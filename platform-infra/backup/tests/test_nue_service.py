"""Synthetic contracts: no host service, Docker, database, credential or repository access."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import signal
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


service = module('service', 'catering-nue-service.py')
core = module('core', 'catering-nue-core.py')


class Admission(unittest.TestCase):
    def properties(self, unit):
        return self.units[unit]

    def setUp(self):
        self.units = {
            'catering-backup.service': dict(InvocationID='a' * 32, MainPID=str(os.getpid()), ActiveState='activating',
                SubState='start', FragmentPath=str(service.SERVICE), DropInPaths='', NeedDaemonReload='no',
                Type='oneshot', User='root', KillMode='mixed', NoNewPrivileges='yes', UMask='0077',
                ControlGroup='/system.slice/catering-backup.service'),
            'catering-backup.timer': dict(FragmentPath=str(service.TIMER), DropInPaths='', NeedDaemonReload='no',
                ActiveState='inactive', Unit='catering-backup.service'),
            'catering-restore-probe.service': dict(LoadState='not-found', ActiveState='inactive')}

    def admit(self):
        with mock.patch.dict(os.environ, {'INVOCATION_ID': 'a' * 32}), \
             mock.patch.object(Path, 'read_text', return_value='0::/system.slice/catering-backup.service\n'), \
             mock.patch.object(service.os, 'stat', return_value=os.stat(__file__)), \
             mock.patch.object(service.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0, stdout=b'catering-backup.service loaded activating start\n')):
            service.scheduler_admission({'timerState': 'inactive'}, self.properties)

    def test_only_actual_own_service_is_admitted(self):
        self.admit()
        for key, value, message in [('InvocationID', 'b' * 32, 'FOREIGN_INVOCATION'),
                                    ('MainPID', '1', 'SERVICE_MAINPID_REQUIRED'),
                                    ('ControlGroup', '/foreign', 'SERVICE_CGROUP'),
                                    ('DropInPaths', '/tmp/override.conf', 'SERVICE_UNIT_DRIFT'),
                                    ('NeedDaemonReload', 'yes', 'SERVICE_UNIT_DRIFT'),
                                    ('NoNewPrivileges', 'no', 'SERVICE_PROPERTIES_DRIFT')]:
            with self.subTest(key=key):
                original = self.units['catering-backup.service'][key]
                self.units['catering-backup.service'][key] = value
                with self.assertRaisesRegex(RuntimeError, message):
                    self.admit()
                self.units['catering-backup.service'][key] = original

    def test_timer_and_legacy_changes_hold(self):
        self.units['catering-backup.timer']['ActiveState'] = 'active'
        with self.assertRaisesRegex(RuntimeError, 'TIMER_STATE_DRIFT'):
            self.admit()
        self.units['catering-backup.timer']['ActiveState'] = 'inactive'
        self.units['catering-restore-probe.service']['LoadState'] = 'loaded'
        with self.assertRaisesRegex(RuntimeError, 'LEGACY_RESTORE_UNIT_PRESENT'):
            self.admit()

    def test_namespace_mismatch_before_job_reads_or_mutates(self):
        with mock.patch.object(service.os, 'geteuid', return_value=0), \
             mock.patch.object(service, 'same_mount_namespace', side_effect=RuntimeError('HOST_MOUNT_NAMESPACE_REQUIRED')), \
             mock.patch.object(service, 'protected') as reader, mock.patch.object(Path, 'mkdir') as writer:
            with self.assertRaisesRegex(RuntimeError, 'HOST_MOUNT_NAMESPACE_REQUIRED'):
                service.Job()
            reader.assert_not_called()
            writer.assert_not_called()

    def test_config_and_credential_generation_replacement_hold(self):
        job = object.__new__(service.Job)
        job.generation_identity = ('generation',)
        job.config_identity = ('config',)
        job.marker = {'configSha256': 'a' * 64}
        job.bindings = {'/protected/credential': 'b' * 64}
        job.identities = {'/protected/credential': ('credential',)}
        good = [(b'', ('generation',)), (b'', ('config',)), (b'', ('credential',))]
        for index in range(3):
            changed = list(good)
            changed[index] = (b'', ('changed',))
            with mock.patch.object(service, 'protected', side_effect=changed):
                with self.assertRaisesRegex(RuntimeError, 'CHANGED'):
                    job.immutable()

    def test_admission_drift_never_creates_first_directory(self):
        for reason in ('CONFIG_CHANGED', 'BOUND_GENERATION_CHANGED', 'SERVICE_UNIT_DRIFT', 'FOREIGN_UPDATE_LOCK'):
            job = object.__new__(service.Job)
            job.gate = mock.Mock(side_effect=RuntimeError(reason))
            job.check_repository = mock.Mock()
            job.admission = mock.Mock()
            with self.subTest(reason=reason), self.assertRaisesRegex(RuntimeError, reason):
                job.stage_admission()
            job.admission.mkdir.assert_not_called()
            job.check_repository.assert_not_called()

    def test_original_attestation_directory_is_validator_root_without_timestamp_rewrite(self):
        import socket
        job = object.__new__(service.Job)
        job.config = json.loads((ROOT / 'nue-service.json.example').read_text())
        job.config['parameters']['CATERING_BACKUP_PRODUCTION_HOST_SHA256'] = service.sha(socket.gethostname().encode())
        job.bindings = job.config['files']
        job.immutable = mock.Mock()
        with mock.patch.object(service.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as validator:
            job.validate_attestations()
        arguments, keywords = validator.call_args
        self.assertEqual(keywords['env']['CATERING_BACKUP_ROOT'], str(Path(job.config['offhostPath']).parent))
        self.assertEqual(keywords['env']['CATERING_OFFHOST_ATTESTATION_FILE'], job.config['offhostPath'])
        self.assertTrue(arguments[0][2].endswith('21600'))
        self.assertNotIn('CATERING_BACKUP_ATTESTATION_NOW_EPOCH', keywords['env'])
        job.config['recoveryPath'] = '/another/generation/recovery'
        with self.assertRaisesRegex(RuntimeError, 'ATTESTATION_GENERATION_DIRECTORY'):
            job.validate_attestations()

    def test_restic_version_and_producer_exit_capability_are_required(self):
        job = object.__new__(service.Job)
        job.immutable = mock.Mock()
        good_version = types.SimpleNamespace(returncode=0, stdout=b'restic 0.19.0 compiled with go1.25.0 on linux/amd64\n')
        good_help = types.SimpleNamespace(returncode=0, stdout=b'--stdin-from-command execute command')
        with mock.patch.object(service.subprocess, 'run', side_effect=[good_version, good_help]) as run:
            job.check_restic()
        self.assertEqual(run.call_args_list[0].args[0], ['/usr/local/bin/restic', 'version'])
        for version in (b'restic 0.16.4 compiled with go1.22.0 on linux/amd64\n',
                        b'restic 0.19.0 compiled with go1.25.0 on darwin/arm64\n'):
            with mock.patch.object(service.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0, stdout=version)):
                with self.assertRaisesRegex(RuntimeError, 'RESTIC_VERSION_REQUIRED'):
                    job.check_restic()
        with mock.patch.object(service.subprocess, 'run', side_effect=[good_version, types.SimpleNamespace(returncode=0, stdout=b'--stdin only')]):
            with self.assertRaisesRegex(RuntimeError, 'RESTIC_PRODUCER_EXIT_SUPPORT_REQUIRED'):
                job.check_restic()

    def test_unbound_manual_core_still_requires_all_units_absent(self):
        source = (ROOT / 'catering-nue-core.py').read_text()
        self.assertIn('if SCHEDULER_GATE is None:', source)
        self.assertIn('LoadState=not-found', source)
        self.assertIn('ROOT_CRONTAB_PRESENT', source)
        self.assertIn('CRON_SCOPE_CHANGED', source)
        self.assertIsNone(core.SCHEDULER_GATE)


class Streaming(unittest.TestCase):
    def child(self, code):
        return subprocess.Popen([sys.executable, '-I', '-B', '-c', code], stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, start_new_session=True)

    def test_actual_stream_is_bounded_and_child_reaped(self):
        child = self.child('import os; os.write(1,b"abcd")')
        try:
            reader = service.DeadlineReader(child, 3, 3)
            with self.assertRaisesRegex(RuntimeError, 'STREAM_BYTE_BUDGET'):
                reader.read(131072)
        finally:
            service.reap(child)
        self.assertIsNotNone(child.poll())
        self.assertTrue(child.stdout.closed)

    def test_stalled_stream_deadline_terminates_child(self):
        child = self.child('import time; time.sleep(30)')
        try:
            with self.assertRaisesRegex(RuntimeError, 'STREAM_DEADLINE'):
                service.DeadlineReader(child, 0.03, 100).read(1)
        finally:
            service.reap(child)
        self.assertIsNotNone(child.poll())

    @unittest.skipUnless(sys.platform.startswith("linux"), "Real Linux waitid(WNOWAIT) descendant cleanup runs in Ubuntu CI")
    def test_linux_exited_leader_does_not_hide_term_ignoring_owned_producer(self):
        code = '''import os, signal, time
read_fd, write_fd = os.pipe()
pid = os.fork()
if pid == 0:
    os.close(read_fd)
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    os.write(write_fd, b'ready')
    os.close(write_fd)
    while True: time.sleep(1)
os.close(write_fd)
os.read(read_fd, 5)
os.close(read_fd)
os.write(1, (str(pid) + '\\n').encode())
os._exit(0)
'''
        child = self.child(code)
        try:
            descendant = int(child.stdout.readline())
            self.assertEqual(service.wait_child_exit(child, 3), 0)
            self.assertIsNone(child.returncode)
            self.assertTrue(service.group_live(child))
            service.reap(child, term_timeout=0.1, kill_timeout=3)
            self.assertEqual(child.returncode, 0)
            self.assertTrue(child.stdout.closed)
            result = subprocess.check_output(['/bin/ps', '-axo', 'pid=,stat=']).decode().splitlines()
            self.assertFalse(any(int(row.split()[0]) == descendant and not row.split()[1].startswith('Z') for row in result))
        finally:
            if child.returncode is None:
                # Until wait(), this direct child still anchors exactly our test group.
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=5)
            if not child.stdout.closed:
                child.stdout.close()

    def test_group_escalation_is_independent_of_leader_exit(self):
        child = types.SimpleNamespace(returncode=None, pid=123, stdout=io.BytesIO(), wait=mock.Mock(return_value=0))
        with mock.patch.object(service, 'group_live', side_effect=[True, True, True, False, False]), \
             mock.patch.object(service.os, 'killpg') as kill:
            service.reap(child, term_timeout=0, kill_timeout=1)
        self.assertEqual(kill.call_args_list, [mock.call(123, signal.SIGTERM), mock.call(123, signal.SIGKILL)])
        child.wait.assert_called_once_with(timeout=5)
        self.assertTrue(child.stdout.closed)

    def test_lost_anchor_never_signals_a_possibly_reused_group(self):
        child = types.SimpleNamespace(returncode=0, pid=123, stdout=io.BytesIO())
        with mock.patch.object(service.os, 'killpg') as kill:
            with self.assertRaisesRegex(RuntimeError, 'CHILD_GROUP_ANCHOR_LOST'):
                service.reap(child)
            kill.assert_not_called()
        self.assertTrue(child.stdout.closed)

    def test_truncated_and_bad_whole_hash_restore_stream_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'OUTER_STREAM_TRUNCATED'):
                core.receive_outer(io.BytesIO(b'x'), Path(directory), 'a' * 32, 'b' * 64, 'c' * 64)


class Lifecycle(unittest.TestCase):
    def job(self):
        job = object.__new__(service.Job)
        job.run_id = 'a' * 32
        job.expected = {}
        job.core = types.SimpleNamespace(RECOVERING=False, capture=mock.Mock(return_value={'capture': True}),
                                         cleanup_after_failure=mock.Mock())
        job.stage_admission = mock.Mock()
        job.transfer_restore = mock.Mock(return_value={'pass': True})
        job.cleanup_admission = mock.Mock()
        return job

    def test_each_failure_uses_owned_cleanup_and_never_returns_pass(self):
        for stage in ('stage_admission', 'capture', 'transfer_restore'):
            job = self.job()
            target = job.core.capture if stage == 'capture' else getattr(job, stage)
            target.side_effect = RuntimeError('synthetic')
            with self.subTest(stage=stage), self.assertRaisesRegex(RuntimeError, 'synthetic'):
                job.run()
            job.core.cleanup_after_failure.assert_called_once_with(job.run_id)
            job.cleanup_admission.assert_called_once()
            self.assertFalse(job.core.RECOVERING)

    def test_cleanup_failure_is_honest_hold(self):
        job = self.job()
        job.core.capture.side_effect = RuntimeError('capture interrupted')
        job.core.cleanup_after_failure.side_effect = RuntimeError('foreign guard')
        output = io.StringIO()
        with contextlib.redirect_stderr(output), self.assertRaisesRegex(RuntimeError, 'capture interrupted'):
            job.run()
        self.assertIn('OWNED_RECOVERY_HOLD', output.getvalue())

    def test_success_requires_transfer_restore_and_admission_cleanup(self):
        job = self.job()
        self.assertEqual(job.run(), {'pass': True})
        job.transfer_restore.assert_called_once_with({'capture': True})
        job.cleanup_admission.assert_called_once()
        job.core.cleanup_after_failure.assert_not_called()

    def test_signal_disables_deadline_and_respects_active_recovery(self):
        job = self.job()
        with mock.patch.object(service.signal, 'alarm') as alarm:
            with self.assertRaisesRegex(RuntimeError, 'JOB_INTERRUPTED'):
                job.interrupted(15, None)
            alarm.assert_called_with(0)
            job.core.RECOVERING = True
            job.interrupted(15, None)

    def test_unit_uses_single_chain_without_mount_namespace_sandbox(self):
        unit = (ROOT / 'catering-nue-backup.service').read_text()
        self.assertNotIn('OnSuccess=', unit)
        for directive in ('ProtectSystem=', 'ProtectHome=', 'PrivateTmp=', 'ReadWritePaths=', 'PrivateMounts=', 'MountFlags='):
            self.assertNotIn(directive, unit)
        self.assertIn('NoNewPrivileges=true', unit)
        self.assertIn('KillMode=mixed', unit)



class TransferChain(unittest.TestCase):
    def job(self, readback=b'synthetic stream', restore_failure=False):
        job = object.__new__(service.Job)
        job.run_id = 'a' * 32
        job.expected = {}
        job.config = {'manifestSha256': 'b' * 64, 'credentialGeneration': 'reviewed'}
        job.bindings = {str(service.CORE): 'c' * 64}
        job.gate = mock.Mock()
        job.check_repository = mock.Mock()
        job.restic = mock.Mock(return_value=json.dumps({'message_type': 'summary', 'snapshot_id': 'd' * 64}).encode())
        job.children = []
        def child(arguments):
            value = readback if not job.children else b'synthetic stream'
            result = subprocess.Popen([sys.executable, '-B', '-I', '-c', 'import os; os.write(1,' + repr(value) + ')'],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
            job.children.append(result)
            return result
        job.restic_child = child
        expected = {'sha256': hashlib.sha256(b'synthetic stream').hexdigest(), 'bytes': len(b'synthetic stream')}
        result = {'status': 'ALL_THREE_DATABASES_GLOBALS_AND_REQUIRED_FILES_IDENTICAL', 'runId': job.run_id,
                  'probeContainerRemoved': True}
        def restore(run_id, outer, manifest, reader):
            while reader.read(131072):
                pass
            if restore_failure:
                raise RuntimeError('RESTORED_BYTES_OR_METADATA_MISMATCH')
            return result
        job.core = types.SimpleNamespace(stream_capture=mock.Mock(return_value=expected),
            restore_from_offhost=mock.Mock(side_effect=restore), cleanup_workspace=mock.Mock(return_value={'clean': True}),
            verify_final=mock.Mock(return_value={'healthy': True}), put=mock.Mock(),
            paths=lambda *args: (Path('/unused'), Path('/unused')))
        return job

    def capture(self, job):
        return {'runId': job.run_id, 'sourceResumed': True, 'manifestSha256': 'e' * 64}

    def test_success_needs_full_readback_restore_cleanup_and_final_health(self):
        job = self.job()
        proof = job.transfer_restore(self.capture(job))
        self.assertEqual(proof['status'], 'FULL_BACKUP_OFFHOST_READBACK_RESTORE_CLEANUP_PASS')
        self.assertIn('capture', proof)
        self.assertIn('finalHealth', proof)
        job.core.restore_from_offhost.assert_called_once()
        job.core.cleanup_workspace.assert_called_once_with(job.run_id, 'capture')
        job.core.verify_final.assert_called_once()
        job.core.put.assert_called_once()
        self.assertTrue(all(child.poll() == 0 and child.stdout.closed for child in job.children))

    def test_readback_mismatch_cannot_reach_restore_or_pass(self):
        job = self.job(readback=b'corrupted')
        with self.assertRaisesRegex(RuntimeError, 'OFFHOST_READBACK_MISMATCH'):
            job.transfer_restore(self.capture(job))
        job.core.restore_from_offhost.assert_not_called()
        job.core.put.assert_not_called()
        self.assertTrue(all(child.poll() is not None and child.stdout.closed for child in job.children))

    def test_restore_mismatch_cannot_publish_proof_and_reaps_children(self):
        job = self.job(restore_failure=True)
        with self.assertRaisesRegex(RuntimeError, 'RESTORED_BYTES_OR_METADATA_MISMATCH'):
            job.transfer_restore(self.capture(job))
        job.core.put.assert_not_called()
        self.assertTrue(all(child.poll() is not None and child.stdout.closed for child in job.children))

    def test_backup_failure_cannot_reach_readback_or_restore(self):
        job = self.job()
        job.restic.side_effect = RuntimeError('RESTIC_FAILED')
        with self.assertRaisesRegex(RuntimeError, 'RESTIC_FAILED'):
            job.transfer_restore(self.capture(job))
        self.assertEqual(job.children, [])
        job.core.put.assert_not_called()


class StrictOuterStream(unittest.TestCase):
    def stream(self, run_id):
        import tarfile
        files = {db + suffix for db in core.DATABASES for suffix in ('.dump', '.sql')} | {'globals.sql', 'images.tar'} | {name + '.tar' for name in core.VOLUMES} | {'config-' + str(i) + '.tar' for i in range(3)}
        manifest = {'runId': run_id, 'hostname': 'catering-prod-02', 'databases': core.DATABASES,
                    'images': ['sha256:' + '1' * 64], 'pgImage': 'sha256:' + '1' * 64,
                    'indices': {key: [] for key in (*core.VOLUMES, 'config-0', 'config-1', 'config-2')},
                    'files': {name: {'bytes': 1, 'sha256': hashlib.sha256(b'x').hexdigest()} for name in files}}
        body = json.dumps(manifest).encode()
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w', format=tarfile.USTAR_FORMAT) as archive:
            for name, data in [('manifest.json', body), *((name, b'x') for name in sorted(files))]:
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return output.getvalue(), hashlib.sha256(body).hexdigest()

    def test_complete_three_database_eight_tree_archive_and_whole_hash(self):
        run_id = 'a' * 32
        stream, manifest_hash = self.stream(run_id)
        with tempfile.TemporaryDirectory() as directory:
            result = core.receive_outer(io.BytesIO(stream), Path(directory), run_id, hashlib.sha256(stream).hexdigest(), manifest_hash)
            self.assertEqual(len(result['files']), 16)
            self.assertEqual(len(result['indices']), 8)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'RESTORED_WHOLE_STREAM_HASH_MISMATCH'):
                core.receive_outer(io.BytesIO(stream), Path(directory), run_id, 'f' * 64, manifest_hash)

    def test_core_restore_failure_still_cleans_only_own_probe_and_workspace(self):
        run_id = 'a' * 32
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with mock.patch.object(core, 'assert_host'), mock.patch.object(core, 'workspace', return_value=(root, root)), \
                 mock.patch.object(core.Path, 'read_text', return_value='MemAvailable: 999999999 kB\n'), \
                 mock.patch.object(core, 'receive_outer', return_value={}), \
                 mock.patch.object(core, 'verify_restored', side_effect=RuntimeError('FULL_THREE_DATABASES_OR_GLOBALS_MISMATCH')), \
                 mock.patch.object(core, 'cleanup_probe') as probe, mock.patch.object(core, 'cleanup_workspace') as workspace:
                with self.assertRaisesRegex(RuntimeError, 'FULL_THREE_DATABASES_OR_GLOBALS_MISMATCH'):
                    core.restore_from_offhost(run_id, 'b' * 64, 'c' * 64, io.BytesIO())
                probe.assert_called_once_with('catering-nue-restore-' + run_id, run_id)
                workspace.assert_called_once_with(run_id, 'restore')


class CoreSchedulerCompatibility(unittest.TestCase):
    def setUp(self):
        self.rows = [{'Name': '/' + name, 'Id': name + '-id', 'Image': 'sha256:image', 'Mounts': [],
                      'State': {'Running': True}, 'HostConfig': {'RestartPolicy': {'Name': 'always'}}}
                     for name in core.NAMES]
        self.expected = {'runtimeEnvSha256': 'a' * 64, 'containers': [
            {'name': row['Name'], 'id': row['Id'], 'image': row['Image'], 'mounts': row['Mounts'],
             'restart': row['HostConfig']['RestartPolicy']} for row in self.rows]}
        self.catalogue = {'databases': sorted(core.DATABASES), 'prepared': 0, 'externalTablespaces': 0}
        self.cron = types.SimpleNamespace(returncode=1, stdout=b'')

    def command(self, argv, **kwargs):
        if argv[:3] == ['docker', 'ps', '-aq']:
            return '\n'.join(row['Id'] for row in self.rows).encode()
        if argv[:2] == ['docker', 'diff']:
            return b''
        if 'psql' in argv:
            return json.dumps(self.catalogue).encode()
        if '--version' in argv:
            return b'postgres (PostgreSQL) 17.9'
        if argv[0] == 'systemctl':
            return b'LoadState=loaded\nActiveState=activating\n'
        raise AssertionError(argv)

    def current(self, scheduler):
        with mock.patch.object(core, 'SCHEDULER_GATE', scheduler), mock.patch.object(core, 'digest', return_value='a' * 64), \
             mock.patch.object(core, 'inspect', return_value=self.rows), mock.patch.object(core, 'command', side_effect=self.command), \
             mock.patch.object(core.subprocess, 'run', return_value=self.cron), mock.patch.object(Path, 'iterdir', return_value=[]):
            return core.assert_current(self.expected)

    def test_only_scheduler_check_is_replaced_and_manual_stays_closed(self):
        with self.assertRaisesRegex(RuntimeError, 'SCHEDULER_STATE_CHANGED'):
            self.current(None)
        scheduler = mock.Mock()
        self.assertEqual(len(self.current(scheduler)), 7)
        scheduler.assert_called_once()
        self.cron = types.SimpleNamespace(returncode=0, stdout=b'foreign cron')
        with self.assertRaisesRegex(RuntimeError, 'ROOT_CRONTAB_PRESENT'):
            self.current(scheduler)

    def test_scheduler_exception_keeps_database_and_container_scope_gates(self):
        self.catalogue['prepared'] = 1
        with self.assertRaisesRegex(RuntimeError, 'DATABASE_SCOPE_CHANGED'):
            self.current(mock.Mock())
        self.catalogue['prepared'] = 0
        self.rows[0]['State']['Running'] = False
        with self.assertRaisesRegex(RuntimeError, 'CONTAINER_STATE_CHANGED'):
            self.current(mock.Mock())


if __name__ == '__main__':
    unittest.main()
