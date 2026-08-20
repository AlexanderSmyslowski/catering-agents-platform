import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync(
  new URL('../platform-infra/scripts/deploy-web-listener-hetzner.sh', import.meta.url),
  'utf8',
);
const workflow = readFileSync(
  new URL('../.github/workflows/deploy-catering-web-listener.yml', import.meta.url),
  'utf8',
);

describe('isolated Catering web listener deployment', () => {
  it('recreates only web and proves the exact intake identity on the dedicated internal listener', () => {
    expect(deploy).toContain('DEPLOY_COMMIT_SHA');
    expect(deploy).toContain('docker compose');
    expect(deploy).toContain('build web');
    expect(deploy).toMatch(/up -d --no-deps --force-recreate --no-build web/);
    expect(deploy).not.toMatch(/up --build -d/);
    expect(deploy).not.toMatch(/up -d\s*$/m);

    expect(deploy).toContain('http://127.0.0.1:8081/api/intake/health');
    expect(deploy).toContain('Authorization: Basic');
    expect(deploy).toContain('payload.get("status") != "ok"');
    expect(deploy).toContain('payload.get("service") != "intake-service"');
  });

  it('preserves protected state and restores the previous web image on a failed listener probe', () => {
    expect(deploy).toContain('--exclude "platform-infra/.env"');
    expect(deploy).toContain('--exclude "platform-infra/sites"');
    expect(deploy).toContain('--exclude "data"');
    expect(deploy).toContain('previous_web_image_id');
    expect(deploy).toContain('previous_web_image_ref');
    expect(deploy).toContain('rollback_web');
    expect(deploy).toContain('docker image tag');
    expect(deploy).toMatch(/up -d --no-deps --force-recreate --no-build web/);
  });

  it('is an explicit manual exact-commit workflow using the production environment', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('uses: actions/checkout@v5');
    expect(workflow).toContain('DEPLOY_COMMIT_SHA: ${{ github.sha }}');
    expect(workflow).toContain('bash platform-infra/scripts/deploy-web-listener-hetzner.sh');
  });
});
