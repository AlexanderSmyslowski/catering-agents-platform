import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adrPath = "docs/architecture/PA18_CLARIFICATION_ANSWER_PROCESSING_GATE_ADR.md";

describe("PA18 clarification answer processing gate ADR", () => {
  it("anchors the PA16/PA17 read-only state and forbids runtime answer processing", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("`ProductionClarificationQuestion` existiert im `shared-core` als typisierte, read-only Rueckfrage.");
    expect(doc).toContain("Es gibt noch keine Nutzerantwortannahme, keine Nutzerantwortspeicherung, keine Antwortverarbeitung und keine neue API dafuer.");
    expect(doc).toContain("keine Runtime-Antwortannahme");
    expect(doc).toContain("keine Nutzerantwortspeicherung");
    expect(doc).toContain("keine Nutzerantwortverarbeitung");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine neue Persistenz, Migration oder Prisma");
  });

  it("defines safe future answer concepts without recipe quantity or allergen decisions", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("Kurze Freitext-Klaerung");
    expect(doc).toContain("Auswahl oder Bestaetigung");
    expect(doc).toContain("Ja/Nein oder binaer");
    expect(doc).toContain("Datei-/Quellenhinweis");
    expect(doc).toContain("Rezeptauswahl oder Rezeptfreigabe");
    expect(doc).toContain("Mengen- oder Portionsentscheidung mit Produktionswirkung");
    expect(doc).toContain("Allergenbewertung oder Allergenfreigabe");
  });

  it("requires question binding sanitizing human review and explicit persistence decisions", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("Jede Antwort muss eindeutig mit `questionId` und einem stabilen Question-Key");
    expect(doc).toContain("Rohtexte, PDF-Extrakte und vollstaendige Dokumentinhalte bleiben tabu");
    expect(doc).toContain("Input-Laengen, Whitespace-/Unicode-Normalisierung, Sanitizing und XSS-Schutz");
    expect(doc).toContain("Menschliche Freigabe bleibt Pflichtgrenze vor produktionsrelevanter Nutzung.");
    expect(doc).toContain("keine neue Persistenzwelt ohne ausdrueckliche Entscheidung");
    expect(doc).toContain("Empfehlung: bewusst stoppen, bis Alexander die unten genannten Entscheidungen trifft.");
  });
});
