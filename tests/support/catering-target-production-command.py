#!/usr/bin/env python3
"""Synthetic command boundary for the real Catering target production updater.

This fixture never contacts a server or Docker daemon. The production shell
control flow remains real; only ssh/docker/rsync are substituted.
"""
from __future__ import annotations

import os
from pathlib import Path
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


def classify_override() -> str:
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


if "TARGET_RUNTIME_DDL_MANIFEST" in stdin_text:
    log("ssh ddl-manifest")
    digest = ddl_manifest_digest(Path.cwd())
    if scenario == "source-document-ddl-drift":
        digest = "0" * 64
    sys.stdout.write(digest + "\n")
    raise SystemExit(0)


if "shared-core/src/persistence.ts" in stdin_text and "sudo -n cat" in stdin_text:
    log("ssh schema-source")
    source = (Path.cwd() / "shared-core/src/persistence.ts").read_text(encoding="utf-8")
    if scenario == "migration-source-drift":
        source = source.replace("version_number >= 3", "version_number >= 4", 1)
    sys.stdout.write(source)
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
        "TARGET_PREFLIGHT_OK target=catering-prod-1 backup=healthy "
        "postgres_volume=platform-infra_postgres_data "
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


if "previous-images.json" in stdin_text and "docker load" in stdin_text:
    log("ssh load")
    raise SystemExit(0)


if "up -d --no-deps" in stdin_text:
    which = classify_override()
    log(f"ssh activate {which}")
    if scenario == "activate-fails" and which == "candidate":
        raise SystemExit(1)
    if scenario == "rollback-fails":
        raise SystemExit(1)
    raise SystemExit(0)


if "check_health()" in stdin_text:
    which = classify_override()
    log(f"ssh verify {which}")
    raise SystemExit(0)


if "install-receipt" in stdin_text and "installed_at=" in stdin_text:
    log("ssh receipt")
    raise SystemExit(0)


if not stdin_text and "chmod 0644" in joined_args:
    log("ssh chmod")
    raise SystemExit(0)


fail("synthetic ssh: unclassified invocation")
