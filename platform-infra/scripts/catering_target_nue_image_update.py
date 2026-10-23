#!/usr/bin/env python3
"""Explicit postmigration image-only update for the manually installed NUE stack.

Transport and current access admission belong to the calling operator. This program
never infers access approval, manufactures historical release receipts, or migrates data.
"""
from __future__ import annotations

import argparse
import base64
import datetime
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid

SERVICES = ("intake", "offer", "production", "exports", "web")
DATABASES = ("catering_agents", "catering_agents_pre_cutover_20260920", "catering_operator_probe_20260919")
NAMES = tuple("platform-infra-" + s + "-1" for s in (*SERVICES, "postgres")) + ("catering-edge-edge-1",)
VOLUMES = {"platform-infra_postgres_data", "platform-infra_caddy_data", "platform-infra_caddy_config", "catering-edge_edge_caddy_data", "catering-edge_edge_caddy_config"}
CONFIG_ROOTS = ("/etc/catering-target", "/opt/catering-agents-platform/platform-infra", "/opt/catering-edge")
RUNTIME_ROOTS = ("shared-core/src", "intake-service/src", "offer-service/src", "production-service/src", "print-export/src")
COMPOSE = Path("/opt/catering-agents-platform/platform-infra/compose.json")
ENV = Path("/etc/catering-target/runtime.env")
LOCK = Path("/opt/catering-target-update.lock")
RELEASES = Path("/opt/catering-nue-image-updates")
SHA = re.compile(r"^[0-9a-f]{64}$")
IMAGE = re.compile(r"^sha256:[0-9a-f]{64}$")
RECOVERING = False
SSH_KEYGEN = "/usr/bin/ssh-keygen"
OPERATOR_SIGNING_KEY = Path("/Users/alexandersmyslowski/.ssh/codex_hetzner_review")
OPERATOR_PUBLIC_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIABJPlMZ355FFNi5V3ZPbSXyDzkXAfA+amXA0STPkzc8"
OPERATOR_KEY_FINGERPRINT = "SHA256:Sp5f1SkjF/Wi3Qs0IJ1+JKwCHpY5hcrYqjd59D0dnas"
SIGNATURE_NAMESPACE = "catering-nue-image-update@catering-agents-platform"
SIGNER_IDENTITY = "catering-nue-operator"
ADMISSION_LIMIT = 32768
SIGNATURE_LIMIT = 8192
CURRENT_RUNTIME_M = "sha256:fb26fe510fade286bbfa02c981a8abb910ef8624a802d26822db662d81befdeb"
CURRENT_WEB_M = "sha256:b2ffe4694b983e4b4c1859676bf24df344900dfeaf8f2f7c07ad1ee23cbce25d"
CURRENT_WEB_CADDY_SHA256 = "966049be4c99e87341b4b26e1830e7f33a626b5f88d77e498983e7ebb3a9207e"
CURRENT_WEB_SNIPPET_SITE_SHA256 = "8e04176f94719bd20f924e0ef5f6d0ad0c224e6976d8813421359e35716aab2e"
ORIGINAL_EDGE_CADDY = Path("/opt/catering-edge/Caddyfile")
# The independently observed original remote_ip ACL denies loopback before auth.
ORIGINAL_EDGE_CADDY_SHA256 = "2f432e92aba90d6f4c533cb3f0cc2cbbd854ba6cc7316a286fcde2e7b1585001"
CURRENT_BASE_LAYOUT = {"mode": "local-current", "runtimeManifest": CURRENT_RUNTIME_M, "webManifest": CURRENT_WEB_M,
                       "runtimeRoot": "/catering-product", "publicRoot": "/catering-public", "servedRoot": "/srv", "previousPublicRoot": "/catering-previous-public"}


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def command(args, timeout=90, data=None):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    # Docker/psql and auth errors can carry credentials; do not echo their output.
    require(result.returncode == 0, "COMMAND_FAILED:" + args[0] + ":" + str(result.returncode))
    return result.stdout


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def protected(path, directory=False):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path, "PROTECTED_PATH")
    for parent in (path, *path.parents):
        info = parent.lstat()
        require(info.st_uid == 0 and not info.st_mode & 0o022 and not stat.S_ISLNK(info.st_mode), "PROTECTED_OWNER_MODE")
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode) and info.st_nlink == 1, "PROTECTED_TYPE")
    return path


def put(path, value):
    body = value if isinstance(value, bytes) else canonical(value)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as target:
        target.write(body)
        target.flush()
        os.fsync(target.fileno())


def read_bound(path, expected):
    require(SHA.fullmatch(expected or "") and digest(path) == expected, "EXPLICIT_FILE_BINDING")
    return json.loads(Path(path).read_bytes())


def read_bounded_bytes(path, expected_sha, limit):
    require(SHA.fullmatch(expected_sha or ""), "NUE_SIGNED_INPUT_DIGEST")
    fd = os.open(protected(path), os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= limit, "NUE_SIGNED_INPUT_SIZE")
        body = source.read(limit + 1)
    require(0 < len(body) <= limit and hashlib.sha256(body).hexdigest() == expected_sha, "NUE_SIGNED_INPUT_BINDING")
    return body


def verify_admission_signature(body, signature):
    require(0 < len(body) <= ADMISSION_LIMIT and 0 < len(signature) <= SIGNATURE_LIMIT, "NUE_SIGNED_INPUT_SIZE")
    public_blob = base64.b64decode(OPERATOR_PUBLIC_KEY.split()[1], validate=True)
    fingerprint = "SHA256:" + base64.b64encode(hashlib.sha256(public_blob).digest()).decode("ascii").rstrip("=")
    require(fingerprint == OPERATOR_KEY_FINGERPRINT, "NUE_PINNED_OPERATOR_KEY_INVALID")
    # Trust only the public key in this accepted helper. Neither the admission nor
    # a target-owned allowed_signers file can select the authenticating issuer.
    with tempfile.TemporaryDirectory(prefix="catering-nue-signature-") as temporary:
        root = Path(temporary); root.chmod(0o700)
        allowed = root / "allowed_signers"; signed = root / "admission.sig"
        put(allowed, (SIGNER_IDENTITY + ' namespaces="' + SIGNATURE_NAMESPACE + '" ' + OPERATOR_PUBLIC_KEY + "\n").encode("ascii"))
        put(signed, signature)
        result = subprocess.run([SSH_KEYGEN, "-Y", "verify", "-f", str(allowed), "-I", SIGNER_IDENTITY, "-n", SIGNATURE_NAMESPACE, "-s", str(signed)], input=body, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
        require(result.returncode == 0, "NUE_AUTHENTIC_MAC_SIGNATURE_REQUIRED")


def sign_admission(body):
    require(0 < len(body) <= ADMISSION_LIMIT, "NUE_SIGNED_INPUT_SIZE")
    info = OPERATOR_SIGNING_KEY.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and info.st_nlink == 1 and not info.st_mode & 0o077, "NUE_LOCAL_SIGNING_KEY_METADATA")
    # Only ssh-keygen opens the existing protected private key, on the Mac.
    result = subprocess.run([SSH_KEYGEN, "-Y", "sign", "-f", str(OPERATOR_SIGNING_KEY), "-n", SIGNATURE_NAMESPACE, "-"], input=body, capture_output=True, timeout=30)
    require(result.returncode == 0, "NUE_LOCAL_ADMISSION_SIGN_FAILED")
    verify_admission_signature(body, result.stdout)
    return result.stdout


def make_admission(manifest, manifest_sha, phase, remote_bundle, remote_admission, parameters):
    """Sign the accepted Mac gate result using the existing local SSH key."""
    require(phase in ("stage", "apply"), "NUE_ADMISSION_PHASE")
    for path in (remote_bundle, remote_admission, *[value for key, value in parameters.items() if not key.endswith("Sha256")]):
        require(isinstance(path, str) and Path(path).is_absolute() and str(Path(path)) == path and ".." not in Path(path).parts, "NUE_ADMISSION_PATH")
    for key, value in parameters.items():
        if key.endswith("Sha256"): require(SHA.fullmatch(value or ""), "NUE_ADMISSION_DIGEST")
    require(SHA.fullmatch(manifest_sha), "NUE_ADMISSION_DIGEST")
    if phase == "apply": require(remote_bundle == str(RELEASES / manifest_sha), "NUE_ADMISSION_STAGED_PATH")
    admission = {"schemaVersion": 1, "mode": "nue-image-only", "targetId": "catering-prod-02", "hostAddress": "2.28.200.16", "phase": phase,
                 "productCommit": manifest["productCommit"], "operationsCommit": manifest["operationsCommit"], "sourceTreeSha256": manifest["sourceTreeSha256"],
                 "helpers": manifest["helpers"], "manifestSha256": manifest_sha, "remoteBundleDir": remote_bundle,
                 "parameters": parameters, "issuedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "nonce": uuid.uuid4().hex}
    body = canonical(admission)
    admission_sha = hashlib.sha256(body).hexdigest()
    signature = sign_admission(body)
    signature_sha = hashlib.sha256(signature).hexdigest()
    signature_path = remote_admission + ".sig"
    argv = ["python3", "-I", remote_bundle + "/tools/catering_target_nue_image_update.py", phase,
            "--bundle-dir", remote_bundle, "--manifest-sha256", manifest_sha, "--admission", remote_admission, "--admission-sha256", admission_sha,
            "--admission-signature", signature_path, "--admission-signature-sha256", signature_sha]
    flags = {"expectedBaseline": "--expected-baseline", "expectedBaselineSha256": "--expected-baseline-sha256", "backupProof": "--backup-proof", "backupProofSha256": "--backup-proof-sha256", "protectedSmoke": "--protected-smoke", "protectedSmokeSha256": "--protected-smoke-sha256"}
    for key, value in parameters.items(): argv.extend((flags[key], value))
    argv.extend(("--confirm", "STAGE_NUE_IMAGE_ONLY" if phase == "stage" else "ACTIVATE_NUE_IMAGE_ONLY"))
    return {"admission": admission, "admissionBody": body.decode("ascii"), "admissionSha256": admission_sha, "remoteAdmissionPath": remote_admission,
            "signatureBody": signature.decode("ascii"), "signatureSha256": signature_sha, "remoteSignaturePath": signature_path, "argv": argv}


def require_admission(path, expected_sha, manifest, manifest_sha, phase, bundle, parameters, signature_path=None, signature_sha=None):
    require(path is not None and expected_sha is not None, "NUE_FRESH_MAC_ADMISSION_REQUIRED")
    require(signature_path is not None and signature_sha is not None, "NUE_SIGNED_MAC_ADMISSION_REQUIRED")
    body = read_bounded_bytes(path, expected_sha, ADMISSION_LIMIT)
    signature = read_bounded_bytes(signature_path, signature_sha, SIGNATURE_LIMIT)
    verify_admission_signature(body, signature)
    admission = json.loads(body)
    require(body == canonical(admission), "NUE_CANONICAL_ADMISSION_REQUIRED")
    require(set(admission) == {"schemaVersion", "mode", "targetId", "hostAddress", "phase", "productCommit", "operationsCommit", "sourceTreeSha256", "helpers", "manifestSha256", "remoteBundleDir", "parameters", "issuedAt", "nonce"}, "NUE_ADMISSION_SHAPE")
    require(admission["schemaVersion"] == 1 and admission["mode"] == "nue-image-only" and admission["targetId"] == "catering-prod-02" and admission["hostAddress"] == "2.28.200.16" and admission["phase"] == phase, "NUE_ADMISSION_TARGET_PHASE")
    if manifest is not None: bind_admission_manifest(admission, manifest)
    require(admission["manifestSha256"] == manifest_sha and admission["remoteBundleDir"] == str(bundle) and admission["parameters"] == parameters, "NUE_ADMISSION_CALL_BINDING")
    require(re.fullmatch(r"[0-9a-f]{32}", admission["nonce"]), "NUE_ADMISSION_NONCE")
    age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(admission["issuedAt"])).total_seconds()
    require(0 <= age <= 900, "NUE_MAC_ADMISSION_EXPIRED")
    return admission


def bind_admission_manifest(admission, manifest):
    for field in ("productCommit", "operationsCommit", "sourceTreeSha256", "helpers"):
        require(admission[field] == manifest[field], "NUE_ADMISSION_ACCEPTED_BINDING")


def schema_binding(files):
    """Use the existing operator's migration-region and literal-DDL no-drift contract."""
    source = files["shared-core/src/persistence.ts"].decode()
    start = source.find("const BUSINESS_RECORDS_SCHEMA_MIGRATION")
    end = source.find("\nfunction getCachedPool", start)
    require(start >= 0 and end > start, "SCHEMA_REGION_MISSING")
    ddl = re.compile(r"\b(?:CREATE|ALTER|DROP)\s+TABLE\b|\bCREATE\s+(?:UNIQUE\s+)?INDEX\b", re.I)
    manifest = {}
    for name, raw in sorted(files.items()):
        if Path(name).suffix not in {".ts", ".tsx", ".js", ".mjs"}:
            continue
        text, fragments, i = raw.decode(), [], 0
        while i < len(text):
            quote = text[i]
            i += 1
            if quote not in ("'", '"', "`"):
                continue
            body = []
            while i < len(text):
                char = text[i]
                if char == "\\" and i + 1 < len(text):
                    body.extend((char, text[i + 1])); i += 2; continue
                i += 1
                if char == quote:
                    break
                body.append(char)
            value = "".join(body).strip()
            if ddl.search(value):
                fragments.append(hashlib.sha256(value.encode()).hexdigest())
        if fragments:
            manifest[name] = sorted(fragments)
    ddl_bytes = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    return {"migration": hashlib.sha256(source[start:end].encode()).hexdigest(), "ddl": hashlib.sha256(ddl_bytes).hexdigest()}


def source_schema(root):
    files = {}
    for relative in RUNTIME_ROOTS:
        directory = root / relative
        require(directory.is_dir() and not directory.is_symlink(), "SOURCE_RUNTIME_ROOT")
        for path in directory.rglob("*"):
            require(not path.is_symlink(), "SOURCE_RUNTIME_SYMLINK")
            if path.is_file():
                files[path.relative_to(root).as_posix()] = path.read_bytes()
    return schema_binding(files)


def runtime_files(container, application_root="/app"):
    require(application_root in ("/app", "/catering-product"), "NUE_RUNTIME_SOURCE_ROOT")
    raw = command(["docker", "exec", container, "tar", "-C", application_root, "-cf", "-", *RUNTIME_ROOTS])
    files = {}
    roots = set()
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        for member in archive:
            name = Path(member.name)
            require(not name.is_absolute() and ".." not in name.parts and (member.isdir() or member.isfile()), "RUNTIME_SOURCE_ARCHIVE")
            require(any(name == Path(root) or Path(root) in name.parents for root in RUNTIME_ROOTS), "RUNTIME_SOURCE_SCOPE")
            if member.isdir():
                roots.add(name.as_posix().rstrip("/"))
            else:
                require(name.as_posix() not in files, "RUNTIME_SOURCE_DUPLICATE")
                files[name.as_posix()] = archive.extractfile(member).read()
    require(set(RUNTIME_ROOTS) <= roots, "RUNTIME_SOURCE_ROOTS")
    return files


def runtime_schema(container, application_root="/app"):
    return schema_binding(runtime_files(container, application_root))


def verify_bundle(bundle, manifest_sha):
    bundle = Path(bundle)
    manifest = read_bound(bundle / "manifest.json", manifest_sha)
    require(set(manifest) == {"schemaVersion", "mode", "repository", "targetId", "platform", "productCommit", "operationsCommit", "sourceTreeSha256", "schemaBinding", "bases", "images", "helpers"}, "NUE_MANIFEST_SHAPE")
    require(manifest["schemaVersion"] == 1 and manifest["mode"] == "nue-image-only" and manifest["targetId"] == "catering-prod-02" and manifest["repository"] == "AlexanderSmyslowski/catering-agents-platform" and manifest["platform"] == "linux/amd64", "NUE_MANIFEST_TARGET")
    for field in ("productCommit", "operationsCommit"):
        require(re.fullmatch(r"[0-9a-f]{40}", manifest[field]), "NUE_COMMIT_BINDING")
    require(set(manifest["helpers"]) == {"catering-target-operator.py", "catering_target_oci.py", "catering_target_nue_image_update.py"}, "NUE_HELPER_SCOPE")
    for name, expected in manifest["helpers"].items():
        require(digest(bundle / "tools" / name) == expected, "NUE_HELPER_BINDING")
    # The caller must execute this accepted payload, never the product's older copy.
    require(digest(Path(__file__)) == manifest["helpers"]["catering_target_nue_image_update.py"], "NUE_PAYLOAD_IDENTITY")
    operator = load_module("nue_bound_operator", bundle / "tools/catering-target-operator.py")
    require(operator._source_tree_digest(bundle / "source") == manifest["sourceTreeSha256"], "NUE_FULL_SOURCE_BINDING")
    require((bundle / "source/package-lock.json").is_file() and (bundle / "source/package.json").is_file(), "NUE_LOCKFILE_REQUIRED")
    require(source_schema(bundle / "source") == manifest["schemaBinding"], "NUE_SOURCE_SCHEMA_BINDING")
    require(set(manifest["images"]) == {"runtime", "web"}, "NUE_IMAGE_SCOPE")
    if manifest["bases"].get("mode") == "local-current":
        require(manifest["bases"] == CURRENT_BASE_LAYOUT, "NUE_CURRENT_BASE_BINDING")
    else:
        require(set(manifest["bases"]) == {"node", "caddy"}, "NUE_BASE_SCOPE")
        for base in manifest["bases"].values():
            require(set(base) == {"reference", "localImageId"} and re.fullmatch(r"[a-zA-Z0-9./:_-]+@sha256:[0-9a-f]{64}", base["reference"]) and IMAGE.fullmatch(base["localImageId"]), "NUE_BASE_BINDING")
    for role, binding in manifest["images"].items():
        require(set(binding) == {"indexDigest", "platformManifestDigest", "configDigest", "archiveSha256"}, "NUE_IMAGE_SHAPE")
        path = bundle / (role + "-image.tar.gz")
        require(digest(path) == binding["archiveSha256"], "NUE_ARCHIVE_BINDING")
        require(operator._inspect_archive(path) == {key: binding[key] for key in ("indexDigest", "platformManifestDigest", "configDigest")}, "NUE_OCI_BINDING")
    return manifest


def accepted_current_binding(binding):
    require(isinstance(binding, dict) and set(binding) == {"manifestSha256", "helperSha256"} and
            all(isinstance(v, str) and re.fullmatch(r"[0-9a-f]{64}", v) for v in binding.values()),
            "NUE_ACCEPTED_CURRENT_BINDING")
    return dict(binding)


def prepare(operator, source, product, operations, output, *, accepted_current_release=None):
    binding = accepted_current_binding(accepted_current_release) if accepted_current_release is not None else None
    require(not os.path.lexists(output), "NUE_INPUT_ALREADY_EXISTS")
    output.mkdir(mode=0o755)
    operator.export_product_context(source, product, output / "source")
    require((output / "source/package-lock.json").is_file(), "NUE_LOCKFILE_REQUIRED")
    tools = output / "tools"; tools.mkdir(mode=0o755)
    for name in ("catering-target-operator.py", "catering_target_oci.py", "catering_target_nue_image_update.py"):
        shutil.copyfile(Path(__file__).with_name(name), tools / name); (tools / name).chmod(0o644)
    request = {"schemaVersion": 1, "mode": "nue-image-only-build-input", "repository": operator.REPOSITORY, "targetId": "catering-prod-02", "productCommit": product, "operationsCommit": operations, "sourceTreeSha256": operator._source_tree_digest(output / "source"), "helpers": {path.name: digest(path) for path in tools.iterdir()}}
    if binding is not None: request["acceptedCurrentRelease"] = binding
    (output / "build-input.json").write_bytes(canonical(request)); (output / "build-input.json").chmod(0o644)
    return digest(output / "build-input.json")


def build_prepared(directory, request_sha, output, node_base, caddy_base, *, base_mode="repository", runtime_base=None, web_base=None):
    host_identity(); directory = protected(directory, directory=True)
    request = read_bound(protected(directory / "build-input.json"), request_sha)
    require(set(request) - {"acceptedCurrentRelease"} == {"schemaVersion", "mode", "repository", "targetId", "productCommit", "operationsCommit", "sourceTreeSha256", "helpers"}, "NUE_BUILD_REQUEST_SHAPE")
    require(request["schemaVersion"] == 1 and request["mode"] == "nue-image-only-build-input" and request["repository"] == "AlexanderSmyslowski/catering-agents-platform" and request["targetId"] == "catering-prod-02", "NUE_BUILD_REQUEST_TARGET")
    require(set(request["helpers"]) == {"catering-target-operator.py", "catering_target_oci.py", "catering_target_nue_image_update.py"}, "NUE_HELPER_SCOPE")
    for name, expected in request["helpers"].items(): require(digest(protected(directory / "tools" / name)) == expected, "NUE_BUILD_HELPER_BINDING")
    require(digest(Path(__file__)) == request["helpers"]["catering_target_nue_image_update.py"], "NUE_PAYLOAD_IDENTITY")
    operator = load_module("nue_build_operator", directory / "tools/catering-target-operator.py")
    require(operator._source_tree_digest(directory / "source") == request["sourceTreeSha256"], "NUE_BUILD_FULL_SOURCE_BINDING")
    for field in ("productCommit", "operationsCommit"): require(re.fullmatch(r"[0-9a-f]{40}", request[field]), "NUE_BUILD_COMMIT")
    binding = accepted_current_binding(request["acceptedCurrentRelease"]) if "acceptedCurrentRelease" in request else None
    if binding is not None:
        require(base_mode == "local-current", "NUE_ACCEPTED_CURRENT_BASE_MODE")
    protected(output.parent, directory=True)
    if binding is not None:
        return create_bundle(operator, directory / "source", request["productCommit"], request["operationsCommit"], output, node_base, caddy_base, exported=True, base_mode=base_mode, runtime_base=runtime_base, web_base=web_base, accepted_current_release=binding)
    token = own_lock()
    try:
        owned(token)
        return create_bundle(operator, directory / "source", request["productCommit"], request["operationsCommit"], output, node_base, caddy_base, exported=True, base_mode=base_mode, runtime_base=runtime_base, web_base=web_base, accepted_current_release=binding)
    finally: unlock(token)



# This is the one manually accepted first release, not a generic installed-status fallback.
PR727_MANIFEST_SHA256 = "8e3bbad3b8445968a27d859f61c29bb99081e54341f267da9e4d35ce5ab5df50"
PR727_RECOVERY_SHA256 = "8f588b754e6a617b6437e0781b3966c03b4aff720db3edf2473491c3f99a008b"
PR727_IMAGES = {"runtime": "sha256:6df040c61e8ca857cc3a3e8b2c54da5a560f14ea19f49d8cbd322032cee1f52b",
                "web": "sha256:ea6c1460fa5a015d0320625477de58d09f9c96c1c29fb27c624be660bd651f12"}
PR735_MANIFEST_SHA256 = "73d8886d9479b2930c08f7da14a37187ca97441168297ecbe0cadf82027199ce"
PR735_HELPER_SHA256 = "51c16f5790446772dca3916769103a3037a0350fb2d8795641d438ad6bedfbeb"
PR735_IMAGES = {"runtime": "sha256:2c94cffb05807cedaab35bf9dcb10779962c9a8f38f9c0143233447f39061b63",
                "web": "sha256:029b327abb846b657dfc36822a36ed5dc4d6f648b4113c9d2379ecf6b8c13111"}
RELEASE_3D287D8_MANIFEST_SHA256 = "1361de764a3bb012ede94b2c6d29a8dd0d7bdd0ad2a99d7162509e47ae99c3b4"
RELEASE_3D287D8_HELPER_SHA256 = "a46091052e2c720981c15aa2c56462754af86e3174a6b4326e603e3b6a3ff101"
RELEASE_3D287D8_IMAGES = {"runtime": "sha256:7b169161fdce4df85a04af78aa01f66f2f7a5f2cc090327714ba6edb4d238fe6",
                          "web": "sha256:47b2e374d2591d63e6237ab1b3904d5a160e375770c340d40769d5366cb14f04"}
RELEASE_681213B_MANIFEST_SHA256 = "3eac18160cf862620ce6b4c7843368a5344dbc1f4837b810bb03a36c9a6720df"
RELEASE_681213B_HELPER_SHA256 = "21e42c3890f63a11b4b860a35f9c0efe7371fd620f870cd70abb903cd80b9cf9"
RELEASE_681213B_IMAGES = {"runtime": "sha256:2c11dc76480fba75e21f3184779d9aa8e786d2271a5bbe6676daa9ae29b8ed01",
                         "web": "sha256:fe2169fa79724d105c1199b28921f24f59bc477bc6ad278201875660018d6160"}
PR727_CADDY_ROOT_NAME = "Caddy_Local_Authority_-_2026_ECC_Root_230535653603960188253814079773346015816"
PR727_CADDY_ROOT_SHA256 = "e70877424f5913ab6146fb751750fd1deb4a862c2820811287459d3b213e2b88"
PR727_CADDY_CA_BUNDLE_SHA256 = "f0cbbbeb86b1ca821634896f134c3c3b73db0bb525664b643ac80159242f9778"


def pr727_web_writable_state(row):
    changes = command(["docker", "diff", row["Id"]]).decode().splitlines()
    if not changes:
        return {"diff": []}
    # Caddy installed its own public root and Docker created the readonly sites
    # mountpoint. Only this observed PR727 state is accepted, never a path prefix.
    crt = "/usr/local/share/ca-certificates/" + PR727_CADDY_ROOT_NAME + ".crt"
    pem = "/etc/ssl/certs/ca-cert-" + PR727_CADDY_ROOT_NAME + ".pem"
    bundle = "/etc/ssl/certs/ca-certificates.crt"
    rehash = "/etc/ssl/certs/fe4a7346.0"
    root = "/data/caddy/pki/authorities/local/root.crt"
    directories = ("/usr", "/usr/local", "/usr/local/share", "/usr/local/share/ca-certificates",
                   "/etc", "/etc/caddy", "/etc/ssl", "/etc/ssl/certs")
    expected = [*("C " + p for p in directories), "A /etc/caddy/sites", "A " + crt,
                "A " + pem, "C " + bundle, "A " + rehash]
    require(sorted(changes) == sorted(expected), "NUE_PR727_WEB_WRITABLE_DRIFT")
    data = [m for m in row["Mounts"] if m["Destination"] == "/data"]
    require(len(data) == 1 and data[0]["Type"] == "volume" and data[0]["Name"] == "platform-infra_caddy_data"
            and data[0]["Source"] == "/var/lib/docker/volumes/platform-infra_caddy_data/_data"
            and data[0]["RW"] is True, "NUE_PR727_WEB_TRUST_VOLUME")
    prefix = ["docker", "exec", row["Id"]]
    paths = [*directories, "/etc/caddy/sites", root, crt, pem, bundle, rehash]
    metadata = command(prefix + ["stat", "-c", "%f|%u|%g|%h", *paths]).decode().splitlines()
    require(len(metadata) == len(paths), "NUE_PR727_WEB_TRUST_METADATA")
    for path, line in zip(paths, metadata):
        values = line.split("|")
        require(len(values) == 4, "NUE_PR727_WEB_TRUST_METADATA")
        mode, uid, gid, links = int(values[0], 16), *map(int, values[1:])
        expected_mode = (stat.S_IFDIR | (0o700 if path == "/etc/caddy/sites" else 0o755)) if path in directories or path == "/etc/caddy/sites" else (
            stat.S_IFLNK | 0o777 if path in (pem, rehash) else stat.S_IFREG | (0o600 if path == root else 0o644))
        require(mode == expected_mode and uid == gid == 0 and (links >= 1 if stat.S_ISDIR(mode) else links == 1), "NUE_PR727_WEB_TRUST_METADATA")
    root_body = command(prefix + ["cat", root])
    require(hashlib.sha256(root_body).hexdigest() == PR727_CADDY_ROOT_SHA256 and
            command(prefix + ["cat", crt]) == root_body, "NUE_PR727_WEB_TRUST_ROOT")
    # The pinned bundle was independently compared with all 146 original image
    # certificates plus exactly this root, preserving multiplicity. Any byte
    # change (including missing/extra certificates) needs a new explicit review.
    require(hashlib.sha256(command(prefix + ["cat", bundle])).hexdigest() == PR727_CADDY_CA_BUNDLE_SHA256, "NUE_PR727_WEB_TRUST_BUNDLE")
    require(command(prefix + ["readlink", pem]).decode().strip() == crt and
            command(prefix + ["readlink", rehash]).decode().strip() == Path(pem).name, "NUE_PR727_WEB_TRUST_LINK")
    return {"diff": sorted(changes), "rootSha256": PR727_CADDY_ROOT_SHA256,
            "caBundleSha256": PR727_CADDY_CA_BUNDLE_SHA256, "metadata": metadata,
            "links": {pem: crt, rehash: Path(pem).name}}


def accepted_pr727_bundle():
    root = protected(RELEASES / PR727_MANIFEST_SHA256, directory=True)
    manifest = read_bound(protected(root / "manifest.json"), PR727_MANIFEST_SHA256)
    require(manifest["productCommit"] == "c3bf1e83127aa96442c3e48d00350ce1ad9c04a5" and
            manifest["operationsCommit"] == "6149d2723f5240a389693798a0e7ef7a3bfabbaf" and
            manifest["bases"] == CURRENT_BASE_LAYOUT, "NUE_PR727_PREDECESSOR_BINDING")
    helper = protected(root / "tools/catering_target_nue_image_update.py")
    require(digest(helper) == manifest["helpers"][helper.name], "NUE_PR727_HELPER_BINDING")
    # Its immutable accepted verifier checks its own helpers, complete source,
    # schema and all archive R/M/C bindings. Never run its old Apply path.
    predecessor = load_module("nue_accepted_pr727", helper)
    require(predecessor.verify_bundle(root, PR727_MANIFEST_SHA256) == manifest, "NUE_PR727_BUNDLE_BINDING")
    receipt = read_bound(protected(root / "manual-forward-recovery-verified.json"), PR727_RECOVERY_SHA256)
    require(receipt["status"] == "MANUAL_NUE_CANDIDATE_RUNTIME_VERIFIED" and
            receipt["manifestSha256"] == PR727_MANIFEST_SHA256 and
            receipt["originalApplyStatus"] == "HOLD" and receipt["currentAuthenticatedSmokePassed"] is True and
            receipt["publicApplyPassed"] is False and receipt["publicVerifyPassed"] is False,
            "NUE_PR727_MANUAL_RECOVERY_BINDING")
    for role, identity in PR727_IMAGES.items():
        require(manifest["images"][role]["platformManifestDigest"] == identity, "NUE_PR727_IMAGE_BINDING")
    return root, manifest


def accepted_pr735_bundle(oci):
    root = protected(RELEASES / PR735_MANIFEST_SHA256, directory=True)
    manifest = read_bound(protected(root / "manifest.json"), PR735_MANIFEST_SHA256)
    require(manifest["productCommit"] == "61ea18f28ba47ed1266a903916c9c43240594b83" and
            manifest["operationsCommit"] == "5c7b44b8d474da0166a1f64a0a43f51e0fa7bc15" and
            manifest["bases"] == CURRENT_BASE_LAYOUT, "NUE_PR735_PREDECESSOR_BINDING")
    helper = protected(root / "tools/catering_target_nue_image_update.py")
    require(digest(helper) == PR735_HELPER_SHA256 == manifest["helpers"][helper.name], "NUE_PR735_HELPER_BINDING")
    predecessor = load_module("nue_accepted_pr735", helper)
    require(predecessor.verify_bundle(root, PR735_MANIFEST_SHA256) == manifest, "NUE_PR735_BUNDLE_BINDING")
    require(all(manifest["images"][role]["platformManifestDigest"] == identity for role, identity in PR735_IMAGES.items()),
            "NUE_PR735_IMAGE_BINDING")
    stage_receipt = json.loads(protected(root / "stage.json").read_bytes())
    require(stage_receipt["manifestSha256"] == PR735_MANIFEST_SHA256 and stage_receipt["mode"] == "nue-image-only",
            "NUE_PR735_STAGE_BINDING")
    baseline = read_bound(protected(root / "baseline.json"), stage_receipt["baselineSha256"])
    installed = json.loads(protected(root / "installed.json").read_bytes())
    candidate = protected(root / "compose.candidate.json").read_bytes()
    images = {s: PR735_IMAGES["web" if s == "web" else "runtime"] for s in SERVICES}
    require(installed["manifestSha256"] == PR735_MANIFEST_SHA256 and installed["status"] == "NUE_IMAGE_ONLY_INSTALLED" and
            installed["images"] == images and hashlib.sha256(candidate).hexdigest() == installed["composeSha256"],
            "NUE_PR735_INSTALL_BINDING")
    # Build already owns the update lock. Reuse the accepted read-only verifier
    # checks here; the public Verify entry point correctly refuses any live lock.
    predecessor.verify_runtime(baseline, images, candidate, candidate_oci=oci,
                               candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
    return root, manifest


def accepted_3d287d8_bundle(oci):
    root = protected(RELEASES / RELEASE_3D287D8_MANIFEST_SHA256, directory=True)
    manifest = read_bound(protected(root / "manifest.json"), RELEASE_3D287D8_MANIFEST_SHA256)
    require(manifest["productCommit"] == "3d287d83ef489bda6bcf581b5e93e0b1009d5639" and
            manifest["operationsCommit"] == "3d287d83ef489bda6bcf581b5e93e0b1009d5639" and
            manifest["bases"] == CURRENT_BASE_LAYOUT, "NUE_RELEASE_3D287D8_PREDECESSOR_BINDING")
    helper = protected(root / "tools/catering_target_nue_image_update.py")
    require(digest(helper) == RELEASE_3D287D8_HELPER_SHA256 == manifest["helpers"][helper.name], "NUE_RELEASE_3D287D8_HELPER_BINDING")
    predecessor = load_module("nue_accepted_3d287d8", helper)
    require(predecessor.verify_bundle(root, RELEASE_3D287D8_MANIFEST_SHA256) == manifest, "NUE_RELEASE_3D287D8_BUNDLE_BINDING")
    require(all(manifest["images"][role]["platformManifestDigest"] == identity for role, identity in RELEASE_3D287D8_IMAGES.items()),
            "NUE_RELEASE_3D287D8_IMAGE_BINDING")
    stage_receipt = json.loads(protected(root / "stage.json").read_bytes())
    require(stage_receipt["manifestSha256"] == RELEASE_3D287D8_MANIFEST_SHA256 and stage_receipt["mode"] == "nue-image-only",
            "NUE_RELEASE_3D287D8_STAGE_BINDING")
    baseline = read_bound(protected(root / "baseline.json"), stage_receipt["baselineSha256"])
    installed = json.loads(protected(root / "installed.json").read_bytes())
    candidate = protected(root / "compose.candidate.json").read_bytes()
    images = {s: RELEASE_3D287D8_IMAGES["web" if s == "web" else "runtime"] for s in SERVICES}
    require(installed["manifestSha256"] == RELEASE_3D287D8_MANIFEST_SHA256 and installed["status"] == "NUE_IMAGE_ONLY_INSTALLED" and
            installed["images"] == images and hashlib.sha256(candidate).hexdigest() == installed["composeSha256"],
            "NUE_RELEASE_3D287D8_INSTALL_BINDING")
    # Build already owns the update lock. Reuse the accepted read-only verifier
    # checks here; the public Verify entry point correctly refuses any live lock.
    predecessor.verify_runtime(baseline, images, candidate, candidate_oci=oci,
                               candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
    return root, manifest


def accepted_681213b_bundle(oci):
    root = protected(RELEASES / RELEASE_681213B_MANIFEST_SHA256, directory=True)
    manifest = read_bound(protected(root / "manifest.json"), RELEASE_681213B_MANIFEST_SHA256)
    require(manifest["productCommit"] == "681213b775851d32fe2c5823a229b7f5b3d739d8" and
            manifest["operationsCommit"] == "3a1bb5588adc84d205265662c7a30e5196098303" and
            manifest["bases"] == CURRENT_BASE_LAYOUT, "NUE_RELEASE_681213B_PREDECESSOR_BINDING")
    helper = protected(root / "tools/catering_target_nue_image_update.py")
    require(digest(helper) == RELEASE_681213B_HELPER_SHA256 == manifest["helpers"][helper.name], "NUE_RELEASE_681213B_HELPER_BINDING")
    predecessor = load_module("nue_accepted_681213b", helper)
    require(predecessor.verify_bundle(root, RELEASE_681213B_MANIFEST_SHA256) == manifest, "NUE_RELEASE_681213B_BUNDLE_BINDING")
    require(all(manifest["images"][role]["platformManifestDigest"] == identity for role, identity in RELEASE_681213B_IMAGES.items()),
            "NUE_RELEASE_681213B_IMAGE_BINDING")
    stage_receipt = json.loads(protected(root / "stage.json").read_bytes())
    require(stage_receipt["manifestSha256"] == RELEASE_681213B_MANIFEST_SHA256 and stage_receipt["mode"] == "nue-image-only",
            "NUE_RELEASE_681213B_STAGE_BINDING")
    baseline = read_bound(protected(root / "baseline.json"), stage_receipt["baselineSha256"])
    installed = json.loads(protected(root / "installed.json").read_bytes())
    candidate = protected(root / "compose.candidate.json").read_bytes()
    images = {s: RELEASE_681213B_IMAGES["web" if s == "web" else "runtime"] for s in SERVICES}
    require(installed["manifestSha256"] == RELEASE_681213B_MANIFEST_SHA256 and installed["status"] == "NUE_IMAGE_ONLY_INSTALLED" and
            installed["images"] == images and hashlib.sha256(candidate).hexdigest() == installed["composeSha256"],
            "NUE_RELEASE_681213B_INSTALL_BINDING")
    # Build already owns the update lock. Reuse the accepted read-only verifier
    # checks here; the public Verify entry point correctly refuses any live lock.
    predecessor.verify_runtime(baseline, images, candidate, candidate_oci=oci,
                               candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
    return root, manifest


def accepted_current_bundle(oci, binding, *, before_lock=False):
    binding = accepted_current_binding(binding)
    sha = binding["manifestSha256"]
    root = protected(RELEASES / sha, directory=True)
    manifest = read_bound(protected(root / "manifest.json"), sha)
    require(manifest["mode"] == "nue-image-only" and manifest["targetId"] == "catering-prod-02" and
            manifest["repository"] == "AlexanderSmyslowski/catering-agents-platform" and
            manifest["platform"] == "linux/amd64" and manifest["bases"] == CURRENT_BASE_LAYOUT,
            "NUE_ACCEPTED_CURRENT_TARGET")
    names = {"catering-target-operator.py", "catering_target_oci.py", "catering_target_nue_image_update.py"}
    require(set(manifest["helpers"]) == names, "NUE_ACCEPTED_CURRENT_HELPER_SCOPE")
    tools = protected(root / "tools", directory=True)
    helper = protected(tools / "catering_target_nue_image_update.py")
    require(digest(helper) == binding["helperSha256"] == manifest["helpers"][helper.name], "NUE_ACCEPTED_CURRENT_HELPER_PIN")
    for name in sorted(names):
        require(digest(protected(tools / name)) == manifest["helpers"][name], "NUE_ACCEPTED_CURRENT_HELPER_BINDING")
    predecessor = load_module("nue_accepted_current", helper)
    require(predecessor.verify_bundle(root, sha) == manifest, "NUE_ACCEPTED_CURRENT_BUNDLE_BINDING")
    stage = json.loads(protected(root / "stage.json").read_bytes())
    require(stage["manifestSha256"] == sha and stage["mode"] == "nue-image-only", "NUE_ACCEPTED_CURRENT_STAGE_BINDING")
    baseline = read_bound(protected(root / "baseline.json"), stage["baselineSha256"])
    installed = json.loads(protected(root / "installed.json").read_bytes())
    candidate = protected(root / "compose.candidate.json").read_bytes()
    images = {s: manifest["images"]["web" if s == "web" else "runtime"]["platformManifestDigest"] for s in SERVICES}
    require(all(IMAGE.fullmatch(identity) for identity in images.values()) and
            installed["manifestSha256"] == sha and installed["status"] == "NUE_IMAGE_ONLY_INSTALLED" and
            installed["images"] == images and hashlib.sha256(candidate).hexdigest() == installed["composeSha256"],
            "NUE_ACCEPTED_CURRENT_INSTALL_BINDING")
    if before_lock:
        require(predecessor.verify(root, sha)["status"] == "NUE_IMAGE_ONLY_VERIFIED", "NUE_ACCEPTED_CURRENT_VERIFY")
    else:
        predecessor.verify_runtime(baseline, images, candidate, candidate_oci=oci,
                                   candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
    return root, manifest


def pr727_running_gate(oci, rows):
    root, manifest = accepted_pr727_bundle()
    return verified_product_running_gate(oci, rows, root, manifest, PR727_IMAGES,
        {"predecessorManifestSha256": PR727_MANIFEST_SHA256, "manualRecoverySha256": PR727_RECOVERY_SHA256})


def pr735_running_gate(oci, rows):
    root, manifest = accepted_pr735_bundle(oci)
    return verified_product_running_gate(oci, rows, root, manifest, PR735_IMAGES,
        {"predecessorManifestSha256": PR735_MANIFEST_SHA256})


def release_3d287d8_running_gate(oci, rows):
    root, manifest = accepted_3d287d8_bundle(oci)
    return verified_product_running_gate(oci, rows, root, manifest, RELEASE_3D287D8_IMAGES,
        {"predecessorManifestSha256": RELEASE_3D287D8_MANIFEST_SHA256})


def release_681213b_running_gate(oci, rows):
    root, manifest = accepted_681213b_bundle(oci)
    return verified_product_running_gate(oci, rows, root, manifest, RELEASE_681213B_IMAGES,
        {"predecessorManifestSha256": RELEASE_681213B_MANIFEST_SHA256})


def verified_product_running_gate(oci, rows, root, manifest, identities, observations):
    compose = json.loads(protected(COMPOSE).read_bytes())
    require(all(compose["services"][s]["image"] == identities["web" if s == "web" else "runtime"] for s in SERVICES), "NUE_PR727_COMPOSE_IMAGES")
    expected_files = {p.relative_to(root / "source").as_posix(): p.read_bytes()
                      for directory in RUNTIME_ROOTS for p in (root / "source" / directory).rglob("*") if p.is_file()}
    for row in rows:
        service = row["Name"].removeprefix("/platform-infra-").removesuffix("-1")
        role = "web" if service == "web" else "runtime"
        identity = identities[role]
        oci.check_running_container(row, identity)
        image = json.loads(command(["docker", "image", "inspect", identity]))[0]
        oci.check_loaded_image(image, identity)
        config = row["Config"]
        require(row.get("ImageManifestDescriptor", {}).get("mediaType") == "application/vnd.oci.image.manifest.v1+json",
                "NUE_PR727_CONTAINER_PLATFORM_MANIFEST")
        if service != "web":
            require(config["Cmd"] == ["npm", "run", "dev:" + service] and
                    config["Entrypoint"] == ["docker-entrypoint.sh"] and
                    config["WorkingDir"] == "/catering-product" and not row["Mounts"], "NUE_PR727_RUNTIME_LAYOUT")
            files = runtime_files(row["Id"], "/catering-product")
            require(files == expected_files and schema_binding(files) == manifest["schemaBinding"], "NUE_PR727_RUNTIME_SOURCE")
            observations[row["Name"] + ":source"] = hashlib.sha256(canonical({k: hashlib.sha256(v).hexdigest() for k, v in sorted(files.items())})).hexdigest()
        else:
            require(config["Cmd"] == ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"] and
                    not config.get("Entrypoint") and config["WorkingDir"] == "/srv", "NUE_PR727_WEB_COMMAND")
            require(config["Cmd"] == image["Config"]["Cmd"] and config.get("Entrypoint") == image["Config"].get("Entrypoint"), "NUE_PR727_WEB_IMAGE_COMMAND")
            mounts = row["Mounts"]
            require(all(not any(m["Destination"] == r or r.startswith(m["Destination"].rstrip("/") + "/") or
                                m["Destination"].startswith(r + "/")
                                for r in ("/srv", "/catering-public", "/catering-previous-public")) for m in mounts),
                    "NUE_PR727_WEB_ROOT_MOUNT")
            site_mounts = [m for m in mounts if m["Type"] == "bind" and m["Destination"] == "/etc/caddy/sites"]
            require(len(site_mounts) == 1 and not site_mounts[0]["RW"], "NUE_PR727_SITES_MOUNT")
            sites = protected(Path(site_mounts[0]["Source"]), directory=True)
            require(sites == COMPOSE.parent / "sites", "NUE_PR727_SITES_SOURCE")
            configurations = {p.name: digest(protected(p)) for p in sites.glob("*.caddy")}
            require(configurations == {"catering-target.caddy": CURRENT_WEB_SNIPPET_SITE_SHA256} and
                    hashlib.sha256(command(["docker", "exec", row["Id"], "cat", "/etc/caddy/Caddyfile"])).hexdigest() == CURRENT_WEB_CADDY_SHA256,
                    "NUE_PR727_SERVING_CONFIG")
            command(["docker", "exec", row["Id"], "sh", "-ec",
                     'test -L /srv && test "$(readlink /srv)" = /catering-public && test -d /catering-public && test ! -L /catering-public && test -d /catering-previous-public && test ! -L /catering-previous-public'])
            observations["webWritableState"] = pr727_web_writable_state(row)
            observations["caddyConfiguration"] = configurations
        observations[row["Name"]] = {"binding": container_binding(row), "cmd": config["Cmd"],
                                     "entrypoint": config.get("Entrypoint"), "workingDir": config["WorkingDir"]}
    observations["composeSha256"] = digest(COMPOSE)
    return observations


def current_base_gate(oci, runtime_m, web_m, *, accepted_current_release=None):
    host_identity()
    require(runtime_m == CURRENT_RUNTIME_M and web_m == CURRENT_WEB_M, "NUE_CURRENT_BASE_EXACT_M_REQUIRED")
    compose = json.loads(protected(COMPOSE).read_bytes())
    require(set(compose["services"]) == set(SERVICES) and all("working_dir" not in compose["services"][s] for s in SERVICES), "NUE_CURRENT_COMPOSE_WORKDIR")
    observations = {}
    image_rows = {role: json.loads(command(["docker", "image", "inspect", identity]))[0] for role, identity in (("runtime", runtime_m), ("web", web_m))}
    for role, identity in (("runtime", runtime_m), ("web", web_m)):
        image = image_rows[role]
        oci.check_loaded_image(image, identity)
        require(image.get("Descriptor", {}).get("mediaType") == "application/vnd.oci.image.manifest.v1+json", "NUE_CURRENT_BASE_NOT_PLATFORM_MANIFEST")
    rows = inspect(["platform-infra-" + service + "-1" for service in SERVICES])
    require({row["Name"] for row in rows} == {"/platform-infra-" + s + "-1" for s in SERVICES} and len(rows) == 5, "NUE_CURRENT_BASE_CONTAINER_SCOPE")
    if accepted_current_release is not None:
        binding = accepted_current_binding(accepted_current_release)
        root, manifest = accepted_current_bundle(oci, binding)
        identities = {role: manifest["images"][role]["platformManifestDigest"] for role in ("runtime", "web")}
        return verified_product_running_gate(oci, rows, root, manifest, identities,
                                             {"acceptedCurrentRelease": binding})
    if all(row.get("ImageManifestDescriptor", {}).get("digest") == PR727_IMAGES["web" if row["Name"] == "/platform-infra-web-1" else "runtime"] for row in rows):
        return pr727_running_gate(oci, rows)
    if all(row.get("ImageManifestDescriptor", {}).get("digest") == PR735_IMAGES["web" if row["Name"] == "/platform-infra-web-1" else "runtime"] for row in rows):
        return pr735_running_gate(oci, rows)
    if all(row.get("ImageManifestDescriptor", {}).get("digest") == RELEASE_3D287D8_IMAGES["web" if row["Name"] == "/platform-infra-web-1" else "runtime"] for row in rows):
        return release_3d287d8_running_gate(oci, rows)
    if all(row.get("ImageManifestDescriptor", {}).get("digest") == RELEASE_681213B_IMAGES["web" if row["Name"] == "/platform-infra-web-1" else "runtime"] for row in rows):
        return release_681213b_running_gate(oci, rows)
    for row in rows:
        service = row["Name"].removeprefix("/platform-infra-").removesuffix("-1")
        oci.check_running_container(row, web_m if service == "web" else runtime_m)
        require(row.get("ImageManifestDescriptor", {}).get("mediaType") == "application/vnd.oci.image.manifest.v1+json", "NUE_CURRENT_CONTAINER_NOT_PLATFORM_MANIFEST")
        config = row["Config"]
        if service != "web":
            require(config["Cmd"] == ["npm", "run", "dev:" + service] and config["Entrypoint"] == ["docker-entrypoint.sh"] and config["WorkingDir"] == "/app", "NUE_CURRENT_RUNTIME_COMMAND")
            require(not row["Mounts"], "NUE_CURRENT_RUNTIME_MOUNTS")
            command(["docker", "exec", row["Id"], "sh", "-ec", "test ! -e /catering-product && test ! -L /catering-product"])
        else:
            # Docker may omit an empty Web Entrypoint; absence and null mean the same thing.
            require(config["Cmd"] == ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"] and not config.get("Entrypoint") and config["WorkingDir"] == "/srv", "NUE_CURRENT_WEB_COMMAND")
            require(config["Cmd"] == image_rows["web"]["Config"]["Cmd"] and config.get("Entrypoint") == image_rows["web"]["Config"].get("Entrypoint"), "NUE_CURRENT_WEB_IMAGE_COMMAND")
            require(all(not any(m["Destination"] == root or root.startswith(m["Destination"].rstrip("/") + "/") or m["Destination"].startswith(root + "/") for root in ("/srv", "/catering-public", "/catering-previous-public")) for m in row["Mounts"]), "NUE_CURRENT_WEB_ROOT_MOUNT")
            command(["docker", "exec", row["Id"], "sh", "-ec", "test -d /srv && test ! -L /srv && test ! -e /catering-public && test ! -L /catering-public && test ! -e /catering-previous-public && test ! -L /catering-previous-public"])
            image_config = command(["docker", "exec", row["Id"], "cat", "/etc/caddy/Caddyfile"])
            site_mounts = [m for m in row["Mounts"] if m["Type"] == "bind" and m["Destination"] == "/etc/caddy/sites"]
            require(len(site_mounts) == 1 and not site_mounts[0]["RW"], "NUE_CURRENT_SITES_MOUNT")
            site_root = protected(Path(site_mounts[0]["Source"]), directory=True)
            require(site_root == COMPOSE.parent / "sites", "NUE_CURRENT_SITES_SOURCE")
            configurations = {"image": image_config}
            for path in sorted(site_root.glob("*.caddy")): configurations[str(path)] = protected(path).read_bytes()
            require(len(configurations) > 1, "NUE_CURRENT_SITES_REQUIRED")
            configuration_hashes = {name: hashlib.sha256(content).hexdigest() for name, content in configurations.items()}
            # This observed site inherits /srv through catering_app_routes. Bind both
            # complete files and their scope; a rootless fragment alone proves nothing.
            snippet_site = str(site_root / "catering-target.caddy")
            bound_snippet = configuration_hashes == {"image": CURRENT_WEB_CADDY_SHA256, snippet_site: CURRENT_WEB_SNIPPET_SITE_SHA256}
            for name, content in configurations.items():
                roots = re.findall(rb"(?m)^\s*root\s+(?:\*\s+)?([^\s{}]+)\s*$", content)
                require(((roots and all(root == b"/srv" for root in roots)) or (not roots and name == snippet_site and bound_snippet)) and b"/catering-previous-public" not in content, "NUE_CURRENT_WEB_SERVING_ROOT")
            observations["caddyConfiguration"] = configuration_hashes
        observations[row["Name"]] = {"binding": container_binding(row), "cmd": config["Cmd"], "entrypoint": config.get("Entrypoint"), "workingDir": config["WorkingDir"]}
    observations["composeSha256"] = digest(COMPOSE)
    return observations


def local_current_dockerfile(role, runtime_m, web_m):
    require(runtime_m == CURRENT_RUNTIME_M and web_m == CURRENT_WEB_M, "NUE_CURRENT_BASE_EXACT_M_REQUIRED")
    runtime = "FROM " + current_local_reference("runtime", runtime_m) + "\nWORKDIR /\nRUN test ! -e /catering-product && test ! -L /catering-product\nWORKDIR /catering-product\nCOPY . .\nRUN npm ci\n"
    if role == "runtime": return runtime + 'CMD ["npm", "run", "dev:intake"]\n'
    require(role == "web", "NUE_CURRENT_DOCKERFILE_ROLE")
    build = runtime.replace("\nWORKDIR /\n", " AS build\nWORKDIR /\n", 1)
    return build + "RUN npm --workspace @catering/backoffice-ui run build\nRUN test -f /catering-product/backoffice-ui/dist/index.html && test -z \"$(find /catering-product/backoffice-ui/dist -type l -print)\"\nFROM " + current_local_reference("web", web_m) + "\nWORKDIR /\nRUN test -d /srv && test ! -L /srv && test ! -e /catering-public && test ! -L /catering-public && test ! -e /catering-previous-public && test ! -L /catering-previous-public && mv /srv /catering-previous-public && mkdir /catering-public && ln -s /catering-public /srv\nCOPY --from=build /catering-product/backoffice-ui/dist/ /catering-public/\nCOPY platform-infra/Caddyfile /etc/caddy/Caddyfile\nWORKDIR /srv\n"


def current_local_reference(role, identity):
    require(role in ("runtime", "web") and IMAGE.fullmatch(identity or ""), "NUE_CURRENT_LOCAL_REFERENCE")
    return "catering-nue-current-" + role + ":" + identity.removeprefix("sha256:")


def create_bundle(operator, source, product, operations, output, node_base, caddy_base, *, exported=False, base_mode="repository", runtime_base=None, web_base=None, accepted_current_release=None):
    binding = accepted_current_binding(accepted_current_release) if accepted_current_release is not None else None
    kwargs = dict(exported=exported, base_mode=base_mode, runtime_base=runtime_base, web_base=web_base,
                  accepted_current_release=binding)
    if binding is None:
        return _create_bundle(operator, source, product, operations, output, node_base, caddy_base, **kwargs)
    require(exported and base_mode == "local-current", "NUE_ACCEPTED_CURRENT_BUILD_SCOPE")
    # Both public build entries share this ordering. Public Verify refuses any
    # update lock; under our own lock the pinned runtime verifier checks again.
    accepted_current_bundle(operator._oci(), binding, before_lock=True)
    token = own_lock()
    try:
        owned(token)
        return _create_bundle(operator, source, product, operations, output, node_base, caddy_base, **kwargs)
    finally:
        unlock(token)


def _create_bundle(operator, source, product, operations, output, node_base, caddy_base, *, exported=False, base_mode="repository", runtime_base=None, web_base=None, accepted_current_release=None):
    """Build only with exact, already present base manifests; no floating FROM tags."""
    require(not output.exists() and not output.is_symlink(), "NUE_OUTPUT_EXISTS")
    binding = accepted_current_binding(accepted_current_release) if accepted_current_release is not None else None
    require(binding is None or (exported and base_mode == "local-current"), "NUE_ACCEPTED_CURRENT_BUILD_SCOPE")
    bases = {}
    require(base_mode in ("repository", "local-current"), "NUE_BASE_MODE")
    if base_mode == "local-current":
        require(node_base is None and caddy_base is None, "NUE_CURRENT_BASE_INPUT_SCOPE")
        current_before = current_base_gate(operator._oci(), runtime_base, web_base, accepted_current_release=binding)
        # Reuse the accepted local tag→exact-M binding; these are local aliases,
        # never invented official repository digests or registry inputs.
        for role, identity in (("runtime", runtime_base), ("web", web_base)):
            reference = current_local_reference(role, identity)
            command(["docker", "tag", identity, reference])
            operator._oci().check_loaded_image(json.loads(command(["docker", "image", "inspect", reference]))[0], identity)
        bases = dict(CURRENT_BASE_LAYOUT)
    else:
        require(runtime_base is None and web_base is None, "NUE_REPOSITORY_BASE_INPUT_SCOPE")
        for role, reference in (("node", node_base), ("caddy", caddy_base)):
            require(re.fullmatch(r"[a-zA-Z0-9./:_-]+@sha256:[0-9a-f]{64}", reference or ""), "NUE_PINNED_BASE_REQUIRED")
            row = json.loads(command(["docker", "image", "inspect", reference]))[0]
            require(row["Os"] == "linux" and row["Architecture"] == "amd64" and IMAGE.fullmatch(row["Id"]), "NUE_BASE_PLATFORM")
            bases[role] = {"reference": reference, "localImageId": row["Id"]}
    output.mkdir(mode=0o755)
    context = output / "source"
    if exported: shutil.copytree(source, context)
    else: operator.export_product_context(source, product, context)
    require((context / "package-lock.json").is_file(), "NUE_LOCKFILE_REQUIRED")
    tools = output / "tools"; tools.mkdir(mode=0o755)
    for name in ("catering-target-operator.py", "catering_target_oci.py", "catering_target_nue_image_update.py"):
        shutil.copyfile(Path(__file__).with_name(name), tools / name)
        (tools / name).chmod(0o644)
    images = {}
    for role in ("runtime", "web"):
        original = (context / ("platform-infra/docker/Dockerfile." + role)).read_text()
        if role == "runtime":
            require(original.count("FROM node:22-alpine") == 1 and original.count("FROM ") == 1, "NUE_RUNTIME_DOCKERFILE")
        else:
            require(original.count("FROM node:22-alpine AS build") == 1 and original.count("FROM caddy:2.10-alpine") == 1 and original.count("FROM ") == 2, "NUE_WEB_DOCKERFILE")
        rendered = local_current_dockerfile(role, runtime_base, web_base) if base_mode == "local-current" else original.replace("FROM node:22-alpine", "FROM " + node_base).replace("FROM caddy:2.10-alpine", "FROM " + caddy_base)
        dockerfile = output / ("Dockerfile." + role + ".bound")
        dockerfile.write_text(rendered); dockerfile.chmod(0o644)
        iid = output / (role + ".iid")
        if base_mode == "local-current":
            for kind, identity in (("runtime", runtime_base), ("web", web_base)):
                operator._oci().check_loaded_image(json.loads(command(["docker", "image", "inspect", current_local_reference(kind, identity)]))[0], identity)
        command(["docker", "build", "--pull=false", "--provenance=false", "--sbom=false", "--platform", "linux/amd64", "--iidfile", str(iid), "--file", str(dockerfile), str(context)], timeout=1800)
        identity = iid.read_text().strip()
        require(IMAGE.fullmatch(identity), "NUE_BUILD_IDENTITY")
        archive = output / (role + "-image.tar.gz")
        operator._save_docker_image(identity, archive)
        images[role] = {**operator._inspect_archive(archive, identity), "archiveSha256": digest(archive)}
    if base_mode == "local-current":
        require(current_base_gate(operator._oci(), runtime_base, web_base, accepted_current_release=binding) == current_before, "NUE_CURRENT_BASE_CHANGED_DURING_BUILD")
        for kind, identity in (("runtime", runtime_base), ("web", web_base)):
            operator._oci().check_loaded_image(json.loads(command(["docker", "image", "inspect", current_local_reference(kind, identity)]))[0], identity)
    manifest = {"schemaVersion": 1, "mode": "nue-image-only", "repository": operator.REPOSITORY, "targetId": "catering-prod-02", "platform": "linux/amd64", "productCommit": product, "operationsCommit": operations, "sourceTreeSha256": operator._source_tree_digest(context), "schemaBinding": source_schema(context), "bases": bases, "images": images, "helpers": {path.name: digest(path) for path in tools.iterdir()}}
    (output / "manifest.json").write_bytes(canonical(manifest)); (output / "manifest.json").chmod(0o644)
    value = digest(output / "manifest.json")
    verify_bundle(output, value)
    return value


def host_identity():
    require(os.geteuid() == 0 and socket.gethostname() == "catering-prod-02", "NUE_HOST_IDENTITY")
    require("2.28.200.16" in command(["ip", "-j", "address"]).decode(), "NUE_HOST_ADDRESS")
    os.umask(0o077)


def inspect(names):
    return json.loads(command(["docker", "inspect", *names]))


def configuration_index():
    result = {}
    for root in CONFIG_ROOTS:
        protected(root, directory=True)
        for current, dirs, files in os.walk(root, followlinks=False):
            for name in sorted([*dirs, *files]):
                path = Path(current) / name; info = path.lstat()
                require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), "NUE_CONFIG_FILE_TYPE")
                require(info.st_uid == 0 and not info.st_mode & 0o022 and (not path.is_file() or info.st_nlink == 1), "NUE_CONFIG_METADATA")
                result[str(path)] = {"uid": info.st_uid, "gid": info.st_gid, "mode": stat.S_IMODE(info.st_mode), "sha256": digest(path) if path.is_file() else None}
    require(str(COMPOSE) in result and str(ENV) in result, "NUE_CONFIG_SCOPE")
    return result


def environment_binding(entries):
    require(isinstance(entries, list), "NUE_ENV_LIST_REQUIRED")
    values = {}
    for entry in entries:
        require(isinstance(entry, str) and "\0" not in entry, "NUE_ENV_ENTRY_REQUIRED")
        name, separator, value = entry.partition("=")
        require(separator == "=" and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) and name not in values,
                "NUE_ENV_UNIQUE_NAME_REQUIRED")
        values[name] = value
    # Compose can reorder ENV entries on recreation; preserve every key and value,
    # while rejecting duplicate names whose effective value would depend on order.
    return hashlib.sha256(canonical(values)).hexdigest()


def container_binding(row, with_id=True):
    host = row["HostConfig"]
    result = {"image": row["Image"], "mounts": row["Mounts"], "restart": host["RestartPolicy"], "ports": host.get("PortBindings") or {}, "networks": sorted(row["NetworkSettings"]["Networks"]), "environmentFormat": "unique-key-map-v1", "environmentSha256": environment_binding(row["Config"].get("Env"))}
    if with_id:
        result["id"] = row["Id"]
    return result


def catalogue():
    sql = "SELECT json_build_object('databases',(SELECT json_agg(datname ORDER BY datname) FROM pg_database WHERE NOT datistemplate AND datname<>'postgres'),'prepared',(SELECT count(*) FROM pg_prepared_xacts),'externalTablespaces',(SELECT count(*) FROM pg_tablespace WHERE pg_tablespace_location(oid)<>''),'schema',(SELECT version_number FROM catering_schema_migrations WHERE unit_name='catering_business_records'));"
    value = json.loads(command(["docker", "exec", "platform-infra-postgres-1", "psql", "-X", "-U", "catering", "-d", "catering_agents", "-Atc", sql]))
    require(value == {"databases": sorted(DATABASES), "prepared": 0, "externalTablespaces": 0, "schema": 3}, "NUE_DATABASE_SCHEMA_SCOPE")
    return value


def snapshot():
    names = command(["docker", "ps", "-a", "--format", "{{.Names}}", "--no-trunc"]).decode().splitlines()
    require(set(names) == set(NAMES) and len(names) == 7, "NUE_SEVEN_CONTAINER_SCOPE")
    rows = inspect(NAMES)
    require(all(row["State"]["Running"] and not row["State"].get("Paused") for row in rows), "NUE_CONTAINER_STATE")
    volumes = set(command(["docker", "volume", "ls", "-q"]).decode().splitlines())
    require(volumes == VOLUMES, "NUE_FIVE_VOLUME_SCOPE")
    networks = sorted(command(["docker", "network", "ls", "--format", "{{.Name}}"]).decode().splitlines())
    require(set(networks) == {"bridge", "host", "none", "catering_private", "catering_public", "catering_ingress", "catering_ui_access"}, "NUE_NETWORK_SCOPE")
    return {"containers": {r["Name"].lstrip("/"): container_binding(r) for r in rows}, "files": configuration_index(), "volumes": sorted(volumes), "networks": networks, "catalogue": catalogue()}


def backup_gate(proof, baseline):
    require(proof["capture"]["sourceResumed"] is True and len(proof["capture"]["files"]) == 17 and proof["capture"]["manifestSha256"] == proof["manifestSha256"], "NUE_BACKUP_COMPONENT_SCOPE")
    require(proof["restore"]["status"] == "ALL_THREE_DATABASES_GLOBALS_AND_REQUIRED_FILES_IDENTICAL" and proof["restore"]["databases"] == 3 and proof["restore"]["fileTrees"] == 8 and proof["restore"]["probeContainerRemoved"] is True, "NUE_RESTORE_PROOF_REQUIRED")
    require(proof["captureCleanup"]["status"] == "OWN_TMPFS_UNMOUNTED" and proof["finalHealth"]["status"] == "ORIGINAL_SEVEN_CONTAINERS_POLICIES_DATABASE_SCOPE_AND_HTTPS_HEALTHY", "NUE_BACKUP_CLEANUP_HEALTH_REQUIRED")
    require(SHA.fullmatch(proof["snapshotId"]) and SHA.fullmatch(proof["manifestSha256"]), "NUE_OFFHOST_SNAPSHOT_BINDING")
    when = datetime.datetime.fromisoformat(proof["at"])
    age = (datetime.datetime.now(datetime.timezone.utc) - when).total_seconds()
    require(0 <= age <= 21600, "NUE_BACKUP_PROOF_STALE")
    require(proof["runId"] == proof["restore"]["runId"] == proof["captureCleanup"]["runId"], "NUE_BACKUP_RUN_BINDING")
    require(re.fullmatch(r"[0-9a-f]{32}", proof["runId"]), "NUE_BACKUP_RUN_ID")
    durable = protected(Path("/var/lib/catering-nue-proof-" + proof["runId"]), directory=True)
    capture = json.loads(protected(durable / "capture.json").read_bytes())
    require(capture["files"] == 16 and capture["manifestSha256"] == proof["manifestSha256"] and capture["runId"] == proof["runId"], "NUE_DURABLE_CAPTURE_BINDING")
    for phase in ("capture", "restore"):
        cleanup = json.loads(protected(durable / (phase + "-cleanup.json")).read_bytes())
        require(cleanup == {"status": "OWN_TMPFS_UNMOUNTED", "runId": proof["runId"], "phase": phase}, "NUE_DURABLE_CLEANUP_PROOF")
        require(not os.path.lexists(Path("/run/catering-nue-" + phase + "-" + proof["runId"])), "NUE_PROBE_WORKSPACE_REMAINS")
    restore = json.loads(protected(durable / "restore.json").read_bytes())
    require(restore == proof["restore"] and restore["manifestSha256"] == proof["manifestSha256"], "NUE_DURABLE_RESTORE_BINDING")
    require(SHA.fullmatch(proof["outer"]["sha256"]) and restore["outerSha256"] == proof["outer"]["sha256"] and proof["outer"]["bytes"] > 0, "NUE_OFFHOST_STREAM_BINDING")
    resume = json.loads(protected(durable / "resume.json").read_bytes())
    require(resume == {"status": "ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED", "runId": proof["runId"]}, "NUE_DURABLE_SOURCE_RESUME")
    original = json.loads(protected(durable / "original-state.json").read_bytes())
    require({row["Name"].lstrip("/") for row in original} == set(NAMES) and len(original) == 7, "NUE_BACKUP_ORIGINAL_SCOPE")
    for row in original:
        previous = baseline["containers"][row["Name"].lstrip("/")]
        require(row["Id"] == previous["id"] and row["Image"] == previous["image"] and row["HostConfig"]["RestartPolicy"] == previous["restart"], "NUE_BACKUP_BASELINE_BINDING")


def own_lock():
    require(not os.path.lexists(LOCK), "NUE_FOREIGN_UPDATE_LOCK")
    token = uuid.uuid4().hex
    LOCK.mkdir(mode=0o700)
    put(LOCK / "owner.json", {"mode": "nue-image-only", "token": token})
    return token


def owned(token):
    protected(LOCK, directory=True)
    require(json.loads(protected(LOCK / "owner.json").read_bytes()) == {"mode": "nue-image-only", "token": token}, "NUE_LOCK_NOT_OWNED")


def unlock(token):
    owned(token)
    (LOCK / "owner.json").unlink(); LOCK.rmdir()


def candidate_compose(old, images):
    value = json.loads(old)
    require(set(value["services"]) == set(SERVICES), "NUE_COMPOSE_SERVICE_SCOPE")
    for service in SERVICES:
        require("image" in value["services"][service] and "build" not in value["services"][service], "NUE_IMAGE_ONLY_SERVICE")
        value["services"][service]["image"] = images[service]
    return (json.dumps(value, indent=2) + "\n").encode()


def stage(bundle, manifest_sha, expected_path, expected_sha, proof_path, proof_sha, admission_path=None, admission_sha=None, signature_path=None, signature_sha=None):
    host_identity()
    protected(bundle, directory=True)
    admission = require_admission(admission_path, admission_sha, None, manifest_sha, "stage", bundle,
                      {"expectedBaseline": str(expected_path), "expectedBaselineSha256": expected_sha, "backupProof": str(proof_path), "backupProofSha256": proof_sha}, signature_path, signature_sha)
    # Authenticate the locally accepted manifest before loading any bundled helper.
    manifest = verify_bundle(bundle, manifest_sha)
    bind_admission_manifest(admission, manifest)
    expected = read_bound(protected(expected_path), expected_sha)
    proof = read_bound(protected(proof_path), proof_sha)
    token = own_lock()
    try:
        baseline = snapshot()
        previous = {r["name"].lstrip("/"): r for r in expected["containers"]}
        require(set(previous) == set(NAMES), "NUE_EXPECTED_SCOPE")
        for name, row in baseline["containers"].items():
            old = previous[name]
            require(all(row[key] == old[key] for key in ("id", "image", "mounts", "restart")), "NUE_CURRENT_BASELINE_MISMATCH")
        backup_gate(proof, baseline)
        for service in SERVICES[:-1]:
            require(runtime_schema("platform-infra-" + service + "-1") == manifest["schemaBinding"], "NUE_RUNTIME_DDL_DRIFT_HOLD")
        protected(RELEASES.parent, directory=True)
        if not RELEASES.exists(): RELEASES.mkdir(mode=0o700)
        protected(RELEASES, directory=True)
        destination = RELEASES / manifest_sha
        require(not os.path.lexists(destination), "NUE_STAGE_ALREADY_EXISTS_HOLD")
        owned(token)
        shutil.copytree(bundle, destination)
        put(destination / "baseline.json", baseline)
        put(destination / "backup-proof.json", Path(proof_path).read_bytes())
        put(destination / "stage.json", {"manifestSha256": manifest_sha, "baselineSha256": digest(destination / "baseline.json"), "backupProofSha256": proof_sha, "expectedSha256": expected_sha, "mode": "nue-image-only", "observerInstalled": False})
        require(digest(destination / "backup-proof.json") == proof_sha, "NUE_BACKUP_COPY_BINDING")
        require(snapshot() == baseline, "NUE_DRIFT_DURING_STAGE")
        return {"status": "NUE_IMAGE_ONLY_STAGED", "manifestSha256": manifest_sha, "path": str(destination)}
    finally:
        unlock(token)


def compose_up():
    command(["docker", "compose", "--project-name", "platform-infra", "--env-file", str(ENV), "-f", str(COMPOSE), "up", "-d", "--no-deps", "--pull", "never", *SERVICES], timeout=180)


def replace_compose(body, metadata, token):
    owned(token)
    pending = COMPOSE.parent / (".nue-compose-" + token + "-" + uuid.uuid4().hex)
    put(pending, body); os.chown(pending, metadata["uid"], metadata["gid"]); os.chmod(pending, metadata["mode"])
    os.replace(pending, COMPOSE)
    fd = os.open(COMPOSE.parent, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)


def policy_name(policy):
    value = policy["Name"]
    require(value in ("no", "always", "unless-stopped", "on-failure"), "NUE_RESTART_POLICY")
    return value + (":" + str(policy["MaximumRetryCount"]) if value == "on-failure" and policy.get("MaximumRetryCount") else "")


def set_policies(baseline, token):
    for service in SERVICES:
        owned(token)
        name = "platform-infra-" + service + "-1"
        command(["docker", "update", "--restart=" + policy_name(baseline["containers"][name]["restart"]), name])


def settle_stops(pending):
    deadline = time.monotonic() + 180
    while pending:
        for identity in tuple(pending):
            if not inspect([identity])[0]["State"]["Running"]:
                pending.remove(identity)
        require(not pending or time.monotonic() < deadline, "NUE_STOP_OUTCOME_UNKNOWN_KEEP_LOCK")
        if pending: time.sleep(1)


def pause_applications(baseline, allowed_images, pending, token):
    rows = inspect(["platform-infra-" + service + "-1" for service in SERVICES])
    require({row["Name"] for row in rows} == {"/platform-infra-" + service + "-1" for service in SERVICES}, "NUE_PAUSE_SCOPE")
    for row in rows:
        previous = dict(baseline["containers"][row["Name"].lstrip("/")])
        current = container_binding(row)
        require(current["image"] in allowed_images, "NUE_PAUSE_IMAGE_NOT_OWNED")
        require(current["restart"] in (previous["restart"], {"Name": "no", "MaximumRetryCount": 0}), "NUE_PAUSE_POLICY_DRIFT")
        for binding in (previous, current):
            for key in ("id", "image", "restart"): binding.pop(key)
        require(current == previous, "NUE_PAUSE_CONTAINER_DRIFT")
    for row in rows:
        owned(token)
        command(["docker", "update", "--restart=no", row["Id"]])
    for row in rows:
        owned(token)
        if not inspect([row["Id"]])[0]["State"]["Running"]: continue
        pending.add(row["Id"])
        command(["docker", "stop", "--timeout", "-1", row["Id"]], timeout=90)
        require(not inspect([row["Id"]])[0]["State"]["Running"], "NUE_STOP_NOT_COMPLETE")
        pending.remove(row["Id"])


def original_edge_loopback_denial(baseline):
    expected = baseline["files"].get(str(ORIGINAL_EDGE_CADDY))
    require(expected is not None and expected["sha256"] == ORIGINAL_EDGE_CADDY_SHA256, "NUE_TLS_403_ORIGINAL_ACL_BASELINE_REQUIRED")
    path = protected(ORIGINAL_EDGE_CADDY); info = path.stat()
    require({"uid": info.st_uid, "gid": info.st_gid, "mode": stat.S_IMODE(info.st_mode), "sha256": digest(path)} == expected, "NUE_TLS_403_ORIGINAL_ACL_CHANGED")


def health(baseline):
    deadline = time.monotonic() + 90
    for service, port in zip(SERVICES[:-1], (3101, 3102, 3103, 3104)):
        while True:
            result = subprocess.run(["docker", "exec", "platform-infra-" + service + "-1", "node", "-e", "fetch('http://127.0.0.1:" + str(port) + "/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], capture_output=True, timeout=10)
            if result.returncode == 0: break
            require(time.monotonic() < deadline, "NUE_HEALTH_TIMEOUT")
            time.sleep(1)
    observed = {"authenticatedSmoke": False}
    for name, url, extra in (("web", "http://127.0.0.1:18081/", []), ("tls", "https://catering.the-one.catering/", ["--resolve", "catering.the-one.catering:443:127.0.0.1"])):
        deadline = time.monotonic() + 60
        while True:
            result = subprocess.run(["curl", "--noproxy", "*", "--connect-timeout", "5", "--max-time", "10", "--silent", "--output", "/dev/null", "--write-out", "%{http_code}", *extra, url], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15)
            code = result.stdout.decode("ascii", errors="replace")
            if result.returncode == 0:
                if code in ("200", "401"): break
                if name == "tls" and code == "403":
                    original_edge_loopback_denial(baseline)
                    observed["tlsProbe"] = "VALID_CERTIFICATE_AND_ORIGINAL_LOOPBACK_ACL_DENIAL"
                    break
            require(time.monotonic() < deadline, "NUE_HTTP_TLS_HEALTH")
            time.sleep(1)
        observed[name] = code
    return observed


def verify_runtime(baseline, images, compose_bytes, candidate_oci=None, candidate_layout=None, candidate_schema=None):
    current = snapshot()
    require(COMPOSE.read_bytes() == compose_bytes, "NUE_COMPOSE_BYTES")
    for key in ("networks", "volumes", "catalogue"):
        require(current[key] == baseline[key], "NUE_PRESERVATION_" + key.upper())
    files = dict(current["files"])
    require(set(files) == set(baseline["files"]), "NUE_CONFIG_FILE_SCOPE")
    files[str(COMPOSE)] = dict(files[str(COMPOSE)], sha256=baseline["files"][str(COMPOSE)]["sha256"])
    require(files == baseline["files"], "NUE_CONFIG_BYTES_OR_METADATA_CHANGED")
    for name, previous in baseline["containers"].items():
        now = current["containers"][name]
        if name in {"platform-infra-" + s + "-1" for s in SERVICES}:
            expected = dict(previous, image=images[name[len("platform-infra-"):-2]])
            expected.pop("id"); now = dict(now); now.pop("id")
        else: expected = previous
        require(now == expected, "NUE_CONTAINER_PRESERVATION")
    if candidate_oci is not None:
        for row in inspect(["platform-infra-" + s + "-1" for s in SERVICES]):
            service = row["Name"].removeprefix("/platform-infra-").removesuffix("-1")
            candidate_oci.check_running_container(row, images[service])
            if candidate_layout == CURRENT_BASE_LAYOUT:
                if service == "web":
                    command(["docker", "exec", row["Id"], "sh", "-ec", 'test "$(readlink /srv)" = /catering-public && test -f /catering-public/index.html && test -z "$(find /catering-public -type l -print)"'])
                else:
                    require(row["Config"]["WorkingDir"] == "/catering-product" and row["Config"]["Cmd"] == ["npm", "run", "dev:" + service] and row["Config"]["Entrypoint"] == ["docker-entrypoint.sh"], "NUE_CANDIDATE_FRESH_RUNTIME_ROOT")
                    require(runtime_schema(row["Id"], "/catering-product") == candidate_schema, "NUE_CANDIDATE_RUNTIME_SCHEMA")
    health(baseline)
    return current


def interrupted(signum, frame):
    if not RECOVERING: raise RuntimeError("NUE_INTERRUPTED:" + str(signum))


def apply(bundle, manifest_sha, smoke, smoke_sha, admission_path=None, admission_sha=None, signature_path=None, signature_sha=None):
    global RECOVERING
    host_identity(); bundle = protected(bundle, directory=True)
    require(bundle == RELEASES / manifest_sha, "NUE_STAGED_PATH_BINDING")
    admission = require_admission(admission_path, admission_sha, None, manifest_sha, "apply", bundle,
                      {"protectedSmoke": str(smoke), "protectedSmokeSha256": smoke_sha}, signature_path, signature_sha)
    manifest = verify_bundle(bundle, manifest_sha)
    bind_admission_manifest(admission, manifest)
    oci = load_module("nue_bound_oci", bundle / "tools/catering_target_oci.py")
    receipt = json.loads(protected(bundle / "stage.json").read_bytes())
    require(receipt["manifestSha256"] == manifest_sha and receipt["mode"] == "nue-image-only", "NUE_STAGE_BINDING")
    baseline = read_bound(protected(bundle / "baseline.json"), receipt["baselineSha256"])
    proof = read_bound(protected(bundle / "backup-proof.json"), receipt["backupProofSha256"])
    backup_gate(proof, baseline)
    # The existing protected smoke receives secrets through its protected environment.
    smoke = protected(smoke)
    require(smoke.stat().st_mode & 0o100, "NUE_SMOKE_EXECUTABLE")
    require(SHA.fullmatch(smoke_sha or "") and digest(smoke) == smoke_sha, "NUE_SMOKE_EXPLICIT_BINDING")
    token = own_lock(); pending = set(); mutated = False; old = COMPOSE.read_bytes(); safe = False
    handlers = {kind: signal.signal(kind, interrupted) for kind in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}
    try:
        require(snapshot() == baseline, "NUE_BASELINE_CHANGED_SINCE_STAGE")
        for service in SERVICES[:-1]:
            require(runtime_schema("platform-infra-" + service + "-1") == manifest["schemaBinding"], "NUE_RUNTIME_DDL_DRIFT_HOLD")
        for role, binding in manifest["images"].items():
            owned(token)
            command(["docker", "load", "--input", str(bundle / (role + "-image.tar.gz"))], timeout=180)
            row = json.loads(command(["docker", "image", "inspect", binding["platformManifestDigest"]]))[0]
            oci.check_loaded_image(row, binding["platformManifestDigest"])
            loaded = bundle / (role + ".loaded.tar")
            require(not os.path.lexists(loaded), "NUE_LOADED_PROBE_EXISTS")
            command(["docker", "save", "--output", str(loaded), binding["platformManifestDigest"]], timeout=300)
            compressed = bundle / (role + ".loaded.tar.gz")
            require(not os.path.lexists(compressed), "NUE_LOADED_PROBE_EXISTS")
            with loaded.open("rb") as source, gzip.open(compressed, "xb", compresslevel=1) as target:
                shutil.copyfileobj(source, target, length=1024 * 1024)
            operator = load_module("nue_loaded_operator", bundle / "tools/catering-target-operator.py")
            actual = operator._inspect_archive(compressed)
            require(all(actual[key] == binding[key] for key in ("platformManifestDigest", "configDigest")), "NUE_LOADED_OCI_RELATION")
        images = {s: manifest["images"]["web" if s == "web" else "runtime"]["platformManifestDigest"] for s in SERVICES}
        candidate = candidate_compose(old, images)
        put(bundle / "compose.before.json", old)
        put(bundle / "compose.candidate.json", candidate)
        # Disable autonomous restarts before the first writer stop. Never SIGKILL a
        # database writer on an arbitrary Docker stop deadline.
        require_admission(admission_path, admission_sha, manifest, manifest_sha, "apply", bundle,
                          {"protectedSmoke": str(smoke), "protectedSmokeSha256": smoke_sha}, signature_path, signature_sha)
        mutated = True
        pause_applications(baseline, {row["image"] for row in baseline["containers"].values()}, pending, token)
        active = command(["docker", "exec", "platform-infra-postgres-1", "psql", "-X", "-U", "catering", "-d", "catering_agents", "-Atc", "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()"])
        require(active.strip() == b"0", "NUE_UNKNOWN_DATABASE_WRITER_HOLD")
        owned(token); require(COMPOSE.read_bytes() == old, "NUE_COMPOSE_CHANGED_BEFORE_REPLACE")
        replace_compose(candidate, baseline["files"][str(COMPOSE)], token)
        compose_up(); set_policies(baseline, token)
        verify_runtime(baseline, images, candidate, candidate_oci=oci, candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
        command([str(smoke)], timeout=180)
        put(bundle / "installed.json", {"status": "NUE_IMAGE_ONLY_INSTALLED", "manifestSha256": manifest_sha, "composeSha256": hashlib.sha256(candidate).hexdigest(), "images": images, "smokeSha256": smoke_sha, "observerInstalled": False, "automaticBackupRestoreChainAccepted": False})
        safe = True
        return {"status": "NUE_IMAGE_ONLY_INSTALLED", "manifestSha256": manifest_sha, "observerInstalled": False}
    except BaseException:
        RECOVERING = True
        try:
            owned(token)
            if mutated:
                settle_stops(pending)
                pause_applications(baseline, {row["image"] for row in baseline["containers"].values()} | set(images.values()), pending, token)
                replace_compose(old, baseline["files"][str(COMPOSE)], token)
                compose_up(); set_policies(baseline, token)
                previous = {s: baseline["containers"]["platform-infra-" + s + "-1"]["image"] for s in SERVICES}
                verify_runtime(baseline, previous, old)
                command([str(smoke)], timeout=180)
                put(bundle / "rollback-verified.json", {"status": "NUE_ORIGINAL_COMPOSE_IMAGES_AND_HEALTH_RESTORED", "dataRolledBack": False})
            safe = True
        except BaseException:
            put(bundle / ("recovery-hold-" + token + ".json"), {"status": "NUE_MANUAL_RECOVERY_REQUIRED", "lockRetained": True})
        raise
    finally:
        RECOVERING = False
        for kind, previous in handlers.items(): signal.signal(kind, previous)
        if safe: unlock(token)


def verify(bundle, manifest_sha):
    host_identity(); bundle = protected(bundle, directory=True)
    require(not os.path.lexists(LOCK), "NUE_UPDATE_OR_RECOVERY_IN_PROGRESS")
    require(bundle == RELEASES / manifest_sha, "NUE_STAGED_PATH_BINDING")
    manifest = verify_bundle(bundle, manifest_sha)
    stage_receipt = json.loads(protected(bundle / "stage.json").read_bytes())
    baseline = read_bound(bundle / "baseline.json", stage_receipt["baselineSha256"])
    installed = json.loads(protected(bundle / "installed.json").read_bytes())
    require(installed["manifestSha256"] == manifest_sha, "NUE_INSTALL_BINDING")
    candidate = protected(bundle / "compose.candidate.json").read_bytes()
    require(hashlib.sha256(candidate).hexdigest() == installed["composeSha256"], "NUE_INSTALLED_COMPOSE_BINDING")
    images = {s: manifest["images"]["web" if s == "web" else "runtime"]["platformManifestDigest"] for s in SERVICES}
    require(images == installed["images"] and installed["status"] == "NUE_IMAGE_ONLY_INSTALLED", "NUE_INSTALLED_IMAGE_BINDING")
    oci = load_module("nue_verify_oci", bundle / "tools/catering_target_oci.py")
    verify_runtime(baseline, images, candidate, candidate_oci=oci, candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
    return {"status": "NUE_IMAGE_ONLY_VERIFIED", "observerInstalled": False, "automaticBackupRestoreChainAccepted": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("build", "stage", "apply", "verify"))
    parser.add_argument("--bundle-dir", type=Path, required=True)
    parser.add_argument("--manifest-sha256", required=True)
    parser.add_argument("--admission", type=Path)
    parser.add_argument("--admission-sha256")
    parser.add_argument("--admission-signature", type=Path)
    parser.add_argument("--admission-signature-sha256")
    parser.add_argument("--expected-baseline", type=Path)
    parser.add_argument("--expected-baseline-sha256")
    parser.add_argument("--backup-proof", type=Path)
    parser.add_argument("--backup-proof-sha256")
    parser.add_argument("--protected-smoke", type=Path)
    parser.add_argument("--protected-smoke-sha256")
    parser.add_argument("--confirm")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--node-base")
    parser.add_argument("--caddy-base")
    parser.add_argument("--base-mode", choices=("repository", "local-current"), default="repository")
    parser.add_argument("--runtime-base")
    parser.add_argument("--web-base")
    args = parser.parse_args(argv)
    try:
        if args.phase in ("stage", "apply"):
            require(args.admission_signature is not None and args.admission_signature_sha256 is not None, "NUE_SIGNED_MAC_ADMISSION_REQUIRED")
        if args.phase == "build":
            require(args.confirm == "BUILD_NUE_IMAGE_ONLY" and args.output_dir is not None, "NUE_BUILD_CONFIRMATION")
            result = {"status": "NUE_IMAGE_ONLY_BUNDLE_BUILT", "manifestSha256": build_prepared(args.bundle_dir, args.manifest_sha256, args.output_dir, args.node_base, args.caddy_base, base_mode=args.base_mode, runtime_base=args.runtime_base, web_base=args.web_base)}
        elif args.phase == "stage":
            require(args.confirm == "STAGE_NUE_IMAGE_ONLY", "NUE_STAGE_CONFIRMATION")
            result = stage(args.bundle_dir, args.manifest_sha256, args.expected_baseline, args.expected_baseline_sha256, args.backup_proof, args.backup_proof_sha256, args.admission, args.admission_sha256, args.admission_signature, args.admission_signature_sha256)
        elif args.phase == "apply":
            require(args.confirm == "ACTIVATE_NUE_IMAGE_ONLY", "NUE_APPLY_CONFIRMATION")
            result = apply(args.bundle_dir, args.manifest_sha256, args.protected_smoke, args.protected_smoke_sha256, args.admission, args.admission_sha256, args.admission_signature, args.admission_signature_sha256)
        else: result = verify(args.bundle_dir, args.manifest_sha256)
        print(json.dumps(result)); return 0
    except BaseException as error:
        print("NUE_IMAGE_UPDATE_HOLD reason=" + (str(error) if type(error) is RuntimeError else type(error).__name__), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
