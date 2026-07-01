import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

interface CommandRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function llmGuardEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPENAI_API_KEY: "",
    CATERING_SYNTHETIC_LLM_MODEL: "",
    CATERING_SYNTHETIC_LLM_SLICE: "",
    CATERING_SYNTHETIC_LLM_OPERATOR_NAME: "",
    CATERING_SYNTHETIC_LLM_BUDGET_NOTE: "",
    CATERING_SYNTHETIC_LLM_MINI_PILOT: "",
    CATERING_SYNTHETIC_LLM_OPERATOR_SCOPE: "",
    CATERING_SYNTHETIC_LLM_DATA_SCOPE: "",
    CATERING_SYNTHETIC_LLM_OUTPUT_SCOPE: "",
    CATERING_SYNTHETIC_LLM_HUMAN_APPROVAL: "",
    ...overrides
  };
}

function runNpmScript(scriptName: string, env: NodeJS.ProcessEnv): CommandRun {
  const result = spawnSync("npm", ["run", "--silent", scriptName], {
    cwd: process.cwd(),
    env,
    encoding: "utf8"
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function parseJsonOutput(output: string): unknown {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Command did not return JSON: ${output}`);
  }

  return JSON.parse(output.slice(start, end + 1));
}

describe("synthetic live command guards", () => {
  it("keeps preflight closed when required provider opt-in is missing", () => {
    const run = runNpmScript("llm:synthetic-live:preflight", llmGuardEnv());
    const output = parseJsonOutput(run.stdout) as {
      ok: boolean;
      errors: string[];
      featureFlagEnabled: boolean;
      transportEnvValid: boolean;
      transportCreatable: boolean;
      rawPromptResponseLoggingAllowed: boolean;
    };

    expect(run.status).toBe(1);
    expect(run.stderr).toBe("");
    expect(output.ok).toBe(false);
    expect(output.featureFlagEnabled).toBe(false);
    expect(output.transportEnvValid).toBe(false);
    expect(output.transportCreatable).toBe(false);
    expect(output.rawPromptResponseLoggingAllowed).toBe(false);
    expect(output.errors).toEqual(
      expect.arrayContaining([
        "synthetic live slice feature flag is disabled",
        "OPENAI_API_KEY must be set",
        "CATERING_SYNTHETIC_LLM_MODEL must be set"
      ])
    );
  });

  it("blocks the mini-pilot check before any provider probe when policy flags are incomplete", () => {
    const fakeApiKey = "test-command-guard-token";
    const run = runNpmScript(
      "llm:synthetic-live:check:mini-pilot",
      llmGuardEnv({
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: fakeApiKey,
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test",
        CATERING_SYNTHETIC_LLM_OPERATOR_NAME: "Alexander",
        CATERING_SYNTHETIC_LLM_BUDGET_NOTE: "local-test"
      })
    );
    const output = parseJsonOutput(run.stdout) as {
      ok: boolean;
      errors: string[];
      summary: {
        status: string;
        reason: string;
      };
      preflight: {
        ok: boolean;
        miniPilotReady: boolean;
        rawPromptResponseLoggingAllowed: boolean;
      };
      probe?: {
        ok: boolean;
        providerRunId?: string;
        response?: unknown;
        auditRecord?: unknown;
      };
    };

    expect(run.status).toBe(1);
    expect(run.stderr).toBe("");
    expect(run.stdout).not.toContain(fakeApiKey);
    expect(output.ok).toBe(false);
    expect(output.summary).toMatchObject({
      status: "blocked",
      reason: "mini_pilot_policy_incomplete"
    });
    expect(output.preflight).toMatchObject({
      ok: true,
      miniPilotReady: false,
      rawPromptResponseLoggingAllowed: false
    });
    expect(output.probe).toMatchObject({
      ok: false
    });
    expect(output.probe?.providerRunId).toBeUndefined();
    expect(output.probe?.response).toBeUndefined();
    expect(output.probe?.auditRecord).toBeUndefined();
    expect(output.errors).toContain("mini-pilot policy is not fully marked as ready");
  });
});
