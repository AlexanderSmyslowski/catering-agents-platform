#!/usr/bin/env python3
"""Synthetic target-selection and initial-install regressions; never contacts a host."""
import copy
import contextlib
import io
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from catering_target_operator_test import (
    ROOT, operator, stage_binding, release_state, contract_validator,
    PRODUCT_SHA, OPERATIONS_SHA, build_fixture_bundle,
)

TARGET = 'catering-prod-02'

class TargetSelectionTests(unittest.TestCase):
    def test_explicit_target_argument_and_legacy_default(self):
        parser = operator._arguments()
        common = ['validate', '--product-commit', PRODUCT_SHA, '--operations-commit', OPERATIONS_SHA,
                  '--product-source', '/synthetic']
        self.assertEqual(getattr(parser.parse_args(common), 'target', None), 'catering-prod-1')
        self.assertEqual(parser.parse_args(common + ['--target', TARGET]).target, TARGET)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            parser.parse_args(common + ['--target', 'unrelated-host'])

    def test_target02_bundle_is_rejected_without_explicit_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle, sha, _, _, source = build_fixture_bundle(Path(tmp))
            path = bundle / 'manifest.json'
            value = json.loads(path.read_text())
            value['targetId'] = TARGET
            path.write_text(json.dumps(value))
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, sha, source)
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, sha, source, target_id=TARGET)

    def test_bootstrap_never_treats_empty_host_as_installed(self):
        path = ROOT / 'platform-infra/scripts/catering-target-bootstrap.py'
        self.assertTrue(path.is_file(), 'missing distinct initial-install verifier')
        spec = importlib.util.spec_from_file_location('bootstrap', path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.assertEqual(mod.classify_containers([]), 'empty')
        with self.assertRaises(mod.BootstrapError):
            mod.verify_installed_containers([])


# The bootstrap module has no import-time host effects.
_spec = importlib.util.spec_from_file_location('target02_bootstrap', ROOT / 'platform-infra/scripts/catering-target-bootstrap.py')
bootstrap = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bootstrap)


def healthy_containers():
    return [{'Name': '/platform-infra-' + name + '-1', 'Id': hashlib.sha256(name.encode()).hexdigest(), 'Image': image,
             'ImageManifestDescriptor': {'digest': 'sha256:08693671787a11fadf8d313e687c5f5a43de631c298bc2f2e0520f432ff1eb0b' if name == 'postgres' else image},
             'Config': {'Labels': {'com.docker.compose.service': name, 'com.docker.compose.project': 'platform-infra'}},
             'State': {'Running': True, 'Health': {'Status': 'healthy'}},
             'Mounts': [{'Destination': '/var/lib/postgresql/data', 'Type': 'volume', 'Name': 'platform-infra_postgres_data', 'Source': '/var/lib/docker/volumes/platform-infra_postgres_data/_data', 'Driver': 'local', 'RW': True, 'Mode': 'z', 'Propagation': ''}] if name == 'postgres' else [],
             'HostConfig': {'RestartPolicy': {'Name': 'no'}, 'PortBindings': {}, 'NetworkMode': 'catering_private'},
             'NetworkSettings': {'Networks': {network: {} for network in ({'catering_private', 'catering_ingress'} if name == 'web' else {'catering_private'})}}}
            for name, image in bootstrap.IMAGES.items()]


def migration_fixture():
    return {'migrationContractVersion': 2, 'comparisonRestrictKey': '0123456789abcdef'*4, 'logicalDigests': {'databases': {
        'catering_agents': 'a'*64, 'catering_agents_pre_cutover_20260920': 'b'*64,
        'catering_operator_probe_20260919': 'c'*64}, 'globals': 'd'*64}}


def restored_fixture(binding):
    return dict(migration_fixture(), productCommit=bootstrap.PRODUCT, operationsCommit=OPERATIONS_SHA,
                manifestSha256='2'*64, inputsSha256='1'*64, postgresBinding=binding)


def loaded_inspect(args):
    # Docker's unqualified root observation and the platform-qualified result
    # have different Id/Descriptor identities in the source's containerd store.
    selected = '--platform' in args
    reference = args[-1]
    manifests = {
        'sha256:778d0b486d6daa02b77434d0358ec57a1b21fd8b6d22ac2eef56a33e816928f6': 'sha256:08693671787a11fadf8d313e687c5f5a43de631c298bc2f2e0520f432ff1eb0b',
        'sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648': 'sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a',
    }
    if selected:
        assert args == ['docker','image','inspect','--platform','linux/amd64',reference]
        image = manifests[reference]
    else:
        assert args == ['docker','image','inspect',reference]
        image = reference
    media = 'index' if reference in manifests and not selected else 'manifest'
    return json.dumps([{'Id':image, 'Os':'linux', 'Architecture':'amd64',
                        'Descriptor': {'digest':image, 'mediaType':'application/vnd.oci.image.'+media+'.v1+json'}}]).encode()


class BootstrapGatesTests(unittest.TestCase):
    def test_running_apps_without_docker_healthcheck_are_verified_by_later_http_probe(self):
        items = healthy_containers()
        for item in items:
            if item['Name'] != '/platform-infra-postgres-1':
                item['State'].pop('Health')
        self.assertEqual(set(bootstrap.verify_installed_containers(items)), {'intake', 'offer', 'production', 'exports', 'web', 'postgres'})

    def test_image_drift_restart_public_network_or_port_blocks_initial_install(self):
        for mutation in ('image', 'restart', 'network', 'port', 'stopped', 'extra'):
            with self.subTest(mutation=mutation):
                items = healthy_containers()
                if mutation == 'image': items[0]['Image'] = 'sha256:' + '0'*64
                if mutation == 'restart': items[0]['HostConfig']['RestartPolicy']['Name'] = 'always'
                if mutation == 'network': items[0]['NetworkSettings']['Networks']['bridge'] = {}
                if mutation == 'port': items[0]['HostConfig']['PortBindings'] = {'80/tcp': [{'HostPort': '80'}]}
                if mutation == 'stopped': items[0]['State']['Running'] = False
                if mutation == 'extra': items.append({'Name': '/catering-edge-edge-1'})
                with self.assertRaises(bootstrap.BootstrapError): bootstrap.verify_installed_containers(items)

    def test_missing_inventory_holds_before_any_host_command(self):
        from types import SimpleNamespace
        import datetime as dt
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp).resolve() / 'inputs.json'
            now = dt.datetime.now(dt.timezone.utc)
            value = {'windowStart': (now-dt.timedelta(minutes=1)).isoformat(), 'windowEnd': (now+dt.timedelta(minutes=10)).isoformat(),
                     'targetId': TARGET, 'serverId': 168651076, 'productCommit': bootstrap.PRODUCT, 'manifestSha256': '2'*64,
                     'operationsCommit': OPERATIONS_SHA, 'sourceInventory': {}}
            path.write_text(json.dumps(value)); path.chmod(0o600)
            args = SimpleNamespace(inputs=path, inputs_sha256=hashlib.sha256(path.read_bytes()).hexdigest(), operations_commit=OPERATIONS_SHA, manifest_sha256='2'*64)
            with patch.object(bootstrap, 'run', side_effect=AssertionError('host command is not allowed')):
                with self.assertRaisesRegex(bootstrap.BootstrapError, 'complete source inventory'):
                    bootstrap.verify_inputs(args)

    def test_source_fence_rejects_running_writer_and_missing_container(self):
        import datetime as dt
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp).resolve() / 'fence.json'
            now = dt.datetime.now(dt.timezone.utc)
            items = healthy_containers() + [{'Name': '/catering-edge-edge-1', 'State': {'Running': False}, 'HostConfig': {'RestartPolicy': {'Name': 'no'}}}]
            value = {'windowStart': (now-dt.timedelta(minutes=1)).isoformat(), 'windowEnd': (now+dt.timedelta(minutes=10)).isoformat(),
                     'serverId': 166533273, 'ip': '2.29.43.174', 'dockerInspect': items, 'scheduledCateringUnits': [], 'runningCateringUnits': [], 'firewallRulesetSha256': '1'*64}
            path.write_text(json.dumps(value)); path.chmod(0o600)
            with self.assertRaisesRegex(bootstrap.BootstrapError, 'source writer'): bootstrap.verify_source_fence(path)
            for item in items: item['State']['Running'] = False
            path.write_text(json.dumps(value))
            self.assertEqual(bootstrap.verify_source_fence(path), hashlib.sha256(path.read_bytes()).hexdigest())
            items.pop(); path.write_text(json.dumps(value))
            with self.assertRaises(bootstrap.BootstrapError): bootstrap.verify_source_fence(path)

    def test_logical_comparison_normalizes_only_pg_random_restrict_token(self):
        a = b'\\restrict Random123\nALTER ROLE catering PASSWORD \'hash\';\n\\unrestrict Random123\n'
        b = a.replace(b'Random123', b'Different456')
        self.assertEqual(bootstrap.logical_digest(a), bootstrap.logical_digest(b))
        self.assertNotEqual(bootstrap.logical_digest(a), bootstrap.logical_digest(b.replace(b'hash', b'other')))


class InitialReceiptTests(unittest.TestCase):
    def fixture(self, root):
        from catering_target_operator_test import CateringTargetOperatorTests, OCI_SHA
        old, _, runtime, web, checker = CateringTargetOperatorTests()._stage_fixture(root)
        release = old.rename(root / bootstrap.PRODUCT)
        path = release / 'manifest.json'; manifest = json.loads(path.read_text())
        manifest.update(targetId=TARGET, productCommit=bootstrap.PRODUCT, migrationSource=operator.MIGRATION_SOURCE)
        path.write_text(json.dumps(manifest)); sha = hashlib.sha256(path.read_bytes()).hexdigest()
        kwargs = dict(manifest_sha256=sha, product_commit=bootstrap.PRODUCT, operations_commit=OPERATIONS_SHA,
                      runtime_image=runtime, web_image=web, stage_binding_sha256=checker, oci_sha256=OCI_SHA,
                      target_id=TARGET, expected_uid=os.getuid(), expected_gid=os.getgid(), require_production_release_root=False)
        values = stage_binding.stage_values(release, **kwargs)
        stage_binding.write_receipt(release, values, expected_uid=os.getuid(), expected_gid=os.getgid())
        return release, manifest, kwargs

    def test_initial_receipt_without_predecessor_is_consumed_by_both_real_validators(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            release, manifest, kwargs = self.fixture(root)
            self.assertEqual(stage_binding.inspect_existing_release(release, **kwargs), 'reusable')
            proof = {'targetId': TARGET, 'productCommit': bootstrap.PRODUCT, 'operationsCommit': OPERATIONS_SHA,
                     'manifestSha256': kwargs['manifest_sha256'], 'state': 'verified_initial_install'}
            bootstrap.write_initial_receipt(release, proof, kwargs['runtime_image'], kwargs['web_image'])
            self.assertFalse((release / 'previous-images.json').exists())
            self.assertEqual(stage_binding.inspect_existing_release(release, **kwargs), 'installed')
            source_names = list(manifest['sourceFiles'])
            observed = release_state.inspect_release_binding(root, release_state.DISCOVER_INSTALLED, *source_names,
                *[manifest['sourceFiles'][name] for name in source_names], bootstrap.PRODUCT, OPERATIONS_SHA, kwargs['manifest_sha256'],
                target_id=TARGET, expected_uid=os.getuid(), expected_gid=os.getgid())
            self.assertEqual(observed['commit'], bootstrap.PRODUCT)
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_release_binding(root, release_state.DISCOVER_INSTALLED, *source_names,
                    *[manifest['sourceFiles'][name] for name in source_names], bootstrap.PRODUCT, OPERATIONS_SHA, kwargs['manifest_sha256'],
                    expected_uid=os.getuid(), expected_gid=os.getgid())
            (release / 'bootstrap-verification.json').write_text('{}')
            with self.assertRaises(stage_binding.StageBindingError): stage_binding.inspect_existing_release(release, **kwargs)

    def test_arbitrary_bootstrap_file_cannot_replace_previous_images_in_normal_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            release, _, kwargs = self.fixture(Path(tmp).resolve())
            (release / 'bootstrap-verification.json').write_text('{}'); (release / 'bootstrap-verification.json').chmod(0o600)
            values = {'status': 'installed', 'commit': bootstrap.PRODUCT, 'runtime_image': kwargs['runtime_image'], 'web_image': kwargs['web_image'],
                      'operations_commit': OPERATIONS_SHA, 'manifest_sha256': kwargs['manifest_sha256'], 'installed_at': '2026-10-05T00:00:00Z'}
            (release / 'install-receipt').write_text(''.join(f'{k}={v}\n' for k,v in values.items())); (release / 'install-receipt').chmod(0o600)
            with self.assertRaises(stage_binding.StageBindingError): stage_binding.inspect_existing_release(release, **kwargs)


class BindingPipelineTests(unittest.TestCase):
    def test_p4_migration_bindings_match_independently_recorded_original_manifest(self):
        # Immutable external protocol fixture, read from the original P4 manifest on 2026-10-05.
        # Synthetic OCI fixtures below must not redefine these production acceptance values.
        self.assertEqual(operator.P4_ARCHIVES, {
            'runtime-image.tar.gz': '3e540113a4dfbe272d15c8eac5713f0911c2fc0831873e87e9d35588701ba43b',
            'web-image.tar.gz': '886d43cde21132b644f91c5a7f52c578a2bc2e6e31b533fd31ff96ea98f64166',
        })
        self.assertEqual(operator.P4_IMAGES, {
            'runtime': 'sha256:6ba5bef903323aa5f4fdc63d1043b627fdaed1cb681526ba19b94a7d7f72c0f3',
            'web': 'sha256:3e45d18ffae79f78d84a4018aa52ac17419f29f2bda3e49ccb3e94311440d48e',
        })
        self.assertEqual(operator.SOURCE_MANIFEST, '9a0bb5c49fd09a9e64a99d00babf69ac771e66238ec5ae728eeedebe7ed79df0')
        self.assertEqual(operator.MIGRATION_PRODUCT, '9ce4fbc96a5dd877f2cd2f00588a22be861306b9')
        self.assertEqual(operator.SOURCE_OPERATIONS, 'b1e3d44573bf6fe6d3c8e46861792a592535e856')

    def test_target02_reuse_preserves_old_bundle_and_bytes_and_binds_new_operations(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            bundle, _, _, commands, source = build_fixture_bundle(root)
            manifest_path = bundle / 'manifest.json'
            original = json.loads(manifest_path.read_text())
            original.update(productCommit=operator.MIGRATION_PRODUCT, operationsCommit=operator.SOURCE_OPERATIONS)
            manifest_path.write_text(json.dumps(original))
            original_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            before = {p.name: p.read_bytes() for p in bundle.iterdir()}
            pinned_images = {name: image['platformManifestDigest'] for name, image in original['images'].items()}
            pinned_archives = {name: original['artifacts'][name] for name in operator.P4_ARCHIVES}
            with patch.object(operator, 'SOURCE_MANIFEST', original_sha), patch.object(operator, 'P4_IMAGES', pinned_images), patch.object(operator, 'P4_ARCHIVES', pinned_archives):
                with self.assertRaises(operator.OperatorError):
                    operator.reuse_migration_bundle(bundle, source, OPERATIONS_SHA, bundle / 'nested-new-target')
                target = root / 'target02'
                sha = operator.reuse_migration_bundle(bundle, source, OPERATIONS_SHA, target)
                manifest = operator.verify_bundle(target, operator.MIGRATION_PRODUCT, OPERATIONS_SHA, sha, source, target_id=TARGET)
                self.assertEqual(manifest['targetId'], TARGET)
                self.assertEqual(manifest['operationsCommit'], OPERATIONS_SHA)
                self.assertEqual(manifest['migrationSource']['operationsCommit'], 'b1e3d44573bf6fe6d3c8e46861792a592535e856')
                for name in ('runtime-image.tar.gz', 'web-image.tar.gz', 'candidate-images.json'):
                    self.assertEqual((target/name).read_bytes(), before[name])
                for product, ops, selected in ((PRODUCT_SHA, OPERATIONS_SHA, TARGET), (operator.MIGRATION_PRODUCT, operator.SOURCE_OPERATIONS, TARGET), (operator.MIGRATION_PRODUCT, OPERATIONS_SHA, 'catering-prod-1')):
                    with self.assertRaises(operator.OperatorError):
                        operator.verify_bundle(target, product, ops, sha, source, target_id=selected)
            self.assertEqual({p.name:p.read_bytes() for p in bundle.iterdir()}, before)

    def test_new_target_contract_cannot_consume_old_observed_inventory(self):
        contract = json.loads((ROOT/'platform-infra/catering-target02-update-contract.json').read_text())
        inventory = json.loads((ROOT/'platform-infra/catering-target-runtime-inventory.json').read_text())
        contract_validator.validate_control_data(contract, None, TARGET)
        for record, selected in ((inventory, TARGET), (None, 'catering-prod-1'), (None, 'unknown')):
            with self.assertRaises(contract_validator.ContractError):
                contract_validator.validate_control_data(contract, record, selected)

    def test_production_runner_loads_operations_contract_with_older_product_root(self):
        import subprocess
        import shlex
        script = ROOT/'platform-infra/scripts/catering-target-production-update.sh'
        definitions = script.read_text().split('case "${MODE}" in')[0]
        # Run the actual loader without the main dispatch; product tree deliberately has no target02 files.
        with tempfile.TemporaryDirectory() as tmp:
            for selected in ('catering-prod-1', TARGET, 'unknown'):
                env = os.environ.copy()
                env.update(CATERING_TARGET_SOURCE_ROOT=tmp, CATERING_TARGET_ID=selected)
                program = definitions.replace('SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"', 'SCRIPT_DIR='+shlex.quote(str(script.parent)))
                result = subprocess.run(['/bin/bash', '-c', program+'\nload_production_contract\nprintf "%s" "$TARGET_ID"'], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 1 if selected == 'unknown' else 0, result.stderr)
                if selected != 'unknown': self.assertEqual(result.stdout, selected)

    def test_access_binding_rejects_wrong_provider_ip_hostkey_and_expired_window(self):
        import datetime as dt
        import base64
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            keybytes = b'synthetic-public-hostkey'
            hosts = root/'known_hosts'; hosts.write_text('2.28.200.16 ssh-ed25519 '+base64.b64encode(keybytes).decode()+'\n'); hosts.chmod(0o600)
            now = dt.datetime.now(dt.timezone.utc)
            original = {'windowStart': (now-dt.timedelta(minutes=1)).isoformat(), 'windowEnd': (now+dt.timedelta(minutes=10)).isoformat(),
                'server': {'id': 168651076, 'name': TARGET, 'public_net': {'ipv4': {'ip': '2.28.200.16'}},
                           'server_type': {'name': 'cx33', 'architecture': 'x86'}, 'image': {'os_flavor': 'ubuntu', 'os_version': '24.04'}},
                'hostKeyFingerprint': 'SHA256:'+base64.b64encode(hashlib.sha256(keybytes).digest()).decode().rstrip('=')}
            path = root/'access.json'; path.write_text(json.dumps(original)); path.chmod(0o600)
            bootstrap.verify_access(path, hosts, '2.28.200.16')
            for field in ('id', 'ip', 'key', 'expired', 'transport'):
                value = copy.deepcopy(original)
                if field == 'id': value['server']['id'] = 166533273
                if field == 'ip': value['server']['public_net']['ipv4']['ip'] = '2.29.43.174'
                if field == 'key': value['hostKeyFingerprint'] = 'SHA256:wrong'
                if field == 'expired': value['windowEnd'] = (now-dt.timedelta(seconds=1)).isoformat()
                path.write_text(json.dumps(value))
                with self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.verify_access(path, hosts, '2.29.43.174' if field == 'transport' else '2.28.200.16')


class FirstStartTests(unittest.TestCase):
    def test_first_start_uses_p4_override_marks_write_boundary_before_app_and_forbids_retry(self):
        self.assertTrue(hasattr(bootstrap, 'start_application'), 'first-write transition must be separately testable')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve(); release = root/'release'; release.mkdir()
            pg = next(item for item in healthy_containers() if item['Name'] == '/platform-infra-postgres-1')
            (root/'restored.json').write_text(json.dumps(restored_fixture(bootstrap.postgres_binding([pg])))); (root/'restored.json').chmod(0o600)
            calls = []
            def docker(args, **kwargs):
                calls.append(args)
                if args[:3] == ['docker', 'image', 'inspect']:
                    return loaded_inspect(args)
                if 'config' in args:
                    return json.dumps({'services': {name: {'image': image, 'restart': 'no'} for name,image in bootstrap.IMAGES.items()}}).encode()
                self.assertTrue((root/'first-app-write.json').exists(), 'app started before durable write boundary')
                self.assertEqual(args[-5:], ['intake', 'offer', 'production', 'exports', 'web'])
                self.assertIn(str(release/'candidate-images.json'), args)
                self.assertNotIn('operations.json', ' '.join(args))
                self.assertIn('--no-deps', args)
                self.assertEqual(args[args.index('--pull')+1], 'never')
                raise bootstrap.BootstrapError('synthetic start failure after potential write')
            with patch.object(bootstrap, 'STATE', root), patch.object(bootstrap, 'observe_containers', return_value=[item for item in healthy_containers() if item['Name'] == '/platform-infra-postgres-1']), \
                 patch.object(bootstrap, 'verify_networks'), patch.object(bootstrap, 'verify_restored'), patch.object(bootstrap, 'check_execution_windows'), patch.object(bootstrap, 'run', side_effect=docker):
                with self.assertRaisesRegex(bootstrap.BootstrapError, 'synthetic start failure'):
                    bootstrap.start_application(release, migration_fixture(), '1'*64, '2'*64, OPERATIONS_SHA)
                count = len(calls)
                with self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.start_application(release, migration_fixture(), '1'*64, '2'*64, OPERATIONS_SHA)
                self.assertEqual(len(calls), count)
                self.assertFalse((release/'install-receipt').exists())


class PostgresPreservationTests(unittest.TestCase):
    def test_installed_container_check_rejects_substituted_data_volume(self):
        for field, value in (('Name', 'replacement-volume'), ('Type', 'bind')):
            items = healthy_containers()
            pg = next(item for item in items if item['Name'] == '/platform-infra-postgres-1')
            pg['Mounts'][0][field] = value
            with self.subTest(field=field), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.verify_installed_containers(items)

    def test_first_start_records_the_restored_postgres_instance_and_full_mount(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve(); release = root/'release'; release.mkdir()
            pg = next(item for item in healthy_containers() if item['Name'] == '/platform-infra-postgres-1')
            expected = {'containerId': pg['Id'], 'image': pg['Image'], 'dataMount': copy.deepcopy(pg['Mounts'][0])}
            (root/'restored.json').write_text(json.dumps(restored_fixture(expected))); (root/'restored.json').chmod(0o600)
            def docker(args, **kwargs):
                if args[:3] == ['docker', 'image', 'inspect']:
                    return loaded_inspect(args)
                if 'config' in args:
                    return json.dumps({'services': {name: {'image': image, 'restart': 'no'} for name,image in bootstrap.IMAGES.items()}}).encode()
                self.assertEqual(json.loads((root/'first-app-write.json').read_text())['postgresBinding'], expected)
                return b''
            with patch.object(bootstrap, 'STATE', root), patch.object(bootstrap, 'observe_containers', return_value=[pg]), \
                 patch.object(bootstrap, 'verify_networks'), patch.object(bootstrap, 'verify_restored'), patch.object(bootstrap, 'check_execution_windows'), patch.object(bootstrap, 'run', side_effect=docker):
                bootstrap.start_application(release, migration_fixture(), '1'*64, '2'*64, OPERATIONS_SHA)

    def test_post_start_and_post_smoke_replacements_never_publish_receipt(self):
        self.assertTrue(hasattr(bootstrap, 'verify_initial_install'), 'initial verification must expose its actual runtime transition for regression coverage')
        for moment in ('before_verify', 'after_smoke', 'unchanged'):
            for replacement in ('container', 'mount'):
                with self.subTest(moment=moment, replacement=replacement), tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp).resolve(); release = root/'release'; release.mkdir()
                    initial = healthy_containers(); pg = next(item for item in initial if item['Name'] == '/platform-infra-postgres-1')
                    binding = {'containerId': pg['Id'], 'image': pg['Image'], 'dataMount': copy.deepcopy(pg['Mounts'][0])}
                    changed = copy.deepcopy(initial); changed_pg = next(item for item in changed if item['Name'] == pg['Name'])
                    if replacement == 'container': changed_pg['Id'] = 'f'*64
                    else: changed_pg['Mounts'][0]['Source'] = '/var/lib/docker/replaced-volume/_data'
                    boundary = {'inputsSha256': '1'*64, 'manifestSha256': '2'*64, 'operationsCommit': OPERATIONS_SHA, 'postgresBinding': binding}
                    restored = {'postgresBinding': binding, 'logicalDigests': {'database': 'old', 'globals': 'old'}}
                    for name, value in [('first-app-write.json',boundary),('restored.json',restored),('credentials.json',{'basicUser':'synthetic','basicPassword':'synthetic','loginCode':'synthetic','pin':'synthetic'})]:
                        (root/name).write_text(json.dumps(value)); (root/name).chmod(0o600)
                    observations = [changed if moment == 'before_verify' else initial, initial, changed if moment == 'after_smoke' else initial]
                    with patch.object(bootstrap, 'STATE', root), patch.object(bootstrap, 'observe_containers', side_effect=observations), \
                         patch.object(bootstrap, 'verify_networks'), patch.object(bootstrap, 'verify_jobs_off'), patch.object(bootstrap, 'check_execution_windows'), \
                         patch.object(bootstrap, 'verify_database_version'), patch.object(bootstrap, 'database_catalog'), patch.object(bootstrap, 'run', return_value=b''):
                        if moment == 'unchanged':
                            bootstrap.verify_initial_install(release, {'smokeCredentials': {'path': str(root/'credentials.json')}}, '1'*64, '2'*64, OPERATIONS_SHA)
                            self.assertTrue((release/'install-receipt').exists())
                        else:
                            with self.assertRaises(bootstrap.BootstrapError):
                                bootstrap.verify_initial_install(release, {'smokeCredentials': {'path': str(root/'credentials.json')}}, '1'*64, '2'*64, OPERATIONS_SHA)
                            self.assertFalse((release/'install-receipt').exists())
                            self.assertFalse((root/'installed').exists())


class DurableBoundaryTests(unittest.TestCase):
    def test_exclusive_publication_syncs_file_then_parent_directory_before_return(self):
        import stat
        calls = []
        original = os.fsync
        def syncing(fd):
            calls.append('directory' if stat.S_ISDIR(os.fstat(fd).st_mode) else 'file')
            original(fd)
        with tempfile.TemporaryDirectory() as tmp, patch.object(bootstrap.os, 'fsync', side_effect=syncing):
            bootstrap.write_new(Path(tmp).resolve()/'boundary.json', '{}')
        self.assertEqual(calls, ['file', 'directory'])


class ExecutionWindowTests(unittest.TestCase):
    def fixture(self, root):
        window = {'windowStart': '2026-10-05T10:00:00+00:00', 'windowEnd': '2026-10-05T10:01:00+00:00'}
        fence = root/'fence.json'; fence.write_text(json.dumps(window)); fence.chmod(0o600)
        package = dict(window, **migration_fixture(), sourceFence={'path': str(fence), 'sha256': hashlib.sha256(fence.read_bytes()).hexdigest()})
        pg = next(item for item in healthy_containers() if item['Name'] == '/platform-infra-postgres-1')
        binding = {'containerId': pg['Id'], 'image': pg['Image'], 'dataMount': copy.deepcopy(pg['Mounts'][0])}
        for name,value in [('restored.json',restored_fixture(binding)),
                           ('first-app-write-fixture.json',{'inputsSha256':'1'*64,'manifestSha256':'2'*64,'operationsCommit':OPERATIONS_SHA,'postgresBinding':binding}),
                           ('credentials.json',{'basicUser':'synthetic','basicPassword':'synthetic','loginCode':'synthetic','pin':'synthetic'})]:
            (root/name).write_text(json.dumps(value)); (root/name).chmod(0o600)
        package['smokeCredentials'] = {'path': str(root/'credentials.json')}
        return package, window, pg

    def test_expired_window_after_slow_restore_prevents_first_write_and_app_start(self):
        import datetime as dt
        real_datetime = dt.datetime
        clock = [real_datetime(2026,10,5,10,0,tzinfo=dt.timezone.utc)]
        class Clock(real_datetime):
            @classmethod
            def now(cls, tz=None): return clock[0]
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve(); release=root/'release'; release.mkdir()
            package,access,pg=self.fixture(root); calls=[]
            def restore(_): clock[0] = real_datetime(2026,10,5,10,2,tzinfo=dt.timezone.utc)
            def docker(args, **kwargs):
                calls.append(args)
                if args[:3] == ['docker','image','inspect']:
                    return loaded_inspect(args)
                if 'config' in args:
                    return json.dumps({'services':{name:{'image':image,'restart':'no'} for name,image in bootstrap.IMAGES.items()}}).encode()
                return b''
            with patch.object(bootstrap,'STATE',root), patch.object(bootstrap.dt,'datetime',Clock), \
                 patch.object(bootstrap,'observe_containers',return_value=[pg]), patch.object(bootstrap,'verify_networks'), \
                 patch.object(bootstrap,'verify_restored',side_effect=restore), patch.object(bootstrap,'run',side_effect=docker):
                bootstrap.check_execution_windows(package,access)
                with self.assertRaisesRegex(bootstrap.BootstrapError,'execution window'):
                    bootstrap.start_application(release,package,'1'*64,'2'*64,OPERATIONS_SHA,access=access)
            self.assertFalse((root/'first-app-write.json').exists())
            self.assertFalse(any('up' in args for args in calls))

    def test_expired_window_after_slow_health_prevents_auth_smoke_and_receipt(self):
        import datetime as dt
        real_datetime = dt.datetime
        clock = [real_datetime(2026,10,5,10,0,tzinfo=dt.timezone.utc)]
        class Clock(real_datetime):
            @classmethod
            def now(cls, tz=None): return clock[0]
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve(); release=root/'release'; release.mkdir()
            package,access,_=self.fixture(root)
            (root/'first-app-write-fixture.json').rename(root/'first-app-write.json')
            calls=[]
            def docker(args, **kwargs):
                calls.append(args)
                clock[0]=real_datetime(2026,10,5,10,2,tzinfo=dt.timezone.utc)
                return b''
            with patch.object(bootstrap,'STATE',root), patch.object(bootstrap.dt,'datetime',Clock), \
                 patch.object(bootstrap,'observe_containers',return_value=healthy_containers()), patch.object(bootstrap,'verify_networks'), \
                 patch.object(bootstrap,'verify_database_version'), patch.object(bootstrap,'database_catalog'), patch.object(bootstrap,'run',side_effect=docker):
                with self.assertRaisesRegex(bootstrap.BootstrapError,'execution window'):
                    bootstrap.verify_initial_install(release,package,'1'*64,'2'*64,OPERATIONS_SHA,access=access)
            self.assertFalse(any('-i' in args for args in calls))
            self.assertFalse((release/'install-receipt').exists())
            self.assertFalse((root/'installed').exists())

    def test_failed_directory_sync_prevents_application_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();release=root/'release';release.mkdir()
            package,access,pg=self.fixture(root);calls=[]
            def docker(args,**kwargs):
                calls.append(args)
                if args[:3]==['docker','image','inspect']:
                    return loaded_inspect(args)
                if 'config' in args:
                    return json.dumps({'services':{name:{'image':image,'restart':'no'} for name,image in bootstrap.IMAGES.items()}}).encode()
                return b''
            with patch.object(bootstrap,'STATE',root), patch.object(bootstrap,'observe_containers',return_value=[pg]), \
                 patch.object(bootstrap,'verify_networks'), patch.object(bootstrap,'verify_restored'), patch.object(bootstrap,'check_execution_windows'), \
                 patch.object(bootstrap,'sync_directory',side_effect=OSError('synthetic fsync failure')), patch.object(bootstrap,'run',side_effect=docker):
                with self.assertRaises(OSError):
                    bootstrap.start_application(release,package,'1'*64,'2'*64,OPERATIONS_SHA,access=access)
            self.assertFalse(any('up' in args for args in calls))
            self.assertTrue((root/'first-app-write.json').exists())
            self.assertFalse((release/'install-receipt').exists())

class ThreeDatabaseTests(unittest.TestCase):
    comparison_key = '0123456789abcdef'*4
    databases = ('catering_agents', 'catering_agents_pre_cutover_20260920', 'catering_operator_probe_20260919')

    def fixture(self):
        catalog = '\n'.join(sorted((*self.databases, 'postgres', 'template0', 'template1'))).encode() + b'\n'
        dumps = {name: b'\\restrict Source123\nCREATE DATABASE ' + name.encode() + b';\n\\unrestrict Source123\n\\connect ' + name.encode() + b'\n\\restrict Source123\nCOPY t FROM stdin;\nrow\n\\.\n\\unrestrict Source123\n' for name in self.databases}
        globals_dump = b"\\restrict Source123\nALTER ROLE catering PASSWORD 'synthetic-verifier';\n\\unrestrict Source123\n"
        dumps = {name: value.replace(b'Source123', self.comparison_key.encode()) for name, value in dumps.items()}
        globals_dump = globals_dump.replace(b'Source123', self.comparison_key.encode())
        def expected(payload):
            return hashlib.sha256(payload).hexdigest()
        logical = {'databases': {name: expected(value) for name, value in dumps.items()}, 'globals': expected(globals_dump)}
        calls = []
        def host(args, **kwargs):
            calls.append(args)
            self.assertEqual(args[:3], ['docker', 'exec', 'platform-infra-postgres-1'])
            command = args[3]
            if command in ('pg_dump', 'pg_dumpall') and args[4:] == ['--version']:
                return (command + ' (PostgreSQL) 17.9\n').encode()
            if command == 'psql':
                self.assertIn('--no-psqlrc', args)
                sql = args[-1]
                if sql == 'SHOW server_version': return b'17.9\n'
                if sql == "SELECT version_number FROM catering_schema_migrations WHERE unit_name = 'catering_business_records'": return b'3\n'
                if sql == 'SELECT datname FROM pg_database ORDER BY datname': return catalog
            if command == 'pg_dump':
                name = next(value.split('=', 1)[1] for value in args if value.startswith('--dbname='))
                self.assertEqual(args[4:], ['--username=catering', '--no-password', '--dbname=' + name, '--create', '--format=plain', '--restrict-key=' + self.comparison_key])
                return dumps[name]
            if command == 'pg_dumpall':
                self.assertEqual(args[4:], ['--username=catering', '--no-password', '--globals-only', '--restrict-key=' + self.comparison_key])
                return globals_dump
            self.fail('unexpected observation command')
        return dumps, logical, calls, host

    def test_compares_all_three_complete_databases_and_globals(self):
        _, logical, _, host = self.fixture()
        with patch.object(bootstrap, 'run', side_effect=host):
            self.assertEqual(bootstrap.database_digests(self.comparison_key), logical)

    def test_extra_missing_duplicate_or_changed_database_catalog_fails_closed(self):
        for drift in ('extra', 'missing', 'duplicate', 'changed_after_dumps'):
            _, _, _, host = self.fixture(); reads = [0]
            def changed(args, **kwargs):
                value = host(args, **kwargs)
                if args[-1] == 'SELECT datname FROM pg_database ORDER BY datname':
                    reads[0] += 1
                    if drift == 'extra' or drift == 'changed_after_dumps' and reads[0] > 1: return value + b'foreign_database\n'
                    if drift == 'missing': return value.replace(b'catering_operator_probe_20260919\n', b'')
                    if drift == 'duplicate': return value + b'catering_agents\n'
                return value
            with self.subTest(drift=drift), patch.object(bootstrap, 'run', side_effect=changed), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.database_digests(self.comparison_key)

    def test_each_omitted_database_change_prevents_first_write(self):
        for name in self.databases[1:]:
            dumps, logical, calls, host = self.fixture()
            dumps[name] = dumps[name].replace(b'row\n', b'changed\n')
            with self.subTest(database=name), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve(); release = root/'release'; release.mkdir()
                pg = next(item for item in healthy_containers() if item['Name'] == '/platform-infra-postgres-1')
                receipt = {'migrationContractVersion': 2, 'productCommit': bootstrap.PRODUCT, 'operationsCommit': OPERATIONS_SHA,
                           'manifestSha256': '2'*64, 'inputsSha256': '1'*64, 'logicalDigests': logical,
                           'postgresBinding': bootstrap.postgres_binding([pg])}
                (root/'restored.json').write_text(json.dumps(receipt)); (root/'restored.json').chmod(0o600)
                with patch.object(bootstrap, 'STATE', root), patch.object(bootstrap, 'observe_containers', return_value=[pg]), \
                     patch.object(bootstrap, 'verify_networks'), patch.object(bootstrap, 'run', side_effect=host), \
                     self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.start_application(release, {'migrationContractVersion': 2, 'comparisonRestrictKey': self.comparison_key, 'logicalDigests': logical}, '1'*64, '2'*64, OPERATIONS_SHA)
                self.assertFalse((root/'first-app-write.json').exists())
                self.assertFalse(any('up' in args for args in calls))

    def test_all_three_comparisons_precede_first_write_and_instance_drift_holds(self):
        for drift in ('none', 'container', 'mount'):
            _, logical, _, host = self.fixture()
            with self.subTest(drift=drift), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve(); release = root/'release'; release.mkdir()
                pg = next(item for item in healthy_containers() if item['Name'] == '/platform-infra-postgres-1')
                changed = copy.deepcopy(pg)
                if drift == 'container': changed['Id'] = 'f'*64
                if drift == 'mount': changed['Mounts'][0]['Source'] = '/replacement'
                package = dict(migration_fixture(), logicalDigests=logical)
                receipt = dict(restored_fixture(bootstrap.postgres_binding([pg])), logicalDigests=logical)
                (root/'restored.json').write_text(json.dumps(receipt)); (root/'restored.json').chmod(0o600)
                inventory = {name: [] for name in ('/opt/catering-agents-platform/data', '/etc/catering-target/runtime.env',
                    '/opt/catering-agents-platform/platform-infra/sites', '/var/lib/docker/volumes/platform-infra_caddy_data/_data',
                    '/var/lib/docker/volumes/platform-infra_caddy_config/_data', '/var/lib/docker/volumes/catering-edge_edge_caddy_data/_data',
                    '/var/lib/docker/volumes/catering-edge_edge_caddy_config/_data')}
                path = root/'inventory.json'; path.write_text(json.dumps(inventory)); path.chmod(0o600)
                package['fileInventory'] = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                started = []
                def execute(args, **kwargs):
                    if 'config' in args: return json.dumps({'services': {name: {'image': image, 'restart': 'no'} for name, image in bootstrap.IMAGES.items()}}).encode()
                    if 'up' in args:
                        proof = json.loads((root/'first-app-write.json').read_text())
                        self.assertEqual(proof['logicalDigests'], logical)
                        self.assertEqual(proof['migrationContractVersion'], 2)
                        started.append(True); return b''
                    return host(args, **kwargs)
                with patch.object(bootstrap, 'STATE', root), patch.object(bootstrap, 'observe_containers', side_effect=[[pg], [changed]]), \
                     patch.object(bootstrap, 'verify_networks'), patch.object(bootstrap, 'verify_loaded_images'), \
                     patch.object(bootstrap, 'check_execution_windows'), patch.object(bootstrap, 'file_inventory', return_value=[]), \
                     patch.object(bootstrap, 'run', side_effect=execute):
                    if drift == 'none': bootstrap.start_application(release, package, '1'*64, '2'*64, OPERATIONS_SHA)
                    else:
                        with self.assertRaises(bootstrap.BootstrapError): bootstrap.start_application(release, package, '1'*64, '2'*64, OPERATIONS_SHA)
                self.assertEqual(bool(started), drift == 'none')
                self.assertEqual((root/'first-app-write.json').exists(), drift == 'none')

    def test_input_drift_is_rechecked_inside_main_lock_before_any_phase_mutation(self):
        import fcntl
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve(); events = []
            class TargetState:
                parent = root.parent
                def mkdir(self, **kwargs): pass
                def lstat(self): return SimpleNamespace(st_uid=0, st_mode=0o40700)
                def is_symlink(self): return False
                def __truediv__(self, name): return root/name
            def inputs(args):
                events.append('input')
                if events.count('input') == 2: raise bootstrap.BootstrapError('synthetic input drift')
                return {}
            original_text = Path.read_text
            def text(path, *args, **kwargs):
                return 'VERSION_ID="24.04"' if str(path) == '/etc/os-release' else original_text(path, *args, **kwargs)
            args = ['start', '--access-evidence', str(root/'access'), '--known-hosts', str(root/'hosts'), '--host', bootstrap.IP,
                    '--operations-commit', OPERATIONS_SHA, '--manifest-sha256', '2'*64, '--inputs', str(root/'inputs'), '--inputs-sha256', '1'*64]
            output = io.StringIO()
            with patch.object(bootstrap, 'STATE', TargetState()), patch.object(bootstrap, 'RELEASE_ROOT', root), \
                 patch.object(bootstrap, 'verify_access', return_value={}), patch.object(bootstrap.os, 'geteuid', return_value=0), \
                 patch.object(bootstrap.sys, 'platform', 'linux'), patch.object(bootstrap.socket, 'gethostname', return_value=TARGET), \
                 patch.object(bootstrap.os, 'uname', return_value=SimpleNamespace(machine='x86_64')), patch.object(Path, 'read_text', text), \
                 patch.object(operator, '_validate_checkout'), patch.object(operator, 'verify_bundle', return_value={}), \
                 patch.object(bootstrap, 'module', side_effect=lambda name: operator if name == 'operator' else stage_binding), \
                 patch.object(bootstrap, 'verify_jobs_off'), patch.object(bootstrap, 'observe_containers', return_value=[]), \
                 patch.object(bootstrap, 'verify_inputs', side_effect=inputs), patch.object(bootstrap, 'check_execution_windows'), \
                 patch.object(bootstrap, 'sync_directory'), patch.object(fcntl, 'flock', side_effect=lambda *args: events.append('lock')), \
                 contextlib.redirect_stderr(output):
                self.assertEqual(bootstrap.main(args), 1)
            self.assertEqual(events, ['input', 'lock', 'input'])
            self.assertFalse((root/'first-app-write.json').exists())

    def test_first_start_rejects_misbound_restore_receipt_before_database_commands(self):
        for field in ('inputsSha256', 'manifestSha256', 'productCommit', 'operationsCommit', 'migrationContractVersion', 'logicalDigests'):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                pg = next(item for item in healthy_containers() if item['Name'] == '/platform-infra-postgres-1')
                receipt = restored_fixture(bootstrap.postgres_binding([pg])); receipt[field] = 'mismatched'
                path = root/'restored.json'; path.write_text(json.dumps(receipt)); path.chmod(0o600)
                with patch.object(bootstrap, 'STATE', root), patch.object(bootstrap, 'observe_containers', return_value=[pg]), \
                     patch.object(bootstrap, 'run', side_effect=AssertionError('host command before bound receipt')), \
                     self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.start_application(root/'release', migration_fixture(), '1'*64, '2'*64, OPERATIONS_SHA)
                self.assertFalse((root/'first-app-write.json').exists())

    def test_same_key_in_sql_body_or_copy_is_never_normalized_away(self):
        for data in (b"CREATE FUNCTION f() RETURNS text AS $$\n\\restrict " + self.comparison_key.encode() + b"\n$$ LANGUAGE sql;\n",
                     b"\\restrict " + self.comparison_key.encode() + b"\n"):
            dumps, _, _, host = self.fixture()
            dumps[self.databases[1]] = dumps[self.databases[1]].replace(b'row\n', data)
            with patch.object(bootstrap, 'run', side_effect=host):
                before = bootstrap.database_digests(self.comparison_key)
                dumps[self.databases[1]] = dumps[self.databases[1]].replace(data, data.replace(b'restrict', b'unrestrict'))
                after = bootstrap.database_digests(self.comparison_key)
            self.assertNotEqual(before['databases'][self.databases[1]], after['databases'][self.databases[1]])

    def test_empty_or_wrong_pg_and_client_versions_fail_closed(self):
        for observed in (b'', b'17.8\n', b'18.0\n'):
            with self.subTest(observed=observed), patch.object(bootstrap, 'run', return_value=observed), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.database_digests(self.comparison_key)
        _, _, _, host = self.fixture()
        def wrong_client(args, **kwargs):
            return b'pg_dump (PostgreSQL) 17.8\n' if args[-1] == '--version' else host(args, **kwargs)
        with patch.object(bootstrap, 'run', side_effect=wrong_client), self.assertRaises(bootstrap.BootstrapError):
            bootstrap.database_digests(self.comparison_key)

    def test_failed_dump_keeps_private_output_out_of_exception_and_logs(self):
        from types import SimpleNamespace
        private = b'synthetic-private-verifier-and-row'
        output = io.StringIO()
        with patch.object(bootstrap.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout=private, stderr=private)), \
             contextlib.redirect_stdout(output), contextlib.redirect_stderr(output), self.assertRaises(bootstrap.BootstrapError) as raised:
            bootstrap.database_digests(self.comparison_key)
        self.assertNotIn(private.decode(), str(raised.exception) + output.getvalue())

    def test_successful_command_with_empty_dump_is_not_a_complete_comparison(self):
        for command in ('pg_dump', 'pg_dumpall'):
            _, _, _, host = self.fixture()
            def empty(args, **kwargs):
                return b'' if args[3] == command and args[-1] != '--version' else host(args, **kwargs)
            with self.subTest(command=command), patch.object(bootstrap, 'run', side_effect=empty), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.database_digests(self.comparison_key)

    def test_complete_archive_and_source_contract_rejects_partial_or_misbound_inputs(self):
        import datetime as dt
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            now = dt.datetime.now(dt.timezone.utc)
            window = {'windowStart': (now-dt.timedelta(minutes=1)).isoformat(), 'windowEnd': (now+dt.timedelta(minutes=5)).isoformat()}
            fence = root/'fence.json'; fence.write_text(json.dumps(window)); fence.chmod(0o600)
            package = dict(window, **migration_fixture(), sourceFence={'path': str(fence), 'sha256': hashlib.sha256(fence.read_bytes()).hexdigest()})
            package['fullDatabaseDumps'] = {}
            for name in self.databases:
                path = root/(name+'.dump'); path.write_bytes(b'PGDMP-synthetic-'+name.encode()); path.chmod(0o600)
                package['fullDatabaseDumps'][name] = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            package['logicalComparisonSource'] = {'serverId': 166533273, 'ip': '2.29.43.174', 'sourceFenceSha256': package['sourceFence']['sha256'],
                                                  'capturedAt': now.isoformat(), 'pgDumpVersion': '17.9'}
            bootstrap.verify_database_inputs(package)
            for mutation in ('legacy_version', 'no_version', 'missing_key', 'invalid_key', 'legacy_archive', 'missing_archive', 'extra_archive', 'duplicate_archive', 'hardlinked_archive', 'copied_archive', 'bad_archive_hash', 'bad_archive_magic',
                             'missing_digest', 'extra_digest', 'invalid_digest', 'extra_logical_key', 'source', 'fence', 'future_capture', 'old_capture', 'client', 'missing_provenance'):
                changed = copy.deepcopy(package)
                if mutation == 'legacy_version': changed['migrationContractVersion'] = 1
                if mutation == 'no_version': changed.pop('migrationContractVersion')
                if mutation == 'missing_key': changed.pop('comparisonRestrictKey')
                if mutation == 'invalid_key': changed['comparisonRestrictKey'] = 'unsafe key'
                if mutation == 'legacy_archive': changed['fullDatabaseDump'] = changed['fullDatabaseDumps'][self.databases[0]]
                if mutation == 'missing_archive': changed['fullDatabaseDumps'].pop(self.databases[2])
                if mutation == 'extra_archive': changed['fullDatabaseDumps']['extra'] = changed['fullDatabaseDumps'][self.databases[0]]
                if mutation == 'duplicate_archive': changed['fullDatabaseDumps'][self.databases[1]] = changed['fullDatabaseDumps'][self.databases[0]]
                if mutation == 'hardlinked_archive':
                    hardlink = root/'hardlink.dump'; os.link(changed['fullDatabaseDumps'][self.databases[0]]['path'], hardlink)
                    changed['fullDatabaseDumps'][self.databases[1]] = {'path': str(hardlink), 'sha256': changed['fullDatabaseDumps'][self.databases[0]]['sha256']}
                if mutation == 'copied_archive':
                    copied = root/'copied.dump'; copied.write_bytes(Path(changed['fullDatabaseDumps'][self.databases[0]]['path']).read_bytes()); copied.chmod(0o600)
                    changed['fullDatabaseDumps'][self.databases[1]] = {'path': str(copied), 'sha256': changed['fullDatabaseDumps'][self.databases[0]]['sha256']}
                if mutation == 'bad_archive_hash': changed['fullDatabaseDumps'][self.databases[1]]['sha256'] = 'f'*64
                if mutation == 'bad_archive_magic':
                    bad = root/'invalid.dump'; bad.write_bytes(b'not-custom'); bad.chmod(0o600)
                    changed['fullDatabaseDumps'][self.databases[2]] = {'path': str(bad), 'sha256': hashlib.sha256(bad.read_bytes()).hexdigest()}
                if mutation == 'missing_digest': changed['logicalDigests']['databases'].pop(self.databases[1])
                if mutation == 'extra_digest': changed['logicalDigests']['databases']['extra'] = 'f'*64
                if mutation == 'invalid_digest': changed['logicalDigests']['databases'][self.databases[1]] = ''
                if mutation == 'extra_logical_key': changed['logicalDigests']['ignored'] = 'f'*64
                if mutation == 'source': changed['logicalComparisonSource']['serverId'] = 168651076
                if mutation == 'fence': changed['logicalComparisonSource']['sourceFenceSha256'] = 'f'*64
                if mutation == 'future_capture': changed['logicalComparisonSource']['capturedAt'] = (now+dt.timedelta(minutes=6)).isoformat()
                if mutation == 'old_capture': changed['logicalComparisonSource']['capturedAt'] = (now-dt.timedelta(minutes=2)).isoformat()
                if mutation == 'client': changed['logicalComparisonSource']['pgDumpVersion'] = '17.8'
                if mutation == 'missing_provenance': changed['logicalComparisonSource'].pop('capturedAt')
                with self.subTest(mutation=mutation), self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.verify_database_inputs(changed)


if __name__ == '__main__':
    unittest.main()
