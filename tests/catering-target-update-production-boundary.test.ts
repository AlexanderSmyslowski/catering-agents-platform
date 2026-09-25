import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const runner = () => [
  readFileSync(path.join(root, "platform-infra/scripts/update-catering-target.sh"), "utf8"),
  readFileSync(path.join(root, "platform-infra/scripts/catering-target-production-update.sh"), "utf8")
].join("\n");

describe("Catering target production command boundary", () => {

  it("keeps every remote Bash heredoc syntactically valid", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const blocks = [...production.matchAll(/<<'(REMOTE_[A-Z0-9_]+)'\n([\s\S]*?)\n\1/g)];
    expect(blocks.map((match) => match[1])).toEqual([
      "REMOTE_SCHEMA_SOURCE",
      "REMOTE_DDL_MANIFEST",
      "REMOTE_PREFLIGHT",
      "REMOTE_LOCK",
      "REMOTE_UNLOCK",
      "REMOTE_RELEASE",
      "REMOTE_RELEASE_OWNERSHIP",
      "REMOTE_LOAD",
      "REMOTE_ACTIVATE",
      "REMOTE_VERIFY",
      "REMOTE_RESTORE_CURRENT"
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

  it("reads installed migration and DDL source from all immutable runtime containers", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    expect(production).toContain("TARGET_RUNTIME_SCHEMA_HASHES");
    expect(production).toContain("TARGET_RUNTIME_DDL_HASHES");
    expect(production).toContain("/app/shared-core/src/persistence.ts");
    expect(production).toContain("for service in intake offer production exports; do");
    expect(production).toContain('sudo -n docker exec "$container"');
    expect(production).not.toMatch(/DEPLOY_PATH\}\/shared-core\/src\/persistence\.ts/);
    expect(production).toContain('fail "TARGET_PREFLIGHT_FAIL gate=runtime_schema_source"');
    expect(production).toContain('fail "TARGET_PREFLIGHT_FAIL gate=runtime_ddl_manifest"');
  });

  it("preserves the empty unlocked-preflight owner across SSH argument serialization", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    expect(production).toContain('expected_lock_owner_arg="__CATERING_NO_LOCK_OWNER__"');
    expect(production).toContain('"${expected_lock_owner_arg}"');
    const match = production.match(/<<'REMOTE_PREFLIGHT'\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toContain('[[ "$#" -eq 26 ]] || preflight_fail remote_argument_count');
    expect(remotePreflight).toContain('expected_owner_arg="$7"');
    expect(remotePreflight).toContain('expected_owner=""');
  });

  it("runs the local runtime DDL scanner with Python warnings treated as errors", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/runtime_ddl_manifest_hash\(\) \{[\s\S]*?python3 - "\$root" <<'PY'\n([\s\S]*?)\nPY\n\}/);
    expect(match?.[1], "local runtime DDL Python block missing").toBeTruthy();
    const check = spawnSync("python3", ["-W", "error", "-", root], {
      input: match?.[1] ?? "",
      encoding: "utf8"
    });
    expect(check.status, check.stderr).toBe(0);
    expect(check.stdout.trim()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("checks the root-only runtime env through non-interactive sudo without reading its contents", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toContain('sudo -n test -f "$runtime_env" || preflight_fail runtime_env_file');
    expect(remotePreflight).toContain('sudo -n test ! -L "$runtime_env" || preflight_fail runtime_env_symlink');
    expect(remotePreflight).toContain('sudo -n stat -c \'%u:%g:%a\' "$runtime_env"');
    expect(remotePreflight).not.toContain('sudo -n cat "$runtime_env"');
  });

  it("distinguishes target file absence, symlink, hash read failure, and actual hash drift", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toContain('preflight_fail "${gate}_file"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_symlink"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_mode"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_hash_read"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_hash"');
    expect(remotePreflight).toContain('check_regular_hash "$platform_base" "$platform_base_hash" platform_base');
    expect(remotePreflight).toContain('check_regular_hash "$platform_ops" "$platform_ops_hash" platform_ops');
    expect(remotePreflight).toContain('check_regular_hash "$edge_base" "$edge_base_hash" edge_base');
    expect(remotePreflight).toContain('check_regular_hash "$edge_ops" "$edge_ops_hash" edge_ops');
    expect(remotePreflight).toContain('check_regular_hash "$edge_caddy" "$edge_caddy_hash" edge_caddy');
    expect(remotePreflight).toContain('check_regular_hash "$target_site" "$target_site_hash" target_site');
    expect(remotePreflight).not.toContain('check_regular_hash "$platform_base" "$platform_base_hash" ||');
  });

  it("binds preflight runtime files and Compose labels from contract v2 instead of reconstructing repo names", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(production).toContain("repositorySourcePaths.platformBase");
    expect(production).toContain("installedRuntime.platform.baseCompose");
    expect(production).toContain("installedRuntime.edge.baseCompose");
    expect(production).toContain("target runtime inventory binding mismatch");
    expect(remotePreflight).toContain('platform_base="${10}"');
    expect(remotePreflight).toContain('edge_base="${14}"');
    expect(remotePreflight).toContain('target_site="${17}"');
    expect(remotePreflight).toContain("com.docker.compose.project.config_files");
    expect(remotePreflight).toContain('check_compose_labels "platform-infra-${service}-1"');
    expect(remotePreflight).toContain('check_compose_labels "catering-edge-edge-1"');
    expect(remotePreflight).not.toContain('$deploy_path/platform-infra/docker-compose.catering-target.json');
    expect(remotePreflight).not.toContain('$deploy_path/edge-infra/docker-compose.catering-target.json');
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
      "remote_argument_count",
      "target_hostname",
      "deploy_path",
      "runtime_env_symlink",
      "runtime_env_mode",
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

  it("keeps local and remote runtime DDL detection semantics identical", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const ddlRegex = 'ddl = re.compile(r"\\b(?:CREATE|ALTER|DROP)\\s+TABLE\\b|\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b", re.I)';
    expect(production.split(ddlRegex).length - 1).toBe(2);
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
    expect(text).not.toContain("docker build");
    expect(text).not.toContain("docker save");
    expect(text).not.toContain("docker load");
    expect(text).toContain("CATERING_TARGET_CANDIDATE_RUNTIME_IMAGE");
    expect(text).toContain("CATERING_TARGET_CANDIDATE_WEB_IMAGE");
    expect(text).toContain("docker image inspect");
    const contract = JSON.parse(readFileSync(path.join(root, "platform-infra/catering-target-update-contract.json"), "utf8"));
    expect(contract.repositorySourcePaths.platformBase).toBe("platform-infra/docker-compose.catering-target.json");
    expect(contract.repositorySourcePaths.platformOperations).toBe("platform-infra/docker-compose.catering-target.operations.json");
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
    expect(runnerText).toContain("/api/intake/v1/auth/login");
    expect(runnerText).toContain("/api/intake/v1/auth/session");
    expect(runnerText).toContain("/api/production/v1/production/plans");
    expect(runnerText).not.toContain("/api/production/v1/production/cases");
    expect(runnerText).toContain("process.stdin");
    expect(runnerText).toContain("shlex.quote");
    expect(runnerText).toContain("AbortSignal.timeout(20000)");
    expect(runnerText).not.toContain("synthetic-password");
  });

  it("protects the server-owned configuration in production sync", () => {
    const text = runner();
    for (const excluded of ["platform-infra/.env", "platform-infra/sites", "data"]) {
      expect(text).toContain("--exclude=" + excluded);
    }
    expect(text).toContain("/etc/catering-target/runtime.env");
    expect(text).toContain("CATERING_TARGET_SOURCE_ROOT");
    expect(text).toContain("source root must be detached");
    expect(text).toContain("status --porcelain --untracked-files=all");
    expect(text).toContain("ServerAliveInterval=15");
    expect(text).toContain("ServerAliveCountMax=4");
  });
});
