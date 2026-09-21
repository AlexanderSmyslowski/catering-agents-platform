import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("keeps the real process snapshot guard free of self-matches and fail-closed on inspection errors", () => {
  const result = spawnSync("python3", ["-B", "tests/local_stack_process_snapshot_test.py"], {
    encoding: "utf8",
    timeout: 15_000,
    env: process.env
  });
  expect(result.error, `${result.stdout}\n${result.stderr}`).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}, 20_000);
