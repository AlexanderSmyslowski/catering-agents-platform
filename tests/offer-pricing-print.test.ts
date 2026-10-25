import { describe, expect, it } from "vitest";
import { calculateOfferPricing } from "../shared-core/src/offer-calculation.js";
import { renderOfferPricingHtml } from "../print-export/src/offer-pricing-html.js";
describe("price calculation in print", () => {
  it("prints singular quantities and keeps money and units together", () => {
    const summary = calculateOfferPricing({ lines: [
      { id: "flat", label: "Logistik", category: "logistics", quantity: "1", unit: "flat", unitNetCents: 15000, taxRateBps: 1900, sourceKind: "synthetic", sourceReference: "Synthetischer Rechentest" },
      { id: "hours", label: "Personal", category: "staff", quantity: "24", unit: "hour", unitNetCents: 4555, taxRateBps: 1900, sourceKind: "synthetic", sourceReference: "Synthetischer Rechentest" }
    ] }, 100);
    const html = renderOfferPricingHtml(summary);
    expect(html).toContain('class="offer-pricing"');
    expect(html).toContain('<span class="quantity">1 Pauschale</span>');
    expect(html).toContain('<span class="quantity">24 Personenstunden</span>');
    expect(html).toMatch(/<span class="money">1\.093,20\s€<\/span>/);
    expect(html).not.toContain("1 Pauschalen");
  });
  it("prints exact net/tax/gross and synthetic labels, while keeping internal sources out of customer output", () => {
    const summary = calculateOfferPricing({ lines: [{
      id: "food", label: "<script>Speisen</script>", category: "food", quantity: "100",
      unit: "guest", unitNetCents: 5800, taxRateBps: 1900, sourceKind: "synthetic",
      sourceReference: "PRIVATE-REFERENCE-<img src=x onerror=alert(1)>"
    }] }, 100);
    const internal = renderOfferPricingHtml(summary);
    expect(internal).toContain("5.800,00");
    expect(internal).toContain("1.102,00");
    expect(internal).toContain("6.902,00");
    expect(internal).toContain("Enthält synthetische Testannahmen");
    expect(internal).toContain("&lt;script&gt;");
    expect(internal).not.toContain("<script>");
    expect(internal).not.toContain("<img");
    expect(renderOfferPricingHtml(summary, false)).not.toContain("PRIVATE-REFERENCE");
  });
  it("prints estimated internal costs without leaking them into customer output", () => {
    const summary = calculateOfferPricing({ lines: [{
      id: "food", label: "Speisen", category: "food", quantity: "100", unit: "guest", unitNetCents: 5800,
      taxRateBps: 1900, sourceKind: "operator", sourceReference: "Verkaufspreis",
      directCost: { totalNetCents: 185000, basis: "estimated", sourceReference: "INTERNAL-COST-<img src=x>", priceDate: "2026-09-12" }
    }] }, 100);
    const internal = renderOfferPricingHtml(summary);
    expect(internal).toContain("1.850,00");
    expect(internal).toContain("3.950,00");
    expect(internal).toContain("Deckungsbeitrag vorläufig");
    expect(internal).toContain("2026-09-12");
    expect(internal).toContain("&lt;img");
    expect(internal).not.toContain("<img");
    const customer = renderOfferPricingHtml(summary, false);
    for (const secret of ["INTERNAL-COST", "1.850,00", "3.950,00", "Deckungsbeitrag", "2026-09-12"]) expect(customer).not.toContain(secret);
    expect(customer).toContain("5.800,00");
  });
  it("does not print a zero cost or complete margin for an older calculation without costs", () => {
    const summary = calculateOfferPricing({ lines: [{ id: "food", label: "Speisen", category: "food", quantity: "100", unit: "guest", unitNetCents: 5800,
      taxRateBps: 1900, sourceKind: "operator", sourceReference: "Verkaufspreis" }] }, 100);
    const internal = renderOfferPricingHtml(summary);
    expect(internal).toContain("Kosten offen: Speisen");
    expect(internal).toContain("Erfasste direkte Kosten netto: offen");
    expect(internal).toContain("Deckungsbeitrag vor Gemeinkosten: noch unvollständig");
  });
  it("keeps unassigned tax and gross open in the printed document", () => {
    const summary = calculateOfferPricing({ lines: [{
      id: "food", label: "Speisen", category: "food", quantity: "100",
      unit: "guest", unitNetCents: 5800, sourceKind: "app_transfer", sourceReference: "Arbeitsbaukasten"
    }] }, 100);
    const html = renderOfferPricingHtml(summary);
    expect(html).toContain("Brutto gesamt: offen");
    expect(html).toContain("Freigabe gesperrt");
  });
});
