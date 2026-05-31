export type ProductionSpecFocusActionsInput = {
  loadSpecIntoEditorState: (spec: Record<string, unknown>) => string;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  setFocusedProductionSpecId: (specId: string) => void;
};

export type ProductionSpecFocusActions = {
  loadSpecIntoEditor: (spec: Record<string, unknown>) => void;
  beginSpecEdit: (spec: Record<string, unknown>) => void;
  openSpecForQuestions: (specId: string) => void;
};

export function buildProductionSpecFocusActions({
  loadSpecIntoEditorState,
  setProductionWorkspaceCleared,
  setFocusedProductionSpecId
}: ProductionSpecFocusActionsInput): ProductionSpecFocusActions {
  function focusSpecId(specId: string) {
    setProductionWorkspaceCleared(false);
    setFocusedProductionSpecId(specId);
  }

  function loadSpecIntoEditor(spec: Record<string, unknown>) {
    focusSpecId(loadSpecIntoEditorState(spec));
  }

  return {
    loadSpecIntoEditor,
    beginSpecEdit: loadSpecIntoEditor,
    openSpecForQuestions: focusSpecId
  };
}
