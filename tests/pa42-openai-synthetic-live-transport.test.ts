import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenAiSyntheticLiveTransport,
  createOpenAiSyntheticLiveTransportFromEnv,
  llmReadinessEvalFixtures,
  validateOpenAiSyntheticLiveTransportEnv,
  type LlmReadinessSyntheticLiveTransportRequest
} from "@catering/shared-core";

function buildRequest(): LlmReadinessSyntheticLiveTransportRequest {
  return {
    providerRunId: "provider-run-1",
    fixtureId: llmReadinessEvalFixtures[0].fixtureId,
    promptSchemaId: "clarification-question-draft-prompt-schema.v0",
    promptArtifactId: "clarification-question-draft.prompt",
    promptVersion: "v0",
    outputKind: "clarification_question_draft",
    systemPrompt: "JSON only",
    userPrompt: "Bitte gib JSON zurueck."
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PA42 OpenAI synthetic live transport", () => {
  it("validates the required env contract", () => {
    expect(validateOpenAiSyntheticLiveTransportEnv({})).toEqual({
      valid: false,
      errors: [
        "OPENAI_API_KEY must be set",
        "CATERING_SYNTHETIC_LLM_MODEL must be set"
      ]
    });

    expect(
      validateOpenAiSyntheticLiveTransportEnv({
        OPENAI_API_KEY: "sk-test",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test"
      })
    ).toEqual({
      valid: true,
      errors: []
    });
  });

  it("creates a transport from env when the required values are present", () => {
    const transport = createOpenAiSyntheticLiveTransportFromEnv({
      OPENAI_API_KEY: "sk-test",
      CATERING_SYNTHETIC_LLM_MODEL: "gpt-test"
    });

    expect("run" in transport).toBe(true);
  });

  it("sends a structured Responses API request and parses JSON output text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/responses");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer sk-test");

      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.model).toBe("gpt-test");
      expect(body.text).toMatchObject({
        format: {
          type: "json_schema",
          name: "clarification_question_draft",
          strict: true
        }
      });

      return new Response(
        JSON.stringify({
          id: "resp-1",
          output_text: JSON.stringify({
            text: "Bitte klaeren, fuer wie viele Personen die Kaffeepause geplant werden soll.",
            reason: "missingFields",
            reasonCode: "attendees.expected"
          })
        }),
        {
          status: 200,
          headers: {
            "x-request-id": "req-openai-1",
            "content-type": "application/json"
          }
        }
      );
    });

    const transport = new OpenAiSyntheticLiveTransport({
      apiKey: "sk-test",
      model: "gpt-test",
      fetchImpl: fetchMock as typeof fetch
    });

    expect(await transport.run(buildRequest())).toEqual({
      ok: true,
      errors: [],
      providerId: "openai-responses",
      providerRequestId: "req-openai-1",
      text: "Bitte klaeren, fuer wie viele Personen die Kaffeepause geplant werden soll.",
      structuredCandidate: {
        reason: "missingFields",
        reasonCode: "attendees.expected"
      }
    });
  });

  it("rejects unsupported output kinds before any network request", async () => {
    const fetchMock = vi.fn();
    const transport = new OpenAiSyntheticLiveTransport({
      apiKey: "sk-test",
      model: "gpt-test",
      fetchImpl: fetchMock as typeof fetch
    });

    const request = buildRequest();
    request.outputKind = "operator_summary_draft";

    const response = await transport.run(request);

    expect(response.ok).toBe(false);
    expect(response.errors).toContain(
      "OpenAI synthetic live transport only supports clarification_question_draft and production_draft_extraction"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the production draft extraction schema and returns JSON text", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.text).toMatchObject({
        format: {
          type: "json_schema",
          name: "production_draft_extraction",
          strict: true
        }
      });

      return new Response(
        JSON.stringify({
          id: "resp-production-draft-1",
          output_text: JSON.stringify({
            eventType: "reception",
            serviceForm: "flying_buffet",
            eventDate: "2026-06-14",
            attendeeCount: 45,
            customerName: null,
            venueName: null,
            components: [
              { label: "Vitello Tonnato", course: null, category: null, note: null }
            ],
            openQuestions: []
          })
        }),
        {
          status: 200,
          headers: {
            "x-request-id": "req-production-draft-1",
            "content-type": "application/json"
          }
        }
      );
    });

    const transport = new OpenAiSyntheticLiveTransport({
      apiKey: "sk-test",
      model: "gpt-test",
      fetchImpl: fetchMock as typeof fetch
    });
    const request = buildRequest();
    request.outputKind = "production_draft_extraction";

    const response = await transport.run(request);

    expect(response.ok).toBe(true);
    expect(response.text).toContain("Vitello Tonnato");
    expect(response.structuredCandidate).toBeUndefined();
  });

  it("surfaces provider-side errors and malformed JSON cleanly", async () => {
    const failingTransport = new OpenAiSyntheticLiveTransport({
      apiKey: "sk-test",
      model: "gpt-test",
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "model not available"
            }
          }),
          {
            status: 400,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      ) as typeof fetch
    });

    const invalidJsonTransport = new OpenAiSyntheticLiveTransport({
      apiKey: "sk-test",
      model: "gpt-test",
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            output_text: "{not-json"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      ) as typeof fetch
    });

    expect(await failingTransport.run(buildRequest())).toEqual({
      ok: false,
      errors: ["model not available"],
      providerId: "openai-responses",
      providerRequestId: undefined
    });

    expect(await invalidJsonTransport.run(buildRequest())).toEqual({
      ok: false,
      errors: ["provider response must be valid JSON"],
      providerId: "openai-responses",
      providerRequestId: undefined
    });
  });
});
