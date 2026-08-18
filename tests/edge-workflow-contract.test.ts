import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/deploy-edge-production.yml', import.meta.url), 'utf8');
const rehearsal = readFileSync(new URL('../edge-infra/docker-compose.rehearsal.yml', import.meta.url), 'utf8');

describe('edge workflow contract', () => {
  it('has an independent lock and exact edge entrypoint', () => {
    expect(workflow).toContain('group: shared-edge-production-deploy');
    expect(workflow).toContain('bash edge-infra/scripts/deploy-hetzner.sh');
    expect(workflow).not.toContain('platform-infra/scripts/deploy-hetzner.sh');
  });

  it('supports a no-cutover rehearsal binding', () => {
    expect(rehearsal).toContain('127.0.0.1:18080:80');
    expect(rehearsal).not.toContain('18443:443');
  });

  it('cannot expose cutover from GitHub Actions before the cutover task is armed', () => {
    expect(workflow).toContain('EDGE_MODE: rehearsal');
    expect(workflow).not.toContain('edge_mode:');
    expect(workflow).not.toContain('- cutover');
    expect(workflow).not.toContain('inputs.edge_mode');
  });
});
