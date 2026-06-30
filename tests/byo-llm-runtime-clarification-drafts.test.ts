import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IntakeStore } from "@catering/intake-service";
import { buildProductionApp, ProductionStore, type ClarificationDraft } from "@catering/production-service";
import {
  AuditLogStore,
  buildByoLlmAdapterFromEnv,
  buildProductionClarificationQuestions,
  llmReadinessContractVersion,
  llmReadinessEvalFixtures,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type LlmReadinessProviderAdapter
} from "@catering/shared-core";

const TRUSTED_SECRET = "byo-llm-draft-secret";
const fixtureSpecId = "spec-synthetic-coffee-break";

const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-byo-llm-drafts-"));
}

function fixtureSpec(): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: fixtureSpecId,
    lifecycle: {
      commercialState: "accepted"
    },
    readiness: {
      status: "complete",
      reasons: []
    },
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: "request-synthetic-coffee-break"
      }
    ],
    event: {
      type: "coffee_break",
      date: "2026-06-25",
      serviceForm: "coffee_break"
    },
    attendees: {
      expected: 35
    },
    servicePlan: {
      eventType: "coffee_break",
      serviceForm: "coffee_break",
      modules: []
    },
    menuPlan: [
      {
        componentId: "coffee-break",
        label: "Kaffeepause",
        menuCategory: "classic"
      }
    ]
  };
}

async function seedFixtureSpec(intakeStore: IntakeStore): Promise<AcceptedEventSpec> {
  const spec = fixtureSpec();
  await intakeStore.saveSpec(spec);
  return spec;
}

async function createDraft(app: ReturnType<typeof buildProductionApp>): Promise<ClarificationDraft> {
  const response = await app.inject({
    method: "POST",
    url: `/v1/production/specs/${fixtureSpecId}/clarification-drafts`,
    headers: trustedProductionHeaders
  });

  expect(response.statusCode).toBe(201);
  return response.json<{ draft: ClarificationDraft }>().draft;
}

describe("BYO LLM runtime clarification drafts", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("parses BYO LLM env and keeps OpenAI calls behind explicit configuration", async () => {
    expect(buildByoLlmAdapterFromEnv({}).adapterMode).toBe("fixture_only");
    expect(buildByoLlmAdapterFromEnv({ CATERING_LLM_PROVIDER: "fixture" }).adapterId).toBe(
      "llm-readiness-fixture-provider-adapter"
    );
    expect(() => buildByoLlmAdapterFromEnv({ CATERING_LLM_PROVIDER: "openai" })).toThrow(
      "CATERING_LLM_MODEL"
    );
    expect(() =>
      buildByoLlmAdapterFromEnv({
        CATERING_LLM_PROVIDER: "openai",
        CATERING_LLM_MODEL: "test-byo-model"
      })
    ).toThrow("CATERING_LLM_API_KEY or OPENAI_API_KEY");
    expect(() => buildByoLlmAdapterFromEnv({ CATERING_LLM_PROVIDER: "other" })).toThrow(
      "Unsupported CATERING_LLM_PROVIDER"
    );

    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(
        JSON.stringify({
          id: "resp-runtime-1",
          output_text: JSON.stringify({
            text: "Bitte klären, welche verbindliche Personenzahl gilt.",
            reason: "missingFields",
            reasonCode: "attendees.expected"
          })
        }),
        {
          status: 200,
          headers: {
            "x-request-id": "req-runtime-1"
          }
        }
      );
    };
    const adapter = buildByoLlmAdapterFromEnv(
      {
        CATERING_LLM_PROVIDER: "openai",
        CATERING_LLM_MODEL: "test-byo-model",
        OPENAI_API_KEY: "test-key",
        CATERING_LLM_BASE_URL: "https://example.test/v1/responses"
      },
      { fetchImpl }
    );
    const response = await adapter.run({ input: structuredClone(llmReadinessEvalFixtures[0].input) });

    expect(response).toMatchObject({
      ok: true,
      adapterMode: "synthetic_live",
      providerId: "openai-responses",
      providerRequestId: "req-runtime-1"
    });
    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe("https://example.test/v1/responses");
  });

  it("creates and lists a fixture-backed clarification draft without writing product questions", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    await seedFixtureSpec(intakeStore);
    const app = buildProductionApp({
      dataRoot,
      intakeStore,
      store,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_LLM_PROVIDER: "fixture" }
    });

    try {
      const draft = await createDraft(app);
      const storedSpec = await intakeStore.getSpec(fixtureSpecId);
      const listResponse = await app.inject({
        method: "GET",
        url: `/v1/production/specs/${fixtureSpecId}/clarification-drafts`,
        headers: trustedProductionHeaders
      });
      const auditEvents = await auditLog.listRecent(5);

      expect(draft).toMatchObject({
        specId: fixtureSpecId,
        status: "pending_review",
        questions: [
          {
            reason: "missingFields",
            reasonCode: "attendees.expected"
          }
        ],
        modelMetadata: {
          adapterMode: "fixture_only",
          fixtureId: "llm-eval-synthetic-coffee-break-missing-attendees"
        }
      });
      expect(draft.questions[0].text).toContain("Kaffeepause");
      expect(storedSpec?.uncertainties).toBeUndefined();
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json<{ items: ClarificationDraft[] }>().items).toHaveLength(1);
      expect(JSON.stringify(auditEvents)).not.toContain(draft.questions[0].text);
      expect(JSON.stringify(auditEvents)).not.toContain("systemPrompt");
      expect(JSON.stringify(auditEvents)).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("rejects schema-invalid adapter output with 422 and does not persist a draft", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    await seedFixtureSpec(intakeStore);
    const invalidAdapter: LlmReadinessProviderAdapter = {
      adapterId: "invalid-fixture-adapter",
      adapterMode: "fixture_only",
      run: async (request) => ({
        ok: true,
        errors: [],
        adapterId: "invalid-fixture-adapter",
        adapterMode: "fixture_only",
        fixtureId: "llm-eval-synthetic-coffee-break-missing-attendees",
        promptSchemaId: request.promptSchemaId,
        outputCandidate: {
          contractVersion: llmReadinessContractVersion,
          outputId: "invalid-output",
          kind: "clarification_question_draft",
          sourceRefs: request.input.sourceRefs,
          humanApprovalRequired: true,
          writesProductObject: false,
          text: "Bitte klären, welche verbindliche Personenzahl gilt.",
          structuredCandidate: {
            reason: "missingFields"
          }
        }
      })
    };
    const app = buildProductionApp({
      dataRoot,
      intakeStore,
      store,
      llmAdapter: invalidAdapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/specs/${fixtureSpecId}/clarification-drafts`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode).toBe(422);
      expect(response.json<{ errors: string[] }>().errors).toContain(
        "outputCandidate.structuredCandidate.reasonCode must be a non-empty string"
      );
      expect(await store.listClarificationDrafts(fixtureSpecId)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("contains adapter runtime failures without persisting drafts or leaking raw provider text", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    await seedFixtureSpec(intakeStore);
    const throwingAdapter: LlmReadinessProviderAdapter = {
      adapterId: "throwing-provider-adapter",
      adapterMode: "synthetic_live",
      run: async () => {
        throw new Error("raw prompt and provider response should never leave the adapter");
      }
    };
    const app = buildProductionApp({
      dataRoot,
      intakeStore,
      store,
      auditLog,
      llmAdapter: throwingAdapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/specs/${fixtureSpecId}/clarification-drafts`,
        headers: trustedProductionHeaders
      });
      const responseBody = response.body;
      const auditJson = JSON.stringify(await auditLog.listRecent(5));

      expect(response.statusCode).toBe(422);
      expect(response.json<{ errors: string[] }>().errors).toContain("BYO-LLM-Aufruf ist fehlgeschlagen.");
      expect(await store.listClarificationDrafts(fixtureSpecId)).toEqual([]);
      expect(responseBody).not.toContain("raw prompt");
      expect(responseBody).not.toContain("provider response");
      expect(auditJson).not.toContain("raw prompt");
      expect(auditJson).not.toContain("provider response");
    } finally {
      await app.close();
    }
  });

  it("approves drafts into spec uncertainties and rejects drafts without materializing questions", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    await seedFixtureSpec(intakeStore);
    const app = buildProductionApp({
      dataRoot,
      intakeStore,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_LLM_PROVIDER: "fixture" }
    });

    try {
      const approvedDraft = await createDraft(app);
      const rejectedDraft = await createDraft(app);
      const approveResponse = await app.inject({
        method: "POST",
        url: `/v1/production/clarification-drafts/${approvedDraft.draftId}/decision`,
        headers: trustedProductionHeaders,
        payload: { approve: true }
      });
      const specAfterApprove = await intakeStore.getSpec(fixtureSpecId);
      const rejectResponse = await app.inject({
        method: "POST",
        url: `/v1/production/clarification-drafts/${rejectedDraft.draftId}/decision`,
        headers: trustedProductionHeaders,
        payload: { approve: false }
      });
      const specAfterReject = await intakeStore.getSpec(fixtureSpecId);
      const questions = buildProductionClarificationQuestions({ spec: specAfterApprove as unknown as Record<string, unknown> });

      expect(approveResponse.statusCode).toBe(200);
      expect(approveResponse.json<{ draft: ClarificationDraft }>().draft.status).toBe("approved");
      expect(specAfterApprove?.uncertainties).toHaveLength(1);
      expect(specAfterApprove?.uncertainties?.[0].suggestedQuestion).toBe(approvedDraft.questions[0].text);
      expect(questions.map((question) => question.prompt)).toContain(approvedDraft.questions[0].text);
      expect(rejectResponse.statusCode).toBe(200);
      expect(rejectResponse.json<{ draft: ClarificationDraft }>().draft.status).toBe("rejected");
      expect(specAfterReject?.uncertainties).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
