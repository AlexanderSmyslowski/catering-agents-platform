import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { ErrorObject } from "ajv";
import { llmReadinessForbiddenPayloadKeys } from "./llm-readiness.js";
import { schemaBundle } from "./schemas/index.js";
import type {
  AcceptedEventSpec,
  EventRequest,
  OfferDraft,
  ProductionDraft,
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
  | "productionDraft"
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
  productionDraft: "https://schemas.catering.local/production-draft.json",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectForbiddenPayloadKeyErrors(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenPayloadKeyErrors(item, `${path}[${index}]`));
  }

  if (!isRecord(value)) {
    return [];
  }

  const errors: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (llmReadinessForbiddenPayloadKeys.includes(key as (typeof llmReadinessForbiddenPayloadKeys)[number])) {
      errors.push(`${path}.${key} is not allowed in ProductionDraft`);
    }
    errors.push(...collectForbiddenPayloadKeyErrors(nested, `${path}.${key}`));
  }
  return errors;
}

function validateProductionDraftSemantics(value: ProductionDraft): string[] {
  const errors = collectForbiddenPayloadKeyErrors(value);

  for (const card of value.reviewCards) {
    if (card.decision !== "pending" && (!card.decidedBy || !card.decidedAt)) {
      errors.push(`reviewCard ${card.cardId} needs decidedBy and decidedAt when decision is ${card.decision}`);
    }
  }

  if (value.status === "approved") {
    const openCards = value.reviewCards.filter((card) => card.decision !== "fits");
    if (openCards.length > 0) {
      errors.push("approved ProductionDraft must have only fits review card decisions");
    }

    if (value.reviewCards.some((card) => card.riskLevel === "blocking")) {
      errors.push("approved ProductionDraft must not contain blocking review cards");
    }
  }

  if ((value.appliedAt || value.appliedBy || value.appliedArtifactIds) && value.status !== "approved") {
    errors.push("applied ProductionDraft metadata requires approved status");
  }

  if ((value.appliedAt && !value.appliedBy) || (value.appliedBy && !value.appliedAt)) {
    errors.push("applied ProductionDraft metadata needs appliedBy and appliedAt together");
  }

  return [...new Set(errors)];
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

export function validateProductionDraft(value: ProductionDraft): ProductionDraft {
  const draft = assertValid("productionDraft", value);
  const semanticErrors = validateProductionDraftSemantics(draft);

  if (semanticErrors.length > 0) {
    throw new Error(`Schema validation failed for productionDraft: ${semanticErrors.join("; ")}`);
  }

  return draft;
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
