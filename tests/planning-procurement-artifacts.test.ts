import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent
} from "../shared-core/src/index.js";
import { buildProcurementPlanningArtifacts } from "../production-service/src/rules/planning-procurement-artifacts.js";

function buildSpec(): AcceptedEventSpec {
  return {
    specId: "spec-procurement-artifacts",
    event: {
      date: "2026-06-01"
    }
  } as unknown as AcceptedEventSpec;
}

function buildComponent(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-focaccia",
    label: "Focaccia",
    menuCategory: "vegetarian",
    productionDecision: {
      mode: "convenience_purchase",
      purchasedElements: ["Focaccia vom Bäcker"]
    },
    ...overrides
  };
}

describe("planning procurement artifacts", () => {
  it("builds convenience procurement items, selection, kitchen sheet and timeline together", () => {
    const artifacts = buildProcurementPlanningArtifacts({
      eventSpec: buildSpec(),
      component: buildComponent(),
      servings: 45,
      kind: "component_procurement"
    });

    expect(artifacts.procurementItems).toHaveLength(1);
    expect(artifacts.procurementItems[0]).toMatchObject({
      displayName: "Focaccia vom Bäcker für Focaccia",
      purchaseQty: 45,
      purchaseUnit: "portion",
      supplierHint: "Metro Convenience"
    });
    expect(artifacts.selection).toEqual({
      componentId: "component-focaccia",
      selectionReason:
        "Komponente ist als Convenience-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.",
      autoUsedInternetRecipe: false
    });
    expect(artifacts.kitchenSheet).toMatchObject({
      title: "Focaccia - Convenience-Zukauf",
      componentId: "component-focaccia",
      prepWindow: "2026-06-01 T-1"
    });
    expect(artifacts.timelineItem).toEqual({
      label: "Focaccia beschaffen",
      at: "2026-06-01 T-1"
    });
  });

  it("keeps external finished procurement wording separate from convenience wording", () => {
    const artifacts = buildProcurementPlanningArtifacts({
      eventSpec: buildSpec(),
      component: buildComponent({
        label: "Dessertgläser",
        productionDecision: {
          mode: "external_finished"
        }
      }),
      servings: 30,
      kind: "component_procurement"
    });

    expect(artifacts.procurementItems[0]).toMatchObject({
      displayName: "Dessertgläser",
      supplierHint: "Metro / externer Lieferant"
    });
    expect(artifacts.selection.selectionReason).toBe(
      "Komponente ist als Fertigprodukt markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen."
    );
    expect(artifacts.timelineItem).toEqual({
      label: "Dessertgläser extern disponieren",
      at: "2026-06-01 T-1"
    });
  });

  it("preserves the explicit baker-purchase reason for implicit bread components", () => {
    const artifacts = buildProcurementPlanningArtifacts({
      eventSpec: buildSpec(),
      component: buildComponent({
        componentId: "component-bread",
        label: "Brot und Baguette",
        productionDecision: {
          mode: "convenience_purchase",
          purchasedElements: ["Baguette", "Brot"]
        }
      }),
      servings: 60,
      kind: "baker_purchase"
    });

    expect(artifacts.selection).toEqual({
      componentId: "component-bread",
      selectionReason:
        "Brot/Baguette ist als klarer Bäcker-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.",
      autoUsedInternetRecipe: false
    });
    expect(artifacts.timelineItem).toEqual({
      label: "Brot und Baguette beim Bäcker beschaffen",
      at: "2026-06-01 T-1"
    });
  });
});
