"""Pure local contracts; never start Docker, PostgreSQL, or Restic."""
import importlib.util
import copy
import hashlib
import io
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest import mock
import os
import signal
import shlex
import time

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / 'tests/integration/catering_backup_tools.py'


class IntegrationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if MODULE.exists():
            spec = importlib.util.spec_from_file_location('integration', MODULE)
            cls.integration = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.integration)

    def implementation(self):
        self.assertTrue(MODULE.is_file(), 'isolated component harness is missing')
        return self.integration

    def test_local_execution_is_rejected_before_tools(self):
        m = self.implementation()
        with self.assertRaisesRegex(m.GateError, 'RUNTIME'):
            m.runtime_guard({}, {}, 'Darwin')

    def test_real_entry_rejects_accidental_local_invocation_without_tools(self):
        self.implementation()
        result = subprocess.run([sys.executable, '-B', str(MODULE)], env={},
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout), {'status': 'failed', 'error': 'RUNTIME_ISOLATION'})
        self.assertEqual(result.stderr, '')

    def test_every_required_runtime_binding_fails_closed(self):
        m = self.implementation()
        env = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted',
               'RUNNER_OS': 'Linux', 'GITHUB_REPOSITORY': m.REPOSITORY,
               'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REF': 'refs/pull/687/merge'}
        event = {'number': 687, 'pull_request': {'draft': True, 'head': {
            'ref': m.BRANCH, 'sha': 'a' * 40, 'repo': {'full_name': m.REPOSITORY}},
            'base': {'ref': 'main', 'repo': {'full_name': m.REPOSITORY}}}}
        self.assertEqual(m.runtime_guard(env, event, 'Linux'), 'a' * 40)
        for key in env:
            bad = dict(env); bad.pop(key)
            with self.subTest(key=key), self.assertRaises(m.GateError):
                m.runtime_guard(bad, event, 'Linux')
        for field, value in [('draft', False), ('head', {}), ('base', {})]:
            bad = copy.deepcopy(event); bad['pull_request'][field] = value
            with self.subTest(field=field), self.assertRaises(m.GateError):
                m.runtime_guard(env, bad, 'Linux')
        bad = copy.deepcopy(event); bad['number'] = 688
        with self.assertRaises(m.GateError):
            m.runtime_guard(env, bad, 'Linux')

    def test_execute_uses_tool_specific_versions_and_stops_on_version_failure(self):
        m = self.implementation()
        version_queries = [
            ('docker', 'version', '--format', '{{.Server.Version}}'),
            ('dpkg-query', '-W', '-f=${Version}', 'restic'),
            ('docker', '--version'),
            ('restic', 'version'),
        ]
        version_output = [b'27.5.1\n', b'0.16.4-2\n', b'Docker version 27.5.1\n',
                          b'restic 0.16.4 compiled with go1.22.2 on linux/amd64\n']
        pull = ('docker', 'pull', 'postgres:17')
        for failed_query in (None, ('docker', '--version'), ('restic', 'version')):
            with self.subTest(failed_query=failed_query), tempfile.TemporaryDirectory() as temp:
                resources = m.Resources(Path(temp).resolve())
                cleanup_queries = [('docker', 'ps', '-aq', '--filter', 'name=^/' + name + '$')
                                   for name in resources.names.values() for _ in range(2)]
                responses = {query: (17 if query == failed_query else 0, output)
                             for query, output in zip(version_queries, version_output)}
                # Model the CLI's rejection of the historical argv, and stop at
                # image acquisition even when all version queries succeed.
                responses[('restic', '--version')] = (1, b'')
                responses[pull] = (78, b'')
                responses.update({query: (0, b'') for query in cleanup_queries})
                calls, unexpected, processes = [], [], []

                def synthetic_process(args, **kwargs):
                    query = tuple(args)
                    calls.append(query)
                    if query not in responses:
                        unexpected.append(query)
                        raise AssertionError('unexpected command at controlled process boundary')
                    code, output = responses[query]
                    process = mock.Mock(returncode=code)
                    process.communicate.return_value = (output, b'')
                    processes.append(process)
                    return process

                def stop_synthetic_process(process, deadline=None):
                    self.assertIn(process, processes)
                    m.PROCESS_GROUPS.remove(process)

                output = io.StringIO()
                # Only execute's UID precondition is simulated. Every process
                # is intercepted; command's exit gate and execute's cleanup run.
                with mock.patch.object(m.os, 'geteuid', return_value=0), mock.patch.object(
                        m, 'Resources', return_value=resources), mock.patch.dict(m.MINIMAL_ENV), mock.patch.object(
                        m, 'PROCESS_GROUPS', resources.processes), mock.patch.object(
                        m.subprocess, 'Popen', side_effect=synthetic_process), mock.patch.object(
                        m, 'stop_process_group', side_effect=stop_synthetic_process), mock.patch.object(
                        sys, 'stdout', output):
                    result = m.execute(ROOT, resources.parent, {'kind': 'synthetic-version-contract'})
                evidence = json.loads(output.getvalue())
                self.assertEqual(result, 1)
                self.assertEqual(evidence['status'], 'failed')
                self.assertEqual(evidence['stage'], 'setup' if failed_query else 'image-acquisition')
                self.assertEqual(evidence['error'], 'TOOL_EXIT_17' if failed_query else 'TOOL_EXIT_78')
                expected_forward = (version_queries[:version_queries.index(failed_query) + 1]
                                    if failed_query else version_queries + [pull])
                self.assertEqual(calls, expected_forward + cleanup_queries)
                self.assertEqual(unexpected, [])
                if failed_query is None:
                    self.assertEqual(evidence['versions']['docker'], version_output[2].decode().strip())
                    self.assertEqual(evidence['versions']['restic'], version_output[3].decode().strip())
                self.assertNotIn('image', evidence)
                self.assertNotIn('source', evidence)
                self.assertEqual(evidence['inspections'], [])
                self.assertEqual(evidence['cleanup']['containers_absent'], list(resources.names.values()))
                self.assertEqual(evidence['cleanup']['anonymous_volumes_absent'], [])
                self.assertTrue(evidence['cleanup']['temporary_root_absent'])
                self.assertTrue(evidence['cleanup']['process_groups_absent'])
                self.assertFalse(resources.root.exists())
                self.assertEqual(resources.processes, [])

    def test_ambiguous_missing_and_drifted_components_are_rejected(self):
        m = self.implementation()
        self.assertEqual(m.between('before<start>payload<end>after', '<start>', '<end>'), 'payload')
        for value in ['<start>x<start>x<end>', '<start>x', '<end><start>']:
            with self.subTest(value=value), self.assertRaises(m.GateError):
                m.between(value, '<start>', '<end>')
        with self.assertRaises(m.GateError):
            m.check_hash(b'drift', '0' * 64)
        parts, evidence = m.load_components(ROOT)
        self.assertEqual(set(parts), set(m.FRAGMENT_HASHES))
        self.assertEqual(evidence['parent_commit'], '34d71daba94ba227146300f69f1f7b2872dce58b')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for path in m.SOURCE_HASHES:
                target = root / path; target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / path).read_bytes())
            target.write_bytes(target.read_bytes() + b'\n')
            with self.assertRaisesRegex(m.GateError, 'SOURCE'):
                m.load_components(root)

    def test_synthetic_oracle_is_exact_and_catches_corruption(self):
        m = self.implementation()
        seed, expected = m.synthetic_fixture()
        self.assertEqual(len(expected['business']), 4)
        self.assertEqual(len(expected['documents']), 3)
        self.assertEqual(expected['documents'][0]['size_bytes'], 262147)
        self.assertEqual(expected['documents'][0]['content_sha256'],
                         hashlib.sha256(bytes(range(256)) * 1024 + b'\x00\xffZ').hexdigest())
        self.assertEqual(expected['business'][0]['business_id'], 'synthetic-alpha')
        self.assertEqual(expected['business'][0]['record_id'], 'shared-record')
        self.assertEqual(expected['business'][2]['record_id'], 'shared-record')
        self.assertIn('decode(', seed)
        m.assert_projection(copy.deepcopy(expected), expected)
        for section in expected:
            bad = copy.deepcopy(expected)
            bad[section] = []
            with self.subTest(section=section), self.assertRaises(m.GateError):
                m.assert_projection(bad, expected)
        bad = copy.deepcopy(expected); bad['documents'][0]['content_sha256'] = '0' * 64
        with self.assertRaises(m.GateError):
            m.assert_projection(bad, expected)

    def test_cleanup_refuses_parent_sibling_symlink_and_wrong_marker(self):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            parent = Path(temp).resolve()
            owned = parent / ('catering-tools-' + 'a' * 32)
            owned.mkdir(mode=0o700); (owned / '.owned').write_text('a' * 32)
            (owned / 'synthetic').write_text('test')
            for wrong in [parent, parent / 'other', parent / ('catering-tools-' + 'b' * 32)]:
                with self.subTest(path=wrong), self.assertRaises(m.GateError):
                    m.remove_owned_root(wrong, parent, 'a' * 32)
            link = parent / ('catering-tools-' + 'b' * 32); link.symlink_to(owned)
            with self.assertRaises(m.GateError):
                m.remove_owned_root(link, parent, 'b' * 32)
            with self.assertRaises(m.GateError):
                m.remove_owned_root(owned, parent, 'b' * 32)
            (owned / '.owned').write_text('wrong-marker')
            with self.assertRaises(m.GateError):
                m.remove_owned_root(owned, parent, 'a' * 32)
            (owned / '.owned').write_text('a' * 32)
            m.remove_owned_root(owned, parent, 'a' * 32)
            self.assertFalse(owned.exists())

    def test_running_inspect_rejects_network_mount_and_privilege_escape(self):
        m = self.implementation()
        value = {'id': 'a' * 64, 'name': '/owned', 'image': 'sha256:' + 'b' * 64,
                 'configured_image': 'postgres@sha256:' + 'c' * 64, 'running': True,
                 'network': 'none', 'ports': {}, 'networks': {'none': {'IPAddress': '', 'GlobalIPv6Address': ''}},
                 'privileged': False, 'user': 'postgres', 'label': 'd' * 32,
                 'mounts': [{'Type': 'bind', 'Source': '/owned/dump', 'Destination': '/restore/postgres.dump', 'RW': False}],
                 'auto_remove': True, 'publish_all_ports': False}
        args = (value['configured_image'], value['image'], 'd' * 32, '/owned/dump')
        m.validate_inspection(value, *args)
        for field, invalid in [('network', 'bridge'), ('ports', {'5432/tcp': [{}]}),
                               ('privileged', True), ('running', False), ('user', 'root'),
                               ('image', 'sha256:' + 'e' * 64), ('auto_remove', False), ('publish_all_ports', True)]:
            bad = copy.deepcopy(value); bad[field] = invalid
            with self.subTest(field=field), self.assertRaises(m.GateError):
                m.validate_inspection(bad, *args)
        bad = copy.deepcopy(value); bad['networks']['none']['IPAddress'] = '172.18.0.2'
        with self.assertRaises(m.GateError):
            m.validate_inspection(bad, *args)
        for badmount in [dict(value['mounts'][0], RW=True),
                         dict(value['mounts'][0], Destination='/var/run/docker.sock')]:
            bad = copy.deepcopy(value); bad['mounts'] = [badmount]
            with self.assertRaises(m.GateError):
                m.validate_inspection(bad, *args)

    def test_timeout_stops_synthetic_pipeline_descendants(self):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); pidfile = root / 'child.pid'; late = root / 'late-write'
            child = ("import os,time; from pathlib import Path; "
                     f"Path({str(pidfile)!r}).write_text(str(os.getpid())); "
                     f"time.sleep(0.5); Path({str(late)!r}).write_text('survived'); time.sleep(5)")
            script = 'value=$( ' + shlex.quote(sys.executable) + ' -c ' + shlex.quote(child) + ' | /bin/cat )'
            try:
                with self.assertRaises((subprocess.TimeoutExpired, m.GateError)):
                    m.command(['/bin/bash', '-c', script], timeout=0.2)
                self.assertTrue(pidfile.exists(), 'real synthetic descendant never started')
                time.sleep(0.6)
                self.assertFalse(late.exists(), 'timed-out pipeline descendant continued writing')
            finally:
                if pidfile.exists():
                    try:
                        os.kill(int(pidfile.read_text()), signal.SIGKILL)
                    except ProcessLookupError:
                        pass

    def test_process_stop_error_does_not_skip_other_cleanup(self):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            resources = m.Resources(Path(temp).resolve())
            resources.root.mkdir(mode=0o700); (resources.root / '.owned').write_text(resources.token)
            process = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(5)'], start_new_session=True)
            resources.processes.append(process)
            def failed_stop(*args, **kwargs):
                os.killpg(process.pid, signal.SIGKILL); process.wait(timeout=1)
                raise OSError('synthetic stop failure')
            def old_failed_stop():
                raise OSError('synthetic stop failure')
            process.terminate = old_failed_stop
            try:
                with mock.patch.object(m, 'stop_process_group', side_effect=failed_stop, create=True), mock.patch.object(
                        resources, 'absent', return_value=True):
                    with self.assertRaises(Exception):
                        resources.cleanup()
                self.assertFalse(resources.root.exists(), 'process-stop exception skipped owned-root cleanup')
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGKILL); process.wait(timeout=1)
                if process in resources.processes:
                    resources.processes.remove(process)

    def test_term_during_cleanup_is_reported_after_other_categories_finish(self):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            resources = m.Resources(Path(temp).resolve())
            resources.root.mkdir(mode=0o700); (resources.root / '.owned').write_text(resources.token)
            old_handler = signal.getsignal(signal.SIGTERM)
            def interrupted(*args):
                raise m.GateError('synthetic interrupt')
            original_remove = m.remove_owned_root
            def interrupt_before_removal(*args):
                os.kill(os.getpid(), signal.SIGTERM)
                original_remove(*args)
            signal.signal(signal.SIGTERM, interrupted)
            try:
                with mock.patch.object(resources, 'absent', return_value=True), mock.patch.object(
                        m, 'remove_owned_root', side_effect=interrupt_before_removal):
                    with self.assertRaises(m.GateError):
                        resources.cleanup()
                self.assertFalse(resources.root.exists(), 'signal skipped remaining cleanup')
            finally:
                signal.signal(signal.SIGTERM, old_handler)

    def test_cleanup_shared_deadline_bounds_slow_tool_commands(self):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            resources = m.Resources(Path(temp).resolve())
            resources.root.mkdir(mode=0o700); (resources.root / '.owned').write_text(resources.token)
            original_command = m.command
            def slow_synthetic_tool(*args, **kwargs):
                return original_command([sys.executable, '-c', 'import time; time.sleep(1)'])
            started = time.monotonic()
            with mock.patch.object(m, 'command', side_effect=slow_synthetic_tool), mock.patch.object(
                    m, 'CLEANUP_BUDGET_SECONDS', 0.6, create=True):
                try:
                    resources.cleanup()
                except m.GateError:
                    pass
            self.assertLess(time.monotonic() - started, 1.5, 'cleanup escaped its shared time budget')
            self.assertFalse(resources.root.exists(), 'budget failure skipped owned-root cleanup')

    def test_root_timeout_is_built_inside_sudo_without_forwarding_unlisted_env(self):
        m = self.implementation()
        self.assertTrue(hasattr(m, 'root_invocation'), 'root timeout argv builder is missing')
        fields = ['GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'RUNNER_OS', 'GITHUB_REPOSITORY',
                  'GITHUB_EVENT_NAME', 'GITHUB_REF', 'GITHUB_EVENT_PATH', 'GITHUB_WORKSPACE', 'RUNNER_TEMP']
        env = dict.fromkeys(fields, 'synthetic-public'); env['UNLISTED_CREDENTIAL'] = 'must-not-cross'
        argv = m.root_invocation('/synthetic/script.py', 'a' * 40, 'b' * 40, env)
        self.assertEqual(argv[:4], ['sudo', '-n', '/usr/bin/env', '-i'])
        offset = argv.index('/usr/bin/timeout')
        self.assertEqual(argv[offset:], ['/usr/bin/timeout', '--signal=TERM', '--kill-after=30s', '600',
                                        '/usr/bin/python3', '-B', '/synthetic/script.py', '--execute', 'a' * 40, 'b' * 40])
        self.assertFalse(any('must-not-cross' in arg for arg in argv))

    def test_slow_root_removal_cannot_escape_cleanup_deadline(self):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            resources = m.Resources(Path(temp).resolve())
            resources.root.mkdir(mode=0o700); (resources.root / '.owned').write_text(resources.token)
            original_remove = m.remove_owned_root
            def slow_removal(*args):
                time.sleep(2)
                original_remove(*args)
            started = time.monotonic()
            with mock.patch.object(resources, 'absent', return_value=True), mock.patch.object(
                    m, 'remove_owned_root', side_effect=slow_removal), mock.patch.object(m, 'CLEANUP_BUDGET_SECONDS', 0.3):
                with self.assertRaises(m.GateError):
                    resources.cleanup()
            self.assertLess(time.monotonic() - started, 0.8)


if __name__ == '__main__':
    unittest.main(verbosity=2)
