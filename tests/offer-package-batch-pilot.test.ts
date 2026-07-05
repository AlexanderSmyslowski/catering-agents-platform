import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/v1/responses`;
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
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
        },
        {
          sourceId: "offer-03",
          sourceHash: "sha256:source-3",
          pseudonymizedHash: "sha256:pseudo-3",
          model: "gpt-5.5",
          ok: false,
          errors: ["no_offer_evidence_retained"]
        },
        {
          sourceId: "offer-04",
          sourceHash: "sha256:source-4",
          pseudonymizedHash: "sha256:pseudo-4",
          model: "gpt-5.5",
          ok: true,
          packageId: "flying_buffet_premium",
          confidence: 0.78,
          alternatives: [],
          usage: { inputTokens: 70, outputTokens: 14, totalTokens: 84 },
          reviewFlags: ["flying_boilerplate_without_glass_evidence"],
          errors: []
        }
      ]
    });
    const reportJson = JSON.stringify(report);

    expect(report.requestCount).toBe(5);
    expect(report.providerRequestCount).toBe(4);
    expect(report.failedBeforeProviderCount).toBe(1);
    expect(report.usage).toEqual({ inputTokens: 340, outputTokens: 68, totalTokens: 408 });
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
      ],
      noOfferEvidence: [
        { sourceId: "offer-03", model: "gpt-5.5" }
      ],
      flyingBoilerplateReview: [
        {
          sourceId: "offer-04",
          model: "gpt-5.5",
          packageId: "flying_buffet_premium",
          confidence: 0.78,
          reason: "flying_boilerplate_without_glass_evidence"
        }
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

  it("refuses limits above the pilot size unless a full run is explicitly allowed", async () => {
    const root = tempRoot();
    roots.push(root);
    await expect(runOfferPackageBatchPilotCli([
      "--source-dir", root,
      "--limit", "21",
      "--dry-run"
    ], {})).rejects.toThrow("requires --allow-full-run");
  });

  it("allows an explicit full-run dry-run without raw source leakage", async () => {
    const root = tempRoot();
    roots.push(root);
    const sourceDir = path.join(root, "offers");
    mkdirSync(sourceDir);
    for (let index = 0; index < 21; index += 1) {
      writeFileSync(path.join(sourceDir, `Angebot_${index}_SecretCustomer.txt`), [
        "Kunde: SecretCustomer GmbH",
        "Business Lunch fuer 40 Personen als Buffet",
        "Preis 42 EUR p.P. netto"
      ].join("\n"));
    }
    const outputPath = path.join(root, "report.json");

    await expect(runOfferPackageBatchPilotCli([
      "--source-dir", sourceDir,
      "--limit", "21",
      "--models", "gpt-5.5",
      "--max-requests", "21",
      "--max-eur", "15",
      "--dry-run",
      "--allow-full-run",
      "--output", outputPath
    ], {})).resolves.toBe(0);
    const output = readFileSync(outputPath, "utf8");
    const report = JSON.parse(output) as {
      sourceCount: number;
      requestCount: number;
      guardrails: { fullBatchRunBlocked: boolean };
    };

    expect(report.sourceCount).toBe(21);
    expect(report.requestCount).toBe(21);
    expect(report.guardrails.fullBatchRunBlocked).toBe(false);
    expect(output).not.toContain("SecretCustomer");
    expect(output).not.toContain("Angebot_0_SecretCustomer");
  });

  it("can resume a batch by explicit source ids without leaking source filenames", async () => {
    const root = tempRoot();
    roots.push(root);
    const sourceDir = path.join(root, "offers");
    mkdirSync(sourceDir);
    for (let index = 0; index < 3; index += 1) {
      writeFileSync(path.join(sourceDir, `Angebot_${index}_PrivateName.txt`), [
        "Kunde: PrivateName GmbH",
        `Business Lunch fuer ${40 + index} Personen als Buffet`,
        "Preis 42 EUR p.P. netto"
      ].join("\n"));
    }
    const outputPath = path.join(root, "report.json");

    await expect(runOfferPackageBatchPilotCli([
      "--source-dir", sourceDir,
      "--limit", "3",
      "--models", "gpt-5.5",
      "--source-ids", "offer-02",
      "--max-requests", "1",
      "--dry-run",
      "--output", outputPath
    ], {})).resolves.toBe(0);
    const output = readFileSync(outputPath, "utf8");
    const report = JSON.parse(output) as {
      sourceCount: number;
      requestCount: number;
      predictions: Array<{ sourceId: string }>;
    };

    expect(report.sourceCount).toBe(1);
    expect(report.requestCount).toBe(1);
    expect(report.predictions.map((prediction) => prediction.sourceId)).toEqual(["offer-02"]);
    expect(output).not.toContain("PrivateName");
    expect(output).not.toContain("Angebot_1_PrivateName");
  });

  it("keeps a valid report when a provider request times out mid-batch", async () => {
    const root = tempRoot();
    roots.push(root);
    const sourceDir = path.join(root, "offers");
    mkdirSync(sourceDir);
    writeFileSync(path.join(sourceDir, "Angebot_First_PrivateName.txt"), [
      "Kunde: PrivateName GmbH",
      "Business Lunch fuer 40 Personen als Buffet",
      "Preis 42 EUR p.P. netto"
    ].join("\n"));
    writeFileSync(path.join(sourceDir, "Angebot_Second_PrivateName.txt"), [
      "Kunde: PrivateName GmbH",
      "Business Lunch fuer 41 Personen als Buffet",
      "Preis 42 EUR p.P. netto"
    ].join("\n"));
    const outputPath = path.join(root, "report.json");
    let requestCount = 0;
    const server = createServer((_request, response) => {
      requestCount += 1;
      if (requestCount === 1) {
        response.writeHead(200, {
          "content-type": "application/json",
          "x-request-id": "req-local-1"
        });
        response.end(JSON.stringify({
          id: "resp-local-1",
          output_text: JSON.stringify({
            packageId: "business_lunch_basic",
            confidence: 0.91,
            rationale: "Business-Lunch-Signale.",
            signals: ["Business Lunch", "40 Personen"],
            alternatives: []
          }),
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15
          }
        }));
        return;
      }
      // Leave the second response open so the OpenAI transport timeout becomes
      // a normal prediction error instead of hanging the whole batch.
      _request.on("close", () => response.destroy());
    });
    const endpoint = await listen(server);

    try {
      await expect(runOfferPackageBatchPilotCli([
        "--source-dir", sourceDir,
        "--limit", "2",
        "--models", "gpt-5.5",
        "--max-requests", "2",
        "--output", outputPath
      ], {
        CATERING_LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-test",
        CATERING_LLM_BASE_URL: endpoint,
        CATERING_OPENAI_TIMEOUT_MS: "25"
      })).resolves.toBe(0);
    } finally {
      await close(server);
    }

    const output = readFileSync(outputPath, "utf8");
    const report = JSON.parse(output) as {
      requestCount: number;
      providerRequestCount: number;
      predictions: Array<{ ok: boolean; errors: string[] }>;
    };

    expect(report.requestCount).toBe(2);
    expect(report.providerRequestCount).toBe(2);
    expect(report.predictions).toHaveLength(2);
    expect(report.predictions[1]?.errors).toContain("OpenAI responses request timed out after 25ms");
    expect(output).not.toContain("PrivateName");
    expect(output).not.toContain("Angebot_First_PrivateName");
    expect(output).not.toContain("Angebot_Second_PrivateName");
  });
});
