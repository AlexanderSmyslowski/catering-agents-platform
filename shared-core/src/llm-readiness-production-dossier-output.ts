import {
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessSourceRef
} from "./llm-readiness.js";

export interface ProductionDossierDraftOutputValidation {
  valid: boolean;
  errors: string[];
}

const requiredProductionDossierSectionTokens = [
  "verstaendnis",
  "rueckfragen",
  "annahmen",
  "kalkulation",
  "mengen",
  "rezept",
  "metro",
  "mise-en-place",
  "abschluss"
] as const;

function normalizeGermanSearchText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceRefKey(sourceRef: LlmReadinessSourceRef): string {
  return `${sourceRef.objectType}:${sourceRef.objectId}`;
}

function sourceRefIdentityErrors(
  expectedInput: LlmReadinessModelInput,
  outputCandidate: LlmReadinessModelOutputCandidate
): string[] {
  const expected = expectedInput.sourceRefs.map(sourceRefKey).sort();
  const actual = outputCandidate.sourceRefs.map(sourceRefKey).sort();
  const missing = expected.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !expected.includes(key));
  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(`sourceRefs missing expected artifacts: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    errors.push(`sourceRefs contain unexpected artifacts: ${extra.join(", ")}`);
  }

  return errors;
}

function structuredCandidateErrors(outputCandidate: LlmReadinessModelOutputCandidate): string[] {
  const structuredCandidate = outputCandidate.structuredCandidate ?? {};
  const errors: string[] = [];

  if (structuredCandidate.sectionCount !== 9) {
    errors.push("structuredCandidate.sectionCount must be 9");
  }
  if (structuredCandidate.summaryKind !== "production_dossier") {
    errors.push("structuredCandidate.summaryKind must be production_dossier");
  }
  if (structuredCandidate.approval !== "pending_human_review") {
    errors.push("structuredCandidate.approval must be pending_human_review");
  }
  if (structuredCandidate.dataMode !== "synthetic_or_demo_only") {
    errors.push("structuredCandidate.dataMode must be synthetic_or_demo_only");
  }

  return errors;
}

function sectionCoverageErrors(outputCandidate: LlmReadinessModelOutputCandidate): string[] {
  const normalizedText = normalizeGermanSearchText(outputCandidate.text);
  const missing = requiredProductionDossierSectionTokens.filter((token) => !normalizedText.includes(token));

  return missing.length > 0
    ? [`text must mention production dossier sections: missing ${missing.join(", ")}`]
    : [];
}

export function validateProductionDossierDraftOutput(
  outputCandidate: unknown,
  expectedInput: LlmReadinessModelInput
): ProductionDossierDraftOutputValidation {
  const genericErrors = validateLlmReadinessModelOutputCandidate(outputCandidate).errors.map((error) =>
    `outputCandidate.${error}`
  );
  if (genericErrors.length > 0 || !outputCandidate) {
    return {
      valid: false,
      errors: [...new Set(genericErrors)]
    };
  }

  const candidate = outputCandidate as LlmReadinessModelOutputCandidate;
  const errors = [
    ...(candidate.kind === "production_dossier_draft"
      ? []
      : ["outputCandidate.kind must be production_dossier_draft"]),
    ...(expectedInput.kind === "production_dossier_draft_request"
      ? []
      : ["expectedInput.kind must be production_dossier_draft_request"]),
    ...sourceRefIdentityErrors(expectedInput, candidate),
    ...structuredCandidateErrors(candidate),
    ...sectionCoverageErrors(candidate)
  ];

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)]
  };
}
