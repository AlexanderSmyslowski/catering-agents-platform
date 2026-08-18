import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../platform-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');

describe('platform production deploy compose contract', () => {
  it('requires and uses the production compose override', () => {
    expect(deploy).toContain("test -f docker-compose.production.yml || { echo 'Missing platform-infra/docker-compose.production.yml on server.'; exit 1; }");
    expect(deploy).toContain('compose_files=(-f docker-compose.yml -f docker-compose.production.yml)');
    expect(deploy).toContain('config >/dev/null');
    expect(deploy).toContain('up --build -d');
    expect(deploy).toContain('compose_files[@]');
    expect(deploy).not.toMatch(/\bdocker compose up --build -d\b/);
  });
});
