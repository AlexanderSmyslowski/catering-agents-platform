import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const rehearsalCaddy = readFileSync(new URL('../edge-infra/Caddyfile.rehearsal', import.meta.url), 'utf8');
const productionCaddy = readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url), 'utf8');
const edgeEnv = readFileSync(new URL('../edge-infra/.env.example', import.meta.url), 'utf8');
const platformCompose = readFileSync(new URL('../platform-infra/docker-compose.yml', import.meta.url), 'utf8');

describe('edge Catering rehearsal contract', () => {
  it('uses the app-owned Caddy on its canonical internal HTTP listener', () => {
    expect(platformCompose).toContain('CATERING_SITE_ADDRESS: ${CATERING_SITE_ADDRESS:-:80}');
    expect(edgeEnv).toContain('CATERING_UPSTREAM=http://web:80');
    expect(edgeEnv).not.toContain('CATERING_UPSTREAM=https://web:443');

    expect(rehearsalCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(productionCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(rehearsalCaddy).not.toContain('tls_server_name {$CATERING_PUBLIC_HOST}');
    expect(productionCaddy).not.toContain('tls_server_name {$CATERING_PUBLIC_HOST}');

    expect(deploy).toContain('legacy_catering="CATERING_UPSTREAM=https://web:443"');
    expect(deploy).toContain('canonical_catering="CATERING_UPSTREAM=http://web:80"');
  });

  it('authenticates and verifies the exact Intake service identity on the candidate listener', () => {
    expect(rehearsalCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(rehearsalCaddy).not.toMatch(/basic_auth|basicauth/);

    expect(deploy).toContain("printf 'CATERING_SMOKE_BASIC_AUTH_USER=%q\\n'");
    expect(deploy).toContain("printf 'CATERING_SMOKE_BASIC_AUTH_PASSWORD=%q\\n'");
    expect(deploy).toContain('--user "${CATERING_SMOKE_BASIC_AUTH_USER}:${CATERING_SMOKE_BASIC_AUTH_PASSWORD}"');

    expect(deploy).toContain('json.load');
    expect(deploy).toContain('payload.get("status") != "ok"');
    expect(deploy).toContain('payload.get("service") != "intake-service"');
    expect(deploy).toContain('probe_catering_json "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/api/intake/health"');

    expect(deploy).not.toContain('probe_status_ok_json "Rehearsal Catering"');
    expect(deploy).not.toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/" "200"');
    expect(deploy).not.toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/" "401"');
  });
});