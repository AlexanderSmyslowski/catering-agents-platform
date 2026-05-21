import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adr = readFileSync("docs/architecture/PA22_CLARIFICATION_ANSWER_STORAGE_DISPLAY_GATE_ADR.md", "utf8");

describe("PA22 clarification answer storage display gate ADR", () => {
  it("anchors the post-PA21 state without adding runtime", () => {
    expect(adr).toContain("PA21 hat `ProductionClarificationAnswer` als reinen shared-core Modellanker eingefuehrt.");
    expect(adr).toContain("Aktiv erlaubt ist nur `answerType = shortText`.");
    expect(adr).toContain("Die Statusmenge ist exakt `draft | submitted | reviewed`.");
    expect(adr).toContain("Der kurze Antworttext ist auf maximal 500 Zeichen begrenzt.");
    expect(adr).toContain("keine Antwortannahme");
    expect(adr).toContain("keine Antwortspeicherung");
    expect(adr).toContain("keine neue API");
    expect(adr).toContain("keine UI-/Projection-Erweiterung");
  });

  it("defines the allowed future storage boundary inside existing persistence constraints", () => {
    expect(adr).toContain("bestehenden Domain- und Persistenzgrenzen");
    expect(adr).toContain("vorhandene `PersistentCollection`-Mechanik");
    expect(adr).toContain("keine direkte Vermischung mit `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList` oder `Recipe`");
    expect(adr).toContain("keine neue Datenbank-/Tabellen-/Prisma-Welt ohne separate ausdrueckliche Freigabe");
    expect(adr).toContain("`answerType = shortText`");
    expect(adr).toContain("`answerText.value` maximal 500 Zeichen nach Normalisierung");
  });

  it("recommends submitted as the first runtime storage status", () => {
    expect(adr).toContain("direkt als `submitted`");
    expect(adr).toContain("`draft` bleibt vorbereitet");
    expect(adr).toContain("`reviewed` bleibt vorbereitet");
    expect(adr).toContain("soll im ersten Runtime-Slice aber nicht automatisch gesetzt werden");
  });

  it("defines read-only display in existing production anchors without editing or spec correction", () => {
    expect(adr).toContain("bestehenden `/produktion`-`ProductionConversationProjection`");
    expect(adr).toContain("keine neue UI-Welt");
    expect(adr).toContain("keine Antwortbearbeitung im ersten Speicher-/Anzeige-Slice");
    expect(adr).toContain("keine automatische Ueberfuehrung in Spec-Korrekturpfade");
  });

  it("requires the later runtime slice to reject unsafe or invalid answers", () => {
    for (const requiredBoundary of [
      "HTML/Scripts escapen oder sanitizen",
      "Leere oder nur aus Whitespace bestehende Antworten ablehnen",
      "Antworten ueber 500 Zeichen nach Normalisierung ablehnen",
      "Unbekannte, ungueltige oder nicht mehr passende `questionId` ablehnen",
      "Falschen oder nicht aktivierten Antworttyp ablehnen",
      "Question-Key muss zur Frage passen",
      "Keine Rohtext-, PDF-Extrakt-, Prompt- oder vollstaendige Dokumentspiegelung",
      "Keine fachliche Interpretation aus Antworttext",
      "Keine Rezept-, Mengen-, Einkaufslisten-, Download-, Freigabe- oder Allergenlogik"
    ]) {
      expect(adr).toContain(requiredBoundary);
    }
  });

  it("keeps PA22 itself within stop boundaries and narrows PA23", () => {
    expect(adr).toContain("keine Antwortannahme in PA22");
    expect(adr).toContain("keine Antwortspeicherung in PA22");
    expect(adr).toContain("keine Antwortverarbeitung in PA22");
    expect(adr).toContain("keine neue API in PA22");
    expect(adr).toContain("keine Migration in PA22");
    expect(adr).toContain("Nach PA22 bleibt allgemeine Runtime weiter blockiert, aber ein PA23-Minimalslice ist vertretbar");
    expect(adr).toContain("eine kurze `shortText`-Antwort auf eine bestehende Frage validieren, als `submitted` im freigegebenen Modell");
  });
});
