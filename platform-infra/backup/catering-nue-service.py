#!/usr/bin/python3
"""Server-local orchestration of the reviewed NUE full backup and restore proof."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import selectors
import signal
import stat
import subprocess
import sys
import time
import uuid

CONFIG = Path('/etc/catering-backup/nue-service.json')
GENERATION = Path('/etc/catering-backup/nue-generation.json')
CORE = Path('/usr/local/libexec/catering-nue-core.py')
SERVICE = Path('/etc/systemd/system/catering-backup.service')
TIMER = Path('/etc/systemd/system/catering-backup.timer')
RESTIC = Path('/usr/local/bin/restic')
HELPER_SHA = '60bfadf8c6f70cdc11c67723156845c4303df96d86df9d49e19028923bb91eee'
COMMON_SHA = '67741391dbabedef7508c7fe9855f943761ead6eda879420cc9c7a81e60608de'
SNAPSHOT_PATH = '/catering-nue-proof.tar'
STREAM_LIMIT = 2 * 1024 ** 3 + 16777216
BASE_ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC', 'HOME': '/root'}
CREDENTIAL_KEYS = {'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'}


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def fingerprint(info):
    return tuple(getattr(info, key) for key in ('st_dev', 'st_ino', 'st_mode', 'st_uid', 'st_gid', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns'))


def protected(path, expected=None, private=False, maximum=16777216):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path, 'PROTECTED_PATH')
    for parent in path.parents:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022, 'PROTECTED_PARENT')
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0 and before.st_nlink == 1 and
            not before.st_mode & 0o022 and before.st_size <= maximum, 'PROTECTED_FILE')
    require(not private or stat.S_IMODE(before.st_mode) == 0o600, 'PRIVATE_FILE_MODE')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as source:
        require(fingerprint(os.fstat(source.fileno())) == fingerprint(before), 'PROTECTED_REPLACED')
        body = source.read(maximum + 1)
        require(len(body) == before.st_size and fingerprint(os.fstat(source.fileno())) == fingerprint(before) == fingerprint(path.lstat()), 'PROTECTED_CHANGED')
    require(expected is None or sha(body) == expected, 'PROTECTED_HASH')
    return body, fingerprint(before)


def protected_binding(path, expected, private=False):
    # The official Restic executable exceeds the record/config reader's 16 MiB
    # limit. Only this fixed binary path gets a larger, still hash-bound budget.
    if Path(path) == RESTIC:
        return protected(path, expected, private=private, maximum=64 * 1024 ** 2)
    return protected(path, expected, private=private)


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def same_mount_namespace():
    require(os.path.samestat(os.stat('/proc/self/ns/mnt'), os.stat('/proc/1/ns/mnt')), 'HOST_MOUNT_NAMESPACE_REQUIRED')


def properties(unit):
    raw = subprocess.run(['/usr/bin/systemctl', 'show', unit, '--no-pager'], env=BASE_ENV,
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20)
    require(raw.returncode == 0 and len(raw.stdout) <= 262144, 'SYSTEMD_SHOW_FAILED')
    return dict(line.split('=', 1) for line in raw.stdout.decode().splitlines() if '=' in line)


def scheduler_admission(config, get_properties=properties):
    """The exception belongs to this actual MainPID, never an exported InvocationID alone."""
    own = get_properties('catering-backup.service')
    invocation = own.get('InvocationID', '')
    require(re.fullmatch('[0-9a-f]{32}', invocation or '') and invocation == os.environ.get('INVOCATION_ID'), 'FOREIGN_INVOCATION')
    require(own.get('MainPID') == str(os.getpid()) and own.get('ActiveState') == 'activating' and own.get('SubState') == 'start', 'SERVICE_MAINPID_REQUIRED')
    require(own.get('FragmentPath') == str(SERVICE) and own.get('DropInPaths') == '' and own.get('NeedDaemonReload') == 'no', 'SERVICE_UNIT_DRIFT')
    required_properties = {'Type': 'oneshot', 'User': 'root', 'KillMode': 'mixed', 'NoNewPrivileges': 'yes', 'UMask': '0077'}
    require(all(own.get(k) == v for k, v in required_properties.items()), 'SERVICE_PROPERTIES_DRIFT')
    cgroup = own.get('ControlGroup', '')
    require(cgroup == '/system.slice/catering-backup.service', 'SERVICE_CGROUP')
    groups = Path('/proc/self/cgroup').read_text().splitlines()
    require('0::' + cgroup in groups, 'PROCESS_OUTSIDE_SERVICE')
    require(os.stat('/proc/self/exe') == os.stat('/proc/' + own['MainPID'] + '/exe'), 'SERVICE_PROCESS_MISMATCH')
    timer = get_properties('catering-backup.timer')
    require(timer.get('FragmentPath') == str(TIMER) and timer.get('DropInPaths') == '' and timer.get('NeedDaemonReload') == 'no', 'TIMER_UNIT_DRIFT')
    require(config['timerState'] in ('inactive', 'active') and timer.get('ActiveState') == config['timerState'], 'TIMER_STATE_DRIFT')
    require(timer.get('Unit') == 'catering-backup.service', 'TIMER_TARGET_DRIFT')
    legacy = get_properties('catering-restore-probe.service')
    require(legacy.get('LoadState') == 'not-found' and legacy.get('ActiveState') == 'inactive', 'LEGACY_RESTORE_UNIT_PRESENT')
    raw = subprocess.run(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend', 'catering-*backup*', 'catering-*restore*'], env=BASE_ENV, capture_output=True, timeout=20)
    require(raw.returncode == 0 and len(raw.stdout) <= 65536, 'SCHEDULER_INVENTORY_FAILED')
    units = {line.split()[0] for line in raw.stdout.decode().splitlines() if line.split()}
    require(units <= {'catering-backup.service', 'catering-backup.timer', 'catering-restore-probe.service'}, 'UNKNOWN_BACKUP_UNIT')
    files = subprocess.run(['/usr/bin/systemctl', 'list-unit-files', '--no-legend', 'catering-*backup*', 'catering-*restore*'], env=BASE_ENV, capture_output=True, timeout=20)
    require(files.returncode == 0 and len(files.stdout) <= 65536, 'SCHEDULER_INVENTORY_FAILED')
    require({line.split()[0] for line in files.stdout.decode().splitlines() if line.split()} <=
            {'catering-backup.service', 'catering-backup.timer'}, 'UNKNOWN_BACKUP_UNIT_FILE')


class DeadlineReader:
    """Bound an untrusted repository stream before the core's strict tar parser reads it."""
    def __init__(self, child, timeout, maximum):
        self.child = child
        self.deadline = time.monotonic() + timeout
        self.maximum = maximum
        self.count = 0

    def read(self, size):
        remaining = self.deadline - time.monotonic()
        require(remaining > 0, 'STREAM_DEADLINE')
        with selectors.DefaultSelector() as selector:
            selector.register(self.child.stdout, selectors.EVENT_READ)
            require(selector.select(remaining), 'STREAM_DEADLINE')
        block = os.read(self.child.stdout.fileno(), min(size, 131072))
        self.count += len(block)
        require(self.count <= self.maximum, 'STREAM_BYTE_BUDGET')
        return block


def wait_child_exit(child, timeout):
    """Observe exit without releasing the PID that anchors our process group."""
    require(child.returncode is None, 'CHILD_GROUP_ANCHOR_LOST')
    deadline = time.monotonic() + timeout
    while True:
        result = os.waitid(os.P_PID, child.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if result is not None:
            return result.si_status if result.si_code == os.CLD_EXITED else -result.si_status
        require(time.monotonic() < deadline, 'CHILD_EXIT_DEADLINE')
        time.sleep(min(0.05, max(0, deadline - time.monotonic())))


def group_live(child):
    # An unreaped direct child reserves this PID even after exit. Never signal a
    # numeric group after another caller has released that ownership anchor.
    require(child.returncode is None, 'CHILD_GROUP_ANCHOR_LOST')
    os.waitid(os.P_PID, child.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
    result = subprocess.run(['/bin/ps', '-axo', 'pid=,pgid=,stat='], env=BASE_ENV,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5)
    require(result.returncode == 0 and len(result.stdout) <= 1048576, 'CHILD_GROUP_INSPECTION_HOLD')
    rows = [line.split() for line in result.stdout.decode('ascii').splitlines()]
    require(all(len(row) == 3 and row[0].isdigit() and row[1].isdigit() for row in rows), 'CHILD_GROUP_INSPECTION_HOLD')
    return any(int(row[1]) == child.pid and not row[2].startswith('Z') for row in rows)


def reap(child, term_timeout=15, kill_timeout=15):
    if child is None:
        return
    try:
        require(child.returncode is None, 'CHILD_GROUP_ANCHOR_LOST')
        # The leader may already have exited successfully while a producer still
        # owns the group. Keep that leader unreaped through both signal phases.
        for signum, timeout in ((signal.SIGTERM, term_timeout), (signal.SIGKILL, kill_timeout)):
            if not group_live(child):
                break
            os.killpg(child.pid, signum)
            deadline = time.monotonic() + timeout
            while group_live(child):
                if time.monotonic() >= deadline:
                    break
                time.sleep(min(0.1, max(0, deadline - time.monotonic())))
        require(not group_live(child), 'OWNED_PROCESS_GROUP_SURVIVES_HOLD')
        child.wait(timeout=5)
    finally:
        if child.stdout is not None:
            child.stdout.close()


class Job:
    def __init__(self):
        require(os.geteuid() == 0, 'ROOT_REQUIRED')
        same_mount_namespace()
        generation, self.generation_identity = protected(GENERATION, private=True)
        marker = json.loads(generation)
        require(set(marker) == {'configSha256', 'credentialGeneration'}, 'GENERATION_SHAPE')
        body, self.config_identity = protected(CONFIG, marker['configSha256'], private=True)
        self.config = json.loads(body)
        self.marker = marker
        require(self.config['credentialGeneration'] == marker['credentialGeneration'] and
                re.fullmatch('[A-Za-z0-9_-]{1,64}', marker['credentialGeneration']), 'CREDENTIAL_GENERATION')
        self.bindings = self.config['files']
        self.identities = {}
        require(self.config['version'] == 1, 'CONFIG_VERSION')
        self.bundle = Path('/opt/catering-nue-image-updates') / self.config['manifestSha256']
        require(re.fullmatch('[0-9a-f]{64}', self.config['manifestSha256']), 'MANIFEST_PIN')
        self.helper = self.bundle / 'tools/catering_target_nue_image_update.py'
        required = {str(CORE), str(Path(__file__).resolve()), str(SERVICE), str(TIMER), str(RESTIC), str(self.helper),
                    str(self.bundle / 'manifest.json'), '/etc/catering-target/runtime.env',
                    self.config['commonPath'], self.config['offhostPath'], self.config['recoveryPath'],
                    self.config['credentialsPath'], self.config['passwordPath']}
        require(set(self.bindings) == required, 'FILE_BINDING_SET')
        require(self.bindings[str(self.helper)] == HELPER_SHA and self.bindings[self.config['commonPath']] == COMMON_SHA and
                self.bindings[str(self.bundle / 'manifest.json')] == self.config['manifestSha256'], 'REVIEWED_SOURCE_PIN')
        for path, expected in self.bindings.items():
            require(re.fullmatch('[0-9a-f]{64}', expected), 'FILE_DIGEST')
            _, self.identities[path] = protected_binding(path, expected, private=path in (self.config['credentialsPath'], self.config['passwordPath']))
        self.installed = load_module('catering_nue_installed', self.helper)
        self.core = load_module('catering_nue_core', CORE)
        self.core.SCHEDULER_GATE = self.scheduler_gate
        self.expected = self.config['expectedCore']
        require(self.expected['runtimeEnvSha256'] == self.bindings['/etc/catering-target/runtime.env'], 'RUNTIME_ENV_PIN')
        self.run_id = uuid.uuid4().hex
        self.admission = Path('/var/lib/catering-nue-admission-' + self.run_id)
        self.admission_files = {}
        self.scheduler_gate()

    def immutable(self):
        require(protected(GENERATION, private=True)[1] == self.generation_identity, 'GENERATION_CHANGED')
        require(protected(CONFIG, self.marker['configSha256'], private=True)[1] == self.config_identity, 'CONFIG_CHANGED')
        for path, expected in self.bindings.items():
            require(protected_binding(path, expected)[1] == self.identities[path], 'BOUND_GENERATION_CHANGED')

    def scheduler_gate(self):
        same_mount_namespace()
        self.immutable()
        scheduler_admission(self.config)
        require(self.installed.snapshot() == self.config['installedSnapshot'], 'INSTALLED_BASELINE_DRIFT')

    def gate(self):
        self.scheduler_gate()
        self.core.assert_host()
        self.check_restic()
        require(not os.path.lexists(self.core.LOCK), 'FOREIGN_UPDATE_LOCK')
        raw = subprocess.run(['/usr/bin/python3', '-B', '-I', str(self.helper), 'verify', '--bundle-dir', str(self.bundle),
                              '--manifest-sha256', self.config['manifestSha256']], env=BASE_ENV, capture_output=True, timeout=180)
        require(raw.returncode == 0 and len(raw.stdout) <= 262144, 'INSTALLED_RELEASE_VERIFY_FAILED')
        require(json.loads(raw.stdout) == {'status': 'NUE_IMAGE_ONLY_VERIFIED', 'observerInstalled': False,
                                          'automaticBackupRestoreChainAccepted': False}, 'INSTALLED_VERIFY_RECEIPT')
        self.immutable()
        self.core.assert_current(self.expected)
        self.validate_attestations()

    def check_restic(self):
        version = subprocess.run([str(RESTIC), 'version'], env=BASE_ENV, capture_output=True, timeout=20)
        require(version.returncode == 0 and len(version.stdout) <= 65536 and
                re.fullmatch(rb'restic 0\.19\.0 compiled with [^\r\n]+ on linux/amd64\n?', version.stdout), 'RESTIC_VERSION_REQUIRED')
        help_result = subprocess.run([str(RESTIC), 'backup', '--help'], env=BASE_ENV, capture_output=True, timeout=20)
        require(help_result.returncode == 0 and len(help_result.stdout) <= 262144 and
                b'--stdin-from-command' in help_result.stdout, 'RESTIC_PRODUCER_EXIT_SUPPORT_REQUIRED')
        self.immutable()

    def validate_attestations(self):
        parameters = self.config['parameters']
        allowed = {
            'CATERING_BACKUP_REPOSITORY_VALUE', 'CATERING_BACKUP_EXPECTED_REPOSITORY_ID',
            'CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256', 'CATERING_BACKUP_PRODUCTION_HOST_SHA256',
            'CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256', 'CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES',
            'CATERING_REQUIRED_SECRET_SCHEMA_SHA256', 'CATERING_SECRET_RECOVERY_SOURCE_TYPE',
            'CATERING_SECRET_RECOVERY_SOURCE_REFERENCE', 'CATERING_SECRET_RECOVERY_REFERENCE_SHA256'}
        require(set(parameters) == allowed and all(isinstance(v, str) and '\x00' not in v for v in parameters.values()), 'ADMISSION_PARAMETERS_INVALID')
        import socket
        host_hash = sha(socket.gethostname().encode())
        require(parameters['CATERING_BACKUP_PRODUCTION_HOST_SHA256'] == host_hash, 'ADMISSION_TARGET_MISMATCH')
        attestation_root = Path(self.config['offhostPath']).parent
        require(attestation_root == Path(self.config['recoveryPath']).parent, 'ATTESTATION_GENERATION_DIRECTORY')
        env = {**BASE_ENV, **parameters, 'CATERING_BACKUP_ROOT': str(attestation_root),
               'CATERING_OFFHOST_ATTESTATION_FILE': self.config['offhostPath'],
               'CATERING_SECRET_RECOVERY_ATTESTATION_FILE': self.config['recoveryPath'],
               'CATERING_OFFHOST_ATTESTATION_SHA256': self.bindings[self.config['offhostPath']],
               'CATERING_SECRET_RECOVERY_ATTESTATION_SHA256': self.bindings[self.config['recoveryPath']]}
        script = 'source "$1"; validate_operator_attestations "$CATERING_BACKUP_EXPECTED_REPOSITORY_ID" "$2" "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" "" "$2" "" "" 21600'
        result = subprocess.run(['/bin/bash', '-c', script, 'catering-nue-admission', self.config['commonPath'], host_hash],
                                env=env, capture_output=True, timeout=45)
        require(result.returncode == 0, 'CURRENT_OFFHOST_OR_RECOVERY_ADMISSION_FAILED')
        self.immutable()

    def restic_child(self, arguments):
        self.immutable()
        credentials = json.loads(protected(self.config['credentialsPath'], self.bindings[self.config['credentialsPath']], private=True)[0])
        require(set(credentials) == CREDENTIAL_KEYS and all(isinstance(v, str) and v and '\x00' not in v for v in credentials.values()), 'CREDENTIAL_ALLOWLIST')
        password = protected(self.config['passwordPath'], self.bindings[self.config['passwordPath']], private=True, maximum=4096)[0].strip()
        require(password and len(password) <= 4096 and b'\n' not in password and b'\x00' not in password, 'PASSWORD_FORMAT')
        read_fd, write_fd = os.pipe()
        try:
            os.write(write_fd, password + b'\n')
            os.close(write_fd)
            write_fd = None
            env = {**BASE_ENV, **credentials, 'RESTIC_REPOSITORY': self.config['parameters']['CATERING_BACKUP_REPOSITORY_VALUE'],
                   'RESTIC_PASSWORD_FILE': '/dev/fd/' + str(read_fd)}
            return subprocess.Popen([str(RESTIC), '--no-cache', *arguments], env=env, pass_fds=(read_fd,),
                                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                    start_new_session=True)
        finally:
            os.close(read_fd)
            if write_fd is not None:
                os.close(write_fd)

    def restic(self, arguments, timeout=600):
        child = self.restic_child(arguments)
        try:
            reader = DeadlineReader(child, timeout, 8388608)
            chunks = []
            while True:
                block = reader.read(131072)
                if not block:
                    break
                chunks.append(block)
            require(wait_child_exit(child, 15) == 0, 'RESTIC_FAILED')
            return b''.join(chunks)
        finally:
            reap(child)

    def check_repository(self):
        result = json.loads(self.restic(['--no-lock', 'cat', 'config'], timeout=60))
        require(result['id'] == self.config['parameters']['CATERING_BACKUP_EXPECTED_REPOSITORY_ID'], 'REPOSITORY_ID_CHANGED')

    def stage_admission(self):
        self.gate()
        self.check_repository()
        self.scheduler_gate()
        require(not os.path.lexists(self.core.LOCK), 'FOREIGN_UPDATE_LOCK')
        self.admission.mkdir(mode=0o700)
        bodies = {'common.sh': protected(self.config['commonPath'], COMMON_SHA)[0],
                  'offhost': protected(self.config['offhostPath'], self.bindings[self.config['offhostPath']])[0],
                  'recovery': protected(self.config['recoveryPath'], self.bindings[self.config['recoveryPath']])[0],
                  'parameters.json': (json.dumps(self.config['parameters'], sort_keys=True) + '\n').encode()}
        for name, body in bodies.items():
            fd = os.open(self.admission / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as target:
                target.write(body)
                target.flush()
                os.fsync(target.fileno())
            self.admission_files[name] = sha(body)
        self.expected = {**self.expected, 'admissionDirectory': str(self.admission), 'admissionFiles': self.admission_files}
        self.core.validate_admission(self.expected, self.run_id)

    def transfer_restore(self, capture):
        require(capture['runId'] == self.run_id and capture['sourceResumed'] is True, 'CAPTURE_RESPONSE')
        self.gate()
        manifest = capture['manifestSha256']
        outer = self.core.stream_capture(self.run_id, manifest, True)
        raw = self.restic(['backup', '--json', '--host', 'catering-prod-02', '--tag', 'nue-proof-' + self.run_id,
                           '--stdin-filename', SNAPSHOT_PATH, '--stdin-from-command', '--', '/usr/bin/python3', '-B', '-I',
                           str(CORE), 'stream', self.run_id, manifest], timeout=1800)
        summaries = [json.loads(line) for line in raw.splitlines() if line and json.loads(line).get('message_type') == 'summary']
        require(len(summaries) == 1, 'SNAPSHOT_SUMMARY')
        snapshot = summaries[0].get('snapshot_id', '')
        require(re.fullmatch('[0-9a-f]{64}', snapshot), 'SNAPSHOT_ID')
        self.gate()
        self.check_repository()
        child = self.restic_child(['dump', snapshot, SNAPSHOT_PATH])
        try:
            reader = DeadlineReader(child, 600, STREAM_LIMIT)
            value = hashlib.sha256()
            while True:
                block = reader.read(131072)
                if not block:
                    break
                value.update(block)
            require(wait_child_exit(child, 15) == 0, 'RESTIC_READBACK_FAILED')
            require({'sha256': value.hexdigest(), 'bytes': reader.count} == outer, 'OFFHOST_READBACK_MISMATCH')
        finally:
            reap(child)
        self.gate()
        child = self.restic_child(['dump', snapshot, SNAPSHOT_PATH])
        try:
            result = self.core.restore_from_offhost(self.run_id, outer['sha256'], manifest, DeadlineReader(child, 1200, STREAM_LIMIT))
            require(wait_child_exit(child, 15) == 0, 'RESTIC_RESTORE_STREAM_FAILED')
        finally:
            reap(child)
        require(result['status'] == 'ALL_THREE_DATABASES_GLOBALS_AND_REQUIRED_FILES_IDENTICAL' and result['runId'] == self.run_id and result['probeContainerRemoved'], 'RESTORE_RESPONSE')
        cleanup = self.core.cleanup_workspace(self.run_id, 'capture')
        self.gate()
        health = self.core.verify_final(self.expected)
        proof = {'status': 'FULL_BACKUP_OFFHOST_READBACK_RESTORE_CLEANUP_PASS', 'runId': self.run_id,
                 'manifestSha256': manifest, 'installedManifestSha256': self.config['manifestSha256'],
                 'snapshotId': snapshot, 'credentialGeneration': self.config['credentialGeneration'], 'outer': outer,
                 'restore': result, 'capture': capture, 'captureCleanup': cleanup, 'finalHealth': health,
                 'remoteSourceSha256': self.bindings[str(CORE)],
                 'at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        self.core.put(self.core.paths(self.run_id, 'capture')[1] / 'service-proof.json', proof)
        return proof

    def cleanup_admission(self):
        if not os.path.lexists(self.admission):
            return
        require(self.admission.resolve(strict=True) == self.admission and self.admission.stat().st_uid == 0 and
                set(p.name for p in self.admission.iterdir()) == set(self.admission_files), 'ADMISSION_CLEANUP_HOLD')
        for name, expected in self.admission_files.items():
            protected(self.admission / name, expected, private=True)
        for name in self.admission_files:
            (self.admission / name).unlink()
        self.admission.rmdir()

    def run(self):
        previous = {kind: signal.signal(kind, self.interrupted) for kind in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT, signal.SIGALRM)}
        signal.alarm(5400)
        try:
            self.stage_admission()
            capture = self.core.capture(self.expected, self.run_id)
            return self.transfer_restore(capture)
        except BaseException:
            # Capture owns resume and its guard. Never infer recovery from a killed process.
            signal.alarm(0)
            self.core.RECOVERING = True
            try:
                self.core.cleanup_after_failure(self.run_id)
            except BaseException:
                print('OWNED_RECOVERY_HOLD run=' + self.run_id, file=sys.stderr)
            raise
        finally:
            signal.alarm(0)
            self.core.RECOVERING = True
            try:
                self.cleanup_admission()
            finally:
                self.core.RECOVERING = False
                for kind, handler in previous.items():
                    signal.signal(kind, handler)

    def interrupted(self, signum, frame):
        signal.alarm(0)
        if not self.core.RECOVERING:
            raise RuntimeError('JOB_INTERRUPTED')


def main():
    os.umask(0o077)
    os.environ.clear()
    # INVOCATION_ID is copied before environment sanitization by the entry point.
    os.environ.update(BASE_ENV)
    os.environ['INVOCATION_ID'] = INVOCATION
    try:
        job = Job()
        proof = job.run()
        print(json.dumps({'status': proof['status'], 'runId': job.run_id}, sort_keys=True))
        return 0
    except BaseException:
        # Exception details, command output and configuration may contain credentials.
        print('NUE_FULL_BACKUP_HOLD', file=sys.stderr)
        return 1


if __name__ == '__main__':
    INVOCATION = os.environ.get('INVOCATION_ID', '')
    raise SystemExit(main())
