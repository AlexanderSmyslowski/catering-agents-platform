import { spawnSync } from 'node:child_process';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workflow = readFileSync(
  new URL('../.github/workflows/deploy-edge-production.yml', import.meta.url),
  'utf8',
);
const sandboxes: string[] = [];

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

function extractRemoteBootstrapScript(edgePath: string): string {
  const startMarker = "<<'REMOTE_SCRIPT'\n";
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf('\n          REMOTE_SCRIPT', start);

  if (start < 0 || end < 0) {
    throw new Error('Remote bootstrap script markers not found');
  }

  return workflow
    .slice(start + startMarker.length, end)
    .replace(/^ {10}/gm, '')
    .replace('edge_path="/opt/shared-edge"', `edge_path=${JSON.stringify(edgePath)}`);
}

function runRemoteBootstrap(injectConcurrentEnv?: string) {
  const sandbox = mkdtempSync(join(tmpdir(), 'edge-env-bootstrap-'));
  sandboxes.push(sandbox);

  const edgePath = join(sandbox, 'shared-edge');
  const sourcePath = join(sandbox, 'source.env');
  const scriptPath = join(sandbox, 'bootstrap.sh');
  const binPath = join(sandbox, 'bin');
  const defaults = 'SHARED_EDGE_CADDY_IMAGE=caddy:2.10.2-alpine\n';

  mkdirSync(binPath);
  writeFileSync(sourcePath, defaults);
  writeFileSync(scriptPath, extractRemoteBootstrapScript(edgePath));
  writeFileSync(
    join(binPath, 'sudo'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ -n "\${INJECT_CONCURRENT_ENV:-}" && ( "\${1:-}" == "ln" || "\${1:-}" == "mv" ) ]]; then
  destination="\${!#}"
  printf '%s' "$INJECT_CONCURRENT_ENV" > "$destination"
fi
exec "$@"
`,
  );
  chmodSync(join(binPath, 'sudo'), 0o755);

  const result = spawnSync('bash', [scriptPath, sourcePath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binPath}:${process.env.PATH ?? ''}`,
      INJECT_CONCURRENT_ENV: injectConcurrentEnv ?? '',
    },
  });

  return {
    defaults,
    edgePath,
    result,
  };
}

describe('edge env bootstrap safety contract', () => {
  it('keeps the protected env readable only by the non-root deploy user', () => {
    expect(workflow).toContain('deploy_uid="$(id -u)"');
    expect(workflow).toContain('deploy_gid="$(id -g)"');
    expect(workflow).toContain('-o "$deploy_uid" -g "$deploy_gid" -m 0600');
    expect(workflow).not.toContain('sudo tee /opt/shared-edge/.env');
  });

  it('publishes a complete bootstrap atomically without overwriting a concurrent env', () => {
    const stageCommand = 'sudo install -o "$deploy_uid" -g "$deploy_gid" -m 0600 "$tmp" "$pending"';
    const publishCommand = 'sudo ln "$pending" "${edge_path}/.env"';

    expect(workflow).toContain('pending="${edge_path}/.env.pending.$$"');
    expect(workflow).toContain(stageCommand);
    expect(workflow).toContain(publishCommand);
    expect(workflow).not.toContain('sudo mv -f "$pending" "${edge_path}/.env"');

    const stage = workflow.indexOf(stageCommand);
    const publish = workflow.indexOf(publishCommand);
    expect(stage).toBeGreaterThanOrEqual(0);
    expect(publish).toBeGreaterThan(stage);
  });

  it('publishes complete defaults with protected mode when the env remains absent', () => {
    const { defaults, edgePath, result } = runRemoteBootstrap();
    const envPath = join(edgePath, '.env');

    expect(result.status).toBe(0);
    expect(readFileSync(envPath, 'utf8')).toBe(defaults);
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
    expect(readdirSync(edgePath).filter((name) => name.startsWith('.env.pending.'))).toEqual([]);
  });

  it('leaves an env created at the publication boundary byte-for-byte unchanged', () => {
    const operatorEnv = 'SHARED_EDGE_CADDY_IMAGE=operator-managed\n';
    const { edgePath, result } = runRemoteBootstrap(operatorEnv);

    expect(result.status).toBe(0);
    expect(readFileSync(join(edgePath, '.env'), 'utf8')).toBe(operatorEnv);
    expect(result.stdout).toContain('appeared concurrently; leaving it unchanged.');
    expect(readdirSync(edgePath).filter((name) => name.startsWith('.env.pending.'))).toEqual([]);
  });
});
