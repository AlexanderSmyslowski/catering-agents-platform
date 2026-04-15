import { acceptedEventSpecSchema } from "./accepted-event-spec.js";
import { commonSchema } from "./common.js";
import { eventRequestSchema } from "./event-request.js";
import { offerDraftSchema } from "./offer-draft.js";
import { productionPlanSchema } from "./production-plan.js";
import { purchaseListSchema } from "./purchase-list.js";
import { recipeSchema } from "./recipe.js";
export const schemaBundle = [
    commonSchema,
    eventRequestSchema,
    acceptedEventSpecSchema,
    offerDraftSchema,
    recipeSchema,
    productionPlanSchema,
    purchaseListSchema
];
