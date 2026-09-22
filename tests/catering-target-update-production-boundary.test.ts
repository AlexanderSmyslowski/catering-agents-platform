import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const runner = () => [
  readFileSync(path.join(root, "platform-infra/scripts/update-catering-target.sh"), "utf8"),
  readFileSync(path.join(root, "platform-infra/scripts/catering-target-production-update.sh"), "utf8")
].join("\n");
const smoke = () => readFileSync(path.join(root, "platform-infra/scripts/catering-target-authenticated-smoke.mjs"), "utf8");

describe("Catering target production command boundary", () => {

  it("keeps every remote Bash heredoc syntactically valid", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const blocks = [...production.matchAll(/<<'(REMOTE_[A-Z0-9_]+)'\n([\s\S]*?)\n\1/g)];
    expect(blocks.map((match) => match[1])).toEqual([
      "REMOTE_SCHEMA_SOURCE",
      "REMOTE_PREFLIGHT",
      "REMOTE_LOCK",
      "REMOTE_UNLOCK",
      "REMOTE_RELEASE",
      "REMOTE_LOAD",
      "REMOTE_ACTIVATE",
      "REMOTE_VERIFY"
    ]);
    for (const match of blocks) {
      const check = spawnSync("/bin/bash", ["-n"], {
        input: match[2] ?? "",
        encoding: "utf8"
      });
      expect(check.status, `${match[1]}: ${check.stderr}`).toBe(0);
    }
  });

  it("disables psql startup files in the read-only remote preflight", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toMatch(/\bpsql\b[^\n]*--no-psqlrc\b/);
  });

  it("wraps runtime schema source SSH failures in a coarse preflight gate", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    expect(production).toMatch(/if ! installed_source="\\$\\(ssh_target bash -s --/);
    expect(production).toContain('fail "TARGET_PREFLIGHT_FAIL gate=runtime_schema_source"');
  });

  it("names critical read-only preflight failure gates without exposing values", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    for (const gate of [
      "target_hostname",
      "deploy_path",
      "runtime_env_mode",
      "platform_base_hash",
      "target_site_hash",
      "target_update_lock_absent",
      "backup_observer_health",
      "platform_compose_render",
      "docker_network_set",
      "writer_mode",
      "schema_version",
      "postgres_network",
      "web_network",
      "edge_ports",
      "postgres_volume",
      "edge_image"
    ]) {
      expect(remotePreflight).toContain("preflight_fail " + gate);
    }
    expect(remotePreflight).toContain("TARGET_PREFLIGHT_FAIL gate=%s");
  });

  it("implements strict read-only production preflight", () => {
    const text = runner();
    expect(text).toContain("--preflight");
    expect(text).toContain("StrictHostKeyChecking=yes");
    expect(text).toContain("UserKnownHostsFile=");
    expect(text).toContain("/usr/local/libexec/catering-backup-observer.py");
    expect(text).toContain("--check");
    expect(text).toContain("catering-prod-1");
    expect(text).not.toContain("normal target preflight is not enabled");
  });

  it("implements an explicitly confirmed production update mode", () => {
    const text = runner();
    expect(text).toContain("--update");
    expect(text).toContain("CATERING_TARGET_CONFIRMATION");
    expect(text).toContain("UPDATE_CATERING_TARGET");
    expect(text).toContain("docker build");
    expect(text).toContain("docker load");
    expect(text).toContain("docker-compose.catering-target.json");
    expect(text).toContain("docker-compose.catering-target.operations.json");
  });

  it("never references the historical shared deployment chain", () => {
    const text = runner();
    expect(text).not.toContain("zeiterfassung_default");
    expect(text).not.toContain("shared-edge");
    expect(text).not.toContain("deploy-hetzner.sh");
    expect(text).not.toContain("docker-compose.production.yml");
    expect(text).not.toContain("docker-compose.edge-cutover.yml");
  });

  it("performs an authenticated application-session read smoke without embedding credentials", () => {
    const runnerText = runner();
    const smokeText = smoke();
    expect(runnerText).toContain("catering-target-authenticated-smoke.mjs");
    expect(smokeText).toContain("/api/intake/v1/auth/login");
    expect(smokeText).toContain("/api/intake/v1/auth/session");
    expect(smokeText).toContain("/api/production/v1/production/cases");
    expect(smokeText).toContain("process.stdin");
    expect(smokeText).not.toContain("synthetic-password");
  });

  it("protects the server-owned configuration in production sync", () => {
    const text = runner();
    for (const excluded of ["platform-infra/.env", "platform-infra/sites", "data"]) {
      expect(text).toContain("--exclude=" + excluded);
    }
    expect(text).toContain("/etc/catering-target/runtime.env");
  });
});
