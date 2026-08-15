import {
  buildAppProductionRouteState,
  type AppProductionRouteStateInput
} from "./app-production-route-state.js";
import {
  buildProductionQuestionEditorState,
  type ProductionQuestionEditorStateInput
} from "./production-question-editor-state.js";
import {
  buildProductionSourceInputAppBoundary,
  type ProductionSourceInputAppBoundaryInput
} from "./production-source-input-app-boundary.js";

export type AppProductionRouteAppBoundaryInput =
  ProductionSourceInputAppBoundaryInput &
  ProductionQuestionEditorStateInput &
  Omit<AppProductionRouteStateInput, "sourceInput" | "sourceInputActions" | "editorState">;

export function buildAppProductionRouteAppBoundary(
  input: AppProductionRouteAppBoundaryInput
) {
  const {
    productionSourceInput,
    productionSourceInputActions
  } = buildProductionSourceInputAppBoundary(input);
  const productionQuestionEditorState = buildProductionQuestionEditorState(input);
  const productionRouteState = buildAppProductionRouteState({
    ...input,
    sourceInput: productionSourceInput,
    sourceInputActions: productionSourceInputActions,
    editorState: productionQuestionEditorState
  });

  return {
    productionSourceInput,
    productionSourceInputActions,
    productionQuestionEditorState,
    ...productionRouteState
  };
}
