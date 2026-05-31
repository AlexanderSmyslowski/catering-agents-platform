import { describe, expect, it, vi } from "vitest";
import {
  buildProductionSpecFocusActions,
  type ProductionSpecFocusActionsInput
} from "../backoffice-ui/src/production-spec-focus-actions.js";

function input(
  overrides: Partial<ProductionSpecFocusActionsInput> = {}
): ProductionSpecFocusActionsInput {
  return {
    loadSpecIntoEditorState: vi.fn(() => "spec-lunch"),
    setProductionWorkspaceCleared: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    ...overrides
  };
}

describe("production spec focus actions", () => {
  it("loads a spec into the editor and focuses the returned spec id", () => {
    const spec = { specId: "spec-lunch", eventType: "Lunch" };
    const actionInput = input({
      loadSpecIntoEditorState: vi.fn(() => "spec-from-editor")
    });
    const actions = buildProductionSpecFocusActions(actionInput);

    actions.loadSpecIntoEditor(spec);

    expect(actionInput.loadSpecIntoEditorState).toHaveBeenCalledWith(spec);
    expect(actionInput.setProductionWorkspaceCleared).toHaveBeenCalledWith(false);
    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-from-editor");
  });

  it("uses the same focus behavior when beginning a spec edit", () => {
    const spec = { specId: "spec-dinner", eventType: "Dinner" };
    const actionInput = input({
      loadSpecIntoEditorState: vi.fn(() => "spec-dinner")
    });
    const actions = buildProductionSpecFocusActions(actionInput);

    actions.beginSpecEdit(spec);

    expect(actionInput.loadSpecIntoEditorState).toHaveBeenCalledWith(spec);
    expect(actionInput.setProductionWorkspaceCleared).toHaveBeenCalledWith(false);
    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-dinner");
  });

  it("opens an existing spec for questions without mutating editor state", () => {
    const actionInput = input();
    const actions = buildProductionSpecFocusActions(actionInput);

    actions.openSpecForQuestions("spec-questions");

    expect(actionInput.loadSpecIntoEditorState).not.toHaveBeenCalled();
    expect(actionInput.setProductionWorkspaceCleared).toHaveBeenCalledWith(false);
    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-questions");
  });
});
