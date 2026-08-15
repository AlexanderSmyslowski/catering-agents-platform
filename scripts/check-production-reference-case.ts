import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildBoundaryGuardedLlmAdapterFromEnv,
  loadByoLlmExternalProcessingApprovalFromEnv,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterResponse,
  type ProductionDraftReferenceAssessment,
  type ProductionDraftReferenceExpectation
} from "../shared-core/src/index.js";
import { findLlmReadinessPromptSchemaEntryByInputKind } from "../shared-core/src/llm-readiness-prompt-schema-registry.js";
import { assessProductionDraftReference } from "../shared-core/src/production-reference-quality.js";
import { llmReadinessContractVersion } from "../shared-core/src/llm-readiness.js";

export type ProductionReferenceProvider = "openai" | "codex_cli";

export interface ProductionReferenceCommandOptions {
  sourcePath: string;
  expectationPath: string;
  provider: ProductionReferenceProvider;
  reportPath: string;
  env?: Record<string, string | undefined>;
  /** Only tests may inject an offline transport; the CLI never supplies it. */
  transport?: LlmReadinessProviderAdapter;
}

export interface ProductionReferenceCommandResult {
  ok: boolean;
  reportPath: string;
  assessment?: ProductionDraftReferenceAssessment;
  errorClasses: string[];
}

interface ProductionReferenceReport {
  reportVersion: "production-reference-report-v0";
  ok: boolean;
  sourceSha256?: string;
  provider: ProductionReferenceProvider;
  providerModel?: string;
  transportMode: "configured" | "injected";
  promptSchemaId?: string;
  promptArtifactId?: string;
  promptVersion?: string;
  componentCount: number;
  openQuestionCount: number;
  missingComponentLabels: string[];
  duplicateComponentLabels: string[];
  forbiddenComponentLabels: string[];
  errorClasses: string[];
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

const providerValues = new Set<ProductionReferenceProvider>(["openai", "codex_cli"]);
const repositoryRoot = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function safeErrorClass(value: string): string {
  if (/approval/i.test(value)) return "processing_approval_rejected";
  if (/provider|transport|codex|openai/i.test(value)) return "provider_transport_failed";
  if (/source/i.test(value)) return "source_contract_failed";
  if (/expectation/i.test(value)) return "expectation_contract_failed";
  if (/output|candidate|component|question|reference/i.test(value)) return "reference_output_failed";
  return "quality_contract_failed";
}

function assertSafeRegularFile(filePath: string, label: string): string {
  const absolute = path.resolve(filePath);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  return realpathSync(absolute);
}

function assertReportPath(reportPath: string): string {
  if (!path.isAbsolute(reportPath)) {
    throw new Error("report path must be absolute and outside the repository");
  }
  const absolute = path.resolve(reportPath);
  const parent = realpathSync(path.dirname(absolute));
  if (parent === repositoryRoot || parent.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error("report path must be absolute and outside the repository");
  }
  try {
    if (lstatSync(absolute).isSymbolicLink()) {
      throw new Error("report path must not be a symbolic link");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "report path must not be a symbolic link") throw error;
    // A new report file is valid; its canonical parent was checked above.
  }
  return path.join(parent, path.basename(absolute));
}

function parseExpectation(filePath: string): ProductionDraftReferenceExpectation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error("expectation file must contain valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("expectation must be a JSON object");
  const expectation = parsed as Partial<ProductionDraftReferenceExpectation>;
  if (
    typeof expectation.caseId !== "string" ||
    typeof expectation.sourceSha256 !== "string" ||
    !Array.isArray(expectation.requiredComponentLabels) ||
    !Array.isArray(expectation.allowedOpenQuestionFields) ||
    !Array.isArray(expectation.forbiddenComponentLabels)
  ) {
    throw new Error("expectation fields are incomplete");
  }
  return expectation as ProductionDraftReferenceExpectation;
}

function parseArgs(argv: readonly string[]): ProductionReferenceCommandOptions {
  const values: Partial<Record<"sourcePath" | "expectationPath" | "provider" | "reportPath", string>> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!["--source", "--expectation", "--provider", "--report"].includes(arg)) {
      throw new Error("unknown or malformed command argument");
    }
    const key = arg.slice(2) as keyof typeof values;
    if (values[key] !== undefined) throw new Error("duplicate command argument");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("command arguments require a value");
    values[key] = value;
    index += 1;
  }
  if (!values.sourcePath || !values.expectationPath || !values.provider || !values.reportPath) {
    throw new Error("--source, --expectation, --provider and --report are required");
  }
  if (!providerValues.has(values.provider as ProductionReferenceProvider)) {
    throw new Error("provider must be openai or codex_cli; fixture and mixed providers are not allowed");
  }
  return {
    sourcePath: values.sourcePath,
    expectationPath: values.expectationPath,
    provider: values.provider as ProductionReferenceProvider,
    reportPath: values.reportPath
  };
}

function buildInput(sourceHash: string, caseId: string) {
  return {
    contractVersion: llmReadinessContractVersion,
    inputId: `production-reference-${caseId}-${sourceHash.slice(-16)}`,
    kind: "production_draft_request" as const,
    sourceRefs: [{ objectType: "safe_source_anchor" as const, objectId: sourceHash }],
    policy: {
      providerCalls: "disabled" as const,
      dataMode: "pseudonymized_approved" as const,
      allowedToolEffects: ["read", "draft"] as const
    }
  };
}

function reportFor(
  options: ProductionReferenceCommandOptions,
  expectation: ProductionDraftReferenceExpectation,
  input: Partial<ProductionReferenceReport>
): ProductionReferenceReport {
  return {
    reportVersion: "production-reference-report-v0",
    ok: false,
    sourceSha256: input.sourceSha256,
    provider: options.provider,
    providerModel: (options.env ?? process.env).CATERING_LLM_MODEL,
    transportMode: options.transport ? "injected" : "configured",
    promptSchemaId: input.promptSchemaId,
    promptArtifactId: input.promptArtifactId,
    promptVersion: input.promptVersion,
    componentCount: input.componentCount ?? 0,
    openQuestionCount: input.openQuestionCount ?? 0,
    missingComponentLabels: input.missingComponentLabels ?? [],
    duplicateComponentLabels: input.duplicateComponentLabels ?? [],
    forbiddenComponentLabels: input.forbiddenComponentLabels ?? [],
    errorClasses: input.errorClasses ?? [],
    usage: input.usage,
    ...input
  };
}

function writeReport(reportPath: string, report: ProductionReferenceReport): void {
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function assessmentCounts(output: LlmReadinessProviderAdapterResponse): { componentCount: number; openQuestionCount: number } {
  try {
    const parsed = JSON.parse(output.outputCandidate?.text ?? "") as { components?: unknown[]; openQuestions?: unknown[] };
    return {
      componentCount: Array.isArray(parsed.components) ? parsed.components.length : 0,
      openQuestionCount: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.length : 0
    };
  } catch {
    return { componentCount: 0, openQuestionCount: 0 };
  }
}

export async function runProductionReferenceQualityCommand(
  options: ProductionReferenceCommandOptions
): Promise<ProductionReferenceCommandResult> {
  if (!providerValues.has(options.provider)) throw new Error("provider must be openai or codex_cli; fixture and mixed providers are not allowed");
  if (options.transport && options.transport.adapterMode !== "synthetic_live") {
    throw new Error("injected transport must use the synthetic_live adapter mode");
  }
  const env = options.env ?? process.env;
  if (env.CATERING_LLM_PROVIDER !== undefined && env.CATERING_LLM_PROVIDER !== options.provider) {
    throw new Error("configured provider does not match the requested provider");
  }
  if (!env.CATERING_LLM_PROCESSING_APPROVAL_FILE) throw new Error("external processing approval is required");
  // Validate the authorization file before reading source material or invoking any transport.
  loadByoLlmExternalProcessingApprovalFromEnv({ ...env, CATERING_LLM_PROVIDER: options.provider }, repositoryRoot);

  const sourcePath = assertSafeRegularFile(options.sourcePath, "source");
  const expectationPath = assertSafeRegularFile(options.expectationPath, "expectation");
  const reportPath = assertReportPath(options.reportPath);
  const expectation = parseExpectation(expectationPath);
  const sourceBytes = readFileSync(sourcePath);
  const sourceHash = sha256(sourceBytes);
  const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("production_draft_request");
  if (!promptSchema) throw new Error("production draft prompt schema is unavailable");

  const baseReport = reportFor(options, expectation, {
    sourceSha256: sourceHash,
    promptSchemaId: promptSchema.promptSchemaId,
    promptArtifactId: promptSchema.promptArtifactId,
    promptVersion: promptSchema.promptVersion
  });
  if (sourceHash !== expectation.sourceSha256) {
    const report = { ...baseReport, errorClasses: ["source_contract_failed"] };
    writeReport(reportPath, report);
    return { ok: false, reportPath, errorClasses: report.errorClasses };
  }

  const input = buildInput(sourceHash, expectation.caseId);
  const response = options.transport
    ? await options.transport.run({
        input,
        promptSchemaId: promptSchema.promptSchemaId,
        promptContext: sourceBytes.toString("utf8")
      })
    : await buildBoundaryGuardedLlmAdapterFromEnv(
        { ...env, CATERING_LLM_PROVIDER: options.provider },
        {}
      ).execute(
          {
            input,
            promptSchemaId: promptSchema.promptSchemaId,
            promptContext: sourceBytes.toString("utf8")
          },
          {
            businessId: env.CATERING_LLM_BUSINESS_ID ?? "local",
            dataClass: "pseudonymized",
            purpose: "production_draft_extraction"
          }
        );
  const counts = assessmentCounts(response);
  const assessment = response.outputCandidate
    ? assessProductionDraftReference(expectation, response.outputCandidate)
    : undefined;
  const errorClasses = [
    ...response.errors.map(safeErrorClass),
    ...(assessment && !assessment.passed ? assessment.errors.map(safeErrorClass) : [])
  ];
  const report: ProductionReferenceReport = {
    ...baseReport,
    ok: response.ok && Boolean(assessment?.passed),
    componentCount: counts.componentCount,
    openQuestionCount: counts.openQuestionCount,
    missingComponentLabels: assessment?.missingComponentLabels ?? [],
    duplicateComponentLabels: assessment?.duplicateComponentLabels ?? [],
    forbiddenComponentLabels: assessment?.forbiddenComponentLabels ?? [],
    errorClasses: [...new Set(errorClasses)],
    usage: response.usage
  };
  writeReport(reportPath, report);
  return {
    ok: report.ok,
    reportPath,
    assessment,
    errorClasses: report.errorClasses
  };
}

export async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runProductionReferenceQualityCommand(options);
    process.stdout.write(`${JSON.stringify({ ok: result.ok, reportPath: result.reportPath, errorClasses: result.errorClasses })}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? safeErrorClass(error.message) : "quality_contract_failed"}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
