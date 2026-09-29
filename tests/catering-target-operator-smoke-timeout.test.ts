import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const smoke = path.join(root, "platform-infra/scripts/catering-target-operator-smoke.mjs");

describe("Catering target operator smoke request timeout", () => {
  it("aborts a hung request at the fixed 20-second timeout", () => {
    const source = readFileSync(smoke, "utf8");
    const runner = `
      const { Readable } = await import("node:stream");
      Object.defineProperty(process, "stdin", {
        configurable: true,
        value: Readable.from([Buffer.from(${JSON.stringify(JSON.stringify({
          basicPassword: "test", basicUser: "test", loginCode: "test", pin: "test"
        }))})])
      });
      globalThis.AbortSignal.timeout = (delay) => {
        if (delay !== 20_000) throw new Error("unexpected request timeout");
        const controller = new AbortController();
        globalThis.setTimeout(() => controller.abort(), 1);
        return controller.signal;
      };
      globalThis.fetch = (_url, init = {}) => {
        if (!init.signal) return new Promise(() => {});
        return new Promise((resolve, reject) => {
          const abort = () => reject(new Error("request aborted"));
          if (init.signal.aborted) abort();
          else init.signal.addEventListener("abort", abort, { once: true });
        });
      };
      await import("data:text/javascript," + encodeURIComponent(${JSON.stringify(source)}));
    `;
    const result = spawnSync("node", ["--input-type=module", "-e", runner], {
      encoding: "utf8",
      timeout: 2_000
    });

    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Authenticated smoke request timed out.");
  });

  it("emits non-sensitive progress markers for the authenticated read smoke", () => {
    const source = readFileSync(smoke, "utf8");
    const setup = `
      const { Readable } = await import("node:stream");
      Object.defineProperty(process, "stdin", {
        configurable: true,
        value: Readable.from([Buffer.from(${JSON.stringify(JSON.stringify({
          basicPassword: "test-password", basicUser: "test-user", loginCode: "test-code", pin: "123456"
        }))})])
      });
      globalThis.fetch = async (url) => {
        if (url.endsWith("/api/intake/v1/auth/login")) {
          return new Response("{}", { status: 200, headers: { "set-cookie": "session=test; Path=/" } });
        }
        if (url.endsWith("/api/intake/v1/auth/session")) {
          return Response.json({ authenticated: true, access: { capabilities: ["production_read"] } }, { status: 200 });
        }
        if (url.endsWith("/api/production/v1/production/plans")) {
          return Response.json([], { status: 200 });
        }
        throw new Error("unexpected smoke request");
      };
      ${source}
    `;
    const result = spawnSync("node", ["--input-type=module", "-e", setup], {
      encoding: "utf8",
      timeout: 2_000
    });

    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("authenticated_read_smoke_ok");
    const markers = [
      "TARGET_AUTH_SMOKE_STAGE stage=script_start status=success",
      "TARGET_AUTH_SMOKE_STAGE stage=payload_valid status=success",
      "TARGET_AUTH_SMOKE_STAGE stage=login_response status=200",
      "TARGET_AUTH_SMOKE_STAGE stage=login status=success",
      "TARGET_AUTH_SMOKE_STAGE stage=session_response status=200",
      "TARGET_AUTH_SMOKE_STAGE stage=session status=success",
      "TARGET_AUTH_SMOKE_STAGE stage=production_read_response status=200",
      "TARGET_AUTH_SMOKE_STAGE stage=production_read status=success"
    ];
    let cursor = -1;
    for (const marker of markers) {
      const next = result.stderr.indexOf(marker);
      expect(next, result.stderr).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(result.stderr).not.toContain("test-password");
    expect(result.stderr).not.toContain("test-user");
    expect(result.stderr).not.toContain("test-code");
    expect(result.stderr).not.toContain("123456");
  });
});
