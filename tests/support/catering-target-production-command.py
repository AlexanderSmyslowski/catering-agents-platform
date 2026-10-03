#!/usr/bin/env python3
"""Synthetic command boundary for the real Catering target production updater.

This fixture never contacts a server or Docker daemon. The production shell
control flow remains real; only ssh/docker/rsync are substituted.
"""
from __future__ import annotations

import os
from pathlib import Path
import json
import re
import shlex
import subprocess
import sys

state_root = Path(os.environ["CATERING_TARGET_FAKE_STATE"])
scenario = os.environ.get("CATERING_TARGET_FAKE_SCENARIO", "healthy")
log_path = Path(os.environ.get("CATERING_TARGET_FAKE_LOG", state_root / "commands.log"))
RETRY_SCENARIOS = {
    "operator-p2-retry-candidate-rejected-sequence",
    "operator-p2-retry-after-rollback-sequence",
}
command = Path(sys.argv[0]).name
args = sys.argv[1:]
PRESERVATION_SCENARIO = '-p41-' in scenario


def preservation_observation(at_verify=False):
    phase_path = state_root / 'preservation-phase'
    phase = phase_path.read_text() if phase_path.exists() else 'initial'
    volume, edge = 'platform-infra_postgres_data', 'sha256:' + 'e' * 64
    if scenario.endswith('under-lock-binding'):
        volume = 'initial_volume' if not (state_root / 'lock-observed').exists() else 'locked_volume'
        edge = 'sha256:' + ('a' if volume == 'initial_volume' else 'e') * 64
    if phase == 'candidate' and 'postflight-' in scenario:
        if 'volume' in scenario or 'both' in scenario:
            volume = 'wrong_candidate_volume'
        if 'edge' in scenario or 'both' in scenario:
            edge = 'sha256:' + 'd' * 64
    if phase == 'previous' and 'rollback-' in scenario:
        if 'volume' in scenario or ('both' in scenario and 'verify-' not in scenario):
            volume = 'wrong_rollback_volume'
        if 'edge' in scenario or ('both' in scenario and 'verify-' not in scenario):
            edge = 'sha256:' + 'c' * 64
    if at_verify and '-verify-both-' in scenario and (
        (phase == 'candidate' and 'rollback-' not in scenario) or
        (phase == 'previous' and 'rollback-' in scenario)
    ):
        volume, edge = 'wrong_verify_volume', 'sha256:' + 'f' * 64
    return volume, edge


def log(line: str) -> None:
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def fail(message: str, code: int = 86) -> "None":
    print(message, file=sys.stderr)
    raise SystemExit(code)


def strict_ssh_options_present(values: list[str]) -> bool:
    joined = "\n".join(values)
    return (
        "StrictHostKeyChecking=yes" in joined
        and "UserKnownHostsFile=" in joined
        and "BatchMode=yes" in joined
        and "IdentitiesOnly=yes" in joined
    )


if command == "docker":
    if not args:
        fail("synthetic docker: missing command")
    if args[0] == "build":
        try:
            iidfile = Path(args[args.index("--iidfile") + 1])
            dockerfile = args[args.index("--file") + 1]
        except (ValueError, IndexError):
            fail("synthetic docker: malformed build")
        if dockerfile.endswith("Dockerfile.runtime"):
            kind = "runtime"
            image = "sha256:" + "1" * 64
        elif dockerfile.endswith("Dockerfile.web"):
            kind = "web"
            image = "sha256:" + "2" * 64
        else:
            fail("synthetic docker: unexpected Dockerfile")
        log(f"local_docker build {kind}")
        iidfile.write_text(image + "\n", encoding="utf-8")
        raise SystemExit(0)

    if args[0] == "save":
        if len(args) != 2 or not args[1].startswith("sha256:"):
            fail("synthetic docker: malformed save")
        log("local_docker save")
        sys.stdout.buffer.write(b"synthetic-docker-image")
        raise SystemExit(0)

    fail("synthetic docker: unexpected command " + " ".join(args))


if command == "rsync":
    destination = args[-1] if args else ""
    if "--no-owner" not in args or "--no-group" not in args:
        fail("synthetic rsync: privileged receiver must own transferred artifacts")
    import shlex

    try:
        rsync_ssh = shlex.split(args[args.index("-e") + 1])
    except (ValueError, IndexError):
        fail("synthetic rsync: SSH transport is missing")
    expected_ssh = [
        "ssh",
        "-i",
        os.environ["CATERING_TARGET_SSH_KEY_FILE"],
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        "UserKnownHostsFile=" + os.environ["CATERING_TARGET_SSH_KNOWN_HOSTS_FILE"],
        "-o",
        "ConnectTimeout=10",
        "-o",
        "ServerAliveInterval=15",
        "-o",
        "ServerAliveCountMax=4",
        "-p",
        "22",
    ]
    if rsync_ssh != expected_ssh:
        fail("synthetic rsync: SSH path arguments were not shell-quoted")
    if destination.endswith("/source/"):
        log("rsync source")
    else:
        log("rsync artifacts")
    raise SystemExit(0)


if command != "ssh":
    fail(f"unexpected synthetic command name: {command}")


if not strict_ssh_options_present(args):
    fail("synthetic ssh: strict SSH options missing")

stdin_bytes = sys.stdin.buffer.read()
stdin_text = stdin_bytes.decode("utf-8", errors="replace")
try:
    separator = args.index("--")
    remote_parts = args[separator + 2:]
    remote_argv = shlex.split(" ".join(remote_parts))
except (ValueError, IndexError):
    fail("synthetic ssh: remote command was malformed")
joined_args = " ".join(remote_argv)

if "inspect-existing" in joined_args:
    if scenario in RETRY_SCENARIOS:
        release_fixture = state_root / "release"
        if (
            not (release_fixture / "stage-receipt").is_file()
            or not (release_fixture / "previous-images.json").is_file()
            or (release_fixture / "install-receipt").exists()
        ):
            log("ssh stage inspect rejected retry fixture")
            raise SystemExit(1)
        log("ssh stage inspect reusable previous-images-present")
        sys.stdout.write("reusable\n")
        raise SystemExit(0)
    if scenario in {
        "operator-apply-retry-candidate-rejected",
        "operator-apply-retry-after-rollback",
        "operator-apply-retry-rollback-snapshot-race",
    }:
        log("ssh stage inspect reusable previous-images-present")
        sys.stdout.write("reusable\n")
        raise SystemExit(0)
    if scenario in {
        "operator-stage-active-without-install-receipt",
        "operator-apply-active-without-install-receipt",
    }:
        log("ssh stage inspect reusable active-without-receipt")
        sys.stdout.write("reusable\n")
        raise SystemExit(0)
    if scenario in {
        "operator-apply-raced-installed",
        "operator-apply-raced-partial",
        "operator-apply-raced-installed-unlock-fails",
        "operator-apply-raced-partial-unlock-fails",
        "operator-apply-raced-active-without-install-receipt",
    }:
        command_history = log_path.read_text(encoding="utf-8")
        if "ssh lock" in command_history:
            if scenario == "operator-apply-raced-active-without-install-receipt":
                log("ssh stage inspect reusable active-without-receipt")
                sys.stdout.write("reusable\n")
                raise SystemExit(0)
            if scenario in {"operator-apply-raced-installed", "operator-apply-raced-installed-unlock-fails"}:
                log("ssh stage inspect installed")
                sys.stdout.write("installed\n")
                raise SystemExit(0)
            log("ssh stage inspect rejected")
            raise SystemExit(1)
        log("ssh stage inspect reusable")
        sys.stdout.write("reusable\n")
        raise SystemExit(0)
    if scenario == "operator-stage-reused":
        log("ssh stage inspect reusable")
        sys.stdout.write("reusable\n")
        raise SystemExit(0)
    if scenario in {"operator-stage-installed", "operator-apply-installed", "operator-apply-installed-inactive"}:
        log("ssh stage inspect installed")
        sys.stdout.write("installed\n")
        raise SystemExit(0)
    if scenario == "operator-stage-partial":
        log("ssh stage inspect rejected")
        raise SystemExit(1)
    if os.environ.get("CATERING_TARGET_FAKE_MODE") == "apply":
        log("ssh stage inspect reusable")
        sys.stdout.write("reusable\n")
        raise SystemExit(0)
    log("ssh stage inspect absent")
    sys.stdout.write("absent\n")
    raise SystemExit(0)

if scenario == "operator-smoke" and "node -e" in joined_args:
    expected_prefix = [
        "sudo", "-n", "docker", "exec", "-i", "platform-infra-intake-1", "node", "-e"
    ]
    if remote_argv[:len(expected_prefix)] != expected_prefix or len(remote_argv) != len(expected_prefix) + 1:
        fail("synthetic operator smoke: command was not transported as a bound argument vector")

if 'stage_tool_sha="${12}"' in stdin_text:
    try:
        # OpenSSH sends remote argv as one shell command string; empty values
        # disappear unless the caller quotes each argument for that shell.
        script_separator = remote_argv.index("--")
        activation_parameters = remote_argv[script_separator + 1:]
    except ValueError:
        fail("synthetic ssh: remote activation command was malformed")
    probe = subprocess.run(
        ["bash", "-euo", "pipefail", "-c", 'stage_tool_sha="${12}"', "remote-activation", *activation_parameters],
        capture_output=True,
        text=True,
        check=False,
    )
    if probe.returncode != 0:
        fail("synthetic ssh: remote activation arguments were not preserved")


def classify_override() -> str:
    if scenario in RETRY_SCENARIOS:
        release_match = re.search(r"/opt/catering-releases/([0-9a-f]{40})/candidate-images\.json", joined_args)
        if release_match is None:
            fail("synthetic retry: override release path was not bound")
        return "candidate" if release_match.group(1) == os.environ["DEPLOY_COMMIT_SHA"] else "previous"
    if scenario.startswith("operator-"):
        installed_file = state_root / "installed-release"
        if installed_file.exists():
            installed_sha = installed_file.read_text(encoding="ascii")
            if f"/opt/catering-releases/{installed_sha}/candidate-images.json" in joined_args:
                return "previous"
    if "candidate-images.json" in joined_args:
        return "candidate"
    if "previous-images.json" in joined_args:
        return "previous"
    fail("synthetic ssh: override path missing")
    return "unknown"


if "docker exec -i" in joined_args and "catering-target-authenticated-smoke.mjs" in joined_args:
    log("ssh smoke")
    if scenario == "smoke-fails":
        raise SystemExit(1)
    sys.stdout.write("authenticated_read_smoke_ok\n")
    raise SystemExit(0)


if "docker exec -i" in joined_args and "node" in joined_args and "--input-type=module" in joined_args:
    if len(remote_argv) < 10 or remote_argv[6:9] != ["node", "--input-type=module", "-e"]:
        fail("synthetic operator smoke: node source was not one remote argument")
    smoke_source = remote_argv[9]
    if "/api/production/v1/production/plans" not in smoke_source:
        fail("synthetic operator smoke: plans read route missing")
    if "/api/production/v1/production/cases" in smoke_source:
        fail("synthetic operator smoke: forbidden cases route present")
    if "synthetic-password" in joined_args or "synthetic-user" in joined_args:
        fail("synthetic operator smoke: credentials leaked into remote command")
    if "synthetic-password" not in stdin_text or "synthetic-user" not in stdin_text:
        fail("synthetic operator smoke: credential payload was not delivered on stdin")
    smoke_markers = [
        "TARGET_AUTH_SMOKE_STAGE stage=script_start status=success",
        "TARGET_AUTH_SMOKE_STAGE stage=payload_valid status=success",
        'TARGET_AUTH_SMOKE_STAGE stage=login_response status=" + String(login.status)',
        "TARGET_AUTH_SMOKE_STAGE stage=login status=success",
        'TARGET_AUTH_SMOKE_STAGE stage=session_response status=" + String(session.status)',
        "TARGET_AUTH_SMOKE_STAGE stage=session status=success",
        'TARGET_AUTH_SMOKE_STAGE stage=production_read_response status=" + String(plans.status)',
        "TARGET_AUTH_SMOKE_STAGE stage=production_read status=success",
    ]
    if any(marker not in smoke_source for marker in smoke_markers):
        fail("synthetic operator smoke: progress marker source is incomplete")
    for marker in (
        "TARGET_AUTH_SMOKE_STAGE stage=script_start status=success",
        "TARGET_AUTH_SMOKE_STAGE stage=payload_valid status=success",
        "TARGET_AUTH_SMOKE_STAGE stage=login_response status=200",
        "TARGET_AUTH_SMOKE_STAGE stage=login status=success",
        "TARGET_AUTH_SMOKE_STAGE stage=session_response status=200",
        "TARGET_AUTH_SMOKE_STAGE stage=session status=success",
        "TARGET_AUTH_SMOKE_STAGE stage=production_read_response status=200",
        "TARGET_AUTH_SMOKE_STAGE stage=production_read status=success",
    ):
        print(marker, file=sys.stderr)
    log("ssh smoke operator plans")
    if PRESERVATION_SCENARIO and 'rollback-' in scenario:
        raise SystemExit(1)
    if scenario in RETRY_SCENARIOS:
        smoke_count_path = state_root / "smoke-count"
        smoke_count = int(smoke_count_path.read_text(encoding="ascii")) if smoke_count_path.exists() else 0
        smoke_count += 1
        smoke_count_path.write_text(str(smoke_count), encoding="ascii")
        capture_count = int((state_root / "capture-count").read_text(encoding="ascii"))
        if (
            scenario == "operator-p2-retry-after-rollback-sequence" and smoke_count == 1
        ) or (
            scenario == "operator-p2-retry-candidate-rejected-sequence" and capture_count == 2 and smoke_count == 1
        ):
            log("ssh smoke failed for retry fixture")
            raise SystemExit(1)
    sys.stdout.write("authenticated_read_smoke_ok\n")
    raise SystemExit(0)


def schema_migration_digest(repo_root: Path, drift: bool = False) -> str:
    import hashlib

    source = (repo_root / "shared-core/src/persistence.ts").read_text(encoding="utf-8")
    if drift:
        source = source.replace("version_number >= 3", "version_number >= 4", 1)
    start = source.find("const BUSINESS_RECORDS_SCHEMA_MIGRATION")
    end = source.find("\nfunction getCachedPool", start)
    if start < 0 or end < 0:
        fail("synthetic ssh: runtime schema migration region missing")
    return hashlib.sha256(source[start:end].encode("utf-8")).hexdigest()


def ddl_manifest_digest(repo_root: Path) -> str:
    import hashlib
    import json
    import re

    runtime_roots = [
        "shared-core/src",
        "intake-service/src",
        "offer-service/src",
        "production-service/src",
        "print-export/src",
    ]
    ddl = re.compile(r"\b(?:CREATE|ALTER|DROP)\s+TABLE\b|\bCREATE\s+(?:UNIQUE\s+)?INDEX\b", re.I)

    def literals(source: str):
        found = []
        i = 0
        while i < len(source):
            quote = source[i]
            if quote not in ("'", '"', "`"):
                i += 1
                continue
            i += 1
            body = []
            while i < len(source):
                char = source[i]
                if char == "\\" and i + 1 < len(source):
                    body.extend([char, source[i + 1]])
                    i += 2
                    continue
                if char == quote:
                    i += 1
                    break
                body.append(char)
                i += 1
            value = "".join(body).strip()
            if ddl.search(value):
                found.append(hashlib.sha256(value.encode("utf-8")).hexdigest())
        return sorted(found)

    manifest = {}
    for relative_root in runtime_roots:
        directory = repo_root / relative_root
        for path in sorted(directory.rglob("*")):
            if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".mjs"}:
                fragments = literals(path.read_text(encoding="utf-8"))
                if fragments:
                    manifest[str(path.relative_to(repo_root))] = fragments
    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


if "TARGET_RUNTIME_SCHEMA_HASHES" in stdin_text:
    log("ssh schema-source")
    digest = schema_migration_digest(Path.cwd(), drift=scenario == "migration-source-drift")
    for service in ["intake", "offer", "production", "exports"]:
        sys.stdout.write(f"{service}={digest}\n")
    raise SystemExit(0)


if "TARGET_RUNTIME_DDL_HASHES" in stdin_text:
    log("ssh ddl-manifest")
    digest = ddl_manifest_digest(Path.cwd())
    if scenario == "source-document-ddl-drift":
        digest = "0" * 64
    for service in ["intake", "offer", "production", "exports"]:
        sys.stdout.write(f"{service}={digest}\n")
    raise SystemExit(0)

if "TARGET_PREFLIGHT_OK target=" in stdin_text:
    if scenario != "operator-rollback-snapshot-race":
        log("ssh preflight")
    if "CATERING_WRITER_MODE" not in stdin_text or "catering_schema_migrations" not in stdin_text:
        fail("synthetic ssh: production preflight lost writer/schema guards")
    if scenario == "writer-disabled":
        raise SystemExit(1)
    if scenario == "schema-version-old":
        raise SystemExit(1)
    count_file = state_root / "preflight-count"
    count = int(count_file.read_text(encoding="utf-8")) if count_file.exists() else 0
    count += 1
    count_file.write_text(str(count), encoding="utf-8")
    runtime_state = ""
    if scenario.startswith("operator-"):
        if scenario in RETRY_SCENARIOS:
            active_release = state_root / "installed-release"
            release = active_release.read_text(encoding="ascii").strip() if active_release.exists() else "b" * 40
        elif scenario in {"operator-rollback-snapshot-race", "operator-apply-retry-rollback-snapshot-race"} and count == 1:
            release = "a" * 40
        elif scenario in {
            "operator-stage-installed", "operator-apply-installed",
            "operator-stage-active-without-install-receipt", "operator-apply-active-without-install-receipt",
        } or (
            scenario in {"operator-apply-raced-installed", "operator-apply-raced-installed-unlock-fails"} and count >= 2
        ) or (
            scenario == "operator-apply-raced-active-without-install-receipt" and count >= 2
        ):
            release = os.environ["DEPLOY_COMMIT_SHA"]
        else:
            release = "b" * 40
        (state_root / "installed-release").write_text(release, encoding="ascii")
        runtime_state = f"runtime_state=release:{release} "
        log(f"ssh preflight release={release}")
        if scenario in {
            "operator-stage-active-without-install-receipt",
            "operator-apply-active-without-install-receipt",
        } or (
            scenario == "operator-apply-raced-active-without-install-receipt" and count >= 2
        ):
            log("ssh preflight failed active candidate has no install receipt")
            raise SystemExit(1)
    if scenario == "preflight-fails" and count == 1:
        raise SystemExit(1)
    if PRESERVATION_SCENARIO:
        phase_path = state_root / 'preservation-phase'
        phase = phase_path.read_text() if phase_path.exists() else 'initial'
        if scenario.startswith('operator-') and phase == 'candidate':
            runtime_state = 'runtime_state=release:' + os.environ['DEPLOY_COMMIT_SHA'] + ' '
        volume, edge = preservation_observation()
        sys.stdout.write('TARGET_PREFLIGHT_OK target=catering-prod-1 backup=healthy ' + runtime_state
                         + 'postgres_volume=' + volume + ' edge_image=' + edge + '\n')
        raise SystemExit(0)
    sys.stdout.write(
        "TARGET_PREFLIGHT_OK target=catering-prod-1 backup=healthy "
        + runtime_state
        + "postgres_volume=platform-infra_postgres_data "
        "edge_image=sha256:" + "e" * 64 + "\n"
    )
    raise SystemExit(0)


if "--rollback" in remote_argv:
    rollback_sha = remote_argv[remote_argv.index("--rollback") + 1]
    installed_sha = (state_root / "installed-release").read_text(encoding="ascii")
    log(f"ssh verify rollback {rollback_sha}")
    if scenario in RETRY_SCENARIOS:
        expected_sha = (state_root / "previous-release-sha").read_text(encoding="ascii").strip()
        raise SystemExit(0 if rollback_sha == expected_sha else 1)
    raise SystemExit(0 if rollback_sha == installed_sha else 1)


if "bundle manifest binding invalid" in stdin_text:
    count_file = state_root / "bundle-verify-count"
    count = int(count_file.read_text(encoding="utf-8")) if count_file.exists() else 0
    count += 1
    count_file.write_text(str(count), encoding="utf-8")
    log("ssh verify bundle")
    raise SystemExit(0)

if 'python3 -B -I "$tool" write' in stdin_text:
    log("ssh stage receipt write")
    raise SystemExit(0)

if 'python3 -B -I "$tool" verify' in stdin_text:
    if scenario == "operator-stage-binding-drift":
        log("ssh stage receipt verify failed")
        raise SystemExit(1)
    log("ssh stage receipt verify")
    raise SystemExit(0)

if "# TARGET_STAGE_BINDING_CAPTURE" in stdin_text and len(remote_argv) > 9 and remote_argv[9] == "true":
    if scenario == "operator-stage-binding-drift-before-load":
        log("ssh stage receipt verify capture failed")
        raise SystemExit(1)
    active_release = (state_root / "installed-release").read_text(encoding="ascii")
    log("ssh stage receipt verify capture")
    log(f"ssh capture previous active-release={active_release}")
    if scenario in RETRY_SCENARIOS:
        capture_match = re.search(
            r"sudo -n python3 - \"\$release_dir/previous-images\.json\"[^\n]*<<'PY'\n(.*?)\nPY",
            stdin_text,
            re.DOTALL,
        )
        if capture_match is None:
            fail("synthetic retry: production previous-image writer was not found")
        images = json.loads((state_root / "active-images.json").read_text(encoding="utf-8"))["services"]
        previous_path = state_root / "release" / "previous-images.json"
        writer = subprocess.run(
            [
                os.environ["CATERING_TARGET_REAL_PYTHON3"],
                "-c",
                capture_match.group(1),
                str(previous_path),
                images["intake"]["image"],
                images["offer"]["image"],
                images["production"]["image"],
                images["exports"]["image"],
                images["web"]["image"],
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if writer.returncode != 0:
            fail("synthetic retry: production previous-image writer failed")
        capture_count_path = state_root / "capture-count"
        capture_count = int(capture_count_path.read_text(encoding="ascii")) if capture_count_path.exists() else 0
        capture_count += 1
        capture_count_path.write_text(str(capture_count), encoding="ascii")
        if scenario == "operator-p2-retry-candidate-rejected-sequence" and capture_count == 1:
            log("ssh candidate rejected before image load")
            raise SystemExit(1)
    log("ssh load")
    raise SystemExit(0)

if "stage receipt binding mismatch" in stdin_text and "python3" in joined_args and "verify" in remote_argv:
    if scenario == "operator-stage-binding-drift":
        log("ssh stage receipt verify failed")
        raise SystemExit(1)
    log("ssh stage receipt verify")
    raise SystemExit(0)

if "stage receipt already exists" in stdin_text and "python3" in joined_args and "write" in remote_argv:
    log("ssh stage receipt write")
    raise SystemExit(0)

if "install receipt binding mismatch" in stdin_text:
    log("ssh verify install receipt")
    raise SystemExit(0)


if "target update lock already exists" in stdin_text and "owner.pending" in stdin_text:
    log("ssh lock")
    if PRESERVATION_SCENARIO:
        (state_root / 'lock-observed').write_text('held')
    raise SystemExit(0)


if 'sudo -n unlink "$lock/owner"' in stdin_text and 'sudo -n rmdir "$lock"' in stdin_text:
    if scenario.endswith("-unlock-fails"):
        log("ssh unlock failed")
        raise SystemExit(42)
    log("ssh unlock")
    raise SystemExit(0)


if "release directory already exists" in stdin_text and "release_root" in stdin_text:
    log("ssh release")
    raise SystemExit(0)


if "previous-images.json" in stdin_text and "docker load" in stdin_text:
    log("ssh load")
    raise SystemExit(0)


if "up -d --no-deps" in stdin_text:
    which = classify_override()
    log(f"ssh activate {which}")
    if PRESERVATION_SCENARIO:
        (state_root / 'preservation-phase').write_text(which)
    if scenario in RETRY_SCENARIOS:
        release_match = re.search(r"/opt/catering-releases/([0-9a-f]{40})/candidate-images\.json", joined_args)
        if release_match is None:
            fail("synthetic retry: activated release path was not bound")
        if which == "candidate":
            (state_root / "installed-release").write_text(os.environ["DEPLOY_COMMIT_SHA"], encoding="ascii")
        else:
            rollback_sha = release_match.group(1)
            (state_root / "installed-release").write_text(rollback_sha, encoding="ascii")
            previous = json.loads((state_root / "release" / "previous-images.json").read_text(encoding="utf-8"))
            (state_root / "active-images.json").write_text(json.dumps(previous) + "\n", encoding="utf-8")
        raise SystemExit(0)
    if scenario in {
        "activate-fails", "operator-rollback-snapshot-race", "operator-apply-retry-rollback-snapshot-race",
    } and which == "candidate":
        raise SystemExit(1)
    if scenario == "rollback-fails":
        raise SystemExit(1)
    raise SystemExit(0)


if "check_health()" in stdin_text:
    services = {
        "intake": "platform-infra-intake-1 http://127.0.0.1:3101/health",
        "offer": "platform-infra-offer-1 http://127.0.0.1:3102/health",
        "production": "platform-infra-production-1 http://127.0.0.1:3103/health",
        "exports": "platform-infra-exports-1 http://127.0.0.1:3104/health",
    }
    for service, invocation in services.items():
        marker = f"TARGET_UPDATE_STAGE stage=health service={service} status=success"
        failed_marker = f"TARGET_UPDATE_STAGE stage=health service={service} status=failed"
        if invocation not in stdin_text or marker not in stdin_text or failed_marker not in stdin_text:
            fail("synthetic health verify: per-service status markers missing")
        print(marker, file=sys.stderr)
    which = classify_override()
    log(f"ssh verify {which}")
    if PRESERVATION_SCENARIO:
        # Execute the shipped preservation checks; only Docker inspection is synthetic.
        # This catches rebinding in the real caller instead of trusting a canned verify result.
        marker = 'actual_postgres_volume="'
        start = stdin_text.index(marker)
        end = stdin_text.index('\ncheck_health() {', start)
        parameters = remote_argv[remote_argv.index('--') + 1:]
        if len(parameters) != 4:
            fail('synthetic preservation: verify argument binding invalid')
        expected_volume, expected_edge = parameters[2:]
        volume, edge = preservation_observation(at_verify=True)
        docker_observation = json.dumps([{'Mounts': [{'Type': 'volume',
            'Destination': '/var/lib/postgresql/data', 'Name': volume}]}])
        fixture_shell = '''
sudo() {
  [[ "$1" == -n && "$2" == docker && "$3" == inspect ]] || return 86
  if [[ "$4" == platform-infra-postgres-1 ]]; then
    printf '%s\\n' "$P41_DOCKER_POSTGRES"
  elif [[ "$4" == --format && "$5" == '{{.Image}}' && "$6" == catering-edge-edge-1 ]]; then
    printf '%s\\n' "$P41_DOCKER_EDGE"
  else
    return 86
  fi
}
expected_postgres_volume="$1"; expected_edge_image="$2"
'''
        probe = subprocess.run(['/bin/bash', '-euo', 'pipefail', '-c',
            fixture_shell + stdin_text[start:end], 'preservation', expected_volume, expected_edge],
            env=dict(os.environ, P41_DOCKER_POSTGRES=docker_observation, P41_DOCKER_EDGE=edge),
            capture_output=True, text=True, check=False)
        log(f'ssh preservation {which} expected_volume={expected_volume} expected_edge={expected_edge} '
            f'observed_volume={volume} observed_edge={edge} exit={probe.returncode}')
        sys.stderr.write(probe.stderr)
        raise SystemExit(probe.returncode)
    raise SystemExit(0)


if "install-receipt" in stdin_text and "installed_at=" in stdin_text:
    log("ssh receipt")
    if scenario in RETRY_SCENARIOS:
        release_fixture = state_root / "release"
        (release_fixture / "install-receipt").write_text("synthetic successful install\n", encoding="ascii")
        (state_root / "installed-release").write_text(os.environ["DEPLOY_COMMIT_SHA"], encoding="ascii")
    raise SystemExit(0)


if not stdin_text and "chmod 0644" in joined_args:
    log("ssh chmod")
    raise SystemExit(0)


fail("synthetic ssh: unclassified invocation")
