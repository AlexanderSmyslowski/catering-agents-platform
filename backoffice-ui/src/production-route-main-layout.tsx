import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { buildProductionMiniPilotActionState } from "./production-mini-pilot-action-state.js";
import {
  ProductionHandoffPanel,
  type ProductionHandoffState
} from "./production-handoff-panel.js";
import {
  ProductionInputPanel,
  type ProductionManualInputActions,
  type ProductionManualInputValues,
  type ProductionSourceInputActions,
  type ProductionSourceInputValues
} from "./production-input-panel.js";
import {
  ProductionObjectsPanel,
  type ProductionObjectsActions,
  type ProductionObjectsState,
  type ProductionPlanProgressState
} from "./production-objects-panel.js";
import {
  ProductionPurchaseListPanel,
  type ProductionPurchaseListState
} from "./production-purchase-list-panel.js";
import { ProductionQuestionPanel } from "./production-question-panel.js";
import type {
  ProductionQuestionPanelActions,
  ProductionQuestionPanelState,
  ProductionQuestionEditorActions,
  ProductionQuestionEditorState
} from "./production-question-panel.js";
import {
  ProductionRecipeLibraryPanel,
  type ProductionRecipeActions,
  type ProductionRecipeLibraryState,
  type ProductionRecipeStatusState,
  type ProductionRecipeUploadState
} from "./production-recipe-library-panel.js";
import {
  ProductionConversationalWorkbench,
  type ProductionWorkbenchNextStep,
  type ProductionWorkbenchSummary
} from "./production-workbench.js";

export type ProductionRouteMainLayoutProps = {
  workbenchSummary: ProductionWorkbenchSummary;
  workbenchNextStep: ProductionWorkbenchNextStep;
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
  sourceInputActions: ProductionSourceInputActions;
  manualInput: ProductionManualInputValues;
  manualInputActions: ProductionManualInputActions;
  questionState: ProductionQuestionPanelState;
  questionActions: ProductionQuestionPanelActions;
  editorState: ProductionQuestionEditorState;
  editorActions: ProductionQuestionEditorActions;
  objectPanelProgress: ProductionPlanProgressState;
  objectPanelState: ProductionObjectsState;
  objectPanelActions: ProductionObjectsActions;
  purchaseListState: ProductionPurchaseListState;
  handoffState: ProductionHandoffState;
  recipeStatus: ProductionRecipeStatusState;
  recipeUpload: ProductionRecipeUploadState;
  recipeLibrary: ProductionRecipeLibraryState;
  recipeActions: ProductionRecipeActions;
  miniPilotRawResult: string;
  setMiniPilotRawResult: (value: string) => void;
  miniPilotReportState: MiniPilotCheckReportState;
  miniPilotStorageHintLabel?: string;
};

export function ProductionRouteMainLayout({
  workbenchSummary,
  workbenchNextStep,
  submitting,
  sourceInput,
  sourceInputActions,
  manualInput,
  manualInputActions,
  questionState,
  questionActions,
  editorState,
  editorActions,
  objectPanelProgress,
  objectPanelState,
  objectPanelActions,
  purchaseListState,
  handoffState,
  recipeStatus,
  recipeUpload,
  recipeLibrary,
  recipeActions,
  miniPilotRawResult,
  setMiniPilotRawResult,
  miniPilotReportState,
  miniPilotStorageHintLabel
}: ProductionRouteMainLayoutProps) {
  const miniPilotActionState = buildProductionMiniPilotActionState(
    miniPilotReportState,
    miniPilotStorageHintLabel
  );

  return (
    <ProductionConversationalWorkbench
      summary={workbenchSummary}
      nextStep={workbenchNextStep}
      miniPilotRawResult={miniPilotRawResult}
      setMiniPilotRawResult={setMiniPilotRawResult}
      miniPilotReportState={miniPilotReportState}
      miniPilotStorageHintLabel={miniPilotStorageHintLabel}
    >
      <div className="production-column">
        <ProductionInputPanel
          submitting={submitting}
          sourceInput={sourceInput}
          sourceInputActions={sourceInputActions}
          manualInput={manualInput}
          manualInputActions={manualInputActions}
        />
      </div>
      <div className="production-column">
        <ProductionQuestionPanel
          questionState={questionState}
          questionActions={questionActions}
          submitting={submitting}
          editorState={editorState}
          editorActions={editorActions}
        />
      </div>
      <div className="production-column">
        <ProductionObjectsPanel
          progressState={objectPanelProgress}
          objectsState={objectPanelState}
          objectsActions={objectPanelActions}
          submitting={submitting}
          miniPilotActionState={miniPilotActionState}
          clearMiniPilotResult={() => setMiniPilotRawResult("")}
        />
      </div>
      <div className="production-column">
        <ProductionPurchaseListPanel purchaseListState={purchaseListState} />
      </div>
      <div className="production-column">
        <ProductionHandoffPanel handoffState={handoffState} />

        <ProductionRecipeLibraryPanel
          statusState={recipeStatus}
          uploadState={recipeUpload}
          libraryState={recipeLibrary}
          recipeActions={recipeActions}
          submitting={submitting}
        />
      </div>
    </ProductionConversationalWorkbench>
  );
}
