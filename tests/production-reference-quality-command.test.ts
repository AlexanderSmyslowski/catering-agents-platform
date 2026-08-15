import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runProductionReferenceQualityCommand,
  type ProductionReferenceCommandOptions
} from "../scripts/check-production-reference-case.js";
import type { LlmReadinessProviderAdapter } from "../shared-core/src/llm-readiness-provider-adapter.js";

const sourceText = "anonymized-koepff-flying-buffet-45p-source-v1\n";
const sourceHash = `sha256:${createHash("sha256").update(sourceText).digest("hex")}`;
const expectation = JSON.parse(readFileSync(
  path.join(process.cwd(), "tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json"),
  "utf8"
)) as Record<string, unknown>;

function adapter(): LlmReadinessProviderAdapter {
  return {
    adapterId: "injected-provider-test",
    adapterMode: "synthetic_live",
    async run(request) {
      return {
        ok: true,
        errors: [],
        adapterId: "injected-provider-test",
        adapterMode: "synthetic_live",
        promptSchemaId: request.promptSchemaId,
        providerId: "injected-provider",
        providerRequestId: "injected-request",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        outputCandidate: {
          contractVersion: "llm-readiness-v0",
          outputId: "injected-output",
          kind: "production_draft_extraction",
          sourceRefs: request.input.sourceRefs,
          humanApprovalRequired: true,
          writesProductObject: false,
          text: JSON.stringify({
            components: (expectation.requiredComponentLabels as string[]).map((label) => ({ label })),
            openQuestions: []
          })
        }
      };
    }
  };
}

function writeApproval(root: string): string {
  const approvalPath = path.join(root, "approval.json");
  writeFileSync(approvalPath, JSON.stringify({
    approvalId: "approval-production-reference-test",
    businessId: "local",
    providerKind: "codex_cli",
    allowedDataClasses: ["pseudonymized"],
    allowedPurposes: ["production_draft_extraction"],
    allowedModels: ["injected-model"],
    allowedCapabilities: ["structured_output"],
    allowedRegions: ["eu-test"],
    allowedEndpoints: ["codex-test"],
    maxCostEurPerCall: 0.1,
    retentionPolicy: "zero-retention",
    trainingUse: "contractually_excluded",
    legalBasisReference: "test",
    approvedBy: "test",
    approvedAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2099-12-31T00:00:00.000Z"
  }));
  chmodSync(approvalPath, 0o600);
  return approvalPath;
}

describe("production reference quality command", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("assesses an injected offline transport and writes a non-sensitive report", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-command-"));
    roots.push(root);
    const sourcePath = path.join(root, "source.txt");
    const expectationPath = path.join(root, "expectation.json");
    const reportPath = path.join(root, "report.json");
    writeFileSync(sourcePath, sourceText);
    writeFileSync(expectationPath, JSON.stringify({ ...expectation, sourceSha256: sourceHash }));

    const result = await runProductionReferenceQualityCommand({
      sourcePath,
      expectationPath,
      provider: "codex_cli",
      reportPath,
      env: {
        CATERING_LLM_PROCESSING_APPROVAL_FILE: writeApproval(root),
        CATERING_LLM_MODEL: "injected-model"
      },
      transport: adapter()
    });

    expect(result.ok).toBe(true);
    const report = readFileSync(reportPath, "utf8");
    expect(report).toContain(sourceHash);
    expect(report).toContain('"ok": true');
    expect(report).not.toContain(sourceText.trim());
  });

  it("rejects fixture or missing provider authorization before any transport call", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-command-"));
    roots.push(root);
    const sourcePath = path.join(root, "source.txt");
    const expectationPath = path.join(root, "expectation.json");
    const reportPath = path.join(root, "report.json");
    writeFileSync(sourcePath, sourceText);
    writeFileSync(expectationPath, JSON.stringify({ ...expectation, sourceSha256: sourceHash }));

    await expect(runProductionReferenceQualityCommand({
      sourcePath,
      expectationPath,
      provider: "fixture" as ProductionReferenceCommandOptions["provider"],
      reportPath,
      transport: adapter()
    })).rejects.toThrow(/openai|codex_cli|external processing approval/i);
  });

  it("rejects an in-repository report path and fixture-only injected transport", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-command-"));
    roots.push(root);
    const sourcePath = path.join(root, "source.txt");
    const expectationPath = path.join(root, "expectation.json");
    writeFileSync(sourcePath, sourceText);
    writeFileSync(expectationPath, JSON.stringify({ ...expectation, sourceSha256: sourceHash }));
    await expect(runProductionReferenceQualityCommand({
      sourcePath,
      expectationPath,
      provider: "codex_cli",
      reportPath: path.join(process.cwd(), "production-reference-report.json"),
      env: {
        CATERING_LLM_PROCESSING_APPROVAL_FILE: writeApproval(root),
        CATERING_LLM_MODEL: "injected-model"
      },
      transport: adapter()
    })).rejects.toThrow(/outside the repository/i);

    const fixtureOnly = { ...adapter(), adapterMode: "fixture_only" as const };
    await expect(runProductionReferenceQualityCommand({
      sourcePath,
      expectationPath,
      provider: "codex_cli",
      reportPath: path.join(root, "fixture-report.json"),
      env: {
        CATERING_LLM_PROCESSING_APPROVAL_FILE: writeApproval(root),
        CATERING_LLM_MODEL: "injected-model"
      },
      transport: fixtureOnly
    })).rejects.toThrow(/synthetic_live/i);
  });
});
