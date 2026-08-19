import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('../edge-infra/scripts/smoke-all.sh', import.meta.url), 'utf8');
const validate = readFileSync(new URL('../edge-infra/scripts/validate.sh', import.meta.url), 'utf8');
const rehearsal = readFileSync(new URL('../edge-infra/docker-compose.rehearsal.yml', import.meta.url), 'utf8');

describe('edge deploy safety contract', () => {
  it('uses an explicit project and never tears down application projects', () => {
    expect(deploy).toContain('docker compose -p shared-edge');
    expect(deploy).not.toMatch(/docker compose down|docker system prune|docker network prune|docker volume prune/);
  });

  it('checks every managed public application after the edge change', () => {
    expect(smoke).toContain('/healthz');
    expect(smoke).toContain('/readyz');
    expect(smoke).toContain('/api/public/config');
    expect(smoke).toContain('EVENTOS_SMOKE_URL');
    expect(smoke).toContain('CATERING_SMOKE_URL');
  });

  it('validates Zeiterfassung response identity and reuses the established Catering smoke suite', () => {
    expect(smoke).toContain('assert_ok_json');
    expect(smoke).toContain('"ok"[[:space:]]*:[[:space:]]*true');
    expect(smoke).toContain('platform-infra/scripts/smoke-check.sh');
    expect(smoke).not.toContain('--location');
  });

  it('probes the new rehearsal listener locally instead of mistaking the old public proxy for the candidate', () => {
    expect(rehearsal).toContain('127.0.0.1:18080:80');
    expect(rehearsal).not.toContain('18443:443');
    expect(deploy).toContain('probe_rehearsal_listener');
    expect(deploy).toContain('http://127.0.0.1:18080');
    expect(deploy).toContain('--header "Host: ${host}"');
    expect(deploy).toContain('probe_ok_json "Rehearsal Zeiterfassung" "${ZEITERFASSUNG_SMOKE_HOST}"');
    expect(deploy).toContain('probe "Rehearsal EventOS" "${EVENTOS_SMOKE_HOST}"');
    expect(deploy).toContain('probe_catering_json "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/api/intake/health"');
  });

  it('requires semantic Zeiterfassung identity from the local rehearsal candidate', () => {
    expect(deploy).toContain('probe_ok_json');
    expect(deploy).toContain('"ok"[[:space:]]*:[[:space:]]*true');
    expect(deploy).toContain('probe_ok_json "Rehearsal Zeiterfassung" "${ZEITERFASSUNG_SMOKE_HOST}" "/healthz"');
  });

  it('validates Caddy through the whitelisted edge service environment only', () => {
    expect(deploy).toContain('run --rm --no-deps --entrypoint caddy edge validate');
    expect(deploy).not.toMatch(/docker run --rm\s+\\?\s*--env-file \.env(?!\.example)/);
    expect(validate).toContain('run --rm --no-deps --entrypoint caddy edge validate');
    expect(validate).not.toMatch(/docker run --rm[\s\\]+--env-file/);
  });

  it('treats an env-only bootstrap directory as no previous edge deployment', () => {
    expect(deploy).toContain('if [[ ! -f "${edge_path}/docker-compose.yml"');
    expect(deploy).toContain("printf 'NONE\\trehearsal\\n'");
  });

  it('keeps bootstrap snapshot read-only and revokes orphaned trust only after recovery is armed', () => {
    const bootstrapGuard = deploy.indexOf('if [[ ! -f "${edge_path}/docker-compose.yml" || ! -f "${edge_path}/.deploy-manifest" ]]');
    const bootstrapEnd = deploy.indexOf("printf 'NONE\\trehearsal\\n'", bootstrapGuard);
    const rollbackTrap = deploy.indexOf("trap 'rollback_edge_candidate' ERR");
    const revokeCall = deploy.indexOf('\nrevoke_live_manifest\n', rollbackTrap);
    expect(bootstrapGuard).toBeGreaterThanOrEqual(0);
    expect(bootstrapEnd).toBeGreaterThan(bootstrapGuard);
    expect(deploy.slice(bootstrapGuard, bootstrapEnd)).not.toContain('sudo rm -f "${edge_path}/.deploy-manifest"');
    expect(revokeCall).toBeGreaterThan(rollbackTrap);
  });

  it('never promotes a failed first-bootstrap candidate into a rollback point', () => {
    expect(deploy).toContain('if [[ ! -f "${edge_path}/docker-compose.yml" || ! -f "${edge_path}/.deploy-manifest" ]]');
  });

  it('arms rollback recovery before revoking live manifest trust', () => {
    expect(deploy).toContain('revoke_live_manifest');
    const rollbackTrap = deploy.indexOf("trap 'rollback_edge_candidate' ERR");
    const revokeCall = deploy.indexOf('\nrevoke_live_manifest\n', rollbackTrap);
    const sync = deploy.indexOf('Syncing edge source');
    expect(rollbackTrap).toBeGreaterThanOrEqual(0);
    expect(revokeCall).toBeGreaterThan(rollbackTrap);
    expect(revokeCall).toBeLessThan(sync);
  });

  it('invalidates manifest trust before candidate mutation and restores it only after verified rollback', () => {
    expect(deploy).toContain('manifest_archive="${archive}.manifest"');
    expect(deploy).toContain('sudo cp "${edge_path}/.deploy-manifest" "${manifest_archive}"');
    expect(deploy).toContain('sudo rm -f "${edge_path}/.deploy-manifest"');
    const revokeCall = deploy.indexOf('\nrevoke_live_manifest\n');
    expect(revokeCall).toBeLessThan(deploy.indexOf('Syncing edge source'));
    expect(deploy).toContain('sudo cp "${manifest_archive}" "${edge_path}/.deploy-manifest"');
  });

  it('retains the host deploy lock when rollback itself fails', () => {
    expect(deploy).toContain('EDGE_RECOVERY_REQUIRED=false');
    expect(deploy).toContain('EDGE_RECOVERY_REQUIRED=true');
    expect(deploy).toContain('Recovery is still required; retaining edge deploy lock');
    const recoveryGuard = deploy.indexOf('if [[ "${EDGE_RECOVERY_REQUIRED}" == "true" ]]');
    const remoteLockRemoval = deploy.indexOf('sudo rm -f "${lock_path}/owner"');
    expect(recoveryGuard).toBeGreaterThanOrEqual(0);
    expect(recoveryGuard).toBeLessThan(remoteLockRemoval);
  });

  it('rolls back on termination signals during the armed mutation window', () => {
    const errTrap = deploy.indexOf("trap 'rollback_edge_candidate' ERR");
    const termTrap = deploy.indexOf("trap 'rollback_edge_candidate 143' TERM", errTrap);
    const intTrap = deploy.indexOf("trap 'rollback_edge_candidate 130' INT", errTrap);
    const hupTrap = deploy.indexOf("trap 'rollback_edge_candidate 129' HUP", errTrap);
    const revokeCall = deploy.indexOf('\nrevoke_live_manifest\n', errTrap);
    const clearSignals = deploy.lastIndexOf('trap - ERR TERM INT HUP');
    const recordManifest = deploy.indexOf('Recording edge deployment manifest');
    expect(termTrap).toBeGreaterThan(errTrap);
    expect(intTrap).toBeGreaterThan(errTrap);
    expect(hupTrap).toBeGreaterThan(errTrap);
    expect(termTrap).toBeLessThan(revokeCall);
    expect(intTrap).toBeLessThan(revokeCall);
    expect(hupTrap).toBeLessThan(revokeCall);
    expect(clearSignals).toBeGreaterThan(recordManifest);
  });

  it('keeps recovery armed and ignores follow-up termination signals until rollback succeeds', () => {
    const rollbackStart = deploy.indexOf('rollback_edge_candidate() {');
    const rollbackEnd = deploy.indexOf('\n}\n\ntrap \'rollback_edge_candidate\' ERR', rollbackStart);
    const rollbackBody = deploy.slice(rollbackStart, rollbackEnd);
    const recoveryArmed = rollbackBody.indexOf('EDGE_RECOVERY_REQUIRED=true');
    const signalsIgnored = rollbackBody.indexOf("trap '' TERM INT HUP");
    const successBranch = rollbackBody.indexOf('EDGE_RECOVERY_REQUIRED=false', recoveryArmed + 1);
    expect(recoveryArmed).toBeGreaterThanOrEqual(0);
    expect(signalsIgnored).toBeGreaterThan(recoveryArmed);
    expect(successBranch).toBeGreaterThan(signalsIgnored);
  });

  it('allows an omitted Zeiterfassung upstream while rejecting duplicate definitions', () => {
    const migrationStart = deploy.indexOf('migrate_legacy_zeiterfassung_upstream() {');
    const migrationEnd = deploy.indexOf('\n}\n\nrelease_edge_lock() {', migrationStart);
    const migrationBody = deploy.slice(migrationStart, migrationEnd);
    expect(migrationStart).toBeGreaterThanOrEqual(0);
    expect(migrationEnd).toBeGreaterThan(migrationStart);
    expect(migrationBody).toContain('if [[ "$zt_count" -gt 1 ]]');
    expect(migrationBody).toContain('duplicate Zeiterfassung upstream definitions; refusing migration');
    expect(migrationBody).toContain('if [[ "$zt_count" = "0" ]]');
    expect(migrationBody).toContain('Compose default remains canonical');
    expect(migrationBody).not.toContain('test "$zt_count" = "1"');
  });

  it('serializes every edge deployment on the host for the full mutation window', () => {
    expect(deploy).toContain('EDGE_LOCK_PATH="${EDGE_DEPLOY_PATH}.deploy-lock"');
    expect(deploy).toContain('acquire_edge_lock');
    expect(deploy).toContain('release_edge_lock');
    expect(deploy).toContain("trap 'release_edge_lock' EXIT");
    expect(deploy.indexOf('acquire_edge_lock')).toBeLessThan(deploy.indexOf('Creating edge rollback snapshot'));
    expect(deploy.indexOf('Recording edge deployment manifest')).toBeLessThan(deploy.lastIndexOf('release_edge_lock'));
  });

  it('restores only the previous shared-edge candidate after post-start failure', () => {
    const rollbackStart = deploy.indexOf('rollback_edge_candidate() {');
    const rollbackEnd = deploy.indexOf('\n}\n\ntrap \'rollback_edge_candidate\' ERR', rollbackStart);
    const rollbackBody = deploy.slice(rollbackStart, rollbackEnd);
    expect(rollbackStart).toBeGreaterThanOrEqual(0);
    expect(rollbackEnd).toBeGreaterThan(rollbackStart);
    expect(rollbackBody).toContain('shared-edge');
    expect(rollbackBody).not.toMatch(/platform-infra.*up|zeiterfassung.*up|eventos.*up/);
  });
});
