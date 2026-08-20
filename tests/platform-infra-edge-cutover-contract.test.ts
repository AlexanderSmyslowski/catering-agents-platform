import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const override = readFileSync(
  new URL('../platform-infra/docker-compose.edge-cutover.yml', import.meta.url),
  'utf8',
);
const deploy = readFileSync(
  new URL('../platform-infra/scripts/deploy-hetzner.sh', import.meta.url),
  'utf8',
);

describe('Catering edge cutover compatibility', () => {
  it('removes host port ownership without removing the internal web service', () => {
    expect(override).toContain('web:');
    expect(override).toContain('ports: !reset []');
  });

  it('requires an explicit edge-external switch before using the cutover override', () => {
    expect(deploy).toContain('EDGE_EXTERNAL');
    expect(deploy).toContain('docker-compose.edge-cutover.yml');
    expect(deploy).toContain('EDGE_EXTERNAL must be true or false.');
  });

  it('keeps the current production compose path as the default', () => {
    expect(deploy).toContain('COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.production.yml)');
    expect(deploy).toContain('if [[ "${EDGE_EXTERNAL}" == "true" ]]');
    expect(deploy).toContain('COMPOSE_FILES+=(-f docker-compose.edge-cutover.yml)');
  });
});
