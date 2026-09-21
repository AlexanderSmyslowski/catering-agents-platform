import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(root, ".github/workflows/update-catering-target.yml");

function workflow() {
  return readFileSync(workflowPath, "utf8");
}

describe("Catering target update workflow", () => {
  it("is manual-only and main-only", () => {
    const text = workflow();
    expect(text).toContain("workflow_dispatch:");
    expect(text).not.toMatch(/^\s*push:/m);
    expect(text).not.toMatch(/^\s*pull_request:/m);
    expect(text).toContain("github.ref == 'refs/heads/main'");
  });

  it("requires exact commit input and explicit operator confirmation", () => {
    const text = workflow();
    expect(text).toContain("commit_sha");
    expect(text).toContain("UPDATE_CATERING_TARGET");
    expect(text).toContain("persist-credentials: false");
  });

  it("uses only the dedicated target update path", () => {
    const text = workflow();
    expect(text).toContain("platform-infra/scripts/update-catering-target.sh");
    expect(text).toContain("--preflight");
    expect(text).toContain("--update");
    expect(text).not.toContain("deploy-hetzner.sh");
    expect(text).not.toContain("deploy-production.yml");
    expect(text).not.toContain("zeiterfassung_default");
    expect(text).not.toContain("shared-edge");
  });

  it("uses dedicated target secrets rather than historical deploy secret names", () => {
    const text = workflow();
    for (const name of [
      "CATERING_TARGET_DEPLOY_HOST",
      "CATERING_TARGET_DEPLOY_USER",
      "CATERING_TARGET_SSH_PRIVATE_KEY",
      "CATERING_TARGET_SSH_KNOWN_HOSTS",
      "CATERING_TARGET_SMOKE_BASIC_AUTH_USER",
      "CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD",
      "CATERING_TARGET_SMOKE_LOGIN_CODE",
      "CATERING_TARGET_SMOKE_PIN"
    ]) {
      expect(text).toContain(name);
    }
    expect(text).not.toContain("HETZNER_DEPLOY_HOST");
    expect(text).not.toContain("HETZNER_DEPLOY_USER");
  });

  it("does not auto-dispatch or retry a target update", () => {
    const text = workflow();
    expect(text).not.toContain("workflow_run:");
    expect(text).not.toContain("schedule:");
    expect(text).toContain("cancel-in-progress: false");
  });
});
