import type {
  RecipeEventUseReview,
  QuantityDecisionInput
} from "@catering/shared-core";
import type {
  ProductionQuantityPreviewInput,
  QuantityWorkflowProjectionInput
} from "./service.js";

export interface QuantityWorkflowRuntimeComponent {
  caseId: string;
  componentId: string;
  revision: string;
  projectionInput: QuantityWorkflowProjectionInput;
  previewInput: Omit<ProductionQuantityPreviewInput, "edit">;
  reviewedQuantityDecision?: QuantityDecisionInput;
  recipeEventUseReview?: RecipeEventUseReview;
}
