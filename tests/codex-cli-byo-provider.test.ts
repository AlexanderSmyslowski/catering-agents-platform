import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IntakeStore } from "@catering/intake-service";
import { buildProductionApp, ProductionStore, type ClarificationDraft } from "@catering/production-service";
import {
  AuditLogStore,
  buildByoLlmAdapterFromEnv,
  byoLlmProviderBoundaryByKind,
  llmReadinessEvalFixtures,
  SCHEMA_VERSION,
  type AcceptedEventSpec
} from "@catering/shared-core";

const TRUSTED_SECRET = "codex-cli-byo-secret";
const fixtureSpecId = "spec-synthetic-coffee-break";

type MockCodexExecRequest = {
  command: string;
  args: string[];
  stdin: string;
  timeoutMs: number;
};

const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-codex-cli-byo-"));
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

async function seedFixtureSpec(intakeStore: IntakeStore): Promise<void> {
  await intakeStore.saveSpec(fixtureSpec());
}

function successfulCodexExec(calls: MockCodexExecRequest[]) {
  return async (request: MockCodexExecRequest) => {
    calls.push(request);
    return {
      exitCode: 0,
      stdout: [
        "Codex CLI finished.",
        "```json",
        JSON.stringify({
          text: "Wie viele Teilnehmer sollen für die Kaffeepause eingeplant werden?",
          reason: "Teilnehmerzahl fehlt.",
          reasonCode: "attendees.expected"
        }),
        "```"
      ].join("\n"),
      stderr: ""
    };
  };
}

describe("Codex CLI BYO LLM provider", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("selects codex_cli from env, passes restrictive exec flags, and leaves fixture/openai selection intact", async () => {
    const calls: MockCodexExecRequest[] = [];
    const adapter = buildByoLlmAdapterFromEnv(
      {
        CATERING_LLM_PROVIDER: "codex_cli",
        CATERING_LLM_CLI_BIN: "codex-test",
        CATERING_LLM_MODEL: "test-codex-model",
        CATERING_LLM_CLI_TIMEOUT_MS: "1234"
      },
      { codexCliExec: successfulCodexExec(calls) }
    );
    const response = await adapter.run({ input: structuredClone(llmReadinessEvalFixtures[0].input) });

    expect(response).toMatchObject({
      ok: true,
      adapterMode: "synthetic_live",
      providerId: "codex-cli"
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "codex-test",
      timeoutMs: 1234
    });
    expect(calls[0].args).toEqual(expect.arrayContaining([
      "exec",
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--model",
      "test-codex-model",
      "-"
    ]));
    expect(calls[0].stdin).toContain("reine Inferenz");
    expect(calls[0].stdin).toContain("Erzeuge ein JSON-Objekt mit den Feldern text, reason und reasonCode.");
    expect(calls[0].stdin).toContain("accepted_event_spec:spec-synthetic-coffee-break");
    expect(buildByoLlmAdapterFromEnv({ CATERING_LLM_PROVIDER: "fixture" }).adapterMode).toBe("fixture_only");
    expect(() => buildByoLlmAdapterFromEnv({ CATERING_LLM_PROVIDER: "openai" })).toThrow("CATERING_LLM_MODEL");
    expect(() =>
      buildByoLlmAdapterFromEnv({
        CATERING_LLM_PROVIDER: "codex_cli",
        CATERING_LLM_CLI_TIMEOUT_MS: "nope"
      })
    ).toThrow("CATERING_LLM_CLI_TIMEOUT_MS must be a positive integer");
  });

  it("documents the codex_cli BYO boundary as local operator transport", () => {
    expect(byoLlmProviderBoundaryByKind("codex_cli")).toMatchObject({
      providerKind: "codex_cli",
      adapterId: "codex-cli",
      status: "local_operator_transport",
      explicitOptInRequired: true,
      realCustomerDataAllowed: false,
      writeEffectsAllowed: false
    });
    expect(byoLlmProviderBoundaryByKind("codex_cli")?.operationalNote).toContain("lokalen Operator-Betrieb");
  });

  it("distinguishes missing binary, login and timeout errors without fixture fallback", async () => {
    const missingBinaryAdapter = buildByoLlmAdapterFromEnv(
      { CATERING_LLM_PROVIDER: "codex_cli" },
      {
        codexCliExec: async () => ({
          exitCode: null,
          stdout: "",
          stderr: "",
          errorCode: "ENOENT"
        })
      }
    );
    const loginAdapter = buildByoLlmAdapterFromEnv(
      { CATERING_LLM_PROVIDER: "codex_cli" },
      {
        codexCliExec: async () => ({
          exitCode: 1,
          stdout: "",
          stderr: "not logged in",
          timedOut: false
        })
      }
    );
    const timeoutAdapter = buildByoLlmAdapterFromEnv(
      {
        CATERING_LLM_PROVIDER: "codex_cli",
        CATERING_LLM_CLI_TIMEOUT_MS: "5"
      },
      {
        codexCliExec: async () => ({
          exitCode: null,
          stdout: "",
          stderr: "",
          timedOut: true
        })
      }
    );

    const missingBinaryResponse = await missingBinaryAdapter.run({
      input: structuredClone(llmReadinessEvalFixtures[0].input)
    });
    const loginResponse = await loginAdapter.run({
      input: structuredClone(llmReadinessEvalFixtures[0].input)
    });
    const timeoutResponse = await timeoutAdapter.run({
      input: structuredClone(llmReadinessEvalFixtures[0].input)
    });

    expect(missingBinaryResponse).toMatchObject({
      ok: false,
      errors: ["codex CLI binary not found: codex"]
    });
    expect(loginResponse).toMatchObject({
      ok: false,
      errors: ["codex CLI is not logged in or subscription authentication is unavailable"]
    });
    expect(timeoutResponse).toMatchObject({
      ok: false,
      errors: ["codex CLI timed out after 5ms"]
    });
  });

  it("creates a schema-valid route draft through mocked Codex CLI and keeps audit free of CLI plaintext", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const calls: MockCodexExecRequest[] = [];
    await seedFixtureSpec(intakeStore);
    const app = buildProductionApp({
      dataRoot,
      intakeStore,
      store,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      buildLlmAdapter: () =>
        buildByoLlmAdapterFromEnv(
          {
            CATERING_LLM_PROVIDER: "codex_cli",
            CATERING_LLM_CLI_BIN: "codex-test"
          },
          { codexCliExec: successfulCodexExec(calls) }
        )
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/specs/${fixtureSpecId}/clarification-drafts`,
        headers: trustedProductionHeaders
      });
      const draft = response.json<{ draft: ClarificationDraft }>().draft;
      const auditEvents = await auditLog.listRecent(5);
      const auditJson = JSON.stringify(auditEvents);

      expect(response.statusCode).toBe(201);
      expect(draft.modelMetadata).toMatchObject({
        adapterMode: "synthetic_live",
        providerId: "codex-cli",
        providerRequestId: "byo-llm-codex-cli-input-spec-synthetic-coffee-break-clarification-draft"
      });
      expect(draft.questions[0]).toMatchObject({
        text: "Wie viele Teilnehmer sollen für die Kaffeepause eingeplant werden?",
        reasonCode: "attendees.expected"
      });
      expect(calls).toHaveLength(1);
      expect(auditJson).not.toContain(draft.questions[0].text);
      expect(auditJson).not.toContain(calls[0].stdin);
      expect(auditJson).not.toContain("Codex CLI finished.");
      expect(auditJson).not.toContain("systemPrompt");
      expect(auditJson).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("returns 422 for garbage Codex CLI output and persists no draft", async () => {
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
      buildLlmAdapter: () =>
        buildByoLlmAdapterFromEnv(
          { CATERING_LLM_PROVIDER: "codex_cli" },
          {
            codexCliExec: async () => ({
              exitCode: 0,
              stdout: "not json, just chatter",
              stderr: ""
            })
          }
        )
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/specs/${fixtureSpecId}/clarification-drafts`,
        headers: trustedProductionHeaders
      });
      const auditJson = JSON.stringify(await auditLog.listRecent(5));

      expect(response.statusCode).toBe(422);
      expect(response.json<{ errors: string[] }>().errors).toContain(
        "codex CLI output did not contain a valid JSON object"
      );
      expect(await store.listClarificationDrafts(fixtureSpecId)).toEqual([]);
      expect(auditJson).not.toContain("not json, just chatter");
    } finally {
      await app.close();
    }
  });
});
