import { describe, expect, it } from "vitest";
import { calculateOfferPricing, summarizeOfferDirectCosts, validOfferPricingCalculation } from "../shared-core/src/offer-calculation.js";

const line = (id: string, extra: Record<string, unknown> = {}) => ({
  id, label: id, category: "food", quantity: "100", unit: "guest", unitNetCents: 5800,
  taxRateBps: 1900, sourceKind: "synthetic", sourceReference: "SYNTHETISCHER-100-GAESTE-TEST", ...extra
});
const estimate = { totalNetCents: 185000, basis: "estimated", estimateDate: "2026-10-25", sourceReference: "SYNTHETISCH: älterer Einkaufspreis, nicht aktuell bestätigt" };
const summarize = (lines: unknown[]) => summarizeOfferDirectCosts(calculateOfferPricing({ lines }, 100).calculation!);

describe("internal direct costs alongside quoted selling prices", () => {
  it("keeps a legacy calculation valid and never turns absent costs into zero profit costs", () => {
    const priced = calculateOfferPricing({ lines: [line("food")] }, 100);
    expect(priced.calculation?.lines[0]).not.toHaveProperty("directCost");
    expect(validOfferPricingCalculation(priced)).toBe(true);
    expect(summarizeOfferDirectCosts(priced.calculation!)).toEqual({
      status: "open", missingLineIds: ["food"], estimatedLineIds: []
    });
  });
  it("uses an explicitly estimated TOTAL cost once and preserves net, tax and gross selling prices", () => {
    const priced = calculateOfferPricing({ lines: [line("food", { directCost: estimate })] }, 100);
    expect(priced.calculation).toMatchObject({ netCents: 580000, taxCents: 110200, grossCents: 690200 });
    expect(summarizeOfferDirectCosts(priced.calculation!)).toEqual({
      status: "estimated", enteredNetCents: 185000, contributionNetCents: 395000,
      missingLineIds: [], estimatedLineIds: ["food"]
    });
    expect(validOfferPricingCalculation(priced)).toBe(true);
    expect(priced.calculation?.lines[0]?.directCost).toEqual(estimate);
  });
  it("shows partial entered costs but withholds a misleading contribution when one position is open", () => {
    expect(summarize([line("food", { directCost: estimate }), line("staff", { category: "staff", quantity: "24", unit: "hour", unitNetCents: 4555 })])).toEqual({
      status: "open", enteredNetCents: 185000, missingLineIds: ["staff"], estimatedLineIds: ["food"]
    });
  });
  it("keeps evidenced costs and their date distinct from estimates and supports a negative contribution", () => {
    expect(summarize([line("food", { directCost: { ...estimate, totalNetCents: 600000, basis: "documented", priceDate: "2026-10-25" } })])).toMatchObject({
      status: "documented", contributionNetCents: -20000, estimatedLineIds: []
    });
    const zero = summarize([line("food", { directCost: { ...estimate, totalNetCents: 0, sourceReference: "SYNTHETISCH: vorhandener Bestand ausdrücklich ohne Kosten bewertet" } })]);
    expect(zero.enteredNetCents).toBe(0);
    expect(zero.contributionNetCents).toBe(580000);
  });
  it.each([
    { ...estimate, basis: "approved" }, { ...estimate, totalNetCents: -1 },
    { ...estimate, totalNetCents: 0.5 }, { ...estimate, totalNetCents: 1_000_000_000_001 },
    { ...estimate, sourceReference: " " }, { ...estimate, priceDate: "2026-02-30" },
    { ...estimate, basis: "documented" }, { ...estimate, marginCents: 123 }
  ])("rejects invalid or fabricated cost fields: %j", directCost => {
    expect(() => calculateOfferPricing({ lines: [line("food", { directCost })] }, 100)).toThrow();
  });
  it("requires the estimate snapshot date separately from an unknown receipt date", () => {
    const missing = { ...estimate, estimateDate: undefined };
    expect(() => calculateOfferPricing({ lines: [line("food", { directCost: missing })] }, 100)).toThrow(/Schätzstand/);
    const dated = { ...estimate, estimateDate: "2026-10-25" };
    const priced = calculateOfferPricing({ lines: [line("food", { directCost: dated })] }, 100);
    expect(priced.calculation?.lines[0]?.directCost).toEqual(dated);
    expect(priced.calculation?.lines[0]?.directCost?.priceDate).toBeUndefined();
    expect(() => calculateOfferPricing({ lines: [line("food", { directCost: { ...dated, estimateDate: "2026-02-30" } })] }, 100)).toThrow(/Schätzstand/);
  });
  it("bounds summed costs and validates persisted cost provenance too", () => {
    expect(() => summarize([line("a", { directCost: { ...estimate, totalNetCents: 1_000_000_000_000 } }), line("b", { directCost: estimate })])).toThrow();
    const priced = calculateOfferPricing({ lines: [line("food", { directCost: estimate })] }, 100);
    (priced.calculation!.lines[0]!.directCost as any).basis = "approved";
    expect(validOfferPricingCalculation(priced)).toBe(false);
  });
});
