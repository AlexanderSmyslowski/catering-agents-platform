import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildByoLlmAdapterFromEnv,
  buildOfferPackageClassificationInput,
  buildOfferPackageClassificationPromptContext,
  buildOfferPackagePilotReport,
  findLlmReadinessPromptSchemaEntryByInputKind,
  loadCuratedOfferPackages,
  parseOfferPackageClassificationDraft,
  pseudonymizeOfferText,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterResponse,
  type OfferPackageClassificationPrediction
} from "@catering/shared-core";

interface CliOptions {
  sourceDir?: string;
  limit: number;
  models: string[];
  maxRequests: number;
  maxEur?: number;
  dryRun: boolean;
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
    models: ["gpt-4.1", "gpt-4.1-mini"],
    maxRequests: Number(env.CATERING_OFFER_BATCH_MAX_REQUESTS ?? 60),
    maxEur: env.CATERING_OFFER_BATCH_MAX_EUR ? Number(env.CATERING_OFFER_BATCH_MAX_EUR) : 3,
    dryRun: false
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
    } else if (arg === "--max-requests") {
      options.maxRequests = Number(next);
      index += 1;
    } else if (arg === "--max-eur") {
      options.maxEur = Number(next);
      index += 1;
    } else if (arg === "--output") {
      options.outputPath = next;
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.sourceDir) {
    throw new Error("Missing --source-dir or CATERING_OFFER_BATCH_SOURCE_DIR.");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 20) {
    throw new Error("--limit must be an integer between 1 and 20; the 916-offer run is blocked in Slice 2.3a.");
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

  return options;
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

function readSources(sourceDir: string, limit: number): SourceText[] {
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  return collectTextFiles(sourceDir).slice(0, limit).map((filePath, index) => ({
    sourceId: `offer-${String(index + 1).padStart(2, "0")}`,
    text: readFileSync(filePath, "utf8")
  }));
}

function adapterForModel(model: string): LlmReadinessProviderAdapter {
  return buildByoLlmAdapterFromEnv({
    ...process.env,
    CATERING_LLM_PROVIDER: process.env.CATERING_LLM_PROVIDER ?? "openai",
    CATERING_LLM_MODEL: model,
    CATERING_SYNTHETIC_LLM_SLICE: "1"
  }, {
    providerRunIdPrefix: "offer-package-batch-pilot"
  });
}

async function classifySource(input: {
  source: SourceText;
  model: string;
  adapter?: LlmReadinessProviderAdapter;
  allowedPackageIds: readonly string[];
  dryRun: boolean;
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
  const adapterResponse: LlmReadinessProviderAdapterResponse = await input.adapter!.run({
    input: readinessInput,
    promptSchemaId: promptSchema.promptSchemaId,
    promptContext: buildOfferPackageClassificationPromptContext({
      pseudonymizedText: pseudonymized.text,
      packages: loadCuratedOfferPackages()
    })
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
    errors: []
  };
}

export async function runOfferPackageBatchPilotCli(
  argv = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env
): Promise<number> {
  const options = parseArgs(argv, env);
  const sources = readSources(options.sourceDir!, options.limit);
  const plannedRequests = sources.length * options.models.length;
  if (plannedRequests > options.maxRequests) {
    throw new Error(`Planned ${plannedRequests} requests exceed maxRequests=${options.maxRequests}.`);
  }

  const packages = loadCuratedOfferPackages();
  const packageIds = packages.map((item) => item.id);
  const adapters = new Map<string, LlmReadinessProviderAdapter>();
  const predictions: OfferPackageClassificationPrediction[] = [];

  for (const source of sources) {
    for (const model of options.models) {
      const adapter = options.dryRun
        ? undefined
        : adapters.get(model) ?? adapterForModel(model);
      if (adapter) {
        adapters.set(model, adapter);
      }
      predictions.push(await classifySource({
        source,
        model,
        adapter,
        allowedPackageIds: packageIds,
        dryRun: options.dryRun
      }));
    }
  }

  const report = buildOfferPackagePilotReport({
    packageIds,
    maxRequests: options.maxRequests,
    maxEur: options.maxEur,
    predictions
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputPath) {
    writeFileSync(options.outputPath, output, "utf8");
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
