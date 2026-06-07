import type {
  ProductionManualInputActions,
  ProductionManualInputValues,
  ProductionSourceInputActions,
  ProductionSourceInputValues
} from "./production-input-panel.js";
import type { ProductionObjectsActions } from "./production-objects-panel.js";
import type {
  ProductionQuestionEditorActions,
  ProductionQuestionEditorState,
  ProductionQuestionPanelActions
} from "./production-question-panel.js";
import type { ProductionRecipeActions } from "./production-recipe-library-panel.js";
import type { ProductionRouteMainLayoutProps } from "./production-route-main-layout.js";
import type { ProductionRouteViewState } from "./production-route-view-state.js";
import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export type ProductionRouteMainLayoutStateInput = {
  viewState: ProductionRouteViewState;
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
  sourceInputActions: ProductionSourceInputActions;
  manualInput: ProductionManualInputValues;
  manualInputActions: ProductionManualInputActions;
  questionActions: ProductionQuestionPanelActions;
  editorState: ProductionQuestionEditorState;
  editorActions: ProductionQuestionEditorActions;
  objectPanelActions: ProductionObjectsActions;
  recipeActions: ProductionRecipeActions;
  miniPilotRawResult: string;
  setMiniPilotRawResult: (value: string) => void;
  miniPilotReportState: MiniPilotCheckReportState;
};

export function buildProductionRouteMainLayoutState({
  viewState,
  submitting,
  sourceInput,
  sourceInputActions,
  manualInput,
  manualInputActions,
  questionActions,
  editorState,
  editorActions,
  objectPanelActions,
  recipeActions,
  miniPilotRawResult,
  setMiniPilotRawResult,
  miniPilotReportState
}: ProductionRouteMainLayoutStateInput): ProductionRouteMainLayoutProps {
  return {
    ...viewState,
    submitting,
    sourceInput,
    sourceInputActions,
    manualInput,
    manualInputActions,
    questionActions,
    editorState,
    editorActions,
    objectPanelActions,
    recipeActions,
    miniPilotRawResult,
    setMiniPilotRawResult,
    miniPilotReportState
  };
}
