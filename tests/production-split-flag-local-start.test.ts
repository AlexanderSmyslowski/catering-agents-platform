import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("local production split flag", () => {
  const source = readFileSync("scripts/start-local-stack.sh", "utf8");
  const setup = source.match(/^PRODUCTION_SPLITS_FLAG="disabled"\nif \[\[ .*CATERING_PRODUCTION_COMPONENT_SPLITS.*\n/m)?.[0];
  it.each([[undefined, "enabled"], ["enabled", "enabled"], ["disabled", "disabled"], ["", "disabled"], ["unknown", "disabled"]])(
    "uses %s as %s", (value, expected) => {
      expect(setup).toBeDefined();
      const env = value === undefined ? {} : { CATERING_PRODUCTION_COMPONENT_SPLITS: value };
      expect(execFileSync("/bin/bash", ["-c", `${setup}printf '%s' "$PRODUCTION_SPLITS_FLAG"`], { env, encoding: "utf8" })).toBe(expected);
    }
  );
});
