export const llmReadinessContractVersion = "llm-readiness-v0";

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
];

export const llmReadinessToolEffects = ["read", "draft", "write"];

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
];

export const llmReadinessModelInputKinds = [
  "clarification_draft_request",
  "operator_summary_request"
];

export const llmReadinessModelOutputKinds = [
  "clarification_question_draft",
  "operator_summary_draft"
];

export const llmReadinessSourceObjectTypes = [
  "accepted_event_spec",
  "production_plan",
  "purchase_list",
  "conversation_projection",
  "safe_source_anchor"
];

export const llmReadinessForbiddenPayloadKeys = [
  "rawText",
  "extractedText",
  "prompt",
  "messages",
  "providerResponse",
  "toolCalls",
  "secret",
  "apiKey"
];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAllowedKind(value) {
  return typeof value === "string" && llmReadinessModelOutputKinds.includes(value);
}

function hasAllowedInputKind(value) {
  return typeof value === "string" && llmReadinessModelInputKinds.includes(value);
}

function hasAllowedSourceObjectType(value) {
  return typeof value === "string" && llmReadinessSourceObjectTypes.includes(value);
}

function hasSafeSourceRefs(value) {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((sourceRef) =>
      isRecord(sourceRef) &&
      hasAllowedSourceObjectType(sourceRef.objectType) &&
      typeof sourceRef.objectId === "string" &&
      sourceRef.objectId.trim().length > 0
    );
}

function hasAllowedInputToolEffects(value) {
  if (!Array.isArray(value)) {
    return false;
  }

  if (value.length === 1) {
    return value[0] === "read";
  }

  return value.length === 2 && value[0] === "read" && value[1] === "draft";
}

function isStructuredCandidateValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "string" || typeof value === "boolean" || value === null;
}

function validateStructuredCandidate(value) {
  const errors = [];

  if (!isRecord(value)) {
    return ["structuredCandidate must be a flat scalar object"];
  }

  for (const [key, candidateValue] of Object.entries(value)) {
    if (key.trim().length === 0) {
      errors.push("structuredCandidate keys must be non-empty strings");
    }

    if (llmReadinessForbiddenPayloadKeys.includes(key)) {
      errors.push("structuredCandidate must not contain forbidden payload keys");
    }

    if (!isStructuredCandidateValue(candidateValue)) {
      errors.push("structuredCandidate must be a flat scalar object");
    }
  }

  return [...new Set(errors)];
}

export function validateLlmReadinessModelInputCandidate(candidate) {
  const errors = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ["candidate must be an object"] };
  }

  if (candidate.contractVersion !== llmReadinessContractVersion) {
    errors.push("contractVersion must match llm-readiness-v0");
  }

  if (typeof candidate.inputId !== "string" || candidate.inputId.trim().length === 0) {
    errors.push("inputId must be a non-empty string");
  }

  if (!hasAllowedInputKind(candidate.kind)) {
    errors.push("kind must be an allowed draft input kind");
  }

  if (!hasSafeSourceRefs(candidate.sourceRefs)) {
    errors.push("sourceRefs must contain safe object references");
  }

  if (!isRecord(candidate.policy)) {
    errors.push("policy must be an object");
  } else {
    if (candidate.policy.providerCalls !== "disabled") {
      errors.push("policy.providerCalls must be disabled");
    }

    if (candidate.policy.dataMode !== "synthetic_or_demo_only") {
      errors.push("policy.dataMode must be synthetic_or_demo_only");
    }

    if (!hasAllowedInputToolEffects(candidate.policy.allowedToolEffects)) {
      errors.push("policy.allowedToolEffects must be read or read+draft only");
    }
  }

  for (const forbiddenKey of llmReadinessForbiddenPayloadKeys) {
    if (forbiddenKey in candidate) {
      errors.push(`${forbiddenKey} is not allowed in readiness input candidates`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateLlmReadinessModelOutputCandidate(candidate) {
  const errors = [];

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

  if (candidate.structuredCandidate !== undefined) {
    errors.push(...validateStructuredCandidate(candidate.structuredCandidate));
  }

  for (const forbiddenKey of llmReadinessForbiddenPayloadKeys) {
    if (forbiddenKey in candidate) {
      errors.push(`${forbiddenKey} is not allowed in readiness output candidates`);
    }
  }

  return { valid: errors.length === 0, errors };
}
