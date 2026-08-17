import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import pdf from "pdf-parse";
import * as documentText from "../shared-core/src/document-text.js";
import { runProductionReferenceQualityCommand } from "../scripts/check-production-reference-case.js";
import type { LlmReadinessProviderAdapter } from "../shared-core/src/llm-readiness-provider-adapter.js";

vi.mock("pdf-parse", () => ({
  default: vi.fn()
}));

const sourceText = "anonymized-koepff-flying-buffet-45p-source-v1\n";
const expectation = JSON.parse(readFileSync(
  path.join(process.cwd(), "tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json"),
  "utf8"
)) as Record<string, unknown>;

function writeApproval(root: string): string {
  const approvalPath = path.join(root, "approval.json");
  writeFileSync(approvalPath, JSON.stringify({
    approvalId: "approval-production-reference-p1-test",
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

function adapter(capture: { promptContext?: string; providerCalls?: number }): LlmReadinessProviderAdapter {
  return {
    adapterId: "injected-provider-test",
    adapterMode: "synthetic_live",
    async run(request) {
      capture.providerCalls = (capture.providerCalls ?? 0) + 1;
      capture.promptContext = request.promptContext;
      return {
        ok: true,
        errors: [],
        adapterId: "injected-provider-test",
        adapterMode: "synthetic_live",
        promptSchemaId: request.promptSchemaId,
        providerId: "injected-provider",
        providerRequestId: "injected-request",
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

function runDocumentedCli(args: string[]): { status: number | null; stderr: string } {
  try {
    execFileSync(process.execPath, ["--import", "tsx/esm", "scripts/check-production-reference-case.ts", ...args], {
      cwd: process.cwd(),
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "CATERING_LLM_PROCESSING_APPROVAL_FILE")),
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { status: 0, stderr: "" };
  } catch (error) {
    const result = error as { status?: number | null; stderr?: Buffer | string };
    return {
      status: result.status ?? null,
      stderr: result.stderr?.toString() ?? ""
    };
  }
}

describe("post-merge production reference P1 regressions", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.mocked(pdf).mockReset();
  });

  it("maps the documented CLI flags before provider authorization is checked", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-p1-cli-"));
    roots.push(root);
    const sourcePath = path.join(root, "source.txt");
    const expectationPath = path.join(root, "expectation.json");
    const reportPath = path.join(root, "report.json");
    writeFileSync(sourcePath, sourceText);
    writeFileSync(expectationPath, JSON.stringify(expectation));

    const result = runDocumentedCli([
      "--source", sourcePath,
      "--expectation", expectationPath,
      "--provider", "codex_cli",
      "--report", reportPath
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("processing_approval_rejected");
  });

  it("rejects unknown, duplicate, missing and valueless documented flags", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-p1-args-"));
    roots.push(root);
    const sourcePath = path.join(root, "source.txt");
    const expectationPath = path.join(root, "expectation.json");
    const reportPath = path.join(root, "report.json");
    writeFileSync(sourcePath, sourceText);
    writeFileSync(expectationPath, JSON.stringify(expectation));
    const valid = ["--source", sourcePath, "--expectation", expectationPath, "--provider", "codex_cli", "--report", reportPath];
    const invalidCalls = [
      ["--unknown", "value", ...valid],
      ["--source", sourcePath, ...valid],
      ["--source", sourcePath],
      ["--source", "--expectation", expectationPath, "--provider", "codex_cli", "--report", reportPath]
    ];

    for (const args of invalidCalls) {
      expect(runDocumentedCli(args).status).not.toBe(0);
    }
  });

  it("writes a source contract report without extracting or calling the provider when the hash mismatches", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-p1-hash-"));
    roots.push(root);
    const pdfBytes = Buffer.from("%PDF-1.7\nwrong source bytes\n%%EOF\n", "latin1");
    const sourcePath = path.join(root, "source.pdf");
    const expectationPath = path.join(root, "expectation.json");
    const reportPath = path.join(root, "report.json");
    writeFileSync(sourcePath, pdfBytes);
    writeFileSync(expectationPath, JSON.stringify({
      ...expectation,
      sourceSha256: `sha256:${"0".repeat(64)}`
    }));

    let extractionCalls = 0;
    vi.mocked(pdf).mockImplementation(async () => {
      extractionCalls += 1;
      throw new Error("PDF extraction must not run for a mismatched source");
    });
    const capture: { promptContext?: string; providerCalls?: number } = {};
    const result = await runProductionReferenceQualityCommand({
      sourcePath,
      expectationPath,
      provider: "codex_cli",
      reportPath,
      env: {
        CATERING_LLM_PROCESSING_APPROVAL_FILE: writeApproval(root),
        CATERING_LLM_MODEL: "injected-model"
      },
      transport: adapter(capture)
    });

    expect(result.ok).toBe(false);
    expect(result.reportPath).toBe(path.join(realpathSync(path.dirname(reportPath)), path.basename(reportPath)));
    expect(result.errorClasses).toEqual(["source_contract_failed"]);
    expect(extractionCalls).toBe(0);
    expect(capture.providerCalls).toBeUndefined();
    expect(JSON.parse(readFileSync(reportPath, "utf8"))).toMatchObject({
      ok: false,
      sourceSha256: `sha256:${createHash("sha256").update(pdfBytes).digest("hex")}`,
      promptSchemaId: "production-draft-extraction-prompt-schema.v0",
      promptArtifactId: "production-draft-extraction.prompt",
      promptVersion: "v0",
      errorClasses: ["source_contract_failed"]
    });
  });

  it("passes extracted PDF text to the provider while hashing the original bytes", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-p1-pdf-"));
    roots.push(root);
    const pdfBytes = Buffer.from("%PDF-1.7\n1 0 obj\n(binary source bytes)\n%%EOF\n", "latin1");
    const sourceHash = `sha256:${createHash("sha256").update(pdfBytes).digest("hex")}`;
    const sourcePath = path.join(root, "source.pdf");
    const expectationPath = path.join(root, "expectation.json");
    const reportPath = path.join(root, "report.json");
    writeFileSync(sourcePath, pdfBytes);
    writeFileSync(expectationPath, JSON.stringify({ ...expectation, sourceSha256: sourceHash }));

    let extractionCalls = 0;
    vi.spyOn(documentText, "extractTextFromDocument").mockImplementation(async (received) => {
      extractionCalls += 1;
      expect(received.content.subarray(0, 8).toString("latin1")).toBe("%PDF-1.7");
      return "Kaffee und Kuchen · extrahierter Angebotstext";
    });

    const capture: { promptContext?: string; providerCalls?: number } = {};
    const result = await runProductionReferenceQualityCommand({
      sourcePath,
      expectationPath,
      provider: "codex_cli",
      reportPath,
      env: {
        CATERING_LLM_PROCESSING_APPROVAL_FILE: writeApproval(root),
        CATERING_LLM_MODEL: "injected-model"
      },
      transport: adapter(capture)
    });

    expect(result.ok).toBe(true);
    expect(extractionCalls).toBe(1);
    expect(capture.providerCalls).toBe(1);
    expect(capture.promptContext).toBe("Kaffee und Kuchen · extrahierter Angebotstext");
    expect(capture.promptContext).not.toContain("%PDF-1.7");
    expect(JSON.parse(readFileSync(reportPath, "utf8"))).toMatchObject({
      sourceSha256: sourceHash,
      promptSchemaId: "production-draft-extraction-prompt-schema.v0",
      promptArtifactId: "production-draft-extraction.prompt",
      promptVersion: "v0"
    });
  });

  it("keeps unsupported, oversized and unreadable sources fail-closed", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-reference-p1-source-"));
    roots.push(root);
    const expectationPath = path.join(root, "expectation.json");
    writeFileSync(expectationPath, JSON.stringify(expectation));
    const env = {
      CATERING_LLM_PROCESSING_APPROVAL_FILE: writeApproval(root),
      CATERING_LLM_MODEL: "injected-model"
    };

    const writeExpectationFor = (content: Uint8Array) => writeFileSync(expectationPath, JSON.stringify({
      ...expectation,
      sourceSha256: `sha256:${createHash("sha256").update(content).digest("hex")}`
    }));

    const unsupportedPath = path.join(root, "source.csv");
    const unsupportedBytes = Buffer.from("not a supported document");
    writeFileSync(unsupportedPath, unsupportedBytes);
    writeExpectationFor(unsupportedBytes);
    await expect(runProductionReferenceQualityCommand({
      sourcePath: unsupportedPath,
      expectationPath,
      provider: "codex_cli",
      reportPath: path.join(root, "unsupported-report.json"),
      env,
      transport: adapter({})
    })).rejects.toThrow(/source file type is not supported/i);

    const oversizedPath = path.join(root, "oversized.pdf");
    const oversizedBytes = Buffer.alloc(25 * 1024 * 1024 + 1, 0x41);
    writeFileSync(oversizedPath, oversizedBytes);
    writeExpectationFor(oversizedBytes);
    await expect(runProductionReferenceQualityCommand({
      sourcePath: oversizedPath,
      expectationPath,
      provider: "codex_cli",
      reportPath: path.join(root, "oversized-report.json"),
      env,
      transport: adapter({})
    })).rejects.toThrow(/zu groß|maximal/i);

    const unreadablePath = path.join(root, "unreadable.pdf");
    const unreadableBytes = Buffer.from("%PDF-1.7\nraw syntax\n%%EOF\n", "latin1");
    writeFileSync(unreadablePath, unreadableBytes);
    writeExpectationFor(unreadableBytes);
    vi.mocked(pdf).mockResolvedValue({ text: "%PDF-1.7\nraw syntax" } as Awaited<ReturnType<typeof pdf>>);
    await expect(runProductionReferenceQualityCommand({
      sourcePath: unreadablePath,
      expectationPath,
      provider: "codex_cli",
      reportPath: path.join(root, "unreadable-report.json"),
      env,
      transport: adapter({})
    })).rejects.toThrow(/text extraction failed/i);
  });
});