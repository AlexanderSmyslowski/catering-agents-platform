import { useEffect } from "react";
import type { AppRoute } from "./app-shell-state.js";
import { buildProductionQuestionAutoOpenState } from "./production-question-auto-open-state.js";

export type UseProductionQuestionAutoOpenInput = {
  route: AppRoute;
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestionCount: number;
  editingSpecId?: string;
  dismissedProductionAnswerSpecId?: string;
  loadSpecIntoEditor: (spec: Record<string, unknown>) => void;
};

export function useProductionQuestionAutoOpen({
  route,
  focusedProductionSpec,
  productionQuestionCount,
  editingSpecId,
  dismissedProductionAnswerSpecId,
  loadSpecIntoEditor
}: UseProductionQuestionAutoOpenInput) {
  useEffect(() => {
    const autoOpenState = buildProductionQuestionAutoOpenState({
      route,
      focusedProductionSpec,
      productionQuestionCount,
      editingSpecId,
      dismissedProductionAnswerSpecId
    });

    if (autoOpenState.shouldAutoOpen && autoOpenState.specId && focusedProductionSpec) {
      loadSpecIntoEditor(focusedProductionSpec);
    }
  }, [
    dismissedProductionAnswerSpecId,
    editingSpecId,
    focusedProductionSpec,
    loadSpecIntoEditor,
    productionQuestionCount,
    route
  ]);
}
