import Fastify from "fastify";
import type { ConfigEnv, ProxyOptions } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTrustedActorResolver } from "../shared-core/src/access-control.js";
import { registerCateringDevSessionRoute } from "../intake-service/src/routes/auth-routes.js";

const environment = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("vite", async (importOriginal) => {
  const original = await importOriginal<typeof import("vite")>();
  return { ...original, loadEnv: () => environment.values };
});
import viteConfig from "../backoffice-ui/vite.config.js";

const secret = "synthetic-local-session-only";
const localEnvironment = {
  CATERING_DEV_AUTH: "1",
  CATERING_TRUSTED_ACTOR_SECRET: secret,
  CATERING_DEFAULT_BUSINESS_ID: "local"
};

afterEach(() => {
  environment.values = {};
  vi.unstubAllEnvs();
});

async function proxyFor(
  url: string,
  env: Record<string, string> = localEnvironment,
  configEnv: ConfigEnv = { command: "serve", mode: "development" }
): Promise<ProxyOptions> {
  environment.values = env;
  if (typeof viteConfig !== "function") throw new Error("Expected the real Vite configuration factory.");
  const config = await viteConfig(configEnv);
  const entry = Object.entries(config.server?.proxy ?? {}).find(([key]) =>
    key.startsWith("^") ? new RegExp(key).test(url) : url.startsWith(key)
  );
  if (!entry || typeof entry[1] === "string") throw new Error(`No configured proxy for ${url}`);
  return entry[1];
}

async function sessionFor(headers: Record<string, string>) {
  const app = Fastify();
  const actorForRequest = createTrustedActorResolver({
    fallbackActorName: "Intake-Mitarbeiter",
    fallbackBusinessId: "local",
    trustedActorSecret: secret
  });
  registerCateringDevSessionRoute({ app, actorForRequest });
  try {
    const response = await app.inject({ method: "GET", url: "/v1/auth/session", headers });
    expect(response.statusCode).toBe(200);
    return response.json<{ authenticated: boolean; access: { capabilities: string[] } }>();
  } finally {
    await app.close();
  }
}

function headersFor(proxy: ProxyOptions): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(proxy.headers ?? {})) {
    if (typeof value !== "string") throw new Error(`Unexpected proxy header type: ${name}`);
    headers[name] = value;
  }
  return headers;
}

async function capabilitiesFor(
  url = "/api/intake/v1/auth/session",
  env: Record<string, string> = localEnvironment,
  configEnv?: ConfigEnv
): Promise<string[]> {
  return (await sessionFor(headersFor(await proxyFor(url, env, configEnv)))).access.capabilities;
}

describe("local rehearsal session proxy", () => {
  it("provides the offer capability through the real local session route", async () => {
    const proxy = await proxyFor("/api/intake/v1/auth/session");
    expect(proxy.rewrite?.("/api/intake/v1/auth/session")).toBe("/v1/auth/session");
    const session = await sessionFor(headersFor(proxy));
    expect(session.authenticated).toBe(true);
    expect(session.access.capabilities).toEqual(expect.arrayContaining(["intake", "offer", "production"]));
  });

  it.each(["1", "true", " TRUE "])("supports the explicit dev-auth spelling %s", async (value) => {
    expect(await capabilitiesFor(undefined, { ...localEnvironment, CATERING_DEV_AUTH: value })).toContain("offer");
  });

  it.each(["", "0", "false", "enabled"])("does not elevate when dev auth is %s", async (value) => {
    expect(await capabilitiesFor(undefined, { ...localEnvironment, CATERING_DEV_AUTH: value })).not.toContain("offer");
  });

  it("does not elevate when the dev-auth flag or trusted secret is absent", async () => {
    const { CATERING_DEV_AUTH: _flag, ...withoutFlag } = localEnvironment;
    const { CATERING_TRUSTED_ACTOR_SECRET: _secret, ...withoutSecret } = localEnvironment;
    for (const env of [withoutFlag, withoutSecret]) {
      const proxy = await proxyFor("/api/intake/v1/auth/session", env);
      expect((await sessionFor(headersFor(proxy))).access.capabilities).not.toContain("offer");
    }
  });

  it("does not confer offer access with an incorrect trusted secret", async () => {
    const headers = headersFor(await proxyFor("/api/intake/v1/auth/session"));
    const session = await sessionFor({ ...headers, "x-catering-trusted-secret": "incorrect" });
    expect(session.access.capabilities).not.toContain("offer");
  });

  it("keeps ordinary intake and neighboring authentication paths intake-only", async () => {
    for (const url of [
      "/api/intake/v1/intake/requests",
      "/api/intake/v1/auth/session-evil",
      "/api/intake/v1/auth/session/extra",
      "/api/intake/v1/auth/login"
    ]) {
      expect(await capabilitiesFor(url)).toEqual(["intake"]);
    }
  });

  it("matches the session query string without changing the rewritten path", async () => {
    const url = "/api/intake/v1/auth/session?probe=1";
    const proxy = await proxyFor(url);
    expect(proxy.rewrite?.(url)).toBe("/v1/auth/session?probe=1");
    expect((await sessionFor(headersFor(proxy))).access.capabilities).toContain("offer");
  });

  it.each(["http://localhost:3101", "http://127.0.0.1:3101", "http://[::1]:3101"])(
    "limits the additional identity to the local target %s", async (target) => {
      expect(await capabilitiesFor(undefined, { ...localEnvironment, VITE_INTAKE_PROXY_TARGET: target })).toContain("offer");
    }
  );

  it.each(["https://example.invalid", "http://192.0.2.1:3101", "http://localhost.example.invalid:3101", "http://localhost:3101/remote", "not-a-url"])(
    "does not elevate a non-loopback or malformed target %s", async (target) => {
      expect(await capabilitiesFor(undefined, { ...localEnvironment, VITE_INTAKE_PROXY_TARGET: target })).not.toContain("offer");
    }
  );

  it("does not enable the additional identity in a build or production mode", async () => {
    expect(await capabilitiesFor(undefined, localEnvironment, { command: "build", mode: "development" })).not.toContain("offer");
    expect(await capabilitiesFor(undefined, localEnvironment, { command: "serve", mode: "production" })).not.toContain("offer");
    expect(await capabilitiesFor(undefined, { ...localEnvironment, NODE_ENV: "production" })).not.toContain("offer");
    vi.stubEnv("NODE_ENV", "production");
    expect(await capabilitiesFor()).not.toContain("offer");
  });
});
