import { describe, expect, it } from "vitest";
import {
  buildProductionDossierDraftInput,
  llmReadinessContractVersion,
  validateProductionDossierDraftOutput,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate
} from "@catering/shared-core";

const spec = { specId: "spec-synthetic-dossier-output" };
const productionPlan = {
  planId: "plan-synthetic-dossier-output",
  eventSpecId: spec.specId
};
const purchaseList = {
  purchaseListId: "purchase-synthetic-dossier-output",
  eventSpecId: spec.specId
};

function expectedInput(): LlmReadinessModelInput {
  const result = buildProductionDossierDraftInput({
    spec,
    productionPlan,
    purchaseList,
    recipes: [{ recipeId: "recipe-vitello" }, { recipeId: "recipe-tarte" }],
    conversationProjection: { sessionId: "production-session-spec-synthetic-dossier-output" }
  });

  if (!result.input) {
    throw new Error(`failed to build test input: ${result.errors.join(", ")}`);
  }

  return result.input;
}

function validProductionDossierOutput(input: LlmReadinessModelInput): LlmReadinessModelOutputCandidate {
  return {
    contractVersion: llmReadinessContractVersion,
    outputId: "output-production-dossier-draft",
    kind: "production_dossier_draft",
    sourceRefs: input.sourceRefs,
    humanApprovalRequired: true,
    writesProductObject: false,
    text: [
      "Verständnis des Angebots",
      "Rückfragen",
      "Annahmen",
      "Kalkulationsübersicht",
      "Mengenkalkulation je Gericht",
      "Rezeptkarten",
      "Metro-Einkaufsliste",
      "Mise-en-Place",
      "Abschlussprüfung"
    ].join("\n"),
    structuredCandidate: {
      sectionCount: 9,
      summaryKind: "production_dossier",
      dataMode: "synthetic_or_demo_only",
      approval: "pending_human_review"
    }
  };
}

describe("production dossier draft output validation", () => {
  it("accepts a nine-section production dossier draft with matching source refs", () => {
    const input = expectedInput();
    const output = validProductionDossierOutput(input);

    expect(validateProductionDossierDraftOutput(output, input)).toEqual({
      valid: true,
      errors: []
    });
  });

  it("rejects source ref drift between the input artifacts and the output candidate", () => {
    const input = expectedInput();
    const output = {
      ...validProductionDossierOutput(input),
      sourceRefs: [
        ...input.sourceRefs.filter((sourceRef) => sourceRef.objectId !== "recipe-tarte"),
        {
          objectType: "safe_source_anchor",
          objectId: "unexpected-output-source"
        }
      ]
    } satisfies LlmReadinessModelOutputCandidate;

    const result = validateProductionDossierDraftOutput(output, input);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("sourceRefs missing expected artifacts: recipe_card:recipe-tarte");
    expect(result.errors).toContain(
      "sourceRefs contain unexpected artifacts: safe_source_anchor:unexpected-output-source"
    );
  });

  it("rejects wrong dossier kind metadata and missing section coverage", () => {
    const input = expectedInput();
    const output = {
      ...validProductionDossierOutput(input),
      kind: "operator_summary_draft",
      text: "Verständnis des Angebots\nRückfragen\nAnnahmen",
      structuredCandidate: {
        sectionCount: 8,
        summaryKind: "operator_context",
        dataMode: "live_data",
        approval: "auto_approved"
      }
    } satisfies LlmReadinessModelOutputCandidate;

    const result = validateProductionDossierDraftOutput(output, input);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("outputCandidate.kind must be production_dossier_draft");
    expect(result.errors).toContain("structuredCandidate.sectionCount must be 9");
    expect(result.errors).toContain("structuredCandidate.summaryKind must be production_dossier");
    expect(result.errors).toContain("structuredCandidate.approval must be pending_human_review");
    expect(result.errors).toContain("structuredCandidate.dataMode must be synthetic_or_demo_only");
    expect(result.errors).toContain(
      "text must mention production dossier sections: missing kalkulation, mengen, rezept, metro, mise-en-place, abschluss"
    );
  });

  it("keeps the generic readiness guard against raw provider payloads", () => {
    const input = expectedInput();
    const output = {
      ...validProductionDossierOutput(input),
      rawText: "raw source text",
      providerResponse: "{}"
    };

    const result = validateProductionDossierDraftOutput(output, input);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("outputCandidate.rawText is not allowed in readiness output candidates");
    expect(result.errors).toContain(
      "outputCandidate.providerResponse is not allowed in readiness output candidates"
    );
  });
});
