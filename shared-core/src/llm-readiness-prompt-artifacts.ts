import type { LlmReadinessModelInputKind } from "./llm-readiness.js";
import {
  findLlmReadinessPromptSchemaEntryByInputKind,
  llmReadinessPromptSchemaRegistryVersion
} from "./llm-readiness-prompt-schema-registry.js";

export const llmReadinessPromptArtifactRegistryVersion = "llm-readiness-prompt-artifact-registry-v0" as const;

export type LlmReadinessPromptArtifactStatus =
  | "synthetic_live_ready"
  | "providerless_contract_only";

export interface LlmReadinessPromptArtifact {
  promptArtifactId: string;
  promptVersion: string;
  promptSchemaId: string;
  promptSchemaRegistryVersion: typeof llmReadinessPromptSchemaRegistryVersion;
  inputKind: LlmReadinessModelInputKind;
  status: LlmReadinessPromptArtifactStatus;
  systemPrompt: string;
  userPromptTemplate: string;
}

export const llmReadinessPromptArtifacts = [
  {
    promptArtifactId: "clarification-question-draft.prompt",
    promptVersion: "v0",
    promptSchemaId: "clarification-question-draft-prompt-schema.v0",
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    inputKind: "clarification_draft_request",
    status: "synthetic_live_ready",
    systemPrompt:
      "Du erstellst genau einen menschlich freizugebenden Klaerungsfragen-Entwurf fuer einen synthetischen Catering-Fall. " +
      "Arbeite nur mit den gegebenen synthetischen Fixture-Hinweisen. " +
      "Erfinde keine neuen Fakten, schreibe nichts in Produktobjekte und gib nur JSON zurueck.",
    userPromptTemplate:
      "Erzeuge ein JSON-Objekt mit den Feldern text, reason und reasonCode. " +
      "text muss eine einzelne deutsche Rueckfrage sein. " +
      "reason und reasonCode muessen knappe scalar-Werte sein. " +
      "Nutze nur die unten genannten Fixture-Hinweise und SourceRefs."
  },
  {
    promptArtifactId: "operator-summary-draft.prompt",
    promptVersion: "v0",
    promptSchemaId: "operator-summary-draft-prompt-schema.v0",
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    inputKind: "operator_summary_request",
    status: "providerless_contract_only",
    systemPrompt:
      "Dieser Prompt-Artefaktplatzhalter bleibt vorerst providerlos und dient nur als nicht-leerer Registry-Anker.",
    userPromptTemplate:
      "Kein live freigegebener Provider-Lauf fuer operator_summary_request in dieser Phase."
  },
  {
    promptArtifactId: "production-dossier-draft.prompt",
    promptVersion: "v0",
    promptSchemaId: "production-dossier-draft-prompt-schema.v0",
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    inputKind: "production_dossier_draft_request",
    status: "providerless_contract_only",
    systemPrompt:
      "Dieser Prompt-Artefaktplatzhalter beschreibt einen kuenftigen Produktionsdossier-Entwurf aus vorhandenen Artefakten. " +
      "Er bleibt providerlos, synthetisch/demo-only, draft-only und ohne Schreibwirkung.",
    userPromptTemplate:
      "Entwirf ein rein menschlich zu pruefendes Produktionsdossier aus den vorhandenen SourceRefs. " +
      "Der Entwurf muss neun sichtbare Abschnitte enthalten: Verstaendnis des Angebots, Rueckfragen, Annahmen, " +
      "Kalkulationsuebersicht, Mengenkalkulation je Gericht, Rezeptkarten, Metro-Einkaufsliste, Mise-en-Place und " +
      "Abschlusspruefung. structuredCandidate.sectionCount muss 9 sein, summaryKind production_dossier, " +
      "dataMode synthetic_or_demo_only und approval pending_human_review. " +
      "Nutze nur vorhandene SourceRefs, erfinde keine Fakten und schreibe nichts in Produktobjekte."
  }
] as const satisfies readonly LlmReadinessPromptArtifact[];

export function findLlmReadinessPromptArtifactByInputKind(
  inputKind: LlmReadinessModelInputKind
): LlmReadinessPromptArtifact | undefined {
  return llmReadinessPromptArtifacts.find((artifact) => artifact.inputKind === inputKind);
}

export function validateLlmReadinessPromptArtifacts(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const artifact of llmReadinessPromptArtifacts) {
    const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind(artifact.inputKind);

    if (!promptSchemaEntry) {
      errors.push(`missing prompt schema entry for ${artifact.inputKind}`);
      continue;
    }

    if (artifact.promptSchemaId !== promptSchemaEntry.promptSchemaId) {
      errors.push(`${artifact.inputKind} promptSchemaId must match prompt schema registry`);
    }

    if (artifact.promptArtifactId !== promptSchemaEntry.promptArtifactId) {
      errors.push(`${artifact.inputKind} promptArtifactId must match prompt schema registry`);
    }

    if (artifact.promptVersion !== promptSchemaEntry.promptVersion) {
      errors.push(`${artifact.inputKind} promptVersion must match prompt schema registry`);
    }

    if (artifact.systemPrompt.trim().length === 0) {
      errors.push(`${artifact.inputKind} systemPrompt must be non-empty`);
    }

    if (artifact.userPromptTemplate.trim().length === 0) {
      errors.push(`${artifact.inputKind} userPromptTemplate must be non-empty`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
