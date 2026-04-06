import { acceptedEventSpecSchema } from "./accepted-event-spec.js";
import { commonSchema } from "./common.js";
import { eventDemandSchema } from "./event-demand.js";
import { eventRequestSchema } from "./event-request.js";
import { offerDraftSchema } from "./offer-draft.js";
import { productionPlanSchema } from "./production-plan.js";
import { purchaseListSchema } from "./purchase-list.js";
import { purchasingUnitProfileSchema } from "./purchasing-unit-profile.js";
import { recipeSchema } from "./recipe.js";
import { yieldProfileSchema } from "./yield-profile.js";

export const schemaBundle = [
  commonSchema,
  eventDemandSchema,
  eventRequestSchema,
  acceptedEventSpecSchema,
  offerDraftSchema,
  recipeSchema,
  yieldProfileSchema,
  purchasingUnitProfileSchema,
  productionPlanSchema,
  purchaseListSchema
];
