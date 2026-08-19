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
    expect(deploy).toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}"');
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

  it('revokes an orphaned manifest before entering bootstrap mode', () => {
    const bootstrapGuard = deploy.indexOf('if [[ ! -f "${edge_path}/docker-compose.yml" || ! -f "${edge_path}/.deploy-manifest" ]]');
    const bootstrapEnd = deploy.indexOf("printf 'NONE\\trehearsal\\n'", bootstrapGuard);
    const revoke = deploy.indexOf('sudo rm -f "${edge_path}/.deploy-manifest"', bootstrapGuard);
    expect(bootstrapGuard).toBeGreaterThanOrEqual(0);
    expect(revoke).toBeGreaterThan(bootstrapGuard);
    expect(revoke).toBeLessThan(bootstrapEnd);
  });

  it('never promotes a failed first-bootstrap candidate into a rollback point', () => {
    expect(deploy).toContain('if [[ ! -f "${edge_path}/docker-compose.yml" || ! -f "${edge_path}/.deploy-manifest" ]]');
  });

  it('invalidates manifest trust before candidate mutation and restores it only after verified rollback', () => {
    expect(deploy).toContain('manifest_archive="${archive}.manifest"');
    expect(deploy).toContain('sudo cp "${edge_path}/.deploy-manifest" "${manifest_archive}"');
    expect(deploy).toContain('sudo rm -f "${edge_path}/.deploy-manifest"');
    expect(deploy.indexOf('sudo rm -f "${edge_path}/.deploy-manifest"')).toBeLessThan(deploy.indexOf('Syncing edge source'));
    expect(deploy).toContain('sudo cp "${manifest_archive}" "${edge_path}/.deploy-manifest"');
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
    expect(deploy).toContain('rollback_edge_candidate');
    expect(deploy).toContain("trap 'rollback_edge_candidate' ERR");
    expect(deploy).toContain('shared-edge');
    expect(deploy).not.toMatch(/platform-infra.*up|zeiterfassung.*up|eventos.*up/);
  });
});
