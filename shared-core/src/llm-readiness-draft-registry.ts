import {
  llmReadinessContractVersion,
  llmReadinessForbiddenPayloadKeys,
  type LlmReadinessDataMode,
  type LlmReadinessModelInputKind,
  type LlmReadinessModelOutputKind,
  type LlmReadinessSourceObjectType,
  type LlmReadinessToolEffect
} from "./llm-readiness.js";

export const llmReadinessDraftRegistryVersion = "llm-readiness-draft-registry-v0" as const;

export type LlmReadinessDraftContractStatus = "schema_contract_only";

export interface LlmReadinessDraftContract {
  contractId: string;
  registryVersion: typeof llmReadinessDraftRegistryVersion;
  readinessContractVersion: typeof llmReadinessContractVersion;
  inputKind: LlmReadinessModelInputKind;
  outputKind: LlmReadinessModelOutputKind;
  status: LlmReadinessDraftContractStatus;
  providerCalls: "disabled";
  dataMode: LlmReadinessDataMode;
  allowedToolEffects: readonly LlmReadinessToolEffect[];
  requiredSourceObjectTypes: readonly LlmReadinessSourceObjectType[];
  humanApprovalRequired: true;
  writesProductObject: false;
  forbiddenPayloadKeys: readonly (typeof llmReadinessForbiddenPayloadKeys)[number][];
  description: string;
}

export const llmReadinessDraftContracts = [
  {
    contractId: "clarification-question-draft.v0",
    registryVersion: llmReadinessDraftRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    inputKind: "clarification_draft_request",
    outputKind: "clarification_question_draft",
    status: "schema_contract_only",
    providerCalls: "disabled",
    dataMode: "synthetic_or_demo_only",
    allowedToolEffects: ["read", "draft"],
    requiredSourceObjectTypes: ["accepted_event_spec"],
    humanApprovalRequired: true,
    writesProductObject: false,
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Contract for a human-reviewed clarification question draft from safe synthetic context."
  },
  {
    contractId: "operator-summary-draft.v0",
    registryVersion: llmReadinessDraftRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    inputKind: "operator_summary_request",
    outputKind: "operator_summary_draft",
    status: "schema_contract_only",
    providerCalls: "disabled",
    dataMode: "synthetic_or_demo_only",
    allowedToolEffects: ["read"],
    requiredSourceObjectTypes: ["accepted_event_spec", "production_plan", "purchase_list"],
    humanApprovalRequired: true,
    writesProductObject: false,
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Contract for a human-reviewed operator summary draft from existing product-object references."
  },
  {
    contractId: "production-draft-extraction.v0",
    registryVersion: llmReadinessDraftRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    inputKind: "production_draft_request",
    outputKind: "production_draft_extraction",
    status: "schema_contract_only",
    providerCalls: "disabled",
    dataMode: "synthetic_or_demo_only",
    allowedToolEffects: ["read", "draft"],
    requiredSourceObjectTypes: ["safe_source_anchor"],
    humanApprovalRequired: true,
    writesProductObject: false,
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Contract for a human-reviewed ProductionDraft extraction from an operator-approved source document."
  },
  {
    contractId: "intake-shadow-extraction.v0",
    registryVersion: llmReadinessDraftRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    inputKind: "intake_shadow_request",
    outputKind: "intake_shadow_extraction",
    status: "schema_contract_only",
    providerCalls: "disabled",
    dataMode: "synthetic_or_demo_only",
    allowedToolEffects: ["read", "draft"],
    requiredSourceObjectTypes: ["safe_source_anchor"],
    humanApprovalRequired: true,
    writesProductObject: false,
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Contract for comparing an LLM intake extraction against the regex baseline without writing product objects."
  },
  {
    contractId: "offer-package-classification.v0",
    registryVersion: llmReadinessDraftRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    inputKind: "offer_package_classification_request",
    outputKind: "offer_package_classification_draft",
    status: "schema_contract_only",
    providerCalls: "disabled",
    dataMode: "pseudonymized_approved",
    allowedToolEffects: ["read", "draft"],
    requiredSourceObjectTypes: ["safe_source_anchor"],
    humanApprovalRequired: true,
    writesProductObject: false,
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Contract for classifying a pseudonymized approved offer text against curated offer package ids."
  }
] as const satisfies readonly LlmReadinessDraftContract[];

export function findLlmReadinessDraftContractByInputKind(
  inputKind: LlmReadinessModelInputKind
): LlmReadinessDraftContract | undefined {
  return llmReadinessDraftContracts.find((contract) => contract.inputKind === inputKind);
}
