import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/deploy-edge-production.yml', import.meta.url),
  'utf8',
);

describe('edge env bootstrap safety contract', () => {
  it('keeps the protected env readable only by the non-root deploy user', () => {
    expect(workflow).toContain('deploy_uid="$(id -u)"');
    expect(workflow).toContain('deploy_gid="$(id -g)"');
    expect(workflow).toContain('-o "$deploy_uid" -g "$deploy_gid" -m 0600');
    expect(workflow).not.toContain('sudo tee /opt/shared-edge/.env');
  });

  it('publishes a complete bootstrap atomically instead of writing the live env in place', () => {
    expect(workflow).toContain('pending="${edge_path}/.env.pending.$$"');
    expect(workflow).toContain('sudo install -o "$deploy_uid" -g "$deploy_gid" -m 0600 "$tmp" "$pending"');
    expect(workflow).toContain('sudo mv -f "$pending" "${edge_path}/.env"');

    const stage = workflow.indexOf('sudo install -o "$deploy_uid" -g "$deploy_gid" -m 0600 "$tmp" "$pending"');
    const publish = workflow.indexOf('sudo mv -f "$pending" "${edge_path}/.env"');
    expect(stage).toBeGreaterThanOrEqual(0);
    expect(publish).toBeGreaterThan(stage);
  });
});
