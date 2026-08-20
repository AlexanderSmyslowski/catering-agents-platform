import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const rehearsalCaddy = readFileSync(new URL('../edge-infra/Caddyfile.rehearsal', import.meta.url), 'utf8');
const productionCaddy = readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url), 'utf8');
const edgeEnv = readFileSync(new URL('../edge-infra/.env.example', import.meta.url), 'utf8');
const edgeCompose = readFileSync(new URL('../edge-infra/docker-compose.yml', import.meta.url), 'utf8');
const platformCompose = readFileSync(new URL('../platform-infra/docker-compose.yml', import.meta.url), 'utf8');
const platformCaddy = readFileSync(new URL('../platform-infra/Caddyfile', import.meta.url), 'utf8');

describe('edge Catering rehearsal contract', () => {
  it('uses a dedicated app-owned internal HTTP listener without coupling it to the public TLS site', () => {
    expect(platformCompose).toContain('CATERING_SITE_ADDRESS: ${CATERING_SITE_ADDRESS:-:80}');
    expect(platformCaddy).toContain('{$CATERING_SITE_ADDRESS::80} {');
    expect(platformCaddy).toContain('http://:8081 {');
    expect(platformCaddy).toContain('import catering_app_routes');
    expect(platformCaddy).not.toContain('{$CATERING_SITE_ADDRESS::80}, :8081 {');

    expect(edgeEnv).toContain('CATERING_APP_UPSTREAM=http://web:8081');
    expect(edgeEnv).not.toMatch(/^CATERING_APP_UPSTREAM=http:\/\/web:80$/m);
    expect(edgeEnv).not.toContain('CATERING_UPSTREAM=https://web:443');

    expect(edgeCompose).toContain('CATERING_UPSTREAM: ${CATERING_APP_UPSTREAM:-http://web:8081}');
    expect(edgeCompose).not.toMatch(/^\s*CATERING_UPSTREAM: \$\{CATERING_APP_UPSTREAM:-http:\/\/web:80\}$/m);
    expect(edgeCompose).not.toContain('CATERING_UPSTREAM: ${CATERING_UPSTREAM:-https://web:443}');

    expect(rehearsalCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(productionCaddy).toContain('reverse_proxy {$CATERING_UPSTREAM}');
    expect(rehearsalCaddy).not.toContain('tls_server_name {$CATERING_PUBLIC_HOST}');
    expect(productionCaddy).not.toContain('tls_server_name {$CATERING_PUBLIC_HOST}');
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
