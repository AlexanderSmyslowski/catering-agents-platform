"""Focused postmigration NUE image-only boundaries; no live Docker or host access."""
import datetime
import importlib.util
import json
import hashlib
import gzip
from pathlib import Path
import re
import subprocess
import shutil
import sys
import tempfile
from types import SimpleNamespace
import unittest
from contextlib import redirect_stderr
import io
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("nue", ROOT / "platform-infra/scripts/catering_target_nue_image_update.py")
nue = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(nue)


class NueTests(unittest.TestCase):
    def test_compose_changes_only_five_image_values(self):
        services = {s: {"image": "old", "restart": "unless-stopped", "environment": {"EXAMPLE": "value"}, "networks": ["private"]} for s in nue.SERVICES}
        original = {"name": "platform-infra", "services": services, "networks": {"private": {"external": True}}, "volumes": {"untouched": {"external": True}}}
        images = {s: "sha256:" + "1" * 64 for s in nue.SERVICES}
        changed = json.loads(nue.candidate_compose(json.dumps(original).encode(), images))
        for s in nue.SERVICES:
            self.assertEqual(changed["services"][s].pop("image"), images[s])
            original["services"][s].pop("image")
        self.assertEqual(changed, original)

    def test_compose_rejects_extra_service_and_build(self):
        for extra in (True, False):
            value = {"services": {s: {"image": "old"} for s in nue.SERVICES}}
            if extra: value["services"]["postgres"] = {"image": "pg"}
            else: value["services"]["web"]["build"] = "."
            with self.assertRaisesRegex(RuntimeError, "NUE_(COMPOSE_SERVICE_SCOPE|IMAGE_ONLY_SERVICE)"):
                nue.candidate_compose(json.dumps(value).encode(), {s: "candidate" for s in nue.SERVICES})

    def test_schema_region_and_literal_ddl_drift_detected(self):
        base = {"shared-core/src/persistence.ts": b"const BUSINESS_RECORDS_SCHEMA_MIGRATION = `CREATE TABLE records (id TEXT)`;\nfunction getCachedPool() {}"}
        expected = nue.schema_binding(base)
        unrelated = {**base, "offer-service/src/ordinary.ts": b"const label='harmless';"}
        self.assertEqual(nue.schema_binding(unrelated), expected)
        extra = {**base, "offer-service/src/new.ts": b"const sql='ALTER TABLE records ADD secret TEXT';"}
        self.assertNotEqual(nue.schema_binding(extra)["ddl"], expected["ddl"])
        changed = {key: value.replace(b"id TEXT", b"id INTEGER") for key, value in base.items()}
        self.assertNotEqual(nue.schema_binding(changed)["migration"], expected["migration"])
        with self.assertRaisesRegex(RuntimeError, "SCHEMA_REGION_MISSING"):
            nue.schema_binding({"shared-core/src/persistence.ts": b"export {}"})

    def test_backend_schema_matches_existing_no_drift_algorithm(self):
        value = nue.source_schema(ROOT)
        shell = (ROOT / "platform-infra/scripts/catering-target-production-update.sh").read_text()
        code = re.search(r"runtime_ddl_manifest_hash\(\).*?<<'PY'\n(.*?)\nPY", shell, re.S).group(1)
        original = subprocess.check_output([sys.executable, "-B", "-c", code, str(ROOT)], text=True).strip()
        self.assertEqual(value["ddl"], original)
        # An extra source root must not be silently skipped in the narrower mode.
        with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(RuntimeError, "SOURCE_RUNTIME_ROOT"):
            nue.source_schema(Path(tmp))

    def test_stop_uncertainty_settles_before_resume(self):
        pending = {"old-id"}
        with patch.object(nue, "inspect", side_effect=[[{"State": {"Running": True}}], [{"State": {"Running": False}}]]), patch.object(nue.time, "sleep"):
            nue.settle_stops(pending)
        self.assertEqual(pending, set())

    def test_stop_uncertainty_keeps_lock(self):
        with patch.object(nue, "inspect", return_value=[{"State": {"Running": True}}]), patch.object(nue.time, "monotonic", side_effect=[0, 181]):
            with self.assertRaisesRegex(RuntimeError, "NUE_STOP_OUTCOME_UNKNOWN_KEEP_LOCK"):
                nue.settle_stops({"old-id"})

    def test_pause_disables_all_restarts_before_unbounded_stops(self):
        baseline, rows = {}, []
        for s in nue.SERVICES:
            row = {"Id": s, "Name": "/platform-infra-" + s + "-1", "Image": "old", "Mounts": [], "HostConfig": {"RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}, "PortBindings": {}}, "NetworkSettings": {"Networks": {"private": {}}}, "Config": {"Env": []}, "State": {"Running": True}}
            rows.append(row); baseline[row["Name"].lstrip("/")] = nue.container_binding(row)
        calls = []
        inspected = iter([rows] + [item for row in rows for item in ([row], [{**row, "State": {"Running": False}}])])
        with patch.object(nue, "inspect", side_effect=lambda names: next(inspected)), patch.object(nue, "owned"), patch.object(nue, "command", side_effect=lambda argv, **kw: calls.append(argv)):
            nue.pause_applications({"containers": baseline}, {"old"}, set(), "token")
        self.assertTrue(all(c[1] == "update" for c in calls[:5]))
        self.assertTrue(all(c[1:4] == ["stop", "--timeout", "-1"] for c in calls[5:]))

    def proof(self):
        return {"capture": {"sourceResumed": True, "files": list(range(17)), "manifestSha256": "c" * 64}, "restore": {"status": "ALL_THREE_DATABASES_GLOBALS_AND_REQUIRED_FILES_IDENTICAL", "databases": 3, "fileTrees": 8, "probeContainerRemoved": True, "runId": "a" * 32}, "captureCleanup": {"status": "OWN_TMPFS_UNMOUNTED", "runId": "a" * 32}, "finalHealth": {"status": "ORIGINAL_SEVEN_CONTAINERS_POLICIES_DATABASE_SCOPE_AND_HTTPS_HEALTHY"}, "snapshotId": "b" * 64, "manifestSha256": "c" * 64, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "runId": "a" * 32}

    def run_apply_failure(self, tmp, recovery_fails=False, preflight_fails=False, loaded_mutation=None):
        sha = "a" * 64; bundle = tmp / sha; bundle.mkdir()
        compose = tmp / "compose.json"
        old = json.dumps({"services": {s: {"image": "old"} for s in nue.SERVICES}}).encode(); compose.write_bytes(old)
        smoke = tmp / "smoke"; smoke.write_bytes(b"#!/bin/sh\nexit 0\n"); smoke.chmod(0o700)
        baseline = {"files": {str(compose): {"uid": 0, "gid": 0, "mode": 0o600}}, "containers": {"platform-infra-" + s + "-1": {"id": s, "image": "old", "restart": {"Name": "unless-stopped", "MaximumRetryCount": 0}} for s in nue.SERVICES}}
        binding = {"platformManifestDigest": "sha256:" + "1" * 64, "configDigest": "sha256:" + "2" * 64}
        manifest = {"schemaBinding": {}, "images": {r: dict(binding) for r in ("runtime", "web")}}
        (bundle / "stage.json").write_text(json.dumps({"manifestSha256": sha, "mode": "nue-image-only", "baselineSha256": "b" * 64, "backupProofSha256": "c" * 64}))
        events = []
        oci = nue.load_module("nue_test_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        def run(argv, **kwargs):
            events.append(argv)
            if argv[:3] == ["docker", "image", "inspect"]:
                row = {"Id": binding["configDigest"] if loaded_mutation == "config-id" else binding["platformManifestDigest"], "Os": "linux", "Architecture": "amd64"}
                if loaded_mutation == "descriptor": row["Descriptor"] = {"digest": binding["configDigest"]}
                return json.dumps([row]).encode()
            if argv[:2] == ["docker", "save"]: Path(argv[3]).write_bytes(b"fixture")
            if "psql" in argv: return b"0"
            return b""
        verify_results = [RuntimeError("CANDIDATE_HEALTH_FAIL"), RuntimeError("ROLLBACK_FAIL") if recovery_fails else {}]
        with patch.multiple(nue, RELEASES=tmp, COMPOSE=compose), patch.object(nue, "host_identity"), patch.object(nue, "protected", side_effect=lambda p, **kw: Path(p)), patch.object(nue, "require_admission"), patch.object(nue, "verify_bundle", return_value=manifest), patch.object(nue, "read_bound", side_effect=lambda p, sha: baseline if Path(p).name == "baseline.json" else {}), patch.object(nue, "backup_gate"), patch.object(nue, "own_lock", return_value="token"), patch.object(nue, "owned"), patch.object(nue, "snapshot", return_value={} if preflight_fails else baseline), patch.object(nue, "runtime_schema", return_value={}), patch.object(nue, "command", side_effect=run), patch.object(nue, "load_module", side_effect=lambda name, path: oci if str(path).endswith("catering_target_oci.py") else SimpleNamespace(_inspect_archive=lambda p: binding)), patch.object(nue, "replace_compose", side_effect=lambda body, meta, token: compose.write_bytes(body)), patch.object(nue, "pause_applications") as pause, patch.object(nue, "compose_up") as up, patch.object(nue, "set_policies"), patch.object(nue, "verify_runtime", side_effect=verify_results), patch.object(nue, "unlock") as unlock:
            expected_error = self.assertRaises(ValueError) if loaded_mutation else self.assertRaisesRegex(RuntimeError, "NUE_BASELINE_CHANGED|CANDIDATE_HEALTH_FAIL")
            with expected_error:
                nue.apply(bundle, sha, smoke, hashlib.sha256(smoke.read_bytes()).hexdigest())
            return bundle, old, compose.read_bytes(), pause.call_count, up.call_count, unlock.call_count

    def test_candidate_failure_pauses_candidates_and_verifies_real_image_rollback(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle, old, after, pauses, starts, unlocks = self.run_apply_failure(Path(tmp))
            self.assertEqual(after, old)
            self.assertEqual((pauses, starts, unlocks), (2, 2, 1))
            self.assertEqual(json.loads((bundle / "rollback-verified.json").read_text())["dataRolledBack"], False)
            self.assertFalse((bundle / "installed.json").exists())

    def test_failed_recovery_retains_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle, _, _, pauses, starts, unlocks = self.run_apply_failure(Path(tmp), recovery_fails=True)
            self.assertEqual((pauses, starts, unlocks), (2, 2, 0))
            self.assertTrue(json.loads((bundle / "recovery-hold-token.json").read_text())["lockRetained"])

    def test_changed_baseline_never_pauses_or_starts_writers(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, old, after, pauses, starts, unlocks = self.run_apply_failure(Path(tmp), preflight_fails=True)
            self.assertEqual(after, old)
            self.assertEqual((pauses, starts, unlocks), (0, 0, 1))

    def test_loaded_config_id_and_wrong_descriptor_fail_before_writer_pause(self):
        for mutation in ("config-id", "descriptor"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as tmp:
                _, old, after, pauses, starts, unlocks = self.run_apply_failure(Path(tmp), loaded_mutation=mutation)
                self.assertEqual(after, old)
                self.assertEqual((pauses, starts, unlocks), (0, 0, 1))

    def test_running_candidate_checks_observed_manifest_descriptor(self):
        oci = nue.load_module("nue_running_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        m, c = "sha256:" + "1" * 64, "sha256:" + "2" * 64
        for row in ({"Image": c, "State": {"Running": True}}, {"Image": m, "State": {"Running": True}, "ImageManifestDescriptor": {"digest": c}}):
            with self.subTest(row=row), self.assertRaises(ValueError): oci.check_running_container(row, m)

    def test_candidate_postflight_invokes_running_oci_gate(self):
        oci = nue.load_module("nue_postflight_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        m, c = "sha256:" + "1" * 64, "sha256:" + "2" * 64
        with tempfile.TemporaryDirectory() as tmp:
            compose = Path(tmp) / "compose.json"; compose.write_bytes(b"{}")
            baseline = {"networks": [], "volumes": [], "catalogue": {}, "files": {str(compose): {"sha256": nue.digest(compose)}}, "containers": {}}
            bad = {"Name": "/platform-infra-web-1", "Image": m, "State": {"Running": True}, "ImageManifestDescriptor": {"digest": c}}
            with patch.object(nue, "COMPOSE", compose), patch.object(nue, "snapshot", return_value=baseline), patch.object(nue, "inspect", return_value=[bad]), patch.object(nue, "health") as health:
                with self.assertRaises(ValueError): nue.verify_runtime(baseline, {s: m for s in nue.SERVICES}, b"{}", candidate_oci=oci)
                health.assert_not_called()

    def test_remote_stage_and_apply_without_admission_never_take_lock(self):
        with patch.object(nue, "host_identity"), patch.object(nue, "protected", side_effect=lambda p, **kw: Path(p)), patch.object(nue, "verify_bundle", return_value={}), patch.object(nue, "own_lock") as lock:
            with self.assertRaisesRegex(RuntimeError, "NUE_FRESH_MAC_ADMISSION_REQUIRED"):
                nue.stage(Path("/bundle"), "a" * 64, Path("/baseline"), "b" * 64, Path("/proof"), "c" * 64)
            with self.assertRaisesRegex(RuntimeError, "NUE_FRESH_MAC_ADMISSION_REQUIRED"):
                nue.apply(nue.RELEASES / ("a" * 64), "a" * 64, Path("/smoke"), "d" * 64)
            lock.assert_not_called()

    def test_static_host_cli_cannot_self_declare_operator_admission(self):
        for phase in ("stage", "apply"):
            args = [phase, "--bundle-dir", "/bundle", "--manifest-sha256", "a" * 64, "--admission", "/forged-admission", "--admission-sha256", "b" * 64]
            with self.subTest(phase=phase), patch.object(nue, "stage") as stage, patch.object(nue, "apply") as apply, redirect_stderr(io.StringIO()) as error:
                self.assertEqual(nue.main(args), 1)
                self.assertIn("NUE_TRUSTED_MAC_CALLER_REQUIRED", error.getvalue())
                stage.assert_not_called(); apply.assert_not_called()

    def test_admission_binds_phase_params_commits_and_short_expiry(self):
        manifest = {"productCommit": "1" * 40, "operationsCommit": "2" * 40, "sourceTreeSha256": "3" * 64, "helpers": {"payload": "4" * 64}}
        params = {"protectedSmoke": "/smoke", "protectedSmokeSha256": "5" * 64}
        bundle = nue.RELEASES / ("a" * 64)
        gate = nue.make_admission(manifest, "a" * 64, "apply", str(bundle), "/admission.json", params)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "admission.json"
            path.write_bytes(nue.canonical(gate["admission"]))
            with patch.object(nue, "protected", return_value=path):
                nue.require_admission(path, gate["admissionSha256"], manifest, "a" * 64, "apply", bundle, params)
                for phase, parameters in (("stage", params), ("apply", {**params, "protectedSmoke": "/changed"})):
                    with self.assertRaisesRegex(RuntimeError, "NUE_ADMISSION_"):
                        nue.require_admission(path, gate["admissionSha256"], manifest, "a" * 64, phase, bundle, parameters)
                changed = dict(gate["admission"], issuedAt=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=16)).isoformat())
                path.write_bytes(nue.canonical(changed))
                with self.assertRaisesRegex(RuntimeError, "NUE_MAC_ADMISSION_EXPIRED"):
                    nue.require_admission(path, nue.digest(path), manifest, "a" * 64, "apply", bundle, params)

    def gate_args(self, operator, phase="stage"):
        argv = ["nue-" + phase + "-gate", "--target", "catering-prod-02", "--product-commit", "1" * 40, "--operations-commit", "2" * 40, "--product-source", "/product", "--bundle-dir", "/bundle", "--manifest-sha256", "a" * 64, "--remote-bundle-dir", "/remote-bundle" if phase == "stage" else str(nue.RELEASES / ("a" * 64)), "--remote-admission-path", "/admission.json"]
        argv += (["--expected-baseline", "/baseline", "--expected-baseline-sha256", "b" * 64, "--backup-proof", "/proof", "--backup-proof-sha256", "c" * 64] if phase == "stage" else ["--protected-smoke", "/smoke", "--protected-smoke-sha256", "d" * 64])
        return argv, operator._arguments().parse_args(argv)

    def test_stage_and_apply_gate_reject_nonmain_or_unfinished_ci_before_admission(self):
        from catering_target_operator_test import operator
        for phase in ("stage", "apply"):
            argv, _ = self.gate_args(operator, phase)
            for in_main in (True, False):
                def rejected(*args): operator.check_commit_acceptance("product", "1" * 40, is_in_main=in_main, runs=[])
                with self.subTest(phase=phase, in_main=in_main), patch.object(operator, "require_macos"), patch.object(operator, "verify_commit_gates", side_effect=rejected), patch.object(operator, "nue_admission") as admit, redirect_stderr(io.StringIO()):
                    self.assertEqual(operator.main(argv), 1)
                    admit.assert_not_called()

    def test_gate_rejects_forged_product_source_and_ops_helper_relation(self):
        from catering_target_operator_test import operator
        _, args = self.gate_args(operator)
        manifest = {"productCommit": args.product_commit, "operationsCommit": args.operations_commit, "sourceTreeSha256": "3" * 64, "helpers": {"catering_target_oci.py": nue.digest(ROOT / "platform-infra/scripts/catering_target_oci.py")}}
        with patch.object(operator, "_nue", return_value=nue), patch.object(nue, "verify_bundle", return_value=manifest):
            with patch.object(operator, "_bound_product_source_tree_digest", return_value="wrong"), self.assertRaisesRegex(operator.OperatorError, "exact accepted product"):
                operator.nue_admission(ROOT, Path("/product"), args)
            manifest["helpers"]["catering_target_oci.py"] = "4" * 64
            with patch.object(operator, "_bound_product_source_tree_digest", return_value="3" * 64), self.assertRaisesRegex(operator.OperatorError, "accepted operations commit"):
                operator.nue_admission(ROOT, Path("/product"), args)

    def test_restore_gates_reject_partial_cleanup_or_stale_proof(self):
        for mutation in ("databases", "cleanup", "stale", "run"):
            proof = self.proof()
            if mutation == "databases": proof["restore"]["databases"] = 1
            if mutation == "cleanup": proof["captureCleanup"]["status"] = "UNKNOWN"
            if mutation == "stale": proof["at"] = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).isoformat()
            if mutation == "run": proof["restore"]["runId"] = "d" * 32
            with self.subTest(mutation=mutation), self.assertRaises(RuntimeError): nue.backup_gate(proof, {})

    def test_complete_restore_proof_requires_same_original_seven_containers_and_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); proof = self.proof(); run = proof["runId"]
            proof["restore"].update(manifestSha256=proof["manifestSha256"], outerSha256="d" * 64)
            proof["outer"] = {"sha256": "d" * 64, "bytes": 123}
            original = [{"Name": "/" + name, "Id": name, "Image": "old", "HostConfig": {"RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}}} for name in nue.NAMES]
            baseline = {"containers": {name: {"id": name, "image": "old", "restart": {"Name": "unless-stopped", "MaximumRetryCount": 0}} for name in nue.NAMES}}
            documents = {"capture.json": {"files": 16, "manifestSha256": proof["manifestSha256"], "runId": run}, "restore.json": proof["restore"], "resume.json": {"status": "ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED", "runId": run}, "original-state.json": original}
            for phase in ("capture", "restore"): documents[phase + "-cleanup.json"] = {"status": "OWN_TMPFS_UNMOUNTED", "runId": run, "phase": phase}
            for name, value in documents.items(): (root / name).write_text(json.dumps(value))
            def protected(path, directory=False): return root if directory else root / Path(path).name
            with patch.object(nue, "protected", side_effect=protected):
                nue.backup_gate(proof, baseline)
                original[0]["Id"] = "different-source"
                (root / "original-state.json").write_text(json.dumps(original))
                with self.assertRaisesRegex(RuntimeError, "NUE_BACKUP_BASELINE_BINDING"): nue.backup_gate(proof, baseline)
                (root / "restore-cleanup.json").write_text(json.dumps({"status": "NOT_CLEANED"}))
                with self.assertRaisesRegex(RuntimeError, "NUE_DURABLE_CLEANUP_PROOF"): nue.backup_gate(proof, baseline)

    def test_foreign_lock_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "lock"; path.mkdir(); marker = path / "owner.json"; marker.write_text("foreign")
            with patch.object(nue, "LOCK", path), self.assertRaisesRegex(RuntimeError, "NUE_FOREIGN_UPDATE_LOCK"):
                nue.own_lock()
            self.assertEqual(marker.read_text(), "foreign")

    def test_historical_target02_gate_stays_migration_only(self):
        from catering_target_operator_test import operator
        with self.assertRaises(operator.OperatorError):
            operator.validate_target("catering-prod-02", "c3bf1e83127aa96442c3e48d00350ce1ad9c04a5", "2" * 40)
        args = operator._arguments().parse_args(["nue-bundle", "--target", "catering-prod-02", "--product-commit", "1" * 40, "--operations-commit", "2" * 40, "--product-source", "/product", "--output-dir", "/bundle", "--node-base", "node@sha256:" + "3" * 64, "--caddy-base", "caddy@sha256:" + "4" * 64])
        self.assertEqual(args.phase, "nue-bundle")

    def test_new_bundle_binds_actual_full_source_lockfile_helpers_and_oci(self):
        from catering_target_operator_test import operator
        from catering_target_v4_test import archive_fixture
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / "source"; source.mkdir(mode=0o755)
            for directory in nue.RUNTIME_ROOTS: (source / directory).mkdir(parents=True, mode=0o755)
            (source / "shared-core/src/persistence.ts").write_text("const BUSINESS_RECORDS_SCHEMA_MIGRATION=`CREATE TABLE records(id TEXT)`;\nfunction getCachedPool() {}")
            (source / "package.json").write_text("{}"); (source / "package-lock.json").write_text('{"lockfileVersion":3}')
            docker = source / "platform-infra/docker"; docker.mkdir(parents=True)
            (docker / "Dockerfile.runtime").write_text("FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\n")
            (docker / "Dockerfile.web").write_text("FROM node:22-alpine AS build\nWORKDIR /app\nCOPY . .\nRUN npm ci\nFROM caddy:2.10-alpine\n")
            fixtures = {role: archive_fixture(role, "manifest") for role in ("runtime", "web")}
            calls = []
            def command(argv, **kwargs):
                calls.append(argv)
                if argv[:3] == ["docker", "image", "inspect"]: return json.dumps([{"Id": "sha256:" + "3" * 64, "Os": "linux", "Architecture": "amd64"}]).encode()
                role = "runtime" if "runtime" in argv[argv.index("--file") + 1] else "web"
                Path(argv[argv.index("--iidfile") + 1]).write_text(fixtures[role][2])
                return b""
            def save(identity, path):
                role = next(role for role in fixtures if fixtures[role][2] == identity)
                path.write_bytes(gzip.compress(fixtures[role][1]))
            with patch.object(nue, "command", side_effect=command), patch.object(operator, "export_product_context", side_effect=lambda src, sha, dst: shutil.copytree(src, dst)), patch.object(operator, "_save_docker_image", side_effect=save):
                out = root / "bundle"
                sha = nue.create_bundle(operator, source, "1" * 40, "2" * 40, out, "node@sha256:" + "4" * 64, "caddy@sha256:" + "5" * 64)
            manifest = nue.verify_bundle(out, sha)
            self.assertEqual((manifest["targetId"], manifest["mode"]), ("catering-prod-02", "nue-image-only"))
            self.assertTrue(all("--pull=false" in call for call in calls if call[1] == "build"))
            self.assertIn("FROM node@sha256:", (out / "Dockerfile.runtime.bound").read_text())
            (out / "source/package-lock.json").write_text("tampered")
            with self.assertRaisesRegex(RuntimeError, "NUE_FULL_SOURCE_BINDING"): nue.verify_bundle(out, sha)

    def test_floating_bases_fail_before_any_build(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(nue, "command") as command:
            with self.assertRaisesRegex(RuntimeError, "NUE_PINNED_BASE_REQUIRED"):
                nue.create_bundle(None, Path(tmp), "1" * 40, "2" * 40, Path(tmp) / "bundle", "node:22-alpine", "caddy:2.10-alpine")
            command.assert_not_called()


if __name__ == "__main__": unittest.main()
