import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const production = readFileSync(
  path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
  "utf8",
);

describe("Catering target runtime identity recovery", () => {
  it("accepts the active release identity for app containers while keeping PostgreSQL canonical", () => {
    expect(production).toContain('local runtime_expectation="${2:-current}"');
    expect(production).toContain('[[ "$#" -eq 26 ]] || preflight_fail remote_argument_count');
    expect(production).toContain('bind_release_runtime() {');
    expect(production).toContain('expected_app_working_dir="$(dirname "$release_base")"');
    expect(production).toContain('expected_app_config_files="$release_base,$release_ops,$override"');
    expect(production).toContain(
      'check_compose_labels "platform-infra-postgres-1" "$platform_project" "$platform_working_dir" "$platform_config_files" postgres platform_postgres',
    );
    expect(production).toContain(
      'check_compose_labels "platform-infra-${service}-1" "$platform_project" "$expected_app_working_dir" "$expected_app_config_files" "$service" "platform_${service}"',
    );
    expect(production).toContain(
      'postflight="$(remote_preflight "${LOCK_OWNER}" "${DEPLOY_COMMIT_SHA}")"',
    );
  });

  it("restores the actually installed runtime identity on rollback instead of the failed release identity", () => {
    const start = production.indexOf("rollback_remote_application() {");
    const end = production.indexOf("\n}\n\nhandle_production_failure() {", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const rollback = production.slice(start, end);
    expect(production).toContain("activate_current_installed_runtime() {");
    expect(production).toContain('installed="$release_root/installed"');
    expect(production).toContain(
      'sudo -n docker compose --env-file "$runtime_env" -f "$canonical_base" -f "$canonical_ops" up -d --no-deps --force-recreate intake offer production exports web',
    );
    expect(rollback).toContain("activate_current_installed_runtime");
    expect(rollback).toContain('remote_preflight "${LOCK_OWNER}" current');
    expect(rollback).not.toContain('activate_remote_override "${release_dir}/previous-images.json"');
  });

  it("can safely resume an incomplete release directory but rejects one already installed", () => {
    expect(production).toContain(
      '[[ ! -e "$release_dir/install-receipt" && ! -L "$release_dir/install-receipt" ]] || exit 1',
    );
    expect(production).toContain(
      'source|candidate-images.json|runtime-image.tar.gz|web-image.tar.gz|previous-images.json',
    );
    expect(production).toContain('runtime_state="release:$commit"');
    expect(production).toContain('sudo -n grep -Fxq "status=installed" "$receipt"');
    expect(production).toContain('sudo -n grep -Fxq "commit=$commit" "$receipt"');
  });
});
