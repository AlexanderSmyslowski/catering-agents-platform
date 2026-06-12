import {
  CodexCliLlmReadinessProviderAdapter,
  type CodexCliExec
} from "./byo-llm-codex-cli-transport.js";
import {
  createOpenAiSyntheticLiveTransportFromEnv
} from "./llm-readiness-openai-transport.js";
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

function normalizedProvider(value: string | undefined): ByoLlmRuntimeProvider {
  const provider = value?.trim().toLowerCase() || "fixture";
  if (provider === "fixture" || provider === "openai" || provider === "codex_cli") {
    return provider;
  }

  throw new Error(`Unsupported CATERING_LLM_PROVIDER "${value}". Expected "fixture", "openai" or "codex_cli".`);
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
      promptSchemaId: request.promptSchemaId
    });
  }
}

export function buildByoLlmAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: BuildByoLlmAdapterOptions = {}
): LlmReadinessProviderAdapter {
  const provider = normalizedProvider(env.CATERING_LLM_PROVIDER);

  if (provider === "fixture") {
    return new FixtureOnlyLlmReadinessProviderAdapter();
  }

  if (provider === "codex_cli") {
    return new CodexCliLlmReadinessProviderAdapter({
      cliBin: env.CATERING_LLM_CLI_BIN,
      model: env.CATERING_LLM_MODEL,
      timeoutMs: parseOptionalPositiveInteger(env.CATERING_LLM_CLI_TIMEOUT_MS, "CATERING_LLM_CLI_TIMEOUT_MS"),
      execImpl: options.codexCliExec,
      providerRunIdPrefix: options.providerRunIdPrefix
    });
  }

  const apiKey = env.CATERING_LLM_API_KEY ?? env.OPENAI_API_KEY;
  const model = env.CATERING_LLM_MODEL;
  const transport = createOpenAiSyntheticLiveTransportFromEnv(
    {
      OPENAI_API_KEY: apiKey,
      CATERING_SYNTHETIC_LLM_MODEL: model,
      CATERING_OPENAI_RESPONSES_URL: env.CATERING_LLM_BASE_URL
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

  return new OpenAiByoLlmReadinessProviderAdapter(
    new SyntheticLiveLlmReadinessSlice({
      enabled: true,
      transport
    }),
    options.providerRunIdPrefix ?? "byo-llm"
  );
}
