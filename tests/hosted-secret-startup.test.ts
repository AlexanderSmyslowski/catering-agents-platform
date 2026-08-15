import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildPrintExportApp } from "../print-export/src/index.js";

const hostedWithoutSecret = {
  CATERING_DEPLOYMENT_PROFILE: "hosted"
};

describe("hosted trusted actor startup contract", () => {
  it("fails fast in every service builder when the hosted secret is missing or blank", () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-hosted-secret-"));
    const builders: Array<[string, () => unknown]> = [
      ["intake missing", () => buildIntakeApp({ rootDir, env: hostedWithoutSecret })],
      ["offer missing", () => buildOfferApp({ rootDir, env: hostedWithoutSecret })],
      ["production missing", () => buildProductionApp({ dataRoot: rootDir, env: hostedWithoutSecret })],
      ["print export missing", () => buildPrintExportApp({ rootDir, env: hostedWithoutSecret })],
      ["intake blank", () => buildIntakeApp({ rootDir, env: { ...hostedWithoutSecret, CATERING_TRUSTED_ACTOR_SECRET: "   " } })],
      ["offer blank", () => buildOfferApp({ rootDir, env: { ...hostedWithoutSecret, CATERING_TRUSTED_ACTOR_SECRET: "   " } })],
      ["production blank", () => buildProductionApp({ dataRoot: rootDir, env: { ...hostedWithoutSecret, CATERING_TRUSTED_ACTOR_SECRET: "   " } })],
      ["print export blank", () => buildPrintExportApp({ rootDir, env: { ...hostedWithoutSecret, CATERING_TRUSTED_ACTOR_SECRET: "   " } })]
    ];

    for (const [name, build] of builders) {
      expect(build, name).toThrow("CATERING_TRUSTED_ACTOR_SECRET must be configured for hosted profile.");
    }
  });

  it("does not require the hosted secret for the local profile", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-local-secret-"));
    const apps = [
      buildIntakeApp({ rootDir, env: { CATERING_DEPLOYMENT_PROFILE: "local" } }),
      buildOfferApp({ rootDir, env: { CATERING_DEPLOYMENT_PROFILE: "local" } }),
      buildProductionApp({ dataRoot: rootDir, env: { CATERING_DEPLOYMENT_PROFILE: "local" } }),
      buildPrintExportApp({ rootDir, env: { CATERING_DEPLOYMENT_PROFILE: "local" } })
    ];

    for (const app of apps) {
      await app.close();
    }
  });

  it("starts every service when hosted secret configuration is present", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-hosted-configured-"));
    const env = {
      ...hostedWithoutSecret,
      CATERING_TRUSTED_ACTOR_SECRET: "test-only-hosted-secret",
      CATERING_DEFAULT_BUSINESS_ID: "acme-main"
    };
    const apps = [
      buildIntakeApp({ rootDir, env }),
      buildOfferApp({ rootDir, env }),
      buildProductionApp({ dataRoot: rootDir, env }),
      buildPrintExportApp({ rootDir, env })
    ];

    for (const app of apps) {
      await app.close();
    }
  });

  it("rejects an invalid hosted default business ID before any service starts", () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-hosted-business-id-"));
    const env = {
      ...hostedWithoutSecret,
      CATERING_TRUSTED_ACTOR_SECRET: "test-only-hosted-secret",
      CATERING_DEFAULT_BUSINESS_ID: "INVALID BUSINESS ID"
    };
    const builders: Array<[string, () => unknown]> = [
      ["intake", () => buildIntakeApp({ rootDir, env })],
      ["offer", () => buildOfferApp({ rootDir, env })],
      ["production", () => buildProductionApp({ dataRoot: rootDir, env })],
      ["print export", () => buildPrintExportApp({ rootDir, env })]
    ];

    for (const [name, build] of builders) {
      expect(build, name).toThrow("Ungültige Betriebskennung.");
    }
  });
});
