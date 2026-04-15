import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { schemaBundle } from "./schemas/index.js";
const Ajv2020 = Ajv2020Module.default ??
    Ajv2020Module;
const addFormats = addFormatsModule.default ??
    addFormatsModule;
const schemaIds = {
    eventRequest: "https://schemas.catering.local/event-request.json",
    offerDraft: "https://schemas.catering.local/offer-draft.json",
    acceptedEventSpec: "https://schemas.catering.local/accepted-event-spec.json",
    recipe: "https://schemas.catering.local/recipe.json",
    productionPlan: "https://schemas.catering.local/production-plan.json",
    purchaseList: "https://schemas.catering.local/purchase-list.json"
};
const ajv = new Ajv2020({
    strict: false,
    allErrors: true
});
addFormats(ajv);
for (const schema of schemaBundle) {
    ajv.addSchema(schema);
}
function formatErrors(errors) {
    return (errors ?? []).map((error) => {
        const path = error.instancePath || error.schemaPath;
        return `${path} ${error.message ?? "validation error"}`.trim();
    });
}
function assertValid(schemaName, value) {
    const validate = ajv.getSchema(schemaIds[schemaName]);
    if (!validate) {
        throw new Error(`Schema ${schemaName} is not registered.`);
    }
    if (!validate(value)) {
        throw new Error(`Schema validation failed for ${schemaName}: ${formatErrors(validate.errors).join("; ")}`);
    }
    return value;
}
export function validateEventRequest(value) {
    return assertValid("eventRequest", value);
}
export function validateOfferDraft(value) {
    return assertValid("offerDraft", value);
}
export function validateAcceptedEventSpec(value) {
    return assertValid("acceptedEventSpec", value);
}
export function validateRecipe(value) {
    return assertValid("recipe", value);
}
export function validateProductionPlan(value) {
    return assertValid("productionPlan", value);
}
export function validatePurchaseList(value) {
    return assertValid("purchaseList", value);
}
