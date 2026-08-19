import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const rehearsalCaddy = readFileSync(new URL('../edge-infra/Caddyfile.rehearsal', import.meta.url), 'utf8');
const productionCaddy = readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url), 'utf8');

describe('edge Catering rehearsal contract', () => {
  it('preserves the public Catering Host header when proxying to the HTTPS app-owned Caddy', () => {
    expect(rehearsalCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(rehearsalCaddy).toContain('header_up Host {$CATERING_PUBLIC_HOST}');
    expect(productionCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(productionCaddy).toContain('header_up Host {$CATERING_PUBLIC_HOST}');
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
