import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("synthetic Catering observer contracts", () => {
  it("runs real local validators with simulated units and heartbeat transport", () => {
    const result = spawnSync("python3", ["-B", "tests/catering_backup_observer_test.py"], {
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 2 * 1024 * 1024,
    });
    expect(result.error, result.error?.message).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toMatch(/Ran \d+ tests/);
    expect(result.stderr).not.toMatch(/skipped=/);
  }, 190000);
});
