import type { ProductionQuestionEditorState } from "./production-question-panel.js";

export type ProductionQuestionEditorStateInput = {
  editingSpecId?: string;
  editingEventType: string;
  editingEventDate: string;
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
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    recipes
  };
}
