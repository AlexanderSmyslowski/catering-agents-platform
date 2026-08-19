import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(new URL('../edge-infra/docker-compose.yml', import.meta.url), 'utf8');
const caddy = readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url), 'utf8');
const rehearsalCaddy = readFileSync(new URL('../edge-infra/Caddyfile.rehearsal', import.meta.url), 'utf8');

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

  it('uses the Catering internal HTTPS listener with the public hostname as TLS SNI', () => {
    expect(compose).toContain('CATERING_UPSTREAM: ${CATERING_UPSTREAM:-https://web:443}');
    for (const config of [caddy, rehearsalCaddy]) {
      expect(config).toContain('tls_server_name {$CATERING_PUBLIC_HOST}');
    }
  });
});
