import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const caddy = readFileSync(
  new URL('../edge-infra/Caddyfile', import.meta.url),
  'utf8',
);
const diagnostic = readFileSync(
  new URL('../edge-infra/scripts/diagnose-edge-tls-storage.sh', import.meta.url),
  'utf8',
);

describe('shared edge cutover live TLS diagnostics', () => {
  it('persists bounded Caddy runtime evidence in the shared edge data volume', () => {
    expect(caddy).toContain('log default');
    expect(caddy).toContain('output file /data/cutover-runtime.log');
    expect(caddy).toContain('roll_size 5MiB');
    expect(caddy).toContain('roll_keep 2');
  });

  it('surfaces only bounded TLS/ACME-oriented evidence after rollback', () => {
    expect(diagnostic).toContain('Persisted cutover TLS runtime evidence');
    expect(diagnostic).toContain('/data/cutover-runtime.log');
    expect(diagnostic).toContain('tail -n 250');
    expect(diagnostic).toContain('grep -Ei "tls|acme|certificate|challenge|issuer|obtain|renew|error|warn"');
    expect(diagnostic).not.toContain('printenv');
    expect(diagnostic).not.toMatch(/cat .*\.key/);
  });
});
