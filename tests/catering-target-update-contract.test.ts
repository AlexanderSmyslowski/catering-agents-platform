import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const contractPath = path.join(root, "platform-infra/catering-target-update-contract.json");

describe("Catering target update contract", () => {
  it("pins only the isolated Catering target topology", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    expect(contract).toMatchObject({
      schemaVersion: 1,
      targetId: "catering-prod-1",
      deployPath: "/opt/catering-agents-platform",
      edgePath: "/opt/catering-edge",
      releaseRoot: "/opt/catering-releases",
      applicationServices: ["intake", "offer", "production", "exports", "web"],
      databaseService: "postgres",
      requiredNetworks: ["catering_private", "catering_ingress", "catering_public"],
      forbiddenNetworks: ["zeiterfassung_default"],
      migrationPolicy: { mode: "explicit-only", supportedCommand: null }
    });
  });

  it("protects server-owned paths from sync", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    expect(contract.protectedRemotePaths).toEqual(expect.arrayContaining([
      "/etc/catering-target/runtime.env",
      "/opt/catering-edge/Caddyfile",
      "/opt/catering-agents-platform/platform-infra/.env",
      "/opt/catering-agents-platform/platform-infra/sites",
      "/opt/catering-agents-platform/data"
    ]));
  });

  it("matches the existing isolated target Compose topology", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    const platform = JSON.parse(readFileSync(path.join(root, contract.platformComposeFiles[0]), "utf8"));
    const platformOps = JSON.parse(readFileSync(path.join(root, contract.platformComposeFiles[1]), "utf8"));
    const edge = JSON.parse(readFileSync(path.join(root, contract.edgeComposeFiles[0]), "utf8"));
    const edgeOps = JSON.parse(readFileSync(path.join(root, contract.edgeComposeFiles[1]), "utf8"));

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
