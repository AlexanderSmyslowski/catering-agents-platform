import { describe, expect, it } from "vitest";
import { calculateOfferPricing } from "../shared-core/src/offer-calculation.js";
import { renderOfferPricingHtml } from "../print-export/src/offer-pricing-html.js";
describe("price calculation in print", () => {
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
