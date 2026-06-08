import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("runtime boundary config", () => {
  it("opts Docker service containers into network-reachable binds without changing local defaults", () => {
    const compose = readFileSync("platform-infra/docker-compose.yml", "utf8");

    expect(compose).toContain("INTAKE_HOST: 0.0.0.0");
    expect(compose).toContain("OFFER_HOST: 0.0.0.0");
    expect(compose).toContain("PRODUCTION_HOST: 0.0.0.0");
    expect(compose).toContain("PRINT_EXPORT_HOST: 0.0.0.0");
    expect(compose).not.toMatch(/^\s+HOST:\s+0\.0\.0\.0$/m);

    const serverEntries = [
      ["intake-service/src/server.ts", "INTAKE_HOST"],
      ["offer-service/src/server.ts", "OFFER_HOST"],
      ["production-service/src/server.ts", "PRODUCTION_HOST"],
      ["print-export/src/server.ts", "PRINT_EXPORT_HOST"]
    ] as const;

    for (const [path, hostEnv] of serverEntries) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain(`process.env.${hostEnv} ?? "127.0.0.1"`);
    }
  });

  it("keeps dev actor headers scoped to the documented local stack", () => {
    const startLocalStack = readFileSync("scripts/start-local-stack.sh", "utf8");
    const checkLocalOps = readFileSync("scripts/check-local-ops.sh", "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(startLocalStack).toContain("export CATERING_DEV_AUTH=1");
    expect(startLocalStack).toContain("x-actor-name");
    expect(checkLocalOps).toContain("CATERING_DEV_AUTH=1");
    expect(checkLocalOps).toContain("x-actor-name");
    expect(packageJson.scripts["dev:intake"]).not.toContain("CATERING_DEV_AUTH");
    expect(packageJson.scripts["dev:offer"]).not.toContain("CATERING_DEV_AUTH");
    expect(packageJson.scripts["dev:production"]).not.toContain("CATERING_DEV_AUTH");
    expect(packageJson.scripts["dev:exports"]).not.toContain("CATERING_DEV_AUTH");
  });
});
