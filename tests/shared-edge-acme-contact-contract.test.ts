import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/cutover-edge-production.yml', import.meta.url),
  'utf8',
);
const cutover = readFileSync(
  new URL('../edge-infra/scripts/cutover-hetzner.sh', import.meta.url),
  'utf8',
);

describe('shared edge production ACME contact contract', () => {
  it('requires an explicit non-example Caddy email and migrates only the known bootstrap placeholder', () => {
    expect(workflow).toContain('CADDY_EMAIL: ${{ secrets.CADDY_EMAIL }}');
    expect(workflow).toContain('test -n "$CADDY_EMAIL"');
    expect(cutover).toContain('CADDY_EMAIL="${CADDY_EMAIL:?Set CADDY_EMAIL}"');
    expect(cutover).toContain("printf 'CADDY_EMAIL=%q\\n' \"${CADDY_EMAIL}\"");
    expect(cutover).toContain('ensure_production_caddy_email');
    expect(cutover).toContain('ops@example.com');
    expect(cutover).toContain('refusing to overwrite it');
    expect(cutover).toContain('migrated atomically from bootstrap placeholder');
  });
});
