import {
  buildAppProductionRouteState,
  type AppProductionRouteStateInput
} from "./app-production-route-state.js";
import {
  buildProductionQuestionEditorState,
  type ProductionQuestionEditorStateInput
} from "./production-question-editor-state.js";
import {
  buildProductionRouteFilterState,
  type ProductionRouteFilterStateInput
} from "./production-route-filter-state.js";
import {
  buildProductionSourceInputAppBoundary,
  type ProductionSourceInputAppBoundaryInput
} from "./production-source-input-app-boundary.js";

export type AppProductionRouteAppBoundaryInput =
  ProductionSourceInputAppBoundaryInput &
  ProductionQuestionEditorStateInput &
  ProductionRouteFilterStateInput &
  Omit<AppProductionRouteStateInput, "sourceInput" | "sourceInputActions" | "editorState">;

export function buildAppProductionRouteAppBoundary(
  input: AppProductionRouteAppBoundaryInput
) {
  const {
    productionSourceInput,
    productionSourceInputActions
  } = buildProductionSourceInputAppBoundary(input);
  const productionQuestionEditorState = buildProductionQuestionEditorState(input);
  const productionRouteFilterState = buildProductionRouteFilterState(input);
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
    productionRouteFilterState,
    ...productionRouteState
  };
}
