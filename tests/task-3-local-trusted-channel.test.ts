import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";

const secret = "local-channel-secret";

function trustedHeaders(actorName: string) {
  return {
    "x-catering-trusted-secret": secret,
    "x-catering-actor-name": actorName,
    "x-catering-business-id": "local"
  };
}

describe("Task 3 local trusted channel", () => {
  it("keeps non-offer mutations and demo seeding usable when the shared secret is configured", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-local-channel-"));
    const intake = buildIntakeApp({ rootDir, trustedActorSecret: secret });
    const production = buildProductionApp({ dataRoot: rootDir, trustedActorSecret: secret });

    const intakeMutation = await intake.inject({
      method: "POST",
      url: "/v1/intake/normalize",
      headers: trustedHeaders("Intake-Mitarbeiter"),
      payload: { text: "Business Lunch fuer 20 Personen." }
    });
    const intakeSeed = await intake.inject({ method: "POST", url: "/v1/intake/seed-demo", headers: trustedHeaders("Betriebs-/Audit-Operator") });
    const productionSeed = await production.inject({ method: "POST", url: "/v1/production/seed-demo", headers: trustedHeaders("Betriebs-/Audit-Operator") });

    expect(intakeMutation.statusCode).toBe(201);
    expect(intakeSeed.statusCode).toBe(201);
    expect(productionSeed.statusCode).toBe(201);
    await intake.close();
    await production.close();
  });

  it("routes intake, offer, production, and both export roles through server-owned trusted proxy headers", () => {
    const viteConfig = readFileSync("backoffice-ui/vite.config.ts", "utf8");
    expect(viteConfig).toMatch(/"\/api\/intake"[\s\S]{0,220}"Intake-Mitarbeiter"/);
    expect(viteConfig).toMatch(/"\/api\/offers"[\s\S]{0,220}"Angebots-Mitarbeiter"/);
    expect(viteConfig).toMatch(/"\/api\/production"[\s\S]{0,220}"Produktions-Mitarbeiter"/);
    expect(viteConfig).toContain('"/api/exports/v1/exports/offers"');
  });

  it("seeds every local service through the same trusted secret and business channel", () => {
    const startScript = readFileSync("scripts/start-local-stack.sh", "utf8");
    const seedBlock = startScript.slice(startScript.indexOf("seed_demo_data()"), startScript.indexOf("screen_session_exists()"));
    expect(seedBlock.match(/x-catering-trusted-secret/g)).toHaveLength(3);
    expect(seedBlock.match(/x-catering-actor-name/g)).toHaveLength(3);
    expect(seedBlock.match(/x-catering-business-id/g)).toHaveLength(3);
  });

  it("runs the direct local checks through trusted service-owned identities", () => {
    const checkScript = readFileSync("scripts/check-local-ops.sh", "utf8");
    expect(checkScript).not.toContain('x-actor-name:');
    expect(checkScript.match(/x-catering-trusted-secret/g)?.length).toBeGreaterThanOrEqual(5);
    expect(checkScript.match(/x-catering-actor-name/g)?.length).toBeGreaterThanOrEqual(5);
    expect(checkScript.match(/x-catering-business-id/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
