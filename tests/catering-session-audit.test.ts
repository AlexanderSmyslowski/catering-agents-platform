import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import type { OutgoingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  hashCateringPin,
  type MinimalMvpRole
} from "../shared-core/src/index.js";

const businessContext = { businessId: "the-one" } as const;
const rootSecret = "catering-session-audit-root-secret-123456";
const sessionEnv = {
  CATERING_DEFAULT_BUSINESS_ID: businessContext.businessId,
  CATERING_TRUSTED_ACTOR_SECRET: rootSecret,
  CATERING_DEV_AUTH: "0"
};
const dataRoots: string[] = [];

interface UserFixture {
  userId: string;
  loginCode: string;
  displayName: string;
  pin: string;
  role: MinimalMvpRole;
}

const productionUser: UserFixture = {
  userId: "session-audit-production-user",
  loginCode: "prod-login-private",
  displayName: "Produktion Audit-Test",
  pin: "592731",
  role: "production_operator"
};
const adminUser: UserFixture = {
  userId: "session-audit-admin-user",
  loginCode: "admin-login-private",
  displayName: "Admin Audit-Test",
  pin: "482731",
  role: "admin"
};

function createDataRoot(): string {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-session-audit-"));
  dataRoots.push(rootDir);
  return rootDir;
}

function cookieFrom(headers: OutgoingHttpHeaders): string {
  const setCookie = headers["set-cookie"];
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof value !== "string") throw new Error("Login hat kein Sitzungscookie geliefert.");
  return value.split(";", 1)[0] ?? "";
}

async function createUser(store: CateringUserStore, fixture: UserFixture): Promise<string> {
  const record = createCateringUserRecord({
    businessId: businessContext.businessId,
    userId: fixture.userId,
    loginCode: fixture.loginCode,
    displayName: fixture.displayName,
    pinHash: await hashCateringPin(fixture.pin),
    role: fixture.role,
    active: true,
    now: new Date("2026-08-28T10:00:00.000Z")
  });
  expect(await store.create(businessContext, record)).toBe("created");
  return record.pinHash;
}

async function loginCookie(
  app: ReturnType<typeof buildIntakeApp>,
  fixture: UserFixture
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: { host: "catering.test", origin: "https://catering.test" },
    payload: { loginCode: fixture.loginCode, pin: fixture.pin }
  });
  expect(response.statusCode, response.body).toBe(200);
  return cookieFrom(response.headers);
}

function sessionHeaders(cookie: string): Record<string, string> {
  return {
    cookie,
    host: "catering.test",
    origin: "https://catering.test"
  };
}

afterEach(() => {
  for (const rootDir of dataRoots.splice(0)) {
    try {
      execFileSync("/usr/bin/trash", [rootDir], { stdio: "ignore" });
    } catch {
      // Testdaten liegen außerhalb des Repositorys; fehlendes Trash darf den Vertragsnachweis nicht maskieren.
    }
  }
});

describe("Catering Session-Audit", () => {
  it("persistiert für eine Produktionsentscheidung exakt die konkrete Session-userId ohne Auth-Geheimnisse", async () => {
    const rootDir = createDataRoot();
    const userStore = new CateringUserStore({ rootDir });
    const productionPinHash = await createUser(userStore, productionUser);
    const adminPinHash = await createUser(userStore, adminUser);
    const intake = buildIntakeApp({ rootDir, userStore, env: sessionEnv });
    const production = buildProductionApp({ dataRoot: rootDir, userStore, env: sessionEnv });

    try {
      const productionCookie = await loginCookie(intake, productionUser);
      const adminCookie = await loginCookie(intake, adminUser);
      const created = await production.inject({
        method: "POST",
        url: "/v1/production/feedback-drafts",
        headers: sessionHeaders(productionCookie),
        payload: {
          target: { specId: "spec-session-audit" },
          feedback: {
            summary: "Operative Rückmeldung zur Produktionsausgabe.",
            observations: ["Die Ausgabe war vollständig vorbereitet."],
            changeRequests: ["Warmhaltebehälter früher bereitstellen."]
          }
        }
      });
      expect(created.statusCode, created.body).toBe(201);
      const feedbackId = created.json<{ draft: { feedbackId: string } }>().draft.feedbackId;

      const auditResponse = await production.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=20",
        headers: sessionHeaders(adminCookie)
      });
      expect(auditResponse.statusCode, auditResponse.body).toBe(200);
      const items = auditResponse.json<{ items: Array<Record<string, unknown>> }>().items;
      const entry = items.find((item) =>
        item.action === "production.feedback_draft_created" && item.entityId === feedbackId
      );
      expect(entry).toBeDefined();
      expect(entry?.actor).toEqual({
        name: productionUser.userId,
        source: "authenticated-session"
      });

      const serialized = JSON.stringify(entry);
      for (const forbidden of [
        productionUser.pin,
        adminUser.pin,
        productionPinHash,
        adminPinHash,
        productionUser.loginCode,
        adminUser.loginCode,
        productionCookie,
        adminCookie,
        "__Host-catering_session",
        rootSecret
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    } finally {
      await Promise.all([production.close(), intake.close()]);
    }
  });
});
