"""Synthetic capacity contracts; no Docker, PostgreSQL or Restic execution."""
import io
import os
import contextlib
from pathlib import Path
import shlex
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
RESTORE = ROOT / 'platform-infra/backup/catering-restore-probe.sh'
COMMON = ROOT / 'platform-infra/backup/catering-backup-common.sh'
CAPACITY = {
    'CATERING_BACKUP_MAX_BYTES': '10240',
    'CATERING_RESTORE_POSTGRES_BYTES': '8388608',
    'CATERING_RESTORE_MEMORY_BYTES': '16777216',
    'CATERING_BACKUP_RESERVE_BYTES': '4096',
    'CATERING_BACKUP_RESERVE_INODES': '16',
}


def admission_source():
    return COMMON.read_text().split("<<'PY_CAPACITY'\n", 1)[1].split('\nPY_CAPACITY', 1)[0]


def extractor_source():
    text = RESTORE.read_text()
    start = 'python3 - "$restore_root/stream.tar" "$restored_tree" <<\'PY\' || fail_state RESTORE_ARTIFACT_INVALID\n'
    return text.split(start, 1)[1].split('\nPY\nrestored_manifest=', 1)[0]


def checksum_source():
    text = (ROOT / 'platform-infra/backup/catering-backup.sh').read_text()
    return text.split('bundle_checksums="$(restic_cmd dump "$snapshot_id" "$bundle_path" | python3 -c \'\n', 1)[1].split("\n')", 1)[0]


class CapacityContracts(unittest.TestCase):
    def test_extension_header_is_rejected_before_unbounded_parser_read(self):
        for source in [extractor_source(), checksum_source()]:
            for kind, method in [(tarfile.XHDTYPE, '_proc_pax'),
                                 (tarfile.SOLARIS_XHDTYPE, '_proc_pax'),
                                 (tarfile.XGLTYPE, '_proc_pax'),
                                 (tarfile.GNUTYPE_LONGNAME, '_proc_gnulong'),
                                 (tarfile.GNUTYPE_LONGLINK, '_proc_gnulong'),
                                 (tarfile.GNUTYPE_SPARSE, '_proc_sparse')]:
                member = tarfile.TarInfo('synthetic')
                member.type, member.size = kind, 1 if kind == tarfile.XGLTYPE else 1073741825
                header = member.tobuf(format=tarfile.GNU_FORMAT)
                original_open = tarfile.open
                def open_header(*args, **kwargs):
                    kwargs['fileobj'] = io.BytesIO(header)
                    return original_open(mode='r|', tarinfo=kwargs.get('tarinfo', tarfile.TarInfo),
                                         fileobj=kwargs['fileobj'])
                with tempfile.TemporaryDirectory(prefix='catering-capacity-header-') as root, \
                        mock.patch.dict(os.environ, {**CAPACITY, 'CATERING_BACKUP_MAX_BYTES': '2147483648'}), \
                        mock.patch('sys.argv', ['extractor', 'synthetic.tar', root]), \
                        mock.patch('tarfile.open', side_effect=open_header), \
                        mock.patch.object(tarfile.TarInfo, method, side_effect=AssertionError('unbounded header parser reached')) as parser:
                    with self.assertRaises(SystemExit) as result:
                        exec(compile(source, '<actual-capacity-reader>', 'exec'), {})
                    self.assertEqual(result.exception.code, 1)
                    parser.assert_not_called()

    def admit(self, stage='config', overrides=None, free_bytes=1 << 30,
              free_inodes=20000, memory_kib=1 << 30):
        values = {**CAPACITY, **(overrides or {})}
        values = {key: value for key, value in values.items() if value is not None}
        space = SimpleNamespace(f_frsize=4096, f_bavail=free_bytes // 4096,
                                f_favail=free_inodes)
        errors = io.StringIO()
        with mock.patch.dict(os.environ, values, clear=True), \
                mock.patch('sys.argv', ['capacity', stage, '/synthetic-root']), \
                mock.patch('os.statvfs', return_value=space), \
                mock.patch('os.sysconf', return_value=4096), \
                mock.patch('builtins.open', mock.mock_open(read_data=f'MemAvailable: {memory_kib} kB\n')), \
                contextlib.redirect_stderr(errors):
            try:
                exec(compile(admission_source(), str(COMMON), 'exec'), {})
            except SystemExit as error:
                return error.code, errors.getvalue()
        return 0, errors.getvalue()

    def test_shared_config_rejects_missing_invalid_and_conflicting_inputs(self):
        for name in CAPACITY:
            for value in [None, '', '0', '-1', '1.5', '1e9', '+1', ' 1', '01',
                          '9223372036854775808']:
                with self.subTest(name=name, value=value):
                    self.assertEqual(self.admit(overrides={name: value}),
                                     (1, 'CAPACITY_ADMISSION_FAILED\n'))
        for overrides in [
            {'CATERING_RESTORE_MEMORY_BYTES': '6291455'},
            {'CATERING_RESTORE_MEMORY_BYTES': CAPACITY['CATERING_RESTORE_POSTGRES_BYTES']},
            {'CATERING_RESTORE_MEMORY_BYTES': '16777217'},
            {'CATERING_RESTORE_POSTGRES_BYTES': '8388609'},
            {'CATERING_BACKUP_MAX_BYTES': '9223372036854775807'},
        ]:
            self.assertEqual(self.admit(overrides=overrides)[0], 1)
        self.assertEqual(self.admit(), (0, ''))

    def test_resource_admission_includes_two_copies_pg_memory_rounding_and_reserves(self):
        disk = 2 * 10240 + 10002 * 4096 + 4096
        memory = disk + 16777216
        inodes = 10002 + 16
        self.assertEqual(self.admit('restore', free_bytes=disk, free_inodes=inodes,
                                   memory_kib=memory // 1024), (0, ''))
        for args in [dict(free_bytes=disk - 4096), dict(free_inodes=inodes - 1),
                     dict(memory_kib=memory // 1024 - 1)]:
            self.assertEqual(self.admit('restore', **args)[0], 1)
        backup = ((10240 + 4095) // 4096) * 4096 + 2 * 4096 + 4096
        self.assertEqual(self.admit('backup', free_bytes=backup, free_inodes=18), (0, ''))
        self.assertEqual(self.admit('backup', free_bytes=backup - 4096)[0], 1)

    def bounded_copy(self, target, payload, maximum=10):
        command = f'source {shlex.quote(str(COMMON))}; capacity_admit config /unused; bounded_backup_stream "$1"'
        return subprocess.run(['bash', '-c', command, 'capacity-test', str(target)],
                              input=payload, capture_output=True,
                              env={**os.environ, **CAPACITY, 'CATERING_BACKUP_MAX_BYTES': str(maximum)})

    def test_actual_transport_limits_file_and_stdout_without_whole_buffering(self):
        with tempfile.TemporaryDirectory(prefix='catering-capacity-copy-') as root:
            for size in [9, 10, 11]:
                for destination in ['-', Path(root) / f'file-{size}']:
                    with self.subTest(size=size, target=str(destination)):
                        result = self.bounded_copy(destination, b'x' * size)
                        self.assertEqual(result.returncode, 0 if size <= 10 else 1)
                        content = result.stdout if destination == '-' else destination.read_bytes()
                        self.assertLessEqual(len(content), 10)
                        if size <= 10:
                            self.assertEqual(content, b'x' * size)
                        else:
                            self.assertEqual(result.stderr, b'CAPACITY_STREAM_FAILED\n')
        self.assertFalse(Path(root).exists())

    def test_transport_preserves_existing_file_and_rejects_write_errors(self):
        with tempfile.TemporaryDirectory(prefix='catering-capacity-write-') as root:
            target = Path(root) / 'existing'
            target.write_bytes(b'old-valid')
            self.assertEqual(self.bounded_copy(target, b'new').returncode, 1)
            self.assertEqual(target.read_bytes(), b'old-valid')
            self.assertEqual(self.bounded_copy(Path(root) / 'missing' / 'file', b'new').returncode, 1)
        self.assertFalse(Path(root).exists())

    def test_actual_producer_serialized_limit_readback_and_extractor(self):
        import hashlib
        script = (ROOT / 'platform-infra/backup/catering-backup.sh').read_text()
        producer = 'snapshot_stream() {' + script.split('snapshot_stream() {', 1)[1].split('snapshot_json="$(snapshot_stream', 1)[0]
        with tempfile.TemporaryDirectory(prefix='catering-capacity-roundtrip-') as temp:
            root = Path(temp)
            work = root / 'work'; work.mkdir()
            (work / 'manifest').write_bytes(b'synthetic-manifest')
            (work / 'postgres_dump').write_bytes(b'PGDMP-synthetic')
            env = {**os.environ, **CAPACITY, 'work_root': str(work)}
            paths = {'sites_path': 'sites', 'platform_caddy_data_mount': 'platform_caddy_data',
                     'platform_caddy_config_mount': 'platform_caddy_config',
                     'shared_edge_caddyfile_path': 'shared_edge_caddyfile',
                     'shared_edge_caddy_data_mount': 'shared_edge_caddy_data',
                     'shared_edge_caddy_config_mount': 'shared_edge_caddy_config'}
            for name, component in paths.items():
                target = root / component
                if component == 'shared_edge_caddyfile':
                    target.write_bytes(b'# synthetic')
                else:
                    target.mkdir(); (target / 'binary').write_bytes(bytes(range(256)))
                env[name] = str(target)
            command = 'source ' + shlex.quote(str(COMMON)) + '\n' + producer + '\nsnapshot_stream | bounded_backup_stream -'
            def capture(limit):
                return subprocess.run(['bash', '-euo', 'pipefail', '-c', command], capture_output=True,
                                      env={**env, 'CATERING_BACKUP_MAX_BYTES': str(limit)})
            initial = capture(1048576)
            self.assertEqual(initial.returncode, 0, initial.stderr)
            size = len(initial.stdout)
            for limit, code in [(size - 1, 1), (size, 0), (size + 1, 0)]:
                result = capture(limit)
                self.assertEqual(result.returncode, code, result.stderr)
                self.assertLessEqual(len(result.stdout), limit)
            # Include bytes after tar's end marker in the full stream hash/cap.
            stream = initial.stdout + b'synthetic-tail'
            env['CATERING_BACKUP_MAX_BYTES'] = str(len(stream))
            # TarInfo/PAX objects already processed must not accumulate in memory.
            cache_guard = '''import tarfile
original_next = tarfile.TarFile.next
def guarded_next(archive):
    if len(archive.members) > 1:
        raise ValueError("processed metadata retained")
    return original_next(archive)
tarfile.TarFile.next = guarded_next
'''
            checksum = subprocess.run([sys.executable, '-c', cache_guard + checksum_source()], input=stream,
                                      capture_output=True, env=env)
            self.assertEqual(checksum.returncode, 0, checksum.stderr)
            self.assertEqual(checksum.stdout.decode().split('\t')[0], hashlib.sha256(stream).hexdigest())
            excessive = subprocess.run([sys.executable, '-c', checksum_source()], input=stream + b'x',
                                       capture_output=True, env=env)
            self.assertNotEqual(excessive.returncode, 0)
            archive = root / 'stream.tar'; archive.write_bytes(stream)
            restored = root / 'restored'; restored.mkdir()
            extracted = subprocess.run([sys.executable, '-c', cache_guard + extractor_source(), str(archive), str(restored)],
                                       capture_output=True, env=env)
            self.assertEqual(extracted.returncode, 0, extracted.stderr)
            self.assertEqual((restored / 'postgres_dump').read_bytes(), b'PGDMP-synthetic')
            for component in paths.values():
                target = restored / 'components' / component
                if target.is_dir():
                    self.assertEqual((target / 'binary').read_bytes(), bytes(range(256)))
            broken = root / 'broken'; broken.mkdir()
            archive.write_bytes(initial.stdout[:2048])
            rejected = subprocess.run([sys.executable, '-c', extractor_source(), str(archive), str(broken)],
                                      capture_output=True, env=env)
            self.assertNotEqual(rejected.returncode, 0)
        self.assertFalse(root.exists())

    def test_actual_transport_handles_partial_zero_and_failed_writes(self):
        source = COMMON.read_text().split("bounded_backup_stream() {\n  python3 -c '\n", 1)[1].split("\n' ", 1)[0]
        for outcome in ['partial', 'zero', 'error', 'headroom']:
            output = bytearray()
            def write(fd, data):
                if outcome == 'error' and output:
                    raise OSError('synthetic I/O failure')
                if outcome == 'zero':
                    return 0
                amount = min(2, len(data)); output.extend(data[:amount]); return amount
            space = SimpleNamespace(f_frsize=4096, f_bavail=1 if outcome == 'headroom' else 100)
            with mock.patch.dict(os.environ, CAPACITY), \
                    mock.patch('sys.argv', ['transport', '/synthetic-owned-file']), \
                    mock.patch('sys.stdin', SimpleNamespace(buffer=io.BytesIO(b'123456'))), \
                    mock.patch('os.open', return_value=100), mock.patch('os.close') as close, \
                    mock.patch('os.write', side_effect=write), mock.patch('os.fstatvfs', return_value=space), \
                    contextlib.redirect_stderr(io.StringIO()):
                try:
                    exec(compile(source, str(COMMON), 'exec'), {})
                    code = 0
                except SystemExit as result:
                    code = result.code
                self.assertEqual(code, 0 if outcome == 'partial' else 1)
                close.assert_called_once_with(100)
                self.assertEqual(output, b'123456' if outcome == 'partial' else b'12' if outcome == 'error' else b'')

    def test_actual_inode_guard_counts_implicit_nodes_and_observed_headroom(self):
        import ast
        tree = ast.parse(extractor_source())
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                     and node.name in ('admit_inode', 'fail', 'ensure_parent')]
        namespace = {'os': os, 'root': '/synthetic-root', 'created': 0}
        exec(compile(ast.Module(body=functions, type_ignores=[]), str(RESTORE), 'exec'), namespace)
        space = SimpleNamespace(f_favail=20000, f_bavail=100000, f_frsize=4096)
        with mock.patch.dict(os.environ, CAPACITY), mock.patch('os.statvfs', return_value=space):
            for _ in range(10000):
                namespace['admit_inode']()
            with self.assertRaises(SystemExit):
                namespace['admit_inode']()
            namespace['created'] = 0
            space.f_favail = 16
            with self.assertRaises(SystemExit):
                namespace['admit_inode']()
            # The actual parent creator consumes the same quota for implicit directories.
            space.f_favail = 20000
            namespace['created'] = 9999
            with mock.patch('os.path.lexists', return_value=False), mock.patch('os.mkdir') as mkdir:
                with self.assertRaises(SystemExit):
                    namespace['ensure_parent']('/synthetic-root/components/sites/file')
                mkdir.assert_called_once_with('/synthetic-root/components', 0o700)

    def admitted_headers(self, sizes, limit):
        # Exercise the production admission branch with synthetic tar metadata.
        # Tiny substitute bodies keep this a numeric boundary proof, not a claim
        # that a multi-gigabyte archive or PostgreSQL restore was executed.
        members = []
        for index, size in enumerate(sizes):
            member = tarfile.TarInfo(f'components/sites/file-{index}')
            member.size = size
            members.append(member)
        archive = mock.MagicMock()
        archive.__enter__.return_value = archive
        archive.__iter__.side_effect = lambda: iter(members)
        archive.extractfile.side_effect = lambda member: io.BytesIO(b'x')
        with tempfile.TemporaryDirectory(prefix='catering-capacity-') as root:
            with mock.patch('sys.argv', ['extractor', 'synthetic.tar', root]), \
                    mock.patch.dict(os.environ, {'CATERING_BACKUP_MAX_BYTES': str(limit),
                                                'CATERING_BACKUP_RESERVE_BYTES': '1',
                                                'CATERING_BACKUP_RESERVE_INODES': '1'}), \
                    mock.patch('tarfile.open', return_value=archive):
                with self.assertRaises(SystemExit):
                    exec(compile(extractor_source(), str(RESTORE), 'exec'), {})
            admitted = archive.extractfile.call_count
        self.assertFalse(Path(root).exists())
        return admitted

    def test_explicit_capacity_admits_header_above_one_gib(self):
        self.assertEqual(self.admitted_headers([1073741825], 2147483648), 1)

    def test_single_file_below_at_and_above_configured_capacity(self):
        for size, expected in [(9, 1), (10, 1), (11, 0)]:
            with self.subTest(size=size):
                self.assertEqual(self.admitted_headers([size], 10), expected)

    def test_aggregate_files_below_at_and_above_configured_capacity(self):
        for sizes, expected in [([4, 5], 2), ([4, 6], 2), ([4, 7], 1)]:
            with self.subTest(sizes=sizes):
                self.assertEqual(self.admitted_headers(sizes, 10), expected)

    def test_invalid_required_capacity_never_admits_a_member(self):
        for limit in ['', '0', '-1', '+10', '1.5', '1e9', ' 10', '01',
                      '9223372036854775808']:
            with self.subTest(limit=limit):
                self.assertEqual(self.admitted_headers([1], limit), 0)


if __name__ == '__main__':
    unittest.main()
