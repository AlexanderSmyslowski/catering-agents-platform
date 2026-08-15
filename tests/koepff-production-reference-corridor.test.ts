import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assessProductionDraftReference } from "../shared-core/src/production-reference-quality.js";
import type { LlmReadinessModelOutputCandidate } from "../shared-core/src/llm-readiness.js";

const expectationPath = path.join(process.cwd(), "tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json");
const expectation = JSON.parse(readFileSync(expectationPath, "utf8")) as {
  caseId: string;
  sourceSha256: string;
  requiredComponentLabels: string[];
  allowedOpenQuestionFields: string[];
  forbiddenComponentLabels: string[];
};

describe("Koepff production reference corridor", () => {
  it("keeps the expectation anonymous and tied to a source hash", () => {
    const fixture = readFileSync(expectationPath, "utf8");
    expect(expectation.caseId).toBe("koepff-flying-buffet-45p");
    expect(expectation.sourceSha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(fixture).not.toMatch(/%PDF|customerName|venueName|rawText|providerResponse|prompt/i);
    expect(expectation.requiredComponentLabels).toEqual(expect.arrayContaining([
      expect.stringMatching(/Roastbeef/i),
      expect.stringMatching(/Drillinge/i),
      expect.stringMatching(/Kokos-Cheesecake/i)
    ]));
  });

  it("enforces the kitchen-facing component and source contracts", () => {
    const output: LlmReadinessModelOutputCandidate = {
      contractVersion: "llm-readiness-v0",
      outputId: "corridor-output",
      kind: "production_draft_extraction",
      sourceRefs: [{ objectType: "safe_source_anchor", objectId: expectation.sourceSha256 }],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: JSON.stringify({
        components: expectation.requiredComponentLabels.map((label) => ({ label })),
        openQuestions: expectation.allowedOpenQuestionFields.map((field) => ({ field, message: "Review required" }))
      })
    };

    expect(assessProductionDraftReference(expectation, output)).toMatchObject({ passed: true });
  });

  it("locks the reviewed thermal and garnish rules without provider text", () => {
    const roastbeef = JSON.parse(readFileSync(path.join(
      process.cwd(),
      "data-seeds/recipes-koepff/koepff-roastbeef-meersalzdrillinge-tomaten-rauke-salsa-gribiche.json"
    ), "utf8")) as { ingredients: Array<{ name: string; quantity: unknown }>; steps: Array<{ instruction: string }> };
    const coconut = JSON.parse(readFileSync(path.join(
      process.cwd(),
      "data-seeds/recipes-koepff/koepff-kokos-zitronen-panna-cotta-toertchen-brombeere.json"
    ), "utf8")) as { ingredients: Array<{ name: string; quantity: unknown }>; steps: Array<{ instruction: string }> };
    const roastbeefText = roastbeef.steps.map((step) => step.instruction).join(" ");
    const coconutText = coconut.steps.map((step) => step.instruction).join(" ");

    expect(roastbeefText).toContain("als ganzes Stück");
    expect(roastbeefText).toContain("Pfanne oder Kipper");
    expect(roastbeefText).toContain("UNOX XVC305E");
    expect(roastbeefText).toContain("54 °C Kerntemperatur");
    expect(roastbeefText).toContain("230 °C Heißluft");
    expect(roastbeefText).toContain("0 % STEAM.Maxi");
    expect(roastbeefText).toContain("30-35 Minuten");
    expect(coconut.ingredients.find((ingredient) => ingredient.name === "Brombeeren")?.quantity).toEqual({ amount: 90, unit: "Stück" });
    expect(coconutText).toContain("2 Brombeeren pro Törtchen");
    expect(coconutText).toContain("1 bis 3 Stück");
  });
});
