import type {
  LlmReadinessModelOutputKind,
  LlmReadinessStructuredCandidateValue
} from "./llm-readiness.js";
import type {
  LlmReadinessSyntheticLiveTransport,
  LlmReadinessSyntheticLiveTransportRequest,
  LlmReadinessSyntheticLiveTransportResponse
} from "./llm-readiness-synthetic-live-slice.js";

export interface OpenAiSyntheticLiveTransportOptions {
  apiKey: string;
  model: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export interface OpenAiSyntheticLiveTransportEnv {
  OPENAI_API_KEY?: string;
  CATERING_SYNTHETIC_LLM_MODEL?: string;
  CATERING_OPENAI_RESPONSES_URL?: string;
}

interface OpenAiResponsesOutputItem {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

interface OpenAiResponsesBody {
  id?: string;
  output_text?: string;
  output?: OpenAiResponsesOutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

const defaultOpenAiResponsesEndpoint = "https://api.openai.com/v1/responses";

function buildClarificationQuestionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      reason: { type: "string" },
      reasonCode: { type: "string" }
    },
    required: ["text", "reason", "reasonCode"]
  };
}

function buildProductionDraftExtractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      eventType: { type: ["string", "null"] },
      serviceForm: { type: ["string", "null"] },
      eventDate: { type: ["string", "null"] },
      attendeeCount: { type: ["number", "null"] },
      customerName: { type: ["string", "null"] },
      venueName: { type: ["string", "null"] },
      components: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            course: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            note: { type: ["string", "null"] }
          },
          required: ["label", "course", "category", "note"]
        }
      },
      openQuestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            field: { type: "string" },
            message: { type: "string" },
            suggestedQuestion: { type: ["string", "null"] }
          },
          required: ["field", "message", "suggestedQuestion"]
        }
      }
    },
    required: [
      "eventType",
      "serviceForm",
      "eventDate",
      "attendeeCount",
      "customerName",
      "venueName",
      "components",
      "openQuestions"
    ]
  };
}

function buildIntakeShadowExtractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      eventType: { type: ["string", "null"] },
      serviceForm: { type: ["string", "null"] },
      eventDate: { type: ["string", "null"] },
      attendeeCount: { type: ["number", "null"] },
      menuItems: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["eventType", "serviceForm", "eventDate", "attendeeCount", "menuItems"]
  };
}

function buildOfferPackageClassificationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      packageId: { type: ["string", "null"] },
      confidence: { type: "number" },
      rationale: { type: "string" },
      signals: {
        type: "array",
        items: { type: "string" }
      },
      alternatives: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            packageId: { type: "string" },
            confidence: { type: "number" }
          },
          required: ["packageId", "confidence"]
        }
      }
    },
    required: ["packageId", "confidence", "rationale", "signals", "alternatives"]
  };
}

function outputSchemaFor(outputKind: LlmReadinessModelOutputKind) {
  if (outputKind === "production_draft_extraction") {
    return buildProductionDraftExtractionSchema();
  }
  if (outputKind === "intake_shadow_extraction") {
    return buildIntakeShadowExtractionSchema();
  }
  if (outputKind === "offer_package_classification_draft") {
    return buildOfferPackageClassificationSchema();
  }
  return buildClarificationQuestionSchema();
}

function buildRequestBody(request: LlmReadinessSyntheticLiveTransportRequest, model: string) {
  return {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: request.systemPrompt
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: request.userPrompt
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: request.outputKind,
        strict: true,
        schema: outputSchemaFor(request.outputKind)
      }
    }
  };
}

function collectTextFromOutput(output: OpenAiResponsesBody["output"]): string | undefined {
  if (!Array.isArray(output)) {
    return undefined;
  }

  const textParts = output
    .flatMap((item) => item.content ?? [])
    .filter((contentItem) => contentItem.type === "output_text" && typeof contentItem.text === "string")
    .map((contentItem) => contentItem.text!.trim())
    .filter((text) => text.length > 0);

  return textParts.length > 0 ? textParts.join("\n") : undefined;
}

function parseResponsePayload(rawText: string, outputKind: LlmReadinessModelOutputKind): {
  ok: boolean;
  errors: string[];
  text?: string;
  structuredCandidate?: Record<string, LlmReadinessStructuredCandidateValue>;
} {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      errors: ["provider response must be valid JSON"]
    };
  }

  if (outputKind === "production_draft_extraction") {
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Array.isArray((parsed as { components?: unknown }).components)
    ) {
      return {
        ok: false,
        errors: ["provider response must contain components as an array"]
      };
    }

    return {
      ok: true,
      errors: [],
      text: JSON.stringify(parsed)
    };
  }

  if (outputKind === "intake_shadow_extraction") {
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Array.isArray((parsed as { menuItems?: unknown }).menuItems)
    ) {
      return {
        ok: false,
        errors: ["provider response must contain menuItems as an array"]
      };
    }

    return {
      ok: true,
      errors: [],
      text: JSON.stringify(parsed)
    };
  }

  if (outputKind === "offer_package_classification_draft") {
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Array.isArray((parsed as { signals?: unknown }).signals) ||
      !Array.isArray((parsed as { alternatives?: unknown }).alternatives)
    ) {
      return {
        ok: false,
        errors: ["provider response must contain signals and alternatives as arrays"]
      };
    }

    return {
      ok: true,
      errors: [],
      text: JSON.stringify(parsed)
    };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as { text?: unknown }).text !== "string" ||
    typeof (parsed as { reason?: unknown }).reason !== "string" ||
    typeof (parsed as { reasonCode?: unknown }).reasonCode !== "string"
  ) {
    return {
      ok: false,
      errors: ["provider response must contain text, reason and reasonCode as strings"]
    };
  }

  return {
    ok: true,
    errors: [],
    text: (parsed as { text: string }).text,
    structuredCandidate: {
      reason: (parsed as { reason: string }).reason,
      reasonCode: (parsed as { reasonCode: string }).reasonCode
    }
  };
}

export function validateOpenAiSyntheticLiveTransportEnv(
  env: OpenAiSyntheticLiveTransportEnv
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof env.OPENAI_API_KEY !== "string" || env.OPENAI_API_KEY.trim().length === 0) {
    errors.push("OPENAI_API_KEY must be set");
  }

  if (
    typeof env.CATERING_SYNTHETIC_LLM_MODEL !== "string" ||
    env.CATERING_SYNTHETIC_LLM_MODEL.trim().length === 0
  ) {
    errors.push("CATERING_SYNTHETIC_LLM_MODEL must be set");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createOpenAiSyntheticLiveTransportFromEnv(
  env: OpenAiSyntheticLiveTransportEnv,
  fetchImpl: typeof fetch = fetch
): OpenAiSyntheticLiveTransport | { errors: string[] } {
  const validation = validateOpenAiSyntheticLiveTransportEnv(env);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  return new OpenAiSyntheticLiveTransport({
    apiKey: env.OPENAI_API_KEY!,
    model: env.CATERING_SYNTHETIC_LLM_MODEL!,
    endpoint: env.CATERING_OPENAI_RESPONSES_URL,
    fetchImpl
  });
}

export class OpenAiSyntheticLiveTransport implements LlmReadinessSyntheticLiveTransport {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiSyntheticLiveTransportOptions) {
    this.endpoint = options.endpoint ?? defaultOpenAiResponsesEndpoint;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async run(
    request: LlmReadinessSyntheticLiveTransportRequest
  ): Promise<LlmReadinessSyntheticLiveTransportResponse> {
    if (
      request.outputKind !== "clarification_question_draft" &&
      request.outputKind !== "production_draft_extraction" &&
      request.outputKind !== "intake_shadow_extraction" &&
      request.outputKind !== "offer_package_classification_draft"
    ) {
      return {
        ok: false,
        errors: ["OpenAI synthetic live transport only supports clarification_question_draft, production_draft_extraction, intake_shadow_extraction and offer_package_classification_draft"],
        providerId: "openai-responses"
      };
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify(buildRequestBody(request, this.options.model))
    });

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const body = (await response.json()) as OpenAiResponsesBody;

    if (!response.ok) {
      return {
        ok: false,
        errors: [body.error?.message ?? `OpenAI responses request failed with status ${response.status}`],
        providerId: "openai-responses",
        providerRequestId: providerRequestId ?? body.id
      };
    }

    const rawText = typeof body.output_text === "string" && body.output_text.trim().length > 0
      ? body.output_text
      : collectTextFromOutput(body.output);

    if (!rawText) {
      return {
        ok: false,
        errors: ["provider response did not contain output text"],
        providerId: "openai-responses",
        providerRequestId: providerRequestId ?? body.id
      };
    }

    const payload = parseResponsePayload(rawText, request.outputKind);
    if (!payload.ok) {
      return {
        ok: false,
        errors: payload.errors,
        providerId: "openai-responses",
        providerRequestId: providerRequestId ?? body.id
      };
    }

    return {
      ok: true,
      errors: [],
      providerId: "openai-responses",
      providerRequestId: providerRequestId ?? body.id,
      text: payload.text,
      structuredCandidate: payload.structuredCandidate,
      usage: body.usage ? {
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
        totalTokens: body.usage.total_tokens
      } : undefined
    };
  }
}
