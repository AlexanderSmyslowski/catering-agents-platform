import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const inventoryPath = path.join(root, "platform-infra/catering-target-runtime-inventory.json");

describe("Catering target runtime inventory", () => {
  it("pins only observed runtime facts and explicit unknowns", () => {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
    expect(inventory).toMatchObject({
      schemaVersion: 1,
      targetId: "catering-prod-1",
      observedAt: "2026-09-23",
      observation: {
        source: "single-read-only-ssh-diagnosis",
        boundMainCommit: "25a62be3a18142977e552081b90b802933971ef0",
        sshSessions: 1,
        mutation: false,
        contentsRead: false
      },
      platform: {
        composeProject: "platform-infra",
        workingDirectory: "/opt/catering-agents-platform/platform-infra"
      },
      edge: {
        containerComposeLabels: { status: "not_checked" },
        operationsFile: { status: "unknown" }
      },
      contractAlignment: {
        requiredModel: "separate repository source paths from installed remote runtime paths",
        preflightAlignment: "pending_until_remaining_runtime_paths_are_confirmed"
      }
    });

    expect(inventory.platform.configFilesFromAllContainerLabels).toEqual([
      expect.objectContaining({
        path: "/opt/catering-agents-platform/platform-infra/compose.json",
        labelEvidence: "confirmed_all_six_platform_containers",
        currentFileState: expect.objectContaining({
          status: "regular_file",
          owner: "root",
          group: "root",
          mode: "0644"
        })
      }),
      expect.objectContaining({
        path: "/opt/catering-agents-platform/platform-infra/operations.json",
        labelEvidence: "confirmed_all_six_platform_containers",
        currentFileState: { status: "not_separately_checked" }
      })
    ]);

    expect(inventory.edge.observedComposeFiles).toEqual([
      expect.objectContaining({
        path: "/opt/catering-edge/compose.json",
        currentFileState: expect.objectContaining({
          status: "regular_file",
          owner: "root",
          group: "root",
          mode: "0644"
        })
      })
    ]);

    expect(inventory.legacyExpectedRemotePaths).toEqual([
      { path: "/opt/catering-agents-platform/platform-infra/docker-compose.catering-target.json", status: "missing" },
      { path: "/opt/catering-agents-platform/platform-infra/docker-compose.catering-target.operations.json", status: "missing" },
      { path: "/opt/catering-edge/docker-compose.catering-target.json", status: "missing" },
      { path: "/opt/catering-edge/docker-compose.catering-target.operations.json", status: "missing" }
    ]);
  });

  it("contains no secret-shaped fields or secret values", () => {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
    const text = JSON.stringify(inventory);
    expect(text).not.toMatch(/password|secret|token|private[_-]?key|authorization/i);
  });
});
