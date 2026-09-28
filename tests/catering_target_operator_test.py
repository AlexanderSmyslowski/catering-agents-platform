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


def build_fixture_bundle(base: Path) -> tuple[Path, str, dict[str, tuple[str, bytes]], list[list[str]]]:
    source = base / "source"
    (source / "platform-infra/docker").mkdir(parents=True)
    (source / "platform-infra/docker/Dockerfile.runtime").write_text("FROM scratch\n", encoding="utf-8")
    (source / "platform-infra/docker/Dockerfile.web").write_text("FROM scratch\n", encoding="utf-8")
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
    return output, manifest_sha, images, commands


def build_release_state_fixture(base: Path, *, current_bundle: bool) -> tuple[Path, str, str, str]:
    release_root = base / "releases"
    release = release_root / PRODUCT_SHA
    source = release / "source/platform-infra"
    source.mkdir(parents=True)
    base_name = "platform-infra/catering-target-compose.json"
    ops_name = "platform-infra/catering-target-operations.json"
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
            "schemaVersion": 1,
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
            output, manifest_sha, images, commands = build_fixture_bundle(Path(temporary))
            manifest = operator.verify_bundle(output, PRODUCT_SHA, OPERATIONS_SHA, manifest_sha)
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
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, "0" * 64)

    def test_manifest_bound_to_another_operations_commit_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-binding-") as temporary:
            bundle, _, _, _ = build_fixture_bundle(Path(temporary))
            manifest_path = bundle / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["operationsCommit"] = "3" * 40
            manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            wrong_binding_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, wrong_binding_sha)

    def test_archive_digest_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-digest-") as temporary:
            bundle, manifest_sha, _, _ = build_fixture_bundle(Path(temporary))
            (bundle / "runtime-image.tar.gz").write_bytes(b"changed archive")
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, manifest_sha)

    def test_missing_image_archive_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-missing-") as temporary:
            bundle, manifest_sha, _, _ = build_fixture_bundle(Path(temporary))
            (bundle / "runtime-image.tar.gz").rename(bundle / "runtime-image.tar.gz.moved")
            with self.assertRaises(operator.OperatorError):
                operator.verify_bundle(bundle, PRODUCT_SHA, OPERATIONS_SHA, manifest_sha)

    def test_operator_invokes_production_runner_without_legacy_workflow_path(self) -> None:
        command = operator.production_runner_command(ROOT, "--update")
        self.assertEqual(Path(command[1]).name, "catering-target-production-update.sh")
        self.assertNotEqual(Path(command[1]).name, "update-catering-target.sh")
        self.assertFalse(operator.is_legacy_target_path(command))

    def test_operator_bundle_phase_has_no_host_mutation_commands(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catering-operator-phases-") as temporary:
            _, _, _, commands = build_fixture_bundle(Path(temporary))
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
            subprocess.run(["git", "-C", str(source), "add", ".gitignore", "Dockerfile"], check=True)
            subprocess.run(["git", "-C", str(source), "commit", "-m", "fixture"], capture_output=True, check=True)
            commit = subprocess.run(
                ["git", "-C", str(source), "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                check=True,
            ).stdout.strip()
            (source / ".env").write_text("SYNTHETIC_LOCAL_VALUE=not-for-build\n", encoding="utf-8")
            destination = Path(temporary) / "context"
            operator.export_product_context(source, commit, destination)
            self.assertTrue((destination / "Dockerfile").is_file())
            self.assertFalse((destination / ".env").exists())


if __name__ == "__main__":
    unittest.main()
