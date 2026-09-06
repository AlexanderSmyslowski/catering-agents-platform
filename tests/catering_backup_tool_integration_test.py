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

    def dump_fixture(self, root):
        # Only the Docker boundary is substituted; it runs the actual supplied
        # container shell and executable, preserving positional arguments/status.
        pg = root / 'fake pg_dump'
        pg.write_text('#!' + sys.executable + "\n" + """import json, os, sys
from pathlib import Path
names = ['PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGSERVICE', 'PGSERVICEFILE']
Path(os.environ['DUMP_OBSERVATION']).write_text(json.dumps({
    'environment': {name: os.environ.get(name) for name in names},
    'argv': sys.argv[1:],
    'generations': [os.environ.get('CATERING_RESTIC_REPOSITORY_GENERATION'),
                    os.environ.get('CATERING_RESTIC_PASSWORD_GENERATION')]}))
sys.stdout.buffer.write(b'PGDMP-synthetic')
sys.exit(int(os.environ.get('DUMP_EXIT', '0')))
""")
        docker = root / 'fake-docker'
        docker.write_text('#!' + sys.executable + "\n" + """import json, os, subprocess, sys
from pathlib import Path
args = sys.argv[1:]
assert args.pop(0) == 'exec'
env = dict(os.environ)
for name in ['PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGSERVICE', 'PGSERVICEFILE']:
    env[name] = 'foreign-inherited-value'
while args[0] == '--env':
    args.pop(0)
    key, value = args.pop(0).split('=', 1)
    env[key] = value
assert args[:3] == ['--user', 'postgres', 'a' * 64]
args = args[3:]
Path(os.environ['DOCKER_OBSERVATION']).write_text(json.dumps(args))
result = subprocess.run(args, env=env)
sys.exit(result.returncode)
""")
        for file in (pg, docker):
            file.chmod(0o700)
        return dict(os.environ, DOCKER_CMD=str(docker), PG_DUMP_CMD=str(pg),
                    postgres_container_id='a' * 64, postgres_dump=str(root / 'dump'),
                    DUMP_OBSERVATION=str(root / 'pg.json'), DOCKER_OBSERVATION=str(root / 'docker.json'))

    def test_current_dump_removes_connection_environment_at_executed_pg_dump(self):
        m = self.implementation()
        sources = {path: (ROOT / path).read_text() for path in m.SOURCE_HASHES}
        fragment = m.extract_components(sources)['dump']
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); env = self.dump_fixture(root)
            result = subprocess.run(['/bin/bash', '-euo', 'pipefail', '-c',
                                     'fail_state() { exit 1; }\n' + fragment],
                                    env=env, capture_output=True)
            self.assertEqual(result.returncode, 0)
            actual = json.loads((root / 'pg.json').read_text())
            self.assertEqual(actual['argv'], ['--username=catering', '--dbname=catering_agents',
                '--format=custom', '--no-owner', '--no-privileges', '--strict-names',
                '--table=public.catering_business_records', '--table=public.catering_source_documents'])
            self.assertEqual((root / 'dump').read_bytes(), b'PGDMP-synthetic')
            self.assertEqual(actual['environment'], dict.fromkeys(
                ['PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGSERVICE', 'PGSERVICEFILE']))

    def test_dump_diagnostics_preserve_original_status_and_same_shell_generations(self):
        m = self.implementation()
        self.assertTrue(hasattr(m, 'run_dump'), 'dump boundary diagnostics are missing')
        parts, _ = m.load_components(ROOT)
        for legacy in (True, False):
            for code in (0, 17, 125, 126, 127):
                with self.subTest(legacy=legacy, code=code), tempfile.TemporaryDirectory() as temp:
                    root = Path(temp); env = self.dump_fixture(root)
                    generation_values = []
                    for label in ('repository', 'password'):
                        path = root / label; path.write_text('synthetic-' + label); path.chmod(0o600)
                        info = path.stat()
                        generation_values.append(f'{info.st_dev}:{info.st_ino}:{info.st_size}:'
                                                 + hashlib.sha256(path.read_bytes()).hexdigest())
                    env.update(CATERING_BACKUP_REPOSITORY_FILE=str(root / 'repository'),
                               CATERING_BACKUP_PASSWORD_FILE=str(root / 'password'),
                               CATERING_BACKUP_EXPECTED_UID=str(os.getuid()), DUMP_EXIT=str(code))
                    diagnostic = m.run_dump(ROOT / 'platform-infra/backup/catering-backup-common.sh',
                                            m.LEGACY_DUMP if legacy else parts['dump'], env)
                    self.assertEqual(diagnostic, {'stage': 'complete' if code == 0 else 'dump',
                        'exit_code': 0 if code == 0 else 1, 'docker_entered': True,
                        'docker_exit_code': code, 'empty_service_rejected': False})
                    actual = json.loads((root / 'pg.json').read_text())
                    self.assertEqual(actual['generations'], generation_values)
                    self.assertEqual(actual['environment'], dict.fromkeys(
                        ['PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGSERVICE', 'PGSERVICEFILE'], '' if legacy else None))
                    self.assertEqual(actual['argv'], ['--username=catering', '--dbname=catering_agents',
                        '--format=custom', '--no-owner', '--no-privileges', '--strict-names',
                        '--table=public.catering_business_records', '--table=public.catering_source_documents'])

    def test_dump_diagnostics_retain_errexit_before_docker(self):
        m = self.implementation()
        self.assertTrue(hasattr(m, 'run_dump'), 'dump boundary diagnostics are missing')
        parts, _ = m.load_components(ROOT)
        for stage in ('source', 'init'):
            with self.subTest(stage=stage), tempfile.TemporaryDirectory() as temp:
                root = Path(temp); env = self.dump_fixture(root)
                env.update(CATERING_BACKUP_REPOSITORY_FILE='synthetic', CATERING_BACKUP_PASSWORD_FILE='synthetic')
                common = root / 'common.sh'; escaped = root / 'escaped'
                failure = 'false\nprintf leaked >' + shlex.quote(str(escaped)) + '\n'
                common.write_text('set -euo pipefail\n' + (failure if stage == 'source' else
                                  'secure_restic_init_generation() {\n' + failure + '}\n'))
                diagnostic = m.run_dump(common, parts['dump'], env)
                self.assertEqual(diagnostic, {'stage': stage, 'exit_code': 1, 'docker_entered': False,
                                             'docker_exit_code': None, 'empty_service_rejected': False})
                self.assertFalse(escaped.exists(), 'diagnostic wrapper suppressed Bash errexit')
                self.assertFalse((root / 'docker.json').exists())

    def test_empty_service_classification_requires_exact_error_and_pg_dump_exit(self):
        m = self.implementation()
        self.assertTrue(hasattr(m, 'run_dump'), 'dump boundary diagnostics are missing')
        expected = b'pg_dump: error: service file "" not found\n'
        for code, error, accepted in [(1, expected, True), (0, expected, False),
                (17, expected, False), (125, expected, False), (126, expected, False),
                (127, expected, False), (1, b'unrelated failure\n', False),
                (1, expected + b'extra failure\n', False)]:
            with self.subTest(code=code, error=error), tempfile.TemporaryDirectory() as temp:
                root = Path(temp); env = self.dump_fixture(root)
                pg = Path(env['PG_DUMP_CMD'])
                pg.write_text('#!' + sys.executable + '\nimport sys\nsys.stderr.buffer.write('
                              + repr(error) + ')\nsys.exit(' + str(code) + ')\n')
                common = root / 'common.sh'
                common.write_text('set -euo pipefail\nsecure_restic_init_generation() { :; }\nfail_state() { return 1; }\n')
                env.update(CATERING_BACKUP_REPOSITORY_FILE='synthetic', CATERING_BACKUP_PASSWORD_FILE='synthetic')
                diagnostic = m.run_dump(common, m.LEGACY_DUMP, env)
                self.assertEqual(diagnostic['docker_exit_code'], code)
                self.assertEqual(diagnostic['empty_service_rejected'], accepted)
                self.assertNotIn('error:', json.dumps(diagnostic))

    def test_dump_observer_launch_failure_and_timeout_cannot_be_expected_rejection(self):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); env = self.dump_fixture(root)
            common = root / 'common.sh'
            common.write_text('set -euo pipefail\nsecure_restic_init_generation() { :; }\nfail_state() { return 1; }\n')
            env.update(CATERING_BACKUP_REPOSITORY_FILE='synthetic', CATERING_BACKUP_PASSWORD_FILE='synthetic')
            missing = m.run_dump(common, m.LEGACY_DUMP, dict(env, DOCKER_CMD=str(root / 'missing-tool')))
            self.assertEqual(missing, {'stage': 'dump', 'exit_code': 1, 'docker_entered': True,
                                      'docker_exit_code': None, 'empty_service_rejected': False})
            self.assertFalse((root / 'pg.json').exists())
            started, late = root / 'started', root / 'late'
            Path(env['PG_DUMP_CMD']).write_text('#!' + sys.executable + '\nimport time\nfrom pathlib import Path\n'
                + f'Path({str(started)!r}).touch()\ntime.sleep(2.5)\nPath({str(late)!r}).touch()\n')
            original_command = m.command
            def short_command(*args, **kwargs):
                return original_command(*args, **kwargs, timeout=1.5)
            with mock.patch.object(m, 'command', side_effect=short_command):
                with self.assertRaises(subprocess.TimeoutExpired):
                    m.run_dump(common, m.LEGACY_DUMP, env)
            self.assertTrue(started.exists(), 'synthetic pg_dump child did not start')
            time.sleep(2.6)
            self.assertFalse(late.exists(), 'Docker observer descendant escaped owned process-group cleanup')
            self.assertEqual(m.PROCESS_GROUPS, [])

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
                cleanup_queries = [('docker', 'ps', '-aq', '--no-trunc', '--filter', 'name=^/' + name + '$')
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


    def reader_case(self, chunks, *, expected=None, tail=b'', exit_code=0,
                    observation_error=False, absence_error=False, timeout=False, release_timeout=False):
        """Exercise restore_case; only process, readiness IO and Docker are synthetic."""
        m = self.implementation()
        expected = m.synthetic_fixture()[1] if expected is None else expected
        events = []
        with tempfile.TemporaryDirectory() as temp:
            resources = m.Resources(Path(temp).resolve())
            resources.root.mkdir(mode=0o700); (resources.root / '.owned').write_text(resources.token)
            process = mock.Mock(returncode=exit_code)
            process.stdout.fileno.return_value = 42
            process.communicate.side_effect = lambda **kw: (events.append('release') or (tail, b''))
            process.stdin.write.side_effect = lambda data: events.append(('release', data))
            process.wait.return_value = exit_code
            selector = mock.MagicMock()
            selector.__enter__.return_value = selector
            selector.select.return_value = [(mock.Mock(fileobj=process.stdout), 1)]
            reads = iter([*chunks, tail, b''] if tail else [*chunks, b''])
            def read(*args):
                events.append('read')
                return next(reads, b'')
            def start(*args, **kwargs):
                resources.processes.append(process)
                events.append('start')
                return process
            def stop(p, deadline=None):
                events.append('stop')
                if p in resources.processes:
                    resources.processes.remove(p)
            def observe(*args):
                events.append('observe')
                if observation_error:
                    raise m.GateError('CONTAINER_ISOLATION')
            in_reader = [True]
            def absent(*args):
                events.append('absence')
                return not (in_reader[0] and absence_error)
            with mock.patch.object(resources, 'create', return_value='a' * 64), mock.patch.object(
                    resources, 'observe', side_effect=observe), mock.patch.object(
                    resources, 'absent', side_effect=absent), mock.patch.object(
                    m, 'start_process', side_effect=start), mock.patch.object(
                    m, 'stop_process_group', side_effect=stop), mock.patch.object(
                    m.selectors, 'DefaultSelector', return_value=selector), mock.patch.object(
                    m.os, 'read', side_effect=read):
                try:
                    if timeout:
                        with mock.patch.object(m.time, 'monotonic', side_effect=[0, 91]):
                            return m.restore_case(resources, 'restore', 'image', 'id', Path(temp)/'dump', 'body', expected), events
                    if release_timeout:
                        with mock.patch.object(m.time, 'monotonic', side_effect=[0, 0, 100, 131]):
                            return m.restore_case(resources, 'restore', 'image', 'id', Path(temp)/'dump', 'body', expected), events
                    return m.restore_case(resources, 'restore', 'image', 'id', Path(temp)/'dump', 'body', expected), events
                finally:
                    in_reader[0] = False
                    resources.cleanup()
                    self.assertFalse(resources.root.exists())
                    self.assertEqual(resources.processes, [])

    def postgres_projection(self, value):
        # PostgreSQL json_agg adds a newline before subsequent composite rows.
        return ('{' + ', '.join(json.dumps(key) + ' : [' + ', \n '.join(
            json.dumps(row, ensure_ascii=False) for row in rows) + ']'
            for key, rows in value.items()) + '}\n').encode()

    def test_restore_reader_accepts_actual_multiline_projection(self):
        expected = self.implementation().synthetic_fixture()[1]
        result, events = self.reader_case([self.postgres_projection(expected) + b'INTEGRATION_READY\n'])
        self.assertTrue(result['data_schema_equal'])
        self.assertLess(events.index('observe'), next(i for i, event in enumerate(events)
                                                    if event == 'release' or isinstance(event, tuple)))
        self.assertLess(events.index('stop'), events.index('absence'))

    def test_restore_reader_compact_and_fragmented_projection(self):
        expected = self.implementation().synthetic_fixture()[1]
        data = json.dumps(expected).encode() + b'\nINTEGRATION_READY\n'
        for chunks in ([data], [data[:83], data[83:-9], data[-9:-2], data[-2:]]):
            with self.subTest(chunks=len(chunks)):
                result, _ = self.reader_case(chunks)
                self.assertTrue(result['data_schema_equal'])

    def test_restore_reader_rejects_invalid_full_documents_and_framing(self):
        m = self.implementation()
        data = json.dumps(m.synthetic_fixture()[1]).encode()
        marker = b'\nINTEGRATION_READY\n'
        invalid = [b'', b'{', b'\xff', b'log\n'+data, data+b'\nlog', data+b'\n{}',
                   data+marker, data+b'\nINTEGRATION_READY']
        for prefix in invalid:
            with self.subTest(prefix_length=len(prefix)), self.assertRaises(m.GateError):
                self.reader_case([prefix+marker])
        for chunks in ([data], [], [data+marker, b'INTEGRATION_READY\n']):
            with self.subTest(chunks=len(chunks)), self.assertRaises(m.GateError):
                self.reader_case(chunks)
        for tail in (b'INTEGRATION_READY\n', b'foreign\n', b'x'*1048576):
            with self.subTest(tail_length=len(tail)), self.assertRaises(m.GateError):
                self.reader_case([data+marker], tail=tail)

    def test_restore_reader_checks_every_projection_section(self):
        m = self.implementation()
        expected = m.synthetic_fixture()[1]
        wrong = []
        for key in expected:
            value = copy.deepcopy(expected); value[key] = []; wrong.append(value)
        value = copy.deepcopy(expected); value['documents'][0]['content_sha256'] = '0'*64; wrong.append(value)
        for value in wrong:
            with self.subTest(value=list(value)), self.assertRaisesRegex(m.GateError, 'DATA_OR_SCHEMA_MISMATCH'):
                self.reader_case([json.dumps(value).encode()+b'\nINTEGRATION_READY\n'])

    def test_restore_reader_preserves_limits_observation_exit_and_absence_gates(self):
        m = self.implementation()
        data = json.dumps(m.synthetic_fixture()[1]).encode()+b'\nINTEGRATION_READY\n'
        for chunks, options, code in [([b'x'*1048576], {}, 'RESTORE_OUTPUT_LIMIT'),
                ([data], {'timeout': True}, 'RESTORE_ASSERT_TIMEOUT'),
                ([data], {'release_timeout': True}, 'RESTORE_RELEASE_TIMEOUT'),
                ([data], {'observation_error': True}, 'CONTAINER_ISOLATION'),
                ([data], {'exit_code': 5}, 'RESTORE_EXIT_NONZERO'),
                ([data], {'absence_error': True}, 'RESTORE_CONTAINER_REMAINS')]:
            with self.subTest(code=code), self.assertRaisesRegex(m.GateError, code):
                self.reader_case(chunks, **options)

    def cleanup_case(self, scenario, *, failure_operation=None, failure_kind=None):
        m = self.implementation()
        with tempfile.TemporaryDirectory() as temp:
            resources = m.Resources(Path(temp).resolve())
            resources.root.mkdir(mode=0o700); (resources.root / '.owned').write_text(resources.token)
            cid, volume, foreign_volume = 'a'*64, 'b'*64, 'f'*64
            resources.ids['restore'] = cid
            if scenario == 'unknown-id': resources.ids.clear()
            resources.volumes.add(volume)
            info = {'id': cid, 'name': '/'+resources.names['restore'], 'label': resources.token,
                    'mounts': [{'Type': 'volume', 'Name': volume}]}
            if scenario == 'renamed': info['name'] = '/renamed'
            if scenario == 'owner': info['label'] = 'foreign'; info['mounts'][0]['Name'] = foreign_volume
            if scenario == 'role': info['name'] = '/'+resources.names['source']; info['mounts'][0]['Name'] = foreign_volume
            if scenario == 'id': info['id'] = 'c'*64; info['mounts'][0]['Name'] = foreign_volume
            if scenario == 'replacement':
                info['id'] = 'c'*64; info['label'] = 'foreign'; info['mounts'][0]['Name'] = foreign_volume
            containers = {info['id']: info}
            volumes = {volume, foreign_volume}
            events, removals = [], []
            process = mock.Mock()
            resources.processes.append(process)
            armed = [False]
            injected = [False]
            query_counts = {}
            def stop(p, deadline=None):
                events.append('process-stop')
                resources.processes.remove(p)
                armed[0] = True
                if scenario == 'before-query': containers.clear()
                if scenario == 'process-failure': raise OSError('synthetic-sensitive-token')
            def boundary(args, **kwargs):
                events.append(tuple(args))
                operation = ('inspect' if args[1] == 'inspect' else 'remove' if args[1] == 'rm'
                             else 'query' if args[1] == 'ps' else 'volume')
                if operation == failure_operation and not injected[0]:
                    injected[0] = True
                    containers.clear()
                    if failure_kind == 'timeout': raise subprocess.TimeoutExpired(['synthetic-sensitive-token'], 1)
                    if failure_kind == 'exception': raise OSError('synthetic-sensitive-token')
                    return subprocess.CompletedProcess(args, 1, b'', {
                        'permission': b'permission denied synthetic-sensitive-token',
                        'offline': b'Cannot connect to the Docker daemon synthetic-sensitive-token',
                        'unknown': b'not found synthetic-sensitive-token'}[failure_kind]) if kwargs.get('check') is False else m.require(False, 'TOOL_EXIT_1')
                if args[1] == 'ps':
                    criterion = args[-1]
                    query_counts[criterion] = query_counts.get(criterion, 0) + 1
                    is_restore = criterion == 'name=^/'+resources.names['restore']+'$'
                    if is_restore and scenario in ('malformed-query', 'multiple-query'):
                        return subprocess.CompletedProcess(args, 0, b'unexpected\n' if scenario == 'malformed-query'
                                                           else ((cid+'\n')*2).encode(), b'')
                    if is_restore and scenario == 'failed-final-query' and query_counts[criterion] == 2:
                        raise m.GateError('TOOL_EXIT_1')
                    if criterion.startswith('name='):
                        name = criterion[len('name=^/'): -1]
                        matches = [key for key, value in containers.items() if value['name'] == '/'+name]
                    else:
                        matches = [key for key in containers if key == criterion.removeprefix('id=')]
                    output = ('\n'.join(matches)+ ('\n' if matches else '')).encode()
                    if scenario == 'query-inspect' and cid in matches and armed[0]:
                        containers.clear(); armed[0] = False
                    return subprocess.CompletedProcess(args, 0, output, b'')
                if args[1] == 'inspect':
                    identity = args[-1]
                    found = containers.get(identity) or next((value for value in containers.values()
                                                              if value['name'] == '/'+identity), None)
                    if found is None:
                        result = subprocess.CompletedProcess(args, 1, b'\n', ('Error: No such object: '+identity+'\n').encode())
                        if kwargs.get('check') is False: return result
                        raise m.GateError('TOOL_EXIT_1')
                    if scenario.startswith('false-missing-'):
                        containers.clear()
                        suffix = scenario.removeprefix('false-missing-')
                        result = subprocess.CompletedProcess(args, 1, b'\n', {
                            'prefix': ('permission denied\nError: No such object: '+identity+'\n').encode(),
                            'foreign-ref': b'Error: No such object: unrelated\n',
                            'suffix': ('Error: No such object: '+identity+'\nprivate-tail').encode()}[suffix])
                        return result
                    output = json.dumps(found).encode()
                    if scenario == 'inspect-remove': containers.clear()
                    return subprocess.CompletedProcess(args, 0, output, b'')
                if args[1] == 'rm':
                    identity = args[-1]; removals.append(identity)
                    self.assertEqual(identity, cid, 'foreign or mutable identity reached removal')
                    if scenario != 'remains': containers.pop(identity, None)
                    # Docker rm --force is successful even if --rm already removed it.
                    return subprocess.CompletedProcess(args, 0, b'', b'')
                if args[1:3] == ['volume', 'ls']:
                    name = args[-1][len('name=^'):-1]
                    return subprocess.CompletedProcess(args, 0, (name+'\n').encode() if name in volumes else b'', b'')
                if args[1:3] == ['volume', 'rm']:
                    self.assertNotEqual(args[-1], foreign_volume)
                    volumes.discard(args[-1])
                    return subprocess.CompletedProcess(args, 0, b'', b'')
                raise AssertionError('unexpected synthetic cleanup command')
            error = None
            result = None
            with mock.patch.object(m, 'command', side_effect=boundary), mock.patch.object(
                    m, 'stop_process_group', side_effect=stop):
                try:
                    result = resources.cleanup()
                except m.GateError as caught:
                    error = caught
            self.assertFalse(resources.root.exists(), 'cleanup failure skipped temporary root')
            self.assertNotIn(volume, volumes, 'cleanup failure skipped known volume')
            self.assertNotIn(foreign_volume, resources.volumes)
            self.assertIn(foreign_volume, volumes)
            self.assertEqual(resources.processes, [])
            self.assertTrue(any(isinstance(event, tuple) and event[-1] == 'name=^/'+resources.names['corrupt']+'$'
                                for event in events), 'cleanup skipped another container')
            return result, error, events, removals, getattr(resources, 'cleanup_outcomes', [])

    def test_cleanup_owned_auto_removal_query_inspect_race(self):
        result, error, events, _, _ = self.cleanup_case('query-inspect')
        self.assertIsNone(error, 'owned --rm disappearance after successful query must be verified absent')
        self.assertTrue(result['temporary_root_absent'])
        self.assertEqual(events[0], 'process-stop')

    def test_cleanup_owned_disappearance_and_removal_stages(self):
        for scenario in ('before-query', 'inspect-remove', 'normal', 'unknown-id'):
            with self.subTest(scenario=scenario):
                result, error, _, _, _ = self.cleanup_case(scenario)
                self.assertIsNone(error)
                self.assertTrue(result['process_groups_absent'])

    def test_cleanup_identity_conflicts_remains_and_process_failure_are_closed(self):
        for scenario in ('renamed', 'replacement', 'owner', 'role', 'id', 'remains', 'process-failure',
                         'malformed-query', 'multiple-query', 'failed-final-query',
                         'false-missing-prefix', 'false-missing-foreign-ref', 'false-missing-suffix'):
            with self.subTest(scenario=scenario):
                _, error, _, removals, _ = self.cleanup_case(scenario)
                self.assertIsNotNone(error)
                if scenario not in ('remains', 'process-failure', 'failed-final-query'):
                    self.assertEqual(removals, [])
                self.assertNotIn('synthetic-sensitive-token', str(error))

    def test_cleanup_tool_failures_never_become_absence_and_have_safe_operations(self):
        for operation in ('query', 'inspect', 'remove'):
            for kind in ('permission', 'offline', 'unknown', 'timeout', 'exception'):
                with self.subTest(operation=operation, kind=kind):
                    _, error, _, _, outcomes = self.cleanup_case('normal', failure_operation=operation, failure_kind=kind)
                    self.assertIsNotNone(error)
                    self.assertNotIn('synthetic-sensitive-token', str(error)+json.dumps(outcomes))
                    failures = [item for item in outcomes if item['status'] == 'failed']
                    self.assertTrue(failures, 'cleanup must expose separately evaluated category failures')
                    self.assertTrue(all(set(item) == {'category', 'operation', 'failure_class', 'status'} for item in failures))

    def test_execute_keeps_primary_and_cleanup_failures_separate_without_private_text(self):
        m = self.implementation()
        for primary in (m.GateError('RESTORE_ORACLE_OUTPUT'), OSError('synthetic-sensitive-token')):
            with self.subTest(primary=type(primary).__name__), tempfile.TemporaryDirectory() as temp:
                resources = m.Resources(Path(temp).resolve())
                output = io.StringIO()
                def boundary(args, **kwargs):
                    if args[1] == 'version': raise primary
                    if args[1] == 'ps': raise OSError('synthetic-sensitive-token')
                    raise AssertionError('unexpected synthetic execute command')
                with mock.patch.object(m.os, 'geteuid', return_value=0), mock.patch.object(
                        m, 'Resources', return_value=resources), mock.patch.dict(m.MINIMAL_ENV), mock.patch.object(
                        m, 'command', side_effect=boundary), mock.patch.object(sys, 'stdout', output):
                    self.assertEqual(m.execute(ROOT, resources.parent, {'kind': 'synthetic-errors'}), 1)
                self.assertNotIn('synthetic-sensitive-token', output.getvalue())
                evidence = json.loads(output.getvalue())
                self.assertEqual(evidence['error'], 'RESTORE_ORACLE_OUTPUT' if isinstance(primary, m.GateError) else 'OSError')
                self.assertEqual(evidence['cleanup']['error'], 'CLEANUP_FAILED')
                failures = [item for item in evidence['cleanup']['outcomes'] if item['status'] == 'failed']
                self.assertEqual([item['category'] for item in failures], ['container-source', 'container-restore', 'container-corrupt'])
                self.assertTrue(all(item['operation'] == 'query-name-before' and item['failure_class'] == 'os-error'
                                    for item in failures))
                self.assertFalse(resources.root.exists())

    def test_restore_reader_real_synthetic_pipe_rejects_delayed_tail_and_cleans_process(self):
        m = self.implementation()
        expected = m.synthetic_fixture()[1]
        payload = self.postgres_projection(expected)+b'INTEGRATION_READY\n'
        for tail in (b'', b'INTEGRATION_READY\n', b'foreign\n', b'x'*1048576):
            with self.subTest(tail_length=len(tail)), tempfile.TemporaryDirectory() as temp:
                resources = m.Resources(Path(temp).resolve())
                resources.root.mkdir(mode=0o700); (resources.root/'.owned').write_text(resources.token)
                script = ('import os,sys,time\n' + f'payload={payload!r}\n' +
                          'os.write(1,payload[:-4]);time.sleep(0.01);os.write(1,payload[-4:])\n' +
                          'assert sys.stdin.buffer.readline()==b"release\\n"\ntime.sleep(0.01)\n' +
                          f'tail={tail!r}\n' + 'sys.stdout.buffer.write(tail);sys.stdout.buffer.flush()\n')
                program = Path(temp)/'synthetic-reader.py'; program.write_text(script)
                original_start = m.start_process
                def synthetic_start(args, **kwargs):
                    return original_start([sys.executable, '-B', str(program)], **kwargs)
                with mock.patch.object(resources, 'create', return_value='a'*64), mock.patch.object(
                        resources, 'observe'), mock.patch.object(resources, 'absent', return_value=True), mock.patch.object(
                        m, 'start_process', side_effect=synthetic_start):
                    try:
                        if tail:
                            with self.assertRaises(m.GateError):
                                m.restore_case(resources, 'restore', 'image', 'id', Path(temp)/'dump', 'body', expected)
                        else:
                            self.assertTrue(m.restore_case(resources, 'restore', 'image', 'id', Path(temp)/'dump', 'body', expected)['data_schema_equal'])
                    finally:
                        resources.cleanup()
                self.assertEqual(resources.processes, [])
                self.assertFalse(resources.root.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
