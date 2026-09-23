import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const evidencePath = path.join(root, "platform-infra/catering-target-readonly-preflight-evidence.json");

describe("Catering target real read-only preflight evidence", () => {
  it("pins the first successful real contract-v2 target preflight without granting update approval", () => {
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      targetId: "catering-prod-1",
      observedAt: "2026-09-23",
      repositoryCommit: "5b2c77089e7fd9051b4a55e38240cd69d6e9ed99",
      execution: {
        mode: "read_only_preflight",
        invocationCount: 1,
        additionalTargetCalls: 0,
        exitCode: 0,
        stderrEmpty: true,
        marker: "TARGET_PREFLIGHT_OK",
        mutation: false
      },
      bindings: {
        backup: "healthy",
        writerMode: "enabled",
        schemaVersion: 3,
        postgresVolume: "platform-infra_postgres_data",
        edgeImage: "sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648"
      },
      authorization: {
        updateAuthorized: false,
        deploymentAuthorized: false
      }
    });
  });

  it("contains no credentials or secret-shaped fields", () => {
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    expect(JSON.stringify(evidence)).not.toMatch(/password|secret|token|private[_-]?key|authorizationHeader/i);
  });
});
