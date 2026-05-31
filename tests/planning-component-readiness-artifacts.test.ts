import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent
} from "../shared-core/src/index.js";
import { buildComponentReadinessArtifacts } from "../production-service/src/rules/planning-component-readiness-artifacts.js";

function buildSpec(): AcceptedEventSpec {
  return {
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
    serviceStyle: "buffet",
    ...overrides
  };
}

describe("planning component readiness artifacts", () => {
  it("keeps missing menu classification as a blocking unresolved planning artifact", () => {
    const artifacts = buildComponentReadinessArtifacts({
      component: buildComponent({ menuCategory: undefined, label: "Mystery Bowl" }),
      eventSpec: buildSpec(),
      servings: 40
    });

    expect(artifacts?.selection).toEqual({
      componentId: "component-focaccia",
      selectionReason: "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.",
      autoUsedInternetRecipe: false
    });
    expect(artifacts?.issue).toBe("Klassifikation für Mystery Bowl fehlt.");
    expect(artifacts?.blocking).toBe(true);
    expect(artifacts?.timelineItem.label).toBe("Mystery Bowl fachlich klären");
  });

  it("keeps missing production decisions explicit and preserves the Focaccia hybrid reason", () => {
    const artifacts = buildComponentReadinessArtifacts({
      component: buildComponent(),
      eventSpec: buildSpec(),
      servings: 80
    });

    expect(artifacts?.selection.selectionReason).toContain("Hybridfall Focaccia");
    expect(artifacts?.issue).toBe("Herstellungsentscheidung für Focaccia fehlt (Hybridfall Focaccia).");
    expect(artifacts?.timelineItem.label).toBe("Focaccia Hybridfall klären");
    expect(artifacts?.kitchenSheet.blockingNotes).toEqual([
      "Hybridfall Focaccia: Bitte bewusst klären, ob Eigenproduktion, Bäcker-Zukauf, Convenience-Zukauf oder Fertigprodukt gilt."
    ]);
  });

  it("requires named purchased elements for hybrid and convenience decisions", () => {
    const artifacts = buildComponentReadinessArtifacts({
      component: buildComponent({
        productionDecision: {
          mode: "hybrid",
          purchasedElements: []
        }
      }),
      eventSpec: buildSpec(),
      servings: 30
    });

    expect(artifacts?.selection.selectionReason).toBe(
      "Hybrid-/Convenience-Entscheidung ist gesetzt, aber die zugekauften Bestandteile sind noch nicht benannt."
    );
    expect(artifacts?.issue).toBe("Zugekaufte Bestandteile für Focaccia fehlen.");
    expect(artifacts?.timelineItem.label).toBe("Focaccia Beschaffungsanteil klären");
  });

  it("returns no artifacts for classified components with complete production readiness", () => {
    const artifacts = buildComponentReadinessArtifacts({
      component: buildComponent({
        productionDecision: {
          mode: "scratch"
        }
      }),
      eventSpec: buildSpec(),
      servings: 24
    });

    expect(artifacts).toBeUndefined();
  });
});
