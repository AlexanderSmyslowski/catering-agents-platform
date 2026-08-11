import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { ErrorObject } from "ajv";
import { llmReadinessForbiddenPayloadKeys } from "./llm-readiness.js";
import { assertApprovalRequestRecordSemantics } from "./approval-request-identity.js";
import type { CaseEvent, CaseProduct, OfferCase, ProductionCase } from "./case-contracts.js";
import { schemaBundle } from "./schemas/index.js";
import type {
  AcceptedEventSpec,
  ApprovedOffer,
  ApprovedProductionSpec,
  ApprovalRequestRecord,
  EventRequest,
  OfferDraft,
  ProductionHandoff,
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
  | "approvalRequest"
  | "approvedOffer"
  | "approvedProductionSpec"
  | "caseEvent"
  | "eventRequest"
  | "offerDraft"
  | "offerCase"
  | "acceptedEventSpec"
  | "productionDraft"
  | "productionCase"
  | "recipe"
  | "productionPlan"
  | "productionHandoff"
  | "purchaseList";

type Validator = ((value: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

const schemaIds: Record<SchemaName, string> = {
  approvalRequest: "https://schemas.catering.local/approval-request.json",
  approvedOffer: "https://schemas.catering.local/approved-offer.json",
  approvedProductionSpec: "https://schemas.catering.local/approved-production-spec.json",
  caseEvent: "https://schemas.catering.local/case.json#/$defs/caseEvent",
  eventRequest: "https://schemas.catering.local/event-request.json",
  offerDraft: "https://schemas.catering.local/offer-draft.json",
  offerCase: "https://schemas.catering.local/case.json#/$defs/offerCase",
  acceptedEventSpec: "https://schemas.catering.local/accepted-event-spec.json",
  productionDraft: "https://schemas.catering.local/production-draft.json",
  productionCase: "https://schemas.catering.local/case.json#/$defs/productionCase",
  recipe: "https://schemas.catering.local/recipe.json",
  productionPlan: "https://schemas.catering.local/production-plan.json",
  productionHandoff: "https://schemas.catering.local/production-handoff.json",
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

const caseEventForbiddenPayloadKeys = new Set<string>([
  ...llmReadinessForbiddenPayloadKeys,
  "providerPayload",
  "rawPrompt",
  "rawProviderPayload",
  "rawResponse",
  "systemPrompt",
  "toolOutput",
  "userPrompt"
]);

function collectCaseEventForbiddenPayloadKeyErrors(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectCaseEventForbiddenPayloadKeyErrors(item, `${path}[${index}]`)
    );
  }

  if (!isRecord(value)) {
    return [];
  }

  const errors: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (caseEventForbiddenPayloadKeys.has(key)) {
      errors.push(`${path}.${key} is not allowed in CaseEvent`);
    }
    errors.push(...collectCaseEventForbiddenPayloadKeyErrors(nested, `${path}.${key}`));
  }
  return errors;
}

function throwCaseValidationErrors(
  schemaName: "caseEvent" | "offerCase" | "productionCase",
  errors: string[]
): void {
  if (errors.length === 0) return;
  throw new Error(
    `Schema validation failed for ${schemaName}: ${[...new Set(errors)].join("; ")}`
  );
}

function reviewCardTargetsPath(targetPath: string | undefined, artifactPath: string): boolean {
  const normalizedPath = targetPath?.trim();
  if (!normalizedPath) {
    return false;
  }

  return normalizedPath === artifactPath ||
    normalizedPath.startsWith(`${artifactPath}.`) ||
    normalizedPath.startsWith(`${artifactPath}[`);
}

function validateProductionDraftReviewCoverage(value: ProductionDraft): string[] {
  const artifacts = value.draftArtifacts;
  const recipeRequirements = (artifacts.recipes ?? []).map((_, index) => ({
    present: true,
    path: `$.draftArtifacts.recipes[${index}]`,
    label: `draftArtifacts.recipes[${index}]`
  }));
  const requirements = [
    {
      present: Boolean(artifacts.eventSpec),
      path: "$.draftArtifacts.eventSpec",
      label: "draftArtifacts.eventSpec"
    },
    {
      present: Boolean(artifacts.productionPlan),
      path: "$.draftArtifacts.productionPlan",
      label: "draftArtifacts.productionPlan"
    },
    {
      present: Boolean(artifacts.purchaseList),
      path: "$.draftArtifacts.purchaseList",
      label: "draftArtifacts.purchaseList"
    },
    ...recipeRequirements
  ];

  return requirements
    .filter((requirement) =>
      requirement.present &&
      !value.reviewCards.some((card) => reviewCardTargetsPath(card.targetPath, requirement.path))
    )
    .map((requirement) => `review coverage missing for ${requirement.label}`);
}

function validateProductionDraftSemantics(value: ProductionDraft): string[] {
  const errors = [
    ...collectForbiddenPayloadKeyErrors(value),
    ...validateProductionDraftReviewCoverage(value)
  ];

  for (const card of value.reviewCards) {
    if (card.decision !== "pending" && (!card.decidedBy || !card.decidedAt)) {
      errors.push(`reviewCard ${card.cardId} needs decidedBy and decidedAt when decision is ${card.decision}`);
    }
  }

  if (value.status === "approved") {
    const openCards = value.reviewCards.filter((card) =>
      (card.requiredApproval === true || card.riskLevel === "blocking") && card.decision !== "fits"
    );
    if (openCards.length > 0) {
      errors.push("approved ProductionDraft must resolve required and blocking review cards as fits");
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

export function validateCaseEvent(value: CaseEvent): CaseEvent {
  throwCaseValidationErrors("caseEvent", collectCaseEventForbiddenPayloadKeyErrors(value));
  const event = assertValid("caseEvent", value);
  const errors: string[] = [];

  if (event.sourceId && event.sourceRef && event.sourceId !== event.sourceRef.sourceId) {
    errors.push("sourceId must match sourceRef.sourceId");
  }
  if (event.artifactId && event.revisionRef && event.artifactId !== event.revisionRef.artifactId) {
    errors.push("artifactId must match revisionRef.artifactId");
  }

  if (["case_created", "case_copied", "source_added", "legacy_unverified"].includes(event.kind) && event.role !== "system") {
    errors.push(`${event.kind} role must be system`);
  }
  if (event.kind === "instruction" && event.role !== "user") {
    errors.push("instruction role must be user");
  }

  const forbiddenFieldsByKind: Partial<Record<CaseEvent["kind"], Array<keyof CaseEvent>>> = {
    case_created: ["sourceId", "artifactId", "sourceRef", "revisionRef"],
    case_copied: ["sourceId", "sourceRef", "revisionRef"],
    source_added: ["artifactId", "revisionRef"],
    instruction: ["sourceId", "artifactId", "sourceRef", "revisionRef"],
    revision_created: ["sourceId", "sourceRef"]
  };
  for (const field of forbiddenFieldsByKind[event.kind] ?? []) {
    if (event[field] !== undefined) errors.push(`${String(field)} is not allowed for ${event.kind}`);
  }

  throwCaseValidationErrors("caseEvent", errors);
  return event;
}

export function validateCaseEventForProduct(value: CaseEvent, product: CaseProduct): CaseEvent {
  const event = validateCaseEvent(value);
  const expectedArtifactType = product === "offer" ? "OfferDraft" : "ProductionDraft";
  if (event.revisionRef && event.revisionRef.artifactType !== expectedArtifactType) {
    throwCaseValidationErrors("caseEvent", [
      `${product} case revisions must reference ${expectedArtifactType}`
    ]);
  }
  return event;
}

function validateCaseTimestamps(
  schemaName: "offerCase" | "productionCase",
  value: OfferCase | ProductionCase
): void {
  const errors: string[] = [];
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
    errors.push("updatedAt must not be earlier than createdAt");
  }
  if (value.copiedFromCaseId === value.caseId) {
    errors.push("copiedFromCaseId must reference another case");
  }
  throwCaseValidationErrors(schemaName, errors);
}

export function validateOfferCase(value: OfferCase): OfferCase {
  const offerCase = assertValid("offerCase", value);
  validateCaseTimestamps("offerCase", offerCase);
  return offerCase;
}

export function validateProductionCase(value: ProductionCase): ProductionCase {
  const productionCase = assertValid("productionCase", value);
  validateCaseTimestamps("productionCase", productionCase);
  return productionCase;
}

export function validateApprovalRequestRecord(value: ApprovalRequestRecord): ApprovalRequestRecord {
  const record = assertValid("approvalRequest", value);
  assertApprovalRequestRecordSemantics(record);
  return record;
}

export function validateApprovedProductionSpec(value: ApprovedProductionSpec): ApprovedProductionSpec {
  const spec = assertValid("approvedProductionSpec", value);
  if (spec.artifacts.productionPlan.eventSpecId !== spec.artifacts.eventSpec.specId) {
    throw new Error("ApprovedProductionSpec productionPlan must reference its eventSpec.");
  }
  if (spec.artifacts.purchaseList.eventSpecId !== spec.artifacts.eventSpec.specId) {
    throw new Error("ApprovedProductionSpec purchaseList must reference its eventSpec.");
  }
  const recipeIds = spec.artifacts.recipes.map((recipe) => recipe.recipeId);
  if (new Set(recipeIds).size !== recipeIds.length) {
    throw new Error("ApprovedProductionSpec recipe snapshots must have unique recipe IDs.");
  }
  const missingRecipeIds = spec.artifacts.productionPlan.recipeSelections
    .map((selection) => selection.recipeId)
    .filter((recipeId): recipeId is string => Boolean(recipeId))
    .filter((recipeId) => !recipeIds.includes(recipeId));
  if (missingRecipeIds.length > 0) {
    throw new Error("ApprovedProductionSpec must include every selected recipe snapshot.");
  }
  return spec;
}

export function validateOfferDraft(value: OfferDraft): OfferDraft {
  const draft = assertValid("offerDraft", value);
  const variantIds = draft.variantSet.map((variant) => variant.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new Error("OfferDraft-Varianten müssen eindeutige variantId-Werte besitzen.");
  }
  return draft;
}

export function validateApprovedOffer(value: ApprovedOffer): ApprovedOffer {
  return assertValid("approvedOffer", value);
}

export function validateProductionHandoff(value: ProductionHandoff): ProductionHandoff {
  return assertValid("productionHandoff", value);
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
