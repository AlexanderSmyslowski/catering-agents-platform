#!/usr/bin/python3 -I
"""Read local restore proof, observe original services, send one bounded health signal."""
import datetime as dt
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import selectors
import signal
import socket
import ssl
import stat
import subprocess
import sys
import time
from urllib.parse import urlsplit

OWNER_UID, OWNER_GID = 0, 0
COMMON = Path(__file__).resolve().with_name('catering-backup-common.sh')
COMMON_SOURCE = None
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC'}
SCOPE = 'postgres-full,sites,platform-caddy,catering-edge-caddy'
COMPONENTS = ('sites', 'platform_caddy_data', 'platform_caddy_config',
              'catering_edge_caddyfile', 'catering_edge_caddy_data', 'catering_edge_caddy_config')
CHILD_GROUPS = set()
HELPER_SECONDS = 10


def require(condition, reason='BINDING_INVALID'):
    if not condition:
        raise ValueError(reason)


def utc_now():
    return int(time.time())


def epoch(value, system=False):
    if system and not value:
        return 0
    return int(dt.datetime.strptime(value, '%a %Y-%m-%d %H:%M:%S UTC' if system else
                                   '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc).timestamp())


def sha(value):
    return hashlib.sha256(value).hexdigest()


def generation(info):
    # Reading can update atime; content/identity/ownership changes must not pass.
    return (info.st_dev, info.st_ino, info.st_mtime_ns, info.st_ctime_ns,
            info.st_size, info.st_mode, info.st_uid, info.st_gid, info.st_nlink)


def protected(path, private=True, maximum=65536):
    """Walk without symlinks; a held directory descriptor binds each open."""
    path = Path(path)
    require(path.is_absolute() and '..' not in path.parts)
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in path.parts[1:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
            info = os.fstat(fd)
            require(info.st_uid in (0, OWNER_UID) and
                    (not info.st_mode & 0o022 or info.st_mode & stat.S_ISVTX), 'PROTECTION_INVALID')
        child = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
        with os.fdopen(child, 'rb') as source:
            info = os.fstat(source.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_uid == OWNER_UID and
                    info.st_gid == OWNER_GID and stat.S_IMODE(info.st_mode) in ((0o600,) if private else (0o600, 0o644, 0o755)) and
                    info.st_nlink == 1 and info.st_size <= maximum, 'PROTECTION_INVALID')
            data = source.read(maximum + 1)
            require(len(data) <= maximum and generation(os.fstat(source.fileno())) == generation(info), 'GENERATION_CHANGED')
        return data, generation(info)
    finally:
        os.close(fd)


def terminate_children(signum=None, frame=None):
    for pid in tuple(CHILD_GROUPS):
        try:
            os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if signum is not None:
        raise SystemExit(1)


def shell(root, command, args, payload=None):
    env = dict(ENV, CATERING_BACKUP_ROOT=str(root), CATERING_BACKUP_EXPECTED_UID=str(OWNER_UID))
    mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGINT})
    process = None
    try:
        # A streamed operations check carries these same validators in memory.
        # Installed senders continue sourcing their adjacent, versioned helper.
        loader = COMMON_SOURCE + '\n' if COMMON_SOURCE is not None else 'source "$1"; shift; '
        helper_args = [] if COMMON_SOURCE is not None else [str(COMMON)]
        process = subprocess.Popen(['/bin/bash', '-c', loader + 'EXPECTED_UID="$CATERING_BACKUP_EXPECTED_UID"; '
                                + command, 'observer', *helper_args, *map(str, args)],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               env=env, start_new_session=True)
        CHILD_GROUPS.add(process.pid)
        signal.pthread_sigmask(signal.SIG_SETMASK, mask)
        output, _ = process.communicate(payload, timeout=HELPER_SECONDS)
        require(process.returncode == 0, 'VALIDATOR_FAILED')
        return output
    finally:
        if process is not None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=1)
            CHILD_GROUPS.discard(process.pid)
            process.stdout.close()
            process.stdin.close()
        signal.pthread_sigmask(signal.SIG_SETMASK, mask)



def publish_state(root, now, failure, health):
    payload = ('status=observer\nlast_seen_epoch=' + str(now) + '\nfailure_epoch=' + str(failure) +
               '\ndelivery_accepted=false\nbackup_health=' + health)
    shell(root, 'atomic_write_record "$1" "$(cat)"$\'\\n\'', [root / 'state'], payload.encode())


class Records:
    def __init__(self):
        self.generations = {}
        self.public_sources = set()

    def read(self, path, private=True):
        # Only explicit versioned sources use 256 KiB; private records stay 64 KiB.
        data, identity = protected(path) if private else protected(path, private=False, maximum=262144)
        if not private:
            self.public_sources.add(str(path))
        self.generations[str(path)] = (data, identity)
        return data

    def stable(self):
        require(all((protected(path) if path not in self.public_sources else protected(path, private=False, maximum=262144)) == value
                    for path, value in self.generations.items()), 'GENERATION_CHANGED')

    def record(self, root, path, kind, checksum=''):
        data = self.read(path)
        require(data.endswith(b'\n') and not data.endswith(b'\n\n') and not any(c in data for c in (b'\0', b'\r', b'\t')))
        if kind in ('offhost', 'secret'):
            result = shell(root, 'validate_attestation_record "$1" "$2" "$3"', [kind, path, checksum])
        else:
            result = shell(root, 'read_record "$1" "$2" "$3"', [path, kind, checksum])
        require(result == data[:-1], 'GENERATION_CHANGED')
        # Projection only: shared fixed schemas already reject duplicates and unknown fields.
        return dict(line.split('=', 1) for line in result.decode('utf-8').splitlines())


def get_units():
    properties = ('ActiveState,UnitFileState,Result,ExecMainStatus,ExecMainCode,InvocationID,'
                  'ExecMainStartTimestamp,ExecMainExitTimestamp,ActiveEnterTimestamp,LastTriggerUSec,'
                  'Persistent,AccuracyUSec,RandomizedDelayUSec,TimersCalendar')
    result = {}
    for key, unit in [('backup', 'catering-backup.service'), ('restore', 'catering-restore-probe.service'),
                      ('timer', 'catering-backup.timer'), ('clock', '')]:
        command = ['/usr/bin/systemctl', 'show', unit, '--property=' + properties] if unit else [
            '/usr/bin/timedatectl', 'show', '--property=NTPSynchronized']
        output = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                env=ENV, timeout=5, check=True).stdout.decode('ascii')
        result[key] = dict(line.split('=', 1) for line in output.splitlines())
    return result


def proof(records, policy, now):
    root, binding = Path(policy['root']), policy['bindings']
    require(set(binding) == {'scope', 'host_binding', 'source_commit', 'source_tree', 'repository_identity',
                             'secret_recovery_reference_sha256', 'restore_postgres_image'})
    require(binding['scope'] == SCOPE and binding['host_binding'] == sha(socket.gethostname().split('.')[0].encode()))
    for key, value in binding.items():
        pattern = r'postgres@sha256:[0-9a-f]{64}' if key == 'restore_postgres_image' else r'[0-9a-f]{40}' if key.startswith('source_') else r'[0-9a-f]{64}'
        require(key == 'scope' or re.fullmatch(pattern, value))
    evidence = records.record(root, root / 'catering-backup-evidence', 'evidence')
    require(evidence['status'] == 'success' and evidence['project'] == 'catering-agents-platform')
    linked = {}
    for kind, directory in [('artifact', 'snapshots'), ('receipt', 'restore-receipts')]:
        path = Path(evidence[kind + '_path'])
        require(path.parent == root / directory and re.fullmatch(r'[A-Za-z0-9_.:-]+', path.name))
        linked[kind] = records.record(root, path, kind, evidence[kind + '_checksum'])
    artifact, receipt = linked['artifact'], linked['receipt']
    status = records.record(root, root / 'catering-backup-repository-status', 'status')
    require(artifact['status'] == 'artifact' and receipt['status'] == 'restore-receipt' and receipt['version'] == '1')
    require(status['status'] == evidence['repository_status'] == 'read-only-verified')
    for key, value in binding.items():
        for record in ([artifact] if key.startswith('source_') else [evidence, receipt] if key == 'repository_identity' else [evidence, artifact, receipt]):
            require(record[key] == value)
    require(status['identity'] == binding['repository_identity'] and status['host_binding'] == binding['host_binding'] and status['scope'] == SCOPE)
    for key in ('snapshot_id', 'artifact_path', 'artifact_checksum'):
        require(evidence[key] == receipt[key])
    require(evidence['snapshot_id'] == evidence['artifact_snapshot_id'] and re.fullmatch(r'[0-9a-f]{64}', evidence['snapshot_id']))
    require(evidence['checksum'] == evidence['artifact_checksum'] and evidence['artifact_host_binding'] == binding['host_binding'] and
            evidence['artifact_scope'] == SCOPE and evidence['artifact_created_at'] == evidence['created_at'])
    for key in ('bundle_path', 'bundle_checksum', 'manifest_path', 'manifest_checksum'):
        require(artifact[key] == receipt[key])
    require(artifact['component_caddy_stream_checksum'] == artifact['bundle_checksum'] and
            artifact['manifest_path'] == 'manifest' and artifact['postgres_dump_path'] == 'postgres_dump')
    for key in ['component_' + c + '_checksum' for c in COMPONENTS]:
        require(evidence[key] == receipt[key] == artifact[key])
    require(all(re.fullmatch(r'[0-9a-f]{64}', value) for record in [evidence, artifact, receipt] for key, value in record.items() if 'checksum' in key))
    created, verified = epoch(evidence['created_at']), epoch(receipt['verified_at'])
    require(created <= verified <= epoch(status['verified_at']) <= now and 0 <= now - created <= 21600, 'EVIDENCE_AGE_INVALID')
    require(0 <= int(evidence['duration_seconds']) <= 7200, 'RESTORE_BUDGET_EXCEEDED')
    deadline = created + 21600
    return created, verified, attestation_deadline(records, policy, now, deadline)


def attestation_deadline(records, policy, now, deadline):
    root, binding = Path(policy['root']), policy['bindings']
    for kind in ('offhost', 'secret'):
        item = policy['attestations'][kind]
        record = records.record(root, item['path'], kind, item['sha256'])
        fixed = {k: v for k, v in record.items() if k not in ('verified_at', 'valid_until', 'attestation_id')}
        require(fixed == item['fields'] and record['status'] == 'operator_attested' and re.fullmatch(r'[0-9a-f]{64}', record['attestation_id']))
        for key in ('scope', 'host_binding', 'repository_identity'):
            require(record[key] == binding[key])
        require(record['production_host_binding'] == binding['host_binding'] if kind == 'offhost' else
                record['source_reference_digest'] == binding['secret_recovery_reference_sha256'])
        if kind == 'secret':
            reference = record['source_reference']
            pattern = (r'github_environment:[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*'
                       if record['source_type'] == 'github_environment' else r'offline_vault:/[A-Za-z0-9_./-]+')
            require(record['source_type'] in ('github_environment', 'offline_vault') and re.fullmatch(pattern, reference) and
                    '..' not in reference and '//' not in reference and not reference.endswith('/'))
            schema = shell(root, 'printf %s "$SECRET_RECOVERY_SCHEMA"', [])
            require(sha(reference.encode()) == record['source_reference_digest'] and sha(schema) == record['required_secret_schema_digest'])
        else:
            require(re.fullmatch(r'[a-z0-9][a-z0-9.-]*[a-z0-9]', record['endpoint_host']) and
                    not record['endpoint_host'].endswith(('.local', '.internal')))
            for key in ('locator_digest', 'resolved_addresses_digest', 'production_addresses_digest'):
                require(re.fullmatch(r'[0-9a-f]{64}', record[key]))
        start, end = epoch(record['verified_at']), epoch(record['valid_until'])
        require(start <= now < end and 0 < end - start <= 2592000, 'ATTESTATION_INVALID')
        deadline = min(deadline, end - 172800)
    return deadline


def service_failure(units, now):
    failures = [epoch(units[k]['ExecMainStartTimestamp'], True) or now for k in ('backup', 'restore')
                if units[k]['Result'] not in ('', 'success') or units[k]['ExecMainStatus'] != '0' or units[k]['ActiveState'] == 'failed']
    return max(failures, default=0)


def service_health(units, now, created, verified, previous_failure):
    require(units['clock']['NTPSynchronized'] == 'yes', 'CLOCK_UNSYNCED')
    timer = units['timer']
    require(timer['ActiveState'] == 'active' and timer['UnitFileState'] == 'enabled' and timer['Persistent'] == 'yes' and
            timer['AccuracyUSec'] == '1min' and timer['RandomizedDelayUSec'] == '0' and
            re.fullmatch(r'\{ OnCalendar=\*-\*-\* 00,03,06,09,12,15,18,21:00:00 UTC ; next_elapse=[^{}]+ \}',
                         timer['TimersCalendar']), 'TIMER_NOT_ARMED')
    times = {}
    for kind, budget in [('backup', 1800), ('restore', 7200)]:
        unit = units[kind]
        start, end = epoch(unit['ExecMainStartTimestamp'], True), epoch(unit['ExecMainExitTimestamp'], True)
        require(start <= now and end <= now, 'CLOCK_INVALID')
        require(unit['Result'] == 'success' and unit['ExecMainStatus'] == '0' and unit['ActiveState'] != 'failed', 'SERVICE_FAILED')
        require(re.fullmatch(r'[0-9a-f]{32}', unit['InvocationID']) and start > 0 and
                unit['ActiveState'] in ('active', 'activating', 'inactive'), 'SERVICE_UNKNOWN')
        running = unit['ActiveState'] in ('active', 'activating')
        require(unit['ExecMainCode'] in (('0', '1') if running else ('1',)), 'SERVICE_UNKNOWN')
        require((now if running else end) - start <= budget and (running or end >= start), 'SERVICE_BUDGET_EXCEEDED')
        times[kind] = (start, end, running)
    start, end, running = times['backup']
    activated = epoch(timer['ActiveEnterTimestamp'], True)
    due = max(now // 10800 * 10800, activated)
    cycle_due = max(start // 10800 * 10800, activated if activated <= start else 0)
    trigger = epoch(timer['LastTriggerUSec'], True)
    require(0 < trigger <= now and (now <= due + 300 or (due <= start <= due + 300 and trigger >= due)), 'CYCLE_MISSING')
    restore_start, restore_end, restoring = times['restore']
    if not running and now > end + 240:
        require(end <= restore_start <= end + 240, 'RESTORE_DISPATCH_MISSING')
    if not running and restore_start >= end:
        require(max(0, start - cycle_due - 60) + restore_start - end <= 240, 'DISPATCH_BUDGET_EXCEEDED')
    require(now <= cycle_due + 9300 or (not running and not restoring and created >= start and verified <= cycle_due + 9300),
            'PUBLICATION_MISSING')
    if now > due + 9300:
        require(not running and not restoring and created >= due and verified <= due + 9300, 'PUBLICATION_MISSING')
    if not running and not restoring and now > end + 240:
        require(restore_start >= end and created >= start and verified >= restore_start and verified <= restore_end, 'PUBLICATION_MISSING')
    require(created > previous_failure, 'FAILURE_LATCHED')


NUE_START = '7d4958e842da4a758f6c1cdc7b36dcc5'
NUE_SUCCESS = '7ad2d189f7e94e70a38c781354912448'
NUE_DONE = '39f53479d3a045ac8e11786248231fbf'
NUE_RESOURCES = 'ae8f7b866b0347b9af31fe1c80b127c0'
NUE_PASS = 'FULL_BACKUP_OFFHOST_READBACK_RESTORE_CLEANUP_PASS'


def bounded_metadata(arguments):
    """The journal may contain diagnostics; keep its bytes private and bounded."""
    mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGINT})
    process, selector, body, deadline = None, selectors.DefaultSelector(), bytearray(), time.monotonic() + 5
    try:
        process = subprocess.Popen(arguments, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                   env=ENV, start_new_session=True)
        CHILD_GROUPS.add(process.pid)
        signal.pthread_sigmask(signal.SIG_SETMASK, mask)
        selector.register(process.stdout, selectors.EVENT_READ)
        while selector.get_map():
            remaining = deadline - time.monotonic()
            require(remaining > 0, 'METADATA_TIMEOUT')
            for key, _ in selector.select(remaining):
                block = os.read(key.fd, 8192)
                if not block:
                    selector.unregister(key.fileobj)
                    continue
                body.extend(block)
                require(len(body) <= 262144, 'METADATA_BUDGET')
        require(process.wait(timeout=max(0.01, deadline - time.monotonic())) == 0, 'METADATA_FAILED')
        return bytes(body)
    finally:
        selector.close()
        if process is not None:
            try: os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            process.wait(timeout=1)
            process.stdout.close()
            CHILD_GROUPS.discard(process.pid)
        signal.pthread_sigmask(signal.SIG_SETMASK, mask)


def get_nue_units():
    fields = ('LoadState,ActiveState,SubState,MainPID,ExecMainPID,InvocationID,Result,ExecMainCode,'
              'ExecMainStatus,ExecMainStartTimestamp,ExecMainExitTimestamp,FragmentPath,DropInPaths,'
              'NeedDaemonReload,UnitFileState,Persistent,AccuracyUSec,RandomizedDelayUSec,TimersCalendar,'
              'ActiveEnterTimestamp,LastTriggerUSec,Unit')
    units = {}
    for key, unit in (('backup', 'catering-backup.service'), ('timer', 'catering-backup.timer'),
                      ('legacy', 'catering-restore-probe.service')):
        raw = bounded_metadata(['/usr/bin/systemctl', 'show', unit, '--all', '--property=' + fields])
        units[key] = dict(line.split('=', 1) for line in raw.decode().splitlines() if '=' in line)
    raw = bounded_metadata(['/usr/bin/timedatectl', 'show', '--property=NTPSynchronized'])
    units['clock'] = dict(line.split('=', 1) for line in raw.decode().splitlines())
    boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip().replace('-', '')
    require(re.fullmatch('[0-9a-f]{32}', boot), 'BOOT_INVALID')
    # The same trusted PID1/process provenance used by the accepted manual reader
    # survives oneshot garbage collection. No synthetic InvocationID is invented.
    raw = bounded_metadata(['/usr/bin/journalctl', '--quiet', '--no-pager', '--output=json', '--all',
        '--lines=128', '--boot=' + boot, '--since=@' + str(utc_now() - 21600),
        '--output-fields=MESSAGE,MESSAGE_ID,INVOCATION_ID,UNIT,JOB_ID,JOB_TYPE,JOB_RESULT,_PID,_UID,_EXE,_COMM,_TRANSPORT,_BOOT_ID,_SYSTEMD_UNIT,_SYSTEMD_CGROUP,_SYSTEMD_INVOCATION_ID,__REALTIME_TIMESTAMP,__MONOTONIC_TIMESTAMP,__CURSOR',
        'UNIT=catering-backup.service', '+', '_SYSTEMD_UNIT=catering-backup.service'])
    units.update(nue_boot=boot, nue_journal=[json.loads(line) for line in raw.splitlines() if line])
    require(Path('/proc/sys/kernel/random/boot_id').read_text().strip().replace('-', '') == boot, 'BOOT_CHANGED')
    return units


def nue_history(units, now):
    rows = units['nue_journal']
    require(0 < len(rows) < 128, 'JOURNAL_INCOMPLETE')
    cycles, cursors, last_real, last_mono = [], set(), 0, 0
    for row in rows:
        real, mono = int(row['__REALTIME_TIMESTAMP']) / 1000000, int(row['__MONOTONIC_TIMESTAMP'])
        cursor = row['__CURSOR']
        require(row['_BOOT_ID'] == units['nue_boot'] and last_real <= real <= now and
                0 < mono and last_mono <= mono and cursor and cursor not in cursors, 'JOURNAL_ORDER_INVALID')
        last_real, last_mono = real, mono
        cursors.add(cursor)
        if row.get('_PID') == '1':
            require(all(row.get(k) == v for k, v in {'_UID': '0', '_EXE': '/usr/lib/systemd/systemd',
                '_COMM': 'systemd', '_TRANSPORT': 'journal', '_SYSTEMD_UNIT': 'init.scope',
                '_SYSTEMD_CGROUP': '/init.scope', 'UNIT': 'catering-backup.service'}.items()), 'PID1_PROVENANCE_REQUIRED')
            invocation, event = row.get('INVOCATION_ID', ''), row.get('MESSAGE_ID')
            require(re.fullmatch('[0-9a-f]{32}', invocation), 'JOURNAL_INVOCATION_INVALID')
            if event == NUE_START:
                require(not any(c['invocation'] == invocation for c in cycles), 'DUPLICATE_INVOCATION')
                require(row.get('JOB_TYPE') == 'start' and isinstance(row.get('JOB_ID'), str) and row['JOB_ID'].isdigit(), 'JOURNAL_START_INVALID')
                cycles.append(dict(invocation=invocation, created=real, start_mono=mono,
                                   job=row.get('JOB_ID'), failed=False, passed=None, success=None, done=None))
            else:
                if not cycles:
                    continue  # The bounded window may start at the end of an older run.
                require(cycles and cycles[-1]['invocation'] == invocation, 'JOURNAL_START_MISSING')
                cycle = cycles[-1]
                if event == NUE_SUCCESS:
                    require(cycle['passed'] and cycle['success'] is None and cycle['passed_mono'] < mono, 'JOURNAL_PASS_MISSING')
                    cycle.update(success=real, success_mono=mono)
                elif event == NUE_DONE:
                    require(cycle['success'] and cycle['done'] is None and row.get('JOB_ID') == cycle['job'] and
                            row.get('JOB_TYPE') == 'start' and row.get('JOB_RESULT') == 'done' and cycle['success_mono'] <= mono, 'JOURNAL_COMPLETION_INVALID')
                    cycle['done'] = real
                elif event != NUE_RESOURCES:
                    cycle['failed'] = True
        else:
            if not cycles:
                require(row.get('_SYSTEMD_UNIT') == 'catering-backup.service', 'PROCESS_INVOCATION_INVALID')
                continue
            require(cycles and row.get('_SYSTEMD_UNIT') == 'catering-backup.service' and
                    row.get('_SYSTEMD_INVOCATION_ID') == cycles[-1]['invocation'], 'PROCESS_INVOCATION_INVALID')
            try: value = json.loads(row.get('MESSAGE', ''))
            except (TypeError, ValueError): value = None
            if isinstance(value, dict) and value.get('status') == NUE_PASS:
                require(set(value) == {'status', 'runId'} and re.fullmatch('[0-9a-f]{32}', value['runId']) and
                        cycles[-1]['passed'] is None and mono > cycles[-1]['start_mono'] and
                        re.fullmatch('[1-9][0-9]*', row.get('_PID', '')) and all(row.get(k) == v for k, v in {
                        '_UID': '0', '_EXE': '/usr/bin/python3.12', '_COMM': 'python3', '_TRANSPORT': 'stdout',
                        '_SYSTEMD_CGROUP': '/system.slice/catering-backup.service'}.items()), 'PASS_PROVENANCE_REQUIRED')
                cycles[-1].update(passed=real, verified=real, passed_mono=mono, runId=value['runId'], mainPid=row['_PID'])
    require(cycles, 'JOURNAL_START_MISSING')
    return cycles


def nue_service_failure(units, now):
    cycles = nue_history(units, now)
    failure = int(cycles[-1]['created']) if cycles[-1]['failed'] else 0
    unit = units['backup']
    if unit.get('Result') not in ('', 'success') or unit.get('ExecMainStatus') != '0' or unit.get('ActiveState') == 'failed':
        failure = max(failure, int(cycles[-1]['created']))
    return failure


def nue_cycle(units, now):
    cycles = nue_history(units, now)
    latest, unit = cycles[-1], units['backup']
    require(not latest['failed'], 'SERVICE_FAILED')
    if not latest['done']:
        require(unit.get('ActiveState') in ('active', 'activating') and unit.get('InvocationID') == latest['invocation'] and
                unit.get('MainPID', '0').isdigit() and int(unit['MainPID']) > 0 and
                now - latest['created'] <= 6600, 'SERVICE_UNKNOWN')
        require(len(cycles) > 1, 'PUBLICATION_MISSING')
        latest = cycles[-2]
    else:
        require(unit.get('ActiveState') == 'inactive' and unit.get('MainPID') == '0' and
                unit.get('Result') == 'success' and unit.get('ExecMainStatus') == '0' and
                unit.get('InvocationID') in ('', latest['invocation']) and
                unit.get('ExecMainPID') in ('0', latest.get('mainPid')), 'SERVICE_FAILED')
    require(not latest['failed'] and latest['passed'] and latest['done'] and
            0 <= latest['done'] - latest['created'] <= 6600, 'PUBLICATION_MISSING')
    return latest


def nue_proof(records, policy, now, units):
    binding, nue = policy['bindings'], policy['nue']
    require(binding['scope'] == SCOPE and binding['host_binding'] == sha(socket.gethostname().split('.')[0].encode()), 'HOST_BINDING_INVALID')
    cycle = nue_cycle(units, now)
    generation_data = records.read('/etc/catering-backup/nue-generation.json')
    marker = json.loads(generation_data)
    config_data = records.read('/etc/catering-backup/nue-service.json')
    config = json.loads(config_data)
    require(sha(config_data) == marker['configSha256'] and marker['credentialGeneration'] ==
            config['credentialGeneration'] == nue['credentialGeneration'] and config['timerState'] == 'active' and
            config['manifestSha256'] == nue['installedManifestSha256'], 'NUE_GENERATION_CHANGED')
    public_paths = {'/usr/local/libexec/catering-nue-core.py', '/usr/local/libexec/catering-nue-service.py',
        '/usr/local/libexec/catering-backup-common.sh', '/etc/systemd/system/catering-backup.service',
        '/etc/systemd/system/catering-backup.timer', '/usr/local/libexec/catering-backup-observer.py',
        '/etc/cron.d/catering-backup-monitor'}
    require(set(nue['files']) == public_paths - {'/usr/local/libexec/catering-backup-observer.py', '/etc/cron.d/catering-backup-monitor'}, 'NUE_FILE_SCOPE')
    require(set(config['expectedCore']['observerFiles']) == {'/usr/local/libexec/catering-backup-observer.py',
        '/etc/cron.d/catering-backup-monitor', '/etc/catering-backup-monitor/policy.json',
        '/etc/catering-backup-monitor/heartbeat-url'}, 'OBSERVER_FILE_SCOPE')
    for path, expected in {**nue['files'], **config['expectedCore']['observerFiles']}.items():
        require(re.fullmatch('[0-9a-f]{64}', expected) and
                sha(records.read(path, private=path not in public_paths)) == expected, 'NUE_SOURCE_CHANGED')
    for path, expected in nue['files'].items():
        require(config['files'][path] == expected, 'NUE_SOURCE_CHANGED')
    run = cycle['runId']
    root = Path('/var/lib/catering-nue-proof-' + run)
    info = root.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == OWNER_UID and info.st_gid == OWNER_GID and
            stat.S_IMODE(info.st_mode) == 0o700, 'PROTECTION_INVALID')
    documents = {name: json.loads(records.read(root / name)) for name in
        ('service-proof.json', 'capture.json', 'resume.json', 'restore.json', 'capture-cleanup.json', 'restore-cleanup.json', 'original-state.json')}
    result, restored, captured = documents['service-proof.json'], documents['restore.json'], documents['capture.json']
    require(result['serviceInvocation'] == {'id': cycle['invocation'], 'mainPid': cycle['mainPid'],
        'bootId': units['nue_boot'], 'configSha256': marker['configSha256']}, 'MAIN_PROCESS_BINDING')
    require(result['status'] == NUE_PASS and result['runId'] == run and result['installedManifestSha256'] == config['manifestSha256'] and
            result['credentialGeneration'] == config['credentialGeneration'] and
            result['remoteSourceSha256'] == nue['files']['/usr/local/libexec/catering-nue-core.py'], 'NUE_PROOF_BINDING')
    require(captured['status'] == 'CAPTURED_NOT_YET_RESTORED' and captured['runId'] == run and captured['files'] == 16 and
            result['capture']['runId'] == run and result['capture']['sourceResumed'] is True and
            len(result['capture']['files']) == 17 and
            captured['manifestSha256'] == result['manifestSha256'] == result['capture']['manifestSha256'], 'CAPTURE_BINDING')
    require(documents['resume.json'] == {'status': 'ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED', 'runId': run}, 'SOURCE_RESUME_REQUIRED')
    require(restored == result['restore'] and restored['runId'] == run and restored['status'] ==
            'ALL_THREE_DATABASES_GLOBALS_AND_REQUIRED_FILES_IDENTICAL' and restored['databases'] == 3 and
            restored['fileTrees'] == 8 and restored['probeContainerRemoved'] is True and
            restored['manifestSha256'] == result['manifestSha256'] and restored['outerSha256'] == result['outer']['sha256'], 'FULL_RESTORE_REQUIRED')
    require(all(re.fullmatch('[0-9a-f]{64}', value) for value in
                (result['snapshotId'], result['manifestSha256'], result['outer']['sha256'])) and
            type(result['outer']['bytes']) is int and 0 < result['outer']['bytes'] <= 2 * 1024 ** 3 + 16777216, 'OFFHOST_PROOF_FIELDS')
    for phase in ('capture', 'restore'):
        require(documents[phase + '-cleanup.json'] == {'status': 'OWN_TMPFS_UNMOUNTED', 'runId': run, 'phase': phase} and
                not os.path.lexists('/run/catering-nue-' + phase + '-' + run), 'OWNED_CLEANUP_REQUIRED')
    require(result['captureCleanup'] == documents['capture-cleanup.json'] and
            not os.path.lexists('/var/lib/catering-nue-admission-' + run) and
            result['finalHealth']['status'] == 'ORIGINAL_SEVEN_CONTAINERS_POLICIES_DATABASE_SCOPE_AND_HTTPS_HEALTHY', 'FINAL_HEALTH_REQUIRED')
    original, baseline = documents['original-state.json'], config['installedSnapshot']['containers']
    require(len(original) == len(baseline) == 7 and {row['Name'].lstrip('/') for row in original} == set(baseline), 'ORIGINAL_STATE_SCOPE')
    for row in original:
        previous = baseline[row['Name'].lstrip('/')]
        require(row['Id'] == previous['id'] and row['Image'] == previous['image'] and
                row['State'] == {'Running': True} and row['HostConfig']['RestartPolicy'] == previous['restart'], 'ORIGINAL_STATE_BINDING')
    verified = dt.datetime.fromisoformat(result['at'].replace('Z', '+00:00'))
    require(verified.utcoffset() == dt.timedelta(0) and cycle['created'] <= verified.timestamp() <= cycle['verified'] <= now and
            0 <= now - cycle['created'] <= 21600, 'EVIDENCE_AGE_INVALID')
    return cycle['created'], cycle['verified'], attestation_deadline(records, policy, now, cycle['created'] + 21600)


def nue_service_health(units, now, created, verified, previous_failure):
    require(units['clock']['NTPSynchronized'] == 'yes', 'CLOCK_UNSYNCED')
    require(units['legacy'].get('LoadState') == 'not-found' and units['legacy'].get('ActiveState') == 'inactive', 'LEGACY_RESTORE_PRESENT')
    for kind, name in (('backup', 'catering-backup.service'), ('timer', 'catering-backup.timer')):
        unit = units[kind]
        require(unit.get('LoadState') == 'loaded' and unit.get('FragmentPath') == '/etc/systemd/system/' + name and
                unit.get('DropInPaths') == '' and unit.get('NeedDaemonReload') == 'no', 'UNIT_DRIFT')
    timer = units['timer']
    require(timer['ActiveState'] == 'active' and timer['UnitFileState'] == 'enabled' and timer['Persistent'] == 'yes' and
            timer['AccuracyUSec'] == '1min' and timer['RandomizedDelayUSec'] == '0' and
            re.fullmatch(r'\{ OnCalendar=\*-\*-\* 00,03,06,09,12,15,18,21:00:00 UTC ; next_elapse=[^{}]+ \}', timer['TimersCalendar']), 'TIMER_NOT_ARMED')
    cycle = nue_cycle(units, now)
    require((created, verified) == (cycle['created'], cycle['verified']), 'CYCLE_CHANGED')
    require(int(created) > previous_failure, 'FAILURE_LATCHED')
    activated, trigger = epoch(timer['ActiveEnterTimestamp'], True), epoch(timer['LastTriggerUSec'], True)
    require(0 < activated <= now, 'CLOCK_INVALID')
    due = max(now // 10800 * 10800, activated)
    latest = nue_history(units, now)[-1]
    require(0 < trigger <= now and (now <= due + 300 or due <= latest['created'] <= due + 300 and trigger >= due), 'CYCLE_MISSING')
    require(now <= due + 9300 or created >= due and verified <= due + 9300, 'PUBLICATION_MISSING')


def heartbeat_url(value):
    require(all(0x21 <= ord(c) <= 0x7e for c in value), 'TARGET_INVALID')
    parsed = urlsplit(value)
    require(parsed.scheme == 'https' and parsed.netloc in ('uptime.betterstack.com', 'incidents.betterstack.com') and not parsed.query and not parsed.fragment and
            re.fullmatch(r'/api/v1/heartbeat/[A-Za-z0-9_-]+', parsed.path), 'TARGET_INVALID')
    return parsed


def http_send(url, healthy, seconds, cutoff=None):
    target = heartbeat_url(url)
    connection = http.client.HTTPSConnection(target.hostname, timeout=seconds, context=ssl.create_default_context())
    try:
        connection.connect()
        require(not healthy or cutoff is None or utc_now() < cutoff, 'INSUFFICIENT_DETECTION_MARGIN')
        connection.request('GET', target.path + ('' if healthy else '/fail'))
        response = connection.getresponse()
        return response.status == 200
    finally:
        connection.close()


def transmit(url, healthy, seconds, cutoff=None):
    # A child deadline also bounds DNS. The secret travels only through stdin.
    result = subprocess.run([sys.executable, '-I', str(Path(__file__).resolve()), '--transmit'],
                            input=json.dumps([url, healthy, seconds, cutoff]).encode(), stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, env=ENV, timeout=seconds, check=False)
    require(result.returncode != 3, 'PING_WINDOW_CLOSED')
    return result.returncode == 0


def run(policy_path, send=False):
    output = dict(backup_health='unknown', reason='OBSERVER_FAILED', data_epoch=None, observer_run='failed',
                  delivery_accepted=False, recipient_confirmed=False, remote_repository_checked=False)
    records, lock, started = Records(), None, time.monotonic()
    try:
        require(os.geteuid() == OWNER_UID and os.getegid() == OWNER_GID, 'PRIVILEGE_INVALID')
        policy = json.loads(records.read(policy_path))
        require(type(policy['version']) is int and policy['version'] in (1, 2), 'POLICY_VERSION')
        read_units, failed_service, check_health = (get_units, service_failure, service_health) if policy['version'] == 1 else (
            get_nue_units, nue_service_failure, nue_service_health)
        if policy['version'] == 2 and send:
            # The cron can be installed and hash-bound before the first accepted
            # cycle. This separate private latch prevents all premature signals.
            require(policy['state_root'] == '/var/lib/catering-backup-monitor', 'NUE_STATE_ROOT')
            armed = Path(policy['state_root']) / 'armed'
            require(os.path.lexists(armed), 'OBSERVER_NOT_ARMED')
            require(records.read(armed) == b'NUE_OBSERVER_ARMED\n', 'OBSERVER_NOT_ARMED')
        state_root = Path(policy['state_root'])
        backup_root = Path(policy['root'])
        require(state_root != backup_root and state_root not in backup_root.parents and backup_root not in state_root.parents)
        for root in (state_root, backup_root):
            info = root.lstat()
            require(stat.S_ISDIR(info.st_mode) and info.st_uid == OWNER_UID and info.st_gid == OWNER_GID and
                    stat.S_IMODE(info.st_mode) == 0o700, 'PROTECTION_INVALID')
        records.read(state_root / 'lock')
        if send:
            lock_identity = records.generations[str(state_root / 'lock')][1]
            lock = os.open(state_root / 'lock', os.O_RDONLY | os.O_NOFOLLOW)
            require(generation(os.fstat(lock)) == lock_identity, 'GENERATION_CHANGED')
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = records.record(state_root, state_root / 'state', 'observer')
        require(state['status'] == 'observer' and state['backup_health'] in ('unknown', 'healthy', 'warning', 'critical') and
                state['delivery_accepted'] in ('true', 'false'), 'STATE_INVALID')
        now, failure = utc_now(), int(state['failure_epoch'])
        require(now >= int(state['last_seen_epoch']) and 0 <= failure <= now, 'CLOCK_ROLLBACK')
        try:
            units = read_units()
            observed_failure = failed_service(units, now)
            failure = max(failure, observed_failure)
            require(not observed_failure, 'SERVICE_FAILED')
            created, verified, deadline = (proof(records, policy, now) if policy['version'] == 1 else nue_proof(records, policy, now, units))
            output['data_epoch'] = int(created)
            check_health(units, now, created, verified, failure)
            output.update(backup_health='healthy', reason='HEALTHY')
        except Exception as error:
            reason = str(error) if type(error) is ValueError and re.fullmatch(r'[A-Z_]+', str(error)) else 'OBSERVATION_FAILED'
            output.update(backup_health='critical', reason=reason)
        heartbeat = policy['heartbeat']
        require(heartbeat['account_verified'] is True and heartbeat['meaning'] == 'backup_restore_health' and
                heartbeat['id'] and heartbeat['team'], 'ACCOUNT_UNBOUND')
        durations = [heartbeat[key] for key in ('period', 'grace', 'provider_delay', 'escalation_delay', 'clock_margin', 'request_seconds')]
        require(all(type(value) is int and value >= 0 for value in durations) and 30 <= durations[0] <= 21600 and
                1 <= heartbeat['request_seconds'] <= 15 and heartbeat['clock_margin'] >= 1, 'TIMING_UNBOUND')
        url_bytes = records.read(heartbeat['url_file'])
        require(sha(url_bytes) == heartbeat['url_sha256'] and url_bytes.endswith(b'\n'))
        url = url_bytes[:-1].decode('ascii')
        heartbeat_url(url)
        terminal_now = utc_now()
        require(now <= terminal_now and time.monotonic() - started < 95, 'OBSERVER_BUDGET_EXCEEDED')
        if output['backup_health'] == 'healthy' and terminal_now >= deadline - sum(durations):
            output.update(backup_health='warning', reason='INSUFFICIENT_DETECTION_MARGIN')
        records.stable()
        if send:
            # Persist uncertainty BEFORE HTTP; interruption cannot manufacture a recovery.
            publish_state(state_root, terminal_now, failure, output['backup_health'])
            records.generations.pop(str(state_root / 'state'))
            records.stable()
            if output['backup_health'] == 'healthy':
                units = read_units()
                checked_now = utc_now()
                observed_failure = failed_service(units, max(terminal_now, checked_now))
                if observed_failure:
                    failure = max(failure, observed_failure)
                    # Keep the failure and the already published clock mark before aborting.
                    publish_state(state_root, max(terminal_now, checked_now), failure, 'critical')
                    raise ValueError('SERVICE_FAILED')
                check_health(units, checked_now, created, verified, failure)
            terminal_now = utc_now()
            require(now <= terminal_now and time.monotonic() - started < 95, 'OBSERVER_BUDGET_EXCEEDED')
            if output['backup_health'] == 'healthy' and terminal_now >= deadline - sum(durations):
                output.update(backup_health='warning', reason='INSUFFICIENT_DETECTION_MARGIN')
            # Retain the terminal clock observation, including a newly closed ping window.
            publish_state(state_root, terminal_now, failure, output['backup_health'])
            try:
                cutoff = deadline - sum(durations) if output['backup_health'] == 'healthy' else None
                output['delivery_accepted'] = transmit(url, output['backup_health'] == 'healthy', heartbeat['request_seconds'], cutoff) is True
            except Exception as error:
                output['delivery_accepted'] = False
                if type(error) is ValueError and str(error) == 'PING_WINDOW_CLOSED':
                    # The worker observed at least cutoff, even if the parent clock rolls back.
                    publish_state(state_root, max(terminal_now, cutoff), failure, 'warning')
            if not output['delivery_accepted']:
                output['reason'] = 'DELIVERY_FAILED'
        output['observer_run'] = 'completed'
    except Exception as error:
        reason = str(error) if type(error) is ValueError and re.fullmatch(r'[A-Z_]+', str(error)) else 'OBSERVER_FAILED'
        output.update(backup_health='unknown', reason=reason, delivery_accepted=False)
    finally:
        if lock is not None:
            os.close(lock)
    return output


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, terminate_children)
    signal.signal(signal.SIGINT, terminate_children)
    if sys.argv[1:] == ['--transmit']:
        try:
            sys.exit(0 if http_send(*json.loads(sys.stdin.buffer.read(4096))) else 1)
        except Exception as error:
            if type(error) is ValueError and str(error) == 'INSUFFICIENT_DETECTION_MARGIN':
                sys.exit(3)
            sys.exit(1)
    require(sys.argv[1:] in ([], ['--check']), 'ARGUMENT_INVALID')
    outcome = run('/etc/catering-backup-monitor/policy.json', send=not sys.argv[1:])
    print(json.dumps(outcome, sort_keys=True))
    sys.exit(0 if outcome['backup_health'] == 'healthy' and (sys.argv[1:] or outcome['delivery_accepted']) else 1)
