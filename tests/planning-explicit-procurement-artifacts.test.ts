import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent
} from "../shared-core/src/index.js";
import { buildExplicitProcurementPlanningArtifacts } from "../production-service/src/rules/planning-explicit-procurement-artifacts.js";

function eventSpec(): AcceptedEventSpec {
  return {
    specId: "spec-explicit-procurement-test",
    event: {
      date: "2026-06-20"
    },
    attendees: {
      expected: 35
    },
    menuPlan: []
  } as unknown as AcceptedEventSpec;
}

function component(productionDecision?: MenuComponent["productionDecision"]): MenuComponent {
  return {
    componentId: "component-dessert",
    label: "Dessertgläser",
    menuCategory: "classic",
    productionDecision
  };
}

describe("planning explicit procurement artifacts", () => {
  it("returns procurement artifacts for explicit convenience purchases", () => {
    const artifacts = buildExplicitProcurementPlanningArtifacts({
      eventSpec: eventSpec(),
      component: component({
        mode: "convenience_purchase",
        purchasedElements: ["Dessertcreme"]
      }),
      servings: 35
    });

    expect(artifacts?.selection.selectionReason).toContain("Convenience-Zukauf");
    expect(artifacts?.timelineItem.label).toBe("Dessertgläser beschaffen");
    expect(artifacts?.procurementItems[0]).toMatchObject({
      displayName: "Dessertcreme für Dessertgläser",
      purchaseQty: 35
    });
  });

  it("returns procurement artifacts for explicit external finished products", () => {
    const artifacts = buildExplicitProcurementPlanningArtifacts({
      eventSpec: eventSpec(),
      component: component({
        mode: "external_finished"
      }),
      servings: 20
    });

    expect(artifacts?.selection.selectionReason).toContain("Fertigprodukt");
    expect(artifacts?.timelineItem.label).toBe("Dessertgläser extern disponieren");
    expect(artifacts?.procurementItems[0]).toMatchObject({
      displayName: "Dessertgläser",
      purchaseQty: 20
    });
  });

  it("leaves scratch and hybrid components to the later planning branches", () => {
    expect(
      buildExplicitProcurementPlanningArtifacts({
        eventSpec: eventSpec(),
        component: component({ mode: "scratch" }),
        servings: 35
      })
    ).toBeUndefined();
    expect(
      buildExplicitProcurementPlanningArtifacts({
        eventSpec: eventSpec(),
        component: component({
          mode: "hybrid",
          purchasedElements: ["Brot"]
        }),
        servings: 35
      })
    ).toBeUndefined();
  });
});
