import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildIntakeApp, IntakeStore } from "../intake-service/src/index.js";
import { buildOfferApp } from "../offer-service/src/index.js";
import { buildProductionApp } from "../production-service/src/index.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  createEventRequestFromText,
  hashCateringPin
} from "../shared-core/src/index.js";

const businessId = "the-one";
const rootSecret = "task-four-service-principal-secret-123456";
const env = {
  CATERING_DEFAULT_BUSINESS_ID: businessId,
  CATERING_TRUSTED_ACTOR_SECRET: rootSecret,
  CATERING_DEV_AUTH: "0"
};
const apps: Array<{ close: () => Promise<unknown> }> = [];

type Method = "GET" | "POST" | "PUT" | "PATCH";
type ServiceName = "Offer-Service" | "Production-Service";

interface InternalTriple {
  target: "intake" | "offer";
  service: ServiceName;
  method: "GET" | "PUT";
  path: string;
}

const triples: readonly InternalTriple[] = [
  { target: "intake", service: "Offer-Service", method: "GET", path: "/v1/intake/internal/requests/missing-request" },
  { target: "intake", service: "Offer-Service", method: "GET", path: "/v1/intake/internal/source-documents/missing-document" },
  { target: "intake", service: "Offer-Service", method: "GET", path: "/v1/intake/internal/specs/missing-spec" },
  { target: "intake", service: "Production-Service", method: "GET", path: "/v1/intake/internal/requests/missing-request" },
  { target: "intake", service: "Production-Service", method: "GET", path: "/v1/intake/internal/specs/missing-spec" },
  { target: "intake", service: "Production-Service", method: "GET", path: "/v1/intake/internal/source-documents/missing-document" },
  { target: "intake", service: "Production-Service", method: "GET", path: "/v1/intake/internal/source-documents/missing-document/content" },
  { target: "intake", service: "Production-Service", method: "PUT", path: "/v1/intake/internal/specs/missing-spec" },
  { target: "intake", service: "Production-Service", method: "PUT", path: "/v1/intake/internal/specs/missing-spec/replacement" },
  { target: "offer", service: "Production-Service", method: "GET", path: "/v1/offers/handoffs/missing-handoff" }
];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function dataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-task4-service-"));
}

function serviceHeaders(service: string, secret = rootSecret) {
  return {
    "x-catering-actor-name": service,
    "x-catering-trusted-secret": secret,
    // The receiver must bind the principal to its configured business instead of this value.
    "x-catering-business-id": "forged-other-business"
  };
}

function neighboringMethod(method: InternalTriple["method"]): Method {
  return method === "GET" ? "POST" : "PATCH";
}

describe("narrow internal service principals", () => {
  it("accepts exactly the ten approved method/path/service triples", async () => {
    const rootDir = dataRoot();
    const intake = buildIntakeApp({ rootDir, env });
    const offer = buildOfferApp({ rootDir, env });
    apps.push(intake, offer);

    for (const triple of triples) {
      const app = triple.target === "intake" ? intake : offer;
      const response = await app.inject({
        method: triple.method,
        url: triple.path,
        headers: serviceHeaders(triple.service),
        ...(triple.method === "PUT" ? { payload: {} } : {})
      });
      expect(response.statusCode, `${triple.service} ${triple.method} ${triple.path}`).not.toBe(401);
      expect(response.statusCode, `${triple.service} ${triple.method} ${triple.path}`).not.toBe(403);
    }
  });

  it("fails closed for every neighboring method, path and service name", async () => {
    const rootDir = dataRoot();
    const intake = buildIntakeApp({ rootDir, env });
    const offer = buildOfferApp({ rootDir, env });
    apps.push(intake, offer);

    for (const triple of triples) {
      const app = triple.target === "intake" ? intake : offer;
      const attempts = [
        { method: neighboringMethod(triple.method), url: triple.path, headers: serviceHeaders(triple.service) },
        { method: triple.method, url: `${triple.path}/neighbor`, headers: serviceHeaders(triple.service) },
        { method: triple.method, url: triple.path, headers: serviceHeaders(`${triple.service}-Neighbor`) }
      ];
      for (const attempt of attempts) {
        const response = await app.inject({
          method: attempt.method,
          url: attempt.url,
          headers: attempt.headers,
          ...((attempt.method === "PUT" || attempt.method === "PATCH") ? { payload: {} } : {})
        });
        expect(response.statusCode, `${attempt.method} ${attempt.url}`).toBe(401);
      }
    }
  });

  it("binds an accepted service principal to the configured business and ignores browser identity headers", async () => {
    const rootDir = dataRoot();
    const store = new IntakeStore({ rootDir });
    const request = createEventRequestFromText({
      requestId: "configured-business-request",
      channel: "text",
      rawText: "Interner Testauftrag für 20 Personen"
    });
    await store.saveRequest({ businessId }, request);
    const intake = buildIntakeApp({ rootDir, store, env });
    apps.push(intake);

    const accepted = await intake.inject({
      method: "GET",
      url: `/v1/intake/internal/requests/${request.requestId}`,
      headers: serviceHeaders("Offer-Service")
    });
    const browserHeaders = await intake.inject({
      method: "GET",
      url: `/v1/intake/internal/requests/${request.requestId}`,
      headers: {
        "x-catering-actor-name": "Offer-Service",
        "x-auth-request-user": "browser@example.test",
        "x-catering-business-id": businessId
      }
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json<{ eventRequest: { requestId: string } }>().eventRequest.requestId).toBe(request.requestId);
    expect(browserHeaders.statusCode).toBe(401);
  });

  it("never grants a service principal a public human create, decision or export capability", async () => {
    const rootDir = dataRoot();
    const intake = buildIntakeApp({ rootDir, env });
    const offer = buildOfferApp({ rootDir, env });
    const production = buildProductionApp({ dataRoot: rootDir, env });
    const print = buildPrintExportApp({ rootDir, env });
    apps.push(intake, offer, production, print);

    const responses = await Promise.all([
      intake.inject({
        method: "POST",
        url: "/v1/intake/normalize",
        headers: serviceHeaders("Offer-Service"),
        payload: { text: "Nicht erlaubter Browserpfad" }
      }),
      offer.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: serviceHeaders("Production-Service"),
        payload: { customerName: "Nicht erlaubt" }
      }),
      production.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers: serviceHeaders("Production-Service"),
        payload: { customerName: "Nicht erlaubt" }
      }),
      print.inject({
        method: "GET",
        url: "/v1/exports/offers/missing/html",
        headers: serviceHeaders("Production-Service")
      })
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401, 401]);
  });

  it("never treats a session userId that equals a service name as an internal principal", async () => {
    const rootDir = dataRoot();
    const userStore = new CateringUserStore({ rootDir });
    expect(await userStore.create({ businessId }, createCateringUserRecord({
      businessId,
      userId: "Production-Service",
      loginCode: "service-lookalike",
      displayName: "Menschlicher Testbenutzer",
      pinHash: await hashCateringPin("482731"),
      role: "admin",
      active: true,
      now: new Date("2026-08-28T10:00:00.000Z")
    }))).toBe("created");
    const intake = buildIntakeApp({ rootDir, userStore, env });
    apps.push(intake);
    const login = await intake.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { host: "catering.test", origin: "https://catering.test" },
      payload: { loginCode: "service-lookalike", pin: "482731" }
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers["set-cookie"];
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (typeof rawCookie !== "string") throw new Error("Login hat kein Cookie geliefert.");

    const response = await intake.inject({
      method: "GET",
      url: "/v1/intake/internal/specs/missing-spec",
      headers: { cookie: rawCookie.split(";", 1)[0] ?? "" }
    });

    expect(response.statusCode).toBe(401);
  });

  it("keeps Offer handoff dual-use for Offer sessions without accepting a service-name session collision", async () => {
    const rootDir = dataRoot();
    const userStore = new CateringUserStore({ rootDir });
    for (const input of [
      { userId: "user-admin", loginCode: "admin", role: "admin" as const, pin: "482731" },
      { userId: "Production-Service", loginCode: "collision", role: "production_operator" as const, pin: "592731" }
    ]) {
      expect(await userStore.create({ businessId }, createCateringUserRecord({
        businessId,
        userId: input.userId,
        loginCode: input.loginCode,
        displayName: input.loginCode,
        pinHash: await hashCateringPin(input.pin),
        role: input.role,
        active: true,
        now: new Date("2026-08-28T10:00:00.000Z")
      }))).toBe("created");
    }
    const intake = buildIntakeApp({ rootDir, userStore, env });
    const offer = buildOfferApp({ rootDir, userStore, env });
    apps.push(intake, offer);

    const loginCookie = async (loginCode: string, pin: string): Promise<string> => {
      const login = await intake.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: { host: "catering.test", origin: "https://catering.test" },
        payload: { loginCode, pin }
      });
      expect(login.statusCode).toBe(200);
      const setCookie = login.headers["set-cookie"];
      const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      if (typeof rawCookie !== "string") throw new Error("Login hat kein Cookie geliefert.");
      return rawCookie.split(";", 1)[0] ?? "";
    };
    const [adminCookie, collisionCookie] = await Promise.all([
      loginCookie("admin", "482731"),
      loginCookie("collision", "592731")
    ]);

    const [adminResponse, collisionResponse] = await Promise.all([
      offer.inject({ method: "GET", url: "/v1/offers/handoffs/missing", headers: { cookie: adminCookie } }),
      offer.inject({ method: "GET", url: "/v1/offers/handoffs/missing", headers: { cookie: collisionCookie } })
    ]);

    expect(adminResponse.statusCode).toBe(404);
    expect(collisionResponse.statusCode).toBe(403);
  });
});
