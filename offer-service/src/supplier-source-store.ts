import { createHash, randomUUID } from "node:crypto";
import { createBusinessScopedPersistentCollection, type BusinessContext, type CollectionStorageOptions } from "@catering/shared-core";

export interface SupplierRow { article: string; description: string; quantity: string; unit: string; price: string }
export interface SupplierSourceConfig {
  name: string; mailboxId: string; sender: string; subject?: string;
  columns: unknown; articleMappings: Array<{article: string; ingredientKey: string; quantity: string; unit: string; rawQuantity: string; rawUnit: string}>; autoApply: boolean; mailboxBinding: string;
}
export interface SupplierPreview {
  id: string; documentKey: string; contentHash: string; configVersion: number;
  senderAuthenticated: boolean; complete: boolean; skipped?: Array<{row: number; reason: string; article?: string}>; rows: SupplierRow[]; appliedArticles?: string[]; createdAt: string; validFrom?: string; appliedAt?: string; discardedAt?: string;
}
export interface SupplierPrice extends SupplierRow {
  ingredientKey: string; sourceName?: string; rawQuantity: string; rawUnit: string; sourceId: string; previewId: string; observedAt: string; validFrom?: string;
}
export interface SupplierSourceRecord {
  id: string; version: number; configVersion: number; config: SupplierSourceConfig;
  active: boolean; previews: SupplierPreview[]; prices: SupplierPrice[]; publishedMappings?: SupplierSourceConfig["articleMappings"]; pollStatus?: "stalled"; poll?: {uidValidity: string; lastUid: number; status: "ok" | "stalled"};
}

/** One source record contains the approval and prices so publication is a single atomic CAS. */
export class SupplierSourceStore {
  private readonly records;
  constructor(options: CollectionStorageOptions = {}) {
    this.records = createBusinessScopedPersistentCollection<SupplierSourceRecord>({
      ...options, collectionName: "offer/supplier-sources", getId: item => item.id, getVersion: item => item.version
    });
  }
  list(context: BusinessContext) { return this.records.list(context); }
  get(context: BusinessContext, id: string) { return this.records.get(context, id); }
  async create(context: BusinessContext, config: SupplierSourceConfig) {
    if ((await this.records.list(context)).length >= 100) throw new Error("Zu viele Quellen.");
    const record: SupplierSourceRecord = { id: randomUUID(), version: 1, configVersion: 1, config, active: false, previews: [], prices: [] };
    if (await this.records.insert(context, record) !== "created") throw new Error("Quelle konnte nicht angelegt werden.");
    return record;
  }
  private async mutate(context: BusinessContext, id: string, fn: (value: SupplierSourceRecord) => SupplierSourceRecord): Promise<SupplierSourceRecord> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const current = await this.records.get(context, id);
      if (!current) throw new Error("Quelle nicht gefunden.");
      const result = fn(current);
      if (result === current) return current;
      const next = { ...result, version: current.version + 1 };
      if (await this.records.compareAndSet(context, id, current.version, next) === "updated") return next;
    }
    throw new Error("Quelle wurde gleichzeitig geändert. Bitte erneut versuchen.");
  }
  configure(context: BusinessContext, id: string, config: SupplierSourceConfig, expectedConfigVersion: number) {
    return this.mutate(context, id, current => {
      if (current.configVersion !== expectedConfigVersion) throw new Error("Quellenversion geändert.");
      return ({ ...current, config, configVersion: current.configVersion + 1, active: false, poll: undefined, previews: current.previews.map(preview => ({...preview, rows: [], skipped: undefined})) });
    });
  }
  stage(context: BusinessContext, id: string, input: { documentKey: string; bytes: Uint8Array; rows: SupplierRow[]; senderAuthenticated: boolean; configVersion: number; validFrom?: string; automatic?: boolean; mailboxBinding: string; complete: boolean; skipped: Array<{row: number; reason: string; article?: string}> }) {
    const contentHash = createHash("sha256").update(input.bytes).digest("hex");
    return this.mutate(context, id, current => {
      if (!Array.isArray(input.skipped) || (input.skipped?.length ?? 0) > 2000 || input.skipped?.some(item => !Number.isSafeInteger(item.row) || item.row <= 0 || typeof item.reason !== "string" || item.reason.length > 200 || (item.article !== undefined && (typeof item.article !== "string" || !item.article.trim() || item.article.length > 200))) || input.rows.length > 2000 || input.bytes.byteLength > 5_000_000 || (input.validFrom && (!/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom) || !Number.isFinite(Date.parse(input.validFrom)) || new Date(input.validFrom).toISOString().slice(0, 10) !== input.validFrom))) throw new Error("Ungültige oder zu große Vorschau.");
      if (input.mailboxBinding !== current.config.mailboxBinding || (input.automatic && !current.active) || current.configVersion !== input.configVersion) throw new Error("Quelle wurde geändert. Bitte erneut prüfen.");
      const existing = current.previews.find(p => p.documentKey === input.documentKey && p.configVersion === input.configVersion);
      if (existing) {
        if (existing.contentHash !== contentHash) throw new Error("Die Dokumentkennung wurde mit anderem Inhalt wiederverwendet.");
        return current;
      }
      if (current.previews.length >= 10000) throw new Error("Zu viele Vorschauen; betriebliche Bereinigung erforderlich.");
      if (current.previews.filter(p => !p.appliedAt && !p.discardedAt && p.configVersion === current.configVersion).length >= 100) throw new Error("Zu viele Vorschauen; betriebliche Bereinigung erforderlich.");
      const preview: SupplierPreview = { ...(input.validFrom ? {validFrom: input.validFrom} : {}), id: randomUUID(), documentKey: input.documentKey, contentHash, configVersion: input.configVersion, senderAuthenticated: input.senderAuthenticated, complete: input.complete === true, ...(input.skipped?.length ? {skipped:input.skipped} : {}), rows: input.rows, createdAt: new Date().toISOString() };
      return { ...current, previews: [...current.previews, preview] };
    });
  }
  recordPoll(context: BusinessContext, id: string, input: {configVersion: number; mailboxBinding: string; expected?: {uidValidity: string; lastUid: number}; next: {uidValidity: string; lastUid: number}; status: "ok" | "stalled"}) {
    return this.mutate(context, id, current => {
      if (!current.active || current.configVersion !== input.configVersion || current.config.mailboxBinding !== input.mailboxBinding) throw new Error("Quelle ist nicht aktiv oder wurde geändert.");
      const old = current.poll;
      if ((old?.uidValidity ?? null) !== (input.expected?.uidValidity ?? null) || (old?.lastUid ?? null) !== (input.expected?.lastUid ?? null)) throw new Error("Abfragestand wurde gleichzeitig geändert.");
      if (!/^\d{1,20}$/.test(input.next.uidValidity) || !Number.isSafeInteger(input.next.lastUid) || input.next.lastUid < 0 || (old && old.uidValidity === input.next.uidValidity && input.next.lastUid < old.lastUid) || (old && old.uidValidity !== input.next.uidValidity && input.next.lastUid !== 0) || (input.status === "stalled" && (old ? old.uidValidity !== input.next.uidValidity || old.lastUid !== input.next.lastUid : input.next.lastUid !== 0))) throw new Error("Ungültiger Abfragestand.");
      return {...current, pollStatus: input.status === "stalled" ? "stalled" : undefined, poll: {...input.next, status: input.status}};
    });
  }
  recordPollFailure(context: BusinessContext, id: string, input: {configVersion: number; mailboxBinding: string}) {
    return this.mutate(context, id, current => {
      if (!current.active || current.configVersion !== input.configVersion || current.config.mailboxBinding !== input.mailboxBinding) throw new Error("Quelle ist nicht aktiv oder wurde geändert.");
      return {...current, pollStatus: "stalled"};
    });
  }
  pause(context: BusinessContext, id: string) { return this.mutate(context, id, current => ({ ...current, active: false, configVersion: current.configVersion + 1, previews: current.previews.map(preview => ({...preview, rows: [], skipped: undefined})) })); }
  discard(context: BusinessContext, id: string, previewId: string, expected: {configVersion: number; sourceVersion: number; mailboxBinding: string}) {
    return this.mutate(context, id, current => {
      if (current.version !== expected.sourceVersion || current.configVersion !== expected.configVersion || current.config.mailboxBinding !== expected.mailboxBinding) throw new Error("Quellenversion geändert.");
      const preview = current.previews.find(p => p.id === previewId);
      if (!preview || preview.configVersion !== current.configVersion || preview.appliedAt || preview.discardedAt) throw new Error("Vorschau nicht mehr offen.");
      return {...current, previews: current.previews.map(p => p.id === previewId ? {...p, discardedAt: new Date().toISOString(), rows: [], skipped: undefined, appliedArticles: undefined} : p)};
    });
  }
  apply(context: BusinessContext, id: string, previewId: string, automatic = false, approvedMappings?: Array<{article: string; ingredientKey: string; quantity: string; unit: string}>, expected?: {configVersion: number; mailboxBinding: string; sourceVersion?: number}, removedArticles: string[] = []) {
    return this.mutate(context, id, current => {
      if (!expected || current.configVersion !== expected.configVersion || current.config.mailboxBinding !== expected.mailboxBinding) throw new Error("Quellenversion geändert.");
      if (expected.sourceVersion !== undefined && current.version !== expected.sourceVersion) throw new Error("Quellenversion geändert.");
      const preview = current.previews.find(p => p.id === previewId);
      if (!preview || preview.configVersion !== current.configVersion) throw new Error("Vorschau ist nicht mehr gültig.");
      if (preview.discardedAt) throw new Error("Vorschau wurde verworfen.");
      if (preview.appliedAt) return current;
      if (automatic && (!current.active || !current.config.autoApply || !preview.senderAuthenticated || !preview.validFrom || !preview.complete)) throw new Error("Automatische Übernahme nicht freigegeben.");
      if (automatic && approvedMappings) throw new Error("Zuordnungen müssen manuell bestätigt werden.");
      if (automatic && removedArticles.length) throw new Error("Zuordnungen müssen manuell entfernt werden.");
      if (new Set(removedArticles).size !== removedArticles.length || removedArticles.some(article => typeof article !== "string" || !article.trim() || article.length > 200) || approvedMappings?.some(item => removedArticles.includes(item.article))) throw new Error("Ungültige Artikelentfernung.");
      const reviewedMappings = approvedMappings ? approvedMappings.map(item => {
        const row = preview.rows.find(candidate => candidate.article === item.article);
        if (!row) throw new Error("Artikel nicht in Vorschau.");
        return {...item, rawQuantity: row.quantity, rawUnit: row.unit};
      }) : current.config.articleMappings;
      const previouslyApplied = new Set(preview.appliedArticles ?? []);
      if (reviewedMappings.some(item => {
        if (!previouslyApplied.has(item.article)) return false;
        const existing = current.config.articleMappings.find(mapping => mapping.article === item.article);
        return !existing || existing.ingredientKey !== item.ingredientKey || existing.quantity !== item.quantity || existing.unit !== item.unit || existing.rawQuantity !== item.rawQuantity || existing.rawUnit !== item.rawUnit;
      })) throw new Error("Bereits bestätigte Artikel benötigen eine neue Vorschau für Änderungen.");
      const selectedMappings = approvedMappings ? [...current.config.articleMappings.filter(previous => !removedArticles.includes(previous.article) && !reviewedMappings.some(item => item.article === previous.article)), ...reviewedMappings] : reviewedMappings;
      if (new Set(selectedMappings.map(item => item.article)).size !== selectedMappings.length || selectedMappings.some(item => !item.article.trim() || !item.ingredientKey.trim())) throw new Error("Ungültige Artikelzuordnung.");
      const mappings = new Map(selectedMappings.map(item => [item.article, item]));
      if (automatic && preview.skipped?.some(item => !item.article)) throw new Error("Unklare Position erfordert Prüfung.");
      const previousArticles = new Set(preview.appliedArticles ?? []);
      const selectedNow = new Set(reviewedMappings.map(item => item.article));
      const mapped = preview.rows.filter(row => mappings.has(row.article) && (automatic || selectedNow.has(row.article)) && !previousArticles.has(row.article));
      const unresolved = (preview.skipped?.some(item => !item.article || mappings.has(item.article)) ?? false) || (!automatic && preview.rows.some(row => !selectedNow.has(row.article) && !previousArticles.has(row.article) && !removedArticles.includes(row.article)));
      if (!mapped.length) {
        if (!automatic && removedArticles.length) {
          if (!current.active || removedArticles.some(article => !current.config.articleMappings.some(item => item.article === article) || !preview.rows.some(row => row.article === article))) throw new Error("Artikelentfernung nicht möglich.");
          return {...current, config:{...current.config,articleMappings:selectedMappings}, publishedMappings:(current.publishedMappings ?? []).filter(item => !removedArticles.includes(item.article)), previews:current.previews.map(p => p.id === previewId && !unresolved ? {...p,appliedAt:new Date().toISOString(),rows:[],skipped:undefined,appliedArticles:undefined} : p)};
        }
        if (previousArticles.size && unresolved) return current;
        throw new Error("Keine zugeordneten Artikel in der Vorschau.");
      }
      if (new Set(mapped.map(row => row.article)).size !== mapped.length || mapped.some(row => !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(mappings.get(row.article)!.quantity) || Number(mappings.get(row.article)!.quantity) <= 0 || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,4})?$/.test(row.price) || Number(row.price) <= 0 || !["kg", "g", "l", "ml", "Stück"].includes(mappings.get(row.article)!.unit))) throw new Error("Preis oder Preisbezug ist unklar; Prüfung erforderlich.");
      if (current.prices.length + mapped.length > 20000) throw new Error("Zu viele Preisbeobachtungen; betriebliche Bereinigung erforderlich.");
      if (automatic && mapped.some(row => { const previous = [...current.prices].reverse().find(price => price.article === row.article); return previous && (previous.ingredientKey !== mappings.get(row.article)!.ingredientKey || previous.description !== row.description || mappings.get(row.article)!.rawUnit !== row.unit || mappings.get(row.article)!.rawQuantity !== row.quantity); })) throw new Error("Preisbezug geändert; Prüfung erforderlich.");
      if (automatic) {
        const micros = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, "0")); };
        for (const row of mapped) {
          const prior = current.prices.filter(p => p.article === row.article && p.ingredientKey === mappings.get(row.article)!.ingredientKey && p.validFrom && p.validFrom <= preview.validFrom!).sort((a,b) => (b.validFrom! + b.observedAt).localeCompare(a.validFrom! + a.observedAt))[0];
          if (!prior) throw new Error("Kein vergleichbarer bestätigter Preis; Prüfung erforderlich.");
          const old = micros(prior.price), next = micros(row.price);
          if ((next > old ? next - old : old - next) * 4n > old) throw new Error("Preisabweichung über 25 Prozent; Prüfung erforderlich.");
        }
      }
      let poll = current.poll;
      if (!automatic && !poll && !current.active) {
        let key: unknown;
        try { key = JSON.parse(preview.documentKey); } catch { throw new Error("Ungültige Dokumentkennung."); }
        if (!Array.isArray(key) || key.length !== 4 || key[0] !== current.config.mailboxId || typeof key[1] !== "string" || !/^\d{1,20}$/.test(key[1]) || !Number.isSafeInteger(key[2]) || key[2] <= 0 || typeof key[3] !== "string" || !/^\d+(?:\.\d+)*$/.test(key[3])) throw new Error("Ungültige Dokumentkennung.");
        poll = {uidValidity:key[1],lastUid:key[2],status:"ok"};
      }
      const appliedAt = new Date().toISOString();
      const prices = mapped.map(row => ({ ...row, rawQuantity: row.quantity, rawUnit: row.unit, quantity: mappings.get(row.article)!.quantity, unit: mappings.get(row.article)!.unit, ingredientKey: mappings.get(row.article)!.ingredientKey, sourceName: current.config.name, sourceId: id, previewId, observedAt: preview.createdAt, ...(preview.validFrom ? {validFrom: preview.validFrom} : {}) }));
      return { ...current, config: { ...current.config, articleMappings: selectedMappings }, publishedMappings: [...(current.publishedMappings ?? []).filter(previous => !removedArticles.includes(previous.article) && !selectedMappings.some(item => item.article === previous.article)), ...selectedMappings], active: true, poll, previews: current.previews.map(p => p.id === previewId ? (unresolved ? {...p, appliedArticles: [...previousArticles, ...mapped.map(row => row.article)]} : {...p, appliedAt, rows: [], skipped: undefined, appliedArticles: undefined}) : p), prices: [...current.prices, ...prices] };
    });
  }
}
