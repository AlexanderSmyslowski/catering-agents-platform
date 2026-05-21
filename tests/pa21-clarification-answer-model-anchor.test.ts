import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allowedProductionClarificationAnswerTypes,
  productionClarificationAnswerModelBoundaries,
  productionClarificationAnswerStatuses,
  productionClarificationAnswerTextMaxLength,
  type ProductionClarificationAnswer
} from "@catering/shared-core";

const adr = readFileSync("docs/architecture/PA20_CLARIFICATION_ANSWER_DATA_MODEL_MIGRATION_ADR.md", "utf8");

const answerModelAnchor = {
  answerId: "answer-pa21-001",
  questionId: "spec-pa21-missingFields-attendees-expected",
  questionKey: {
    reason: "missingFields",
    reasonCode: "attendees.expected"
  },
  answerType: "shortText",
  status: "submitted",
  answerText: {
    kind: "shortText",
    value: "120 Personen, davon 8 vegan."
  },
  actor: {
    actorName: "Kuechenleitung"
  },
  createdAt: "2026-05-21T10:00:00.000Z",
  updatedAt: "2026-05-21T10:00:00.000Z"
} satisfies ProductionClarificationAnswer;

describe("PA21 clarification answer model anchor", () => {
  it("confirms Option B as target direction without adding runtime persistence or API", () => {
    expect(adr).toContain("Alexander hat nach PA20 entschieden: Option B wird als Zielrichtung bestaetigt.");
    expect(adr).toContain("Minimaler Reviewstatus: `draft / submitted / reviewed`.");
    expect(adr).toContain("Erster spaeterer Runtime-Slice: nur speichern/anzeigen, keine automatische Ueberfuehrung in Spec-Korrekturpfade.");
    expect(adr).toContain("keine Antwortannahme in PA21");
    expect(adr).toContain("keine Antwortspeicherung in PA21");
    expect(adr).toContain("keine neue API in PA21");
    expect(adr).toContain("keine Migration in PA21");
  });

  it("requires binding to questionId and stable question key", () => {
    expect(answerModelAnchor.questionId).toBe("spec-pa21-missingFields-attendees-expected");
    expect(answerModelAnchor.questionKey).toEqual({
      reason: "missingFields",
      reasonCode: "attendees.expected"
    });
    expect(Object.keys(answerModelAnchor.questionKey).sort()).toEqual(["reason", "reasonCode"]);
  });

  it("keeps shortText as the only active answer type and excludes selection or yes/no", () => {
    expect(allowedProductionClarificationAnswerTypes).toEqual(["shortText"]);
    expect(answerModelAnchor.answerType).toBe("shortText");
    expect(allowedProductionClarificationAnswerTypes).not.toContain("selectionOrConfirmation");
    expect(allowedProductionClarificationAnswerTypes).not.toContain("yesNo");
  });

  it("uses exactly draft submitted and reviewed as minimal review statuses", () => {
    expect(productionClarificationAnswerStatuses).toEqual(["draft", "submitted", "reviewed"]);
    expect(productionClarificationAnswerStatuses).not.toContain("rejected");
    expect(answerModelAnchor.status).toBe("submitted");
  });

  it("anchors text length and safety boundaries without raw text mirroring or automatic interpretation", () => {
    expect(productionClarificationAnswerTextMaxLength).toBe(500);
    expect(answerModelAnchor.answerText.kind).toBe("shortText");
    expect(answerModelAnchor.answerText.value.length).toBeLessThanOrEqual(productionClarificationAnswerTextMaxLength);
    expect(productionClarificationAnswerModelBoundaries).toContain("noRawDocumentTextMirroring");
    expect(productionClarificationAnswerModelBoundaries).toContain("noHtmlOrScriptMirroring");
    expect(productionClarificationAnswerModelBoundaries).toContain("noAutomaticDomainInterpretation");
    expect(productionClarificationAnswerModelBoundaries).toContain("noAutomaticSpecCorrectionTransfer");
    expect(JSON.stringify(answerModelAnchor)).not.toContain("<script");
    expect(JSON.stringify(answerModelAnchor)).not.toContain("%PDF");
    expect(JSON.stringify(answerModelAnchor)).not.toContain("extractedText");
  });

  it("does not add persistence api or runtime acceptance assumptions to the model anchor", () => {
    expect(Object.keys(answerModelAnchor).sort()).toEqual([
      "actor",
      "answerId",
      "answerText",
      "answerType",
      "createdAt",
      "questionId",
      "questionKey",
      "status",
      "updatedAt"
    ]);
    expect(JSON.stringify(answerModelAnchor)).not.toContain("collectionName");
    expect(JSON.stringify(answerModelAnchor)).not.toContain("endpoint");
    expect(JSON.stringify(answerModelAnchor)).not.toContain("persistedAt");
  });
});
