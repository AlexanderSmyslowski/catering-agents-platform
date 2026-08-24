import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(
  new URL('../platform-infra/scripts/deploy-hetzner.sh', import.meta.url),
  'utf8'
);

describe('Hetzner deploy manifest write permissions', () => {
  it('keeps the atomic manifest replace while performing target-directory writes through sudo', () => {
    expect(deploy).toContain('| sudo tee "${temporary}" >/dev/null');
    expect(deploy).toContain('sudo mv "${temporary}" "${manifest}"');
    expect(deploy).not.toContain('> "${temporary}"');
    expect(deploy).not.toContain('\n  mv "${temporary}" "${manifest}"');
  });
});
