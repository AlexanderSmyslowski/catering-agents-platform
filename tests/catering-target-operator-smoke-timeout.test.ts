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
});
