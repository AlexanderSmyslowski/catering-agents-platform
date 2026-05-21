import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adrPath = "docs/architecture/PA15_PRODUCTION_AGENT_NEXT_CAPABILITY_ADR.md";

describe("PA15 production agent next capability ADR", () => {
  it("compares the expected capability options and recommends clarification first", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("Option A: Rueckfragenmodell / Clarification Model");
    expect(doc).toContain("Option B: RecipeCandidate-Grenze");
    expect(doc).toContain("Option C: Read-only Download-/Output-Einordnung");
    expect(doc).toContain("Option D: Tool-/LLM-Gate vorbereiten");
    expect(doc).toContain("Primaere Empfehlung: Option A, Rueckfragenmodell / Clarification Model.");
    expect(doc).toContain("PA16 Clarification Model Slice 1");
  });

  it("keeps the next slice bounded to model/projection work without fake production logic", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("keine Runtime-Implementierung");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz, Migration oder Prisma");
    expect(doc).toContain("keine LLM-/Tool-Use-/Prompt-Implementierung");
    expect(doc).toContain("keine Rezeptkandidaten-Generierung");
    expect(doc).toContain("keine Allergenlogik DE/EN");
    expect(doc).toContain("keine Rohtexte, extrahierten Texte oder PDF-Inhalte in Rueckfragen-, Conversation- oder Exportankern gespiegelt werden");
  });
});
