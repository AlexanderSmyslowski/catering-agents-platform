"""Synthetic observer contracts; all service and HTTP boundaries are simulated."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sys
import tempfile
import subprocess
import unittest
from unittest import mock
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / 'platform-infra/backup/catering-backup-observer.py'
NOW = 1789286400
SCOPE = 'postgres-full,sites,platform-caddy,catering-edge-caddy'
COMPONENTS = ['sites', 'platform_caddy_data', 'platform_caddy_config', 'catering_edge_caddyfile', 'catering_edge_caddy_data', 'catering_edge_caddy_config']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def stamp(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def system_stamp(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).strftime('%a %Y-%m-%d %H:%M:%S UTC') if epoch else ''


class ObserverContracts(unittest.TestCase):
    def setUp(self):
        self.assertTrue(ENTRY.is_file(), 'The real observer entrypoint is not implemented yet')
        spec = importlib.util.spec_from_file_location('catering_observer', ENTRY)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.temp = tempfile.TemporaryDirectory(prefix='catering-observer-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.root, self.state = self.base / 'backup', self.base / 'monitor'
        for directory in [self.root, self.root / 'snapshots', self.root / 'restore-receipts', self.root / 'candidates', self.state]:
            directory.mkdir(mode=0o700)
        self.created = NOW - 1000
        self.binding = dict(scope=SCOPE, host_binding=digest(b'fixture-host'), source_commit='a' * 40,
                            source_tree='b' * 40, repository_identity='c' * 64,
                            secret_recovery_reference_sha256=digest(b'offline_vault:/synthetic/vault'),
                            restore_postgres_image='postgres@sha256:' + 'e' * 64)
        self.artifact_path = self.root / 'snapshots/artifact-1'
        self.receipt_path = self.root / 'restore-receipts/receipt-1'
        self.artifact = dict(status='artifact', **{k: v for k, v in self.binding.items() if k != 'repository_identity'},
                             bundle_path='catering-backup-stream-1', bundle_checksum='f' * 64,
                             manifest_path='manifest', manifest_checksum='1' * 64,
                             postgres_dump_path='postgres_dump', component_postgres_dump_checksum='2' * 64,
                             component_caddy_stream_checksum='f' * 64,
                             **{'component_' + k + '_checksum': '4' * 64 for k in COMPONENTS})
        artifact_hash = self.write_record(self.artifact_path, self.artifact)
        self.receipt = dict(status='restore-receipt', version='1', scope=SCOPE,
                            host_binding=self.binding['host_binding'], snapshot_id='5' * 64,
                            repository_identity=self.binding['repository_identity'], artifact_path=str(self.artifact_path),
                            artifact_checksum=artifact_hash, verified_at=stamp(NOW - 800),
                            **{k: self.artifact[k] for k in ['bundle_path', 'bundle_checksum', 'manifest_path', 'manifest_checksum',
                                'secret_recovery_reference_sha256', 'restore_postgres_image']},
                            **{'component_' + k + '_checksum': '4' * 64 for k in COMPONENTS})
        receipt_hash = self.write_record(self.receipt_path, self.receipt)
        self.evidence = dict(status='success', project='catering-agents-platform', scope=SCOPE,
                             host_binding=self.binding['host_binding'], created_at=stamp(self.created), snapshot_id='5' * 64,
                             checksum=artifact_hash, artifact_path=str(self.artifact_path), artifact_snapshot_id='5' * 64,
                             artifact_checksum=artifact_hash, artifact_host_binding=self.binding['host_binding'],
                             artifact_scope=SCOPE, artifact_created_at=stamp(self.created),
                             repository_identity=self.binding['repository_identity'], repository_status='read-only-verified',
                             receipt_path=str(self.receipt_path), receipt_checksum=receipt_hash,
                             secret_recovery_reference_sha256=self.binding['secret_recovery_reference_sha256'],
                             restore_postgres_image=self.binding['restore_postgres_image'], duration_seconds='200',
                             **{'component_' + k + '_checksum': '4' * 64 for k in COMPONENTS})
        self.write_record(self.root / 'catering-backup-evidence', self.evidence)
        self.write_record(self.root / 'catering-backup-repository-status', dict(status='read-only-verified',
                          identity=self.binding['repository_identity'], host_binding=self.binding['host_binding'], scope=SCOPE,
                          verified_at=stamp(NOW - 800)))
        self.policy = dict(version=1, root=str(self.root), state_root=str(self.state), bindings=self.binding,
                           attestations={}, heartbeat=dict(id='synthetic-1', team='synthetic-team',
                           meaning='backup_restore_health', account_verified=True, period=300, grace=60,
                           provider_delay=30, escalation_delay=0, clock_margin=30, request_seconds=15,
                           url_file=str(self.base / 'heartbeat-url'), url_sha256=digest(b'https://uptime.betterstack.com/api/v1/heartbeat/SYNTHETIC_SECRET\n')))
        for kind in ['offhost', 'secret']:
            fields = dict(status='operator_attested', repository_identity=self.binding['repository_identity'],
                          host_binding=self.binding['host_binding'], scope=SCOPE)
            if kind == 'offhost':
                fields.update(locator_digest='6' * 64, endpoint_host='storage.example', resolved_addresses_digest='7' * 64,
                              production_addresses='192.0.2.10', production_external_addresses='192.0.2.10',
                              production_addresses_digest='8' * 64, production_host_binding=self.binding['host_binding'])
            else:
                fields.update(source_type='offline_vault', source_reference='offline_vault:/synthetic/vault',
                              source_reference_digest=self.binding['secret_recovery_reference_sha256'], required_secret_schema_digest=digest(b'operator-secret-schema-v2|restic_encryption_password,offhost_repository_access,POSTGRES_PASSWORD,CATERING_TRUSTED_ACTOR_SECRET,CATERING_BASIC_AUTH_PASSWORD_HASH'))
            value = dict(fields, verified_at=stamp(NOW - 86400), valid_until=stamp(NOW + 86400 * 20), attestation_id=digest(kind.encode()))
            path = self.root / (kind + '-attestation')
            self.policy['attestations'][kind] = dict(path=str(path), sha256=self.write_record(path, value), fields=fields)
        self.write(self.base / 'heartbeat-url', b'https://uptime.betterstack.com/api/v1/heartbeat/SYNTHETIC_SECRET\n')
        self.write_record(self.state / 'state', dict(status='observer', last_seen_epoch='0', failure_epoch='0',
                          delivery_accepted='false', backup_health='unknown'))
        self.write(self.state / 'lock', b'')
        self.policy_path = self.base / 'policy.json'
        self.save_policy()
        unit = dict(ActiveState='inactive', Result='success', ExecMainStatus='0', ExecMainCode='1',
                    InvocationID='a' * 32, ExecMainStartTimestamp=system_stamp(NOW - 1000),
                    ExecMainExitTimestamp=system_stamp(NOW - 900))
        self.units = {'backup': dict(unit), 'restore': dict(unit, InvocationID='b' * 32,
                      ExecMainStartTimestamp=system_stamp(NOW - 900), ExecMainExitTimestamp=system_stamp(NOW - 800)),
                      'timer': dict(ActiveState='active', UnitFileState='enabled', Persistent='yes',
                      AccuracyUSec='1min', RandomizedDelayUSec='0', TimersCalendar='{ OnCalendar=*-*-* 00,03,06,09,12,15,18,21:00:00 UTC ; next_elapse=synthetic }',
                      ActiveEnterTimestamp=system_stamp(NOW - 1000), LastTriggerUSec=system_stamp(NOW - 1000)),
                      'clock': {'NTPSynchronized': 'yes'}}
        for patch in [mock.patch.object(self.module, 'OWNER_UID', os.getuid()),
                      mock.patch.object(self.module, 'OWNER_GID', os.getgid()),
                      mock.patch.object(self.module, 'utc_now', lambda: NOW),
                      mock.patch.object(self.module, 'get_units', lambda: self.units),
                      mock.patch.object(socket, 'gethostname', lambda: 'fixture-host')]:
            patch.start()
            self.addCleanup(patch.stop)

    def write(self, path, value):
        path.write_bytes(value)
        path.chmod(0o600)

    def write_record(self, path, record):
        data = ''.join(k + '=' + str(v) + '\n' for k, v in record.items()).encode()
        self.write(path, data)
        return digest(data)

    def save_policy(self):
        self.write(self.policy_path, (json.dumps(self.policy) + '\n').encode())

    def rebind_artifact(self):
        checksum = self.write_record(self.artifact_path, self.artifact)
        self.receipt['artifact_checksum'] = checksum
        self.evidence.update(checksum=checksum, artifact_checksum=checksum,
                             receipt_checksum=self.write_record(self.receipt_path, self.receipt))
        self.write_record(self.root / 'catering-backup-evidence', self.evidence)

    def check(self, send=False):
        before = {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        output = self.module.run(str(self.policy_path), send=send)
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()})
        self.assertFalse(output['remote_repository_checked'])
        self.assertNotIn('SYNTHETIC_SECRET', json.dumps(output))
        return output

    def test_complete_proof_is_healthy_without_transport(self):
        outcome = self.check()
        self.assertEqual(outcome['backup_health'], 'healthy')
        self.assertFalse(outcome['delivery_accepted'])
        self.assertEqual(outcome['data_epoch'], self.created)

    def monitor_snapshot(self):
        return {str(p): (p.read_bytes(), self.module.generation(p.stat()))
                for p in self.base.rglob('*') if p.is_file()}

    def test_check_with_held_observer_lock_is_healthy_and_changes_no_records(self):
        before = self.monitor_snapshot()
        with (self.state / 'lock').open('rb') as lock:
            self.module.fcntl.flock(lock, self.module.fcntl.LOCK_EX)
            with mock.patch.object(self.module, 'transmit', side_effect=AssertionError('check must not send')):
                outcome = self.check()
        self.assertEqual(outcome['backup_health'], 'healthy')
        self.assertEqual(outcome['observer_run'], 'completed')
        self.assertFalse(outcome['delivery_accepted'])
        self.assertEqual(self.monitor_snapshot(), before)

    def test_check_does_not_acquire_any_flock(self):
        flock = self.module.fcntl.flock
        with mock.patch.object(self.module.fcntl, 'flock', wraps=flock) as calls:
            outcome = self.check()
        self.assertEqual(outcome['backup_health'], 'healthy')
        self.assertEqual(calls.call_args_list, [], 'read-only check acquired an advisory lock')

    def test_check_detects_lock_replacement_during_observation(self):
        def changed_units():
            (self.state / 'lock').rename(self.state / 'prior-lock')
            self.write(self.state / 'lock', b'')
            return self.units
        with mock.patch.object(self.module, 'get_units', side_effect=changed_units):
            outcome = self.check()
        self.assertEqual(outcome['backup_health'], 'unknown')
        self.assertEqual(outcome['reason'], 'GENERATION_CHANGED')

    def test_check_detects_state_replacement_during_observation(self):
        def changed_units():
            self.write_record(self.state / 'state', dict(status='observer', last_seen_epoch=str(NOW),
                              failure_epoch=str(NOW - 10), delivery_accepted='false', backup_health='critical'))
            return self.units
        with mock.patch.object(self.module, 'get_units', side_effect=changed_units):
            outcome = self.check()
        self.assertEqual(outcome['backup_health'], 'unknown')
        self.assertEqual(outcome['reason'], 'GENERATION_CHANGED')

    def test_check_rejects_restore_proof_older_than_backup_even_with_rebound_checksum(self):
        self.receipt['verified_at'] = stamp(self.created - 1)
        self.evidence['receipt_checksum'] = self.write_record(self.receipt_path, self.receipt)
        self.write_record(self.root / 'catering-backup-evidence', self.evidence)
        outcome = self.check()
        self.assertEqual(outcome['backup_health'], 'critical')
        self.assertEqual(outcome['reason'], 'EVIDENCE_AGE_INVALID')

    def test_check_rejects_missing_restore_dispatch_despite_fresh_evidence(self):
        self.units['restore'].update(ExecMainStartTimestamp=system_stamp(NOW - 1200),
                                    ExecMainExitTimestamp=system_stamp(NOW - 1100))
        outcome = self.check()
        self.assertEqual(outcome['backup_health'], 'critical')
        self.assertEqual(outcome['reason'], 'RESTORE_DISPATCH_MISSING')

    def test_mutating_observer_holds_exclusive_lock_through_send(self):
        def transmitted(*args):
            with (self.state / 'lock').open('rb') as competing:
                with self.assertRaises(BlockingIOError):
                    self.module.fcntl.flock(competing, self.module.fcntl.LOCK_EX | self.module.fcntl.LOCK_NB)
            self.assertIn('last_seen_epoch=' + str(NOW), (self.state / 'state').read_text())
            return True
        with mock.patch.object(self.module, 'transmit', side_effect=transmitted):
            outcome = self.check(send=True)
        self.assertEqual(outcome['backup_health'], 'healthy')
        self.assertTrue(outcome['delivery_accepted'])

    def rendered_preflight(self):
        runner = (ROOT / 'platform-infra/scripts/catering-target-production-update.sh').read_text()
        definitions = runner[:runner.index('\ncase "${MODE}" in')]
        definitions_path = self.base / 'runner-functions.sh'
        self.write(definitions_path, definitions.encode())
        rendered = subprocess.run(['/bin/bash', '-euo', 'pipefail', '-c', '''
source "$1"
OPERATIONS_ROOT="$2"; REPO_ROOT="$2"
CONTRACT_PATH="$2/platform-infra/catering-target-update-contract.json"
RUNTIME_INVENTORY_PATH="$2/platform-infra/catering-target-runtime-inventory.json"
load_production_contract
ssh_target() { cat; }
remote_preflight ""
''', 'render-check', str(definitions_path), str(ROOT)], capture_output=True, text=True,
            env=dict(os.environ, CATERING_TARGET_OPERATIONS_COMMIT='b' * 40), check=False)
        self.assertEqual(rendered.returncode, 0, rendered.stderr)
        return rendered.stdout

    def source_input_probe(self):
        probe = self.base / 'input-probe.py'
        self.write(probe, b'''import ast, json, os, stat, subprocess, sys
info = os.fstat(0)
print('INPUT_FD ' + json.dumps({'boundary': sys.argv[2], 'regular': stat.S_ISREG(info.st_mode),
      'size': info.st_size, 'nlink': info.st_nlink}), file=sys.stderr)
if sys.argv[1] == 'inspect':
    raise SystemExit(0)
if sys.argv[1] == 'python':
    raise SystemExit(subprocess.run([sys.executable, *sys.argv[3:]]).returncode)
source = sys.stdin.read()
ast.parse(source)
if sys.argv[2] == 'observer':
    print(json.dumps({'observer_run': 'completed', 'backup_health': 'healthy'}))
elif sys.argv[2] == 'release':
    print('b' * 40 + '\\tsha256:' + 'e' * 64 + '\\tsha256:' + 'f' * 64)
''')
        return probe

    def input_fd_observations(self, result):
        return [json.loads(line.removeprefix('INPUT_FD ')) for line in result.stderr.splitlines()
                if line.startswith('INPUT_FD ')]

    def readonly_shell(self, command, **kwargs):
        if not sys.platform.startswith('linux'):
            return subprocess.run(command, **kwargs)
        tracer = shutil.which('strace')
        self.assertIsNotNone(tracer, 'Linux read-only gate requires strace; CI installs it explicitly')
        with tempfile.TemporaryDirectory(prefix='catering-observer-trace-') as directory:
            trace = Path(directory) / 'syscalls.log'
            result = subprocess.run([tracer, '-f', '-yy', '-s', '256', '-o', str(trace), '-e',
                'trace=%file,write,writev,pwrite64,pwritev,pwritev2,ftruncate,fallocate,fchmod,fchown,flock,fcntl',
                *command], **kwargs)
            denied = self.forbidden_syscalls(trace.read_text())
            self.assertFalse(denied, '\n'.join(denied[:20]))
        return result

    @staticmethod
    def forbidden_syscalls(trace):
        forbidden = []
        pending = {}
        mutations = {'creat', 'truncate', 'ftruncate', 'fallocate', 'chmod', 'fchmod', 'fchmodat',
                     'chown', 'fchown', 'lchown', 'fchownat', 'utime', 'utimes', 'futimesat',
                     'utimensat', 'mkdir', 'mkdirat', 'rmdir', 'unlink', 'unlinkat', 'rename',
                     'renameat', 'renameat2', 'link', 'linkat', 'symlink', 'symlinkat', 'mknod', 'mknodat'}
        for line in trace.splitlines():
            unfinished = re.fullmatch(r'(\d+)\s+([a-z0-9_]+)\((.*) <unfinished \.\.\.>', line)
            if unfinished:
                key = unfinished.group(1, 2)
                if key in pending:
                    forbidden.append(pending[key][0])
                pending[key] = (line, unfinished[1] + ' ' + unfinished[2] + '(' + unfinished[3])
                continue
            resumed = re.fullmatch(r'(\d+)\s+<\.\.\. ([a-z0-9_]+) resumed>(.*)', line)
            if resumed:
                initial = pending.pop(resumed.group(1, 2), None)
                if initial is None:
                    forbidden.append(line)
                    continue
                line = initial[1] + resumed[3]
            call = re.search(r'\b([a-z0-9_]+)\((.*)', line)
            if not call:
                continue
            name, args = call.groups()
            denied = name in mutations or name == 'flock'
            if name in {'open', 'openat', 'openat2'}:
                denied = bool(re.search(r'O_(WRONLY|RDWR|CREAT|TRUNC|APPEND|TMPFILE)', args))
                if name in {'open', 'openat'}:
                    prefix = r'AT_FDCWD(?:<[^>]*>)?, ' if name == 'openat' else ''
                    # Flags alone do not distinguish a stderr character sink from a regular substitute.
                    null_flags = r'(?:O_(?:WRONLY|RDWR)(?:\|O_(?:CLOEXEC|LARGEFILE))*|O_WRONLY\|O_CREAT\|O_TRUNC, 0666)'
                    if re.fullmatch(prefix + r'"/dev/null", ' + null_flags + r'\) = \d+</dev/null<char 1:3>>', args):
                        denied = False
                # Bash probes a controlling terminal before starting without one; this failed open creates no FD.
                if name == 'openat' and re.fullmatch(r'AT_FDCWD(?:<[^>]*>)?, "/dev/tty", O_RDWR\|O_NONBLOCK\) = -1 ENXIO \(No such device or address\)', args):
                    denied = False
            if name == 'fcntl' and re.search(r'F_(?:OFD_)?SETLK', args):
                denied = True
            if name in {'write', 'writev', 'pwrite64', 'pwritev', 'pwritev2'}:
                destination = args.split(',', 1)[0]
                denied = not (re.search(r'<(?:pipe:|(?:UNIX|TCP|UDP):)', destination)
                              or re.fullmatch(r'\d+</dev/null<char 1:3>>', destination))
            if denied:
                forbidden.append(line)
        forbidden.extend(original for original, _ in pending.values())
        return forbidden

    def test_trace_parser_accepts_captured_null_character_stderr_redirection(self):
        captured = ('711119 openat(AT_FDCWD</home/runner/work/catering-agents-platform/catering-agents-platform>, '
                    '"/dev/null", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 3</dev/null<char 1:3>>')
        self.assertFalse(self.forbidden_syscalls(captured))
        self.assertFalse(self.forbidden_syscalls('1 write(3</dev/null<char 1:3>>, "diagnostic", 10) = 10'))

    def test_trace_parser_accepts_only_captured_failed_tty_startup(self):
        captured = ('711108 openat(AT_FDCWD</home/runner/work/catering-agents-platform/catering-agents-platform>, '
                    '"/dev/tty", O_RDWR|O_NONBLOCK) = -1 ENXIO (No such device or address)')
        self.assertFalse(self.forbidden_syscalls(captured))

    def test_trace_parser_keeps_device_substitutes_and_mutations_forbidden(self):
        denied = [
            '1 openat(AT_FDCWD, "/dev/null", O_RDWR|O_CLOEXEC) = 3</dev/null>',
            '1 openat(AT_FDCWD, "/dev/null", O_RDWR|O_CLOEXEC) = 3',
            '1 openat(AT_FDCWD, "/dev/null", O_RDWR|O_CLOEXEC) = -1 EACCES (Permission denied)',
            '1 openat(AT_FDCWD, "/dev/null", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 3</dev/null>',
            '1 openat(AT_FDCWD, "/dev/null", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 3</dev/null<char 1:5>>',
            '1 openat(AT_FDCWD, "/dev/null", O_WRONLY|O_CREAT|O_TRUNC, 0600) = 3</dev/null<char 1:3>>',
            '1 openat(AT_FDCWD, "/dev/null", O_WRONLY|O_CREAT|O_TRUNC|O_APPEND, 0666) = 3</dev/null<char 1:3>>',
            '1 openat(AT_FDCWD, "/dev/nullish", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 3</dev/nullish<char 1:3>>',
            '1 openat(AT_FDCWD, "/dev/null", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 3</tmp/substitute>',
            '1 write(3</dev/null>, "source", 6) = 6',
            '1 write(3</dev/null<char 1:5>>, "source", 6) = 6',
            '1 write(3</dev/nullish<char 1:3>>, "source", 6) = 6',
            '1 openat(AT_FDCWD, "/dev/tty", O_RDWR|O_NONBLOCK) = 3</dev/tty<char 5:0>>',
            '1 openat(AT_FDCWD, "/dev/tty", O_RDWR|O_NONBLOCK) = -1 EACCES (Permission denied)',
            '1 openat(AT_FDCWD, "/dev/tty", O_RDWR|O_NONBLOCK) = -1 EINTR (Interrupted system call)',
            '1 openat(AT_FDCWD, "/dev/tty", O_RDWR|O_NONBLOCK|O_CREAT, 0666) = -1 ENXIO (No such device or address)',
            '1 openat(AT_FDCWD, "/dev/tty", O_RDWR|O_NONBLOCK|O_CLOEXEC) = -1 ENXIO (No such device or address)',
            '1 openat(AT_FDCWD, "/dev/other", O_RDWR|O_NONBLOCK) = -1 ENXIO (No such device or address)',
            '1 open("/dev/tty", O_RDWR|O_NONBLOCK) = -1 ENXIO (No such device or address)',
            '1 openat(AT_FDCWD, "/tmp/sh-thd", O_RDWR|O_CREAT|O_EXCL, 0600) = -1 EACCES (Permission denied)',
            '1 openat(AT_FDCWD, "/tmp/sh-thd", O_RDWR|O_CREAT|O_EXCL, 0600) = 3</tmp/sh-thd (deleted)>',
            '1 write(3</tmp/sh-thd (deleted)>, "source", 6) = 6',
            '1 unlink("/tmp/sh-thd") = 0',
            '1 flock(3</synthetic/lock>, LOCK_EX|LOCK_NB) = 0',
        ]
        for line in denied:
            with self.subTest(trace=line):
                self.assertTrue(self.forbidden_syscalls(line), line)

    def test_trace_parser_requires_complete_matching_split_device_calls(self):
        null_start = '1 openat(AT_FDCWD, "/dev/null", O_WRONLY|O_CREAT|O_TRUNC, 0666 <unfinished ...>'
        null_end = '1 <... openat resumed>) = 3</dev/null<char 1:3>>'
        interleaved = '2 write(1<pipe:[123]>, "result", 6) = 6'
        self.assertFalse(self.forbidden_syscalls('\n'.join([null_start, interleaved, null_end])))
        tty_start = '1 openat(AT_FDCWD, "/dev/tty", O_RDWR|O_NONBLOCK <unfinished ...>'
        tty_end = '1 <... openat resumed>) = -1 ENXIO (No such device or address)'
        self.assertFalse(self.forbidden_syscalls('\n'.join([tty_start, tty_end])))
        rejected = [
            null_start,
            null_end,
            null_start + '\n' + null_end.replace('1 <', '2 <'),
            null_start + '\n' + null_end.replace('openat resumed', 'open resumed'),
            null_start + '\n' + null_end.replace('<char 1:3>', ''),
            null_start + '\n' + null_end.replace('3</dev/null<char 1:3>>', '-1 EACCES (Permission denied)'),
            null_start + '\n' + '1 <... openat resumed>) = 3</dev/null<char 1:',
            null_start + '\n' + null_start + '\n' + null_end,
            tty_start + '\n' + '1 <... openat resumed>) = 3</dev/tty<char 5:0>>',
        ]
        for trace in rejected:
            with self.subTest(trace=trace):
                self.assertTrue(self.forbidden_syscalls(trace), trace)

    def test_process_tree_guard_detects_large_shell_heredoc_write(self):
        self.assertTrue(self.forbidden_syscalls('1 openat(AT_FDCWD, "/tmp/sh-thd", O_RDWR|O_CREAT|O_EXCL, 0600) = 3'))
        self.assertTrue(self.forbidden_syscalls('1 write(3</tmp/sh-thd (deleted)>, "source", 6) = 6'))
        self.assertTrue(self.forbidden_syscalls('1 unlink("/tmp/sh-thd") = 0'))
        self.assertTrue(self.forbidden_syscalls('1 flock(3</synthetic/lock>, LOCK_EX|LOCK_NB) = 0'))
        self.assertFalse(self.forbidden_syscalls('1 write(1<pipe:[123]>, "result", 6) = 6'))
        self.assertFalse(self.forbidden_syscalls('1 openat(AT_FDCWD, "/dev/null", O_RDWR|O_CLOEXEC) = 3</dev/null<char 1:3>>'))
        if not sys.platform.startswith('linux'):
            print('Linux process-tree execution pending; local FD and syscall-parser controls executed', file=sys.stderr)
            return
        tracer = shutil.which('strace')
        self.assertIsNotNone(tracer, 'Linux read-only gate requires strace')
        trace = self.base / 'heredoc-negative-control.log'
        result = subprocess.run([tracer, '-f', '-yy', '-s', '256', '-o', str(trace), '-e',
            'trace=%file,write,writev,flock,fcntl', '/bin/bash', '-c',
            "IFS= read -r -d '' value <<'LEGACY' || [[ -n \"$value\" ]]\n" + 'q' * 107595 + '\nLEGACY\n'],
            capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        denied = self.forbidden_syscalls(trace.read_text())
        self.assertTrue(any('O_CREAT' in line for line in denied), trace.read_text())

    def test_preflight_source_inputs_are_pipes_at_process_boundaries(self):
        rendered = self.rendered_preflight()
        probe = self.source_input_probe()
        # Source assignments precede target reads in the corrected template.
        # The existing heredoc variant has no assignments and remains executable here.
        assignments = []
        for name in ('release_check_source', 'running_identity_source', 'observer_check_source'):
            match = re.search(r'^' + name + r"=('(?:[^']|'\"'\"')*')$", rendered, re.M)
            if match:
                assignments.append(match.group(0))
        identity_body = re.search(r"^running_identity_source\+='\n[\s\S]*?\n'", rendered, re.M)
        if identity_body:
            assignments.append(identity_body.group(0))
        observer_start = rendered.index('[[ -f "$observer"')
        observer_end = rendered.index('\nif [[ "$operator_mode"', observer_start)
        release_start = rendered.index('  release_binding="')
        release_end = rendered.index('\n  [[ "$active_release_sha"', release_start)
        release = rendered[release_start:release_end]
        # Probe the actual source redirection outside command substitution, whose
        # old quoted heredoc cannot even be parsed by macOS Bash 3.2.
        capture_end = release.index(')" || preflight_fail operator_release_binding')
        release = release[len('  release_binding="$('):capture_end] + release[capture_end + len(')" || preflight_fail operator_release_binding'):]
        identity_start = rendered.index('\n', rendered.index('  observation="$(sudo -n docker inspect --format')) + 1
        identity_end = rendered.index('\n  done', identity_start)
        old_observer = self.base / 'existing-observer.py'
        self.write(old_observer, b'not executed\n')
        shell = '''
read() { "$P41_REAL_PYTHON" -B "$P41_PROBE" inspect read; builtin read "$@"; }
sudo() { [[ "$1" == -n && "$2" == /usr/bin/python3 ]] || return 86; "$P41_REAL_PYTHON" -B "$P41_PROBE" consume "$boundary"; }
/usr/bin/python3() { "$P41_REAL_PYTHON" -B "$P41_PROBE" consume "$boundary"; }
python3() { "$P41_REAL_PYTHON" -B "$P41_PROBE" python json "$@"; }
preflight_fail() { printf 'TARGET_PREFLIGHT_FAIL gate=%s\\n' "$1" >&2; return 1; }
observer="$1"; release_root=/synthetic; requested_release_sha=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
source_platform_base=platform-infra/base; source_platform_ops=platform-infra/ops
release_binding=$'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\\tsha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\\tsha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
platform_base_hash=x; platform_ops_hash=x; bound_product_sha=x; operations_commit=x; manifest_sha=x
observation='{"Image":"sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","State":{"Running":true}}'
expected=sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
release_dir=/synthetic
''' + '\n'.join(assignments) + '\nboundary=release\n' + release + \
            '\nboundary=identity\n' + rendered[identity_start:identity_end] + \
            '\nboundary=observer\n' + rendered[observer_start:observer_end]
        # Bash receives the test script through a pipe too, independent of ARG_MAX.
        result = self.readonly_shell(['/bin/bash', '-euo', 'pipefail', '-s', '--', str(old_observer)],
            input=shell, capture_output=True, text=True, check=False,
            env=dict(os.environ, P41_REAL_PYTHON=sys.executable, P41_PROBE=str(probe)))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        observed = self.input_fd_observations(result)
        self.assertTrue({'release', 'identity', 'observer'} <= {item['boundary'] for item in observed})
        self.assertFalse([item for item in observed if item['regular']], result.stderr)

    def test_common_read_validators_use_pipes_for_source_and_record_input(self):
        probe = self.source_input_probe()
        artifact = dict(self.artifact, bundle_path='catering-backup-stream-' + 'q' * 20000)
        artifact_path = self.root / 'snapshots/large-artifact'
        self.write_record(artifact_path, artifact)
        item = self.policy['attestations']['secret']
        record = dict(item['fields'], source_reference='offline_vault:/synthetic/' + 'q' * 20000,
                      verified_at=stamp(NOW - 1000), valid_until=stamp(NOW + 900000), attestation_id=digest(b'large'))
        attestation_path = self.root / 'large-secret-attestation'
        checksum = self.write_record(attestation_path, record)
        result = self.readonly_shell(['/bin/bash', '-euo', 'pipefail', '-c', '''
source "$1"; EXPECTED_UID="$2"
read() { "$P41_REAL_PYTHON" -B "$P41_PROBE" inspect read; builtin read "$@"; }
python3() { "$P41_REAL_PYTHON" -B "$P41_PROBE" python python "$@"; }
read_record "$3" artifact
printf '\\n'
validate_attestation_record secret "$4" "$5"
''', 'common-read', str(self.module.COMMON), str(os.getuid()), str(artifact_path),
            str(attestation_path), checksum], input='', capture_output=True, text=True, check=False,
            env=dict(os.environ, CATERING_BACKUP_ROOT=str(self.root), CATERING_BACKUP_EXPECTED_UID=str(os.getuid()),
                     P41_REAL_PYTHON=sys.executable, P41_PROBE=str(probe)))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stdout, artifact_path.read_text() + attestation_path.read_text().rstrip('\n'))
        observed = self.input_fd_observations(result)
        self.assertTrue(any(item['boundary'] == 'python' for item in observed))
        self.assertTrue(any(item['boundary'] == 'read' for item in observed))
        self.assertFalse([item for item in observed if item['regular']], result.stderr)

    def test_rendered_preflight_uses_bound_check_instead_of_installed_locking_observer(self):
        rendered = self.rendered_preflight()
        syntax = subprocess.run(['/bin/bash', '-n'], input=rendered,
                                capture_output=True, text=True, check=False)
        self.assertEqual(syntax.returncode, 0, syntax.stderr)
        start = rendered.index('[[ -f "$observer"')
        end = rendered.index('\nif [[ "$operator_mode"', start)
        block = rendered[start:end].replace('/etc/catering-backup-monitor/policy.json', str(self.policy_path))
        old_observer = self.base / 'installed-observer.py'
        self.write(old_observer, b"import fcntl\nfcntl.flock(1, fcntl.LOCK_EX | fcntl.LOCK_NB)\n")
        # Privilege and unit observations are synthetic; execute the real streamed module
        # with the same protected records and real shared validators as direct checks.
        bootstrap = '''
import fcntl, json, os, pathlib, runpy, socket, sys
def forbidden_lock(*args):
    raise AssertionError('installed or streamed observer acquired flock')
fcntl.flock = forbidden_lock
original_open = os.open
def read_only_open(path, flags, *args, **kwargs):
    if os.fspath(path) != os.devnull and flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND):
        raise AssertionError('streamed check opened a file for mutation')
    return original_open(path, flags, *args, **kwargs)
os.open = read_only_open
socket.gethostname = lambda: 'fixture-host'
def observation_trace(frame, event, arg):
    if event == 'call' and frame.f_code.co_name == 'run' and 'Records' in frame.f_globals:
        frame.f_globals['OWNER_UID'] = os.getuid()
        frame.f_globals['OWNER_GID'] = os.getgid()
        frame.f_globals['utc_now'] = lambda: ''' + str(NOW) + '''
        frame.f_globals['get_units'] = lambda: json.loads(os.environ['P41_UNITS'])
    return observation_trace
sys.settrace(observation_trace)
args = sys.argv[1:]
if args[0] == '-B':
    args = args[1:]
assert args[:2] == ['-I', '-'] or args[0] == '-I', args
if args[1] == '-':
    sys.argv = ['-'] + args[2:]
    exec(compile(sys.stdin.read(), '<rendered-observer>', 'exec'), {'__name__': '__main__', '__file__': '<stdin>'})
else:
    sys.argv = args[1:]
    runpy.run_path(args[1], run_name='__main__')
'''
        self.write(self.base / 'bootstrap.py', bootstrap.encode())
        before = self.monitor_snapshot()
        check = self.readonly_shell(['/bin/bash', '-euo', 'pipefail', '-s', '--', str(old_observer)], input='''
observer="$1"
preflight_fail() { printf 'TARGET_PREFLIGHT_FAIL gate=%s\\n' "$1" >&2; return 1; }
sudo() {
  [[ "$1" == -n && "$2" == /usr/bin/python3 ]] || return 86
  shift 2
  "$P41_REAL_PYTHON" -B "$P41_BOOTSTRAP" "$@"
}
''' + block + '\nprintf "%s\\n" "$observer_json"',
            capture_output=True, text=True, check=False, env=dict(os.environ,
                P41_REAL_PYTHON=sys.executable, P41_BOOTSTRAP=str(self.base / 'bootstrap.py'),
                P41_UNITS=json.dumps(self.units)))
        self.assertEqual(check.returncode, 0, check.stdout + check.stderr)
        outcome = json.loads(check.stdout)
        self.assertEqual(outcome['backup_health'], 'healthy')
        self.assertFalse(outcome['delivery_accepted'])
        self.assertEqual(self.monitor_snapshot(), before)

    def test_historical_two_table_scope_cannot_authorize_target(self):
        self.policy['bindings']['scope'] = 'postgres,sites,platform-caddy,shared-edge-caddy'
        self.save_policy()
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_candidate_without_restore_is_not_success(self):
        (self.root / 'catering-backup-evidence').rename(self.root / 'old-evidence')
        self.write_record(self.root / 'catering-backup-candidate', dict(status='pointer', candidate_path='/synthetic', candidate_checksum='a' * 64, created_at=stamp(self.created)))
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_changed_artifact_is_rejected(self):
        self.artifact['source_tree'] = '9' * 40
        self.write_record(self.artifact_path, self.artifact)
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_source_binding_is_checked_even_with_rebound_hashes(self):
        self.artifact['source_tree'] = '9' * 40
        new_hash = self.write_record(self.artifact_path, self.artifact)
        self.receipt['artifact_checksum'] = new_hash
        self.evidence.update(checksum=new_hash, artifact_checksum=new_hash,
                             receipt_checksum=self.write_record(self.receipt_path, self.receipt))
        self.write_record(self.root / 'catering-backup-evidence', self.evidence)
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_new_failure_overrides_fresh_old_evidence(self):
        self.units['backup'].update(ActiveState='failed', Result='exit-code', ExecMainStatus='1',
                                   ExecMainStartTimestamp=system_stamp(NOW - 10))
        self.assertEqual(self.check()['reason'], 'SERVICE_FAILED')

    def test_future_and_expired_evidence_are_rejected(self):
        for created in [NOW + 1, NOW - 21601]:
            with self.subTest(created=created):
                self.evidence.update(created_at=stamp(created), artifact_created_at=stamp(created))
                self.write_record(self.root / 'catering-backup-evidence', self.evidence)
                self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_missing_and_wrong_mode_records_are_rejected(self):
        self.receipt_path.chmod(0o644)
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_attestation_expiry_and_warning(self):
        item = self.policy['attestations']['secret']
        record = dict(item['fields'], verified_at=stamp(NOW - 86400), valid_until=stamp(NOW), attestation_id=digest(b'fixture'))
        item['sha256'] = self.write_record(Path(item['path']), record)
        self.save_policy()
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_clock_sync_failure_is_not_healthy(self):
        self.units['clock']['NTPSynchronized'] = 'no'
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_successful_transport_is_not_recipient_confirmation(self):
        with mock.patch.object(self.module, 'transmit', return_value=True):
            outcome = self.check(send=True)
        self.assertTrue(outcome['delivery_accepted'])
        self.assertFalse(outcome['recipient_confirmed'])

    def test_transport_failure_does_not_claim_delivery(self):
        with mock.patch.object(self.module, 'transmit', side_effect=OSError('SYNTHETIC_SECRET')):
            outcome = self.check(send=True)
        self.assertFalse(outcome['delivery_accepted'])
        self.assertEqual(outcome['reason'], 'DELIVERY_FAILED')

    def test_unknown_account_binding_cannot_send(self):
        self.policy['heartbeat']['account_verified'] = False
        self.save_policy()
        with mock.patch.object(self.module, 'transmit', side_effect=AssertionError('must not send')):
            outcome = self.check(send=True)
        self.assertFalse(outcome['delivery_accepted'])

    def test_repeated_latched_failure_does_not_move_watermark(self):
        self.write_record(self.state / 'state', dict(status='observer', last_seen_epoch=str(NOW - 5),
                          failure_epoch=str(NOW - 20), delivery_accepted='false', backup_health='critical'))
        with mock.patch.object(self.module, 'transmit', return_value=True):
            for _ in range(2):
                outcome = self.check(send=True)
                self.assertEqual(outcome['reason'], 'FAILURE_LATCHED')
                self.assertIn('failure_epoch=' + str(NOW - 20) + '\n', (self.state / 'state').read_text())

    def test_publisher_delay_cannot_send_late_success(self):
        original = self.module.shell
        terminal = NOW
        def delayed(root, command, args, payload=None):
            nonlocal terminal
            result = original(root, command, args, payload)
            if 'atomic_write_record' in command:
                terminal = self.created + 21600
            return result
        with mock.patch.object(self.module, 'shell', side_effect=delayed), \
             mock.patch.object(self.module, 'utc_now', lambda: terminal), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.check(send=True)
        self.assertFalse(any(call.args[1] for call in send.call_args_list))

    def test_new_failure_during_verification_cannot_send_success(self):
        original = self.module.shell
        healthy_backup = dict(self.units['backup'])
        failed = NOW - 10
        observed_now = NOW
        def delayed(root, command, args, payload=None):
            nonlocal observed_now
            result = original(root, command, args, payload)
            if 'atomic_write_record' in command:
                self.units['backup'].update(Result='exit-code', ExecMainStatus='1', ActiveState='failed',
                                           ExecMainStartTimestamp=system_stamp(failed))
                observed_now = NOW - 1
            return result
        with mock.patch.object(self.module, 'shell', side_effect=delayed), \
             mock.patch.object(self.module, 'utc_now', lambda: observed_now), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            outcome = self.check(send=True)
        self.assertEqual(outcome['reason'], 'SERVICE_FAILED')
        self.assertFalse(outcome['delivery_accepted'])
        send.assert_not_called()
        persisted = dict(line.split('=', 1) for line in (self.state / 'state').read_text().splitlines())
        self.assertEqual(persisted['failure_epoch'], str(failed))
        self.assertEqual(persisted['last_seen_epoch'], str(NOW))
        self.assertEqual(persisted['backup_health'], 'critical')
        self.assertEqual(persisted['delivery_accepted'], 'false')
        with mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.units['backup'] = healthy_backup
            for _ in range(2):
                outcome = self.check(send=True)
                self.assertEqual(outcome['reason'], 'FAILURE_LATCHED')
                self.assertEqual(outcome['backup_health'], 'critical')
                self.assertIn('failure_epoch=' + str(failed) + '\n', (self.state / 'state').read_text())
            self.units['backup'].update(Result='exit-code', ExecMainStatus='1', ActiveState='failed',
                                       ExecMainStartTimestamp=system_stamp(NOW - 30))
            self.assertEqual(self.check(send=True)['reason'], 'SERVICE_FAILED')
            self.assertIn('failure_epoch=' + str(failed) + '\n', (self.state / 'state').read_text())
            self.assertFalse(any(call.args[1] for call in send.call_args_list))

            # A complete new synthetic proof replaces the old generation, not just its timestamp.
            self.created = NOW - 5
            self.artifact.update(bundle_path='catering-backup-stream-2', bundle_checksum='9' * 64,
                                 component_caddy_stream_checksum='9' * 64)
            self.receipt.update(snapshot_id='6' * 64, verified_at=stamp(NOW - 1),
                                bundle_path=self.artifact['bundle_path'], bundle_checksum=self.artifact['bundle_checksum'])
            self.evidence.update(snapshot_id='6' * 64, artifact_snapshot_id='6' * 64,
                                 created_at=stamp(self.created), artifact_created_at=stamp(self.created))
            self.rebind_artifact()
            self.write_record(self.root / 'catering-backup-repository-status', dict(status='read-only-verified',
                              identity=self.binding['repository_identity'], host_binding=self.binding['host_binding'],
                              scope=SCOPE, verified_at=stamp(NOW - 1)))
            self.units['backup'].update(Result='success', ExecMainStatus='0', ActiveState='inactive',
                                       ExecMainStartTimestamp=system_stamp(self.created), ExecMainExitTimestamp=system_stamp(NOW - 4))
            self.units['restore'].update(ExecMainStartTimestamp=system_stamp(NOW - 4), ExecMainExitTimestamp=system_stamp(NOW - 1))
            self.units['timer'].update(ActiveEnterTimestamp=system_stamp(self.created), LastTriggerUSec=system_stamp(self.created))
            outcome = self.check(send=True)
            self.assertEqual(outcome['backup_health'], 'healthy')
            self.assertTrue(outcome['delivery_accepted'])
            self.assertIn('failure_epoch=' + str(failed) + '\n', (self.state / 'state').read_text())
        self.assertEqual([call.args[1] for call in send.call_args_list], [False, False, False, True])

    def test_record_swap_during_publication_cannot_send_success(self):
        original = self.module.shell
        def replaced(root, command, args, payload=None):
            result = original(root, command, args, payload)
            if 'atomic_write_record' in command:
                self.write_record(self.artifact_path, dict(self.artifact, source_tree='9' * 40))
            return result
        with mock.patch.object(self.module, 'shell', side_effect=replaced), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.module.run(str(self.policy_path), send=True)
        self.assertFalse(any(call.args[1] for call in send.call_args_list))

    def test_duplicate_unknown_and_nul_records_fail_closed(self):
        original = self.artifact_path.read_bytes()
        for suffix in [b'status=artifact\n', b'unknown_key=extra\n', b'\0\n']:
            self.write(self.artifact_path, original + suffix)
            self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_symlink_and_hardlink_records_fail_closed(self):
        old = self.receipt_path.with_name('original-receipt')
        self.receipt_path.rename(old)
        self.receipt_path.symlink_to(old)
        self.assertNotEqual(self.check()['backup_health'], 'healthy')
        self.receipt_path.rename(self.receipt_path.with_name('preserved-link'))
        os.link(old, self.receipt_path)
        self.assertNotEqual(self.check()['backup_health'], 'healthy')

    def test_clock_rollback_is_not_recovery(self):
        self.write_record(self.state / 'state', dict(status='observer', last_seen_epoch=str(NOW + 1),
                          failure_epoch='0', delivery_accepted='false', backup_health='healthy'))
        with mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.assertNotEqual(self.check(send=True)['backup_health'], 'healthy')
        send.assert_not_called()

    def test_failed_state_publication_prevents_all_signals(self):
        original = self.module.shell
        initial_state, healthy_backup = (self.state / 'state').read_bytes(), dict(self.units['backup'])
        for phase in ['first', 'late_before_write', 'late_after_write']:
            with self.subTest(phase=phase):
                self.write(self.state / 'state', initial_state)
                self.units['backup'] = dict(healthy_backup)
                writes = 0
                def refused(root, command, args, payload=None):
                    nonlocal writes
                    if 'atomic_write_record' not in command:
                        return original(root, command, args, payload)
                    writes += 1
                    if phase == 'first' or (writes == 2 and phase == 'late_before_write'):
                        raise OSError('SYNTHETIC_SECRET')
                    result = original(root, command, args, payload)
                    if writes == 2:
                        raise OSError('SYNTHETIC_SECRET')
                    self.units['backup'].update(Result='exit-code', ExecMainStatus='1', ActiveState='failed',
                                               ExecMainStartTimestamp=system_stamp(NOW - 10))
                    return result
                with mock.patch.object(self.module, 'shell', side_effect=refused), \
                     mock.patch.object(self.module, 'transmit', return_value=True) as send:
                    outcome = self.check(send=True)
                self.assertEqual(outcome['observer_run'], 'failed')
                self.assertEqual(outcome['backup_health'], 'unknown')
                self.assertEqual(outcome['reason'], 'OBSERVER_FAILED')
                self.assertFalse(outcome['delivery_accepted'])
                send.assert_not_called()
                persisted = dict(line.split('=', 1) for line in (self.state / 'state').read_text().splitlines())
                self.assertEqual(persisted['failure_epoch'], str(NOW - 10) if phase == 'late_after_write' else '0')
                self.assertEqual(persisted['backup_health'], 'critical' if phase == 'late_after_write' else
                                 'unknown' if phase == 'first' else 'healthy')

    def test_observer_lock_does_not_wait_or_send(self):
        with (self.state / 'lock').open('rb') as lock:
            self.module.fcntl.flock(lock, self.module.fcntl.LOCK_EX)
            with mock.patch.object(self.module, 'transmit', return_value=True) as send:
                self.assertFalse(self.check(send=True)['delivery_accepted'])
            send.assert_not_called()

    def test_missed_cycles_and_exceeded_budgets(self):
        for kind, budget in [('backup', 1800), ('restore', 7200)]:
            prior = dict(self.units[kind])
            self.units[kind].update(ActiveState='activating', ExecMainStartTimestamp=system_stamp(NOW - budget - 1))
            self.assertEqual(self.check()['reason'], 'SERVICE_BUDGET_EXCEEDED')
            self.units[kind] = prior
        self.units['timer']['ActiveEnterTimestamp'] = system_stamp(NOW - 20000)
        future = NOW + 10800
        with mock.patch.object(self.module, 'utc_now', lambda: future):
            self.assertEqual(self.check()['reason'], 'CYCLE_MISSING')

    def test_attestation_warning_is_early_without_extending_expiry(self):
        item = self.policy['attestations']['secret']
        value = dict(item['fields'], verified_at=stamp(NOW - 86400),
                     valid_until=stamp(NOW + 86400), attestation_id=digest(b'warning'))
        item['sha256'] = self.write_record(Path(item['path']), value)
        self.save_policy()
        self.assertEqual(self.check()['backup_health'], 'warning')

    def test_repeated_same_evidence_uses_fixed_cutoff(self):
        cutoff = self.created + 21600 - 435
        # Isolate the immutable-data deadline from the separately tested timer schedule.
        with mock.patch.object(self.module, 'service_health'), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            for instant, expected in [(cutoff - 1, 'healthy'), (cutoff, 'warning'), (cutoff + 1, 'warning')]:
                with mock.patch.object(self.module, 'utc_now', lambda: instant):
                    self.assertEqual(self.check(send=True)['backup_health'], expected)
        self.assertEqual([c.args[1] for c in send.call_args_list], [True, False, False])

    def test_transport_allowlist_tls_redirect_and_secret_boundaries(self):
        import ssl
        valid = 'https://uptime.betterstack.com/api/v1/heartbeat/SYNTHETIC_SECRET'
        for url in [valid + '?x=1', valid + '#fragment', valid.replace('https:', 'http:'),
                    valid.replace('uptime.', 'evil.'), valid.replace('betterstack.com', 'betterstack.com:443'),
                    valid.replace('uptime.', 'user@uptime.')]:
            with self.assertRaises(ValueError):
                self.module.heartbeat_url(url)
        connection = mock.MagicMock()
        with mock.patch.object(self.module.http.client, 'HTTPSConnection', return_value=connection) as create:
            for status, expected in [(200, True), (302, False), (429, False), (500, False)]:
                connection.getresponse.return_value.status = status
                self.assertEqual(self.module.http_send(valid, False, 15), expected)
            args, kwargs = create.call_args
            self.assertEqual(args, ('uptime.betterstack.com',))
            self.assertTrue(kwargs['context'].check_hostname)
            self.assertEqual(kwargs['context'].verify_mode, ssl.CERT_REQUIRED)
            self.assertEqual(connection.request.call_args.args, ('GET', '/api/v1/heartbeat/SYNTHETIC_SECRET/fail'))
        with mock.patch.object(self.module.subprocess, 'run', return_value=mock.Mock(returncode=0)) as child:
            self.assertTrue(self.module.transmit(valid, True, 15))
        args, kwargs = child.call_args
        self.assertNotIn('SYNTHETIC_SECRET', repr(args) + repr(kwargs['env']))
        self.assertIn(b'SYNTHETIC_SECRET', kwargs['input'])
        self.assertEqual(kwargs['timeout'], 15)

    def test_no_secret_exception_on_stdout_or_stderr(self):
        output, errors = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors), \
             mock.patch.object(self.module, 'transmit', side_effect=RuntimeError('SYNTHETIC_SECRET')):
            result = self.check(send=True)
        self.assertNotIn('SYNTHETIC_SECRET', output.getvalue() + errors.getvalue() + json.dumps(result))

    def test_missing_mandatory_policy_bindings_are_rejected(self):
        for key in list(self.binding):
            value = self.binding.pop(key)
            self.save_policy()
            self.assertNotEqual(self.check()['backup_health'], 'healthy', key)
            self.binding[key] = value

    def test_artifact_invariants_even_when_digests_rebound(self):
        for key in ['component_caddy_stream_checksum', 'manifest_path', 'postgres_dump_path']:
            original = self.artifact[key]
            self.artifact[key] = '8' * 64 if 'checksum' in key else 'unexpected'
            self.rebind_artifact()
            self.assertNotEqual(self.check()['backup_health'], 'healthy', key)
            self.artifact[key] = original

    def test_recovery_attestation_semantics_not_just_policy_equality(self):
        item = self.policy['attestations']['secret']
        for key, value in [('source_reference', 'synthetic-vault'), ('required_secret_schema_digest', '9' * 64)]:
            original = item['fields'][key]
            item['fields'][key] = value
            item['sha256'] = self.write_record(Path(item['path']), dict(item['fields'], verified_at=stamp(NOW - 1000),
                                                     valid_until=stamp(NOW + 900000), attestation_id=digest(b'invalid')))
            self.save_policy()
            self.assertNotEqual(self.check()['backup_health'], 'healthy', key)
            item['fields'][key] = original

    def test_exact_calendar_and_terminal_exit_code(self):
        original = self.units['timer']['TimersCalendar']
        self.units['timer']['TimersCalendar'] += ' { OnCalendar=hourly ; next_elapse=synthetic }'
        self.assertEqual(self.check()['reason'], 'TIMER_NOT_ARMED')
        self.units['timer']['TimersCalendar'] = original
        self.units['restore']['ExecMainCode'] = '2'
        self.assertEqual(self.check()['reason'], 'SERVICE_UNKNOWN')

    def test_dispatch_and_total_cycle_deadlines(self):
        due = NOW // 10800 * 10800
        self.units['timer'].update(ActiveEnterTimestamp=system_stamp(due), LastTriggerUSec=system_stamp(due))
        self.units['backup'].update(ExecMainStartTimestamp=system_stamp(due + 200), ExecMainExitTimestamp=system_stamp(due + 800))
        self.units['restore'].update(ActiveState='activating', ExecMainStartTimestamp=system_stamp(due + 2000),
                                     ExecMainExitTimestamp='')
        with self.assertRaisesRegex(ValueError, 'RESTORE_DISPATCH_MISSING'):
            self.module.service_health(self.units, due + 2100, self.created, due + 1, 0)
        self.units['backup'].update(ExecMainStartTimestamp=system_stamp(due + 300), ExecMainExitTimestamp=system_stamp(due + 2100))
        self.units['restore'].update(ActiveState='inactive', ExecMainStartTimestamp=system_stamp(due + 2340),
                                     ExecMainExitTimestamp=system_stamp(due + 9540))
        with self.assertRaisesRegex(ValueError, 'DISPATCH_BUDGET_EXCEEDED'):
            self.module.service_health(self.units, due + 9541, due + 300, due + 9540, 0)
        with self.assertRaisesRegex(ValueError, 'DISPATCH_BUDGET_EXCEEDED'):
            self.module.service_health(self.units, due + 10801, due + 300, due + 9540, 0)

    def test_actual_failed_invocation_latches_then_new_proof_recovers(self):
        failed = NOW - 2000
        self.units['backup'].update(Result='exit-code', ExecMainStatus='1', ActiveState='failed',
                                   ExecMainStartTimestamp=system_stamp(failed))
        with mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.assertEqual(self.check(send=True)['reason'], 'SERVICE_FAILED')
            self.assertIn('failure_epoch=' + str(failed) + '\n', (self.state / 'state').read_text())
            self.units['backup'].update(Result='success', ExecMainStatus='0', ActiveState='inactive',
                                       ExecMainStartTimestamp=system_stamp(self.created))
            self.assertEqual(self.check(send=True)['backup_health'], 'healthy')
        self.assertEqual([c.args[1] for c in send.call_args_list], [False, True])

    def test_service_or_transport_timeout_is_observable(self):
        import subprocess
        with mock.patch.object(self.module, 'get_units', side_effect=subprocess.TimeoutExpired('synthetic', 5)):
            self.assertNotEqual(self.check()['backup_health'], 'healthy')
        with mock.patch.object(self.module, 'transmit', side_effect=subprocess.TimeoutExpired('synthetic', 15)):
            self.assertEqual(self.check(send=True)['reason'], 'DELIVERY_FAILED')

    def test_worker_rechecks_cutoff_after_tls_connect(self):
        connection = mock.MagicMock()
        with mock.patch.object(self.module.http.client, 'HTTPSConnection', return_value=connection):
            with self.assertRaisesRegex(ValueError, 'INSUFFICIENT_DETECTION_MARGIN'):
                self.module.http_send('https://uptime.betterstack.com/api/v1/heartbeat/SYNTHETIC_SECRET', True, 15, NOW)
        connection.request.assert_not_called()

    def test_worker_closed_window_survives_following_clock_rollback(self):
        cutoff = self.created + 21600 - 435
        clock = cutoff - 10
        with mock.patch.object(self.module, 'service_health'), \
             mock.patch.object(self.module, 'utc_now', lambda: clock), \
             mock.patch.object(self.module, 'transmit', side_effect=ValueError('PING_WINDOW_CLOSED')):
            self.assertFalse(self.check(send=True)['delivery_accepted'])
        clock = cutoff - 5
        with mock.patch.object(self.module, 'service_health'), \
             mock.patch.object(self.module, 'utc_now', lambda: clock), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.assertEqual(self.check(send=True)['reason'], 'CLOCK_ROLLBACK')
        send.assert_not_called()

    def test_get_units_uses_only_bounded_metadata_commands(self):
        with mock.patch.object(self.module.subprocess, 'run', return_value=mock.Mock(stdout=b'ActiveState=inactive\n')) as execute:
            # setUp replaces get_units; load a separate module to inspect the real process boundary.
            spec = importlib.util.spec_from_file_location('observer_commands', ENTRY)
            fresh = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(fresh)
            fresh.get_units()
        self.assertEqual(len(execute.call_args_list), 4)
        for call in execute.call_args_list:
            self.assertEqual(call.args[0][1], 'show')
            self.assertEqual(call.kwargs['timeout'], 5)
            self.assertNotIn('SYNTHETIC_SECRET', repr(call))

    def test_cutoff_crossing_survives_real_second_run_clock_rollback(self):
        original = self.module.shell
        cutoff = self.created + 21600 - 435
        clock = cutoff - 10
        def delayed(root, command, args, payload=None):
            nonlocal clock
            result = original(root, command, args, payload)
            if 'atomic_write_record' in command:
                clock = cutoff + 1
            return result
        with mock.patch.object(self.module, 'service_health'), \
             mock.patch.object(self.module, 'utc_now', lambda: clock), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            with mock.patch.object(self.module, 'shell', side_effect=delayed):
                self.assertEqual(self.check(send=True)['backup_health'], 'warning')
            clock = cutoff - 5
            self.assertEqual(self.check(send=True)['reason'], 'CLOCK_ROLLBACK')
        self.assertEqual([c.args[1] for c in send.call_args_list], [False])

    def test_helper_timeout_kills_real_synthetic_grandchild(self):
        import subprocess
        import time
        marker = self.base / 'must-not-be-written'
        command = '(sleep 1; printf late > "$1") & wait'
        with mock.patch.object(self.module, 'HELPER_SECONDS', 0.1):
            with self.assertRaises(subprocess.TimeoutExpired):
                self.module.shell(self.root, command, [marker])
        self.assertEqual(self.module.CHILD_GROUPS, set())
        time.sleep(1.1)
        self.assertFalse(marker.exists())

    def test_observer_term_kills_owned_helper_group(self):
        import subprocess
        import time
        import signal
        marker = self.base / 'term-must-not-be-written'
        ready = self.base / 'term-ready'
        code = ('import importlib.util,signal; '
                's=importlib.util.spec_from_file_location("o",' + repr(str(ENTRY)) + '); '
                'o=importlib.util.module_from_spec(s);s.loader.exec_module(o);'
                'signal.signal(signal.SIGTERM,o.terminate_children);'
                'o.shell(' + repr(str(self.root)) + ',\'touch "$1"; (sleep 1; printf late > "$2") & wait\',' + repr([str(ready), str(marker)]) + ')')
        process = subprocess.Popen([__import__('sys').executable, '-B', '-c', code], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 3
            while not ready.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(ready.exists())
            process.send_signal(signal.SIGTERM)
            self.assertEqual(process.wait(timeout=2), 1)
            time.sleep(1.1)
            self.assertFalse(marker.exists())
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=2)

    def test_term_between_spawn_and_registration_cannot_orphan_helper(self):
        import subprocess
        import time
        marker = self.base / 'registration-must-not-be-written'
        code = ('import importlib.util,signal,os\n'
                's=importlib.util.spec_from_file_location("o",' + repr(str(ENTRY)) + ')\n'
                'o=importlib.util.module_from_spec(s);s.loader.exec_module(o)\n'
                'signal.signal(signal.SIGTERM,o.terminate_children)\n'
                'original=o.subprocess.Popen\n'
                'def interrupted(*args,**kwargs):\n'
                ' p=original(*args,**kwargs)\n'
                ' os.kill(os.getpid(),signal.SIGTERM)\n'
                ' return p\n'
                'o.subprocess.Popen=interrupted\n'
                'o.shell(' + repr(str(self.root)) + ',\'(sleep 0.4; printf late > "$1") & wait\',' + repr([str(marker)]) + ')')
        process = subprocess.run([__import__('sys').executable, '-B', '-c', code], stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL, timeout=3)
        self.assertEqual(process.returncode, 1)
        time.sleep(0.6)
        self.assertFalse(marker.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
