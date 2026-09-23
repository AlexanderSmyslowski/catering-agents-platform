import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const contractPath = path.join(root, "platform-infra/catering-target-update-contract.json");
const inventoryPath = path.join(root, "platform-infra/catering-target-runtime-inventory.json");

describe("Catering target update contract", () => {
  it("separates repository sources from installed target runtime paths", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    expect(contract).toMatchObject({
      schemaVersion: 2,
      targetId: "catering-prod-1",
      deployPath: "/opt/catering-agents-platform",
      edgePath: "/opt/catering-edge",
      releaseRoot: "/opt/catering-releases",
      repositorySourcePaths: {
        platformBase: "platform-infra/docker-compose.catering-target.json",
        platformOperations: "platform-infra/docker-compose.catering-target.operations.json",
        edgeBase: "edge-infra/docker-compose.catering-target.json",
        edgeOperations: "edge-infra/docker-compose.catering-target.operations.json",
        edgeCaddy: "edge-infra/Caddyfile.catering-target.operations",
        targetSite: "platform-infra/target-sites/catering-target.caddy"
      },
      installedRuntime: {
        platform: {
          composeProject: "platform-infra",
          workingDirectory: "/opt/catering-agents-platform/platform-infra",
          baseCompose: "/opt/catering-agents-platform/platform-infra/compose.json",
          operationsCompose: "/opt/catering-agents-platform/platform-infra/operations.json",
          targetSite: "/opt/catering-agents-platform/platform-infra/sites/catering-target.caddy"
        },
        edge: {
          composeProject: "catering-edge",
          workingDirectory: "/opt/catering-edge",
          baseCompose: "/opt/catering-edge/compose.json",
          operationsCompose: "/opt/catering-edge/operations.json",
          caddyfile: "/opt/catering-edge/Caddyfile"
        }
      },
      applicationServices: ["intake", "offer", "production", "exports", "web"],
      databaseService: "postgres",
      requiredNetworks: ["catering_private", "catering_ingress", "catering_public"],
      forbiddenNetworks: ["zeiterfassung_default"],
      migrationPolicy: { mode: "explicit-only", supportedCommand: null }
    });
    expect(JSON.stringify(contract.installedRuntime)).not.toContain("docker-compose.catering-target");
  });

  it("matches the machine-readable observed runtime inventory", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
    const platform = Object.fromEntries(inventory.platform.runtimeFiles.map((file: any) => [file.role, file]));
    const edge = Object.fromEntries(inventory.edge.runtimeFiles.map((file: any) => [file.role, file]));
    const bindings = [
      [contract.installedRuntime.platform.baseCompose, contract.repositorySourcePaths.platformBase, platform.base_compose],
      [contract.installedRuntime.platform.operationsCompose, contract.repositorySourcePaths.platformOperations, platform.operations_compose],
      [contract.installedRuntime.platform.targetSite, contract.repositorySourcePaths.targetSite, platform.target_site],
      [contract.installedRuntime.edge.baseCompose, contract.repositorySourcePaths.edgeBase, edge.base_compose],
      [contract.installedRuntime.edge.operationsCompose, contract.repositorySourcePaths.edgeOperations, edge.operations_compose],
      [contract.installedRuntime.edge.caddyfile, contract.repositorySourcePaths.edgeCaddy, edge.caddyfile]
    ];
    for (const [runtimePath, sourcePath, observed] of bindings) {
      expect(observed).toMatchObject({
        path: runtimePath,
        sourcePath,
        status: "regular_file",
        owner: "root",
        group: "root",
        mode: "0644",
        sourceMatch: true
      });
    }
    expect(inventory.platform.composeProject).toBe(contract.installedRuntime.platform.composeProject);
    expect(inventory.platform.workingDirectory).toBe(contract.installedRuntime.platform.workingDirectory);
    expect(inventory.edge.composeProject).toBe(contract.installedRuntime.edge.composeProject);
    expect(inventory.edge.workingDirectory).toBe(contract.installedRuntime.edge.workingDirectory);
  });

  it("protects server-owned paths from sync", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    expect(contract.protectedRemotePaths).toEqual(expect.arrayContaining([
      "/etc/catering-target/runtime.env",
      "/opt/catering-agents-platform/platform-infra/compose.json",
      "/opt/catering-agents-platform/platform-infra/operations.json",
      "/opt/catering-agents-platform/platform-infra/.env",
      "/opt/catering-agents-platform/platform-infra/sites",
      "/opt/catering-agents-platform/data",
      "/opt/catering-edge/compose.json",
      "/opt/catering-edge/operations.json",
      "/opt/catering-edge/Caddyfile"
    ]));
  });

  it("matches the existing isolated target Compose source topology", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    const platform = JSON.parse(readFileSync(path.join(root, contract.repositorySourcePaths.platformBase), "utf8"));
    const platformOps = JSON.parse(readFileSync(path.join(root, contract.repositorySourcePaths.platformOperations), "utf8"));
    const edge = JSON.parse(readFileSync(path.join(root, contract.repositorySourcePaths.edgeBase), "utf8"));
    const edgeOps = JSON.parse(readFileSync(path.join(root, contract.repositorySourcePaths.edgeOperations), "utf8"));

    expect(Object.keys(platform.services).sort()).toEqual([...contract.applicationServices, contract.databaseService].sort());
    expect(platform.services.postgres.networks).toEqual(["catering_private"]);
    expect(Object.values(platform.services).every((service: any) => !service.ports?.length)).toBe(true);
    expect(JSON.stringify({ platform, platformOps, edge, edgeOps })).not.toContain("zeiterfassung_default");

    for (const network of ["catering_private", "catering_ingress"]) {
      expect(platform.networks[network]).toMatchObject({
        internal: true,
        enable_ipv6: false,
        driver_opts: { "com.docker.network.bridge.gateway_mode_ipv4": "isolated" }
      });
    }

    expect(edgeOps.services.edge.ports).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 80, published: "80", protocol: "tcp" }),
      expect.objectContaining({ target: 443, published: "443", protocol: "tcp" })
    ]));
  });
});
