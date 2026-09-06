#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly MAX_RECORD_BYTES="${CATERING_BACKUP_MAX_RECORD_BYTES:-65536}"
readonly BACKUP_ROOT="${CATERING_BACKUP_ROOT:-/var/lib/catering-backup}"
# These paths are exported as shared entry-point constants; each caller uses a
# different subset, so ShellCheck must not treat them as dead local variables.
# shellcheck disable=SC2034
readonly EVIDENCE_PATH="$BACKUP_ROOT/catering-backup-evidence"
# shellcheck disable=SC2034
readonly REPOSITORY_STATUS_PATH="$BACKUP_ROOT/catering-backup-repository-status"
# shellcheck disable=SC2034
readonly CANDIDATE_POINTER="$BACKUP_ROOT/catering-backup-candidate"
# These are non-secret, repository-defined names for the independent recovery
# source. Their digests are derived from canonical strings below rather than
# accepting arbitrary operator-provided hexadecimal values.
# The source class and locator are operator inputs, but only the concrete
# external classes checked below are accepted. A repository-local label is
# deliberately not an independence claim.
readonly SECRET_RECOVERY_SCHEMA="operator-secret-schema-v2|restic_encryption_password,offhost_repository_access,POSTGRES_PASSWORD,CATERING_TRUSTED_ACTOR_SECRET,CATERING_BASIC_AUTH_PASSWORD_HASH"
fail_state() {
  printf '%s\n' "${1:-STATE_INVALID}" >&2
  return 1
}

safe_record_path() {
  local path="${1-}" root cursor parent relative component
  # Keep the configured root as a lexical trust boundary.  Resolving it with
  # realpath first would turn a root or parent symlink into an accepted alias.
  root="$(python3 - "$BACKUP_ROOT" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
)"
  path="$(python3 - "$path" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
)"
  [[ -d "$root" && ! -L "$root" && "$path" == "$root"/* && "$path" != *$'\n'* && "$path" != *$'\r'* ]] || return 1
  parent="$(dirname "$path")"
  relative="$(python3 - "$root" "$parent" <<'PY'
import os, sys
try:
    value = os.path.relpath(sys.argv[2], sys.argv[1])
except ValueError:
    raise SystemExit(1)
if value == ".." or value.startswith("../"):
    raise SystemExit(1)
print(value)
PY
)" || return 1
  cursor="$root"
  if [[ "$relative" != "." ]]; then
    IFS=/ read -ra components <<< "$relative"
    for component in "${components[@]}"; do
      [[ -n "$component" ]] || continue
      cursor="$cursor/$component"
      [[ ! -L "$cursor" && -d "$cursor" ]] || return 1
    done
  fi
  [[ ! -L "$path" ]] || return 1
  if [[ -e "$path" ]]; then
    [[ -f "$path" ]] || return 1
  fi
}

assert_root_mode_600() {
  local path="${1-}" expected_uid="${2:-0}" info mode owner kind
  [[ -n "$path" && ! -L "$path" ]] || { fail_state STATE_PATH_INVALID; return 1; }
  [[ "$expected_uid" =~ ^[0-9]+$ ]] || { fail_state STATE_MODE_INVALID; return 1; }
  if info="$(stat -c '%F:%a:%u' "$path" 2>/dev/null)"; then
    IFS=: read -r kind mode owner <<< "$info"
    [[ "$kind" == "regular file" && "$mode" == 600 && "$owner" == "$expected_uid" ]] || { fail_state STATE_MODE_INVALID; return 1; }
  else
    info="$(stat -f '%HT:%Lp:%u' "$path" 2>/dev/null)" || { fail_state STATE_MISSING; return 1; }
    IFS=: read -r kind mode owner <<< "$info"
    [[ "$kind" == "Regular File" && "$mode" == 600 && "$owner" == "$expected_uid" ]] || { fail_state STATE_MODE_INVALID; return 1; }
  fi
}

# Read a regular root-owned 0600 file exactly once through an O_NOFOLLOW
# descriptor.  The optional digest is checked over those same bytes, so later
# parsing cannot accidentally authenticate a different path generation.
read_bound_text() {
  local path="${1-}" limit="${2:-$MAX_RECORD_BYTES}" expected_uid="${3:-${CATERING_BACKUP_EXPECTED_UID:-0}}" expected_digest="${4-}" single_line="${5:-0}"
  [[ -n "$path" && "$path" == /* ]] || { fail_state STATE_PATH_INVALID; return 1; }
  [[ "$expected_uid" =~ ^[0-9]+$ ]] || { fail_state STATE_MODE_INVALID; return 1; }
  [[ "$limit" =~ ^[0-9]+$ ]] || { fail_state STATE_LIMIT_INVALID; return 1; }
  [[ -z "$expected_digest" || "$expected_digest" =~ ^[0-9a-f]{64}$ ]] || { fail_state CHECKSUM_INVALID; return 1; }
  python3 - "$path" "$limit" "$expected_uid" "$expected_digest" "$single_line" <<'PY'
import hashlib, os, stat, sys
path, limit, expected_uid, expected_digest, single_line = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] == "1"
try:
    before = os.lstat(path)
    if not stat.S_ISREG(before.st_mode): raise ValueError("STATE_PATH_INVALID")
    if before.st_uid != expected_uid or stat.S_IMODE(before.st_mode) != 0o600: raise ValueError("STATE_MODE_INVALID")
    if before.st_size > limit: raise ValueError("STATE_TOO_LARGE")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
except FileNotFoundError:
    print("STATE_MISSING", file=sys.stderr); raise SystemExit(1)
except (OSError, ValueError) as error:
    code = str(error) if str(error).startswith("STATE_") else "STATE_PATH_INVALID"
    print(code, file=sys.stderr); raise SystemExit(1)
try:
    info = os.fstat(fd)
    if (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino): raise ValueError("STATE_PATH_CHANGED")
    if not stat.S_ISREG(info.st_mode) or info.st_uid != expected_uid or stat.S_IMODE(info.st_mode) != 0o600: raise ValueError("STATE_MODE_INVALID")
    if info.st_size > limit: raise ValueError("STATE_TOO_LARGE")
    data = bytearray()
    while len(data) <= limit:
        try: chunk = os.read(fd, min(8192, limit + 1 - len(data)))
        except InterruptedError: continue
        if not chunk: break
        data.extend(chunk)
finally:
    os.close(fd)
if len(data) > limit: print("STATE_TOO_LARGE", file=sys.stderr); raise SystemExit(1)
if expected_digest and hashlib.sha256(data).hexdigest() != expected_digest: print("CHECKSUM_MISMATCH", file=sys.stderr); raise SystemExit(1)
if b"\x00" in data or b"\r" in data or (single_line and b"\n" in data[:-1]): print("STATE_ENCODING_INVALID", file=sys.stderr); raise SystemExit(1)
try: text = bytes(data).decode("utf-8")
except UnicodeDecodeError: print("STATE_ENCODING_INVALID", file=sys.stderr); raise SystemExit(1)
if not text.endswith("\n"): print("STATE_FORMAT_INVALID", file=sys.stderr); raise SystemExit(1)
text = text[:-1]
if not text or (single_line and "\n" in text) or any((ord(ch) < 0x20 and ch != "\n") or ch in " \t" for ch in text): print("STATE_FORMAT_INVALID", file=sys.stderr); raise SystemExit(1)
print(text, end="")
PY
}

# Repository and password files are trust-boundary inputs.  Read the locator
# through one no-follow descriptor, then validate its inode, owner, mode and
# bounded UTF-8 contents before a caller ever hands it to Restic.
read_secure_single_line() {
  read_bound_text "${1-}" "${2:-$MAX_RECORD_BYTES}" "${3:-${CATERING_BACKUP_EXPECTED_UID:-0}}" "" 1
}

# Record only non-secret file identity (device, inode, size and digest).  The
# entrypoints capture this generation before their first Restic call; every
# later invocation compares the descriptor it opens with that same token.
secure_file_generation() {
  local path="${1-}" expected_uid="${2:-${CATERING_BACKUP_EXPECTED_UID:-0}}" limit="${3:-$MAX_RECORD_BYTES}"
  [[ "$path" == /* && "$expected_uid" =~ ^[0-9]+$ && "$limit" =~ ^[0-9]+$ ]] || { fail_state REPOSITORY_READ_FAILED; return 1; }
  python3 - "$path" "$expected_uid" "$limit" <<'PY'
import hashlib, os, stat, sys
path, expected_uid, limit = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
try:
    before = os.lstat(path)
    if not stat.S_ISREG(before.st_mode): raise ValueError("STATE_PATH_INVALID")
    if before.st_uid != expected_uid or stat.S_IMODE(before.st_mode) != 0o600: raise ValueError("STATE_MODE_INVALID")
    if before.st_size > limit: raise ValueError("STATE_TOO_LARGE")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
except FileNotFoundError:
    print("STATE_MISSING", file=sys.stderr); raise SystemExit(1)
except (OSError, ValueError) as error:
    print(str(error) if str(error).startswith("STATE_") else "STATE_PATH_INVALID", file=sys.stderr); raise SystemExit(1)
try:
    info = os.fstat(fd)
    if (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino): raise ValueError("STATE_PATH_CHANGED")
    data = bytearray()
    while len(data) <= limit:
        chunk = os.read(fd, min(8192, limit + 1 - len(data)))
        if not chunk: break
        data.extend(chunk)
finally:
    os.close(fd)
if len(data) > limit: raise SystemExit(1)
print("%s:%s:%s:%s" % (info.st_dev, info.st_ino, len(data), hashlib.sha256(data).hexdigest()))
PY
}

secure_restic_init_generation() {
  local repository_file="${1-}" password_file="${2-}" repository_generation password_generation
  repository_generation="$(secure_file_generation "$repository_file")" || return 1
  password_generation="$(secure_file_generation "$password_file")" || return 1
  export CATERING_RESTIC_REPOSITORY_GENERATION="$repository_generation"
  export CATERING_RESTIC_PASSWORD_GENERATION="$password_generation"
}

# Execute Restic with descriptors opened and validated in the same Python
# process that execs the child.  This avoids Bash path reopens and keeps the
# descriptors stable even when an attacker replaces the configured files.
secure_restic() {
  local command="${CATERING_RESTIC_COMMAND:-restic}" repository_file="${CATERING_BACKUP_REPOSITORY_FILE:-}" password_file="${CATERING_BACKUP_PASSWORD_FILE:-}" expected_uid="${CATERING_BACKUP_EXPECTED_UID:-0}" expected_locator_digest="${CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256:-}" repository_generation password_generation
  [[ -n "$repository_file" && -n "$password_file" && "$repository_file" == /* && "$password_file" == /* ]] || { fail_state REPOSITORY_READ_FAILED; return 1; }
  require_digest "$expected_locator_digest" || { fail_state REPOSITORY_BINDING_INVALID; return 1; }
  repository_generation="${CATERING_RESTIC_REPOSITORY_GENERATION:-}"
  password_generation="${CATERING_RESTIC_PASSWORD_GENERATION:-}"
  if [[ -z "$repository_generation" || -z "$password_generation" ]]; then
    secure_restic_init_generation "$repository_file" "$password_file" || { fail_state REPOSITORY_READ_FAILED; return 1; }
    repository_generation="$CATERING_RESTIC_REPOSITORY_GENERATION"
    password_generation="$CATERING_RESTIC_PASSWORD_GENERATION"
  fi
  python3 -c '
import fcntl, hashlib, os, shutil, stat, sys
command, repository_file, password_file = sys.argv[1:4]
expected_locator_digest = sys.argv[4]
expected_repository_generation, expected_password_generation = sys.argv[5:7]
expected_uid, limit = int(sys.argv[7]), int(sys.argv[8])
restic_args = sys.argv[9:]
def open_checked(path, locator=False):
    before = os.lstat(path)
    if not stat.S_ISREG(before.st_mode) or before.st_uid != expected_uid or stat.S_IMODE(before.st_mode) != 0o600 or before.st_size > limit:
        raise RuntimeError("STATE_MODE_INVALID" if stat.S_ISREG(before.st_mode) else "STATE_PATH_INVALID")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    info = os.fstat(fd)
    if (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino):
        os.close(fd); raise RuntimeError("STATE_PATH_CHANGED")
    if not stat.S_ISREG(info.st_mode) or info.st_uid != expected_uid or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > limit:
        os.close(fd); raise RuntimeError("STATE_MODE_INVALID")
    data = bytearray()
    while len(data) <= limit:
        try: chunk = os.read(fd, min(8192, limit + 1 - len(data)))
        except InterruptedError: continue
        if not chunk: break
        data.extend(chunk)
    if (len(data) > limit or b"\x00" in data or b"\r" in data or
        b"\n" in data[:-1] or not data.endswith(b"\n")):
        os.close(fd); raise RuntimeError("STATE_FORMAT_INVALID")
    try:
        text = bytes(data[:-1]).decode("utf-8")
    except UnicodeDecodeError:
        os.close(fd); raise RuntimeError("STATE_ENCODING_INVALID")
    if any((ord(char) < 0x20) or char in " \t" for char in text):
        os.close(fd); raise RuntimeError("STATE_FORMAT_INVALID")
    if locator and hashlib.sha256(data[:-1]).hexdigest() != expected_locator_digest:
        os.close(fd); raise RuntimeError("REPOSITORY_BINDING_MISMATCH")
    generation = "%s:%s:%s:%s" % (info.st_dev, info.st_ino, len(data), hashlib.sha256(data).hexdigest())
    expected_generation = expected_repository_generation if locator else expected_password_generation
    if generation != expected_generation:
        os.close(fd); raise RuntimeError("REPOSITORY_GENERATION_CHANGED")
    os.lseek(fd, 0, os.SEEK_SET)
    return fd
try:
    repo_fd, password_fd = open_checked(repository_file, True), open_checked(password_file)
    # Reserve descriptors above the two public slots before assigning 9/8:
    # open() may itself return 8 or 9, and a plain dup() could allocate the
    # other slot and then be overwritten by the first dup2().
    repo_bound = fcntl.fcntl(repo_fd, fcntl.F_DUPFD, 10)
    password_bound = fcntl.fcntl(password_fd, fcntl.F_DUPFD, 10)
    os.set_inheritable(repo_bound, True); os.set_inheritable(password_bound, True)
    os.dup2(repo_bound, 9, inheritable=True); os.dup2(password_bound, 8, inheritable=True)
    for descriptor in {repo_fd, password_fd, repo_bound, password_bound}:
        if descriptor not in (8, 9): os.close(descriptor)
    executable = shutil.which(command) or command
    env = dict(os.environ)
    for key in ("RESTIC_REPOSITORY", "RESTIC_PASSWORD", "RESTIC_PASSWORD_COMMAND",
                "CATERING_BACKUP_REPOSITORY_FILE", "CATERING_BACKUP_PASSWORD_FILE",
                "CATERING_BACKUP_REPOSITORY_VALUE"):
        env.pop(key, None)
    argv = [executable, "--repository-file", "/proc/self/fd/9", "--password-file", "/proc/self/fd/8"] + restic_args
    os.execvpe(executable, argv, env)
except Exception as error:
    code = str(error) if (str(error).startswith("STATE_") or str(error).startswith("REPOSITORY_")) else "REPOSITORY_READ_FAILED"
    print(code, file=sys.stderr)
    raise SystemExit(1)
' "$command" "$repository_file" "$password_file" "$expected_locator_digest" "$repository_generation" "$password_generation" "$expected_uid" "$MAX_RECORD_BYTES" "$@"
}

validate_offhost_repository() {
  local repository="${1-}" syntax_only="${2:-0}" authority host port path resolved expected_uid
  [[ "$syntax_only" == 0 || "$syntax_only" == 1 ]] || { fail_state REPOSITORY_INVALID; return 1; }
  [[ -n "$repository" && "$repository" != *$'\n'* && "$repository" != *$'\r'* && "$repository" != *$'\t'* && "$repository" != *' '* ]] || { fail_state REPOSITORY_INVALID; return 1; }
  [[ "$repository" != *"@"* && "$repository" != *"%"* && "$repository" != *"?"* && "$repository" != *"#"* ]] || { fail_state REPOSITORY_INVALID; return 1; }
  case "$repository" in
    s3:*)
      authority="${repository#s3:}"
      authority="${authority#https://}"
      ;;
    rest:https://*) authority="${repository#rest:https://}" ;;
    *) fail_state REPOSITORY_LOCAL; return 1 ;;
  esac
  [[ "$authority" != //* && "$authority" == */* ]] || { fail_state REPOSITORY_INVALID; return 1; }
  host="${authority%%/*}"
  path="${authority#*/}"
  [[ -n "$host" && -n "$path" && "$path" != /* && "$path" != *//* && "$path" =~ ^[A-Za-z0-9._/-]+$ ]] || { fail_state REPOSITORY_INVALID; return 1; }
  if [[ "$host" == *:* ]]; then
    port="${host##*:}"
    host="${host%:*}"
    [[ "$port" =~ ^[0-9]{1,5}$ && "$port" -ge 1 && "$port" -le 65535 ]] || { fail_state REPOSITORY_INVALID; return 1; }
  fi
  [[ "$host" =~ ^[A-Za-z0-9.-]+$ && "$host" != .* && "$host" != *..* && "$host" != *. && "$host" != -* && "$host" != *- ]] || { fail_state REPOSITORY_INVALID; return 1; }
  [[ "$host" != *[!A-Za-z0-9.-]* && "$host" != localhost && "$host" != *.localhost && "$host" != *.local && "$host" != *.internal && "$host" == *.* ]] || { fail_state REPOSITORY_LOCAL; return 1; }
  if [[ "$host" =~ ^[0-9.]+$ ]]; then fail_state REPOSITORY_LOCAL; return 1; fi
  host="$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"
  [[ "$host" != 0.0.0.0 && "$host" != 127.* && "$host" != 10.* && "$host" != 100.64.* && "$host" != 169.254.* && "$host" != 192.168.* && "$host" != 172.16.* && "$host" != 172.17.* && "$host" != 172.18.* && "$host" != 172.19.* && "$host" != 172.2[0-9].* && "$host" != 172.3[0-1].* ]] || { fail_state REPOSITORY_LOCAL; return 1; }
  # A public-looking DNS label is not enough: the immutable attestation
  # generation resolves it and rejects every loopback/private/link-local/
  # ULA/reserved address.  Skip that second lookup when the aggregate validator
  # has already captured the generation; direct callers retain the standalone
  # syntax-and-resolution check.
  [[ "$syntax_only" == 1 ]] && return 0
  expected_uid="${CATERING_BACKUP_EXPECTED_UID:-0}"
  if [[ "$expected_uid" != 0 && -n "${CATERING_BACKUP_RESOLVED_ADDRESSES:-}" ]]; then
    resolved="$CATERING_BACKUP_RESOLVED_ADDRESSES"
    RESOLVED_ADDRESSES="$resolved" python3 - <<'PY'
import ipaddress, os, sys
values = os.environ.get("RESOLVED_ADDRESSES", "").split(",")
if not values or any(not value for value in values): raise SystemExit(1)
for value in values:
    try: address = ipaddress.ip_address(value)
    except ValueError: raise SystemExit(1)
    if (not address.is_global or address.is_loopback or address.is_private or
        address.is_link_local or address.is_reserved or address.is_unspecified or
        address.is_multicast):
        raise SystemExit(1)
PY
  else
    python3 - "$host" <<'PY'
import ipaddress, socket, sys
host = sys.argv[1]
try:
    answers = {item[4][0] for item in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)}
except OSError:
    raise SystemExit(1)
if not answers: raise SystemExit(1)
for value in answers:
    try: address = ipaddress.ip_address(value)
    except ValueError: raise SystemExit(1)
    if (not address.is_global or address.is_loopback or address.is_private or
        address.is_link_local or address.is_reserved or address.is_unspecified or
        address.is_multicast):
        raise SystemExit(1)
PY
  fi
}

repository_endpoint_host() {
  local repository="${1-}" authority host
  case "$repository" in
    s3:*) authority="${repository#s3:}"; authority="${authority#https://}" ;;
    rest:https://*) authority="${repository#rest:https://}" ;;
    *) return 1 ;;
  esac
  host="${authority%%/*}"
  [[ "$host" == *:* ]] && host="${host%:*}"
  printf '%s' "$host" | tr '[:upper:]' '[:lower:]'
}

# Parse the explicitly operator-provided external production set.  `none` is
# meaningful only as the exact lower-case token; it means no NAT/floating
# address exists in addition to the live interface set.
canonical_external_addresses() {
  [[ -n "${CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES+x}" ]] || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
  PROD_EXTERNAL_ADDRESSES="${CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES-}" python3 - <<'PY'
import ipaddress, os, sys
raw = os.environ.get("PROD_EXTERNAL_ADDRESSES", "")
if raw == "none":
    print("none")
    raise SystemExit(0)
if not raw or raw != raw.strip() or raw.startswith(",") or raw.endswith(","):
    raise SystemExit(1)
values = raw.split(",")
if any(not value or any(ch.isspace() for ch in value) or value == "none" for value in values):
    raise SystemExit(1)
try:
    canonical = sorted({str(ipaddress.ip_address(value)) for value in values}, key=lambda value: (ipaddress.ip_address(value).version, ipaddress.ip_address(value).packed))
except ValueError:
    raise SystemExit(1)
print(",".join(canonical))
PY
}

_interface_addresses_once() {
  local expected_uid="${CATERING_BACKUP_EXPECTED_UID:-0}" interface_addresses
  [[ "$expected_uid" =~ ^[0-9]+$ ]] || { fail_state ATTESTATION_INVALID; return 1; }
  if [[ "$expected_uid" != 0 && "${CATERING_BACKUP_TEST_MODE:-0}" == 1 ]]; then
    interface_addresses="${CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES:-${CATERING_BACKUP_LOCAL_ADDRESSES:-}}"
    [[ -n "$interface_addresses" ]] || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
    printf '%s' "$interface_addresses"
    return 0
  fi
  python3 - <<'PY'
import subprocess
try:
    output = subprocess.check_output(
        ["ip", "-o", "addr", "show", "scope", "global"],
        text=True, stderr=subprocess.DEVNULL,
    )
except (OSError, subprocess.CalledProcessError):
    raise SystemExit(1)
values = []
for line in output.splitlines():
    fields = line.split()
    for index, field in enumerate(fields):
        if field in ("inet", "inet6") and index + 1 < len(fields):
            values.append(fields[index + 1].split("/", 1)[0])
if not values:
    raise SystemExit(1)
print(",".join(values), end="")
PY
}

# Produce the canonical union used by direct callers.  Attestation validation
# uses capture_address_generation below so interface, external and endpoint
# inputs are sampled only once per validation generation.
canonical_production_addresses() {
  local interface_addresses external_addresses
  interface_addresses="$(_interface_addresses_once)" || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
  external_addresses="$(canonical_external_addresses)" || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
  PROD_INTERFACE_ADDRESSES="$interface_addresses" PROD_EXTERNAL_ADDRESSES="$external_addresses" python3 - <<'PY'
import ipaddress, os, sys
interfaces = os.environ.get("PROD_INTERFACE_ADDRESSES", "")
external = os.environ.get("PROD_EXTERNAL_ADDRESSES", "")
values = interfaces.split(",") if interfaces else []
if external != "none": values += external.split(",") if external else []
if not values or any(not value or any(ch.isspace() for ch in value) for value in values):
    raise SystemExit(1)
try:
    canonical = sorted({str(ipaddress.ip_address(value)) for value in values}, key=lambda value: (ipaddress.ip_address(value).version, ipaddress.ip_address(value).packed))
except ValueError:
    raise SystemExit(1)
print(",".join(canonical))
PY
}

# Capture one immutable generation: interface addresses, external operator
# set, endpoint answers and all derived digests are emitted as one tab record.
# Downstream validators receive this record instead of resolving or rereading
# any of the inputs, preventing mixed-generation attestations.
capture_address_generation() {
  local repository="${1-}" interface_addresses external_addresses endpoint resolved expected_uid="${CATERING_BACKUP_EXPECTED_UID:-0}"
  # Reuse the closed-world locator grammar without triggering a second DNS
  # lookup; this generation owns the single endpoint resolution below.
  validate_offhost_repository "$repository" 1 || { fail_state REPOSITORY_INVALID; return 1; }
  interface_addresses="$(_interface_addresses_once)" || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
  external_addresses="$(canonical_external_addresses)" || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
  endpoint="$(repository_endpoint_host "$repository")" || { fail_state REPOSITORY_INVALID; return 1; }
  if [[ "$expected_uid" != 0 && "${CATERING_BACKUP_TEST_MODE:-0}" == 1 ]]; then
    resolved="${CATERING_BACKUP_RESOLVED_ADDRESSES:-}"
    [[ -n "$resolved" ]] || { fail_state OFFHOST_ATTESTATION_INVALID; return 1; }
  else
    resolved=""
  fi
  GEN_INTERFACE="$interface_addresses" GEN_EXTERNAL="$external_addresses" GEN_ENDPOINT="$endpoint" GEN_RESOLVED="$resolved" GEN_TEST_MODE="${CATERING_BACKUP_TEST_MODE:-0}" python3 - <<'PY'
import hashlib, ipaddress, os, socket, sys
def canonical(raw, allow_none=False):
    if allow_none and raw == "none": return "none", set()
    if not raw or raw != raw.strip() or raw.startswith(",") or raw.endswith(","):
        raise SystemExit(1)
    values = raw.split(",")
    if any(not value or any(ch.isspace() for ch in value) or value == "none" for value in values):
        raise SystemExit(1)
    try:
        result = sorted({str(ipaddress.ip_address(value)) for value in values}, key=lambda value: (ipaddress.ip_address(value).version, ipaddress.ip_address(value).packed))
    except ValueError:
        raise SystemExit(1)
    return ",".join(result), set(result)
interface, interface_set = canonical(os.environ.get("GEN_INTERFACE", ""))
external, external_set = canonical(os.environ.get("GEN_EXTERNAL", ""), True)
production_set = interface_set | external_set
if not production_set: raise SystemExit(1)
production = ",".join(sorted(production_set, key=lambda value: (ipaddress.ip_address(value).version, ipaddress.ip_address(value).packed)))
resolved_raw = os.environ.get("GEN_RESOLVED", "")
if os.environ.get("GEN_TEST_MODE") == "1":
    if not resolved_raw: raise SystemExit(1)
    resolved_values = resolved_raw.split(",")
else:
    try:
        resolved_values = sorted({item[4][0] for item in socket.getaddrinfo(os.environ.get("GEN_ENDPOINT", ""), None, type=socket.SOCK_STREAM)})
    except OSError:
        raise SystemExit(1)
if not resolved_values or any(not value or any(ch.isspace() for ch in value) for value in resolved_values):
    raise SystemExit(1)
try:
    endpoint_set = {str(ipaddress.ip_address(value)) for value in resolved_values}
except ValueError:
    raise SystemExit(1)
for value in endpoint_set:
    address = ipaddress.ip_address(value)
    if (not address.is_global or address.is_loopback or address.is_private or address.is_link_local or address.is_reserved or address.is_unspecified or address.is_multicast):
        raise SystemExit(1)
if endpoint_set & production_set: raise SystemExit(1)
resolved = ",".join(sorted(endpoint_set, key=lambda value: (ipaddress.ip_address(value).version, ipaddress.ip_address(value).packed)))
print("\t".join((os.environ["GEN_ENDPOINT"], resolved, hashlib.sha256(resolved.encode()).hexdigest(), external, production, hashlib.sha256(production.encode()).hexdigest())))
PY
}

production_address_digest() {
  local canonical
  canonical="$(canonical_production_addresses)" || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
  printf '%s' "$canonical" | sha256sum | awk '{print $1}'
}

# Resolve an endpoint once, canonicalize IPv4/IPv6, and compare its complete
# answer set directly with the single production set before returning a digest.
resolved_address_digest() {
  local host="${1-}" resolved="${CATERING_BACKUP_RESOLVED_ADDRESSES:-}" expected_uid="${CATERING_BACKUP_EXPECTED_UID:-0}" production
  [[ "$expected_uid" =~ ^[0-9]+$ ]] || { fail_state ATTESTATION_INVALID; return 1; }
  if [[ "$expected_uid" == 0 || "${CATERING_BACKUP_TEST_MODE:-0}" != 1 ]]; then resolved=""; fi
  production="$(canonical_production_addresses)" || { fail_state PRODUCTION_ADDRESSES_INVALID; return 1; }
  RESOLVED_ADDRESSES="$resolved" PRODUCTION_ADDRESSES="$production" HOSTNAME_TO_RESOLVE="$host" python3 - <<'PY'
import hashlib, ipaddress, os, socket, sys
raw = os.environ.get("RESOLVED_ADDRESSES", "")
if raw:
    values = raw.split(",")
else:
    try:
        values = sorted({item[4][0] for item in socket.getaddrinfo(os.environ.get("HOSTNAME_TO_RESOLVE", ""), None, type=socket.SOCK_STREAM)})
    except OSError:
        raise SystemExit(1)
if not values or any(not value or any(ch.isspace() for ch in value) for value in values):
    raise SystemExit(1)
try:
    endpoint = {str(ipaddress.ip_address(value)) for value in values}
    production = {str(ipaddress.ip_address(value)) for value in os.environ.get("PRODUCTION_ADDRESSES", "").split(",") if value}
except ValueError:
    raise SystemExit(1)
for value in endpoint:
    address = ipaddress.ip_address(value)
    if (not address.is_global or address.is_loopback or address.is_private or
        address.is_link_local or address.is_reserved or address.is_unspecified or
        address.is_multicast):
        raise SystemExit(1)
if endpoint & production:
    raise SystemExit(1)
print(hashlib.sha256(",".join(sorted(endpoint, key=lambda value: (ipaddress.ip_address(value).version, ipaddress.ip_address(value).packed))).encode()).hexdigest())
PY
}

# Fingerprint the six source roots without reading secret content.  Device,
# inode, type, size and modification generation are bound before and after the
# single tar stream; a path replacement therefore cannot silently change the
# capture generation.
capture_source_generation() {
  [[ "$#" == 6 ]] || { fail_state CADDY_CAPTURE_INVALID; return 1; }
  python3 - "$@" <<'PY'
import hashlib, os, stat, sys
labels = ("sites", "platform_caddy_data", "platform_caddy_config",
          "shared_edge_caddyfile", "shared_edge_caddy_data",
          "shared_edge_caddy_config")
value = hashlib.sha256()
def add(label, relative, info):
    if stat.S_ISLNK(info.st_mode) or not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
        raise ValueError("CADDY_CAPTURE_INVALID")
    value.update(("%s\0%s\0%s\0%s\0%s\0%s\0%s\n" % (
        label, relative, info.st_dev, info.st_ino, stat.S_IMODE(info.st_mode),
        info.st_size, info.st_mtime_ns)).encode("utf-8"))
def walk(label, root):
    root_info = os.lstat(root)
    add(label, ".", root_info)
    if stat.S_ISREG(root_info.st_mode):
        return
    pending = [(root, ".")]
    while pending:
        current, relative = pending.pop()
        entries = sorted(os.scandir(current), key=lambda entry: entry.name, reverse=True)
        for entry in entries:
            child_relative = entry.name if relative == "." else relative + "/" + entry.name
            info = entry.stat(follow_symlinks=False)
            add(label, child_relative, info)
            if stat.S_ISDIR(info.st_mode):
                pending.append((entry.path, child_relative))
for label, root in zip(labels, sys.argv[1:]):
    if not root.startswith("/") or "\x00" in root:
        raise ValueError("CADDY_CAPTURE_INVALID")
    walk(label, root)
print(value.hexdigest())
PY
}

attestation_field() {
  local record="${1-}" wanted="${2-}" line key value found="" count=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"; value="${line#*=}"
    if [[ "$key" == "$wanted" ]]; then found="$value"; count=$((count + 1)); fi
  done <<< "$record"
  [[ "$count" == 1 ]] || return 1
  printf '%s' "$found"
}

validate_attestation_record() {
  local kind="${1-}" path="${2-}" expected_digest="${3-}" record line key allowed required seen="|"
  require_digest "$expected_digest" || { fail_state ATTESTATION_DIGEST_INVALID; return 1; }
  safe_record_path "$path" || { fail_state ATTESTATION_PATH_INVALID; return 1; }
  record="$(read_bound_text "$path" "$MAX_RECORD_BYTES" "${CATERING_BACKUP_EXPECTED_UID:-0}" "$expected_digest" 0)" || return 1
  case "$kind" in
    offhost)
      allowed='|status|locator_digest|endpoint_host|resolved_addresses_digest|production_addresses|production_external_addresses|production_addresses_digest|repository_identity|host_binding|production_host_binding|scope|verified_at|valid_until|attestation_id|'
      required='status locator_digest endpoint_host resolved_addresses_digest production_addresses production_external_addresses production_addresses_digest repository_identity host_binding production_host_binding scope verified_at valid_until attestation_id' ;;
    secret)
      allowed='|status|source_type|source_reference|source_reference_digest|required_secret_schema_digest|repository_identity|host_binding|scope|verified_at|valid_until|attestation_id|'
      required='status source_type source_reference source_reference_digest required_secret_schema_digest repository_identity host_binding scope verified_at valid_until attestation_id' ;;
    *) fail_state ATTESTATION_INVALID; return 1 ;;
  esac
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || { fail_state ATTESTATION_INVALID; return 1; }
    key="${line%%=*}"; [[ "$allowed" == *"|$key|"* && "$seen" != *"|$key|"* ]] || { fail_state ATTESTATION_INVALID; return 1; }
    [[ -n "${line#*=}" ]] || { fail_state ATTESTATION_INVALID; return 1; }
    seen+="$key|"
  done <<< "$record"
  for required_key in $required; do [[ "$seen" == *"|$required_key|"* ]] || { fail_state ATTESTATION_INVALID; return 1; }; done
  printf '%s' "$record"
}

attestation_time_allowed() {
  local timestamp="${1-}" valid_until="${2-}" minimum_remaining="${3:-0}" now="${CATERING_BACKUP_ATTESTATION_NOW_EPOCH:-}" timestamp_epoch valid_epoch
  [[ "$minimum_remaining" =~ ^[0-9]+$ ]] || return 1
  require_timestamp "$timestamp" || return 1
  require_timestamp "$valid_until" || return 1
  # Clock injection is a non-root hermetic-test seam only.  Production always
  # uses the real UTC clock and cannot be frozen by an environment variable.
  if [[ "${CATERING_BACKUP_TEST_MODE:-0}" != 1 || "${CATERING_BACKUP_EXPECTED_UID:-0}" == 0 || -z "$now" ]]; then now="$(date -u +%s)"; fi
  [[ "$now" =~ ^[0-9]+$ ]] || return 1
  timestamp_epoch="$(python3 - "$timestamp" <<'PY'
import datetime, sys
try:
    value = datetime.datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
    print(int(value.timestamp()))
except Exception:
    raise SystemExit(1)
PY
)" || return 1
  valid_epoch="$(python3 - "$valid_until" <<'PY'
import datetime, sys
try:
    value = datetime.datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
    print(int(value.timestamp()))
except Exception:
    raise SystemExit(1)
PY
)" || return 1
  [[ "$timestamp_epoch" -le "$now" && "$valid_epoch" -gt "$now" && "$valid_epoch" -gt "$timestamp_epoch" && $((valid_epoch - timestamp_epoch)) -le 2592000 && $((valid_epoch - now)) -ge "$minimum_remaining" ]]
}

validate_offhost_attestation() {
  local path="${1-}" repository_id="${2-}" host_digest="${3-}" locator_digest="${4-}" resolved_digest="${5-}" production_host_digest="${6-}" production_addresses_digest="${7-}" expected_production_addresses="${8-}" expected_external_addresses="${9-}" expected_endpoint="${10-}" expected_resolved_addresses="${11-}" minimum_remaining="${12:-0}" record endpoint actual_resolved record_locator record_resolved record_production record_production_set record_external record_repository record_host record_production_host record_scope record_time valid_until record_id
  require_digest "$repository_id" || return 1
  require_digest "$host_digest" || return 1
  require_digest "$locator_digest" || return 1
  require_digest "$resolved_digest" || return 1
  require_digest "$production_host_digest" || return 1
  require_digest "$production_addresses_digest" || return 1
  if [[ -z "$expected_production_addresses" ]]; then expected_production_addresses="$(canonical_production_addresses)" || return 1; fi
  if [[ -z "$expected_external_addresses" ]]; then expected_external_addresses="$(canonical_external_addresses)" || return 1; fi
  [[ "$expected_production_addresses" != *[[:space:]]* ]] || return 1
  record="$(validate_attestation_record offhost "$path" "${CATERING_OFFHOST_ATTESTATION_SHA256:-}")" || return 1
  [[ "$(attestation_field "$record" status)" == operator_attested ]] || return 1
  record_locator="$(attestation_field "$record" locator_digest)" || return 1
  require_digest "$record_locator" || return 1
  [[ "$record_locator" == "$locator_digest" ]] || return 1
  endpoint="$(attestation_field "$record" endpoint_host)" || return 1
  if [[ -z "$expected_endpoint" ]]; then expected_endpoint="$(repository_endpoint_host "${CATERING_BACKUP_REPOSITORY_VALUE:-}")" || return 1; fi
  [[ "$endpoint" == "$expected_endpoint" && "$endpoint" =~ ^[a-z0-9][a-z0-9.-]*[a-z0-9]$ && "$endpoint" != *.local && "$endpoint" != *.internal ]] || return 1
  if [[ -n "$expected_resolved_addresses" ]]; then
    actual_resolved="$(printf '%s' "$expected_resolved_addresses" | sha256sum | awk '{print $1}')" || return 1
  else
    actual_resolved="$(resolved_address_digest "$endpoint")" || return 1
  fi
  record_resolved="$(attestation_field "$record" resolved_addresses_digest)" || return 1
  require_digest "$record_resolved" || return 1
  [[ "$actual_resolved" == "$resolved_digest" && "$record_resolved" == "$resolved_digest" ]] || return 1
  [[ "$production_addresses_digest" == "${CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256:-}" ]] || return 1
  record_production="$(attestation_field "$record" production_addresses_digest)" || return 1
  require_digest "$record_production" || return 1
  [[ "$record_production" == "$production_addresses_digest" ]] || return 1
  record_production_set="$(attestation_field "$record" production_addresses)" || return 1
  [[ "$record_production_set" == "$expected_production_addresses" ]] || return 1
  record_external="$(attestation_field "$record" production_external_addresses)" || return 1
  [[ "$record_external" == "$expected_external_addresses" ]] || return 1
  # The backup executes on the production host, so both host fields attest the
  # same identity.  Off-host exclusion is the endpoint/address-set boundary.
  record_repository="$(attestation_field "$record" repository_identity)" || return 1
  record_host="$(attestation_field "$record" host_binding)" || return 1
  record_production_host="$(attestation_field "$record" production_host_binding)" || return 1
  require_digest "$record_repository" || return 1
  require_digest "$record_host" || return 1
  require_digest "$record_production_host" || return 1
  [[ "$production_host_digest" == "$host_digest" && "$record_repository" == "$repository_id" && "$record_host" == "$host_digest" && "$record_production_host" == "$host_digest" ]] || return 1
  record_scope="$(attestation_field "$record" scope)" || return 1
  [[ "$record_scope" == postgres,sites,platform-caddy,shared-edge-caddy ]] || return 1
  record_time="$(attestation_field "$record" verified_at)" || return 1
  valid_until="$(attestation_field "$record" valid_until)" || return 1
  attestation_time_allowed "$record_time" "$valid_until" "$minimum_remaining" || return 1
  record_id="$(attestation_field "$record" attestation_id)" || return 1
  require_digest "$record_id"
}

validate_secret_recovery_attestation() {
  local path="${1-}" repository_id="${2-}" host_digest="${3-}" secret_reference="${4-}" minimum_remaining="${5:-0}" record source_reference source_type source_schema expected_source_schema expected_source_type expected_source_reference record_repository record_host record_scope record_time valid_until record_id expected_source_digest expected_schema_digest
  require_digest "$repository_id" || return 1
  require_digest "$host_digest" || return 1
  require_digest "$secret_reference" || return 1
  record="$(validate_attestation_record secret "$path" "${CATERING_SECRET_RECOVERY_ATTESTATION_SHA256:-}")" || return 1
  [[ "$(attestation_field "$record" status)" == operator_attested ]] || return 1
  expected_source_type="${CATERING_SECRET_RECOVERY_SOURCE_TYPE-}"
  expected_source_reference="${CATERING_SECRET_RECOVERY_SOURCE_REFERENCE-}"
  [[ "$expected_source_type" == github_environment || "$expected_source_type" == offline_vault ]] || return 1
  [[ "$expected_source_reference" != *$'\n'* && "$expected_source_reference" != *$'\r'* && "$expected_source_reference" != *[[:space:]]* && "$expected_source_reference" != *..* && "$expected_source_reference" != *//* ]] || return 1
  case "$expected_source_type" in
    github_environment) [[ "$expected_source_reference" =~ ^github_environment:[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || return 1 ;;
    offline_vault) [[ "$expected_source_reference" =~ ^offline_vault:/[A-Za-z0-9_./-]+$ && "$expected_source_reference" != *..* && "$expected_source_reference" != *//* && "$expected_source_reference" != */ ]] || return 1 ;;
  esac
  source_type="$(attestation_field "$record" source_type)" || return 1
  [[ "$source_type" == "$expected_source_type" ]] || return 1
  source_reference="$(attestation_field "$record" source_reference)" || return 1
  [[ "$source_reference" == "$expected_source_reference" ]] || return 1
  source_schema="$(attestation_field "$record" source_reference_digest)" || return 1
  expected_source_schema="$(attestation_field "$record" required_secret_schema_digest)" || return 1
  require_digest "$source_schema" || return 1
  require_digest "$expected_source_schema" || return 1
  expected_source_digest="$(printf '%s' "$expected_source_reference" | sha256sum | awk '{print $1}')" || return 1
  expected_schema_digest="$(printf '%s' "$SECRET_RECOVERY_SCHEMA" | sha256sum | awk '{print $1}')" || return 1
  [[ "$source_schema" == "$expected_source_digest" ]] || return 1
  [[ "$source_schema" == "$secret_reference" ]] || return 1
  [[ "$expected_source_schema" == "$expected_schema_digest" && "$expected_source_schema" == "${CATERING_REQUIRED_SECRET_SCHEMA_SHA256:-}" ]] || return 1
  record_repository="$(attestation_field "$record" repository_identity)" || return 1
  record_host="$(attestation_field "$record" host_binding)" || return 1
  require_digest "$record_repository" || return 1
  require_digest "$record_host" || return 1
  [[ "$record_repository" == "$repository_id" && "$record_host" == "$host_digest" ]] || return 1
  record_scope="$(attestation_field "$record" scope)" || return 1
  [[ "$record_scope" == postgres,sites,platform-caddy,shared-edge-caddy ]] || return 1
  record_time="$(attestation_field "$record" verified_at)" || return 1
  valid_until="$(attestation_field "$record" valid_until)" || return 1
  attestation_time_allowed "$record_time" "$valid_until" "$minimum_remaining" || return 1
  record_id="$(attestation_field "$record" attestation_id)" || return 1
  require_digest "$record_id"
}

validate_operator_attestations() {
  local repository_id="${1-}" host_digest="${2-}" locator_digest="${3-}" resolved_digest="${4-}" production_host_digest="${5-}" production_addresses_digest="${6-}" production_addresses="${7-}" minimum_remaining="${8:-0}" generation endpoint resolved_addresses generation_resolved_digest generation_external generation_production generation_production_digest production_addresses_digest_actual
  [[ -n "${CATERING_OFFHOST_ATTESTATION_FILE:-}" && -n "${CATERING_SECRET_RECOVERY_ATTESTATION_FILE:-}" && -n "${CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256:-}" && -n "${CATERING_BACKUP_PRODUCTION_HOST_SHA256:-}" && -n "${CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256:-}" && -n "${CATERING_REQUIRED_SECRET_SCHEMA_SHA256:-}" && -n "${CATERING_SECRET_RECOVERY_SOURCE_TYPE:-}" && -n "${CATERING_SECRET_RECOVERY_SOURCE_REFERENCE:-}" ]] || { fail_state ATTESTATION_MISSING; return 1; }
  require_digest "$repository_id" || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "$host_digest" || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "$locator_digest" || { fail_state ATTESTATION_INVALID; return 1; }
  [[ -z "$resolved_digest" || "$resolved_digest" =~ ^[0-9a-f]{64}$ ]] || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "$production_host_digest" || { fail_state ATTESTATION_INVALID; return 1; }
  [[ "$minimum_remaining" =~ ^[0-9]+$ ]] || { fail_state ATTESTATION_INVALID; return 1; }
  generation="$(capture_address_generation "${CATERING_BACKUP_REPOSITORY_VALUE:-}")" || { fail_state ATTESTATION_INVALID; return 1; }
  IFS=$'\t' read -r endpoint resolved_addresses generation_resolved_digest generation_external generation_production generation_production_digest <<< "$generation"
  [[ -n "$endpoint" && -n "$resolved_addresses" && -n "$generation_resolved_digest" && -n "$generation_external" && -n "$generation_production" && -n "$generation_production_digest" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  [[ -z "$resolved_digest" || "$resolved_digest" == "$generation_resolved_digest" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  [[ -z "$production_addresses_digest" || "$production_addresses_digest" == "$generation_production_digest" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  [[ -z "$production_addresses" || "$production_addresses" == "$generation_production" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  production_addresses="$generation_production"
  production_addresses_digest="$generation_production_digest"
  production_addresses_digest_actual="$(printf '%s' "$production_addresses" | sha256sum | awk '{print $1}')" || { fail_state ATTESTATION_INVALID; return 1; }
  [[ "$production_addresses_digest_actual" == "$production_addresses_digest" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "$CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256" || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "$CATERING_REQUIRED_SECRET_SCHEMA_SHA256" || { fail_state ATTESTATION_INVALID; return 1; }
  require_digest "${CATERING_SECRET_RECOVERY_REFERENCE_SHA256:-}" || { fail_state ATTESTATION_INVALID; return 1; }
  [[ "$locator_digest" == "$CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  validate_offhost_repository "${CATERING_BACKUP_REPOSITORY_VALUE:-}" 1 || { fail_state ATTESTATION_INVALID; return 1; }
  [[ "$production_host_digest" == "$CATERING_BACKUP_PRODUCTION_HOST_SHA256" && "$production_host_digest" == "$host_digest" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  [[ "$production_addresses_digest" == "$CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256" ]] || { fail_state ATTESTATION_INVALID; return 1; }
  CATERING_BACKUP_REPOSITORY_VALUE="${CATERING_BACKUP_REPOSITORY_VALUE:-}" validate_offhost_attestation "$CATERING_OFFHOST_ATTESTATION_FILE" "$repository_id" "$host_digest" "$locator_digest" "$generation_resolved_digest" "$production_host_digest" "$production_addresses_digest" "$production_addresses" "$generation_external" "$endpoint" "$resolved_addresses" "$minimum_remaining" || { fail_state OFFHOST_ATTESTATION_INVALID; return 1; }
  validate_secret_recovery_attestation "$CATERING_SECRET_RECOVERY_ATTESTATION_FILE" "$repository_id" "$host_digest" "$CATERING_SECRET_RECOVERY_REFERENCE_SHA256" "$minimum_remaining" || { fail_state SECRET_ATTESTATION_INVALID; return 1; }
}

validate_repository_status_record() {
  local record="${1-}" line key value seen="|" wanted
  [[ -n "$record" ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* && "$line" != *$'\r'* && "$line" != *$'\t'* ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
    key="${line%%=*}"; value="${line#*=}"
    [[ "$key" =~ ^[a-z][a-z0-9_]*$ && -n "$value" && "$seen" != *"|$key|"* ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
    case "$key" in status|identity|host_binding|scope|verified_at) ;; *) fail_state REPOSITORY_STATUS_INVALID; return 1 ;; esac
    seen+="$key|"
  done <<< "$record"
  for wanted in status identity host_binding scope verified_at; do
    [[ "$seen" == *"|$wanted|"* ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  done
  local status identity host_binding scope verified_at
  status="${record#*status=}"; status="${status%%$'\n'*}"
  identity="$(printf '%s\n' "$record" | awk -F= '$1=="identity"{print substr($0,index($0,"=")+1)}')"
  host_binding="$(printf '%s\n' "$record" | awk -F= '$1=="host_binding"{print substr($0,index($0,"=")+1)}')"
  scope="$(printf '%s\n' "$record" | awk -F= '$1=="scope"{print substr($0,index($0,"=")+1)}')"
  verified_at="$(printf '%s\n' "$record" | awk -F= '$1=="verified_at"{print substr($0,index($0,"=")+1)}')"
  [[ "$status" == read-only-verified && "$identity" =~ ^[0-9a-f]{64}$ && "$host_binding" =~ ^[0-9a-f]{64}$ && "$scope" == postgres,sites,platform-caddy,shared-edge-caddy ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  require_timestamp "$verified_at" || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
}

validate_repository_status_binding() {
  local record="${1-}" expected_identity="${2-}" expected_host="${3-}" expected_scope="${4-}" line key value status="" identity="" host_binding="" scope="" verified_at=""
  validate_repository_status_record "$record" || return 1
  require_digest "$expected_identity" || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  require_digest "$expected_host" || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  [[ "$expected_scope" == postgres,sites,platform-caddy,shared-edge-caddy ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"; value="${line#*=}"
    case "$key" in
      status) status="$value" ;;
      identity) identity="$value" ;;
      host_binding) host_binding="$value" ;;
      scope) scope="$value" ;;
      verified_at) verified_at="$value" ;;
    esac
  done <<< "$record"
  [[ "$status" == read-only-verified && "$identity" == "$expected_identity" && "$host_binding" == "$expected_host" && "$scope" == "$expected_scope" ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  local now timestamp_epoch
  if [[ "${CATERING_BACKUP_TEST_MODE:-0}" == 1 && "${CATERING_BACKUP_EXPECTED_UID:-0}" != 0 && -n "${CATERING_BACKUP_ATTESTATION_NOW_EPOCH:-}" ]]; then
    now="$CATERING_BACKUP_ATTESTATION_NOW_EPOCH"
  else
    now="$(date -u +%s)" || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  fi
  [[ "$now" =~ ^[0-9]+$ ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  timestamp_epoch="$(python3 - "$verified_at" <<'PY'
import datetime, sys
try:
    value = datetime.datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
    print(int(value.timestamp()))
except Exception:
    raise SystemExit(1)
PY
)" || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
  [[ "$timestamp_epoch" =~ ^[0-9]+$ && "$timestamp_epoch" -le "$now" ]] || { fail_state REPOSITORY_STATUS_INVALID; return 1; }
}

validate_open_fd() {
  local fd="${1-}" expected_uid="${2:-${CATERING_BACKUP_EXPECTED_UID:-0}}" limit="${3:-$MAX_RECORD_BYTES}"
  [[ "$fd" =~ ^[0-9]+$ && "$expected_uid" =~ ^[0-9]+$ ]] || { fail_state STATE_MODE_INVALID; return 1; }
  python3 - "$fd" "$expected_uid" "$limit" <<'PY'
import os, stat, sys
fd, expected_uid, limit = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
try: info = os.fstat(fd)
except OSError: print("STATE_PATH_INVALID", file=sys.stderr); raise SystemExit(1)
if not stat.S_ISREG(info.st_mode) or info.st_uid != expected_uid or stat.S_IMODE(info.st_mode) != 0o600:
    print("STATE_MODE_INVALID", file=sys.stderr); raise SystemExit(1)
if info.st_size > limit: print("STATE_TOO_LARGE", file=sys.stderr); raise SystemExit(1)
PY
}

read_secure_fd() {
  local fd="${1-}" limit="${2:-$MAX_RECORD_BYTES}" expected_uid="${3:-${CATERING_BACKUP_EXPECTED_UID:-0}}"
  validate_open_fd "$fd" "$expected_uid" "$limit" || return 1
  python3 - "$fd" "$limit" <<'PY'
import os, sys
fd, limit = int(sys.argv[1]), int(sys.argv[2])
position = os.lseek(fd, 0, os.SEEK_CUR)
os.lseek(fd, 0, os.SEEK_SET)
try:
    data = bytearray()
    while len(data) <= limit:
        try: chunk = os.read(fd, min(8192, limit + 1 - len(data)))
        except InterruptedError: continue
        if not chunk: break
        data.extend(chunk)
finally: os.lseek(fd, position, os.SEEK_SET)
if len(data) > limit: print("STATE_TOO_LARGE", file=sys.stderr); raise SystemExit(1)
if b"\x00" in data or b"\r" in data or b"\n" in data[:-1]: print("STATE_FORMAT_INVALID", file=sys.stderr); raise SystemExit(1)
try: text = bytes(data).decode("utf-8")
except UnicodeDecodeError: print("STATE_ENCODING_INVALID", file=sys.stderr); raise SystemExit(1)
if not text.endswith("\n"): print("STATE_FORMAT_INVALID", file=sys.stderr); raise SystemExit(1)
print(text[:-1], end="")
PY
}

validate_record_payload() {
  local payload="${1-}" line key value seen="|"
  [[ -n "$payload" ]] || { fail_state STATE_INVALID; return 1; }
  [[ "$payload" == $'status='* ]] || { fail_state STATE_INVALID; return 1; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    [[ "$line" == *=* && "$line" != *$'\t'* && "$line" != *$'\r'* ]] || { fail_state STATE_INVALID; return 1; }
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[a-z][a-z0-9_]*$ && -n "$value" ]] || { fail_state STATE_INVALID; return 1; }
    [[ "$seen" != *"|$key|"* ]] || { fail_state RECORD_DUPLICATE_FIELD; return 1; }
    seen+="$key|"
  done < <(printf '%s' "$payload")
}

assert_directory_mode() {
  local path="${1-}" info mode owner kind expected_uid="${2:-${CATERING_BACKUP_EXPECTED_UID:-0}}"
  [[ -n "$path" && ! -L "$path" && "$expected_uid" =~ ^[0-9]+$ ]] || { fail_state STATE_PATH_INVALID; return 1; }
  if info="$(stat -c '%F:%a:%u' "$path" 2>/dev/null)"; then
    IFS=: read -r kind mode owner <<< "$info"
    [[ "$kind" == "directory" && "$mode" == 700 && "$owner" == "$expected_uid" ]] || { fail_state STATE_MODE_INVALID; return 1; }
  else
    info="$(stat -f '%HT:%Lp:%u' "$path" 2>/dev/null)" || { fail_state STATE_MISSING; return 1; }
    IFS=: read -r kind mode owner <<< "$info"
    [[ "$kind" == "Directory" && "$mode" == 700 && "$owner" == "$expected_uid" ]] || { fail_state STATE_MODE_INVALID; return 1; }
  fi
}

# This is the single durable publication primitive.  The binary source form
# keeps file contents out of Bash variables, so NUL and UTF-8 validation happen
# before any publication while the source descriptor remains identity-bound.
_atomic_publish() {
  local target="${1-}" mode="${2-}" source="${3-}" payload="${4-}" expected_uid="${5:-${CATERING_BACKUP_EXPECTED_UID:-$(id -u)}}"
  export CATERING_BACKUP_ROOT="$BACKUP_ROOT"
  python3 - "$target" "$MAX_RECORD_BYTES" "$mode" "$source" "$payload" "$expected_uid" <<'PY'
import os, re, secrets, stat, sys

target, limit, mode, source, payload = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]
expected_uid = int(sys.argv[6]) if len(sys.argv) > 6 else os.getuid()

def fail(code):
    print(code, file=sys.stderr)
    raise SystemExit(1)

def read_fd(fd, bound):
    value = bytearray()
    while len(value) <= bound:
        try:
            chunk = os.read(fd, min(8192, bound + 1 - len(value)))
        except InterruptedError:
            continue
        if not chunk:
            break
        value.extend(chunk)
    return bytes(value)

def valid_record(data):
    if b"\x00" in data or len(data) > limit:
        return "STATE_TOO_LARGE" if len(data) > limit else "STATE_INVALID"
    if not data.endswith(b"\n"):
        return "STATE_FORMAT_INVALID"
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return "STATE_ENCODING_INVALID"
    lines = text[:-1].split("\n")
    if not lines or not lines[0].startswith("status="):
        return "STATE_INVALID"
    seen = set()
    for line in lines:
        if "=" not in line or "\t" in line or "\r" in line:
            return "STATE_INVALID"
        key, value = line.split("=", 1)
        if not re.fullmatch(r"[a-z][a-z0-9_]*", key) or not value or key in seen:
            return "STATE_INVALID"
        seen.add(key)
    return None

class PublishError(Exception):
    pass

def require(condition, code):
    if not condition:
        raise PublishError(code)

def open_directory_chain(path):
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open("/", flags)
    try:
        for component in path.split("/")[1:]:
            if not component or component in (".", ".."):
                raise PublishError("STATE_PATH_INVALID")
            child = os.open(component, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except OSError:
        os.close(fd)
        raise PublishError("STATE_PATH_INVALID")
    except BaseException:
        os.close(fd)
        raise

def open_relative_chain(base_fd, relative):
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.dup(base_fd)
    try:
        for component in relative.split("/"):
            if not component or component in (".", ".."):
                raise PublishError("STATE_PATH_INVALID")
            child = os.open(component, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except OSError:
        os.close(fd)
        raise PublishError("STATE_PATH_INVALID")
    except BaseException:
        os.close(fd)
        raise

def open_temp(parent_fd, prefix):
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    for _ in range(32):
        name = "%s%s.%s" % (prefix, os.getpid(), secrets.token_hex(8))
        try:
            return os.open(name, flags, 0o600, dir_fd=parent_fd), name
        except FileExistsError:
            continue
    raise PublishError("STATE_PERSIST_FAILED")

def write_all(fd, value):
    offset = 0
    while offset < len(value):
        try:
            count = os.write(fd, value[offset:])
        except InterruptedError:
            continue
        if count <= 0:
            raise PublishError("STATE_PERSIST_FAILED")
        offset += count

data = payload.encode("utf-8") if mode == "payload" else None
root_fd = parent_fd = -1
source_fd = -1
temporary = None
published = False
try:
    root_value = os.environ.get("CATERING_BACKUP_ROOT")
    require(root_value is not None and root_value.startswith("/"), "STATE_PATH_INVALID")
    require(target.startswith("/") and os.path.normpath(target) == target, "STATE_PATH_INVALID")
    root = os.path.abspath(root_value)
    parent = os.path.dirname(target)
    # macOS exposes /var as a stable system alias for /private/var.  Bind the
    # canonical spelling before traversing so that O_NOFOLLOW rejects actual
    # project-controlled symlinks without rejecting the platform's alias.
    if sys.platform == "darwin" and root.startswith("/var/"):
        root = "/private" + root
    if sys.platform == "darwin" and parent.startswith("/var/"):
        parent = "/private" + parent
    target_name = os.path.basename(target)
    require(root not in ("", "/") and target_name not in ("", ".", "..") and "/" not in target_name, "STATE_PATH_INVALID")
    relative_parent = os.path.relpath(parent, root)
    require(relative_parent != ".." and not relative_parent.startswith("../"), "STATE_PATH_INVALID")
    root_fd = open_directory_chain(root)
    parent_fd = root_fd if relative_parent == "." else open_relative_chain(root_fd, relative_parent)
    root_info = os.fstat(root_fd)
    parent_info = os.fstat(parent_fd)
    require(stat.S_ISDIR(root_info.st_mode) and stat.S_ISDIR(parent_info.st_mode), "STATE_PATH_INVALID")
    require(root_info.st_uid == expected_uid and parent_info.st_uid == expected_uid, "STATE_MODE_INVALID")
    require(stat.S_IMODE(root_info.st_mode) == 0o700 and stat.S_IMODE(parent_info.st_mode) == 0o700, "STATE_MODE_INVALID")

    def fresh_binding():
        fresh_root = fresh_parent = -1
        try:
            fresh_root = open_directory_chain(root)
            fresh_parent = fresh_root if relative_parent == "." else open_relative_chain(fresh_root, relative_parent)
            return os.fstat(fresh_root), os.fstat(fresh_parent)
        except OSError:
            raise PublishError("STATE_PATH_CHANGED")
        finally:
            if fresh_parent >= 0 and fresh_parent != fresh_root:
                os.close(fresh_parent)
            if fresh_root >= 0:
                os.close(fresh_root)

    def ensure_binding():
        try:
            current_root = os.fstat(root_fd)
            current_parent = os.fstat(parent_fd)
            fresh_root, fresh_parent = fresh_binding()
            # A second fresh traversal closes the only remaining window between
            # opening the current chain and comparing its descriptors: a path
            # swap after the first fresh fstat must not become a success.
            latest_root, latest_parent = fresh_binding()
        except OSError:
            raise PublishError("STATE_PATH_CHANGED")
        for info in (current_root, current_parent, fresh_root, fresh_parent, latest_root, latest_parent):
            require(stat.S_ISDIR(info.st_mode), "STATE_PATH_CHANGED")
        require((fresh_root.st_dev, fresh_root.st_ino) == (current_root.st_dev, current_root.st_ino), "STATE_PATH_CHANGED")
        require((fresh_parent.st_dev, fresh_parent.st_ino) == (current_parent.st_dev, current_parent.st_ino), "STATE_PATH_CHANGED")
        require((latest_root.st_dev, latest_root.st_ino) == (current_root.st_dev, current_root.st_ino), "STATE_PATH_CHANGED")
        require((latest_parent.st_dev, latest_parent.st_ino) == (current_parent.st_dev, current_parent.st_ino), "STATE_PATH_CHANGED")

    ensure_binding()
    if mode == "source":
        try:
            source_before = os.lstat(source)
            if not stat.S_ISREG(source_before.st_mode) or source_before.st_uid != expected_uid or stat.S_IMODE(source_before.st_mode) != 0o600 or source_before.st_size > limit:
                fail("STATE_TOO_LARGE" if source_before.st_size > limit else "STATE_TYPE_INVALID")
            source_fd = os.open(source, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
            source_info = os.fstat(source_fd)
            if (source_before.st_dev, source_before.st_ino) != (source_info.st_dev, source_info.st_ino):
                fail("STATE_PATH_CHANGED")
            if not stat.S_ISREG(source_info.st_mode) or source_info.st_uid != expected_uid or stat.S_IMODE(source_info.st_mode) != 0o600 or source_info.st_size > limit:
                fail("STATE_TOO_LARGE" if source_info.st_size > limit else "STATE_MODE_INVALID")
            data = read_fd(source_fd, limit)
        except FileNotFoundError:
            fail("STATE_MISSING")
        finally:
            if source_fd >= 0:
                os.close(source_fd)
                source_fd = -1
    if data is None:
        fail("STATE_INVALID")
    invalid = valid_record(data)
    if invalid:
        fail(invalid)
    ensure_binding()

    old_present = False
    old_data = b""
    try:
        target_metadata = os.stat(target_name, dir_fd=parent_fd, follow_symlinks=False)
    except FileNotFoundError:
        old_fd = -1
    else:
        if stat.S_ISLNK(target_metadata.st_mode) or not stat.S_ISREG(target_metadata.st_mode):
            raise PublishError("STATE_PATH_INVALID")
        if target_metadata.st_uid != expected_uid or stat.S_IMODE(target_metadata.st_mode) != 0o600:
            raise PublishError("STATE_MODE_INVALID")
        try:
            old_fd = os.open(target_name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent_fd)
        except OSError:
            raise PublishError("STATE_PATH_CHANGED")
    if old_fd >= 0:
        try:
            old_info = os.fstat(old_fd)
            if not stat.S_ISREG(old_info.st_mode) or old_info.st_uid != expected_uid or stat.S_IMODE(old_info.st_mode) != 0o600:
                fail("STATE_MODE_INVALID")
            old_data = read_fd(old_fd, limit)
            if len(old_data) > limit:
                fail("STATE_TOO_LARGE")
            old_present = True
        finally:
            os.close(old_fd)

    def sync_parent():
        os.fsync(parent_fd)

    def read_target():
        try:
            check_fd = os.open(target_name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent_fd)
        except FileNotFoundError:
            return None, None
        try:
            check_info = os.fstat(check_fd)
            require(stat.S_ISREG(check_info.st_mode) and check_info.st_uid == expected_uid and stat.S_IMODE(check_info.st_mode) == 0o600, "STATE_MODE_INVALID")
            return check_info, read_fd(check_fd, limit + 1)
        finally:
            os.close(check_fd)

    fd, temporary = open_temp(parent_fd, ".record.")
    try:
        os.fchmod(fd, 0o600)
        write_all(fd, data)
        os.fsync(fd)
        temporary_info = os.fstat(fd)
        os.close(fd)
        fd = -1
        ensure_binding()
        os.replace(temporary, target_name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
        published = True
        temporary = None
        sync_parent()
        ensure_binding()
        target_info, readback = read_target()
        require(target_info is not None and (temporary_info.st_dev, temporary_info.st_ino) == (target_info.st_dev, target_info.st_ino), "STATE_PATH_CHANGED")
        require(readback == data and len(readback) <= limit, "STATE_READBACK_MISMATCH")
        # Validate the complete readback before the final fresh chain bind; the
        # following binding check is the defined success boundary.
        ensure_binding()
    except PublishError:
        if published:
            raise PublishError("EVIDENCE_DURABILITY_UNKNOWN")
        raise
    except Exception:
        if published:
            raise PublishError("EVIDENCE_DURABILITY_UNKNOWN")
        raise PublishError("STATE_PERSIST_FAILED")
except PublishError as error:
    fail(str(error))
except SystemExit:
    raise
except Exception:
    fail("STATE_PERSIST_FAILED")
finally:
    if source_fd >= 0:
        os.close(source_fd)
    if "fd" in locals() and fd >= 0:
        os.close(fd)
    if not published and temporary is not None:
        try:
            os.unlink(temporary, dir_fd=parent_fd)
        except (FileNotFoundError, OSError):
            pass
    if parent_fd >= 0 and parent_fd != root_fd:
        os.close(parent_fd)
    if root_fd >= 0:
        os.close(root_fd)
PY
}

atomic_write_record() {
  local target="${1-}" payload="${2-}"
  [[ -n "$target" && "$target" == /* ]] || { fail_state STATE_PATH_INVALID; return 1; }
  safe_record_path "$target" || { fail_state STATE_PATH_INVALID; return 1; }
  if [[ -e "$target" ]]; then
    assert_root_mode_600 "$target" "${CATERING_BACKUP_EXPECTED_UID:-$(id -u)}" || return 1
  fi
  [[ -d "$(dirname "$target")" ]] || { fail_state STATE_PATH_INVALID; return 1; }
  validate_record_payload "$payload" || return 1
  _atomic_publish "$target" payload "" "$payload" "${CATERING_BACKUP_EXPECTED_UID:-$(id -u)}" || return 1
}

atomic_replace() {
  local source="${1-}" target="${2-}"
  [[ -n "$source" && -n "$target" && "$source" == /* && "$target" == /* ]] || { fail_state STATE_PATH_INVALID; return 1; }
  safe_record_path "$source" || { fail_state STATE_PATH_INVALID; return 1; }
  safe_record_path "$target" || { fail_state STATE_PATH_INVALID; return 1; }
  _atomic_publish "$target" source "$source" "" "${CATERING_BACKUP_EXPECTED_UID:-$(id -u)}" || return 1
}

read_bounded_record() {
  local path="${1-}" limit="${2:-$MAX_RECORD_BYTES}" expected_uid="${3:-0}" expected_digest="${4-}"
  safe_record_path "$path" || { fail_state STATE_PATH_INVALID; return 1; }
  [[ "$expected_uid" =~ ^[0-9]+$ ]] || { fail_state STATE_MODE_INVALID; return 1; }
  [[ "$limit" =~ ^[0-9]+$ ]] || { fail_state STATE_LIMIT_INVALID; return 1; }
  [[ -z "$expected_digest" || "$expected_digest" =~ ^[0-9a-f]{64}$ ]] || { fail_state CHECKSUM_INVALID; return 1; }
  # Production callers use UID 0; the narrow third argument lets an isolated
  # non-root test process prove writer/reader byte compatibility without
  # weakening the production owner contract.
  python3 - "$path" "$limit" "$expected_uid" "$expected_digest" <<'PY'
import hashlib, os, stat, sys
path, limit, expected_uid = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
expected_digest = sys.argv[4] if len(sys.argv) > 4 else ""
try:
    before = os.stat(path, follow_symlinks=False)
    if not stat.S_ISREG(before.st_mode):
        raise ValueError("STATE_PATH_INVALID")
    if before.st_size > limit:
        raise ValueError("STATE_TOO_LARGE")
    no_follow = os.O_NOFOLLOW if hasattr(os, "O_NOFOLLOW") else 0
    fd = os.open(path, os.O_RDONLY | no_follow)
except FileNotFoundError:
    print("STATE_MISSING", file=sys.stderr); raise SystemExit(1)
except (OSError, ValueError) as error:
    code = str(error) if str(error).startswith("STATE_") else "STATE_PATH_INVALID"
    print(code, file=sys.stderr); raise SystemExit(1)
try:
    info = os.fstat(fd)
    if (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino):
        print("STATE_PATH_CHANGED", file=sys.stderr); raise SystemExit(1)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != expected_uid or stat.S_IMODE(info.st_mode) != 0o600:
        print("STATE_MODE_INVALID", file=sys.stderr); raise SystemExit(1)
    if info.st_size > limit:
        print("STATE_TOO_LARGE", file=sys.stderr); raise SystemExit(1)
    value = bytearray()
    while len(value) <= limit:
        try:
            chunk = os.read(fd, min(8192, limit + 1 - len(value)))
        except InterruptedError:
            continue
        if not chunk:
            break
        value.extend(chunk)
finally:
    os.close(fd)
if len(value) > limit:
    print("STATE_TOO_LARGE", file=sys.stderr); raise SystemExit(1)
if expected_digest and hashlib.sha256(value).hexdigest() != expected_digest:
    print("CHECKSUM_MISMATCH", file=sys.stderr); raise SystemExit(1)
if b"\x00" in value or b"\r" in value:
    print("STATE_ENCODING_INVALID", file=sys.stderr); raise SystemExit(1)
try:
    text = value.decode("utf-8")
except UnicodeDecodeError:
    print("STATE_ENCODING_INVALID", file=sys.stderr); raise SystemExit(1)
if not text.endswith("\n"):
    print("STATE_FORMAT_INVALID", file=sys.stderr); raise SystemExit(1)
if text.endswith("\n\n"):
    print("STATE_FORMAT_INVALID", file=sys.stderr); raise SystemExit(1)
print(text, end="")
PY
}

require_hex() { [[ "${1-}" =~ ^[0-9a-f]+$ ]]; }
require_digest() { [[ "${1-}" =~ ^[0-9a-f]{64}$ ]]; }
require_commit() { [[ "${1-}" =~ ^[0-9a-f]{40}$ ]]; }
require_safe_token() { [[ "${1-}" =~ ^[A-Za-z0-9_.:-]+$ ]]; }
require_timestamp() { [[ "${1-}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; }
rto_elapsed_allowed() { [[ "${1-}" =~ ^[0-9]+$ && "$1" -le 14400 ]]; }

verify_checksum() {
  local expected="${1-}" file="${2-}" actual
  require_digest "$expected" || { fail_state CHECKSUM_INVALID; return 1; }
  actual="$(sha256sum "$file" 2>/dev/null | awk '{print $1}')" || { fail_state CHECKSUM_READ_FAILED; return 1; }
  [[ "$actual" == "$expected" ]] || { fail_state CHECKSUM_MISMATCH; return 1; }
}
