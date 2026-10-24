"""Reviewed NUE cold backup/restore core; manual admission remains fail closed."""
import base64
import datetime
import hashlib
import json
import os
import re
from pathlib import Path
import signal
import selectors
import socket
import stat
import subprocess
import sys
import tarfile
import time

DATABASES = ("catering_agents", "catering_agents_pre_cutover_20260920", "catering_operator_probe_20260919")
NAMES = tuple("platform-infra-" + s + "-1" for s in ("postgres", "intake", "offer", "production", "exports", "web")) + ("catering-edge-edge-1",)
VOLUMES = ("platform-infra_postgres_data", "platform-infra_caddy_data", "platform-infra_caddy_config", "catering-edge_edge_caddy_data", "catering-edge_edge_caddy_config")
CONFIG_ROOTS = ("/etc/catering-target", "/opt/catering-agents-platform/platform-infra", "/opt/catering-edge")
LIMIT = 2 * 1024 ** 3
RESERVE = 1024 ** 3
LOCK = Path("/opt/catering-target-update.lock")
EDGE_CONFIG_SHA256 = "2f432e92aba90d6f4c533cb3f0cc2cbbd854ba6cc7316a286fcde2e7b1585001"

COMMON_SHA256 = '67741391dbabedef7508c7fe9855f943761ead6eda879420cc9c7a81e60608de'


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def command(args, timeout=90, output=None):
    result = subprocess.run(args, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    # Dump and credential errors can contain secrets: only the command class and exit are reportable.
    require(result.returncode == 0, "COMMAND_FAILED:" + args[0] + ":" + str(result.returncode))
    return result.stdout if output is None else b""


def checked_run_id(value):
    require(len(value) == 32 and all(c in "0123456789abcdef" for c in value), "RUN_ID_INVALID")
    return value


def paths(run_id, phase):
    checked_run_id(run_id)
    require(phase in ("capture", "restore"), "PHASE_INVALID")
    root = Path("/run/catering-nue-" + phase + "-" + run_id)
    durable = Path("/var/lib/catering-nue-proof-" + run_id)
    return root, durable


def put(path, value):
    body = (json.dumps(value, sort_keys=True, ensure_ascii=True, indent=2) + "\n").encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as target:
        target.write(body)
        target.flush()
        os.fsync(target.fileno())
    return hashlib.sha256(body).hexdigest()


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(131072), b""):
            value.update(block)
    return value.hexdigest()


def plain_digest(path):
    lines = path.read_bytes().splitlines(keepends=True)
    starts = [i for i, line in enumerate(lines) if line.startswith(b"\\restrict ")]
    ends = [i for i, line in enumerate(lines) if line.startswith(b"\\unrestrict ")]
    if starts or ends:
        require(len(starts) == len(ends) == 1 and starts[0] < ends[0], "DUMP_RESTRICT_FRAME")
        require(lines[starts[0]].split()[1] == lines[ends[0]].split()[1], "DUMP_RESTRICT_PAIR")
        require(all(not line.strip() or line.startswith(b"--") for line in lines[:starts[0]] + lines[ends[0] + 1:]), "DUMP_RESTRICT_POSITION")
        lines = [line for i, line in enumerate(lines) if i not in (starts[0], ends[0])]
    return hashlib.sha256(b"".join(lines)).hexdigest()


def file_index(root):
    root = Path(root)
    result = []
    for current, dirs, files in os.walk(root, followlinks=False):
        for name in (["."] if Path(current) == root else []) + sorted(dirs + files):
            path = Path(current) if name == "." else Path(current) / name
            info = path.lstat()
            require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), "UNSUPPORTED_SOURCE_FILE_TYPE")
            row = dict(path=str(path.relative_to(root)), uid=info.st_uid, gid=info.st_gid,
                       mode=stat.S_IMODE(info.st_mode), type="directory" if path.is_dir() else "file",
                       xattrs={name: base64.b64encode(os.getxattr(path, name, follow_symlinks=False)).decode()
                               for name in sorted(os.listxattr(path, follow_symlinks=False))})
            if path.is_file():
                row.update(bytes=info.st_size, sha256=digest(path))
                after = path.lstat()
                require((info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns) ==
                        (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), "SOURCE_FILE_CHANGED")
            result.append(row)
    return sorted(result, key=lambda row: row["path"])


def assert_host():
    require(os.geteuid() == 0 and socket.gethostname() == "catering-prod-02", "HOST_IDENTITY")
    require("2.28.200.16" in command(["ip", "-j", "address"]).decode(), "HOST_ADDRESS")
    require(os.path.samestat(os.stat("/proc/self/ns/mnt"), os.stat("/proc/1/ns/mnt")), "HOST_MOUNT_NAMESPACE_REQUIRED")
    os.umask(0o077)


def inspect(ids):
    return json.loads(command(["docker", "inspect", *ids]))



def verify_bound_regular_file(path, expected_hash, expected_size=None):
    require(path.is_absolute() and path.resolve(strict=True) == path, "BOUND_FILE_PATH")
    for parent in path.parents:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022, "BOUND_FILE_PARENT")
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0 and before.st_nlink == 1
            and not before.st_mode & 0o022 and before.st_size <= LIMIT, "BOUND_FILE_METADATA")
    require(expected_size is None or before.st_size == expected_size, "BOUND_FILE_SIZE")
    generation = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_gid, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    require(digest(path) == expected_hash and generation(before) == generation(path.lstat()), "BOUND_FILE_CHANGED")


def known_node_compile_cache(path):
    parts = path.split("/")
    prefix = ["", "tmp", "node-compile-cache"]
    return parts == prefix or parts == prefix + ["v22.23.3-x64-9de703df-0"] or (
        len(parts) == 5 and parts[:4] == prefix + ["v22.23.3-x64-9de703df-0"]
        and len(parts[4]) == 8 and all(c in "0123456789abcdef" for c in parts[4]))


def check_web_readiness():
    # The preserved edge ACL deliberately denies loopback before authentication.
    # Bind that expectation to the actual original config; 403 is not an authenticated smoke.
    verify_bound_regular_file(Path("/opt/catering-edge/Caddyfile"), EDGE_CONFIG_SHA256)
    observed = {}
    for name, url, resolve, accepted in (
        ("web", "http://127.0.0.1:18081/", [], ("200", "401")),
        ("tls", "https://catering.the-one.catering/",
         ["--resolve", "catering.the-one.catering:443:127.0.0.1"], ("403",))):
        deadline = time.monotonic() + 60
        while True:
            result = subprocess.run(
                ["curl", "--noproxy", "*", "--connect-timeout", "5", "--max-time", "10",
                 "--silent", "--output", "/dev/null", "--write-out", "%{http_code}", *resolve, url],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15)
            code = result.stdout.decode("ascii", errors="replace")
            if result.returncode == 0 and code in accepted:
                observed[name] = code
                break
            require(time.monotonic() < deadline, "WEB_OR_TLS_RESUME_FAILED")
            time.sleep(1)
    return observed


SCHEDULER_GATE = None


def observer_cron_admission(expected):
    allowed = {'e2scrub_all', '.placeholder', 'sysstat'}
    bindings = expected.get('observerFiles')
    if bindings is not None:
        require(SCHEDULER_GATE is not None and set(bindings) == {
            '/usr/local/libexec/catering-backup-observer.py', '/etc/cron.d/catering-backup-monitor',
            '/etc/catering-backup-monitor/policy.json', '/etc/catering-backup-monitor/heartbeat-url'}, 'OBSERVER_SCOPE_INVALID')
        for name, expected_hash in bindings.items():
            require(re.fullmatch('[0-9a-f]{64}', expected_hash), 'OBSERVER_DIGEST_INVALID')
            verify_bound_regular_file(Path(name), expected_hash)
            if name.startswith('/etc/catering-backup-monitor/'):
                require(stat.S_IMODE(Path(name).lstat().st_mode) == 0o600, 'OBSERVER_PRIVATE_MODE')
        allowed.add('catering-backup-monitor')
    require({p.name for p in Path('/etc/cron.d').iterdir()} <= allowed, 'CRON_SCOPE_CHANGED')


def assert_current(expected):
    require(isinstance(expected.get("runtimeEnvSha256"), str) and digest(Path("/etc/catering-target/runtime.env")) == expected["runtimeEnvSha256"], "CURRENT_RUNTIME_ENV_CHANGED")
    ids = command(["docker", "ps", "-aq", "--no-trunc"]).decode().splitlines()
    rows = inspect(ids)
    require({r["Name"].lstrip("/") for r in rows} == set(NAMES), "CONTAINER_SCOPE_CHANGED")
    previous = {r["name"].lstrip("/"): r for r in expected["containers"]}
    for row in rows:
        old = previous[row["Name"].lstrip("/")]
        require(row["Id"] == old["id"] and row["Image"] == old["image"] and row["Mounts"] == old["mounts"], "CONTAINER_BINDING_CHANGED")
        require(row["State"]["Running"] and not row["State"].get("Paused"), "CONTAINER_STATE_CHANGED")
        require(row["HostConfig"]["RestartPolicy"] == old["restart"], "RESTART_POLICY_CHANGED")
    for service in ("intake", "offer", "production", "exports"):
        changed = command(["docker", "diff", "platform-infra-" + service + "-1"]).decode().splitlines()
        for item in changed:
            path = item[2:]
            require(path in ("/tmp", "/root", "/root/.npm", "/root/.npm/_logs", "/root/.npm/_update-notifier-last-checked") or
                    path.startswith(("/tmp/tsx-0/", "/root/.npm/_logs/")) or path == "/tmp/tsx-0" or known_node_compile_cache(path), "UNKNOWN_BACKEND_WRITABLE_PATH")
    pg = next(row for row in rows if row["Name"] == "/platform-infra-postgres-1")
    prefix = ["docker", "exec", "-u", "postgres", pg["Id"]]
    sql = "SELECT json_build_object('databases',(SELECT json_agg(datname ORDER BY datname) FROM pg_database WHERE NOT datistemplate AND datname<>'postgres'),'prepared',(SELECT count(*) FROM pg_prepared_xacts),'externalTablespaces',(SELECT count(*) FROM pg_tablespace WHERE pg_tablespace_location(oid)<>''));"
    catalogue = json.loads(command(prefix + ["psql", "-X", "-U", "catering", "-d", "postgres", "-Atc", sql]))
    require(catalogue["databases"] == sorted(DATABASES) and catalogue["prepared"] == catalogue["externalTablespaces"] == 0, "DATABASE_SCOPE_CHANGED")
    require(command(prefix + ["postgres", "--version"]).decode().strip() == "postgres (PostgreSQL) 17.9", "POSTGRES_VERSION_CHANGED")
    if SCHEDULER_GATE is None:
        for unit in ("catering-backup.service", "catering-backup.timer", "catering-restore-probe.service"):
            state = command(["systemctl", "show", unit, "--property=LoadState,ActiveState", "--no-pager"]).decode()
            require("LoadState=not-found" in state and "ActiveState=inactive" in state, "SCHEDULER_STATE_CHANGED")
    else:
        SCHEDULER_GATE()
    cron = subprocess.run(["crontab", "-l", "-u", "root"], capture_output=True, timeout=15)
    require(cron.returncode == 1 and not cron.stdout, "ROOT_CRONTAB_PRESENT")
    observer_cron_admission(expected)
    return rows


def admit_memory():
    available = int(next(line.split()[1] for line in Path("/proc/meminfo").read_text().splitlines() if line.startswith("MemAvailable:"))) * 1024
    require(available >= 2 * LIMIT + 536870912 + RESERVE, "MEMORY_HEADROOM_INSUFFICIENT")


def workspace(run_id, phase):
    root, durable = paths(run_id, phase)
    require(not os.path.lexists(root), "WORKSPACE_ALREADY_EXISTS")
    root.mkdir(mode=0o700)
    try:
        command(["mount", "-t", "tmpfs", "-o", "size=" + str(LIMIT) + ",nr_inodes=100000,mode=0700,nodev,nosuid,noexec", "tmpfs", str(root)])
        require(os.path.ismount(root), "WORKSPACE_NOT_TMPFS")
        put(root / "owner.json", {"runId": run_id, "phase": phase})
        return root, durable
    except BaseException:
        # This path was absent before our mkdir. A timed-out mount child is reaped by subprocess.run.
        require(root.is_dir() and not root.is_symlink() and root.stat().st_uid == 0, "WORKSPACE_SETUP_CLEANUP_HOLD")
        if os.path.ismount(root):
            command(["umount", str(root)])
        require(not os.path.ismount(root), "WORKSPACE_SETUP_CLEANUP_HOLD")
        root.rmdir()
        raise


def own_lock(run_id):
    require(not os.path.lexists(LOCK), "FOREIGN_UPDATE_LOCK")
    LOCK.mkdir(mode=0o700)
    put(LOCK / "owner.json", {"runId": run_id, "purpose": "NUE_BACKUP_ONCE"})


def lock_owned(run_id):
    require(not LOCK.is_symlink() and json.loads((LOCK / "owner.json").read_text()) == {"runId": run_id, "purpose": "NUE_BACKUP_ONCE"}, "UPDATE_LOCK_NOT_OWNED")


def release_lock(run_id):
    lock_owned(run_id)
    # This removes only this invocation's coordination marker, never existing data or a foreign guard.
    (LOCK / "owner.json").unlink()
    LOCK.rmdir()


def find_owned_probe(name, run_id):
    ids = command(["docker", "ps", "-aq", "--no-trunc", "--filter", "name=^/" + name + "$"]).decode().splitlines()
    require(len(ids) <= 1, "AMBIGUOUS_PROBE_IDENTITY")
    if not ids:
        return None
    row = inspect(ids)[0]
    require(row["Name"] == "/" + name and row["Config"]["Labels"].get("catering.nue.probe") == run_id, "PROBE_NOT_OWNED")
    return row["Id"]


def cleanup_probe(name, run_id):
    own_id = find_owned_probe(name, run_id)
    if own_id:
        command(["docker", "container", "remove", "--force", "--volumes", own_id])
    require(find_owned_probe(name, run_id) is None, "PROBE_CLEANUP_FAILED")


def stop_owned(container_id, pending):
    pending.add(container_id)
    command(["docker", "stop", "--timeout", "-1", container_id], timeout=90)
    require(not inspect([container_id])[0]["State"]["Running"], "STOP_NOT_COMPLETE")
    pending.remove(container_id)


def settle_stops(pending):
    deadline = time.monotonic() + 180
    while pending:
        for container_id in tuple(pending):
            if not inspect([container_id])[0]["State"]["Running"]:
                pending.remove(container_id)
        require(not pending or time.monotonic() < deadline, "STOP_OUTCOME_UNKNOWN_KEEP_LOCK")
        if pending:
            time.sleep(1)


RECOVERING = False


def interrupted(signum, frame):
    if not RECOVERING:
        raise RuntimeError("INTERRUPTED:" + str(signum))


def resume(rows):
    by_name = {row["Name"].lstrip("/"): row for row in rows}
    for name in ("platform-infra-postgres-1", "platform-infra-intake-1", "platform-infra-offer-1", "platform-infra-production-1", "platform-infra-exports-1", "platform-infra-web-1", "catering-edge-edge-1"):
        row = by_name[name]
        require(inspect([row["Id"]])[0]["Image"] == row["Image"], "ORIGINAL_IMAGE_CHANGED")
        if row["State"]["Running"]:
            command(["docker", "start", row["Id"]])
        if name == "platform-infra-postgres-1":
            deadline = time.monotonic() + 60
            while subprocess.run(["docker", "exec", "-u", "postgres", row["Id"], "pg_isready", "-U", "catering", "-d", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10).returncode:
                require(time.monotonic() < deadline, "POSTGRES_RESUME_TIMEOUT")
                time.sleep(1)
    for row in rows:
        policy = row["HostConfig"]["RestartPolicy"]
        name = policy["Name"]
        if name == "on-failure" and policy.get("MaximumRetryCount"):
            name += ":" + str(policy["MaximumRetryCount"])
        command(["docker", "update", "--restart=" + name, row["Id"]])
    deadline = time.monotonic() + 60
    for service, port in (("intake", 3101), ("offer", 3102), ("production", 3103), ("exports", 3104)):
        row = by_name["platform-infra-" + service + "-1"]
        while subprocess.run(["docker", "exec", row["Id"], "node", "-e", "fetch('http://127.0.0.1:" + str(port) + "/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10).returncode:
            require(time.monotonic() < deadline, "APPLICATION_RESUME_TIMEOUT")
            time.sleep(1)
    check_web_readiness()
    for original in rows:
        row = inspect([original["Id"]])[0]
        require(row["Image"] == original["Image"] and row["State"]["Running"] == original["State"]["Running"] and row["HostConfig"]["RestartPolicy"] == original["HostConfig"]["RestartPolicy"], "ORIGINAL_STATE_NOT_RESTORED")


def archive(path, root):
    command(["tar", "--create", "--file", str(path), "--acls", "--xattrs", "--numeric-owner", "--format=pax", "--directory", str(root), "."], timeout=300)


def protected_bytes(path, expected_hash=None):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path, "ADMISSION_PATH_INVALID")
    for parent in path.parents:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022, "ADMISSION_PARENT_INVALID")
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600 and info.st_size <= 262144, "ADMISSION_FILE_INVALID")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as source:
        generation = lambda value: (value.st_dev, value.st_ino, value.st_mode, value.st_uid, value.st_gid, value.st_nlink, value.st_size, value.st_mtime_ns, value.st_ctime_ns)
        require(generation(os.fstat(source.fileno())) == generation(info), "ADMISSION_FILE_REPLACED")
        body = source.read(262145)
        require(len(body) == info.st_size and generation(os.fstat(source.fileno())) == generation(info) == generation(path.lstat()), "ADMISSION_FILE_CHANGED")
    if expected_hash is not None:
        require(hashlib.sha256(body).hexdigest() == expected_hash, "ADMISSION_DIGEST_MISMATCH")
    return body


def validate_admission(expected, run_id):
    directory = Path("/var/lib/catering-nue-admission-" + checked_run_id(run_id))
    require(expected.get("admissionDirectory") == str(directory), "OPERATOR_ADMISSION_REQUIRED")
    bindings = expected.get("admissionFiles", {})
    require(set(bindings) == {"common.sh", "parameters.json", "offhost", "recovery"}, "ADMISSION_BINDINGS_REQUIRED")
    require(bindings["common.sh"] == COMMON_SHA256, "UNREVIEWED_ADMISSION_VALIDATOR")
    for name, value in bindings.items():
        require(isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value), "ADMISSION_DIGEST_INVALID")
        protected_bytes(directory / name, value)
    parameters = json.loads(protected_bytes(directory / "parameters.json", bindings["parameters.json"]))
    allowed = {
        "CATERING_BACKUP_REPOSITORY_VALUE", "CATERING_BACKUP_EXPECTED_REPOSITORY_ID",
        "CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256", "CATERING_BACKUP_PRODUCTION_HOST_SHA256",
        "CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256", "CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES",
        "CATERING_REQUIRED_SECRET_SCHEMA_SHA256", "CATERING_SECRET_RECOVERY_SOURCE_TYPE",
        "CATERING_SECRET_RECOVERY_SOURCE_REFERENCE", "CATERING_SECRET_RECOVERY_REFERENCE_SHA256"
    }
    require(set(parameters) == allowed and all(isinstance(v, str) and "\x00" not in v for v in parameters.values()), "ADMISSION_PARAMETERS_INVALID")
    host_hash = hashlib.sha256(socket.gethostname().encode()).hexdigest()
    require(parameters["CATERING_BACKUP_PRODUCTION_HOST_SHA256"] == host_hash, "ADMISSION_TARGET_MISMATCH")
    environment = {"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C", "TZ": "UTC", **parameters,
                   "CATERING_BACKUP_ROOT": str(directory),
                   "CATERING_OFFHOST_ATTESTATION_FILE": str(directory / "offhost"),
                   "CATERING_SECRET_RECOVERY_ATTESTATION_FILE": str(directory / "recovery"),
                   "CATERING_OFFHOST_ATTESTATION_SHA256": bindings["offhost"],
                   "CATERING_SECRET_RECOVERY_ATTESTATION_SHA256": bindings["recovery"]}
    # Reuse the unchanged production validator, with live NUE addresses and DNS; no test-mode or UID override.
    script = 'source "$1"; validate_operator_attestations "$CATERING_BACKUP_EXPECTED_REPOSITORY_ID" "$2" "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" "" "$2" "" "" 21600'
    result = subprocess.run(["/bin/bash", "-c", script, "catering-nue-admission", str(directory / "common.sh"), host_hash],
                            env=environment, capture_output=True, timeout=45)
    require(result.returncode == 0, "CURRENT_OFFHOST_OR_RECOVERY_ADMISSION_FAILED")
    for name, value in bindings.items():
        protected_bytes(directory / name, value)
    return hashlib.sha256(json.dumps(bindings, sort_keys=True).encode()).hexdigest()


def capture(expected, run_id):
    assert_host()
    checked_run_id(run_id)
    admit_memory()
    admission_hash = validate_admission(expected, run_id)
    rows = assert_current(expected)
    root, durable = paths(run_id, "capture")
    require(not os.path.lexists(durable), "DURABLE_PROOF_ALREADY_EXISTS")
    own_lock(run_id)
    changed = False
    workspace_ready = False
    pending_stops = set()
    previous_signals = {kind: signal.signal(kind, interrupted) for kind in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)}
    try:
        durable.mkdir(mode=0o700)
        minimal = [{key: row[key] for key in ("Id", "Name", "Image", "State", "HostConfig")} for row in rows]
        for row in minimal:
            row["State"] = {"Running": row["State"]["Running"]}
            row["HostConfig"] = {"RestartPolicy": row["HostConfig"]["RestartPolicy"]}
        put(durable / "original-state.json", minimal)
        root, durable = workspace(run_id, "capture")
        workspace_ready = True
        images = sorted({row["Image"] for row in rows})
        image_size = sum(row["Size"] for row in json.loads(command(["docker", "image", "inspect", *images])))
        require(image_size < LIMIT * 3 // 4, "IMAGE_CAPTURE_EXCEEDS_BUDGET")
        command(["docker", "image", "save", "--output", str(root / "images.tar"), *images], timeout=300)
        require(validate_admission(expected, run_id) == admission_hash, "ADMISSION_CHANGED_BEFORE_WRITER_STOP")
        assert_current(expected)
        for row in rows:
            lock_owned(run_id)
            changed = True
            command(["docker", "update", "--restart=no", row["Id"]])
        by_name = {row["Name"].lstrip("/"): row for row in rows}
        for name in ("catering-edge-edge-1", "platform-infra-web-1", "platform-infra-intake-1", "platform-infra-offer-1", "platform-infra-production-1", "platform-infra-exports-1"):
            lock_owned(run_id)
            stop_owned(by_name[name]["Id"], pending_stops)
            require(not inspect([by_name[name]["Id"]])[0]["State"]["Running"], "WRITER_STILL_RUNNING")
        pg = by_name["platform-infra-postgres-1"]
        prefix = ["docker", "exec", "-u", "postgres", pg["Id"]]
        clients = command(prefix + ["psql", "-X", "-U", "catering", "-d", "postgres", "-Atc", "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid();"]).decode().strip()
        require(clients == "0", "UNKNOWN_DATABASE_CLIENT")
        require(command(prefix + ["psql", "-X", "-U", "catering", "-d", "postgres", "-Atc", "SELECT count(*) FROM pg_prepared_xacts;"]).decode().strip() == "0", "PREPARED_TRANSACTION")
        logical = {}
        for db in DATABASES:
            for suffix, fmt in (("dump", "custom"), ("sql", "plain")):
                with (root / (db + "." + suffix)).open("xb") as target:
                    command(prefix + ["pg_dump", "-U", "catering", "-d", db, "--format=" + fmt, "--quote-all-identifiers"], timeout=180, output=target)
            logical[db] = plain_digest(root / (db + ".sql"))
        with (root / "globals.sql").open("xb") as target:
            command(prefix + ["pg_dumpall", "-U", "catering", "--globals-only", "--quote-all-identifiers"], output=target)
        logical["globals"] = plain_digest(root / "globals.sql")
        stop_owned(pg["Id"], pending_stops)
        stopped = inspect([pg["Id"]])[0]["State"]
        require(not stopped["Running"] and not stopped.get("OOMKilled") and stopped["ExitCode"] == 0, "POSTGRES_NOT_CLEANLY_STOPPED")
        volumes = {}
        for row in rows:
            for mount in row["Mounts"]:
                if mount["Type"] == "volume":
                    volumes[mount["Name"]] = mount["Source"]
        require(set(volumes) == set(VOLUMES), "VOLUME_SCOPE_CHANGED")
        pg_root = Path(volumes["platform-infra_postgres_data"])
        require(not (pg_root / "postmaster.pid").exists(), "POSTMASTER_PID_REMAINS")
        control_name = "catering-nue-control-" + run_id
        require(find_owned_probe(control_name, run_id) is None, "CONTROL_HELPER_EXISTS")
        control_attempted = False
        try:
            control_attempted = True
            control_id = command(["docker", "create", "--pull=never", "--name", control_name, "--label", "catering.nue.probe=" + run_id, "--network=none", "--restart=no", "--read-only", "--memory=67108864", "--memory-swap=67108864", "--cpus=1", "--pids-limit=32", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--user=postgres", "--mount", "type=bind,src=" + str(pg_root) + ",dst=/cold,readonly", "--entrypoint=pg_controldata", pg["Image"], "/cold"]).decode().strip()
            require(find_owned_probe(control_name, run_id) == control_id, "CONTROL_HELPER_IDENTITY")
            control = command(["docker", "start", "--attach", control_id], timeout=30).decode()
        finally:
            if control_attempted:
                cleanup_probe(control_name, run_id)
        require(any("Database cluster state:" in line and line.split(":", 1)[1].strip() == "shut down" for line in control.splitlines()), "POSTGRES_CONTROL_NOT_SHUT_DOWN")
        indices = {}
        for name, source in sorted(volumes.items()):
            indices[name] = file_index(source)
            archive(root / (name + ".tar"), source)
            require(file_index(source) == indices[name], "VOLUME_CHANGED_DURING_CAPTURE")
        for i, source in enumerate(CONFIG_ROOTS):
            indices["config-" + str(i)] = file_index(source)
            archive(root / ("config-" + str(i) + ".tar"), source)
            require(file_index(source) == indices["config-" + str(i)], "CONFIG_CHANGED_DURING_CAPTURE")
        require(not command(["docker", "ps", "-q"]).strip(), "UNEXPECTED_RUNNING_CONTAINER")
        require(validate_admission(expected, run_id) == admission_hash, "ADMISSION_CHANGED_DURING_CAPTURE")
        files = {path.name: {"bytes": path.stat().st_size, "sha256": digest(path)} for path in root.iterdir() if path.is_file() and path.name != "owner.json"}
        manifest = dict(version=1, admissionSha256=admission_hash, runId=run_id, hostname="catering-prod-02", at=datetime.datetime.now(datetime.timezone.utc).isoformat(), pgImage=pg["Image"], images=images, databases=DATABASES, logical=logical, indices=indices, files=files)
        manifest_hash = put(root / "manifest.json", manifest)
        os.chmod(root / "manifest.json", 0o400)
        put(durable / "capture.json", {"status": "CAPTURED_NOT_YET_RESTORED", "runId": run_id, "manifestSha256": manifest_hash, "files": len(files), "bytes": sum(v["bytes"] for v in files.values())})
    finally:
        global RECOVERING
        RECOVERING = True
        try:
            if changed:
                lock_owned(run_id)
                settle_stops(pending_stops)
                resume(rows)
                put(durable / "resume.json", {"status": "ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED", "runId": run_id})
            elif workspace_ready:
                put(durable / "resume.json", {"status": "NO_SOURCE_MUTATION_BY_THIS_RUN", "runId": run_id})
                cleanup_workspace(run_id, "capture")
            else:
                require(not os.path.lexists(root), "WORKSPACE_SETUP_CLEANUP_HOLD_KEEP_LOCK")
            release_lock(run_id)
        finally:
            RECOVERING = False
            for kind, previous in previous_signals.items():
                signal.signal(kind, previous)
    return {"runId": run_id, "manifestSha256": manifest_hash, "files": ["manifest.json", *sorted(files)], "bytes": sum(v["bytes"] for v in files.values()), "sourceResumed": True}


def extract_checked(archive_path, target):
    with tarfile.open(archive_path) as source:
        for member in source:
            name = Path(member.name)
            require(not name.is_absolute() and ".." not in name.parts and (member.isfile() or member.isdir()), "ARCHIVE_MEMBER_REJECTED")
    target.mkdir(mode=0o700)
    command(["tar", "--extract", "--file", str(archive_path), "--acls", "--xattrs", "--numeric-owner", "--same-owner", "--same-permissions", "--directory", str(target)], timeout=300)


def verify_restored(root, manifest, run_id):
    assert_host()
    require(root == paths(run_id, "restore")[0] and root.resolve(strict=True) == root and os.path.ismount(root), "RESTORE_WORKSPACE_BINDING")
    require(json.loads((root / "owner.json").read_text()) == {"runId": run_id, "phase": "restore"}, "RESTORE_WORKSPACE_NOT_OWNED")
    validate_manifest(manifest, run_id)
    for name, expected in manifest["files"].items():
        path = root / name
        require(path.is_file() and path.stat().st_size == expected["bytes"] and digest(path) == expected["sha256"], "RESTORED_FILE_MISMATCH")
    for name, expected in manifest["indices"].items():
        target = root / ("restored-" + name)
        extract_checked(root / (name + ".tar"), target)
        require(file_index(target) == expected, "RESTORED_BYTES_OR_METADATA_MISMATCH")
    pg_data = root / "restored-platform-infra_postgres_data"
    name = "catering-nue-restore-" + checked_run_id(run_id)
    require(find_owned_probe(name, run_id) is None, "PROBE_CONTAINER_ALREADY_EXISTS")
    uid = pg_data.stat().st_uid
    gid = pg_data.stat().st_gid
    own_id = None
    create_attempted = False
    try:
        create_attempted = True
        own_id = command(["docker", "create", "--pull=never", "--name", name, "--label", "catering.nue.probe=" + run_id, "--network=none", "--restart=no", "--read-only", "--memory=536870912", "--memory-swap=536870912", "--cpus=1", "--pids-limit=128", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--user=" + str(uid) + ":" + str(gid), "--tmpfs", "/tmp:rw,noexec,nosuid,size=16777216,mode=1777", "--mount", "type=bind,src=" + str(pg_data) + ",dst=/var/lib/postgresql/data", "--entrypoint=postgres", manifest["pgImage"], "-D", "/var/lib/postgresql/data", "-c", "listen_addresses=", "-c", "unix_socket_directories=/tmp"]).decode().strip()
        row = inspect([own_id])[0]
        require(row["Image"] == manifest["pgImage"] and row["HostConfig"]["NetworkMode"] == "none" and not row["HostConfig"]["PortBindings"] and row["HostConfig"]["RestartPolicy"]["Name"] == "no", "PROBE_ISOLATION")
        binds = [mount for mount in row["Mounts"] if mount["Type"] == "bind"]
        require(len(binds) == 1 and binds[0]["Source"] == str(pg_data) and binds[0]["Destination"] == "/var/lib/postgresql/data" and binds[0]["RW"], "PROBE_MOUNT_SCOPE")
        require(all(mount in binds or (mount["Type"] == "tmpfs" and mount["Destination"] == "/tmp" and not mount.get("Source")) for mount in row["Mounts"]), "PROBE_EXTRA_MOUNT")
        require(set(row["HostConfig"].get("Tmpfs", {})) == {"/tmp"}, "PROBE_TMPFS_SCOPE")
        command(["docker", "start", own_id])
        deadline = time.monotonic() + 60
        while subprocess.run(["docker", "exec", own_id, "pg_isready", "-h", "/tmp", "-U", "catering", "-d", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10).returncode:
            require(time.monotonic() < deadline, "PROBE_POSTGRES_TIMEOUT")
            time.sleep(1)
        logical = {}
        for db in DATABASES:
            path = root / ("restored-" + db + ".sql")
            with path.open("xb") as target:
                command(["docker", "exec", own_id, "pg_dump", "-h", "/tmp", "-U", "catering", "-d", db, "--format=plain", "--quote-all-identifiers"], timeout=180, output=target)
            logical[db] = plain_digest(path)
        path = root / "restored-globals.sql"
        with path.open("xb") as target:
            command(["docker", "exec", own_id, "pg_dumpall", "-h", "/tmp", "-U", "catering", "--globals-only", "--quote-all-identifiers"], output=target)
        logical["globals"] = plain_digest(path)
        require(logical == manifest["logical"], "FULL_THREE_DATABASES_OR_GLOBALS_MISMATCH")
    finally:
        if create_attempted:
            cleanup_probe(name, run_id)
    return {"status": "ALL_THREE_DATABASES_GLOBALS_AND_REQUIRED_FILES_IDENTICAL", "runId": run_id, "databases": 3, "fileTrees": len(manifest["indices"]), "probeContainerRemoved": True}


def cleanup_workspace(run_id, phase):
    assert_host()
    root, durable = paths(run_id, phase)
    require(root.is_dir() and not root.is_symlink() and os.path.ismount(root), "CLEANUP_WORKSPACE_INVALID")
    require(json.loads((root / "owner.json").read_text()) == {"runId": run_id, "phase": phase}, "CLEANUP_NOT_OWNED")
    require(find_owned_probe("catering-nue-restore-" + run_id, run_id) is None and find_owned_probe("catering-nue-control-" + run_id, run_id) is None, "CLEANUP_PROBE_REMAINS")
    if phase == "capture":
        require(json.loads((durable / "resume.json").read_text())["status"] in ("ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED", "NO_SOURCE_MUTATION_BY_THIS_RUN"), "CLEANUP_SOURCE_NOT_RESUMED")
    command(["umount", str(root)])
    require(not os.path.ismount(root), "CLEANUP_MOUNT_REMAINS")
    root.rmdir()
    result = {"status": "OWN_TMPFS_UNMOUNTED", "runId": run_id, "phase": phase}
    put(durable / (phase + "-cleanup.json"), result)
    return result

def validate_manifest(manifest, run_id):
    require(manifest["runId"] == run_id and manifest["hostname"] == "catering-prod-02" and tuple(manifest["databases"]) == DATABASES, "MANIFEST_BINDING")
    expected_files = {db + suffix for db in DATABASES for suffix in (".dump", ".sql")} | {"globals.sql", "images.tar"} | {name + ".tar" for name in VOLUMES} | {"config-" + str(i) + ".tar" for i in range(len(CONFIG_ROOTS))}
    require(set(manifest["files"]) == expected_files and set(manifest["indices"]) == set(VOLUMES) | {"config-" + str(i) for i in range(len(CONFIG_ROOTS))}, "MANIFEST_SCOPE")
    require(manifest["pgImage"] in manifest["images"] and all(isinstance(v, str) and v.startswith("sha256:") and len(v) == 71 and all(c in "0123456789abcdef" for c in v[7:]) for v in manifest["images"]), "MANIFEST_IMAGE_BINDING")
    require(all(isinstance(v["bytes"], int) and v["bytes"] > 0 and isinstance(v["sha256"], str) and len(v["sha256"]) == 64 and all(c in "0123456789abcdef" for c in v["sha256"]) for v in manifest["files"].values()), "MANIFEST_FILE_FIELDS")
    require(sum(v["bytes"] for v in manifest["files"].values()) <= LIMIT, "MANIFEST_FILE_BUDGET")


def bounded_pipe_chunks(child, limit, timeout):
    deadline = time.monotonic() + timeout
    count = 0
    with selectors.DefaultSelector() as selector:
        selector.register(child.stdout, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            require(remaining > 0, "STREAM_DEADLINE")
            if not selector.select(min(remaining, 1)):
                continue
            block = os.read(child.stdout.fileno(), 131072)
            if not block:
                break
            count += len(block)
            require(count <= limit, "STREAM_BYTE_BUDGET")
            yield block


def stream_capture(run_id, manifest_sha256, hash_only=False):
    assert_host()
    root, durable = paths(run_id, "capture")
    require(os.path.ismount(root) and not root.is_symlink() and root.resolve(strict=True) == root, "CAPTURE_WORKSPACE_INVALID")
    require(json.loads((root / "owner.json").read_text()) == {"runId": run_id, "phase": "capture"}, "CAPTURE_WORKSPACE_NOT_OWNED")
    require(json.loads((durable / "resume.json").read_text())["status"] == "ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED", "SOURCE_NOT_RESUMED")
    require(digest(root / "manifest.json") == manifest_sha256, "CAPTURE_MANIFEST_CHANGED")
    manifest = json.loads((root / "manifest.json").read_text())
    validate_manifest(manifest, run_id)
    for name, expected in manifest["files"].items():
        path = root / name
        require(path.is_file() and not path.is_symlink() and path.stat().st_size == expected["bytes"] and digest(path) == expected["sha256"], "CAPTURE_FILE_CHANGED")
    args = ["tar", "--create", "--sort=name", "--format=ustar", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner",
            "--directory", str(root), "manifest.json", *sorted(manifest["files"])]
    if not hash_only:
        command(args, timeout=600, output=sys.stdout.buffer)
        return None
    child = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        value = hashlib.sha256()
        count = 0
        for block in bounded_pipe_chunks(child, LIMIT + 16777216, 600):
            count += len(block)
            require(count <= LIMIT + 16777216, "OUTER_STREAM_EXCEEDS_BUDGET")
            value.update(block)
        require(child.wait(timeout=10) == 0, "CAPTURE_TAR_FAILED")
        return {"sha256": value.hexdigest(), "bytes": count}
    finally:
        if child.poll() is None:
            child.terminate()
            child.wait(timeout=10)
        child.stdout.close()


def receive_outer(source, target, run_id, expected_outer_sha256, expected_manifest_sha256):
    whole = hashlib.sha256()
    count = 0

    def read_exact(size):
        nonlocal count
        require(0 <= size <= 8388608, "OUTER_READ_SIZE_INVALID")
        parts = []
        remaining = size
        while remaining:
            block = source.read(min(131072, remaining))
            require(bool(block), "OUTER_STREAM_TRUNCATED")
            remaining -= len(block)
            count += len(block)
            require(count <= LIMIT + 16777216, "OUTER_STREAM_EXCEEDS_BUDGET")
            whole.update(block)
            parts.append(block)
        return b"".join(parts)

    seen = set()
    manifest = None
    while True:
        header = read_exact(512)
        if not any(header):
            require(not any(read_exact(512)), "OUTER_END_INVALID")
            while True:
                block = source.read(131072)
                if not block:
                    break
                require(not any(block), "OUTER_TRAILING_DATA")
                count += len(block)
                require(count <= LIMIT + 16777216, "OUTER_STREAM_EXCEEDS_BUDGET")
                whole.update(block)
            break
        require(header[257:263] == b"ustar\x00", "OUTER_USTAR_REQUIRED")
        member = tarfile.TarInfo.frombuf(header, "utf-8", "strict")
        require(member.isfile() and member.name not in seen and "/" not in member.name, "OUTER_MEMBER_INVALID")
        if manifest is None:
            require(member.name == "manifest.json" and 0 < member.size <= 8388608, "OUTER_MANIFEST_REQUIRED")
            body = read_exact(member.size)
            require(hashlib.sha256(body).hexdigest() == expected_manifest_sha256, "RESTORED_MANIFEST_HASH_MISMATCH")
            manifest = json.loads(body)
            validate_manifest(manifest, run_id)
            with (target / member.name).open("xb") as output:
                output.write(body)
        else:
            require(member.name in manifest["files"] and member.size == manifest["files"][member.name]["bytes"], "OUTER_FILE_BINDING")
            value = hashlib.sha256()
            with (target / member.name).open("xb") as output:
                remaining = member.size
                while remaining:
                    block = read_exact(min(131072, remaining))
                    remaining -= len(block)
                    value.update(block)
                    output.write(block)
            require(value.hexdigest() == manifest["files"][member.name]["sha256"], "RESTORED_COMPONENT_HASH_MISMATCH")
        seen.add(member.name)
        padding = (-member.size) % 512
        require(not any(read_exact(padding)), "OUTER_PADDING_INVALID")
    require(manifest is not None and seen == {"manifest.json", *manifest["files"]}, "OUTER_SCOPE_INCOMPLETE")
    require(whole.hexdigest() == expected_outer_sha256, "RESTORED_WHOLE_STREAM_HASH_MISMATCH")
    return manifest


def restore_from_offhost(run_id, expected_outer_sha256, expected_manifest_sha256, source=None):
    assert_host()
    checked_run_id(run_id)
    available = int(next(line.split()[1] for line in Path("/proc/meminfo").read_text().splitlines() if line.startswith("MemAvailable:"))) * 1024
    require(available >= LIMIT + 536870912 + RESERVE, "RESTORE_MEMORY_HEADROOM_INSUFFICIENT")
    root, durable = workspace(run_id, "restore")
    previous_signals = {kind: signal.signal(kind, interrupted) for kind in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)}
    try:
        manifest = receive_outer(sys.stdin.buffer if source is None else source, root, run_id, expected_outer_sha256, expected_manifest_sha256)
        result = verify_restored(root, manifest, run_id)
        result.update(outerSha256=expected_outer_sha256, manifestSha256=expected_manifest_sha256)
        put(durable / "restore.json", result)
        return result
    finally:
        global RECOVERING
        RECOVERING = True
        try:
            cleanup_probe("catering-nue-restore-" + run_id, run_id)
            cleanup_workspace(run_id, "restore")
        finally:
            RECOVERING = False
            for kind, previous in previous_signals.items():
                signal.signal(kind, previous)


def cleanup_after_failure(run_id):
    assert_host()
    root, durable = paths(run_id, "capture")
    require(not os.path.lexists(LOCK), "CAPTURE_OR_RECOVERY_STILL_LOCKED")
    if not os.path.lexists(root):
        return {"status": "NO_CAPTURE_WORKSPACE", "runId": run_id}
    return cleanup_workspace(run_id, "capture")


def verify_original_health(expected):
    assert_host()
    rows = assert_current(expected)
    for service, port in (("intake", 3101), ("offer", 3102), ("production", 3103), ("exports", 3104)):
        row = next(row for row in rows if row["Name"] == "/platform-infra-" + service + "-1")
        command(["docker", "exec", row["Id"], "node", "-e", "fetch('http://127.0.0.1:" + str(port) + "/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], timeout=15)
    web = check_web_readiness()
    return {"status": "ORIGINAL_SEVEN_CONTAINERS_POLICIES_DATABASE_SCOPE_AND_HTTPS_HEALTHY",
            "web": web, "tlsProbe": "VALID_CERTIFICATE_AND_ORIGINAL_LOOPBACK_ACL_DENIAL",
            "authenticatedSmoke": False}


def verify_final(expected):
    require(not os.path.lexists(LOCK), "UPDATE_LOCK_REMAINS_AFTER_PROOF")
    return verify_original_health(expected)


def complete_captured_resume(expected, run_id, manifest_sha256):
    assert_host()
    lock_owned(run_id)
    root, durable = paths(run_id, "capture")
    require(os.path.ismount(root) and root.resolve(strict=True) == root, "CAPTURE_WORKSPACE_INVALID")
    require(json.loads(protected_bytes(root / "owner.json")) == {"runId": run_id, "phase": "capture"}, "CAPTURE_WORKSPACE_NOT_OWNED")
    proof = json.loads(protected_bytes(durable / "capture.json"))
    require(proof["runId"] == run_id and proof["manifestSha256"] == manifest_sha256
            and proof["status"] == "CAPTURED_NOT_YET_RESTORED", "CAPTURE_PROOF_MISMATCH")
    verify_bound_regular_file(root / "manifest.json", manifest_sha256)
    require((root / "manifest.json").stat().st_size <= 8388608, "MANIFEST_SIZE")
    manifest = json.loads((root / "manifest.json").read_text())
    validate_manifest(manifest, run_id)
    for name, value in manifest["files"].items():
        path = root / name
        verify_bound_regular_file(path, value["sha256"], value["bytes"])
    for proc in Path("/proc").iterdir():
        if not proc.name.isdigit() or int(proc.name) == os.getpid():
            continue
        try:
            argv = (proc / "cmdline").read_bytes()
        except (FileNotFoundError, PermissionError):
            continue
        require(not (argv.startswith(b"/usr/bin/python3\0") and
                     b"capture(json.loads(sys.argv[1]),json.loads(sys.argv[2]))" in argv),
                "CAPTURE_PROCESS_STILL_PRESENT")
        require(not argv.startswith(b"docker\0stop\0"), "DOCKER_STOP_STILL_PRESENT")
    original = json.loads(protected_bytes(durable / "original-state.json"))
    rows = inspect(list(NAMES))
    actual = []
    for row in rows:
        actual.append({key: row[key] for key in ("Id", "Name", "Image", "State", "HostConfig")})
        actual[-1]["State"] = {"Running": row["State"]["Running"]}
        actual[-1]["HostConfig"] = {"RestartPolicy": row["HostConfig"]["RestartPolicy"]}
    require(sorted(actual, key=lambda r:r["Name"]) == sorted(original, key=lambda r:r["Name"]), "ORIGINAL_STATE_NOT_RESTORED")
    health = verify_original_health(expected)
    lock_owned(run_id)
    put(durable / "resume.json", {"status":"ORIGINAL_SERVICES_AND_RESTART_POLICIES_RESTORED", "runId":run_id})
    release_lock(run_id)
    return {"runId":run_id, "sourceResumed":True, "manifestSha256":manifest_sha256,
            "files":["manifest.json", *sorted(manifest["files"])], "bytes":proof["bytes"], "health":health}


if __name__ == "__main__":
    require(len(sys.argv) == 4 and sys.argv[1] == "stream", "STREAM_ONLY_ENTRYPOINT")
    stream_capture(checked_run_id(sys.argv[2]), sys.argv[3])
