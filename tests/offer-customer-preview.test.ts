import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { buildPrintExportApp } from "../print-export/src/index.js";

const secret = "synthetic-customer-preview";
const headers = { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Angebots-Mitarbeiter", "x-catering-business-id": "alpha" };
const env = { CATERING_DEV_AUTH: "1", CATERING_DEFAULT_BUSINESS_ID: "alpha" };

describe("customer offer draft preview", () => {
  it("uses the real pricing route, keeps amounts and portions, and excludes internal material", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-customer-preview-"));
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: { customerName: "SYNTHETISCHER Kunde" } });
      expect(created.statusCode).toBe(201);
      const caseId = created.json().case.caseId;
      const draft = await offer.inject({ method: "POST", url: "/v1/offers/from-text", headers, payload: { caseId, text: "SYNTHETISCH: Abendbuffet für 100 Gäste am 13.11.2026: 55 Portionen Hähnchenragout, 25 Portionen Gemüsebratlinge, 20 Portionen veganes Linsenragout. Interne Notiz: INTERNAL-NARRATIVE." } });
      expect(draft.statusCode).toBe(201);
      const d = draft.json();
      const url = (id: string, view = "kundenentwurf") => `/v1/exports/offers/${id}/html?ansicht=${view}`;
      const unpriced = await print.inject({ method: "GET", url: url(d.draftId), headers });
      expect(unpriced.statusCode).toBe(409);
      const priced = await offer.inject({ method: "POST", url: `/v1/offers/drafts/${d.draftId}/pricing`, headers, payload: {
        revision: d.revision, variantId: d.variantSet[0].variantId, calculation: { lines: [{
          id: "food", label: "Speisen <sicher>", category: "food", quantity: "100", unit: "guest", unitNetCents: 5800,
          taxRateBps: 1900, taxReason: "INTERNAL-TAX", sourceKind: "synthetic", sourceReference: "INTERNAL-SELL-SOURCE",
          directCost: { totalNetCents: 185000, basis: "estimated", estimateDate: "2026-10-25", sourceReference: "INTERNAL-COST-SOURCE" }
        }] }
      } });
      expect(priced.statusCode, priced.body).toBe(201);
      const p = priced.json();
      const preview = await print.inject({ method: "GET", url: url(p.draftId), headers });
      expect(preview.statusCode, preview.body).toBe(200);
      expect(preview.headers["cache-control"]).toBe("no-store");
      for (const text of ["Kundenentwurf", "nicht zum Versand freigegeben", "13.11.2026", "100", "55 Portionen", "25 Portionen", "20 Portionen", "5.800,00", "1.102,00", "6.902,00", "synthetische Testannahmen", "Speisen &lt;sicher&gt;"]) expect(preview.body).toContain(text);
      for (const internal of ["INTERNAL-", "Deckungsbeitrag", "Interne Kosten", "1.850,00", "Weitere Leistungsplanung", "Varianten:", "Offene Punkte:", "Preis- und Steuergrundlage bleiben prüfpflichtig"]) expect(preview.body).not.toContain(internal);
      const saved = await offer.inject({ method: "GET", url: `/v1/offers/drafts/${p.draftId}`, headers });
      expect(saved.json().reviewStatus.publishApproved).toBe(false);
      const internal = await print.inject({ method: "GET", url: url(p.draftId, "intern"), headers });
      expect(internal.body).toContain("INTERNAL-COST-SOURCE");
      expect(internal.body).toContain("INTERNAL-TAX");
      const otherBusiness = await print.inject({ method: "GET", url: url(p.draftId), headers: { ...headers, "x-catering-business-id": "beta" } });
      expect(otherBusiness.statusCode).toBe(404);
      const productionReader = await print.inject({ method: "GET", url: url(p.draftId), headers: { ...headers, "x-catering-actor-name": "Produktions-Leser" } });
      expect(productionReader.statusCode).toBe(403);
      await new OfferStore({ rootDir }).saveDraft({ businessId: "alpha" }, { ...p, draftId: "synthetic-unlinked-preview" });
      const unlinked = await print.inject({ method: "GET", url: url("synthetic-unlinked-preview"), headers });
      expect(unlinked.statusCode).toBe(409);
      expect(unlinked.body).not.toContain("Speisen");
      const stale = await print.inject({ method: "GET", url: url(d.draftId), headers });
      expect(stale.statusCode).toBe(409);
      expect(stale.body).toContain("Auftrag wurde inzwischen geändert");
      expect(stale.body).not.toContain("INTERNAL-");
    } finally {
      await offer.close(); await print.close();
      // macOS keeps local test data recoverable; other CI hosts discard their
      // temporary workspace at job end without needing a destructive fallback.
      if (existsSync("/usr/bin/trash")) execFileSync("/usr/bin/trash", [rootDir]);
    }
  });
});
