import { acceptedEventSpecSchema } from "./accepted-event-spec.js";
import { approvalRequestSchema } from "./approval-request.js";
import { approvedOfferSchema } from "./approved-offer.js";
import { approvedProductionSpecSchema } from "./approved-production-spec.js";
import { commonSchema } from "./common.js";
import { eventRequestSchema } from "./event-request.js";
import { offerDraftSchema } from "./offer-draft.js";
import { productionDraftSchema } from "./production-draft.js";
import { productionPlanSchema } from "./production-plan.js";
import { productionHandoffSchema } from "./production-handoff.js";
import { purchaseListSchema } from "./purchase-list.js";
import { recipeSchema } from "./recipe.js";

export const schemaBundle = [
  commonSchema,
  approvalRequestSchema,
  approvedOfferSchema,
  approvedProductionSpecSchema,
  eventRequestSchema,
  acceptedEventSpecSchema,
  offerDraftSchema,
  productionDraftSchema,
  recipeSchema,
  productionPlanSchema,
  productionHandoffSchema,
  purchaseListSchema
];
