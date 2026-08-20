import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(
  new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url),
  'utf8',
);

describe('shared edge cutover live TLS diagnostics', () => {
  it('captures bounded Caddy TLS evidence before any cutover rollback mutates shared-edge state', () => {
    expect(deploy).toContain('collect_cutover_tls_diagnostics');
    expect(deploy).toContain('Cutover TLS diagnostic: Caddy logs');
    expect(deploy).toContain('docker compose -p shared-edge -f docker-compose.yml --env-file .env logs --no-color --tail 200 edge');
    expect(deploy).toContain('Cutover TLS diagnostic: local handshake');
    expect(deploy).toContain('curl --resolve');
    expect(deploy).toMatch(/rollback_edge_candidate\(\)[\s\S]*collect_cutover_tls_diagnostics[\s\S]*Edge candidate failed/);
  });
});
