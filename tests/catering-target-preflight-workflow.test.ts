import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(root, ".github/workflows/catering-target-preflight.yml");
const productionRunnerPath = path.join(root, "platform-infra/scripts/catering-target-production-update.sh");

function workflow() {
  return readFileSync(workflowPath, "utf8");
}

function productionRunner() {
  return readFileSync(productionRunnerPath, "utf8");
}

describe("Catering target read-only preflight workflow", () => {
  it("is manual-only and main-only", () => {
    const text = workflow();
    expect(text).toContain("workflow_dispatch:");
    expect(text).not.toMatch(/^\s*push:/m);
    expect(text).not.toMatch(/^\s*pull_request:/m);
    expect(text).not.toMatch(/^\s*schedule:/m);
    expect(text).toContain("github.ref == 'refs/heads/main'");
  });

  it("binds the requested commit to the exact current main head", () => {
    const text = workflow();
    expect(text).toContain("commit_sha");
    expect(text).toContain("persist-credentials: false");
    expect(text).toContain("git rev-parse HEAD");
    expect(text).toContain("git ls-remote origin refs/heads/main");
  });

  it("executes only the read-only target preflight", () => {
    const text = workflow();
    expect(text).toContain("platform-infra/scripts/update-catering-target.sh --preflight");
    expect(text).not.toContain("--update");
    expect(text).not.toContain("UPDATE_CATERING_TARGET");
    expect(text).not.toContain("CATERING_TARGET_CONFIRMATION");
  });

  it("uses only dedicated target SSH inputs and no smoke credentials", () => {
    const text = workflow();
    for (const name of [
      "CATERING_TARGET_DEPLOY_HOST",
      "CATERING_TARGET_DEPLOY_USER",
      "CATERING_TARGET_SSH_PRIVATE_KEY",
      "CATERING_TARGET_SSH_KNOWN_HOSTS"
    ]) {
      expect(text).toContain(name);
    }
    for (const forbidden of [
      "CATERING_TARGET_SMOKE_BASIC_AUTH_USER",
      "CATERING_TARGET_SMOKE_BASIC_AUTH_PASSWORD",
      "CATERING_TARGET_SMOKE_LOGIN_CODE",
      "CATERING_TARGET_SMOKE_PIN",
      "HETZNER_DEPLOY_HOST",
      "HETZNER_DEPLOY_USER",
      "deploy-hetzner.sh",
      "zeiterfassung_default"
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("uses the protected target environment and the runner's strict SSH transport", () => {
    const text = workflow();
    const runner = productionRunner();
    expect(text).toContain("environment: catering-target-production");
    expect(text).toContain("if: always()");
    expect(text).toContain("rm -rf --");
    expect(runner).toContain("StrictHostKeyChecking=yes");
    expect(runner).toContain("UserKnownHostsFile=");
    expect(runner).toContain("BatchMode=yes");
    expect(runner).toContain("IdentitiesOnly=yes");
  });
});
