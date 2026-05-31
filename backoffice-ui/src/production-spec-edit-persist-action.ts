import {
  completeProductionQuestionEditSuccess,
  type ProductionQuestionEditSuccessActions
} from "./production-question-editor-state.js";
import type { SpecEditUpdateInput } from "./production-spec-edit-update.js";

export type ProductionSpecEditPersistActionInput = ProductionQuestionEditSuccessActions & {
  editingSpecId?: string;
  updateAcceptedSpec: (
    specId: string,
    input: SpecEditUpdateInput
  ) => Promise<{ acceptedEventSpec: Record<string, unknown> }>;
  buildCurrentSpecUpdateInput: () => SpecEditUpdateInput;
};

export function buildProductionSpecEditPersistAction({
  editingSpecId,
  updateAcceptedSpec,
  buildCurrentSpecUpdateInput,
  setProductionWorkspaceCleared,
  setFocusedProductionSpecId,
  resetSpecEdit,
  refreshDashboard,
  setNotice
}: ProductionSpecEditPersistActionInput) {
  return async function persistCurrentSpecEdit(options?: { quiet?: boolean }) {
    if (!editingSpecId) {
      return undefined;
    }

    const response = await updateAcceptedSpec(editingSpecId, buildCurrentSpecUpdateInput());
    const updatedSpec = response.acceptedEventSpec;
    await completeProductionQuestionEditSuccess(
      updatedSpec,
      editingSpecId,
      {
        setProductionWorkspaceCleared,
        setFocusedProductionSpecId,
        resetSpecEdit,
        refreshDashboard,
        setNotice
      },
      options
    );
    return updatedSpec;
  };
}
