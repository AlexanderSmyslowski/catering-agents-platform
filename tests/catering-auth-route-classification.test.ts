import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildIntakeApp } from "../intake-service/src/index.js";
import { buildOfferApp } from "../offer-service/src/index.js";
import { buildProductionApp } from "../production-service/src/index.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import {
  classifyCateringRouteAuth,
  type CateringServiceTarget
} from "../shared-core/src/catering-request-auth.js";

const apps: Array<{ close: () => Promise<unknown> }> = [];
const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const sessionEnv = {
  CATERING_DEFAULT_BUSINESS_ID: "the-one",
  CATERING_TRUSTED_ACTOR_SECRET: "task-four-route-classification-secret-123456",
  CATERING_DEV_AUTH: "0"
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function dataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-task4-routes-"));
}

function registeredPathsForMethod(
  app: { printRoutes: (options: { commonPrefix: false; method: (typeof methods)[number] }) => string },
  method: (typeof methods)[number]
): string[] {
  const parents: string[] = [];
  const paths: string[] = [];
  for (const line of app.printRoutes({ commonPrefix: false, method }).split("\n")) {
    const markerIndex = Math.max(line.indexOf("├── "), line.indexOf("└── "));
    if (markerIndex < 0) continue;
    const depth = markerIndex / 4;
    const segment = line.slice(markerIndex + 4).replace(/ \([^)]*\)$/, "");
    const fullPath = segment.startsWith("/") && depth === 0
      ? segment
      : `${parents[depth - 1] ?? ""}${segment}`;
    parents[depth] = fullPath;
    parents.length = depth + 1;
    if (fullPath.startsWith("/v1/")) paths.push(fullPath);
  }
  return paths;
}

describe("Catering route authentication classification", () => {
  it("classifies every registered /v1 route after all four apps are ready", async () => {
    const rootDir = dataRoot();
    const built = [
      ["intake-service", buildIntakeApp({ rootDir, env: sessionEnv })],
      ["offer-service", buildOfferApp({ rootDir, env: sessionEnv })],
      ["production-service", buildProductionApp({ dataRoot: rootDir, env: sessionEnv })],
      ["print-export", buildPrintExportApp({ rootDir, env: sessionEnv })]
    ] as const;
    apps.push(...built.map(([, app]) => app));
    await Promise.all(built.map(([, app]) => app.ready()));

    for (const [targetService, app] of built) {
      for (const method of methods) {
        for (const routePath of registeredPathsForMethod(app, method)) {
          expect(
            classifyCateringRouteAuth({ targetService, method, pathname: routePath }),
            `${targetService} ${method} ${routePath}`
          ).not.toBe("deny");
        }
      }
    }
  });

  it.each([
    ["production-service", "GET", "/v1/production/cases/:caseId/quantity-workflow"],
    ["production-service", "POST", "/v1/production/cases/:caseId/quantity-workflow/:componentId/preview"],
    ["production-service", "POST", "/v1/production/cases/:caseId/quantity-workflow/:componentId/confirm"],
    ["print-export", "GET", "/v1/exports/production-folders/:planId/html"]
  ] as const)("keeps the historically omitted route protected: %s %s %s", (targetService, method, pathname) => {
    expect(classifyCateringRouteAuth({ targetService, method, pathname })).toBe("protected-session");
  });

  it("fails closed for an unknown /v1 route and never broadens an internal route", () => {
    expect(classifyCateringRouteAuth({
      targetService: "offer-service",
      method: "DELETE",
      pathname: "/v1/offers/future-unclassified-route"
    })).toBe("protected-session");
    expect(classifyCateringRouteAuth({
      targetService: "intake-service",
      method: "GET",
      pathname: "/v1/intake/internal/specs/:specId"
    })).toBe("internal-service");
    expect(classifyCateringRouteAuth({
      targetService: "intake-service",
      method: "POST",
      pathname: "/v1/intake/internal/specs/:specId"
    })).toBe("protected-session");
    expect(classifyCateringRouteAuth({
      targetService: "offer-service" as CateringServiceTarget,
      method: "GET",
      pathname: "/not-a-product-route"
    })).toBe("deny");
  });

  it("classifies Intake login as public while session and logout remain cookie-protected", () => {
    expect(classifyCateringRouteAuth({
      targetService: "intake-service",
      method: "POST",
      pathname: "/v1/auth/login"
    })).toBe("public-auth");
    expect(classifyCateringRouteAuth({
      targetService: "intake-service",
      method: "GET",
      pathname: "/v1/auth/session"
    })).toBe("protected-session");
    expect(classifyCateringRouteAuth({
      targetService: "intake-service",
      method: "POST",
      pathname: "/v1/auth/logout"
    })).toBe("protected-session");
  });
});
