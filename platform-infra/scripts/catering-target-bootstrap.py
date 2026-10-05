#!/usr/bin/env python3
"""Bound, host-local initial installation for the single approved migration target.

Run only in a separately approved window. This tool neither connects to a host,
installs packages, restores data, opens the edge, nor starts automatic jobs.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import functools
import socket
import stat
import subprocess
import sys

TARGET = 'catering-prod-02'
PRODUCT = '9ce4fbc96a5dd877f2cd2f00588a22be861306b9'
SOURCE_OPERATIONS = 'b1e3d44573bf6fe6d3c8e46861792a592535e856'
SERVER = 168651076
IP = '2.28.200.16'
PG = 'sha256:778d0b486d6daa02b77434d0358ec57a1b21fd8b6d22ac2eef56a33e816928f6'
EDGE = 'sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648'
IMAGES = {
    'intake': 'sha256:6ba5bef903323aa5f4fdc63d1043b627fdaed1cb681526ba19b94a7d7f72c0f3',
    'offer': 'sha256:6ba5bef903323aa5f4fdc63d1043b627fdaed1cb681526ba19b94a7d7f72c0f3',
    'production': 'sha256:6ba5bef903323aa5f4fdc63d1043b627fdaed1cb681526ba19b94a7d7f72c0f3',
    'exports': 'sha256:6ba5bef903323aa5f4fdc63d1043b627fdaed1cb681526ba19b94a7d7f72c0f3',
    'web': 'sha256:3e45d18ffae79f78d84a4018aa52ac17419f29f2bda3e49ccb3e94311440d48e',
    'postgres': PG,
}
RELEASE_ROOT = Path('/opt/catering-releases')
STATE = Path('/var/lib/catering-target-bootstrap')
RUNTIME = Path('/etc/catering-target/runtime.env')
SCRIPTS = Path(__file__).resolve().parent
UPDATE_LOCK = Path('/opt/catering-target-update.lock')
TIMERS = ('catering-backup.timer', 'catering-restore-probe.timer', 'catering-backup-observer.timer')
UNITS = TIMERS + ('catering-backup.service', 'catering-restore-probe.service', 'catering-backup-observer.service')
DOMAINS = {'database', 'roles', 'owners', 'acls', 'settings', 'extensions', 'tablespaces',
           'sequences', 'large_objects', 'auth', 'uploads', 'documents', 'configuration', 'caddy', 'os_identity_mapping'}


class BootstrapError(Exception):
    """A fixed, non-sensitive bootstrap gate failure."""


def require(condition, message):
    if not condition:
        raise BootstrapError(message)


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def protected(path):
    path = Path(path)
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and not path.is_symlink() and path.resolve() == path.absolute(), 'protected input must be a regular file')
    require(info.st_uid in {0, os.getuid()} and stat.S_IMODE(info.st_mode) == 0o600, 'protected input ownership or mode mismatch')
    return path


def read_json(path):
    return json.loads(protected(path).read_text())


def run(args, *, input=None):
    # Suppress command output on failures: database globals and env files contain secrets.
    result = subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=900, check=False)
    require(result.returncode == 0, 'required host observation or operation failed')
    return result.stdout


@functools.lru_cache(maxsize=None)
def module(name):
    path = SCRIPTS / ('catering-target-' + name + '.py')
    spec = importlib.util.spec_from_file_location('bootstrap_' + name, path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def fresh_window(document):
    now = dt.datetime.now(dt.timezone.utc)
    start = dt.datetime.fromisoformat(document['windowStart'].replace('Z', '+00:00'))
    end = dt.datetime.fromisoformat(document['windowEnd'].replace('Z', '+00:00'))
    require(start <= now < end and end - start <= dt.timedelta(hours=8), 'approved execution window missing or expired')


def verify_access(evidence, known_hosts, host):
    value = read_json(evidence)
    fresh_window(value)
    server = value['server']
    require(server['id'] == SERVER and server['name'] == TARGET and server['public_net']['ipv4']['ip'] == IP,
            'provider identity mismatch')
    require(server['server_type']['name'] == 'cx33' and server['server_type']['architecture'] == 'x86', 'provider resource identity mismatch')
    require(server['image']['os_flavor'] == 'ubuntu' and server['image']['os_version'].startswith('24.04'), 'provider OS mismatch')
    require(host == IP, 'target02 transport must use its bound IP')
    lines = protected(known_hosts).read_text().splitlines()
    require(len(lines) == 1, 'target02 requires one explicit pinned known-host entry')
    fields = lines[0].split()
    require(len(fields) == 3 and fields[0] == IP and fields[1] == 'ssh-ed25519', 'target02 known-host binding mismatch')
    fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(base64.b64decode(fields[2], validate=True)).digest()).decode().rstrip('=')
    require(fingerprint == value['hostKeyFingerprint'], 'target02 host-key evidence mismatch')
    return value


def classify_containers(containers):
    if not containers:
        return 'empty'
    names = {item['Name'].lstrip('/') for item in containers}
    if names == {'platform-infra-postgres-1'}:
        return 'database_only'
    if names == {'platform-infra-' + service + '-1' for service in IMAGES}:
        return 'application_present'
    raise BootstrapError('unexpected or partial host containers')


def observe_containers():
    ids = run(['docker', 'ps', '-aq']).decode().split()
    return json.loads(run(['docker', 'inspect', *ids])) if ids else []


def verify_jobs_off():
    for unit in UNITS:
        # systemctl show returns explicit not-found states without guessing success from a nonzero exit.
        result = run(['systemctl', 'show', unit, '--property=ActiveState,UnitFileState,LoadState']).decode()
        fields = dict(line.split('=', 1) for line in result.splitlines() if '=' in line)
        require(fields.get('ActiveState') in {'inactive', 'failed'} and fields.get('UnitFileState', '') in {'', 'disabled', 'masked', 'static'}, 'automatic backup, probe or heartbeat must remain off')
    for root in (Path('/etc/cron.d'), Path('/var/spool/cron/crontabs')):
        if root.exists():
            for entry in root.iterdir():
                require(not entry.is_symlink(), 'cron observation is ambiguous')
                if entry.is_file():
                    require('catering' not in entry.read_text().lower(), 'automatic Catering cron or heartbeat remains installed')
    timers = run(['systemctl', 'list-timers', '--all', '--no-pager', '--no-legend']).decode()
    require(not any('catering' in line for line in timers.splitlines()), 'an automatic Catering timer is still scheduled')


def verify_networks():
    names = run(['docker', 'network', 'ls', '--format', '{{.Name}}']).decode().splitlines()
    require(set(names) <= {'bridge', 'host', 'none', 'catering_private', 'catering_ingress'}, 'unexpected Docker network or public edge network')
    for name in ('catering_private', 'catering_ingress'):
        items = json.loads(run(['docker', 'network', 'inspect', name]))
        require(len(items) == 1 and items[0]['Internal'] is True and items[0]['Driver'] == 'bridge'
                and items[0]['Options'].get('com.docker.network.bridge.gateway_mode_ipv4') == 'isolated', 'application network is not isolated')


def postgres_binding(containers):
    matches = [item for item in containers if item.get('Name') == '/platform-infra-postgres-1']
    require(len(matches) == 1, 'database container identity missing or ambiguous')
    item = matches[0]
    require(isinstance(item.get('Id'), str) and re.fullmatch('[0-9a-f]{64}', item['Id']), 'database container ID invalid')
    mounts = [m for m in item.get('Mounts', []) if m.get('Destination') == '/var/lib/postgresql/data']
    require(len(mounts) == 1 and mounts[0].get('Type') == 'volume' and mounts[0].get('Name') == 'platform-infra_postgres_data', 'database volume identity mismatch')
    require(isinstance(mounts[0].get('Source'), str) and mounts[0]['Source'].startswith('/')
            and mounts[0].get('Driver') == 'local' and mounts[0].get('RW') is True, 'database mount identity invalid')
    # Copy the complete observed mount: later observations must never mutate the baseline.
    return {'containerId': item['Id'], 'image': item['Image'], 'dataMount': json.loads(json.dumps(mounts[0]))}


def verify_database_only(containers):
    require(classify_containers(containers) == 'database_only', 'restore/first start requires only the database')
    item = containers[0]
    require(item['Image'] == PG and item['State']['Running'] is True and item['State'].get('Health', {}).get('Status') == 'healthy', 'restored database image or health mismatch')
    require(item['HostConfig']['RestartPolicy']['Name'] == 'no' and not item['HostConfig'].get('PortBindings')
            and not item['HostConfig'].get('Privileged') and set(item['NetworkSettings']['Networks']) == {'catering_private'}, 'database isolation mismatch')
    return postgres_binding(containers)


def verify_installed_containers(containers, *, expected_database=None):
    require(classify_containers(containers) == 'application_present', 'initial install has not been observed')
    actual_database = postgres_binding(containers)
    if expected_database is not None:
        require(actual_database == expected_database, 'restored PostgreSQL instance or data mount changed')
    identities = {}
    for item in containers:
        service = item['Config']['Labels'].get('com.docker.compose.service')
        require(service in IMAGES and item['Name'] == '/platform-infra-' + service + '-1', 'container identity mismatch')
        require(item['Config']['Labels'].get('com.docker.compose.project') == 'platform-infra', 'compose project mismatch')
        require(item['Image'] == IMAGES[service], 'running image mismatch')
        if service != 'postgres':
            require(item.get('ImageManifestDescriptor', {}).get('digest') == IMAGES[service], 'running platform manifest mismatch')
        require(item['State']['Running'] is True and not item['State'].get('OOMKilled'), 'container is not running')
        if service == 'postgres':
            require(item['State'].get('Health', {}).get('Status') == 'healthy', 'container health has not passed')
        host = item['HostConfig']
        require(host['RestartPolicy']['Name'] == 'no' and not host.get('PortBindings') and not host.get('Privileged'), 'container restart, exposure or privilege mismatch')
        require(not host.get('NetworkMode') in {'host', 'none'} and not host.get('CapAdd'), 'container isolation mismatch')
        networks = set(item['NetworkSettings']['Networks'])
        require(networks == ({'catering_private', 'catering_ingress'} if service == 'web' else {'catering_private'}), 'container networks mismatch')
        identities[service] = item['Id']
    require(set(identities) == set(IMAGES), 'duplicate or missing service')
    return identities


def logical_digest(payload):
    # PG 17.9 emits a random psql restrict token. Its value is not database state.
    lines = payload.splitlines(keepends=True)
    normalized = b''.join(line for line in lines if not re.fullmatch(rb'\\(?:un)?restrict [A-Za-z0-9]+\r?\n?', line))
    return hashlib.sha256(normalized).hexdigest()


def database_digests():
    prefix = ['docker', 'exec', 'platform-infra-postgres-1']
    args = ['--username=catering', '--no-password']
    version = run(prefix + ['psql', *args, '--no-psqlrc', '--dbname=catering_agents', '-Atc', 'SHOW server_version']).decode().strip()
    require(version.split()[0] == '17.9', 'PostgreSQL version mismatch')
    schema = run(prefix + ['psql', *args, '--no-psqlrc', '--dbname=catering_agents', '-Atc', "SELECT version_number FROM catering_schema_migrations WHERE unit_name = 'catering_business_records'"]).decode().strip()
    require(schema == '3', 'restored schema mismatch')
    return {
        'database': logical_digest(run(prefix + ['pg_dump', *args, '--dbname=catering_agents', '--create', '--format=plain'])),
        'globals': logical_digest(run(prefix + ['pg_dumpall', *args, '--globals-only'])),
    }


def file_inventory(root):
    root = Path(root)
    require(root.is_absolute() and '..' not in root.parts and root.exists(), 'inventory root missing')
    records = []
    hardlinks = {}
    paths = [root]
    if root.is_dir() and not root.is_symlink():
        paths += sorted(root.rglob('*'))
    for path in paths:
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode), 'unsupported migration file type')
        attrs = {name: hashlib.sha256(os.getxattr(path, name, follow_symlinks=False)).hexdigest()
                 for name in sorted(os.listxattr(path, follow_symlinks=False))}
        identity = (info.st_dev, info.st_ino)
        first_link = hardlinks.get(identity) if stat.S_ISREG(info.st_mode) else None
        if stat.S_ISREG(info.st_mode):
            hardlinks.setdefault(identity, str(path.relative_to(root)))
        records.append({'hardlinkTo': first_link, 'path': str(path.relative_to(root)), 'mode': stat.S_IMODE(info.st_mode), 'uid': info.st_uid,
                        'gid': info.st_gid, 'type': stat.S_IFMT(info.st_mode), 'xattrs': attrs,
                        'value': os.readlink(path) if path.is_symlink() else digest(path) if path.is_file() else None})
    return records


def verify_source_fence(path):
    fence = read_json(path)
    fresh_window(fence)
    require(fence['serverId'] == 166533273 and fence['ip'] == '2.29.43.174', 'source fencing identity mismatch')
    # These are protected captured observations, not user-entered passed booleans.
    containers = fence['dockerInspect']
    require(isinstance(containers, list) and len(containers) == 7, 'complete source container observation required')
    names = {item['Name'] for item in containers}
    require(names == {'/platform-infra-' + name + '-1' for name in IMAGES} | {'/catering-edge-edge-1'}, 'source inventory mismatch')
    for item in containers:
        require(item['State']['Running'] is False and item['HostConfig']['RestartPolicy']['Name'] == 'no', 'source writer or restart remains active')
    require(fence['scheduledCateringUnits'] == [] and fence['runningCateringUnits'] == [], 'source automatic work not fenced')
    require(isinstance(fence['firewallRulesetSha256'], str) and re.fullmatch('[0-9a-f]{64}', fence['firewallRulesetSha256']), 'source firewall observation missing')
    return digest(path)


def verify_inputs(args):
    package = read_json(args.inputs)
    require(digest(args.inputs) == args.inputs_sha256, 'protected input package binding mismatch')
    fresh_window(package)
    require(package['targetId'] == TARGET and package['serverId'] == SERVER and package['productCommit'] == PRODUCT
            and package['operationsCommit'] == args.operations_commit and args.operations_commit != SOURCE_OPERATIONS,
            'migration package identity mismatch')
    require(set(package['sourceInventory']) == DOMAINS, 'complete source inventory is mandatory')
    for name in DOMAINS:
        record = package['sourceInventory'][name]
        require(digest(protected(record['path'])) == record['sha256'], 'protected source inventory binding mismatch')
    for name in ('fullDatabaseDump', 'rolesDump', 'databaseSettings', 'sourceFence', 'fileInventory', 'smokeCredentials'):
        record = package[name]
        require(digest(protected(record['path'])) == record['sha256'], 'full-fidelity migration input missing or changed')
    require(package['dumpFormat'] == 'custom-with-owners-and-acls' and package['postgresVersion'] == '17.9' and package['schemaVersion'] == 3,
            'full-fidelity PostgreSQL backup required')
    with protected(package['fullDatabaseDump']['path']).open('rb') as handle:
        archive_magic = handle.read(5)
    require(archive_magic == b'PGDMP', 'custom PostgreSQL archive required')
    require(set(package['logicalDigests']) == {'database', 'globals'} and all(re.fullmatch('[0-9a-f]{64}', v) for v in package['logicalDigests'].values()), 'protected logical comparison missing')
    for name, image in (('postgres', PG), ('edge', EDGE)):
        archive = package['infraArchives'][name]
        require(digest(protected(archive['path'])) == archive['sha256'], 'mandatory infrastructure archive missing or changed')
        identity = module('operator')._inspect_archive(Path(archive['path']))
        require(image in {identity['configDigest'], identity['platformManifestDigest']}, 'infrastructure image identity mismatch')
    require(all(type(package['resources'][key]) is int and package['resources'][key] > 0 for key in ('freeBytes', 'freeInodes', 'availableRamBytes')), 'approved resource budget missing')
    disk = os.statvfs('/opt')
    mem = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    require(disk.f_bavail * disk.f_frsize >= package['resources']['freeBytes'] and disk.f_favail >= package['resources']['freeInodes']
            and int(mem['MemAvailable'].split()[0]) * 1024 >= package['resources']['availableRamBytes'], 'migration resource reserve insufficient')
    verify_source_fence(package['sourceFence']['path'])
    return package


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def check_execution_windows(package, access):
    fresh_window(package)
    fresh_window(access)
    fence = package['sourceFence']
    require(digest(protected(fence['path'])) == fence['sha256'], 'source fencing evidence changed')
    fresh_window(read_json(fence['path']))


def write_new(path, content, mode=0o600):
    # Exclusive, synced writes preserve partial-work evidence and forbid silent retries.
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'w') as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    sync_directory(Path(path).parent)


def compose(release):
    # The operations override enables automatic restarts; first install deliberately uses base + P4 only.
    return ['docker', 'compose', '--project-name', 'platform-infra', '--env-file', str(RUNTIME),
            '-f', str(release / 'source/platform-infra/docker-compose.catering-target.json'),
            '-f', str(release / 'candidate-images.json')]


def verify_restored(package):
    require(database_digests() == package['logicalDigests'], 'restored database, roles, owners, ACLs or settings differ')
    expected = read_json(package['fileInventory']['path'])
    require(isinstance(expected, dict) and expected, 'full file inventory required')
    required = {'/opt/catering-agents-platform/data', '/etc/catering-target/runtime.env', '/opt/catering-agents-platform/platform-infra/sites',
                '/var/lib/docker/volumes/platform-infra_caddy_data/_data', '/var/lib/docker/volumes/platform-infra_caddy_config/_data',
                '/var/lib/docker/volumes/catering-edge_edge_caddy_data/_data', '/var/lib/docker/volumes/catering-edge_edge_caddy_config/_data'}
    require(required <= set(expected), 'application, auth, configuration and Caddy inventory incomplete')
    allowed = required | {'/opt/catering-agents-platform/platform-infra/.env', '/opt/catering-edge/Caddyfile', '/opt/catering-edge/.env'}
    for root, records in expected.items():
        require(root in allowed, 'file inventory outside migration allowlist')
        require(file_inventory(root) == records, 'restored file metadata or contents differ')
    return {'logicalDigests': package['logicalDigests'], 'fileInventorySha256': package['fileInventory']['sha256']}


def write_initial_receipt(release, proof, runtime_image, web_image, *, before_publish=None):
    """Publish only after the caller has verified actual isolated runtime and auth smoke."""
    if before_publish is not None:
        before_publish()
    write_new(release / 'bootstrap-verification.json', json.dumps(proof, sort_keys=True))
    receipt = {'status': 'installed', 'commit': proof['productCommit'], 'runtime_image': runtime_image, 'web_image': web_image,
               'operations_commit': proof['operationsCommit'], 'manifest_sha256': proof['manifestSha256'], 'installation_kind': 'initial',
               'bootstrap_evidence_sha256': digest(release / 'bootstrap-verification.json'),
               'installed_at': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    if before_publish is not None:
        before_publish()
    write_new(release / 'install-receipt', ''.join(f'{k}={v}\n' for k, v in receipt.items()))
    if before_publish is not None:
        before_publish()
    write_new(release.parent / 'installed', proof['productCommit'] + '\n', 0o644)


def start_application(release, package, inputs_sha256, manifest_sha256, operations_commit, *, access=None):
    boundary = STATE / 'first-app-write.json'
    require(not boundary.exists(), 'first app write may have occurred; manual recovery required')
    containers = observe_containers()
    database = verify_database_only(containers)
    restored = read_json(STATE / 'restored.json')
    require(restored['inputsSha256'] == inputs_sha256, 'restore input binding changed')
    require(restored.get('postgresBinding') == database, 'restored PostgreSQL instance or data mount changed')
    verify_networks()
    verify_restored(package)
    for reference in set(IMAGES.values()):
        loaded = json.loads(run(['docker', 'image', 'inspect', reference]))
        require(len(loaded) == 1 and loaded[0]['Id'] == reference and loaded[0]['Os'] == 'linux' and loaded[0]['Architecture'] == 'amd64', 'first-start loaded image mismatch')
    effective = json.loads(run(compose(release) + ['config', '--format', 'json']))
    for name, service in effective['services'].items():
        require(name in IMAGES and service['image'] == IMAGES[name] and service.get('restart', 'no') == 'no' and not service.get('ports'), 'first-start Compose image, restart or port mismatch')
    require(verify_database_only(observe_containers()) == database, 'PostgreSQL instance or data mount changed during pre-start verification')
    check_execution_windows(package, access)
    write_new(boundary, json.dumps({'targetId': TARGET, 'productCommit': PRODUCT, 'operationsCommit': operations_commit,
                                 'inputsSha256': inputs_sha256, 'manifestSha256': manifest_sha256, 'postgresBinding': database,
                                 'startedAt': dt.datetime.now(dt.timezone.utc).isoformat()}))
    check_execution_windows(package, access)
    run(compose(release) + ['up', '-d', '--no-deps', '--pull', 'never', 'intake', 'offer', 'production', 'exports', 'web'])


def verify_initial_install(release, package, inputs_sha256, manifest_sha256, operations_commit, *, access=None):
    boundary = STATE / 'first-app-write.json'
    observed_boundary = read_json(boundary)
    require(observed_boundary['inputsSha256'] == inputs_sha256 and observed_boundary['manifestSha256'] == manifest_sha256
            and observed_boundary['operationsCommit'] == operations_commit, 'initial write boundary mismatch')
    expected_database = observed_boundary.get('postgresBinding')
    require(isinstance(expected_database, dict) and read_json(STATE / 'restored.json').get('postgresBinding') == expected_database, 'restored PostgreSQL baseline missing or changed')
    verify_networks()
    identities = verify_installed_containers(observe_containers(), expected_database=expected_database)
    database_digests()  # Read actual version/schema; initial app writes may legitimately change the data digest.
    for service, port in (('intake', 3101), ('offer', 3102), ('production', 3103), ('exports', 3104)):
        run(['docker', 'exec', 'platform-infra-' + service + '-1', 'node', '--input-type=module', '-e',
             f"const r=await fetch('http://127.0.0.1:{port}/health',{{signal:AbortSignal.timeout(10000)}});if(!r.ok||(await r.json()).status!=='ok')process.exit(1)"])
    run(['docker', 'exec', 'platform-infra-web-1', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
    proof = {'state': 'verified_initial_install', 'targetId': TARGET, 'productCommit': PRODUCT, 'operationsCommit': operations_commit,
             'manifestSha256': manifest_sha256, 'inputsSha256': inputs_sha256, 'containers': identities,
             'postgresBinding': expected_database, 'writeBoundarySha256': digest(boundary), 'restoredSha256': digest(STATE / 'restored.json')}
    credentials = read_json(package['smokeCredentials']['path'])
    require(set(credentials) == {'basicUser', 'basicPassword', 'loginCode', 'pin'} and all(isinstance(v, str) and v for v in credentials.values()), 'protected smoke credentials missing')
    smoke = (SCRIPTS / 'catering-target-operator-smoke.mjs').read_text()
    verify_installed_containers(observe_containers(), expected_database=expected_database)
    check_execution_windows(package, access)
    run(['docker', 'exec', '-i', 'platform-infra-intake-1', 'node', '--input-type=module', '-e', smoke],
        input=json.dumps(credentials).encode())
    verify_jobs_off()
    verify_networks()
    proof['containers'] = verify_installed_containers(observe_containers(), expected_database=expected_database)
    write_initial_receipt(release, proof, IMAGES['intake'], IMAGES['web'],
                          before_publish=lambda: check_execution_windows(package, access))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('access', 'observe', 'prepare', 'load', 'postgres', 'verify-restored', 'start', 'verify-install'))
    parser.add_argument('--access-evidence', type=Path, required=True)
    parser.add_argument('--known-hosts', type=Path, required=True)
    parser.add_argument('--host', required=True)
    parser.add_argument('--operations-commit')
    parser.add_argument('--manifest-sha256')
    parser.add_argument('--inputs', type=Path)
    parser.add_argument('--inputs-sha256')
    args = parser.parse_args(argv)
    try:
        access = verify_access(args.access_evidence, args.known_hosts, args.host)
        if args.phase == 'access':
            print('TARGET02_ACCESS_BINDING_OK')
            return 0
        require(os.geteuid() == 0 and sys.platform == 'linux' and socket.gethostname().split('.')[0] == TARGET, 'bootstrap requires the bound Linux target as root')
        require(os.uname().machine == 'x86_64' and 'VERSION_ID="24.04"' in Path('/etc/os-release').read_text(), 'target architecture or OS mismatch')
        require(args.operations_commit and re.fullmatch('[0-9a-f]{40}', args.operations_commit), 'exact accepted operations commit required')
        operations = SCRIPTS.parents[1]
        module('operator')._validate_checkout(operations, args.operations_commit, 'operations')
        verify_jobs_off()
        containers = observe_containers()
        if args.phase == 'observe':
            print(json.dumps({'targetId': TARGET, 'state': classify_containers(containers)}))
            return 0
        require(args.inputs and args.inputs_sha256 and args.manifest_sha256, 'protected migration inputs and bundle binding required')
        package = verify_inputs(args)
        release = RELEASE_ROOT / PRODUCT
        manifest = module('operator').verify_bundle(release, PRODUCT, args.operations_commit, args.manifest_sha256, release / 'source', target_id=TARGET)
        require(not (RELEASE_ROOT / 'installed').exists(), 'initial install already has an installed marker')
        check_execution_windows(package, access)
        STATE.mkdir(mode=0o700, exist_ok=True)
        sync_directory(STATE.parent)
        require(STATE.lstat().st_uid == 0 and stat.S_IMODE(STATE.lstat().st_mode) == 0o700 and not STATE.is_symlink(), 'bootstrap state directory unsafe')
        # flock serializes cooperating bootstrap commands. The durable boundary additionally blocks retries after app writes.
        import fcntl
        lock = os.open(STATE / 'lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        containers = observe_containers()
        require(not (RELEASE_ROOT / 'installed').exists(), 'initial install already recorded')
        owner = f'bootstrap_target={TARGET}\noperations_commit={args.operations_commit}\ninputs_sha256={args.inputs_sha256}\n'
        if args.phase == 'prepare':
            check_execution_windows(package, access)
            UPDATE_LOCK.mkdir(mode=0o700)
            sync_directory(UPDATE_LOCK.parent)
            write_new(UPDATE_LOCK / 'owner', owner)
        else:
            require(UPDATE_LOCK.is_dir() and not UPDATE_LOCK.is_symlink() and UPDATE_LOCK.lstat().st_uid == 0,
                    'bootstrap update exclusion missing')
            require(protected(UPDATE_LOCK / 'owner').read_text() == owner, 'another operation owns the update exclusion')
        stage = module('stage-binding')
        stage_values = stage.stage_values(release, manifest_sha256=args.manifest_sha256, product_commit=PRODUCT,
            operations_commit=args.operations_commit, runtime_image=IMAGES['intake'], web_image=IMAGES['web'],
            stage_binding_sha256=digest(SCRIPTS / 'catering-target-stage-binding.py'),
            oci_sha256=digest(SCRIPTS / 'catering_target_oci.py'), target_id=TARGET)
        if args.phase == 'prepare':
            check_execution_windows(package, access)
            stage.write_receipt(release, stage_values)
        else:
            stage.verify_receipt(release, stage_values)
        boundary = STATE / 'first-app-write.json'
        require(args.phase == 'verify-install' or not boundary.exists(), 'first app write may have occurred; manual recovery required')
        if args.phase == 'prepare':
            require(classify_containers(containers) == 'empty', 'prepare requires an empty host')
            require(run(['docker', 'volume', 'ls', '-q']).strip() == b'', 'new host has pre-existing data volumes')
            names = set(run(['docker', 'network', 'ls', '--format', '{{.Name}}']).decode().splitlines())
            require(names == {'bridge', 'host', 'none'}, 'new host has pre-existing application networks')
            for root in ('/etc/catering-target', '/opt/catering-agents-platform/platform-infra/sites', '/opt/catering-edge'):
                check_execution_windows(package, access)
                Path(root).mkdir(parents=True, mode=0o755, exist_ok=True)
            for scope in ('platform', 'edge'):
                for entry in module('contract').RUNTIME_FILE_BINDINGS[scope]:
                    _, destination, source = entry
                    check_execution_windows(package, access)
                    write_new(Path(destination), (release / 'source' / source).read_text(), 0o644)
            check_execution_windows(package, access)
            write_new(STATE / 'prepared.json', json.dumps({'productCommit': PRODUCT, 'operationsCommit': args.operations_commit, 'manifestSha256': args.manifest_sha256}))
        elif args.phase == 'load':
            require(classify_containers(containers) == 'empty', 'image load requires an empty host')
            protected(STATE / 'prepared.json')
            for path in [release / 'runtime-image.tar.gz', release / 'web-image.tar.gz'] + [Path(package['infraArchives'][name]['path']) for name in ('postgres', 'edge')]:
                check_execution_windows(package, access)
                run(['docker', 'load', '--input', str(path)])
            for reference in set(IMAGES.values()) | {EDGE}:
                observed = json.loads(run(['docker', 'image', 'inspect', reference]))
                require(len(observed) == 1 and observed[0]['Id'] == reference, 'loaded immutable image mismatch')
            check_execution_windows(package, access)
            write_new(STATE / 'images-loaded.json', json.dumps({'manifestSha256': args.manifest_sha256, 'images': IMAGES}))
        elif args.phase == 'postgres':
            require(classify_containers(containers) == 'empty', 'database start requires an empty host')
            protected(STATE / 'images-loaded.json')
            protected(RUNTIME)
            require('CATERING_WRITER_MODE=enabled' not in RUNTIME.read_text().splitlines(), 'productive writer must remain disabled')
            check_execution_windows(package, access)
            run(compose(release) + ['up', '-d', '--no-deps', '--pull', 'never', 'postgres'])
            verify_networks()
        elif args.phase == 'verify-restored':
            database = verify_database_only(containers)
            verify_networks()
            proof = verify_restored(package)
            require(verify_database_only(observe_containers()) == database, 'PostgreSQL instance or data mount changed during restore verification')
            check_execution_windows(package, access)
            write_new(STATE / 'restored.json', json.dumps(dict(proof, inputsSha256=args.inputs_sha256, manifestSha256=args.manifest_sha256, postgresBinding=database)))
        elif args.phase == 'start':
            start_application(release, package, args.inputs_sha256, args.manifest_sha256, args.operations_commit, access=access)
        else:
            require(args.phase == 'verify-install', 'unsupported transition')
            verify_initial_install(release, package, args.inputs_sha256, args.manifest_sha256, args.operations_commit, access=access)
            # Preserve the exclusion and its owner as evidence while reopening the normal updater's lock path.
            check_execution_windows(package, access)
            UPDATE_LOCK.rename(STATE / 'completed-update-lock')
            sync_directory(STATE)
            sync_directory(UPDATE_LOCK.parent)
        print('TARGET02_BOOTSTRAP_OK phase=' + args.phase + ' productive_writer_released=false')
        return 0
    except (BootstrapError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError,
            module('operator').OperatorError, module('stage-binding').StageBindingError):
        print('TARGET02_BOOTSTRAP_HOLD: prerequisite or observed state failed; preserve evidence; no automatic rollback', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
