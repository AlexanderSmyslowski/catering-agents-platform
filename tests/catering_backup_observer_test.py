"""Synthetic observer contracts; all service and HTTP boundaries are simulated."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import tempfile
import unittest
from unittest import mock
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / 'platform-infra/backup/catering-backup-observer.py'
NOW = 1789286400
SCOPE = 'postgres,sites,platform-caddy,shared-edge-caddy'
COMPONENTS = ['sites', 'platform_caddy_data', 'platform_caddy_config', 'shared_edge_caddyfile', 'shared_edge_caddy_data', 'shared_edge_caddy_config']


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
        def delayed(root, command, args, payload=None):
            result = original(root, command, args, payload)
            if 'atomic_write_record' in command:
                self.units['backup'].update(Result='exit-code', ExecMainStatus='1', ActiveState='failed')
            return result
        with mock.patch.object(self.module, 'shell', side_effect=delayed), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.check(send=True)
        self.assertFalse(any(call.args[1] for call in send.call_args_list))

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
        def refused(root, command, args, payload=None):
            if 'atomic_write_record' in command:
                raise OSError('SYNTHETIC_SECRET')
            return original(root, command, args, payload)
        with mock.patch.object(self.module, 'shell', side_effect=refused), \
             mock.patch.object(self.module, 'transmit', return_value=True) as send:
            self.assertFalse(self.check(send=True)['delivery_accepted'])
        send.assert_not_called()

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
