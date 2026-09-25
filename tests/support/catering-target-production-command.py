#!/usr/bin/env python3
"""Synthetic command boundary for the real Catering target production updater.

This fixture never contacts a server or Docker daemon. The production shell
control flow remains real; only ssh/docker/rsync are substituted.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shlex
import subprocess
import sys

state_root = Path(os.environ["CATERING_TARGET_FAKE_STATE"])
scenario = os.environ.get("CATERING_TARGET_FAKE_SCENARIO", "healthy")
log_path = state_root / "commands.log"
command = Path(sys.argv[0]).name
args = sys.argv[1:]


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
    fail("synthetic docker: local Docker is forbidden for fixed production candidates")


if command == "rsync":
    destination = args[-1] if args else ""
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
joined_args = " ".join(args)
try:
    remote_index = args.index("operator@target.invalid")
except ValueError:
    fail("synthetic ssh: remote target missing")
remote_args = args[remote_index + 1:]
remote_command = " ".join(remote_args)


def classify_override() -> str:
    if "candidate-images.json" in joined_args:
        return "candidate"
    if "previous-images.json" in joined_args:
        return "previous"
    fail("synthetic ssh: override path missing")
    return "unknown"


if "docker exec -i" in remote_command and "node" in remote_command and "--input-type=module" in remote_command:
    for shell in ("/bin/bash", "/bin/dash"):
        syntax = subprocess.run([shell, "-n", "-c", remote_command], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if syntax.returncode != 0:
            fail(f"synthetic ssh: remote shell parse failed under {shell}: {syntax.stderr.strip()}")
    try:
        parsed = shlex.split(remote_command, posix=True)
        script = parsed[parsed.index("-e") + 1]
    except (ValueError, IndexError):
        fail("synthetic ssh: smoke argv parse failed")
    production = (Path.cwd() / "platform-infra/scripts/catering-target-production-update.sh").read_text(encoding="utf-8")
    marker = "  read -r -d '' smoke_script <<'NODE' || true\n"
    start = production.find(marker)
    end = production.find("\nNODE\n", start + len(marker))
    if start < 0 or end < 0:
        fail("synthetic ssh: embedded smoke source missing")
    expected_script = production[start + len(marker):end]
    actual_hash = hashlib.sha256(script.encode("utf-8")).hexdigest()
    expected_hash = hashlib.sha256(expected_script.encode("utf-8")).hexdigest()
    if actual_hash != expected_hash:
        fail("synthetic ssh: smoke -e payload changed across SSH transport")
    if "/api/production/v1/production/plans" not in script or "/api/production/v1/production/cases" in script:
        fail("synthetic ssh: wrong read-only smoke route")
    log("ssh smoke")
    log(f"ssh smoke script_sha256={actual_hash}")
    if scenario == "smoke-fails":
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
    if scenario == "preflight-fails" and count == 1:
        raise SystemExit(1)
    sys.stdout.write(
        "TARGET_PREFLIGHT_OK target=catering-prod-1 backup=healthy writer=enabled schema_version=3 "
        "runtime_state=baseline postgres_volume=platform-infra_postgres_data "
        "edge_image=sha256:" + "e" * 64 + "\n"
    )
    raise SystemExit(0)


if "target update lock already exists" in stdin_text and "owner.pending" in stdin_text:
    log("ssh lock")
    raise SystemExit(0)


if 'sudo -n unlink "$lock/owner"' in stdin_text and 'sudo -n rmdir "$lock"' in stdin_text:
    log("ssh unlock")
    raise SystemExit(0)


if "release directory already exists" in stdin_text and "release_root" in stdin_text:
    log("ssh release")
    raise SystemExit(0)

if 'source_dir="$release_dir/source"' in stdin_text and "chown -R root:root" in stdin_text:
    log("ssh release-ownership")
    raise SystemExit(0)

if "previous-images.json" in stdin_text and "docker image inspect" in stdin_text and "candidate-images.json" in stdin_text:
    log("ssh candidate-bind")
    if scenario == "candidate-image-missing":
        raise SystemExit(1)
    raise SystemExit(0)

if 'installed="$release_root/installed"' in stdin_text and "force-recreate" in stdin_text:
    log("ssh restore-current")
    if scenario == "rollback-fails":
        raise SystemExit(1)
    raise SystemExit(0)


if "up -d --no-deps" in stdin_text:
    which = classify_override()
    log(f"ssh activate {which}")
    if scenario == "activate-fails" and which == "candidate":
        raise SystemExit(1)
    raise SystemExit(0)


if "check_health()" in stdin_text:
    which = classify_override()
    log(f"ssh verify {which}")
    raise SystemExit(0)


if "install-receipt" in stdin_text and "installed_at=" in stdin_text:
    log("ssh receipt")
    raise SystemExit(0)


fail("synthetic ssh: unclassified invocation")
