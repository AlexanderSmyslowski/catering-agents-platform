import type { AppRoute } from "./app-shell-state.js";

export interface ProductionQuestionAutoOpenInput {
  route: AppRoute;
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestionCount: number;
  editingSpecId?: string;
  dismissedProductionAnswerSpecId?: string;
}

export interface ProductionQuestionAutoOpenState {
  shouldAutoOpen: boolean;
  specId?: string;
}

export function buildProductionQuestionAutoOpenState(
  input: ProductionQuestionAutoOpenInput
): ProductionQuestionAutoOpenState {
  if (input.route !== "production" || !input.focusedProductionSpec) {
    return { shouldAutoOpen: false };
  }

  const specId = String(input.focusedProductionSpec.specId ?? "");
  if (!specId) {
    return { shouldAutoOpen: false };
  }

  const readiness = String(
    (input.focusedProductionSpec.readiness as Record<string, unknown> | undefined)?.status ?? ""
  );
  const hasOpenQuestionsOrIncompleteReadiness =
    input.productionQuestionCount > 0 || readiness !== "complete";

  return {
    shouldAutoOpen:
      hasOpenQuestionsOrIncompleteReadiness &&
      input.editingSpecId !== specId &&
      input.dismissedProductionAnswerSpecId !== specId,
    specId
  };
}
