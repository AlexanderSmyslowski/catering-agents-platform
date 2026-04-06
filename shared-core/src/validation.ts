import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { ErrorObject } from "ajv";
import { schemaBundle } from "./schemas/index.js";
import type {
  AcceptedEventSpec,
  EventDemand,
  EventRequest,
  OfferDraft,
  PurchasingUnitProfile,
  ProductionPlan,
  PurchaseList,
  Recipe,
  YieldProfile
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
  | "eventDemand"
  | "eventRequest"
  | "offerDraft"
  | "acceptedEventSpec"
  | "recipe"
  | "yieldProfile"
  | "purchasingUnitProfile"
  | "productionPlan"
  | "purchaseList";

type Validator = ((value: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

const schemaIds: Record<SchemaName, string> = {
  eventDemand: "https://schemas.catering.local/event-demand.json",
  eventRequest: "https://schemas.catering.local/event-request.json",
  offerDraft: "https://schemas.catering.local/offer-draft.json",
  acceptedEventSpec: "https://schemas.catering.local/accepted-event-spec.json",
  recipe: "https://schemas.catering.local/recipe.json",
  yieldProfile: "https://schemas.catering.local/yield-profile.json",
  purchasingUnitProfile: "https://schemas.catering.local/purchasing-unit-profile.json",
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

export function validateEventDemand(value: EventDemand): EventDemand {
  const normalized = {
    ...value,
    ownershipContext: value.ownershipContext ?? "customer"
  } as EventDemand;

  return assertValid("eventDemand", normalized);
}

export function validateOfferDraft(value: OfferDraft): OfferDraft {
  return assertValid("offerDraft", value);
}

export function validateAcceptedEventSpec(
  value: AcceptedEventSpec
): AcceptedEventSpec {
  const normalized = {
    ...value,
    ownershipContext: value.ownershipContext ?? "customer"
  } as AcceptedEventSpec;

  return assertValid("acceptedEventSpec", normalized);
}

export function validateRecipe(value: Recipe): Recipe {
  const normalized = {
    ...value,
    allergenStatus: value.allergenStatus ?? "known"
  } as Recipe;

  return assertValid("recipe", normalized);
}

export function validateYieldProfile(value: YieldProfile): YieldProfile {
  return assertValid("yieldProfile", value);
}

export function validatePurchasingUnitProfile(
  value: PurchasingUnitProfile
): PurchasingUnitProfile {
  return assertValid("purchasingUnitProfile", value);
}

export function validateProductionPlan(value: ProductionPlan): ProductionPlan {
  const normalized = {
    ...value,
    ownershipContext: value.ownershipContext ?? "production"
  } as ProductionPlan;

  return assertValid("productionPlan", normalized);
}

export function validatePurchaseList(value: PurchaseList): PurchaseList {
  return assertValid("purchaseList", value);
}
