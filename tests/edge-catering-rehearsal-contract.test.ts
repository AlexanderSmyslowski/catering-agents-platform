import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const rehearsalCaddy = readFileSync(new URL('../edge-infra/Caddyfile.rehearsal', import.meta.url), 'utf8');

describe('edge Catering rehearsal contract', () => {
  it('expects the unauthenticated rehearsal listener to reach the Catering app successfully', () => {
    expect(rehearsalCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(rehearsalCaddy).not.toMatch(/basic_auth|basicauth/);
    expect(deploy).toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/" "200"');
    expect(deploy).not.toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}" "/" "401"');
  });
});
