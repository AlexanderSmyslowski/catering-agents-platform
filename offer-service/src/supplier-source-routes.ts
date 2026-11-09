import type { FastifyInstance } from "fastify";
import { AUTHENTICATED_SESSION_APPROVAL_ACTOR_SOURCE, hasMinimalMvpCapability, type TrustedActor, type BusinessContext } from "@catering/shared-core";
import { SupplierSourceStore, type SupplierRow, type SupplierSourceConfig, type SupplierSourceRecord } from "./supplier-source-store.js";

type Selection = { uidValidity: string; uid: number; part: string };
export interface SupplierSourceAdapter {
  mailboxBinding(context: BusinessContext, mailboxId: string): Promise<string>;
  listMailboxes(context: BusinessContext): Promise<Array<{id: string; label: string}>>;
  listMessages(context: BusinessContext, mailboxId: string, sender: string): Promise<Array<{uidValidity: string; uid: number; subject: string; from: string; attachments: Array<{part: string}>}>>;
  inspect(context: BusinessContext, mailboxId: string, selection: Selection, sender: string): Promise<unknown>;
  parse(context: BusinessContext, mailboxId: string, selection: Selection, columns: unknown, sender: string, subject?: string): Promise<{bytes: Uint8Array; rows: SupplierRow[]; senderAuthenticated: boolean; complete: boolean; skipped: Array<{row:number;reason:string;article?:string}>; validFrom?: string}>;
}
export const disabledSupplierSourceAdapter: SupplierSourceAdapter = {
  async listMailboxes() { return []; },
  async mailboxBinding() { throw new Error("Mailbox integration unavailable"); },
  async listMessages() { throw new Error("Mailbox integration unavailable"); },
  async inspect() { throw new Error("Mailbox integration unavailable"); },
  async parse() { throw new Error("Mailbox integration unavailable"); }
};
function selection(value: unknown): Selection {
  const input = value as Partial<Selection> | null;
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !["uidValidity", "uid", "part"].includes(key)) || typeof input.uidValidity !== "string" || !/^\d{1,20}$/.test(input.uidValidity) || !Number.isSafeInteger(input.uid) || input.uid! <= 0 || typeof input.part !== "string" || !/^\d+(?:\.\d+)*$/.test(input.part)) throw new Error("Ungültige Nachrichtenauswahl.");
  return { uidValidity: input.uidValidity, uid: input.uid!, part: input.part };
}
function requiredSender(value: unknown): string {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s<>@]+@[^\s<>@]+$/.test(value)) throw new Error("Absenderadresse erforderlich.");
  return canonicalAddress(value);
}
function canonicalAddress(value: string): string {
  const at = value.lastIndexOf("@"); return value.slice(0, at) + "@" + value.slice(at + 1).toLowerCase();
}
function config(value: unknown): SupplierSourceConfig {
  const input = value as Partial<SupplierSourceConfig> | null;
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 120 || typeof input.mailboxId !== "string" || !/^[\w-]{1,80}$/.test(input.mailboxId) || typeof input.sender !== "string" || !/^[^\s<>@]+@[^\s<>@]+$/.test(input.sender) || input.sender.length > 254 || (input.subject !== undefined && (typeof input.subject !== "string" || input.subject.length > 200)) || typeof input.autoApply !== "boolean" || !input.columns || typeof input.columns !== "object" || Array.isArray(input.columns)) throw new Error("Ungültige Quellenkonfiguration.");
  return { name: input.name.trim(), mailboxId: input.mailboxId, sender: canonicalAddress(input.sender), ...(input.subject ? {subject: input.subject} : {}), columns: input.columns, articleMappings: [], autoApply: input.autoApply, mailboxBinding: "" };
}
function mappings(value: unknown): Array<{article: string; ingredientKey: string; quantity: string; unit: string}> {
  if (!Array.isArray(value) || value.length > 10000 || value.some(x => !x || typeof x.article !== "string" || !x.article.trim() || x.article.length > 200 || typeof x.ingredientKey !== "string" || !x.ingredientKey.trim() || x.ingredientKey.length > 200 || typeof x.quantity !== "string" || typeof x.unit !== "string")) throw new Error("Ungültige Artikelzuordnung.");
  return value.map(x => ({article: x.article, ingredientKey: x.ingredientKey, quantity: x.quantity, unit: x.unit}));
}
export function registerSupplierSourceRoutes(app: FastifyInstance, input: {store: SupplierSourceStore; adapter: SupplierSourceAdapter; actorForRequest: (request: {headers: Record<string, string | string[] | undefined>}) => TrustedActor}) {
  app.register(async scope => {
  const base = "/v1/offers/supplier-sources";
  const summary = (source: SupplierSourceRecord) => ({id: source.id, version: source.version, configVersion: source.configVersion, config: (({mailboxBinding: _binding, ...visible}) => visible)(source.config), active: source.active, pollStatus: source.pollStatus ?? null, poll: source.poll ?? null, pendingCount: source.previews.filter(p => !p.appliedAt && !p.discardedAt && p.configVersion === source.configVersion).length});
  scope.addHook("onRequest", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    const actor = input.actorForRequest(request);
    if (!actor.trusted || actor.source !== AUTHENTICATED_SESSION_APPROVAL_ACTOR_SOURCE || !hasMinimalMvpCapability(actor, "commercial")) return reply.code(403).send({message: "Kaufmännische Berechtigung erforderlich."});
    const priceRead = request.method === "GET" && request.url.split("?", 1)[0] === `${base}/prices`;
    if (!priceRead && actor.role !== "admin") return reply.code(403).send({message: "Administratorberechtigung erforderlich."});
  });
  const ctx = (request: {headers: Record<string, string | string[] | undefined>}) => ({businessId: input.actorForRequest(request).businessId});
  const safe = async (reply: {code: (code: number) => {send: (value: unknown) => unknown}}, fn: () => Promise<unknown>) => {
    try { return await fn(); } catch (error) {
      if (error instanceof Error && error.message === "Quellenversion geändert.") return reply.code(409).send({message: "Die Quelle wurde zwischenzeitlich geändert. Bitte neu laden.", code: "version_conflict"});
      if (error instanceof Error && /^(Zu viele Vorschauen|Zu viele Preisbeobachtungen|Zu viele Quellen)/.test(error.message)) return reply.code(409).send({message: "Speichergrenze für Lieferantenpreise erreicht. Betriebliche Bereinigung erforderlich.", code: "capacity_reached"});
      return reply.code(400).send({message: "Quelle oder Nachricht konnte nicht verarbeitet werden. Bitte Angaben prüfen."});
    }
  };
  async function authorized(context: BusinessContext, mailboxId: string) { if (!(await input.adapter.listMailboxes(context)).some(item => item.id === mailboxId)) throw new Error("Postfach nicht freigegeben."); }
  scope.get(`${base}/mailboxes`, async req => ({mailboxes: await input.adapter.listMailboxes(ctx(req))}));
  scope.get<{Params:{id:string}; Querystring:{sender?:unknown}}>(`${base}/mailboxes/:id/messages`, async (req, reply) => safe(reply, async () => { await authorized(ctx(req), req.params.id); return {messages: await input.adapter.listMessages(ctx(req), req.params.id, requiredSender(req.query.sender))}; }));
  scope.post<{Params:{id:string}; Body:unknown}>(`${base}/mailboxes/:id/columns`, async (req, reply) => safe(reply, async () => { await authorized(ctx(req), req.params.id); const body = req.body as Record<string,unknown>; if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ungültige Auswahl."); const {sender,...selected} = body; return input.adapter.inspect(ctx(req), req.params.id, selection(selected), requiredSender(sender)); }));
  scope.get(base, async req => {
    const context = ctx(req);
    const sources = await input.store.list(context);
    return {sources: await Promise.all(sources.map(async source => {
      const visible = summary(source);
      if (source.active) {
        try {
          if (await input.adapter.mailboxBinding(context, source.config.mailboxId) === source.config.mailboxBinding) return visible;
        } catch { /* The configured mailbox may have been disconnected. */ }
        return {...visible, pollStatus: "stalled"};
      }
      return visible;
    }))};
  });
  scope.get<{Querystring:{offset?:string;ingredient?:string}}>(`${base}/prices`, async req => {
    const today = new Date().toISOString().slice(0, 10);
    const latest = new Map<string, {sourceName:string} & SupplierSourceRecord["prices"][number]>();
    for (const source of await input.store.list(ctx(req))) for (const price of source.prices) {
      if (req.query.ingredient && price.ingredientKey.normalize("NFC").toLocaleLowerCase("de-DE") !== req.query.ingredient.trim().normalize("NFC").toLocaleLowerCase("de-DE")) continue;
      if (price.validFrom && price.validFrom > today) continue;
      if (!(source.publishedMappings ?? source.config.articleMappings).some(mapping => mapping.article === price.article && mapping.ingredientKey === price.ingredientKey)) continue;
      const key = JSON.stringify([source.id, price.article, price.ingredientKey]);
      const current = latest.get(key);
      const rank = (p: typeof price) => `${p.validFrom ?? p.observedAt.slice(0, 10)}/${p.observedAt}`;
      if (!current || rank(price) > rank(current)) latest.set(key, {...price, sourceName: price.sourceName ?? source.config.name});
    }
    const offset = /^\d{1,6}$/.test(req.query.offset ?? "") ? Number(req.query.offset) : 0;
    const prices = [...latest.values()].sort((a,b) => a.ingredientKey.localeCompare(b.ingredientKey) || a.sourceId.localeCompare(b.sourceId) || a.article.localeCompare(b.article));
    return {prices: prices.slice(offset, offset + 500), nextOffset: offset + 500 < prices.length ? offset + 500 : null};
  });
  scope.get<{Params:{id:string}}>(`${base}/:id/previews`, async (req, reply) => safe(reply, async () => {
    const source = await input.store.get(ctx(req), req.params.id); if (!source) throw new Error("Quelle nicht gefunden.");
    return {previews: source.previews.filter(p => !p.appliedAt && !p.discardedAt && p.configVersion === source.configVersion).map(({rows, skipped, ...preview}) => ({...preview, rowCount: rows.length, skippedCount: skipped?.length ?? 0, reason: !preview.senderAuthenticated ? "sender_unverified" : !preview.complete ? "incomplete_document" : !preview.validFrom ? "effective_date_unknown" : "review_required"}))};
  }));
  scope.get<{Params:{id:string;previewId:string}}>(`${base}/:id/previews/:previewId`, async (req, reply) => safe(reply, async () => {
    const source = await input.store.get(ctx(req), req.params.id); const preview = source?.previews.find(p => p.id === req.params.previewId && !p.appliedAt && !p.discardedAt && p.configVersion === source.configVersion);
    if (!preview) throw new Error("Vorschau nicht gefunden."); return {preview: {...preview, sourceVersion: source!.version}};
  }));
  scope.post<{Params:{id:string;previewId:string}; Body:{expectedConfigVersion?:unknown;expectedSourceVersion?:unknown}}>(`${base}/:id/previews/:previewId/discard`, async (req, reply) => safe(reply, async () => {
    if (!Number.isSafeInteger(req.body?.expectedConfigVersion) || !Number.isSafeInteger(req.body?.expectedSourceVersion)) throw new Error("Versionsangaben erforderlich.");
    const source = await input.store.get(ctx(req), req.params.id); if (!source) throw new Error("Quelle nicht gefunden.");
    await authorized(ctx(req), source.config.mailboxId);
    if (await input.adapter.mailboxBinding(ctx(req), source.config.mailboxId) !== source.config.mailboxBinding) throw new Error("Postfachbindung geändert.");
    return {source: summary(await input.store.discard(ctx(req), req.params.id, req.params.previewId, {configVersion:req.body.expectedConfigVersion as number, sourceVersion:req.body.expectedSourceVersion as number, mailboxBinding:source.config.mailboxBinding}))};
  }));
  scope.post<{Params:{id:string}}>(`${base}/:id/pause`, async (req, reply) => safe(reply, async () => ({source: summary(await input.store.pause(ctx(req), req.params.id))})));
  scope.post<{Body:unknown}>(base, async (req, reply) => safe(reply, async () => { const body = config(req.body); await authorized(ctx(req), body.mailboxId); body.mailboxBinding = await input.adapter.mailboxBinding(ctx(req), body.mailboxId); if (!body.mailboxBinding) throw new Error("Postfachbindung fehlt."); return {source: summary(await input.store.create(ctx(req), body))}; }));
  scope.put<{Params:{id:string}; Body:unknown}>(`${base}/:id`, async (req, reply) => safe(reply, async () => { const body = config(req.body); const expected = (req.body as {expectedConfigVersion?:unknown})?.expectedConfigVersion; if (!Number.isSafeInteger(expected) || (expected as number) < 1) throw new Error("Versionsangabe fehlt."); await authorized(ctx(req), body.mailboxId); body.mailboxBinding = await input.adapter.mailboxBinding(ctx(req), body.mailboxId); if (!body.mailboxBinding) throw new Error("Postfachbindung fehlt."); return {source: summary(await input.store.configure(ctx(req), req.params.id, body, expected as number))}; }));
  scope.post<{Params:{id:string}; Body:unknown}>(`${base}/:id/preview`, async (req, reply) => safe(reply, async () => {
    const source = await input.store.get(ctx(req), req.params.id);
    if (!source) throw new Error("Quelle nicht gefunden.");
    await authorized(ctx(req), source.config.mailboxId);
    const binding = await input.adapter.mailboxBinding(ctx(req), source.config.mailboxId); if (binding !== source.config.mailboxBinding) throw new Error("Postfachbindung geändert.");
    const selected = selection(req.body);
    const parsed = await input.adapter.parse(ctx(req), source.config.mailboxId, selected, source.config.columns, source.config.sender, source.config.subject);
    await authorized(ctx(req), source.config.mailboxId);
    if (await input.adapter.mailboxBinding(ctx(req), source.config.mailboxId) !== binding) throw new Error("Postfachbindung geändert.");
    const documentKey = JSON.stringify([source.config.mailboxId, selected.uidValidity, selected.uid, selected.part]);
    const updated = await input.store.stage(ctx(req), source.id, {...parsed, documentKey, configVersion: source.configVersion, mailboxBinding: binding});
    const preview = updated.previews.find(p => p.documentKey === documentKey && p.configVersion === source.configVersion);
    if (!preview) throw new Error("Vorschau nicht gefunden.");
    return {preview: {...preview, sourceVersion: updated.version}};
  }));
  scope.post<{Params:{id:string}; Body:{previewId?:unknown; articleMappings?:unknown; removedArticles?:unknown; expectedConfigVersion?:unknown; expectedSourceVersion?:unknown}}>(`${base}/:id/activate`, async (req, reply) => safe(reply, async () => {
    if (typeof req.body?.previewId !== "string" || !Number.isSafeInteger(req.body.expectedConfigVersion) || !Number.isSafeInteger(req.body.expectedSourceVersion)) throw new Error("Vorschau und Versionsangaben erforderlich.");
    const source = await input.store.get(ctx(req), req.params.id); if (!source) throw new Error("Quelle nicht gefunden.");
    const removed = req.body.removedArticles ?? [];
    if (!Array.isArray(removed) || removed.length > 10000 || removed.some(item => typeof item !== "string" || !item.trim() || item.length > 200)) throw new Error("Ungültige Artikelentfernung.");
    await authorized(ctx(req), source.config.mailboxId);
    if (await input.adapter.mailboxBinding(ctx(req), source.config.mailboxId) !== source.config.mailboxBinding) throw new Error("Postfachbindung geändert.");
    return {source: summary(await input.store.apply(ctx(req), req.params.id, req.body.previewId, false, mappings(req.body.articleMappings), {configVersion: req.body.expectedConfigVersion as number, sourceVersion: req.body.expectedSourceVersion as number, mailboxBinding: source.config.mailboxBinding}, removed))};
  }));
  });
}
