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
} = {}) {
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
  return lines.join('\n');
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
  if (kind === 'invalid-tar') {
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
const args = process.argv.slice(2);
const env = process.env;
const components = [
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
const byName = Object.fromEntries(components.map((row) => [row[3], row]));
const byId = Object.fromEntries(components.map((row, index) => [(index + 1).toString(16).repeat(64), row]));
function idFor(component) { return (components.findIndex((row) => row[0] === component) + 1).toString(16).repeat(64); }
function rowFor(value) { return byId[value] || byName[value] || components.find((row) => row[0] === value); }
function emit(value) { process.stdout.write(String(value)); }
function networksFor(component) {
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
  };
  const result = rows[network] || [];
  if (env.HARNESS_CASE === 'unknown-alias' && network === 'platform-infra_default') result.push(['foreign-consumer', ['foreign']]);
  return result;
}
function networkId(network) {
  if (env.HARNESS_CASE === 'network-id' && network === 'platform-infra_default') return 'f'.repeat(64);
  return { 'platform-infra_default': 'b'.repeat(64), 'zeiterfassung_default': 'c'.repeat(64), 'commcats-eventos_default': 'd'.repeat(64) }[network];
}
if (args[0] === 'network' && args[1] === 'ls') {
  emit('platform-infra_default\t' + 'b'.repeat(64) + '\tbridge\tlocal\n');
  emit('zeiterfassung_default\t' + 'c'.repeat(64) + '\tbridge\tlocal\n');
  emit('commcats-eventos_default\t' + 'd'.repeat(64) + '\tbridge\tlocal\n');
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
  if (format === '{{.Id}}') emit(idFor(component) + '\n');
  else if (format === '{{.Name}}') emit('/' + row[3] + '\n');
  else if (format.includes('.State.Pid')) emit(env.HARNESS_REMOTE_PID + '\n');
  else if (format === '{{.Image}}') {
    emit(component === 'eventos-app' ? 'sha256:' + 'e'.repeat(64) + '\n' : 'sha256:' + '0'.repeat(64) + '\n');
  } else if (format.includes('.Config.Image')) {
    if (component === 'eventos-app') emit(env.HARNESS_CASE === 'eventos-unbound' ? 'commcats-eventos-app:latest\n' : 'commcats-eventos-app\n');
    else if (component === 'zeiterfassung-app') emit('zeiterfassung-app:1.2.3-0123456789ab\n');
    else emit('fixture:image\n');
  } else if (format.includes('.State.Status')) emit('running\n');
  else if (format.includes('.State.StartedAt')) emit('2026-08-21T00:00:00Z\n');
  else if (format.includes('.RestartCount')) emit('0\n');
  else if (format.includes('HostConfig.PortBindings')) emit(component === 'shared-edge' ? '80/tcp=80,;443/tcp=443,;\n' : '\n');
  else if (format.includes('com.docker.compose.project.working_dir')) {
    if (component === 'eventos-app') emit(env.HARNESS_EVENTOS_ROOT + '/current\n');
    else if (component === 'zeiterfassung-app') emit(env.HARNESS_ZEIT_ROOT + '/0123456789ab-20260821T120000Z\n');
    else emit('<no value>\n');
  } else if (format.includes('com.docker.compose.project')) emit(row[1] + '\n');
  else if (format.includes('com.docker.compose.service')) emit(row[2] + '\n');
  else if (format.includes('com.docker.compose.oneoff')) emit('False\n');
  else if (format.includes('com.docker.compose.container-number')) emit('1\n');
  else if (format.includes('.Config.Env')) {
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
    if (component === 'shared-edge') emit(env.HARNESS_EDGE_PATH + '/Caddyfile\t/etc/caddy/Caddyfile\tro\tfalse\n');
  } else if (format.includes('IPAddress')) {
    if (component === 'shared-edge') emit('172.31.0.2\n');
  } else if (format.includes('join $network.Aliases')) {
    emit(networksFor(component).map((row) => row[0] + '=' + row[1].join(',') + ';').join('') + '\n');
  } else if (format.includes('$network_name')) {
    emit(networksFor(component).map((row) => row[0] + '\n').join(''));
  } else {
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
console.log('LISTEN 0 128 0.0.0.0:80 0.0.0.0:* users:((' + '"caddy"' + ',pid=' + pid + ',fd=3))');
console.log('LISTEN 0 128 0.0.0.0:443 0.0.0.0:* users:((' + '"caddy"' + ',pid=' + pid + ',fd=4))');
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
fs.writeFileSync(process.env.HARNESS_PROC_ROOT + '/1/cmdline', 'foreign\\0');
fs.writeFileSync(process.env.HARNESS_PROC_ROOT + '/1/exe', 'foreign-executable');
rewritten = 'mapfile() {\n  if [ "\${1:-}" = "-t" ]; then shift; fi\n  local variable="\${1:-}" line\n  local -a values=()\n  while IFS= read -r line; do values+=("$line"); done\n  eval "$variable=(\\"\\\${values[@]}\\")"\n}\n' + rewritten;
const scriptPath = root + '/remote-rewritten.sh';
fs.writeFileSync(scriptPath, rewritten, { mode: 0o700 });
const childEnv = { ...process.env, HARNESS_REMOTE_PID: String(process.pid) };
const result = childProcess.spawnSync('/bin/bash', [scriptPath, process.env.HARNESS_EXPECTED_CADDY_SHA], {
  encoding: 'utf8',
  env: childEnv,
  timeout: 60000,
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
    expect(remoteScripts).not.toMatch(/(^|[^-])>{1,2}(?!&2)/m);
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

  it('executes the complete SSH heredoc through a fake remote and rejects adversarial runtime fixtures', () => {
    const remoteSnapshot = extractRemoteSnapshot(helper);
    const stateLine = extractFunction(helper, 'state_line');
    const stateField = extractFunction(helper, 'state_field');
    const validator = extractFunction(helper, 'validate_allowlisted_inventory');
    const runRemote = (fixture: ReturnType<typeof createFakeRemoteFixture>) => runExtractedFunction(
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
    const validFixture = createFakeRemoteFixture('valid');
    const validRemote = runRemote(validFixture);
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

    for (const kind of [
      'listener-extra',
      'invalid-tar',
      'manifest-drift',
    ]) {
      const fixture = createFakeRemoteFixture(kind);
      const remoteResult = runRemote(fixture);
      expect(remoteResult.status, `${kind}: ${remoteResult.stdout}${remoteResult.stderr}`).not.toBe(0);
      expect(remoteResult.stdout, kind).not.toContain('Authorization');
      expect(remoteResult.stdout, kind).not.toContain('SECRET');
    }
  }, 120000);

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
    const compare = extractFunction(helper, 'compare_identity_invariants');
    const fixture = `
set -euo pipefail
COMPONENTS=(shared-edge)
fail() { printf '%s\\n' "$1"; exit 1; }
${stateLine}
${stateField}
${compare}
before_snapshot=$'STATE\\tshared-edge\\tfull-before\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t0\\t80/tcp=80\\tnetwork'
after_snapshot=$'STATE\\tshared-edge\\tfull-after\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t0\\t80/tcp=80\\tnetwork'
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
      const beforeNetwork = field === 'network' ? beforeValue : 'network';
      const afterNetwork = field === 'network' ? afterValue : 'network';
      const fixture = `set -euo pipefail\nCOMPONENTS=(shared-edge)\nfail() { printf '%s\\n' "$1"; exit 1; }\n${stateLine}\n${stateField}\n${compare}\nbefore_snapshot=$'STATE\\tshared-edge\\t${before}\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t${beforeRestart}\\t80/tcp=80\\t${beforeNetwork}'\nafter_snapshot=$'STATE\\tshared-edge\\t${after}\\tshared-edge-edge-1\\timage\\trunning\\tstarted\\t${afterRestart}\\t80/tcp=80\\t${afterNetwork}'\ncompare_identity_invariants`;
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
