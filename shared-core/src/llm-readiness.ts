export const llmReadinessContractVersion = "llm-readiness-v0" as const;

export const llmReadinessForbiddenBoundaries = [
  "noProvider",
  "noProviderSecrets",
  "noModelCalls",
  "noRealData",
  "noApiEndpoint",
  "noPersistence",
  "noMigration",
  "noRuntimeConversationSession",
  "noProductObjectWrites",
  "noToolOrchestrationWithWriteEffect"
] as const;

export type LlmReadinessForbiddenBoundary = typeof llmReadinessForbiddenBoundaries[number];

export const llmReadinessToolEffects = ["read", "draft", "write"] as const;

export type LlmReadinessToolEffect = typeof llmReadinessToolEffects[number];

export type LlmReadinessToolStatus = "allowed_without_provider" | "decision_required";

export interface LlmReadinessToolBoundary {
  toolId: string;
  effect: LlmReadinessToolEffect;
  status: LlmReadinessToolStatus;
  requiresHumanApproval: boolean;
  description: string;
}

export const llmReadinessToolBoundaries = [
  {
    toolId: "accepted_event_spec.read",
    effect: "read",
    status: "allowed_without_provider",
    requiresHumanApproval: false,
    description: "Existing AcceptedEventSpec data may be referenced as read-only context."
  },
  {
    toolId: "production_plan.read",
    effect: "read",
    status: "allowed_without_provider",
    requiresHumanApproval: false,
    description: "Existing ProductionPlan data may be referenced as read-only context."
  },
  {
    toolId: "purchase_list.read",
    effect: "read",
    status: "allowed_without_provider",
    requiresHumanApproval: false,
    description: "Existing PurchaseList data may be referenced as read-only context."
  },
  {
    toolId: "clarification_question.draft",
    effect: "draft",
    status: "allowed_without_provider",
    requiresHumanApproval: true,
    description: "A model-shaped draft may suggest a clarification question, but cannot write it."
  },
  {
    toolId: "operator_summary.draft",
    effect: "draft",
    status: "allowed_without_provider",
    requiresHumanApproval: true,
    description: "A model-shaped draft may summarize existing context for an operator."
  },
  {
    toolId: "accepted_event_spec.write",
    effect: "write",
    status: "decision_required",
    requiresHumanApproval: true,
    description: "Writing to leading product objects needs an explicit gate decision."
  },
  {
    toolId: "production_plan.write",
    effect: "write",
    status: "decision_required",
    requiresHumanApproval: true,
    description: "Writing production plans needs an explicit gate decision."
  },
  {
    toolId: "purchase_list.write",
    effect: "write",
    status: "decision_required",
    requiresHumanApproval: true,
    description: "Writing purchase lists needs an explicit gate decision."
  }
] as const satisfies readonly LlmReadinessToolBoundary[];

export const llmReadinessModelInputKinds = [
  "clarification_draft_request",
  "operator_summary_request"
] as const;

export type LlmReadinessModelInputKind = typeof llmReadinessModelInputKinds[number];

export const llmReadinessModelOutputKinds = [
  "clarification_question_draft",
  "operator_summary_draft"
] as const;

export type LlmReadinessModelOutputKind = typeof llmReadinessModelOutputKinds[number];

export type LlmReadinessSourceObjectType =
  | "accepted_event_spec"
  | "production_plan"
  | "purchase_list"
  | "conversation_projection"
  | "safe_source_anchor";

export interface LlmReadinessSourceRef {
  objectType: LlmReadinessSourceObjectType;
  objectId: string;
  label?: string;
}

export interface LlmReadinessModelInput {
  contractVersion: typeof llmReadinessContractVersion;
  inputId: string;
  kind: LlmReadinessModelInputKind;
  sourceRefs: LlmReadinessSourceRef[];
  policy: {
    providerCalls: "disabled";
    dataMode: "synthetic_or_demo_only";
    allowedToolEffects: readonly ["read"] | readonly ["read", "draft"];
  };
}

export interface LlmReadinessModelOutputCandidate {
  contractVersion: typeof llmReadinessContractVersion;
  outputId: string;
  kind: LlmReadinessModelOutputKind;
  sourceRefs: LlmReadinessSourceRef[];
  humanApprovalRequired: true;
  writesProductObject: false;
  text: string;
  structuredCandidate?: Record<string, string | number | boolean | null>;
}

export interface LlmReadinessModelOutputValidation {
  valid: boolean;
  errors: string[];
}

export const llmReadinessForbiddenPayloadKeys = [
  "rawText",
  "extractedText",
  "prompt",
  "messages",
  "providerResponse",
  "toolCalls",
  "secret",
  "apiKey"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAllowedKind(value: unknown): value is LlmReadinessModelOutputKind {
  return typeof value === "string" && llmReadinessModelOutputKinds.includes(value as LlmReadinessModelOutputKind);
}

function hasSafeSourceRefs(value: unknown): boolean {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((sourceRef) =>
      isRecord(sourceRef) &&
      typeof sourceRef.objectType === "string" &&
      typeof sourceRef.objectId === "string" &&
      sourceRef.objectId.trim().length > 0
    );
}

export function validateLlmReadinessModelOutputCandidate(
  candidate: unknown
): LlmReadinessModelOutputValidation {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ["candidate must be an object"] };
  }

  if (candidate.contractVersion !== llmReadinessContractVersion) {
    errors.push("contractVersion must match llm-readiness-v0");
  }

  if (!hasAllowedKind(candidate.kind)) {
    errors.push("kind must be an allowed draft output kind");
  }

  if (!hasSafeSourceRefs(candidate.sourceRefs)) {
    errors.push("sourceRefs must contain safe object references");
  }

  if (candidate.humanApprovalRequired !== true) {
    errors.push("humanApprovalRequired must be true");
  }

  if (candidate.writesProductObject !== false) {
    errors.push("writesProductObject must be false");
  }

  if (typeof candidate.text !== "string" || candidate.text.trim().length === 0) {
    errors.push("text must be a non-empty draft string");
  }

  for (const forbiddenKey of llmReadinessForbiddenPayloadKeys) {
    if (forbiddenKey in candidate) {
      errors.push(`${forbiddenKey} is not allowed in readiness output candidates`);
    }
  }

  return { valid: errors.length === 0, errors };
}
