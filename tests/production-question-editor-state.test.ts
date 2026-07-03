import { describe, expect, it, vi } from "vitest";
import {
  buildProductionQuestionEditorState,
  completeProductionQuestionEditSuccess,
  type ProductionQuestionEditSuccessActions
} from "../backoffice-ui/src/production-question-editor-state.js";

describe("production question editor state", () => {
  it("completes a saved answer edit with focused spec, reset editor and dashboard refresh", async () => {
    const calls: string[] = [];
    const actions: ProductionQuestionEditSuccessActions = {
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
      }),
      resetSpecEdit: vi.fn((markDismissed) => {
        calls.push(`resetSpecEdit:${markDismissed}`);
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    };

    const updatedSpecId = await completeProductionQuestionEditSuccess(
      { specId: "spec-updated-1" },
      "spec-fallback-1",
      actions
    );

    expect(updatedSpecId).toBe("spec-updated-1");
    expect(actions.setNotice).toHaveBeenCalledWith("Spezifikation wurde gespeichert.");
    expect(calls).toEqual([
      "setProductionWorkspaceCleared:false",
      "setFocusedProductionSpecId:spec-updated-1",
      "resetSpecEdit:false",
      "refreshDashboard",
      "setNotice:Spezifikation wurde gespeichert."
    ]);
  });

  it("keeps saved answer success quiet and falls back to the editing spec id", async () => {
    const actions: ProductionQuestionEditSuccessActions = {
      setProductionWorkspaceCleared: vi.fn(),
      setFocusedProductionSpecId: vi.fn(),
      resetSpecEdit: vi.fn(),
      refreshDashboard: vi.fn(async () => undefined),
      setNotice: vi.fn()
    };

    const updatedSpecId = await completeProductionQuestionEditSuccess(
      {},
      "spec-fallback-2",
      actions,
      { quiet: true }
    );

    expect(updatedSpecId).toBe("spec-fallback-2");
    expect(actions.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-fallback-2");
    expect(actions.setNotice).not.toHaveBeenCalled();
  });

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
      editingEventSchedule: "12:00-14:00",
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
      editingEventSchedule: "12:00-14:00",
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
