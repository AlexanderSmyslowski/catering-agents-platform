import { describe, expect, it } from "vitest";
import { calculateOfferPricing, validOfferPricingCalculation } from "../shared-core/src/offer-calculation.js";

const row = (id: string, quantity: string, unitNetCents: number, extra: Record<string, unknown> = {}) => ({
  id, label: id, category: id === "food" ? "food" : "other", quantity,
  unit: id === "food" ? "guest" : "flat", unitNetCents, taxRateBps: 1900,
  sourceKind: "app_transfer", sourceReference: "Angebotsrechner 0.6 – historische Arbeitsgrundlage", ...extra
});
const example = [
  row("food", "80", 5800), row("delivery", "1", 15000), row("setup", "1", 12000),
  row("staff", "18", 4555, { category: "staff", unit: "hour" }),
  row("equipment", "80", 1200, { category: "equipment", unit: "guest" }),
  row("drinks", "80", 1400, { category: "drinks", unit: "guest" }), row("decoration", "1", 18000)
];

describe("offer calculation from the existing App-Transfer calculator", () => {
  it("reproduces the existing flying-buffet example without treating observations as approval", () => {
    const result = calculateOfferPricing({ lines: example }, 80);
    expect(result.subtotal).toEqual({ amount: 7989.9, currency: "EUR" });
    expect(result.calculation).toMatchObject({ netCents: 798990, taxCents: 151808, grossCents: 950798, containsSynthetic: false });
    expect(result.calculation?.lines.find(x => x.id === "staff")?.netCents).toBe(81990);
    expect(result.notes?.join(" ")).toContain("prüfpflichtig");
    expect(validOfferPricingCalculation(result)).toBe(true);
  });

  it("reproduces the existing business-lunch example", () => {
    const lines = [row("food", "35", 2000), row("delivery", "1", 15000), row("setup", "1", 12000),
      row("staff", "6", 4555, { category: "staff", unit: "hour" }),
      row("equipment", "35", 500, { category: "equipment", unit: "guest" }),
      row("drinks", "35", 800, { category: "drinks", unit: "guest" })];
    const r = calculateOfferPricing({ lines }, 35);
    expect(r.calculation).toMatchObject({ netCents: 169830, taxCents: 32268, grossCents: 202098 });
  });

  it("rounds net lines and tax groups half up using exact integers", () => {
    const result = calculateOfferPricing({ lines: [
      row("food", "1", 1), row("fractional", "0.5", 1),
      row("fractional-2", "0.000002", 1000000, { sourceKind: "synthetic" })
    ] }, 1);
    expect(result.calculation?.lines.map(x => x.netCents)).toEqual([1, 1, 2]);
    expect(result.calculation).toMatchObject({ netCents: 4, taxCents: 1, grossCents: 5, containsSynthetic: true });
  });

  it("keeps missing tax explicit and never fabricates a gross total", () => {
    const r = calculateOfferPricing({ lines: [row("food", "100", 5850, { taxRateBps: undefined })] }, 100);
    expect(r.calculation?.missingTaxLineIds).toEqual(["food"]);
    expect(r.calculation?.taxCents).toBeUndefined();
    expect(r.calculation?.grossCents).toBeUndefined();
    expect(validOfferPricingCalculation(r)).toBe(true);
  });

  it.each([
    { quantity: "1e3" }, { quantity: "0" }, { quantity: "-1" }, { quantity: "0.0000001" },
    { unitNetCents: -1 }, { unitNetCents: 1.1 }, { taxRateBps: 19.5 }, { taxRateBps: 10001 },
    { sourceReference: "" }, { taxRateBps: 0 }, { unitNetCents: 0 }, { netCents: 123 },
    { sourceKind: "approved" }, { sourceKind: ["synthetic"] }, { sourceKind: null }, { sourceKind: {} }, { unknown: true }
  ])("rejects invalid, unjustified or client-calculated financial fields: %j", patch => {
    expect(() => calculateOfferPricing({ lines: [row("food", "1", 1, patch)] }, 1)).toThrow();
  });

  it("retains explicitly included free items and justified zero tax", () => {
    const r = calculateOfferPricing({ lines: [row("food", "100", 0, {
      zeroPriceReason: "Im separat vereinbarten Paket enthalten", taxRateBps: 0, taxReason: "Explizite Testannahme", sourceKind: "synthetic"
    })] }, 100);
    expect(r.calculation?.lines).toHaveLength(1);
    expect(r.calculation?.grossCents).toBe(0);
  });

  it("rejects duplicate lines, range overflow and forged derived amounts", () => {
    expect(() => calculateOfferPricing({ lines: [row("food", "1", 100), row("food", "1", 100)] }, 1)).toThrow();
    expect(() => calculateOfferPricing({ lines: [row("food", "100000", 1000000000)] }, 1)).toThrow();
    const r = calculateOfferPricing({ lines: example }, 80);
    const invalidKind = structuredClone(r);
    (invalidKind.calculation!.lines[0] as unknown as Record<string, unknown>).sourceKind = ["synthetic"];
    expect(validOfferPricingCalculation(invalidKind)).toBe(false);
    for (const target of ["subtotal", "perPerson", "netCents", "taxCents", "grossCents", "line"]) {
      const forged = structuredClone(r);
      if (target === "subtotal") forged.subtotal.amount++;
      else if (target === "perPerson") forged.perPerson!.amount++;
      else if (target === "line") forged.calculation!.lines[0]!.netCents++;
      else (forged.calculation as unknown as Record<string, number>)[target]!++;
      expect(validOfferPricingCalculation(forged), target).toBe(false);
    }
  });
});
