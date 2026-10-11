"""Portable Docker/containerd infrastructure export regressions; no Docker required."""
import copy
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from catering_target_operator_test import operator
from catering_target02_test import bootstrap, healthy_containers

oci = operator._oci()
INDEX = 'application/vnd.oci.image.index.v1+json'
MANIFEST = 'application/vnd.oci.image.manifest.v1+json'
CONFIG = 'application/vnd.oci.image.config.v1+json'


def infrastructure_fixture(mutation=None):
    # Reproduce an official-image index with only the amd64 branch and its
    # attestation exported. All hashes below are built independently of the verifier.
    files = {}
    def blob(value, media):
        data = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
        digest = 'sha256:' + hashlib.sha256(data).hexdigest()
        files['blobs/sha256/' + digest[7:]] = data
        return {'mediaType': media, 'digest': digest, 'size': len(data)}
    layer = blob(b'synthetic executed layer', 'application/vnd.oci.image.layer.v1.tar')
    config = blob({'os': 'linux', 'architecture': 'arm64' if mutation == 'config-platform' else 'amd64',
                   'rootfs': {'type': 'layers', 'diff_ids': [layer['digest']]}}, CONFIG)
    mc, ml = dict(config), dict(layer)
    if mutation == 'config-size': mc['size'] += 1
    if mutation == 'layer-size': ml['size'] += 1
    annotations = {'org.opencontainers.image.version': 'fixture', 'com.docker.official-images.bashbrew.arch': 'amd64'}
    manifest = blob({'schemaVersion': 2, 'mediaType': MANIFEST, 'config': mc, 'layers': [ml],
                     'annotations': {'bad': 1} if mutation == 'annotations' else annotations}, MANIFEST)
    selected = {**manifest, 'platform': {'os': 'linux', 'architecture': 'amd64'}, 'annotations': annotations}
    if mutation == 'manifest-size': selected['size'] += 1
    if mutation == 'descriptor-platform': selected['platform']['architecture'] = 'arm64'
    if mutation == 'variant': selected['platform']['variant'] = 'v1'
    ac = blob({'os': 'unknown', 'architecture': 'unknown'}, CONFIG)
    al = blob(b'{"predicateType":"synthetic"}', 'application/vnd.in-toto+json')
    am = blob({'schemaVersion': 2, 'mediaType': MANIFEST, 'config': ac, 'layers': [al]}, MANIFEST)
    attestation = {**am, 'platform': {'os': 'unknown', 'architecture': 'unknown'}, 'annotations': {
        'com.docker.official-images.bashbrew.arch': 'amd64', 'vnd.docker.reference.type': 'attestation-manifest',
        'vnd.docker.reference.digest': manifest['digest']}}
    foreign = {'mediaType': MANIFEST, 'digest': 'sha256:' + 'a'*64, 'size': 123,
               'platform': {'os': 'linux', 'architecture': 'arm64', 'variant': 'v8'}}
    foreign_attestation = {'mediaType': MANIFEST, 'digest': 'sha256:' + 'b'*64, 'size': 123,
        'platform': {'os': 'unknown', 'architecture': 'unknown'}, 'annotations': {
        'com.docker.official-images.bashbrew.arch': 'arm64v8', 'vnd.docker.reference.type': 'attestation-manifest',
        'vnd.docker.reference.digest': foreign['digest']}}
    if mutation == 'foreign-unknown': foreign['platform'] = {'os': 'unknown', 'architecture': 'unknown'}
    if mutation == 'foreign-url': foreign['urls'] = ['https://invalid.example/']
    if mutation == 'foreign-attestation-ref': foreign_attestation['annotations']['vnd.docker.reference.digest'] = 'sha256:' + 'c'*64
    entries = [selected, attestation, foreign, foreign_attestation]
    if mutation == 'ambiguous': entries.append({**selected, 'digest': 'sha256:' + 'c'*64})
    root = blob({'schemaVersion': 2, 'mediaType': INDEX, 'manifests': entries}, INDEX)
    exported = {**root, 'annotations': {'containerd.io/distribution.source.docker.io': 'library/fixture'}}
    if mutation == 'root-size': exported['size'] += 1
    files['index.json'] = json.dumps({'schemaVersion': 2, 'mediaType': INDEX, 'manifests': [exported]}).encode()
    files['manifest.json'] = json.dumps([{'Config': 'blobs/sha256/' + config['digest'][7:], 'RepoTags': None,
          'Layers': [] if mutation == 'legacy-layers' else ['blobs/sha256/' + layer['digest'][7:]]}]).encode()
    files['oci-layout'] = b'{"imageLayoutVersion":"1.0.0"}'
    for label, descriptor in [('root',root),('manifest',manifest),('config',config),('layer',layer),
                              ('attestation',am),('attestation-config',ac),('attestation-layer',al)]:
        path = 'blobs/sha256/' + descriptor['digest'][7:]
        if mutation == 'missing-' + label: del files[path]
        if mutation == 'hash-' + label: files[path] = b'!' + files[path][1:]
    if mutation == 'unrelated-blob': files['blobs/sha256/' + 'f'*64] = b'unbound'
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode='w') as tar:
        for name, data in files.items():
            item = tarfile.TarInfo(name); item.size = len(data)
            tar.addfile(item, io.BytesIO(data))
    proof = {'rootIndexDigest': root['digest'], 'platformManifestDigest': manifest['digest'], 'configDigest': config['digest']}
    return gzip.compress(result.getvalue()), proof


class InfrastructureArchiveTests(unittest.TestCase):
    def inspect(self, path, root):
        return oci.inspect_infrastructure_archive(path, root)

    def test_official_partial_export_proves_root_to_executed_platform(self):
        data, expected = infrastructure_fixture()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'image.tar.gz'; path.write_bytes(data)
            try:
                proof = self.inspect(path, expected['rootIndexDigest'])
            except ValueError as exc:
                self.fail('valid official amd64 export rejected: ' + str(exc))
            self.assertEqual({k: proof[k] for k in expected}, expected)
            self.assertEqual(proof['unverifiedDescriptors'], ['sha256:'+'a'*64, 'sha256:'+'b'*64])

    def test_required_bytes_and_platform_cannot_use_foreign_branch_exception(self):
        mutations = ['root-size','manifest-size','config-size','layer-size','config-platform','descriptor-platform',
                     'variant','annotations','ambiguous','foreign-unknown','foreign-url','foreign-attestation-ref',
                     'legacy-layers','unrelated-blob']
        mutations += [kind + '-' + part for kind in ('missing','hash') for part in
                      ('root','manifest','config','layer','attestation','attestation-config','attestation-layer')]
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as tmp:
                data, expected = infrastructure_fixture(mutation)
                path = Path(tmp)/'image.tar.gz'; path.write_bytes(data)
                with self.assertRaises(ValueError): self.inspect(path, expected['rootIndexDigest'])

    def test_root_pin_cannot_be_replaced_by_manifest_config_or_export_index(self):
        data, expected = infrastructure_fixture()
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'image.tar.gz'; path.write_bytes(data)
            with tarfile.open(path) as tar: exported = 'sha256:' + hashlib.sha256(tar.extractfile('index.json').read()).hexdigest()
            for wrong in (expected['platformManifestDigest'], expected['configDigest'], exported, 'sha256:'+'f'*64):
                with self.subTest(wrong=wrong), self.assertRaises(ValueError): self.inspect(path, wrong)

    def test_app_v4_remains_strict_for_partial_official_exports(self):
        data, expected=infrastructure_fixture()
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'image.tar.gz'; path.write_bytes(data)
            with self.assertRaises(ValueError): oci.inspect_archive(path,expected['rootIndexDigest'])


class BootstrapInfrastructureTests(unittest.TestCase):
    def test_loaded_root_requires_the_bound_platform_observation(self):
        binding = {'rootIndexDigest': bootstrap.PG,
                   'platformManifestDigest': 'sha256:08693671787a11fadf8d313e687c5f5a43de631c298bc2f2e0520f432ff1eb0b',
                   'configDigest': 'sha256:543fd794d2d9f63d895fe05cd707fb042604fe7d593d66147d86ede6152f429b'}
        root = {'Id': binding['rootIndexDigest'], 'Os':'linux', 'Architecture':'amd64',
                'Descriptor': {'digest':binding['rootIndexDigest'], 'mediaType':INDEX}}
        platform = {'Id':binding['platformManifestDigest'], 'Os':'linux', 'Architecture':'amd64',
                    'Descriptor': {'digest':binding['platformManifestDigest'], 'mediaType':MANIFEST}}
        oci.check_loaded_infrastructure(root, platform, binding)
        for mutation in ('root','manifest','config-as-manifest','root-descriptor','manifest-descriptor','platform','missing-descriptor'):
            with self.subTest(mutation=mutation):
                r,m=copy.deepcopy(root),copy.deepcopy(platform)
                if mutation=='root': r['Id']='sha256:'+'f'*64
                if mutation=='manifest': m['Id']='sha256:'+'f'*64
                if mutation=='config-as-manifest': m['Id']=binding['configDigest']
                if mutation=='root-descriptor': r['Descriptor']['digest']=binding['platformManifestDigest']
                if mutation=='manifest-descriptor': m['Descriptor']['digest']=binding['rootIndexDigest']
                if mutation=='platform': m['Architecture']='arm64'
                if mutation=='missing-descriptor': del m['Descriptor']
                with self.assertRaises(ValueError): oci.check_loaded_infrastructure(r,m,binding)

    def test_bootstrap_archive_binding_rejects_changed_pin_or_archive_before_load(self):
        data,binding=infrastructure_fixture()
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp).resolve()/'infra.tar.gz';path.write_bytes(data);path.chmod(0o600)
            record={'path':str(path),'sha256':hashlib.sha256(data).hexdigest()}
            package={'infraArchives':{'postgres':record,'edge':dict(record)}}
            with patch.object(bootstrap,'INFRA_IDENTITIES',{'postgres':binding,'edge':binding}):
                proof=bootstrap.verify_infrastructure_archives(package)
                self.assertEqual(proof['postgres']['rootIndexDigest'],binding['rootIndexDigest'])
                self.assertEqual(proof['postgres']['archiveSha256'],record['sha256'])
                for mutation in ('pin','archive'):
                    with self.subTest(mutation=mutation):
                        broken=copy.deepcopy(package)
                        if mutation=='archive': broken['infraArchives']['edge']['sha256']='0'*64
                        wrong=copy.deepcopy(binding)
                        if mutation=='pin': wrong['platformManifestDigest']='sha256:'+'f'*64
                        with patch.object(bootstrap,'INFRA_IDENTITIES',{'postgres':binding,'edge':wrong}), \
                             patch.object(bootstrap,'run',side_effect=AssertionError('no Docker call before archive proof')):
                            with self.assertRaises(bootstrap.BootstrapError): bootstrap.verify_infrastructure_archives(broken)

    def test_load_publishes_same_archive_chain_and_holds_on_docker_resolution_drift(self):
        data,binding=infrastructure_fixture()
        for drift in (False,True):
            with self.subTest(drift=drift), tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp).resolve(); archive=root/'infra.tar.gz'; archive.write_bytes(data); archive.chmod(0o600)
                record={'path':str(archive),'sha256':hashlib.sha256(data).hexdigest()}
                package={'infraArchives':{'postgres':record,'edge':dict(record)}}
                def docker(args,**kwargs):
                    if args[:2]==['docker','load']:
                        if args[-1] == str(archive):
                            self.assertEqual(args,['docker','load','--platform','linux/amd64','--input',str(archive)])
                        else:
                            self.assertEqual(args[2], '--input')
                            self.assertIn(args[3], [str(root/'runtime-image.tar.gz'),str(root/'web-image.tar.gz')])
                        return b''
                    if args==['docker','image','inspect',binding['rootIndexDigest']]:
                        identity=binding['rootIndexDigest']; media=INDEX
                    elif args==['docker','image','inspect','--platform','linux/amd64',binding['rootIndexDigest']]:
                        identity='sha256:'+'f'*64 if drift else binding['platformManifestDigest']; media=MANIFEST
                    else:
                        self.assertEqual(args[:3],['docker','image','inspect'])
                        self.assertIn(args[3],set(bootstrap.IMAGES.values())-{bootstrap.PG})
                        identity=args[3];media=MANIFEST
                    return json.dumps([{'Id':identity,'Os':'linux','Architecture':'amd64',
                                        'Descriptor':{'digest':identity,'mediaType':media}}]).encode()
                with patch.object(bootstrap,'STATE',root), \
                     patch.object(bootstrap,'INFRA_IDENTITIES',{'postgres':binding,'edge':binding}), \
                     patch.object(bootstrap,'check_execution_windows'), patch.object(bootstrap,'run',side_effect=docker):
                    if drift:
                        with self.assertRaises(bootstrap.BootstrapError):
                            bootstrap.load_images(root,package,'1'*64,'2'*64,access={})
                        self.assertFalse((root/'images-loaded.json').exists())
                    else:
                        bootstrap.load_images(root,package,'1'*64,'2'*64,access={})
                        receipt=json.loads((root/'images-loaded.json').read_text())
                        self.assertEqual(receipt['infrastructureBindings']['postgres']['configDigest'],binding['configDigest'])
                        self.assertEqual(receipt['infrastructureBindings']['edge']['unverifiedDescriptors'],['sha256:'+'a'*64,'sha256:'+'b'*64])
                        bootstrap.verify_loaded_receipt(package,'1'*64,'2'*64)
                        for key in ('rootIndexDigest','platformManifestDigest','configDigest','archiveSha256'):
                            broken=copy.deepcopy(receipt);broken['infrastructureBindings']['postgres'][key]='0'*64
                            (root/'images-loaded.json').write_text(json.dumps(broken))
                            with self.subTest(key=key), self.assertRaises(bootstrap.BootstrapError):
                                bootstrap.verify_loaded_receipt(package,'1'*64,'2'*64)

    def test_loaded_archive_change_prevents_any_docker_command(self):
        data,binding=infrastructure_fixture()
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();path=root/'infra.tar.gz';path.write_bytes(data+b'changed');path.chmod(0o600)
            record={'path':str(path),'sha256':hashlib.sha256(data).hexdigest()}
            with patch.object(bootstrap,'INFRA_IDENTITIES',{'postgres':binding,'edge':binding}), \
                 patch.object(bootstrap,'run',side_effect=AssertionError('Docker is forbidden')):
                with self.assertRaisesRegex(bootstrap.BootstrapError,'archive missing or changed'):
                    bootstrap.load_images(root,{'infraArchives':{'postgres':record,'edge':record}},'1'*64,'2'*64,access={})

    def test_database_observation_rejects_wrong_selected_manifest(self):
        pg = next(c for c in healthy_containers() if c['Name']=='/platform-infra-postgres-1')
        pg['ImageManifestDescriptor'] = {'digest': 'sha256:'+'f'*64}
        with self.assertRaises(bootstrap.BootstrapError): bootstrap.verify_database_only([pg])


if __name__ == '__main__':
    unittest.main()
