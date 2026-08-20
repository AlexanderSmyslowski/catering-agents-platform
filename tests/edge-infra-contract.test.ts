import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(new URL('../edge-infra/docker-compose.yml', import.meta.url), 'utf8');
const caddy = readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url), 'utf8');
const rehearsalCaddy = readFileSync(new URL('../edge-infra/Caddyfile.rehearsal', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../edge-infra/.env.example', import.meta.url), 'utf8');
const platformCompose = readFileSync(new URL('../platform-infra/docker-compose.yml', import.meta.url), 'utf8');
const deployScript = readFileSync(
  new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url),
  'utf8',
);

describe('independent edge infrastructure contract', () => {
  it('owns only edge resources and the two temporary compatibility networks', () => {
    expect(compose).toContain('name: shared-edge');
    expect(compose).toContain('edge:');
    expect(compose).toContain('80:80');
    expect(compose).toContain('443:443');
    expect(compose).toContain('platform-infra_default');
    expect(compose).toContain('zeiterfassung_default');
    expect(compose).not.toMatch(/postgres|database|docker\.sock|\/var\/run\/docker/);
  });

  it('routes public hosts only to application upstreams', () => {
    expect(caddy).toContain('{$CATERING_PUBLIC_HOST}');
    expect(caddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(caddy).toContain('{$ZEITERFASSUNG_PUBLIC_HOST}');
    expect(caddy).toContain('reverse_proxy {$ZEITERFASSUNG_UPSTREAM}');
    expect(caddy).toContain('{$EVENTOS_PUBLIC_HOST}');
    expect(caddy).toContain('reverse_proxy {$EVENTOS_UPSTREAM}');
  });

  it('uses the canonical Catering internal HTTP listener without an unnecessary TLS hop', () => {
    expect(platformCompose).toContain('CATERING_SITE_ADDRESS: ${CATERING_SITE_ADDRESS:-:80}');
    expect(compose).toContain('CATERING_UPSTREAM: ${CATERING_APP_UPSTREAM:-http://web:8081}');
    expect(envExample).toContain('CATERING_APP_UPSTREAM=http://web:8081');
    expect(envExample).not.toContain('CATERING_UPSTREAM=https://web:443');
    for (const config of [caddy, rehearsalCaddy]) {
      expect(config).not.toContain('tls_server_name {$CATERING_PUBLIC_HOST}');
      expect(config).toContain('header_up Host {$CATERING_PUBLIC_HOST}');
    }
  });

  it('uses candidate identities as the rehearsal gate and reserves public-host smoke checks for cutover', () => {
    expect(deployScript).toContain(
      'if [[ "${EDGE_MODE}" == "rehearsal" ]]; then probe_rehearsal_listener; fi',
    );
    expect(deployScript).toContain('if [[ "${EDGE_MODE}" == "cutover" ]]; then');
    expect(deployScript).toContain(
      'bash "${SCRIPT_DIR}/smoke-all.sh"',
    );
    expect(deployScript).toContain(
      'Skipping managed public-host smoke checks in rehearsal mode; candidate identities are authoritative.',
    );
  });

  it('uses the canonical production Zeiterfassung container and migrates only the known legacy upstream under the host lock', () => {
    expect(compose).toContain(
      'ZEITERFASSUNG_UPSTREAM: ${ZEITERFASSUNG_UPSTREAM:-zeiterfassung-app-1:3040}',
    );
    expect(envExample).toContain('ZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040');
    expect(envExample).not.toContain('ZEITERFASSUNG_UPSTREAM=app:3040');

    const acquireIndex = deployScript.indexOf('acquire_edge_lock\n');
    const migrateCallIndex = deployScript.indexOf('migrate_legacy_zeiterfassung_upstream\n');
    const snapshotIndex = deployScript.indexOf('echo "Creating edge rollback snapshot..."');
    expect(acquireIndex).toBeGreaterThan(-1);
    expect(migrateCallIndex).toBeGreaterThan(acquireIndex);
    expect(snapshotIndex).toBeGreaterThan(migrateCallIndex);

    const migrationStart = deployScript.indexOf('migrate_legacy_zeiterfassung_upstream() {');
    const migrationEnd = deployScript.indexOf('\n}\n\nrelease_edge_lock() {', migrationStart);
    const migration = deployScript.slice(migrationStart, migrationEnd + 3);
    expect(migrationStart).toBeGreaterThan(-1);
    expect(migrationEnd).toBeGreaterThan(migrationStart);
    expect(migration).toContain('legacy_zt="ZEITERFASSUNG_UPSTREAM=app:3040"');
    expect(migration).toContain('canonical_zt="ZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040"');
    expect(migration).toContain('grep -Fxq "$legacy_zt"');
    expect(migration).toContain('sudo mv -f "$pending" "${edge_path}/.env"');
    expect(migration).toContain('Protected edge .env Zeiterfassung upstream migrated atomically.');
  });
});
