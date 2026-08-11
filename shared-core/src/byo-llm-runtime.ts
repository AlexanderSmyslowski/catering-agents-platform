import {
  CodexCliLlmReadinessProviderAdapter,
  type CodexCliExec
} from "./byo-llm-codex-cli-transport.js";
import {
  createOpenAiSyntheticLiveTransportFromEnv
} from "./llm-readiness-openai-transport.js";
import { validateByoLlmProviderRunBoundary } from "./byo-llm-boundary.js";
import {
  createByoLlmProviderDescriptor,
  evaluateByoLlmProviderDataGate,
  loadByoLlmExternalProcessingApprovalFromEnv,
  redactByoLlmEndpointForAudit,
  type ByoLlmExternalProcessingApproval,
  type ByoLlmProviderDataContext,
  type ByoLlmProviderDescriptor,
  projectByoLlmExternalPromptContext
} from "./byo-llm-provider-data-policy.js";
import { createHash } from "node:crypto";
import {
  FixtureOnlyLlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
  type LlmReadinessProviderAdapterResponse
} from "./llm-readiness-provider-adapter.js";
import { SyntheticLiveLlmReadinessSlice } from "./llm-readiness-synthetic-live-slice.js";

export type ByoLlmRuntimeProvider = "fixture" | "openai" | "codex_cli";

export interface BuildByoLlmAdapterOptions {
  fetchImpl?: typeof fetch;
  codexCliExec?: CodexCliExec;
  providerRunIdPrefix?: string;
}

export interface BoundaryGuardedLlmAdapterOptions {
  descriptor: ByoLlmProviderDescriptor;
  delegate: LlmReadinessProviderAdapter;
  approvalResolver?: () => ByoLlmExternalProcessingApproval | undefined;
  /** Server-owned runtime flags are part of the use-case boundary, including injected delegates. */
  env?: Record<string, string | undefined>;
}

// Fixture calls pass through the same draft-only runtime guard as external
// providers. Track only wrappers created here so a caller cannot imitate a
// local fixture merely by choosing adapterMode: "fixture_only".
const runtimeCreatedFixtureAdapters = new WeakMap<object, LlmReadinessProviderAdapter["run"]>();

function isRuntimeCreatedFixtureAdapter(adapter: LlmReadinessProviderAdapter): boolean {
  return runtimeCreatedFixtureAdapters.get(adapter) === adapter.run &&
    Object.getPrototypeOf(adapter) === BoundaryGuardedByoLlmProviderAdapter.prototype;
}

function safeExternalProviderErrors(errors: readonly string[]): string[] {
  const staticSafe = new Set([
    "BYO LLM provider call failed",
    "no synthetic fixture matches input",
    "provider response must be valid JSON",
    "provider response must contain components as an array",
    "provider response must contain menuItems as an array",
    "provider response must contain signals and alternatives as arrays",
    "provider response must contain text, reason and reasonCode as strings",
    "provider response did not contain output text",
    "codex CLI output did not contain a valid JSON object",
    "codex CLI JSON output must contain components as an array",
    "codex CLI JSON output must contain menuItems as an array",
    "codex CLI JSON output must contain signals and alternatives as arrays",
    "codex CLI JSON output must contain text, reason and reasonCode as strings",
    "codex CLI is not logged in or subscription authentication is unavailable",
    "OpenAI synthetic live transport only supports clarification_question_draft, production_draft_extraction, intake_shadow_extraction and offer_package_classification_draft",
    "Codex CLI transport only supports clarification_question_draft, production_draft_extraction, intake_shadow_extraction and offer_package_classification_draft"
  ]);
  const safe = errors.filter((error) => (
    staticSafe.has(error) ||
    /^codex CLI binary not found: [^\r\n]+$/.test(error) ||
    /^codex CLI timed out after \d+ms$/.test(error) ||
    /^codex CLI exited with code (?:-?\d+|unknown)$/.test(error) ||
    /^OpenAI responses request timed out after \d+ms$/.test(error)
  )).map((error) => (
    error.startsWith("codex CLI binary not found:") ? "codex CLI binary not found" : error
  ));
  return safe.length > 0 ? [...new Set(safe)] : ["BYO LLM provider call failed"];
}

/**
 * The guarded adapter owns approval lookup so route handlers cannot forward a
 * client supplied policy record into a provider transport.
 */
export class BoundaryGuardedLlmAdapter {
  readonly adapterId: LlmReadinessProviderAdapter["adapterId"];
  readonly adapterMode: LlmReadinessProviderAdapter["adapterMode"];

  constructor(private readonly options: BoundaryGuardedLlmAdapterOptions) {
    this.adapterId = options.delegate.adapterId;
    this.adapterMode = options.delegate.adapterMode;
  }

  async execute(
    request: LlmReadinessProviderAdapterRequest,
    context: ByoLlmProviderDataContext
  ): Promise<LlmReadinessProviderAdapterResponse> {
    const providerBoundary = validateByoLlmProviderRunBoundary({
      providerKind: this.options.descriptor.providerKind,
      env: this.options.env ?? process.env,
      input: request.input
    });
    const inputHash = `sha256:${createHash("sha256").update(JSON.stringify(request.input)).digest("hex")}`;
    const projection = projectByoLlmExternalPromptContext(request.promptContext);
    const projectedRequest: LlmReadinessProviderAdapterRequest = this.options.descriptor.dataLeavesInstallation
      ? {
          ...request,
          input: {
            ...structuredClone(request.input),
            sourceRefs: request.input.sourceRefs.map((sourceRef, index) => ({
              ...sourceRef,
              label: `external-source-${index + 1}`
            }))
          },
          promptContext: projection.text
        }
      : request;
    const projectionHash = `sha256:${createHash("sha256").update(JSON.stringify(projectedRequest)).digest("hex")}`;
    const policyMetadata = (input: {
      approvalId?: string;
      outputHash?: string;
      successClass: "success" | "policy_rejected" | "provider_rejected";
    }) => ({
      approvalId: input.approvalId,
      businessId: context.businessId,
      providerKind: this.options.descriptor.providerKind,
      providerModel: this.options.descriptor.providerModel,
      capability: this.options.descriptor.capability,
      actualRegion: this.options.descriptor.actualRegion,
      endpoint: redactByoLlmEndpointForAudit(this.options.descriptor.endpoint),
      maximumEstimatedCostEur: this.options.descriptor.maximumEstimatedCostEur,
      retentionPolicy: this.options.descriptor.retentionPolicy,
      trainingUse: this.options.descriptor.trainingUse,
      purpose: context.purpose,
      dataClass: context.dataClass,
      inputHash,
      sourceHash: projection.sourceHash,
      projectionHash,
      outputHash: input.outputHash,
      successClass: input.successClass
    });
    if (!providerBoundary.valid) {
      return {
        ok: false,
        errors: providerBoundary.errors,
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: request.promptSchemaId,
        processingPolicy: policyMetadata({ successClass: "policy_rejected" })
      };
    }
    if (
      this.options.descriptor.providerKind === "fixture" &&
      !isRuntimeCreatedFixtureAdapter(this.options.delegate)
    ) {
      return {
        ok: false,
        errors: ["fixture provider descriptors require the built-in fixture adapter"],
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: request.promptSchemaId,
        processingPolicy: policyMetadata({ successClass: "policy_rejected" })
      };
    }
    let approval: ByoLlmExternalProcessingApproval | undefined;
    try {
      approval = this.options.approvalResolver?.();
    } catch {
      return {
        ok: false,
        errors: ["external processing approval could not be loaded"],
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: request.promptSchemaId,
        processingPolicy: policyMetadata({ successClass: "policy_rejected" })
      };
    }
    const decision = evaluateByoLlmProviderDataGate({
      provider: this.options.descriptor,
      context,
      approval
    });
    if (!decision.allowed) {
      return {
        ok: false,
        errors: decision.errors,
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: request.promptSchemaId,
        processingPolicy: policyMetadata({ approvalId: decision.approvalId, successClass: "policy_rejected" })
      };
    }
    let response: LlmReadinessProviderAdapterResponse;
    try {
      response = await this.options.delegate.run(projectedRequest);
    } catch (error) {
      const safeProviderError = error instanceof Error && /^OpenAI Responses request timed out after \d+ms$/.test(error.message)
        ? error.message
        : "BYO LLM provider call failed";
      return {
        ok: false,
        errors: [safeProviderError],
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: request.promptSchemaId,
        processingPolicy: policyMetadata({ approvalId: decision.approvalId, successClass: "provider_rejected" })
      };
    }
    const outputHash = response.outputCandidate
      ? `sha256:${createHash("sha256").update(response.outputCandidate.text).digest("hex")}`
      : undefined;
    const outputBoundary = response.outputCandidate
      ? validateByoLlmProviderRunBoundary({
          providerKind: this.options.descriptor.providerKind,
          env: this.options.env ?? process.env,
          input: request.input,
          outputCandidate: response.outputCandidate
        })
      : { valid: true, errors: [] };
    if (!outputBoundary.valid) {
      return {
        ok: false,
        errors: outputBoundary.errors,
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: request.promptSchemaId,
        processingPolicy: policyMetadata({
          approvalId: decision.approvalId,
          outputHash,
          successClass: "provider_rejected"
        })
      };
    }
    const safeResponse = this.options.descriptor.dataLeavesInstallation &&
      (!response.ok || response.errors.length > 0)
      ? {
          ...response,
          // An external delegate returning ok=true with errors is malformed;
          // fail closed and never let its raw error text escape the boundary.
          ok: false,
          errors: safeExternalProviderErrors(response.errors),
          outputCandidate: undefined
        }
      : response;
    return {
      ...safeResponse,
      processingPolicy: policyMetadata({
        approvalId: decision.approvalId,
        outputHash,
        successClass: safeResponse.ok ? "success" : "provider_rejected"
      })
    };
  }
}

export function createBoundaryGuardedLlmAdapter(options: BoundaryGuardedLlmAdapterOptions): BoundaryGuardedLlmAdapter {
  return new BoundaryGuardedLlmAdapter(options);
}

function normalizedProvider(value: string | undefined): ByoLlmRuntimeProvider {
  const provider = value?.trim().toLowerCase() || "fixture";
  if (provider === "fixture" || provider === "openai" || provider === "codex_cli") {
    return provider;
  }

  throw new Error(`Unsupported CATERING_LLM_PROVIDER "${value}". Expected "fixture", "openai" or "codex_cli".`);
}

function providerCapabilityFromEnv(
  env: Record<string, string | undefined>,
  provider: ByoLlmRuntimeProvider
): ByoLlmProviderDescriptor["capability"] {
  if (provider === "fixture") return "structured_output";
  const configured = env.CATERING_LLM_PROVIDER_CAPABILITY?.trim();
  if (configured === "structured_output" || configured === "document_understanding" || configured === "text_generation") {
    return configured;
  }
  return "structured_output";
}

function hasVerifiedProviderCapability(value: string | undefined): boolean {
  const configured = value?.trim();
  return configured === "structured_output" || configured === "document_understanding" || configured === "text_generation";
}

function hasConcreteProviderMetadata(value: string | undefined): boolean {
  const configured = value?.trim();
  return Boolean(configured) && configured?.toLowerCase() !== "unknown";
}

export function byoLlmProviderDescriptorFromEnv(
  env: Record<string, string | undefined> = process.env
): ByoLlmProviderDescriptor {
  const provider = normalizedProvider(env.CATERING_LLM_PROVIDER);
  return createByoLlmProviderDescriptor({
    providerKind: provider,
    dataLeavesInstallation: provider !== "fixture",
    providerModel: provider === "fixture" ? "fixture" : env.CATERING_LLM_MODEL?.trim() || "unknown",
    capability: providerCapabilityFromEnv(env, provider),
    actualRegion: provider === "fixture" ? "local" : env.CATERING_LLM_PROCESSING_REGION?.trim() || "unknown",
    maximumEstimatedCostEur: provider === "fixture"
      ? 0
      // An unset external cost estimate must never make a provider look cheaper.
      : Number(env.CATERING_LLM_MAX_ESTIMATED_COST_EUR ?? Number.MAX_VALUE),
    retentionPolicy: provider === "fixture" ? "local-only" : env.CATERING_LLM_RETENTION_POLICY?.trim() || "unknown",
    trainingUse: provider === "fixture" ? "contractually_excluded" : env.CATERING_LLM_TRAINING_USE === "contractually_excluded"
      ? "contractually_excluded"
      : env.CATERING_LLM_TRAINING_USE === "allowed" ? "allowed" : "unknown",
    endpoint: provider === "fixture"
      ? "local://fixture"
      : provider === "openai"
        ? env.CATERING_LLM_BASE_URL?.trim() || "https://api.openai.com/v1/responses"
        : env.CATERING_LLM_CLI_BIN?.trim() || "codex",
    metadataVerified: provider === "fixture" || Boolean(
      hasConcreteProviderMetadata(env.CATERING_LLM_MODEL) &&
      hasVerifiedProviderCapability(env.CATERING_LLM_PROVIDER_CAPABILITY) &&
      hasConcreteProviderMetadata(env.CATERING_LLM_PROCESSING_REGION) &&
      env.CATERING_LLM_MAX_ESTIMATED_COST_EUR?.trim() &&
      hasConcreteProviderMetadata(env.CATERING_LLM_RETENTION_POLICY) &&
      env.CATERING_LLM_TRAINING_USE === "contractually_excluded" &&
      hasConcreteProviderMetadata(provider === "openai" ? env.CATERING_LLM_BASE_URL : env.CATERING_LLM_CLI_BIN)
    )
  });
}

export function buildBoundaryGuardedLlmAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: BuildByoLlmAdapterOptions = {}
): BoundaryGuardedLlmAdapter {
  return new BoundaryGuardedLlmAdapter({
    descriptor: byoLlmProviderDescriptorFromEnv(env),
    delegate: buildByoLlmAdapterFromEnv(env, options),
    approvalResolver: () => loadByoLlmExternalProcessingApprovalFromEnv(env),
    env
  });
}

export function guardByoLlmAdapterForEnv(
  delegate: LlmReadinessProviderAdapter,
  env: Record<string, string | undefined> = process.env
): BoundaryGuardedLlmAdapter {
  const descriptor = byoLlmProviderDescriptorFromEnv(env);
  return new BoundaryGuardedLlmAdapter({
    descriptor,
    delegate,
    approvalResolver: () => loadByoLlmExternalProcessingApprovalFromEnv(env),
    env
  });
}

function parseOptionalPositiveInteger(value: string | undefined, envName: string): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer.`);
  }

  return parsed;
}

class OpenAiByoLlmReadinessProviderAdapter implements LlmReadinessProviderAdapter {
  readonly adapterId = "llm-readiness-synthetic-live-slice" as const;
  readonly adapterMode = "synthetic_live" as const;

  constructor(
    private readonly slice: SyntheticLiveLlmReadinessSlice,
    private readonly providerRunIdPrefix: string
  ) {}

  async run(request: LlmReadinessProviderAdapterRequest): Promise<LlmReadinessProviderAdapterResponse> {
    return this.slice.run({
      providerRunId: `${this.providerRunIdPrefix}-${request.input.inputId}`,
      input: request.input,
      promptSchemaId: request.promptSchemaId,
      promptContext: request.promptContext
    });
  }
}

class BoundaryGuardedByoLlmProviderAdapter implements LlmReadinessProviderAdapter {
  readonly adapterId: LlmReadinessProviderAdapter["adapterId"];
  readonly adapterMode: LlmReadinessProviderAdapter["adapterMode"];

  constructor(
    private readonly providerKind: ByoLlmRuntimeProvider,
    private readonly env: Record<string, string | undefined>,
    private readonly delegate: LlmReadinessProviderAdapter
  ) {
    this.adapterId = delegate.adapterId;
    this.adapterMode = delegate.adapterMode;
    const intrinsicRun = this.run.bind(this);
    Object.defineProperty(this, "run", {
      configurable: false,
      value: intrinsicRun,
      writable: false
    });
    Object.freeze(this);
  }

  async run(request: LlmReadinessProviderAdapterRequest): Promise<LlmReadinessProviderAdapterResponse> {
    const inputBoundary = validateByoLlmProviderRunBoundary({
      providerKind: this.providerKind,
      env: this.env,
      input: request.input
    });

    if (!inputBoundary.valid) {
      return {
        ok: false,
        errors: inputBoundary.errors,
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: request.promptSchemaId
      };
    }

    const response = await this.delegate.run(request);
    const outputBoundary = validateByoLlmProviderRunBoundary({
      providerKind: this.providerKind,
      env: this.env,
      input: request.input,
      outputCandidate: response.outputCandidate
    });

    if (!outputBoundary.valid) {
      return {
        ...response,
        ok: false,
        errors: [...new Set([...response.errors, ...outputBoundary.errors])]
      };
    }

    return response;
  }
}

export function buildByoLlmAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: BuildByoLlmAdapterOptions = {}
): LlmReadinessProviderAdapter {
  const provider = normalizedProvider(env.CATERING_LLM_PROVIDER);

  if (provider === "fixture") {
    const adapter = new BoundaryGuardedByoLlmProviderAdapter(
      provider,
      env,
      new FixtureOnlyLlmReadinessProviderAdapter()
    );
    runtimeCreatedFixtureAdapters.set(adapter, adapter.run);
    return adapter;
  }

  if (provider === "codex_cli") {
    return new BoundaryGuardedByoLlmProviderAdapter(
      provider,
      env,
      new CodexCliLlmReadinessProviderAdapter({
        cliBin: env.CATERING_LLM_CLI_BIN,
        model: env.CATERING_LLM_MODEL,
        timeoutMs: parseOptionalPositiveInteger(env.CATERING_LLM_CLI_TIMEOUT_MS, "CATERING_LLM_CLI_TIMEOUT_MS"),
        execImpl: options.codexCliExec,
        providerRunIdPrefix: options.providerRunIdPrefix
      })
    );
  }

  const apiKey = env.CATERING_LLM_API_KEY ?? env.OPENAI_API_KEY;
  const model = env.CATERING_LLM_MODEL;
  const transport = createOpenAiSyntheticLiveTransportFromEnv(
    {
      OPENAI_API_KEY: apiKey,
      CATERING_SYNTHETIC_LLM_MODEL: model,
      CATERING_OPENAI_RESPONSES_URL: env.CATERING_LLM_BASE_URL,
      CATERING_OPENAI_TIMEOUT_MS: env.CATERING_OPENAI_TIMEOUT_MS
    },
    options.fetchImpl
  );

  if ("errors" in transport) {
    throw new Error(
      transport.errors
        .map((error) =>
          error
            .replace("OPENAI_API_KEY", "CATERING_LLM_API_KEY or OPENAI_API_KEY")
            .replace("CATERING_SYNTHETIC_LLM_MODEL", "CATERING_LLM_MODEL")
        )
        .join("; ")
    );
  }

  return new BoundaryGuardedByoLlmProviderAdapter(
    provider,
    env,
    new OpenAiByoLlmReadinessProviderAdapter(
      new SyntheticLiveLlmReadinessSlice({
        enabled: true,
        transport
      }),
      options.providerRunIdPrefix ?? "byo-llm"
    )
  );
}
