import {
  validateLlmReadinessModelInputCandidate,
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate
} from "./llm-readiness.js";
import { isLlmReadinessSyntheticLiveSliceEnabled } from "./llm-readiness-synthetic-live-slice.js";

export const byoLlmBoundaryPolicyVersion = "byo-llm-boundary-v0" as const;

export type ByoLlmProviderKind = "fixture" | "openai" | "codex_cli" | "custom_byo_provider";

export type ByoLlmDraftUseCase =
  | "clarification_question_draft"
  | "production_draft_extraction"
  | "recipe_research_summary_draft"
  | "search_query_suggestion_draft"
  | "uncertainty_summary_draft";

export type ByoLlmDraftUseCaseStatus = "implemented_readiness_contract" | "future_allowed_shape";

export interface ByoLlmDraftUseCaseBoundary {
  draftType: ByoLlmDraftUseCase;
  status: ByoLlmDraftUseCaseStatus;
  providerCallsDefault: "disabled";
  externalCallsByDefault: false;
  humanApprovalRequired: true;
  writesProductObject: false;
}

export interface ByoLlmProviderBoundary {
  providerKind: ByoLlmProviderKind;
  adapterId: string;
  status: "fixture_only" | "synthetic_live_transport" | "local_operator_transport" | "future_provider_boundary";
  explicitOptInRequired: boolean;
  realCustomerDataAllowed: false;
  writeEffectsAllowed: false;
  operationalNote?: string;
}

export interface ByoLlmBoundaryPolicy {
  policyVersion: typeof byoLlmBoundaryPolicyVersion;
  providerCallsDefault: "disabled";
  providerCallsRequireExplicitOptIn: true;
  realCustomerDataDefault: "rejected";
  allowedDataMode: "synthetic_or_demo_only";
  schemaValidationRequired: true;
  humanApprovalRequired: true;
  writesProductObject: false;
  productObjectWritesAllowed: false;
  allowedDraftUseCases: readonly ByoLlmDraftUseCaseBoundary[];
  providerBoundaries: readonly ByoLlmProviderBoundary[];
}

export interface ByoLlmProviderRunBoundaryRequest {
  input: LlmReadinessModelInput;
  env?: Record<string, string | undefined>;
  providerKind: ByoLlmProviderKind;
  outputCandidate?: LlmReadinessModelOutputCandidate;
}

export interface ByoLlmProviderRunBoundaryValidation {
  valid: boolean;
  errors: string[];
}

export const byoLlmBoundaryPolicy = {
  policyVersion: byoLlmBoundaryPolicyVersion,
  providerCallsDefault: "disabled",
  providerCallsRequireExplicitOptIn: true,
  realCustomerDataDefault: "rejected",
  allowedDataMode: "synthetic_or_demo_only",
  schemaValidationRequired: true,
  humanApprovalRequired: true,
  writesProductObject: false,
  productObjectWritesAllowed: false,
  allowedDraftUseCases: [
    {
      draftType: "clarification_question_draft",
      status: "implemented_readiness_contract",
      providerCallsDefault: "disabled",
      externalCallsByDefault: false,
      humanApprovalRequired: true,
      writesProductObject: false
    },
    {
      draftType: "production_draft_extraction",
      status: "implemented_readiness_contract",
      providerCallsDefault: "disabled",
      externalCallsByDefault: false,
      humanApprovalRequired: true,
      writesProductObject: false
    },
    {
      draftType: "recipe_research_summary_draft",
      status: "future_allowed_shape",
      providerCallsDefault: "disabled",
      externalCallsByDefault: false,
      humanApprovalRequired: true,
      writesProductObject: false
    },
    {
      draftType: "search_query_suggestion_draft",
      status: "future_allowed_shape",
      providerCallsDefault: "disabled",
      externalCallsByDefault: false,
      humanApprovalRequired: true,
      writesProductObject: false
    },
    {
      draftType: "uncertainty_summary_draft",
      status: "future_allowed_shape",
      providerCallsDefault: "disabled",
      externalCallsByDefault: false,
      humanApprovalRequired: true,
      writesProductObject: false
    }
  ],
  providerBoundaries: [
    {
      providerKind: "fixture",
      adapterId: "llm-readiness-fixture-provider-adapter",
      status: "fixture_only",
      explicitOptInRequired: false,
      realCustomerDataAllowed: false,
      writeEffectsAllowed: false
    },
    {
      providerKind: "openai",
      adapterId: "openai-responses",
      status: "synthetic_live_transport",
      explicitOptInRequired: true,
      realCustomerDataAllowed: false,
      writeEffectsAllowed: false
    },
    {
      providerKind: "codex_cli",
      adapterId: "codex-cli",
      status: "local_operator_transport",
      explicitOptInRequired: true,
      realCustomerDataAllowed: false,
      writeEffectsAllowed: false,
      operationalNote: "Nur fuer lokalen Operator-Betrieb; Server- und Batch-Nutzung gehoeren auf die API-Schiene."
    },
    {
      providerKind: "custom_byo_provider",
      adapterId: "custom-byo-provider",
      status: "future_provider_boundary",
      explicitOptInRequired: true,
      realCustomerDataAllowed: false,
      writeEffectsAllowed: false
    }
  ]
} as const satisfies ByoLlmBoundaryPolicy;

export function isByoLlmProviderOptInEnabled(
  env: Record<string, string | undefined> = {}
): boolean {
  return isLlmReadinessSyntheticLiveSliceEnabled(env);
}

export function allowedByoLlmDraftUseCaseByType(
  draftType: string
): ByoLlmDraftUseCaseBoundary | undefined {
  return byoLlmBoundaryPolicy.allowedDraftUseCases.find((useCase) => useCase.draftType === draftType);
}

export function byoLlmProviderBoundaryByKind(
  providerKind: ByoLlmProviderKind
): ByoLlmProviderBoundary | undefined {
  return byoLlmBoundaryPolicy.providerBoundaries.find((provider) => provider.providerKind === providerKind);
}

export function validateByoLlmProviderRunBoundary(
  request: ByoLlmProviderRunBoundaryRequest
): ByoLlmProviderRunBoundaryValidation {
  const errors: string[] = [];
  const providerBoundary = byoLlmProviderBoundaryByKind(request.providerKind);
  const inputValidation = validateLlmReadinessModelInputCandidate(request.input);

  errors.push(...inputValidation.errors.map((error) => `input.${error}`));

  if (!providerBoundary) {
    errors.push("providerKind must be registered in the BYO LLM boundary policy");
  } else {
    if (providerBoundary.realCustomerDataAllowed !== false) {
      errors.push("provider boundary must not allow real customer data");
    }

    if (providerBoundary.writeEffectsAllowed !== false) {
      errors.push("provider boundary must not allow write effects");
    }

    if (
      providerBoundary.explicitOptInRequired &&
      !isByoLlmProviderOptInEnabled(request.env)
    ) {
      errors.push("provider calls require explicit synthetic-live opt-in");
    }
  }

  if (request.input.policy.dataMode !== byoLlmBoundaryPolicy.allowedDataMode) {
    errors.push("input.policy.dataMode must stay synthetic_or_demo_only");
  }

  if (request.outputCandidate !== undefined) {
    const outputValidation = validateLlmReadinessModelOutputCandidate(request.outputCandidate);
    errors.push(...outputValidation.errors.map((error) => `outputCandidate.${error}`));

    const useCase = allowedByoLlmDraftUseCaseByType(request.outputCandidate.kind);
    if (!useCase) {
      errors.push("outputCandidate.kind must be an allowed BYO LLM draft use case");
    } else {
      if (useCase.humanApprovalRequired !== true) {
        errors.push("BYO LLM draft use case must require human approval");
      }

      if (useCase.writesProductObject !== false) {
        errors.push("BYO LLM draft use case must not write product objects");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)]
  };
}
