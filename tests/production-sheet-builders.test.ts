import { describe, expect, it } from "vitest";
import type { AcceptedEventSpec, MenuComponent } from "@catering/shared-core";
import {
  gnPlanFor,
  hybridClarificationReason,
  prepWindowFor,
  procurementKitchenSheet,
  purchasedElementsSummary,
  stationFor,
  unresolvedKitchenSheet
} from "../production-service/src/rules/production-sheet-builders.js";

function spec(overrides: Partial<AcceptedEventSpec> = {}): AcceptedEventSpec {
  return {
    event: {
      date: "2026-07-12"
    },
    ...overrides
  } as AcceptedEventSpec;
}

function component(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-1",
    label: "Focaccia",
    productionDecision: {
      mode: "hybrid",
      purchasedElements: ["Brot", "Dip"]
    },
    ...overrides
  };
}

describe("production sheet builders", () => {
  it("keeps station, prep window and GN planning deterministic", () => {
    expect(stationFor("Dessert im Glas")).toBe("cold-kitchen");
    expect(stationFor("Kaffee und Tee")).toBe("beverage-station");
    expect(stationFor("Tomatensuppe")).toBe("hot-kitchen");
    expect(prepWindowFor(spec())).toBe("2026-07-12 T-1");
    expect(prepWindowFor(spec({ event: {} }))).toBe("Zeitfenster offen, Produktionsvorlauf bitte manuell prüfen");
    expect(gnPlanFor(18)).toEqual([{ container: "GN 1/2", count: 1 }]);
    expect(gnPlanFor(41)).toEqual([{ container: "GN 1/1", count: 3 }]);
  });

  it("summarizes hybrid clarification and purchased elements without planning side effects", () => {
    expect(hybridClarificationReason(component())).toContain("Hybridfall Focaccia");
    expect(hybridClarificationReason(component({ label: "Tomatensuppe" }))).toBeUndefined();
    expect(purchasedElementsSummary(component())).toBe("Brot, Dip");
    expect(purchasedElementsSummary(component({ productionDecision: { mode: "hybrid" } }))).toBe("noch offen");
  });

  it("builds procurement kitchen sheets from the existing production copy", () => {
    const sheet = procurementKitchenSheet(
      component({ productionDecision: { mode: "convenience_purchase", purchasedElements: ["Quiche"] } }),
      24,
      spec()
    );

    expect(sheet).toMatchObject({
      title: "Focaccia - Convenience-Zukauf",
      componentId: "component-1",
      productionQty: { amount: 24, unit: "Portionen" },
      station: "hot-kitchen",
      prepWindow: "2026-07-12 T-1",
      ingredients: [],
      steps: [],
      procurementNotes: [
        "Beschaffung laut Herstellungsart: Convenience-Zukauf.",
        "Zugekaufte Bestandteile: Quiche.",
        "Lieferquelle und Gebinde vor Bestellung kurz prüfen."
      ]
    });
    expect(sheet.instructions).toContain("Komponente vor Service optisch und mengenmäßig gegen das Angebot prüfen.");
  });

  it("builds unresolved kitchen sheets as blocking, non-operational work cards", () => {
    const sheet = unresolvedKitchenSheet(component(), 24, "Rezept fehlt.", spec());

    expect(sheet).toMatchObject({
      title: "Focaccia - Rezeptklärung nötig",
      componentId: "component-1",
      productionQty: { amount: 24, unit: "Portionen" },
      ingredients: [],
      steps: [],
      blockingNotes: ["Rezept fehlt."]
    });
    expect(sheet.instructions).toEqual([
      "Aktuell geplant für 24 Portionen.",
      "Rezept fehlt.",
      "Für diese Komponente liegt derzeit noch kein belastbares Rezept vor.",
      "Bitte Bibliotheksrezept zuweisen, neues Rezept hochladen oder Herstellungsart auf Beschaffung umstellen.",
      "Danach die Produktionsplanung erneut starten."
    ]);
  });
});
