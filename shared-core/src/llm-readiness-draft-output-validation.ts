import {
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputValidation
} from "./llm-readiness.js";
import { validateProductionDossierDraftOutput } from "./llm-readiness-production-dossier-output.js";

export function validateLlmReadinessDraftOutputForInput(
  outputCandidate: unknown,
  expectedInput: LlmReadinessModelInput
): LlmReadinessModelOutputValidation {
  if (expectedInput.kind === "production_dossier_draft_request") {
    return validateProductionDossierDraftOutput(outputCandidate, expectedInput);
  }

  return validateLlmReadinessModelOutputCandidate(outputCandidate);
}
