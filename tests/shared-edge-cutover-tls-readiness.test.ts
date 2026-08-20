import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(
  new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url),
  'utf8',
);

describe('shared edge cutover TLS readiness', () => {
  it('waits for public TLS readiness before running the strict public smoke suite', () => {
    expect(deploy).toContain('wait_for_cutover_tls');
    expect(deploy).toContain('EDGE_MODE');
    expect(deploy).toContain('curl --silent --show-error --fail --max-time 5');
    expect(deploy).toContain('Public edge TLS did not become ready');
    expect(deploy).toMatch(/if \[\[ "\$\{EDGE_MODE\}" == "cutover" \]\]; then[\s\S]*wait_for_cutover_tls/);
  });
});
