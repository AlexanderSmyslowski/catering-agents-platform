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
    return [{'Name': '/platform-infra-' + name + '-1', 'Id': name + '-container-id', 'Image': image,
             'ImageManifestDescriptor': {'digest': image},
             'Config': {'Labels': {'com.docker.compose.service': name, 'com.docker.compose.project': 'platform-infra'}},
             'State': {'Running': True, 'Health': {'Status': 'healthy'}},
             'Mounts': [{'Destination': '/var/lib/postgresql/data', 'Type': 'volume', 'Name': 'platform-infra_postgres_data'}] if name == 'postgres' else [],
             'HostConfig': {'RestartPolicy': {'Name': 'no'}, 'PortBindings': {}, 'NetworkMode': 'catering_private'},
             'NetworkSettings': {'Networks': {network: {} for network in ({'catering_private', 'catering_ingress'} if name == 'web' else {'catering_private'})}}}
            for name, image in bootstrap.IMAGES.items()]


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
                     'targetId': TARGET, 'serverId': 168651076, 'productCommit': bootstrap.PRODUCT,
                     'operationsCommit': OPERATIONS_SHA, 'sourceInventory': {}}
            path.write_text(json.dumps(value)); path.chmod(0o600)
            args = SimpleNamespace(inputs=path, inputs_sha256=hashlib.sha256(path.read_bytes()).hexdigest(), operations_commit=OPERATIONS_SHA)
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
            (root/'restored.json').write_text(json.dumps({'inputsSha256': '1'*64})); (root/'restored.json').chmod(0o600)
            calls = []
            def docker(args, **kwargs):
                calls.append(args)
                if args[:3] == ['docker', 'image', 'inspect']:
                    return json.dumps([{'Id': args[3], 'Os': 'linux', 'Architecture': 'amd64'}]).encode()
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
                 patch.object(bootstrap, 'verify_networks'), patch.object(bootstrap, 'verify_restored'), patch.object(bootstrap, 'run', side_effect=docker):
                with self.assertRaisesRegex(bootstrap.BootstrapError, 'synthetic start failure'):
                    bootstrap.start_application(release, {}, '1'*64, '2'*64, OPERATIONS_SHA)
                count = len(calls)
                with self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.start_application(release, {}, '1'*64, '2'*64, OPERATIONS_SHA)
                self.assertEqual(len(calls), count)
                self.assertFalse((release/'install-receipt').exists())

if __name__ == '__main__':
    unittest.main()
