import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import { analyzeIntakeText } from "../shared-core/src/intake-signals.js";

const secret = "synthetic-open-extra-test";
const env = { CATERING_DEV_AUTH: "1", CATERING_DEFAULT_BUSINESS_ID: "local" };
const headers = { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Angebots-Mitarbeiter", "x-catering-business-id": "local" };
describe("unquantified offer extras", () => {
  it.each([
    "Korkgeld 15 € pro Flasche, Flaschenzahl offen.",
    "Korkgeld 15 € pro Flasche, 10 Flaschen.",
    "Korkgeld 15 € pro Flasche, ungefähr 10 Flaschen.",
    "Korkgeld 15 € pro Flasche, maximal 10 Flaschen.",
    "Kein Korkgeld: 15 € pro Flasche."
  ])("preserves the quoted price as a question through pricing and export: %s", async extra => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "synthetic-open-extra-"));
    const offer = buildOfferApp({ rootDir, trustedActorSecret: secret, env });
    const print = buildPrintExportApp({ rootDir, trustedActorSecret: secret, env });
    try {
      const created = await offer.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
      const initial = await offer.inject({ method: "POST", url: "/v1/offers/from-text", headers, payload: { caseId: created.json().case.caseId, text: `SYNTHETISCH: Abendbuffet für 60 Gäste. ${extra}` } });
      expect(initial.statusCode, initial.body).toBe(201);
      const draft = initial.json();
      expect(draft.openQuestions.join(" ")).toMatch(/Wie werden die Angabe .*Korkgeld.*15.*Flasche.*abrechenbare Menge/i);
      const rows = [
        ["food", "Speisen", "food", "60", "guest", 6900], ["staff", "Service", "staff", "45", "hour", 4555],
        ["delivery", "Lieferung", "logistics", "1", "flat", 15000], ["cleaning", "Reinigung", "equipment", "1", "flat", 33600],
        ["equipment", "Infrastruktur", "equipment", "1", "flat", 25000]
      ].map(([id,label,category,quantity,unit,unitNetCents]) => ({ id,label,category,quantity,unit,unitNetCents,sourceKind:"operator",sourceReference:"Synthetischer Test" }));
      const priced = await offer.inject({ method:"POST", url:`/v1/offers/drafts/${draft.draftId}/pricing`, headers, payload:{ revision:draft.revision, variantId:draft.variantSet[0].variantId, calculation:{lines:rows} } });
      expect(priced.statusCode, priced.body).toBe(201);
      const revised = priced.json();
      expect(revised.openQuestions.join(" ")).toMatch(/Wie werden die Angabe .*Korkgeld.*15.*Flasche.*abrechenbare Menge/i);
      expect(revised.pricingSummary.calculation.netCents).toBe(692575);
      expect(revised.pricingSummary.calculation.grossCents).toBeUndefined();
      expect(revised.pricingSummary.calculation.lines).toHaveLength(5);
      expect(revised.reviewStatus.publishApproved).toBe(false);
      const html = await print.inject({ method:"GET",url:`/v1/exports/offers/${revised.draftId}/html`,headers });
      expect(html.statusCode, html.body).toBe(200);
      expect(html.body).toMatch(/Wie werden die Angabe .*Korkgeld.*15.*Flasche.*abrechenbare Menge/i);
      if (extra.startsWith("Kein")) expect(html.body).toContain("kein Korkgeld bei gleichzeitig genanntem Preis");
      expect(html.body).toContain("6.925,75");
      expect(html.body).toContain("Brutto gesamt: offen");
    } finally { await offer.close(); await print.close(); }
  });
  it("does not invent a corkage question without the charge", () => {
    expect(analyzeIntakeText("Synthetisches Buffet für 60 Gäste.").uncertainties.some(item => item.field === "offer.extra")).toBe(false);
    expect(analyzeIntakeText("Korkgeld 15,50 EUR je Flasche, Flaschenzahl unbekannt.").uncertainties.some(item => item.suggestedQuestion?.includes("15,50"))).toBe(true);
  });
});
