import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adr = readFileSync("docs/architecture/PA20_CLARIFICATION_ANSWER_DATA_MODEL_MIGRATION_ADR.md", "utf8");

describe("PA20 clarification answer data model migration ADR", () => {
  it("anchors the post-PA19 non-runtime state", () => {
    expect(adr).toContain("PA19 hat bewusst nur einen shared-core Typ-/Testanker geschaffen");
    expect(adr).toContain("`allowedProductionClarificationAnswerTypes` enthaelt aktiv ausschliesslich `shortText`");
    expect(adr).toContain("Der Draft traegt keinen Antwortinhalt.");
    expect(adr).toContain("Es gibt keine Antwortannahme, keine Speicherung, keine Verarbeitung, keine API, keine UI-Runtime und keine neue Persistenz.");
  });

  it("documents the required future answer data without implementing storage", () => {
    expect(adr).toContain("`questionId`");
    expect(adr).toContain("stabiler Question-Key mit `reason` und `reasonCode`");
    expect(adr).toContain("`answerType = shortText`");
    expect(adr).toContain("harte Laengenbegrenzung");
    expect(adr).toContain("`createdAt`");
    expect(adr).not.toContain("CREATE TABLE production_clarification_answers");
  });

  it("compares options A through D across the required decision criteria", () => {
    for (const option of ["Option A", "Option B", "Option C", "Option D"]) {
      expect(adr).toContain(option);
    }
    for (const criterion of [
      "MVP-Fit",
      "Audit/Review-Faehigkeit",
      "Implementierungsrisiko",
      "Security/XSS/Input-Sanitizing",
      "Migrations-/Persistenzrisiko",
      "Testbarkeit",
      "Alignment mit Single-Tenant zuerst"
    ]) {
      expect(adr).toContain(criterion);
    }
  });

  it("recommends option B without allowing PA20 runtime or persistence work", () => {
    expect(adr).toContain("Empfohlen wird Option B als naechstes Gate");
    expect(adr).toContain("ein kleines, explizites `ProductionClarificationAnswer`-Datenmodell innerhalb der bestehenden Domain- und Persistenzgrenzen");
    expect(adr).toContain("keine Antwortannahme in PA20");
    expect(adr).toContain("keine Antwortspeicherung in PA20");
    expect(adr).toContain("keine Antwortverarbeitung in PA20");
    expect(adr).toContain("keine neue API in PA20");
    expect(adr).toContain("keine Migration in PA20");
    expect(adr).toContain("keine neue Persistenzwelt und kein Prisma");
  });
});
