import { validateLlmReadinessModelOutputCandidate } from "./llm-readiness.js";
import { validateLlmReadinessEvalFixture } from "./fixtures/llm-readiness-eval-fixtures.js";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDraftText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function sourceRefKey(sourceRef) {
  return `${sourceRef.objectType}:${sourceRef.objectId}`;
}

function collectSourceRefKeys(sourceRefs) {
  if (!Array.isArray(sourceRefs)) {
    return [];
  }

  return sourceRefs
    .filter(isRecord)
    .map((sourceRef) => ({
      objectType: sourceRef.objectType,
      objectId: sourceRef.objectId
    }))
    .filter((sourceRef) => typeof sourceRef.objectType === "string" && typeof sourceRef.objectId === "string")
    .map(sourceRefKey)
    .sort();
}

function sameStringList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameStructuredCandidate(expected, actual) {
  if (expected === undefined && actual === undefined) {
    return true;
  }

  if (!isRecord(actual) || expected === undefined) {
    return false;
  }

  const expectedEntries = Object.entries(expected).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const actualEntries = Object.entries(actual).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return (
    expectedEntries.length === actualEntries.length &&
    expectedEntries.every(([expectedKey, expectedValue], index) => {
      const [actualKey, actualValue] = actualEntries[index] ?? [];
      return expectedKey === actualKey && expectedValue === actualValue;
    })
  );
}

export function validateLlmReadinessEvalOutputCandidateMatch(fixture, candidate) {
  const errors = [];

  const fixtureValidation = validateLlmReadinessEvalFixture(fixture);
  for (const fixtureError of fixtureValidation.errors) {
    errors.push(`fixture.${fixtureError}`);
  }

  const candidateValidation = validateLlmReadinessModelOutputCandidate(candidate);
  for (const candidateError of candidateValidation.errors) {
    errors.push(`candidate.${candidateError}`);
  }

  if (!isRecord(fixture) || !isRecord(fixture.expectedOutput) || !isRecord(candidate)) {
    return { valid: errors.length === 0, errors };
  }

  const expectedOutput = fixture.expectedOutput;
  const outputCandidate = candidate;

  if (outputCandidate.kind !== expectedOutput.kind) {
    errors.push("candidate.kind must match fixture expectedOutput.kind");
  }

  if (outputCandidate.humanApprovalRequired !== expectedOutput.humanApprovalRequired) {
    errors.push("candidate.humanApprovalRequired must match fixture expectedOutput.humanApprovalRequired");
  }

  if (outputCandidate.writesProductObject !== expectedOutput.writesProductObject) {
    errors.push("candidate.writesProductObject must match fixture expectedOutput.writesProductObject");
  }

  if (
    Array.isArray(outputCandidate.sourceRefs) &&
    Array.isArray(expectedOutput.sourceRefs) &&
    !sameStringList(collectSourceRefKeys(outputCandidate.sourceRefs), collectSourceRefKeys(expectedOutput.sourceRefs))
  ) {
    errors.push("candidate.sourceRefs must match fixture expectedOutput.sourceRefs");
  }

  if (
    typeof outputCandidate.text === "string" &&
    typeof expectedOutput.text === "string" &&
    normalizeDraftText(outputCandidate.text) !== normalizeDraftText(expectedOutput.text)
  ) {
    errors.push("candidate.text must match fixture expectedOutput.text");
  }

  if (!sameStructuredCandidate(expectedOutput.structuredCandidate, outputCandidate.structuredCandidate)) {
    errors.push("candidate.structuredCandidate must match fixture expectedOutput.structuredCandidate");
  }

  return { valid: errors.length === 0, errors };
}
