import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const helperPath = path.resolve(import.meta.dirname, "../platform-infra/scripts/catering-production-evidence.sh");
function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }

export function runHelperWithActualRemote(mode: "complete" | "missing" | "contradictory" | "malformed" | "generation-swapped", supplied?: { root: string; nowEpoch?: number; repositoryId?: string }, options: { webMount?: string; edgeDataLabel?: string; timerCalendar?: string; aliases?: string; endpointNetworkId?: string; pythonSearchPath?: string } = {}): ReturnType<typeof spawnSync> {
  // Bind before fake PATH shadows python3. Setup failures must throw, since a
  // returned UNKNOWN could incorrectly satisfy a negative collector test.
  const pythonEnvironment = { ...process.env, PATH: options.pythonSearchPath ?? process.env.PATH ?? "" };
  const discover = spawnSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8", timeout: 10000, env: pythonEnvironment });
  const python = discover.status === 0 ? discover.stdout.trim() : "";
  if (!path.isAbsolute(python)) throw new Error("Collector fixture setup requires a usable Python 3 interpreter");
  const probe = spawnSync(python, ["-c", 'import datetime, os, stat, sys; assert sys.version_info.major == 3; assert callable(os.pread); datetime.datetime.fromisoformat("2026-09-04T00:00:00+00:00").timestamp(); print("catering-python3-ready")'], { encoding: "utf8", timeout: 10000, env: pythonEnvironment });
  if (probe.status !== 0 || probe.stdout.trim() !== "catering-python3-ready") throw new Error("Collector fixture setup requires a usable Python 3 interpreter");
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "catering-production-evidence-real-"));
  const bin = path.join(fixtureRoot, "bin");
  const stateRoot = supplied?.root ?? fixtureRoot;
  const snapshots = path.join(stateRoot, "snapshots");
  const receipts = path.join(stateRoot, "restore-receipts");
  const evidence = path.join(stateRoot, "catering-backup-evidence");
  const status = path.join(stateRoot, "catering-backup-repository-status");
  const repository = path.join(stateRoot, "repository");
  const password = path.join(stateRoot, "password");
  const statCount = path.join(fixtureRoot, "stat-count");
  const sshOutput = path.join(fixtureRoot, "ssh-output");
  const host = "fixture-host";
  const hostDigest = sha256(host);
  const scope = "postgres,sites,platform-caddy,shared-edge-caddy";
  const repositoryId = "b".repeat(64);
  const snapshotId = "a".repeat(64);
  const componentChecksum = "c".repeat(64);
  const secretReference = "d".repeat(64);
  const image = "registry.example/postgres@sha256:" + "e".repeat(64);
  const artifactPath = path.join(snapshots, "catering-backup-artifact-1");
  const receiptPath = path.join(receipts, "catering-restore-receipt-1");
  const createdAt = "2026-09-04T00:00:00Z";
  mkdirSync(bin, { recursive: true, mode: 0o700 });
  if (!supplied) {
    mkdirSync(snapshots, { mode: 0o700 });
    mkdirSync(receipts, { mode: 0o700 });
    const artifact = [
      "status=artifact", "scope=" + scope, "host_binding=" + hostDigest,
      "source_commit=" + "f".repeat(40), "source_tree=" + "1".repeat(40),
      "secret_recovery_reference_sha256=" + secretReference, "restore_postgres_image=" + image,
      "bundle_path=catering-backup-stream-1", "bundle_checksum=" + componentChecksum,
      "manifest_path=manifest", "manifest_checksum=" + componentChecksum,
      "postgres_dump_path=postgres_dump", "component_postgres_dump_checksum=" + componentChecksum,
      "component_caddy_stream_checksum=" + componentChecksum, "component_sites_checksum=" + componentChecksum,
      "component_platform_caddy_data_checksum=" + componentChecksum, "component_platform_caddy_config_checksum=" + componentChecksum,
      "component_shared_edge_caddyfile_checksum=" + componentChecksum, "component_shared_edge_caddy_data_checksum=" + componentChecksum,
      "component_shared_edge_caddy_config_checksum=" + componentChecksum, "",
    ].join("\n");
    const artifactChecksum = sha256(artifact);
    const receipt = [
      "status=restore-receipt", "version=1", "scope=" + scope, "host_binding=" + hostDigest,
      "snapshot_id=" + snapshotId, "repository_identity=" + repositoryId, "artifact_path=" + artifactPath,
      "artifact_checksum=" + artifactChecksum, "bundle_path=catering-backup-stream-1", "bundle_checksum=" + componentChecksum,
      "manifest_path=manifest", "manifest_checksum=" + componentChecksum, "secret_recovery_reference_sha256=" + secretReference,
      "restore_postgres_image=" + image, "component_sites_checksum=" + componentChecksum,
      "component_platform_caddy_data_checksum=" + componentChecksum, "component_platform_caddy_config_checksum=" + componentChecksum,
      "component_shared_edge_caddyfile_checksum=" + componentChecksum, "component_shared_edge_caddy_data_checksum=" + componentChecksum,
      "component_shared_edge_caddy_config_checksum=" + componentChecksum, "verified_at=" + createdAt, "",
    ].join("\n");
    const receiptChecksum = sha256(receipt);
    const evidenceText = [
      "status=success", "project=catering-agents-platform", "scope=" + scope, "host_binding=" + hostDigest,
      "created_at=" + createdAt, "snapshot_id=" + snapshotId, "checksum=" + artifactChecksum, "artifact_path=" + artifactPath,
      "artifact_snapshot_id=" + snapshotId, "artifact_checksum=" + artifactChecksum, "artifact_host_binding=" + hostDigest,
      "artifact_scope=" + scope, "artifact_created_at=" + createdAt, "repository_identity=" + repositoryId,
      "repository_status=read-only-verified", "receipt_path=" + receiptPath, "receipt_checksum=" + receiptChecksum,
      "secret_recovery_reference_sha256=" + secretReference, "restore_postgres_image=" + image,
      "component_sites_checksum=" + componentChecksum, "component_platform_caddy_data_checksum=" + componentChecksum,
      "component_platform_caddy_config_checksum=" + componentChecksum, "component_shared_edge_caddyfile_checksum=" + componentChecksum,
      "component_shared_edge_caddy_data_checksum=" + componentChecksum, "component_shared_edge_caddy_config_checksum=" + componentChecksum,
      "duration_seconds=100", "",
    ].join("\n");
    const statusText = "status=read-only-verified\nidentity=" + repositoryId + "\nhost_binding=" + hostDigest + "\nscope=" + scope + "\nverified_at=" + createdAt + "\n";
    writeFileSync(artifactPath, artifact, { mode: 0o600 });
    writeFileSync(receiptPath, receipt, { mode: 0o600 });
    writeFileSync(status, statusText, { mode: 0o600 });
    writeFileSync(repository, "s3:s3.example/catering\n", { mode: 0o600 });
    writeFileSync(password, "fixture-password\n", { mode: 0o600 });
    if (mode !== "missing") {
      const payload = mode === "contradictory" ? evidenceText.replace("scope=" + scope, "scope=wrong-scope") : mode === "malformed" ? evidenceText + "unknown_field=value\n" : evidenceText;
      writeFileSync(evidence, payload, { mode: 0o600 });
    }
  }
  const install = (name: string, body: string): void => writeFileSync(path.join(bin, name), body + "\n", { mode: 0o755 });
  install("ssh", `#!/usr/bin/env bash
set -uo pipefail
if /bin/bash -s -- "$FAKE_EXPECTED_PROJECT" "$FAKE_EVIDENCE_PATH" "$FAKE_STATUS_PATH" "$FAKE_REPOSITORY_FILE" "$FAKE_PASSWORD_FILE" >"$FAKE_SSH_OUTPUT" 2>/dev/null; then cat "$FAKE_SSH_OUTPUT"; exit 0; else rc=$?; cat "$FAKE_SSH_OUTPUT"; exit "$rc"; fi`);
  install("hostname", `#!/usr/bin/env bash
printf '%s\\n' fixture-host`);
  install("date", `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *"-d "*"+%s")
    if [[ "$FAKE_READER_SUPPLIED" != 1 ]]; then printf '1788476400\\n'; exit 0; fi
    "$FAKE_READER_PYTHON" -c 'import datetime,sys; print(int(datetime.datetime.fromisoformat(sys.argv[1].replace("Z","+00:00")).timestamp()))' "$3" ;;
  *+%s) printf '%s\\n' "$FAKE_READER_NOW" ;;
  *+%Y%m%dT%H%M%SZ) printf '20260904T000000Z\\n' ;;
  *) printf '2026-09-04T00:00:00Z\\n' ;;
esac`);
  install("stat", `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == -L ]]; then shift; fi
[[ "$1" == --format ]] || exit 1
"$FAKE_READER_PYTHON" - "$2" "$3" <<'PY'
import os, stat, sys
fmt, pathname = sys.argv[1:]
if pathname.startswith("/dev/fd/"):
    info = os.fstat(int(pathname.rsplit("/", 1)[1]))
else:
    info = os.stat(pathname)
kind = "regular file" if stat.S_ISREG(info.st_mode) else "directory" if stat.S_ISDIR(info.st_mode) else "fifo"
count_path = os.environ.get("FAKE_STAT_COUNT_FILE", "")
count = 0
if count_path:
    try:
        with open(count_path) as handle: count = int(handle.read() or "0")
    except FileNotFoundError: pass
    with open(count_path, "w") as handle: handle.write(str(count + 1))
device, inode = info.st_dev, info.st_ino
if os.environ.get("FAKE_STAT_SWAP_PATH") == pathname and count >= 2:
    inode += 1
values = {"%F": kind, "%a": format(stat.S_IMODE(info.st_mode), "o"), "%u": "0", "%g": "0", "%d": str(device), "%i": str(inode)}
for key, value in values.items(): fmt = fmt.replace(key, value)
print(fmt)
PY`);
  install("base64", `#!/usr/bin/env bash
set -euo pipefail
exec /usr/bin/base64 "$@"`);
  install("python3", `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == - ]]; then
  script="$(/bin/cat)"
  if [[ "$script" == *socket.getaddrinfo* ]]; then
    [[ "$FAKE_RESOLVE_MODE" == private ]] && exit 1
    exit 0
  fi
  printf '%s' "$script" | "$FAKE_READER_PYTHON" "$@"
else
  exec "$FAKE_READER_PYTHON" "$@"
fi`);
  install("restic", `#!/usr/bin/env bash
set -euo pipefail
repo_fd= pass_fd=
while [[ "$1" == --repository-file || "$1" == --password-file ]]; do
  [[ "$2" == /proc/self/fd/* ]] || exit 31
  if [[ "$1" == --repository-file ]]; then repo_fd="$(/usr/bin/basename "$2")"; else pass_fd="$(/usr/bin/basename "$2")"; fi
  shift 2
done
[[ -n "$repo_fd" && -n "$pass_fd" ]] || exit 32
[[ -e "/proc/self/fd/$repo_fd" || -e "/dev/fd/$repo_fd" ]] || exit 33
# Read through the inherited descriptors without advancing their shared offset;
# every Restic invocation must observe the same preflight-bound file generation.
repo_value="$("$FAKE_READER_PYTHON" -c 'import os,sys; sys.stdout.write(os.pread(int(sys.argv[1]), 65536, 0).decode())' "$repo_fd")"
pass_value="$("$FAKE_READER_PYTHON" -c 'import os,sys; sys.stdout.write(os.pread(int(sys.argv[1]), 65536, 0).decode())' "$pass_fd")"
[[ "$repo_value" == s3:s3.example/catering ]] || exit 34
[[ -n "$pass_value" ]] || exit 35
case "$1" in
  cat) printf '{"id":"%s"}\\n' "$FAKE_READER_REPOSITORY_ID" ;;
  snapshots) printf '[{"id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]\\n' ;;
  *) exit 36 ;;
esac`);
  install("docker", `#!/usr/bin/env bash
set -euo pipefail
project_id=1111111111111111111111111111111111111111111111111111111111111111
edge_id=2222222222222222222222222222222222222222222222222222222222222222
postgres_id=3333333333333333333333333333333333333333333333333333333333333333
platform_data=/srv/platform-caddy-data
platform_config=/srv/platform-caddy-config
edge_data=/srv/shared-edge-caddy-data
edge_config=/srv/shared-edge-caddy-config
case "$1" in
  ps)
    if [[ "$*" == *"no-trunc"* && "$*" == *"service=web"* ]]; then printf '%s\\n' "$project_id"
    elif [[ "$*" == *"no-trunc"* && "$*" == *"service=edge"* ]]; then printf '%s\\n' "$edge_id"
    elif [[ "$*" == *"label=com.docker.compose.project=platform-infra"* ]]; then printf 'platform-infra-postgres-1\\nplatform-infra-web-1\\n'; fi ;;
  inspect)
    format= target= expect_format=false
    for arg in "$@"; do
      target="$arg"
      if [[ "$expect_format" == true ]]; then format="$arg"; expect_format=false; elif [[ "$arg" == --format ]]; then expect_format=true; fi
    done
    [[ "$target" == platform-infra-web-1 ]] && target="$project_id"
    case "$format" in
      *'%t'*)
        if [[ "$target" == "$project_id" ]]; then
          printf 'volume:platform-infra_caddy_data:%s:/data:true\\n' "$platform_data"
          printf 'volume:platform-infra_caddy_config:%s:/config:true\\n' "$platform_config"
          printf 'bind::/opt/catering-agents-platform/platform-infra/sites:/etc/caddy/sites:false\\n'
        else
          printf 'volume:shared-edge_edge_caddy_data:%s:/data:true\\n' "$edge_data"
          printf 'volume:shared-edge_edge_caddy_config:%s:/config:true\\n' "$edge_config"
          printf 'bind::/opt/shared-edge/Caddyfile:/etc/caddy/Caddyfile:false\\n'
        fi ;;
      *'.NetworkSettings.Networks'*)
        expected_aliases='{{with index .NetworkSettings.Networks "platform-infra_default"}}{{printf "%s:%s" .NetworkID (join .Aliases ",")}}{{end}}'
        [[ "$format" == "$expected_aliases" && "$target" == "$project_id" ]] || exit 49
        printf '%s:%s\\n' "$FAKE_ENDPOINT_NETWORK_ID" "$FAKE_MEMBER_ALIASES" ;;
      *'.Id'*'.Config.Image'*)
        if [[ "$target" == "$project_id" ]]; then printf '%s:0:running:caddy:2-alpine\\n' "$project_id"; else printf '%s:0:running:postgres:latest\\n' "$postgres_id"; fi ;;
      *'.Mounts'*)
        if [[ "$target" == "$project_id" ]]; then
          printf 'volume:platform-infra_caddy_data:%s:/data\\n' "$platform_data"
          printf 'volume:platform-infra_caddy_config:%s:/config\\n' "$platform_config"
          printf '%s\\n' "$FAKE_WEB_MOUNT"
        else printf 'volume:platform-infra_postgres_data:/srv/postgres:/var/lib/postgresql/data\\n'; fi ;;
      *'.Name'*) [[ "$target" == "$project_id" ]] && printf '/platform-infra-web-1\\n' || printf '/shared-edge-edge-1\\n' ;;
      *'compose.project'*) [[ "$target" == "$project_id" ]] && printf 'platform-infra\\n' || printf 'shared-edge\\n' ;;
      *'compose.service'*)
        if [[ "$target" == "$project_id" ]]; then printf 'web\\n'; elif [[ "$target" == "$edge_id" ]]; then printf 'edge\\n'; else printf 'postgres\\n'; fi ;;
      *'.State.Status'*) printf 'running\\n' ;;
      *'State.Health'*) printf 'healthy\\n' ;;
      *'Config.Env'*)
        expected_env='{{range .Config.Env}}{{if eq (index (split . "=") 0) "CATERING_DATA_ROOT"}}{{println .}}{{end}}{{end}}'
        [[ "$format" == "$expected_env" ]] || exit 48
        if [[ "$target" != "$project_id" ]]; then printf 'CATERING_DATA_ROOT=/var/lib/postgresql/data\\n'; fi ;;
      *) exit 41 ;;
    esac ;;
  volume)
    if [[ "$2" == ls ]]; then
      if [[ "$*" == *'project=shared-edge'* ]]; then printf 'shared-edge_edge_caddy_data\\nshared-edge_edge_caddy_config\\n'
      else printf 'platform-infra_postgres_data\\nplatform-infra_caddy_data\\nplatform-infra_caddy_config\\n'; fi
    else
      format= target= expect_format=false
      for arg in "$@"; do
        target="$arg"
        if [[ "$expect_format" == true ]]; then format="$arg"; expect_format=false; elif [[ "$arg" == --format ]]; then expect_format=true; fi
      done
      if [[ "$format" == *'printf "%s:%s:%s"'* ]]; then
        case "$target" in
          platform-infra_postgres_data) printf 'platform-infra_postgres_data:local:/srv/postgres\\n' ;;
          platform-infra_caddy_data) printf 'platform-infra_caddy_data:local:%s\\n' "$platform_data" ;;
          platform-infra_caddy_config) printf 'platform-infra_caddy_config:local:%s\\n' "$platform_config" ;;
          shared-edge_edge_caddy_data) printf 'shared-edge_edge_caddy_data:local:%s\\n' "$edge_data" ;;
          shared-edge_edge_caddy_config) printf 'shared-edge_edge_caddy_config:local:%s\\n' "$edge_config" ;;
          *) exit 42 ;;
        esac
      elif [[ "$format" == *'Mountpoint'* ]]; then
        case "$target" in
          platform-infra_caddy_data) printf '%s\\n' "$platform_data" ;;
          platform-infra_caddy_config) printf '%s\\n' "$platform_config" ;;
          shared-edge_edge_caddy_data) printf '%s\\n' "$edge_data" ;;
          shared-edge_edge_caddy_config) printf '%s\\n' "$edge_config" ;;
          platform-infra_postgres_data) printf '/srv/postgres\\n' ;;
          *) exit 42 ;;
        esac
      elif [[ "$format" == *'Labels'* ]]; then
        case "$target" in
          platform-infra_caddy_data) printf 'platform-infra_caddy_data|platform-infra|caddy_data\\n' ;;
          platform-infra_caddy_config) printf 'platform-infra_caddy_config|platform-infra|caddy_config\\n' ;;
          shared-edge_edge_caddy_data) printf 'shared-edge_edge_caddy_data|shared-edge|%s\\n' "$FAKE_EDGE_DATA_LABEL" ;;
          shared-edge_edge_caddy_config) printf 'shared-edge_edge_caddy_config|shared-edge|edge_caddy_config\\n' ;;
          *) exit 43 ;;
        esac
      else
        case "$target" in
          platform-infra_postgres_data) printf 'platform-infra_postgres_data:local:/srv/postgres\\n' ;;
          *) exit 44 ;;
        esac
      fi
    fi ;;
  network)
    if [[ "$2" == ls ]]; then
      printf 'platform-infra_default\\n'
    elif [[ "$2" == inspect && "$3" == --format && "$5" == platform-infra_default ]]; then
      if [[ "$4" == '{{printf "%s:%s:%s:%s" .Name .Id .Driver .Scope}}' ]]; then
        printf 'platform-infra_default:4444444444444444444444444444444444444444444444444444444444444444:bridge:local\\n'
      elif [[ "$4" == '{{range $id, $container := .Containers}}{{printf "%s:%s" $id $container.Name}}{{"\\n"}}{{end}}' ]]; then
        printf '%s:platform-infra-web-1\\n' "$project_id"
      else exit 45; fi
    else exit 45; fi ;;

  *) exit 46 ;;
esac`);
  install("systemctl", `#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  show)
    if [[ "$*" == *TimersCalendar* ]]; then printf 'Id=catering-backup.timer\\nLoadState=loaded\\nActiveState=active\\nUnit=catering-backup.service\\nTimersCalendar=%s\\n' "$FAKE_TIMER_CALENDAR"
    else printf 'Id=catering-backup.service\\nLoadState=loaded\\nActiveState=active\\nSubState=running\\nExecMainStatus=0\\n'; fi ;;
  is-active) printf 'active\\n' ;;
  list-unit-files) printf 'catering-backup.service enabled\\n' ;;
  *) exit 47 ;;
esac`);
  for (const commandName of ["findmnt", "mount", "ss", "realpath", "readlink", "find"]) {
    install(commandName, "#!/usr/bin/env bash\nexit 0");
  }
  const run = spawnSync(process.env.CATERING_EVIDENCE_TEST_BASH ?? "bash", [helperPath], {
    encoding: "utf8",
    // Bash 3.2 on macOS starts one bounded fake command per record; keep a
    // finite guard while allowing the complete quoted heredoc to finish.
    timeout: 120000,
    env: {
      ...process.env,
      PATH: bin + ":" + (process.env.PATH ?? ""),
      CATERING_EVIDENCE_SSH_KEY: "fixture-key",
      CATERING_EVIDENCE_SSH_KNOWN_HOSTS: "fixture-known-hosts",
      HETZNER_DEPLOY_HOST: "fixture.invalid",
      HETZNER_DEPLOY_USER: "fixture-user",
      FAKE_EXPECTED_PROJECT: "catering-agents-platform",
      FAKE_EVIDENCE_PATH: evidence,
      FAKE_STATUS_PATH: status,
      FAKE_REPOSITORY_FILE: repository,
      FAKE_PASSWORD_FILE: password,
      FAKE_STAT_COUNT_FILE: statCount,
      FAKE_STAT_SWAP_PATH: mode === "generation-swapped" ? evidence : "",
      FAKE_RESOLVE_MODE: "public",
      FAKE_EDGE_DATA_LABEL: options.edgeDataLabel ?? "edge_caddy_data",
      FAKE_ENDPOINT_NETWORK_ID: options.endpointNetworkId ?? "4".repeat(64),
      FAKE_MEMBER_ALIASES: options.aliases ?? "web,platform-infra-web-1",
      FAKE_TIMER_CALENDAR: options.timerCalendar ?? "{ OnCalendar=*-*-* 00,06,12,18:00:00 UTC ; next_elapse=Fri 2026-09-04 06:00:00 UTC }",
      FAKE_WEB_MOUNT: options.webMount ?? "bind::/opt/catering-agents-platform/platform-infra/sites:/etc/caddy/sites",
      FAKE_READER_SUPPLIED: supplied ? "1" : "0",
      FAKE_READER_PYTHON: python,
      FAKE_READER_NOW: String(supplied?.nowEpoch ?? 1788480000),
      FAKE_READER_REPOSITORY_ID: supplied?.repositoryId ?? repositoryId,
      FAKE_SSH_OUTPUT: sshOutput,
    },
  });
  spawnSync("/usr/bin/trash", [fixtureRoot], { stdio: "ignore" });
  return run;
}
