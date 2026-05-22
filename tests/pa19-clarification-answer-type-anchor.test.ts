import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allowedProductionClarificationAnswerTypes,
  futureProductionClarificationAnswerTypeConcepts,
  type ProductionClarificationAnswerDraft
} from "@catering/shared-core";

const adr = readFileSync("docs/architecture/PA18_CLARIFICATION_ANSWER_PROCESSING_GATE_ADR.md", "utf8");

const answerDraft: ProductionClarificationAnswerDraft = {
  context: {
    specId: "spec-pa19",
    productionSessionId: "production-session-spec-pa19"
  },
  questionId: "spec-pa19-missingFields-attendees-expected",
  questionKey: {
    reason: "missingFields",
    reasonCode: "attendees.expected"
  },
  answerType: "shortText"
};

describe("PA19 clarification answer type anchor", () => {
  it("allows only shortText as first runtime answer type", () => {
    expect(allowedProductionClarificationAnswerTypes).toEqual(["shortText"]);
    expect(allowedProductionClarificationAnswerTypes).not.toContain("selectionOrConfirmation");
    expect(allowedProductionClarificationAnswerTypes).not.toContain("yesNo");
  });

  it("keeps later answer concepts outside the active first runtime type list", () => {
    expect(futureProductionClarificationAnswerTypeConcepts).toEqual([
      "selectionOrConfirmation",
      "yesNo",
      "sourceReference"
    ]);
    for (const futureType of futureProductionClarificationAnswerTypeConcepts) {
      expect(allowedProductionClarificationAnswerTypes).not.toContain(futureType);
    }
  });

  it("requires stable question binding without carrying answer content or runtime assumptions", () => {
    expect(answerDraft).toEqual({
      context: {
        specId: "spec-pa19",
        productionSessionId: "production-session-spec-pa19"
      },
      questionId: "spec-pa19-missingFields-attendees-expected",
      questionKey: {
        reason: "missingFields",
        reasonCode: "attendees.expected"
      },
      answerType: "shortText"
    });
    expect(Object.keys(answerDraft).sort()).toEqual(["answerType", "context", "questionId", "questionKey"]);
    expect(JSON.stringify(answerDraft)).not.toContain("Rohtext");
    expect(JSON.stringify(answerDraft)).not.toContain("%PDF");
  });

  it("documents Alexanders PA18 decisions and PA19 non-runtime boundaries", () => {
    expect(adr).toContain("Alexander hat nach PA18 entschieden: weiterarbeiten ja, aber nur als Typanker.");
    expect(adr).toContain("Antwortspeicherung bleibt blockiert, bis ein bewusster Datenmodell-/Migrationsschnitt entschieden ist.");
    expect(adr).toContain("Der erste echte Runtime-Antworttyp bleibt auf kurze Freitext-Klaerung `shortText` begrenzt.");
    expect(adr).toContain("Auswahl/Bestaetigung, Ja/Nein und Datei-/Quellenhinweise bleiben spaetere, nicht aktivierte Konzeptgrenzen.");
    expect(adr).toContain("PA19 erzeugt keine Antwortannahme, keine Antwortspeicherung, keine Antwortverarbeitung, keine API und keine Runtime-Annahme.");
  });
});
