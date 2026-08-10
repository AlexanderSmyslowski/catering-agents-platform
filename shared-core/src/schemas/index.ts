import { acceptedEventSpecSchema } from "./accepted-event-spec.js";
import { approvalRequestSchema } from "./approval-request.js";
import { commonSchema } from "./common.js";
import { eventRequestSchema } from "./event-request.js";
import { offerDraftSchema } from "./offer-draft.js";
import { productionDraftSchema } from "./production-draft.js";
import { productionPlanSchema } from "./production-plan.js";
import { purchaseListSchema } from "./purchase-list.js";
import { recipeSchema } from "./recipe.js";

export const schemaBundle = [
  commonSchema,
  approvalRequestSchema,
  eventRequestSchema,
  acceptedEventSpecSchema,
  offerDraftSchema,
  productionDraftSchema,
  recipeSchema,
  productionPlanSchema,
  purchaseListSchema
];
