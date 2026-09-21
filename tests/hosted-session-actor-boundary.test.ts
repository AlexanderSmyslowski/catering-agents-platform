import { mkdtempSync } from "node:fs";
import type { OutgoingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildIntakeApp, IntakeStore } from "../intake-service/src/index.js";
import { buildOfferApp, OfferStore } from "../offer-service/src/index.js";
import { buildProductionApp, ProductionStore } from "../production-service/src/index.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  hashCateringPin,
  RecipeLibrary
} from "../shared-core/src/index.js";

const businessId = "the-one";
const rootSecret = "task-four-session-root-secret-123456789";
const sessionEnv = {
  CATERING_DEFAULT_BUSINESS_ID: businessId,
  CATERING_TRUSTED_ACTOR_SECRET: rootSecret,
  CATERING_DEV_AUTH: "0"
};
const historicalHeaders = {
  "x-actor-name": "Administrator",
  "x-catering-actor-name": "Administrator",
  "x-catering-business-id": businessId,
  "x-catering-trusted-secret": rootSecret,
  "x-auth-request-user": "forged-visitor",
  "x-auth-request-role": "admin",
  "x-forwarded-user": "forged-visitor"
};
const apps: Array<{ close: () => Promise<unknown> }> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function rootDir(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-task4-boundary-"));
}

function cookieFrom(headers: OutgoingHttpHeaders): string {
  const setCookie = headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof raw !== "string") throw new Error("Login hat kein Cookie geliefert.");
  return raw.split(";", 1)[0] ?? "";
}

async function sessionFixture(role: "admin" | "production_operator" = "production_operator") {
  const dataRoot = rootDir();
  const userStore = new CateringUserStore({ rootDir: dataRoot });
  const loginCode = role === "admin" ? "admin" : "production";
  const pin = role === "admin" ? "482731" : "592731";
  const user = createCateringUserRecord({
    businessId,
    userId: role === "admin" ? "user-admin" : "user-production",
    loginCode,
    displayName: role === "admin" ? "Admin Test" : "Produktion Test",
    pinHash: await hashCateringPin(pin),
    role,
    active: true,
    now: new Date("2026-08-28T10:00:00.000Z")
  });
  expect(await userStore.create({ businessId }, user)).toBe("created");

  const intake = buildIntakeApp({ rootDir: dataRoot, userStore, env: sessionEnv });
  apps.push(intake);
  const login = await intake.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: { host: "catering.test", origin: "https://catering.test" },
    payload: { loginCode, pin }
  });
  expect(login.statusCode).toBe(200);

  return {
    intake,
    dataRoot,
    userStore,
    cookie: cookieFrom(login.headers)
  };
}

describe("hosted session actor boundary", () => {
  it("rejects every historical human header before any store access in all four apps", async () => {
    const dataRoot = rootDir();
    const intakeRead = vi.spyOn(IntakeStore.prototype, "listRequests");
    const offerRead = vi.spyOn(RecipeLibrary.prototype, "list");
    const productionRead = vi.spyOn(ProductionStore.prototype, "getPlan");
    const exportRead = vi.spyOn(OfferStore.prototype, "getDraft");
    const intake = buildIntakeApp({ rootDir: dataRoot, env: sessionEnv });
    const offer = buildOfferApp({ rootDir: dataRoot, env: sessionEnv });
    const production = buildProductionApp({ dataRoot, env: sessionEnv });
    const print = buildPrintExportApp({ rootDir: dataRoot, env: sessionEnv });
    apps.push(intake, offer, production, print);

    const responses = await Promise.all([
      intake.inject({ method: "GET", url: "/v1/intake/requests", headers: historicalHeaders }),
      offer.inject({ method: "GET", url: "/v1/offers/recipes", headers: historicalHeaders }),
      production.inject({ method: "GET", url: "/v1/production/plans/missing", headers: historicalHeaders }),
      print.inject({ method: "GET", url: "/v1/exports/offers/missing/html", headers: historicalHeaders })
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401, 401]);
    expect(intakeRead).not.toHaveBeenCalled();
    expect(offerRead).not.toHaveBeenCalled();
    expect(productionRead).not.toHaveBeenCalled();
    expect(exportRead).not.toHaveBeenCalled();
  });

  it("rejects a valid Bearer token without its cookie in all four apps", async () => {
    const { intake, dataRoot, userStore, cookie } = await sessionFixture();
    const token = cookie.split("=", 2)[1] ?? "";
    const headers = { authorization: `Bearer ${token}` };
    const intakeRead = vi.spyOn(IntakeStore.prototype, "listRequests");
    const offerRead = vi.spyOn(RecipeLibrary.prototype, "list");
    const productionRead = vi.spyOn(ProductionStore.prototype, "getPlan");
    const exportRead = vi.spyOn(OfferStore.prototype, "getDraft");
    const offer = buildOfferApp({ rootDir: dataRoot, userStore, env: sessionEnv });
    const production = buildProductionApp({ dataRoot, userStore, env: sessionEnv });
    const print = buildPrintExportApp({ rootDir: dataRoot, userStore, env: sessionEnv });
    apps.push(offer, production, print);

    const responses = await Promise.all([
      intake.inject({ method: "GET", url: "/v1/intake/requests", headers }),
      offer.inject({ method: "GET", url: "/v1/offers/recipes", headers }),
      production.inject({ method: "GET", url: "/v1/production/plans/missing", headers }),
      print.inject({ method: "GET", url: "/v1/exports/production-plans/missing/html", headers })
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401, 401]);
    expect(intakeRead).not.toHaveBeenCalled();
    expect(offerRead).not.toHaveBeenCalled();
    expect(productionRead).not.toHaveBeenCalled();
    expect(exportRead).not.toHaveBeenCalled();
  });

  it("accepts the exact Intake cookie unchanged in Offer, Production and Print while forged headers cannot elevate it", async () => {
    const { dataRoot, userStore, cookie } = await sessionFixture();
    const offer = buildOfferApp({ rootDir: dataRoot, userStore, env: sessionEnv });
    const production = buildProductionApp({ dataRoot, userStore, env: sessionEnv });
    const print = buildPrintExportApp({ rootDir: dataRoot, userStore, env: sessionEnv });
    apps.push(offer, production, print);
    const forgedAdminHeaders = { ...historicalHeaders, cookie };

    const [offerResponse, productionResponse, productionExport, commercialExport] = await Promise.all([
      offer.inject({ method: "GET", url: "/v1/offers/recipes", headers: forgedAdminHeaders }),
      production.inject({ method: "GET", url: "/v1/production/plans/missing", headers: forgedAdminHeaders }),
      print.inject({ method: "GET", url: "/v1/exports/production-plans/missing/html", headers: forgedAdminHeaders }),
      print.inject({ method: "GET", url: "/v1/exports/offers/missing/html", headers: forgedAdminHeaders })
    ]);

    expect(offerResponse.statusCode).toBe(403);
    expect(productionResponse.statusCode).toBe(404);
    expect(productionExport.statusCode).toBe(404);
    expect(commercialExport.statusCode).toBe(403);
  });

  it("rejects cookie-authenticated product mutations without a matching HTTPS Origin", async () => {
    const { dataRoot, userStore, cookie } = await sessionFixture("admin");
    const offer = buildOfferApp({ rootDir: dataRoot, userStore, env: sessionEnv });
    const production = buildProductionApp({ dataRoot, userStore, env: sessionEnv });
    apps.push(offer, production);
    const headers = {
      cookie,
      host: "catering.test",
      origin: "https://foreign.test"
    };

    const responses = await Promise.all([
      offer.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers,
        payload: {
          customerName: "Cross origin",
          eventTypeLabel: "Empfang",
          eventDate: "2026-09-01",
          attendeeCount: 10
        }
      }),
      production.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers,
        payload: {
          customerName: "Cross origin",
          eventTypeLabel: "Empfang",
          eventDate: "2026-09-01",
          attendeeCount: 10
        }
      }),
      offer.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: { cookie, host: "catering.test" },
        payload: {
          customerName: "Missing origin",
          eventTypeLabel: "Empfang",
          eventDate: "2026-09-01",
          attendeeCount: 10
        }
      })
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([403, 403, 403]);
  });
});
