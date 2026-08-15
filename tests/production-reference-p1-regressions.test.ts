import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import pdf from "pdf-parse";
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

function adapter(capture: { promptContext?: string }): LlmReadinessProviderAdapter {
  return {
    adapterId: "injected-provider-test",
    adapterMode: "synthetic_live",
    async run(request) {
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

    vi.mocked(pdf).mockImplementation(async (received) => {
      expect(Buffer.from(received).subarray(0, 8).toString("latin1")).toBe("%PDF-1.7");
      return { text: "Kaffee und Kuchen · extrahierter Angebotstext" } as Awaited<ReturnType<typeof pdf>>;
    });

    const capture: { promptContext?: string } = {};
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
    expect(capture.promptContext).toBe("Kaffee und Kuchen · extrahierter Angebotstext");
    expect(capture.promptContext).not.toContain("%PDF-1.7");
    expect(readFileSync(reportPath, "utf8")).toContain(sourceHash);
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

    const unsupportedPath = path.join(root, "source.csv");
    writeFileSync(unsupportedPath, "not a supported document");
    await expect(runProductionReferenceQualityCommand({
      sourcePath: unsupportedPath,
      expectationPath,
      provider: "codex_cli",
      reportPath: path.join(root, "unsupported-report.json"),
      env,
      transport: adapter({})
    })).rejects.toThrow(/source file type is not supported/i);

    const oversizedPath = path.join(root, "oversized.pdf");
    writeFileSync(oversizedPath, Buffer.alloc(25 * 1024 * 1024 + 1, 0x41));
    await expect(runProductionReferenceQualityCommand({
      sourcePath: oversizedPath,
      expectationPath,
      provider: "codex_cli",
      reportPath: path.join(root, "oversized-report.json"),
      env,
      transport: adapter({})
    })).rejects.toThrow(/zu groß|maximal/i);

    const unreadablePath = path.join(root, "unreadable.pdf");
    writeFileSync(unreadablePath, "%PDF-1.7\nraw syntax\n%%EOF\n", "latin1");
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
