import type {
  ProductionDocumentSubmitActionInput,
  ProductionDocumentSubmitActions
} from "./production-document-submit-action.js";
import { buildProductionDocumentSubmitActions } from "./production-document-submit-action.js";
import {
  buildProductionManualInputActions,
  buildProductionManualInputStateFromForm,
  type ProductionManualInputActionsInput,
  type ProductionManualInputFormStateInput
} from "./production-manual-input-state.js";
import type {
  ProductionManualInputActions,
  ProductionManualInputValues
} from "./production-input-panel.js";
import type { ProductionManualSpecSubmitInput } from "./production-manual-spec-submit-action.js";
import { buildProductionManualSpecSubmitAction } from "./production-manual-spec-submit-action.js";
import type { ProductionTextIntakeSubmitInput } from "./production-text-intake-submit-action.js";
import { buildProductionTextIntakeSubmitAction } from "./production-text-intake-submit-action.js";

export type ProductionIntakeManualSpecFormInput =
  ProductionManualInputFormStateInput &
  Omit<ProductionManualInputActionsInput, "submitManualSpec">;

export type ProductionIntakeActionsAppBoundaryInput =
  ProductionTextIntakeSubmitInput &
  ProductionDocumentSubmitActionInput &
  ProductionManualSpecSubmitInput & {
    manualSpecForm: ProductionIntakeManualSpecFormInput;
  };

export type ProductionIntakeActionsAppBoundary = ProductionDocumentSubmitActions & {
  handleIntakeSubmit: () => Promise<void>;
  handleManualSpecSubmit: () => Promise<void>;
  manualSpecInput: ProductionManualInputValues;
  manualSpecActions: ProductionManualInputActions;
};

export function buildProductionIntakeActionsAppBoundary(
  input: ProductionIntakeActionsAppBoundaryInput
): ProductionIntakeActionsAppBoundary {
  const handleIntakeSubmit = buildProductionTextIntakeSubmitAction(input);
  const documentSubmitActions = buildProductionDocumentSubmitActions(input);
  const handleManualSpecSubmit = buildProductionManualSpecSubmitAction(input);
  const manualSpecInput = buildProductionManualInputStateFromForm(input.manualSpecForm);
  const manualSpecActions = buildProductionManualInputActions({
    ...input.manualSpecForm,
    submitManualSpec: handleManualSpecSubmit
  });

  return {
    handleIntakeSubmit,
    handleManualSpecSubmit,
    manualSpecInput,
    manualSpecActions,
    ...documentSubmitActions
  };
}
