import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import type { OutgoingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildIntakeApp } from "../intake-service/src/app.js";
import {
  CATERING_SESSION_COOKIE,
  cateringSessionBinding,
  deriveCateringAuthKeys,
  isCateringSessionMode
} from "../shared-core/src/catering-session-auth.js";
import { hashCateringPin } from "../shared-core/src/catering-pin-crypto.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  type CateringUserRecord
} from "../shared-core/src/catering-user-store.js";
import type { BusinessContext } from "../shared-core/src/business-context.js";

const context: BusinessContext = { businessId: "the-one" };
const rootSecret = "catering-session-test-root-secret-123456";
const sameOriginHeaders = {
  host: "catering.test",
  origin: "https://catering.test"
};
const apps: Array<{ close: () => Promise<unknown> }> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function dataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-session-auth-"));
}

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signedJwt(secret: Buffer, claims: Record<string, unknown>): string {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson(claims);
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`, "utf8")
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function cookieValue(response: { headers: OutgoingHttpHeaders }): string {
  const setCookie = response.headers["set-cookie"];
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof header !== "string") throw new Error("Die Loginantwort hat kein Sitzungs-Cookie gesetzt.");
  return header.split(";", 1)[0] ?? "";
}

function cookieHeader(token: string): Record<string, string> {
  return { cookie: `${CATERING_SESSION_COOKIE}=${token}` };
}

async function userFor(
  store: CateringUserStore,
  input: { userId?: string; loginCode?: string; displayName?: string; role?: CateringUserRecord["role"]; active?: boolean } = {}
): Promise<CateringUserRecord> {
  const record = createCateringUserRecord({
    businessId: context.businessId,
    userId: input.userId ?? "user-admin",
    loginCode: input.loginCode ?? "admin",
    displayName: input.displayName ?? "Admin Test",
    pinHash: await hashCateringPin("482731"),
    role: input.role ?? "admin",
    active: input.active ?? true,
    now: new Date("2026-08-28T10:00:00.000Z")
  });
  expect(await store.create(context, record)).toBe("created");
  const persisted = await store.getById(context, record.userId);
  if (!persisted) throw new Error("Der Testbenutzer wurde nicht gespeichert.");
  return persisted;
}

async function fixture(input: Parameters<typeof userFor>[1] = {}) {
  const rootDir = dataRoot();
  const userStore = new CateringUserStore({ rootDir });
  const user = await userFor(userStore, input);
  const app = buildIntakeApp({
    rootDir,
    userStore,
    env: {
      CATERING_DEFAULT_BUSINESS_ID: context.businessId,
      CATERING_TRUSTED_ACTOR_SECRET: rootSecret
    }
  });
  apps.push(app);
  return { app, user, userStore };
}

function tokenFor(user: CateringUserRecord, overrides: Record<string, unknown> = {}): string {
  const keys = deriveCateringAuthKeys(rootSecret);
  const now = Math.floor(Date.now() / 1_000);
  return signedJwt(keys.jwtKey, {
    sub: user.userId,
    sessionBinding: cateringSessionBinding({ userId: user.userId, authEpoch: user.authEpoch }, keys.bindingKey),
    iat: now - 1,
    exp: now + 60 * 60,
    iss: "catering-agents-platform",
    aud: "catering-backoffice",
    ...overrides
  });
}

async function login(
  app: ReturnType<typeof buildIntakeApp>,
  body: { loginCode?: string; pin?: string } = { loginCode: "admin", pin: "482731" },
  headers: Record<string, string> = sameOriginHeaders
) {
  return app.inject({ method: "POST", url: "/v1/auth/login", headers, payload: body });
}

describe("Catering Session-Authentifizierung", () => {
  it("aktiviert den Sessionmodus fail-closed und leitet getrennte Schlüssel aus einem starken Root-Secret ab", () => {
    // This fails if a missing Dev opt-in ever re-enables header authentication or key domains collapse into one secret.
    expect(isCateringSessionMode({})).toBe(true);
    expect(isCateringSessionMode({ CATERING_DEV_AUTH: "1" })).toBe(false);
    expect(isCateringSessionMode({ CATERING_DEV_AUTH: "true" })).toBe(true);
    expect(isCateringSessionMode({ CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_DEV_AUTH: "1" })).toBe(true);
    expect(() => deriveCateringAuthKeys("zu-kurz")).toThrow();

    const keys = deriveCateringAuthKeys(rootSecret);
    expect(keys.jwtKey).toHaveLength(32);
    expect(keys.bindingKey).toHaveLength(32);
    expect(keys.rateLimitKey).toHaveLength(32);
    expect(keys.jwtKey.equals(keys.bindingKey)).toBe(false);
    expect(keys.jwtKey.equals(keys.rateLimitKey)).toBe(false);
    expect(keys.bindingKey.equals(keys.rateLimitKey)).toBe(false);
  });

  it("projiziert im expliziten lokalen Dev-Modus den serverseitig aufgelösten Proxy-Actor als Sitzung", async () => {
    const app = buildIntakeApp({
      rootDir: dataRoot(),
      env: {
        CATERING_DEFAULT_BUSINESS_ID: context.businessId,
        CATERING_TRUSTED_ACTOR_SECRET: rootSecret,
        CATERING_DEV_AUTH: "1"
      }
    });
    apps.push(app);

    const trustedDevHeaders = {
      "x-catering-trusted-secret": rootSecret,
      "x-catering-actor-name": "Intake-Mitarbeiter",
      "x-catering-business-id": context.businessId
    };
    const [response, loginResponse, logoutResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/v1/auth/session", headers: trustedDevHeaders }),
      app.inject({ method: "POST", url: "/v1/auth/login", headers: trustedDevHeaders }),
      app.inject({ method: "POST", url: "/v1/auth/logout", headers: trustedDevHeaders })
    ]);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authenticated: true,
      user: {
        userId: "Intake-Mitarbeiter",
        displayName: "Intake-Mitarbeiter"
      },
      access: { capabilities: ["intake"] }
    });
    expect([loginResponse.statusCode, logoutResponse.statusCode]).toEqual([404, 404]);
  });

  it("lässt das Hosted-Profil auch bei gesetztem Dev-Flag niemals auf die Proxy-Sessionprojektion zurückfallen", async () => {
    const app = buildIntakeApp({
      rootDir: dataRoot(),
      env: {
        CATERING_DEFAULT_BUSINESS_ID: context.businessId,
        CATERING_TRUSTED_ACTOR_SECRET: rootSecret,
        CATERING_DEPLOYMENT_PROFILE: "hosted",
        CATERING_DEV_AUTH: "1"
      }
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: {
        "x-catering-trusted-secret": rootSecret,
        "x-catering-actor-name": "Administrator",
        "x-catering-business-id": context.businessId
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Ungültige Sitzung." });
  });

  it("setzt nur das sichere Host-Cookie und gibt nie Token oder Credentialdaten zurück", async () => {
    // This fails if a browser-readable token, a non-host cookie, or credential fields reach the client.
    const { app, user } = await fixture();
    const response = await login(app);

    expect(response.statusCode).toBe(200);
    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toContain(`${CATERING_SESSION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toMatch(/(?:^|;)\s*Domain=/i);
    expect(response.json()).toEqual({
      authenticated: true,
      user: { userId: user.userId, displayName: user.displayName },
      access: { capabilities: ["intake", "offer", "production", "production_read", "operations_audit", "commercial"] }
    });
    expect(response.json()).not.toHaveProperty("token");
    expect(response.json()).not.toHaveProperty("role");
    expect(JSON.stringify(response.json())).not.toContain('"role"');
    expect(JSON.stringify(response.json())).not.toContain('"loginCode"');
    expect(JSON.stringify(response.json())).not.toContain('"pinHash"');
    expect(JSON.stringify(response.json())).not.toContain("482731");
  });

  it("enthält im Cookie-JWT nur die erlaubten Claims", async () => {
    // This fails if role, login code, display name, PIN data, or business context leak into a signed browser claim.
    const { app } = await fixture();
    const response = await login(app);
    const token = cookieValue(response).split("=", 2)[1] ?? "";
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "iss", "sessionBinding", "sub"]);
    expect(payload.iss).toBe("catering-agents-platform");
    expect(payload.aud).toBe("catering-backoffice");
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("loginCode");
    expect(payload).not.toHaveProperty("displayName");
    expect(payload).not.toHaveProperty("pinHash");
    expect(payload).not.toHaveProperty("businessId");
  });

  it("akzeptiert keinen gültigen Bearer-Token ohne Cookie und keinen Actor-Header als Fallback", async () => {
    // This fails if jwtVerify falls back to Authorization or a historical actor header restores an identity.
    const { app } = await fixture();
    const loginResponse = await login(app);
    const token = cookieValue(loginResponse).split("=", 2)[1] ?? "";

    const [bearer, headerOnly] = await Promise.all([
      app.inject({ method: "GET", url: "/v1/auth/session", headers: { authorization: `Bearer ${token}` } }),
      app.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: { "x-actor-name": "Administrator", "x-catering-actor-name": "Administrator" }
      })
    ]);

    expect(bearer.statusCode).toBe(401);
    expect(headerOnly.statusCode).toBe(401);
  });

  it.each([
    ["falscher Issuer", { iss: "not-catering" }],
    ["falsche Audience", { aud: "not-backoffice" }],
    ["abgelaufene Laufzeit", { exp: Math.floor(Date.now() / 1_000) - 1 }],
    ["falsches Binding", { sessionBinding: "wrong-binding" }]
  ])("weist ein Cookie mit %s zurück", async (_caseName, overrides) => {
    // This fails if any signature-adjacent JWT claim or the current session binding is not verified.
    const { app, user } = await fixture();
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: cookieHeader(tokenFor(user, overrides))
    });

    expect(response.statusCode).toBe(401);
  });

  it("weist fehlende Subjects, inaktive Benutzer und generisch fehlerhafte Anmeldungen zurück", async () => {
    // This fails if a JWT subject can outlive its server record or login failures disclose account state.
    const { app, user, userStore } = await fixture();
    const inactive = await userStore.updateSecurity(context, user, { active: false }, new Date("2026-08-28T10:01:00.000Z"));
    if (inactive.kind !== "updated") throw new Error("Inaktiv-Testzustand konnte nicht erstellt werden.");

    const missingSubject = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: cookieHeader(tokenFor({ ...inactive.user, userId: "missing-user" }))
    });
    const inactiveSession = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: cookieHeader(tokenFor(inactive.user))
    });
    const [unknownLogin, wrongPinLogin, inactiveLogin] = await Promise.all([
      login(app, { loginCode: "missing", pin: "482731" }),
      login(app, { loginCode: "admin", pin: "000000" }),
      login(app)
    ]);

    expect(missingSubject.statusCode).toBe(401);
    expect(inactiveSession.statusCode).toBe(401);
    expect([unknownLogin.statusCode, wrongPinLogin.statusCode, inactiveLogin.statusCode]).toEqual([401, 401, 401]);
    expect([unknownLogin.json(), wrongPinLogin.json(), inactiveLogin.json()]).toEqual([
      unknownLogin.json(),
      unknownLogin.json(),
      unknownLogin.json()
    ]);
  });

  it("invalidiert eine Sitzung bei Rollen- oder PIN-Wechsel durch die aktuelle authEpoch", async () => {
    // This fails if a claim-held role or stale binding remains usable after either security mutation.
    const { app, user, userStore } = await fixture();
    const loginResponse = await login(app);
    const cookie = cookieValue(loginResponse);
    const current = await userStore.getById(context, user.userId);
    if (!current) throw new Error("Aktueller Benutzer wurde nicht gefunden.");
    const roleChange = await userStore.updateSecurity(context, current, { role: "production_operator" }, new Date("2026-08-28T10:01:00.000Z"));
    if (roleChange.kind !== "updated") throw new Error("Rollenwechsel konnte nicht erstellt werden.");

    const staleAfterRole = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie }
    });
    const pinChange = await userStore.updateSecurity(
      context,
      roleChange.user,
      { pinHash: await hashCateringPin("111111") },
      new Date("2026-08-28T10:02:00.000Z")
    );
    if (pinChange.kind !== "updated") throw new Error("PIN-Wechsel konnte nicht erstellt werden.");
    const staleAfterPin = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie }
    });

    expect(staleAfterRole.statusCode).toBe(401);
    expect(staleAfterPin.statusCode).toBe(401);
  });

  it("belebt ein altes Cookie nach Deaktivierung und Reaktivierung nicht wieder", async () => {
    // This fails if only active is checked and the epoch is not bound into the signed session.
    const { app, user, userStore } = await fixture();
    const loginResponse = await login(app);
    const cookie = cookieValue(loginResponse);
    const current = await userStore.getById(context, user.userId);
    if (!current) throw new Error("Aktueller Benutzer wurde nicht gefunden.");
    const deactivated = await userStore.updateSecurity(context, current, { active: false }, new Date("2026-08-28T10:01:00.000Z"));
    if (deactivated.kind !== "updated") throw new Error("Deaktivierung konnte nicht erstellt werden.");
    const reactivated = await userStore.updateSecurity(context, deactivated.user, { active: true }, new Date("2026-08-28T10:02:00.000Z"));
    if (reactivated.kind !== "updated") throw new Error("Reaktivierung konnte nicht erstellt werden.");

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie }
    });
    expect(response.statusCode).toBe(401);
  });

  it("setzt die aktuelle User-Store-Rolle serverseitig in die Sessionantwort", async () => {
    // This fails if a role from token or headers controls capabilities instead of the current user record.
    const { app, user } = await fixture({ role: "production_operator", displayName: "Produktion Test" });
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: cookieHeader(tokenFor(user, { role: "admin" }))
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authenticated: true,
      user: { userId: user.userId, displayName: "Produktion Test" },
      access: { capabilities: ["production", "production_read"] }
    });
  });

  it("erzwingt Same-Origin für Login und Logout und löscht ein gültiges Cookie vollständig", async () => {
    // This fails if cross-origin state changes or a logout leaves a browser session cookie active.
    const { app } = await fixture();
    const crossOriginLogin = await login(app, { loginCode: "admin", pin: "482731" }, {
      host: "catering.test",
      origin: "https://other.test"
    });
    expect(crossOriginLogin.statusCode).toBe(403);

    const authenticated = await login(app);
    const cookie = cookieValue(authenticated);
    const crossOriginLogout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { ...cookieHeader(cookie.split("=", 2)[1] ?? ""), host: "catering.test", origin: "https://other.test" }
    });
    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { ...sameOriginHeaders, cookie }
    });

    expect(crossOriginLogout.statusCode).toBe(403);
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers["set-cookie"])).toContain(`${CATERING_SESSION_COOKIE}=`);
    expect(String(logout.headers["set-cookie"])).toMatch(/Max-Age=0/i);
  });
});
