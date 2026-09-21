// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useProductionSpecEditor } from "../backoffice-ui/src/use-production-spec-editor.js";

type ProductionSpecEditor = ReturnType<typeof useProductionSpecEditor>;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderEditor(focusedProductionSpec?: Record<string, unknown>) {
  let editor: ProductionSpecEditor | undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe() {
    editor = useProductionSpecEditor({ focusedProductionSpec });
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  if (!editor) {
    throw new Error("Production spec editor hook did not render.");
  }

  return {
    get editor() {
      if (!editor) {
        throw new Error("Production spec editor hook did not render.");
      }
      return editor;
    }
  };
}

const lunchSpec = {
  specId: "spec-lunch",
  event: {
    type: "Lunch",
    date: "2026-06-12",
    schedule: [{ label: "Service", start: "12:00", end: "14:00" }],
    serviceForm: "Buffet"
  },
  attendees: {
    expected: 42
  },
  menuPlan: [
    {
      componentId: "component-hummus",
      label: "Hummus mit Rohkost",
      menuCategory: "vegan",
      recipeOverrideId: "recipe-hummus",
      productionDecision: {
        mode: "scratch",
        purchasedElements: ["Baguette"],
        notes: "Baguette beim Baecker zukaufen"
      }
    }
  ]
};

describe("useProductionSpecEditor", () => {
  it("loads a focused spec into editable state and detects unchanged snapshots", () => {
    const probe = renderEditor(lunchSpec);

    act(() => {
      expect(probe.editor.loadSpecIntoEditor(lunchSpec)).toBe("spec-lunch");
    });

    expect(probe.editor.editingSpecId).toBe("spec-lunch");
    expect(probe.editor.editingEventType).toBe("Lunch");
    expect(probe.editor.editingEventSchedule).toBe("12:00-14:00");
    expect(probe.editor.editingAttendeeCount).toBe("42");
    expect(probe.editor.editingComponentStates["component-hummus"]).toEqual({
      menuCategory: "vegan",
      productionMode: "scratch",
      purchasedElements: "Baguette",
      recipeOverrideId: "recipe-hummus",
      notes: "Baguette beim Baecker zukaufen"
    });
    expect(probe.editor.hasFocusedSpecEditChanges).toBe(false);
  });

  it("keeps component edits, builds update input, and remembers dismissed specs on reset", () => {
    const probe = renderEditor(lunchSpec);

    act(() => {
      probe.editor.loadSpecIntoEditor(lunchSpec);
    });
    act(() => {
      probe.editor.setEditingAttendeeCount("45");
      probe.editor.updateEditingComponentState("component-hummus", {
        purchasedElements: "Baguette, Gemuesesticks"
      });
    });

    expect(probe.editor.hasFocusedSpecEditChanges).toBe(true);
    expect(probe.editor.buildCurrentSpecUpdateInput()).toMatchObject({
      attendeeCount: 45,
      componentUpdates: [
        {
          componentId: "component-hummus",
          purchasedElements: ["Baguette", "Gemuesesticks"]
        }
      ]
    });

    act(() => {
      probe.editor.resetSpecEdit();
    });

    expect(probe.editor.editingSpecId).toBeUndefined();
    expect(probe.editor.dismissedProductionAnswerSpecId).toBe("spec-lunch");
  });
});


it("preserves complex original schedule while editing only manufacturing notes", () => {
  const schedule = [{ label: "Aufbau", start: "08:00", end: "09:00" }, { label: "Station 2", start: "09:00", end: "12:00" }];
  const spec = { ...lunchSpec, event: { ...lunchSpec.event, schedule } };
  const probe = renderEditor(spec);
  act(() => probe.editor.beginSpecEdit(spec));
  expect(probe.editor.hasFocusedSpecEditChanges).toBe(false);
  act(() => probe.editor.updateEditingComponentState("component-hummus", { notes: "neue Notiz" }));
  expect(probe.editor.buildCurrentSpecUpdateInput().eventSchedule).toEqual(schedule);
  expect(probe.editor.hasFocusedSpecEditChanges).toBe(true);
});

it.each([false, true])("preserves quantity edits through unrelated edits and canonical save/reopen (existing quantities: %s)", async existing => {
  const { buildProductionSpecEditPersistAction } = await import("../backoffice-ui/src/production-spec-edit-persist-action.js");
  const spec = { ...lunchSpec, menuPlan: [{ ...lunchSpec.menuPlan[0]!, productionDecision: {
    mode: "hybrid", purchasedElements: ["Baguette"], notes: "alt",
    ...(existing ? { purchasedQuantities: [{ element: "Baguette", amountPerPerson: 1, unit: "Stück" }] } : {})
  } }] };
  const probe = renderEditor(spec);
  act(() => probe.editor.beginSpecEdit(spec));
  act(() => probe.editor.updateEditingComponentState("component-hummus", { purchasedQuantities: [{ element: "Baguette", amountPerPerson: "2", unit: "Stück" }] }));
  act(() => probe.editor.updateEditingComponentState("component-hummus", { notes: "neu" }));
  act(() => probe.editor.updateEditingComponentState("component-hummus", { menuCategory: "vegetarian" }));
  expect(probe.editor.buildCurrentSpecUpdateInput().componentUpdates![0]).toMatchObject({ purchasedQuantities: [{ element: "Baguette", amountPerPerson: 2, unit: "Stück" }], notes: "neu", menuCategory: "vegetarian", productionMode: "hybrid", recipeOverrideId: "recipe-hummus" });
  const draft = { draftId: "synthetic-r1", revision: 1, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:synthetic" }, reviewCards: [], draftArtifacts: { eventSpec: spec } };
  const context = { caseId: "synthetic-case", draft };
  const saved = await buildProductionSpecEditPersistAction({ editingSpecId: spec.specId,
    productionDraftContext: context, getCurrentProductionDraftContext: () => context,
    buildCurrentSpecUpdateInput: () => probe.editor.buildCurrentSpecUpdateInput(),
    reviseProductionDraft: async (_id, input) => {
      expect(input.componentUpdates).toEqual([{ componentId: "component-hummus", notes: "neu", purchasedQuantities: [{ element: "Baguette", amountPerPerson: 2, unit: "Stück" }] }]);
      const eventSpec = { ...spec, menuPlan: [{ ...spec.menuPlan[0]!, menuCategory: input.componentClassifications[0]!.menuCategory, productionDecision: { ...spec.menuPlan[0]!.productionDecision, notes: input.componentUpdates![0]!.notes, purchasedQuantities: input.componentUpdates![0]!.purchasedQuantities } }] };
      return { draft: { ...draft, draftId: "synthetic-r2", revision: 2, draftArtifacts: { eventSpec } } };
    },
    updateAcceptedSpec: async () => { throw new Error("canonical save must not use legacy intake"); },
    setProductionWorkspaceCleared: () => {}, setFocusedProductionSpecId: () => {}, resetSpecEdit: () => {}, refreshDashboard: async () => {}, setNotice: () => {}
  })();
  act(() => probe.editor.beginSpecEdit(saved!));
  expect(probe.editor.editingComponentStates["component-hummus"]!.purchasedQuantities).toEqual([{ element: "Baguette", amountPerPerson: "2", unit: "Stück" }]);
  expect(probe.editor.buildCurrentSpecUpdateInput().eventSchedule).toEqual(spec.event.schedule);
});

it("preserves original comma-bearing names through real-hook quantity edits in a different row order", () => {
  const spec = { ...lunchSpec, menuPlan: [{ ...lunchSpec.menuPlan[0]!, productionDecision: { mode: "hybrid", purchasedElements: ["Gebäck, geschnitten", "Wasser"], purchasedQuantities: [{ element: "Wasser", amountPerPerson: 0.5, unit: "l" }, { element: "Gebäck, geschnitten", amountPerPerson: 1, unit: "Stück" }] } }] };
  const probe = renderEditor(spec);
  act(() => probe.editor.beginSpecEdit(spec));
  act(() => probe.editor.updateEditingComponentState("component-hummus", { purchasedQuantities: [{ element: "Wasser", amountPerPerson: "0.75", unit: "l" }, { element: "Gebäck, geschnitten", amountPerPerson: "1", unit: "Stück" }] }));
  expect(probe.editor.editingComponentStates["component-hummus"]!.originalPurchasedElements).toEqual(["Gebäck, geschnitten", "Wasser"]);
  expect(probe.editor.buildCurrentSpecUpdateInput().componentUpdates![0]).toMatchObject({ purchasedElements: ["Gebäck, geschnitten", "Wasser"], purchasedQuantities: [{ element: "Wasser", amountPerPerson: 0.75, unit: "l" }, { element: "Gebäck, geschnitten", amountPerPerson: 1, unit: "Stück" }] });
});
