#!/usr/bin/env python3
"""Focused acceptance tests for the versioned Catering target operator."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
OPERATOR_PATH = ROOT / "platform-infra/scripts/catering-target-operator.py"
SPEC = importlib.util.spec_from_file_location("catering_target_operator", OPERATOR_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("operator module could not be loaded")
operator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(operator)

RELEASE_STATE_PATH = ROOT / "platform-infra/scripts/catering-target-release-state.py"
RELEASE_STATE_SPEC = importlib.util.spec_from_file_location("catering_target_release_state", RELEASE_STATE_PATH)
if RELEASE_STATE_SPEC is None or RELEASE_STATE_SPEC.loader is None:
    raise RuntimeError("release-state verifier module could not be loaded")
release_state = importlib.util.module_from_spec(RELEASE_STATE_SPEC)
RELEASE_STATE_SPEC.loader.exec_module(release_state)

CONTRACT_VALIDATOR_PATH = ROOT / "platform-infra/scripts/catering-target-contract.py"
CONTRACT_VALIDATOR_SPEC = importlib.util.spec_from_file_location("catering_target_contract", CONTRACT_VALIDATOR_PATH)
if CONTRACT_VALIDATOR_SPEC is None or CONTRACT_VALIDATOR_SPEC.loader is None:
    raise RuntimeError("contract validator module could not be loaded")
contract_validator = importlib.util.module_from_spec(CONTRACT_VALIDATOR_SPEC)
CONTRACT_VALIDATOR_SPEC.loader.exec_module(contract_validator)

STAGE_BINDING_PATH = ROOT / "platform-infra/scripts/catering-target-stage-binding.py"
STAGE_BINDING_SPEC = importlib.util.spec_from_file_location("catering_target_stage_binding", STAGE_BINDING_PATH)
if STAGE_BINDING_SPEC is None or STAGE_BINDING_SPEC.loader is None:
    raise RuntimeError("stage binding module could not be loaded")
stage_binding = importlib.util.module_from_spec(STAGE_BINDING_SPEC)
STAGE_BINDING_SPEC.loader.exec_module(stage_binding)


PRODUCT_SHA = "1" * 40
OPERATIONS_SHA = "2" * 40


def docker_archive(config: dict[str, str]) -> tuple[str, bytes]:
    config_bytes = json.dumps(config, sort_keys=True, separators=(",", ":")).encode("utf-8")
    image_id = "sha256:" + hashlib.sha256(config_bytes).hexdigest()
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode="w") as handle:
        info = tarfile.TarInfo("manifest.json")
        manifest = json.dumps([{"Config": image_id.split(":", 1)[1] + ".json", "RepoTags": None, "Layers": ["layer.tar"]}]).encode("utf-8")
        info.size = len(manifest)
        handle.addfile(info, io.BytesIO(manifest))
        info = tarfile.TarInfo(image_id.split(":", 1)[1] + ".json")
        info.size = len(config_bytes)
        handle.addfile(info, io.BytesIO(config_bytes))
        info = tarfile.TarInfo("layer.tar")
        info.size = 0
        handle.addfile(info, io.BytesIO(b""))
    return image_id, archive.getvalue()


def successful_main_push(commit: str) -> dict[str, str]:
    return {
        "event": "push",
        "head_branch": "main",
        "head_sha": commit,
        "status": "completed",
        "conclusion": "success",
    }


def build_fixture_bundle(base: Path) -> tuple[Path, str, dict[str, tuple[str, bytes]], list[list[str]], Path]:
    source = base / "source"
    (source / "platform-infra/docker").mkdir(parents=True)
    (source / "platform-infra/docker/Dockerfile.runtime").write_text("FROM scratch\n", encoding="utf-8")
    (source / "platform-infra/docker/Dockerfile.web").write_text("FROM scratch\n", encoding="utf-8")
    (source / "platform-infra/docker-compose.catering-target.json").write_text('{"services":{}}\n', encoding="utf-8")
    (source / "platform-infra/docker-compose.catering-target.operations.json").write_text('{"services":{}}\n', encoding="utf-8")
    output = base / "bundle"
    images = {
        "runtime": docker_archive({"architecture": "amd64", "os": "linux", "rootfs": {"type": "layers", "diff_ids": []}}),
        "web": docker_archive({"architecture": "amd64", "os": "linux", "rootfs": {"type": "layers", "diff_ids": []}}),
    }
    commands: list[list[str]] = []

    def docker(command: list[str], **kwargs: object) -> CompletedProcess[bytes]:
        commands.append(command)
        if command[1] == "build":
            iidfile = Path(command[command.index("--iidfile") + 1])
            kind = "runtime" if command[command.index("--file") + 1].endswith("Dockerfile.runtime") else "web"
            iidfile.write_text(images[kind][0] + "\n", encoding="utf-8")
            return CompletedProcess(command, 0, b"", b"")
        if command[1] == "save":
            for image_id, archive in images.values():
                if command[2] == image_id:
                    return CompletedProcess(command, 0, archive, b"")
        raise AssertionError("unexpected Docker command")

    def save(image_id: str, destination: Path) -> None:
        commands.append(["docker", "save", image_id])
        archive = next(archive for bound_id, archive in images.values() if bound_id == image_id)
        destination.write_bytes(gzip.compress(archive, compresslevel=1, mtime=0))

    def export_context(source_root: Path, product_commit: str, destination: Path) -> None:
        shutil.copytree(source_root, destination)

    manifest_sha = operator.create_bundle(
        source,
        PRODUCT_SHA,
        OPERATIONS_SHA,
        output,
        docker_runner=docker,
        docker_saver=save,
        context_exporter=export_context,
    )
    return output, manifest_sha, images, commands, source


def build_release_state_fixture(base: Path, *, current_bundle: bool) -> tuple[Path, str, str, str]:
    release_root = base / "releases"
    release = release_root / PRODUCT_SHA
    source = release / "source/platform-infra"
    source.mkdir(parents=True)
    base_name = "platform-infra/docker-compose.catering-target.json"
    ops_name = "platform-infra/docker-compose.catering-target.operations.json"
    base_file = release / "source" / base_name
    ops_file = release / "source" / ops_name
    base_file.write_text('{"services":{}}\n', encoding="utf-8")
    ops_file.write_text('{"services":{}}\n', encoding="utf-8")
    runtime_id = "sha256:" + "a" * 64
    web_id = "sha256:" + "b" * 64
    candidate = {
        "services": {
            **{service: {"image": runtime_id} for service in ("intake", "offer", "production", "exports")},
            "web": {"image": web_id},
        }
    }
    candidate_path = release / "candidate-images.json"
    candidate_path.write_text(json.dumps(candidate, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    candidate_path.chmod(0o644)
    receipt_values = {
        "status": "installed",
        "commit": PRODUCT_SHA,
        "runtime_image": runtime_id,
        "web_image": web_id,
        "installed_at": "2026-09-28T19:00:00Z",
    }
    manifest_sha = "0" * 64
    if current_bundle:
        (release / "runtime-image.tar.gz").write_bytes(b"runtime archive fixture")
        (release / "web-image.tar.gz").write_bytes(b"web archive fixture")
        for name in ("runtime-image.tar.gz", "web-image.tar.gz"):
            (release / name).chmod(0o644)
        manifest = {
            "schemaVersion": 3,
            "repository": "AlexanderSmyslowski/catering-agents-platform",
            "targetId": "catering-prod-1",
            "platform": "linux/amd64",
            "productCommit": PRODUCT_SHA,
            "operationsCommit": OPERATIONS_SHA,
            "images": {
                "runtime": {"imageId": runtime_id, "archive": "runtime-image.tar.gz", "services": ["intake", "offer", "production", "exports"]},
                "web": {"imageId": web_id, "archive": "web-image.tar.gz", "services": ["web"]},
            },
            "artifacts": {
                "candidate-images.json": hashlib.sha256(candidate_path.read_bytes()).hexdigest(),
                "runtime-image.tar.gz": hashlib.sha256((release / "runtime-image.tar.gz").read_bytes()).hexdigest(),
                "web-image.tar.gz": hashlib.sha256((release / "web-image.tar.gz").read_bytes()).hexdigest(),
            },
            "sourceFiles": {
                base_name: hashlib.sha256(base_file.read_bytes()).hexdigest(),
                ops_name: hashlib.sha256(ops_file.read_bytes()).hexdigest(),
            },
            "sourceTreeSha256": release_state._source_tree_sha256(
                release / "source", os.getuid(), os.getgid()
            ),
        }
        manifest_path = release / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        manifest_path.chmod(0o644)
        manifest_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        receipt_values["operations_commit"] = OPERATIONS_SHA
        receipt_values["manifest_sha256"] = manifest_sha
    receipt = release / "install-receipt"
    receipt.write_text("".join(f"{key}={value}\n" for key, value in receipt_values.items()), encoding="ascii")
    receipt.chmod(0o600)
    marker = release_root / "installed"
    marker.write_text(PRODUCT_SHA + "\n", encoding="ascii")
    marker.chmod(0o644)
    return release_root.resolve(), base_name, ops_name, manifest_sha


class CateringTargetOperatorTests(unittest.TestCase):
    def _stage_fixture(self, base: Path) -> tuple[Path, str, str, str, str]:
        release = base / PRODUCT_SHA
        release.mkdir()
        source_platform = release / "source/platform-infra"
        source_platform.mkdir(parents=True)
        (release / "source").chmod(0o755)
        source_platform.chmod(0o755)
        source_files = {
            "platform-infra/docker-compose.catering-target.json": source_platform / "docker-compose.catering-target.json",
            "platform-infra/docker-compose.catering-target.operations.json": source_platform / "docker-compose.catering-target.operations.json",
        }
        for index, source_path in enumerate(source_files.values()):
            source_path.write_text(json.dumps({"source": index}) + "\n", encoding="utf-8")
            source_path.chmod(0o644)
        source_files_sha256 = {
            relative: hashlib.sha256(source_path.read_bytes()).hexdigest()
            for relative, source_path in source_files.items()
        }
        runtime_image = "sha256:" + "a" * 64
        web_image = "sha256:" + "b" * 64
        candidate = {"services": {
            "intake": {"image": runtime_image}, "offer": {"image": runtime_image},
            "production": {"image": runtime_image}, "exports": {"image": runtime_image},
            "web": {"image": web_image},
        }}
        (release / "candidate-images.json").write_text(json.dumps(candidate, sort_keys=True) + "\n", encoding="utf-8")
        (release / "runtime-image.tar.gz").write_bytes(b"runtime archive")
        (release / "web-image.tar.gz").write_bytes(b"web archive")
        shutil.copyfile(STAGE_BINDING_PATH, release / "stage-binding.py")
        for name in ("candidate-images.json", "runtime-image.tar.gz", "web-image.tar.gz", "stage-binding.py"):
            (release / name).chmod(0o644)
        artifacts = {name: hashlib.sha256((release / name).read_bytes()).hexdigest() for name in ("candidate-images.json", "runtime-image.tar.gz", "web-image.tar.gz")}
        source_tree_sha256 = stage_binding.source_tree_sha256(
            release / "source", expected_uid=os.getuid(), expected_gid=os.getgid()
        )
        manifest = {
            "schemaVersion": 3,
            "repository": operator.REPOSITORY,
            "targetId": operator.TARGET_ID,
            "platform": "linux/amd64",
            "productCommit": PRODUCT_SHA,
            "operationsCommit": OPERATIONS_SHA,
            "images": {
                "runtime": {"imageId": runtime_image, "archive": "runtime-image.tar.gz", "services": ["intake", "offer", "production", "exports"]},
                "web": {"imageId": web_image, "archive": "web-image.tar.gz", "services": ["web"]},
            },
            "artifacts": artifacts,
            "sourceFiles": source_files_sha256,
            "sourceTreeSha256": source_tree_sha256,
        }
        (release / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        (release / "manifest.json").chmod(0o644)
        return release, hashlib.sha256((release / "manifest.json").read_bytes()).hexdigest(), runtime_image, web_image, hashlib.sha256(STAGE_BINDING_PATH.read_bytes()).hexdigest()

    def test_stage_receipt_binds_commits_manifest_images_and_artifact_digests(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-binding-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            values = stage_binding.stage_values(
                release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                expected_uid=uid, expected_gid=gid, require_production_release_root=False,
            )
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            stage_binding.verify_receipt(release, values, expected_uid=uid, expected_gid=gid)

    def test_identical_complete_stage_is_reusable_without_rewriting_receipts(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-reuse-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            values = stage_binding.stage_values(
                release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                expected_uid=uid, expected_gid=gid, require_production_release_root=False,
            )
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            receipt_before = (release / "stage-receipt").read_bytes()
            self.assertEqual(
                stage_binding.inspect_existing_release(
                    release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA,
                    operations_commit=OPERATIONS_SHA, runtime_image=runtime_image, web_image=web_image,
                    stage_binding_sha256=checker_sha, expected_uid=uid, expected_gid=gid,
                    require_production_release_root=False,
                ),
                "reusable",
            )
            self.assertEqual((release / "stage-receipt").read_bytes(), receipt_before)

    def test_previous_images_without_install_receipt_allow_exact_stage_retry(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-retry-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            arguments = {
                "manifest_sha256": manifest_sha,
                "product_commit": PRODUCT_SHA,
                "operations_commit": OPERATIONS_SHA,
                "runtime_image": runtime_image,
                "web_image": web_image,
                "stage_binding_sha256": checker_sha,
                "expected_uid": uid,
                "expected_gid": gid,
                "require_production_release_root": False,
            }
            values = stage_binding.stage_values(release, **arguments)
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            previous_images = {
                "services": {
                    name: {"image": "sha256:" + "d" * 64}
                    for name in ("intake", "offer", "production", "exports", "web")
                }
            }
            previous_path = release / "previous-images.json"
            previous_path.write_text(json.dumps(previous_images) + "\n", encoding="utf-8")
            previous_path.chmod(0o600)

            self.assertEqual(stage_binding.inspect_existing_release(release, **arguments), "reusable")

    def test_previous_images_do_not_weaken_bundle_layout_or_receipt_bindings(self) -> None:
        mutations = (
            ("manifest", "stage manifest digest mismatch"),
            ("image", "stage manifest image binding mismatch"),
            ("source", "stage source artifact digest mismatch"),
            ("receipt", "stage receipt binding mismatch"),
            ("previous_mode", "stage artifact ownership or mode is invalid"),
            ("previous_shape", "stage rollback binding is invalid"),
            ("unknown_file", "stage release layout is invalid"),
        )
        for mutation, expected_error in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory(
                prefix="catering-operator-stage-retry-drift-"
            ) as temporary:
                release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
                uid, gid = os.getuid(), os.getgid()
                arguments = {
                    "manifest_sha256": manifest_sha,
                    "product_commit": PRODUCT_SHA,
                    "operations_commit": OPERATIONS_SHA,
                    "runtime_image": runtime_image,
                    "web_image": web_image,
                    "stage_binding_sha256": checker_sha,
                    "expected_uid": uid,
                    "expected_gid": gid,
                    "require_production_release_root": False,
                }
                values = stage_binding.stage_values(release, **arguments)
                stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
                previous_path = release / "previous-images.json"
                previous_path.write_text(
                    json.dumps({"services": {
                        name: {"image": "sha256:" + "d" * 64}
                        for name in ("intake", "offer", "production", "exports", "web")
                    }}) + "\n",
                    encoding="utf-8",
                )
                previous_path.chmod(0o600)
                if mutation == "manifest":
                    (release / "manifest.json").write_text("{}\n", encoding="utf-8")
                elif mutation == "image":
                    arguments["runtime_image"] = "sha256:" + "c" * 64
                elif mutation == "source":
                    source_file = release / "source/platform-infra/docker-compose.catering-target.json"
                    source_file.write_text("drift\n", encoding="utf-8")
                elif mutation == "receipt":
                    receipt = release / "stage-receipt"
                    receipt.write_text(receipt.read_text(encoding="ascii") + "unexpected=value\n", encoding="ascii")
                    receipt.chmod(0o600)
                elif mutation == "previous_mode":
                    previous_path.chmod(0o644)
                elif mutation == "previous_shape":
                    previous_path.write_text("{}\n", encoding="utf-8")
                    previous_path.chmod(0o600)
                else:
                    (release / "unexpected.txt").write_text("unbound\n", encoding="ascii")

                with self.assertRaisesRegex(stage_binding.StageBindingError, expected_error):
                    stage_binding.inspect_existing_release(release, **arguments)

    def test_existing_partial_or_unknown_stage_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-partial-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            arguments = {
                "manifest_sha256": manifest_sha,
                "product_commit": PRODUCT_SHA,
                "operations_commit": OPERATIONS_SHA,
                "runtime_image": runtime_image,
                "web_image": web_image,
                "stage_binding_sha256": checker_sha,
                "expected_uid": os.getuid(),
                "expected_gid": os.getgid(),
                "require_production_release_root": False,
            }
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.inspect_existing_release(release, **arguments)
            values = stage_binding.stage_values(release, **arguments)
            stage_binding.write_receipt(release, values, expected_uid=os.getuid(), expected_gid=os.getgid())
            (release / "unexpected.txt").write_text("unbound\n", encoding="ascii")
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.inspect_existing_release(release, **arguments)

    def test_extra_source_file_and_wrong_owner_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-source-extra-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            arguments = {
                "manifest_sha256": manifest_sha,
                "product_commit": PRODUCT_SHA,
                "operations_commit": OPERATIONS_SHA,
                "runtime_image": runtime_image,
                "web_image": web_image,
                "stage_binding_sha256": checker_sha,
                "expected_uid": uid,
                "expected_gid": gid,
                "require_production_release_root": False,
            }
            values = stage_binding.stage_values(release, **arguments)
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            extra = release / "source/platform-infra/untracked.txt"
            extra.write_text("unbound\n", encoding="ascii")
            extra.chmod(0o644)
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.inspect_existing_release(release, **arguments)
            extra.unlink()
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.inspect_existing_release(release, **{**arguments, "expected_uid": uid + 1})

    def test_same_product_commit_with_different_manifest_binding_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-rebind-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            values = stage_binding.stage_values(
                release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                expected_uid=uid, expected_gid=gid, require_production_release_root=False,
            )
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.inspect_existing_release(
                    release, manifest_sha256="f" * 64, product_commit=PRODUCT_SHA,
                    operations_commit=OPERATIONS_SHA, runtime_image="sha256:" + "c" * 64,
                    web_image=web_image, stage_binding_sha256=checker_sha, expected_uid=uid, expected_gid=gid,
                    require_production_release_root=False,
                )

    def test_installed_receipt_is_distinct_from_reusable_stage(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-installed-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            arguments = {
                "manifest_sha256": manifest_sha,
                "product_commit": PRODUCT_SHA,
                "operations_commit": OPERATIONS_SHA,
                "runtime_image": runtime_image,
                "web_image": web_image,
                "stage_binding_sha256": checker_sha,
                "expected_uid": uid,
                "expected_gid": gid,
                "require_production_release_root": False,
            }
            values = stage_binding.stage_values(release, **arguments)
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            previous_images = {"services": {name: {"image": "sha256:" + "d" * 64} for name in ("intake", "offer", "production", "exports", "web")}}
            (release / "previous-images.json").write_text(json.dumps(previous_images) + "\n", encoding="utf-8")
            (release / "previous-images.json").chmod(0o600)
            install_receipt = {
                "status": "installed", "commit": PRODUCT_SHA, "runtime_image": runtime_image,
                "web_image": web_image, "operations_commit": OPERATIONS_SHA,
                "manifest_sha256": manifest_sha, "installed_at": "2026-09-28T19:00:00Z",
            }
            (release / "install-receipt").write_text(
                "".join(f"{key}={value}\n" for key, value in install_receipt.items()), encoding="ascii"
            )
            (release / "install-receipt").chmod(0o600)
            self.assertEqual(stage_binding.inspect_existing_release(release, **arguments), "installed")
            (release / "install-receipt").write_text("status=installed\ncommit=" + "9" * 40 + "\n", encoding="ascii")
            (release / "install-receipt").chmod(0o600)
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.inspect_existing_release(release, **arguments)

    def test_stage_source_modes_and_recursive_digest_are_deterministic(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-source-mode-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            values = stage_binding.stage_values(
                release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                expected_uid=uid, expected_gid=gid, require_production_release_root=False,
            )
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            (release / "source/platform-infra").chmod(0o700)
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.inspect_existing_release(
                    release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA,
                    operations_commit=OPERATIONS_SHA, runtime_image=runtime_image, web_image=web_image,
                    stage_binding_sha256=checker_sha, expected_uid=uid, expected_gid=gid,
                    require_production_release_root=False,
                )

    def test_apply_stage_binding_rejects_changed_artifact_or_commit(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-drift-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            values = stage_binding.stage_values(
                release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                expected_uid=uid, expected_gid=gid, require_production_release_root=False,
            )
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            (release / "candidate-images.json").write_text("{}\n", encoding="utf-8")
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.stage_values(
                    release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                    runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                    expected_uid=uid, expected_gid=gid, require_production_release_root=False,
                )

    def test_apply_stage_binding_rejects_changed_staged_compose_source(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-stage-source-drift-") as temporary:
            release, manifest_sha, runtime_image, web_image, checker_sha = self._stage_fixture(Path(temporary))
            uid, gid = os.getuid(), os.getgid()
            values = stage_binding.stage_values(
                release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                expected_uid=uid, expected_gid=gid, require_production_release_root=False,
            )
            stage_binding.write_receipt(release, values, expected_uid=uid, expected_gid=gid)
            compose = release / "source/platform-infra/docker-compose.catering-target.json"
            compose.write_text('{"services":{"web":{"privileged":true}}}\n', encoding="utf-8")
            with self.assertRaises(stage_binding.StageBindingError):
                stage_binding.stage_values(
                    release, manifest_sha256=manifest_sha, product_commit=PRODUCT_SHA, operations_commit=OPERATIONS_SHA,
                    runtime_image=runtime_image, web_image=web_image, stage_binding_sha256=checker_sha,
                    expected_uid=uid, expected_gid=gid, require_production_release_root=False,
                )
    def test_contract_and_inventory_accept_the_versioned_control_values(self) -> None:
        contract = json.loads((ROOT / "platform-infra/catering-target-update-contract.json").read_text(encoding="utf-8"))
        inventory = json.loads((ROOT / "platform-infra/catering-target-runtime-inventory.json").read_text(encoding="utf-8"))
        contract_validator.validate_control_data(contract, inventory)

    def test_contract_rejects_whitespace_or_shell_metacharacters_in_remote_paths(self) -> None:
        contract = json.loads((ROOT / "platform-infra/catering-target-update-contract.json").read_text(encoding="utf-8"))
        inventory = json.loads((ROOT / "platform-infra/catering-target-runtime-inventory.json").read_text(encoding="utf-8"))
        contract["installedRuntime"]["platform"]["baseCompose"] = "/opt/catering-agents-platform/platform-infra/compose.json; touch /tmp/x"
        with self.assertRaises(contract_validator.ContractError):
            contract_validator.validate_control_data(contract, inventory)

    def test_inventory_rejects_metacharacters_in_compose_identity(self) -> None:
        contract = json.loads((ROOT / "platform-infra/catering-target-update-contract.json").read_text(encoding="utf-8"))
        inventory = json.loads((ROOT / "platform-infra/catering-target-runtime-inventory.json").read_text(encoding="utf-8"))
        inventory["platform"]["containers"][0]["name"] = "platform-infra-postgres-1; whoami"
        with self.assertRaises(contract_validator.ContractError):
            contract_validator.validate_control_data(contract, inventory)

    def test_inventory_rejects_wrong_json_types_with_fixed_contract_error(self) -> None:
        contract = json.loads((ROOT / "platform-infra/catering-target-update-contract.json").read_text(encoding="utf-8"))
        inventory = json.loads((ROOT / "platform-infra/catering-target-runtime-inventory.json").read_text(encoding="utf-8"))
        inventory["platform"]["runtimeFiles"][0]["role"] = ["base_compose"]
        with self.assertRaises(contract_validator.ContractError):
            contract_validator.validate_control_data(contract, inventory)
        with tempfile.TemporaryDirectory(prefix="catering-contract-type-error-") as temporary:
            contract_path = Path(temporary) / "contract.json"
            inventory_path = Path(temporary) / "inventory.json"
            contract_path.write_text(json.dumps(contract), encoding="utf-8")
            inventory_path.write_text(json.dumps(inventory), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(CONTRACT_VALIDATOR_PATH), str(contract_path), str(inventory_path)],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr, "target contract or inventory has invalid control values\n")

    def test_local_git_checkout_binding_and_origin_main_ancestry_are_checked(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-git-gate-") as temporary:
            root = Path(temporary) / "checkout"
            root.mkdir()
            subprocess.run(["git", "init", str(root)], capture_output=True, check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Catering operator test"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "operator-test@example.invalid"], check=True)
            (root / "bound.txt").write_text("bound\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "bound.txt"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "bound"], capture_output=True, check=True)
            bound = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
            subprocess.run(["git", "-C", str(root), "remote", "add", "origin", "git@github.com:AlexanderSmyslowski/catering-agents-platform.git"], check=True)
            subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", bound], check=True)
            subprocess.run(["git", "-C", str(root), "checkout", "--detach", bound], capture_output=True, check=True)

            self.assertEqual(operator._validate_checkout(root, bound, "product"), root.resolve())
            self.assertTrue(operator._is_ancestor(root, bound))
            subprocess.run(["git", "-C", str(root), "remote", "set-url", "origin", "git@github.com:untrusted/other-repository.git"], check=True)
            with self.assertRaises(operator.OperatorError):
                operator._validate_checkout(root, bound, "product")
            subprocess.run(["git", "-C", str(root), "remote", "set-url", "origin", "git@github.com:AlexanderSmyslowski/catering-agents-platform.git"], check=True)
            with self.assertRaises(operator.OperatorError):
                operator._validate_checkout(root, "f" * 40, "product")

            (root / "outside.txt").write_text("outside\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "outside.txt"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "outside main"], capture_output=True, check=True)
            outside = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
            self.assertFalse(operator._is_ancestor(root, outside))

    def test_historical_release_layout_accepts_matching_install_receipt_and_candidate_images(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-") as temporary:
            release_root, base_name, ops_name, _ = build_release_state_fixture(Path(temporary), current_bundle=False)
            binding = release_state.inspect_release_binding(
                release_root,
                release_state.DISCOVER_INSTALLED,
                base_name,
                ops_name,
                hashlib.sha256((release_root / PRODUCT_SHA / "source" / base_name).read_bytes()).hexdigest(),
                hashlib.sha256((release_root / PRODUCT_SHA / "source" / ops_name).read_bytes()).hexdigest(),
                PRODUCT_SHA,
                OPERATIONS_SHA,
                "0" * 64,
                expected_uid=os.getuid(),
                expected_gid=os.getgid(),
            )
            self.assertEqual(binding["commit"], PRODUCT_SHA)
            self.assertEqual(binding["runtime_image"], "sha256:" + "a" * 64)
            self.assertEqual(binding["web_image"], "sha256:" + "b" * 64)

    def test_rollback_accepts_verified_previous_receipt_without_candidate_bundle(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-rollback-state-") as temporary:
            release_root, base_name, ops_name, _ = build_release_state_fixture(Path(temporary), current_bundle=False)
            binding = release_state.inspect_rollback_binding(
                release_root,
                PRODUCT_SHA,
                base_name,
                ops_name,
                "3" * 40,
                "4" * 40,
                expected_uid=os.getuid(),
                expected_gid=os.getgid(),
            )
            self.assertEqual(binding["commit"], PRODUCT_SHA)
            self.assertEqual(binding["runtime_image"], "sha256:" + "a" * 64)
            self.assertEqual(binding["web_image"], "sha256:" + "b" * 64)

    def test_rollback_rejects_candidate_commit_and_previous_receipt_drift(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-rollback-state-") as temporary:
            release_root, base_name, ops_name, _ = build_release_state_fixture(Path(temporary), current_bundle=False)
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_rollback_binding(
                    release_root,
                    PRODUCT_SHA,
                    base_name,
                    ops_name,
                    PRODUCT_SHA,
                    "4" * 40,
                    expected_uid=os.getuid(),
                    expected_gid=os.getgid(),
                )
            marker = release_root / "installed"
            marker.write_text("3" * 40 + "\n", encoding="ascii")
            marker.chmod(0o644)
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_rollback_binding(
                    release_root,
                    PRODUCT_SHA,
                    base_name,
                    ops_name,
                    "3" * 40,
                    "4" * 40,
                    expected_uid=os.getuid(),
                    expected_gid=os.getgid(),
                )

    def test_release_state_rejects_receipt_image_mismatch(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-") as temporary:
            release_root, base_name, ops_name, _ = build_release_state_fixture(Path(temporary), current_bundle=False)
            receipt = release_root / PRODUCT_SHA / "install-receipt"
            receipt.write_text(receipt.read_text(encoding="ascii").replace("runtime_image=sha256:a", "runtime_image=sha256:c"), encoding="ascii")
            receipt.chmod(0o600)
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_release_binding(
                    release_root,
                    release_state.DISCOVER_INSTALLED,
                    base_name,
                    ops_name,
                    hashlib.sha256((release_root / PRODUCT_SHA / "source" / base_name).read_bytes()).hexdigest(),
                    hashlib.sha256((release_root / PRODUCT_SHA / "source" / ops_name).read_bytes()).hexdigest(),
                    PRODUCT_SHA,
                    OPERATIONS_SHA,
                    "0" * 64,
                    expected_uid=os.getuid(),
                    expected_gid=os.getgid(),
                )

    def test_candidate_release_state_requires_manifest_and_archive_bindings(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-") as temporary:
            release_root, base_name, ops_name, manifest_sha = build_release_state_fixture(Path(temporary), current_bundle=True)
            source = release_root / PRODUCT_SHA / "source"
            binding = release_state.inspect_release_binding(
                release_root,
                PRODUCT_SHA,
                base_name,
                ops_name,
                hashlib.sha256((source / base_name).read_bytes()).hexdigest(),
                hashlib.sha256((source / ops_name).read_bytes()).hexdigest(),
                PRODUCT_SHA,
                OPERATIONS_SHA,
                manifest_sha,
                expected_uid=os.getuid(),
                expected_gid=os.getgid(),
            )
            self.assertEqual(binding["commit"], PRODUCT_SHA)
            archive = release_root / PRODUCT_SHA / "runtime-image.tar.gz"
            archive.write_bytes(b"tampered archive")
            archive.chmod(0o644)
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_release_binding(
                    release_root,
                    PRODUCT_SHA,
                    base_name,
                    ops_name,
                    hashlib.sha256((source / base_name).read_bytes()).hexdigest(),
                    hashlib.sha256((source / ops_name).read_bytes()).hexdigest(),
                    PRODUCT_SHA,
                    OPERATIONS_SHA,
                    manifest_sha,
                    expected_uid=os.getuid(),
                    expected_gid=os.getgid(),
                )

    def test_candidate_release_state_rejects_legacy_schema_one_manifest(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-legacy-candidate-") as temporary:
            release_root, base_name, ops_name, _ = build_release_state_fixture(Path(temporary), current_bundle=True)
            release = release_root / PRODUCT_SHA
            manifest_path = release / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["schemaVersion"] = 1
            manifest.pop("sourceFiles")
            manifest.pop("sourceTreeSha256")
            manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            manifest_path.chmod(0o644)
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_release_binding(
                    release_root,
                    PRODUCT_SHA,
                    base_name,
                    ops_name,
                    hashlib.sha256((release / "source" / base_name).read_bytes()).hexdigest(),
                    hashlib.sha256((release / "source" / ops_name).read_bytes()).hexdigest(),
                    PRODUCT_SHA,
                    OPERATIONS_SHA,
                    hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
                    expected_uid=os.getuid(),
                    expected_gid=os.getgid(),
                )

    def test_installed_legacy_schema_one_receipt_remains_available_for_rollback(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-legacy-installed-") as temporary:
            release_root, base_name, ops_name, _ = build_release_state_fixture(Path(temporary), current_bundle=True)
            release = release_root / PRODUCT_SHA
            manifest_path = release / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["schemaVersion"] = 1
            manifest.pop("sourceFiles")
            manifest.pop("sourceTreeSha256")
            manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            manifest_path.chmod(0o644)
            manifest_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            receipt_path = release / "install-receipt"
            receipt = receipt_path.read_text(encoding="ascii")
            receipt_lines = [line for line in receipt.splitlines() if not line.startswith("manifest_sha256=")]
            receipt_lines.append(f"manifest_sha256={manifest_sha}")
            receipt_path.write_text("\n".join(receipt_lines) + "\n", encoding="ascii")
            receipt_path.chmod(0o600)

            binding = release_state.inspect_rollback_binding(
                release_root,
                PRODUCT_SHA,
                base_name,
                ops_name,
                "3" * 40,
                OPERATIONS_SHA,
                expected_uid=os.getuid(),
                expected_gid=os.getgid(),
            )
            self.assertEqual(binding["commit"], PRODUCT_SHA)

    def test_installed_schema_two_receipt_remains_available_for_rollback(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-v2-installed-") as temporary:
            release_root, base_name, ops_name, _ = build_release_state_fixture(Path(temporary), current_bundle=True)
            release = release_root / PRODUCT_SHA
            manifest_path = release / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["schemaVersion"] = 2
            manifest.pop("sourceTreeSha256")
            manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            manifest_path.chmod(0o644)
            manifest_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            receipt_path = release / "install-receipt"
            receipt = receipt_path.read_text(encoding="ascii")
            receipt_lines = [line for line in receipt.splitlines() if not line.startswith("manifest_sha256=")]
            receipt_lines.append(f"manifest_sha256={manifest_sha}")
            receipt_path.write_text("\n".join(receipt_lines) + "\n", encoding="ascii")
            receipt_path.chmod(0o600)

            binding = release_state.inspect_rollback_binding(
                release_root,
                PRODUCT_SHA,
                base_name,
                ops_name,
                "3" * 40,
                OPERATIONS_SHA,
                expected_uid=os.getuid(),
                expected_gid=os.getgid(),
            )
            self.assertEqual(binding["commit"], PRODUCT_SHA)

    def test_generated_v3_bundle_passes_candidate_installed_and_rollback_checks(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-v3-") as temporary:
            base = Path(temporary)
            bundle, manifest_sha, images, _, product_source = build_fixture_bundle(base)
            release_root = base / "releases"
            release = release_root / PRODUCT_SHA
            release.mkdir(parents=True)
            release_root = release_root.resolve()
            for name in ("candidate-images.json", "manifest.json", "runtime-image.tar.gz", "web-image.tar.gz"):
                shutil.copyfile(bundle / name, release / name)
                (release / name).chmod(0o644)
            shutil.copytree(product_source, release / "source")
            source_base = "platform-infra/docker-compose.catering-target.json"
            source_ops = "platform-infra/docker-compose.catering-target.operations.json"
            source = release / "source"
            source_base_sha = hashlib.sha256((source / source_base).read_bytes()).hexdigest()
            source_ops_sha = hashlib.sha256((source / source_ops).read_bytes()).hexdigest()
            runtime_image = images["runtime"][0]
            web_image = images["web"][0]
            uid, gid = os.getuid(), os.getgid()

            candidate = release_state.inspect_release_binding(
                release_root,
                PRODUCT_SHA,
                source_base,
                source_ops,
                source_base_sha,
                source_ops_sha,
                PRODUCT_SHA,
                OPERATIONS_SHA,
                manifest_sha,
                expected_uid=uid,
                expected_gid=gid,
            )
            self.assertEqual(candidate["commit"], PRODUCT_SHA)

            receipt = release / "install-receipt"
            receipt.write_text(
                "".join(
                    f"{key}={value}\n"
                    for key, value in {
                        "status": "installed",
                        "commit": PRODUCT_SHA,
                        "runtime_image": runtime_image,
                        "web_image": web_image,
                        "installed_at": "2026-09-28T19:00:00Z",
                        "operations_commit": OPERATIONS_SHA,
                        "manifest_sha256": manifest_sha,
                    }.items()
                ),
                encoding="ascii",
            )
            receipt.chmod(0o600)
            marker = release_root / "installed"
            marker.write_text(PRODUCT_SHA + "\n", encoding="ascii")
            marker.chmod(0o644)

            installed = release_state.inspect_release_binding(
                release_root,
                release_state.DISCOVER_INSTALLED,
                source_base,
                source_ops,
                source_base_sha,
                source_ops_sha,
                PRODUCT_SHA,
                OPERATIONS_SHA,
                "0" * 64,
                expected_uid=uid,
                expected_gid=gid,
            )
            self.assertEqual(installed["commit"], PRODUCT_SHA)
            rollback = release_state.inspect_rollback_binding(
                release_root,
                PRODUCT_SHA,
                source_base,
                source_ops,
                "3" * 40,
                OPERATIONS_SHA,
                expected_uid=uid,
                expected_gid=gid,
            )
            self.assertEqual(rollback["commit"], PRODUCT_SHA)

    def test_installed_v3_release_rejects_changed_compose_source(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-v3-drift-") as temporary:
            base = Path(temporary)
            bundle, manifest_sha, images, _, product_source = build_fixture_bundle(base)
            release_root = base / "releases"
            release = release_root / PRODUCT_SHA
            release.mkdir(parents=True)
            release_root = release_root.resolve()
            for name in ("candidate-images.json", "manifest.json", "runtime-image.tar.gz", "web-image.tar.gz"):
                shutil.copyfile(bundle / name, release / name)
                (release / name).chmod(0o644)
            shutil.copytree(product_source, release / "source")
            source_base = "platform-infra/docker-compose.catering-target.json"
            source_ops = "platform-infra/docker-compose.catering-target.operations.json"
            runtime_image = images["runtime"][0]
            web_image = images["web"][0]
            (release / "install-receipt").write_text(
                f"status=installed\ncommit={PRODUCT_SHA}\nruntime_image={runtime_image}\nweb_image={web_image}\n"
                f"installed_at=2026-09-28T19:00:00Z\noperations_commit={OPERATIONS_SHA}\nmanifest_sha256={manifest_sha}\n",
                encoding="ascii",
            )
            (release / "install-receipt").chmod(0o600)
            (release_root / "installed").write_text(PRODUCT_SHA + "\n", encoding="ascii")
            (release_root / "installed").chmod(0o644)
            (release / "source" / source_base).write_text('{"services":{"web":{"privileged":true}}}\n', encoding="utf-8")
            changed_base_sha = hashlib.sha256((release / "source" / source_base).read_bytes()).hexdigest()
            ops_sha = hashlib.sha256((release / "source" / source_ops).read_bytes()).hexdigest()
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_release_binding(
                    release_root,
                    release_state.DISCOVER_INSTALLED,
                    source_base,
                    source_ops,
                    changed_base_sha,
                    ops_sha,
                    PRODUCT_SHA,
                    OPERATIONS_SHA,
                    "0" * 64,
                    expected_uid=os.getuid(),
                    expected_gid=os.getgid(),
                )

    def test_v3_candidate_release_rejects_unbound_source_tree_file(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-release-state-v3-tree-drift-") as temporary:
            release_root, base_name, ops_name, manifest_sha = build_release_state_fixture(Path(temporary), current_bundle=True)
            release = release_root / PRODUCT_SHA
            source = release / "source"
            (source / "unexpected.txt").write_text("unbound\n", encoding="ascii")
            (source / "unexpected.txt").chmod(0o644)
            with self.assertRaises(release_state.ReleaseBindingError):
                release_state.inspect_release_binding(
                    release_root,
                    PRODUCT_SHA,
                    base_name,
                    ops_name,
                    hashlib.sha256((source / base_name).read_bytes()).hexdigest(),
                    hashlib.sha256((source / ops_name).read_bytes()).hexdigest(),
                    PRODUCT_SHA,
                    OPERATIONS_SHA,
                    manifest_sha,
                    expected_uid=os.getuid(),
                    expected_gid=os.getgid(),
                )

    def test_workflow_runs_uses_read_only_get_with_exact_commit_filters(self) -> None:
        response = CompletedProcess(
            ["gh", "api"],
            0,
            stdout="push\tmain\t" + PRODUCT_SHA + "\tcompleted\tsuccess\n",
            stderr="",
        )
        with patch.object(operator, "_safe_run", return_value=response) as request:
            runs = operator._workflow_runs(PRODUCT_SHA)
        command = request.call_args.args[0]
        self.assertEqual(request.call_args.kwargs["timeout"], 30)
        self.assertEqual(runs, [successful_main_push(PRODUCT_SHA)])
        self.assertEqual(command[command.index("--method") + 1], "GET")
        self.assertIn(f"head_sha={PRODUCT_SHA}", command)
        self.assertIn("event=push", command)
        self.assertIn("branch=main", command)

    def test_default_docker_runner_executes_without_duplicate_check_argument(self) -> None:
        response = CompletedProcess(["docker", "version"], 0, stdout="", stderr="")
        with patch.object(operator.subprocess, "run", return_value=response) as docker:
            result = operator._default_docker_runner(
                ["docker", "version"], capture_output=True, text=True, check=False
            )
        self.assertIs(result, response)
        docker.assert_called_once_with(
            ["docker", "version"], capture_output=True, text=True, check=False
        )

    def test_cli_rejects_non_macos_before_commit_or_target_actions(self) -> None:
        with patch.object(operator.sys, "platform", "linux"), patch.object(
            operator, "verify_commit_gates", side_effect=AssertionError("commit gate must not run")
        ):
            with patch("sys.stderr", io.StringIO()) as stderr:
                result = operator.main(
                    [
                        "validate",
                        "--product-commit",
                        PRODUCT_SHA,
                        "--operations-commit",
                        OPERATIONS_SHA,
                        "--product-source",
                        "/unused",
                    ]
                )
        self.assertEqual(result, 1)
        self.assertIn("restricted to macOS", stderr.getvalue())

    def test_historical_product_commit_with_exact_main_push_ci_is_accepted(self) -> None:
        operator.check_commit_acceptance(
            "product",
            PRODUCT_SHA,
            is_in_main=True,
            runs=[successful_main_push(PRODUCT_SHA)],
        )

    def test_pull_request_ci_alone_is_rejected(self) -> None:
        with self.assertRaises(operator.OperatorError):
            operator.check_commit_acceptance(
                "product",
                PRODUCT_SHA,
                is_in_main=True,
                runs=[{**successful_main_push(PRODUCT_SHA), "event": "pull_request"}],
            )

    def test_product_commit_outside_origin_main_is_rejected(self) -> None:
        with self.assertRaises(operator.OperatorError):
            operator.check_commit_acceptance(
                "product",
                PRODUCT_SHA,
                is_in_main=False,
                runs=[successful_main_push(PRODUCT_SHA)],
            )

    def test_operations_commit_without_its_own_main_push_ci_is_rejected(self) -> None:
        with self.assertRaises(operator.OperatorError):
            operator.check_commit_acceptance(
                "operations",
                OPERATIONS_SHA,
                is_in_main=True,
                runs=[successful_main_push("3" * 40)],
            )

    def test_operations_commit_outside_origin_main_is_rejected(self) -> None:
        with self.assertRaises(operator.OperatorError):
            operator.check_commit_acceptance(
                "operations",
                OPERATIONS_SHA,
                is_in_main=False,
                runs=[successful_main_push(OPERATIONS_SHA)],
            )

    def test_bundle_binds_manifest_and_archives_to_both_commits(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-bundle-") as temporary:
            output, manifest_sha, images, commands, source = build_fixture_bundle(Path(temporary))
            manifest = operator.verify_bundle(output, PRODUCT_SHA, OPERATIONS_SHA, manifest_sha, source)
            self.assertEqual(manifest["productCommit"], PRODUCT_SHA)
            self.assertEqual(manifest["operationsCommit"], OPERATIONS_SHA)
            self.assertEqual(manifest["images"]["runtime"]["imageId"], images["runtime"][0])
            self.assertEqual(manifest["images"]["web"]["imageId"], images["web"][0])
            self.assertEqual([command[1] for command in commands], ["build", "save", "build", "save"])
            self.assertTrue(all(command[0] == "docker" for command in commands))

    def test_manifest_sha_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-manifest-") as temporary:
            bundle = Path(temporary)
            (bundle / "manifest.json").write_text("{}\n", encoding="utf-8")
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, "0" * 64, ROOT)

    def test_bundle_rejects_compose_source_drift_from_bound_product_checkout(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-compose-source-drift-") as temporary:
            bundle, manifest_sha, _, _, source = build_fixture_bundle(Path(temporary))
            (source / "platform-infra/docker-compose.catering-target.json").write_text(
                '{"services":{"web":{"privileged":true}}}\n', encoding="utf-8"
            )
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, manifest_sha, source)

    def test_manifest_bound_to_another_operations_commit_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-binding-") as temporary:
            bundle, _, _, _, source = build_fixture_bundle(Path(temporary))
            manifest_path = bundle / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["operationsCommit"] = "3" * 40
            manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            wrong_binding_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, wrong_binding_sha, source)

    def test_archive_digest_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-digest-") as temporary:
            bundle, manifest_sha, _, _, source = build_fixture_bundle(Path(temporary))
            (bundle / "runtime-image.tar.gz").write_bytes(b"changed archive")
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, manifest_sha, source)

    def test_missing_image_archive_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-missing-") as temporary:
            bundle, manifest_sha, _, _, source = build_fixture_bundle(Path(temporary))
            (bundle / "runtime-image.tar.gz").rename(bundle / "runtime-image.tar.gz.moved")
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, manifest_sha, source)

    def test_operator_invokes_production_runner_without_legacy_workflow_path(self) -> None:
        command = operator.production_runner_command(ROOT, "--update")
        self.assertEqual(Path(command[1]).name, "catering-target-production-update.sh")
        self.assertNotEqual(Path(command[1]).name, "update-catering-target.sh")
        self.assertFalse(operator.is_legacy_target_path(command))

    def test_runner_exposes_separate_stage_apply_and_verify_phases(self) -> None:
        for phase in ("--stage", "--apply", "--verify"):
            command = operator.production_runner_command(ROOT, phase)
            self.assertEqual(command[-1], phase)
            self.assertNotIn("update-catering-target.sh", command)

    def test_verify_phase_uses_local_bindings_without_github_commit_gates(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-verify-") as temporary:
            product = Path(temporary) / "product"
            bundle = Path(temporary) / "bundle"
            product.mkdir()
            bundle.mkdir()
            with patch.object(operator, "require_macos"), patch.object(operator, "repository_root", return_value=ROOT), patch.object(
                operator, "_validate_checkout", side_effect=[ROOT, product.resolve()]
            ), patch.object(operator, "verify_commit_gates", side_effect=AssertionError("verify must not contact GitHub")), patch.object(
                operator, "verify_bundle", return_value={}
            ), patch.object(operator, "_run_production_phase") as run_phase:
                result = operator.main([
                    "verify", "--product-commit", PRODUCT_SHA, "--operations-commit", OPERATIONS_SHA,
                    "--product-source", str(product), "--bundle-dir", str(bundle), "--manifest-sha256", "3" * 64,
                ])
            self.assertEqual(result, 0)
            self.assertEqual(run_phase.call_args.args[0][-1], "--verify")

    def test_operator_bundle_phase_has_no_host_mutation_commands(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-phases-") as temporary:
            _, _, _, commands, _ = build_fixture_bundle(Path(temporary))
            forbidden = {"ssh", "rsync", "gh", "update-catering-target.sh"}
            self.assertFalse(any(Path(command[0]).name in forbidden for command in commands))
            self.assertFalse(any(" compose up " in " ".join(command) for command in commands))

    def test_product_context_excludes_ignored_local_environment_files(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-context-") as temporary:
            source = Path(temporary) / "source"
            source.mkdir()
            subprocess.run(["git", "init", str(source)], capture_output=True, check=True)
            subprocess.run(["git", "-C", str(source), "config", "user.name", "Catering operator test"], check=True)
            subprocess.run(["git", "-C", str(source), "config", "user.email", "operator-test@example.invalid"], check=True)
            (source / ".gitignore").write_text(".env\n", encoding="utf-8")
            (source / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
            nested = source / "nested"
            nested.mkdir()
            executable = nested / "entry.sh"
            executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            executable.chmod(0o755)
            subprocess.run(["git", "-C", str(source), "add", ".gitignore", "Dockerfile", "nested/entry.sh"], check=True)
            subprocess.run(["git", "-C", str(source), "commit", "-m", "fixture"], capture_output=True, check=True)
            commit = subprocess.run(
                ["git", "-C", str(source), "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                check=True,
            ).stdout.strip()
            (source / ".env").write_text("SYNTHETIC_LOCAL_VALUE=not-for-build\n", encoding="utf-8")
            destination = Path(temporary) / "context"
            previous_umask = os.umask(0o077)
            try:
                operator.export_product_context(source, commit, destination)
            finally:
                os.umask(previous_umask)
            self.assertTrue((destination / "Dockerfile").is_file())
            self.assertFalse((destination / ".env").exists())
            self.assertEqual(destination.stat().st_mode & 0o777, 0o755)
            self.assertEqual((destination / "nested").stat().st_mode & 0o777, 0o755)
            self.assertEqual((destination / "Dockerfile").stat().st_mode & 0o777, 0o644)
            self.assertEqual((destination / "nested/entry.sh").stat().st_mode & 0o777, 0o755)


if __name__ == "__main__":
    unittest.main()
