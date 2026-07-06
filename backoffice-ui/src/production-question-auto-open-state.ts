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

  // The operator probe showed that auto-opening the editor after upload causes a
  // disorienting jump into component forms. Keep the spec identified, but make
  // answering a deliberate click from the guided review surface.
  return {
    shouldAutoOpen: false,
    specId
  };
}
