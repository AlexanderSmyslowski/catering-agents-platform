import { describe, expect, it } from "vitest";
import { formatDocumentDate, formatPreparationWindow, formatProductionStation } from "../print-export/src/document-labels.js";

describe("dates in office and kitchen documents", () => {
  it("formats a calendar day without timezone conversion or invented missing dates", () => {
    expect(formatDocumentDate("2026-11-13")).toBe("13.11.2026");
    expect(formatDocumentDate(undefined)).toBe("offen");
    expect(formatDocumentDate("2026-02-30")).toBe("2026-02-30");
  });
  it("resolves an explicit event-relative previous day across month, year and leap boundaries", () => {
    expect(formatPreparationWindow("2026-11-13 T-1", "2026-11-13")).toBe("12.11.2026 (Vortag; Planangabe prüfen)");
    expect(formatPreparationWindow("2027-01-01 T-1", "2027-01-01")).toContain("31.12.2026");
    expect(formatPreparationWindow("2028-03-01 T-1", "2028-03-01")).toContain("29.02.2028");
    expect(formatPreparationWindow("2026-11-13 T-1", "2026-11-14")).toBe("2026-11-13 T-1");
    expect(formatPreparationWindow("nach Absprache", "2026-11-13")).toBe("nach Absprache");
  });
});

describe("production work area labels", () => {
  it("distinguishes explicit work areas from historical inferred tokens", () => {
    expect(formatProductionStation("pastry", true)).toBe("Patisserie");
    expect(formatProductionStation("cold-kitchen", true)).toBe("Kalte Küche");
    expect(formatProductionStation("hot-kitchen")).toBe("Vorschlag: Warme Küche (ungeprüft)");
    expect(formatProductionStation("Vorschlag: Getränke (ungeprüft)")).toBe("Vorschlag: Getränke (ungeprüft)");
    expect(formatProductionStation("Ausgabe Süd")).toBe("Ausgabe Süd");
  });
});
