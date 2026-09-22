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


if "shared-core/src/persistence.ts" in stdin_text and "sudo -n cat" in stdin_text:
    log("ssh schema-source")
    source = (Path.cwd() / "shared-core/src/persistence.ts").read_text(encoding="utf-8")
    if scenario == "migration-source-drift":
        source = source.replace("version_number >= 3", "version_number >= 4", 1)
    sys.stdout.write(source)
    raise SystemExit(0)

if "TARGET_PREFLIGHT_OK target=" in stdin_text:
    log("ssh preflight")
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
