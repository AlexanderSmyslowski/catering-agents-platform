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

function buildRequestBody(request, model) {
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
        name: "clarification_question_draft",
        strict: true,
        schema: buildClarificationQuestionSchema()
      }
    }
  };
}

function collectTextFromOutput(output) {
  if (!Array.isArray(output)) {
    return undefined;
  }

  const textParts = output
    .flatMap((item) => item.content ?? [])
    .filter((contentItem) => contentItem.type === "output_text" && typeof contentItem.text === "string")
    .map((contentItem) => contentItem.text.trim())
    .filter((text) => text.length > 0);

  return textParts.length > 0 ? textParts.join("\n") : undefined;
}

function parseResponsePayload(rawText) {
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      errors: ["provider response must be valid JSON"]
    };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof parsed.text !== "string" ||
    typeof parsed.reason !== "string" ||
    typeof parsed.reasonCode !== "string"
  ) {
    return {
      ok: false,
      errors: ["provider response must contain text, reason and reasonCode as strings"]
    };
  }

  return {
    ok: true,
    errors: [],
    text: parsed.text,
    structuredCandidate: {
      reason: parsed.reason,
      reasonCode: parsed.reasonCode
    }
  };
}

export function validateOpenAiSyntheticLiveTransportEnv(env) {
  const errors = [];

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

export function createOpenAiSyntheticLiveTransportFromEnv(env, fetchImpl = fetch) {
  const validation = validateOpenAiSyntheticLiveTransportEnv(env);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  return new OpenAiSyntheticLiveTransport({
    apiKey: env.OPENAI_API_KEY,
    model: env.CATERING_SYNTHETIC_LLM_MODEL,
    endpoint: env.CATERING_OPENAI_RESPONSES_URL,
    fetchImpl
  });
}

export class OpenAiSyntheticLiveTransport {
  constructor(options) {
    this.options = options;
    this.endpoint = options.endpoint ?? defaultOpenAiResponsesEndpoint;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async run(request) {
    if (request.outputKind !== "clarification_question_draft") {
      return {
        ok: false,
        errors: ["OpenAI synthetic live transport only supports clarification_question_draft"],
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
    const body = await response.json();

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

    const payload = parseResponsePayload(rawText);
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
      structuredCandidate: payload.structuredCandidate
    };
  }
}
