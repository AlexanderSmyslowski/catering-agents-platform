import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { ErrorObject } from "ajv";
import { schemaBundle } from "./schemas/index.js";
import type {
  AcceptedEventSpec,
  EventRequest,
  OfferDraft,
  ProductionPlan,
  PurchaseList,
  Recipe
} from "./types.js";

const Ajv2020 = (
  Ajv2020Module as unknown as {
    default?: new (options?: Record<string, unknown>) => {
      addSchema: (schema: unknown) => void;
      getSchema: (id: string) => Validator | undefined;
    };
  }
).default ??
  (Ajv2020Module as unknown as new (options?: Record<string, unknown>) => {
    addSchema: (schema: unknown) => void;
    getSchema: (id: string) => Validator | undefined;
  });

const addFormats = (
  addFormatsModule as unknown as {
    default?: (ajv: unknown) => void;
  }
).default ??
  (addFormatsModule as unknown as (ajv: unknown) => void);

type SchemaName =
  | "eventRequest"
  | "offerDraft"
  | "acceptedEventSpec"
  | "recipe"
  | "productionPlan"
  | "purchaseList";

type Validator = ((value: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

const schemaIds: Record<SchemaName, string> = {
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

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const path = error.instancePath || error.schemaPath;
    return `${path} ${error.message ?? "validation error"}`.trim();
  });
}

function assertValid<T>(schemaName: SchemaName, value: T): T {
  const validate = ajv.getSchema(schemaIds[schemaName]);
  if (!validate) {
    throw new Error(`Schema ${schemaName} is not registered.`);
  }

  if (!validate(value)) {
    throw new Error(
      `Schema validation failed for ${schemaName}: ${formatErrors(validate.errors).join("; ")}`
    );
  }

  return value;
}

export function validateEventRequest(value: EventRequest): EventRequest {
  return assertValid("eventRequest", value);
}

export function validateOfferDraft(value: OfferDraft): OfferDraft {
  return assertValid("offerDraft", value);
}

export function validateAcceptedEventSpec(
  value: AcceptedEventSpec
): AcceptedEventSpec {
  return assertValid("acceptedEventSpec", value);
}

export function validateRecipe(value: Recipe): Recipe {
  return assertValid("recipe", value);
}

export function validateProductionPlan(value: ProductionPlan): ProductionPlan {
  return assertValid("productionPlan", value);
}

export function validatePurchaseList(value: PurchaseList): PurchaseList {
  return assertValid("purchaseList", value);
}
