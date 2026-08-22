import { accessSync, chmodSync, constants, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const workflowPath = new URL('../.github/workflows/post-cutover-evidence.yml', import.meta.url);
const helperPath = new URL('../edge-infra/scripts/post-cutover-evidence.sh', import.meta.url);
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
const helper = existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : '';

const helperFile = fileURLToPath(helperPath);
const caddyfileSha256 = createHash('sha256')
  .update(readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url)))
  .digest('hex');
const originalProcessPath = process.env.PATH ?? '';

function resolveExecutableFromPath(executable: string, pathValue: string): string {
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, executable);
    try {
      if (statSync(candidate).isFile()) {
        accessSync(candidate, constants.X_OK);
        return candidate;
      }
    } catch (_error) {
      // Keep searching so a missing or inaccessible PATH entry cannot run a fixture.
    }
  }
  throw new Error(`Unable to resolve ${executable} from original PATH: ${pathValue}`);
}

function createRunnerFixture() {
  const root = mkdtempSync(join(tmpdir(), 'post-cutover-evidence-runner-'));
  const sshDir = join(root, '.ssh');
  mkdirSync(sshDir, { recursive: true });
  writeFileSync(join(sshDir, 'id_ed25519'), 'fixture-private-key\n', { mode: 0o600 });
  writeFileSync(join(sshDir, 'known_hosts'), 'fixture-known-host\n', { mode: 0o600 });
  const sshLog = join(root, 'ssh-called');
  const sshStub = join(root, 'ssh');
  writeFileSync(
    sshStub,
    '#!/usr/bin/env bash\nprintf "%s\\n" called > "$SSH_LOG"\nexit 99\n',
    { mode: 0o700 },
  );
  chmodSync(sshStub, 0o700);
  return { root, sshLog };
}

function validHelperEnvironment(fixture: ReturnType<typeof createRunnerFixture>): Record<string, string | undefined> {
  return {
    ...process.env,
    HOME: fixture.root,
    PATH: `${fixture.root}:${process.env.PATH ?? ''}`,
    SSH_LOG: fixture.sshLog,
    DEPLOY_HOST: 'hetzner.example',
    DEPLOY_USER: 'deploy',
    EDGE_DEPLOY_PATH: '/opt/shared-edge',
    EDGE_ROLLBACK_ROOT: '/opt/shared-edge-rollbacks',
    EXPECTED_CUTOVER_COMMIT: '6703d2aa9bb426c7f44d6601306dc623219741be',
    CUTOVER_RUN_ID: '32417734936',
    CATERING_SMOKE_URL: 'https://catering.the-one.catering',
    ZEITERFASSUNG_SMOKE_URL: 'https://zeit.the-one.catering',
    EVENTOS_SMOKE_URL: 'https://eventos.commcats.de',
    CATERING_SMOKE_BASIC_AUTH_USER: 'fixture-user',
    CATERING_SMOKE_BASIC_AUTH_PASSWORD: 'fixture-password',
    EVIDENCE_CONTEXT: 'github-production',
    EXPECTED_CADDYFILE_SHA256: caddyfileSha256,
    GITHUB_ACTIONS: 'true',
    GITHUB_REF_NAME: 'main',
  };
}

function runHelper(environment: Record<string, string | undefined>) {
  return spawnSync('bash', [helperFile], {
    env: environment,
    encoding: 'utf8',
  });
}

function extractFunction(source: string, name: string) {
  const match = source.match(new RegExp(`${name}\\(\\) \\{[\\s\\S]*?\\n\\}`, 'm'));
  if (!match) throw new Error(`Missing helper function ${name}`);
  return match[0];
}

function createZeiterfassungProvenanceFixture(overrides: {
  targetRoot?: string;
  releaseName?: string;
  version?: string;
  gitSha?: string;
  currentTarget?: string;
} = {}) {
  const root = overrides.targetRoot ?? mkdtempSync(join(tmpdir(), 'zeiterfassung-deploy-'));
  const releaseName = overrides.releaseName ?? '0123456789ab-20260821T120000Z';
  const releasePath = join(root, releaseName);
  mkdirSync(releasePath, { recursive: true });
  writeFileSync(join(releasePath, 'package.json'), JSON.stringify({ version: overrides.version ?? '1.2.3' }));
  writeFileSync(join(releasePath, '.release-git-sha'), `${overrides.gitSha ?? '0123456789abcdef0123456789abcdef01234567'}\n`);
  symlinkSync(overrides.currentTarget ?? releasePath, join(root, 'current'));
  return { root, releasePath, currentPath: join(root, 'current') };
}

function runExtractedFunction(
  functionSource: string,
  script: string,
  environment: Record<string, string | undefined> = {},
  timeoutMs = 30000,
) {
  return spawnSync('bash', ['-c', `set -euo pipefail\nfail() { printf '%s\\n' "$1"; exit 1; }\nremote_fail() { fail "$1"; }\n${functionSource}\n${script}`], {
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
  });
}

function inventoryFixture(overrides: {
  labels?: Record<string, string>;
  networks?: Record<string, string>;
  owner80?: string;
  foreignMember?: boolean;
} = {}, includeIranmonitor = true) {
  const idFor = (index: number) => index.toString(16).padStart(2, '0').repeat(32);
  const state = (
    component: string,
    id: string,
    name: string,
    project: string,
    service: string,
    networks: string,
  ) => [
    'STATE', component, id, name, 'fixture:image', 'running', '2026-08-21T00:00:00Z', '0', '', networks,
    project, service, 'False', '1', networks,
  ].join('\t');
  const iranmonitorState = (
    component: string,
    id: string,
    name: string,
    image: string,
    service: string,
    ports: string,
    networks: string,
  ) => [
    'STATE', component, id, name, image, 'running', '2026-08-21T00:00:00Z', '0', ports, networks,
    'deploy', service, 'False', '1', networks,
  ].join('\t');
  const network = (name: string, id: string, members: string) =>
    ['NETWORK', name, id, 'bridge', 'local', members].join('\t');
  const entries: Record<string, string> = {
    'shared-edge': state('shared-edge', idFor(1), 'shared-edge-edge-1', 'shared-edge', 'edge', 'platform-infra_default=edge,shared-edge-edge-1;zeiterfassung_default=edge,shared-edge-edge-1;'),
    'catering-web': state('catering-web', idFor(2), 'platform-infra-web-1', 'platform-infra', 'web', 'platform-infra_default=web,platform-infra-web-1;zeiterfassung_default=web,platform-infra-web-1;'),
    'catering-postgres': state('catering-postgres', idFor(3), 'platform-infra-postgres-1', 'platform-infra', 'postgres', 'platform-infra_default=postgres,platform-infra-postgres-1;'),
    'catering-intake': state('catering-intake', idFor(4), 'platform-infra-intake-1', 'platform-infra', 'intake', 'platform-infra_default=intake,platform-infra-intake-1;'),
    'catering-offer': state('catering-offer', idFor(5), 'platform-infra-offer-1', 'platform-infra', 'offer', 'platform-infra_default=offer,platform-infra-offer-1;'),
    'catering-production': state('catering-production', idFor(6), 'platform-infra-production-1', 'platform-infra', 'production', 'platform-infra_default=production,platform-infra-production-1;'),
    'catering-exports': state('catering-exports', idFor(7), 'platform-infra-exports-1', 'platform-infra', 'exports', 'platform-infra_default=exports,platform-infra-exports-1;'),
    'zeiterfassung-app': state('zeiterfassung-app', idFor(8), 'zeiterfassung-app-1', 'zeiterfassung', 'app', 'zeiterfassung_default=app,zeiterfassung-app-1;'),
    'eventos-app': state('eventos-app', idFor(9), 'commcats-eventos-app', 'commcats-eventos', 'app', 'commcats-eventos_default=app,commcats-eventos-app;platform-infra_default=app,commcats-eventos-app;'),
    'eventos-postgres': state('eventos-postgres', idFor(10), 'commcats-eventos-postgres', 'commcats-eventos', 'postgres', 'commcats-eventos_default=postgres,commcats-eventos-postgres;'),
  };
  if (includeIranmonitor) {
    entries['iranmonitor-web'] = iranmonitorState('iranmonitor-web', idFor(14), 'deploy-web-1', 'deploy-web', 'web', '0.0.0.0:3000->3000/tcp;', 'deploy_default=web,deploy-web-1;');
    entries['iranmonitor-ingest'] = iranmonitorState('iranmonitor-ingest', idFor(15), 'deploy-ingest-1', 'deploy-ingest', 'ingest', 'none', 'deploy_default=ingest,deploy-ingest-1;');
    entries['iranmonitor-db'] = iranmonitorState('iranmonitor-db', idFor(16), 'deploy-db-1', 'postgres:16-alpine', 'db', '127.0.0.1:5432->5432/tcp;', 'deploy_default=db,deploy-db-1;');
  }
  for (const [component, replacement] of Object.entries(overrides.networks ?? {})) {
    const fields = entries[component].split('\t');
    fields[9] = replacement;
    fields[14] = replacement;
    entries[component] = fields.join('\t');
  }
  for (const [component, replacement] of Object.entries(overrides.labels ?? {})) {
    const fields = entries[component].split('\t');
    fields[11] = replacement;
    entries[component] = fields.join('\t');
  }
  const platformMembers = [
    'commcats-eventos-app=app,commcats-eventos-app',
    'platform-infra-exports-1=exports,platform-infra-exports-1',
    'platform-infra-intake-1=intake,platform-infra-intake-1',
    'platform-infra-offer-1=offer,platform-infra-offer-1',
    'platform-infra-postgres-1=postgres,platform-infra-postgres-1',
    'platform-infra-production-1=production,platform-infra-production-1',
    'platform-infra-web-1=web,platform-infra-web-1',
    'shared-edge-edge-1=edge,shared-edge-edge-1',
  ];
  if (overrides.foreignMember) platformMembers.push('foreign=foreign');
  const lines = [
    ...Object.values(entries),
    'NETWORK_LS\tplatform-infra_default\t' + idFor(11) + '\tbridge\tlocal',
    'NETWORK_LS\tzeiterfassung_default\t' + idFor(12) + '\tbridge\tlocal',
    'NETWORK_LS\tcommcats-eventos_default\t' + idFor(13) + '\tbridge\tlocal',
    network('platform-infra_default', idFor(11), `${platformMembers.join(';')};`),
    network('zeiterfassung_default', idFor(12), 'platform-infra-web-1=web,platform-infra-web-1;shared-edge-edge-1=edge,shared-edge-edge-1;zeiterfassung-app-1=app,zeiterfassung-app-1;'),
    network('commcats-eventos_default', idFor(13), 'commcats-eventos-app=app,commcats-eventos-app;commcats-eventos-postgres=postgres,commcats-eventos-postgres;'),
    `PORT_OWNER\t80\t${idFor(1)}\t${overrides.owner80 ?? 'shared-edge-edge-1'}`,
    `PORT_OWNER\t443\t${idFor(1)}\tshared-edge-edge-1`,
  ];
  if (includeIranmonitor) {
    lines.push(
      'NETWORK_LS\tdeploy_default\t' + idFor(17) + '\tbridge\tlocal',
      network('deploy_default', idFor(17), 'deploy-db-1=db,deploy-db-1;deploy-ingest-1=ingest,deploy-ingest-1;deploy-web-1=web,deploy-web-1;'),
    );
  }
  return lines.join('\n');
}

function iranmonitorInventoryFixture(overrides: {
  web?: Partial<{ id: string; image: string; status: string; restart: string; networks: string; ports: string }>;
  ingest?: Partial<{ id: string; image: string; status: string; restart: string; networks: string; ports: string }>;
  db?: Partial<{ id: string; image: string; status: string; restart: string; networks: string; ports: string }>;
  extra?: boolean;
  foreignMember?: boolean;
} = {}) {
  const idFor = (index: number) => index.toString(16).padStart(2, '0').repeat(32);
  const record = (
    component: string,
    id: string,
    name: string,
    image: string,
    status: string,
    restart: string,
    ports: string,
    networks: string,
    project = 'deploy',
    service: string,
  ) => [
    'STATE', component, id, name, image, status, '2026-08-21T00:00:00Z', restart, ports, networks,
    project, service, 'False', '1', networks,
  ].join('\t');
  const web = { id: idFor(20), image: 'deploy-web', status: 'running', restart: '0', ports: '0.0.0.0:3000->3000/tcp;', networks: 'deploy_default=web,deploy-web-1;', ...overrides.web };
  const ingest = { id: idFor(21), image: 'deploy-ingest', status: 'running', restart: '0', ports: 'none', networks: 'deploy_default=ingest,deploy-ingest-1;', ...overrides.ingest };
  const db = { id: idFor(22), image: 'postgres:16-alpine', status: 'running', restart: '0', ports: '127.0.0.1:5432->5432/tcp;', networks: 'deploy_default=db,deploy-db-1;', ...overrides.db };
  const members = [
    'deploy-db-1=db,deploy-db-1',
    'deploy-ingest-1=ingest,deploy-ingest-1',
    'deploy-web-1=web,deploy-web-1',
  ];
  if (overrides.foreignMember) members.push('foreign-deploy=foreign');
  if (overrides.extra) members.push('deploy-worker-1=worker,deploy-worker-1');
  const extra = overrides.extra
    ? record('iranmonitor-extra', idFor(23), 'deploy-worker-1', 'deploy-worker', 'running', '0', 'none', 'deploy_default=worker,deploy-worker-1;', 'deploy', 'worker')
    : undefined;
  return [
    inventoryFixture({}, false),
    record('iranmonitor-web', web.id, 'deploy-web-1', web.image, web.status, web.restart, web.ports, web.networks, 'deploy', 'web'),
    record('iranmonitor-ingest', ingest.id, 'deploy-ingest-1', ingest.image, ingest.status, ingest.restart, ingest.ports, ingest.networks, 'deploy', 'ingest'),
    record('iranmonitor-db', db.id, 'deploy-db-1', db.image, db.status, db.restart, db.ports, db.networks, 'deploy', 'db'),
    extra,
    `NETWORK_LS\tdeploy_default\t${idFor(24)}\tbridge\tlocal`,
    `NETWORK\tdeploy_default\t${idFor(24)}\tbridge\tlocal\t${members.join(';')};`,
  ].filter((line): line is string => Boolean(line)).join('\n');
}

function createFakeRemoteFixture(kind: string, originalPath = originalProcessPath) {
  const realSha256sum = resolveExecutableFromPath('sha256sum', originalPath);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'post-cutover-evidence-remote-')));
  const edgePath = join(root, 'shared-edge');
  const rollbackRoot = join(root, 'shared-edge-rollbacks');
  const eventosRoot = join(root, 'commcats-eventos');
  const zeiterfassungRoot = join(root, 'zeiterfassung-deploy');
  const procRoot = join(root, 'proc-fixture');
  const archiveContent = join(root, 'rollback-content');
  const eventosRelease = join(eventosRoot, 'releases', 'a'.repeat(12) + '-20260821T120000Z');
  const zeiterfassungRelease = join(zeiterfassungRoot, '0123456789ab-20260821T120000Z');
  mkdirSync(edgePath, { recursive: true });
  mkdirSync(rollbackRoot, { recursive: true });
  mkdirSync(eventosRelease, { recursive: true });
  mkdirSync(zeiterfassungRelease, { recursive: true });
  mkdirSync(archiveContent, { recursive: true });
  mkdirSync(procRoot, { recursive: true });

  const commit = '6703d2aa9bb426c7f44d6601306dc623219741be';
  const releaseSha = 'a'.repeat(40);
  const caddyText = readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url), 'utf8');
  writeFileSync(join(edgePath, 'Caddyfile'), caddyText);
  writeFileSync(join(archiveContent, 'Caddyfile'), caddyText);
  writeFileSync(join(edgePath, 'docker-compose.yml'), 'name: shared-edge\nservices: {}\n');
  writeFileSync(join(archiveContent, 'docker-compose.yml'), 'name: shared-edge\nservices: {}\n');
  writeFileSync(
    join(edgePath, '.deploy-manifest'),
    `commit=${commit}\nmode=cutover\ndeployed_at=2026-08-21T12:00:00Z\nrollback_root=${rollbackRoot}\n`,
  );
  writeFileSync(join(eventosRelease, '.eventos-release-sha'), `${releaseSha}\n`);
  symlinkSync(eventosRelease, join(eventosRoot, 'current'));
  writeFileSync(join(zeiterfassungRelease, 'package.json'), '{"version":"1.2.3"}\n');
  writeFileSync(join(zeiterfassungRelease, '.release-git-sha'), '0123456789abcdef0123456789abcdef01234567\n');
  symlinkSync(zeiterfassungRelease, join(zeiterfassungRoot, 'current'));

  const archive = join(rollbackRoot, 'shared-edge-20260821T120000Z.tar.gz');
  if (kind === 'invalid-tar' || kind === 'unknown-runtime-before-gate') {
    writeFileSync(archive, 'this is not a tar archive\n');
  } else {
    const tarResult = spawnSync('tar', ['-czf', archive, '-C', archiveContent, '.'], { encoding: 'utf8' });
    if (tarResult.status !== 0) throw new Error(`${tarResult.stdout}${tarResult.stderr}`);
  }
  writeFileSync(
    `${archive}.manifest`,
    `commit=${commit}\nmode=cutover\ndeployed_at=2026-08-21T12:00:00Z\nrollback_root=${rollbackRoot}\n`,
  );
  writeFileSync(join(rollbackRoot, 'latest'), `${archive}\n`);

const dockerScript = String.raw`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const env = process.env;
const iranmonitorCases = [
  ['iranmonitor-web', 'deploy', 'web', 'deploy-web-1'],
  ['iranmonitor-ingest', 'deploy', 'ingest', 'deploy-ingest-1'],
  ['iranmonitor-db', 'deploy', 'db', 'deploy-db-1'],
];
const extraIranmonitor = env.HARNESS_CASE === 'iranmonitor-fourth'
  ? [['iranmonitor-extra', 'deploy', 'worker', 'deploy-worker-1']]
  : [];
const baseComponents = [
  ['shared-edge', 'shared-edge', 'edge', 'shared-edge-edge-1'],
  ['catering-web', 'platform-infra', 'web', 'platform-infra-web-1'],
  ['catering-postgres', 'platform-infra', 'postgres', 'platform-infra-postgres-1'],
  ['catering-intake', 'platform-infra', 'intake', 'platform-infra-intake-1'],
  ['catering-offer', 'platform-infra', 'offer', 'platform-infra-offer-1'],
  ['catering-production', 'platform-infra', 'production', 'platform-infra-production-1'],
  ['catering-exports', 'platform-infra', 'exports', 'platform-infra-exports-1'],
  ['zeiterfassung-app', 'zeiterfassung', 'app', 'zeiterfassung-app-1'],
  ['eventos-app', 'commcats-eventos', 'app', 'commcats-eventos-app'],
  ['eventos-postgres', 'commcats-eventos', 'postgres', 'commcats-eventos-postgres'],
];
const components = [...baseComponents, ...iranmonitorCases, ...extraIranmonitor];
const unknownComponents = ['unknown-runtime', 'unknown-runtime-before-gate', 'unknown-runtime-inspect-failure', 'unknown-runtime-empty', 'unknown-runtime-unsorted'].includes(env.HARNESS_CASE)
  ? [['unknown-runtime-1', 'rogue-project', 'rogue-service', 'rogue-runtime-1']]
  : ['unknown-runtime-multiple', 'unknown-runtime-multiple-inspect-failure'].includes(env.HARNESS_CASE)
    ? [
        ['unknown-runtime-1', 'rogue-project', 'rogue-service', 'rogue-runtime-1'],
        ['unknown-runtime-2', 'rogue-project-2', 'rogue-service-2', 'rogue-runtime-2'],
      ]
    : env.HARNESS_CASE === 'unknown-runtime-control'
      ? [['unknown-runtime-control', 'rogue-project-control', 'rogue-service-control\nencoded', 'rogue-runtime-control']]
      : [];
// Keep legacy fake IDs stable for the unknown-container diagnostics while the
// newly allowlisted Iranmonitor records remain part of the runtime inventory.
const runtimeComponents = baseComponents.concat(unknownComponents, iranmonitorCases, extraIranmonitor);
const unknownMetadata = {
  'unknown-runtime-1': { image: 'rogue/image:1.0', status: 'running', started: '2026-08-21T00:00:01Z', restart: '2', networks: ['rogue-net'], ports: '8080/tcp\t18080\n8443/tcp\t18443\n' },
  'unknown-runtime-2': { image: 'rogue/image:2.0', status: 'running', started: '2026-08-21T00:00:02Z', restart: '3', networks: ['rogue-net-2'], ports: '9090/tcp\t19090\n' },
  'unknown-runtime-control': { image: 'rogue/image:control', status: 'running', started: '2026-08-21T00:00:03Z', restart: '4', networks: ['rogue-net-control'], ports: '7070/tcp\t17070\n' },
};
const byName = Object.fromEntries(runtimeComponents.map((row) => [row[3], row]));
const byId = Object.fromEntries(runtimeComponents.map((row, index) => [(index + 1).toString(16).repeat(64), row]));
function idFor(component) { return (runtimeComponents.findIndex((row) => row[0] === component) + 1).toString(16).repeat(64); }
function isUnknown(component) { return component.startsWith('unknown-runtime'); }
function metadataFor(component) { return unknownMetadata[component]; }
function rowFor(value) { return byId[value] || byName[value] || components.find((row) => row[0] === value); }
function emit(value) { process.stdout.write(String(value)); }
function networksFor(component) {
  if (env.HARNESS_CASE === 'unknown-runtime-unsorted' && component === 'unknown-runtime-1') {
    return [
      ['zeta-net', ['rogue-runtime-1']],
      ['alpha-net', ['rogue-runtime-1']],
      ['middle-net', ['rogue-runtime-1']],
    ];
  }
  switch (component) {
    case 'shared-edge': return [['platform-infra_default', ['edge', 'shared-edge-edge-1']], ['zeiterfassung_default', ['edge', 'shared-edge-edge-1']]];
    case 'catering-web': return [['platform-infra_default', ['web', 'platform-infra-web-1']], ['zeiterfassung_default', ['web', 'platform-infra-web-1']]];
    case 'catering-postgres': return [['platform-infra_default', ['postgres', 'platform-infra-postgres-1']]];
    case 'catering-intake': return [['platform-infra_default', ['intake', 'platform-infra-intake-1']]];
    case 'catering-offer': return [['platform-infra_default', ['offer', 'platform-infra-offer-1']]];
    case 'catering-production': return [['platform-infra_default', ['production', 'platform-infra-production-1']]];
    case 'catering-exports': return [['platform-infra_default', ['exports', 'platform-infra-exports-1']]];
    case 'zeiterfassung-app': return [['zeiterfassung_default', ['app', 'zeiterfassung-app-1']]];
    case 'eventos-app': return [['commcats-eventos_default', ['app', 'commcats-eventos-app']], ['platform-infra_default', ['app', 'commcats-eventos-app']]];
    case 'eventos-postgres': return [['commcats-eventos_default', ['postgres', 'commcats-eventos-postgres']]];
    case 'iranmonitor-web': return env.HARNESS_CASE === 'iranmonitor-network' ? [['deploy_default', ['web', 'deploy-web-1']], ['shared-edge_default', ['web', 'deploy-web-1']]] : [['deploy_default', ['web', 'deploy-web-1']]];
    case 'iranmonitor-ingest': return [['deploy_default', ['ingest', 'deploy-ingest-1']]];
    case 'iranmonitor-db': return [['deploy_default', ['db', 'deploy-db-1']]];
    case 'iranmonitor-extra': return [['deploy_default', ['worker', 'deploy-worker-1']]];
    case 'unknown-runtime-1': return metadataFor(component).networks.map((network) => [network, ['rogue-runtime-1']]);
    case 'unknown-runtime-2': return metadataFor(component).networks.map((network) => [network, ['rogue-runtime-2']]);
    case 'unknown-runtime-control': return metadataFor(component).networks.map((network) => [network, ['rogue-runtime-control']]);
    default: return [];
  }
}
function membersFor(network) {
  const rows = {
    'platform-infra_default': [
      ['commcats-eventos-app', ['app', 'commcats-eventos-app']],
      ['platform-infra-exports-1', ['exports', 'platform-infra-exports-1']],
      ['platform-infra-intake-1', ['intake', 'platform-infra-intake-1']],
      ['platform-infra-offer-1', ['offer', 'platform-infra-offer-1']],
      ['platform-infra-postgres-1', ['postgres', 'platform-infra-postgres-1']],
      ['platform-infra-production-1', ['production', 'platform-infra-production-1']],
      ['platform-infra-web-1', ['web', 'platform-infra-web-1']],
      ['shared-edge-edge-1', ['edge', 'shared-edge-edge-1']],
    ],
    'zeiterfassung_default': [
      ['platform-infra-web-1', ['web', 'platform-infra-web-1']],
      ['shared-edge-edge-1', ['edge', 'shared-edge-edge-1']],
      ['zeiterfassung-app-1', ['app', 'zeiterfassung-app-1']],
    ],
    'commcats-eventos_default': [
      ['commcats-eventos-app', ['app', 'commcats-eventos-app']],
      ['commcats-eventos-postgres', ['postgres', 'commcats-eventos-postgres']],
    ],
    'deploy_default': [
      ['deploy-db-1', ['db', 'deploy-db-1']],
      ['deploy-ingest-1', ['ingest', 'deploy-ingest-1']],
      ['deploy-web-1', ['web', 'deploy-web-1']],
    ],
  };
  const result = rows[network] || [];
  if (env.HARNESS_CASE === 'iranmonitor-network-consumer' && network === 'deploy_default') result.push(['foreign-deploy', ['foreign']]);
  if (env.HARNESS_CASE === 'iranmonitor-fourth' && network === 'deploy_default') result.push(['deploy-worker-1', ['worker', 'deploy-worker-1']]);
  if (env.HARNESS_CASE === 'unknown-alias' && network === 'platform-infra_default') result.push(['foreign-consumer', ['foreign']]);
  return result;
}
function networkId(network) {
  if (env.HARNESS_CASE === 'network-id' && network === 'platform-infra_default') return 'f'.repeat(64);
  return { 'platform-infra_default': 'b'.repeat(64), 'zeiterfassung_default': 'c'.repeat(64), 'commcats-eventos_default': 'd'.repeat(64), 'deploy_default': 'e'.repeat(64) }[network];
}
if (args[0] === 'network' && args[1] === 'ls') {
  emit('platform-infra_default\t' + 'b'.repeat(64) + '\tbridge\tlocal\n');
  emit('zeiterfassung_default\t' + 'c'.repeat(64) + '\tbridge\tlocal\n');
  emit('commcats-eventos_default\t' + 'd'.repeat(64) + '\tbridge\tlocal\n');
  if (iranmonitorCases.length > 0) emit('deploy_default\t' + 'e'.repeat(64) + '\tbridge\tlocal\n');
  process.exit(0);
}
if (args[0] === 'network' && args[1] === 'inspect') {
  const formatIndex = args.indexOf('--format');
  const format = formatIndex >= 0 ? args[formatIndex + 1] : '';
  const network = args[args.length - 1];
  if ((env.HARNESS_CASE === 'network-id' || env.HARNESS_CASE === 'unknown-alias') && network === 'platform-infra_default') {
    process.stderr.write('fixture network invariant drift\\n');
    process.exit(42);
  }
  if (format.includes('.Name') && format.includes('.Id')) {
    emit(network + '\t' + networkId(network) + '\tbridge\tlocal\n');
  } else {
    emit(membersFor(network).map((row) => row[0] + '=' + row[1].join(',') + ';').join('') + '\n');
  }
  process.exit(0);
}
if (args[0] === 'ps') {
  const filters = [];
  for (let index = 0; index < args.length; index += 1) if (args[index] === '--filter') filters.push(args[index + 1]);
  const projectFilter = filters.find((value) => value.startsWith('label=com.docker.compose.project='));
  const serviceFilter = filters.find((value) => value.startsWith('label=com.docker.compose.service='));
  const nameFilter = filters.find((value) => value.startsWith('name=^/'));
  let selected = components;
  if (projectFilter) selected = selected.filter((row) => row[1] === projectFilter.split('=').pop());
  if (serviceFilter) selected = selected.filter((row) => row[2] === serviceFilter.split('=').pop());
  if (nameFilter) {
    const expected = nameFilter.slice('name=^/'.length, -1);
    selected = selected.filter((row) => row[3] === expected);
  }
  if (!projectFilter && !serviceFilter && !nameFilter) selected = runtimeComponents;
  emit(selected.map((row) => idFor(row[0])).join('\n') + (selected.length ? '\n' : ''));
  process.exit(0);
}
if (args[0] === 'inspect') {
  const formatIndex = args.indexOf('--format');
  const format = formatIndex >= 0 ? args[formatIndex + 1] : '';
  const target = args[args.length - 1];
  const row = rowFor(target);
  if (!row) process.exit(1);
  if (format.includes('contains')) {
    process.stderr.write('docker inspect template function "contains" not defined\\n');
    process.exit(125);
  }
  const component = row[0];
  const unknown = isUnknown(component);
  const metadata = unknown ? metadataFor(component) : undefined;
  if (unknown && env.HARNESS_CASE === 'unknown-runtime-inspect-failure' && component === 'unknown-runtime-1') {
    process.stderr.write('docker-daemon-secret-error-marker\n');
    process.exit(23);
  }
  if (unknown && env.HARNESS_CASE === 'unknown-runtime-multiple-inspect-failure' && component === 'unknown-runtime-1') {
    process.stderr.write('docker-daemon-secret-error-marker\n');
    process.exit(23);
  }
  if (format === '{{.Id}}') emit(idFor(component) + '\n');
  else if (format === '{{.Name}}') emit('/' + row[3] + '\n');
  else if (format.includes('.State.Pid')) emit(env.HARNESS_REMOTE_PID + '\n');
  else if (format === '{{.Image}}') {
    emit(component === 'eventos-app' ? 'sha256:' + 'e'.repeat(64) + '\n' : 'sha256:' + '0'.repeat(64) + '\n');
  } else if (format.includes('.Config.Image')) {
    if (component === 'eventos-app') emit(env.HARNESS_CASE === 'eventos-unbound' ? 'commcats-eventos-app:latest\n' : 'commcats-eventos-app\n');
    else if (component === 'zeiterfassung-app') emit('zeiterfassung-app:1.2.3-0123456789ab\n');
    else if (component === 'iranmonitor-web') emit(env.HARNESS_CASE === 'iranmonitor-image' ? 'deploy-web:latest\n' : 'deploy-web\n');
    else if (component === 'iranmonitor-ingest') emit('deploy-ingest\n');
    else if (component === 'iranmonitor-db') emit('postgres:16-alpine\n');
    else if (component === 'iranmonitor-extra') emit('deploy-worker\n');
    else if (env.HARNESS_CASE === 'unknown-runtime-empty' && unknown) emit('\n');
    else if (unknown) emit(metadata.image + '\n');
    else emit('fixture:image\n');
  } else if (format.includes('.State.Status')) emit((env.HARNESS_CASE === 'unknown-runtime-empty' && unknown) ? '\n' : (env.HARNESS_CASE === 'iranmonitor-stopped' && component === 'iranmonitor-web' ? 'exited' : (unknown ? metadata.status : 'running')) + '\n');
  else if (format.includes('.State.StartedAt')) emit((env.HARNESS_CASE === 'unknown-runtime-empty' && unknown) ? '\n' : (unknown ? metadata.started : '2026-08-21T00:00:00Z') + '\n');
  else if (format.includes('.RestartCount')) emit((env.HARNESS_CASE === 'unknown-runtime-empty' && unknown) ? '\n' : (env.HARNESS_CASE === 'iranmonitor-restart' && component === 'iranmonitor-web' ? '1' : (unknown ? metadata.restart : '0')) + '\n');
  else if (format.includes('HostConfig.PortBindings')) {
    const hostIpBindings = format.includes('printf "%s\\t%s\\t%s\\n"');
    const structuredBindings = format.includes('printf "%s\\t%s\\n"');
    if (component === 'iranmonitor-web') {
      if (hostIpBindings) emit(env.HARNESS_CASE === 'iranmonitor-host-80' ? '0.0.0.0\t3000/tcp\t80\n' : env.HARNESS_CASE === 'iranmonitor-host-443' ? '0.0.0.0\t3000/tcp\t443\n' : '0.0.0.0\t3000/tcp\t3000\n');
      else emit('3000/tcp\t3000\n');
    } else if (component === 'iranmonitor-ingest') {
      if (hostIpBindings || structuredBindings) emit(env.HARNESS_CASE === 'iranmonitor-ingest-ports' ? '0.0.0.0\t8080/tcp\t8080\n' : '');
      else emit(env.HARNESS_CASE === 'iranmonitor-ingest-ports' ? '8080/tcp=8080,;\n' : '\n');
    } else if (component === 'iranmonitor-db') {
      if (hostIpBindings) emit(env.HARNESS_CASE === 'iranmonitor-db-public' ? '0.0.0.0\t5432/tcp\t5432\n' : '127.0.0.1\t5432/tcp\t5432\n');
      else emit(env.HARNESS_CASE === 'iranmonitor-db-public' ? '5432/tcp\t5432\n' : '5432/tcp\t5432\n');
    } else if (component === 'iranmonitor-extra') emit(structuredBindings ? '8080/tcp\t8080\n' : '8080/tcp=8080,;\n');
    else if (component === 'shared-edge') emit(structuredBindings ? '80/tcp\t80\n443/tcp\t443\n' : '80/tcp=80,;443/tcp=443,;\n');
    else if (env.HARNESS_CASE === 'foreign-app-host-ports' && component === 'catering-web') {
      emit(structuredBindings ? '8081/tcp\t80\n3000/tcp\t443\n' : '8081/tcp=80,;3000/tcp=443,;\n');
    } else if (env.HARNESS_CASE === 'eventos-alternative-host-port' && component === 'eventos-app') {
      emit(structuredBindings ? '3000/tcp\t3001\n' : '3000/tcp=3001,;\n');
    } else if (env.HARNESS_CASE === 'eventos-postgres-alternative-host-port' && component === 'eventos-postgres') {
      emit(structuredBindings ? '5432/tcp\t15432\n' : '5432/tcp=15432,;\n');
    } else if (env.HARNESS_CASE === 'unknown-runtime-unsorted' && component === 'unknown-runtime-1') {
      emit(structuredBindings ? '8443/tcp\t18443\n8080/tcp\t18080\n' : '8443/tcp=18443,;8080/tcp=18080,;\n');
    } else if (env.HARNESS_CASE === 'unknown-runtime-empty' && unknown) {
      emit('\n');
    } else if (unknown) {
      emit(structuredBindings ? metadata.ports : metadata.ports.replace(/\\t/g, '=').replace(/\\n/g, ';'));
    } else emit('\n');
  }
  else if (format.includes('com.docker.compose.project.working_dir')) {
    if (component === 'eventos-app') emit(env.HARNESS_EVENTOS_ROOT + '/current\n');
    else if (component === 'zeiterfassung-app') emit(env.HARNESS_ZEIT_ROOT + '/0123456789ab-20260821T120000Z\n');
    else emit('<no value>\n');
  } else if (format.includes('com.docker.compose.project')) emit(env.HARNESS_CASE === 'unknown-runtime-empty' && unknown ? '\n' : row[1] + '\n');
  else if (format.includes('com.docker.compose.service')) emit(env.HARNESS_CASE === 'unknown-runtime-empty' && unknown ? '\n' : row[2] + '\n');
  else if (format.includes('com.docker.compose.oneoff')) emit('False\n');
  else if (format.includes('com.docker.compose.container-number')) emit('1\n');
  else if (format.includes('.Config.Env')) {
    if (unknown) {
      fs.appendFileSync(env.HARNESS_UNKNOWN_READ_LOG, 'env\\n');
      emit('AUTHORIZATION=Bearer fixture-token\\nSECRET=fixture-secret\\n');
    }
    if (component === 'shared-edge') emit([
      'CATERING_UPSTREAM=http://web:8081',
      'ZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040',
      'EVENTOS_UPSTREAM=commcats-eventos-app:3045',
      'CATERING_PUBLIC_HOST=' + (env.HARNESS_CASE === 'wrong-caddy-mapping' ? 'evil.example' : 'catering.the-one.catering'),
      'ZEITERFASSUNG_PUBLIC_HOST=zeit.the-one.catering',
      'EVENTOS_PUBLIC_HOST=eventos.commcats.de',
    ].join('\n') + '\n');
    else if (component === 'eventos-app') emit('EVENTOS_RELEASE_SHA=' + (env.HARNESS_CASE === 'eventos-arbitrary-sha' ? 'b'.repeat(40) : env.HARNESS_EVENTOS_SHA) + '\n');
  } else if (format.includes('.Mounts')) {
    if (unknown) {
      fs.appendFileSync(env.HARNESS_UNKNOWN_READ_LOG, 'mounts\\n');
      emit('/sensitive/fixture\t/app\tfalse\n');
    }
    if (component === 'shared-edge') emit(env.HARNESS_EDGE_PATH + '/Caddyfile\t/etc/caddy/Caddyfile\tfalse\n');
  } else if (format.includes('IPAddress')) {
    if (component === 'shared-edge') emit('172.31.0.2\n');
  } else if (format.includes('join $network.Aliases')) {
    emit(networksFor(component).map((row) => row[0] + '=' + row[1].join(',') + ';').join('') + '\n');
  } else if (format.includes('$network_name')) {
    emit(env.HARNESS_CASE === 'unknown-runtime-empty' && unknown ? '\n' : networksFor(component).map((row) => row[0] + '\n').join(''));
  } else {
    if (unknown && format.includes('.Config.Labels')) {
      fs.appendFileSync(env.HARNESS_UNKNOWN_READ_LOG, 'labels\\n');
      emit('com.example.foreign=fixture-label\\n');
    }
    const hostKeys = ['CATERING_PUBLIC_HOST', 'ZEITERFASSUNG_PUBLIC_HOST', 'EVENTOS_PUBLIC_HOST'];
    const key = hostKeys.find((value) => format.includes(value + '='));
    if (component === 'shared-edge' && key) emit((env.HARNESS_CASE === 'wrong-caddy-mapping' && key === 'CATERING_PUBLIC_HOST' ? 'evil.example' : { CATERING_PUBLIC_HOST: 'catering.the-one.catering', ZEITERFASSUNG_PUBLIC_HOST: 'zeit.the-one.catering', EVENTOS_PUBLIC_HOST: 'eventos.commcats.de' }[key]) + '\n');
  }
  process.exit(0);
}
process.exit(1);
`;
const ssScript = String.raw`#!/usr/bin/env node
const pid = process.env.HARNESS_REMOTE_PID;
if (process.env.HARNESS_CASE === 'listener-extra') console.log('LISTEN 0 128 0.0.0.0:80 0.0.0.0:* users:((' + '"foreign"' + ',pid=1,fd=3))');
if (process.env.HARNESS_CASE === 'listener-foreign-cgroup' || process.env.HARNESS_CASE === 'listener-wrong-docker-proxy') console.log('LISTEN 0 128 0.0.0.0:80 0.0.0.0:* users:((' + '"foreign"' + ',pid=1,fd=3))');
else console.log('LISTEN 0 128 0.0.0.0:80 0.0.0.0:* users:((' + '"caddy"' + ',pid=' + pid + ',fd=3))');
if (process.env.HARNESS_CASE !== 'listener-missing') console.log('LISTEN 0 128 0.0.0.0:443 0.0.0.0:* users:((' + '"caddy"' + ',pid=' + pid + ',fd=4))');
`;
  const realpathScript = String.raw`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args[0] === '-e') args.shift();
if (process.env.HARNESS_CASE === 'unreadable-zeiterfassung-root' && args[0].startsWith(process.env.HARNESS_ZEIT_ROOT)) {
  process.stderr.write('realpath: Permission denied\\n');
  process.exit(13);
}
try { process.stdout.write(fs.realpathSync(args[0]) + '\n'); } catch (_error) { process.exit(1); }
`;
  const shaScript = String.raw`#!/usr/bin/env node
const fs = require('fs');
const childProcess = require('child_process');
const args = process.argv.slice(2);
const result = childProcess.spawnSync(process.env.REAL_SHA256SUM, args, { encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.status !== 0) process.exit(result.status || 1);
const target = args[0];
const countFile = process.env.HARNESS_ROOT + '/sha-count';
if ((process.env.HARNESS_CASE === 'manifest-drift' || process.env.HARNESS_CASE === 'lock-drift') && target === process.env.HARNESS_EDGE_PATH + '/.deploy-manifest' && !fs.existsSync(countFile)) {
  fs.writeFileSync(countFile, '1');
  if (process.env.HARNESS_CASE === 'manifest-drift') {
    const manifest = fs.readFileSync(target, 'utf8').replace('2026-08-21T12:00:00Z', '2026-08-21T12:00:01Z');
    fs.writeFileSync(target, manifest);
  }
  if (process.env.HARNESS_CASE === 'lock-drift') fs.writeFileSync(process.env.HARNESS_EDGE_PATH + '.deploy-lock', 'appeared during snapshot\n');
}
`;
  const sshScript = String.raw`#!/usr/bin/env node
const fs = require('fs');
const childProcess = require('child_process');
const root = process.env.HARNESS_ROOT;
const original = fs.readFileSync(0, 'utf8');
fs.writeFileSync(process.env.HARNESS_SCRIPT_LOG, original);
let rewritten = original;
for (const [from, to] of [
  ['/opt/shared-edge-rollbacks', process.env.HARNESS_ROLLBACK_ROOT],
  ['/opt/shared-edge', process.env.HARNESS_EDGE_PATH],
  ['/opt/commcats-eventos/current', process.env.HARNESS_EVENTOS_ROOT + '/current'],
  ['/opt/commcats-eventos/releases', process.env.HARNESS_EVENTOS_ROOT + '/releases'],
  ['/root/zeiterfassung-deploy/current', process.env.HARNESS_ZEIT_ROOT + '/current'],
  ['/proc/', process.env.HARNESS_PROC_ROOT + '/'],
]) rewritten = rewritten.split(from).join(to);
const remoteProc = process.env.HARNESS_PROC_ROOT + '/' + process.pid;
fs.mkdirSync(remoteProc, { recursive: true });
fs.writeFileSync(remoteProc + '/cgroup', '0::/fixture/shared-edge\\n');
fs.writeFileSync(remoteProc + '/cmdline', 'caddy\\0');
fs.writeFileSync(remoteProc + '/exe', 'fixture-executable');
fs.mkdirSync(process.env.HARNESS_PROC_ROOT + '/1', { recursive: true });
fs.writeFileSync(process.env.HARNESS_PROC_ROOT + '/1/cgroup', '0::/fixture/foreign\\n');
fs.writeFileSync(process.env.HARNESS_PROC_ROOT + '/1/cmdline', process.env.HARNESS_CASE === 'listener-wrong-docker-proxy' ? 'docker-proxy -container-ip 172.31.0.99 -container-port 9999' : 'foreign');
fs.writeFileSync(process.env.HARNESS_PROC_ROOT + '/1/exe', 'foreign-executable');
rewritten = 'mapfile() {\n  if [ "\${1:-}" = "-t" ]; then shift; fi\n  local variable="\${1:-}" line\n  local -a values=()\n  while IFS= read -r line; do values+=("$line"); done\n  eval "$variable=(\\"\\\${values[@]}\\")"\n}\n' + rewritten;
const scriptPath = root + '/remote-rewritten.sh';
fs.writeFileSync(scriptPath, rewritten, { mode: 0o700 });
const childEnv = { ...process.env, HARNESS_REMOTE_PID: String(process.pid) };
const result = childProcess.spawnSync('/bin/bash', [scriptPath, process.env.HARNESS_EXPECTED_CADDY_SHA], {
  encoding: 'utf8',
  env: childEnv,
  timeout: 40000,
  killSignal: 'SIGTERM',
});
if (result.error && result.error.code === 'ETIMEDOUT') {
  process.stderr.write('fake remote harness timed out\\n');
  process.exit(124);
}
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status === null ? 1 : result.status);
`;
  for (const [name, content] of [['docker', dockerScript], ['ss', ssScript], ['realpath', realpathScript], ['sha256sum', shaScript], ['ssh', sshScript]] as const) {
    writeFileSync(join(root, name), content, { mode: 0o700 });
    chmodSync(join(root, name), 0o700);
  }
  return {
    root,
    edgePath,
    rollbackRoot,
    eventosRoot,
    zeiterfassungRoot,
    environment: {
      ...process.env,
      PATH: `${root}${delimiter}${originalPath}`,
      HARNESS_ROOT: root,
      HARNESS_EDGE_PATH: edgePath,
      HARNESS_ROLLBACK_ROOT: rollbackRoot,
      HARNESS_EVENTOS_ROOT: eventosRoot,
      HARNESS_ZEIT_ROOT: zeiterfassungRoot,
      HARNESS_PROC_ROOT: procRoot,
      HARNESS_EVENTOS_SHA: releaseSha,
      HARNESS_EXPECTED_CADDY_SHA: kind === 'wrong-caddy-hash' ? 'd'.repeat(64) : caddyfileSha256,
      HARNESS_CASE: kind,
      HARNESS_SCRIPT_LOG: join(root, 'remote-script.log'),
      HARNESS_UNKNOWN_READ_LOG: join(root, 'unknown-read.log'),
      REAL_SHA256SUM: realSha256sum,
    },
  };
}

function extractRemoteSnapshot(source: string) {
  const start = source.indexOf('remote_snapshot() {');
  const end = source.indexOf('\n}\n\nstate_line()', start);
  if (start < 0 || end < 0) throw new Error('Missing remote_snapshot function');
  return source.slice(start, end + 2);
}

function runFakeRemoteSnapshot(kind: string, timeoutMs = 50000) {
  const fixture = createFakeRemoteFixture(kind);
  const result = runExtractedFunction(
    extractRemoteSnapshot(helper),
    [
      'SSH_ARGS=(--batch-mode)',
      'REMOTE=fixture',
      'EXPECTED_CADDYFILE_SHA256="$HARNESS_EXPECTED_CADDY_SHA"',
      'remote_snapshot',
    ].join('\n'),
    fixture.environment,
    timeoutMs,
  );
  return { fixture, result };
}

function extractDockerInspectEnvLines(source: string) {
  return source
    .split('\n')
    .filter((line) => line.includes('docker inspect --format') && line.includes('.Config.Env'));
}

describe('post-cutover evidence workflow contract', () => {
  it('is manually dispatched, read-only, production-bound and uses the proven SSH roles', () => {
    expect(workflow).toMatch(/^name: Post-cutover shared-edge evidence$/m);
    expect(workflow).toMatch(/^on:\s*$/m);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^\s*(push|pull_request|schedule|workflow_call):/m);
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('group: shared-edge-production-deploy');
    expect(workflow).toContain('runs-on: ubuntu-latest');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('actions/checkout@v5');
    expect(workflow).toMatch(/post-cutover-evidence:\n\s+if: github\.ref == 'refs\/heads\/main'/);
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(workflow).toContain('HETZNER_SSH_PRIVATE_KEY');
    expect(workflow).toContain('HETZNER_SSH_KNOWN_HOSTS');
    expect(workflow).toContain('HETZNER_DEPLOY_HOST');
    expect(workflow).toContain('HETZNER_DEPLOY_USER');
    expect(workflow).toContain('SMOKE_BASIC_AUTH_USER');
    expect(workflow).toContain('SMOKE_BASIC_AUTH_PASSWORD');
    expect(workflow).toContain('::add-mask::');
    expect(workflow).toContain('bash edge-infra/scripts/post-cutover-evidence.sh');
    expect(workflow).toContain('EXPECTED_CUTOVER_COMMIT: 6703d2aa9bb426c7f44d6601306dc623219741be');
    expect(workflow).toContain('CUTOVER_RUN_ID: 32417734936');
    expect(workflow).toContain('EVIDENCE_CONTEXT: github-production');
    expect(workflow).not.toContain('hashFiles(');
    expect(workflow).not.toContain('ZEITERFASSUNG_OWNER_CONTRACT_STATUS');
    expect(workflow).not.toContain('EVENTOS_OWNER_CONTRACT_STATUS');
    expect(workflow).not.toContain('ZEITERFASSUNG_EXPECTED_VERSION');
    expect(workflow).not.toContain('ZEITERFASSUNG_EXPECTED_GIT_SHA');
    expect(workflow).not.toMatch(/docker\s+(?:compose|network|rm|system|volume)\b/);
    expect(workflow).not.toMatch(/\b(?:sudo|rsync|scp)\b/);
    expect(workflow).not.toContain('Authorization');
    expect(workflow).not.toMatch(/(?:^|[\s"'])-k([\s"']|$)/);
    expect(workflow).not.toContain('--insecure');
  });

  it('computes and validates the raw checked-out Caddyfile SHA before invoking the helper', () => {
    const runStart = workflow.indexOf('      - name: Run read-only post-cutover evidence\n');
    const runStep = workflow.slice(runStart);
    const shaCommand = "EXPECTED_CADDYFILE_SHA256=\"$(sha256sum edge-infra/Caddyfile | awk '{print $1}')\"";
    const validation = '[[ "${EXPECTED_CADDYFILE_SHA256}" =~ ^[0-9a-f]{64}$ ]]';
    const exportCommand = 'export EXPECTED_CADDYFILE_SHA256';
    const helperCommand = 'bash edge-infra/scripts/post-cutover-evidence.sh';

    expect(runStart).toBeGreaterThanOrEqual(0);
    expect(runStep).not.toContain('hashFiles(');
    expect(runStep).not.toContain('GITHUB_ENV');
    expect(runStep).toContain(shaCommand);
    expect(runStep).toContain(validation);
    expect(runStep).toContain(exportCommand);
    expect(runStep).toContain(helperCommand);
    expect(runStep.indexOf(shaCommand)).toBeLessThan(runStep.indexOf(validation));
    expect(runStep.indexOf(validation)).toBeLessThan(runStep.indexOf(exportCommand));
    expect(runStep.indexOf(exportCommand)).toBeLessThan(runStep.indexOf(helperCommand));
  });

  it('dominates every production-secret step with the main-branch job guard', () => {
    const jobStart = workflow.indexOf('  post-cutover-evidence:\n');
    const guard = workflow.indexOf("    if: github.ref == 'refs/heads/main'", jobStart);
    expect(jobStart).toBeGreaterThanOrEqual(0);
    expect(guard).toBeGreaterThan(jobStart);
    expect(workflow.indexOf('secrets.', jobStart)).toBeGreaterThan(guard);
    expect(workflow.slice(jobStart, guard)).not.toContain('secrets.');
  });

  it('captures the required read-only ownership, identity, network and rollback evidence', () => {
    expect(helper).toContain('set -euo pipefail');
    expect(helper).toContain('ss -ltnp');
    expect(helper).toContain('docker ps');
    expect(helper).toContain('docker inspect');
    expect(helper).toContain("docker inspect --format '{{.Image}}'");
    expect(helper).toContain('docker network ls');
    expect(helper).toContain('docker network inspect');
    expect(helper).toContain('HostConfig.PortBindings');
    expect(helper).toContain('RestartCount');
    expect(helper).toContain('StartedAt');
    expect(helper).toContain('before_snapshot');
    expect(helper).toContain('after_snapshot');
    expect(helper).toContain('platform-infra_default');
    expect(helper).toContain('zeiterfassung_default');
    expect(helper).toContain('http://web:8081');
    expect(helper).toContain('zeiterfassung-app-1:3040');
    expect(helper).toContain('commcats-eventos-app:3045');
    expect(helper).toContain('intake-service');
    expect(helper).toContain('EXPECTED_CUTOVER_COMMIT');
    expect(helper).toContain('cutover-workflow');
    expect(helper).toContain('cutover-run-id');
    expect(helper).toContain('ROLLBACK');
    expect(helper).toContain('full container ID');
    expect(helper).toContain('network ID');
    expect(helper).toContain('unknown network consumer');
    expect(helper).toContain('foreign public port owner');
    expect(helper).toContain('/api/public/config');
    expect(helper).toContain('Accept: application/json');
    expect(helper).toContain('/api/offers/health');
    expect(helper).toContain('/api/production/health');
    expect(helper).toContain('/api/exports/health');
    expect(helper).not.toContain('/root/zeiterfassung-deploy');
    expect(helper).toContain('read_zeiterfassung_container_metadata');
    expect(helper).toContain('assert_zeiterfassung_container_metadata');
    expect(helper).toContain('EXPECTED_CADDYFILE_SHA256');
    expect(helper).toContain('validate_effective_caddy_config');
    expect(helper).toContain('/etc/caddy/Caddyfile');
    expect(helper).toContain('tar -tzf');
    expect(helper).toContain('sha256sum');
    expect(helper).toContain('/proc/');
    expect(helper).toContain('docker-proxy');
    expect(helper).toContain('cgroup');
    expect(helper).toContain('snapshot_generation_before');
  });

  it('uses the Compose working-dir label for Zeiterfassung provenance, never the container working directory', () => {
    expect(helper).toContain('com.docker.compose.project.working_dir');
    expect(helper).not.toContain('.Config.WorkingDir');
  });

  it('uses only Docker-compatible templates for environment inspection', () => {
    const envInspectLines = extractDockerInspectEnvLines(helper);
    expect(envInspectLines).toHaveLength(3);
    expect(envInspectLines.every((line) => line.includes('{{range .Config.Env}}{{println .}}{{end}}'))).toBe(true);
    expect(envInspectLines.join('\n')).not.toContain('contains');
  });

  it('contains no server mutation, secret disclosure or insecure TLS path', () => {
    const remoteScripts = [...helper.matchAll(/<<'REMOTE_SCRIPT'\n([\s\S]*?)\nREMOTE_SCRIPT/g)]
      .map((match) => match[1])
      .join('\n');
    const linesWithComposeMutation = helper
      .split('\n')
      .filter((line) => /docker\s+compose\b/.test(line) && /\b(up|down|restart|start|stop|kill|exec|cp|update)\b/.test(line));

    expect(linesWithComposeMutation).toEqual([]);
    expect(helper).not.toMatch(/\bdocker\s+(?:network\s+(?:connect|disconnect|create|rm)|rm|prune|system\s+prune)\b/);
    expect(helper).not.toMatch(/\b(?:sudo|rsync|scp|docker\s+exec|docker\s+cp)\b/);
    expect(helper).not.toMatch(/\b(?:tee|mv|install|mkdir|rm)\b/);
    expect(remoteScripts).not.toMatch(/(^|[^-])>{1,2}(?!&2|\/dev\/null)/m);
    expect(helper).not.toMatch(/\bset\s+-x\b/);
    expect(helper).toContain('range .Config.Env');
    expect(helper).not.toContain('{{json .Config.Env}}');
    expect(helper).not.toContain('{{json .Config.Labels}}');
    expect(helper).not.toContain('LABELS');
    expect(helper).not.toMatch(/(?:cat|source|printf[^\n]*<)\s+[^\n]*\.env/);
    expect(helper).not.toMatch(/(^|[\s"'])-k([\s"']|$)/);
    expect(helper).not.toContain('--insecure');
    expect(helper).not.toContain('Authorization');
    expect(helper).not.toContain('{{json .Config.Labels}}');
    expect(helper).not.toContain('ZEITERFASSUNG_EXPECTED_VERSION');
    expect(helper).not.toContain('ZEITERFASSUNG_EXPECTED_GIT_SHA');
  });

  it('routes remote gate failures to stderr without contaminating the evidence snapshot', () => {
    const remoteFail = extractFunction(helper, 'remote_fail');
    const result = spawnSync('bash', ['-c', `set +e
${remoteFail}
remote_fail 'sanitized fixture failure'`], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('sanitized fixture failure');
  });

  it('fails closed on smoke, TLS, identity, ownership, restart, ID and network drift', () => {
    expect(helper).toContain('--proto');
    expect(helper).toContain('--tlsv1.2');
    expect(helper).toContain('http_code');
    expect(helper).toContain('content_type');
    expect(helper).toContain('payload.get("ok") is not True');
    expect(helper).toContain('payload.get("status") != "ok"');
    expect(helper).toContain('payload.get("service") != "intake-service"');
    expect(helper).toContain('Container ID changed');
    expect(helper).toContain('RestartCount increased');
    expect(helper).toContain('network mapping');
    expect(helper).toContain('public 80/443 ownership');
    expect(helper).toContain('EventOS release marker');
    expect(helper).toContain('compare_eventos_content_id_invariant');
    expect(helper).not.toContain('ZEITERFASSUNG_OWNER_CONTRACT_STATUS');
    expect(helper).toContain('validate_curl_args');
    expect(helper).toContain('assert_eventos_ready_identity');
    expect(helper).toContain('assert_eventos_health_identity');
    expect(helper).toContain('name": "database"');
  });

  it('executes exact-input rejection fixtures before any SSH call', () => {
    for (const [field, value] of [
      ['CATERING_SMOKE_URL', 'https://evil.example'],
      ['EDGE_DEPLOY_PATH', '/opt/other'],
      ['DEPLOY_HOST', 'hetzner.example;touch'],
    ] as const) {
      const fixture = createRunnerFixture();
      const environment = validHelperEnvironment(fixture);
      environment[field] = value;
      const result = runHelper(environment);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('PHASE 2: NO-GO');
      expect(existsSync(fixture.sshLog)).toBe(false);
    }
  });

  it('rejects a single backslash in Basic-Auth username or password before SSH', () => {
    for (const field of ['CATERING_SMOKE_BASIC_AUTH_USER', 'CATERING_SMOKE_BASIC_AUTH_PASSWORD'] as const) {
      const fixture = createRunnerFixture();
      const environment = validHelperEnvironment(fixture);
      environment[field] = 'one\\two';
      environment.ZEITERFASSUNG_OWNER_CONTRACT_STATUS = 'ready';
      for (const commandName of ['docker', 'ss', 'sha256sum']) {
        writeFileSync(join(fixture.root, commandName), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o700 });
      }
      const result = runHelper(environment);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('unsupported curl-config characters');
      expect(existsSync(fixture.sshLog)).toBe(false);
    }
  });

  it('does not accept a self-asserted owner status before the read-only owner evidence path', () => {
    const fixture = createRunnerFixture();
    const result = runHelper(validHelperEnvironment(fixture));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain('ZEITERFASSUNG_OWNER_CONTRACT_STATUS');
  });

  it('does not accept release identity from workflow environment inputs', () => {
    const fixture = createRunnerFixture();
    const environment = validHelperEnvironment(fixture);
    environment.ZEITERFASSUNG_OWNER_CONTRACT_STATUS = 'ready';
    environment.ZEITERFASSUNG_EXPECTED_VERSION = '9.9.9';
    environment.ZEITERFASSUNG_EXPECTED_GIT_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
    const result = runHelper(environment);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain('9.9.9');
    expect(`${result.stdout}${result.stderr}`).not.toContain('fedcba9876543210fedcba9876543210fedcba98');
  });

  it('reads exactly the allowlisted runtime upstreams from a fake Docker inspect fixture', () => {
    const upstreamReader = extractFunction(helper, 'read_effective_upstreams');
    const root = mkdtempSync(join(tmpdir(), 'post-cutover-evidence-upstream-'));
    const dockerStub = join(root, 'docker');
    writeFileSync(
      dockerStub,
      '#!/usr/bin/env bash\nprintf "%s\\n" "${UPSTREAM_ENV_LINES}"\n',
      { mode: 0o700 },
    );
    const runFixture = (lines: string) => spawnSync('bash', ['-c', `set -euo pipefail
remote_fail() { printf '%s\\n' "$1" >&2; exit 1; }
${upstreamReader}
read_effective_upstreams shared-edge-id`], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${root}:${process.env.PATH ?? ''}`, UPSTREAM_ENV_LINES: lines },
    });
    const valid = runFixture([
      'CATERING_UPSTREAM=http://web:8081',
      'ZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040',
      'EVENTOS_UPSTREAM=commcats-eventos-app:3045',
    ].join('\n'));
    expect(valid.status, `${valid.stdout}${valid.stderr}`).toBe(0);
    expect(valid.stdout).toBe([
      'UPSTREAM\tcatering\thttp://web:8081\tcatering-web',
      'UPSTREAM\tzeiterfassung\tzeiterfassung-app-1:3040\tzeiterfassung-app',
      'UPSTREAM\teventos\tcommcats-eventos-app:3045\teventos-app',
      '',
    ].join('\n'));
    for (const drift of [
      'CATERING_UPSTREAM=http://web:8081\nZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040',
      'CATERING_UPSTREAM=http://web:8081\nCATERING_UPSTREAM=http://evil:9\nZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040\nEVENTOS_UPSTREAM=commcats-eventos-app:3045',
      'CATERING_UPSTREAM=http://web:8081\nZEITERFASSUNG_UPSTREAM=zeiterfassung-app-1:3040\nEVENTOS_UPSTREAM=http://evil:9',
    ]) {
      const rejected = runFixture(drift);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stdout).toBe('');
    }
  });

  it('executes safe Zeiterfassung container metadata without resolving its working directory', () => {
    const metadata = extractFunction(helper, 'read_zeiterfassung_container_metadata');
    const assertion = extractFunction(helper, 'assert_zeiterfassung_container_metadata');
    const root = mkdtempSync(join(tmpdir(), 'zeiterfassung-container-metadata-'));
    writeFileSync(
      join(root, 'docker'),
      `#!/usr/bin/env bash
case "$*" in
  *Config.Image*) printf '%s\\n' 'zeiterfassung-app:1.2.3-0123456789ab' ;;
  *com.docker.compose.project.working_dir*) printf '%s\\n' '/root/zeiterfassung-deploy' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o700 },
    );
    const result = runExtractedFunction(
      `${assertion}\n${metadata}`,
      'read_zeiterfassung_container_metadata fixture; printf "%s\\n" "$ZEITERFASSUNG_CONTAINER_IMAGE|$ZEITERFASSUNG_COMPOSE_WORKING_DIR"',
      { PATH: `${root}:${process.env.PATH ?? ''}` },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).toBe('zeiterfassung-app:1.2.3-0123456789ab|/root/zeiterfassung-deploy\n');
  });

  it('rejects malformed Zeiterfassung container metadata', () => {
    const assertion = extractFunction(helper, 'assert_zeiterfassung_container_metadata');
    const loader = extractFunction(helper, 'load_zeiterfassung_container_metadata');
    const containerLine = extractFunction(helper, 'zeiterfassung_container_line');
    const stateField = extractFunction(helper, 'state_field');
    const invalidWorkingDir = runExtractedFunction(
      assertion,
      'assert_zeiterfassung_container_metadata "relative/path" "zeiterfassung-app:1.2.3-0123456789ab"',
    );
    expect(invalidWorkingDir.status).not.toBe(0);
    expect(`${invalidWorkingDir.stdout}${invalidWorkingDir.stderr}`).toContain('working-dir label is malformed');

    const tabWorkingDir = runExtractedFunction(
      assertion,
      `assert_zeiterfassung_container_metadata $'/root/zeiterfassung-deploy\\twith-tab' "zeiterfassung-app:1.2.3-0123456789ab"`,
    );
    expect(tabWorkingDir.status).not.toBe(0);
    expect(`${tabWorkingDir.stdout}${tabWorkingDir.stderr}`).toContain('working-dir label is malformed');

    const tabSnapshot = runExtractedFunction(
      `${stateField}\n${containerLine}\n${loader}`,
      `load_zeiterfassung_container_metadata $'ZEITERFASSUNG_CONTAINER\\tzeiterfassung-app:1.2.3-0123456789ab\\t/root/zeiterfassung-deploy\\twith-tab'`,
    );
    expect(tabSnapshot.status).not.toBe(0);
    expect(`${tabSnapshot.stdout}${tabSnapshot.stderr}`).toContain('working-dir label is invalid');

    const invalidImage = runExtractedFunction(
      assertion,
      'assert_zeiterfassung_container_metadata "/root/zeiterfassung-deploy" "zeiterfassung-app:latest"',
    );
    expect(invalidImage.status).not.toBe(0);
    expect(`${invalidImage.stdout}${invalidImage.stderr}`).toContain('image identity is not allowlisted');
  });

  it('validates the canonical EventOS release marker as a regular lowercase SHA file', () => {
    const markerReader = extractFunction(helper, 'read_eventos_release_marker');
    const root = mkdtempSync(join(tmpdir(), 'eventos-release-marker-'));
    const marker = join(root, '.eventos-release-sha');
    writeFileSync(marker, `${'a'.repeat(40)}\n`);
    const valid = runExtractedFunction(
      markerReader,
      'read_eventos_release_marker "$MARKER"; printf "%s\\n" "$EVENTOS_RELEASE_SHA";',
      { MARKER: marker },
    );
    expect(valid.status, `${valid.stdout}${valid.stderr}`).toBe(0);
    expect(valid.stdout).toBe(`${'a'.repeat(40)}\n`);

    for (const value of ['A'.repeat(40), 'a'.repeat(39), `${'a'.repeat(40)}\nextra\n`]) {
      writeFileSync(marker, value);
      const rejected = runExtractedFunction(markerReader, 'read_eventos_release_marker "$MARKER"', { MARKER: marker });
      expect(rejected.status).not.toBe(0);
    }
    const outside = join(root, 'outside-marker');
    writeFileSync(outside, `${'b'.repeat(40)}\n`);
    const symlink = join(root, 'symlink-marker');
    symlinkSync(outside, symlink);
    const symlinkResult = runExtractedFunction(markerReader, 'read_eventos_release_marker "$MARKER"', { MARKER: symlink });
    expect(symlinkResult.status).not.toBe(0);
  });

  it('rejects an EventOS identity without the exact image name and immutable local content ID', () => {
    const normalizeImage = extractFunction(helper, 'normalize_eventos_image_name');
    const identity = extractFunction(helper, 'read_eventos_container_identity');
    const root = mkdtempSync(join(tmpdir(), 'eventos-container-identity-'));
    const docker = join(root, 'docker');
    const releaseSha = 'a'.repeat(40);
    writeFileSync(
      docker,
      `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *Config.Image*) printf '%s\\n' "\${EVENTOS_IMAGE:-commcats-eventos-app}" ;;
  *.Image*) printf '%s\\n' "\${EVENTOS_CONTENT_ID:-sha256:${'e'.repeat(64)}}" ;;
  *EVENTOS_RELEASE_SHA=*|*.Config.Env*) printf 'EVENTOS_RELEASE_SHA=%s\\n' "\${EVENTOS_CONTAINER_RELEASE:-$EVENTOS_RELEASE_SHA}" ;;
  *com.docker.compose.project.working_dir*) printf '%s\\n' "$EVENTOS_WORKING_DIR" ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o700 },
    );
    const valid = runExtractedFunction(
      `${normalizeImage}\n${identity}`,
      'export EVENTOS_RELEASE_SHA="$EXPECTED_SHA"; read_eventos_container_identity fixture',
      {
        PATH: `${root}:${process.env.PATH ?? ''}`,
        EXPECTED_SHA: releaseSha,
        EVENTOS_WORKING_DIR: '/opt/commcats-eventos/current',
      },
    );
    expect(valid.status, `${valid.stdout}${valid.stderr}`).toBe(0);

    const wrongImage = runExtractedFunction(
      `${normalizeImage}\n${identity}`,
      'export EVENTOS_RELEASE_SHA="$EXPECTED_SHA"; export EVENTOS_IMAGE=commcats-eventos-app:latest; read_eventos_container_identity fixture',
      {
        PATH: `${root}:${process.env.PATH ?? ''}`,
        EXPECTED_SHA: releaseSha,
        EVENTOS_WORKING_DIR: '/opt/commcats-eventos/current',
        EVENTOS_IMAGE: 'commcats-eventos-app:latest',
      },
    );
    expect(wrongImage.status).not.toBe(0);
    expect(`${wrongImage.stdout}${wrongImage.stderr}`).toContain('documented owner image');

    const missingContentId = runExtractedFunction(
      `${normalizeImage}\n${identity}`,
      'export EVENTOS_RELEASE_SHA="$EXPECTED_SHA"; export EVENTOS_CONTENT_ID="<no value>"; read_eventos_container_identity fixture',
      {
        PATH: `${root}:${process.env.PATH ?? ''}`,
        EXPECTED_SHA: releaseSha,
        EVENTOS_WORKING_DIR: '/opt/commcats-eventos/current',
        EVENTOS_CONTENT_ID: '<no value>',
      },
    );
    expect(missingContentId.status).not.toBe(0);
    expect(`${missingContentId.stdout}${missingContentId.stderr}`).toContain('local content ID');

    const invalidContentId = runExtractedFunction(
      `${normalizeImage}\n${identity}`,
      'export EVENTOS_RELEASE_SHA="$EXPECTED_SHA"; export EVENTOS_CONTENT_ID="sha256:E"; read_eventos_container_identity fixture',
      {
        PATH: `${root}:${process.env.PATH ?? ''}`,
        EXPECTED_SHA: releaseSha,
        EVENTOS_WORKING_DIR: '/opt/commcats-eventos/current',
        EVENTOS_CONTENT_ID: 'sha256:E',
      },
    );
    expect(invalidContentId.status).not.toBe(0);
    expect(`${invalidContentId.stdout}${invalidContentId.stderr}`).toContain('local content ID');

    const releaseMismatch = runExtractedFunction(
      `${normalizeImage}\n${identity}`,
      'export EVENTOS_RELEASE_SHA="$EXPECTED_SHA"; export EVENTOS_CONTAINER_RELEASE="$MISMATCHED_SHA"; read_eventos_container_identity fixture',
      {
        PATH: `${root}:${process.env.PATH ?? ''}`,
        EXPECTED_SHA: releaseSha,
        MISMATCHED_SHA: 'b'.repeat(40),
        EVENTOS_WORKING_DIR: '/opt/commcats-eventos/current',
        EVENTOS_CONTAINER_RELEASE: 'b'.repeat(40),
      },
    );
    expect(releaseMismatch.status).not.toBe(0);
    expect(`${releaseMismatch.stdout}${releaseMismatch.stderr}`).toContain('does not match the immutable release marker');
  });

  it('accepts the documented local EventOS image name only with a separate immutable content ID', () => {
    const normalizeImage = extractFunction(helper, 'normalize_eventos_image_name');
    const identity = extractFunction(helper, 'read_eventos_container_identity');
    const root = mkdtempSync(join(tmpdir(), 'eventos-local-image-identity-'));
    const docker = join(root, 'docker');
    const releaseSha = 'a'.repeat(40);
    const contentId = `sha256:${'f'.repeat(64)}`;
    writeFileSync(
      docker,
      `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *Config.Image*) printf '%s\\n' 'commcats-eventos-app' ;;
  *.Image*) printf '%s\\n' '${contentId}' ;;
  *EVENTOS_RELEASE_SHA=*|*.Config.Env*) printf 'EVENTOS_RELEASE_SHA=%s\\n' "$EVENTOS_RELEASE_SHA" ;;
  *com.docker.compose.project.working_dir*) printf '%s\\n' "$EVENTOS_WORKING_DIR" ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o700 },
    );
    const result = runExtractedFunction(
      `${normalizeImage}\n${identity}`,
      'export EVENTOS_RELEASE_SHA="$EXPECTED_SHA"; read_eventos_container_identity fixture',
      {
        PATH: `${root}:${process.env.PATH ?? ''}`,
        EXPECTED_SHA: releaseSha,
        EVENTOS_WORKING_DIR: '/opt/commcats-eventos/current',
      },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`EVENTOS_IDENTITY\tcommcats-eventos-app\t${contentId}\t${releaseSha}\t/opt/commcats-eventos/current`);
  });

  it('requires the documented EventOS health and ready identity fields and exact marker revision', () => {
    const eventosIdentity = extractFunction(helper, 'assert_eventos_identity');
    const eventosHealthIdentity = extractFunction(helper, 'assert_eventos_health_identity');
    const eventosReadyIdentity = extractFunction(helper, 'assert_eventos_ready_identity');
    const lowercase = extractFunction(helper, 'lowercase');
    const expectedRevision = 'a'.repeat(40);
    const valid = runExtractedFunction('', [
      `EVENTOS_RELEASE_SHA=${expectedRevision}`,
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos","version":"2.4.0"}'`,
      lowercase,
      eventosIdentity,
      'assert_eventos_identity',
    ].join('\n'));
    expect(valid.status, `${valid.stdout}${valid.stderr}`).toBe(0);
    const health = runExtractedFunction('', [
      `EVENTOS_RELEASE_SHA=${expectedRevision}`,
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos","version":"2.4.0"}'`,
      lowercase,
      eventosIdentity,
      eventosHealthIdentity,
      'assert_eventos_health_identity',
    ].join('\n'));
    expect(health.status, `${health.stdout}${health.stderr}`).toBe(0);
    const nonExactHealth = runExtractedFunction('', [
      `EVENTOS_RELEASE_SHA=${expectedRevision}`,
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos","version":"2.4.0","checks":[]}'`,
      lowercase,
      eventosIdentity,
      eventosHealthIdentity,
      'assert_eventos_health_identity',
    ].join('\n'));
    expect(nonExactHealth.status).not.toBe(0);
    const ready = runExtractedFunction('', [
      `EVENTOS_RELEASE_SHA=${expectedRevision}`,
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos","version":"2.4.0","checks":[{"name":"database","ok":true}],"timestamp":"2026-08-21T12:00:00.000Z"}'`,
      lowercase,
      eventosIdentity,
      eventosReadyIdentity,
      'assert_eventos_ready_identity',
    ].join('\n'));
    expect(ready.status, `${ready.stdout}${ready.stderr}`).toBe(0);
    const badReady = runExtractedFunction('', [
      `EVENTOS_RELEASE_SHA=${expectedRevision}`,
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos","version":"2.4.0","checks":[{"name":"database","ok":false}]}'`,
      lowercase,
      eventosIdentity,
      eventosReadyIdentity,
      'assert_eventos_ready_identity',
    ].join('\n'));
    expect(badReady.status).not.toBe(0);
    for (const body of [
      `{"ok":true,"revision":"${'b'.repeat(40)}","service":"commcats-eventos","version":"2.4.0"}`,
      `{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos","version":""}`,
      `{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos"}`,
      `{"ok":true,"revision":"${expectedRevision}","service":"commcats-eventos","version":"2.4.0","gitSha":"${expectedRevision}"}`,
    ]) {
      const rejected = runExtractedFunction('', [
        `EVENTOS_RELEASE_SHA=${expectedRevision}`,
        'HTTP_CONTENT_TYPE=application/json',
        `HTTP_BODY='${body}'`,
        lowercase,
        eventosIdentity,
        'assert_eventos_identity',
      ].join('\n'));
      expect(rejected.status).not.toBe(0);
    }
  });

  it('validates rollback pointer, archive and sidecar as non-symlink files in the rollback root', () => {
    const manifest = extractFunction(helper, 'validate_manifest_file');
    const rollback = extractFunction(helper, 'validate_rollback_evidence');
    const createFixture = (kind: 'valid' | 'pointer-symlink' | 'archive-symlink' | 'bad-manifest' | 'invalid-tar') => {
      const root = mkdtempSync(join(tmpdir(), 'post-cutover-evidence-rollback-'));
      const canonicalRoot = realpathSync(root);
      writeFileSync(
        join(root, 'realpath'),
        '#!/usr/bin/env bash\nif [[ "$1" == -e ]]; then shift; fi\npython3 -c \'import os, sys; print(os.path.realpath(sys.argv[1]))\' "$1"\n',
        { mode: 0o700 },
      );
      const archive = join(root, 'shared-edge-20260821T120000Z.tar.gz');
      const pointer = join(root, 'latest');
      const sidecar = `${archive}.manifest`;
      const manifestText = [
        `commit=${'b'.repeat(40)}`,
        'mode=cutover',
        'deployed_at=2026-08-21T12:00:00Z',
        `rollback_root=${canonicalRoot}`,
        '',
      ].join('\n');
      const archiveContent = join(root, 'archive-content');
      mkdirSync(archiveContent);
      writeFileSync(join(archiveContent, 'Caddyfile'), 'fixture caddy\n');
      writeFileSync(join(archiveContent, 'docker-compose.yml'), 'fixture compose\n');
      if (kind === 'invalid-tar') {
        writeFileSync(archive, 'fixture archive\n');
      } else if (kind !== 'archive-symlink') {
        const archiveResult = spawnSync('tar', ['-czf', archive, '-C', archiveContent, '.'], { encoding: 'utf8' });
        expect(archiveResult.status, `${archiveResult.stdout}${archiveResult.stderr}`).toBe(0);
      }
      writeFileSync(sidecar, kind === 'bad-manifest' ? `${manifestText}unexpected=value\n` : manifestText);
      if (kind === 'pointer-symlink') {
        const outside = join(root, 'outside-pointer');
        writeFileSync(outside, `${archive}\n`);
        symlinkSync(outside, pointer);
      } else if (kind === 'archive-symlink') {
        const outside = join(root, 'outside-archive');
        writeFileSync(outside, 'fixture archive\n');
        symlinkSync(outside, archive);
        writeFileSync(pointer, `${archive}\n`);
      } else {
        writeFileSync(pointer, `${archive}\n`);
      }
      return root;
    };
    const validRoot = createFixture('valid');
    const valid = runExtractedFunction(
      `${manifest}\n${rollback}`,
      'validate_rollback_evidence "$ROOT"',
      { ROOT: realpathSync(validRoot), PATH: `${validRoot}:${process.env.PATH ?? ''}` },
    );
    expect(valid.status, `${valid.stdout}${valid.stderr}`).toBe(0);
    for (const kind of ['pointer-symlink', 'archive-symlink', 'bad-manifest', 'invalid-tar'] as const) {
      const root = createFixture(kind);
      const rejected = runExtractedFunction(`${manifest}\n${rollback}`, 'validate_rollback_evidence "$ROOT"', {
        ROOT: realpathSync(root),
        PATH: `${root}:${process.env.PATH ?? ''}`,
      });
      expect(rejected.status).not.toBe(0);
    }
  });

  it('fails closed when the deploy lock is active or ambiguous and fingerprints relevant files', () => {
    const lock = extractFunction(helper, 'validate_deploy_lock_absent');
    const generation = extractFunction(helper, 'read_edge_generation');
    const generationLine = extractFunction(helper, 'generation_line');
    const compareGeneration = extractFunction(helper, 'compare_generation_invariants');
    const stateField = extractFunction(helper, 'state_field');
    const root = mkdtempSync(join(tmpdir(), 'post-cutover-evidence-generation-'));
    for (const file of ['.deploy-manifest', 'docker-compose.yml', 'Caddyfile']) {
      writeFileSync(join(root, file), `${file}=fixture\n`);
    }
    const clear = runExtractedFunction(lock, 'validate_deploy_lock_absent "$ROOT_LOCK"', { ROOT_LOCK: `${root}.deploy-lock` });
    expect(clear.status, `${clear.stdout}${clear.stderr}`).toBe(0);
    writeFileSync(`${root}.deploy-lock`, 'active\n');
    const active = runExtractedFunction(lock, 'validate_deploy_lock_absent "$ROOT_LOCK"', { ROOT_LOCK: `${root}.deploy-lock` });
    expect(active.status).not.toBe(0);
    writeFileSync(`${root}.deploy-lock`, '');
    const generationResult = runExtractedFunction(generation, 'read_edge_generation "$ROOT"', { ROOT: root });
    expect(generationResult.status, `${generationResult.stdout}${generationResult.stderr}`).toBe(0);
    expect(generationResult.stdout).toContain('GENERATION\t.deploy-manifest\t');
    const compare = runExtractedFunction(compareGeneration, [
      stateField,
      generationLine,
      `before_snapshot='GENERATION\t.deploy-manifest\t${'a'.repeat(64)}\nGENERATION\tdocker-compose.yml\t${'b'.repeat(64)}\nGENERATION\tCaddyfile\t${'c'.repeat(64)}'`,
      `after_snapshot='GENERATION\t.deploy-manifest\t${'a'.repeat(64)}\nGENERATION\tdocker-compose.yml\t${'b'.repeat(64)}\nGENERATION\tCaddyfile\t${'c'.repeat(64)}'`,
      'compare_generation_invariants',
    ].join('\n'));
    expect(compare.status, `${compare.stdout}${compare.stderr}`).toBe(0);
    const drift = runExtractedFunction(compareGeneration, [
      stateField,
      generationLine,
      `before_snapshot='GENERATION\t.deploy-manifest\t${'a'.repeat(64)}'`,
      `after_snapshot='GENERATION\t.deploy-manifest\t${'d'.repeat(64)}'`,
      'compare_generation_invariants',
    ].join('\n'));
    expect(drift.status).not.toBe(0);
  });

  it('compares complete network IDs, drivers, scopes, members and aliases across snapshots', () => {
    expect(helper).toContain('compare_network_invariants');
    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const validFixture = inventoryFixture();
    const missingContainerAlias = inventoryFixture({
      networks: {
        'catering-web': 'platform-infra_default=web;zeiterfassung_default=web,platform-infra-web-1;',
      },
    });
    const fixture = `set -euo pipefail\nfail() { printf '%s\\n' "$1"; exit 1; }\nstate_line() { printf '%s\\n' "$1" | awk -F '\\t' -v component="$2" '$1 == "STATE" && $2 == component { print; count += 1 } END { if (count != 1) exit 1 }'; }\nstate_field() { printf '%s\\n' "$1" | awk -F '\\t' -v field_number="$2" '{ print $field_number }'; }\n${validator}\nvalidate_allowlisted_inventory "$SNAPSHOT"`;
    const rejected = spawnSync('bash', ['-c', fixture], {
      encoding: 'utf8',
      env: { ...process.env, SNAPSHOT: missingContainerAlias },
    });
    expect(rejected.status).not.toBe(0);
    expect(`${rejected.stdout}${rejected.stderr}`).toMatch(/alias|network/);
    expect(validFixture).toContain('NETWORK\tplatform-infra_default');
  });

  it('requires a correlated process/cgroup or docker-proxy proof for every public listener', () => {
    expect(helper).toContain('validate_public_listener_ownership');
    expect(helper).toContain('listener PID');
    expect(helper).toContain('Shared Edge container PID');
    expect(helper).toContain('container IP');
  });

  it('accepts exactly one Shared Edge Docker owner when ss hides listener PIDs', () => {
    const validator = extractFunction(helper, 'validate_public_listener_ownership');
    const root = mkdtempSync(join(tmpdir(), 'post-cutover-listener-no-pid-'));
    const dockerStub = join(root, 'docker');
    const ssStub = join(root, 'ss');
    writeFileSync(
      dockerStub,
      [
        '#!/usr/bin/env bash',
        'case "$*" in',
        '  *".State.Pid"*) printf "%s\\n" 4242 ;;',
        '  *"IPAddress"*) printf "%s\\n" 172.31.0.2 ;;',
        '  *) exit 1 ;;',
        'esac',
      ].join('\n'),
      { mode: 0o700 },
    );
    writeFileSync(
      ssStub,
      [
        '#!/usr/bin/env bash',
        "printf '%s\\n' 'LISTEN 0 4096 0.0.0.0:80 0.0.0.0:*'",
        "printf '%s\\n' 'LISTEN 0 4096 0.0.0.0:443 0.0.0.0:*'",
      ].join('\n'),
      { mode: 0o700 },
    );
    chmodSync(dockerStub, 0o700);
    chmodSync(ssStub, 0o700);
    const sharedEdgeId = 'a'.repeat(64);
    const result = runExtractedFunction(
      validator,
      [
        'mapfile() {',
        '  if [[ "${1:-}" == "-t" ]]; then shift; fi',
        '  local variable="${1:-}" line',
        '  local -a values=()',
        '  while IFS= read -r line; do values+=("$line"); done',
        '  [[ "$variable" == listener_lines ]] || return 2',
        '  listener_lines=("${values[@]}")',
        '}',
        `port_owner_lines=$'PORT_OWNER\\t80\\t${sharedEdgeId}\\tshared-edge-edge-1\\nPORT_OWNER\\t443\\t${sharedEdgeId}\\tshared-edge-edge-1'`,
        `validate_public_listener_ownership ${sharedEdgeId}`,
      ].join('\n'),
      { PATH: `${root}${delimiter}${originalProcessPath}` },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('LISTENER\t');
    expect(`${result.stdout}${result.stderr}`).not.toContain('SECRET');
  });

  it('rejects PID-less listeners with a wrong, duplicate or foreign-app Docker owner', () => {
    const validator = extractFunction(helper, 'validate_public_listener_ownership');
    const sharedEdgeId = 'a'.repeat(64);
    const foreignId = 'b'.repeat(64);
    const runValidator = (ownerLines: string) => {
      const root = mkdtempSync(join(tmpdir(), 'post-cutover-listener-owner-negative-'));
      writeFileSync(
        join(root, 'docker'),
        [
          '#!/usr/bin/env bash',
          'case "$*" in',
          '  *".State.Pid"*) printf "%s\\n" 4242 ;;',
          '  *"IPAddress"*) printf "%s\\n" 172.31.0.2 ;;',
          '  *) exit 1 ;;',
          'esac',
        ].join('\n'),
        { mode: 0o700 },
      );
      writeFileSync(
        join(root, 'ss'),
        [
          '#!/usr/bin/env bash',
          "printf '%s\\n' 'LISTEN 0 4096 0.0.0.0:80 0.0.0.0:*'",
          "printf '%s\\n' 'LISTEN 0 4096 0.0.0.0:443 0.0.0.0:*'",
        ].join('\n'),
        { mode: 0o700 },
      );
      chmodSync(join(root, 'docker'), 0o700);
      chmodSync(join(root, 'ss'), 0o700);
      return runExtractedFunction(
        validator,
        [
          'mapfile() {',
          '  if [[ "${1:-}" == "-t" ]]; then shift; fi',
          '  local variable="${1:-}" line',
          '  local -a values=()',
          '  while IFS= read -r line; do values+=("$line"); done',
          '  [[ "$variable" == listener_lines ]] || return 2',
          '  listener_lines=("${values[@]}")',
          '}',
          `port_owner_lines=$'${ownerLines.replaceAll('\t', '\\t').replaceAll('\n', '\\n')}'`,
          `validate_public_listener_ownership ${sharedEdgeId}`,
        ].join('\n'),
        { PATH: `${root}${delimiter}${originalProcessPath}` },
      );
    };
    const wrongOwner = runValidator(`PORT_OWNER\t80\t${foreignId}\tcatering-web\nPORT_OWNER\t443\t${sharedEdgeId}\tshared-edge-edge-1`);
    expect(wrongOwner.status).not.toBe(0);
    expect(`${wrongOwner.stdout}${wrongOwner.stderr}`).toMatch(/Docker ownership|foreign/);
    const duplicateOwner = runValidator(`PORT_OWNER\t80\t${sharedEdgeId}\tshared-edge-edge-1\nPORT_OWNER\t80\t${foreignId}\tcatering-web\nPORT_OWNER\t443\t${sharedEdgeId}\tshared-edge-edge-1`);
    expect(duplicateOwner.status).not.toBe(0);
    expect(`${duplicateOwner.stdout}${duplicateOwner.stderr}`).toMatch(/Docker ownership|foreign/);
    expect(`${wrongOwner.stdout}${wrongOwner.stderr}${duplicateOwner.stdout}${duplicateOwner.stderr}`).not.toContain('SECRET');
  });

  it('binds effective Caddy host mappings to the hashed read-only mount and runtime values', () => {
    expect(helper).toContain('CADDYFILE_SHA256');
    expect(helper).toContain('Caddyfile import is not allowlisted');
    expect(helper).toContain('CATERING_PUBLIC_HOST');
    expect(helper).toContain('EVENTOS_PUBLIC_HOST');
    expect(helper).toContain('reverse_proxy');
    const caddyValidation = extractFunction(helper, 'validate_effective_caddy_config');
    const root = mkdtempSync(join(tmpdir(), 'caddy-hash-fixture-'));
    writeFileSync(join(root, 'Caddyfile'), readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url)));
    const wrongHash = runExtractedFunction(
      caddyValidation,
      `edge_path="$ROOT"; edge_id=fixture; expected_caddyfile_sha256='${'d'.repeat(64)}'; validate_effective_caddy_config`,
      { ROOT: root },
    );
    expect(wrongHash.status).not.toBe(0);
    expect(`${wrongHash.stdout}${wrongHash.stderr}`).toContain('Caddyfile hash differs');
  });

  it('accepts optional Docker mount modes while enforcing exact destination, source and RW=false', () => {
    expect(helper).toContain('{{printf "%s\\t%s\\t%t\\n" .Source .Destination .RW}}');
    expect(helper).not.toContain('.Mode');
    const caddyValidation = extractFunction(helper, 'validate_effective_caddy_config');
    const root = mkdtempSync(join(tmpdir(), 'caddy-mount-fixture-'));
    const caddyPath = join(root, 'Caddyfile');
    const wrongSource = join(root, 'not-the-caddyfile');
    const dockerStub = join(root, 'docker');
    const realpathStub = join(root, 'realpath');
    writeFileSync(caddyPath, readFileSync(new URL('../edge-infra/Caddyfile', import.meta.url)));
    writeFileSync(wrongSource, 'different source\n');
    writeFileSync(
      dockerStub,
      String.raw`#!/usr/bin/env bash
if [[ "$*" == *".Mounts"* ]]; then
  printf '%s\n' "$MOUNT_LINE" | awk -F '\t' 'NF == 4 { printf "%s\t%s\t%s\n", $1, $2, $4; next } { print }'
  exit 0
fi
exit 1
`,
      { mode: 0o700 },
    );
    chmodSync(dockerStub, 0o700);
    writeFileSync(
      realpathStub,
      '#!/usr/bin/env node\n' +
        "const fs = require('node:fs');\n" +
        "const args = process.argv.slice(2);\n" +
        "if (args[0] === '-e') args.shift();\n" +
        "try { process.stdout.write(fs.realpathSync(args[0]) + '\\n'); } catch (_error) { process.exit(1); }\n",
      { mode: 0o700 },
    );
    chmodSync(realpathStub, 0o700);

    const mountScript = [
      'read_effective_edge_value() {',
      '  case "$2" in',
      '    CATERING_PUBLIC_HOST) printf "%s" catering.the-one.catering ;;',
      '    ZEITERFASSUNG_PUBLIC_HOST) printf "%s" zeit.the-one.catering ;;',
      '    EVENTOS_PUBLIC_HOST) printf "%s" eventos.commcats.de ;;',
      '    *) return 1 ;;',
      '  esac',
      '}',
      'edge_path="$ROOT"',
      'edge_id=fixture',
      'expected_caddyfile_sha256="' + caddyfileSha256 + '"',
      'validate_effective_caddy_config',
    ].join('\n');
    const runMountCase = (mountLine: string) => runExtractedFunction(
      caddyValidation,
      mountScript,
      {
        ROOT: root,
        PATH: root + delimiter + originalProcessPath,
        MOUNT_LINE: mountLine,
        SECRET_FIXTURE: 'fixture-secret-must-not-leak',
      },
    );

    const modeEmpty = runMountCase(caddyPath + '\t/etc/caddy/Caddyfile\tfalse');
    expect(modeEmpty.status, modeEmpty.stdout + modeEmpty.stderr).toBe(0);

    const modeWithExtraOption = runMountCase(caddyPath + '\t/etc/caddy/Caddyfile\tro,Z\tfalse');
    expect(modeWithExtraOption.status, modeWithExtraOption.stdout + modeWithExtraOption.stderr).toBe(0);

    const writable = runMountCase(caddyPath + '\t/etc/caddy/Caddyfile\ttrue');
    expect(writable.status).not.toBe(0);
    expect(writable.stdout + writable.stderr).toContain('destination=/etc/caddy/Caddyfile');
    expect(writable.stdout + writable.stderr).toContain('rw=true');

    const wrongDestination = runMountCase(caddyPath + '\t/etc/caddy/other\tfalse');
    expect(wrongDestination.status).not.toBe(0);
    expect(wrongDestination.stdout + wrongDestination.stderr).toContain('destination=/etc/caddy/other');
    expect(wrongDestination.stdout + wrongDestination.stderr).toContain('rw=false');

    const missingMount = runMountCase('');
    expect(missingMount.status).not.toBe(0);
    expect(missingMount.stdout + missingMount.stderr).toContain('destination=/etc/caddy/Caddyfile');
    expect(missingMount.stdout + missingMount.stderr).toContain('rw=missing-or-ambiguous');

    const ambiguousMount = runMountCase([
      caddyPath + '\t/etc/caddy/Caddyfile\tfalse',
      caddyPath + '\t/etc/caddy/Caddyfile\tfalse',
    ].join('\n'));
    expect(ambiguousMount.status).not.toBe(0);
    expect(ambiguousMount.stdout + ambiguousMount.stderr).toContain('rw=missing-or-ambiguous');

    const emptySource = runMountCase('\t/etc/caddy/Caddyfile\tfalse');
    expect(emptySource.status).not.toBe(0);

    const emptyDestination = runMountCase(caddyPath + '\t\tfalse');
    expect(emptyDestination.status).not.toBe(0);

    const wrongSourceResult = runMountCase(wrongSource + '\t/etc/caddy/Caddyfile\tfalse');
    expect(wrongSourceResult.status).not.toBe(0);
    expect(wrongSourceResult.stdout + wrongSourceResult.stderr).toContain('source-realpath=mismatch');

    for (const result of [modeEmpty, modeWithExtraOption, writable, wrongDestination, missingMount, ambiguousMount, emptySource, emptyDestination, wrongSourceResult]) {
      expect(result.stdout + result.stderr).not.toContain('fixture-secret-must-not-leak');
    }
  });

  it('rejects EventOS marker-only identity and requires image/Compose provenance', () => {
    expect(helper).toContain('EVENTOS_IMAGE');
    expect(helper).toContain('commcats-eventos');
    expect(helper).toContain('compose.project.working_dir');
    expect(helper).toContain('EventOS image name');
    expect(helper).toContain('EventOS local content ID');
    expect(helper).not.toContain('commcats-eventos-app@sha256:');
  });

  it('closes TOCTOU inside one remote snapshot, not only between before and after snapshots', () => {
    expect(helper).toContain('snapshot_generation_before');
    expect(helper).toContain('snapshot_generation_after');
    expect(helper).toContain('snapshot lock state changed');
    expect(helper).toContain('snapshot manifest changed');
  });

  it('resolves the fake remote sha256sum from the original PATH and fails closed when missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'post-cutover-sha256sum-resolution-'));
    const originalBin = join(root, 'original-bin');
    mkdirSync(originalBin);
    const expectedBinary = join(originalBin, 'sha256sum');
    writeFileSync(expectedBinary, '#!/usr/bin/env bash\nexit 0\n', { mode: 0o700 });
    chmodSync(expectedBinary, 0o700);
    const originalPath = `${originalBin}${delimiter}${join(root, 'missing-bin')}`;

    const fixture = createFakeRemoteFixture('valid', originalPath);
    expect(fixture.environment.REAL_SHA256SUM).toBe(expectedBinary);
    expect(() => createFakeRemoteFixture('valid', join(root, 'missing-bin'))).toThrow(
      /Unable to resolve sha256sum from original PATH/,
    );
  });

  it('executes the valid SSH heredoc through a fake remote with a bounded local process timeout', () => {
    const remoteSnapshot = extractRemoteSnapshot(helper);
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const validFixture = createFakeRemoteFixture('valid');
    const validRemote = runExtractedFunction(
      remoteSnapshot,
      [
        'SSH_ARGS=(--batch-mode)',
        'REMOTE=fixture',
        'EXPECTED_CADDYFILE_SHA256="$HARNESS_EXPECTED_CADDY_SHA"',
        'remote_snapshot',
      ].join('\n'),
      validFixture.environment,
      50000,
    );
    expect(validRemote.status, `${validRemote.stdout}${validRemote.stderr}`).toBe(0);
    expect(validRemote.stdout).toContain('STATE\tshared-edge');
    expect(readFileSync(join(validFixture.root, 'remote-script.log'), 'utf8')).toContain('validate_effective_caddy_config');
    expect(validRemote.stdout).not.toContain('Authorization');
    expect(validRemote.stdout).not.toContain('SECRET');
    const validInventory = runExtractedFunction(
      `${stateLine}\n${stateField}\n${validator}`,
      'validate_allowlisted_inventory "$SNAPSHOT"',
      { SNAPSHOT: validRemote.stdout },
    );
    expect(validInventory.status, `${validInventory.stdout}${validInventory.stderr}`).toBe(0);
  }, 60000);

  it('accepts the exact three-container Iranmonitor inventory through the remote snapshot and allowlist', () => {
    const { result } = runFakeRemoteSnapshot('iranmonitor-exact');
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('STATE\tiranmonitor-web');
    expect(result.stdout).toContain('STATE\tiranmonitor-ingest');
    expect(result.stdout).toContain('STATE\tiranmonitor-db');
    expect(result.stdout).toContain('0.0.0.0:3000->3000/tcp');
    expect(result.stdout).toContain('127.0.0.1:5432->5432/tcp');
    expect(result.stdout).toContain('deploy_default');

    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const validInventory = runExtractedFunction(
      `${stateLine}\n${stateField}\n${validator}`,
      'validate_allowlisted_inventory "$SNAPSHOT"',
      { SNAPSHOT: result.stdout },
    );
    expect(validInventory.status, `${validInventory.stdout}${validInventory.stderr}`).toBe(0);
  }, 60000);

  it('keeps an additional deploy/Iranmonitor consumer fail-closed while diagnosing only that unknown', () => {
    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const result = runExtractedFunction(
      `${stateLine}\n${stateField}\n${validator}`,
      'validate_allowlisted_inventory "$SNAPSHOT"',
      { SNAPSHOT: iranmonitorInventoryFixture({ extra: true }) },
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('runtime inventory component allowlist mismatch');
  });

  it.each([
    ['image', iranmonitorInventoryFixture({ web: { image: 'deploy-web:latest' } }), 'Iranmonitor web image identity'],
    ['web host port 80', iranmonitorInventoryFixture({ web: { ports: '0.0.0.0:3000->80/tcp' } }), 'Iranmonitor web port bindings'],
    ['web host port 443', iranmonitorInventoryFixture({ web: { ports: '0.0.0.0:3000->443/tcp' } }), 'Iranmonitor web port bindings'],
    ['database public binding', iranmonitorInventoryFixture({ db: { ports: '0.0.0.0:5432->5432/tcp' } }), 'Iranmonitor db port bindings'],
    ['ingest host port', iranmonitorInventoryFixture({ ingest: { ports: '0.0.0.0:8080->8080/tcp' } }), 'Iranmonitor ingest port bindings'],
    ['unexpected network', iranmonitorInventoryFixture({ web: { networks: 'deploy_default=web,deploy-web-1;shared-edge_default=web,deploy-web-1;' } }), 'iranmonitor-web has an unknown or duplicate network attachment'],
    ['foreign deploy network consumer', iranmonitorInventoryFixture({ foreignMember: true }), 'unknown network consumer on deploy_default'],
  ])('rejects Iranmonitor %s drift in the executed allowlist helper', (_name, snapshot, expected) => {
    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const result = runExtractedFunction(
      `${stateLine}\n${stateField}\n${validator}`,
      'validate_allowlisted_inventory "$SNAPSHOT"',
      { SNAPSHOT: snapshot },
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(expected);
  });

  it('normalizes Iranmonitor bindings with HostIP, HostPort and container protocol', () => {
    const reader = extractFunction(helper, 'read_iranmonitor_port_bindings');
    const root = mkdtempSync(join(tmpdir(), 'iranmonitor-port-bindings-'));
    writeFileSync(
      join(root, 'docker'),
      '#!/usr/bin/env bash\nprintf \'%s\\n\' $\'0.0.0.0\\t3000/tcp\\t3000\' $\'127.0.0.1\\t5432/tcp\\t5432\'\n',
      { mode: 0o700 },
    );
    const result = runExtractedFunction(
      reader,
      'read_iranmonitor_port_bindings fixture',
      { PATH: `${root}${delimiter}${originalProcessPath}` },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout.trimEnd()).toBe('0.0.0.0:3000->3000/tcp;127.0.0.1:5432->5432/tcp;');
  });

  it.each([
    ['restart count', 'a'.repeat(64), 'a'.repeat(64), '0', '1', 'deploy_default=web,deploy-web-1;', 'deploy_default=web,deploy-web-1;', '0.0.0.0:3000->3000/tcp;', '0.0.0.0:3000->3000/tcp;', 'RestartCount changed'],
    ['container ID', 'a'.repeat(64), 'b'.repeat(64), '0', '0', 'deploy_default=web,deploy-web-1;', 'deploy_default=web,deploy-web-1;', '0.0.0.0:3000->3000/tcp;', '0.0.0.0:3000->3000/tcp;', 'Container ID changed'],
    ['network', 'a'.repeat(64), 'a'.repeat(64), '0', '0', 'deploy_default=web,deploy-web-1;', 'deploy_default=web,deploy-web-1;shared-edge_default=web,deploy-web-1;', '0.0.0.0:3000->3000/tcp;', '0.0.0.0:3000->3000/tcp;', 'network mapping changed'],
    ['port binding', 'a'.repeat(64), 'a'.repeat(64), '0', '0', 'deploy_default=web,deploy-web-1;', 'deploy_default=web,deploy-web-1;', '0.0.0.0:3000->3000/tcp;', '0.0.0.0:3000->443/tcp;', 'port bindings changed'],
  ])('rejects Iranmonitor %s between pre- and post-smoke snapshots', (_name, beforeId, afterId, beforeRestart, afterRestart, beforeNetworks, afterNetworks, beforePorts, afterPorts, expected) => {
    const compare = extractFunction(helper, 'compare_iranmonitor_invariants');
    const canonicalizer = extractFunction(helper, 'canonicalize_network_mapping');
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const makeSnapshot = (id: string, restart: string, networks: string, ports: string) => [
      `STATE\tiranmonitor-web\t${id}\tdeploy-web-1\tdeploy-web\trunning\tstarted\t${restart}\t${ports}\t${networks}\tdeploy\tweb\tFalse\t1\t${networks}`,
      `STATE\tiranmonitor-ingest\t${'c'.repeat(64)}\tdeploy-ingest-1\tdeploy-ingest\trunning\tstarted\t0\tnone\tdeploy_default=ingest,deploy-ingest-1;\tdeploy\tingest\tFalse\t1\tdeploy_default=ingest,deploy-ingest-1;`,
      `STATE\tiranmonitor-db\t${'d'.repeat(64)}\tdeploy-db-1\tpostgres:16-alpine\trunning\tstarted\t0\t127.0.0.1:5432->5432/tcp\tdeploy_default=db,deploy-db-1;\tdeploy\tdb\tFalse\t1\tdeploy_default=db,deploy-db-1;`,
    ].join('\n');
    const result = runExtractedFunction(
      `${stateLine}\n${stateField}\n${canonicalizer}\n${compare}`,
      `before_snapshot=$'${makeSnapshot(beforeId, beforeRestart, beforeNetworks, beforePorts).replaceAll('\\', '\\\\').replaceAll("'", "'\\''")}'; after_snapshot=$'${makeSnapshot(afterId, afterRestart, afterNetworks, afterPorts).replaceAll('\\', '\\\\').replaceAll("'", "'\\''")}'; compare_iranmonitor_invariants`,
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(expected);
  });

  it('accepts reordered Iranmonitor aliases as the same pre/post network mapping', () => {
    const compare = extractFunction(helper, 'compare_iranmonitor_invariants');
    const canonicalizer = extractFunction(helper, 'canonicalize_network_mapping');
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const makeSnapshot = (webNetworks: string) => [
      `STATE\tiranmonitor-web\t${'a'.repeat(64)}\tdeploy-web-1\tdeploy-web\trunning\tstarted\t0\t0.0.0.0:3000->3000/tcp;\t${webNetworks}\tdeploy\tweb\tFalse\t1\t${webNetworks}`,
      'STATE\tiranmonitor-ingest\t' + 'c'.repeat(64) + '\tdeploy-ingest-1\tdeploy-ingest\trunning\tstarted\t0\tnone\tdeploy_default=ingest,deploy-ingest-1;\tdeploy\tingest\tFalse\t1\tdeploy_default=ingest,deploy-ingest-1;',
      'STATE\tiranmonitor-db\t' + 'd'.repeat(64) + '\tdeploy-db-1\tpostgres:16-alpine\trunning\tstarted\t0\t127.0.0.1:5432->5432/tcp;\tdeploy_default=db,deploy-db-1;\tdeploy\tdb\tFalse\t1\tdeploy_default=db,deploy-db-1;',
    ].join('\n');
    const result = runExtractedFunction(
      `${stateLine}\n${stateField}\n${canonicalizer}\n${compare}`,
      'before_snapshot="$BEFORE_SNAPSHOT"\nafter_snapshot="$AFTER_SNAPSHOT"\ncompare_iranmonitor_invariants',
      {
        BEFORE_SNAPSHOT: makeSnapshot('deploy_default=web,deploy-web-1;'),
        AFTER_SNAPSHOT: makeSnapshot('deploy_default=deploy-web-1,web;'),
      },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });

  it('accepts reordered deploy_default member and alias sets as the same network invariant', () => {
    const compare = extractFunction(helper, 'compare_network_invariants');
    const canonicalizer = extractFunction(helper, 'canonicalize_network_mapping');
    const stateField = extractFunction(helper, 'state_field');
    const beforeSnapshot = [
      'NETWORK\tplatform-infra_default\tplatform-id\tbridge\tlocal\tplatform=platform;',
      'NETWORK\tzeiterfassung_default\tzeit-id\tbridge\tlocal\tzeit=zeit;',
      'NETWORK\tcommcats-eventos_default\teventos-id\tbridge\tlocal\teventos=eventos;',
      'NETWORK\tdeploy_default\tdeploy-id\tbridge\tlocal\tdeploy-db-1=db,deploy-db-1;deploy-ingest-1=ingest,deploy-ingest-1;deploy-web-1=web,deploy-web-1;',
    ].join('\n');
    const afterSnapshot = [
      'NETWORK\tplatform-infra_default\tplatform-id\tbridge\tlocal\tplatform=platform;',
      'NETWORK\tzeiterfassung_default\tzeit-id\tbridge\tlocal\tzeit=zeit;',
      'NETWORK\tcommcats-eventos_default\teventos-id\tbridge\tlocal\teventos=eventos;',
      'NETWORK\tdeploy_default\tdeploy-id\tbridge\tlocal\tdeploy-web-1=deploy-web-1,web;deploy-ingest-1=deploy-ingest-1,ingest;deploy-db-1=deploy-db-1,db;',
    ].join('\n');
    const result = runExtractedFunction(
      `${stateField}\n${canonicalizer}\n${compare}`,
      'before_snapshot="$BEFORE_SNAPSHOT"\nafter_snapshot="$AFTER_SNAPSHOT"\ncompare_network_invariants',
      { BEFORE_SNAPSHOT: beforeSnapshot, AFTER_SNAPSHOT: afterSnapshot },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });

  it.each([
    ['duplicate network/member', 'deploy_default=web;deploy_default=deploy-web-1;'],
    ['duplicate alias', 'deploy_default=web,web;'],
  ])('keeps %s fail-closed during network canonicalization', (_name, mapping) => {
    const canonicalizer = extractFunction(helper, 'canonicalize_network_mapping');
    const result = runExtractedFunction(
      canonicalizer,
      'canonicalize_network_mapping "$MAPPING"',
      { MAPPING: mapping },
    );
    expect(result.status).not.toBe(0);
  });

  it('emits only safe metadata for one unknown runtime container before one fail-closed abort', () => {
    const { fixture, result } = runFakeRemoteSnapshot('unknown-runtime');
    const diagnostic = `${result.stdout}${result.stderr}`;
    const unknownId = 'b'.repeat(64);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('UNKNOWN_RUNTIME_CONTAINER');
    expect(result.stderr).toContain('name=rogue-runtime-1');
    expect(result.stderr).toContain(`container_id=${unknownId}`);
    expect(result.stderr).toContain('image=rogue/image:1.0');
    expect(result.stderr).toContain('status=running');
    expect(result.stderr).toContain('started_at=2026-08-21T00:00:01Z');
    expect(result.stderr).toContain('restart_count=2');
    expect(result.stderr).toContain('compose_project=rogue-project');
    expect(result.stderr).toContain('compose_service=rogue-service');
    expect(result.stderr).toContain('network_names=rogue-net');
    expect(result.stderr).toContain('published_host_ports=8080/tcp=18080');
    expect(result.stderr).toContain('8443/tcp=18443');
    expect(diagnostic.match(/unknown runtime container or network consumer is outside the allowlist\./g)).toHaveLength(1);
    expect(diagnostic).not.toContain('AUTHORIZATION');
    expect(diagnostic).not.toContain('Bearer fixture-token');
    expect(diagnostic).not.toContain('SECRET');
    expect(diagnostic).not.toContain('fixture-secret');
    expect(diagnostic).not.toContain('com.example.foreign');
    expect(diagnostic).not.toContain('fixture-label');
    expect(existsSync(join(fixture.root, 'unknown-read.log'))).toBe(false);
  }, 60000);

  it('diagnoses every unknown runtime container before exactly one fail-closed abort', () => {
    const { result } = runFakeRemoteSnapshot('unknown-runtime-multiple');
    const diagnostic = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(result.stderr.match(/^UNKNOWN_RUNTIME_CONTAINER\b/gm)).toHaveLength(2);
    expect(result.stderr).toContain('name=rogue-runtime-1');
    expect(result.stderr).toContain(`container_id=${'b'.repeat(64)}`);
    expect(result.stderr).toContain('name=rogue-runtime-2');
    expect(result.stderr).toContain(`container_id=${'c'.repeat(64)}`);
    expect(result.stderr).toContain('image=rogue/image:1.0');
    expect(result.stderr).toContain('image=rogue/image:2.0');
    expect(result.stderr).toContain('network_names=rogue-net');
    expect(result.stderr).toContain('network_names=rogue-net-2');
    expect(diagnostic.match(/unknown runtime container or network consumer is outside the allowlist\./g)).toHaveLength(1);
    expect(diagnostic).not.toMatch(/AUTHORIZATION|Bearer fixture-token|SECRET|fixture-secret|com\.example\.foreign|fixture-label/);
  }, 60000);

  it('quotes control characters in unknown-container metadata without creating injected output lines', () => {
    const { result } = runFakeRemoteSnapshot('unknown-runtime-control');
    const diagnostic = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("compose_service=$'rogue-service-control\\nencoded'");
    expect(diagnostic).not.toMatch(/\nencoded(?:\r)?\n/);
    expect(diagnostic).not.toMatch(/AUTHORIZATION|SECRET|com\.example\.foreign/);
  }, 60000);

  it('runs the unknown-container inventory before an unrelated earlier evidence gate can abort', () => {
    const { result } = runFakeRemoteSnapshot('unknown-runtime-before-gate');
    const diagnostic = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('UNKNOWN_RUNTIME_CONTAINER');
    expect(result.stderr).toContain('name=rogue-runtime-1');
    expect(diagnostic.match(/unknown runtime container or network consumer is outside the allowlist\./g)).toHaveLength(1);
    expect(diagnostic).not.toContain('rollback archive is not a readable tar.gz archive');
  }, 60000);

  it('uses fixed safe placeholders when an unknown-container inspect fails and suppresses daemon stderr', () => {
    const { fixture, result } = runFakeRemoteSnapshot('unknown-runtime-inspect-failure');
    const diagnostic = `${result.stdout}${result.stderr}`;
    const unknownId = 'b'.repeat(64);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('UNKNOWN_RUNTIME_CONTAINER');
    expect(result.stderr).toContain(`container_id=${unknownId}`);
    for (const field of ['name', 'image', 'status', 'started_at', 'restart_count', 'compose_project', 'compose_service', 'network_names', 'published_host_ports']) {
      expect(result.stderr).toContain(`${field}=inspect-error`);
    }
    expect(diagnostic).not.toContain('docker-daemon-secret-error-marker');
    expect(diagnostic.match(/unknown runtime container or network consumer is outside the allowlist\./g)).toHaveLength(1);
    expect(existsSync(join(fixture.root, 'unknown-read.log'))).toBe(false);
  }, 60000);

  it('uses fixed placeholders for empty unknown-container metadata and preserves the single fail-closed abort', () => {
    const { result } = runFakeRemoteSnapshot('unknown-runtime-empty');
    const diagnostic = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('UNKNOWN_RUNTIME_CONTAINER');
    for (const field of ['image', 'status', 'started_at', 'restart_count', 'compose_project', 'compose_service', 'network_names', 'published_host_ports']) {
      expect(result.stderr).toContain(`${field}=missing`);
    }
    expect(diagnostic.match(/unknown runtime container or network consumer is outside the allowlist\./g)).toHaveLength(1);
  }, 60000);

  it('continues after a failed first unknown inspect and diagnoses every later unknown container', () => {
    const { result } = runFakeRemoteSnapshot('unknown-runtime-multiple-inspect-failure');
    const diagnostic = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(result.stderr.match(/^UNKNOWN_RUNTIME_CONTAINER\b/gm)).toHaveLength(2);
    expect(result.stderr).toContain(`container_id=${'b'.repeat(64)}`);
    expect(result.stderr).toContain(`container_id=${'c'.repeat(64)}`);
    expect(result.stderr).toContain('name=inspect-error');
    expect(result.stderr).toContain('name=rogue-runtime-2');
    expect(result.stderr).toContain('image=rogue/image:2.0');
    expect(diagnostic).not.toContain('docker-daemon-secret-error-marker');
    expect(diagnostic.match(/unknown runtime container or network consumer is outside the allowlist\./g)).toHaveLength(1);
  }, 60000);

  it('sorts unknown-container networks and published host ports deterministically', () => {
    const { result } = runFakeRemoteSnapshot('unknown-runtime-unsorted');
    const diagnostic = `${result.stdout}${result.stderr}`;
    const line = result.stderr.split('\n').find((entry) => entry.startsWith('UNKNOWN_RUNTIME_CONTAINER')) ?? '';

    expect(result.status).not.toBe(0);
    expect(line).toContain('network_names=alpha-net\\,middle-net\\,zeta-net');
    const firstPort = line.indexOf('8080/tcp=18080');
    const secondPort = line.indexOf('8443/tcp=18443');
    expect(firstPort).toBeGreaterThan(-1);
    expect(secondPort).toBeGreaterThan(firstPort);
    expect(diagnostic.match(/unknown runtime container or network consumer is outside the allowlist\./g)).toHaveLength(1);
  }, 60000);

  it('maps remote snapshot failures through the outer PHASE 2 NO-GO path without forwarding remote stderr', () => {
    const wrapper = extractFunction(helper, 'run_remote_snapshot_or_fail');
    const result = runExtractedFunction(
      `${extractFunction(helper, 'fail')}\n${wrapper}`,
      [
        'remote_snapshot() {',
        "  printf 'UNKNOWN_RUNTIME_CONTAINER\\tname=safe\\n' >&2",
        "  printf '%s\\n' 'remote evidence gate failed: shared-edge deploy lock is active or ambiguous.' >&2",
        "  printf '%s\\n' 'remote evidence gate failed: unknown runtime container or network consumer is outside the allowlist.' >&2",
        "  printf '%s\\n' 'docker-daemon-secret-error-marker' >&2",
        '  return 23',
        '}',
        'if ! snapshot="$(run_remote_snapshot_or_fail)"; then',
        '  fail "remote evidence snapshot failed."',
        'fi',
      ].join('\n'),
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('PHASE 2: NO-GO');
    expect(output).toContain('UNKNOWN_RUNTIME_CONTAINER\tname=safe');
    expect(output).toContain('remote evidence gate failed: shared-edge deploy lock is active or ambiguous.');
    expect(output).toContain('remote evidence gate failed: unknown runtime container or network consumer is outside the allowlist.');
    expect(output).not.toContain('docker-daemon-secret-error-marker');
    expect(helper.match(/if ! before_snapshot="\$\(run_remote_snapshot_or_fail\)"; then/g)).toHaveLength(1);
    expect(helper.match(/if ! after_snapshot="\$\(run_remote_snapshot_or_fail\)"; then/g)).toHaveLength(1);
  }, 30000);

  it.each([
      'listener-extra',
      'listener-missing',
      'listener-foreign-cgroup',
      'listener-wrong-docker-proxy',
      'invalid-tar',
      'manifest-drift',
  ])('rejects adversarial SSH fixture %s with a bounded local process timeout', (kind) => {
    const remoteSnapshot = extractRemoteSnapshot(helper);
    const fixture = createFakeRemoteFixture(kind);
    const result = runExtractedFunction(
      remoteSnapshot,
      [
        'SSH_ARGS=(--batch-mode)',
        'REMOTE=fixture',
        'EXPECTED_CADDYFILE_SHA256="$HARNESS_EXPECTED_CADDY_SHA"',
        'remote_snapshot',
      ].join('\n'),
      fixture.environment,
      50000,
    );
    expect(result.status, `${kind}: ${result.stdout}${result.stderr}`).not.toBe(0);
    expect(result.stdout, kind).not.toContain('Authorization');
    expect(result.stdout, kind).not.toContain('SECRET');
  }, 60000);

  it('rejects app containers publishing host 80/443 through nonstandard container ports', () => {
    const remoteSnapshot = extractRemoteSnapshot(helper);
    const fixture = createFakeRemoteFixture('foreign-app-host-ports');
    const result = runExtractedFunction(
      remoteSnapshot,
      [
        'SSH_ARGS=(--batch-mode)',
        'REMOTE=fixture',
        'EXPECTED_CADDYFILE_SHA256="$HARNESS_EXPECTED_CADDY_SHA"',
        'remote_snapshot',
      ].join('\n'),
      fixture.environment,
      50000,
    );
    expect(result.status, `${result.stdout}${result.stderr}`).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/application container still publishes host port|public 80\/443 ownership/);
    expect(result.stdout).not.toContain('SECRET');
  }, 60000);

  it('rejects EventOS 3000/tcp published on an alternate host port', () => {
    const remoteSnapshot = extractRemoteSnapshot(helper);
    const fixture = createFakeRemoteFixture('eventos-alternative-host-port');
    const result = runExtractedFunction(
      remoteSnapshot,
      [
        'SSH_ARGS=(--batch-mode)',
        'REMOTE=fixture',
        'EXPECTED_CADDYFILE_SHA256="$HARNESS_EXPECTED_CADDY_SHA"',
        'remote_snapshot',
      ].join('\n'),
      fixture.environment,
      50000,
    );
    expect(result.status, `${result.stdout}${result.stderr}`).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('EventOS publishes a forbidden container port.');
    expect(`${result.stdout}${result.stderr}`).not.toContain('Authorization');
    expect(`${result.stdout}${result.stderr}`).not.toContain('SECRET');
  }, 60000);

  it('rejects EventOS Postgres 5432/tcp published on an alternate host port', () => {
    const remoteSnapshot = extractRemoteSnapshot(helper);
    const fixture = createFakeRemoteFixture('eventos-postgres-alternative-host-port');
    const result = runExtractedFunction(
      remoteSnapshot,
      [
        'SSH_ARGS=(--batch-mode)',
        'REMOTE=fixture',
        'EXPECTED_CADDYFILE_SHA256="$HARNESS_EXPECTED_CADDY_SHA"',
        'remote_snapshot',
      ].join('\n'),
      fixture.environment,
      50000,
    );
    expect(result.status, `${result.stdout}${result.stderr}`).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('EventOS Postgres has a forbidden container port.');
    expect(`${result.stdout}${result.stderr}`).not.toContain('Authorization');
    expect(`${result.stdout}${result.stderr}`).not.toContain('SECRET');
  }, 60000);

  it('uses container and public evidence when the Zeiterfassung deployment root is unreadable', () => {
    const remoteSnapshot = extractRemoteSnapshot(helper);
    const fixture = createFakeRemoteFixture('unreadable-zeiterfassung-root');
    const result = runExtractedFunction(
      remoteSnapshot,
      [
        'SSH_ARGS=(--batch-mode)',
        'REMOTE=fixture',
        'EXPECTED_CADDYFILE_SHA256="$HARNESS_EXPECTED_CADDY_SHA"',
        'remote_snapshot',
      ].join('\n'),
      fixture.environment,
      70000,
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('STATE\tzeiterfassung-app');
    expect(result.stdout).toContain('ZEITERFASSUNG_CONTAINER');
    expect(`${result.stdout}${result.stderr}`).not.toContain('Permission denied');

    const lowercase = extractFunction(helper, 'lowercase');
    const releaseIdentity = extractFunction(helper, 'assert_zeiterfassung_release_identity');
    const readyIdentity = extractFunction(helper, 'assert_zeiterfassung_identity');
    const configIdentity = extractFunction(helper, 'assert_zeiterfassung_config_identity');
    const gitSha = '0123456789abcdef0123456789abcdef01234567';
    const publicIdentity = runExtractedFunction('', [
      'ZEITERFASSUNG_RELEASE_VERSION="9.9.9"',
      'ZEITERFASSUNG_RELEASE_GIT_SHA="fedcba9876543210fedcba9876543210fedcba98"',
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"version":"1.2.3","gitSha":"${gitSha}"}'`,
      lowercase,
      releaseIdentity,
      'assert_zeiterfassung_release_identity',
      `HTTP_BODY='{"ok":true,"version":"1.2.3","gitSha":"${gitSha}"}'`,
      readyIdentity,
      'assert_zeiterfassung_identity',
      `HTTP_BODY='{"ok":true,"environmentLabel":"Produktiv","version":"1.2.3","gitSha":"${gitSha}","appUrl":"https://zeit.the-one.catering","platformCustomersEnabled":false}'`,
      configIdentity,
      'assert_zeiterfassung_config_identity',
    ].join('\n'));
    expect(publicIdentity.status, `${publicIdentity.stdout}${publicIdentity.stderr}`).toBe(0);
  }, 120000);

  it('requires release version and SHA on Zeiterfassung ready and public-config responses', () => {
    const lowercase = extractFunction(helper, 'lowercase');
    const readyIdentity = extractFunction(helper, 'assert_zeiterfassung_identity');
    const configIdentity = extractFunction(helper, 'assert_zeiterfassung_config_identity');
    const validScript = [
      'ZEITERFASSUNG_RELEASE_VERSION=1.2.3',
      'ZEITERFASSUNG_RELEASE_GIT_SHA=0123456789abcdef0123456789abcdef01234567',
      'HTTP_CONTENT_TYPE=application/json',
      'HTTP_BODY=\'{"ok":true,"version":"1.2.3","gitSha":"0123456789abcdef0123456789abcdef01234567"}\'',
      lowercase,
      readyIdentity,
      'assert_zeiterfassung_identity',
      'HTTP_BODY=\'{"ok":true,"version":"1.2.3","gitSha":"0123456789abcdef0123456789abcdef01234567","environmentLabel":"Produktiv","appUrl":"https://zeit.the-one.catering","platformCustomersEnabled":false}\'',
      configIdentity,
      'assert_zeiterfassung_config_identity',
    ].join('\n');
    const validResult = runExtractedFunction('', validScript);
    expect(validResult.status, `${validResult.stdout}${validResult.stderr}`).toBe(0);

    const missingIdentity = [
      'ZEITERFASSUNG_RELEASE_VERSION=1.2.3',
      'ZEITERFASSUNG_RELEASE_GIT_SHA=0123456789abcdef0123456789abcdef01234567',
      'HTTP_CONTENT_TYPE=application/json',
      'HTTP_BODY=\'{"ok":true}\'',
      lowercase,
      readyIdentity,
      'assert_zeiterfassung_identity',
    ].join('\n');
    const missingResult = runExtractedFunction('', missingIdentity);
    expect(missingResult.status).not.toBe(0);
    expect(`${missingResult.stdout}${missingResult.stderr}`).toContain('Zeiterfassung semantic identity failed');
  });

  it('fails closed when public Zeiterfassung identity proofs disagree', () => {
    const lowercase = extractFunction(helper, 'lowercase');
    const releaseIdentity = extractFunction(helper, 'assert_zeiterfassung_release_identity');
    const readyIdentity = extractFunction(helper, 'assert_zeiterfassung_identity');
    const configIdentity = extractFunction(helper, 'assert_zeiterfassung_config_identity');
    const gitSha = '0123456789abcdef0123456789abcdef01234567';
    const mismatchedGitSha = 'fedcba9876543210fedcba9876543210fedcba98';
    const readyMismatch = runExtractedFunction('', [
      'ZEITERFASSUNG_RELEASE_VERSION="9.9.9"',
      'ZEITERFASSUNG_RELEASE_GIT_SHA="fedcba9876543210fedcba9876543210fedcba98"',
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"version":"1.2.3","gitSha":"${gitSha}"}'`,
      lowercase,
      releaseIdentity,
      'assert_zeiterfassung_release_identity',
      `HTTP_BODY='{"ok":true,"version":"1.2.4","gitSha":"${gitSha}"}'`,
      readyIdentity,
      'assert_zeiterfassung_identity',
    ].join('\n'));
    expect(readyMismatch.status).not.toBe(0);
    expect(`${readyMismatch.stdout}${readyMismatch.stderr}`).toContain('Zeiterfassung semantic identity failed');

    const configMismatch = runExtractedFunction('', [
      'ZEITERFASSUNG_RELEASE_VERSION="9.9.9"',
      'ZEITERFASSUNG_RELEASE_GIT_SHA="fedcba9876543210fedcba9876543210fedcba98"',
      'HTTP_CONTENT_TYPE=application/json',
      `HTTP_BODY='{"ok":true,"version":"1.2.3","gitSha":"${gitSha}"}'`,
      lowercase,
      releaseIdentity,
      'assert_zeiterfassung_release_identity',
      `HTTP_BODY='{"ok":true,"version":"1.2.3","gitSha":"${mismatchedGitSha}","environmentLabel":"Produktiv","appUrl":"https://zeit.the-one.catering","platformCustomersEnabled":false}'`,
      configIdentity,
      'assert_zeiterfassung_config_identity',
    ].join('\n'));
    expect(configMismatch.status).not.toBe(0);
    expect(`${configMismatch.stdout}${configMismatch.stderr}`).toContain('Zeiterfassung public config identity failed');
  });

  it('never prints a sensitive label or secret-like extra state field', () => {
    const summary = extractFunction(helper, 'print_container_summary');
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const stateFixture = `STATE\tshared-edge\t${'a'.repeat(64)}\tshared-edge-edge-1\tfixture:image\trunning\t2026-08-21T00:00:00Z\t0\t\tplatform-infra_default=edge,shared-edge-edge-1;\tshared-edge\tedge\tFalse\t1\tedge,shared-edge-edge-1\tcom.example.sensitive=do-not-print SECRET_VALUE`;
    const result = runExtractedFunction(
      summary,
      `${stateLine}\n${stateField}\nCOMPONENTS=(shared-edge); print_container_summary before $'${stateFixture}'`,
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).not.toContain('com.example.sensitive');
    expect(result.stdout).not.toContain('SECRET_VALUE');
    expect(result.stdout).not.toContain('LABELS');
  });

  it('keeps response headers, environment-like data and smoke credentials out of evidence output', () => {
    const fetchHttps = extractFunction(helper, 'fetch_https');
    const root = mkdtempSync(join(tmpdir(), 'post-cutover-evidence-curl-'));
    const curlStub = join(root, 'curl');
    writeFileSync(
      curlStub,
      '#!/usr/bin/env bash\nprintf "%s\\n" "$*" > "$ARGS_LOG"\nprintf "%s\\n" "Authorization: Bearer SECRET_VALUE"\nprintf "200\\tapplication/json\\tno-store\\n"\n',
      { mode: 0o700 },
    );
    const script = [
      'CURL_ARGS=(--fail --silent --show-error)',
      'HTTP_STATUS="" HTTP_CONTENT_TYPE="" HTTP_CACHE_CONTROL="" HTTP_BODY=""',
      'CATERING_SMOKE_BASIC_AUTH_USER=fixture-user CATERING_SMOKE_BASIC_AUTH_PASSWORD=fixture-password',
      'fetch_https https://zeit.the-one.catering/healthz basic',
    ].join('\n');
    const argsLog = join(root, 'curl-args');
    const result = runExtractedFunction(fetchHttps, script, {
      PATH: `${root}:${process.env.PATH ?? ''}`,
      ARGS_LOG: argsLog,
    });
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(`${result.stdout}${result.stderr}`).not.toContain('SECRET_VALUE');
    expect(`${result.stdout}${result.stderr}`).not.toContain('Authorization');
    expect(readFileSync(argsLog, 'utf8')).not.toContain('fixture-password');
  });

  it('compares EventOS local content IDs as a separate before/after smoke invariant', () => {
    const stateField = extractFunction(helper, 'state_field');
    const identityLine = extractFunction(helper, 'eventos_identity_line');
    const contentId = extractFunction(helper, 'eventos_content_id');
    const compareContentId = extractFunction(helper, 'compare_eventos_content_id_invariant');
    const beforeId = `sha256:${'e'.repeat(64)}`;
    const afterId = `sha256:${'d'.repeat(64)}`;
    const valid = runExtractedFunction(
      `${stateField}\n${identityLine}\n${contentId}\n${compareContentId}`,
      `before_snapshot=$'EVENTOS_IDENTITY\\tcommcats-eventos-app\\t${beforeId}\\t${'a'.repeat(40)}\\t/opt/commcats-eventos/current'\nafter_snapshot="$before_snapshot"\ncompare_eventos_content_id_invariant`,
    );
    expect(valid.status, `${valid.stdout}${valid.stderr}`).toBe(0);

    const drift = runExtractedFunction(
      `${stateField}\n${identityLine}\n${contentId}\n${compareContentId}`,
      `before_snapshot=$'EVENTOS_IDENTITY\\tcommcats-eventos-app\\t${beforeId}\\t${'a'.repeat(40)}\\t/opt/commcats-eventos/current'\nafter_snapshot=$'EVENTOS_IDENTITY\\tcommcats-eventos-app\\t${afterId}\\t${'a'.repeat(40)}\\t/opt/commcats-eventos/current'\ncompare_eventos_content_id_invariant`,
    );
    expect(drift.status).not.toBe(0);
    expect(`${drift.stdout}${drift.stderr}`).toContain('local content ID changed after smoke');
  });

  it('executes the helper ID/restart invariant function against changed fixture records', () => {
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const canonicalizer = extractFunction(helper, 'canonicalize_network_mapping');
    const compare = extractFunction(helper, 'compare_identity_invariants');
    const fixture = `
set -euo pipefail
COMPONENTS=(shared-edge)
fail() { printf '%s\\n' "$1"; exit 1; }
${stateLine}
${stateField}
${canonicalizer}
${compare}
before_snapshot=$'STATE\\tshared-edge\\tfull-before\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t0\\t80/tcp=80\\tplatform-infra_default=network;'
after_snapshot=$'STATE\\tshared-edge\\tfull-after\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t0\\t80/tcp=80\\tplatform-infra_default=network;'
compare_identity_invariants
`;
    const result = spawnSync('bash', ['-c', fixture], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Container ID changed');
  });

  it('executes allowlist fixtures that reject foreign labels, aliases, consumers and port owners', () => {
    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const fixture = `
set -euo pipefail
fail() { printf '%s\\n' "$1"; exit 1; }
${validator}
validate_allowlisted_inventory $'CONTAINER\\tshared-edge\\tfull-edge\\tshared-edge-edge-1\\tshared-edge\\tedge\\tFalse\\t1\\tplatform-infra_default,zeiterfassung_default\\tedge,shared-edge-edge-1\\nNETWORK\\tplatform-infra_default\\tnetwork-id\\tbridge\\tlocal\\tshared-edge-edge-1=\"edge\";platform-infra-web-1=\"web\";\\nPORT_OWNER\\t80\\tforeign-container\\tforeign-process'
`;
    const result = spawnSync('bash', ['-c', fixture], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(
      /foreign public port owner|unknown network consumer|unexpected Compose label|unexpected network alias/,
    );
  });

  it('executes a complete allowlist fixture and rejects each runtime drift class', () => {
    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const validFixture = `set -euo pipefail\nfail() { printf '%s\\n' "$1"; exit 1; }\nstate_line() { printf '%s\\n' "$1" | awk -F '\\t' -v component="$2" '$1 == "STATE" && $2 == component { print; count += 1 } END { if (count != 1) exit 1 }'; }\nstate_field() { printf '%s\\n' "$1" | awk -F '\\t' -v field_number="$2" '{ print $field_number }'; }\n${validator}\nvalidate_allowlisted_inventory "$SNAPSHOT"`;
    const validResult = spawnSync('bash', ['-c', validFixture], {
      encoding: 'utf8',
      env: { ...process.env, SNAPSHOT: inventoryFixture() },
    });
    expect(validResult.status, `${validResult.stdout}${validResult.stderr}`).toBe(0);
    const cases = [
      { name: 'foreign owner', snapshot: inventoryFixture({ owner80: 'foreign-container' }), expected: 'foreign public port owner' },
      { name: 'wrong label', snapshot: inventoryFixture({ labels: { 'catering-web': 'wrong-service' } }), expected: 'unexpected Compose label' },
      { name: 'foreign alias', snapshot: inventoryFixture({ networks: { 'catering-web': 'platform-infra_default=web,foreign;zeiterfassung_default=web,platform-infra-web-1;' } }), expected: 'unexpected network alias' },
      { name: 'foreign network consumer', snapshot: inventoryFixture({ foreignMember: true }), expected: 'unknown network consumer' },
      { name: 'unknown network attachment', snapshot: inventoryFixture({ networks: { 'catering-web': 'platform-infra_default=web,platform-infra-web-1;foreign_default=web,platform-infra-web-1;' } }), expected: 'network mapping is incomplete' },
    ];
    for (const testCase of cases) {
      const fixture = `set -euo pipefail\nfail() { printf '%s\\n' "$1"; exit 1; }\nstate_line() { printf '%s\\n' "$1" | awk -F '\\t' -v component="$2" '$1 == "STATE" && $2 == component { print; count += 1 } END { if (count != 1) exit 1 }'; }\nstate_field() { printf '%s\\n' "$1" | awk -F '\\t' -v field_number="$2" '{ print $field_number }'; }\n${validator}\nvalidate_allowlisted_inventory "$SNAPSHOT"`;
      const result = spawnSync('bash', ['-c', fixture], {
        encoding: 'utf8',
        env: { ...process.env, SNAPSHOT: testCase.snapshot },
      });
      expect(result.status, testCase.name).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`, testCase.name).toContain(testCase.expected);
    }
  });

  it('executes the TLS-option and public-identity negative fixtures', () => {
    const curlValidator = extractFunction(helper, 'validate_curl_args');
    const curlFixture = `set -euo pipefail\nfail() { printf '%s\\n' "$1"; exit 1; }\nCURL_ARGS=(--fail --insecure --proto '=https' --tlsv1.2)\n${curlValidator}\nvalidate_curl_args`;
    const curlResult = spawnSync('bash', ['-c', curlFixture], { encoding: 'utf8' });
    expect(curlResult.status).not.toBe(0);
    expect(`${curlResult.stdout}${curlResult.stderr}`).toContain('insecure TLS');

    const eventosIdentity = extractFunction(helper, 'assert_eventos_identity');
    const lowercase = extractFunction(helper, 'lowercase');
    const identityFixture = `set -euo pipefail\nfail() { printf '%s\\n' "$1"; exit 1; }\n${lowercase}\nHTTP_CONTENT_TYPE='application/json'\nHTTP_BODY='{"ok":true,"service":"foreign-service"}'\n${eventosIdentity}\nassert_eventos_identity`;
    const identityResult = spawnSync('bash', ['-c', identityFixture], { encoding: 'utf8' });
    expect(identityResult.status).not.toBe(0);
    expect(`${identityResult.stdout}${identityResult.stderr}`).toContain('EventOS public identity failed');
  });

  it('executes restart, network and ID invariance fixtures as fail-closed gates', () => {
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const canonicalizer = extractFunction(helper, 'canonicalize_network_mapping');
    const compare = extractFunction(helper, 'compare_identity_invariants');
    for (const [field, beforeValue, afterValue, expected] of [
      ['id', 'a'.repeat(64), 'b'.repeat(64), 'Container ID changed'],
      ['restart', '0', '1', 'RestartCount increased'],
      ['network', 'old-network', 'new-network', 'network mapping changed'],
    ] as const) {
      const before = field === 'id' ? beforeValue : 'a'.repeat(64);
      const after = field === 'id' ? afterValue : 'a'.repeat(64);
      const beforeRestart = field === 'restart' ? beforeValue : '0';
      const afterRestart = field === 'restart' ? afterValue : '0';
      const beforeNetwork = field === 'network' ? `platform-infra_default=${beforeValue};` : 'platform-infra_default=network;';
      const afterNetwork = field === 'network' ? `platform-infra_default=${afterValue};` : 'platform-infra_default=network;';
      const fixture = `set -euo pipefail\nCOMPONENTS=(shared-edge)\nfail() { printf '%s\\n' "$1"; exit 1; }\n${stateLine}\n${stateField}\n${canonicalizer}\n${compare}\nbefore_snapshot=$'STATE\\tshared-edge\\t${before}\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t${beforeRestart}\\t80/tcp=80\\t${beforeNetwork}'\nafter_snapshot=$'STATE\\tshared-edge\\t${after}\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t${afterRestart}\\t80/tcp=80\\t${afterNetwork}'\ncompare_identity_invariants`;
      const result = spawnSync('bash', ['-c', fixture], { encoding: 'utf8' });
      expect(result.status, field).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`, field).toContain(expected);
    }
  });

  it('parses the workflow structurally and enforces the exact trigger/permission/environment contract', () => {
    const result = spawnSync('ruby', ['-e', `require 'yaml'; data = YAML.load_file(ARGV.fetch(0)); trigger = data[true] || data['on']; abort 'trigger' unless trigger == {'workflow_dispatch' => nil}; abort 'permissions' unless data['permissions'] == {'contents' => 'read'}; abort 'environment' unless data['jobs'].values.all? { |job| job['environment'] == 'production' }; abort 'runner' unless data['jobs'].values.all? { |job| job['runs-on'] == 'ubuntu-latest' };`, fileURLToPath(workflowPath)], { encoding: 'utf8' });
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });
});
