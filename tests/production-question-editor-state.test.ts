import { describe, expect, it } from "vitest";
import { buildProductionQuestionEditorState } from "../backoffice-ui/src/production-question-editor-state.js";

describe("production question editor state", () => {
  it("maps the editor state fields without changing collection references", () => {
    const editingComponentStates = {
      component_a: {
        menuCategory: "main",
        productionMode: "kitchen",
        purchasedElements: "Brot",
        recipeOverrideId: "",
        notes: "scharf getrennt verpacken"
      }
    };
    const recipes = [{ recipeId: "recipe-1", name: "Kichererbsencurry" }];

    const state = buildProductionQuestionEditorState({
      editingSpecId: "spec-1",
      editingEventType: "Lunch",
      editingEventDate: "2026-06-01",
      editingAttendeeCount: "42",
      editingServiceForm: "Buffet",
      editingMenuItems: "Curry, Salat",
      editingComponentStates,
      hasFocusedSpecEditChanges: true,
      recipes
    });

    expect(state).toEqual({
      editingSpecId: "spec-1",
      editingEventType: "Lunch",
      editingEventDate: "2026-06-01",
      editingAttendeeCount: "42",
      editingServiceForm: "Buffet",
      editingMenuItems: "Curry, Salat",
      editingComponentStates,
      hasFocusedSpecEditChanges: true,
      recipes
    });
    expect(state.editingComponentStates).toBe(editingComponentStates);
    expect(state.recipes).toBe(recipes);
  });

  it("keeps the optional editing spec id undefined", () => {
    const state = buildProductionQuestionEditorState({
      editingEventType: "",
      editingEventDate: "",
      editingAttendeeCount: "",
      editingServiceForm: "",
      editingMenuItems: "",
      editingComponentStates: {},
      hasFocusedSpecEditChanges: false,
      recipes: []
    });

    expect(state.editingSpecId).toBeUndefined();
    expect(state.hasFocusedSpecEditChanges).toBe(false);
  });
});
