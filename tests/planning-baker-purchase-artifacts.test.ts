import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent
} from "../shared-core/src/index.js";
import { buildImplicitBakerPurchasePlanningArtifacts } from "../production-service/src/rules/planning-baker-purchase-artifacts.js";

function eventSpec(overrides: Partial<AcceptedEventSpec> = {}): AcceptedEventSpec {
  return {
    specId: "spec-baker-artifacts-test",
    event: {
      date: "2026-06-18"
    },
    attendees: {
      expected: 40
    },
    menuPlan: [],
    ...overrides
  } as unknown as AcceptedEventSpec;
}

function component(label: string, productionDecision?: MenuComponent["productionDecision"]): MenuComponent {
  return {
    componentId: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    menuCategory: "classic",
    productionDecision
  };
}

describe("planning baker purchase artifacts", () => {
  it("returns procurement artifacts for clear bread components without explicit production decision", () => {
    const artifacts = buildImplicitBakerPurchasePlanningArtifacts({
      eventSpec: eventSpec(),
      component: component("Brot & Baguette"),
      servings: 40
    });

    expect(artifacts?.kind).toBe("procurement");
    if (artifacts?.kind !== "procurement") {
      throw new Error("Expected procurement baker purchase artifacts.");
    }
    expect(artifacts.artifacts.selection.selectionReason).toContain("Bäcker-Zukauf");
    expect(artifacts.artifacts.timelineItem.label).toBe("Brot & Baguette beim Bäcker beschaffen");
    expect(artifacts.artifacts.procurementItems.map((item) => item.displayName)).toEqual([
      "Baguette für Brot & Baguette",
      "Brot für Brot & Baguette"
    ]);
  });

  it("returns unresolved artifacts when gluten-free constraints block implicit baker purchase", () => {
    const artifacts = buildImplicitBakerPurchasePlanningArtifacts({
      eventSpec: eventSpec({ productionConstraints: ["gluten_free"] }),
      component: component("Brotkorb"),
      servings: 25
    });

    expect(artifacts?.kind).toBe("unresolved");
    if (artifacts?.kind !== "unresolved") {
      throw new Error("Expected unresolved baker purchase artifacts.");
    }
    expect(artifacts.artifacts.issue).toContain("gluten_free blockiert den Bäcker-Zukauf");
    expect(artifacts.artifacts.timelineItem.label).toBe("Brotkorb Bäcker-Zukauf klären");
  });

  it("does not take over components that already have an explicit production decision", () => {
    const artifacts = buildImplicitBakerPurchasePlanningArtifacts({
      eventSpec: eventSpec(),
      component: component("Brot & Baguette", {
        mode: "scratch",
        notes: "Eigenproduktion ausdrücklich gewünscht"
      }),
      servings: 40
    });

    expect(artifacts).toBeUndefined();
  });
});
