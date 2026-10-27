import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOfferApp, OfferStore } from "@catering/offer-service";
import { buildPrintExportApp } from "@catering/print-export";
import { withBusinessTargetCriticalSection } from "@catering/shared-core";
import { newDb } from "pg-mem";

const secret = "synthetic-multitab-export-test";
const env = { CATERING_DEV_AUTH: "1", CATERING_DEFAULT_BUSINESS_ID: "local" };
const headers = {
  "x-catering-trusted-secret": secret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "local"
};
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    try { execFileSync("/usr/bin/trash", [root], { stdio: "ignore" }); } catch {}
  }
});

describe("Angebotsexport nach Änderungen in einem anderen Tab", () => {
  it("rejects the old case draft and exports the current draft after another tab saves", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-multitab-export-"));
    roots.push(rootDir);
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
      expect(created.statusCode, created.body).toBe(201);
      const caseId = created.json().case.caseId;
      const makeDraft = (requestId: string, text: string) => offer.inject({
        method: "POST", url: "/v1/offers/from-text", headers, payload: { caseId, requestId, text }
      });
      const first = await makeDraft("synthetic-tab-a", "SYNTHETISCHER TEST: Empfang für 100 Gäste.");
      expect(first.statusCode, first.body).toBe(201);
      const oldDraft = first.json().draftId as string;
      const initialExport = await print.inject({ method: "GET", url: "/v1/exports/offers/" + oldDraft + "/html", headers });
      expect(initialExport.statusCode, initialExport.body).toBe(200);

      const second = await makeDraft("synthetic-tab-b", "SYNTHETISCHER TEST: Empfang für 100 Gäste, Menü geändert.");
      expect(second.statusCode, second.body).toBe(201);
      const currentDraft = second.json().draftId as string;
      expect(currentDraft).not.toBe(oldDraft);

      const stale = await print.inject({ method: "GET", url: "/v1/exports/offers/" + oldDraft + "/html", headers });
      expect(stale.statusCode).toBe(409);
      expect(stale.body).toContain("Auftrag wurde inzwischen geändert");
      expect(stale.body).not.toContain("SYNTHETISCHER TEST");
      expect(stale.headers["cache-control"]).toContain("no-store");
      const archived = await print.inject({ method: "GET", url: "/v1/exports/offers/" + oldDraft + "/html?ansicht=archiv", headers });
      expect(archived.statusCode, archived.body).toBe(200);
      expect(archived.body).toContain("Ältere Angebotsfassung");
      expect(archived.body).toContain("nicht an Kunden versenden");

      const current = await print.inject({ method: "GET", url: "/v1/exports/offers/" + currentDraft + "/html", headers });
      expect(current.statusCode, current.body).toBe(200);
      expect(current.headers["cache-control"]).toContain("no-store");
    } finally {
      await offer.close();
      await print.close();
    }
  });

  it.each(["tied-sequence", "missing-reference", "ambiguous-case", "revision-drift", "revision-created"] as const)(
    "fails closed when the case history is ambiguous: %s", async ambiguity => {
      const rootDir = mkdtempSync(path.join(tmpdir(), "catering-export-invalid-history-"));
      roots.push(rootDir);
      const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
      const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
      const store = new OfferStore({ rootDir });
      const context = { businessId: "local" };
      try {
        const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
        const caseId = created.json().case.caseId as string;
        const first = await offer.inject({ method: "POST", url: "/v1/offers/from-text", headers,
          payload: { caseId, requestId: "synthetic-conflict", text: "SYNTHETISCH: Empfang für 100 Gäste." } });
        expect(first.statusCode, first.body).toBe(201);
        const draft = first.json();
        if (ambiguity === "revision-drift") {
          await store.saveDraft(context, { ...draft, revision: draft.revision + 1 });
        } else {
          const events = await store.listEvents(context, caseId);
          const original = events.find(event => event.kind === "draft_created" && event.artifactId === draft.draftId)!;
          let targetCaseId = caseId;
          if (ambiguity === "ambiguous-case") {
            const other = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
            targetCaseId = other.json().case.caseId;
          }
          const record = { ...original, eventId: "synthetic-conflict-" + ambiguity, caseId: targetCaseId,
            kind: ambiguity === "revision-created" ? "revision_created" as const : original.kind,
            sequence: ambiguity === "tied-sequence" ? original.sequence : original.sequence + 1,
            artifactId: ambiguity === "ambiguous-case" ? draft.draftId : "synthetic-other-draft",
            revisionRef: ambiguity === "missing-reference" ? undefined : {
              ...original.revisionRef!, artifactId: ambiguity === "ambiguous-case" ? draft.draftId : "synthetic-other-draft"
            }
          };
          const raw = store as unknown as { caseEvents: { insert: (context: { businessId: string }, event: typeof record) => Promise<string> } };
          expect(await raw.caseEvents.insert(context, record)).toBe("created");
        }
        const result = await print.inject({ method: "GET", url: "/v1/exports/offers/" + draft.draftId + "/html", headers });
        expect(result.statusCode, result.body).toBe(409);
        expect(result.body).not.toContain("SYNTHETISCH: Empfang");
      } finally {
        await offer.close();
        await print.close();
      }
    }
  );

  it("returns a conflict for a linked draft whose case is missing", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-export-missing-case-"));
    roots.push(rootDir);
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    const store = new OfferStore({ rootDir });
    const context = { businessId: "local" };
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
      const caseId = created.json().case.caseId as string;
      const first = await offer.inject({ method: "POST", url: "/v1/offers/from-text", headers,
        payload: { caseId, requestId: "missing-case-source", text: "SYNTHETISCH: 100 Gäste." } });
      expect(first.statusCode, first.body).toBe(201);
      const orphanId = "synthetic-draft-missing-case";
      await store.saveDraft(context, { ...first.json(), draftId: orphanId });
      const original = (await store.listEvents(context, caseId)).find(event => event.kind === "draft_created")!;
      const event = { ...original, eventId: "synthetic-missing-case-event", caseId: "synthetic-case-does-not-exist",
        artifactId: orphanId, revisionRef: { ...original.revisionRef!, artifactId: orphanId } };
      const raw = store as unknown as { caseEvents: { insert: (context: { businessId: string }, item: typeof event) => Promise<string> } };
      expect(await raw.caseEvents.insert(context, event)).toBe("created");
      const result = await print.inject({ method: "GET", url: "/v1/exports/offers/" + orphanId + "/html", headers });
      expect(result.statusCode, result.body).toBe(409);
    } finally {
      await offer.close();
      await print.close();
    }
  });

  it("suppresses customer text for an explicitly archived formerly approved draft", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-export-approved-archive-"));
    roots.push(rootDir);
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    const store = new OfferStore({ rootDir });
    const context = { businessId: "local" };
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
      const caseId = created.json().case.caseId as string;
      const createDraft = (requestId: string) => offer.inject({ method: "POST", url: "/v1/offers/from-text", headers,
        payload: { caseId, requestId, text: "SYNTHETISCH: 100 Gäste." } });
      const first = await createDraft("archive-source");
      expect(first.statusCode, first.body).toBe(201);
      const archivedId = "synthetic-formerly-approved";
      const draft = { ...first.json(), draftId: archivedId, customerFacingText: "SYNTHETISCHER-ALTER-KUNDENTEXT",
        reviewStatus: { priceReviewStatus: "verified", taxReviewStatus: "verified", allergenReviewStatus: "verified",
          hygieneTemperatureReviewStatus: "verified", sourceSecured: true, publishApproved: true } };
      expect(await store.saveDraftForCase(context, caseId, draft)).toBe("saved");
      const before = await print.inject({ method: "GET", url: "/v1/exports/offers/" + archivedId + "/html", headers });
      expect(before.statusCode, before.body).toBe(200);
      expect(before.body).toContain("SYNTHETISCHER-ALTER-KUNDENTEXT");
      const newer = await createDraft("archive-newer");
      expect(newer.statusCode, newer.body).toBe(201);
      const archived = await print.inject({ method: "GET", url: "/v1/exports/offers/" + archivedId + "/html?ansicht=archiv", headers });
      expect(archived.statusCode, archived.body).toBe(200);
      expect(archived.body).toContain("Ältere Angebotsfassung");
      expect(archived.body).toContain("nicht an Kunden versenden");
      expect(archived.body).not.toContain("SYNTHETISCHER-ALTER-KUNDENTEXT");
      expect(archived.body).toContain("Angebotsentwurf · interne Prüfung");
    } finally {
      await offer.close();
      await print.close();
    }
  });

  it("rechecks the case after an edit commits while export is starting", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-export-race-"));
    roots.push(rootDir);
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const original = OfferStore.prototype.getDraft;
    const spy = vi.spyOn(OfferStore.prototype, "getDraft");
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
      const caseId = created.json().case.caseId;
      const createDraft = (requestId: string) => offer.inject({
        method: "POST", url: "/v1/offers/from-text", headers,
        payload: { caseId, requestId, text: "SYNTHETISCH: Veranstaltung für 100 Gäste." }
      });
      const first = await createDraft("race-first");
      expect(first.statusCode, first.body).toBe(201);
      const oldDraft = first.json().draftId as string;
      spy.mockImplementation(async function (this: OfferStore, ...args) {
        const result = await original.apply(this, args);
        if (args[1] === oldDraft) {
          entered();
          await resume;
        }
        return result;
      });
      const pendingExport = print.inject({ method: "GET", url: "/v1/exports/offers/" + oldDraft + "/html", headers });
      await waiting;
      const second = await createDraft("race-second");
      expect(second.statusCode, second.body).toBe(201);
      release();
      const result = await pendingExport;
      expect(result.statusCode).toBe(409);
      expect(result.body).toContain("Auftrag wurde inzwischen geändert");
    } finally {
      release();
      spy.mockRestore();
      await offer.close();
      await print.close();
    }
  });

  it("serializes a waiting case edit and export using the existing case lock", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-export-case-lock-"));
    roots.push(rootDir);
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    const context = { businessId: "local" };
    let release = () => {};
    let holding: Promise<void> | undefined;
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
      const caseId = created.json().case.caseId as string;
      const createDraft = (requestId: string) => offer.inject({
        method: "POST", url: "/v1/offers/from-text", headers,
        payload: { caseId, requestId, text: "SYNTHETISCH: Veranstaltung für 100 Gäste." }
      });
      const first = await createDraft("lock-first");
      expect(first.statusCode, first.body).toBe(201);
      const draftId = first.json().draftId as string;
      const target = { kind: "offer_case", artifactId: caseId, revision: 0 };
      const identity = JSON.stringify({ businessId: context.businessId, ...target });
      const hash = createHash("sha256").update(identity).digest("hex");
      const queuePath = path.join(rootDir, "businesses", "local", "offers", "case-events", ".decision-target-locks", hash + ".lock.queue");
      let entered!: () => void;
      const enteredLock = new Promise<void>(resolve => { entered = resolve; });
      const resume = new Promise<void>(resolve => { release = resolve; });
      holding = withBusinessTargetCriticalSection({
        storage: { rootDir }, context, target, collectionNamespace: "offers/case-events",
        queueFullMessage: "queue full", timeoutMessage: "lock timeout",
        legacyTimeoutMessage: "legacy lock timeout", postgresPoolMessage: "pool required",
        operation: async () => { entered(); await resume; }
      });
      await enteredLock;
      const count = () => existsSync(queuePath) ? readdirSync(queuePath).filter(name => /^ticket-[0-9]+[.]json$/.test(name)).length : 0;
      const before = count();
      const waitForTickets = async (minimum: number) => {
        const deadline = Date.now() + 3000;
        while (count() < minimum && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
        expect(count()).toBeGreaterThanOrEqual(minimum);
      };
      let writerFinished = false;
      const writer = createDraft("lock-second").then(result => { writerFinished = true; return result; });
      await waitForTickets(before + 1);
      let exportFinished = false;
      const exported = print.inject({ method: "GET", url: "/v1/exports/offers/" + draftId + "/html", headers })
        .then(result => { exportFinished = true; return result; });
      await waitForTickets(before + 2);
      expect(writerFinished).toBe(false);
      expect(exportFinished).toBe(false);
      release();
      expect((await writer).statusCode).toBe(201);
      expect((await exported).statusCode).toBe(409);
      await holding;
    } finally {
      release();
      await holding;
      await offer.close();
      await print.close();
    }
  });

  it("uses the PostgreSQL transaction client for case and draft export reads", async () => {
    const { Pool } = newDb().adapters.createPg();
    const base = new Pool();
    let enforceTransactionReads = false;
    let inTransaction = false;
    let exportCommits = 0;
    const pgPool = {
      async query(sql: string, params?: unknown[]) {
        if (enforceTransactionReads && inTransaction) throw new Error("Export escaped its transaction client");
        return base.query(sql, params);
      },
      async connect() {
        const client = await base.connect();
        return {
          async query(sql: string, params?: unknown[]) {
            if (sql === "BEGIN") inTransaction = true;
            // pg-mem lacks advisory locks; this verifies transaction-client use, not real database locking.
            if (sql.startsWith("SELECT pg_catalog.pg_advisory_xact_lock") || sql.startsWith("SELECT pg_catalog.set_config")) return { rows: [] };
            const result = await client.query(sql, params);
            if (sql === "COMMIT" || sql === "ROLLBACK") {
              if (sql === "COMMIT" && enforceTransactionReads) exportCommits++;
              inTransaction = false;
            }
            return result;
          },
          release: () => client.release()
        };
      }
    };
    const offer = buildOfferApp({ pgPool, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ pgPool, trustedActorSecret: secret, env });
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
      expect(created.statusCode, created.body).toBe(201);
      const caseId = created.json().case.caseId as string;
      const createDraft = (requestId: string) => offer.inject({
        method: "POST", url: "/v1/offers/from-text", headers,
        payload: { caseId, requestId, text: "SYNTHETISCH: Veranstaltung für 100 Gäste." }
      });
      const first = await createDraft("pg-first");
      const second = await createDraft("pg-second");
      expect(first.statusCode, first.body).toBe(201);
      expect(second.statusCode, second.body).toBe(201);
      enforceTransactionReads = true;
      const oldExport = await print.inject({ method: "GET", url: "/v1/exports/offers/" + first.json().draftId + "/html", headers });
      const newExport = await print.inject({ method: "GET", url: "/v1/exports/offers/" + second.json().draftId + "/html", headers });
      expect(oldExport.statusCode, oldExport.body).toBe(409);
      expect(newExport.statusCode, newExport.body).toBe(200);
      expect(exportCommits).toBe(2);
    } finally {
      await offer.close();
      await print.close();
      await base.end();
    }
  });

  it("marks unlinked older drafts as internal and unverified rather than a current customer offer", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-legacy-export-"));
    roots.push(rootDir);
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    try {
      const seeded = await offer.inject({
        method: "POST", url: "/v1/offers/seed-demo",
        headers: { ...headers, "x-catering-actor-name": "Betriebs-/Audit-Operator" }
      });
      expect(seeded.statusCode, seeded.body).toBe(201);
      const draftId = seeded.json().seeded[0].draftId as string;
      const result = await print.inject({ method: "GET", url: "/v1/exports/offers/" + draftId + "/html", headers });
      expect(result.statusCode, result.body).toBe(200);
      expect(result.body).toContain("Fassung nicht als aktuelles Angebot bestätigt");
      expect(result.body).toContain("nicht an Kunden versenden");
      expect(result.headers["cache-control"]).toContain("no-store");

      const store = new OfferStore({ rootDir });
      const legacy = await store.getDraft({ businessId: "local" }, draftId);
      expect(legacy).toBeDefined();
      await store.saveDraft({ businessId: "local" }, {
        ...legacy!, draftId: "synthetic-unlinked-approved", customerFacingText: "SYNTHETISCHER-KUNDENTEXT-NICHT-AUSGEBEN",
        reviewStatus: { priceReviewStatus: "verified", taxReviewStatus: "verified", allergenReviewStatus: "verified",
          hygieneTemperatureReviewStatus: "verified", sourceSecured: true, publishApproved: true }
      });
      const approvedLegacy = await print.inject({ method: "GET", url: "/v1/exports/offers/synthetic-unlinked-approved/html", headers });
      expect(approvedLegacy.statusCode, approvedLegacy.body).toBe(200);
      expect(approvedLegacy.body).toContain("Fassung nicht als aktuelles Angebot bestätigt");
      expect(approvedLegacy.body).not.toContain("SYNTHETISCHER-KUNDENTEXT-NICHT-AUSGEBEN");
      expect(approvedLegacy.body).toContain("Angebotsentwurf · interne Prüfung");
    } finally {
      await offer.close();
      await print.close();
    }
  });
});
