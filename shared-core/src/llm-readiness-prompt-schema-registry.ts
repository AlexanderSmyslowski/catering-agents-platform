import {
  llmReadinessContractVersion,
  llmReadinessForbiddenPayloadKeys,
  type LlmReadinessModelInputKind,
  type LlmReadinessModelOutputKind,
  type LlmReadinessSourceObjectType,
  type LlmReadinessToolEffect
} from "./llm-readiness.js";

export const llmReadinessPromptSchemaRegistryVersion = "llm-readiness-prompt-schema-registry-v0" as const;

export type LlmReadinessPromptSchemaRegistryStatus = "schema_contract_only";

export interface LlmReadinessPromptSchemaRegistryEntry {
  promptSchemaId: string;
  registryVersion: typeof llmReadinessPromptSchemaRegistryVersion;
  readinessContractVersion: typeof llmReadinessContractVersion;
  draftContractId: string;
  inputKind: LlmReadinessModelInputKind;
  outputKind: LlmReadinessModelOutputKind;
  status: LlmReadinessPromptSchemaRegistryStatus;
  promptArtifactId: string;
  promptVersion: string;
  policyArtifactId: string;
  policyVersion: string;
  outputSchemaId: string;
  providerCalls: "disabled";
  dataMode: "synthetic_or_demo_only";
  allowedToolEffects: readonly LlmReadinessToolEffect[];
  requiredSourceObjectTypes: readonly LlmReadinessSourceObjectType[];
  humanApprovalRequired: true;
  writesProductObject: false;
  fixtureIds: readonly string[];
  forbiddenPayloadKeys: readonly (typeof llmReadinessForbiddenPayloadKeys)[number][];
  description: string;
}

export const llmReadinessPromptSchemaRegistry = [
  {
    promptSchemaId: "clarification-question-draft-prompt-schema.v0",
    registryVersion: llmReadinessPromptSchemaRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    draftContractId: "clarification-question-draft.v0",
    inputKind: "clarification_draft_request",
    outputKind: "clarification_question_draft",
    status: "schema_contract_only",
    promptArtifactId: "clarification-question-draft.prompt",
    promptVersion: "v0",
    policyArtifactId: "clarification-question-draft.policy",
    policyVersion: "v0",
    outputSchemaId: "clarification-question-draft.output-schema.v0",
    providerCalls: "disabled",
    dataMode: "synthetic_or_demo_only",
    allowedToolEffects: ["read", "draft"],
    requiredSourceObjectTypes: ["accepted_event_spec"],
    humanApprovalRequired: true,
    writesProductObject: false,
    fixtureIds: ["llm-eval-synthetic-coffee-break-missing-attendees"],
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Schema-only prompt, policy and output-schema metadata for clarification draft readiness."
  },
  {
    promptSchemaId: "operator-summary-draft-prompt-schema.v0",
    registryVersion: llmReadinessPromptSchemaRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    draftContractId: "operator-summary-draft.v0",
    inputKind: "operator_summary_request",
    outputKind: "operator_summary_draft",
    status: "schema_contract_only",
    promptArtifactId: "operator-summary-draft.prompt",
    promptVersion: "v0",
    policyArtifactId: "operator-summary-draft.policy",
    policyVersion: "v0",
    outputSchemaId: "operator-summary-draft.output-schema.v0",
    providerCalls: "disabled",
    dataMode: "synthetic_or_demo_only",
    allowedToolEffects: ["read"],
    requiredSourceObjectTypes: ["accepted_event_spec", "production_plan", "purchase_list"],
    humanApprovalRequired: true,
    writesProductObject: false,
    fixtureIds: ["llm-eval-synthetic-buffet-operator-summary"],
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Schema-only prompt, policy and output-schema metadata for operator summary readiness."
  },
  {
    promptSchemaId: "production-dossier-draft-prompt-schema.v0",
    registryVersion: llmReadinessPromptSchemaRegistryVersion,
    readinessContractVersion: llmReadinessContractVersion,
    draftContractId: "production-dossier-draft.v0",
    inputKind: "production_dossier_draft_request",
    outputKind: "production_dossier_draft",
    status: "schema_contract_only",
    promptArtifactId: "production-dossier-draft.prompt",
    promptVersion: "v0",
    policyArtifactId: "production-dossier-draft.policy",
    policyVersion: "v0",
    outputSchemaId: "production-dossier-draft.output-schema.v0",
    providerCalls: "disabled",
    dataMode: "synthetic_or_demo_only",
    allowedToolEffects: ["read", "draft"],
    requiredSourceObjectTypes: [
      "accepted_event_spec",
      "production_plan",
      "purchase_list",
      "recipe_card",
      "conversation_projection"
    ],
    humanApprovalRequired: true,
    writesProductObject: false,
    fixtureIds: ["llm-eval-synthetic-koepff-production-dossier"],
    forbiddenPayloadKeys: llmReadinessForbiddenPayloadKeys,
    description: "Schema-only prompt, policy and output-schema metadata for production dossier draft readiness."
  }
] as const satisfies readonly LlmReadinessPromptSchemaRegistryEntry[];

export function findLlmReadinessPromptSchemaEntryByContractId(
  draftContractId: string
): LlmReadinessPromptSchemaRegistryEntry | undefined {
  return llmReadinessPromptSchemaRegistry.find((entry) => entry.draftContractId === draftContractId);
}

export function findLlmReadinessPromptSchemaEntryByInputKind(
  inputKind: LlmReadinessModelInputKind
): LlmReadinessPromptSchemaRegistryEntry | undefined {
  return llmReadinessPromptSchemaRegistry.find((entry) => entry.inputKind === inputKind);
}
