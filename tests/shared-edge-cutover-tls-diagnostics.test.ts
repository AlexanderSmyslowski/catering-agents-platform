import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const diagnostic = readFileSync(
  new URL('../edge-infra/scripts/diagnose-edge-tls-storage.sh', import.meta.url),
  'utf8',
);
const workflow = readFileSync(
  new URL('../.github/workflows/diagnose-edge-tls.yml', import.meta.url),
  'utf8',
);

describe('shared edge TLS diagnostics', () => {
  it('collects safe certificate-store and DNS evidence without exposing key contents', () => {
    expect(diagnostic).toContain('Shared-edge TLS storage diagnostic');
    expect(diagnostic).toContain('docker volume ls');
    expect(diagnostic).toContain('edge_caddy_data');
    expect(diagnostic).toContain('find /data/caddy/certificates');
    expect(diagnostic).toContain('getent ahostsv4');
    expect(diagnostic).not.toMatch(/cat .*\.key/);
    expect(diagnostic).not.toContain('printenv');
  });

  it('exposes the diagnostic only as an explicit production workflow dispatch', () => {
    expect(workflow).toContain('name: Diagnose shared edge TLS');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('bash edge-infra/scripts/diagnose-edge-tls-storage.sh');
  });
});
