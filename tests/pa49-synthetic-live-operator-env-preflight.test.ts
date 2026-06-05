import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  runLlmReadinessSyntheticLivePreflight
} from "@catering/shared-core";

const docPath = "docs/architecture/PA49_SYNTHETIC_LIVE_OPERATOR_ENV_PREFLIGHT.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("PA49 synthetic-live operator env preflight", () => {
  it("documents a local operator/env preflight without widening the corridor", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA49 Synthetic-Live Operator Env Preflight");
    expect(doc).toContain("kein Provider-Call");
    expect(doc).toContain("keine UI");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Runtime-Conversation");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("keeps the preflight script discoverable from package.json", () => {
    expect(packageJson.scripts["llm:synthetic-live:preflight"]).toBe(
      "tsx scripts/check-synthetic-live-llm-readiness.ts"
    );
    expect(existsSync("scripts/check-synthetic-live-llm-readiness.ts")).toBe(true);
  });

  it("fails clearly when the feature flag and env contract are missing", () => {
    const result = runLlmReadinessSyntheticLivePreflight({
      env: {}
    });

    expect(result.ok).toBe(false);
    expect(result.featureFlagEnabled).toBe(false);
    expect(result.transportEnvValid).toBe(false);
    expect(result.promptArtifactsValid).toBe(true);
    expect(result.clarificationFixtureAvailable).toBe(true);
    expect(result.transportCreatable).toBe(false);
    expect(result.errors).toEqual([
      "synthetic live slice feature flag is disabled",
      "OPENAI_API_KEY must be set",
      "CATERING_SYNTHETIC_LLM_MODEL must be set"
    ]);
  });

  it("passes when the local operator contract is fully present", () => {
    const result = runLlmReadinessSyntheticLivePreflight({
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: "sk-test",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.featureFlagEnabled).toBe(true);
    expect(result.transportEnvValid).toBe(true);
    expect(result.promptArtifactsValid).toBe(true);
    expect(result.clarificationFixtureAvailable).toBe(true);
    expect(result.transportCreatable).toBe(true);
    expect(result.providerId).toBe("openai-responses");
    expect(result.fixtureId).toBe(llmReadinessEvalFixtures[0].fixtureId);
    expect(result.promptSchemaId).toBe("clarification-question-draft-prompt-schema.v0");
    expect(result.promptArtifactId).toBe("clarification-question-draft.prompt");
    expect(result.model).toBe("gpt-test");
  });
});
