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
    promptArtifactId: "production-draft-extraction.prompt",
    promptVersion: "v0",
    promptSchemaId: "production-draft-extraction-prompt-schema.v0",
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    inputKind: "production_draft_request",
    status: "synthetic_live_ready",
    systemPrompt:
      "Du erstellst aus einem operatorfreigegebenen, anonymisierten Catering-Angebot eine vollstaendige, menschlich zu pruefende Inventur fuer einen ProductionDraft. " +
      "Arbeite ausschliesslich mit dem Dokument, schreibe keine Produktobjekte, erfinde keine Gerichte, mappe keine Rezepte automatisch und gib nur JSON zurueck.",
    userPromptTemplate:
      "Extrahiere Eventdaten, Personenzahl, Serviceform, alle kulinarischen Angebotspositionen und nur wirklich notwendige Rueckfragen. " +
      "Gehe den Dokumenttext in Quellreihenfolge Zeile fuer Zeile durch. Jedes Gericht, Dessert, jede Sauce, Beilage oder andere kulinarische Position muss genau einmal als components-Eintrag oder bei echter Unlesbarkeit als openQuestions-Eintrag vorkommen. " +
      "Verbinde zusammengehoerende Bezeichnungen einer Position, ohne eigenstaendige Positionen zusammenzufassen. Bewahre die sichtbare Angebotsbezeichnung im label. " +
      "Setze eine Ernaehrungskategorie nur, wenn eine woertliche Quellenstelle genau diese Kategorie fuer die einzelne Komponente nennt; liefere diese Stelle als categoryEvidence. Leite Kategorien nie aus Zutaten oder einer Aussage zum Gesamtsortiment ab. " +
      "Uhrzeiten, Abschnittsueberschriften, Buffetnamen, Geschirr, Glaeser, Schilder, Mobiliar und andere Non-Food- oder Servicepositionen sind keine Menuekomponenten. Wenn daraus eine Produktionsklaerung folgt, erfasse sie als openQuestions-Eintrag. " +
      "Lasse keine kulinarische Position still weg und fuehre vor der Ausgabe einen Vollstaendigkeitsabgleich gegen jede relevante Quellzeile durch. " +
      "Antwortformat: JSON mit eventType, serviceForm, eventDate, attendeeCount, customerName, venueName, components inklusive categoryEvidence und openQuestions."
  },
  {
    promptArtifactId: "intake-shadow-extraction.prompt",
    promptVersion: "v0",
    promptSchemaId: "intake-shadow-extraction-prompt-schema.v0",
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    inputKind: "intake_shadow_request",
    status: "synthetic_live_ready",
    systemPrompt:
      "Du extrahierst aus einem freigegebenen synthetischen oder anonymisierten Catering-Anfragetext einen Vergleichsentwurf fuer den Intake-Schattenmodus. " +
      "Schreibe keine Produktobjekte, erfinde keine Fakten und gib nur JSON zurueck.",
    userPromptTemplate:
      "Extrahiere eventType, serviceForm, eventDate, attendeeCount und menuItems. " +
      "Nutze nur den gegebenen Text. Wenn ein Feld fehlt, gib null oder eine leere Liste zurueck. " +
      "Antwortformat: JSON mit eventType, serviceForm, eventDate, attendeeCount und menuItems."
  },
  {
    promptArtifactId: "offer-package-classification.prompt",
    promptVersion: "v0",
    promptSchemaId: "offer-package-classification-prompt-schema.v0",
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    inputKind: "offer_package_classification_request",
    status: "synthetic_live_ready",
    systemPrompt:
      "Du klassifizierst einen pseudonymisierten Catering-Angebotstext gegen eine feste Liste kuratierter Angebotspakete. " +
      "Nutze nur die angegebenen Paket-IDs, erfinde keine neuen Pakete, schreibe keine Produktobjekte und gib nur JSON zurueck.",
    userPromptTemplate:
      "Waehle die beste packageId aus der Paketliste oder null, wenn kein Paket passt. " +
      "institution_framework_catering braucht expliziten Rahmenvertrags- oder Serienbeleg; Kundentyp allein reicht nicht. " +
      "wedding_* Pakete brauchen explizite Hochzeitsbegriffe. " +
      "Nutze null, wenn die Textbelege fuer ein Paket nicht reichen. " +
      "Gib confidence zwischen 0 und 1, knappe rationale, bis zu drei signals und bis zu drei alternatives zurueck. " +
      "Antwortformat: JSON mit packageId, confidence, rationale, signals und alternatives."
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
