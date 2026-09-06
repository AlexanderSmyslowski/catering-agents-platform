"""Synthetic component integration, exclusively for PR 687's ephemeral hosted CI.

No production entrypoint, attestation, off-host admission, or product evidence is
invoked. Source drift fails closed; the restore's original EXIT trap is retained.
"""
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import selectors
import secrets
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import time
import tempfile

REPOSITORY = 'AlexanderSmyslowski/catering-agents-platform'
BRANCH = 'codex/catering-backup-restore-slice-20260903'
PARENT = '34d71daba94ba227146300f69f1f7b2872dce58b'
PARENT_TREE = 'fb5c57b369c45e4d2168f5586242325d5e3193bd'
SOURCE_HASHES = {
    'platform-infra/backup/catering-backup.sh': 'e96eb78f29e682b33ba282131f9a3aaf7d92a3b7e27388536ef5e2cd680c4aba',
    'platform-infra/backup/catering-restore-probe.sh': '84f200dbb9b6b764353cec177fb6d2f45f66a404c4d3d6c3a95f6cb94f35ac44',
    'platform-infra/backup/catering-backup-common.sh': 'a86a719e270993049003cfd3d5d01d24df120c83b897d7b68f48f5d6e8fc9638',
    'shared-core/src/persistence.ts': 'fc9c03509db36052a4de0aa04d31e518913877b9736be39925561bfe6f5d547f',
    'intake-service/src/source-document-store.ts': 'b4923e5d1a0bc30ac59cfbbe1adf4a33c98a6e81ce4c257fe235645237f795d0',
}
FRAGMENT_HASHES = {'dump': 'd8feef1b9f54e37673cfe0a95b304d4d5f831070367fa5186fe71bdd45d7622b',
 'stream': '19564f4a25bb2bc4859c0822dd4647cf8a2e5820b5688eaabff6cfecbaab33c2',
 'snapshot': '9af73780445cf1e070407f3e091fdd7511837529d963cf0bd578914eb24f2b22',
 'checksums': 'fefaf52f40586772c6ac005bc06274ec7075d9e45ec015fb1d4a0491ddb0ecc4',
 'extractor': '59ff3e67619afe3bd0f12a154372f7bfc6bd5311b954cbb1968f938807d0a2a6',
 'restore_body': 'df3b873e6348e15c717615fb703b33baaba648a9df07c19a80dd86a9550fd512',
 'migration': '4be8b342a6e5bfdeb1a71a2449fc9405aae5c86011d7f01043043e4aeb83539b',
 'document_template': 'fbe66c402fead5a7fc2e58e25ac7c1921236337dafbdc6e2c180eafeb231c026',
 'document_ddl': '5931c3b92110424a5f7e951967d67a4c368705d1d8e57dffc854dd3f318aa13c'}
LEGACY_DUMP = 'if ! "$DOCKER_CMD" exec --env PGHOST= --env PGHOSTADDR= --env PGPORT= --env PGSERVICE= --env PGSERVICEFILE= --user postgres "$postgres_container_id" "$PG_DUMP_CMD" \\\n  --username=catering --dbname=catering_agents --format=custom --no-owner --no-privileges \\\n  --strict-names --table=public.catering_business_records --table=public.catering_source_documents >"$postgres_dump" 2>/dev/null; then\n  fail_state POSTGRES_DUMP_FAILED\nfi\n'
LEGACY_DUMP_SHA256 = 'f10e73b13c2df029df7000960fb23493c6be14d92d49eba37cd033a431883f4b'
LEGACY_BACKUP_SHA256 = 'bdcf0f4e3f7173d541c838fd04992c1ff2995c5914c9a2be220854c3bb730de4'
MINIMAL_ENV = {'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
               'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'}


class GateError(Exception):
    """Contains only controlled diagnostic codes; subprocess output is private."""


def require(condition, code):
    if not condition:
        raise GateError(code)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def check_hash(value, expected):
    require(digest(value) == expected, 'SOURCE_HASH_MISMATCH')


def between(text, start, end):
    require(text.count(start) == 1 and text.count(end) == 1, 'SOURCE_ANCHOR_AMBIGUOUS')
    left = text.index(start) + len(start)
    right = text.index(end)
    require(left <= right, 'SOURCE_ANCHOR_ORDER')
    return text[left:right]


def extract_components(sources):
    backup = sources['platform-infra/backup/catering-backup.sh']
    restore = sources['platform-infra/backup/catering-restore-probe.sh']
    business = sources['shared-core/src/persistence.ts']
    documents = sources['intake-service/src/source-document-store.ts']
    dump = between(backup, 'postgres_dump="$work_root/postgres_dump"\n', 'sites_path="/opt/catering-agents-platform/platform-infra/sites"')
    stream = 'snapshot_stream() {' + between(backup, 'snapshot_stream() {', 'snapshot_json="$(snapshot_stream')
    snapshot = 'snapshot_json="$(snapshot_stream' + between(backup, 'snapshot_json="$(snapshot_stream', 'assert_caddy_container_mounts platform-infra web platform-infra-web-1 platform-infra_caddy_data platform-infra_caddy_config "$platform_caddy_data_mount" "$platform_caddy_config_mount" /opt/catering-agents-platform/platform-infra/sites /etc/caddy/sites\ncaddy_binding_after=')
    checksums = 'bundle_checksums="$(' + between(backup, 'bundle_checksums="$(', 'repository_identity_after="$(read_repository_identity)"')
    extractor = between(restore, 'python3 - "$restore_root/stream.tar" "$restored_tree" <<\'PY\' || fail_state RESTORE_ARTIFACT_INVALID\n', '\nPY\nrestored_manifest="$restored_tree/manifest"') + '\n'
    quoted_body = between(restore, '"$CATERING_RESTORE_POSTGRES_IMAGE" -ceu ', ' 2>/dev/null; then\n  fail_state RESTORE_PROBE_FAILED')
    decoded = shlex.split(quoted_body)
    require(len(decoded) == 1, 'SOURCE_RESTORE_BODY_AMBIGUOUS')
    migration = between(business, 'const BUSINESS_RECORDS_SCHEMA_MIGRATION = `', '`;\n\nfunction isPgMemDoParserError')
    constant = between(documents, 'const SOURCE_DOCUMENT_TABLE = "', '";\nconst SOURCE_DOCUMENT_DIRECTORY')
    require(constant == 'catering_source_documents', 'SOURCE_TABLE_CONSTANT')
    ddl = between(documents, 'this.queryable.query(\n          `', '`\n        ).then(() => undefined)')
    require(re.findall(r'\$\{[^}]*\}', ddl) == ['${SOURCE_DOCUMENT_TABLE}'], 'SOURCE_INTERPOLATION')
    require('${' not in migration, 'SOURCE_INTERPOLATION')
    return {'dump': dump, 'stream': stream, 'snapshot': snapshot, 'checksums': checksums,
            'extractor': extractor, 'restore_body': decoded[0], 'migration': migration,
            'document_template': ddl, 'document_ddl': ddl.replace('${SOURCE_DOCUMENT_TABLE}', constant)}


def load_components(root):
    sources = {}
    for path, expected in SOURCE_HASHES.items():
        target = root / path
        require(target.is_file() and not target.is_symlink(), 'SOURCE_PATH')
        data = target.read_bytes(); check_hash(data, expected)
        sources[path] = data.decode('utf-8')
    parts = extract_components(sources)
    require(set(parts) == set(FRAGMENT_HASHES), 'SOURCE_FRAGMENT_SET')
    for key, value in parts.items():
        check_hash(value.encode(), FRAGMENT_HASHES[key])
    check_hash(LEGACY_DUMP.encode(), LEGACY_DUMP_SHA256)
    return parts, {'parent_commit': PARENT, 'parent_tree': PARENT_TREE,
                   'source_sha256': SOURCE_HASHES, 'fragment_sha256': FRAGMENT_HASHES,
                   'dump_origin': {'legacy': {'commit': PARENT, 'tree': PARENT_TREE,
                       'backup_sha256': LEGACY_BACKUP_SHA256, 'fragment_sha256': LEGACY_DUMP_SHA256},
                       'current': {'execution_identity': 'identity.commit/identity.tree',
                           'backup_sha256': SOURCE_HASHES['platform-infra/backup/catering-backup.sh'],
                           'fragment_sha256': FRAGMENT_HASHES['dump']}}}


def runtime_guard(env, event, operating_system):
    expected = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted',
                'RUNNER_OS': 'Linux', 'GITHUB_REPOSITORY': REPOSITORY,
                'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REF': 'refs/pull/687/merge'}
    require(operating_system == 'Linux' and all(env.get(k) == v for k, v in expected.items()), 'RUNTIME_ISOLATION')
    pr = event.get('pull_request', {})
    head, base = pr.get('head', {}), pr.get('base', {})
    require(event.get('number') == 687 and pr.get('draft') is True
            and head.get('ref') == BRANCH and base.get('ref') == 'main'
            and head.get('repo', {}).get('full_name') == REPOSITORY
            and base.get('repo', {}).get('full_name') == REPOSITORY
            and re.fullmatch('[0-9a-f]{40}', head.get('sha', '')) is not None, 'RUNTIME_PR_BINDING')
    return head['sha']


def remove_owned_root(root, parent, token):
    require(re.fullmatch('[0-9a-f]{32}', token) is not None, 'CLEANUP_TOKEN')
    require(parent == parent.resolve() and not parent.is_symlink(), 'CLEANUP_PARENT')
    require(root == parent / ('catering-tools-' + token) and not root.is_symlink(), 'CLEANUP_BOUNDARY')
    if not root.exists():
        return
    require(root.is_dir() and root.resolve().parent == parent
            and stat.S_IMODE(root.stat().st_mode) == 0o700, 'CLEANUP_BOUNDARY')
    marker = root / '.owned'
    require(marker.is_file() and not marker.is_symlink() and marker.read_text() == token, 'CLEANUP_OWNERSHIP')
    shutil.rmtree(root)
    require(not os.path.lexists(root), 'CLEANUP_REMAINS')


def validate_inspection(value, image, image_id, token, dump=None):
    require(value['image'] == image_id and value['configured_image'] == image
            and value['label'] == token and value['running'] is True, 'CONTAINER_IDENTITY')
    require(value['network'] == 'none' and not value['ports']
            and value['privileged'] is False and value['auto_remove'] is True
            and value['publish_all_ports'] is False, 'CONTAINER_ISOLATION')
    require(set(value['networks']) <= {'none'}, 'CONTAINER_ENDPOINT')
    for endpoint in value['networks'].values():
        require(not endpoint.get('IPAddress') and not endpoint.get('GlobalIPv6Address'), 'CONTAINER_ENDPOINT')
    mounts = value['mounts']
    if dump:
        require(value['user'] == 'postgres', 'CONTAINER_USER')
        binds = [m for m in mounts if m['Type'] == 'bind']
        require(len(binds) == 1 and binds[0]['Source'] == dump
                and binds[0]['Destination'] == '/restore/postgres.dump' and binds[0]['RW'] is False, 'CONTAINER_DUMP_BIND')
    for mount in mounts:
        require(mount['Destination'] != '/var/run/docker.sock'
                and mount['Type'] in ('bind', 'volume'), 'CONTAINER_MOUNT')
        if mount['Type'] == 'volume':
            require(re.fullmatch('[0-9a-f]{64}', mount['Name']) is not None
                    and mount['Destination'] == '/var/lib/postgresql/data', 'CONTAINER_VOLUME')


TABLES = ['catering_business_records', 'catering_source_documents']
# All projected columns and defaults are independent of the extracted DDL.
BUSINESS_COLUMNS = [('business_id', 'text', 'NO', None), ('collection_name', 'text', 'NO', None),
                    ('record_id', 'text', 'NO', None), ('payload', 'jsonb', 'NO', None),
                    ('version_number', 'integer', 'YES', None), ('updated_at', 'timestamp with time zone', 'NO', 'now()')]
DOCUMENT_COLUMNS = [('business_id', 'text', 'NO', None), ('document_id', 'text', 'NO', None),
                    ('filename', 'text', 'NO', None), ('mime_type', 'text', 'NO', None),
                    ('size_bytes', 'bigint', 'NO', None), ('sha256', 'text', 'NO', None),
                    ('data_class', 'text', 'NO', None), ('created_at', 'timestamp with time zone', 'NO', None),
                    ('content', 'bytea', 'NO', None)]


def sql_literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def synthetic_fixture():
    businesses = [
        {'business_id': 'synthetic-alpha', 'collection_name': 'offers', 'record_id': 'shared-record',
         'payload': {'version': 7, 'nested': {'label': 'Grüße Ω', 'items': [1, False, None]}}, 'version_number': 7, 'updated_at': '2026-01-02T03:04:05.123456Z'},
        {'business_id': 'synthetic-alpha', 'collection_name': 'sources', 'record_id': 'source-record',
         'payload': {'revision': 2, 'empty': {}, 'quote': "chef's"}, 'version_number': 2, 'updated_at': '2026-02-03T04:05:06.000000Z'},
        {'business_id': 'synthetic-beta', 'collection_name': 'offers', 'record_id': 'shared-record',
         'payload': {'version': 0, 'different_business': True}, 'version_number': 0, 'updated_at': '2026-03-04T05:06:07.000008Z'},
        {'business_id': 'synthetic-gamma', 'collection_name': 'cases', 'record_id': 'third-record',
         'payload': {'nullable_version': True}, 'version_number': None, 'updated_at': '2026-04-05T06:07:08.999999Z'},
    ]
    contents = [bytes(range(256)) * 1024 + b'\x00\xffZ', b'\x00\xff\x80synthetic-beta\n', b'\xff\x00third\x81']
    documents = []
    statements = []
    for row in businesses:
        values = [json.dumps(v, ensure_ascii=False) if isinstance(v, dict) else v for v in row.values()]
        statements.append('INSERT INTO catering_business_records VALUES (' + ','.join(map(sql_literal, values)) + ');')
    for index, content in enumerate(contents):
        row = {'business_id': ['synthetic-alpha', 'synthetic-beta', 'synthetic-gamma'][index],
               'document_id': 'shared-document', 'filename': ['synthetic-ä.bin', 'synthetic-b.bin', 'synthetic-c.bin'][index],
               'mime_type': 'application/octet-stream', 'size_bytes': len(content), 'sha256': digest(content),
               'data_class': 'synthetic_or_demo_only', 'created_at': '2026-05-06T07:08:09.123456Z'}
        statements.append('INSERT INTO catering_source_documents VALUES (' + ','.join(map(sql_literal, row.values()))
                          + ",decode('" + content.hex() + "','hex'));")
        documents.append(dict(row, content_length=len(content), content_sha256=digest(content)))
    columns = []
    for table, spec in zip(TABLES, [BUSINESS_COLUMNS, DOCUMENT_COLUMNS]):
        for position, (name, kind, nullable, default) in enumerate(spec, 1):
            columns.append({'table_name': table, 'ordinal_position': position, 'column_name': name,
                            'data_type': kind, 'is_nullable': nullable, 'column_default': default})
    primary_keys = [{'table_name': TABLES[0], 'definition': 'PRIMARY KEY (business_id, collection_name, record_id)'},
                    {'table_name': TABLES[1], 'definition': 'PRIMARY KEY (business_id, document_id)'}]
    return '\n'.join(statements), {'business': businesses, 'documents': documents, 'columns': columns, 'primary_keys': primary_keys}


PROJECTION_SQL = """
SELECT json_build_object(
'business', (SELECT json_agg(r ORDER BY business_id,collection_name,record_id) FROM
 (SELECT business_id,collection_name,record_id,payload,version_number,
 to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at
 FROM public.catering_business_records) r),
'documents', (SELECT json_agg(r ORDER BY business_id,document_id) FROM
 (SELECT business_id,document_id,filename,mime_type,size_bytes,sha256,data_class,
 to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at,
 octet_length(content) AS content_length,encode(sha256(content),'hex') AS content_sha256
 FROM public.catering_source_documents) r),
'columns', (SELECT json_agg(r ORDER BY table_name,ordinal_position) FROM
 (SELECT table_name,ordinal_position,column_name,data_type,is_nullable,column_default
 FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN ('catering_business_records','catering_source_documents')) r),
'primary_keys', (SELECT json_agg(r ORDER BY table_name) FROM
 (SELECT relname AS table_name,pg_get_constraintdef(c.oid) AS definition
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE c.contype='p' AND n.nspname='public'
 AND relname IN ('catering_business_records','catering_source_documents')) r));
"""
RESTORE_SUFFIX = "\n# Test-only oracle and observation barrier; original EXIT trap remains active.\n" + (
    "psql -X --no-password --username=catering --dbname=catering_agents -qAt -v ON_ERROR_STOP=1 <<'INTEGRATION_SQL'\n"
    + PROJECTION_SQL + "\nINTEGRATION_SQL\n"
    'test "$(psql -X --username=catering --dbname=catering_agents -qAt -c '
    + shlex.quote("SELECT to_regclass('public.catering_schema_migrations') IS NULL") + ')" = t\n'
    "printf 'INTEGRATION_READY\\n'\nIFS= read -r integration_release\ntest \"$integration_release\" = release\n")


def assert_projection(actual, expected):
    require(actual == expected, 'DATA_OR_SCHEMA_MISMATCH')


PROCESS_GROUPS = []
CLEANUP_BUDGET_SECONDS = 20.0
CLEANUP_DEADLINE = None
PROCESS_STOP_SECONDS = 1.0


def group_exists(process):
    process.poll()
    try:
        os.killpg(process.pid, 0)
        return True
    except ProcessLookupError:
        return False


def start_process(args, **kwargs):
    # Block interruption only across spawn/registration. The child restores
    # the old mask before exec, so its TERM behavior remains unchanged.
    old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGINT})
    try:
        process = subprocess.Popen(args, start_new_session=True,
                                   preexec_fn=lambda: signal.pthread_sigmask(signal.SIG_SETMASK, old_mask), **kwargs)
        PROCESS_GROUPS.append(process)
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)
    return process


def stop_process_group(process, deadline=None):
    end = min(time.monotonic() + PROCESS_STOP_SECONDS, deadline or float('inf'))
    for sig, allowance in [(signal.SIGTERM, 0.2), (signal.SIGKILL, PROCESS_STOP_SECONDS)]:
        if not group_exists(process):
            break
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            pass
        until = min(end, time.monotonic() + allowance)
        while group_exists(process) and time.monotonic() < until:
            time.sleep(min(0.01, max(0, until - time.monotonic())))
    require(not group_exists(process), 'PROCESS_GROUP_REMAINS')
    process.wait(timeout=max(0.001, end - time.monotonic()))
    for pipe in (process.stdin, process.stdout, process.stderr):
        if pipe is not None:
            pipe.close()
    if process in PROCESS_GROUPS:
        PROCESS_GROUPS.remove(process)


def command(args, *, data=None, env=None, timeout=120, pass_fds=(), check=True):
    if CLEANUP_DEADLINE is not None:
        remaining = CLEANUP_DEADLINE - time.monotonic()
        require(remaining > 0.05, 'CLEANUP_DEADLINE')
        timeout = min(timeout, max(0.01, remaining - min(PROCESS_STOP_SECONDS, remaining / 2)))
    process = start_process(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env=env or MINIMAL_ENV, pass_fds=pass_fds)
    try:
        stdout, stderr = process.communicate(input=data, timeout=timeout)
    finally:
        stop_process_group(process, CLEANUP_DEADLINE)
    result = subprocess.CompletedProcess(args, process.returncode, stdout, stderr)
    if check:
        require(result.returncode == 0, 'TOOL_EXIT_' + str(result.returncode))
    return result


def shell(script, env, *, pass_fds=()):
    return command(['/bin/bash', '-euo', 'pipefail', '-c', script], env=env, pass_fds=pass_fds)


# Only this child sees Docker stderr; diagnostics contain fixed identifiers and
# exit codes, while stdout remains the original product dump redirection.
DUMP_OBSERVER = r'''import os, subprocess, sys
fd = int(sys.argv[1])
os.write(fd, b'docker-enter 0\n')
try:
    result = subprocess.run(sys.argv[2:], stderr=subprocess.PIPE)
except OSError:
    os.write(fd, b'docker-launch 127\n')
    raise SystemExit(127)
os.write(fd, ('docker-return %d\n' % result.returncode).encode())
if result.returncode == 1 and result.stderr == b'pg_dump: error: service file "" not found\n':
    os.write(fd, b'empty-service 1\n')
raise SystemExit(result.returncode if result.returncode >= 0 else 128 - result.returncode)
'''


def dump_script(common, fragment, fd, docker):
    observer = shlex.join([sys.executable, '-c', DUMP_OBSERVER, str(fd), docker])
    # Source/init remain unconditionally evaluated in this same Bash process.
    # Wrapping either in if/|| would suppress errexit inside sourced functions.
    return ("dump_stage=source\ntrap 'printf \"%s %s\\n\" \"$dump_stage\" \"$?\" >&"
            + str(fd) + "' EXIT\nsource " + shlex.quote(str(common)) + '\n'
            + 'dump_stage=init\nsecure_restic_init_generation "$CATERING_BACKUP_REPOSITORY_FILE" "$CATERING_BACKUP_PASSWORD_FILE"\n'
            + 'dump_docker() { ' + observer + ' "$@"; }\nDOCKER_CMD=dump_docker\ndump_stage=dump\n'
            + fragment + '\ndump_stage=complete\n')


def run_dump(common, fragment, env):
    with tempfile.TemporaryFile() as diagnostic:
        script = dump_script(common, fragment, diagnostic.fileno(), env['DOCKER_CMD'])
        result = command(['/bin/bash', '-euo', 'pipefail', '-c', script], env=env,
                         pass_fds=(diagnostic.fileno(),), check=False)
        diagnostic.seek(0)
        lines = diagnostic.read(1024).decode('ascii').splitlines()
    require(bool(lines) and len(lines) <= 4, 'DUMP_DIAGNOSTIC_INVALID')
    match = re.fullmatch(r'(source|init|dump|complete) ([0-9]{1,3})', lines[-1])
    require(match is not None and int(match[2]) == result.returncode, 'DUMP_DIAGNOSTIC_INVALID')
    stage, code = match[1], int(match[2])
    events = lines[:-1]
    entered = bool(events) and events[0] == 'docker-enter 0'
    raw = None
    rejected = False
    if events:
        require(entered and len(events) >= 2, 'DUMP_DIAGNOSTIC_INVALID')
        returned = re.fullmatch(r'docker-(return|launch) (-?[0-9]{1,3})', events[1])
        require(returned is not None, 'DUMP_DIAGNOSTIC_INVALID')
        if returned[1] == 'return':
            raw = int(returned[2])
        else:
            require(returned[2] == '127', 'DUMP_DIAGNOSTIC_INVALID')
        require(events[2:] in ([], ['empty-service 1']), 'DUMP_DIAGNOSTIC_INVALID')
        rejected = raw == 1 and events[2:] == ['empty-service 1']
    return {'stage': stage, 'exit_code': code, 'docker_entered': entered,
            'docker_exit_code': raw, 'empty_service_rejected': rejected}


INSPECT_FORMAT = '{' + ','.join('"' + name + '":{{json ' + expression + '}}' for name, expression in [
    ('id', '.Id'), ('name', '.Name'), ('image', '.Image'), ('configured_image', '.Config.Image'),
    ('running', '.State.Running'), ('network', '.HostConfig.NetworkMode'),
    ('ports', '.HostConfig.PortBindings'), ('publish_all_ports', '.HostConfig.PublishAllPorts'),
    ('networks', '.NetworkSettings.Networks'),
    ('privileged', '.HostConfig.Privileged'), ('user', '.Config.User'),
    ('label', '(index .Config.Labels "catering.synthetic.integration")'),
    ('mounts', '.Mounts'), ('auto_remove', '.HostConfig.AutoRemove')]) + '}'


class Resources:
    def __init__(self, parent):
        self.token = secrets.token_hex(16)
        self.parent = parent
        self.root = parent / ('catering-tools-' + self.token)
        self.names = {role: 'catering-tools-' + self.token + '-' + role for role in ('source', 'restore', 'corrupt')}
        self.ids = {}
        self.volumes = set()
        self.processes = PROCESS_GROUPS
        self.inspections = []

    def inspect(self, identity):
        return json.loads(command(['docker', 'inspect', '--format', INSPECT_FORMAT, identity]).stdout)

    def create(self, role, args):
        # Names are registered before creation, so interruption during create
        # can still recover the exact owned resource by its unpredictable name.
        result = command(['docker', 'create', '--name', self.names[role], '--label',
                          'catering.synthetic.integration=' + self.token, *args])
        cid = result.stdout.decode().strip()
        require(re.fullmatch('[0-9a-f]{64}', cid) is not None, 'CONTAINER_ID_INVALID')
        self.ids[role] = cid
        info = self.inspect(cid)
        self.register_volumes(info)
        return cid

    def register_volumes(self, info):
        require(info['label'] == self.token and info['name'] in ['/' + n for n in self.names.values()], 'CLEANUP_CONTAINER_OWNER')
        for mount in info['mounts']:
            if mount['Type'] == 'volume':
                name = mount['Name']
                require(re.fullmatch('[0-9a-f]{64}', name) is not None, 'CLEANUP_VOLUME_OWNER')
                self.volumes.add(name)

    def observe(self, cid, image, image_id, dump=None, credential=None):
        info = self.inspect(cid)
        validate_inspection(info, image, image_id, self.token, dump)
        if credential:
            binds = [m for m in info['mounts'] if m['Type'] == 'bind']
            require(len(binds) == 1 and binds[0]['Source'] == credential
                    and binds[0]['Destination'] == '/run/synthetic-db-password'
                    and binds[0]['RW'] is False, 'SOURCE_CREDENTIAL_BIND')
        self.register_volumes(info)
        devices = command(['docker', 'exec', cid, 'cat', '/proc/net/dev']).stdout.decode()
        require({line.split(':', 1)[0].strip() for line in devices.splitlines() if ':' in line} == {'lo'}, 'CONTAINER_NONLOOPBACK_INTERFACE')
        info['interfaces'] = ['lo']
        self.inspections.append(info)

    def absent(self, name, expected_id=None):
        ids = self.container_ids('name=^/' + name + '$')
        require(expected_id is None or ids in ([], [expected_id]), 'CLEANUP_CONTAINER_ID')
        return not ids

    def container_ids(self, criterion):
        output = command(['docker', 'ps', '-aq', '--no-trunc', '--filter', criterion]).stdout
        require(re.fullmatch(rb'(?:[0-9a-f]{64}\n)?', output) is not None, 'CLEANUP_QUERY_INVALID')
        return output.decode().splitlines()

    def cleanup_container(self, role):
        name, cid = self.names[role], self.ids.get(role)
        self.cleanup_operation = 'query-name-before'
        name_absent = self.absent(name, cid)
        id_absent = True
        if cid:
            self.cleanup_operation = 'query-id-before'
            ids = self.container_ids('id=' + cid)
            require(ids in ([], [cid]), 'CLEANUP_CONTAINER_ID')
            id_absent = not ids
        if not name_absent or not id_absent:
            self.cleanup_operation = 'inspect'
            identity = cid or name
            result = command(['docker', 'inspect', '--format', INSPECT_FORMAT, identity], check=False)
            # Docker's untyped inspect flushes an empty template line when the
            # owned --rm container disappears. Only this exact missing result
            # can defer to the functional final absence queries below.
            missing = (result.returncode == 1 and result.stdout == b'\n'
                       and result.stderr == ('Error: No such object: ' + identity + '\n').encode())
            if not missing:
                require(result.returncode == 0, 'CLEANUP_TOOL_EXIT')
                info = json.loads(result.stdout)
                self.cleanup_operation = 'identity'
                require(info['name'] == '/' + name and info['label'] == self.token
                        and re.fullmatch('[0-9a-f]{64}', info['id']) is not None
                        and (cid is None or info['id'] == cid)
                        and not any(known_id == info['id'] and known_role != role
                                    for known_role, known_id in self.ids.items()), 'CLEANUP_CONTAINER_ID')
                cid = info['id']
                self.ids[role] = cid
                self.cleanup_operation = 'register-volumes'
                self.register_volumes(info)
                self.cleanup_operation = 'remove'
                command(['docker', 'rm', '--force', '--volumes', cid])
        self.cleanup_operation = 'query-name-final'
        name_absent = self.absent(name, cid)
        id_absent = True
        if cid:
            self.cleanup_operation = 'query-id-final'
            ids = self.container_ids('id=' + cid)
            require(ids in ([], [cid]), 'CLEANUP_CONTAINER_ID')
            id_absent = not ids
        self.cleanup_operation = 'absence'
        require(name_absent and id_absent, 'CLEANUP_CONTAINER_REMAINS')

    def cleanup(self):
        global CLEANUP_DEADLINE
        self.cleanup_end = time.monotonic() + CLEANUP_BUDGET_SECONDS
        CLEANUP_DEADLINE = self.cleanup_end - min(2.0, CLEANUP_BUDGET_SECONDS / 3)
        interrupted = []
        handlers = {sig: signal.getsignal(sig) for sig in (signal.SIGTERM, signal.SIGINT)}
        for sig in handlers:
            signal.signal(sig, lambda value, _: interrupted.append(value))
        try:
            result = self._cleanup()
            require(not interrupted, 'CLEANUP_INTERRUPTED')
            return result
        finally:
            CLEANUP_DEADLINE = None
            for sig, handler in handlers.items():
                signal.signal(sig, handler)

    def _cleanup(self):
        failures = []
        self.cleanup_outcomes = []
        def outcome(category, error=None):
            value = {'category': category, 'status': 'failed' if error is not None else 'passed'}
            if error is not None:
                failure_class = 'unexpected'
                if isinstance(error, subprocess.TimeoutExpired):
                    failure_class = 'timeout'
                elif isinstance(error, (json.JSONDecodeError, UnicodeDecodeError, KeyError, TypeError)):
                    failure_class = 'invalid-response'
                elif isinstance(error, OSError):
                    failure_class = 'os-error'
                elif isinstance(error, GateError):
                    code = str(error)
                    failure_class = {'CLEANUP_DEADLINE': 'deadline', 'CLEANUP_CONTAINER_ID': 'identity',
                        'CLEANUP_CONTAINER_OWNER': 'ownership', 'CLEANUP_VOLUME_OWNER': 'ownership',
                        'CLEANUP_CONTAINER_REMAINS': 'remains', 'CLEANUP_VOLUME_REMAINS': 'remains',
                        'CLEANUP_QUERY_INVALID': 'invalid-response', 'CLEANUP_TOOL_EXIT': 'tool-exit',
                        'CLEANUP_ACTIVE_PROCESS': 'process-active', 'PROCESS_GROUP_REMAINS': 'process-active',
                        'CLEANUP_BOUNDARY': 'boundary', 'CLEANUP_OWNERSHIP': 'ownership',
                        'CLEANUP_TOKEN': 'ownership', 'CLEANUP_PARENT': 'boundary',
                        'CLEANUP_REMAINS': 'remains'}.get(code, 'unexpected')
                    if re.fullmatch(r'TOOL_EXIT_-?\d+', code):
                        failure_class = 'tool-exit'
                value.update(operation=self.cleanup_operation, failure_class=failure_class)
                failures.append(category)
            self.cleanup_outcomes.append(value)
        for process in list(self.processes):
            self.cleanup_operation = 'stop'
            try:
                stop_process_group(process, CLEANUP_DEADLINE)
                outcome('process-group')
            except Exception as error:
                outcome('process-group', error)
        for role, name in self.names.items():
            try:
                self.cleanup_container(role)
                outcome('container-' + role)
            except Exception as error:
                outcome('container-' + role, error)
        for volume in self.volumes:
            try:
                self.cleanup_operation = 'query-before'
                remaining = command(['docker', 'volume', 'ls', '--format', '{{.Name}}', '--filter', 'name=^' + volume + '$']).stdout.decode().splitlines()
                if volume in remaining:
                    self.cleanup_operation = 'remove'
                    command(['docker', 'volume', 'rm', volume])
                self.cleanup_operation = 'query-final'
                remaining = command(['docker', 'volume', 'ls', '--format', '{{.Name}}', '--filter', 'name=^' + volume + '$']).stdout.decode().splitlines()
                self.cleanup_operation = 'absence'
                require(volume not in remaining, 'CLEANUP_VOLUME_REMAINS')
                outcome('anonymous-volume')
            except Exception as error:
                outcome('anonymous-volume', error)
        try:
            self.cleanup_operation = 'process-absence'
            require(not any(group_exists(p) for p in self.processes), 'CLEANUP_ACTIVE_PROCESS')
            self.cleanup_operation = 'deadline'
            remaining = self.cleanup_end - time.monotonic()
            require(remaining > 0 and signal.getitimer(signal.ITIMER_REAL) == (0.0, 0.0), 'CLEANUP_DEADLINE')
            old_alarm = signal.getsignal(signal.SIGALRM)
            def expired(*_):
                raise GateError('CLEANUP_DEADLINE')
            signal.signal(signal.SIGALRM, expired)
            signal.setitimer(signal.ITIMER_REAL, remaining)
            try:
                self.cleanup_operation = 'remove-owned-root'
                remove_owned_root(self.root, self.parent, self.token)
            finally:
                signal.setitimer(signal.ITIMER_REAL, 0)
                signal.signal(signal.SIGALRM, old_alarm)
            outcome('temporary-root')
        except Exception as error:
            outcome('temporary-root', error)
        require(not failures, 'CLEANUP_FAILED_' + '_'.join(failures))
        return {'containers_absent': list(self.names.values()), 'anonymous_volumes_absent': sorted(self.volumes), 'temporary_root_absent': True, 'process_groups_absent': True,
                'budget_seconds': CLEANUP_BUDGET_SECONDS, 'outcomes': self.cleanup_outcomes}


def psql(cid, sql):
    return command(['docker', 'exec', '-i', '--user', 'postgres', cid, 'psql', '-X',
                    '--username=catering', '--dbname=catering_agents', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                   data=sql.encode()).stdout.decode().strip()


def wait_ready(cid):
    # Bounded readiness observation of the one startup; this never restarts it.
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        result = command(['docker', 'exec', '--user', 'postgres', cid, '/bin/sh', '-ceu',
                          'test "$(cat /proc/1/comm)" = postgres; '
                          'pg_isready --username=catering --dbname=catering_agents'], check=False)
        if result.returncode == 0:
            return
        time.sleep(0.25)
    raise GateError('SOURCE_START_TIMEOUT')


def restore_case(resources, role, image, image_id, dump, body, expected=None):
    suffix = RESTORE_SUFFIX if expected is not None else ''
    cid = resources.create(role, ['-i', '--user', 'postgres', '--rm', '--network', 'none', '--pull', 'never',
                                  '--entrypoint', '/bin/sh', '--volume', str(dump) + ':/restore/postgres.dump:ro',
                                  image, '-ceu', body + suffix])
    process = start_process(['docker', 'start', '-ai', cid], env=MINIMAL_ENV,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE if expected is None else subprocess.DEVNULL)
    if expected is None:
        output, errors = process.communicate(timeout=90)
        require(process.returncode > 0 and b'pg_restore: error:' in errors
                and b'valid archive' in errors, 'CORRUPT_DUMP_NOT_REJECTED_BY_RESTORE')
        stop_process_group(process)
        require(resources.absent(resources.names[role]), 'CORRUPT_CONTAINER_REMAINS')
        return {'exit_code': process.returncode, 'pg_restore_rejected_input': True, 'container_absent': True}
    output = bytearray()
    deadline = time.monotonic() + 90
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        while not output.endswith(b'INTEGRATION_READY\n'):
            require(time.monotonic() < deadline, 'RESTORE_ASSERT_TIMEOUT')
            for key, _ in selector.select(timeout=0.5):
                chunk = os.read(key.fileobj.fileno(), 65536)
                require(bool(chunk), 'RESTORE_EARLY_EXIT')
                output.extend(chunk)
                require(len(output) < 1048576, 'RESTORE_OUTPUT_LIMIT')
    marker = b'\nINTEGRATION_READY\n'
    require(output.count(marker) == 1 and output.endswith(marker), 'RESTORE_ORACLE_OUTPUT')
    try:
        projection = json.loads(output[:-len(marker)].decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise GateError('RESTORE_ORACLE_OUTPUT') from None
    assert_projection(projection, expected)
    resources.observe(cid, image, image_id, str(dump))
    # Keep the release/exit window bounded without communicate buffering an
    # unlimited tail. The unchanged producer emits nothing after its marker.
    release_deadline = time.monotonic() + 30
    process.stdin.write(b'release\n')
    process.stdin.flush()
    process.stdin.close()
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        eof = False
        while not eof:
            remaining = release_deadline - time.monotonic()
            require(remaining > 0, 'RESTORE_RELEASE_TIMEOUT')
            for key, _ in selector.select(timeout=min(0.5, remaining)):
                chunk = os.read(key.fileobj.fileno(), 65536)
                require(len(output) + len(chunk) < 1048576, 'RESTORE_OUTPUT_LIMIT')
                require(not chunk, 'RESTORE_ORACLE_OUTPUT')
                eof = True
    remaining = release_deadline - time.monotonic()
    require(remaining > 0, 'RESTORE_RELEASE_TIMEOUT')
    process.wait(timeout=remaining)
    require(process.returncode == 0, 'RESTORE_EXIT_NONZERO')
    stop_process_group(process)
    require(resources.absent(resources.names[role]), 'RESTORE_CONTAINER_REMAINS')
    return {'exit_code': 0, 'data_schema_equal': True, 'migration_bookkeeping_absent': True, 'container_absent': True}


def write_private(path, content, mode=0o600):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(content)
    os.chmod(path, mode)


def execute(root, parent, identity):
    require(os.geteuid() == 0, 'ROOT_REQUIRED_FOR_UNCHANGED_RESTIC_CONTRACT')
    parts, provenance = load_components(root)
    resources = Resources(parent)
    evidence = {'kind': 'synthetic-component-only', 'identity': identity, 'provenance': provenance,
                'backend': 'local-ephemeral-encrypted-restic', 'offhost_coverage': False,
                'production_entrypoints_executed': False, 'status': 'failed', 'stage': 'setup',
                'restore_suffix_sha256': digest(RESTORE_SUFFIX.encode()),
                'extractor_input_transport': 'anonymous-seekable-memfd; no on-disk bundle archive'}
    try:
        resources.root.mkdir(mode=0o700)
        write_private(resources.root / '.owned', resources.token.encode())
        MINIMAL_ENV.update(HOME=str(resources.root), TMPDIR=str(resources.root),
                           DOCKER_CONFIG=str(resources.root / 'docker-config'))
        env = dict(MINIMAL_ENV)
        work = resources.root / 'work'; work.mkdir(mode=0o700)
        locator, password = resources.root / 'repository-location', resources.root / 'restic-password'
        repository = resources.root / 'encrypted-repository'
        write_private(locator, (str(repository) + '\n').encode())
        write_private(password, (secrets.token_hex(32) + '\n').encode())
        db_password = resources.root / 'db-password'
        write_private(db_password, (secrets.token_hex(32) + '\n').encode(), 0o644)
        env.update(CATERING_BACKUP_ROOT=str(resources.root), CATERING_BACKUP_REPOSITORY_FILE=str(locator),
                   CATERING_BACKUP_PASSWORD_FILE=str(password), CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256=digest(str(repository).encode()))
        common = root / 'platform-infra/backup/catering-backup-common.sh'
        prelude = 'source ' + shlex.quote(str(common)) + '\nrestic_cmd() { secure_restic "$@" 2>/dev/null; }\n'
        prelude += 'secure_restic_init_generation "$CATERING_BACKUP_REPOSITORY_FILE" "$CATERING_BACKUP_PASSWORD_FILE"\n'
        evidence['versions'] = {'python': sys.version.split()[0]}
        evidence['versions']['docker_engine'] = command(['docker', 'version', '--format', '{{.Server.Version}}']).stdout.decode().strip()
        evidence['versions']['restic_package'] = command(['dpkg-query', '-W', '-f=${Version}', 'restic']).stdout.decode().strip()
        evidence['versions']['docker'] = command(['docker', '--version']).stdout.decode().strip()
        evidence['versions']['restic'] = command(['restic', 'version']).stdout.decode().strip()
        evidence['stage'] = 'image-acquisition'
        command(['docker', 'pull', 'postgres:17'], timeout=180)
        image_info = json.loads(command(['docker', 'image', 'inspect', '--format', '{"id":{{json .Id}},"digests":{{json .RepoDigests}}}', 'postgres:17']).stdout)
        digests = [x for x in image_info['digests'] if re.fullmatch(r'postgres@sha256:[0-9a-f]{64}', x)]
        require(len(digests) == 1 and re.fullmatch(r'sha256:[0-9a-f]{64}', image_info['id']) is not None, 'IMAGE_DIGEST_INVALID')
        image, image_id = digests[0], image_info['id']
        evidence['image'] = {'acquired_tag': 'postgres:17', 'repository_digest': image, 'image_id': image_id}
        source = resources.create('source', ['--rm', '--network', 'none', '--pull', 'never',
                                           '--env', 'POSTGRES_USER=catering', '--env', 'POSTGRES_DB=catering_agents',
                                           '--env', 'POSTGRES_PASSWORD_FILE=/run/synthetic-db-password',
                                           '--volume', str(db_password) + ':/run/synthetic-db-password:ro', image])
        command(['docker', 'start', source]); wait_ready(source)
        resources.observe(source, image, image_id, credential=str(db_password))
        for tool in ['psql', 'pg_dump', 'pg_restore']:
            evidence['versions'][tool] = command(['docker', 'exec', '--user', 'postgres', source, tool, '--version']).stdout.decode().strip()
        require(all(' 17.' in evidence['versions'][t] for t in ['psql', 'pg_dump', 'pg_restore']), 'POSTGRES_MAJOR_MISMATCH')
        evidence['stage'] = 'source-schema-and-fixture'
        seed, expected = synthetic_fixture()
        psql(source, parts['migration'] + '\n' + parts['document_ddl'] + ';\n' + seed)
        assert_projection(json.loads(psql(source, PROJECTION_SQL)), expected)
        require(psql(source, "SELECT unit_name || ':' || version_number FROM catering_schema_migrations") == 'catering_business_records:3', 'MIGRATION_BOOKKEEPING')
        evidence['source'] = {'data_schema_equal': True, 'business_rows': 4, 'document_rows': 3,
                              'migration_bookkeeping': 'catering_business_records:3; excluded by exact two-table dump'}
        env.update(work_root=str(work), postgres_dump=str(work / 'postgres_dump'), postgres_container_id=source,
                   DOCKER_CMD='docker', PG_DUMP_CMD='pg_dump', bundle_path='synthetic-component-stream')
        evidence['stage'] = 'legacy-pg-dump-rejection'
        evidence['legacy_dump'] = run_dump(common, LEGACY_DUMP, env)
        require(evidence['legacy_dump'] == {'stage': 'dump', 'exit_code': 1,
                'docker_entered': True, 'docker_exit_code': 1, 'empty_service_rejected': True},
                'LEGACY_EMPTY_SERVICE_NOT_REJECTED')
        evidence['stage'] = 'exact-pg-dump'
        evidence['dump'] = run_dump(common, parts['dump'], env)
        require(evidence['dump'] == {'stage': 'complete', 'exit_code': 0,
                'docker_entered': True, 'docker_exit_code': 0, 'empty_service_rejected': False},
                'CURRENT_DUMP_FAILED')
        write_private(work / 'manifest', b'version=1\nkind=synthetic-component-only\n')
        component_paths = {}
        for name in ['sites', 'platform_caddy_data', 'platform_caddy_config', 'shared_edge_caddyfile', 'shared_edge_caddy_data', 'shared_edge_caddy_config']:
            path = resources.root / name
            if name == 'shared_edge_caddyfile':
                write_private(path, b'# synthetic Caddy fixture, never used as configuration\n')
            else:
                path.mkdir(mode=0o700)
                write_private(path / 'synthetic.bin', bytes(range(256)) * 600 + name.encode())
                nested = path / 'nested'; nested.mkdir(mode=0o700)
                write_private(nested / 'label.txt', ('synthetic ' + name + '\n').encode())
            component_paths[name] = path
        env.update(sites_path=str(component_paths['sites']), platform_caddy_data_mount=str(component_paths['platform_caddy_data']),
                   platform_caddy_config_mount=str(component_paths['platform_caddy_config']), shared_edge_caddyfile_path=str(component_paths['shared_edge_caddyfile']),
                   shared_edge_caddy_data_mount=str(component_paths['shared_edge_caddy_data']), shared_edge_caddy_config_mount=str(component_paths['shared_edge_caddy_config']))
        evidence['stage'] = 'exact-stream-restic-backup'
        shell(prelude + 'restic_cmd init >/dev/null\n', env)
        repository_id = json.loads(shell(prelude + 'restic_cmd cat config\n', env).stdout)['id']
        require(re.fullmatch('[0-9a-f]{64}', repository_id) is not None, 'RESTIC_REPOSITORY_ID')
        script = prelude + parts['stream'] + parts['snapshot'] + parts['checksums']
        script += '\nprintf "%s\\n%s\\n" "$snapshot_id" "$bundle_checksums"\n'
        lines = shell(script, env).stdout.decode().splitlines()
        require(len(lines) == 2 and re.fullmatch('[0-9a-f]{64}', lines[0]) is not None, 'SNAPSHOT_RESULT')
        snapshot_id, checksums = lines[0], lines[1].split('\t')
        env['snapshot_id'] = snapshot_id
        evidence['stage'] = 'independent-full-readback-and-extraction'
        stream = shell(prelude + 'restic_cmd dump "$snapshot_id" "$bundle_path"\n', env).stdout
        require(len(stream) < 16777216 and digest(stream) == checksums[0], 'WHOLE_STREAM_CHECKSUM_MISMATCH')
        restored_tree = resources.root / 'restored-tree'; restored_tree.mkdir(mode=0o700)
        fd = os.memfd_create('synthetic-component-readback', os.MFD_CLOEXEC)
        try:
            with os.fdopen(os.dup(fd), 'wb') as sink:
                sink.write(stream)
            os.lseek(fd, 0, os.SEEK_SET)
            command(['python3', '-', '/proc/self/fd/' + str(fd), str(restored_tree)],
                    data=parts['extractor'].encode(), env=env, pass_fds=(fd,))
        finally:
            os.close(fd)
        del stream
        expected_files = {'manifest': work / 'manifest', 'postgres_dump': work / 'postgres_dump'}
        for name, path in component_paths.items():
            if path.is_file():
                expected_files['components/' + name] = path
            else:
                for file in path.rglob('*'):
                    if file.is_file():
                        expected_files['components/' + name + '/' + str(file.relative_to(path))] = file
        actual_files = {str(p.relative_to(restored_tree)): p for p in restored_tree.rglob('*') if p.is_file()}
        require(set(expected_files) == set(actual_files), 'FILE_SET_MISMATCH')
        file_hashes = {}
        for name, original in expected_files.items():
            file_hashes[name] = digest(original.read_bytes())
            require(digest(actual_files[name].read_bytes()) == file_hashes[name], 'FILE_CHECKSUM_MISMATCH')
        measured_components = [file_hashes['postgres_dump']]
        for name in component_paths:
            if name == 'shared_edge_caddyfile':
                measured_components.append(file_hashes['components/' + name])
            else:
                rows = sorted((key, value) for key, value in file_hashes.items() if key.startswith('components/' + name + '/'))
                measured_components.append(digest(b''.join(key.encode() + b'\0' + value.encode() + b'\n' for key, value in rows)))
        require(checksums[1:] == measured_components, 'COMPONENT_CHECKSUM_MISMATCH')
        require(json.loads(shell(prelude + 'restic_cmd cat config\n', env).stdout)['id'] == repository_id, 'REPOSITORY_ID_CHANGED')
        evidence['restic'] = {'repository_id': repository_id, 'snapshot_id': snapshot_id, 'whole_stream_sha256': checksums[0],
                              'independent_full_stream_match': True, 'all_component_checksums_match': True, 'per_file_sha256': file_hashes}
        evidence['stage'] = 'exact-inner-restore'
        evidence['restore'] = restore_case(resources, 'restore', image, image_id, restored_tree / 'postgres_dump', parts['restore_body'], expected)
        evidence['stage'] = 'corrupt-dump-failure'
        corrupt = resources.root / 'corrupt.dump'; write_private(corrupt, b'synthetic deliberately invalid custom dump\n', 0o644)
        evidence['corrupt_dump'] = restore_case(resources, 'corrupt', image, image_id, corrupt, parts['restore_body'])
        evidence['status'] = 'passed'
    except Exception as error:
        evidence['error'] = str(error) if isinstance(error, GateError) else type(error).__name__
    finally:
        try:
            evidence['cleanup'] = resources.cleanup()
        except Exception as error:
            evidence['status'] = 'failed'
            evidence['cleanup'] = {'error': 'CLEANUP_FAILED',
                'outcomes': getattr(resources, 'cleanup_outcomes', []),
                'failure_class': 'interrupted' if isinstance(error, GateError)
                and str(error) == 'CLEANUP_INTERRUPTED' else 'category-failure'}
        evidence['inspections'] = resources.inspections
    print(json.dumps(evidence, sort_keys=True), flush=True)
    return 0 if evidence['status'] == 'passed' else 1


def root_invocation(script, head, tree, environment):
    forwarded = {key: environment[key] for key in ['GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'RUNNER_OS', 'GITHUB_REPOSITORY',
                 'GITHUB_EVENT_NAME', 'GITHUB_REF', 'GITHUB_EVENT_PATH', 'GITHUB_WORKSPACE', 'RUNNER_TEMP']}
    return ['sudo', '-n', '/usr/bin/env', '-i', *[k + '=' + v for k, v in {**MINIMAL_ENV, **forwarded}.items()],
            '/usr/bin/timeout', '--signal=TERM', '--kill-after=30s', '600',
            '/usr/bin/python3', '-B', script, '--execute', head, tree]


def main():
    # Validate public workflow metadata before Git, sudo, Docker, or Restic.
    env = os.environ
    require(env.get('GITHUB_ACTIONS') == 'true' and env.get('RUNNER_ENVIRONMENT') == 'github-hosted'
            and platform.system() == 'Linux', 'RUNTIME_ISOLATION')
    event = json.loads(Path(env['GITHUB_EVENT_PATH']).read_text())
    head = runtime_guard(env, event, platform.system())
    root = Path(__file__).resolve().parents[2]
    require(root == Path(env['GITHUB_WORKSPACE']).resolve(), 'RUNTIME_CHECKOUT_PATH')
    parent = Path(env['RUNNER_TEMP'])
    require(parent.is_absolute() and parent == parent.resolve() and parent.is_dir(), 'RUNTIME_TEMP_PATH')
    load_components(root)
    if len(sys.argv) > 1 and sys.argv[1] == '--execute':
        require(len(sys.argv) == 4 and sys.argv[2] == head
                and re.fullmatch('[0-9a-f]{40}', sys.argv[3]) is not None, 'RUNTIME_IDENTITY')
        def interrupted(*_):
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            signal.signal(signal.SIGINT, signal.SIG_IGN)
            raise GateError('INTERRUPTED')
        signal.signal(signal.SIGTERM, interrupted)
        signal.signal(signal.SIGINT, interrupted)
        return execute(root, parent, {'commit': head, 'tree': sys.argv[3], 'runner': 'github-hosted', 'os': 'Linux', 'pr': 687})
    require(os.geteuid() != 0, 'RUNNER_GIT_IDENTITY_REQUIRED')
    def git(*args):
        return command(['git', '-C', str(root), '--no-optional-locks', *args]).stdout.decode().strip()
    require(git('rev-parse', 'HEAD') == head and not git('status', '--porcelain=v1', '--untracked-files=all'), 'CHECKOUT_NOT_CLEAN_PR_HEAD')
    require(git('rev-parse', PARENT + '^{tree}') == PARENT_TREE, 'PARENT_TREE_MISMATCH')
    git('merge-base', '--is-ancestor', PARENT, head)
    tree = git('rev-parse', 'HEAD^{tree}')
    if sys.argv[1:] == ['--preflight']:
        print(json.dumps({'preflight': 'passed', 'commit': head, 'tree': tree, 'runner': 'github-hosted'}))
        return 0
    require(len(sys.argv) == 1, 'ARGUMENT_INVALID')
    args = root_invocation(str(Path(__file__).resolve()), head, tree, env)
    return subprocess.run(args, env=MINIMAL_ENV).returncode


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'status': 'failed', 'error': str(error) if isinstance(error, GateError) else type(error).__name__}))
        sys.exit(1)
