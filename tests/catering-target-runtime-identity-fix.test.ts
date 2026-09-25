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
  it("normalizes release ownership after rsync before candidate activation", () => {
    const start = production.indexOf("prepare_remote_release() {");
    const end = production.indexOf("\n}\n\ncapture_previous_and_load_candidates() {", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const prepare = production.slice(start, end);

    const sourceChown = prepare.indexOf('sudo -n chown -R root:root -- "$source_dir"');
    const bundleChown = prepare.indexOf('sudo -n chown root:root --');
    const chmod = prepare.indexOf('sudo -n chmod 0644');
    expect(sourceChown).toBeGreaterThanOrEqual(0);
    expect(bundleChown).toBeGreaterThan(sourceChown);
    expect(chmod).toBeGreaterThan(bundleChown);

    expect(prepare).toContain(
      '[[ "$(sudo -n stat -c \'%u:%g:%a\' "$platform_base")" == "0:0:644" ]]',
    );
    expect(prepare).toContain(
      '[[ "$(sudo -n stat -c \'%u:%g:%a\' "$platform_ops")" == "0:0:644" ]]',
    );
    expect(prepare).toContain(
      '[[ "$(sudo -n stat -c \'%u:%g:%a\' "$release_dir/candidate-images.json")" == "0:0:644" ]]',
    );
  });

  it("uses an allowed read-only Production route for the authenticated smoke", () => {
    const start = production.indexOf("authenticated_read_smoke() {");
    const end = production.indexOf("\n}\n\nwrite_install_receipt() {", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const smoke = production.slice(start, end);

    expect(smoke).toContain("/api/production/v1/production/plans");
    expect(smoke).not.toContain("/api/production/v1/production/cases");
    expect(smoke).toContain('includes("production_read")');
    expect(smoke).toContain("authenticated_read_smoke_ok");
  });

  it("exposes fail-closed release stage markers without changing the smoke route", () => {
    expect(production).toContain("TARGET_UPDATE_STAGE stage=activate status=start");
    expect(production).toContain("TARGET_UPDATE_STAGE stage=activate status=success");
    expect(production).toContain("TARGET_UPDATE_STAGE stage=postflight status=success");
    expect(production).toContain("TARGET_UPDATE_STAGE stage=health service=intake status=success");
    expect(production).toContain("TARGET_UPDATE_STAGE stage=health service=exports status=success");
    expect(production).toContain("TARGET_UPDATE_STAGE stage=auth_smoke status=start");
    expect(production).toContain("TARGET_AUTH_SMOKE_STAGE stage=login status=success");
    expect(production).toContain("TARGET_AUTH_SMOKE_STAGE stage=session status=success");
    expect(production).toContain("TARGET_AUTH_SMOKE_STAGE stage=production_read status=success");
    expect(production).toContain("/api/production/v1/production/plans");
    expect(production).not.toContain("/api/production/v1/production/cases");
  });

});
