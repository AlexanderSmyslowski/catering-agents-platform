import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const rehearsalCaddy = readFileSync(new URL('../edge-infra/Caddyfile.rehearsal', import.meta.url), 'utf8');

describe('edge Catering rehearsal contract', () => {
  it('verifies Catering identity on the unauthenticated rehearsal listener', () => {
    expect(rehearsalCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(rehearsalCaddy).not.toMatch(/basic_auth|basicauth/);
    expect(deploy).toContain('probe_status_ok_json');
    expect(deploy).toContain('"status"[[:space:]]*:[[:space:]]*"ok"');
    expect(deploy).toContain('probe_status_ok_json "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/api/intake/health"');
    expect(deploy).not.toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/" "401"');
    expect(deploy).not.toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/" "200"');
  });
});
