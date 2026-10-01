"""Independent synthetic OCI fixtures for the R/M/C bundle contract."""
import gzip
import hashlib
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path


def archive_fixture(kind='runtime', identity='index', mutation=None):
    files = {}
    def blob(value, media):
        data = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
        digest = 'sha256:' + hashlib.sha256(data).hexdigest()
        files['blobs/sha256/' + digest[7:]] = data
        return {'mediaType': media, 'digest': digest, 'size': len(data)}
    idx = 'application/vnd.oci.image.index.v1+json'
    man = 'application/vnd.oci.image.manifest.v1+json'
    cfg = 'application/vnd.oci.image.config.v1+json'
    layer = blob(b'layer-' + kind.encode(), 'application/vnd.oci.image.layer.v1.tar')
    config = blob({'architecture': 'arm64' if mutation == 'wrong-config-platform' else 'amd64', 'os': 'linux', 'config': {'Labels': {'kind': kind}}, 'rootfs': {'type': 'layers', 'diff_ids': [layer['digest']]}}, cfg)
    mc = dict(config)
    if mutation == 'wrong-config-size': mc['size'] += 1
    if mutation == 'wrong-config-type': mc['mediaType'] = man
    manifest = blob({'schemaVersion': 2, 'mediaType': man, 'config': mc, 'layers': [layer]}, man)
    selected = {**manifest, 'platform': {'os': 'linux', 'architecture': 'amd64'}}
    if mutation == 'variant': selected['platform']['variant'] = 'v1'
    if mutation == 'wrong-descriptor-platform': selected['platform']['architecture'] = 'arm64'
    if mutation == 'wrong-manifest-size': selected['size'] += 1
    if mutation == 'wrong-manifest-type': selected['mediaType'] = idx
    entries = [selected]
    if mutation == 'zero-platform': entries = []
    if mutation == 'ambiguous-platform': entries.append(dict(selected))
    if identity == 'attestation' or mutation in {'wrong-attestation-ref', 'unexpected-entry'}:
        ac = blob({'os': 'unknown', 'architecture': 'unknown', 'rootfs': {'type': 'layers', 'diff_ids': []}}, cfg)
        al = blob(b'{"predicateType":"fixture"}', 'application/vnd.in-toto+json')
        am = blob({'schemaVersion': 2, 'mediaType': man, 'config': ac, 'layers': [al]}, man)
        entries.append({**am, 'platform': {'os': 'unknown', 'architecture': 'unknown'}, 'annotations': {'vnd.docker.reference.type': 'invalid' if mutation == 'unexpected-entry' else 'attestation-manifest', 'vnd.docker.reference.digest': 'sha256:' + 'f'*64 if mutation == 'wrong-attestation-ref' else manifest['digest']}})
    index = blob({'schemaVersion': 2, 'mediaType': idx, 'manifests': entries}, idx)
    root = selected if identity == 'manifest' else index
    iid = root['digest']
    files['index.json'] = json.dumps({'schemaVersion': 2, 'mediaType': idx, 'manifests': [root]}).encode()
    config_path = 'blobs/sha256/' + config['digest'][7:]
    files['manifest.json'] = json.dumps([{'Config': 'blobs/sha256/' + layer['digest'][7:] if mutation == 'different-docker-config' else config_path, 'RepoTags': None, 'Layers': [] if mutation == 'different-docker-layers' else ['blobs/sha256/' + layer['digest'][7:]]}]).encode()
    files['oci-layout'] = b'{"imageLayoutVersion":"1.0.0"}'
    if mutation in {'tampered-index','tampered-manifest','tampered-config','tampered-layer','missing-manifest'}:
        d = {'tampered-index': index, 'tampered-manifest': manifest, 'tampered-config': config, 'tampered-layer': layer, 'missing-manifest': manifest}[mutation]
        path = 'blobs/sha256/' + d['digest'][7:]
        if mutation == 'missing-manifest': del files[path]
        else: files[path] += b' '
    if mutation == 'unrelated-iid': iid = 'sha256:' + 'f'*64
    if mutation == 'config-iid': iid = config['digest']
    if mutation == 'traversal': files['../outside'] = b'unsafe'
    if mutation == 'unexpected-file': files['extra.json'] = b'{}'
    # A manifest-root export contains no unused index blob.
    if identity == 'manifest': files.pop('blobs/sha256/' + index['digest'][7:])
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name); info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
            if mutation == 'duplicate-config' and name == config_path: tar.addfile(info, io.BytesIO(data))
        if mutation == 'duplicate-directory':
            for name in ('blobs', 'blobs/'):
                info = tarfile.TarInfo(name); info.type = tarfile.DIRTYPE; tar.addfile(info)
        if mutation == 'link':
            info = tarfile.TarInfo('link'); info.type = tarfile.SYMTYPE; info.linkname = 'index.json'; tar.addfile(info)
    bindings = {'indexDigest': 'sha256:' + hashlib.sha256(files['index.json']).hexdigest(), 'platformManifestDigest': manifest['digest'], 'configDigest': config['digest']}
    return bindings, output.getvalue(), iid


class V4ContractTests(unittest.TestCase):
    def test_new_bundle_uses_three_distinct_identities_and_manifest_override(self):
        from catering_target_operator_test import build_fixture_bundle, operator, PRODUCT_SHA, OPERATIONS_SHA
        with tempfile.TemporaryDirectory() as tmp:
            out, sha, _, commands, source = build_fixture_bundle(Path(tmp), identity='manifest')
            value = operator.verify_bundle(out, PRODUCT_SHA, OPERATIONS_SHA, sha, source)
            self.assertEqual(value['schemaVersion'], 4)
            for kind in ('runtime', 'web'):
                binding, _, _ = archive_fixture(kind, 'manifest')
                self.assertEqual({key: value['images'][kind][key] for key in binding}, binding)
                self.assertEqual(set(value['images'][kind]), {'archive','services',*binding})
                self.assertEqual(len(set(binding.values())), 3)
            self.assertNotEqual(value['images']['runtime']['configDigest'], value['images']['web']['configDigest'])
            for command in commands:
                if command[1] == 'build':
                    self.assertIn('--provenance=false', command)
                    self.assertIn('--sbom=false', command)

    def test_archive_chain_accepts_manifest_index_and_known_attestation(self):
        from catering_target_operator_test import operator
        for identity in ('manifest', 'index', 'attestation'):
            with self.subTest(identity=identity), tempfile.TemporaryDirectory() as tmp:
                bindings, data, iid = archive_fixture(identity=identity)
                path = Path(tmp) / 'image.tar.gz'; path.write_bytes(gzip.compress(data))
                self.assertEqual(operator._inspect_archive(path, iid), bindings)

    def test_archive_chain_rejects_invalid_or_unrelated_entries(self):
        from catering_target_operator_test import operator
        mutations = ('unrelated-iid', 'config-iid', 'tampered-index', 'tampered-manifest', 'tampered-config',
                     'tampered-layer', 'missing-manifest', 'zero-platform', 'ambiguous-platform', 'variant',
                     'wrong-descriptor-platform', 'wrong-config-platform', 'wrong-manifest-size', 'wrong-config-size',
                     'wrong-manifest-type', 'wrong-config-type', 'different-docker-config', 'different-docker-layers',
                     'duplicate-config', 'duplicate-directory', 'traversal', 'link', 'unexpected-file', 'wrong-attestation-ref', 'unexpected-entry')
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as tmp:
                _, data, iid = archive_fixture(mutation=mutation)
                path = Path(tmp) / 'image.tar.gz'; path.write_bytes(gzip.compress(data))
                with self.assertRaises(operator.OperatorError): operator._inspect_archive(path, iid)

    def test_rehashed_bundle_still_rejects_wrong_r_m_c_and_non_manifest_overrides(self):
        from catering_target_operator_test import build_fixture_bundle, operator, PRODUCT_SHA, OPERATIONS_SHA
        for mutation in ('indexDigest', 'platformManifestDigest', 'configDigest', 'imageId', 'runtimeReference', 'overrideC', 'overrideR', 'overrideTag', 'legacy3'):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as tmp:
                out, _, _, _, source = build_fixture_bundle(Path(tmp))
                manifest = json.loads((out / 'manifest.json').read_text())
                image = manifest['images']['runtime']
                if mutation.startswith('override'):
                    candidate = json.loads((out / 'candidate-images.json').read_text())
                    reference = image['configDigest'] if mutation == 'overrideC' else image['indexDigest'] if mutation == 'overrideR' else 'fixture:latest'
                    for service in ('intake','offer','production','exports'): candidate['services'][service]['image'] = reference
                    (out / 'candidate-images.json').write_text(json.dumps(candidate))
                    manifest['artifacts']['candidate-images.json'] = hashlib.sha256((out / 'candidate-images.json').read_bytes()).hexdigest()
                elif mutation == 'legacy3': manifest['schemaVersion'] = 3
                else: image[mutation] = 'sha256:' + 'f'*64
                (out / 'manifest.json').write_text(json.dumps(manifest))
                digest = hashlib.sha256((out / 'manifest.json').read_bytes()).hexdigest()
                with self.assertRaises(operator.OperatorError): operator.verify_bundle(out, PRODUCT_SHA, OPERATIONS_SHA, digest, source)

    def test_stage_receipt_binds_helper_and_r_m_c_and_rejects_old_receipt(self):
        from catering_target_operator_test import CateringTargetOperatorTests, stage_binding, PRODUCT_SHA, OPERATIONS_SHA, OCI_SHA
        import os
        with tempfile.TemporaryDirectory() as tmp:
            release, digest, m, web, checker = CateringTargetOperatorTests()._stage_fixture(Path(tmp))
            args = dict(manifest_sha256=digest, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                        runtime_image=m, web_image=web, stage_binding_sha256=checker, oci_sha256=OCI_SHA,
                        require_production_release_root=False, expected_uid=os.getuid(), expected_gid=os.getgid())
            values = stage_binding.stage_values(release, **args)
            self.assertEqual(values['schema_version'], '4')
            bindings, _, _ = archive_fixture(identity='manifest')
            for field, key in (('index_digest','indexDigest'), ('platform_manifest_digest','platformManifestDigest'), ('config_digest','configDigest')):
                self.assertEqual(values['runtime_' + field], bindings[key])
            self.assertEqual(values['oci_sha256'], OCI_SHA)
            stage_binding.write_receipt(release, values, expected_uid=os.getuid(), expected_gid=os.getgid())
            receipt = release / 'stage-receipt'
            receipt.write_text(receipt.read_text().replace('schema_version=4', 'schema_version=2'))
            with self.assertRaises(stage_binding.StageBindingError): stage_binding.verify_receipt(release, values, expected_uid=os.getuid(), expected_gid=os.getgid())
            (release / 'catering_target_oci.py').write_text('# changed helper\n')
            with self.assertRaises(stage_binding.StageBindingError): stage_binding.stage_values(release, **args)

    def test_release_rejects_v2_v3_candidates_but_accepts_legacy_installed_bindings(self):
        from catering_target_operator_test import build_release_state_fixture, release_state, PRODUCT_SHA, OPERATIONS_SHA
        import os
        for version in (2, 3):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as tmp:
                root, _, _, _ = build_release_state_fixture(Path(tmp), current_bundle=True)
                release = root / PRODUCT_SHA
                manifest = json.loads((release / 'manifest.json').read_text())
                manifest['schemaVersion'] = version
                if version == 2: manifest.pop('sourceTreeSha256')
                for image in manifest['images'].values():
                    image['imageId'] = image.pop('platformManifestDigest'); image.pop('indexDigest'); image.pop('configDigest')
                (release / 'manifest.json').write_text(json.dumps(manifest))
                digest = hashlib.sha256((release / 'manifest.json').read_bytes()).hexdigest()
                args = (release, digest, PRODUCT_SHA, OPERATIONS_SHA, manifest['images']['runtime']['imageId'], manifest['images']['web']['imageId'], os.getuid(), os.getgid())
                with self.assertRaises(release_state.ReleaseBindingError): release_state._verify_manifest(*args)
                release_state._verify_manifest(*args, allow_legacy_schema=True)

    def test_runtime_observations_require_manifest_identity_and_running_state(self):
        from catering_target_operator_test import operator
        helper = operator._oci()
        reference = 'sha256:' + 'a'*64
        for function in ('check_running_container', 'check_loaded_image'):
            self.assertTrue(hasattr(helper, function), f'{function} must validate observable runtime identity')
        loaded = {'Id': reference, 'Os': 'linux', 'Architecture': 'amd64'}
        helper.check_loaded_image(loaded, reference)
        helper.check_loaded_image({**loaded, 'Descriptor': {'digest': reference}}, reference)
        running = {'Image': reference, 'State': {'Running': True}}
        helper.check_running_container(running, reference)
        helper.check_running_container({**running, 'ImageManifestDescriptor': {'digest': reference}}, reference)
        invalid_loaded = ({**loaded, 'Id': 'fixture:tag'}, {**loaded, 'Os': 'windows'},
                          {**loaded, 'Architecture': 'arm64'}, {**loaded, 'Variant': 'v1'},
                          {**loaded, 'Descriptor': {'digest': 'sha256:' + 'b'*64}}, {**loaded, 'Descriptor': None})
        invalid_running = ({**running, 'Image': 'sha256:' + 'b'*64}, {**running, 'State': {'Running': False}},
                           {**running, 'State': {'Running': 1}}, {**running, 'ImageManifestDescriptor': {'digest': 'sha256:' + 'b'*64}},
                           {**running, 'ImageManifestDescriptor': None})
        for observation in invalid_loaded:
            with self.assertRaises(ValueError): helper.check_loaded_image(observation, reference)
        for observation in invalid_running:
            with self.assertRaises(ValueError): helper.check_running_container(observation, reference)
