#!/usr/bin/env python3
import os
import pty
import select
import shlex
import signal
import termios
import time

EXPECTED_SOURCE_COMMIT = "5b2c77089e7fd9051b4a55e38240cd69d6e9ed99"
EXPECTED_RUNTIME_IMAGE = "sha256:778c2daadc272666192a1212095275c1cafb5bdb4b0845f49ce16312207050b2"

def required_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise SystemExit(f"missing required environment: {name}")
    return value

def main() -> int:
    if required_env("DEPLOY_COMMIT_SHA") != EXPECTED_SOURCE_COMMIT:
        raise SystemExit("unexpected source commit")

    host = required_env("CATERING_TARGET_DEPLOY_HOST")
    user = required_env("CATERING_TARGET_DEPLOY_USER")
    key_file = required_env("CATERING_TARGET_SSH_KEY_FILE")
    known_hosts = required_env("CATERING_TARGET_SSH_KNOWN_HOSTS_FILE")
    login_code = required_env("CATERING_TARGET_SMOKE_LOGIN_CODE")
    pin = required_env("CATERING_TARGET_SMOKE_PIN")

    if "\n" in login_code or "\r" in login_code or not (1 <= len(login_code) <= 128):
        raise SystemExit("invalid smoke login code shape")
    if login_code.startswith("--"):
        raise SystemExit("invalid smoke login code shape")
    if not (len(pin) == 6 and pin.isascii() and pin.isdigit()):
        raise SystemExit("invalid smoke PIN shape")

    remote_script = r'''
set -euo pipefail
lock=/opt/catering-target-update.lock
runtime_image=sha256:778c2daadc272666192a1212095275c1cafb5bdb4b0845f49ce16312207050b2
postgres=platform-infra-postgres-1
intake=platform-infra-intake-1
stage=precheck

fail() {
  printf 'TARGET_SMOKE_RECOVERY_FAIL stage=%s\n' "$stage"
  exit 1
}

stty -echo || fail
sudo -n test -d "$lock" || fail
sudo -n test ! -L "$lock" || fail
[[ "$(sudo -n realpath -e -- "$lock")" == "$lock" ]] || fail
[[ "$(sudo -n stat -c '%a' "$lock")" == "700" ]] || fail
sudo -n test -f "$lock/owner" || fail
sudo -n test ! -L "$lock/owner" || fail
[[ "$(sudo -n stat -c '%a' "$lock/owner")" == "600" ]] || fail

lock_stat="$(sudo -n stat -c '%d:%i:%a:%u:%g' "$lock")" || fail
owner_stat="$(sudo -n stat -c '%d:%i:%a:%u:%g' "$lock/owner")" || fail
owner_digest="$(sudo -n sha256sum "$lock/owner" | awk '{print $1}')" || fail
[[ "$owner_digest" =~ ^[0-9a-f]{64}$ ]] || fail
[[ "$(sudo -n grep -c '^owner_token=' "$lock/owner")" == "1" ]] || fail
owner_token="$(sudo -n sed -n 's/^owner_token=//p' "$lock/owner")" || fail
[[ -n "$owner_token" && "$owner_token" != *$'\n'* && "$owner_token" != *$'\r'* ]] || fail

schema_version="$(sudo -n docker exec "$postgres" psql --no-psqlrc --no-password -U catering -d catering_agents --tuples-only --no-align --command="SELECT version_number FROM catering_schema_migrations WHERE unit_name='catering_business_records'" | tr -d '[:space:]')" || fail
[[ "$schema_version" == "3" ]] || fail
auth_users_before="$(sudo -n docker exec "$postgres" psql --no-psqlrc --no-password -U catering -d catering_agents --tuples-only --no-align --command="SELECT count(*) FROM catering_business_records WHERE collection_name='auth/users'" | tr -d '[:space:]')" || fail
[[ "$auth_users_before" == "0" ]] || fail
sudo -n docker image inspect "$runtime_image" >/dev/null || fail

mapfile -t db_lines < <(sudo -n docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$intake" | grep '^CATERING_DATABASE_URL=')
mapfile -t business_lines < <(sudo -n docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$intake" | grep '^CATERING_DEFAULT_BUSINESS_ID=')
[[ "${#db_lines[@]}" == "1" && "${#business_lines[@]}" == "1" ]] || fail
database_url="${db_lines[0]#CATERING_DATABASE_URL=}"
business_id="${business_lines[0]#CATERING_DEFAULT_BUSINESS_ID=}"
[[ -n "$database_url" && "$business_id" == "the-one" ]] || fail

printf 'TARGET_SMOKE_RECOVERY_PRECHECK_OK schema_version=3 auth_users=0 runtime_present=true lock=retained\n'
printf 'TARGET_SMOKE_LOGIN_READY\n'
IFS= read -r login_code || fail
[[ -n "$login_code" && "${#login_code}" -le 128 && "$login_code" != --* ]] || fail

stage=create
if ! sudo -n docker run --rm -it --pull never --network catering_private \
  -e "CATERING_DATABASE_URL=$database_url" \
  -e "CATERING_DEFAULT_BUSINESS_ID=$business_id" \
  "$runtime_image" \
  /bin/sh -eu -c '
    stty -echo
    printf "TARGET_SMOKE_PIN_READY\n"
    exec ./node_modules/.bin/tsx scripts/manage-catering-user.ts create \
      --login-code "$1" \
      --display-name "Release Smoke" \
      --role read_only_operator
  ' bootstrap "$login_code"
then
  fail
fi

stage=verify
schema_after="$(sudo -n docker exec "$postgres" psql --no-psqlrc --no-password -U catering -d catering_agents --tuples-only --no-align --command="SELECT version_number FROM catering_schema_migrations WHERE unit_name='catering_business_records'" | tr -d '[:space:]')" || fail
[[ "$schema_after" == "3" ]] || fail
auth_users_after="$(sudo -n docker exec "$postgres" psql --no-psqlrc --no-password -U catering -d catering_agents --tuples-only --no-align --command="SELECT count(*) FROM catering_business_records WHERE collection_name='auth/users'" | tr -d '[:space:]')" || fail
[[ "$auth_users_after" == "1" ]] || fail
verdict="$(sudo -n docker exec "$postgres" psql --no-psqlrc --no-password -U catering -d catering_agents --tuples-only --no-align --command="SELECT CASE WHEN count(*) = 1 AND bool_and(payload->>'schemaVersion'='1.0') AND bool_and(payload->>'displayName'='Release Smoke') AND bool_and(payload->>'role'='read_only_operator') AND bool_and(payload->>'active'='true') AND bool_and(payload->>'businessId'=business_id) AND bool_and(payload->>'authEpoch'='0') AND bool_and(payload->>'failedLoginCount'='0') AND bool_and(payload->>'version'='0') THEN 'ok' ELSE 'fail' END FROM catering_business_records WHERE collection_name='auth/users'" | tr -d '[:space:]')" || fail
[[ "$verdict" == "ok" ]] || fail

stage=unlock
[[ "$(sudo -n stat -c '%d:%i:%a:%u:%g' "$lock")" == "$lock_stat" ]] || fail
[[ "$(sudo -n stat -c '%d:%i:%a:%u:%g' "$lock/owner")" == "$owner_stat" ]] || fail
[[ "$(sudo -n sha256sum "$lock/owner" | awk '{print $1}')" == "$owner_digest" ]] || fail
sudo -n grep -Fxq "owner_token=$owner_token" "$lock/owner" || fail
sudo -n unlink "$lock/owner" || fail
sudo -n rmdir "$lock" || fail
sudo -n test ! -e "$lock" || fail
printf 'TARGET_SMOKE_BOOTSTRAP_OK schema_version=3 auth_users=1 role=read_only_operator lock_released=true\n'
'''

    remote_command = "bash -c " + shlex.quote(remote_script)
    ssh_argv = [
        "ssh", "-tt",
        "-i", key_file,
        "-o", "BatchMode=yes",
        "-o", "IdentitiesOnly=yes",
        "-o", "StrictHostKeyChecking=yes",
        "-o", f"UserKnownHostsFile={known_hosts}",
        "-o", "ConnectTimeout=10",
        "-p", "22",
        f"{user}@{host}",
        remote_command,
    ]

    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(ssh_argv[0], ssh_argv)

    attrs = termios.tcgetattr(fd)
    attrs[3] &= ~termios.ECHO
    termios.tcsetattr(fd, termios.TCSANOW, attrs)

    captured = bytearray()
    login_ready = pin_ready = login_sent = pin_sent = final_ok = False
    deadline = time.monotonic() + 180
    child_status = None

    try:
        while time.monotonic() < deadline:
            readable, _, _ = select.select([fd], [], [], 0.2)
            if fd in readable:
                try:
                    chunk = os.read(fd, 4096)
                except OSError:
                    chunk = b""
                if chunk:
                    captured.extend(chunk)
                    login_ready = login_ready or b"TARGET_SMOKE_LOGIN_READY" in captured
                    if login_ready and not login_sent:
                        os.write(fd, login_code.encode("utf-8") + b"\n")
                        login_sent = True
                    pin_ready = pin_ready or b"TARGET_SMOKE_PIN_READY" in captured
                    if pin_ready and not pin_sent:
                        os.write(fd, pin.encode("ascii") + b"\n")
                        pin_sent = True
                    final_ok = final_ok or b"TARGET_SMOKE_BOOTSTRAP_OK" in captured
                else:
                    waited, status = os.waitpid(pid, os.WNOHANG)
                    if waited == pid:
                        child_status = status
                    else:
                        _, child_status = os.waitpid(pid, 0)
                    break
            waited, status = os.waitpid(pid, os.WNOHANG)
            if waited == pid:
                child_status = status
                break

        if child_status is None:
            os.kill(pid, signal.SIGKILL)
            _, child_status = os.waitpid(pid, 0)
            raise SystemExit("target smoke recovery timed out")
    finally:
        try:
            os.close(fd)
        except OSError:
            pass

    rc = os.WEXITSTATUS(child_status) if os.WIFEXITED(child_status) else 255
    pin_echo = pin.encode("ascii") in captured
    success_marker = b'"status":"success"' in captured
    error_marker = b'"status":"error"' in captured
    precheck_ok = b"TARGET_SMOKE_RECOVERY_PRECHECK_OK" in captured
    fail_marker = b"TARGET_SMOKE_RECOVERY_FAIL" in captured
    stage = "none"
    for candidate in ("precheck", "create", "verify", "unlock"):
        if f"TARGET_SMOKE_RECOVERY_FAIL stage={candidate}".encode("ascii") in captured:
            stage = candidate

    print(
        "TARGET_SMOKE_RECOVERY_CLIENT "
        f"rc={rc} precheck_ok={str(precheck_ok).lower()} "
        f"login_ready={str(login_ready).lower()} login_sent={str(login_sent).lower()} "
        f"pin_ready={str(pin_ready).lower()} pin_sent={str(pin_sent).lower()} "
        f"pin_echo={str(pin_echo).lower()} admin_success={str(success_marker).lower()} "
        f"admin_error={str(error_marker).lower()} final_ok={str(final_ok).lower()} "
        f"remote_fail={str(fail_marker).lower()} remote_stage={stage}"
    )

    if rc != 0 or not precheck_ok or not login_sent or not pin_sent:
        return 1
    if pin_echo or error_marker or not success_marker or not final_ok or fail_marker:
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
