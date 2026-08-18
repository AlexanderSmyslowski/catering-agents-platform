import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('../edge-infra/scripts/smoke-all.sh', import.meta.url), 'utf8');
const rehearsal = readFileSync(new URL('../edge-infra/docker-compose.rehearsal.yml', import.meta.url), 'utf8');

describe('edge deploy safety contract', () => {
  it('uses an explicit project and never tears down application projects', () => {
    expect(deploy).toContain('docker compose -p shared-edge');
    expect(deploy).not.toMatch(/docker compose down|docker system prune|docker network prune|docker volume prune/);
  });

  it('checks every managed public application after the edge change', () => {
    expect(smoke).toContain('/healthz');
    expect(smoke).toContain('/readyz');
    expect(smoke).toContain('/api/public/config');
    expect(smoke).toContain('EVENTOS_SMOKE_URL');
    expect(smoke).toContain('CATERING_SMOKE_URL');
  });

  it('probes the new rehearsal listener locally instead of mistaking the old public proxy for the candidate', () => {
    expect(rehearsal).toContain('127.0.0.1:18080:80');
    expect(rehearsal).not.toContain('18443:443');
    expect(deploy).toContain('probe_rehearsal_listener');
    expect(deploy).toContain('http://127.0.0.1:18080');
    expect(deploy).toContain('--header "Host: ${host}"');
    expect(deploy).toContain('probe "Rehearsal Zeiterfassung" "${ZEITERFASSUNG_SMOKE_HOST}"');
    expect(deploy).toContain('probe "Rehearsal EventOS" "${EVENTOS_SMOKE_HOST}"');
    expect(deploy).toContain('probe "Rehearsal Catering" "${CATERING_SMOKE_HOST}"');
  });
});
