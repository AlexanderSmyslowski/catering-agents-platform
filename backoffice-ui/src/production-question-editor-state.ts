import type { ProductionQuestionEditorState } from "./production-question-panel.js";

export type ProductionQuestionEditSuccessActions = {
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  setFocusedProductionSpecId: (specId: string) => void;
  resetSpecEdit: (markDismissed: boolean) => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
};

export type ProductionQuestionEditorStateInput = {
  editingSpecId?: string;
  editingEventType: string;
  editingEventDate: string;
  editingEventSchedule?: string;
  editingAttendeeCount: string;
  editingServiceForm: string;
  editingMenuItems: string;
  editingComponentStates: ProductionQuestionEditorState["editingComponentStates"];
  hasFocusedSpecEditChanges: boolean;
  recipes: ProductionQuestionEditorState["recipes"];
};

export function buildProductionQuestionEditorState({
  editingSpecId,
  editingEventType,
  editingEventDate,
  editingEventSchedule,
  editingAttendeeCount,
  editingServiceForm,
  editingMenuItems,
  editingComponentStates,
  hasFocusedSpecEditChanges,
  recipes
}: ProductionQuestionEditorStateInput): ProductionQuestionEditorState {
  return {
    editingSpecId,
    editingEventType,
    editingEventDate,
    ...(editingEventSchedule !== undefined ? { editingEventSchedule } : {}),
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    recipes
  };
}

export async function completeProductionQuestionEditSuccess(
  updatedSpec: Record<string, unknown>,
  fallbackSpecId: string,
  actions: ProductionQuestionEditSuccessActions,
  options?: { quiet?: boolean }
) {
  const updatedSpecId = String(updatedSpec.specId ?? fallbackSpecId);
  actions.setProductionWorkspaceCleared(false);
  actions.setFocusedProductionSpecId(updatedSpecId);
  actions.resetSpecEdit(false);
  await actions.refreshDashboard();
  if (!options?.quiet) {
    actions.setNotice("Spezifikation wurde gespeichert.");
  }

  return updatedSpecId;
}
