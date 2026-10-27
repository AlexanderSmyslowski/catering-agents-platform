"""NUE observer contracts with synthetic journals; no host or network access."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest import mock
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location('nue_observer', Path(__file__).resolve().parents[1] / 'catering-backup-observer.py')
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)
NOW = 1800004600
BOOT, INVOCATION, RUN = 'a' * 32, 'b' * 32, 'c' * 32
START = '7d4958e842da4a758f6c1cdc7b36dcc5'
SUCCESS = '7ad2d189f7e94e70a38c781354912448'
DONE = '39f53479d3a045ac8e11786248231fbf'


def row(seconds, event=None, message=None, invocation=INVOCATION):
    value = dict(_BOOT_ID=BOOT, __REALTIME_TIMESTAMP=str((NOW + seconds) * 1000000),
                 __MONOTONIC_TIMESTAMP=str((10000 + seconds) * 1000000), __CURSOR=str(seconds))
    if event:
        value.update(_PID='1', _UID='0', _EXE='/usr/lib/systemd/systemd', _COMM='systemd',
                     _TRANSPORT='journal', _SYSTEMD_UNIT='init.scope', _SYSTEMD_CGROUP='/init.scope',
                     UNIT='catering-backup.service', INVOCATION_ID=invocation, MESSAGE_ID=event,
                     JOB_ID='42', JOB_TYPE='start', JOB_RESULT='done')
    else:
        value.update(_PID='123', _UID='0', _EXE='/usr/bin/python3.12', _COMM='python3',
                     _TRANSPORT='stdout', _SYSTEMD_UNIT='catering-backup.service',
                     _SYSTEMD_CGROUP='/system.slice/catering-backup.service',
                     _SYSTEMD_INVOCATION_ID=invocation, MESSAGE=json.dumps(message))
    return value


class JournalContracts(unittest.TestCase):
    def setUp(self):
        self.units = {'nue_boot': BOOT, 'nue_journal': [row(-1000, START),
            row(-800, message={'status': 'FULL_BACKUP_OFFHOST_READBACK_RESTORE_CLEANUP_PASS', 'runId': RUN}),
            row(-799, SUCCESS), row(-798, DONE)],
            'backup': {'ActiveState': 'inactive', 'SubState': 'dead', 'MainPID': '0',
                'InvocationID': '', 'ExecMainPID': '0', 'ExecMainCode': '0', 'ExecMainStatus': '0',
                'Result': 'success', 'ExecMainStartTimestamp': '', 'ExecMainExitTimestamp': ''}}

    def test_gc_requires_real_pid1_completion_and_source_time_is_run_start(self):
        cycle = observer.nue_cycle(self.units, NOW)
        self.assertEqual(cycle['runId'], RUN)
        self.assertEqual(cycle['created'], NOW - 1000)
        self.assertEqual(cycle['verified'], NOW - 800)

    def test_missing_or_incomplete_journal_never_makes_gc_a_success(self):
        for rows in ([], self.units['nue_journal'][:-1], self.units['nue_journal'][1:]):
            with self.subTest(rows=len(rows)), self.assertRaises(ValueError):
                observer.nue_cycle(dict(self.units, nue_journal=rows), NOW)

    def test_process_cannot_spoof_pid1_completion(self):
        self.units['nue_journal'][-1]['_PID'] = '123'
        with self.assertRaises(ValueError): observer.nue_cycle(self.units, NOW)

    def test_retained_mainpid_mismatch_and_running_budget_rejected(self):
        self.units['backup']['ExecMainPID'] = '456'
        with self.assertRaises(ValueError): observer.nue_cycle(self.units, NOW)
        self.units['backup']['ExecMainPID'] = '0'
        self.units['nue_journal'].append(row(-100, START, invocation='d' * 32))
        self.units['backup'].update(ActiveState='activating', MainPID='456', InvocationID='d' * 32)
        self.assertEqual(observer.nue_cycle(self.units, NOW)['runId'], RUN)
        with self.assertRaises(ValueError): observer.nue_cycle(self.units, NOW + 6601)

    def test_metadata_output_is_bounded_and_owned_children_reaped(self):
        with self.assertRaisesRegex(ValueError, 'METADATA_BUDGET'):
            observer.bounded_metadata([sys.executable, '-I', '-c', 'import os;os.write(1,b"x"*300000)'])
        self.assertFalse(observer.CHILD_GROUPS)

    def test_shared_metadata_deadline_still_reaps_an_incomplete_worker(self):
        with self.assertRaisesRegex(ValueError, 'METADATA_TIMEOUT'):
            observer.bounded_metadata([sys.executable, '-I', '-c', 'import time; time.sleep(5)'],
                                      deadline=time.monotonic() + .05)
        self.assertFalse(observer.CHILD_GROUPS)

    def test_large_versioned_source_does_not_raise_private_record_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve() / 'source'
            path.write_bytes(b'synthetic' * 9000)
            path.chmod(0o600)
            with mock.patch.object(observer, 'OWNER_UID', os.getuid()), mock.patch.object(observer, 'OWNER_GID', os.getgid()):
                records = observer.Records()
                self.assertEqual(len(records.read(path, private=False)), 81000)
                records.stable()
                with self.assertRaisesRegex(ValueError, 'PROTECTION_INVALID'): observer.protected(path)

    def test_nue_calendar_clock_and_latched_failure_remain_mandatory(self):
        stamp = lambda value: datetime.fromtimestamp(value, timezone.utc).strftime('%a %Y-%m-%d %H:%M:%S UTC')
        self.units['backup'].update(LoadState='loaded', FragmentPath='/etc/systemd/system/catering-backup.service', DropInPaths='', NeedDaemonReload='no')
        self.units.update(clock={'NTPSynchronized': 'yes'}, legacy={'LoadState': 'not-found', 'ActiveState': 'inactive'},
            timer={'LoadState': 'loaded', 'FragmentPath': '/etc/systemd/system/catering-backup.timer', 'DropInPaths': '', 'NeedDaemonReload': 'no',
                'ActiveState': 'active', 'UnitFileState': 'enabled', 'Persistent': 'yes', 'AccuracyUSec': '1min', 'RandomizedDelayUSec': '0',
                'TimersCalendar': '{ OnCalendar=*-*-* 00,03,06,09,12,15,18,21:00:00 UTC ; next_elapse=synthetic }',
                'ActiveEnterTimestamp': stamp(NOW - 2000), 'LastTriggerUSec': stamp(NOW - 1000)})
        observer.nue_service_health(self.units, NOW, NOW - 1000, NOW - 800, 0)
        with self.assertRaisesRegex(ValueError, 'FAILURE_LATCHED'):
            observer.nue_service_health(self.units, NOW, NOW - 1000, NOW - 800, NOW - 1000)
        self.units['nue_journal'][0]['__REALTIME_TIMESTAMP'] = str((NOW - 1000) * 1000000 + 500000)
        with self.assertRaisesRegex(ValueError, 'FAILURE_LATCHED'):
            observer.nue_service_health(self.units, NOW, NOW - 1000 + .5, NOW - 800, NOW - 1000)
        self.units['nue_journal'][0]['__REALTIME_TIMESTAMP'] = str((NOW - 1000) * 1000000)
        with self.assertRaisesRegex(ValueError, 'CYCLE_MISSING'):
            observer.nue_service_health(self.units, NOW + 10101, NOW - 1000, NOW - 800, 0)
        self.units['clock']['NTPSynchronized'] = 'no'
        with self.assertRaisesRegex(ValueError, 'CLOCK_UNSYNCED'):
            observer.nue_service_health(self.units, NOW, NOW - 1000, NOW - 800, 0)

    def test_new_failure_overrides_old_pass_even_with_collected_unit(self):
        self.units['nue_journal'] += [row(-100, START, invocation='d' * 32), row(-90, 'be02cf6855d2428ba40df7e9d022f03d', invocation='d' * 32)]
        self.assertEqual(observer.nue_service_failure(self.units, NOW), NOW - 100)
        with self.assertRaises(ValueError): observer.nue_cycle(self.units, NOW)

    def test_future_reordered_foreign_boot_and_duplicate_rows_rejected(self):
        for change in ('future', 'order', 'boot', 'duplicate'):
            units = copy.deepcopy(self.units)
            if change == 'future': units['nue_journal'][-1]['__REALTIME_TIMESTAMP'] = str((NOW + 1) * 1000000)
            if change == 'order': units['nue_journal'][1:3] = list(reversed(units['nue_journal'][1:3]))
            if change == 'boot': units['nue_journal'][0]['_BOOT_ID'] = 'e' * 32
            if change == 'duplicate': units['nue_journal'].append(units['nue_journal'][-1])
            with self.subTest(change=change), self.assertRaises(ValueError): observer.nue_cycle(units, NOW)

    def test_current_provider_hostname_is_supported_without_redirect_or_userinfo(self):
        for host in ('uptime.betterstack.com', 'incidents.betterstack.com'):
            self.assertEqual(observer.heartbeat_url('https://' + host + '/api/v1/heartbeat/SYNTHETIC').hostname, host)
        for url in ('https://evil.example/api/v1/heartbeat/SYNTHETIC',
                    'https://user@incidents.betterstack.com/api/v1/heartbeat/SYNTHETIC',
                    'https://incidents.betterstack.com/api/v1/heartbeat/SYNTHETIC?redirect=1'):
            with self.assertRaises(ValueError): observer.heartbeat_url(url)


class ObservationSnapshotContracts(unittest.TestCase):
    def setUp(self):
        fixture = JournalContracts()
        fixture.setUp()
        self.units = fixture.units
        self.running = dict(self.units['backup'], ActiveState='activating', MainPID='456', InvocationID='d' * 32)
        self.journal = self.units['nue_journal'] + [row(-1, START, invocation='d' * 32)]

    def observe(self, backups, timers=None):
        backups = iter(backups)
        timers = iter(timers or [{'LastTriggerUSec': 'stable'}] * 4)
        def metadata(argv, **kwargs):
            if argv[0] == '/usr/bin/journalctl':
                return b'\n'.join(json.dumps(item).encode() for item in self.journal)
            if argv[0] == '/usr/bin/timedatectl':
                return b'NTPSynchronized=yes\n'
            unit = argv[2]
            value = next(backups) if unit == 'catering-backup.service' else next(timers) if unit == 'catering-backup.timer' else {'LoadState': 'not-found'}
            return ''.join(k + '=' + v + '\n' for k, v in value.items()).encode()
        with mock.patch.object(observer, 'bounded_metadata', side_effect=metadata), \
             mock.patch.object(Path, 'read_text', return_value=BOOT):
            return observer.get_nue_units()

    def test_start_between_unit_and_journal_reads_uses_one_new_consistent_snapshot(self):
        units = self.observe([self.units['backup'], self.running, self.running, self.running])
        self.assertEqual(units['backup']['InvocationID'], 'd' * 32)
        self.assertEqual(observer.nue_cycle(units, NOW)['runId'], RUN)

    def test_timer_trigger_between_reads_is_reobserved_with_the_backup(self):
        units = self.observe([self.running] * 4, [{'LastTriggerUSec': 'old'}, {'LastTriggerUSec': 'new'},
                                                {'LastTriggerUSec': 'new'}, {'LastTriggerUSec': 'new'}])
        self.assertEqual(units['timer']['LastTriggerUSec'], 'new')
        self.assertEqual(observer.nue_cycle(units, NOW)['runId'], RUN)

    def test_continuously_changing_unit_stays_unknown_after_one_retry(self):
        with self.assertRaisesRegex(ValueError, 'UNIT_SNAPSHOT_UNSTABLE'):
            self.observe([self.units['backup'], self.running, self.units['backup'], self.running])


class ProofContracts(unittest.TestCase):
    def setUp(self):
        JournalContracts.setUp(self)
        sha = observer.sha
        self.policy = {'bindings': {'scope': observer.SCOPE, 'host_binding': sha(socket.gethostname().split('.')[0].encode())},
            'nue': {'credentialGeneration': 'synthetic', 'installedManifestSha256': '1' * 64,
            'files': {p: sha(b'fixed') for p in ('/usr/local/libexec/catering-nue-core.py',
                '/usr/local/libexec/catering-nue-service.py', '/usr/local/libexec/catering-backup-common.sh',
                '/etc/systemd/system/catering-backup.service', '/etc/systemd/system/catering-backup.timer')}}}
        self.source_files = {p: b'fixed' for p in self.policy['nue']['files']}
        for p in ('/usr/local/libexec/catering-backup-observer.py', '/etc/cron.d/catering-backup-monitor',
                  '/etc/catering-backup-monitor/policy.json', '/etc/catering-backup-monitor/heartbeat-url'):
            self.source_files[p] = b'fixed'
        self.config = {'credentialGeneration': 'synthetic', 'timerState': 'active', 'manifestSha256': '1' * 64,
            'files': self.policy['nue']['files'], 'expectedCore': {'observerFiles': {p: sha(self.source_files[p]) for p in self.source_files if p not in self.policy['nue']['files']}},
            'installedSnapshot': {'containers': {f'synthetic-{i}': {'id': str(i), 'image': 'image', 'restart': {'Name': 'always'}} for i in range(7)}}}
        config_bytes = json.dumps(self.config).encode()
        self.source_files['/etc/catering-backup/nue-service.json'] = config_bytes
        self.config_hash = sha(config_bytes)
        self.source_files['/etc/catering-backup/nue-generation.json'] = json.dumps({'configSha256': self.config_hash, 'credentialGeneration': 'synthetic'}).encode()
        cleanup = lambda phase: {'status': 'OWN_TMPFS_UNMOUNTED', 'runId': RUN, 'phase': phase}
        restored = {'status': 'ALL_THREE_DATABASES_GLOBALS_AND_REQUIRED_FILES_IDENTICAL', 'runId': RUN,
            'databases': 3, 'fileTrees': 8, 'probeContainerRemoved': True, 'manifestSha256': '2' * 64, 'outerSha256': '3' * 64}
        result = {'status': observer.NUE_PASS, 'runId': RUN, 'installedManifestSha256': '1' * 64,
            'credentialGeneration': 'synthetic', 'remoteSourceSha256': sha(b'fixed'),
            'serviceInvocation': {'id': INVOCATION, 'mainPid': '123', 'bootId': BOOT, 'configSha256': self.config_hash},
            'capture': {'runId': RUN, 'sourceResumed': True, 'manifestSha256': '2' * 64, 'files': ['synthetic'] * 17},
            'manifestSha256': '2' * 64, 'snapshotId': '4' * 64, 'outer': {'sha256': '3' * 64, 'bytes': 100},
            'restore': restored, 'captureCleanup': cleanup('capture'),
            'finalHealth': {'status': 'ORIGINAL_SEVEN_CONTAINERS_POLICIES_DATABASE_SCOPE_AND_HTTPS_HEALTHY'},
            'at': datetime.fromtimestamp(NOW - 801, timezone.utc).isoformat()}
        self.documents = {'service-proof.json': result, 'capture.json': {'status': 'CAPTURED_NOT_YET_RESTORED', 'runId': RUN, 'files': 16, 'manifestSha256': '2' * 64},
            'resume.json': {'status': 'ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED', 'runId': RUN},
            'restore.json': copy.deepcopy(restored), 'capture-cleanup.json': cleanup('capture'), 'restore-cleanup.json': cleanup('restore'),
            'original-state.json': [{'Name': '/synthetic-' + str(i), 'Id': str(i), 'Image': 'image', 'State': {'Running': True}, 'HostConfig': {'RestartPolicy': {'Name': 'always'}}} for i in range(7)]}

    def proof(self):
        def read(path, private=True):
            if str(path) in self.source_files:
                return self.source_files[str(path)]
            return json.dumps(self.documents[Path(path).name]).encode()
        metadata = types.SimpleNamespace(st_mode=stat.S_IFDIR | 0o700, st_uid=observer.OWNER_UID, st_gid=observer.OWNER_GID)
        with mock.patch.object(Path, 'lstat', return_value=metadata), mock.patch.object(os.path, 'lexists', return_value=False), \
             mock.patch.object(observer, 'attestation_deadline', side_effect=lambda r,p,n,d:d):
            return observer.nue_proof(types.SimpleNamespace(read=read), self.policy, NOW, self.units)

    def test_complete_proof_age_starts_before_capture_not_after_restore(self):
        self.assertEqual(self.proof(), (NOW - 1000, NOW - 800, NOW - 1000 + 21600))

    def test_missing_cleanup_wrong_database_count_and_different_main_process_rejected(self):
        for kind in ('cleanup', 'databases', 'pid', 'config', 'original', 'snapshot'):
            before = copy.deepcopy(self.documents)
            if kind == 'cleanup': self.documents['restore-cleanup.json']['runId'] = 'f' * 32
            if kind == 'databases': self.documents['restore.json']['databases'] = 2
            if kind == 'pid': self.documents['service-proof.json']['serviceInvocation']['mainPid'] = '456'
            if kind == 'config': self.documents['service-proof.json']['serviceInvocation']['configSha256'] = 'f' * 64
            if kind == 'original': self.documents['original-state.json'][0]['Id'] = 'foreign'
            if kind == 'snapshot': self.documents['service-proof.json']['snapshotId'] = 'invalid'
            with self.subTest(kind=kind), self.assertRaises(ValueError): self.proof()
            self.documents = before


class CronContracts(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('nue_core_observer_test', Path(__file__).resolve().parents[1] / 'catering-nue-core.py')
        self.core = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.core)
        self.files = {p: 'a' * 64 for p in ('/usr/local/libexec/catering-backup-observer.py', '/etc/cron.d/catering-backup-monitor',
            '/etc/catering-backup-monitor/policy.json', '/etc/catering-backup-monitor/heartbeat-url')}

    def test_unconfigured_manual_and_foreign_cron_stay_closed(self):
        with mock.patch.object(Path, 'iterdir', return_value=[Path('catering-backup-monitor')]):
            with self.assertRaises(RuntimeError): self.core.observer_cron_admission({})
            with self.assertRaises(RuntimeError): self.core.observer_cron_admission({'observerFiles': self.files})
        with mock.patch.object(self.core, 'SCHEDULER_GATE', lambda:None), mock.patch.object(Path, 'iterdir', return_value=[Path('foreign')]), \
             mock.patch.object(Path, 'lstat', return_value=types.SimpleNamespace(st_mode=0o600)), mock.patch.object(self.core, 'verify_bound_regular_file'):
            with self.assertRaisesRegex(RuntimeError, 'CRON_SCOPE_CHANGED'):
                self.core.observer_cron_admission({'observerFiles': self.files})

    def test_only_exact_bound_observer_files_are_allowed(self):
        with mock.patch.object(self.core, 'SCHEDULER_GATE', lambda:None), mock.patch.object(Path, 'iterdir', return_value=[Path('catering-backup-monitor')]), \
             mock.patch.object(Path, 'lstat', return_value=types.SimpleNamespace(st_mode=0o600)), mock.patch.object(self.core, 'verify_bound_regular_file') as verify:
            self.core.observer_cron_admission({'observerFiles': self.files})
            self.assertEqual(verify.call_count, 4)
            verify.side_effect = RuntimeError('BOUND_FILE_CHANGED')
            with self.assertRaisesRegex(RuntimeError, 'BOUND_FILE_CHANGED'):
                self.core.observer_cron_admission({'observerFiles': self.files})


class MainProcessContracts(unittest.TestCase):
    def test_receipt_requires_current_service_mainpid(self):
        spec = importlib.util.spec_from_file_location('nue_service_observer_test', Path(__file__).resolve().parents[1] / 'catering-nue-service.py')
        service = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(service)
        job = object.__new__(service.Job)
        job.marker = {'configSha256': 'a' * 64}
        unit = {'InvocationID': INVOCATION, 'MainPID': str(os.getpid()), 'ActiveState': 'activating', 'SubState': 'start'}
        with mock.patch.dict(os.environ, {'INVOCATION_ID': INVOCATION}), mock.patch.object(service, 'properties', return_value=unit), \
             mock.patch.object(Path, 'read_text', return_value=BOOT):
            self.assertEqual(job.invocation_receipt()['mainPid'], str(os.getpid()))
            unit['MainPID'] = '1'
            with self.assertRaisesRegex(RuntimeError, 'PASS_MAINPID_REQUIRED'): job.invocation_receipt()


class VersionDispatchContracts(unittest.TestCase):
    def near_start(self, *, send=False, precise_now=None, precise_times=None, future=False,
                   main_pid='456', failed=False, second_failure=False, closed_window=False):
        path = Path(__file__).resolve().parents[3] / 'tests/catering_backup_observer_test.py'
        spec = importlib.util.spec_from_file_location('near_start_observer_fixture', path)
        legacy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(legacy)
        fixture = legacy.ObserverContracts('test_complete_proof_is_healthy_without_transport')
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        m = fixture.module
        clock = 1800003600  # Exact regular three-hour boundary.
        precise_now = clock + .75 if precise_now is None else precise_now
        fixed_root = Path('/var/lib/catering-backup-monitor')
        fixture.policy.update(version=2, state_root=str(fixed_root))
        fixture.save_policy()
        fixture.write(fixture.state / 'armed', b'NUE_OBSERVER_ARMED\n')
        journal = JournalContracts()
        journal.setUp()
        units = journal.units
        for entry in units['nue_journal']:
            entry['__REALTIME_TIMESTAMP'] = str(int(entry['__REALTIME_TIMESTAMP']) - 1000 * 1000000)
        started = row(0, START, invocation='d' * 32)
        started['__REALTIME_TIMESTAMP'] = str(int((clock + (2 if future else .5)) * 1000000))
        units['nue_journal'].append(started)
        units['backup'].update(ActiveState='activating', MainPID=main_pid, InvocationID='d' * 32,
                              LoadState='loaded', FragmentPath='/etc/systemd/system/catering-backup.service',
                              DropInPaths='', NeedDaemonReload='no')
        units.update(clock={'NTPSynchronized': 'yes'}, legacy={'LoadState': 'not-found', 'ActiveState': 'inactive'},
            timer={'LoadState': 'loaded', 'FragmentPath': '/etc/systemd/system/catering-backup.timer',
                'DropInPaths': '', 'NeedDaemonReload': 'no', 'ActiveState': 'active', 'UnitFileState': 'enabled',
                'Persistent': 'yes', 'AccuracyUSec': '1min', 'RandomizedDelayUSec': '0',
                'TimersCalendar': '{ OnCalendar=*-*-* 00,03,06,09,12,15,18,21:00:00 UTC ; next_elapse=synthetic }',
                'ActiveEnterTimestamp': legacy.system_stamp(clock - 2000), 'LastTriggerUSec': legacy.system_stamp(clock)})
        if failed or second_failure:
            failed_units = copy.deepcopy(units)
            failure = row(1, 'be02cf6855d2428ba40df7e9d022f03d', invocation='d' * 32)
            failure['__REALTIME_TIMESTAMP'] = str(int((clock + (.85 if second_failure else .6)) * 1000000))
            failed_units['nue_journal'].append(failure)
            failed_units['backup'].update(ActiveState='failed', MainPID='0', Result='exit-code', ExecMainStatus='1')
            if failed:
                units = failed_units
        def local_path(value):
            value = Path(value)
            return fixture.state / value.relative_to(fixed_root) if value == fixed_root or fixed_root in value.parents else value
        delivered = []
        def transport(url, healthy, seconds, cutoff=None, diagnostic=None):
            delivered.append(healthy)
            if not healthy:
                self.assertEqual(diagnostic['backup_health'], 'critical')
                self.assertIn(diagnostic['reason'], ('SERVICE_FAILED', 'SERVICE_UNKNOWN', 'JOURNAL_ORDER_INVALID'))
            if closed_window:
                raise ValueError('PING_WINDOW_CLOSED')
            return True
        with mock.patch.object(m, 'Path', side_effect=local_path), \
             mock.patch.object(m, 'utc_now', return_value=clock), \
             mock.patch.object(m.time, 'time', return_value=precise_now, side_effect=precise_times), \
             mock.patch.object(m, 'get_nue_units', return_value=units,
                               side_effect=[units, failed_units] if second_failure else None), \
             mock.patch.object(m, 'nue_proof', return_value=(clock - 1000, clock - 800,
                               clock + (10000.25 if closed_window else 10000))), \
             mock.patch.object(m, 'transmit', side_effect=transport):
            result = m.run(fixture.policy_path, send=send)
        return result, delivered, (fixture.state / 'state').read_text()

    def test_nue_run_accepts_real_start_after_coarse_initial_clock(self):
        result, delivered, _ = self.near_start()
        self.assertEqual(result['backup_health'], 'healthy')
        self.assertEqual(result['data_epoch'], 1800002600)
        self.assertEqual(delivered, [])

    def test_nue_sender_rechecks_fractional_start_without_false_fail_signal(self):
        result, delivered, state = self.near_start(send=True)
        self.assertEqual(result['backup_health'], 'healthy')
        self.assertEqual(delivered, [True])
        self.assertIn('failure_epoch=0\n', state)
        self.assertIn('last_seen_epoch=1800003600\n', state)

    def test_nue_run_still_rejects_a_row_after_actual_observation_time(self):
        result, delivered, _ = self.near_start(send=True, future=True)
        self.assertEqual(result['reason'], 'JOURNAL_ORDER_INVALID')
        self.assertEqual(result['backup_health'], 'critical')
        self.assertEqual(delivered, [False])

    def test_nue_clock_rollback_during_metadata_is_not_a_healthy_observation(self):
        result, delivered, _ = self.near_start(precise_now=1800003599.75)
        self.assertEqual(result['reason'], 'CLOCK_ROLLBACK')
        self.assertNotEqual(result['backup_health'], 'healthy')
        self.assertEqual(delivered, [])

    def test_nue_sender_does_not_signal_healthy_after_recheck_clock_rollback(self):
        result, delivered, _ = self.near_start(send=True,
            precise_times=[1800003600.75, 1800003600.8, 1800003600.7])
        self.assertEqual(result['reason'], 'CLOCK_ROLLBACK')
        self.assertNotEqual(result['backup_health'], 'healthy')
        self.assertEqual(delivered, [])

    def test_nue_start_without_main_process_remains_critical(self):
        result, delivered, _ = self.near_start(send=True, main_pid='0')
        self.assertEqual(result['reason'], 'SERVICE_UNKNOWN')
        self.assertEqual(result['backup_health'], 'critical')
        self.assertEqual(delivered, [False])

    def test_real_failure_during_start_is_still_latched_and_signalled(self):
        result, delivered, state = self.near_start(send=True, failed=True)
        self.assertEqual(result['reason'], 'SERVICE_FAILED')
        self.assertEqual(result['backup_health'], 'critical')
        self.assertEqual(delivered, [False])
        self.assertIn('failure_epoch=1800003600\n', state)

    def test_failure_during_sender_recheck_keeps_the_integer_state_format(self):
        result, delivered, state = self.near_start(send=True, second_failure=True,
            precise_times=[1800003600.75, 1800003600.8, 1800003600.9])
        self.assertEqual(result['reason'], 'SERVICE_FAILED')
        self.assertEqual(delivered, [])
        self.assertIn('failure_epoch=1800003600\n', state)
        self.assertIn('last_seen_epoch=1800003600\n', state)
        self.assertIn('backup_health=critical', state)

    def test_closed_fractional_ping_window_preserves_the_observed_integer_watermark(self):
        result, _, state = self.near_start(send=True, closed_window=True)
        self.assertFalse(result['delivery_accepted'])
        self.assertIn('last_seen_epoch=1800013166\n', state)
        self.assertIn('failure_epoch=0\n', state)
        self.assertIn('backup_health=warning', state)

    def test_nue_check_uses_new_readers_without_network_or_state_writes(self):
        path = Path(__file__).resolve().parents[3] / 'tests/catering_backup_observer_test.py'
        spec = importlib.util.spec_from_file_location('legacy_observer_fixture', path)
        legacy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(legacy)
        fixture = legacy.ObserverContracts('test_complete_proof_is_healthy_without_transport')
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        fixture.policy['version'] = 2
        fixture.save_policy()
        before = (fixture.state / 'state').read_bytes()
        m = fixture.module
        with mock.patch.object(m.time, 'time', return_value=legacy.NOW), \
             mock.patch.object(m, 'get_units', side_effect=AssertionError('legacy reader used')), \
             mock.patch.object(m, 'get_nue_units', return_value={}), \
             mock.patch.object(m, 'nue_service_failure', return_value=0), \
             mock.patch.object(m, 'nue_proof', return_value=(legacy.NOW - 1000 + .75, legacy.NOW - 800, legacy.NOW + 10000)), \
             mock.patch.object(m, 'nue_service_health') as check, mock.patch.object(m, 'transmit') as transmit:
            result = m.run(fixture.policy_path, send=False)
        self.assertEqual(result['backup_health'], 'healthy')
        self.assertEqual(result['recipient_confirmed'], False)
        self.assertIs(type(result['data_epoch']), int)
        self.assertEqual(result['data_epoch'], legacy.NOW - 1000)
        check.assert_called_once()
        transmit.assert_not_called()
        self.assertEqual((fixture.state / 'state').read_bytes(), before)

    def test_unarmed_nue_cron_cannot_observe_publish_or_send(self):
        with mock.patch.object(observer.os, 'geteuid', return_value=observer.OWNER_UID), \
             mock.patch.object(observer.os, 'getegid', return_value=observer.OWNER_GID), \
             mock.patch.object(observer.Records, 'read', return_value=json.dumps({'version': 2, 'state_root': '/var/lib/catering-backup-monitor'}).encode()), \
             mock.patch.object(observer.os.path, 'lexists', return_value=False), \
             mock.patch.object(observer, 'get_nue_units') as observe, mock.patch.object(observer, 'publish_state') as publish, \
             mock.patch.object(observer, 'transmit') as transmit:
            result = observer.run('/synthetic/policy', send=True)
        self.assertEqual(result['reason'], 'OBSERVER_NOT_ARMED')
        observe.assert_not_called()
        publish.assert_not_called()
        transmit.assert_not_called()


class DiagnosticContracts(unittest.TestCase):
    def setUp(self):
        self.clock = mock.patch.object(observer, 'utc_now', return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.failure = dict(backup_health='critical', reason='SERVICE_FAILED', data_epoch=NOW - 1000,
                            delivery_accepted=False)

    def test_report_excludes_credentials_unknown_reasons_and_unbounded_values(self):
        report = observer.diagnostic_report(dict(self.failure, reason='SYNTHETIC_SECRET',
            observation_reason='https://secret.example/token', password='SYNTHETIC_SECRET',
            data_epoch=True, arbitrary='x' * 100000))
        encoded = json.dumps(report)
        self.assertLess(len(encoded), 512)
        self.assertNotIn('SYNTHETIC_SECRET', encoded)
        self.assertNotIn('secret.example', encoded)
        self.assertEqual(report['reason'], 'OBSERVER_FAILED')
        self.assertIsNone(report['data_epoch'])
        self.assertEqual(report['checked_at_epoch'], NOW)
        for invalid in (['SERVICE_FAILED'], {'token': 'SYNTHETIC_SECRET'}, None):
            self.assertEqual(observer.diagnostic_report({'reason': invalid})['reason'], 'OBSERVER_FAILED')

    def test_failure_request_contains_diagnosis_and_healthy_request_stays_bodyless(self):
        connection = mock.MagicMock()
        connection.getresponse.return_value.status = 200
        url = 'https://incidents.betterstack.com/api/v1/heartbeat/SYNTHETIC_TOKEN'
        with mock.patch.object(observer.http.client, 'HTTPSConnection', return_value=connection):
            self.assertTrue(observer.http_send(url, False, 5, diagnostic=self.failure))
            call = connection.request.call_args
            self.assertEqual(call.args, ('POST', '/api/v1/heartbeat/SYNTHETIC_TOKEN/fail'))
            report = json.loads(call.kwargs['body'])
            self.assertEqual(report['reason'], 'SERVICE_FAILED')
            self.assertEqual(report['data_epoch'], NOW - 1000)
            self.assertNotIn('SYNTHETIC_TOKEN', call.kwargs['body'].decode())
            observer.http_send(url, True, 5, diagnostic=self.failure)
            self.assertEqual(connection.request.call_args.args, ('GET', '/api/v1/heartbeat/SYNTHETIC_TOKEN'))
            self.assertEqual(connection.request.call_args.kwargs, {})

    def test_worker_keeps_secret_in_stdin_and_sends_only_closed_diagnostic_fields(self):
        url = 'https://incidents.betterstack.com/api/v1/heartbeat/SYNTHETIC_TOKEN'
        with mock.patch.object(observer.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as child:
            self.assertTrue(observer.transmit(url, False, 5, diagnostic=dict(self.failure, password='PRIVATE_VALUE')))
        args, kwargs = child.call_args
        self.assertNotIn('SYNTHETIC_TOKEN', repr(args) + repr(kwargs['env']))
        payload = json.loads(kwargs['input'])
        self.assertEqual(payload[0], url)
        self.assertEqual(payload[4]['reason'], 'SERVICE_FAILED')
        self.assertNotIn('PRIVATE_VALUE', kwargs['input'].decode())
        self.assertEqual(kwargs['timeout'], 5)

    def test_journal_retains_observation_reason_when_delivery_fails(self):
        outcome = dict(self.failure, reason='DELIVERY_FAILED', observation_reason='SERVICE_FAILED')
        with mock.patch.object(observer.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as logger:
            self.assertTrue(observer.journal_outcome(outcome))
        args, kwargs = logger.call_args
        self.assertEqual(args[0][:4], ['/usr/bin/logger', '-t', 'catering-backup-observer', '--'])
        report = json.loads(args[0][-1])
        self.assertEqual(report['reason'], 'DELIVERY_FAILED')
        self.assertEqual(report['observation_reason'], 'SERVICE_FAILED')
        self.assertEqual(kwargs['timeout'], 1)

    def test_logging_failure_never_changes_a_failure_to_success(self):
        with mock.patch.object(observer, 'journal_outcome', return_value=False), mock.patch('builtins.print') as output:
            self.assertEqual(observer.finish(self.failure), 1)
        report = json.loads(output.call_args.args[0])
        self.assertFalse(report['diagnostic_logged'])
        self.assertEqual(report['reason'], 'SERVICE_FAILED')

    def test_read_only_check_and_healthy_signal_do_not_write_failure_logs(self):
        with mock.patch.object(observer, 'journal_outcome') as journal, mock.patch('builtins.print'):
            self.assertEqual(observer.finish(self.failure, check=True), 1)
            self.assertEqual(observer.finish(dict(self.failure, backup_health='healthy',
                                                reason='HEALTHY', delivery_accepted=True)), 0)
        journal.assert_not_called()

    def test_logger_timeout_or_error_is_bounded_and_does_not_escape(self):
        for error in (subprocess.TimeoutExpired('logger', 1), OSError('SYNTHETIC_SECRET')):
            with self.subTest(error=type(error).__name__), \
                 mock.patch.object(observer.subprocess, 'run', side_effect=error), mock.patch('builtins.print') as output:
                self.assertFalse(observer.journal_outcome(self.failure))
                output.assert_not_called()

    def test_failed_delivery_preserves_original_monitor_failure(self):
        path = Path(__file__).resolve().parents[3] / 'tests/catering_backup_observer_test.py'
        spec = importlib.util.spec_from_file_location('diagnostic_sender_fixture', path)
        legacy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(legacy)
        fixture = legacy.ObserverContracts('test_complete_proof_is_healthy_without_transport')
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        fixture.units['backup'].update(Result='exit-code', ActiveState='failed', ExecMainStatus='1')
        with mock.patch.object(fixture.module, 'transmit', return_value=False) as send:
            result = fixture.check(send=True)
        self.assertEqual(result['reason'], 'DELIVERY_FAILED')
        self.assertEqual(result['observation_reason'], 'SERVICE_FAILED')
        self.assertEqual(send.call_args.kwargs['diagnostic']['reason'], 'SERVICE_FAILED')


if __name__ == '__main__': unittest.main()
