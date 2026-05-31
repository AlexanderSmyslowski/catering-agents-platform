import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent
} from "../shared-core/src/index.js";
import { buildUnresolvedComponentArtifacts } from "../production-service/src/rules/planning-unresolved-component-artifacts.js";

function buildSpec(): AcceptedEventSpec {
  return {
    event: {
      date: "2026-06-01"
    }
  } as unknown as AcceptedEventSpec;
}

function buildComponent(): MenuComponent {
  return {
    componentId: "component-clarify",
    label: "Mystery Bowl",
    menuCategory: "vegetarian"
  };
}

describe("planning unresolved component artifacts", () => {
  it("builds the repeated unresolved planning artifacts from the same reason and timeline label", () => {
    const component = buildComponent();
    const artifacts = buildUnresolvedComponentArtifacts({
      component,
      eventSpec: buildSpec(),
      servings: 42,
      reason: "Herstellungsentscheidung fehlt.",
      timelineLabel: "Mystery Bowl Herstellungsart klären"
    });

    expect(artifacts.selection).toEqual({
      componentId: "component-clarify",
      selectionReason: "Herstellungsentscheidung fehlt.",
      autoUsedInternetRecipe: false
    });
    expect(artifacts.issue).toBe("Herstellungsentscheidung fehlt.");
    expect(artifacts.blocking).toBe(true);
    expect(artifacts.timelineItem).toEqual({
      label: "Mystery Bowl Herstellungsart klären",
      at: "2026-06-01 T-1"
    });
    expect(artifacts.kitchenSheet).toMatchObject({
      title: "Mystery Bowl - Rezeptklärung nötig",
      componentId: "component-clarify",
      blockingNotes: ["Herstellungsentscheidung fehlt."],
      instructions: expect.arrayContaining([
        "Aktuell geplant für 42 Portionen.",
        "Herstellungsentscheidung fehlt."
      ])
    });
  });

  it("keeps issue text and blocking classification separate from the operator-facing reason", () => {
    const artifacts = buildUnresolvedComponentArtifacts({
      component: buildComponent(),
      eventSpec: buildSpec(),
      servings: 12,
      reason: "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.",
      issue: "Klassifikation für Mystery Bowl fehlt.",
      blocking: false,
      timelineLabel: "Mystery Bowl fachlich klären"
    });

    expect(artifacts.selection.selectionReason).toBe(
      "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen."
    );
    expect(artifacts.kitchenSheet.blockingNotes).toEqual([
      "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen."
    ]);
    expect(artifacts.issue).toBe("Klassifikation für Mystery Bowl fehlt.");
    expect(artifacts.blocking).toBe(false);
  });
});
