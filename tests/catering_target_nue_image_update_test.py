"""Focused postmigration NUE image-only boundaries; no live Docker or host access."""
import datetime
import base64
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
from contextlib import ExitStack, contextmanager, redirect_stderr
import io
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("nue", ROOT / "platform-infra/scripts/catering_target_nue_image_update.py")
nue = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(nue)


class NueTests(unittest.TestCase):
    @contextmanager
    def synthetic_current_host(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); compose = root / "compose.json"; sites = root / "sites"; sites.mkdir()
            (sites / "accepted.caddy").write_bytes(b":8081 {\n root * /srv\n file_server\n}\n")
            compose.write_text(json.dumps({"services": {s: {"image": "existing"} for s in nue.SERVICES}}))
            caddy_cmd = ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
            rows = []
            for service in nue.SERVICES:
                identity = nue.CURRENT_WEB_M if service == "web" else nue.CURRENT_RUNTIME_M
                row = {"Name": "/platform-infra-" + service + "-1", "Id": service + "-existing-id", "Image": identity,
                       "ImageManifestDescriptor": {"digest": identity, "mediaType": "application/vnd.oci.image.manifest.v1+json"}, "State": {"Running": True},
                       "Config": {"Cmd": caddy_cmd if service == "web" else ["npm", "run", "dev:" + service], "Entrypoint": None if service == "web" else ["docker-entrypoint.sh"], "WorkingDir": "/srv" if service == "web" else "/app", "Env": []},
                       "Mounts": [{"Type": "bind", "Destination": "/etc/caddy/sites", "Source": str(sites), "RW": False}] if service == "web" else [],
                       "HostConfig": {"RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}, "PortBindings": {}}, "NetworkSettings": {"Networks": {"catering_private": {}}}}
                rows.append(row)
            images = {identity: {"Id": identity, "Descriptor": {"digest": identity, "mediaType": "application/vnd.oci.image.manifest.v1+json"}, "Os": "linux", "Architecture": "amd64", "Config": {"Cmd": caddy_cmd, "Entrypoint": None}} for identity in (nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)}
            state = {"rows": rows, "images": images, "compose": compose, "sites": sites, "imageConfig": b":80 {\n root * /srv\n file_server\n}\n", "collision": False, "calls": []}
            def command(argv, **kwargs):
                state["calls"].append(argv)
                if argv[:3] == ["docker", "image", "inspect"]: return json.dumps([images[argv[-1]]]).encode()
                if "cat" in argv: return state["imageConfig"]
                if "sh" in argv and state["collision"]: raise RuntimeError("NUE_CURRENT_PATH_COLLISION")
                return b""
            with patch.object(nue, "host_identity"), patch.object(nue, "protected", side_effect=lambda p, **kw: Path(p)), patch.object(nue, "COMPOSE", compose), patch.object(nue, "inspect", side_effect=lambda names: rows), patch.object(nue, "command", side_effect=command):
                yield state

    @contextmanager
    def synthetic_issuer(self):
        with tempfile.TemporaryDirectory() as temporary:
            key = Path(temporary) / "synthetic-issuer"
            subprocess.run([nue.SSH_KEYGEN, "-q", "-t", "ed25519", "-N", "", "-f", str(key)], check=True, capture_output=True)
            public = " ".join(Path(str(key) + ".pub").read_text().split()[:2])
            fingerprint = "SHA256:" + base64.b64encode(hashlib.sha256(base64.b64decode(public.split()[1])).digest()).decode().rstrip("=")
            with patch.multiple(nue, OPERATOR_SIGNING_KEY=key, OPERATOR_PUBLIC_KEY=public, OPERATOR_KEY_FINGERPRINT=fingerprint):
                yield key

    def environment_row(self, entries):
        return {"Id": "synthetic", "Image": "old", "Mounts": [],
                "HostConfig": {"RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}, "PortBindings": {}},
                "NetworkSettings": {"Networks": {"private": {}}}, "Config": {"Env": entries}}

    def test_container_binding_preserves_values_independently_of_env_order(self):
        original = ["A=one", "EMPTY=", "TOKEN=left=right", "B=two"]
        self.assertEqual(nue.container_binding(self.environment_row(original)),
                         nue.container_binding(self.environment_row(list(reversed(original)))))
        baseline = nue.container_binding(self.environment_row(original))
        for changed in (["A=changed", *original[1:]], original[:-1], [*original, "EXTRA=new"]):
            with self.subTest(changed=changed):
                self.assertNotEqual(nue.container_binding(self.environment_row(changed)), baseline)

    def test_container_binding_rejects_ambiguous_or_invalid_environment(self):
        for entries in (None, {}, ["A=one", "A=one"], ["A=one", "A=two"], ["NO_EQUALS"],
                        ["=empty_name"], ["A\0=bad"], ["A=bad\0value"], [42]):
            with self.subTest(entries=entries), self.assertRaisesRegex(RuntimeError, "NUE_ENV_"):
                nue.container_binding(self.environment_row(entries))

    def test_reordered_environment_passes_runtime_preservation_but_real_changes_hold(self):
        with tempfile.TemporaryDirectory() as temporary:
            compose = Path(temporary) / "compose.json"; compose.write_bytes(b"candidate-compose")
            original = self.environment_row(["A=one", "B=two"])
            baseline = {"containers": {"platform-infra-offer-1": nue.container_binding(original)},
                        "files": {str(compose): {"sha256": "original", "mode": 0o600}},
                        "networks": ["private"], "volumes": ["data"], "catalogue": {"schema": 3}}
            current_row = {**original, "Id": "candidate", "Image": "new", "Config": {"Env": ["B=two", "A=one"]}}
            current = {**baseline, "containers": {"platform-infra-offer-1": nue.container_binding(current_row)},
                       "files": {str(compose): {"sha256": "candidate", "mode": 0o600}}}
            with patch.object(nue, "COMPOSE", compose), patch.object(nue, "snapshot", return_value=current), patch.object(nue, "health"):
                nue.verify_runtime(baseline, {"offer": "new"}, b"candidate-compose")
                current["containers"]["platform-infra-offer-1"] = nue.container_binding({**current_row, "Config": {"Env": ["B=changed", "A=one"]}})
                with self.assertRaisesRegex(RuntimeError, "NUE_CONTAINER_PRESERVATION"):
                    nue.verify_runtime(baseline, {"offer": "new"}, b"candidate-compose")

    def test_reverse_pause_accepts_reordered_values_and_blocks_drift_before_mutation(self):
        rows = [{**self.environment_row(["A=one", "B=two"]), "Id": service,
                 "Name": "/platform-infra-" + service + "-1", "State": {"Running": True}}
                for service in nue.SERVICES]
        baseline = {"containers": {row["Name"].lstrip("/"): nue.container_binding(row) for row in rows}}
        candidates = [{**row, "Id": row["Id"] + "-new", "Image": "new", "Config": {"Env": ["B=two", "A=one"]}}
                      for row in rows]
        inspected = iter([candidates] + [item for row in candidates for item in ([row], [{**row, "State": {"Running": False}}])])
        calls = []
        with patch.object(nue, "inspect", side_effect=lambda names: next(inspected)), patch.object(nue, "owned"), patch.object(nue, "command", side_effect=lambda argv, **kw: calls.append(argv)):
            nue.pause_applications(baseline, {"old", "new"}, set(), "own-token")
        self.assertEqual(len(calls), 10)
        self.assertTrue(all(call[:3] == ["docker", "update", "--restart=no"] for call in calls[:5]))
        candidates[-1]["Config"]["Env"] = ["B=changed", "A=one"]
        with patch.object(nue, "inspect", return_value=candidates), patch.object(nue, "command") as command:
            with self.assertRaisesRegex(RuntimeError, "NUE_PAUSE_CONTAINER_DRIFT"):
                nue.pause_applications(baseline, {"old", "new"}, set(), "own-token")
            command.assert_not_called()

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

    def run_apply_failure(self, tmp, recovery_fails=False, preflight_fails=False, loaded_mutation=None, smoke_fails=False):
        sha = "a" * 64; bundle = tmp / sha; bundle.mkdir()
        compose = tmp / "compose.json"
        old = json.dumps({"services": {s: {"image": "old"} for s in nue.SERVICES}}).encode(); compose.write_bytes(old)
        smoke = tmp / "smoke"; smoke.write_bytes(b"#!/bin/sh\nexit 0\n"); smoke.chmod(0o700)
        baseline = {"files": {str(compose): {"uid": 0, "gid": 0, "mode": 0o600}}, "containers": {"platform-infra-" + s + "-1": {"id": s, "image": "old", "restart": {"Name": "unless-stopped", "MaximumRetryCount": 0}} for s in nue.SERVICES}}
        binding = {"platformManifestDigest": "sha256:" + "1" * 64, "configDigest": "sha256:" + "2" * 64}
        manifest = {"schemaBinding": {}, "bases": {}, "images": {r: dict(binding) for r in ("runtime", "web")}}
        (bundle / "stage.json").write_text(json.dumps({"manifestSha256": sha, "mode": "nue-image-only", "baselineSha256": "b" * 64, "backupProofSha256": "c" * 64}))
        events = []
        oci = nue.load_module("nue_test_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        def run(argv, **kwargs):
            events.append(argv)
            if smoke_fails and argv == [str(smoke)] and events.count(argv) == 1: raise RuntimeError("AUTHENTICATED_SMOKE_FAILED")
            if argv[:3] == ["docker", "image", "inspect"]:
                row = {"Id": binding["configDigest"] if loaded_mutation == "config-id" else binding["platformManifestDigest"], "Os": "linux", "Architecture": "amd64"}
                if loaded_mutation == "descriptor": row["Descriptor"] = {"digest": binding["configDigest"]}
                return json.dumps([row]).encode()
            if argv[:2] == ["docker", "save"]: Path(argv[3]).write_bytes(b"fixture")
            if "psql" in argv: return b"0"
            return b""
        verify_results = [{} if smoke_fails else RuntimeError("CANDIDATE_HEALTH_FAIL"), RuntimeError("ROLLBACK_FAIL") if recovery_fails else {}]
        with ExitStack() as stack:
            stack.enter_context(patch.multiple(nue, RELEASES=tmp, COMPOSE=compose))
            stack.enter_context(patch.object(nue, "host_identity"))
            stack.enter_context(patch.object(nue, "protected", side_effect=lambda p, **kw: Path(p)))
            stack.enter_context(patch.object(nue, "require_admission"))
            stack.enter_context(patch.object(nue, "bind_admission_manifest"))
            stack.enter_context(patch.object(nue, "verify_bundle", return_value=manifest))
            stack.enter_context(patch.object(nue, "read_bound", side_effect=lambda p, sha: baseline if Path(p).name == "baseline.json" else {}))
            stack.enter_context(patch.object(nue, "backup_gate"))
            stack.enter_context(patch.object(nue, "own_lock", return_value="token"))
            stack.enter_context(patch.object(nue, "owned"))
            stack.enter_context(patch.object(nue, "snapshot", return_value={} if preflight_fails else baseline))
            stack.enter_context(patch.object(nue, "runtime_schema", return_value={}))
            stack.enter_context(patch.object(nue, "command", side_effect=run))
            stack.enter_context(patch.object(nue, "load_module", side_effect=lambda name, path: oci if str(path).endswith("catering_target_oci.py") else SimpleNamespace(_inspect_archive=lambda p: binding)))
            stack.enter_context(patch.object(nue, "replace_compose", side_effect=lambda body, meta, token: compose.write_bytes(body)))
            pause = stack.enter_context(patch.object(nue, "pause_applications"))
            up = stack.enter_context(patch.object(nue, "compose_up"))
            stack.enter_context(patch.object(nue, "set_policies"))
            stack.enter_context(patch.object(nue, "verify_runtime", side_effect=verify_results))
            unlock = stack.enter_context(patch.object(nue, "unlock"))
            expected_error = self.assertRaises(ValueError) if loaded_mutation else self.assertRaisesRegex(RuntimeError, "AUTHENTICATED_SMOKE_FAILED" if smoke_fails else "NUE_BASELINE_CHANGED|CANDIDATE_HEALTH_FAIL")
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

    def test_authenticated_smoke_remains_required_after_readiness(self):
        with tempfile.TemporaryDirectory() as temporary:
            bundle, old, after, pauses, starts, unlocks = self.run_apply_failure(Path(temporary), smoke_fails=True)
            self.assertEqual(after, old)
            self.assertEqual((pauses, starts, unlocks), (2, 2, 1))
            self.assertFalse((bundle / "installed.json").exists())
            self.assertTrue((bundle / "rollback-verified.json").exists())

    def test_web_readiness_retries_http_but_keeps_original_tls_acl_and_cert_validation(self):
        with tempfile.TemporaryDirectory() as temporary:
            edge = Path(temporary) / "Caddyfile"; edge.write_bytes(b"synthetic-original-edge-acl"); edge.chmod(0o600)
            info = edge.stat(); expected = {"uid": info.st_uid, "gid": info.st_gid, "mode": 0o600, "sha256": nue.digest(edge)}
            baseline = {"files": {str(edge): expected}}; calls = []; http_codes = iter((b"503", b"401"))
            def run(argv, **kwargs):
                calls.append(argv)
                return SimpleNamespace(returncode=0, stdout=(b"403" if argv[-1].startswith("https://") else next(http_codes)) if argv[0] == "curl" else b"")
            with patch.object(nue, "ORIGINAL_EDGE_CADDY", edge), patch.object(nue, "ORIGINAL_EDGE_CADDY_SHA256", expected["sha256"]), patch.object(nue, "protected", side_effect=lambda p: p), patch.object(nue.subprocess, "run", side_effect=run), patch.object(nue.time, "sleep"):
                result = nue.health(baseline)
            self.assertEqual((result["web"], result["tls"], result["authenticatedSmoke"]), ("401", "403", False))
            self.assertEqual(result["tlsProbe"], "VALID_CERTIFICATE_AND_ORIGINAL_LOOPBACK_ACL_DENIAL")
            self.assertEqual(len([call for call in calls if call[0] == "curl"]), 3)
            self.assertTrue(all("-k" not in call and "--insecure" not in call for call in calls))

    def test_tls_403_requires_exact_original_file_metadata_and_baseline(self):
        for mutation in ("baseline", "bytes", "mode", "certificate", "http403"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                edge = Path(temporary) / "Caddyfile"; edge.write_bytes(b"synthetic-original-edge-acl"); edge.chmod(0o600)
                original_sha = nue.digest(edge); info = edge.stat()
                expected = {"uid": info.st_uid, "gid": info.st_gid, "mode": 0o600, "sha256": original_sha}
                if mutation == "baseline": expected["sha256"] = "f" * 64
                if mutation == "bytes": edge.write_bytes(b"changed-ACL")
                if mutation == "mode": edge.chmod(0o644)
                baseline = {"files": {str(edge): expected}}
                def run(argv, **kwargs):
                    if argv[0] != "curl": return SimpleNamespace(returncode=0, stdout=b"")
                    tls = argv[-1].startswith("https://")
                    return SimpleNamespace(returncode=60 if tls and mutation == "certificate" else 0, stdout=b"403" if tls or mutation == "http403" else b"401")
                with patch.object(nue, "ORIGINAL_EDGE_CADDY", edge), patch.object(nue, "ORIGINAL_EDGE_CADDY_SHA256", original_sha), patch.object(nue, "protected", side_effect=lambda p: p), patch.object(nue.subprocess, "run", side_effect=run), patch.object(nue.time, "monotonic", side_effect=[0, 0, 61] if mutation == "http403" else [0, 0, 0, 61]), patch.object(nue.time, "sleep"):
                    with self.assertRaisesRegex(RuntimeError, "NUE_TLS_403_ORIGINAL_ACL_|NUE_HTTP_TLS_HEALTH"): nue.health(baseline)

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
                self.assertIn("NUE_SIGNED_MAC_ADMISSION_REQUIRED", error.getvalue())
                stage.assert_not_called(); apply.assert_not_called()

    def test_admission_binds_phase_params_commits_and_short_expiry(self):
        manifest = {"productCommit": "1" * 40, "operationsCommit": "2" * 40, "sourceTreeSha256": "3" * 64, "helpers": {"payload": "4" * 64}}
        params = {"protectedSmoke": "/smoke", "protectedSmokeSha256": "5" * 64}
        bundle = nue.RELEASES / ("a" * 64)
        with self.synthetic_issuer(), tempfile.TemporaryDirectory() as tmp:
            gate = nue.make_admission(manifest, "a" * 64, "apply", str(bundle), "/admission.json", params)
            path = Path(tmp) / "admission.json"
            path.write_bytes(nue.canonical(gate["admission"]))
            signature = Path(tmp) / "admission.sig"; signature.write_text(gate["signatureBody"])
            with patch.object(nue, "protected", side_effect=lambda p, **kw: Path(p)):
                nue.require_admission(path, gate["admissionSha256"], manifest, "a" * 64, "apply", bundle, params, signature, gate["signatureSha256"])
                for phase, parameters in (("stage", params), ("apply", {**params, "protectedSmoke": "/changed"})):
                    with self.assertRaisesRegex(RuntimeError, "NUE_ADMISSION_"):
                        nue.require_admission(path, gate["admissionSha256"], manifest, "a" * 64, phase, bundle, parameters, signature, gate["signatureSha256"])
                changed = dict(gate["admission"], issuedAt=(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=16)).isoformat())
                path.write_bytes(nue.canonical(changed))
                signature.write_bytes(nue.sign_admission(path.read_bytes()))
                with self.assertRaisesRegex(RuntimeError, "NUE_MAC_ADMISSION_EXPIRED"):
                    nue.require_admission(path, nue.digest(path), manifest, "a" * 64, "apply", bundle, params, signature, nue.digest(signature))

    def test_real_signature_rejects_wrong_key_namespace_and_changed_bytes(self):
        with self.synthetic_issuer() as key, tempfile.TemporaryDirectory() as temporary:
            body = b'{"accepted":"synthetic"}\n'
            signature = nue.sign_admission(body)
            nue.verify_admission_signature(body, signature)
            other = Path(temporary) / "synthetic-other"
            subprocess.run([nue.SSH_KEYGEN, "-q", "-t", "ed25519", "-N", "", "-f", str(other)], check=True, capture_output=True)
            for signer, namespace, message, expected in ((other, nue.SIGNATURE_NAMESPACE, body, body), (key, nue.SIGNATURE_NAMESPACE + "-wrong", body, body), (key, nue.SIGNATURE_NAMESPACE, body, body.replace(b"accepted", b"rejectxx"))):
                forged = subprocess.run([nue.SSH_KEYGEN, "-Y", "sign", "-f", str(signer), "-n", namespace, "-"], input=message, check=True, capture_output=True).stdout
                with self.subTest(signer=signer.name, namespace=namespace, changed=message != expected), self.assertRaisesRegex(RuntimeError, "NUE_AUTHENTIC_MAC_SIGNATURE_REQUIRED"):
                    nue.verify_admission_signature(expected, forged)
            with self.assertRaisesRegex(RuntimeError, "NUE_AUTHENTIC_MAC_SIGNATURE_REQUIRED"):
                nue.verify_admission_signature(body, b"self-declared-signature")

    def test_same_host_forged_admission_digest_cannot_open_stage_lock(self):
        with self.synthetic_issuer(), tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); admission = root / "forged.json"; signature = root / "forged.sig"
            admission.write_bytes(b'{"issuedAt":"self-declared"}\n'); signature.write_bytes(b"unsigned")
            with patch.object(nue, "host_identity"), patch.object(nue, "protected", side_effect=lambda p, **kw: Path(p)), patch.object(nue, "verify_bundle", return_value={}) as verify_bundle, patch.object(nue, "own_lock") as lock:
                with self.assertRaisesRegex(RuntimeError, "NUE_AUTHENTIC_MAC_SIGNATURE_REQUIRED"):
                    nue.stage(root, "a" * 64, root / "baseline", "b" * 64, root / "proof", "c" * 64, admission, nue.digest(admission), signature, nue.digest(signature))
                lock.assert_not_called()
                verify_bundle.assert_not_called()

    def test_signature_verifier_cleans_its_own_temporary_files_on_rejection(self):
        temporary_directory = tempfile.TemporaryDirectory
        with self.synthetic_issuer(), temporary_directory() as parent:
            created = []
            def own_temp(**kwargs):
                context = temporary_directory(dir=parent, **kwargs); created.append(Path(context.name)); return context
            with patch.object(nue.tempfile, "TemporaryDirectory", side_effect=own_temp):
                with self.assertRaisesRegex(RuntimeError, "NUE_AUTHENTIC_MAC_SIGNATURE_REQUIRED"):
                    nue.verify_admission_signature(b"synthetic", b"unsigned")
            self.assertTrue(created)
            self.assertTrue(all(not path.exists() for path in created))

    def test_signature_inputs_are_bounded_and_fingerprint_is_pinned(self):
        public_blob = base64.b64decode(nue.OPERATOR_PUBLIC_KEY.split()[1], validate=True)
        self.assertEqual("SHA256:" + base64.b64encode(hashlib.sha256(public_blob).digest()).decode().rstrip("="), nue.OPERATOR_KEY_FINGERPRINT)
        with self.synthetic_issuer(), tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "oversized"; path.write_bytes(b"x" * (nue.ADMISSION_LIMIT + 1))
            with patch.object(nue, "protected", side_effect=lambda p: p), self.assertRaisesRegex(RuntimeError, "NUE_SIGNED_INPUT_SIZE"):
                nue.read_bounded_bytes(path, nue.digest(path), nue.ADMISSION_LIMIT)
            with patch.object(nue, "OPERATOR_KEY_FINGERPRINT", "wrong"), self.assertRaisesRegex(RuntimeError, "NUE_PINNED_OPERATOR_KEY_INVALID"):
                nue.verify_admission_signature(b"synthetic", b"unsigned")

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
        for mode in ("repository", "local-current"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as tmp:
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
                    if argv[:3] == ["docker", "image", "inspect"]:
                        identity = nue.CURRENT_RUNTIME_M if "runtime" in argv[-1] else nue.CURRENT_WEB_M
                        return json.dumps([{"Id": identity, "Os": "linux", "Architecture": "amd64"}]).encode()
                    if argv[:2] == ["docker", "tag"]: return b""
                    role = "runtime" if "runtime" in argv[argv.index("--file") + 1] else "web"
                    Path(argv[argv.index("--iidfile") + 1]).write_text(fixtures[role][2])
                    return b""
                def save(identity, path):
                    role = next(role for role in fixtures if fixtures[role][2] == identity)
                    path.write_bytes(gzip.compress(fixtures[role][1]))
                with patch.object(nue, "command", side_effect=command), patch.object(operator, "export_product_context", side_effect=lambda src, sha, dst: shutil.copytree(src, dst)), patch.object(operator, "_save_docker_image", side_effect=save), patch.object(nue, "current_base_gate", return_value={"current": True}) as current_gate:
                    out = root / "bundle"
                    sha = nue.create_bundle(operator, source, "1" * 40, "2" * 40, out,
                                            "node@sha256:" + "4" * 64 if mode == "repository" else None,
                                            "caddy@sha256:" + "5" * 64 if mode == "repository" else None,
                                            base_mode=mode, runtime_base=nue.CURRENT_RUNTIME_M if mode == "local-current" else None,
                                            web_base=nue.CURRENT_WEB_M if mode == "local-current" else None)
                manifest = nue.verify_bundle(out, sha)
                self.assertEqual((manifest["targetId"], manifest["mode"]), ("catering-prod-02", "nue-image-only"))
                self.assertTrue(all("--pull=false" in call for call in calls if call[1] == "build"))
                if mode == "repository":
                    self.assertIn("FROM node@sha256:", (out / "Dockerfile.runtime.bound").read_text())
                    current_gate.assert_not_called()
                else:
                    self.assertEqual(current_gate.call_count, 2)
                    self.assertEqual(manifest["bases"], nue.CURRENT_BASE_LAYOUT)
                    self.assertIn("WORKDIR /catering-product", (out / "Dockerfile.runtime.bound").read_text())
                    self.assertIn("ln -s /catering-public /srv", (out / "Dockerfile.web.bound").read_text())
                    self.assertFalse(any(call[1] == "pull" for call in calls))
                    with patch.object(nue, "command", side_effect=command), patch.object(operator, "export_product_context", side_effect=lambda src, sha, dst: shutil.copytree(src, dst)), patch.object(operator, "_save_docker_image", side_effect=save), patch.object(nue, "current_base_gate", side_effect=[{"current": True}, {"current": False}]):
                        rejected = root / "drift-bundle"
                        with self.assertRaisesRegex(RuntimeError, "NUE_CURRENT_BASE_CHANGED_DURING_BUILD"):
                            nue.create_bundle(operator, source, "1" * 40, "2" * 40, rejected, None, None, base_mode="local-current", runtime_base=nue.CURRENT_RUNTIME_M, web_base=nue.CURRENT_WEB_M)
                        self.assertFalse((rejected / "manifest.json").exists())
                (out / "source/package-lock.json").write_text("tampered")
                with self.assertRaisesRegex(RuntimeError, "NUE_FULL_SOURCE_BINDING"): nue.verify_bundle(out, sha)

    def test_floating_bases_fail_before_any_build(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(nue, "command") as command:
            with self.assertRaisesRegex(RuntimeError, "NUE_PINNED_BASE_REQUIRED"):
                nue.create_bundle(None, Path(tmp), "1" * 40, "2" * 40, Path(tmp) / "bundle", "node:22-alpine", "caddy:2.10-alpine")
            command.assert_not_called()

    def test_current_base_gate_binds_real_five_commands_images_sites_and_compose(self):
        oci = nue.load_module("nue_current_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        with self.synthetic_current_host() as state:
            first = nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
            self.assertEqual(first, nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M))
            self.assertEqual(len([key for key in first if key.startswith("/platform-infra-")]), 5)
            self.assertTrue(all(call[:3] in (["docker", "image", "inspect"], ["docker", "exec", call[2]]) for call in state["calls"]))


    @contextmanager
    def synthetic_pr727_host(self):
        with self.synthetic_current_host() as state:
            source = state["compose"].parent / "predecessor"
            expected_files = {}
            for directory in nue.RUNTIME_ROOTS:
                path = source / "source" / directory / "fixture.ts"
                path.parent.mkdir(parents=True); path.write_bytes(b"export const retained = true;\n")
                expected_files[path.relative_to(source / "source").as_posix()] = path.read_bytes()
            manifest = {"schemaBinding": {"migration": "same", "ddl": "same"}}
            for row in state["rows"]:
                service = row["Name"].removeprefix("/platform-infra-").removesuffix("-1")
                identity = nue.PR727_IMAGES["web" if service == "web" else "runtime"]
                row["Image"] = row["ImageManifestDescriptor"]["digest"] = identity
                if service != "web": row["Config"]["WorkingDir"] = "/catering-product"
                state["images"][identity] = {**state["images"][nue.CURRENT_WEB_M], "Id": identity,
                    "Descriptor": {"digest": identity, "mediaType": "application/vnd.oci.image.manifest.v1+json"}}
            (state["sites"] / "accepted.caddy").rename(state["sites"] / "catering-target.caddy")
            site = state["sites"] / "catering-target.caddy"
            state["imageConfig"] = (ROOT / "platform-infra/Caddyfile").read_bytes()
            state["compose"].write_text(json.dumps({"services": {s: {"image": nue.PR727_IMAGES["web" if s == "web" else "runtime"]} for s in nue.SERVICES}}))
            with patch.object(nue, "accepted_pr727_bundle", return_value=(source, manifest)), \
                 patch.object(nue, "runtime_files", side_effect=lambda *a: dict(expected_files)) as runtime, \
                 patch.object(nue, "schema_binding", return_value=manifest["schemaBinding"]), \
                 patch.object(nue, "CURRENT_WEB_SNIPPET_SITE_SHA256", hashlib.sha256(site.read_bytes()).hexdigest()):
                state.update(runtime=runtime, expectedFiles=expected_files)
                yield state

    def test_pr727_predecessor_keeps_original_bases_and_exact_current_source(self):
        oci = nue.load_module("nue_predecessor_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        with self.synthetic_pr727_host() as state:
            first = nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
            self.assertEqual(first, nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M))
            self.assertEqual(first["predecessorManifestSha256"], "8e3bbad3b8445968a27d859f61c29bb99081e54341f267da9e4d35ce5ab5df50")
            self.assertEqual(len([k for k in first if k.endswith(":source")]), 4)
            self.assertEqual(nue.CURRENT_RUNTIME_M, "sha256:fb26fe510fade286bbfa02c981a8abb910ef8624a802d26822db662d81befdeb")
            self.assertEqual(nue.CURRENT_WEB_M, "sha256:b2ffe4694b983e4b4c1859676bf24df344900dfeaf8f2f7c07ad1ee23cbce25d")

    @contextmanager
    def synthetic_pr735_host(self):
        images = {"runtime": "sha256:2c94cffb05807cedaab35bf9dcb10779962c9a8f38f9c0143233447f39061b63",
                  "web": "sha256:029b327abb846b657dfc36822a36ed5dc4d6f648b4113c9d2379ecf6b8c13111"}
        with self.synthetic_pr727_host() as state:
            root, manifest = nue.accepted_pr727_bundle()
            for row in state["rows"]:
                role = "web" if row["Name"] == "/platform-infra-web-1" else "runtime"
                identity = images[role]
                state["images"][identity] = {**state["images"][row["Image"]], "Id": identity,
                    "Descriptor": {"digest": identity, "mediaType": "application/vnd.oci.image.manifest.v1+json"}}
                row["Image"] = row["ImageManifestDescriptor"]["digest"] = identity
            state["compose"].write_text(json.dumps({"services": {s: {"image": images["web" if s == "web" else "runtime"]} for s in nue.SERVICES}}))
            with patch.object(nue, "accepted_pr735_bundle", return_value=(root, manifest)):
                yield state

    def test_verified_pr735_predecessor_can_build_the_next_release(self):
        oci = nue.load_module("nue_followup_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        with self.synthetic_pr735_host():
            actual = nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
            self.assertEqual(actual["predecessorManifestSha256"], "73d8886d9479b2930c08f7da14a37187ca97441168297ecbe0cadf82027199ce")
            self.assertEqual(len([k for k in actual if k.endswith(":source")]), 4)

    @contextmanager
    def synthetic_3d287d8_host(self):
        images = {"runtime": "sha256:7b169161fdce4df85a04af78aa01f66f2f7a5f2cc090327714ba6edb4d238fe6",
                  "web": "sha256:47b2e374d2591d63e6237ab1b3904d5a160e375770c340d40769d5366cb14f04"}
        with self.synthetic_pr727_host() as state:
            root, manifest = nue.accepted_pr727_bundle()
            for row in state["rows"]:
                role = "web" if row["Name"] == "/platform-infra-web-1" else "runtime"
                identity = images[role]
                state["images"][identity] = {**state["images"][row["Image"]], "Id": identity,
                    "Descriptor": {"digest": identity, "mediaType": "application/vnd.oci.image.manifest.v1+json"}}
                row["Image"] = row["ImageManifestDescriptor"]["digest"] = identity
            state["compose"].write_text(json.dumps({"services": {s: {"image": images["web" if s == "web" else "runtime"]} for s in nue.SERVICES}}))
            with patch.object(nue, "accepted_3d287d8_bundle", return_value=(root, manifest)):
                yield state

    def test_verified_3d287d8_predecessor_can_build_the_next_release(self):
        oci = nue.load_module("nue_installed_successor_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        with self.synthetic_3d287d8_host():
            actual = nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
            self.assertEqual(actual["predecessorManifestSha256"], "1361de764a3bb012ede94b2c6d29a8dd0d7bdd0ad2a99d7162509e47ae99c3b4")
            self.assertEqual(len([k for k in actual if k.endswith(":source")]), 4)

    def test_pr735_predecessor_keeps_source_identity_and_serving_guards(self):
        oci = nue.load_module("nue_followup_negative_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        for mutation in ("image", "source", "compose", "mount", "command", "site", "web-write"):
            with self.subTest(mutation=mutation), self.synthetic_pr735_host() as state:
                if mutation == "image": state["rows"][0]["Image"] = "sha256:" + "a" * 64
                if mutation == "source": state["runtime"].side_effect = lambda *a: {"shared-core/src/fixture.ts": b"changed"}
                if mutation == "compose": state["compose"].write_text(json.dumps({"services": {s: {"image": "unknown"} for s in nue.SERVICES}}))
                if mutation == "mount": state["rows"][0]["Mounts"] = [{"Destination":"/catering-product", "RW":True}]
                if mutation == "command": state["rows"][0]["Config"]["Cmd"] = ["npm", "run", "other"]
                if mutation == "site": (state["sites"] / "extra.caddy").write_text("root * /other")
                original = nue.command
                def changed(argv, **kwargs):
                    if argv[:2] == ["docker", "diff"] and mutation == "web-write": return b"C /catering-public/index.html"
                    return original(argv, **kwargs)
                with patch.object(nue, "command", side_effect=changed), self.assertRaises((RuntimeError, ValueError)):
                    nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)

    def test_3d287d8_predecessor_keeps_source_identity_and_serving_guards(self):
        oci = nue.load_module("nue_followup_negative_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        for mutation in ("image", "source", "compose", "mount", "command", "site", "web-write", "mixed-images", "unknown-images"):
            with self.subTest(mutation=mutation), self.synthetic_3d287d8_host() as state:
                if mutation == "image": state["rows"][0]["Image"] = "sha256:" + "a" * 64
                if mutation == "source": state["runtime"].side_effect = lambda *a: {"shared-core/src/fixture.ts": b"changed"}
                if mutation == "compose": state["compose"].write_text(json.dumps({"services": {s: {"image": "unknown"} for s in nue.SERVICES}}))
                if mutation == "mount": state["rows"][0]["Mounts"] = [{"Destination":"/catering-product", "RW":True}]
                if mutation == "command": state["rows"][0]["Config"]["Cmd"] = ["npm", "run", "other"]
                if mutation == "site": (state["sites"] / "extra.caddy").write_text("root * /other")
                if mutation == "mixed-images": state["rows"][0]["ImageManifestDescriptor"]["digest"] = nue.PR735_IMAGES["runtime"]
                if mutation == "unknown-images":
                    for row in state["rows"]: row["ImageManifestDescriptor"]["digest"] = "sha256:" + "a" * 64
                original = nue.command
                def changed(argv, **kwargs):
                    if argv[:2] == ["docker", "diff"] and mutation == "web-write": return b"C /catering-public/index.html"
                    return original(argv, **kwargs)
                with patch.object(nue, "command", side_effect=changed), self.assertRaises((RuntimeError, ValueError)):
                    nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)

    def test_pr735_record_requires_pinned_source_helper_installed_receipt_and_runtime(self):
        from unittest.mock import Mock
        mutations = (None, "product", "operations", "bases", "manifest", "helper", "helper-pin", "M",
                     "stage", "baseline", "installed", "receipt-manifest", "receipt-image", "compose", "bundle-verifier", "runtime-verifier")
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                releases = Path(temporary); root = releases / "fixture"; (root / "tools").mkdir(parents=True)
                helper = root / "tools/catering_target_nue_image_update.py"; helper.write_bytes(b"accepted fixture")
                helper_sha = hashlib.sha256(helper.read_bytes()).hexdigest()
                manifest = {"productCommit":"61ea18f28ba47ed1266a903916c9c43240594b83",
                    "operationsCommit":"5c7b44b8d474da0166a1f64a0a43f51e0fa7bc15", "bases":dict(nue.CURRENT_BASE_LAYOUT),
                    "helpers":{helper.name:helper_sha}, "schemaBinding":{"migration":"same", "ddl":"same"},
                    "images":{role:{"platformManifestDigest":identity} for role,identity in nue.PR735_IMAGES.items()}}
                if mutation == "product": manifest["productCommit"] = "a" * 40
                if mutation == "operations": manifest["operationsCommit"] = "b" * 40
                if mutation == "bases": manifest["bases"]["runtimeRoot"] = "/other"
                if mutation == "M": manifest["images"]["runtime"]["platformManifestDigest"] = "sha256:" + "c" * 64
                raw = nue.canonical(manifest); sha = hashlib.sha256(raw).hexdigest()
                root.rename(releases / sha); root = releases / sha; helper = root / "tools" / helper.name
                (root / "manifest.json").write_bytes(raw)
                baseline = {"fixture":"unchanged"}; baseline_raw = nue.canonical(baseline)
                (root / "baseline.json").write_bytes(baseline_raw)
                stage = {"manifestSha256":sha, "mode":"nue-image-only", "baselineSha256":hashlib.sha256(baseline_raw).hexdigest()}
                if mutation == "stage": stage["manifestSha256"] = "d" * 64
                (root / "stage.json").write_bytes(nue.canonical(stage))
                images = {s:nue.PR735_IMAGES["web" if s == "web" else "runtime"] for s in nue.SERVICES}
                candidate = nue.canonical({"services":images}); (root / "compose.candidate.json").write_bytes(candidate)
                receipt = {"manifestSha256":sha, "status":"NUE_IMAGE_ONLY_INSTALLED", "images":dict(images),
                           "composeSha256":hashlib.sha256(candidate).hexdigest()}
                if mutation == "installed": receipt["status"] = "HOLD"
                if mutation == "receipt-manifest": receipt["manifestSha256"] = "e" * 64
                if mutation == "receipt-image": receipt["images"]["intake"] = "sha256:" + "f" * 64
                (root / "installed.json").write_bytes(nue.canonical(receipt))
                if mutation == "manifest": (root / "manifest.json").write_bytes(raw + b" ")
                if mutation == "helper": helper.write_bytes(b"changed")
                if mutation == "baseline": (root / "baseline.json").write_bytes(b"{}")
                if mutation == "compose": (root / "compose.candidate.json").write_bytes(candidate + b" ")
                verifier = SimpleNamespace(verify_bundle=Mock(return_value=manifest), verify_runtime=Mock())
                if mutation == "bundle-verifier": verifier.verify_bundle.side_effect = RuntimeError("archive/source drift")
                if mutation == "runtime-verifier": verifier.verify_runtime.side_effect = RuntimeError("current runtime drift")
                with patch.object(nue, "RELEASES", releases), patch.object(nue, "PR735_MANIFEST_SHA256", sha), \
                     patch.object(nue, "PR735_HELPER_SHA256", "0" * 64 if mutation == "helper-pin" else helper_sha), \
                     patch.object(nue, "protected", side_effect=lambda p,**kw:Path(p)), \
                     patch.object(nue, "load_module", return_value=verifier) as loader:
                    if mutation is None:
                        oci = object()
                        self.assertEqual(nue.accepted_pr735_bundle(oci), (root, manifest))
                        verifier.verify_bundle.assert_called_once_with(root, sha)
                        verifier.verify_runtime.assert_called_once_with(baseline, images, candidate, candidate_oci=oci,
                            candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
                    else:
                        with self.assertRaises(RuntimeError): nue.accepted_pr735_bundle(object())
                        if mutation in ("helper", "helper-pin", "manifest", "product", "operations", "bases"):
                            loader.assert_not_called()

    def test_3d287d8_record_requires_pinned_source_helper_installed_receipt_and_runtime(self):
        from unittest.mock import Mock
        mutations = (None, "product", "operations", "bases", "manifest", "helper", "helper-pin", "M",
                     "stage", "baseline", "installed", "receipt-manifest", "receipt-image", "compose", "bundle-verifier", "runtime-verifier")
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                releases = Path(temporary); root = releases / "fixture"; (root / "tools").mkdir(parents=True)
                helper = root / "tools/catering_target_nue_image_update.py"; helper.write_bytes(b"accepted fixture")
                helper_sha = hashlib.sha256(helper.read_bytes()).hexdigest()
                manifest = {"productCommit":"3d287d83ef489bda6bcf581b5e93e0b1009d5639",
                    "operationsCommit":"3d287d83ef489bda6bcf581b5e93e0b1009d5639", "bases":dict(nue.CURRENT_BASE_LAYOUT),
                    "helpers":{helper.name:helper_sha}, "schemaBinding":{"migration":"same", "ddl":"same"},
                    "images":{role:{"platformManifestDigest":identity} for role,identity in nue.RELEASE_3D287D8_IMAGES.items()}}
                if mutation == "product": manifest["productCommit"] = "a" * 40
                if mutation == "operations": manifest["operationsCommit"] = "b" * 40
                if mutation == "bases": manifest["bases"]["runtimeRoot"] = "/other"
                if mutation == "M": manifest["images"]["runtime"]["platformManifestDigest"] = "sha256:" + "c" * 64
                raw = nue.canonical(manifest); sha = hashlib.sha256(raw).hexdigest()
                root.rename(releases / sha); root = releases / sha; helper = root / "tools" / helper.name
                (root / "manifest.json").write_bytes(raw)
                baseline = {"fixture":"unchanged"}; baseline_raw = nue.canonical(baseline)
                (root / "baseline.json").write_bytes(baseline_raw)
                stage = {"manifestSha256":sha, "mode":"nue-image-only", "baselineSha256":hashlib.sha256(baseline_raw).hexdigest()}
                if mutation == "stage": stage["manifestSha256"] = "d" * 64
                (root / "stage.json").write_bytes(nue.canonical(stage))
                images = {s:nue.RELEASE_3D287D8_IMAGES["web" if s == "web" else "runtime"] for s in nue.SERVICES}
                candidate = nue.canonical({"services":images}); (root / "compose.candidate.json").write_bytes(candidate)
                receipt = {"manifestSha256":sha, "status":"NUE_IMAGE_ONLY_INSTALLED", "images":dict(images),
                           "composeSha256":hashlib.sha256(candidate).hexdigest()}
                if mutation == "installed": receipt["status"] = "HOLD"
                if mutation == "receipt-manifest": receipt["manifestSha256"] = "e" * 64
                if mutation == "receipt-image": receipt["images"]["intake"] = "sha256:" + "f" * 64
                (root / "installed.json").write_bytes(nue.canonical(receipt))
                if mutation == "manifest": (root / "manifest.json").write_bytes(raw + b" ")
                if mutation == "helper": helper.write_bytes(b"changed")
                if mutation == "baseline": (root / "baseline.json").write_bytes(b"{}")
                if mutation == "compose": (root / "compose.candidate.json").write_bytes(candidate + b" ")
                verifier = SimpleNamespace(verify_bundle=Mock(return_value=manifest), verify_runtime=Mock())
                if mutation == "bundle-verifier": verifier.verify_bundle.side_effect = RuntimeError("archive/source drift")
                if mutation == "runtime-verifier": verifier.verify_runtime.side_effect = RuntimeError("current runtime drift")
                with patch.object(nue, "RELEASES", releases), patch.object(nue, "RELEASE_3D287D8_MANIFEST_SHA256", sha), \
                     patch.object(nue, "RELEASE_3D287D8_HELPER_SHA256", "0" * 64 if mutation == "helper-pin" else helper_sha), \
                     patch.object(nue, "protected", side_effect=lambda p,**kw:Path(p)), \
                     patch.object(nue, "load_module", return_value=verifier) as loader:
                    if mutation is None:
                        oci = object()
                        self.assertEqual(nue.accepted_3d287d8_bundle(oci), (root, manifest))
                        verifier.verify_bundle.assert_called_once_with(root, sha)
                        verifier.verify_runtime.assert_called_once_with(baseline, images, candidate, candidate_oci=oci,
                            candidate_layout=manifest["bases"], candidate_schema=manifest["schemaBinding"])
                    else:
                        with self.assertRaises(RuntimeError): nue.accepted_3d287d8_bundle(object())
                        if mutation in ("helper", "helper-pin", "manifest", "product", "operations", "bases"):
                            loader.assert_not_called()

    @contextmanager
    def synthetic_pr727_caddy_trust(self):
        with self.synthetic_pr727_host() as state:
            web = state["rows"][-1]
            web["Mounts"].append({"Type": "volume", "Name": "platform-infra_caddy_data",
                "Source": "/var/lib/docker/volumes/platform-infra_caddy_data/_data", "Destination": "/data", "RW": True})
            crt = "/usr/local/share/ca-certificates/" + nue.PR727_CADDY_ROOT_NAME + ".crt"
            pem = "/etc/ssl/certs/ca-cert-" + nue.PR727_CADDY_ROOT_NAME + ".pem"
            root = "/data/caddy/pki/authorities/local/root.crt"
            bundle = "/etc/ssl/certs/ca-certificates.crt"
            rehash = "/etc/ssl/certs/fe4a7346.0"
            directories = ["/usr", "/usr/local", "/usr/local/share", "/usr/local/share/ca-certificates",
                           "/etc", "/etc/caddy", "/etc/ssl", "/etc/ssl/certs"]
            trust = {"diff": [*("C " + p for p in directories), "A /etc/caddy/sites", "A " + crt,
                              "A " + pem, "C " + bundle, "A " + rehash],
                     "files": {root: b"synthetic-own-root\n", crt: b"synthetic-own-root\n",
                               bundle: b"synthetic-base-ca-one\nsynthetic-base-ca-two\nsynthetic-own-root\n"},
                     "links": {pem: crt, rehash: Path(pem).name},
                     "metadata": {**{p: "41ed|0|0|1" for p in directories}, "/etc/caddy/sites": "41c0|0|0|2",
                                  root: "8180|0|0|1", crt: "81a4|0|0|1", bundle: "81a4|0|0|1",
                                  pem: "a1ff|0|0|1", rehash: "a1ff|0|0|1"}}
            original = nue.command
            def command(argv, **kwargs):
                if argv[:2] == ["docker", "diff"]: return ("\n".join(trust["diff"]) + "\n").encode()
                if argv[:3] == ["docker", "exec", web["Id"]]:
                    if argv[3:5] == ["stat", "-c"]: return ("\n".join(trust["metadata"][p] for p in argv[6:]) + "\n").encode()
                    if argv[3] == "cat" and argv[4] in trust["files"]: return trust["files"][argv[4]]
                    if argv[3] == "readlink": return (trust["links"][argv[4]] + "\n").encode()
                return original(argv, **kwargs)
            with patch.object(nue, "command", side_effect=command), patch.multiple(nue,
                    PR727_CADDY_ROOT_SHA256=hashlib.sha256(trust["files"][root]).hexdigest(),
                    PR727_CADDY_CA_BUNDLE_SHA256=hashlib.sha256(trust["files"][bundle]).hexdigest()):
                yield state, trust, (root, crt, bundle, pem, rehash)

    def test_pr727_observed_caddy_trust_passes_and_is_bound_before_after(self):
        oci = nue.load_module("nue_caddy_trust_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        with self.synthetic_pr727_caddy_trust() as (state, trust, paths):
            first = nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
            self.assertEqual(first, nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M))
            self.assertEqual(first["webWritableState"]["diff"], sorted(trust["diff"]))
            self.assertEqual(first["webWritableState"]["rootSha256"], nue.PR727_CADDY_ROOT_SHA256)
            self.assertEqual(len([k for k in first if k.endswith(":source")]), 4)

    def test_pr727_caddy_trust_rejects_unproven_files_certificates_metadata_and_mounts(self):
        for mutation in ("extra-path", "deleted", "changed-status", "duplicate", "missing-path", "wrong-root",
                         "wrong-added-root", "extra-ca", "missing-ca", "duplicate-ca", "pem-target", "rehash-target",
                         "file-type", "owner", "mode", "links", "directory-type", "foreign-volume", "foreign-source", "bind-data"):
            with self.subTest(mutation=mutation), self.synthetic_pr727_caddy_trust() as (state, trust, paths):
                root, crt, bundle, pem, rehash = paths
                if mutation == "extra-path": trust["diff"].append("A /etc/ssl/certs/unrelated.pem")
                if mutation == "deleted": trust["diff"].append("D /etc/ssl/certs/original.pem")
                if mutation == "changed-status": trust["diff"][0] = "A /usr"
                if mutation == "duplicate": trust["diff"].append(trust["diff"][0])
                if mutation == "missing-path": trust["diff"].pop()
                if mutation == "wrong-root": trust["files"][root] = b"another-root\n"
                if mutation == "wrong-added-root": trust["files"][crt] = b"another-root\n"
                if mutation == "extra-ca": trust["files"][bundle] += b"unrelated-ca\n"
                if mutation == "missing-ca": trust["files"][bundle] = trust["files"][bundle].replace(b"synthetic-base-ca-one\n", b"")
                if mutation == "duplicate-ca": trust["files"][bundle] += b"synthetic-base-ca-two\n"
                if mutation == "pem-target": trust["links"][pem] = "/data/caddy/pki/authorities/local/root.key"
                if mutation == "rehash-target": trust["links"][rehash] = "unrelated.pem"
                if mutation == "file-type": trust["metadata"][crt] = "a1ff|0|0|1"
                if mutation == "owner": trust["metadata"][root] = "8180|1000|0|1"
                if mutation == "mode": trust["metadata"][bundle] = "81b6|0|0|1"
                if mutation == "links": trust["metadata"][crt] = "81a4|0|0|2"
                if mutation == "directory-type": trust["metadata"]["/etc/ssl"] = "81a4|0|0|1"
                if mutation == "foreign-volume": state["rows"][-1]["Mounts"][-1]["Name"] = "foreign"
                if mutation == "foreign-source": state["rows"][-1]["Mounts"][-1]["Source"] = "/elsewhere"
                if mutation == "bind-data": state["rows"][-1]["Mounts"][-1]["Type"] = "bind"
                with self.assertRaisesRegex(RuntimeError, "NUE_PR727_WEB_"):
                    nue.pr727_web_writable_state(state["rows"][-1])

    def test_pr727_predecessor_rejects_current_layout_identity_source_and_config_drift(self):
        oci = nue.load_module("nue_predecessor_negative_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        for mutation in ("M", "C", "image", "cwd", "command", "entrypoint", "mount", "site", "compose", "source", "web-layout", "web-write"):
            with self.subTest(mutation=mutation), self.synthetic_pr727_host() as state:
                if mutation == "M": state["rows"][0]["ImageManifestDescriptor"]["digest"] = "sha256:" + "a" * 64
                if mutation == "C": state["rows"][0]["Image"] = "sha256:" + "b" * 64
                if mutation == "image": state["images"][nue.PR727_IMAGES["runtime"]]["Id"] = "sha256:" + "c" * 64
                if mutation == "cwd": state["rows"][0]["Config"]["WorkingDir"] = "/app"
                if mutation == "command": state["rows"][0]["Config"]["Cmd"] = ["npm", "run", "other"]
                if mutation == "entrypoint": state["rows"][0]["Config"]["Entrypoint"] = []
                if mutation == "mount": state["rows"][0]["Mounts"] = [{"Type":"bind","Source":"/unrelated","Destination":"/catering-product","RW":True}]
                if mutation == "site": (state["sites"] / "extra.caddy").write_bytes(b"root * /other")
                if mutation == "compose": state["compose"].write_text(json.dumps({"services": {s: {"image": "unknown"} for s in nue.SERVICES}}))
                if mutation == "source": state["runtime"].side_effect = lambda *a: {"shared-core/src/fixture.ts": b"changed"}
                if mutation == "web-layout": state["collision"] = True
                original = nue.command
                def changed_command(argv, **kwargs):
                    if argv[:2] == ["docker", "diff"]: return b"C /catering-public/index.html" if mutation == "web-write" else b""
                    return original(argv, **kwargs)
                with patch.object(nue, "command", side_effect=changed_command):
                    with self.assertRaises((RuntimeError, ValueError)):
                        nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)

    def test_pr727_record_requires_pinned_manifest_helper_recovery_and_old_verifier(self):
        for mutation in (None, "manifest", "helper", "recovery", "product", "M", "verifier"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                releases=Path(temporary); root=releases/"fixture"; (root/"tools").mkdir(parents=True)
                helper=root/"tools/catering_target_nue_image_update.py"; helper.write_bytes(b"accepted fixture")
                manifest={"productCommit":"c3bf1e83127aa96442c3e48d00350ce1ad9c04a5",
                    "operationsCommit":"6149d2723f5240a389693798a0e7ef7a3bfabbaf",
                    "bases":dict(nue.CURRENT_BASE_LAYOUT),"helpers":{helper.name:hashlib.sha256(helper.read_bytes()).hexdigest()},
                    "images":{k:{"platformManifestDigest":v} for k,v in nue.PR727_IMAGES.items()}}
                if mutation=="product":manifest["productCommit"]="a"*40
                if mutation=="M":manifest["images"]["runtime"]["platformManifestDigest"]="sha256:"+"b"*64
                raw=nue.canonical(manifest); sha=hashlib.sha256(raw).hexdigest(); root.rename(releases/sha);root=releases/sha;helper=root/"tools"/helper.name
                (root/"manifest.json").write_bytes(raw)
                receipt={"status":"MANUAL_NUE_CANDIDATE_RUNTIME_VERIFIED","manifestSha256":sha,"originalApplyStatus":"HOLD",
                    "currentAuthenticatedSmokePassed":True,"publicApplyPassed":False,"publicVerifyPassed":False}
                receipt_raw=nue.canonical(receipt);receipt_sha=hashlib.sha256(receipt_raw).hexdigest()
                (root/"manual-forward-recovery-verified.json").write_bytes(receipt_raw)
                if mutation=="manifest":(root/"manifest.json").write_bytes(raw+b" ")
                if mutation=="helper":helper.write_bytes(b"changed")
                if mutation=="recovery":(root/"manual-forward-recovery-verified.json").write_bytes(receipt_raw+b" ")
                verifier=SimpleNamespace(verify_bundle=__import__("unittest.mock",fromlist=["Mock"]).Mock(return_value=manifest))
                if mutation=="verifier":verifier.verify_bundle.side_effect=RuntimeError("archive/source/C drift")
                with patch.object(nue,"RELEASES",releases),patch.object(nue,"PR727_MANIFEST_SHA256",sha), \
                     patch.object(nue,"PR727_RECOVERY_SHA256",receipt_sha),patch.object(nue,"protected",side_effect=lambda p,**kw:Path(p)), \
                     patch.object(nue,"load_module",return_value=verifier):
                    if mutation is None:
                        self.assertEqual(nue.accepted_pr727_bundle(),(root,manifest))
                        verifier.verify_bundle.assert_called_once_with(root,sha)
                    else:
                        with self.assertRaises(RuntimeError):nue.accepted_pr727_bundle()

    def test_current_web_optional_empty_entrypoint_can_be_omitted(self):
        oci = nue.load_module("nue_current_empty_entrypoint_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        for omitted in ("image", "container", "both"):
            with self.subTest(omitted=omitted), self.synthetic_current_host() as state:
                expected = nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
                if omitted in ("image", "both"): state["images"][nue.CURRENT_WEB_M]["Config"].pop("Entrypoint")
                if omitted in ("container", "both"): state["rows"][-1]["Config"].pop("Entrypoint")
                self.assertEqual(nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M), expected)

    def test_current_web_rootless_site_imports_only_the_bound_image_snippet(self):
        oci = nue.load_module("nue_current_snippet_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        site = b"http://:8082 {\n import catering_app_routes\n}\n"
        self.assertEqual(nue.CURRENT_WEB_SNIPPET_SITE_SHA256, "8e04176f94719bd20f924e0ef5f6d0ad0c224e6976d8813421359e35716aab2e")
        with self.synthetic_current_host() as state:
            (state["sites"] / "accepted.caddy").rename(state["sites"] / "catering-target.caddy")
            (state["sites"] / "catering-target.caddy").write_bytes(site)
            state["imageConfig"] = (ROOT / "platform-infra/Caddyfile").read_bytes()
            self.assertEqual(hashlib.sha256(state["imageConfig"]).hexdigest(), "966049be4c99e87341b4b26e1830e7f33a626b5f88d77e498983e7ebb3a9207e")
            with patch.object(nue, "CURRENT_WEB_SNIPPET_SITE_SHA256", hashlib.sha256(site).hexdigest()):
                first = nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
                self.assertEqual(first, nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M))
                self.assertEqual(first["caddyConfiguration"][str(state["sites"] / "catering-target.caddy")], hashlib.sha256(site).hexdigest())

    def test_current_web_snippet_binding_rejects_unknown_or_changed_configurations(self):
        oci = nue.load_module("nue_current_snippet_negative_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        site = b"http://:8082 {\n import catering_app_routes\n}\n"
        for mutation in ("image", "image-import", "image-redirect", "image-snippet", "site-import", "redirect", "root", "file-server", "name", "extra-rootless", "extra-rooted", "previous-root", "unbound-site"):
            with self.subTest(mutation=mutation), self.synthetic_current_host() as state:
                path = state["sites"] / "catering-target.caddy"
                (state["sites"] / "accepted.caddy").rename(path); path.write_bytes(site)
                state["imageConfig"] = (ROOT / "platform-infra/Caddyfile").read_bytes()
                if mutation == "image": state["imageConfig"] = state["imageConfig"].replace(b"root * /srv", b"root * /other")
                if mutation == "image-import": state["imageConfig"] += b"\nimport /etc/unknown/*.caddy\n"
                if mutation == "image-redirect": state["imageConfig"] = state["imageConfig"].replace(b"root * /srv", b"root * /srv\n redir https://unknown.invalid")
                if mutation == "image-snippet": state["imageConfig"] = state["imageConfig"].replace(b"(catering_app_routes)", b"(unknown_routes)")
                if mutation == "site-import": path.write_bytes(site.replace(b"catering_app_routes", b"unknown_routes"))
                if mutation == "redirect": path.write_bytes(site.replace(b" import", b" redir https://unknown.invalid\n import"))
                if mutation == "root": path.write_bytes(site.replace(b" import", b" root * /other\n import"))
                if mutation == "file-server": path.write_bytes(site.replace(b" import", b" file_server\n import"))
                if mutation == "name": path.rename(state["sites"] / "unknown.caddy")
                if mutation == "extra-rootless": (state["sites"] / "extra.caddy").write_bytes(site)
                if mutation == "extra-rooted": (state["sites"] / "extra.caddy").write_bytes(b":8090 {\n root * /srv\n file_server\n}\n")
                if mutation == "previous-root": path.write_bytes(site.replace(b" import", b" root * /catering-previous-public\n import"))
                expected_site = nue.CURRENT_WEB_SNIPPET_SITE_SHA256 if mutation == "unbound-site" else hashlib.sha256(site).hexdigest()
                with patch.object(nue, "CURRENT_WEB_SNIPPET_SITE_SHA256", expected_site):
                    with self.assertRaisesRegex(RuntimeError, "NUE_CURRENT_WEB_SERVING_ROOT"):
                        nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)

    def test_current_base_gate_rejects_image_root_command_mount_and_compose_drift(self):
        oci = nue.load_module("nue_current_negative_oci", ROOT / "platform-infra/scripts/catering_target_oci.py")
        for mutation in ("config-id", "index", "container", "command", "cwd", "mount", "site", "collision", "compose", "backend-entrypoint", "web-entrypoint", "web-image-entrypoint"):
            with self.subTest(mutation=mutation), self.synthetic_current_host() as state:
                if mutation == "config-id": state["images"][nue.CURRENT_RUNTIME_M]["Id"] = "sha256:" + "a" * 64
                if mutation == "index": state["images"][nue.CURRENT_WEB_M]["Descriptor"]["mediaType"] = "application/vnd.oci.image.index.v1+json"
                if mutation == "container": state["rows"][0]["ImageManifestDescriptor"]["digest"] = "sha256:" + "a" * 64
                if mutation == "command": state["rows"][0]["Config"]["Cmd"] = ["npm", "run", "other"]
                if mutation == "backend-entrypoint": state["rows"][0]["Config"]["Entrypoint"] = None
                if mutation == "web-entrypoint": state["rows"][-1]["Config"]["Entrypoint"] = ["unexpected-entrypoint"]
                if mutation == "web-image-entrypoint": state["images"][nue.CURRENT_WEB_M]["Config"]["Entrypoint"] = ["unexpected-entrypoint"]
                if mutation == "cwd": state["rows"][0]["Config"]["WorkingDir"] = "/unexpected"
                if mutation == "mount": state["rows"][-1]["Mounts"].append({"Type": "bind", "Destination": "/srv", "Source": "/old-assets", "RW": False})
                if mutation == "site": (state["sites"] / "accepted.caddy").write_text("root * /catering-previous-public\n")
                if mutation == "collision": state["collision"] = True
                if mutation == "compose": state["compose"].write_text(json.dumps({"services": {s: {"working_dir": "/app"} for s in nue.SERVICES}}))
                with self.assertRaises((RuntimeError, ValueError)): nue.current_base_gate(oci, nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)

    def test_current_mode_rejects_edge_or_floating_bases_before_build(self):
        for runtime_m, web_m in ((nue.CURRENT_RUNTIME_M, "sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648"), ("node:22-alpine", nue.CURRENT_WEB_M)):
            with self.subTest(runtime_m=runtime_m, web_m=web_m), patch.object(nue, "host_identity"), patch.object(nue, "command") as command:
                with self.assertRaisesRegex(RuntimeError, "NUE_CURRENT_BASE_EXACT_M_REQUIRED"): nue.current_base_gate(None, runtime_m, web_m)
                command.assert_not_called()

    def test_current_web_image_replaces_serving_root_without_deleting_old_assets(self):
        dockerfile = nue.local_current_dockerfile("web", nue.CURRENT_RUNTIME_M, nue.CURRENT_WEB_M)
        script = next(line.removeprefix("RUN ") for line in dockerfile.splitlines() if line.startswith("RUN test -d /srv"))
        for collision in (False, True):
            with self.subTest(collision=collision), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary); srv = root / "srv"; srv.mkdir(); (srv / "stale.js").write_text("old")
                if collision: (root / "catering-public").mkdir()
                bounded = script
                for name in ("/catering-previous-public", "/catering-public", "/srv"): bounded = bounded.replace(name, str(root / name[1:]))
                result = subprocess.run(["sh", "-ec", bounded], capture_output=True)
                if collision:
                    self.assertNotEqual(result.returncode, 0); self.assertFalse(srv.is_symlink()); self.assertTrue((srv / "stale.js").exists())
                else:
                    self.assertEqual(result.returncode, 0)
                    (root / "catering-public/index.html").write_text("fresh")
                    self.assertTrue(srv.is_symlink()); self.assertEqual((srv / "index.html").read_text(), "fresh")
                    self.assertFalse((srv / "stale.js").exists()); self.assertTrue((root / "catering-previous-public/stale.js").exists())
        self.assertIn("COPY --from=build /catering-product/backoffice-ui/dist/ /catering-public/", dockerfile)
        self.assertIn("COPY platform-infra/Caddyfile /etc/caddy/Caddyfile", dockerfile)
        self.assertNotIn("/app/", dockerfile)
        self.assertIn("RUN npm ci", dockerfile)
        self.assertIn("find /catering-product/backoffice-ui/dist -type l", dockerfile)


if __name__ == "__main__": unittest.main()
