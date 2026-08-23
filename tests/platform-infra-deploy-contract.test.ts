import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(new URL('../platform-infra/scripts/deploy-hetzner.sh', import.meta.url), 'utf8');

describe('platform production deploy compose contract', () => {
  it('renders the stable base plus production set, then mutates only through the full edge chain', () => {
    expect(deploy).toContain("test -f docker-compose.production.yml || { echo 'Missing platform-infra/docker-compose.production.yml on server.'; exit 1; }");
    expect(deploy).toMatch(
      /docker compose\s+\\?\s*-f docker-compose\.yml\s+\\?\s*-f docker-compose\.production\.yml\s+\\?\s*config\s+>\/dev\/null/
    );
    expect(deploy).toMatch(/docker compose[\s\S]*-f docker-compose\.edge-cutover\.yml[\s\S]*up --build -d/);
    expect(deploy).not.toMatch(/docker compose\s+\\?\s*-f docker-compose\.yml\s+\\?\s*-f docker-compose\.production\.yml\s+\\?\s*up --build -d/);
    expect(deploy).not.toMatch(/\bdocker compose up --build -d\b/);
  });
});
