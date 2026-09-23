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
        source: "two-single-session-read-only-diagnostics",
        boundMainCommit: "25a62be3a18142977e552081b90b802933971ef0",
        sshSessionsTotal: 2,
        mutation: false,
        contentsRead: false,
        hashValuesExposed: false
      },
      platform: {
        composeProject: "platform-infra",
        workingDirectory: "/opt/catering-agents-platform/platform-infra"
      },
      edge: {
        composeProject: "catering-edge",
        workingDirectory: "/opt/catering-edge",
        container: { name: "catering-edge-edge-1", service: "edge" }
      },
      contractAlignment: {
        requiredModel: "separate repository source paths from installed remote runtime paths",
        preflightAlignment: "contract_v2_candidate_uses_confirmed_runtime_paths"
      }
    });

    const allRuntimeFiles = [...inventory.platform.runtimeFiles, ...inventory.edge.runtimeFiles];
    expect(allRuntimeFiles).toHaveLength(6);
    for (const file of allRuntimeFiles) {
      expect(file).toMatchObject({
        status: "regular_file",
        owner: "root",
        group: "root",
        mode: "0644",
        sourceMatch: true
      });
      expect(file.path).toMatch(/^\/opt\/catering-/);
      expect(file.sourcePath).toBeTypeOf("string");
    }

    expect(inventory.platform.runtimeFiles.map((file: any) => file.role).sort()).toEqual(
      ["base_compose", "operations_compose", "target_site"]
    );
    expect(inventory.edge.runtimeFiles.map((file: any) => file.role).sort()).toEqual(
      ["base_compose", "caddyfile", "operations_compose"]
    );

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
