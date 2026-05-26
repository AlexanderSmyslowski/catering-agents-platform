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
