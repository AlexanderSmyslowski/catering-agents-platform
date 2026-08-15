import {
  llmReadinessForbiddenPayloadKeys,
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelOutputCandidate
} from "./llm-readiness.js";

export interface ProductionDraftReferenceExpectation {
  caseId: string;
  sourceSha256: string;
  requiredComponentLabels: readonly string[];
  allowedOpenQuestionFields: readonly string[];
  forbiddenComponentLabels: readonly string[];
}

export interface ProductionDraftReferenceAssessment {
  passed: boolean;
  missingComponentLabels: string[];
  duplicateComponentLabels: string[];
  forbiddenComponentLabels: string[];
  errors: string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reference labels are human-facing, so only representation differences are
 * normalized. Matching remains exact after normalization; substrings and
 * edit-distance matches would make a provider omission look complete.
 */
function normalizeReferenceText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("de-DE");
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function collectForbiddenPayloadKeys(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenPayloadKeys(item, found);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (llmReadinessForbiddenPayloadKeys.includes(key as (typeof llmReadinessForbiddenPayloadKeys)[number])) {
      found.add(key);
    }
    collectForbiddenPayloadKeys(nested, found);
  }
}

function outputShape(output: LlmReadinessModelOutputCandidate): {
  components: JsonRecord[];
  openQuestions: JsonRecord[];
  errors: string[];
} {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.text);
  } catch {
    return { components: [], openQuestions: [], errors: ["output text must be valid JSON"] };
  }

  if (!isRecord(parsed)) {
    return { components: [], openQuestions: [], errors: ["output JSON must be an object"] };
  }
  if (!Array.isArray(parsed.components)) errors.push("output components must be an array");
  if (!Array.isArray(parsed.openQuestions)) errors.push("output openQuestions must be an array");

  const components = Array.isArray(parsed.components)
    ? parsed.components.filter(isRecord)
    : [];
  const openQuestions = Array.isArray(parsed.openQuestions)
    ? parsed.openQuestions.filter(isRecord)
    : [];
  if (Array.isArray(parsed.components) && components.length !== parsed.components.length) {
    errors.push("every component must be an object");
  }
  if (Array.isArray(parsed.openQuestions) && openQuestions.length !== parsed.openQuestions.length) {
    errors.push("every open question must be an object");
  }
  return { components, openQuestions, errors };
}

function expectationErrors(expectation: ProductionDraftReferenceExpectation): string[] {
  const errors: string[] = [];
  if (!nonEmptyString(expectation.caseId)) errors.push("expectation caseId is required");
  if (!/^sha256:[a-f0-9]{64}$/u.test(expectation.sourceSha256)) errors.push("expectation sourceSha256 must be a sha256 digest");

  const checkLabels = (labels: unknown, name: string) => {
    if (!Array.isArray(labels) || labels.length === 0) errors.push(`expectation ${name} must not be empty`);
    const normalized = Array.isArray(labels) ? labels.filter(nonEmptyString).map(normalizeReferenceText) : [];
    if (!Array.isArray(labels) || normalized.length !== labels.length || normalized.some((value) => value.length === 0)) {
      errors.push(`expectation ${name} must contain non-empty labels`);
    }
    if (new Set(normalized).size !== normalized.length) errors.push(`expectation ${name} must not contain duplicates`);
  };
  checkLabels(expectation.requiredComponentLabels, "requiredComponentLabels");
  checkLabels(expectation.forbiddenComponentLabels, "forbiddenComponentLabels");
  if (!Array.isArray(expectation.allowedOpenQuestionFields) || expectation.allowedOpenQuestionFields.some((field) => !nonEmptyString(field))) {
    errors.push("expectation allowedOpenQuestionFields must contain non-empty fields");
  }
  return errors;
}

export function assessProductionDraftReference(
  expectation: ProductionDraftReferenceExpectation,
  output: LlmReadinessModelOutputCandidate
): ProductionDraftReferenceAssessment {
  const errors = expectationErrors(expectation);
  const missingComponentLabels: string[] = [];
  const duplicateComponentLabels: string[] = [];
  const forbiddenComponentLabels: string[] = [];

  const outputValidation = validateLlmReadinessModelOutputCandidate(output);
  if (!outputValidation.valid) errors.push("output candidate failed the readiness boundary");
  if (output.kind !== "production_draft_extraction") errors.push("output kind must be production_draft_extraction");
  const sourceRefs = Array.isArray(output.sourceRefs) ? output.sourceRefs : [];
  if (!sourceRefs.some((ref) => ref.objectType === "safe_source_anchor" && ref.objectId === expectation.sourceSha256)) {
    errors.push("output source reference does not match the expectation hash");
  }

  const shape = outputShape(output);
  errors.push(...shape.errors);
  const forbiddenPayloadKeys = new Set<string>();
  try {
    collectForbiddenPayloadKeys(JSON.parse(output.text), forbiddenPayloadKeys);
  } catch {
    // The shape error above is the only safe diagnostic for malformed text.
  }
  if (forbiddenPayloadKeys.size > 0) errors.push("output text contains a forbidden payload field");

  const requiredLabels = Array.isArray(expectation.requiredComponentLabels)
    ? expectation.requiredComponentLabels.filter(nonEmptyString)
    : [];
  const forbiddenLabels = Array.isArray(expectation.forbiddenComponentLabels)
    ? expectation.forbiddenComponentLabels.filter(nonEmptyString)
    : [];
  const requiredByNormalized = new Map(
    requiredLabels.map((label) => [normalizeReferenceText(label), label])
  );
  const forbiddenByNormalized = new Map(
    forbiddenLabels.map((label) => [normalizeReferenceText(label), label])
  );
  const seenCounts = new Map<string, number>();
  for (const component of shape.components) {
    if (!nonEmptyString(component.label)) {
      errors.push("every component label must be a non-empty string");
      continue;
    }
    const normalized = normalizeReferenceText(component.label);
    seenCounts.set(normalized, (seenCounts.get(normalized) ?? 0) + 1);
    const expectedLabel = requiredByNormalized.get(normalized);
    if (expectedLabel !== undefined && (seenCounts.get(normalized) ?? 0) > 1) {
      duplicateComponentLabels.push(expectedLabel);
    }
    const forbiddenLabel = forbiddenByNormalized.get(normalized);
    if (forbiddenLabel !== undefined) forbiddenComponentLabels.push(forbiddenLabel);
    if (expectedLabel === undefined && forbiddenLabel === undefined) {
      errors.push("output contains an unexpected component label");
    }
  }
  for (const [normalized, label] of requiredByNormalized) {
    if (!seenCounts.has(normalized)) missingComponentLabels.push(label);
  }
  if (missingComponentLabels.length > 0) errors.push("required component labels are missing");
  if (duplicateComponentLabels.length > 0) errors.push("required component labels are duplicated");
  if (forbiddenComponentLabels.length > 0) errors.push("forbidden component labels were emitted");

  const allowedQuestionFields = new Set(
    (Array.isArray(expectation.allowedOpenQuestionFields) ? expectation.allowedOpenQuestionFields : [])
      .filter(nonEmptyString)
      .map(normalizeReferenceText)
  );
  const seenQuestionFields = new Set<string>();
  for (const question of shape.openQuestions) {
    if (!nonEmptyString(question.field)) {
      errors.push("every open question field must be a non-empty string");
      continue;
    }
    const field = normalizeReferenceText(question.field);
    if (!allowedQuestionFields.has(field)) errors.push("output contains an unapproved open question field");
    if (seenQuestionFields.has(field)) errors.push("output contains a duplicate open question field");
    seenQuestionFields.add(field);
  }

  return {
    passed: errors.length === 0 && missingComponentLabels.length === 0 && duplicateComponentLabels.length === 0 && forbiddenComponentLabels.length === 0,
    missingComponentLabels,
    duplicateComponentLabels: [...new Set(duplicateComponentLabels)],
    forbiddenComponentLabels: [...new Set(forbiddenComponentLabels)],
    errors: [...new Set(errors)]
  };
}
