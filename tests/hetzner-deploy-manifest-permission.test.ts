import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(
  new URL('../platform-infra/scripts/deploy-hetzner.sh', import.meta.url),
  'utf8'
);

describe('Hetzner deploy manifest write permissions', () => {
  it('writes the server-owned deploy manifest through sudo instead of redirecting as the deploy user', () => {
    expect(deploy).toMatch(/printf '%s\\n'[\s\S]*\| sudo tee \\\"\\\$\{manifest\}\\\" >\/dev\/null/);
    expect(deploy).not.toContain('> \\\"\\${temporary}\\\"');
  });
});
