import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const script = readFileSync(
  new URL('../edge-infra/scripts/cutover-hetzner.sh', import.meta.url),
  'utf8',
);
const workflow = readFileSync(
  new URL('../.github/workflows/cutover-edge-production.yml', import.meta.url),
  'utf8',
);

describe('shared edge cutover orchestrator', () => {
  it('rehearses first, releases only Catering web ports, then performs cutover', () => {
    expect(script).toContain('EDGE_MODE=rehearsal');
    expect(script).toContain('docker-compose.edge-cutover.yml');
    expect(script).toContain('--no-deps --force-recreate --no-build web');
    expect(script).toContain('EDGE_MODE=cutover');
  });

  it('restores Catering web port ownership if cutover fails', () => {
    expect(script).toContain('restore_catering_web_ports');
    expect(script).toContain('trap');
    expect(script).toMatch(/docker-compose\.yml[\s\S]*docker-compose\.production\.yml[\s\S]*--no-deps --force-recreate --no-build web/);
  });

  it('proves unrelated application container identities are preserved', () => {
    for (const service of ['postgres', 'intake', 'offer', 'production', 'exports']) {
      expect(script).toContain(service);
    }
    expect(script).toContain('zeiterfassung-app-1');
    expect(script).toContain('commcats-eventos-app');
    expect(script).toContain('container identity changed');
  });

  it('uses a dedicated production workflow and never turns the rehearsal workflow into cutover', () => {
    expect(workflow).toContain('name: Cut over shared edge production');
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('cutover-hetzner.sh');
    expect(workflow).toContain('${{ github.sha }}');
  });
});
