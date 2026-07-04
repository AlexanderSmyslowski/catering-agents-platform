import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runOfferPackageBatchPilotCli } from "../scripts/run-offer-package-batch-pilot.js";
import {
  buildOfferPackageClassificationInput,
  buildOfferPackageClassificationPromptContext,
  buildOfferPackagePilotReport,
  loadCuratedOfferPackages,
  parseOfferPackageClassificationDraft,
  pseudonymizeOfferText,
  validateLlmReadinessModelInputCandidate
} from "@catering/shared-core";

function tempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-offer-package-pilot-"));
}

describe("offer package batch pilot", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pseudonymizes offer text before provider use and keeps package evidence", () => {
    const raw = [
      "Kunde: Ada Lovelace GmbH",
      "E-Mail: ada@example.test",
      "Telefon +49 6221 123456",
      "Adresse: Hauptstrasse 12, 69117 Heidelberg",
      "Business Lunch fuer 40 Personen als Buffet",
      "Preis 42 EUR p.P. netto",
      "Tomatensuppe | Roastbeef | Dessert"
    ].join("\n");

    const pseudonymized = pseudonymizeOfferText(raw);

    expect(pseudonymized.text).toContain("Business Lunch");
    expect(pseudonymized.text).toContain("40 Personen");
    expect(pseudonymized.text).toContain("42 EUR");
    expect(pseudonymized.text).not.toContain("Ada");
    expect(pseudonymized.text).not.toContain("example.test");
    expect(pseudonymized.text).not.toContain("Hauptstrasse");
    expect(pseudonymized.removedLineCount).toBeGreaterThanOrEqual(4);
  });

  it("accepts only pseudonymized-approved classification inputs and curated package ids", () => {
    const input = buildOfferPackageClassificationInput({
      sourceHash: "sha256:test-source",
      sourceId: "offer-01"
    });
    const packageIds = loadCuratedOfferPackages().map((item) => item.id);

    expect(validateLlmReadinessModelInputCandidate(input)).toEqual({ valid: true, errors: [] });
    expect(input.policy.dataMode).toBe("pseudonymized_approved");
    expect(parseOfferPackageClassificationDraft(JSON.stringify({
      packageId: "business_lunch_basic",
      confidence: 0.84,
      rationale: "Business-Lunch-Signale.",
      signals: ["Lunch", "40 Personen"],
      alternatives: []
    }), packageIds).errors).toEqual([]);
    expect(parseOfferPackageClassificationDraft(JSON.stringify({
      packageId: "invented_package",
      confidence: 0.84,
      rationale: "Nicht erlaubt.",
      signals: [],
      alternatives: []
    }), packageIds).errors).toContain("packageId must be null or one of the curated package ids");
  });

  it("states package boundary rules before provider classification", () => {
    const context = buildOfferPackageClassificationPromptContext({
      pseudonymizedText: "Catering | 50 Personen | Buffet",
      packages: loadCuratedOfferPackages()
    });

    expect(context).toContain("institution_framework_catering nur waehlen");
    expect(context).toContain("Kundentyp, Institutsname oder Hochschul-/Klinikbezug allein reichen nicht");
    expect(context).toContain("wedding_buffet_premium und wedding_reception_addon nur waehlen");
    expect(context).toContain("packageId null ist ein erwuenschtes Ergebnis");
  });

  it("builds a raw-text-free report with request counts, usage, disagreements and review lists", () => {
    const report = buildOfferPackagePilotReport({
      packageIds: ["business_lunch_basic", "brunch_buffet"],
      maxRequests: 60,
      maxEur: 3,
      predictions: [
        {
          sourceId: "offer-01",
          sourceHash: "sha256:source",
          pseudonymizedHash: "sha256:pseudo",
          model: "gpt-5.5",
          ok: true,
          packageId: "business_lunch_basic",
          confidence: 0.9,
          alternatives: ["brunch_buffet"],
          usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
          errors: []
        },
        {
          sourceId: "offer-01",
          sourceHash: "sha256:source",
          pseudonymizedHash: "sha256:pseudo",
          model: "gpt-5.4",
          ok: true,
          packageId: "brunch_buffet",
          confidence: 0.65,
          alternatives: ["business_lunch_basic"],
          usage: { inputTokens: 90, outputTokens: 18, totalTokens: 108 },
          errors: []
        },
        {
          sourceId: "offer-02",
          sourceHash: "sha256:source-2",
          pseudonymizedHash: "sha256:pseudo-2",
          model: "gpt-5.5",
          ok: true,
          packageId: null,
          confidence: 0.55,
          alternatives: ["business_lunch_basic"],
          usage: { inputTokens: 80, outputTokens: 16, totalTokens: 96 },
          errors: []
        }
      ]
    });
    const reportJson = JSON.stringify(report);

    expect(report.requestCount).toBe(3);
    expect(report.providerRequestCount).toBe(3);
    expect(report.failedBeforeProviderCount).toBe(0);
    expect(report.usage).toEqual({ inputTokens: 270, outputTokens: 54, totalTokens: 324 });
    expect(report.disagreements).toEqual([
      { sourceId: "offer-01", packageIds: ["brunch_buffet", "business_lunch_basic"] }
    ]);
    expect(report.reviewLists).toEqual({
      lowConfidence: [
        { sourceId: "offer-01", model: "gpt-5.4", packageId: "brunch_buffet", confidence: 0.65 },
        { sourceId: "offer-02", model: "gpt-5.5", packageId: null, confidence: 0.55 }
      ],
      nullClassifications: [
        { sourceId: "offer-02", model: "gpt-5.5", confidence: 0.55 }
      ]
    });
    expect(report.guardrails).toMatchObject({
      rawTextStored: false,
      rawPromptStored: false,
      rawResponseStored: false,
      fullBatchRunBlocked: true
    });
    expect(reportJson).not.toContain("Ada Lovelace");
    expect(reportJson).not.toContain("example.test");
  });

  it("runs the CLI dry-run without leaking filenames or source text and keeps the full batch blocked", async () => {
    const root = tempRoot();
    roots.push(root);
    const sourceDir = path.join(root, "offers");
    mkdirSync(sourceDir);
    writeFileSync(path.join(sourceDir, "Angebot_Ada_Lovelace.txt"), [
      "Kunde: Ada Lovelace GmbH",
      "ada@example.test",
      "Business Lunch fuer 40 Personen als Buffet",
      "Preis 42 EUR p.P. netto"
    ].join("\n"));
    writeFileSync(path.join(sourceDir, "Angebot_Grace_Hopper.txt"), [
      "Kunde: Grace Hopper GmbH",
      "Telefon +49 6221 999999",
      "Flying Buffet fuer 80 Personen",
      "Fingerfood und Empfang"
    ].join("\n"));
    const outputPath = path.join(root, "report.json");

    await expect(runOfferPackageBatchPilotCli([
      "--source-dir", sourceDir,
      "--dry-run",
      "--output", outputPath
    ], {})).resolves.toBe(0);
    const output = readFileSync(outputPath, "utf8");
    const report = JSON.parse(output) as {
      sourceCount: number;
      requestCount: number;
      providerRequestCount: number;
      failedBeforeProviderCount: number;
    };

    expect(report.sourceCount).toBe(2);
    expect(report.requestCount).toBe(4);
    expect(report.providerRequestCount).toBe(0);
    expect(report.failedBeforeProviderCount).toBe(4);
    expect(output).toContain("\"fullBatchRunBlocked\": true");
    expect(output).toContain("\"model\": \"gpt-5.5\"");
    expect(output).toContain("\"model\": \"gpt-5.4\"");
    expect(output).not.toContain("Ada");
    expect(output).not.toContain("Grace");
    expect(output).not.toContain("example.test");
    expect(output).not.toContain("Angebot_Ada_Lovelace");
  });

  it("refuses limits above the approved 20-offer pilot size", async () => {
    const root = tempRoot();
    roots.push(root);
    await expect(runOfferPackageBatchPilotCli([
      "--source-dir", root,
      "--limit", "21",
      "--dry-run"
    ], {})).rejects.toThrow("the 916-offer run is blocked");
  });
});
