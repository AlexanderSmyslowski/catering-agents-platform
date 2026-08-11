import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildBoundaryGuardedLlmAdapterFromEnv,
  buildOfferPackageClassificationInput,
  buildOfferPackageClassificationPromptContext,
  buildOfferPackagePilotReport,
  findLlmReadinessPromptSchemaEntryByInputKind,
  loadCuratedOfferPackages,
  parseOfferPackageClassificationDraft,
  pseudonymizeOfferText,
  type BoundaryGuardedLlmAdapter,
  type LlmReadinessProviderAdapterResponse,
  type OfferPackageClassificationPrediction
} from "@catering/shared-core";

interface CliOptions {
  sourceDir?: string;
  limit: number;
  models: string[];
  sourceIds?: string[];
  maxRequests: number;
  maxEur?: number;
  inputEurPer1M?: number;
  outputEurPer1M?: number;
  dryRun: boolean;
  allowFullRun: boolean;
  outputPath?: string;
}

interface SourceText {
  sourceId: string;
  text: string;
}

function parseArgs(argv: string[], env: Record<string, string | undefined>): CliOptions {
  const options: CliOptions = {
    sourceDir: env.CATERING_OFFER_BATCH_SOURCE_DIR,
    limit: 20,
    models: ["gpt-5.5", "gpt-5.4"],
    maxRequests: Number(env.CATERING_OFFER_BATCH_MAX_REQUESTS ?? 60),
    maxEur: env.CATERING_OFFER_BATCH_MAX_EUR ? Number(env.CATERING_OFFER_BATCH_MAX_EUR) : 3,
    inputEurPer1M: parseOptionalPositiveNumber(env.CATERING_OFFER_BATCH_INPUT_EUR_PER_1M_TOKENS),
    outputEurPer1M: parseOptionalPositiveNumber(env.CATERING_OFFER_BATCH_OUTPUT_EUR_PER_1M_TOKENS),
    dryRun: false,
    allowFullRun: env.CATERING_OFFER_BATCH_ALLOW_FULL_RUN === "1"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--source-dir") {
      options.sourceDir = next;
      index += 1;
    } else if (arg === "--limit") {
      options.limit = Number(next);
      index += 1;
    } else if (arg === "--models") {
      options.models = next.split(",").map((item) => item.trim()).filter(Boolean);
      index += 1;
    } else if (arg === "--source-ids") {
      options.sourceIds = parseSourceIds(next);
      index += 1;
    } else if (arg === "--source-id-file") {
      options.sourceIds = parseSourceIds(readFileSync(next, "utf8"));
      index += 1;
    } else if (arg === "--max-requests") {
      options.maxRequests = Number(next);
      index += 1;
    } else if (arg === "--max-eur") {
      options.maxEur = Number(next);
      index += 1;
    } else if (arg === "--input-eur-per-1m-tokens") {
      options.inputEurPer1M = Number(next);
      index += 1;
    } else if (arg === "--output-eur-per-1m-tokens") {
      options.outputEurPer1M = Number(next);
      index += 1;
    } else if (arg === "--output") {
      options.outputPath = next;
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--allow-full-run") {
      options.allowFullRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.sourceDir) {
    throw new Error("Missing --source-dir or CATERING_OFFER_BATCH_SOURCE_DIR.");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("--limit must be a positive integer.");
  }
  if (options.limit > 20 && !options.allowFullRun) {
    throw new Error("--limit above 20 requires --allow-full-run after human approval; the 916-offer run remains blocked by default.");
  }
  if (options.models.length === 0) {
    throw new Error("--models must contain at least one model.");
  }
  if (!Number.isInteger(options.maxRequests) || options.maxRequests < 1) {
    throw new Error("--max-requests must be a positive integer.");
  }
  if (options.maxEur !== undefined && (!Number.isFinite(options.maxEur) || options.maxEur <= 0)) {
    throw new Error("--max-eur must be a positive number when provided.");
  }
  if (options.inputEurPer1M !== undefined && (!Number.isFinite(options.inputEurPer1M) || options.inputEurPer1M < 0)) {
    throw new Error("--input-eur-per-1m-tokens must be a non-negative number when provided.");
  }
  if (options.outputEurPer1M !== undefined && (!Number.isFinite(options.outputEurPer1M) || options.outputEurPer1M < 0)) {
    throw new Error("--output-eur-per-1m-tokens must be a non-negative number when provided.");
  }
  if (
    !options.dryRun &&
    options.maxEur !== undefined &&
    (options.inputEurPer1M === undefined || options.outputEurPer1M === undefined)
  ) {
    throw new Error("--max-eur requires --input-eur-per-1m-tokens and --output-eur-per-1m-tokens (or CATERING_OFFER_BATCH_*_EUR_PER_1M_TOKENS env) for non-dry-run batches.");
  }

  return options;
}

function parseOptionalPositiveNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  return Number(value);
}

function parseSourceIds(value: string): string[] {
  return [...new Set(value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean))];
}

function collectTextFiles(rootDir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(rootDir).sort()) {
    const fullPath = path.join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectTextFiles(fullPath));
    } else if (stats.isFile() && fullPath.toLowerCase().endsWith(".txt")) {
      files.push(fullPath);
    }
  }
  return files;
}

function readSources(sourceDir: string, limit: number, sourceIds?: readonly string[]): SourceText[] {
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const sources = collectTextFiles(sourceDir).slice(0, limit).map((filePath, index) => ({
    sourceId: `offer-${String(index + 1).padStart(2, "0")}`,
    text: readFileSync(filePath, "utf8")
  }));

  if (!sourceIds || sourceIds.length === 0) {
    return sources;
  }

  const requested = new Set(sourceIds);
  const filtered = sources.filter((source) => requested.has(source.sourceId));
  const found = new Set(filtered.map((source) => source.sourceId));
  const missing = sourceIds.filter((sourceId) => !found.has(sourceId));
  if (missing.length > 0) {
    throw new Error(`Requested sourceIds not found within --limit: ${missing.join(", ")}`);
  }

  return filtered;
}

function adapterForModel(model: string, env: Record<string, string | undefined>): BoundaryGuardedLlmAdapter {
  const providerEnv = {
    ...env,
    CATERING_LLM_PROVIDER: env.CATERING_LLM_PROVIDER ?? "openai",
    CATERING_LLM_MODEL: model,
    CATERING_SYNTHETIC_LLM_SLICE: "1"
  };
  return buildBoundaryGuardedLlmAdapterFromEnv(providerEnv, {
    providerRunIdPrefix: "offer-package-batch-pilot"
  });
}

function buildLocalReviewFlags(input: {
  packageId: string | null;
  pseudonymizedText: string;
}): string[] {
  const flags: string[] = [];
  const hasFlyingBoilerplate = /flying food buffets zeichnen/i.test(input.pseudonymizedText);
  const hasGlassEvidence = /\b(?:glaeschen|gläschen|glaeser|gläser|glaesersystem|gläsersystem|im glas|in glaesern|in gläsern)\b/i
    .test(input.pseudonymizedText);

  if (input.packageId === "flying_buffet_premium" && hasFlyingBoilerplate && !hasGlassEvidence) {
    flags.push("flying_boilerplate_without_glass_evidence");
  }

  return flags;
}

function writeReportCheckpoint(input: {
  outputPath?: string;
  packageIds: readonly string[];
  maxRequests: number;
  maxEur?: number;
  predictions: readonly OfferPackageClassificationPrediction[];
  fullBatchRunAllowed: boolean;
}): void {
  if (!input.outputPath) {
    return;
  }

  const report = buildOfferPackagePilotReport({
    packageIds: input.packageIds,
    maxRequests: input.maxRequests,
    maxEur: input.maxEur,
    predictions: input.predictions,
    fullBatchRunAllowed: input.fullBatchRunAllowed
  });
  const tmpPath = `${input.outputPath}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  renameSync(tmpPath, input.outputPath);
}

function estimateSpendEur(
  predictions: readonly OfferPackageClassificationPrediction[],
  options: Pick<CliOptions, "inputEurPer1M" | "outputEurPer1M">
): number {
  const inputRate = options.inputEurPer1M ?? 0;
  const outputRate = options.outputEurPer1M ?? 0;
  return predictions.reduce((total, prediction) =>
    total +
    ((prediction.usage?.inputTokens ?? 0) * inputRate / 1_000_000) +
    ((prediction.usage?.outputTokens ?? 0) * outputRate / 1_000_000)
  , 0);
}

function hasProviderPredictionWithoutUsage(predictions: readonly OfferPackageClassificationPrediction[]): boolean {
  return predictions.some((prediction) =>
    (prediction.providerId !== undefined || prediction.providerRequestId !== undefined) &&
    prediction.usage === undefined
  );
}

function assertBudgetBeforeNextRequest(
  predictions: readonly OfferPackageClassificationPrediction[],
  options: Pick<CliOptions, "maxEur" | "inputEurPer1M" | "outputEurPer1M">
): void {
  if (options.maxEur === undefined) {
    return;
  }
  if (hasProviderPredictionWithoutUsage(predictions)) {
    throw new Error("Cannot enforce --max-eur because at least one provider response omitted usage metadata; checkpoint report was written before stopping.");
  }
  const spendEur = estimateSpendEur(predictions, options);
  if (spendEur >= options.maxEur) {
    throw new Error(`Estimated spend ${spendEur.toFixed(6)} EUR reached --max-eur ${options.maxEur}; checkpoint report was written before stopping.`);
  }
}

async function classifySource(input: {
  source: SourceText;
  model: string;
  adapter?: BoundaryGuardedLlmAdapter;
  allowedPackageIds: readonly string[];
  dryRun: boolean;
  businessId: string;
}): Promise<OfferPackageClassificationPrediction> {
  const pseudonymized = pseudonymizeOfferText(input.source.text);
  const sourceHash = pseudonymized.sourceHash;
  const basePrediction = {
    sourceId: input.source.sourceId,
    sourceHash,
    pseudonymizedHash: pseudonymized.pseudonymizedHash,
    model: input.model
  };

  if (input.dryRun) {
    return {
      ...basePrediction,
      ok: false,
      errors: pseudonymized.riskFlags.length > 0 ? pseudonymized.riskFlags : ["dry_run_no_provider_call"]
    };
  }
  if (pseudonymized.riskFlags.length > 0) {
    return {
      ...basePrediction,
      ok: false,
      errors: pseudonymized.riskFlags
    };
  }

  const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("offer_package_classification_request");
  if (!promptSchema) {
    throw new Error("offer package classification prompt schema is not registered.");
  }

  const readinessInput = buildOfferPackageClassificationInput({
    sourceHash,
    sourceId: `${input.source.sourceId}-${input.model.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`
  });
  const adapterResponse: LlmReadinessProviderAdapterResponse = await input.adapter!.execute({
    input: readinessInput,
    promptSchemaId: promptSchema.promptSchemaId,
    promptContext: buildOfferPackageClassificationPromptContext({
      pseudonymizedText: pseudonymized.text,
      packages: loadCuratedOfferPackages()
    })
  }, {
    businessId: input.businessId,
    // A text transform alone is not an authorization record. Until a reviewed
    // derived-source manifest exists, batch input remains conservatively private.
    dataClass: "personal_confidential",
    purpose: "offer_package_classification"
  });

  const parsed = adapterResponse.outputCandidate
    ? parseOfferPackageClassificationDraft(adapterResponse.outputCandidate.text, input.allowedPackageIds)
    : { errors: ["missing outputCandidate"] };

  if (!adapterResponse.ok || parsed.errors.length > 0 || !parsed.draft) {
    return {
      ...basePrediction,
      ok: false,
      providerId: adapterResponse.providerId,
      providerRequestId: adapterResponse.providerRequestId,
      usage: adapterResponse.usage,
      processingPolicy: adapterResponse.processingPolicy,
      errors: [...new Set([...adapterResponse.errors, ...parsed.errors])]
    };
  }

  return {
    ...basePrediction,
    ok: true,
    packageId: parsed.draft.packageId,
    confidence: parsed.draft.confidence,
    alternatives: parsed.draft.alternatives.map((alternative) => alternative.packageId),
    providerId: adapterResponse.providerId,
    providerRequestId: adapterResponse.providerRequestId,
    usage: adapterResponse.usage,
    processingPolicy: adapterResponse.processingPolicy,
    reviewFlags: buildLocalReviewFlags({
      packageId: parsed.draft.packageId,
      pseudonymizedText: pseudonymized.text
    }),
    errors: []
  };
}

export async function runOfferPackageBatchPilotCli(
  argv = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env
): Promise<number> {
  const options = parseArgs(argv, env);
  const sources = readSources(options.sourceDir!, options.limit, options.sourceIds);
  const plannedRequests = sources.length * options.models.length;
  if (plannedRequests > options.maxRequests) {
    throw new Error(`Planned ${plannedRequests} requests exceed maxRequests=${options.maxRequests}.`);
  }

  const packages = loadCuratedOfferPackages();
  const packageIds = packages.map((item) => item.id);
  const adapters = new Map<string, BoundaryGuardedLlmAdapter>();
  const predictions: OfferPackageClassificationPrediction[] = [];

  for (const source of sources) {
    for (const model of options.models) {
      if (!options.dryRun) {
        assertBudgetBeforeNextRequest(predictions, options);
      }
      const adapter = options.dryRun
        ? undefined
        : adapters.get(model) ?? adapterForModel(model, env);
      if (adapter) {
        adapters.set(model, adapter);
      }
      predictions.push(await classifySource({
        source,
        model,
        adapter,
        allowedPackageIds: packageIds,
        dryRun: options.dryRun,
        businessId: env.CATERING_OFFER_BATCH_BUSINESS_ID ?? "local"
      }));
      writeReportCheckpoint({
        outputPath: options.outputPath,
        packageIds,
        maxRequests: options.maxRequests,
        maxEur: options.maxEur,
        predictions,
        fullBatchRunAllowed: options.allowFullRun
      });
    }
  }

  const report = buildOfferPackagePilotReport({
    packageIds,
    maxRequests: options.maxRequests,
    maxEur: options.maxEur,
    predictions,
    fullBatchRunAllowed: options.allowFullRun
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputPath) {
    writeReportCheckpoint({
      outputPath: options.outputPath,
      packageIds,
      maxRequests: options.maxRequests,
      maxEur: options.maxEur,
      predictions,
      fullBatchRunAllowed: options.allowFullRun
    });
  } else {
    process.stdout.write(output);
  }

  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOfferPackageBatchPilotCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
