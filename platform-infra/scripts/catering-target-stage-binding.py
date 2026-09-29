#!/usr/bin/env python3
"""Create and verify the immutable receipt that separates target stage from apply."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any


IMAGE_ID_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SOURCE_COMPOSE_FILES = {
    "platform-infra/docker-compose.catering-target.json": "source_platform_base_sha256",
    "platform-infra/docker-compose.catering-target.operations.json": "source_platform_operations_sha256",
}
MANIFEST_KEYS = {
    "schemaVersion", "repository", "targetId", "platform", "productCommit", "operationsCommit",
    "images", "artifacts", "sourceFiles", "sourceTreeSha256",
}
RELEASE_FILES = {
    "candidate-images.json", "runtime-image.tar.gz", "web-image.tar.gz", "manifest.json", "stage-binding.py",
}
SERVICE_NAMES = {"intake", "offer", "production", "exports", "web"}


class StageBindingError(Exception):
    """A fixed, non-sensitive stage receipt failure."""


def _digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def _regular(root: Path, name: str, *, mode: int, uid: int | None, gid: int | None) -> Path:
    path = root / name
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise StageBindingError("stage artifact type is invalid")
    if stat.S_IMODE(info.st_mode) != mode or (uid is not None and info.st_uid != uid) or (gid is not None and info.st_gid != gid):
        raise StageBindingError("stage artifact ownership or mode is invalid")
    return path


def _directory(root: Path, name: str, *, mode: int, uid: int | None, gid: int | None) -> Path:
    path = root / name if name else root
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise StageBindingError("stage source directory is invalid")
    if stat.S_IMODE(info.st_mode) != mode or (uid is not None and info.st_uid != uid) or (gid is not None and info.st_gid != gid):
        raise StageBindingError("stage source directory ownership or mode is invalid")
    return path


def source_tree_sha256(source_root: Path, *, expected_uid: int | None = 0, expected_gid: int | None = 0) -> str:
    """Hash a normalized source tree while rejecting links, special files and umask drift."""
    records: list[list[str]] = []
    try:
        _directory(source_root, "", mode=0o755, uid=expected_uid, gid=expected_gid)
        for current, directories, files in os.walk(source_root, topdown=True, followlinks=False):
            current_path = Path(current)
            directories.sort()
            files.sort()
            for name in directories:
                path = current_path / name
                info = path.lstat()
                if (
                    not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode)
                    or stat.S_IMODE(info.st_mode) != 0o755
                    or (expected_uid is not None and info.st_uid != expected_uid)
                    or (expected_gid is not None and info.st_gid != expected_gid)
                ):
                    raise StageBindingError("stage source tree metadata is invalid")
                records.append(["directory", path.relative_to(source_root).as_posix(), "0755"])
            for name in files:
                path = current_path / name
                info = path.lstat()
                mode = stat.S_IMODE(info.st_mode)
                if (
                    not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode)
                    or mode not in {0o644, 0o755}
                    or (expected_uid is not None and info.st_uid != expected_uid)
                    or (expected_gid is not None and info.st_gid != expected_gid)
                ):
                    raise StageBindingError("stage source tree metadata is invalid")
                records.append(["file", path.relative_to(source_root).as_posix(), f"{mode:04o}", _digest(path)])
    except OSError as exc:
        raise StageBindingError("stage source tree is unavailable") from exc
    payload = json.dumps(records, ensure_ascii=True, separators=(",", ":")).encode("ascii")
    return hashlib.sha256(payload).hexdigest()


def _validate_previous_images(release_dir: Path, *, expected_uid: int | None, expected_gid: int | None) -> None:
    path = _regular(release_dir, "previous-images.json", mode=0o600, uid=expected_uid, gid=expected_gid)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise StageBindingError("stage rollback binding is invalid") from exc
    services = value.get("services") if isinstance(value, dict) and set(value) == {"services"} else None
    if not isinstance(services, dict) or set(services) != SERVICE_NAMES:
        raise StageBindingError("stage rollback binding is invalid")
    for item in services.values():
        if not isinstance(item, dict) or set(item) != {"image"} or not isinstance(item["image"], str) or not IMAGE_ID_RE.fullmatch(item["image"]):
            raise StageBindingError("stage rollback binding is invalid")


def _validate_install_receipt(release_dir: Path, values: dict[str, str], *, expected_uid: int | None, expected_gid: int | None) -> bool:
    path = release_dir / "install-receipt"
    try:
        path.lstat()
    except FileNotFoundError:
        return False
    receipt = _regular(release_dir, "install-receipt", mode=0o600, uid=expected_uid, gid=expected_gid)
    try:
        lines = receipt.read_text(encoding="ascii").splitlines()
        observed: dict[str, str] = {}
        for line in lines:
            key, separator, value = line.partition("=")
            if not separator or not key or key in observed:
                raise StageBindingError("stage install receipt is invalid")
            observed[key] = value
    except (OSError, UnicodeError) as exc:
        raise StageBindingError("stage install receipt is invalid") from exc
    expected = {
        "status": "installed",
        "commit": values["product_commit"],
        "runtime_image": values["runtime_image"],
        "web_image": values["web_image"],
        "operations_commit": values["operations_commit"],
        "manifest_sha256": values["manifest_sha256"],
    }
    if (
        set(observed) != set(expected) | {"installed_at"}
        or any(observed.get(key) != value for key, value in expected.items())
        or re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", observed.get("installed_at", "")) is None
    ):
        raise StageBindingError("stage install receipt binding mismatch")
    try:
        datetime.strptime(observed["installed_at"], "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise StageBindingError("stage install receipt timestamp is invalid") from exc
    return True


def _verify_release_layout(
    release_dir: Path,
    *,
    expected_uid: int | None,
    expected_gid: int | None,
    require_stage_receipt: bool,
) -> None:
    _directory(release_dir, "", mode=0o755, uid=expected_uid, gid=expected_gid)
    names = {entry.name for entry in release_dir.iterdir()}
    required = RELEASE_FILES | {"source"}
    optional = {"stage-receipt", "previous-images.json", "install-receipt"}
    if not required.issubset(names) or names - required - optional:
        raise StageBindingError("stage release layout is invalid")
    if require_stage_receipt and "stage-receipt" not in names:
        raise StageBindingError("stage receipt is missing")
    if "stage-receipt" in names:
        _regular(release_dir, "stage-receipt", mode=0o600, uid=expected_uid, gid=expected_gid)
    if "previous-images.json" in names:
        _validate_previous_images(release_dir, expected_uid=expected_uid, expected_gid=expected_gid)
    if "install-receipt" in names and "previous-images.json" not in names:
        raise StageBindingError("installed release state is incomplete")
    if "install-receipt" in names:
        _regular(release_dir, "install-receipt", mode=0o600, uid=expected_uid, gid=expected_gid)


def inspect_existing_release(
    release_dir: Path,
    *,
    manifest_sha256: str,
    product_commit: str,
    operations_commit: str,
    runtime_image: str,
    web_image: str,
    stage_binding_sha256: str,
    require_production_release_root: bool = True,
    expected_uid: int | None = 0,
    expected_gid: int | None = 0,
) -> str:
    """Classify an existing release without changing it or accepting ambiguous state."""
    try:
        release_dir.lstat()
    except FileNotFoundError:
        parent = release_dir.parent
        try:
            parent.lstat()
        except FileNotFoundError:
            return "absent"
        _directory(parent, "", mode=0o755, uid=expected_uid, gid=expected_gid)
        return "absent"
    values = stage_values(
        release_dir,
        manifest_sha256=manifest_sha256,
        product_commit=product_commit,
        operations_commit=operations_commit,
        runtime_image=runtime_image,
        web_image=web_image,
        stage_binding_sha256=stage_binding_sha256,
        require_production_release_root=require_production_release_root,
        expected_uid=expected_uid,
        expected_gid=expected_gid,
    )
    _verify_release_layout(
        release_dir, expected_uid=expected_uid, expected_gid=expected_gid, require_stage_receipt=True
    )
    verify_receipt(release_dir, values, expected_uid=expected_uid, expected_gid=expected_gid)
    installed = _validate_install_receipt(
        release_dir, values, expected_uid=expected_uid, expected_gid=expected_gid
    )
    if installed:
        return "installed"
    if (release_dir / "previous-images.json").exists():
        raise StageBindingError("release has incomplete apply state")
    return "reusable"


def _source_file_digests(
    source_root: Path,
    *,
    expected_uid: int | None,
    expected_gid: int | None,
) -> dict[str, str]:
    _directory(source_root, "", mode=0o755, uid=expected_uid, gid=expected_gid)
    _directory(source_root, "platform-infra", mode=0o755, uid=expected_uid, gid=expected_gid)
    return {
        relative: _digest(_regular(source_root, relative, mode=0o644, uid=expected_uid, gid=expected_gid))
        for relative in SOURCE_COMPOSE_FILES
    }


def _validated_source_manifest(manifest: Any) -> dict[str, str]:
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 3 or set(manifest) != MANIFEST_KEYS:
        raise StageBindingError("stage manifest source binding is invalid")
    source_files = manifest.get("sourceFiles")
    if not isinstance(source_files, dict) or set(source_files) != set(SOURCE_COMPOSE_FILES):
        raise StageBindingError("stage manifest source binding is invalid")
    if any(not isinstance(value, str) or not SHA256_RE.fullmatch(value) for value in source_files.values()):
        raise StageBindingError("stage manifest source binding is invalid")
    return source_files


def verify_local_source_root(source_root: Path, manifest_path: Path, manifest_sha256: str) -> None:
    try:
        if not SHA256_RE.fullmatch(manifest_sha256):
            raise StageBindingError("target source-root binding is invalid")
        manifest_info = manifest_path.lstat()
        if not stat.S_ISREG(manifest_info.st_mode) or stat.S_ISLNK(manifest_info.st_mode):
            raise StageBindingError("target source-root binding is invalid")
        if _digest(manifest_path) != manifest_sha256:
            raise StageBindingError("target source-root binding is invalid")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected = _validated_source_manifest(manifest)
        observed = _source_file_digests(source_root, expected_uid=None, expected_gid=None)
        if observed != expected:
            raise StageBindingError("target source-root binding is invalid")
        expected_tree = manifest.get("sourceTreeSha256")
        if not isinstance(expected_tree, str) or source_tree_sha256(source_root, expected_uid=None, expected_gid=None) != expected_tree:
            raise StageBindingError("target source-root binding is invalid")
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, AttributeError, ValueError, StageBindingError):
        raise StageBindingError("target source-root binding is invalid") from None


def stage_values(
    release_dir: Path,
    *,
    manifest_sha256: str,
    product_commit: str,
    operations_commit: str,
    runtime_image: str,
    web_image: str,
    stage_binding_sha256: str,
    require_production_release_root: bool = True,
    expected_uid: int | None = 0,
    expected_gid: int | None = 0,
) -> dict[str, str]:
    release = str(release_dir)
    if require_production_release_root and not re.fullmatch(r"/opt/catering-releases/[0-9a-f]{40}", release):
        raise StageBindingError("stage release path is invalid")
    if Path(release).name != product_commit or not COMMIT_RE.fullmatch(product_commit) or not COMMIT_RE.fullmatch(operations_commit):
        raise StageBindingError("stage commit binding is invalid")
    if not SHA256_RE.fullmatch(manifest_sha256) or not SHA256_RE.fullmatch(stage_binding_sha256):
        raise StageBindingError("stage digest binding is invalid")
    if not IMAGE_ID_RE.fullmatch(runtime_image) or not IMAGE_ID_RE.fullmatch(web_image):
        raise StageBindingError("stage image binding is invalid")

    _verify_release_layout(
        release_dir, expected_uid=expected_uid, expected_gid=expected_gid, require_stage_receipt=False
    )
    if require_production_release_root:
        _directory(release_dir.parent, "", mode=0o755, uid=expected_uid, gid=expected_gid)
    source_root = _directory(release_dir, "source", mode=0o755, uid=expected_uid, gid=expected_gid)
    _directory(source_root, "platform-infra", mode=0o755, uid=expected_uid, gid=expected_gid)
    manifest_path = _regular(release_dir, "manifest.json", mode=0o644, uid=expected_uid, gid=expected_gid)
    candidate_path = _regular(release_dir, "candidate-images.json", mode=0o644, uid=expected_uid, gid=expected_gid)
    runtime_path = _regular(release_dir, "runtime-image.tar.gz", mode=0o644, uid=expected_uid, gid=expected_gid)
    web_path = _regular(release_dir, "web-image.tar.gz", mode=0o644, uid=expected_uid, gid=expected_gid)
    binding_path = _regular(release_dir, "stage-binding.py", mode=0o644, uid=expected_uid, gid=expected_gid)
    if _digest(binding_path) != stage_binding_sha256:
        raise StageBindingError("stage binding tool digest mismatch")
    if _digest(manifest_path) != manifest_sha256:
        raise StageBindingError("stage manifest digest mismatch")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_bindings = _validated_source_manifest(manifest)
    observed_source = _source_file_digests(source_root, expected_uid=expected_uid, expected_gid=expected_gid)
    if observed_source != source_bindings:
        raise StageBindingError("stage source artifact digest mismatch")
    tree_sha256 = manifest.get("sourceTreeSha256")
    if not isinstance(tree_sha256, str) or not SHA256_RE.fullmatch(tree_sha256):
        raise StageBindingError("stage source tree binding is invalid")
    if source_tree_sha256(source_root, expected_uid=expected_uid, expected_gid=expected_gid) != tree_sha256:
        raise StageBindingError("stage source tree digest mismatch")
    if (
        manifest.get("schemaVersion") != 3
        or manifest.get("repository") != "AlexanderSmyslowski/catering-agents-platform"
        or manifest.get("targetId") != "catering-prod-1"
        or manifest.get("platform") != "linux/amd64"
        or manifest.get("productCommit") != product_commit
        or manifest.get("operationsCommit") != operations_commit
    ):
        raise StageBindingError("stage manifest commit binding mismatch")
    if manifest.get("images") != {
        "runtime": {"imageId": runtime_image, "archive": "runtime-image.tar.gz", "services": ["intake", "offer", "production", "exports"]},
        "web": {"imageId": web_image, "archive": "web-image.tar.gz", "services": ["web"]},
    }:
        raise StageBindingError("stage manifest image binding mismatch")
    digests = {
        "candidate-images.json": _digest(candidate_path),
        "runtime-image.tar.gz": _digest(runtime_path),
        "web-image.tar.gz": _digest(web_path),
    }
    if manifest.get("artifacts") != digests:
        raise StageBindingError("stage artifact digest mismatch")
    expected_candidate = {"services": {
        "intake": {"image": runtime_image}, "offer": {"image": runtime_image},
        "production": {"image": runtime_image}, "exports": {"image": runtime_image},
        "web": {"image": web_image},
    }}
    if json.loads(candidate_path.read_text(encoding="utf-8")) != expected_candidate:
        raise StageBindingError("stage candidate image binding mismatch")
    values = {
        "schema_version": "2",
        "product_commit": product_commit,
        "operations_commit": operations_commit,
        "manifest_sha256": manifest_sha256,
        "candidate_images_sha256": digests["candidate-images.json"],
        "runtime_archive_sha256": digests["runtime-image.tar.gz"],
        "web_archive_sha256": digests["web-image.tar.gz"],
        "runtime_image": runtime_image,
        "web_image": web_image,
        "source_tree_sha256": tree_sha256,
        "stage_binding_sha256": stage_binding_sha256,
        **{
            SOURCE_COMPOSE_FILES[relative]: source_bindings[relative]
            for relative in SOURCE_COMPOSE_FILES
        },
    }
    if (release_dir / "install-receipt").exists():
        _validate_install_receipt(release_dir, values, expected_uid=expected_uid, expected_gid=expected_gid)
    return values


def write_receipt(release_dir: Path, values: dict[str, str], *, expected_uid: int | None = 0, expected_gid: int | None = 0) -> None:
    receipt = release_dir / "stage-receipt"
    if receipt.exists() or receipt.is_symlink():
        raise StageBindingError("stage receipt already exists")
    fd, temporary = tempfile.mkstemp(prefix=".stage-receipt.", dir=release_dir)
    try:
        with os.fdopen(fd, "w", encoding="ascii") as handle:
            for key, value in values.items():
                handle.write(f"{key}={value}\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, receipt)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    _regular(release_dir, "stage-receipt", mode=0o600, uid=expected_uid, gid=expected_gid)


def verify_receipt(release_dir: Path, expected: dict[str, str], *, expected_uid: int | None = 0, expected_gid: int | None = 0) -> None:
    receipt = _regular(release_dir, "stage-receipt", mode=0o600, uid=expected_uid, gid=expected_gid)
    lines = receipt.read_text(encoding="ascii").splitlines()
    observed: dict[str, str] = {}
    for line in lines:
        if "=" not in line:
            raise StageBindingError("stage receipt format is invalid")
        key, value = line.split("=", 1)
        if key in observed:
            raise StageBindingError("stage receipt format is invalid")
        observed[key] = value
    if observed != expected or len(lines) != len(expected):
        raise StageBindingError("stage receipt binding mismatch")


def _main() -> int:
    parser = argparse.ArgumentParser()
    actions = parser.add_subparsers(dest="action", required=True)
    for action in ("write", "verify", "inspect-existing"):
        receipt = actions.add_parser(action)
        receipt.add_argument("release_dir", type=Path)
        receipt.add_argument("manifest_sha256")
        receipt.add_argument("product_commit")
        receipt.add_argument("operations_commit")
        receipt.add_argument("runtime_image")
        receipt.add_argument("web_image")
        receipt.add_argument("stage_binding_sha256")
    source_check = actions.add_parser("verify-source")
    source_check.add_argument("source_root", type=Path)
    source_check.add_argument("manifest_path", type=Path)
    source_check.add_argument("manifest_sha256")
    args = parser.parse_args()
    try:
        if args.action == "verify-source":
            verify_local_source_root(args.source_root, args.manifest_path, args.manifest_sha256)
            return 0
        if args.action == "inspect-existing":
            print(inspect_existing_release(
                args.release_dir,
                manifest_sha256=args.manifest_sha256,
                product_commit=args.product_commit,
                operations_commit=args.operations_commit,
                runtime_image=args.runtime_image,
                web_image=args.web_image,
                stage_binding_sha256=args.stage_binding_sha256,
            ))
            return 0
        values = stage_values(
            args.release_dir,
            manifest_sha256=args.manifest_sha256,
            product_commit=args.product_commit,
            operations_commit=args.operations_commit,
            runtime_image=args.runtime_image,
            web_image=args.web_image,
            stage_binding_sha256=args.stage_binding_sha256,
        )
        if args.action == "write":
            write_receipt(args.release_dir, values)
        elif args.action == "verify":
            verify_receipt(args.release_dir, values)
    except (OSError, UnicodeError, json.JSONDecodeError, StageBindingError, TypeError, AttributeError, KeyError, ValueError):
        message = "target source-root binding is invalid" if args.action == "verify-source" else "stage receipt or artifact binding is invalid"
        print(message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
