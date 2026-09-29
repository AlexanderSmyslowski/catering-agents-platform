#!/usr/bin/env python3
"""Versioned Mac operator for bound CateringOS product and operations commits."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Sequence


REPOSITORY = "AlexanderSmyslowski/catering-agents-platform"
TARGET_ID = "catering-prod-1"
CI_WORKFLOW = "ci.yml"
APPLICATION_SERVICES = ("intake", "offer", "production", "exports", "web")
SOURCE_COMPOSE_FILES = (
    "platform-infra/docker-compose.catering-target.json",
    "platform-infra/docker-compose.catering-target.operations.json",
)
IMAGE_ID_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class OperatorError(Exception):
    """A safe, non-sensitive operator failure suitable for terminal output."""


def repository_root() -> Path:
    return Path(__file__).resolve().parents[2]


def require_macos() -> None:
    if sys.platform != "darwin":
        raise OperatorError("the versioned Catering target operator is restricted to macOS")


def _safe_run(
    command: Sequence[str],
    *,
    cwd: Path | None = None,
    binary: bool = False,
    timeout: float = 30,
    runner: Callable[..., Any] = subprocess.run,
) -> Any:
    try:
        result = runner(
            list(command),
            cwd=str(cwd) if cwd is not None else None,
            capture_output=True,
            text=not binary,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise OperatorError("required local or GitHub read timed out") from exc
    except OSError as exc:
        raise OperatorError("required local command is unavailable") from exc
    if result.returncode != 0:
        raise OperatorError("required local or GitHub read failed")
    return result


def _git(root: Path, *args: str) -> str:
    result = _safe_run(["git", "-C", str(root), *args], cwd=root)
    return result.stdout.strip()


def normalize_repository_url(value: str) -> str | None:
    remote = value.strip()
    patterns = (
        r"^git@github\.com:(.+)$",
        r"^ssh://git@github\.com/(.+)$",
        r"^https://github\.com/(.+)$",
    )
    for pattern in patterns:
        match = re.fullmatch(pattern, remote, flags=re.IGNORECASE)
        if match:
            slug = match.group(1).removesuffix(".git").strip("/").lower()
            return slug
    return None


def _validate_checkout(root_arg: Path, expected_commit: str, label: str) -> Path:
    if not COMMIT_RE.fullmatch(expected_commit):
        raise OperatorError(f"{label} commit must be a full lowercase 40-character SHA")
    if root_arg.is_symlink() or not root_arg.is_dir():
        raise OperatorError(f"{label} checkout must be a real directory")
    root = root_arg.resolve(strict=True)
    try:
        reported_root = Path(_git(root, "rev-parse", "--show-toplevel")).resolve(strict=True)
        head = _git(root, "rev-parse", "HEAD")
        status = _git(root, "status", "--porcelain", "--untracked-files=all")
        symbolic = subprocess.run(
            ["git", "-C", str(root), "symbolic-ref", "-q", "HEAD"],
            cwd=str(root),
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
        if symbolic.returncode not in (0, 1):
            raise OperatorError(f"{label} checkout state could not be verified")
        detached = symbolic.returncode == 1
        origin = _git(root, "remote", "get-url", "origin")
    except (OperatorError, OSError, subprocess.TimeoutExpired):
        raise OperatorError(f"{label} checkout could not be verified") from None
    if reported_root != root:
        raise OperatorError(f"{label} path is not the checkout root")
    if normalize_repository_url(origin) != REPOSITORY.lower():
        raise OperatorError(f"{label} checkout origin is not the authorized repository")
    if head != expected_commit:
        raise OperatorError(f"{label} checkout HEAD does not match the bound commit")
    if status:
        raise OperatorError(f"{label} checkout must be clean, including untracked files")
    if not detached:
        raise OperatorError(f"{label} checkout must be detached at the bound commit")
    return root


def check_commit_acceptance(
    label: str,
    commit: str,
    *,
    is_in_main: bool,
    runs: Sequence[dict[str, Any]],
) -> None:
    if label not in {"product", "operations"}:
        raise OperatorError("unknown commit binding")
    if not COMMIT_RE.fullmatch(commit):
        raise OperatorError(f"{label} commit must be a full lowercase 40-character SHA")
    if not is_in_main:
        raise OperatorError(f"{label} commit is not in origin/main history")
    if not any(
        item.get("event") == "push"
        and item.get("head_branch") == "main"
        and item.get("head_sha") == commit
        and item.get("status") == "completed"
        and item.get("conclusion") == "success"
        for item in runs
    ):
        raise OperatorError(f"{label} commit lacks successful exact main push CI")


def _workflow_runs(commit: str) -> list[dict[str, str]]:
    query = ".workflow_runs[] | [.event, .head_branch, .head_sha, .status, .conclusion] | @tsv"
    command = [
        "gh",
        "api",
        "--method",
        "GET",
        "--paginate",
        f"repos/{REPOSITORY}/actions/workflows/{CI_WORKFLOW}/runs",
        "-f",
        f"head_sha={commit}",
        "-f",
        "event=push",
        "-f",
        "branch=main",
        "-F",
        "per_page=100",
        "--jq",
        query,
    ]
    result = _safe_run(command, timeout=30)
    rows: list[dict[str, str]] = []
    for line in result.stdout.splitlines():
        fields = line.split("\t")
        if len(fields) == 5:
            rows.append(dict(zip(("event", "head_branch", "head_sha", "status", "conclusion"), fields)))
    return rows


def _is_ancestor(root: Path, commit: str) -> bool:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"],
            cwd=str(root),
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except subprocess.TimeoutExpired as exc:
        raise OperatorError("origin/main ancestry check timed out") from exc
    if result.returncode not in (0, 1):
        raise OperatorError("origin/main ancestry could not be verified")
    return result.returncode == 0


def verify_commit_gates(
    operations_root: Path,
    operations_commit: str,
    product_root: Path,
    product_commit: str,
) -> tuple[Path, Path]:
    operations = _validate_checkout(operations_root, operations_commit, "operations")
    product = _validate_checkout(product_root, product_commit, "product")
    if operations == product:
        raise OperatorError("product and operations checkouts must be separate")
    try:
        _safe_run(
            ["git", "-C", str(operations), "fetch", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"],
            cwd=operations,
            timeout=30,
        )
        product_in_main = _is_ancestor(operations, product_commit)
        operations_in_main = _is_ancestor(operations, operations_commit)
    except OperatorError:
        raise OperatorError("origin/main history could not be refreshed and verified") from None
    product_runs = _workflow_runs(product_commit)
    operations_runs = _workflow_runs(operations_commit)
    check_commit_acceptance("product", product_commit, is_in_main=product_in_main, runs=product_runs)
    check_commit_acceptance("operations", operations_commit, is_in_main=operations_in_main, runs=operations_runs)
    return operations, product


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as exc:
        raise OperatorError("bundle artifact is unavailable or unreadable") from exc
    return digest.hexdigest()


def _source_compose_digests(source_root: Path) -> dict[str, str]:
    if source_root.is_symlink() or not source_root.is_dir():
        raise OperatorError("bound product source is not a real directory")
    return {relative: _file_sha256(_regular_file(source_root, relative)) for relative in SOURCE_COMPOSE_FILES}


def _source_tree_digest(source_root: Path) -> str:
    records: list[list[str]] = []
    if source_root.is_symlink() or not source_root.is_dir():
        raise OperatorError("product source tree is not a real directory")
    try:
        if source_root.stat().st_mode & 0o777 != 0o755:
            raise OperatorError("product source tree permissions are not normalized")
        for current, directories, files in os.walk(source_root, topdown=True, followlinks=False):
            current_path = Path(current)
            directories.sort()
            files.sort()
            for name in directories:
                path = current_path / name
                info = path.lstat()
                if path.is_symlink() or not path.is_dir() or info.st_mode & 0o777 != 0o755:
                    raise OperatorError("product source tree permissions are not normalized")
                records.append(["directory", path.relative_to(source_root).as_posix(), "0755"])
            for name in files:
                path = current_path / name
                info = path.lstat()
                mode = info.st_mode & 0o777
                if path.is_symlink() or not path.is_file() or mode not in {0o644, 0o755}:
                    raise OperatorError("product source tree permissions are not normalized")
                records.append(["file", path.relative_to(source_root).as_posix(), f"{mode:04o}", _file_sha256(path)])
    except OSError as exc:
        raise OperatorError("product source tree is unavailable") from exc
    payload = json.dumps(records, ensure_ascii=True, separators=(",", ":")).encode("ascii")
    return hashlib.sha256(payload).hexdigest()


def _bound_product_source_tree_digest(source_root: Path, product_commit: str) -> str:
    git_metadata = source_root / ".git"
    if git_metadata.exists():
        with tempfile.TemporaryDirectory(prefix="catering-target-source-check-") as temporary:
            export = Path(temporary) / "source"
            export_product_context(source_root, product_commit, export)
            return _source_tree_digest(export)
    return _source_tree_digest(source_root)


def _regular_file(root: Path, name: str) -> Path:
    relative = PurePosixPath(name)
    if relative.is_absolute() or not relative.parts or any(part in {".", ".."} for part in relative.parts):
        raise OperatorError("bundle contains an invalid artifact path")
    path = root.joinpath(*relative.parts)
    if path.is_symlink() or not path.is_file():
        raise OperatorError("bundle artifact is missing or not a regular file")
    try:
        path.resolve(strict=True).relative_to(root.resolve(strict=True))
    except (OSError, ValueError) as exc:
        raise OperatorError("bundle artifact escapes its bundle directory") from exc
    return path


def _verify_docker_archive(path: Path, expected_image_id: str) -> None:
    if not IMAGE_ID_RE.fullmatch(expected_image_id):
        raise OperatorError("bundle image identity is not an immutable sha256 image ID")
    try:
        with tarfile.open(path, mode="r:gz") as archive:
            manifest_file = archive.extractfile("manifest.json")
            if manifest_file is None:
                raise OperatorError("Docker archive has no manifest")
            entries = json.loads(manifest_file.read())
            if not isinstance(entries, list) or len(entries) != 1 or not isinstance(entries[0], dict):
                raise OperatorError("Docker archive manifest is ambiguous")
            entry = entries[0]
            config_name = entry.get("Config")
            layers = entry.get("Layers")
            if not isinstance(config_name, str) or not isinstance(layers, list):
                raise OperatorError("Docker archive manifest shape is invalid")
            config_relative = PurePosixPath(config_name)
            if config_relative.is_absolute() or any(part in {".", ".."} for part in config_relative.parts):
                raise OperatorError("Docker archive config path is invalid")
            config_file = archive.extractfile(config_name)
            if config_file is None:
                raise OperatorError("Docker archive config is missing")
            config_bytes = config_file.read()
            actual_image_id = "sha256:" + hashlib.sha256(config_bytes).hexdigest()
            if actual_image_id != expected_image_id:
                raise OperatorError("Docker archive config does not match its bound image ID")
            config = json.loads(config_bytes)
            if config.get("os") != "linux" or config.get("architecture") != "amd64":
                raise OperatorError("Docker archive platform does not match linux/amd64")
            for layer in layers:
                if not isinstance(layer, str):
                    raise OperatorError("Docker archive layer path is invalid")
                relative = PurePosixPath(layer)
                if relative.is_absolute() or any(part in {".", ".."} for part in relative.parts):
                    raise OperatorError("Docker archive layer path is invalid")
                member = archive.getmember(layer)
                if not member.isfile():
                    raise OperatorError("Docker archive layer is not a regular file")
    except OperatorError:
        raise
    except (OSError, EOFError, tarfile.TarError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise OperatorError("Docker archive is missing, invalid, or unreadable") from exc


def verify_bundle(
    bundle_arg: Path,
    product_commit: str,
    operations_commit: str,
    expected_manifest_sha256: str,
    product_source_root: Path,
) -> dict[str, Any]:
    if not COMMIT_RE.fullmatch(product_commit) or not COMMIT_RE.fullmatch(operations_commit):
        raise OperatorError("bundle requires full product and operations commit SHAs")
    if not SHA256_RE.fullmatch(expected_manifest_sha256):
        raise OperatorError("manifest SHA-256 must be supplied explicitly")
    if bundle_arg.is_symlink() or not bundle_arg.is_dir():
        raise OperatorError("bundle directory must be a real directory")
    bundle = bundle_arg.resolve(strict=True)
    manifest_path = _regular_file(bundle, "manifest.json")
    if _file_sha256(manifest_path) != expected_manifest_sha256:
        raise OperatorError("bundle manifest SHA-256 does not match the explicit binding")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise OperatorError("bundle manifest is unreadable or invalid") from exc
    if not isinstance(manifest, dict) or set(manifest) != {
        "schemaVersion",
        "repository",
        "targetId",
        "platform",
        "productCommit",
        "operationsCommit",
        "images",
        "artifacts",
        "sourceFiles",
        "sourceTreeSha256",
    }:
        raise OperatorError("bundle manifest shape is unsupported")
    if (
        manifest.get("schemaVersion") != 3
        or manifest.get("repository") != REPOSITORY
        or manifest.get("targetId") != TARGET_ID
        or manifest.get("platform") != "linux/amd64"
        or manifest.get("productCommit") != product_commit
        or manifest.get("operationsCommit") != operations_commit
    ):
        raise OperatorError("bundle manifest does not match the explicit repository and commit bindings")

    images = manifest.get("images")
    artifacts = manifest.get("artifacts")
    source_files = manifest.get("sourceFiles")
    if (
        not isinstance(source_files, dict)
        or set(source_files) != set(SOURCE_COMPOSE_FILES)
        or any(not isinstance(value, str) or not SHA256_RE.fullmatch(value) for value in source_files.values())
        or source_files != _source_compose_digests(product_source_root)
    ):
        raise OperatorError("bundle Compose source binding does not match the product checkout")
    source_tree_sha256 = manifest.get("sourceTreeSha256")
    if (
        not isinstance(source_tree_sha256, str)
        or not SHA256_RE.fullmatch(source_tree_sha256)
        or source_tree_sha256 != _bound_product_source_tree_digest(product_source_root, product_commit)
    ):
        raise OperatorError("bundle product source tree binding does not match the product commit")
    if not isinstance(images, dict) or set(images) != {"runtime", "web"}:
        raise OperatorError("bundle image set is incomplete or unexpected")
    if not isinstance(artifacts, dict) or set(artifacts) != {
        "candidate-images.json",
        "runtime-image.tar.gz",
        "web-image.tar.gz",
    }:
        raise OperatorError("bundle artifact set is incomplete or unexpected")

    expected_services = {
        "runtime": ["intake", "offer", "production", "exports"],
        "web": ["web"],
    }
    for name, archive_name in (("runtime", "runtime-image.tar.gz"), ("web", "web-image.tar.gz")):
        image = images[name]
        if not isinstance(image, dict) or set(image) != {"imageId", "archive", "services"}:
            raise OperatorError("bundle image binding shape is invalid")
        if image.get("archive") != archive_name or image.get("services") != expected_services[name]:
            raise OperatorError("bundle image is bound to the wrong application services")
        image_id = image.get("imageId")
        if not isinstance(image_id, str) or not IMAGE_ID_RE.fullmatch(image_id):
            raise OperatorError("bundle image identity is not immutable")
        archive_path = _regular_file(bundle, archive_name)
        declared_sha = artifacts.get(archive_name)
        if not isinstance(declared_sha, str) or not SHA256_RE.fullmatch(declared_sha):
            raise OperatorError("bundle image archive digest is invalid")
        if _file_sha256(archive_path) != declared_sha:
            raise OperatorError("bundle image archive digest mismatch")
        _verify_docker_archive(archive_path, image_id)

    candidate_path = _regular_file(bundle, "candidate-images.json")
    candidate_digest = artifacts.get("candidate-images.json")
    if not isinstance(candidate_digest, str) or not SHA256_RE.fullmatch(candidate_digest):
        raise OperatorError("candidate image override digest is invalid")
    if _file_sha256(candidate_path) != candidate_digest:
        raise OperatorError("candidate image override digest mismatch")
    try:
        candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise OperatorError("candidate image override is invalid") from exc
    runtime_id = images["runtime"]["imageId"]
    web_id = images["web"]["imageId"]
    expected_candidate = {
        "services": {
            service: {"image": runtime_id}
            for service in ("intake", "offer", "production", "exports")
        }
        | {"web": {"image": web_id}}
    }
    if candidate != expected_candidate:
        raise OperatorError("candidate image override does not match the bundle manifest")
    return manifest


def _default_docker_runner(command: list[str], **kwargs: Any) -> Any:
    try:
        kwargs["check"] = False
        result = subprocess.run(command, **kwargs)
    except OSError as exc:
        raise OperatorError("Docker is unavailable for the secret-free bundle build") from exc
    if result.returncode != 0:
        raise OperatorError("Docker bundle build failed")
    return result


def export_product_context(source: Path, product_commit: str, destination: Path) -> None:
    """Export only tracked product files so ignored Mac-local secrets never enter Docker COPY."""
    archive_path = destination.parent / "product-source.tar"
    try:
        with archive_path.open("wb") as archive_file:
            result = subprocess.run(
                ["git", "-C", str(source), "archive", "--format=tar", product_commit],
                stdout=archive_file,
                stderr=subprocess.DEVNULL,
                check=False,
            )
    except OSError as exc:
        raise OperatorError("exact product source archive could not be created") from exc
    if result.returncode != 0:
        raise OperatorError("exact product source archive could not be created")
    destination.mkdir(parents=True, exist_ok=False, mode=0o755)
    os.chmod(destination, 0o755)

    def ensure_directory(path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True, mode=0o755)
        os.chmod(path, 0o755)

    try:
        with tarfile.open(archive_path, mode="r:") as archive:
            for member in archive.getmembers():
                relative = PurePosixPath(member.name)
                if relative.is_absolute() or any(part in {".", ".."} for part in relative.parts):
                    raise OperatorError("product source archive contains an invalid path")
                basename = relative.name.lower()
                allowed_env_examples = {".env.example", ".env.sample", ".env.template"}
                if (
                    (basename.startswith(".env") and basename not in allowed_env_examples)
                    or basename in {"id_rsa", "id_ed25519", "credentials.json", "service-account.json"}
                    or relative.suffix.lower() in {".pem", ".p12", ".pfx", ".key"}
                    or any(part.lower() in {"secrets", "credentials"} for part in relative.parts[:-1])
                ):
                    raise OperatorError("product source contains a credential-shaped build input")
                path = destination.joinpath(*relative.parts)
                if member.isdir():
                    ensure_directory(path)
                    continue
                if not member.isfile():
                    raise OperatorError("product source archive contains a non-regular entry")
                source_file = archive.extractfile(member)
                if source_file is None:
                    raise OperatorError("product source archive is incomplete")
                ensure_directory(path.parent)
                path.write_bytes(source_file.read())
                os.chmod(path, 0o755 if member.mode & 0o111 else 0o644)
    except (OSError, tarfile.TarError) as exc:
        raise OperatorError("exact product source archive is invalid") from exc


def _save_docker_image(image_id: str, destination: Path) -> None:
    if not IMAGE_ID_RE.fullmatch(image_id):
        raise OperatorError("Docker returned an invalid immutable image ID")
    try:
        process = subprocess.Popen(["docker", "save", image_id], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except OSError as exc:
        raise OperatorError("Docker image export failed") from exc
    try:
        assert process.stdout is not None
        with destination.open("wb") as raw_output:
            with gzip.GzipFile(fileobj=raw_output, mode="wb", compresslevel=1, mtime=0) as compressed:
                while True:
                    chunk = process.stdout.read(1024 * 1024)
                    if not chunk:
                        break
                    compressed.write(chunk)
        process.communicate()
    except OSError as exc:
        process.kill()
        process.communicate()
        raise OperatorError("Docker image export failed") from exc
    if process.returncode != 0:
        raise OperatorError("Docker image export failed")


def create_bundle(
    source_root: Path,
    product_commit: str,
    operations_commit: str,
    output_dir: Path,
    *,
    docker_runner: Callable[..., Any] = _default_docker_runner,
    docker_saver: Callable[[str, Path], None] = _save_docker_image,
    context_exporter: Callable[[Path, str, Path], None] = export_product_context,
) -> str:
    if not COMMIT_RE.fullmatch(product_commit) or not COMMIT_RE.fullmatch(operations_commit):
        raise OperatorError("bundle requires full product and operations commit SHAs")
    if source_root.is_symlink() or not source_root.is_dir():
        raise OperatorError("product source must be a real checkout directory")
    source = source_root.resolve(strict=True)
    for relative in (
        "platform-infra/docker/Dockerfile.runtime",
        "platform-infra/docker/Dockerfile.web",
    ):
        if _regular_file(source, relative).stat().st_size == 0:
            raise OperatorError("product Dockerfile is empty")
    output = output_dir.expanduser().absolute()
    if output.exists() or output.is_symlink():
        raise OperatorError("bundle output path already exists")
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".catering-target-bundle-", dir=output.parent))
    build_state = Path(tempfile.mkdtemp(prefix=".catering-target-build-", dir=output.parent))
    source_context = build_state / "source"
    context_exporter(source, product_commit, source_context)
    built_images: dict[str, str] = {}

    for name, dockerfile in (
        ("runtime", "platform-infra/docker/Dockerfile.runtime"),
        ("web", "platform-infra/docker/Dockerfile.web"),
    ):
        iidfile = build_state / f"{name}.iid"
        command = [
            "docker",
            "build",
            "--platform",
            "linux/amd64",
            "--iidfile",
            str(iidfile),
            "--tag",
            f"catering-target-{name}:{product_commit}",
            "--file",
            str(source_context / dockerfile),
            str(source_context),
        ]
        docker_runner(command, cwd=str(source_context), capture_output=True, text=True, check=False)
        try:
            image_id = iidfile.read_text(encoding="ascii").strip()
        except OSError as exc:
            raise OperatorError("Docker did not produce an immutable image identity") from exc
        if not IMAGE_ID_RE.fullmatch(image_id):
            raise OperatorError("Docker returned an invalid immutable image identity")
        built_images[name] = image_id
        docker_saver(image_id, staging / f"{name}-image.tar.gz")

    runtime_id = built_images["runtime"]
    web_id = built_images["web"]
    _verify_docker_archive(staging / "runtime-image.tar.gz", runtime_id)
    _verify_docker_archive(staging / "web-image.tar.gz", web_id)
    candidate = {
        "services": {
            **{service: {"image": runtime_id} for service in ("intake", "offer", "production", "exports")},
            "web": {"image": web_id},
        }
    }
    candidate_path = staging / "candidate-images.json"
    candidate_path.write_text(json.dumps(candidate, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    artifacts = {
        "candidate-images.json": _file_sha256(candidate_path),
        "runtime-image.tar.gz": _file_sha256(staging / "runtime-image.tar.gz"),
        "web-image.tar.gz": _file_sha256(staging / "web-image.tar.gz"),
    }
    source_files = _source_compose_digests(source_context)
    source_tree_sha256 = _source_tree_digest(source_context)
    manifest = {
        "schemaVersion": 3,
        "repository": REPOSITORY,
        "targetId": TARGET_ID,
        "platform": "linux/amd64",
        "productCommit": product_commit,
        "operationsCommit": operations_commit,
        "images": {
            "runtime": {
                "imageId": runtime_id,
                "archive": "runtime-image.tar.gz",
                "services": ["intake", "offer", "production", "exports"],
            },
            "web": {
                "imageId": web_id,
                "archive": "web-image.tar.gz",
                "services": ["web"],
            },
        },
        "artifacts": artifacts,
        "sourceFiles": source_files,
        "sourceTreeSha256": source_tree_sha256,
    }
    manifest_path = staging / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest_sha256 = _file_sha256(manifest_path)
    verify_bundle(staging, product_commit, operations_commit, manifest_sha256, source_context)
    try:
        staging.rename(output)
    except OSError as exc:
        raise OperatorError("completed bundle could not be published to its output path") from exc
    try:
        shutil.rmtree(build_state)
    except OSError:
        # A leftover temp build directory contains the tracked product export and image ID files.
        pass
    return manifest_sha256


def production_runner_command(root: Path, mode: str) -> list[str]:
    if mode not in {"--preflight", "--stage", "--apply", "--verify", "--update"}:
        raise OperatorError("unsupported production runner mode")
    runner = root / "platform-infra/scripts/catering-target-production-update.sh"
    if not runner.is_file() or runner.is_symlink():
        raise OperatorError("versioned production runner is missing")
    command = ["/bin/bash", str(runner), mode]
    if is_legacy_target_path(command):
        raise OperatorError("legacy target path is forbidden from the versioned operator")
    return command


def is_legacy_target_path(command: Sequence[str]) -> bool:
    forbidden = {"update-catering-target.sh", "deploy-hetzner.sh", "deploy-web-listener-hetzner.sh"}
    return any(Path(part).name in forbidden for part in command) or any(
        ".github/workflows/update-catering-target.yml" in part
        or ".github/workflows/catering-target-preflight.yml" in part
        for part in command
    )


def _runner_environment(
    product_commit: str,
    operations_commit: str,
    product_root: Path,
    *,
    bundle_dir: Path | None = None,
    manifest_sha256: str | None = None,
) -> dict[str, str]:
    environment = os.environ.copy()
    environment["DEPLOY_COMMIT_SHA"] = product_commit
    environment["CATERING_TARGET_SOURCE_ROOT"] = str(product_root.resolve(strict=True))
    environment["CATERING_TARGET_OPERATIONS_COMMIT"] = operations_commit
    if bundle_dir is not None and manifest_sha256 is not None:
        environment["CATERING_TARGET_BUNDLE_DIR"] = str(bundle_dir.resolve(strict=True))
        environment["CATERING_TARGET_MANIFEST_SHA256"] = manifest_sha256
    return environment


def _run_production_phase(command: Sequence[str], environment: dict[str, str]) -> None:
    try:
        completed = subprocess.run(list(command), cwd=str(repository_root()), env=environment, check=False)
    except OSError as exc:
        raise OperatorError("versioned production runner could not be started") from exc
    if completed.returncode != 0:
        raise OperatorError(f"operator phase failed with exit code {completed.returncode}")


def _arguments() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Mac-based, commit-bound CateringOS target operator")
    subparsers = parser.add_subparsers(dest="phase", required=True)

    def bound_inputs(command: argparse.ArgumentParser) -> None:
        command.add_argument("--product-commit", required=True)
        command.add_argument("--operations-commit", required=True)
        command.add_argument("--product-source", type=Path, required=True)

    validate = subparsers.add_parser("validate", help="check both immutable commit gates without host contact")
    bound_inputs(validate)

    bundle = subparsers.add_parser("bundle", help="build and bind secret-free linux/amd64 image artifacts")
    bound_inputs(bundle)
    bundle.add_argument("--output-dir", type=Path, required=True)

    preflight = subparsers.add_parser("preflight", help="run the separate read-only target preflight")
    bound_inputs(preflight)

    stage = subparsers.add_parser("stage", help="transfer an already verified bundle without activation")
    bound_inputs(stage)
    stage.add_argument("--bundle-dir", type=Path, required=True)
    stage.add_argument("--manifest-sha256", required=True)
    stage.add_argument("--confirm", required=True)

    apply = subparsers.add_parser("apply", help="activate only an already staged and bound bundle")
    bound_inputs(apply)
    apply.add_argument("--bundle-dir", type=Path, required=True)
    apply.add_argument("--manifest-sha256", required=True)
    apply.add_argument("--confirm", required=True)

    verify = subparsers.add_parser("verify", help="perform GitHub-free read-only verification of an installed binding")
    bound_inputs(verify)
    verify.add_argument("--bundle-dir", type=Path, required=True)
    verify.add_argument("--manifest-sha256", required=True)

    gate = subparsers.add_parser("_gate", help=argparse.SUPPRESS)
    bound_inputs(gate)
    gate.add_argument("--bundle-dir", type=Path)
    gate.add_argument("--manifest-sha256")

    bundle_bindings = subparsers.add_parser("_bundle-bindings", help=argparse.SUPPRESS)
    bound_inputs(bundle_bindings)
    bundle_bindings.add_argument("--bundle-dir", type=Path, required=True)
    bundle_bindings.add_argument("--manifest-sha256", required=True)

    local_bundle_bindings = subparsers.add_parser("_bundle-bindings-local", help=argparse.SUPPRESS)
    bound_inputs(local_bundle_bindings)
    local_bundle_bindings.add_argument("--bundle-dir", type=Path, required=True)
    local_bundle_bindings.add_argument("--manifest-sha256", required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _arguments().parse_args(argv)
    try:
        require_macos()
        ops_root = repository_root()
        product_sha = args.product_commit
        operations_sha = args.operations_commit
        if args.phase in {"verify", "_bundle-bindings-local"}:
            operations = _validate_checkout(ops_root, operations_sha, "operations")
            product = _validate_checkout(args.product_source, product_sha, "product")
            if operations == product:
                raise OperatorError("product and operations checkouts must be separate")
        else:
            operations, product = verify_commit_gates(
                ops_root,
                operations_sha,
                args.product_source,
                product_sha,
            )
        if args.phase == "validate":
            print(f"CATERING_OPERATOR_GATES_OK product={product_sha} operations={operations_sha}")
            return 0
        if args.phase == "bundle":
            manifest_sha = create_bundle(product, product_sha, operations_sha, args.output_dir)
            print(f"CATERING_TARGET_BUNDLE_OK product={product_sha} operations={operations_sha} manifest_sha256={manifest_sha}")
            return 0
        if args.phase == "_gate":
            if (args.bundle_dir is None) != (args.manifest_sha256 is None):
                raise OperatorError("bundle directory and manifest SHA must be supplied together")
            if args.bundle_dir is not None:
                verify_bundle(args.bundle_dir, product_sha, operations_sha, args.manifest_sha256, product)
            return 0
        if args.phase in {"_bundle-bindings", "_bundle-bindings-local"}:
            manifest = verify_bundle(args.bundle_dir, product_sha, operations_sha, args.manifest_sha256, product)
            print(f"{manifest['images']['runtime']['imageId']}\t{manifest['images']['web']['imageId']}")
            return 0

        environment = _runner_environment(product_sha, operations_sha, product)
        if args.phase == "preflight":
            _run_production_phase(production_runner_command(operations, "--preflight"), environment)
            return 0
        if args.phase == "stage":
            if args.confirm != "STAGE_CATERING_TARGET":
                raise OperatorError("stage requires --confirm STAGE_CATERING_TARGET")
            verify_bundle(args.bundle_dir, product_sha, operations_sha, args.manifest_sha256, product)
            environment.update(_runner_environment(
                product_sha, operations_sha, product,
                bundle_dir=args.bundle_dir, manifest_sha256=args.manifest_sha256,
            ))
            environment["CATERING_TARGET_CONFIRMATION"] = "STAGE_CATERING_TARGET"
            with tempfile.TemporaryDirectory(prefix="catering-target-source-") as temporary:
                sync_source = Path(temporary) / "source"
                export_product_context(product, product_sha, sync_source)
                environment["CATERING_TARGET_SOURCE_SYNC_ROOT"] = str(sync_source)
                _run_production_phase(production_runner_command(operations, "--stage"), environment)
            return 0
        if args.phase == "apply":
            if args.confirm != "ACTIVATE_CATERING_TARGET":
                raise OperatorError("apply requires --confirm ACTIVATE_CATERING_TARGET")
            verify_bundle(args.bundle_dir, product_sha, operations_sha, args.manifest_sha256, product)
            environment.update(
                _runner_environment(
                    product_sha,
                    operations_sha,
                    product,
                    bundle_dir=args.bundle_dir,
                    manifest_sha256=args.manifest_sha256,
                )
            )
            environment["CATERING_TARGET_CONFIRMATION"] = "ACTIVATE_CATERING_TARGET"
            _run_production_phase(production_runner_command(operations, "--apply"), environment)
            return 0
        if args.phase == "verify":
            verify_bundle(args.bundle_dir, product_sha, operations_sha, args.manifest_sha256, product)
            environment.update(_runner_environment(
                product_sha, operations_sha, product,
                bundle_dir=args.bundle_dir, manifest_sha256=args.manifest_sha256,
            ))
            _run_production_phase(production_runner_command(operations, "--verify"), environment)
            return 0
    except OperatorError as exc:
        print(f"CATERING_OPERATOR_FAIL reason={exc}", file=sys.stderr)
        return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
