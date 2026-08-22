import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  devDependencies?: Record<string, string>;
};

describe("Vitest runner stability contract", () => {
  it("uses the Vitest 4 release line that contains the worker-RPC closure fix", () => {
    expect(packageJson.devDependencies?.vitest).toMatch(/^\^4\./);

    const version = spawnSync(
      process.execPath,
      [resolve(root, "node_modules/vitest/vitest.mjs"), "--version"],
      { cwd: root, encoding: "utf8" },
    );

    expect(version.error).toBeUndefined();
    expect(version.status).toBe(0);
    expect(version.stdout).toMatch(/^vitest\/4\./);
  });
});
