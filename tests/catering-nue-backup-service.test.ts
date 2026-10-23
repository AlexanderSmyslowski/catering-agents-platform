import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "vitest";

test("NUE full backup service preserves admission, stream and owned recovery contracts", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const result = spawnSync("python3", [
    "-I", "-B", "-m", "unittest", "discover",
    "-s", "platform-infra/backup/tests", "-v",
  ], { cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024 });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toContain(process.platform === "linux" ? "\nOK\n" : "\nOK (skipped=1)\n");
});
