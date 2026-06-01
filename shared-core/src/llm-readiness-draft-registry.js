import {
  llmReadinessContractVersion,
  llmReadinessForbiddenPayloadKeys
} from "./llm-readiness.js";

export const llmReadinessDraftRegistryVersion = "llm-readiness-draft-registry-v0";

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
  }
];

export function findLlmReadinessDraftContractByInputKind(inputKind) {
  return llmReadinessDraftContracts.find((contract) => contract.inputKind === inputKind);
}
