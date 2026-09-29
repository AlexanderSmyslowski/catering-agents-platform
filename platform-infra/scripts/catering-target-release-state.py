#!/usr/bin/env python3
"""Validate the installed or candidate application release used by the operator."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path, PurePosixPath


REPOSITORY = "AlexanderSmyslowski/catering-agents-platform"
TARGET_ID = "catering-prod-1"
DISCOVER_INSTALLED = "__CATERING_DISCOVER_INSTALLED__"
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
IMAGE_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
SERVICES = {
    "runtime": ("intake", "offer", "production", "exports"),
    "web": ("web",),
}
ARCHIVES = {"runtime": "runtime-image.tar.gz", "web": "web-image.tar.gz"}
ARTIFACTS = {"candidate-images.json", "runtime-image.tar.gz", "web-image.tar.gz"}
SOURCE_COMPOSE_FILES = {
    "platform-infra/docker-compose.catering-target.json",
    "platform-infra/docker-compose.catering-target.operations.json",
}
LEGACY_MANIFEST_KEYS = {
    "schemaVersion",
    "repository",
    "targetId",
    "platform",
    "productCommit",
    "operationsCommit",
    "images",
    "artifacts",
}
CURRENT_MANIFEST_V2_KEYS = LEGACY_MANIFEST_KEYS | {"sourceFiles"}
CURRENT_MANIFEST_V3_KEYS = CURRENT_MANIFEST_V2_KEYS | {"sourceTreeSha256"}


class ReleaseBindingError(Exception):
    """A safe release-state verification failure."""


def _require(condition: bool) -> None:
    if not condition:
        raise ReleaseBindingError("release state is not bound to the expected commit and artifacts")


def _directory(path: Path) -> Path:
    try:
        info = path.lstat()
        _require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode))
        _require(path.resolve(strict=True) == path)
    except (OSError, RuntimeError) as exc:
        raise ReleaseBindingError("release directory is missing or unsafe") from exc
    return path


def _regular_file(path: Path, mode: int | None, expected_uid: int, expected_gid: int) -> Path:
    try:
        info = path.lstat()
        _require(stat.S_ISREG(info.st_mode) and not stat.S_ISLNK(info.st_mode))
        _require(info.st_uid == expected_uid and info.st_gid == expected_gid)
        if mode is not None:
            _require(stat.S_IMODE(info.st_mode) == mode)
    except (OSError, RuntimeError) as exc:
        raise ReleaseBindingError("release artifact is missing or unsafe") from exc
    return path


def _digest(path: Path) -> str:
    value = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                value.update(chunk)
    except OSError as exc:
        raise ReleaseBindingError("release artifact could not be read") from exc
    return value.hexdigest()


def _source_tree_sha256(source_root: Path, expected_uid: int, expected_gid: int) -> str:
    records: list[list[str]] = []
    root_info = source_root.lstat()
    _require(
        stat.S_ISDIR(root_info.st_mode)
        and not stat.S_ISLNK(root_info.st_mode)
        and stat.S_IMODE(root_info.st_mode) == 0o755
        and root_info.st_uid == expected_uid
        and root_info.st_gid == expected_gid
    )
    for current, directories, files in os.walk(source_root, topdown=True, followlinks=False):
        current_path = Path(current)
        directories.sort()
        files.sort()
        for name in directories:
            path = current_path / name
            info = path.lstat()
            _require(
                stat.S_ISDIR(info.st_mode)
                and not stat.S_ISLNK(info.st_mode)
                and stat.S_IMODE(info.st_mode) == 0o755
                and info.st_uid == expected_uid
                and info.st_gid == expected_gid
            )
            records.append(["directory", path.relative_to(source_root).as_posix(), "0755"])
        for name in files:
            path = current_path / name
            info = path.lstat()
            mode = stat.S_IMODE(info.st_mode)
            _require(
                stat.S_ISREG(info.st_mode)
                and not stat.S_ISLNK(info.st_mode)
                and mode in {0o644, 0o755}
                and info.st_uid == expected_uid
                and info.st_gid == expected_gid
            )
            records.append(["file", path.relative_to(source_root).as_posix(), f"{mode:04o}", _digest(path)])
    return hashlib.sha256(json.dumps(records, ensure_ascii=True, separators=(",", ":")).encode("ascii")).hexdigest()


def _image_ids(candidate_path: Path, expected_uid: int, expected_gid: int) -> tuple[str, str]:
    candidate = _regular_file(candidate_path, 0o644, expected_uid, expected_gid)
    try:
        value = json.loads(candidate.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ReleaseBindingError("candidate image override is invalid") from exc
    _require(isinstance(value, dict) and set(value) == {"services"})
    services = value.get("services")
    expected_names = {"intake", "offer", "production", "exports", "web"}
    _require(isinstance(services, dict) and set(services) == expected_names)
    for name, item in services.items():
        _require(isinstance(item, dict) and set(item) == {"image"})
        _require(isinstance(item["image"], str) and IMAGE_RE.fullmatch(item["image"]) is not None)
    runtime_ids = {services[name]["image"] for name in SERVICES["runtime"]}
    _require(len(runtime_ids) == 1)
    return next(iter(runtime_ids)), services["web"]["image"]


def _verify_manifest(
    release: Path,
    manifest_sha256: str,
    product_commit: str,
    operations_commit: str,
    runtime_image: str,
    web_image: str,
    expected_uid: int,
    expected_gid: int,
    *,
    allow_legacy_schema: bool = False,
) -> None:
    _require(SHA256_RE.fullmatch(manifest_sha256) is not None)
    manifest_path = _regular_file(release / "manifest.json", 0o644, expected_uid, expected_gid)
    _require(_digest(manifest_path) == manifest_sha256)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ReleaseBindingError("release manifest is invalid") from exc
    _require(isinstance(manifest, dict))
    schema_version = manifest.get("schemaVersion")
    if type(schema_version) is int and schema_version == 1:
        # Schema 1 is retained only so an existing installed release can be verified or rolled back.
        _require(allow_legacy_schema and set(manifest) == LEGACY_MANIFEST_KEYS)
    elif type(schema_version) is int and schema_version == 2:
        _require(set(manifest) == CURRENT_MANIFEST_V2_KEYS)
        source_files = manifest.get("sourceFiles")
        _require(
            isinstance(source_files, dict)
            and set(source_files) == SOURCE_COMPOSE_FILES
            and all(isinstance(value, str) and SHA256_RE.fullmatch(value) is not None for value in source_files.values())
        )
        source = _directory(release / "source")
        _directory(source / "platform-infra")
        for relative, expected_sha256 in source_files.items():
            source_path = _regular_file(source / relative, 0o644, expected_uid, expected_gid)
            _require(_digest(source_path) == expected_sha256)
    elif type(schema_version) is int and schema_version == 3:
        _require(set(manifest) == CURRENT_MANIFEST_V3_KEYS)
        source_files = manifest.get("sourceFiles")
        _require(
            isinstance(source_files, dict)
            and set(source_files) == SOURCE_COMPOSE_FILES
            and all(isinstance(value, str) and SHA256_RE.fullmatch(value) is not None for value in source_files.values())
        )
        source = _directory(release / "source")
        _directory(source / "platform-infra")
        for relative, expected_sha256 in source_files.items():
            source_path = _regular_file(source / relative, 0o644, expected_uid, expected_gid)
            _require(_digest(source_path) == expected_sha256)
        tree_sha256 = manifest.get("sourceTreeSha256")
        _require(
            isinstance(tree_sha256, str)
            and SHA256_RE.fullmatch(tree_sha256) is not None
            and _source_tree_sha256(source, expected_uid, expected_gid) == tree_sha256
        )
    else:
        raise ReleaseBindingError("release state is not bound to the expected commit and artifacts")
    _require(
        manifest["repository"] == REPOSITORY
        and manifest["targetId"] == TARGET_ID
        and manifest["platform"] == "linux/amd64"
        and manifest["productCommit"] == product_commit
        and manifest["operationsCommit"] == operations_commit
    )
    expected_images = {
        "runtime": {
            "imageId": runtime_image,
            "archive": ARCHIVES["runtime"],
            "services": list(SERVICES["runtime"]),
        },
        "web": {
            "imageId": web_image,
            "archive": ARCHIVES["web"],
            "services": list(SERVICES["web"]),
        },
    }
    _require(manifest["images"] == expected_images)
    artifacts = manifest["artifacts"]
    _require(isinstance(artifacts, dict) and set(artifacts) == ARTIFACTS)
    for name in ARTIFACTS:
        path = _regular_file(release / name, 0o644, expected_uid, expected_gid)
        _require(isinstance(artifacts[name], str) and SHA256_RE.fullmatch(artifacts[name]) is not None)
        _require(_digest(path) == artifacts[name])


def _installed_receipt(
    release_root: Path,
    release: Path,
    commit: str,
    runtime_image: str,
    web_image: str,
    expected_uid: int,
    expected_gid: int,
) -> None:
    marker = _regular_file(release_root / "installed", 0o644, expected_uid, expected_gid)
    try:
        _require(marker.read_text(encoding="ascii").strip() == commit)
    except (OSError, UnicodeError) as exc:
        raise ReleaseBindingError("installed release marker is invalid") from exc
    receipt = _regular_file(release / "install-receipt", 0o600, expected_uid, expected_gid)
    try:
        lines = receipt.read_text(encoding="ascii").splitlines()
    except (OSError, UnicodeError) as exc:
        raise ReleaseBindingError("installed release receipt is invalid") from exc
    values: dict[str, str] = {}
    for line in lines:
        key, separator, value = line.partition("=")
        _require(bool(separator) and bool(key) and key not in values)
        values[key] = value
    required = {"status", "commit", "runtime_image", "web_image", "installed_at"}
    optional = {"operations_commit", "manifest_sha256"}
    _require(required.issubset(values) and not (set(values) - required - optional))
    _require((set(values) & optional) in (set(), optional))
    _require(
        values["status"] == "installed"
        and values["commit"] == commit
        and values["runtime_image"] == runtime_image
        and values["web_image"] == web_image
        and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", values["installed_at"]) is not None
    )
    if optional.issubset(values):
        _require(COMMIT_RE.fullmatch(values["operations_commit"]) is not None)
        _verify_manifest(
            release,
            values["manifest_sha256"],
            commit,
            values["operations_commit"],
            runtime_image,
            web_image,
            expected_uid,
            expected_gid,
            allow_legacy_schema=True,
        )


def inspect_release_binding(
    release_root_arg: Path,
    requested_release: str,
    source_base: str,
    source_ops: str,
    source_base_sha256: str,
    source_ops_sha256: str,
    bound_product_commit: str,
    bound_operations_commit: str,
    bound_manifest_sha256: str,
    *,
    expected_uid: int = 0,
    expected_gid: int = 0,
) -> dict[str, str]:
    release_root = release_root_arg.absolute()
    _directory(release_root)
    _require(COMMIT_RE.fullmatch(bound_product_commit) is not None)
    _require(COMMIT_RE.fullmatch(bound_operations_commit) is not None)
    _require(SHA256_RE.fullmatch(source_base_sha256) is not None)
    _require(SHA256_RE.fullmatch(source_ops_sha256) is not None)
    _require(source_base.startswith("platform-infra/") and ".." not in PurePosixPath(source_base).parts)
    _require(source_ops.startswith("platform-infra/") and ".." not in PurePosixPath(source_ops).parts)

    if requested_release == DISCOVER_INSTALLED:
        marker = _regular_file(release_root / "installed", 0o644, expected_uid, expected_gid)
        try:
            commit = marker.read_text(encoding="ascii").strip()
        except (OSError, UnicodeError) as exc:
            raise ReleaseBindingError("installed release marker is invalid") from exc
        state = "installed"
    elif COMMIT_RE.fullmatch(requested_release):
        commit = requested_release
        state = "candidate" if commit == bound_product_commit else "installed"
    else:
        raise ReleaseBindingError("requested release binding is invalid")
    _require(COMMIT_RE.fullmatch(commit) is not None)

    release = _directory(release_root / commit)
    source = _directory(release / "source")
    _directory(source / "platform-infra")
    base_path = _regular_file(source / source_base, None, expected_uid, expected_gid)
    ops_path = _regular_file(source / source_ops, None, expected_uid, expected_gid)
    _require(_digest(base_path) == source_base_sha256 and _digest(ops_path) == source_ops_sha256)

    runtime_image, web_image = _image_ids(release / "candidate-images.json", expected_uid, expected_gid)
    if state == "candidate":
        _require(commit == bound_product_commit)
        _verify_manifest(
            release,
            bound_manifest_sha256,
            commit,
            bound_operations_commit,
            runtime_image,
            web_image,
            expected_uid,
            expected_gid,
        )
    else:
        _installed_receipt(
            release_root,
            release,
            commit,
            runtime_image,
            web_image,
            expected_uid,
            expected_gid,
        )

    return {"commit": commit, "runtime_image": runtime_image, "web_image": web_image}


def inspect_rollback_binding(
    release_root_arg: Path,
    previous_release: str,
    source_base: str,
    source_ops: str,
    candidate_product_commit: str,
    operations_commit: str,
    *,
    expected_uid: int = 0,
    expected_gid: int = 0,
) -> dict[str, str]:
    _require(COMMIT_RE.fullmatch(previous_release) is not None)
    _require(COMMIT_RE.fullmatch(candidate_product_commit) is not None)
    _require(previous_release != candidate_product_commit)
    _require(source_base.startswith("platform-infra/") and ".." not in PurePosixPath(source_base).parts)
    _require(source_ops.startswith("platform-infra/") and ".." not in PurePosixPath(source_ops).parts)
    release_root = release_root_arg.absolute()
    release = _directory(release_root / previous_release)
    source = _directory(release / "source")
    base_path = _regular_file(source / source_base, None, expected_uid, expected_gid)
    ops_path = _regular_file(source / source_ops, None, expected_uid, expected_gid)
    return inspect_release_binding(
        release_root,
        previous_release,
        source_base,
        source_ops,
        _digest(base_path),
        _digest(ops_path),
        candidate_product_commit,
        operations_commit,
        "0" * 64,
        expected_uid=expected_uid,
        expected_gid=expected_gid,
    )


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if len(arguments) == 7 and arguments[0] == "/opt/catering-releases" and arguments[1] == "--rollback":
        try:
            binding = inspect_rollback_binding(
                Path(arguments[0]),
                *arguments[2:],
                expected_uid=0,
                expected_gid=0,
            )
        except (ReleaseBindingError, OSError, ValueError, TypeError, json.JSONDecodeError):
            print("operator rollback binding failed", file=sys.stderr)
            return 1
        print(f"{binding['commit']}\t{binding['runtime_image']}\t{binding['web_image']}")
        return 0
    if len(arguments) != 9 or arguments[0] != "/opt/catering-releases":
        print("operator release binding failed", file=sys.stderr)
        return 1
    try:
        binding = inspect_release_binding(
            Path(arguments[0]),
            *arguments[1:],
            expected_uid=0,
            expected_gid=0,
        )
    except (ReleaseBindingError, OSError, ValueError, TypeError, json.JSONDecodeError):
        print("operator release binding failed", file=sys.stderr)
        return 1
    print(f"{binding['commit']}\t{binding['runtime_image']}\t{binding['web_image']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
