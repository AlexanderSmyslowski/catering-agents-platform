import { runHelperWithActualRemote } from "./catering-backup-collector-fixture.js";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

const files = {
  common: "platform-infra/backup/catering-backup-common.sh",
  backup: "platform-infra/backup/catering-backup.sh",
  restore: "platform-infra/backup/catering-restore-probe.sh",
  service: "platform-infra/backup/catering-backup.service",
  timer: "platform-infra/backup/catering-backup.timer",
  restoreService: "platform-infra/backup/catering-restore-probe.service",
  env: "platform-infra/backup/catering-backup.env.example",
  runbook: "docs/operations/CATERING_BACKUP_RESTORE.md",
} as const;

function source(relativePath: string): string {
  const absolute = path.join(repoRoot, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function executableLines(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

function syntax(relativePath: string): ReturnType<typeof spawnSync> {
  return spawnSync("bash", ["-n", path.join(repoRoot, relativePath)], {
    encoding: "utf8",
  });
}

function runShell(script: string, env: NodeJS.ProcessEnv = {}): ReturnType<typeof spawnSync> {
  return spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function removeFixture(pathname: string): void {
  spawnSync("/usr/bin/trash", [pathname], { stdio: "ignore" });
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function createBackupEntrypointFixture() {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-entrypoint-"));
    const fakeBin = path.join(root, "bin");
    mkdirSync(fakeBin, { mode: 0o700 });
    const fakeVolumeRoot = path.join(root, "volumes");
    for (const volume of ["platform-infra_caddy_data", "platform-infra_caddy_config", "shared-edge_edge_caddy_data", "shared-edge_edge_caddy_config"]) {
      mkdirSync(path.join(fakeVolumeRoot, volume, "_data"), { recursive: true, mode: 0o700 });
    }
    const logPath = path.join(root, "commands.log");
    const repositoryFile = path.join(root, "repository");
    const passwordFile = path.join(root, "password");
    writeFileSync(repositoryFile, "s3:s3.example/catering\n", { mode: 0o600 });
    writeFileSync(passwordFile, "fixture-password\n", { mode: 0o600 });
    const offhostAttestation = path.join(root, "offhost-attestation");
    const secretAttestation = path.join(root, "secret-attestation");
    const hostname = String(spawnSync("hostname", ["-s"], { encoding: "utf8" }).stdout).trim();
    const hostDigest = createHash("sha256").update(hostname).digest("hex");
    const productionAddressesDigest = sha256("1.1.1.1");
    const productionAddresses = "1.1.1.1";
    const secretSourceType = "offline_vault";
    const secretSourceReference = "offline_vault:/recovery/catering-v1";
    const secretSchema = "operator-secret-schema-v2|restic_encryption_password,offhost_repository_access,POSTGRES_PASSWORD,CATERING_TRUSTED_ACTOR_SECRET,CATERING_BASIC_AUTH_PASSWORD_HASH";
    const secretReference = sha256(secretSourceReference);
    const secretSchemaDigest = sha256(secretSchema);
    const offhostAttestationText = `status=operator_attested\nlocator_digest=${sha256("s3:s3.example/catering")}\nendpoint_host=s3.example\nresolved_addresses_digest=${sha256("8.8.8.8")}\nproduction_addresses=${productionAddresses}\nproduction_external_addresses=none\nproduction_addresses_digest=${productionAddressesDigest}\nrepository_identity=${"b".repeat(64)}\nhost_binding=${hostDigest}\nproduction_host_binding=${hostDigest}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=2026-09-04T00:00:00Z\nvalid_until=2026-09-05T00:00:00Z\nattestation_id=${"a".repeat(64)}\n`;
    const secretAttestationText = `status=operator_attested\nsource_type=${secretSourceType}\nsource_reference=${secretSourceReference}\nsource_reference_digest=${secretReference}\nrequired_secret_schema_digest=${secretSchemaDigest}\nrepository_identity=${"b".repeat(64)}\nhost_binding=${hostDigest}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=2026-09-04T00:00:00Z\nvalid_until=2026-09-05T00:00:00Z\nattestation_id=${"f".repeat(64)}\n`;
    writeFileSync(offhostAttestation, offhostAttestationText, { mode: 0o600 });
    writeFileSync(secretAttestation, secretAttestationText, { mode: 0o600 });
    const previousEvidence = path.join(root, "catering-backup-evidence");
    const previousEvidenceBytes = "status=success\nchecksum=old\n";
    writeFileSync(previousEvidence, previousEvidenceBytes, { mode: 0o600 });
    const pointer = path.join(root, "catering-backup-candidate");
    const fakeTar = path.join(root, "fake-stream.tar");
    const fakeTarResult = spawnSync("python3", ["-c", "import io,tarfile,sys; out=sys.argv[1]; dirs=['components','components/sites','components/platform_caddy_data','components/platform_caddy_config','components/shared_edge_caddy_data','components/shared_edge_caddy_config']; files={'manifest':b'manifest\\n','postgres_dump':b'PGDUMP-FIXTURE\\n','components/shared_edge_caddyfile':b'caddy\\n'}; files.update({f'{name}/marker':name.encode()+b'\\n' for name in dirs[1:]}); archive=tarfile.open(out,'w'); [archive.addfile((lambda i: (setattr(i,'type',tarfile.DIRTYPE),setattr(i,'mode',0o700),i)[-1])(tarfile.TarInfo(name))) for name in dirs]; [archive.addfile((lambda i: (setattr(i,'size',len(data)),setattr(i,'mode',0o600),i)[-1])(tarfile.TarInfo(name)),io.BytesIO(data)) for name,data in files.items()]; archive.close()", fakeTar], { encoding: "utf8" });
    expect(fakeTarResult.status, String(fakeTarResult.stderr)).toBe(0);
    const install = (name: string, lines: string[]): void => {
      writeFileSync(path.join(fakeBin, name), `${lines.join("\n")}\n`, { mode: 0o755 });
    };
    install("python3", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "if [[ \"${1-}\" == \"-\" ]]; then",
      "  source_code=\"$(/usr/bin/python3 -c 'import sys; print(sys.stdin.read(), end=\"\")')\"",
      "  if [[ \"$source_code\" == *\"parts = root.strip\"* && \"$source_code\" == *\"os.mkdir(root\"* ]]; then exit 0; fi",
      "  if [[ \"$source_code\" == *'labels = (\"sites\",'* ]]; then",
      "    count=0",
      "    [[ -f \"${FAKE_CADDY_CAPTURE_COUNT:-}\" ]] && count=$(<\"$FAKE_CADDY_CAPTURE_COUNT\")",
      "    count=$((count + 1))",
      "    [[ -n \"${FAKE_CADDY_CAPTURE_COUNT:-}\" ]] && printf '%s' \"$count\" >\"$FAKE_CADDY_CAPTURE_COUNT\"",
      "    if [[ \"${FAKE_CADDY_CAPTURE_SWAP:-0}\" == 1 && \"$count\" -ge 2 ]]; then",
      "      mutated_root=\"${3-}\"",
      "      if [[ -d \"$mutated_root\" ]]; then printf 'generation-two\\n' >\"$mutated_root/marker\"; chmod 600 \"$mutated_root/marker\"; fi",
      "      printf 'caddy-generation-swapped\\n'",
      "    else",
      "      printf 'caddy-generation-stable\\n'",
      "    fi",
      "    exit 0",
      "  fi",
      "  if [[ \"$source_code\" == *'mode=\"w|\"'* ]]; then printf 'CADDY-STREAM-FIXTURE\\n'; exit 0; fi",
      "  printf '%s' \"$source_code\" | /usr/bin/python3 - \"${@:2}\"",
      "else",
      "  exec /usr/bin/python3 \"$@\"",
      "fi",
    ]);
    install("stat", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "last=\"\"",
      "for arg in \"$@\"; do last=\"$arg\"; done",
      "printf 'stat %s\\n' \"$*\" >> \"$FAKE_LOG\"",
      "if [[ \"${1-}\" == \"-c\" && ( \"$last\" == \"$CATERING_REPOSITORY_FILE\" || \"$last\" == \"$CATERING_PASSWORD_FILE\" ) ]]; then",
      "  printf 'regular file:600:0\\n'; exit 0",
      "fi",
      "exec /usr/bin/stat \"$@\"",
    ]);
    install("docker", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf 'docker %s\\n' \"$*\" >> \"$FAKE_LOG\"",
      "web_id=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "edge_id=9999999999999999999999999999999999999999999999999999999999999999",
      "case \"${1-}\" in",
      "  ps) if [[ \"$*\" == *'service=postgres'* ]]; then printf 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\\n'; elif [[ \"$*\" == *'service=web'* ]]; then printf '%s\\n' \"$web_id\"; elif [[ \"$*\" == *'service=edge'* ]]; then printf '%s\\n' \"$edge_id\"; else exit 1; fi ;;",
      "  inspect)",
      "    container=\"${@: -1}\"",
      "    if [[ \"$container\" == \"$web_id\" || \"$container\" == \"$edge_id\" ]]; then",
      "      if [[ \"$container\" == \"$web_id\" ]]; then caddy_name=/platform-infra-web-1; caddy_project=platform-infra; caddy_service=web; caddy_mounts=\"volume|platform-infra_caddy_data|$FAKE_VOLUME_ROOT/platform-infra_caddy_data/_data|/data|true\\nvolume|platform-infra_caddy_config|$FAKE_VOLUME_ROOT/platform-infra_caddy_config/_data|/config|true\\nbind||/opt/catering-agents-platform/platform-infra/sites|/etc/caddy/sites|false\"; else caddy_name=/shared-edge-edge-1; caddy_project=shared-edge; caddy_service=edge; caddy_mounts=\"volume|shared-edge_edge_caddy_data|$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_data/_data|/data|true\\nvolume|shared-edge_edge_caddy_config|$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_config/_data|/config|true\\nbind||/opt/shared-edge/Caddyfile|/etc/caddy/Caddyfile|false\"; fi",
      "      case \"$*\" in",
      "        *'.Id'*) printf '%s\\n' \"$container\" ;;",
      "        *'.Mounts'*) printf '%b\\n' \"$caddy_mounts\" ;;",
      "        *'.Name'*) printf '%s\\n' \"$caddy_name\" ;;",
      "        *'compose.project'*) printf '%s\\n' \"$caddy_project\" ;;",
      "        *'compose.service'*) printf '%s\\n' \"$caddy_service\" ;;",
      "        *'.State.Status'*) printf 'running\\n' ;;",
      "        *'.State.Health'*) printf 'healthy\\n' ;;",
      "        *) exit 1 ;;",
      "      esac",
      "      exit 0",
      "    fi",
      "    case \"$*\" in",
      "      *'.Id'*) printf 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\\n' ;;",
      "      *'.Mounts'*) printf 'volume|platform-infra_postgres_data|/var/lib/postgresql/data|true\\n' ;;",
      "      *'.Name'*) printf '/platform-infra-postgres-1\\n' ;;",
      "      *'RepoDigests'*) printf 'registry.example/postgres@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\\n' ;;",
      "      *'.Image'*) printf 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\\n' ;;",
      "      *'Config.Image'*) printf 'postgres:17-alpine\\n' ;;",
      "      *'.State.Status'*) printf 'running\\n' ;;",
      "      *'.State.Health.Status'*) printf 'healthy\\n' ;;",
      "      *'compose.project'*) printf 'platform-infra\\n' ;;",
      "      *'compose.service'*) printf 'postgres\\n' ;;",
      "      *'container-number'*) printf '1\\n' ;;",
      "      *'Config.Env'*) printf 'POSTGRES_DB=catering_agents\\nPOSTGRES_USER=catering\\n' ;;",
      "      *) exit 1 ;;",
      "    esac ;;",
      "  volume) volume=\"${@: -1}\"; case \"$volume\" in platform-infra_postgres_data) printf 'platform-infra_postgres_data|platform-infra|postgres_data\\n' ;; platform-infra_caddy_data) printf 'platform-infra_caddy_data|platform-infra|caddy_data|%s\\n' \"$FAKE_VOLUME_ROOT/$volume/_data\" ;; platform-infra_caddy_config) printf 'platform-infra_caddy_config|platform-infra|caddy_config|%s\\n' \"$FAKE_VOLUME_ROOT/$volume/_data\" ;; shared-edge_edge_caddy_data) printf 'shared-edge_edge_caddy_data|shared-edge|edge_caddy_data|%s\\n' \"$FAKE_VOLUME_ROOT/$volume/_data\" ;; shared-edge_edge_caddy_config) printf 'shared-edge_edge_caddy_config|shared-edge|edge_caddy_config|%s\\n' \"$FAKE_VOLUME_ROOT/$volume/_data\" ;; *) exit 1 ;; esac ;;",
      "  image) printf 'registry.example/postgres@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\\n' ;;",
      "  exec) printf 'PGDUMP-FIXTURE\\n' ;;",
      "  *) exit 1 ;;",
      "esac",
    ]);
    install("tar", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf 'tar %s\\n' \"$*\" >> \"$FAKE_LOG\"",
      "output=\"\"",
      "while [[ $# -gt 0 ]]; do",
      "  if [[ \"$1\" == \"--file\" ]]; then output=\"$2\"; shift 2; else shift; fi",
      "done",
      "[[ -n \"$output\" ]]",
      "if [[ \"$output\" == - ]]; then printf 'CADDY-STREAM-FIXTURE\\n'; else printf 'ARCHIVE-FIXTURE-%s\\n' \"$(basename \"$output\")\" > \"$output\"; fi",
    ]);
    install("restic", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf 'restic %s\\n' \"$*\" >> \"$FAKE_LOG\"",
      "repo_file=; password_file=",
      "while [[ \"${1-}\" == --repository-file || \"${1-}\" == --password-file ]]; do [[ \"$2\" == /proc/self/fd/* ]] || exit 31; [[ \"$1\" == --repository-file ]] && repo_file=\"$2\" || password_file=\"$2\"; shift 2; done",
      "if [[ \"$repo_file\" == /proc/self/fd/* ]]; then repo_file=\"/dev/fd/${repo_file##*/}\"; fi",
      "if [[ \"$password_file\" == /proc/self/fd/* ]]; then password_file=\"/dev/fd/${password_file##*/}\"; fi",
      "[[ -n \"$repo_file\" && -n \"$password_file\" ]] || exit 32",
      "command=\"${1-}\"; shift || true",
      "case \"$command\" in",
      "  backup) cat >/dev/null; printf '{\"snapshot_id\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}\\n' ;;",
      "  cat) cat_count=0; [[ -f \"${FAKE_RESTIC_COUNT:-}\" ]] && cat_count=$(<\"$FAKE_RESTIC_COUNT\"); cat_count=$((cat_count + 1)); [[ -n \"${FAKE_RESTIC_COUNT:-}\" ]] && printf '%s' \"$cat_count\" >\"$FAKE_RESTIC_COUNT\";",
      "    if [[ \"${FAKE_GENERATION_FILE:-}\" != \"\" && \"$cat_count\" == 5 ]]; then",
      "      /usr/bin/python3 - \"$FAKE_GENERATION_FILE\" \"$FAKE_GENERATION_MARKER\" \"$FAKE_GENERATION_ROOT\" \"$FAKE_PRIOR_RECORD_COUNT\" <<'PY_GENERATION'",
      "import os, pathlib, sys",
      "p, marker, root, prior = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), int(sys.argv[4])",
      "assert len(list((root / \"snapshots\").iterdir())) == prior + 1",
      "assert len(list((root / \"candidates\").iterdir())) == prior + 1",
      "old = p.stat().st_ino",
      "replacement = p.with_name(p.name + \".replacement\")",
      "replacement.write_bytes(p.read_bytes()); replacement.chmod(0o600); os.replace(replacement, p)",
      "assert p.stat().st_ino != old",
      "marker.write_text(\"artifact-and-candidate-written;generation-replaced\\n\")",
      "PY_GENERATION",
      "    fi",
      "    if [[ \"${FAKE_RESTIC_MODE:-}\" == repo-drift && \"$cat_count\" -ge \"${FAKE_RESTIC_DRIFT_AT:-2}\" ]]; then printf '{\"id\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\"}\\n'; else printf '{\"id\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"}\\n'; fi ;;",
      "  dump) snapshot=\"${1-}\"; object=\"${2-}\"; if [[ \"$object\" == catering-backup-stream-* ]]; then cat \"$FAKE_TAR\"; else cat \"$object\"; fi ;;",
      "  *) exit 1 ;;",
      "esac",
    ]);
    const backupEnv: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
        FAKE_LOG: logPath,
        CATERING_REPOSITORY_FILE: repositoryFile,
        CATERING_PASSWORD_FILE: passwordFile,
        CATERING_BACKUP_ROOT: root,
        CATERING_BACKUP_EXPECTED_HOST_SHA256: hostDigest,
        CATERING_BACKUP_SOURCE_COMMIT: "a".repeat(40),
        CATERING_BACKUP_SOURCE_TREE: "b".repeat(40),
        CATERING_BACKUP_REPOSITORY_FILE: repositoryFile,
        CATERING_BACKUP_PASSWORD_FILE: passwordFile,
        CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256: createHash("sha256").update("s3:s3.example/catering").digest("hex"),
        CATERING_BACKUP_EXPECTED_REPOSITORY_ID: "b".repeat(64),
        CATERING_BACKUP_PRODUCTION_HOST_SHA256: hostDigest,
        CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256: productionAddressesDigest,
        CATERING_BACKUP_LOCAL_ADDRESSES: "1.1.1.1",
        CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES: "1.1.1.1",
        CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES: "none",
        CATERING_OFFHOST_ATTESTATION_FILE: offhostAttestation,
        CATERING_OFFHOST_ATTESTATION_SHA256: sha256(offhostAttestationText),
        CATERING_SECRET_RECOVERY_ATTESTATION_FILE: secretAttestation,
        CATERING_SECRET_RECOVERY_ATTESTATION_SHA256: sha256(secretAttestationText),
        CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 0),
        CATERING_BACKUP_TEST_MODE: "1",
        CATERING_BACKUP_ATTESTATION_NOW_EPOCH: "1788480000",
        CATERING_BACKUP_RESOLVED_ADDRESSES: "8.8.8.8",
        FAKE_VOLUME_ROOT: fakeVolumeRoot,
        FAKE_TAR: fakeTar,
        CATERING_SECRET_RECOVERY_SOURCE_TYPE: secretSourceType,
        CATERING_SECRET_RECOVERY_SOURCE_REFERENCE: secretSourceReference,
        CATERING_SECRET_RECOVERY_REFERENCE_SHA256: secretReference,
        CATERING_REQUIRED_SECRET_SCHEMA_SHA256: secretSchemaDigest,
        CATERING_RESTORE_POSTGRES_IMAGE: `registry.example/postgres@sha256:${"d".repeat(64)}`,
        CATERING_RESTIC_COMMAND: path.join(fakeBin, "restic"),
        CATERING_DOCKER_COMMAND: path.join(fakeBin, "docker"),
        CATERING_PG_DUMP_COMMAND: "pg_dump",
    };
    return { root, fakeBin, fakeVolumeRoot, logPath, repositoryFile, passwordFile, offhostAttestationText, secretAttestationText, hostDigest, productionAddressesDigest, secretSourceType, secretSourceReference, secretReference, secretSchemaDigest, previousEvidence, previousEvidenceBytes, pointer, fakeTar, backupEnv };
}

function createRestoreEntrypointFixture() {
    const root = mkdtempSync(path.join(realpathSync(tmpdir()), "catering-restore-entrypoint-"));
    const bin = path.join(root, "bin");
    const runtime = path.join(root, "runtime");
    const tree = path.join(root, "tree");
    let tarPath = path.join(root, "stream.tar");
    const log = path.join(root, "commands.log");
    const pgLog = path.join(root, "postgres-commands.log");
    const repository = path.join(root, "repository");
    const password = path.join(root, "password");
    const uid = String(process.getuid?.() ?? 0);
    const host = "fixture-host";
    const hostDigest = sha256(host);
    const repositoryId = "b".repeat(64);
    const snapshotId = "a".repeat(64);
    const sourceCommit = "c".repeat(40);
    const sourceTree = "d".repeat(40);
    const sourceType = "offline_vault";
    const sourceReference = "offline_vault:/recovery/catering-v1";
    const secretSchema = "operator-secret-schema-v2|restic_encryption_password,offhost_repository_access,POSTGRES_PASSWORD,CATERING_TRUSTED_ACTOR_SECRET,CATERING_BASIC_AUTH_PASSWORD_HASH";
    const secretReference = sha256(sourceReference);
    const image = `registry.example/postgres@sha256:${"f".repeat(64)}`;
    mkdirSync(bin, { recursive: true, mode: 0o700 });
    mkdirSync(runtime, { mode: 0o700 });
    for (const component of [
      "sites",
      "platform_caddy_data",
      "platform_caddy_config",
      "shared_edge_caddy_data",
      "shared_edge_caddy_config",
    ]) {
      mkdirSync(path.join(tree, "components", component), { recursive: true, mode: 0o700 });
      writeFileSync(path.join(tree, "components", component, "marker"), `${component}\n`, { mode: 0o600 });
    }
    mkdirSync(path.join(tree, "components"), { recursive: true, mode: 0o700 });
    writeFileSync(path.join(tree, "manifest"), "manifest\n", { mode: 0o600 });
    writeFileSync(path.join(tree, "postgres_dump"), "custom-dump\n", { mode: 0o600 });
    writeFileSync(path.join(tree, "components", "shared_edge_caddyfile"), "caddy\n", { mode: 0o600 });
    const tarResult = spawnSync("python3", ["-c", `import io, tarfile, sys\nout=sys.argv[1]\ndirs=['components','components/sites','components/platform_caddy_data','components/platform_caddy_config','components/shared_edge_caddy_data','components/shared_edge_caddy_config']\nfiles={'manifest':b'manifest\\n','postgres_dump':b'custom-dump\\n','components/shared_edge_caddyfile':b'caddy\\n'}\nfor name in dirs:\n  if name != 'components': files[f'{name}/marker']=name.encode()+b'\\n'\nwith tarfile.open(out,'w') as archive:\n  for name in dirs:\n    info=tarfile.TarInfo(name); info.type=tarfile.DIRTYPE; info.mode=0o700; archive.addfile(info)\n  for name,data in files.items():\n    info=tarfile.TarInfo(name); info.size=len(data); info.mode=0o600; archive.addfile(info,io.BytesIO(data))\n`, tarPath], { encoding: "utf8" });
    expect(tarResult.status, String(tarResult.stderr)).toBe(0);
    const filteredTarPath = path.join(root, "stream-filtered.tar");
    const filterResult = spawnSync("python3", ["-c", "import sys,tarfile\nsrc,dst=sys.argv[1:]\nwith tarfile.open(src,'r:') as inp, tarfile.open(dst,'w') as out:\n  for member in inp:\n    if member.name == 'components':\n      continue\n    data=inp.extractfile(member) if member.isfile() else None\n    out.addfile(member,data)", tarPath, filteredTarPath], { encoding: "utf8" });
    expect(filterResult.status, String(filterResult.stderr)).toBe(0);
    tarPath = filteredTarPath;
    writeFileSync(repository, "s3:s3.example/catering\n", { mode: 0o600 });
    writeFileSync(password, "fixture-password\n", { mode: 0o600 });
    const secretSchemaDigest = sha256(secretSchema);
    const productionAddresses = "1.1.1.1";
    const productionAddressesDigest = sha256(productionAddresses);
    const offhostAttestation = path.join(root, "offhost-attestation");
    const secretAttestation = path.join(root, "secret-attestation");
    const offhostAttestationText = `status=operator_attested\nlocator_digest=${sha256("s3:s3.example/catering")}\nendpoint_host=s3.example\nresolved_addresses_digest=${sha256("8.8.8.8")}\nproduction_addresses=${productionAddresses}\nproduction_external_addresses=none\nproduction_addresses_digest=${productionAddressesDigest}\nrepository_identity=${repositoryId}\nhost_binding=${hostDigest}\nproduction_host_binding=${hostDigest}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=2026-09-04T00:00:00Z\nvalid_until=2026-09-05T00:00:00Z\nattestation_id=${"a".repeat(64)}\n`;
    const secretAttestationText = `status=operator_attested\nsource_type=${sourceType}\nsource_reference=${sourceReference}\nsource_reference_digest=${sha256(sourceReference)}\nrequired_secret_schema_digest=${secretSchemaDigest}\nrepository_identity=${repositoryId}\nhost_binding=${hostDigest}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=2026-09-04T00:00:00Z\nvalid_until=2026-09-05T00:00:00Z\nattestation_id=${"f".repeat(64)}\n`;
    writeFileSync(offhostAttestation, offhostAttestationText, { mode: 0o600 });
    writeFileSync(secretAttestation, secretAttestationText, { mode: 0o600 });
    const bundleChecksum = sha256(readFileSync(tarPath));
    const manifestChecksum = sha256("manifest\n");
    const dumpChecksum = sha256("custom-dump\n");
    const componentTreeChecksum = (name: string): string => {
      const member = `components/${name}/marker`;
      return sha256(`${member}\0${sha256(`components/${name}\n`)}\n`);
    };
    const componentSitesChecksum = componentTreeChecksum("sites");
    const componentPlatformCaddyDataChecksum = componentTreeChecksum("platform_caddy_data");
    const componentPlatformCaddyConfigChecksum = componentTreeChecksum("platform_caddy_config");
    const componentSharedEdgeCaddyDataChecksum = componentTreeChecksum("shared_edge_caddy_data");
    const componentSharedEdgeCaddyConfigChecksum = componentTreeChecksum("shared_edge_caddy_config");
    const componentSharedEdgeCaddyfileChecksum = sha256("caddy\n");
    const artifactPath = path.join(root, "snapshots", "catering-backup-artifact-1");
    const candidatePath = path.join(root, "candidates", "catering-backup-candidate-1");
    mkdirSync(path.dirname(artifactPath), { mode: 0o700 });
    mkdirSync(path.dirname(candidatePath), { mode: 0o700 });
    const artifact = `status=artifact\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nhost_binding=${hostDigest}\nsource_commit=${sourceCommit}\nsource_tree=${sourceTree}\nsecret_recovery_reference_sha256=${secretReference}\nrestore_postgres_image=${image}\nbundle_path=catering-backup-stream-1\nbundle_checksum=${bundleChecksum}\nmanifest_path=manifest\nmanifest_checksum=${manifestChecksum}\npostgres_dump_path=postgres_dump\ncomponent_postgres_dump_checksum=${dumpChecksum}\ncomponent_caddy_stream_checksum=${bundleChecksum}\ncomponent_sites_checksum=${componentSitesChecksum}\ncomponent_platform_caddy_data_checksum=${componentPlatformCaddyDataChecksum}\ncomponent_platform_caddy_config_checksum=${componentPlatformCaddyConfigChecksum}\ncomponent_shared_edge_caddyfile_checksum=${componentSharedEdgeCaddyfileChecksum}\ncomponent_shared_edge_caddy_data_checksum=${componentSharedEdgeCaddyDataChecksum}\ncomponent_shared_edge_caddy_config_checksum=${componentSharedEdgeCaddyConfigChecksum}\n`;
    const artifactChecksum = sha256(artifact);
    const candidate = `status=candidate\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nhost_binding=${hostDigest}\nsource_commit=${sourceCommit}\nsource_tree=${sourceTree}\nsnapshot_id=${snapshotId}\nrepository_identity=${repositoryId}\nartifact_path=${artifactPath}\nartifact_checksum=${artifactChecksum}\nbundle_path=catering-backup-stream-1\nbundle_checksum=${bundleChecksum}\nsecret_recovery_reference_sha256=${secretReference}\nrestore_postgres_image=${image}\ncreated_at=2026-09-04T00:00:00Z\nstatus_timestamp=2026-09-04T00:00:00Z\n`;
    writeFileSync(artifactPath, artifact, { mode: 0o600 });
    writeFileSync(candidatePath, candidate, { mode: 0o600 });
    writeFileSync(path.join(root, "catering-backup-candidate"), `status=pointer\ncandidate_path=${candidatePath}\ncandidate_checksum=${sha256(candidate)}\ncreated_at=2026-09-04T00:00:00Z\n`, { mode: 0o600 });
    const install = (name: string, body: string): void => writeFileSync(path.join(bin, name), `${body}\n`, { mode: 0o755 });
    install("hostname", `#!/usr/bin/env bash\nprintf '%s\\n' ${JSON.stringify(host)}`);
    install("date", `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *+%s ]]; then
  count=0
  [[ -f "\${FAKE_CLOCK_COUNT:-}" ]] && count=$(<"$FAKE_CLOCK_COUNT")
  count=$((count + 1))
  [[ -n "\${FAKE_CLOCK_COUNT:-}" ]] && printf '%s' "$count" >"$FAKE_CLOCK_COUNT"
  if [[ -f "\${FAKE_LATE_MARKER:-}" ]]; then
    printf '%s\\n' "$(( \${FAKE_BASE_EPOCH:-1788480000} + \${FAKE_LATE_SECONDS:-0} ))"
    exit 0
  fi
  case "\${FAKE_CLOCK_MODE:-}" in over) [[ "$count" == 1 ]] && printf '1000\\n' || printf '15401\\n' ;; negative) [[ "$count" == 1 ]] && printf '1000\\n' || printf '999\\n' ;; *) printf '%s\\n' "\${FAKE_BASE_EPOCH:-1788480000}" ;; esac
elif [[ "$*" == *+%Y%m%dT%H%M%SZ ]]; then printf '20260904T000000Z\\n'
else printf '2026-09-04T00:00:00Z\\n'
fi`);
    install("restic", `#!/usr/bin/env bash
set -euo pipefail
printf 'restic %s\\n' "$*" >>"$FAKE_LOG"
repo=; pass=
while [[ "\${1-}" == --repository-file || "\${1-}" == --password-file ]]; do [[ "$2" == /proc/self/fd/* ]] || exit 31; [[ "$1" == --repository-file ]] && repo="$2" || pass="$2"; shift 2; done
[[ -n "$repo" && -n "$pass" ]] || exit 32
case "\${1-}" in
  cat)
    cat_count=0; [[ -f "\${FAKE_RESTIC_COUNT:-}" ]] && cat_count=$(<"$FAKE_RESTIC_COUNT")
    cat_count=$((cat_count + 1)); [[ -n "\${FAKE_RESTIC_COUNT:-}" ]] && printf '%s' "$cat_count" >"$FAKE_RESTIC_COUNT"
    if [[ -n "\${FAKE_LATE_MODE:-}" && "$cat_count" == 5 ]]; then
      python3 - "$CATERING_BACKUP_ROOT" "$FAKE_LATE_MARKER" "$FAKE_PRIOR_STATUS_INODE" "$FAKE_PRIOR_RECEIPTS" <<'LATE'
import glob, json, os, sys
root, marker, prior_inode, prior_count = sys.argv[1:]
receipts = glob.glob(root + '/restore-receipts/*')
status_inode = os.stat(root + '/catering-backup-repository-status').st_ino
assert len(receipts) == int(prior_count) + 1, 'receipt write not reached'
assert status_inode != int(prior_inode), 'status write not reached'
with open(marker, 'w') as out: json.dump({'receipt_count': len(receipts), 'status_inode': status_inode, 'after_receipt_and_status': True}, out)
mode = os.environ['FAKE_LATE_MODE']
if mode in ('generation', 'generation-password'):
    target = os.environ['FAKE_GENERATION_FILE']
    with open(target, 'rb') as inp: value = inp.read()
    with open(target + '.replacement', 'wb') as out: out.write(value)
    os.chmod(target + '.replacement', 0o600)
    os.replace(target + '.replacement', target)
    with open(marker + '.generation-replaced', 'w') as out: out.write(str(os.stat(target).st_ino))
elif mode == 'attestation':
    with open(os.environ['CATERING_OFFHOST_ATTESTATION_FILE'], 'a') as out: out.write('unexpected=value\\n')
LATE
      if [[ "$FAKE_LATE_MODE" == id ]]; then printf '{"id":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}\\n'; exit 0; fi
    fi
    if [[ "\${FAKE_RESTIC_MODE:-}" == kill-final && "$cat_count" -ge 4 ]]; then kill -9 "$PPID"; fi
    if [[ "\${FAKE_RESTIC_MODE:-}" == repo-drift && "$cat_count" -ge "\${FAKE_RESTIC_DRIFT_AT:-2}" ]]; then printf '{"id":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}\\n'; else printf '{"id":"${repositoryId}"}\\n'; fi
    ;;
  snapshots) printf '[{"id":"${snapshotId}"}]\\n' ;;
  dump) cat "$FAKE_TAR" ;;
  *) exit 33 ;;
esac`);
    install("docker", `#!/usr/bin/env bash\nset -euo pipefail\nprintf 'docker %s\\n' \"$*\" >>\"$FAKE_LOG\"\ncase \"$1\" in ps) printf '%s' \"\${FAKE_DOCKER_PS:-}\" ;; run) [[ \"$*\" == *'--user postgres'* && \"$*\" == *'--network none'* && \"$*\" == *'--pull never'* && \"$*\" == *'--rm'* && \"$*\" != *' -p '* ]] || exit 41; [[ \"\${FAKE_DOCKER_MODE:-}\" == restore-fail ]] && exit 42 || true ;; inspect) printf 'stale\\n' ;; *) exit 43 ;; esac`);
    install("initdb", `#!/usr/bin/env bash
set -euo pipefail
printf 'initdb %s\\n' "$*" >>"$FAKE_PG_LOG"
[[ "\${FAKE_PG_FAIL:-}" == initdb ]] && exit 71
/bin/mkdir -p "$CATERING_RESTORE_RUNTIME_ROOT/pgdata"`);
    install("pg_ctl", `#!/usr/bin/env bash
set -euo pipefail
printf 'pg_ctl %s\\n' "$*" >>"$FAKE_PG_LOG"
case "$*" in
  *" -w start"*) [[ "\${FAKE_PG_FAIL:-}" == pg_ctl ]] && exit 72; /bin/mkdir -p "$CATERING_RESTORE_RUNTIME_ROOT/pgdata" ;;
  *"-m immediate -w stop"*) [[ "\${FAKE_PG_FAIL:-}" == pg_ctl_stop ]] && exit 73 ;;
esac`);
    install("psql", `#!/usr/bin/env bash
set -euo pipefail
printf 'psql %s\\n' "$*" >>"$FAKE_PG_LOG"
case "$*" in
  *"CREATE ROLE catering LOGIN"*) [[ "\${FAKE_PG_FAIL:-}" == role ]] && exit 74 || true ;;
  *"public.catering_business_records"*) [[ "\${FAKE_PG_FAIL:-}" == table1 ]] && exit 75; printf '0\\n' ;;
  *"public.catering_source_documents"*) [[ "\${FAKE_PG_FAIL:-}" == table2 ]] && exit 76; printf '0\\n' ;;
esac`);
    install("createdb", `#!/usr/bin/env bash
set -euo pipefail
printf 'createdb %s\\n' "$*" >>"$FAKE_PG_LOG"
[[ "$*" == "--username=postgres --owner=catering catering_agents" ]] || exit 77
[[ "\${FAKE_PG_FAIL:-}" == createdb ]] && exit 78 || true`);
    install("pg_restore", `#!/usr/bin/env bash
set -euo pipefail
printf 'pg_restore %s\\n' "$*" >>"$FAKE_PG_LOG"
[[ "$*" == "--exit-on-error --no-owner --no-privileges --username=catering --dbname=catering_agents /restore/postgres.dump" ]] || exit 79
[[ "\${FAKE_PG_FAIL:-}" == pg_restore ]] && exit 80 || true`);
    install("docker", `#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >>"$FAKE_LOG"
case "\${1-}" in
  ps)
    ps_count=0; [[ -f "\${FAKE_DOCKER_PS_COUNT:-}" ]] && ps_count=$(<"$FAKE_DOCKER_PS_COUNT")
    ps_count=$((ps_count + 1)); [[ -n "\${FAKE_DOCKER_PS_COUNT:-}" ]] && printf '%s' "$ps_count" >"$FAKE_DOCKER_PS_COUNT"
    if [[ "\${FAKE_DOCKER_MODE:-}" == cleanup-fail && "$ps_count" -ge 2 ]]; then printf 'catering-restore-probe-stale\\n'; else printf '%s' "\${FAKE_DOCKER_PS:-}"; fi
    ;;
  run)
    [[ "$*" == *"--user postgres"* ]] || { printf 'bad-user:%s\n' "$*" >>"$FAKE_LOG"; exit 41; }
    [[ "$*" == *"--network none"* ]] || { printf 'bad-network:%s\n' "$*" >>"$FAKE_LOG"; exit 41; }
    [[ "$*" == *"--pull never"* ]] || { printf 'bad-pull:%s\n' "$*" >>"$FAKE_LOG"; exit 41; }
    [[ "$*" == *"--rm"* ]] || { printf 'bad-rm:%s\n' "$*" >>"$FAKE_LOG"; exit 41; }
    for arg in "$@"; do [[ "$arg" != "-p" && "$arg" != "--publish" ]] || exit 41; done
    inner_script="\${@: -1}"
    mkdir() {
      [[ "$*" == '-p /tmp/pgsocket' ]] || return 81
      /bin/mkdir -p "$CATERING_RESTORE_RUNTIME_ROOT/pgsocket"
    }
    export -f mkdir
    bash -ceu "$inner_script"
    [[ "\${FAKE_DOCKER_MODE:-}" == restore-fail ]] && exit 42 || true
    ;;
  inspect) printf 'stale\\n' ;;
  *) exit 43 ;;
esac`);
    const invoke = (extra: NodeJS.ProcessEnv = {}): ReturnType<typeof spawnSync> => spawnSync("bash", [path.join(repoRoot, files.restore)], {
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        FAKE_LOG: log,
        FAKE_PG_LOG: pgLog,
        FAKE_TAR: tarPath,
        CATERING_BACKUP_ROOT: root,
        CATERING_RESTORE_RUNTIME_ROOT: runtime,
        CATERING_BACKUP_EXPECTED_UID: uid,
        CATERING_BACKUP_TEST_MODE: "1",
        CATERING_BACKUP_ATTESTATION_NOW_EPOCH: "1788480000",
        CATERING_BACKUP_RESOLVED_ADDRESSES: "8.8.8.8",
        CATERING_BACKUP_EXPECTED_HOST_SHA256: hostDigest,
        CATERING_BACKUP_SOURCE_COMMIT: sourceCommit,
        CATERING_BACKUP_SOURCE_TREE: sourceTree,
        CATERING_BACKUP_REPOSITORY_FILE: repository,
        CATERING_BACKUP_PASSWORD_FILE: password,
        CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256: sha256("s3:s3.example/catering"),
        CATERING_BACKUP_PRODUCTION_HOST_SHA256: hostDigest,
        CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256: productionAddressesDigest,
        CATERING_BACKUP_LOCAL_ADDRESSES: "1.1.1.1",
        CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES: "1.1.1.1",
        CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES: "none",
        CATERING_RESTORE_POSTGRES_IMAGE: image,
        CATERING_SECRET_RECOVERY_SOURCE_TYPE: sourceType,
        CATERING_SECRET_RECOVERY_SOURCE_REFERENCE: sourceReference,
        CATERING_SECRET_RECOVERY_REFERENCE_SHA256: secretReference,
        CATERING_REQUIRED_SECRET_SCHEMA_SHA256: secretSchemaDigest,
        CATERING_OFFHOST_ATTESTATION_FILE: offhostAttestation,
        CATERING_OFFHOST_ATTESTATION_SHA256: sha256(offhostAttestationText),
        CATERING_SECRET_RECOVERY_ATTESTATION_FILE: secretAttestation,
        CATERING_SECRET_RECOVERY_ATTESTATION_SHA256: sha256(secretAttestationText),
        CATERING_RESTIC_COMMAND: path.join(bin, "restic"),
        CATERING_DOCKER_COMMAND: path.join(bin, "docker"),
        ...extra,
      },
    });
    const evidencePath = path.join(root, "catering-backup-evidence");
    writeFileSync(pgLog, "", { mode: 0o600 });
    return { root, runtime, pgLog, log, evidencePath, invoke, repository, password, offhostAttestation, offhostAttestationText };
}

describe("Catering backup and isolated restore repository contract", () => {
  test("contains the complete inert repository slice", () => {
    for (const relativePath of Object.values(files)) {
      expect(existsSync(path.join(repoRoot, relativePath)), relativePath).toBe(true);
    }
  });

  test("restore entrypoint is executable for its systemd ExecStart contract", () => {
    expect(statSync(path.join(repoRoot, files.restore)).mode & 0o777).toBe(0o755);
  });

  test("shell entrypoints and common writer are syntactically valid and fail-closed", () => {
    for (const relativePath of [files.common, files.backup, files.restore]) {
      const value = source(relativePath);
      if (relativePath !== files.common) {
        expect(value).toContain("#!/usr/bin/env bash");
        expect(value).toContain("set -euo pipefail");
        expect(value).toContain("umask 077");
      }
      const result = syntax(relativePath);
      expect(result.status, String(result.stderr)).toBe(0);
    }
  });

  test("backup binds the fixed six-hour RPO, scope, host and source identity", () => {
    const backup = source(files.backup);
    expect(backup).toContain('readonly RPO_SECONDS="21600"');
    expect(backup).toContain('readonly BACKUP_SCOPE="postgres,sites,platform-caddy,shared-edge-caddy"');
    expect(backup).toContain("CATERING_BACKUP_EXPECTED_HOST_SHA256");
    expect(backup).toContain("CATERING_BACKUP_SOURCE_COMMIT");
    expect(backup).toContain("CATERING_BACKUP_SOURCE_TREE");
    expect(backup).toContain("hostname");
    expect(backup).toContain("sha256sum");
    expect(backup).toContain("require_commit");
    expect(backup).toContain("require_digest");
  });

  test("backup discovers only the exact production PostgreSQL service and fixed volumes", () => {
    const backup = source(files.backup);
    expect(backup).toContain("com.docker.compose.project=platform-infra");
    expect(backup).toContain("com.docker.compose.service=postgres");
    for (const volume of [
      "platform-infra_caddy_data",
      "platform-infra_caddy_config",
      "shared-edge_edge_caddy_data",
      "shared-edge_edge_caddy_config",
    ]) {
      expect(backup).toContain(volume);
    }
    expect(backup).toContain("sites_path=\"/opt/catering-agents-platform/platform-infra/sites\"");
    expect(backup).toContain("/opt/shared-edge/Caddyfile");
    expect(backup).not.toMatch(/\bdocker\s+compose\b/);
  });

  test("backup binds the immutable PostgreSQL container, runtime digest, mount and database identity", () => {
    const backup = source(files.backup);
    expect(backup).toContain("--no-trunc");
    expect(backup).toContain("{{.ID}}");
    expect(backup).toContain("postgres_container_id");
    expect(backup).toContain("RepoDigests");
    expect(backup).toContain("platform-infra_postgres_data");
    expect(backup).toContain("/var/lib/postgresql/data");
    expect(backup).toContain("--username=catering");
    expect(backup).toContain("--dbname=catering_agents");
    expect(backup).toContain('"$DOCKER_CMD" exec');
    expect(backup).toContain('--user postgres');
    expect(backup).toContain('"$postgres_container_id"');
    expect(backup).toContain("POSTGRES_REPO_DIGEST");
  });

  test("backup closes the inspected container and volume identity before pg_dump", () => {
    const backup = source(files.backup);
    expect(backup).toContain("ps --no-trunc");
    expect(backup).toContain("/platform-infra-postgres-1");
    expect(backup).toContain("container-number");
    expect(backup).toContain(".State.Status");
    expect(backup).toContain(".State.Health.Status");
    expect(backup).toContain("volume inspect");
    expect(backup).toContain("com.docker.compose.volume");
    expect(backup).toContain("postgres_data");
    expect(backup).toContain("image inspect");
    expect(backup).toContain("POSTGRES_DB");
    expect(backup).toContain("POSTGRES_USER");
    expect(backup).toContain('"$postgres_container_id"');
    expect(backup.indexOf("POSTGRES_REPO_DIGEST")).toBeLessThan(backup.indexOf('"$DOCKER_CMD" exec'));
  });

  test("backup rechecks Caddy container and mount generation after capture", () => {
    const backup = source(files.backup);
    expect(backup).toContain("caddy_binding_before");
    expect(backup).toContain("caddy_binding_after");
    expect(backup).toContain("CADDY_CAPTURE_DRIFT");
    const snapshot = backup.indexOf('snapshot_json="$(snapshot_stream');
    const recheck = backup.indexOf("caddy_binding_after", snapshot);
    expect(snapshot).toBeGreaterThanOrEqual(0);
    expect(recheck).toBeGreaterThan(snapshot);
  });

  test("backup uses a custom PostgreSQL dump and closes over every persisted component", () => {
    const backup = source(files.backup);
    expect(backup).toContain("pg_dump");
    expect(backup).toContain("--format=custom");
    expect(backup).toContain("--no-owner");
    expect(backup).toContain("--no-privileges");
    expect(backup).toContain("--strict-names");
    expect(backup).toContain("--table=public.catering_business_records");
    expect(backup).toContain("--table=public.catering_source_documents");
    for (const variable of ["PGHOST", "PGHOSTADDR", "PGPORT", "PGSERVICE", "PGSERVICEFILE"]) {
      expect(backup).toContain(`--env ${variable}=`);
    }
    expect(backup).toContain("catering_business_records");
    expect(backup).toContain("catering_source_documents");
    expect(backup).toContain('arcname="components/"');
    for (const component of [
      "postgres_dump",
      "sites",
      "platform_caddy_data",
      "platform_caddy_config",
      "shared_edge_caddyfile",
      "shared_edge_caddy_data",
      "shared_edge_caddy_config",
    ]) {
      expect(backup).toContain(component);
    }
  });

  test("backup and restore bind the four-name scope to component checksums", () => {
    const backup = source(files.backup);
    const restore = source(files.restore);
    const expectedScope = "postgres,sites,platform-caddy,shared-edge-caddy";
    expect(backup).toContain(`readonly BACKUP_SCOPE="${expectedScope}"`);
    expect(restore).toContain(`readonly BACKUP_SCOPE="${expectedScope}"`);
    for (const field of [
      "component_sites_checksum",
      "component_platform_caddy_data_checksum",
      "component_platform_caddy_config_checksum",
      "component_shared_edge_caddyfile_checksum",
      "component_shared_edge_caddy_data_checksum",
      "component_shared_edge_caddy_config_checksum",
    ]) {
      expect(backup).toContain(field);
      expect(restore).toContain(field);
    }
  });

  test("backup requires protected non-local Restic configuration and verifies remote readback", () => {
    const backup = source(files.backup);
    const common = source(files.common);
    expect(backup).toContain("CATERING_BACKUP_REPOSITORY_FILE");
    expect(backup).toContain("CATERING_BACKUP_PASSWORD_FILE");
    expect(backup).toContain("assert_root_mode_600");
    expect(backup).toContain("assert_off_host_repository");
    expect(backup).toContain("restic");
    expect(backup).toContain("backup");
    expect(backup).toContain("cat config");
    expect(backup).toContain("dump");
    expect(backup).toContain("BUNDLE_READBACK_FAILED");
    expect(backup).toContain("BUNDLE_READBACK_FAILED");
    expect(backup).toContain("repository_identity");
    expect(common).toContain("--repository-file");
    expect(common).toContain("--password-file");
    expect(common).toContain("RESTIC_REPOSITORY");
    expect(backup).not.toContain("export RESTIC_REPOSITORY");
    expect(backup).not.toContain("RESTIC_REPOSITORY=");
    expect(backup).not.toMatch(/\b(?:echo|printf)\b[^\n]*PASSWORD_FILE/i);
  });

  test("backup publishes only a versioned candidate and never advances final evidence", () => {
    const backup = source(files.backup);
    expect(backup).toContain("candidate_dir=\"$BACKUP_ROOT/candidates\"");
    expect(backup).toContain("catering-backup-candidate");
    expect(backup).toContain("status=candidate");
    expect(backup).not.toContain("catering-backup-evidence");
    expect(backup).not.toContain("catering-backup-repository-status");
    expect(backup).toContain("atomic_write_record");
    expect(backup).toContain("candidate_pointer");
  });

  test("backup persists a versioned Restic stream manifest without a local Caddy bundle", () => {
    const backup = source(files.backup);
    expect(backup).toContain("manifest_path");
    expect(backup).toContain("bundle_checksum");
    expect(backup).toContain("component_postgres_dump_checksum");
    expect(backup).not.toContain("postgres_dump=$postgres_dump");
    expect(backup).toContain("--stdin");
    expect(backup).toContain("--stdin-filename");
    expect(backup).not.toMatch(/bundle_path=\"\$snapshot_dir/);
    expect(backup).toContain("cleanup_work_root");
  });

  test("Variant A keeps Caddy cleartext archives transient and never leaves a local bundle", () => {
    const backup = source(files.backup);
    expect(backup).toContain("bundle_path=\"catering-backup-stream-");
    expect(backup).not.toMatch(/bundle_path=\"\$snapshot_dir/);
    expect(backup).toContain("platform-infra_caddy_data");
    expect(backup).toContain("shared-edge_edge_caddy_data");
    expect(backup).not.toMatch(/tar .*--file \"\$work_root/);
    expect(backup).toContain("secret_recovery_reference_sha256");
    expect(backup).toContain("cleanup_work_root");
  });

  for (const kind of ["repository", "password"] as const) {
    for (const prior of [false, true]) {
      test(`backup final query rejects replaced ${kind} generation with ${prior ? "prior pointer" : "first run"}`, () => {
        const fixture = createBackupEntrypointFixture();
        const { root, pointer, backupEnv, repositoryFile, passwordFile } = fixture;
        try {
          if (prior) {
            const produced = spawnSync(path.join(repoRoot, files.backup), [], { encoding: "utf8", env: backupEnv });
            expect(produced.status, String(produced.stderr)).toBe(0);
          }
          const previous = prior ? readFileSync(pointer) : undefined;
          const generationFile = kind === "repository" ? repositoryFile : passwordFile;
          const before = readFileSync(generationFile);
          const inode = statSync(generationFile).ino;
          const marker = path.join(root, "generation-marker");
          const result = spawnSync(path.join(repoRoot, files.backup), [], { encoding: "utf8", env: {
            ...backupEnv, FAKE_RESTIC_COUNT: path.join(root, "final-query-count"),
            FAKE_GENERATION_FILE: generationFile, FAKE_GENERATION_MARKER: marker,
            FAKE_GENERATION_ROOT: root, FAKE_PRIOR_RECORD_COUNT: prior ? "1" : "0",
          } });
          expect(readFileSync(marker, "utf8")).toBe("artifact-and-candidate-written;generation-replaced\n");
          expect(statSync(generationFile).ino).not.toBe(inode);
          expect(readFileSync(generationFile)).toEqual(before);
          expect(result.status, String(result.stderr)).not.toBe(0);
          expect(String(result.stderr)).toContain("REPOSITORY_GENERATION_CHANGED");
          if (previous) expect(readFileSync(pointer)).toEqual(previous);
          else expect(existsSync(pointer)).toBe(false);
        } finally { removeFixture(root); }
      }, 120000);
    }
  }

  test("backup entrypoint fake records off-host commands and preserves a pointer failure exit", () => {
    const { root, fakeBin, fakeVolumeRoot, logPath, repositoryFile, passwordFile, offhostAttestationText, secretAttestationText, hostDigest, productionAddressesDigest, secretSourceType, secretSourceReference, secretReference, secretSchemaDigest, previousEvidence, previousEvidenceBytes, pointer, fakeTar, backupEnv } = createBackupEntrypointFixture();
    expect(spawnSync("mkfifo", [pointer], { encoding: "utf8" }).status).toBe(0);
    const result = spawnSync(path.join(repoRoot, files.backup), [], {
      encoding: "utf8",
      env: backupEnv,
    });
    try {
      expect(result.status).toBe(1);
      expect(String(result.stderr)).toContain("STATE_PATH_INVALID");
      const commandLog = readFileSync(logPath, "utf8");
      expect(commandLog).toContain("docker ps --no-trunc");
      expect(commandLog).toContain("docker inspect");
      expect(commandLog).toContain("docker exec");
      expect(commandLog).toContain("restic --repository-file");
      expect(commandLog).not.toContain("s3://backup.example/catering");
      expect(commandLog).not.toContain("fixture-password");
      expect(readdirSync(root).some((entry) => entry.startsWith(".work-"))).toBe(false);
      expect(readdirSync(root).some((entry) => /(?:bundle|caddy_data_archive|caddy_config_archive)/.test(entry))).toBe(false);
      expect(readFileSync(previousEvidence, "utf8")).toBe(previousEvidenceBytes);
      expect(statSync(pointer).isFIFO()).toBe(true);

      const captureCount = path.join(root, "caddy-capture-count");
      const captureDrift = spawnSync(path.join(repoRoot, files.backup), [], {
        encoding: "utf8",
        env: {
          ...backupEnv,
          FAKE_CADDY_CAPTURE_SWAP: "1",
          FAKE_CADDY_CAPTURE_COUNT: captureCount,
        },
      });
      expect(captureDrift.status).not.toBe(0);
      expect(String(captureDrift.stderr)).toContain("CADDY_CAPTURE_DRIFT");
      expect(readFileSync(path.join(fakeVolumeRoot, "platform-infra_caddy_data", "_data", "marker"), "utf8")).toBe("generation-two\n");
      expect(readFileSync(previousEvidence, "utf8")).toBe(previousEvidenceBytes);
      expect(statSync(pointer).isFIFO()).toBe(true);

      for (const driftAt of [2, 3, 4]) {
        const driftRoot = mkdtempSync(path.join(tmpdir(), `catering-backup-repo-drift-${driftAt}-`));
        const driftRepository = path.join(driftRoot, "repository");
        const driftPassword = path.join(driftRoot, "password");
        const driftEvidence = path.join(driftRoot, "catering-backup-evidence");
        const driftPointer = path.join(driftRoot, "catering-backup-candidate");
        writeFileSync(driftRepository, "s3:s3.example/catering\n", { mode: 0o600 });
        writeFileSync(driftPassword, "fixture-password\n", { mode: 0o600 });
        const driftOffhostAttestation = path.join(driftRoot, "offhost-attestation");
        const driftSecretAttestation = path.join(driftRoot, "secret-attestation");
        writeFileSync(driftOffhostAttestation, offhostAttestationText.replace(/host_binding=0+/g, `host_binding=${hostDigest}`).replace(/production_host_binding=0+/g, `production_host_binding=${hostDigest}`).replace(/repository_identity=b+/g, "repository_identity=" + "b".repeat(64)), { mode: 0o600 });
        writeFileSync(driftSecretAttestation, secretAttestationText.replace(/host_binding=0+/g, `host_binding=${hostDigest}`).replace(/repository_identity=b+/g, "repository_identity=" + "b".repeat(64)), { mode: 0o600 });
        writeFileSync(driftEvidence, previousEvidenceBytes, { mode: 0o600 });
        const countPath = path.join(driftRoot, "restic-count");
        const driftResult = spawnSync(path.join(repoRoot, files.backup), [], {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
            FAKE_LOG: logPath,
            FAKE_RESTIC_MODE: "repo-drift",
            FAKE_RESTIC_DRIFT_AT: String(driftAt),
            FAKE_RESTIC_COUNT: countPath,
            CATERING_REPOSITORY_FILE: driftRepository,
            CATERING_PASSWORD_FILE: driftPassword,
            CATERING_BACKUP_ROOT: driftRoot,
            CATERING_BACKUP_EXPECTED_HOST_SHA256: hostDigest,
            CATERING_BACKUP_SOURCE_COMMIT: "a".repeat(40),
            CATERING_BACKUP_SOURCE_TREE: "b".repeat(40),
            CATERING_BACKUP_REPOSITORY_FILE: driftRepository,
            CATERING_BACKUP_PASSWORD_FILE: driftPassword,
            CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256: createHash("sha256").update("s3:s3.example/catering").digest("hex"),
            CATERING_BACKUP_EXPECTED_REPOSITORY_ID: "b".repeat(64),
            CATERING_BACKUP_PRODUCTION_HOST_SHA256: hostDigest,
            CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256: productionAddressesDigest,
            CATERING_BACKUP_LOCAL_ADDRESSES: "1.1.1.1",
            CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES: "1.1.1.1",
            CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES: "none",
            CATERING_OFFHOST_ATTESTATION_FILE: driftOffhostAttestation,
            CATERING_OFFHOST_ATTESTATION_SHA256: sha256(offhostAttestationText.replace(/host_binding=0+/g, `host_binding=${hostDigest}`).replace(/production_host_binding=0+/g, `production_host_binding=${hostDigest}`).replace(/repository_identity=b+/g, "repository_identity=" + "b".repeat(64))),
            CATERING_SECRET_RECOVERY_ATTESTATION_FILE: driftSecretAttestation,
            CATERING_SECRET_RECOVERY_ATTESTATION_SHA256: sha256(secretAttestationText.replace(/host_binding=0+/g, `host_binding=${hostDigest}`).replace(/repository_identity=b+/g, "repository_identity=" + "b".repeat(64))),
            CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 0),
            CATERING_BACKUP_TEST_MODE: "1",
            CATERING_BACKUP_ATTESTATION_NOW_EPOCH: "1788480000",
            CATERING_BACKUP_RESOLVED_ADDRESSES: "8.8.8.8",
            FAKE_VOLUME_ROOT: fakeVolumeRoot,
            FAKE_TAR: fakeTar,
            CATERING_SECRET_RECOVERY_SOURCE_TYPE: secretSourceType,
            CATERING_SECRET_RECOVERY_SOURCE_REFERENCE: secretSourceReference,
            CATERING_SECRET_RECOVERY_REFERENCE_SHA256: secretReference,
            CATERING_REQUIRED_SECRET_SCHEMA_SHA256: secretSchemaDigest,
            CATERING_RESTORE_POSTGRES_IMAGE: `registry.example/postgres@sha256:${"d".repeat(64)}`,
            CATERING_RESTIC_COMMAND: path.join(fakeBin, "restic"),
            CATERING_DOCKER_COMMAND: path.join(fakeBin, "docker"),
            CATERING_PG_DUMP_COMMAND: "pg_dump",
          },
        });
        expect(driftResult.status, String(driftResult.stderr)).not.toBe(0);
        expect(String(driftResult.stderr)).toContain("REPOSITORY_ID_MISMATCH");
        expect(readFileSync(driftEvidence, "utf8")).toBe(previousEvidenceBytes);
        expect(existsSync(driftPointer)).toBe(false);
        const snapshots = existsSync(path.join(driftRoot, "snapshots")) ? readdirSync(path.join(driftRoot, "snapshots")) : [];
        const candidates = existsSync(path.join(driftRoot, "candidates")) ? readdirSync(path.join(driftRoot, "candidates")) : [];
        // The immutable-ID checkpoints are: before snapshot (2), after the
        // snapshot readback (3), then before candidate (4).  A drift at the
        // latter boundary may leave only an orphan artifact record; it must
        // never advance the candidate pointer.
        expect(snapshots.length).toBe(driftAt >= 4 ? 1 : 0);
        expect(candidates.length).toBe(0);
        removeFixture(driftRoot);
      }
    } finally {
      removeFixture(root);
    }
  }, 180000);

  test("backup binds each Caddy container once to its complete volume matrix", () => {
    const backup = source(files.backup);
    const start = backup.indexOf("assert_caddy_container_mounts() {");
    const end = backup.indexOf("\n}\n\nassert_caddy_container_mounts platform-infra", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const helper = backup.slice(start, end + 2);
    const root = mkdtempSync(path.join(tmpdir(), "catering-caddy-mount-"));
    const docker = path.join(root, "docker");
    const webId = "e".repeat(64);
    const edgeId = "f".repeat(64);
    writeFileSync(
      docker,
      `#!/usr/bin/env bash
set -euo pipefail
web_id=${webId}
edge_id=${edgeId}
case "$1" in
  ps) [[ "$*" == *service=web* ]] && printf '%s\\n' "$web_id" || printf '%s\\n' "$edge_id" ;;
  inspect)
    id="$4"
    case "$*" in
      *'.Id'*) printf '%s\\n' "$id" ;;
      *'.Mounts'*) if [[ "$CADDY_MOUNT_MODE" == swapped ]]; then [[ "$id" == "$web_id" ]] && printf 'volume|platform-infra_caddy_data|%s|/wrong|true\\nvolume|platform-infra_caddy_config|%s|/config|true\\nbind||/opt/catering-agents-platform/platform-infra/sites|/etc/caddy/sites|false\\n' "$FAKE_VOLUME_ROOT/platform-infra_caddy_data/_data" "$FAKE_VOLUME_ROOT/platform-infra_caddy_config/_data" || printf 'volume|shared-edge_edge_caddy_data|%s|/wrong|true\\nvolume|shared-edge_edge_caddy_config|%s|/config|true\\nbind||/opt/shared-edge/Caddyfile|/etc/caddy/Caddyfile|false\\n' "$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_data/_data" "$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_config/_data"; else [[ "$id" == "$web_id" ]] && printf 'volume|platform-infra_caddy_data|%s|/data|true\\nvolume|platform-infra_caddy_config|%s|/config|true\\nbind||/opt/catering-agents-platform/platform-infra/sites|/etc/caddy/sites|false\\n' "$FAKE_VOLUME_ROOT/platform-infra_caddy_data/_data" "$FAKE_VOLUME_ROOT/platform-infra_caddy_config/_data" || printf 'volume|shared-edge_edge_caddy_data|%s|/data|true\\nvolume|shared-edge_edge_caddy_config|%s|/config|true\\nbind||/opt/shared-edge/Caddyfile|/etc/caddy/Caddyfile|false\\n' "$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_data/_data" "$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_config/_data"; fi ;;
      *'.Name'*) [[ "$id" == "$web_id" ]] && printf '/platform-infra-web-1\\n' || printf '/shared-edge-edge-1\\n' ;;
      *'compose.project'*) [[ "$id" == "$web_id" ]] && printf 'platform-infra\\n' || printf 'shared-edge\\n' ;;
      *'compose.service'*) [[ "$id" == "$web_id" ]] && printf 'web\\n' || printf 'edge\\n' ;;
      *'.State.Status'*) printf 'running\\n' ;;
      *'.State.Health'*) printf 'healthy\\n' ;;
      *) exit 1 ;;
    esac ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o700 },
    );
    const run = (mode: string) =>
      runShell(
        `${helper}
DOCKER_CMD=${JSON.stringify(docker)}
fail_state() { printf '%s\\n' "$1" >&2; return 1; }
assert_caddy_container_mounts platform-infra web platform-infra-web-1 platform-infra_caddy_data platform-infra_caddy_config "$FAKE_VOLUME_ROOT/platform-infra_caddy_data/_data" "$FAKE_VOLUME_ROOT/platform-infra_caddy_config/_data" /opt/catering-agents-platform/platform-infra/sites /etc/caddy/sites
assert_caddy_container_mounts shared-edge edge shared-edge-edge-1 shared-edge_edge_caddy_data shared-edge_edge_caddy_config "$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_data/_data" "$FAKE_VOLUME_ROOT/shared-edge_edge_caddy_config/_data" /opt/shared-edge/Caddyfile /etc/caddy/Caddyfile
`,
        { CADDY_MOUNT_MODE: mode, FAKE_VOLUME_ROOT: path.join(root, "volumes") },
      );
    try {
      expect(run("valid").status).toBe(0);
      const rejected = run("swapped");
      expect(rejected.status).not.toBe(0);
      expect(String(rejected.stderr)).toContain("CADDY_CONTAINER_MOUNT_INVALID");
    } finally {
      removeFixture(root);
    }
  });

  test("Caddy capture binds source generation across the stream", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-caddy-generation-"));
    const sources = [
      path.join(root, "sites"),
      path.join(root, "platform-caddy-data"),
      path.join(root, "platform-caddy-config"),
      path.join(root, "shared-edge-caddyfile"),
      path.join(root, "shared-edge-caddy-data"),
      path.join(root, "shared-edge-caddy-config"),
    ];
    for (const sourcePath of sources) {
      if (sourcePath.endsWith("caddyfile")) writeFileSync(sourcePath, "caddy\n", { mode: 0o600 });
      else {
        mkdirSync(sourcePath, { mode: 0o700 });
        writeFileSync(path.join(sourcePath, "marker"), "generation-one\n", { mode: 0o600 });
      }
    }
    const common = path.join(repoRoot, files.common);
    const result = runShell(
      `source ${JSON.stringify(common)}
before="$(capture_source_generation ${sources.map((value) => JSON.stringify(value)).join(" ")})"
mv ${JSON.stringify(path.join(sources[0], "marker"))} ${JSON.stringify(path.join(sources[0], "marker.old"))}
printf 'generation-two\\n' > ${JSON.stringify(path.join(sources[0], "marker"))}
chmod 600 ${JSON.stringify(path.join(sources[0], "marker"))}
after="$(capture_source_generation ${sources.map((value) => JSON.stringify(value)).join(" ")})"
[[ -n "$before" && -n "$after" && "$before" != "$after" ]]`,
      { CATERING_BACKUP_ROOT: root, CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 0) },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
      expect(source(files.backup)).toContain("caddy_source_generation_before");
      expect(source(files.backup)).toContain("caddy_source_generation_after");
    } finally {
      removeFixture(root);
    }
  });

  test("restore rejects empty Caddy component roots", () => {
    const restore = source(files.restore);
    const marker = 'python3 - "$restored_tree" <<\'PY\' || fail_state RESTORE_ARTIFACT_INVALID';
    const start = restore.indexOf(marker);
    const bodyStart = restore.indexOf("\n", start) + 1;
    const bodyEnd = restore.indexOf("\nPY", bodyStart);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(bodyEnd).toBeGreaterThan(bodyStart);
    const python = restore.slice(bodyStart, bodyEnd);
    const root = mkdtempSync(path.join(tmpdir(), "catering-caddy-restore-"));
    const tree = path.join(root, "tree");
    mkdirSync(path.join(tree, "components/sites"), { recursive: true, mode: 0o700 });
    for (const component of ["platform_caddy_data", "platform_caddy_config", "shared_edge_caddy_data", "shared_edge_caddy_config"]) {
      mkdirSync(path.join(tree, `components/${component}`), { recursive: true, mode: 0o700 });
    }
    mkdirSync(path.join(tree, "components"), { recursive: true, mode: 0o700 });
    writeFileSync(path.join(tree, "manifest"), "manifest\n");
    writeFileSync(path.join(tree, "postgres_dump"), "dump\n");
    writeFileSync(path.join(tree, "components/shared_edge_caddyfile"), "caddy\n");
    const run = () => runShell(`python3 - ${JSON.stringify(tree)} <<'PY'\n${python}\nPY\n`);
    try {
      expect(run().status).not.toBe(0);
      for (const component of ["platform_caddy_data", "platform_caddy_config", "shared_edge_caddy_data", "shared_edge_caddy_config"]) {
        writeFileSync(path.join(tree, `components/${component}/sentinel`), "x");
      }
      writeFileSync(path.join(tree, "components/sites/sentinel"), "x");
      expect(run().status).toBe(0);
    } finally {
      removeFixture(root);
    }
  });

  test("collector interpreter binds an atypical Python path before fake PATH for a produced restore", () => {
    const fixture = createRestoreEntrypointFixture();
    const interpreterBin = path.join(fixture.root, "python space'$(literal)");
    mkdirSync(interpreterBin);
    const discovered = spawnSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" });
    try {
      expect(discovered.status, String(discovered.stderr)).toBe(0);
      const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
      const interpreter = path.join(interpreterBin, "bound-python");
      const trace = path.join(fixture.root, "interpreter-calls");
      // Discovery reports a controlled target; every target invocation still
      // executes real Python with its original arguments, stdin and descriptors.
      writeFileSync(path.join(interpreterBin, "python3"), `#!/bin/sh\nexec ${quote(discovered.stdout.trim())} -c 'import sys; code=sys.argv[1]; sys.executable=sys.argv[2]; exec(code)' "$2" ${quote(interpreter)}\n`, { mode: 0o755 });
      writeFileSync(interpreter, `#!/bin/bash
case "$1:$2" in
  -c:*sys.stdout.write*os.pread*) site=restic ;;
  -c:*datetime.fromisoformat*sys.argv*) site=date ;;
  -c:*json.load*) site=python-exec ;;
  -:%*) site=stat ;;
  -:*) site=python-stdin ;;
  *) site=setup ;;
esac
printf '%s\\n' "$site" >> ${quote(trace)}
exec ${quote(discovered.stdout.trim())} "$@"
`, { mode: 0o755 });
      const produced = fixture.invoke();
      expect(produced.status, String(produced.stderr)).toBe(0);
      const options = { pythonSearchPath: interpreterBin + path.delimiter + (process.env.PATH ?? "") };
      const accepted = runHelperWithActualRemote("complete", { root: fixture.root }, options);
      expect(accepted.status, String(accepted.stdout) + String(accepted.stderr)).toBe(0);
      expect(accepted.stdout).toContain("CLASSIFICATION\tbackup_channel\tBELEGT");
      expect(existsSync(trace), "collector bypassed the selected interpreter").toBe(true);
      const calls = readFileSync(trace, "utf8").trim().split("\n");
      for (const site of ["date", "stat", "python-stdin", "python-exec", "restic"]) expect(calls).toContain(site);
      expect(calls.filter(site => site === "restic").length).toBeGreaterThanOrEqual(4);
      const drifted = runHelperWithActualRemote("complete", { root: fixture.root, repositoryId: "c".repeat(64) }, options);
      expect(drifted.status).toBe(1);
      expect(drifted.stdout).toContain("EVIDENCE_ERROR\tREMOTE_OUTPUT_INVALID");
      expect(drifted.stdout).not.toContain("CLASSIFICATION\tbackup_channel\tBELEGT");
    } finally {
      removeFixture(fixture.root);
    }
  }, 120000);

  for (const prior of [false, true]) {
    for (const mode of ["id", "generation", "generation-password", "attestation", "stale", "rto", "rpo-boundary", "rto-boundary"] as const) {
      test(`late publication ${mode} with prior=${prior} uses the actual collector authority`, () => {
        const fixture = createRestoreEntrypointFixture();
        const { root, evidencePath, invoke } = fixture;
        const reader = (repositoryId?: string, nowEpoch = 1788480000) => runHelperWithActualRemote("complete", { root, nowEpoch, repositoryId });
        try {
          if (prior) {
            const success = invoke();
            expect(success.status, String(success.stderr)).toBe(0);
            const accepted = reader();
            expect(accepted.status, String(accepted.stdout)).toBe(0);
            expect(String(accepted.stdout)).toContain("CLASSIFICATION\tbackup_channel\tBELEGT");
          }
          const oldEvidence = existsSync(evidencePath) ? readFileSync(evidencePath) : undefined;
          const statusPath = path.join(root, "catering-backup-repository-status");
          const receipts = path.join(root, "restore-receipts");
          const generationFile = mode === "generation-password" ? fixture.password : fixture.repository;
          const priorRepositoryInode = statSync(generationFile).ino;
          const priorRepositoryContent = readFileSync(generationFile);
          const priorInode = existsSync(statusPath) ? statSync(statusPath).ino : 0;
          const priorReceipts = existsSync(receipts) ? readdirSync(receipts).length : 0;
          const marker = path.join(root, "late-marker");
          const result = invoke({
            FAKE_LATE_MODE: mode,
            FAKE_GENERATION_FILE: generationFile,
            FAKE_LATE_MARKER: marker,
            FAKE_RESTIC_COUNT: path.join(root, "late-restic-count"),
            FAKE_PRIOR_STATUS_INODE: String(priorInode),
            FAKE_PRIOR_RECEIPTS: String(priorReceipts),
            FAKE_BASE_EPOCH: String(1788480000 + (mode === "stale" || mode === "rpo-boundary" ? 21600 : 0)),
            FAKE_LATE_SECONDS: String(mode === "stale" ? 1 : mode === "rto" ? 14401 : mode === "rto-boundary" ? 14400 : 0),
          });
          expect(existsSync(marker), `${String(result.stderr)}; late injection was never reached`).toBe(true);
          expect(JSON.parse(readFileSync(marker, "utf8")).after_receipt_and_status).toBe(true);
          if (mode === "generation" || mode === "generation-password") {
            expect(existsSync(marker + ".generation-replaced"), String(result.stderr)).toBe(true);
            expect(statSync(generationFile).ino).not.toBe(priorRepositoryInode);
            expect(readFileSync(generationFile)).toEqual(priorRepositoryContent);
          }
          const boundary = mode.endsWith("boundary");
          if (boundary) {
            expect(result.status, String(result.stderr)).toBe(0);
            expect(readFileSync(evidencePath, "utf8")).toContain(`duration_seconds=${mode === "rto-boundary" ? 14400 : 0}\n`);
          } else {
            expect(result.status, `${mode} incorrectly published success`).not.toBe(0);
            const reason = { id: "REPOSITORY_ID_MISMATCH", generation: "REPOSITORY_GENERATION_CHANGED", "generation-password": "REPOSITORY_GENERATION_CHANGED", attestation: "ATTESTATION_INVALID", stale: "CANDIDATE_STALE", rto: "RESTORE_CLOCK_INVALID" }[mode as "id" | "generation" | "generation-password" | "attestation" | "stale" | "rto"];
            expect(String(result.stderr)).toContain(reason);
            expect(existsSync(evidencePath) ? readFileSync(evidencePath) : undefined).toEqual(oldEvidence);
          }
          // Clear only the injected transient fault. Persistent live drift must
          // still reject old proof; unreferenced preparation is not authority.
          writeFileSync(fixture.offhostAttestation, fixture.offhostAttestationText, { mode: 0o600 });
          const collected = reader(undefined, mode === "rpo-boundary" ? 1788501600 : mode === "rto-boundary" ? 1788494400 : 1788480000);
          if (prior || boundary) {
            expect(collected.status, String(collected.stdout)).toBe(0);
            expect(String(collected.stdout)).toContain("CLASSIFICATION\tbackup_channel\tBELEGT");
          } else {
            expect(collected.status).not.toBe(0);
            expect(String(collected.stdout)).toContain("EVIDENCE_STATUS\tUNKNOWN");
          }
          if (prior && mode === "id") {
            const drifted = reader("c".repeat(64));
            expect(drifted.status).not.toBe(0);
            expect(String(drifted.stdout)).not.toContain("CLASSIFICATION\tbackup_channel\tBELEGT");
          }
        } finally {
          removeFixture(root);
        }
      }, 300000);
    }
  }

  test("restore entrypoint fake exercises success, repeat, failure and stale cleanup gates", () => {
    const { root, runtime, pgLog, log, evidencePath, invoke } = createRestoreEntrypointFixture();
    const oldEvidence = "status=success\nchecksum=old\n";
    writeFileSync(evidencePath, oldEvidence, { mode: 0o600 });
    writeFileSync(pgLog, "", { mode: 0o600 });
    try {
      const success = invoke();
      expect(success.status, `${String(success.stderr)}\n${readFileSync(pgLog, "utf8")}`).toBe(0);
      expect(readFileSync(pgLog, "utf8")).toContain("initdb");
      const firstEvidence = readFileSync(evidencePath);
      expect(firstEvidence.toString()).toContain("status=success\n");
      expect(readFileSync(pgLog, "utf8").trim().split("\n").map((line) => line.split(" ", 1)[0])).toEqual([
        "initdb",
        "pg_ctl",
        "psql",
        "createdb",
        "pg_restore",
        "psql",
        "psql",
        "pg_ctl",
      ]);
      expect(String(readFileSync(log))).toContain("--repository-file /proc/self/fd/9");
      expect(invoke().status).toBe(0);
      const beforeFailure = readFileSync(evidencePath);
      for (const [failure, expectedCommands] of [
        ["initdb", ["initdb"]],
        ["pg_ctl", ["initdb", "pg_ctl"]],
        ["role", ["initdb", "pg_ctl", "psql", "pg_ctl"]],
        ["createdb", ["initdb", "pg_ctl", "psql", "createdb", "pg_ctl"]],
        ["pg_restore", ["initdb", "pg_ctl", "psql", "createdb", "pg_restore", "pg_ctl"]],
        ["table1", ["initdb", "pg_ctl", "psql", "createdb", "pg_restore", "psql", "pg_ctl"]],
        ["table2", ["initdb", "pg_ctl", "psql", "createdb", "pg_restore", "psql", "psql", "pg_ctl"]],
      ] as const) {
        writeFileSync(pgLog, "", { mode: 0o600 });
        const failed = invoke({ FAKE_PG_FAIL: failure });
        expect(failed.status, failure).not.toBe(0);
        expect(readFileSync(evidencePath)).toEqual(beforeFailure);
        const commands = readFileSync(pgLog, "utf8").trim().split("\n").filter(Boolean).map((line) => line.split(" ", 1)[0]);
        expect(commands).toEqual(expectedCommands);
      }
      expect(invoke({ FAKE_DOCKER_MODE: "restore-fail" }).status).not.toBe(0);
      expect(readFileSync(evidencePath)).toEqual(beforeFailure);
      const receiptDir = path.join(root, "restore-receipts");
      const receiptEntriesBeforeDrift = existsSync(receiptDir) ? readdirSync(receiptDir).sort() : [];
      const statusPath = path.join(root, "catering-backup-repository-status");
      const statusBeforeDrift = existsSync(statusPath) ? readFileSync(statusPath) : undefined;
      const drift = invoke({ FAKE_RESTIC_MODE: "repo-drift", FAKE_RESTIC_DRIFT_AT: "3", FAKE_RESTIC_COUNT: path.join(root, "restic-count-drift") });
      expect(drift.status).not.toBe(0);
      expect(readFileSync(evidencePath)).toEqual(beforeFailure);
      const receiptEntriesAfterDrift = existsSync(receiptDir) ? readdirSync(receiptDir).sort() : [];
      expect(receiptEntriesAfterDrift).toEqual(receiptEntriesBeforeDrift);
      expect(existsSync(statusPath) ? readFileSync(statusPath) : undefined).toEqual(statusBeforeDrift);
      const cleanupFailure = invoke({ FAKE_DOCKER_MODE: "cleanup-fail", FAKE_DOCKER_PS_COUNT: path.join(root, "docker-ps-count") });
      expect(cleanupFailure.status).not.toBe(0);
      expect(readFileSync(evidencePath)).toEqual(beforeFailure);
      const overRto = invoke({ FAKE_CLOCK_MODE: "over", FAKE_CLOCK_COUNT: path.join(root, "clock-count-over") });
      expect(overRto.status).not.toBe(0);
      expect(readFileSync(evidencePath)).toEqual(beforeFailure);
      const negativeRto = invoke({ FAKE_CLOCK_MODE: "negative", FAKE_CLOCK_COUNT: path.join(root, "clock-count-negative") });
      expect(negativeRto.status).not.toBe(0);
      expect(readFileSync(evidencePath)).toEqual(beforeFailure);
      const killed = invoke({ FAKE_RESTIC_MODE: "kill-final", FAKE_RESTIC_COUNT: path.join(root, "restic-count-kill") });
      expect(killed.status).not.toBe(0);
      expect(readFileSync(evidencePath)).toEqual(beforeFailure);
      const stale = invoke({ FAKE_DOCKER_PS: "stale-probe\n" });
      expect(stale.status).not.toBe(0);
      expect(String(stale.stderr)).toContain("RESTORE_STALE_PROBE");
    } finally {
      removeFixture(root);
    }
  }, 180000);

  test("off-host repository policy rejects local schemes and loopback authorities", () => {
    const common = source(files.common);
    const start = common.indexOf("validate_offhost_repository() {");
    const end = common.indexOf("\n}\n", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const policy = common.slice(start, end + 3);
    const run = (uri: string, resolved = "8.8.8.8") =>
      runShell(
        `fail_state() { printf '%s\\n' \"$1\" >&2; return 1; }\n${policy}\nvalidate_offhost_repository ${JSON.stringify(uri)}`,
        { CATERING_BACKUP_EXPECTED_UID: "501", CATERING_BACKUP_TEST_MODE: "1", CATERING_BACKUP_RESOLVED_ADDRESSES: resolved },
      );
    expect(run("s3:s3.example/catering").status).toBe(0);
    for (const uri of [
      "file:///tmp/backup",
      "s3:localhost/catering",
      "s3:127.0.0.1/catering",
      "rclone:file:backup",
      "rclone:./backup",
      "rclone:remote",
      "s3:user@backup.example/catering",
    ]) {
      const rejected = run(uri);
      expect(rejected.status).not.toBe(0);
      expect(String(rejected.stderr)).toMatch(/REPOSITORY_(?:LOCAL|INVALID)/);
    }
    const cgnat = run("s3:backup.example/catering", "100.64.0.1");
    expect(cgnat.status).not.toBe(0);
  });

  test("durable publication uses fsync, atomic replacement and parent-directory fsync", () => {
    const common = source(files.common);
    expect(common).toContain("os.fsync");
    expect(common).toContain("os.replace");
    expect(common).toContain("O_DIRECTORY");
    expect(common).toContain("atomic_write_record");
    for (const entrypoint of [source(files.backup), source(files.restore)]) {
      expect(entrypoint).toMatch(/source .*catering-backup-common\.sh/);
      expect(entrypoint).toContain("atomic_write_record");
      expect(entrypoint).not.toContain("os.replace");
    }
  });

  test("durability faults before and after replace have terminal semantics", () => {
    const common = source(files.common);
    const marker = "  python3 - \"$target\" \"$MAX_RECORD_BYTES\" \"$mode\" \"$source\" \"$payload\" \"$expected_uid\" <<'PY'\n";
    const start = common.indexOf(marker);
    const end = common.indexOf("\nPY\n}", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const writerPython = common.slice(start + marker.length, end);
    const encoded = Buffer.from(writerPython, "utf8").toString("base64");
    const runCase = (faultAt: number, expectedCode: string, expectedBytes: string) => {
      const root = mkdtempSync(path.join(tmpdir(), `catering-backup-durability-${faultAt}-`));
      const parent = path.join(root, "records");
      const target = path.join(parent, "evidence");
      mkdirSync(parent, { mode: 0o700 });
      writeFileSync(target, "status=success\nvalue=old\n", { mode: 0o600 });
      const script = [
        "import base64, os as real_os, sys, types",
        "proxy = types.ModuleType('os')",
        "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
        "calls = {'count': 0}",
        "def fake_fsync(fd):",
        "    calls['count'] += 1",
        `    if calls['count'] == ${faultAt}: raise OSError('injected fsync')`,
        "    return real_os.fsync(fd)",
        "proxy.fsync = fake_fsync",
        "sys.modules['os'] = proxy",
        `sys.argv = ['writer', ${JSON.stringify(target)}, '65536', 'payload', '', 'status=success\\nvalue=new\\n', ${JSON.stringify(String(process.getuid?.() ?? 0))}]`,
        `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<writer>', 'exec'), {})`,
      ].join("\n");
      try {
        const result = spawnSync("python3", ["-c", script], {
          encoding: "utf8",
          env: { ...process.env, CATERING_BACKUP_ROOT: root },
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(expectedCode);
        expect(readFileSync(target, "utf8")).toBe(expectedBytes);
      } finally {
        removeFixture(root);
      }
    };
    runCase(1, "STATE_PERSIST_FAILED", "status=success\nvalue=old\n");
    runCase(2, "EVIDENCE_DURABILITY_UNKNOWN", "status=success\nvalue=new\n");
  });

  test("restore is bound to the exact candidate, snapshot, repository, host and checksums", () => {
    const restore = source(files.restore);
    const common = source(files.common);
    expect(common).toContain("catering-backup-candidate");
    expect(restore).toContain("candidate_path");
    expect(restore).toContain("snapshot_id");
    expect(restore).toContain("repository_identity");
    expect(restore).toContain("artifact_checksum");
    expect(restore).toContain("host_binding");
    expect(restore).toContain("source_commit");
    expect(restore).toContain("source_tree");
    expect(restore).toContain('readonly BACKUP_SCOPE="postgres,sites,platform-caddy,shared-edge-caddy"');
    expect(restore).toContain('readonly RTO_SECONDS="14400"');
  });

  test("restore retrieves the exact Restic snapshot before any Docker mutation", () => {
    const restore = executableLines(source(files.restore));
    const resticIndex = restore.indexOf('restic_cmd dump "$snapshot_id" "$bundle_path"');
    const dockerRunIndex = restore.indexOf('"$DOCKER_CMD" run --name');
    expect(resticIndex).toBeGreaterThanOrEqual(0);
    expect(dockerRunIndex).toBeGreaterThan(resticIndex);
    expect(restore).toContain("verify_checksum");
    expect(restore.indexOf("verify_checksum")).toBeLessThan(dockerRunIndex);
  });

  test("restore uses one digest-pinned, networkless PostgreSQL probe with no published ports", () => {
    const restore = executableLines(source(files.restore));
    expect(restore).toContain("CATERING_RESTORE_POSTGRES_IMAGE");
    expect(restore).toContain("@sha256:[0-9a-f]{64}");
    expect(restore).toContain("--network none");
    expect(restore).toContain("--pull never");
    expect(restore).toContain("--rm");
    expect(restore).not.toMatch(/--network[ =](?:host|platform-infra_default|catering_|shared-edge|zeiterfassung)/);
    const dockerStart = restore.indexOf('"$DOCKER_CMD" run');
    const dockerEnd = restore.indexOf("-ceu '", dockerStart);
    expect(dockerStart).toBeGreaterThanOrEqual(0);
    expect(dockerEnd).toBeGreaterThan(dockerStart);
    const dockerCommand = restore.slice(dockerStart, dockerEnd);
    expect(dockerCommand).not.toMatch(/(^|\s)-p(\s|=)/m);
    expect(dockerCommand).not.toMatch(/(^|\s)--publish(\s|=)/m);
    expect(restore).not.toMatch(/\bdocker\s+compose\b/);
    expect(restore).not.toMatch(/\b(?:curl|wget|ssh|scp)\b/);
    expect((restore.match(/run --name[^\n]*--rm --network none/g) ?? []).length).toBe(1);
    expect(restore).toContain("--entrypoint /bin/sh");
    expect(restore).toContain(":/restore/postgres.dump:ro");
    expect(restore).toContain("initdb");
    expect(restore).toContain("pg_ctl");
    expect(restore).toContain("--user postgres");
    expect(restore).toContain("createdb --username=postgres --owner=catering catering_agents");
    expect(restore).toContain("--username=catering");
    expect(restore).toContain("--dbname=catering_agents");
    expect(restore).toContain("--no-owner");
    expect(restore).toContain("--no-privileges");
    expect(restore).toContain("os.fchmod(fd, 0o644 if member.name == \"postgres_dump\" else 0o600)");
    expect(restore).toContain("trap");
  });

  test("restore proves both authoritative PostgreSQL tables and the four-hour RTO", () => {
    const restore = source(files.restore);
    expect(restore).toContain("catering_business_records");
    expect(restore).toContain("catering_source_documents");
    expect(restore).toContain("pg_restore");
    expect(restore).toContain("--exit-on-error");
    expect(restore).toContain("duration_seconds");
    expect(restore).toContain('readonly RTO_SECONDS="14400"');
    expect(restore).toContain("duration_seconds");
  });

  test("RTO elapsed contract accepts zero and the boundary but rejects negative and over-limit", () => {
    const common = path.join(repoRoot, files.common);
    const root = mkdtempSync(path.join(tmpdir(), "catering-rto-"));
    const result = runShell(
      `set -euo pipefail
source ${JSON.stringify(common)}
rto_elapsed_allowed 0
rto_elapsed_allowed 14400
! rto_elapsed_allowed 14401
! rto_elapsed_allowed -1
`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
    } finally {
      removeFixture(root);
    }
  });

  test("only a successful restore promotes the existing evidence contract", () => {
    const restore = executableLines(source(files.restore));
    const common = executableLines(source(files.common));
    expect(common).toContain("catering-backup-evidence");
    expect(common).toContain("catering-backup-repository-status");
    expect(restore).toContain("catering-restore-receipt");
    expect(restore).toContain("receipt_path");
    expect(restore).toContain("receipt_checksum");
    const receiptIndex = restore.indexOf("write_restore_receipt");
    const repositoryIndex = restore.indexOf("write_repository_status");
    const evidenceIndex = restore.indexOf("promote_final_evidence");
    expect(receiptIndex).toBeGreaterThanOrEqual(0);
    expect(repositoryIndex).toBeGreaterThan(receiptIndex);
    expect(evidenceIndex).toBeGreaterThan(repositoryIndex);
    expect(restore).toContain("promote_final_evidence");
  });

  test("restore consumes only the restored tree and verifies cleanup before promotion", () => {
    const restore = executableLines(source(files.restore));
    expect(restore).toContain('restic_cmd dump "$snapshot_id" "$bundle_path"');
    expect(restore).toContain('stream.tar');
    expect(restore).toContain('restored_manifest="$restored_tree/manifest"');
    expect(restore).toContain('restored_postgres_dump="$restored_tree/$(basename "$postgres_dump_path")"');
    expect(restore).toContain("restored_tree");
    expect(restore).toContain("cleanup_restore_root");
    expect(restore.indexOf("cleanup_restore_root || fail_state RESTORE_CLEANUP_FAILED")).toBeLessThan(
      restore.indexOf("receipt_path=\"$receipt_dir/"),
    );
    expect(restore.indexOf("promote_final_evidence")).toBeGreaterThan(restore.indexOf("receipt_checksum"));
    expect(restore).toContain("shutil.rmtree");
    expect(restore).not.toContain("/usr/bin/trash");
  });

  test("secret recovery provenance remains bound through candidate, receipt and evidence", () => {
    const backup = source(files.backup);
    const restore = source(files.restore);
    expect(backup).toContain("CATERING_SECRET_RECOVERY_REFERENCE_SHA256");
    expect(backup).toContain("secret_recovery_reference_sha256=$CATERING_SECRET_RECOVERY_REFERENCE_SHA256");
    expect(restore).toContain("CATERING_SECRET_RECOVERY_REFERENCE_SHA256");
    expect(restore).toContain("secret_recovery_reference_sha256");
    const collector = source("platform-infra/scripts/catering-production-evidence.sh");
    expect(collector).toContain("secret_recovery_reference_sha256");
  });

  test("repository identity is checked before any receipt/status/evidence publication", () => {
    const restore = executableLines(source(files.restore));
    const identityCheck = restore.indexOf('[[ "$live_repository_identity" == "$repository_identity" ]]');
    const restoreCall = restore.indexOf('restic_cmd dump "$snapshot_id" "$bundle_path"');
    const firstAtomicWrite = restore.indexOf("atomic_write_record");
    expect(identityCheck).toBeGreaterThanOrEqual(0);
    expect(identityCheck).toBeLessThan(restoreCall);
    expect(firstAtomicWrite).toBeGreaterThan(restoreCall);
    expect(restore).toContain("REPOSITORY_ID_MISMATCH");
  });

  test("repository status binding rejects drift and future timestamps", () => {
    const common = source(files.common);
    const recordStart = common.indexOf("validate_repository_status_record() {");
    const recordEnd = common.indexOf("\nvalidate_open_fd() {", recordStart);
    const bindingStart = common.indexOf("validate_repository_status_binding() {");
    const bindingEnd = common.indexOf("\nvalidate_open_fd() {", bindingStart);
    expect(recordStart).toBeGreaterThanOrEqual(0);
    expect(bindingStart).toBeGreaterThanOrEqual(0);
    const functions = `${common.slice(recordStart, recordEnd)}\n${common.slice(bindingStart, bindingEnd)}`;
    const run = (record: string): ReturnType<typeof runShell> => runShell(`fail_state() { return 1; }\nrequire_timestamp() { [[ \"$1\" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; }\nrequire_digest() { [[ \"$1\" =~ ^[0-9a-f]{64}$ ]]; }\n${functions}\nvalidate_repository_status_binding \"$STATUS_RECORD\" ${"b".repeat(64)} ${"c".repeat(64)} postgres,sites,platform-caddy,shared-edge-caddy`, { CATERING_BACKUP_EXPECTED_UID: "501", STATUS_RECORD: record });
    const now = String(spawnSync("date", ["-u", "+%Y-%m-%dT%H:%M:%SZ"], { encoding: "utf8" }).stdout).trim();
    const valid = `status=read-only-verified\nidentity=${"b".repeat(64)}\nhost_binding=${"c".repeat(64)}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=${now}`;
    const validResult = run(valid);
    expect(validResult.status, String(validResult.stderr)).toBe(0);
    expect(run(valid.replace(/host_binding=c+/, `host_binding=${"x".repeat(64)}`)).status).not.toBe(0);
    expect(run(valid.replace(/verified_at=.*/, "verified_at=2099-01-01T00:00:00Z")).status).not.toBe(0);
  });

  test("RPO timestamp starts at capture and RTO is gated before final evidence", () => {
    const backup = source(files.backup);
    const restore = source(files.restore);
    const backupStart = backup.indexOf('backup_started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"');
    expect(backupStart).toBeGreaterThanOrEqual(0);
    expect(backupStart).toBeLessThan(backup.indexOf("prepare_backup_root()"));
    expect(backupStart).toBeLessThan(backup.indexOf("postgres_container_id="));
    expect(backup).toContain("backup_started_at");
    expect(backup).toContain("created_at=$backup_started_at");
    expect(restore).toContain("rto_prepare_elapsed");
    expect(restore).toContain("RESTORE_TIMEOUT");
    expect(restore.indexOf("rto_prepare_elapsed")).toBeLessThan(restore.indexOf("promote_final_evidence"));
    expect(restore.indexOf("rto_prepare_elapsed")).toBeLessThan(restore.indexOf('receipt_path="$receipt_dir/'));
    expect(restore.lastIndexOf("duration_seconds")).toBeLessThan(restore.indexOf("promote_final_evidence"));
  });

  test("restore validates the state-root and receipt directory trust boundaries before writes", () => {
    const restore = source(files.restore);
    expect(restore).toContain("assert_root_mode");
    expect(restore).toContain("BACKUP_ROOT");
    expect(restore).toContain("assert_directory_mode");
    expect(restore).toContain("RESTORE_CLEANUP_FAILED");
  });

  test("record payload parser rejects duplicate and control-byte fields", () => {
    const common = path.join(repoRoot, files.common);
    const roots = [
      mkdtempSync(path.join(tmpdir(), "catering-backup-parser-")),
      mkdtempSync(path.join(tmpdir(), "catering-backup-parser-")),
      mkdtempSync(path.join(tmpdir(), "catering-backup-parser-")),
    ];
    const uid = process.getuid?.() ?? 0;
    const readAndValidate = (pathname: string) =>
      runShell(
        `source ${JSON.stringify(common)}\n` +
          `payload="$(read_bounded_record ${JSON.stringify(pathname)} 128 ${uid})"\n` +
          `validate_record_payload "$payload"`,
        { CATERING_BACKUP_ROOT: path.dirname(pathname) },
      );
    try {
      const duplicatePath = path.join(roots[0], "record.json");
      const controlPath = path.join(roots[1], "record.json");
      const nulPath = path.join(roots[2], "record.json");
      writeFileSync(duplicatePath, "status=candidate\nstatus=other\n", { mode: 0o600 });
      writeFileSync(controlPath, "status=candidate\r\n", { mode: 0o600 });
      writeFileSync(nulPath, Buffer.from("status=candidate\nvalue=bad\u0000bytes\n"), { mode: 0o600 });
      const duplicate = readAndValidate(duplicatePath);
      const control = readAndValidate(controlPath);
      const nul = readAndValidate(nulPath);
      expect(duplicate.status).not.toBe(0);
      expect(control.status).not.toBe(0);
      expect(nul.status).not.toBe(0);
      expect(duplicate.stderr).toMatch(/RECORD_DUPLICATE_FIELD|STATE_INVALID/);
      expect(control.stderr).toMatch(/STATE_FORMAT_INVALID|STATE_ENCODING_INVALID|STATE_INVALID/);
      expect(nul.stderr).toContain("STATE_ENCODING_INVALID");
    } finally {
      roots.forEach(removeFixture);
    }
  });

  test("backup and restore require the independent secret recovery reference", () => {
    const backup = source(files.backup);
    const restore = source(files.restore);
    expect(backup).toContain(': "${CATERING_SECRET_RECOVERY_REFERENCE_SHA256:?');
    expect(restore).toContain(': "${CATERING_SECRET_RECOVERY_REFERENCE_SHA256:?');
    expect(restore).toContain("SECRET_REFERENCE_MISMATCH");
    expect(restore).toContain("candidate_secret_reference");
    expect(restore).toContain("artifact_secret_reference");
  });

  test("restore uses a closed-world schema for every persisted record slot", () => {
    const restore = source(files.restore);
    expect(restore).toContain("validate_record_schema");
    for (const field of ["status", "scope", "host_binding", "source_commit", "source_tree", "snapshot_id", "repository_identity", "secret_recovery_reference_sha256"]) {
      expect(restore).toContain(field);
    }
    expect(restore).toContain("RECORD_UNKNOWN_FIELD");
    expect(restore).toContain("RECORD_DUPLICATE_FIELD");
  });

  test("the timer defines the exact six-hour UTC schedule and remains inert in Git", () => {
    const timer = source(files.timer);
    expect(timer).toContain("OnCalendar=*-*-* 00,06,12,18:00:00 UTC");
    expect(timer).toContain("Persistent=true");
    expect(timer).toContain("Unit=catering-backup.service");
    expect(timer).not.toMatch(/RandomizedDelaySec=(?!0\b)/);
  });

  test("the future oneshot cycle runs backup before restore and has a four-hour ceiling", () => {
    const service = source(files.service);
    expect(service).toContain("catering-backup.sh");
    expect(service).not.toContain("catering-restore-probe.sh");
    expect(service).toContain("Type=oneshot");
    expect(service).toContain("TimeoutStartSec=1h");
    expect(service).toContain("OnSuccess=catering-restore-probe.service");
    expect(service).toContain("EnvironmentFile=/etc/catering-backup/catering-backup.env");
    expect(service).toContain("NoNewPrivileges=true");
    expect(service).toContain("ProtectSystem=strict");

    const restoreService = source(files.restoreService);
    expect(restoreService).toContain("catering-restore-probe.sh");
    expect(restoreService).toContain("TimeoutStartSec=4h");
    expect(restoreService).not.toContain("WantedBy=");
  });

  test("the environment schema contains names and placeholders but no usable secrets", () => {
    const env = source(files.env);
    for (const name of [
      "CATERING_BACKUP_EXPECTED_HOST_SHA256",
      "CATERING_BACKUP_SOURCE_COMMIT",
      "CATERING_BACKUP_SOURCE_TREE",
      "CATERING_BACKUP_REPOSITORY_FILE",
      "CATERING_BACKUP_PASSWORD_FILE",
      "CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256",
      "CATERING_BACKUP_EXPECTED_REPOSITORY_ID",
      "CATERING_BACKUP_PRODUCTION_HOST_SHA256",
      "CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES",
      "CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES",
      "CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256",
      "CATERING_OFFHOST_ATTESTATION_FILE",
      "CATERING_OFFHOST_ATTESTATION_SHA256",
      "CATERING_SECRET_RECOVERY_ATTESTATION_FILE",
      "CATERING_SECRET_RECOVERY_ATTESTATION_SHA256",
      "CATERING_SECRET_RECOVERY_SOURCE_TYPE",
      "CATERING_SECRET_RECOVERY_SOURCE_REFERENCE",
      "CATERING_REQUIRED_SECRET_SCHEMA_SHA256",
      "CATERING_RESTORE_RUNTIME_ROOT",
      "CATERING_RESTORE_POSTGRES_IMAGE",
      "CATERING_SECRET_RECOVERY_REFERENCE_SHA256",
    ]) {
      expect(env).toContain(`${name}=`);
    }
    expect(env).not.toMatch(/(?:password|secret|token|private[_-]?key)\s*=\s*\S+/i);
  });

  test("the runbook keeps installation and every real operation behind separate gates", () => {
    const runbook = source(files.runbook);
    expect(runbook).toContain("RPO: 6 Stunden");
    expect(runbook).toContain("RTO: 4 Stunden");
    expect(runbook).toContain("repository-only");
    expect(runbook).toContain("kein Backup ausgeführt");
    expect(runbook).toContain("kein Restore ausgeführt");
    expect(runbook).toContain("separate Freigabe");
    expect(runbook).toContain("Phase 3");
    expect(runbook).toContain("Ports 80/443");
  });

  test("atomic writer publishes an exact record with restrictive mode and full readback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-writer-"));
    const target = path.join(root, "record.json");
    const payload = "status=candidate\nscope=postgres,sites,platform-caddy,shared-edge-caddy\n";
    const common = path.join(repoRoot, files.common);
    const result = runShell(
      `source ${JSON.stringify(common)}\n` +
        `atomic_write_record ${JSON.stringify(target)} "$CATERING_TEST_PAYLOAD"`,
      { CATERING_BACKUP_ROOT: root, CATERING_TEST_PAYLOAD: payload },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
      expect(readFileSync(target, "utf8")).toBe(payload);
      expect(statSync(target).mode & 0o777).toBe(0o600);
      expect(readdirSync(root)).toEqual(["record.json"]);
      const reader = runShell(
        `source ${JSON.stringify(common)}\n` +
          `read_bounded_record ${JSON.stringify(target)} "$MAX_RECORD_BYTES" ${process.getuid?.() ?? 0}`,
        { CATERING_BACKUP_ROOT: root },
      );
      expect(reader.status, String(reader.stderr)).toBe(0);
      expect(reader.stdout).toBe(payload);
    } finally {
      removeFixture(root);
    }
  });

  test("binary-safe atomic_replace preserves every byte including the final newline", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-replace-"));
    const sourcePath = path.join(root, "source-record");
    const target = path.join(root, "record.json");
    const payload = "status=candidate\nscope=postgres,sites,platform-caddy,shared-edge-caddy\n";
    const common = path.join(repoRoot, files.common);
    writeFileSync(sourcePath, payload, { mode: 0o600 });
    const result = runShell(
      `source ${JSON.stringify(common)}\n` +
        `atomic_replace ${JSON.stringify(sourcePath)} ${JSON.stringify(target)}`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
      expect(readFileSync(target, "utf8")).toBe(payload);
      const reader = runShell(
        `source ${JSON.stringify(common)}\n` +
          `read_bounded_record ${JSON.stringify(target)} "$MAX_RECORD_BYTES" ${process.getuid?.() ?? 0}`,
        { CATERING_BACKUP_ROOT: root },
      );
      expect(reader.status, String(reader.stderr)).toBe(0);
      expect(reader.stdout).toBe(payload);
    } finally {
      removeFixture(root);
    }
  });

  test("atomic writer completes short writes and retries EINTR", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-short-write-"));
    const target = path.join(root, "record.json");
    const common = source(files.common);
    const marker = "  python3 - \"$target\" \"$MAX_RECORD_BYTES\" \"$mode\" \"$source\" \"$payload\" \"$expected_uid\" <<'PY'\n";
    const start = common.indexOf(marker);
    const end = common.indexOf("\nPY\n}", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const writerPython = common.slice(start + marker.length, end);
    const encoded = Buffer.from(writerPython, "utf8").toString("base64");
    const harness = [
      "import base64, os, sys",
      "real_write = os.write",
      "calls = {'count': 0}",
      "def short_write(fd, data):",
      "    if calls['count'] == 0:",
      "        calls['count'] += 1",
      "        return real_write(fd, data[:1])",
      "    if calls['count'] == 1:",
      "        calls['count'] += 1",
      "        raise InterruptedError()",
      "    return real_write(fd, data)",
      "os.write = short_write",
      `sys.argv = ['writer', ${JSON.stringify(target)}, '65536', 'payload', '', 'status=candidate\\nscope=postgres,sites,platform-caddy,shared-edge-caddy\\n']`,
      `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<writer>', 'exec'), {})`,
    ].join("\n");
    try {
      const result = spawnSync("python3", ["-c", harness], {
        encoding: "utf8",
        env: { ...process.env, CATERING_BACKUP_ROOT: root },
      });
      expect(result.status, String(result.stderr)).toBe(0);
      expect(readFileSync(target, "utf8")).toBe("status=candidate\nscope=postgres,sites,platform-caddy,shared-edge-caddy\n");
      expect(statSync(target).mode & 0o777).toBe(0o600);
    } finally {
      removeFixture(root);
    }
  });

  test("binary-safe atomic_replace rejects NUL bytes before publishing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-nul-"));
    const sourcePath = path.join(root, "source-record");
    const target = path.join(root, "record.json");
    const common = path.join(repoRoot, files.common);
    writeFileSync(sourcePath, Buffer.from("status=candidate\nvalue=bad\u0000bytes\n"), { mode: 0o600 });
    const result = runShell(
      `source ${JSON.stringify(common)}\n` +
        `atomic_replace ${JSON.stringify(sourcePath)} ${JSON.stringify(target)}`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("STATE_INVALID");
      expect(existsSync(target)).toBe(false);
    } finally {
      removeFixture(root);
    }
  });

  test("writer rejects an invalid small record before publishing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-invalid-"));
    const target = path.join(root, "record.json");
    const common = path.join(repoRoot, files.common);
    const result = runShell(
      `set -euo pipefail\nsource ${JSON.stringify(common)}\n` +
        `atomic_write_record ${JSON.stringify(target)} ${JSON.stringify("not-a-record")}`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("STATE_INVALID");
      expect(existsSync(target)).toBe(false);
    } finally {
      removeFixture(root);
    }
  });

  test("writer and reader share the exact UTF-8 byte boundary", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-boundary-"));
    const target = path.join(root, "record.json");
    const oversizeTarget = path.join(root, "oversize-record.json");
    const common = path.join(repoRoot, files.common);
    const acceptedPayload = `status=${"x".repeat(56)}\n`;
    const rejectedPayload = `status=${"x".repeat(57)}\n`;
    expect(Buffer.byteLength(acceptedPayload, "utf8")).toBe(64);
    expect(Buffer.byteLength(rejectedPayload, "utf8")).toBe(65);
    try {
      const accepted = runShell(
        `source ${JSON.stringify(common)}\n` +
          `atomic_write_record ${JSON.stringify(target)} "$CATERING_TEST_PAYLOAD"`,
        { CATERING_BACKUP_ROOT: root, CATERING_BACKUP_MAX_RECORD_BYTES: "64", CATERING_TEST_PAYLOAD: acceptedPayload },
      );
      expect(accepted.status, String(accepted.stderr)).toBe(0);
      const read = runShell(
        `source ${JSON.stringify(common)}\nread_bounded_record ${JSON.stringify(target)} 64 ${process.getuid?.() ?? 0}`,
        { CATERING_BACKUP_ROOT: root, CATERING_BACKUP_MAX_RECORD_BYTES: "64" },
      );
      expect(read.status, String(read.stderr)).toBe(0);
      expect(read.stdout).toBe(acceptedPayload);
      const rejected = runShell(
        `source ${JSON.stringify(common)}\n` +
          `atomic_write_record ${JSON.stringify(oversizeTarget)} "$CATERING_TEST_PAYLOAD"`,
        { CATERING_BACKUP_ROOT: root, CATERING_BACKUP_MAX_RECORD_BYTES: "64", CATERING_TEST_PAYLOAD: rejectedPayload },
      );
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain("STATE_TOO_LARGE");
      expect(readFileSync(target, "utf8")).toBe(acceptedPayload);
      expect(existsSync(oversizeTarget)).toBe(false);
    } finally {
      removeFixture(root);
    }
  });

  test("common reader is descriptor-bound, owner/mode strict, and bounded before parse", () => {
    const common = source(files.common);
    expect(common).toContain("os.O_NOFOLLOW");
    expect(common).toContain("os.fstat");
    expect(common).toContain("info.st_uid != expected_uid");
    expect(common).toContain("STATE_TOO_LARGE");
    expect(common).toContain("STATE_MODE_INVALID");
    expect(common).toContain("STATE_PATH_INVALID");
    expect(common).toContain("(before.st_dev, before.st_ino) != (info.st_dev, info.st_ino)");
    expect(common).toContain('expected_uid="${3:-0}"');
  });

  test("reader accepts a writer record only for the explicit test UID and rejects root-only default", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-reader-"));
    const target = path.join(root, "record.json");
    const common = path.join(repoRoot, files.common);
    const payload = "status=candidate\n";
    writeFileSync(target, payload, { mode: 0o600 });
    const uid = process.getuid?.() ?? 0;
    const accepted = runShell(
      `source ${JSON.stringify(common)}\nread_bounded_record ${JSON.stringify(target)} 64 ${uid}`,
      { CATERING_BACKUP_ROOT: root },
    );
    const productionDefault = runShell(
      `source ${JSON.stringify(common)}\nread_bounded_record ${JSON.stringify(target)} 64`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(accepted.status, String(accepted.stderr)).toBe(0);
      expect(accepted.stdout).toBe(payload);
      expect(productionDefault.status).not.toBe(0);
      expect(productionDefault.stderr).toContain("STATE_MODE_INVALID");
    } finally {
      removeFixture(root);
    }
  });

  test("reader rejects symlink, FIFO, wrong mode and oversize files without blocking", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-reader-negative-"));
    const valid = path.join(root, "valid-record");
    const symlink = path.join(root, "symlink-record");
    const fifo = path.join(root, "fifo-record");
    const wrongMode = path.join(root, "wrong-mode");
    const huge = path.join(root, "huge-record");
    const common = path.join(repoRoot, files.common);
    const uid = process.getuid?.() ?? 0;
    writeFileSync(valid, "status=candidate\n", { mode: 0o600 });
    symlinkSync(valid, symlink);
    expect(spawnSync("mkfifo", [fifo], { encoding: "utf8" }).status).toBe(0);
    writeFileSync(wrongMode, "status=candidate\n", { mode: 0o600 });
    chmodSync(wrongMode, 0o644);
    writeFileSync(huge, "x".repeat(65), { mode: 0o600 });
    const read = (pathname: string, limit = 64) =>
      runShell(
        `source ${JSON.stringify(common)}\nread_bounded_record ${JSON.stringify(pathname)} ${limit} ${uid}`,
        { CATERING_BACKUP_ROOT: root },
      );
    try {
      expect(read(symlink).stderr).toContain("STATE_PATH_INVALID");
      expect(read(fifo).stderr).toContain("STATE_PATH_INVALID");
      expect(read(wrongMode).stderr).toContain("STATE_MODE_INVALID");
      expect(read(huge, 64).stderr).toContain("STATE_TOO_LARGE");
      for (const pathname of [symlink, fifo, wrongMode, huge]) {
        expect(read(pathname).status).not.toBe(0);
      }
    } finally {
      removeFixture(root);
    }
  });

  test("bounded reader rejects a record with more than one terminal LF", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-reader-terminal-lf-"));
    const target = path.join(root, "record");
    const common = path.join(repoRoot, files.common);
    writeFileSync(target, "status=candidate\n\n", { mode: 0o600 });
    try {
      const result = runShell(
        `source ${JSON.stringify(common)}\nread_bounded_record ${JSON.stringify(target)} 64 ${process.getuid?.() ?? 0}`,
        { CATERING_BACKUP_ROOT: root },
      );
      expect(result.status).not.toBe(0);
      expect(String(result.stderr)).toContain("STATE_FORMAT_INVALID");
    } finally {
      removeFixture(root);
    }
  });

  test("reader fails closed when the path inode changes between lstat and open", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-reader-inode-"));
    const target = path.join(root, "record.json");
    const common = source(files.common);
    const readerStart = common.indexOf("read_bound_text() {");
    const marker = 'python3 - "$path" "$limit" "$expected_uid" "$expected_digest" "$single_line" <<\'PY\'\n';
    const start = common.indexOf(marker, readerStart);
    expect(readerStart).toBeGreaterThanOrEqual(0);
    const end = common.indexOf("\nPY\n}", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const readerPython = common.slice(start + marker.length, end);
    const payload = "status=candidate\n";
    writeFileSync(target, payload, { mode: 0o600 });
    const encoded = Buffer.from(readerPython, "utf8").toString("base64");
    const shim = [
      "import base64, os as real_os, sys, types",
      "proxy = types.ModuleType('os')",
      "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
      `target = ${JSON.stringify(target)}`,
      "swapped = {'done': False}",
      "def fake_lstat(path):",
      "    result = real_os.lstat(path)",
      "    if path == target and not swapped['done']:",
      "        swapped['done'] = True",
      "        real_os.rename(path, path + '.old')",
      "        with real_os.fdopen(real_os.open(path, real_os.O_WRONLY | real_os.O_CREAT | real_os.O_EXCL, 0o600), 'wb') as handle:",
      `            handle.write(${JSON.stringify(payload)}.encode())`,
      "    return result",
      "proxy.lstat = fake_lstat",
      "sys.modules['os'] = proxy",
      `sys.argv = ['reader', ${JSON.stringify(target)}, '64', ${JSON.stringify(String(process.getuid?.() ?? 0))}, '', '0']`,
      `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<reader>', 'exec'), {})`,
    ].join("\n");
    try {
      const result = spawnSync("python3", ["-c", shim], { encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("STATE_PATH_CHANGED");
    } finally {
      removeFixture(root);
    }
  });

  test("writer fails closed outside the bound root and through a symlink parent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-path-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-backup-outside-"));
    const common = path.join(repoRoot, files.common);
    const payload = "status=candidate\n";
    const outsideResult = runShell(
      `set -euo pipefail\nsource ${JSON.stringify(common)}\n` +
        `atomic_write_record ${JSON.stringify(path.join(outside, "record.json"))} ${JSON.stringify(payload)}`,
      { CATERING_BACKUP_ROOT: root },
    );
    const link = path.join(root, "linked");
    symlinkSync(outside, link);
    const symlinkResult = runShell(
      `set -euo pipefail\nsource ${JSON.stringify(common)}\n` +
        `atomic_write_record ${JSON.stringify(path.join(link, "record.json"))} ${JSON.stringify(payload)}`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(outsideResult.status).not.toBe(0);
      expect(outsideResult.stderr).toContain("STATE_PATH_INVALID");
      expect(symlinkResult.status).not.toBe(0);
      expect(symlinkResult.stderr).toContain("STATE_PATH_INVALID");
    } finally {
      removeFixture(root);
      removeFixture(outside);
    }
  });

  test("writer rejects a symlinked root and an existing FIFO target", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-root-"));
    const rootAlias = `${root}-alias`;
    const common = path.join(repoRoot, files.common);
    const payload = "status=candidate\n";
    symlinkSync(root, rootAlias);
    const aliasResult = runShell(
      `source ${JSON.stringify(common)}\n` +
        `atomic_write_record ${JSON.stringify(path.join(rootAlias, "record.json"))} ${JSON.stringify(payload)}`,
      { CATERING_BACKUP_ROOT: rootAlias },
    );
    const fifo = path.join(root, "record.json");
    expect(spawnSync("mkfifo", [fifo], { encoding: "utf8" }).status).toBe(0);
    const fifoResult = runShell(
      `source ${JSON.stringify(common)}\n` +
        `atomic_write_record ${JSON.stringify(fifo)} ${JSON.stringify(payload)}`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(aliasResult.status).not.toBe(0);
      expect(aliasResult.stderr).toContain("STATE_PATH_INVALID");
      expect(fifoResult.status).not.toBe(0);
      expect(fifoResult.stderr).toContain("STATE_PATH_INVALID");
    } finally {
      removeFixture(rootAlias);
      removeFixture(root);
    }
  });

  test("atomic writer guards stay fail-closed when called in an OR context", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-or-context-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-backup-or-outside-"));
    const common = path.join(repoRoot, files.common);
    const payload = "status=candidate\n";
    const target = path.join(outside, "record.json");
    const sourcePath = path.join(root, "source-record");
    writeFileSync(sourcePath, payload, { mode: 0o600 });
    const result = runShell(
      `source ${JSON.stringify(common)}
fail_state() { printf '%s\\n' "$1" >&2; return 1; }
write_rc=0
atomic_write_record ${JSON.stringify(target)} "$CATERING_TEST_PAYLOAD" || write_rc=$?
replace_rc=0
atomic_replace ${JSON.stringify(sourcePath)} ${JSON.stringify(target)} || replace_rc=$?
[[ "$write_rc" -ne 0 && "$replace_rc" -ne 0 ]]
test ! -e ${JSON.stringify(target)}`,
      { CATERING_BACKUP_ROOT: root, CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 0), CATERING_TEST_PAYLOAD: payload },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
      expect(result.stderr).toContain("STATE_PATH_INVALID");
      expect(existsSync(target)).toBe(false);
    } finally {
      removeFixture(root);
      removeFixture(outside);
    }
  });

  test("bounded reader guards stay fail-closed in command substitution and OR contexts", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-reader-or-context-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-backup-reader-or-outside-"));
    const common = path.join(repoRoot, files.common);
    const target = path.join(outside, "record.json");
    writeFileSync(target, "status=candidate\n", { mode: 0o600 });
    const result = runShell(
      `source ${JSON.stringify(common)}
fail_state() { printf '%s\\n' "$1" >&2; return 1; }
read_rc=0
read_value="$(read_bounded_record ${JSON.stringify(target)} 64 ${process.getuid?.() ?? 0})" || read_rc=$?
[[ "$read_rc" -ne 0 ]]
test -z "\${read_value:-}"`,
      { CATERING_BACKUP_ROOT: root, CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 0) },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
      expect(result.stderr).toContain("STATE_PATH_INVALID");
      expect(result.stdout).not.toContain("status=candidate");
    } finally {
      removeFixture(root);
      removeFixture(outside);
    }
  });

  test("atomic publication rejects a parent swap after the outer path check", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-parent-swap-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-backup-parent-swap-outside-"));
    const parent = path.join(root, "records");
    const movedParent = path.join(root, "records-original");
    const target = path.join(parent, "evidence");
    const outsideTarget = path.join(outside, "evidence");
    const common = path.join(repoRoot, files.common);
    const previous = "status=success\nvalue=old\n";
    const replacement = "status=success\nvalue=new\n";
    mkdirSync(parent, { mode: 0o700 });
    writeFileSync(target, previous, { mode: 0o600 });
     const result = runShell(
      "source " + JSON.stringify(common) + "\n" +
        "original=\"$(declare -f _atomic_publish)\"\n" +
        "original=\"${original/_atomic_publish/_atomic_publish_impl}\"\n" +
        "eval \"$original\"\n" +
        "_atomic_publish() {\n" +
        "  mv -- " + JSON.stringify(parent) + " " + JSON.stringify(movedParent) + "\n" +
        "  ln -s -- " + JSON.stringify(outside) + " " + JSON.stringify(parent) + "\n" +
        "  _atomic_publish_impl \"$@\"\n" +
        "}\n" +
        "write_rc=0\n" +
        "atomic_write_record " + JSON.stringify(target) + " \"$CATERING_TEST_PAYLOAD\" || write_rc=$?\n" +
        "printf 'write_rc=%s\\n' \"$write_rc\"",
     { CATERING_BACKUP_ROOT: root, CATERING_TEST_PAYLOAD: replacement },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
     expect(result.stdout).toContain("write_rc=");
      expect(Number(String(result.stdout).match(/write_rc=(\d+)/)?.[1])).not.toBe(0);
      expect(existsSync(outsideTarget)).toBe(false);
      expect(readFileSync(path.join(movedParent, "evidence"), "utf8")).toBe(previous);
    } finally {
      removeFixture(root);
      removeFixture(outside);
    }
  });

  test("atomic publication rejects parent drift during the final readback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-final-readback-swap-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-backup-final-readback-outside-"));
    const parent = path.join(root, "records");
    const movedParent = path.join(root, "records-original");
    const target = path.join(parent, "evidence");
    const outsideTarget = path.join(outside, "evidence");
    const common = source(files.common);
    const previous = "status=success\nvalue=old\n";
    const marker = "  python3 - \"$target\" \"$MAX_RECORD_BYTES\" \"$mode\" \"$source\" \"$payload\" \"$expected_uid\" <<'PY'\n";
    const start = common.indexOf(marker);
    const end = common.indexOf("\nPY\n}", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const writerPython = common.slice(start + marker.length, end);
    const encoded = Buffer.from(writerPython, "utf8").toString("base64");
    mkdirSync(parent, { mode: 0o700 });
    const script = [
      "import base64, os as real_os, sys, types",
      "proxy = types.ModuleType('os')",
      "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
      `parent = ${JSON.stringify(parent)}`,
      `moved = ${JSON.stringify(movedParent)}`,
      `outside = ${JSON.stringify(outside)}`,
      "swapped = {'done': False}",
      "def fake_read(fd, length):",
      "    data = real_os.read(fd, length)",
      "    if data and not swapped['done']:",
      "        swapped['done'] = True",
      "        real_os.rename(parent, moved)",
      "        real_os.symlink(outside, parent)",
      "    return data",
      "proxy.read = fake_read",
      "sys.modules['os'] = proxy",
      `sys.argv = ['writer', ${JSON.stringify(target)}, '65536', 'payload', '', 'status=success\\nvalue=new\\n', ${JSON.stringify(String(process.getuid?.() ?? 0))}]`,
      `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<writer>', 'exec'), {})`,
    ].join("\n");
    try {
      const result = spawnSync("python3", ["-c", script], {
        encoding: "utf8",
        env: { ...process.env, CATERING_BACKUP_ROOT: root },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("EVIDENCE_DURABILITY_UNKNOWN");
      expect(existsSync(outsideTarget)).toBe(false);
      expect(readFileSync(path.join(movedParent, "evidence"), "utf8")).toBe("status=success\nvalue=new\n");
    } finally {
      removeFixture(root);
      removeFixture(outside);
    }
  });

  test("post-replace parent drift reports durability as unknown", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-postreplace-swap-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-backup-postreplace-outside-"));
    const parent = path.join(root, "records");
    const movedParent = path.join(root, "records-original");
    const target = path.join(parent, "evidence");
    const outsideTarget = path.join(outside, "evidence");
    const common = source(files.common);
    const previous = "status=success\nvalue=old\n";
    const marker = "  python3 - \"$target\" \"$MAX_RECORD_BYTES\" \"$mode\" \"$source\" \"$payload\" \"$expected_uid\" <<'PY'\n";
    const start = common.indexOf(marker);
    const end = common.indexOf("\nPY\n}", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const writerPython = common.slice(start + marker.length, end);
    const encoded = Buffer.from(writerPython, "utf8").toString("base64");
    mkdirSync(parent, { mode: 0o700 });
    writeFileSync(target, previous, { mode: 0o600 });
    const script = [
      "import base64, os as real_os, sys, types",
      "proxy = types.ModuleType('os')",
      "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
      `parent = ${JSON.stringify(parent)}`,
      `moved = ${JSON.stringify(movedParent)}`,
      `outside = ${JSON.stringify(outside)}`,
      "calls = {'count': 0}",
      "def fake_fsync(fd):",
      "    calls['count'] += 1",
      "    if calls['count'] == 2:",
      "        real_os.rename(parent, moved)",
      "        real_os.symlink(outside, parent)",
      "    return real_os.fsync(fd)",
      "proxy.fsync = fake_fsync",
      "sys.modules['os'] = proxy",
      `sys.argv = ['writer', ${JSON.stringify(target)}, '65536', 'payload', '', 'status=success\\nvalue=new\\n', ${JSON.stringify(String(process.getuid?.() ?? 0))}]`,
      `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<writer>', 'exec'), {})`,
    ].join("\n");
    try {
      const result = spawnSync("python3", ["-c", script], {
        encoding: "utf8",
        env: { ...process.env, CATERING_BACKUP_ROOT: root },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("EVIDENCE_DURABILITY_UNKNOWN");
      expect(readFileSync(path.join(movedParent, "evidence"), "utf8")).toBe("status=success\nvalue=new\n");
      expect(existsSync(outsideTarget)).toBe(false);
    } finally {
      removeFixture(root);
      removeFixture(outside);
    }
  });

  test("atomic publication rejects a parent swap after a fresh dirfd bind", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-final-binding-swap-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-backup-final-binding-outside-"));
    const parent = path.join(root, "records");
    const movedParent = path.join(root, "records-original");
    const target = path.join(parent, "evidence");
    const outsideTarget = path.join(outside, "evidence");
    const common = source(files.common);
    const previous = "status=success\nvalue=old\n";
    const marker = "  python3 - \"$target\" \"$MAX_RECORD_BYTES\" \"$mode\" \"$source\" \"$payload\" \"$expected_uid\" <<'PY'\n";
    const start = common.indexOf(marker);
    const end = common.indexOf("\nPY\n}", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const writerPython = common.slice(start + marker.length, end);
    const encoded = Buffer.from(writerPython, "utf8").toString("base64");
    mkdirSync(parent, { mode: 0o700 });
    writeFileSync(target, previous, { mode: 0o600 });
    const script = [
      "import base64, os as real_os, sys, types",
      "proxy = types.ModuleType('os')",
      "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
      `parent = ${JSON.stringify(parent)}`,
      `moved = ${JSON.stringify(movedParent)}`,
      `outside = ${JSON.stringify(outside)}`,
      "calls = {'records': 0, 'swapped': False}",
      "def fake_open(path, flags, mode=0o777, *, dir_fd=None):",
      "    fd = real_os.open(path, flags, mode, dir_fd=dir_fd)",
      "    if path == 'records':",
      "        calls['records'] += 1",
      "        if calls['records'] == 2:",
      "            real_os.rename(parent, moved)",
      "            real_os.symlink(outside, parent)",
      "            calls['swapped'] = True",
      "    return fd",
      "proxy.open = fake_open",
      "sys.modules['os'] = proxy",
      `sys.argv = ['writer', ${JSON.stringify(target)}, '65536', 'payload', '', 'status=success\\nvalue=new\\n', ${JSON.stringify(String(process.getuid?.() ?? 0))}]`,
      "status = 0",
      "try:",
      `    exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<writer>', 'exec'), {})`,
      "except SystemExit as error:",
      "    status = error.code if isinstance(error.code, int) else 1",
      "print('swapped=%s' % calls['swapped'])",
      "raise SystemExit(status)",
    ].join("\n");
    try {
      const result = spawnSync("python3", ["-c", script], {
        encoding: "utf8",
        env: { ...process.env, CATERING_BACKUP_ROOT: root },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/STATE_PATH_(?:CHANGED|INVALID)/);
      expect(result.stdout).toContain("swapped=True");
      expect(existsSync(outsideTarget)).toBe(false);
      expect(readFileSync(path.join(movedParent, "evidence"), "utf8")).toBe(previous);
    } finally {
      removeFixture(root);
      removeFixture(outside);
    }
  });

  test("secure single-line reader rejects relative paths through command substitution", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-single-line-relative-"));
    const common = path.join(repoRoot, files.common);
    writeFileSync(path.join(root, "relative-locator"), "s3:s3.example/catering\n", { mode: 0o600 });
    const result = runShell(
      `source ${JSON.stringify(common)}
fail_state() { printf '%s\\n' "$1" >&2; return 1; }
cd ${JSON.stringify(root)}
read_rc=0
value="$(read_secure_single_line relative-locator 64 ${process.getuid?.() ?? 0})" || read_rc=$?
[[ "$read_rc" -ne 0 ]]
test -z "\${value:-}"`,
      { CATERING_BACKUP_ROOT: root, CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 0) },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
      expect(result.stderr).toContain("STATE_PATH_INVALID");
      expect(result.stdout).not.toContain("relative-locator");
    } finally {
      removeFixture(root);
    }
  });

  test("secure Restic wrapper binds no-follow descriptors and rejects a source symlink", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-secure-restic-"));
    const common = path.join(repoRoot, files.common);
    const repository = path.join(root, "repository");
    const password = path.join(root, "password");
    const fake = path.join(root, "restic");
    const log = path.join(root, "restic.log");
    const uid = process.getuid?.() ?? 0;
    writeFileSync(repository, "s3:s3.example/catering\n", { mode: 0o600 });
    writeFileSync(password, "fixture-password\n", { mode: 0o600 });
    writeFileSync(
      fake,
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" > "$FAKE_LOG"
repo=""; pass=""
while [[ "\${1-}" == --repository-file || "\${1-}" == --password-file ]]; do
  [[ "$2" == /proc/self/fd/* ]] || exit 31
  [[ "$1" == --repository-file ]] && repo="/dev/fd/\${2##*/}" || pass="/dev/fd/\${2##*/}"
  shift 2
done
[[ -z "\${CATERING_BACKUP_REPOSITORY_FILE:-}" && -z "\${CATERING_BACKUP_PASSWORD_FILE:-}" ]] || exit 34
if [[ "\${FAKE_SWAP:-}" == 1 ]]; then
  mv "$FAKE_REPOSITORY_FILE" "$FAKE_REPOSITORY_FILE.old"
  printf 's3:replacement.example/catering\n' > "$FAKE_REPOSITORY_FILE"
  mv "$FAKE_PASSWORD_FILE" "$FAKE_PASSWORD_FILE.old"
  printf 'replacement-password\n' > "$FAKE_PASSWORD_FILE"
fi
[[ "$(cat "$repo")" == 's3:s3.example/catering' ]] || exit 32
[[ "$(cat "$pass")" == 'fixture-password' ]] || exit 33
printf 'ok\\n'
`,
      { mode: 0o755 },
    );
    const run = (repositoryPath: string, extraEnv: NodeJS.ProcessEnv = {}) =>
      runShell(
        `source ${JSON.stringify(common)}\nsecure_restic cat config`,
        {
          CATERING_BACKUP_ROOT: root,
          CATERING_BACKUP_EXPECTED_UID: String(uid),
          CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256: sha256("s3:s3.example/catering"),
          CATERING_BACKUP_REPOSITORY_FILE: repositoryPath,
          CATERING_BACKUP_PASSWORD_FILE: password,
          CATERING_RESTIC_COMMAND: fake,
          FAKE_REPOSITORY_FILE: repository,
          FAKE_PASSWORD_FILE: password,
          FAKE_LOG: log,
          ...extraEnv,
        },
      );
    const link = path.join(root, "repository-link");
    const swapped = path.join(root, "repository-swapped");
    symlinkSync(repository, link);
    writeFileSync(swapped, "s3:other.example/catering\n", { mode: 0o600 });
    try {
      const accepted = run(repository);
      expect(accepted.status, String(accepted.stderr)).toBe(0);
      expect(accepted.stdout).toBe("ok\n");
      expect(readFileSync(log, "utf8")).toContain("--repository-file /proc/self/fd/9");
      const collision = runShell(
        `source ${JSON.stringify(common)}\nexec 3<${JSON.stringify(repository)}\nexec 4<${JSON.stringify(password)}\nexec 5<${JSON.stringify(repository)}\nexec 6<${JSON.stringify(password)}\nexec 7<${JSON.stringify(repository)}\nsecure_restic cat config`,
        {
          CATERING_BACKUP_ROOT: root,
          CATERING_BACKUP_EXPECTED_UID: String(uid),
          CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256: sha256("s3:s3.example/catering"),
          CATERING_BACKUP_REPOSITORY_FILE: repository,
          CATERING_BACKUP_PASSWORD_FILE: password,
          CATERING_RESTIC_COMMAND: fake,
          FAKE_LOG: log,
        },
      );
      expect(collision.status, String(collision.stderr)).toBe(0);
      expect(collision.stdout).toBe("ok\n");
      const rejected = run(link);
      expect(rejected.status).not.toBe(0);
      expect(String(rejected.stderr)).toMatch(/STATE_PATH_INVALID|STATE_PATH_CHANGED/);
      const digestMismatch = run(swapped);
      expect(digestMismatch.status).not.toBe(0);
      expect(String(digestMismatch.stderr)).toContain("REPOSITORY_BINDING_MISMATCH");
      const replacementRace = run(repository, { FAKE_SWAP: "1" });
      expect(replacementRace.status, String(replacementRace.stderr)).toBe(0);
      expect(replacementRace.stdout).toBe("ok\n");
    } finally {
      removeFixture(root);
    }
  });

  test("secure Restic rejects repository or password generation changes between calls", () => {
    const common = path.join(repoRoot, files.common);
    const runCase = (changed: "repository" | "password"): ReturnType<typeof runShell> => {
      const root = mkdtempSync(path.join(tmpdir(), "catering-backup-restic-generation-"));
      const repository = path.join(root, "repository");
      const password = path.join(root, "password");
      const fake = path.join(root, "restic");
      const log = path.join(root, "restic.log");
      writeFileSync(repository, "s3:s3.example/catering\n", { mode: 0o600 });
      writeFileSync(password, "fixture-password\n", { mode: 0o600 });
      writeFileSync(fake, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$FAKE_LOG"
repo=; pass=
while [[ "\${1-}" == --repository-file || "\${1-}" == --password-file ]]; do
  [[ "$2" == /proc/self/fd/* ]] || exit 31
  [[ "$1" == --repository-file ]] && repo="/dev/fd/\${2##*/}" || pass="/dev/fd/\${2##*/}"
  shift 2
done
[[ "$(cat "$repo")" == 's3:s3.example/catering' ]] || exit 32
[[ "$(cat "$pass")" == 'fixture-password' ]] || exit 33
printf '{"id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}\\n'
`, { mode: 0o755 });
      const replacement = changed === "repository" ? repository : password;
      const expected = changed === "repository" ? "s3:s3.example/catering\n" : "fixture-password\n";
      const script = `source ${JSON.stringify(common)}
first=0
secure_restic cat config >/dev/null || first=$?
mv ${JSON.stringify(replacement)} ${JSON.stringify(`${replacement}.old`)}
printf '%s\\n' ${JSON.stringify(expected.slice(0, -1))} > ${JSON.stringify(replacement)}
chmod 600 ${JSON.stringify(replacement)}
second=0
secure_restic cat config >/dev/null || second=$?
count=0
[[ -f "\$FAKE_LOG" ]] && count=\$(awk 'END{print NR}' "\$FAKE_LOG")
[[ "\$first" -eq 0 && "\$second" -ne 0 && "\$count" -eq 1 ]]
`;
      const result = runShell(script, {
        CATERING_BACKUP_ROOT: root,
        CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 0),
        CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256: sha256("s3:s3.example/catering"),
        CATERING_BACKUP_REPOSITORY_FILE: repository,
        CATERING_BACKUP_PASSWORD_FILE: password,
        CATERING_RESTIC_COMMAND: fake,
        FAKE_LOG: log,
      });
      removeFixture(root);
      return result;
    };
    for (const changed of ["repository", "password"] as const) {
      const result = runCase(changed);
      expect(result.status, String(result.stderr)).toBe(0);
      expect(String(result.stderr)).toContain("REPOSITORY_GENERATION_CHANGED");
    }
  });

  test("descriptor provenance tests kill lstat/open and hash/parse reopen mutants", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-a3-descriptor-mutants-"));
    const common = source(files.common);
    const uid = process.getuid?.() ?? 0;
    const repository = path.join(root, "repository");
    const password = path.join(root, "password");
    const fakeRestic = path.join(root, "restic");
    writeFileSync(repository, "s3:s3.example/catering\n", { mode: 0o600 });
    writeFileSync(password, "fixture-password\n", { mode: 0o600 });
    writeFileSync(fakeRestic, "#!/usr/bin/env bash\nprintf 'ok\\n'\n", { mode: 0o755 });

    const secureStart = common.indexOf("python3 -c '");
    const secureEnd = common.indexOf("\n' \"$command\"", secureStart);
    const securePython = common.slice(secureStart + "python3 -c '\n".length, secureEnd);
    const readerStart = common.indexOf("read_bound_text() {");
    const readerMarker = 'python3 - "$path" "$limit" "$expected_uid" "$expected_digest" "$single_line" <<\'PY\'\n';
    const readerPythonStart = common.indexOf(readerMarker, readerStart);
    const readerPythonEnd = common.indexOf("\nPY\n}", readerPythonStart);
    const readerPython = common.slice(readerPythonStart + readerMarker.length, readerPythonEnd);
    expect(securePython.length).toBeGreaterThan(0);
    expect(readerPython.length).toBeGreaterThan(0);
    const payload = "status=original\n";
    const digest = sha256(payload);
    const runSecure = (body: string) => {
      const encoded = Buffer.from(body, "utf8").toString("base64");
      const script = [
        "import base64, hashlib, os as real_os, sys, types",
        "proxy = types.ModuleType('os')",
        "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
        `target = ${JSON.stringify(repository)}`,
        `replacement = ${JSON.stringify(repository + ".replacement")}`,
        `with open(replacement, 'wb') as handle: handle.write(${JSON.stringify("s3:s3.example/catering\n")}.encode())`,
        "real_os.chmod(replacement, 0o600)",
        "replacement_info = real_os.stat(replacement, follow_symlinks=False)",
        "with open(replacement, 'rb') as handle: replacement_bytes = handle.read()",
        "replacement_generation = '%s:%s:%s:%s' % (replacement_info.st_dev, replacement_info.st_ino, len(replacement_bytes), hashlib.sha256(replacement_bytes).hexdigest())",
        `password_info = real_os.stat(${JSON.stringify(password)}, follow_symlinks=False)`,
        `with open(${JSON.stringify(password)}, 'rb') as handle: password_bytes = handle.read()` ,
        "password_generation = '%s:%s:%s:%s' % (password_info.st_dev, password_info.st_ino, len(password_bytes), hashlib.sha256(password_bytes).hexdigest())",
        "swapped = {'done': False}",
        "def fake_lstat(path):",
        "    result = real_os.lstat(path)",
        "    if path == target and not swapped['done']:",
        "        swapped['done'] = True",
        "        real_os.rename(path, path + '.old')",
        "        real_os.rename(replacement, path)",
        "    return result",
        "proxy.lstat = fake_lstat",
        "sys.modules['os'] = proxy",
        `sys.argv = ['secure', ${JSON.stringify(fakeRestic)}, ${JSON.stringify(repository)}, ${JSON.stringify(password)}, ${JSON.stringify(sha256("s3:s3.example/catering"))}, replacement_generation, password_generation, ${JSON.stringify(String(uid))}, '65536', 'cat']`,
        `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<secure>', 'exec'), {})`,
      ].join("\n");
      return spawnSync("python3", ["-c", script], { encoding: "utf8" });
    };
    const runReader = (body: string) => {
      const encoded = Buffer.from(body, "utf8").toString("base64");
      const script = [
        "import base64, os as real_os, sys, types",
        "proxy = types.ModuleType('os')",
        "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
        `target = ${JSON.stringify(repository)}`,
        "swapped = {'done': False}",
        "def fake_lstat(path):",
        "    result = real_os.lstat(path)",
        "    if path == target and not swapped['done']:",
        "        swapped['done'] = True",
        "        real_os.rename(path, path + '.old')",
        "        with real_os.fdopen(real_os.open(path, real_os.O_WRONLY | real_os.O_CREAT | real_os.O_EXCL, 0o600), 'wb') as handle:",
        `            handle.write(${JSON.stringify(payload)}.encode())`,
        "    return result",
        "proxy.lstat = fake_lstat",
        "sys.modules['os'] = proxy",
        `sys.argv = ['reader', ${JSON.stringify(repository)}, '65536', ${JSON.stringify(String(uid))}, ${JSON.stringify(digest)}, '0']`,
        `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<reader>', 'exec'), {})`,
      ].join("\n");
      return spawnSync("python3", ["-c", script], { encoding: "utf8" });
    };
    try {
      const secure = runSecure(securePython);
      expect(secure.status).not.toBe(0);
      expect(secure.stderr).toContain("STATE_PATH_CHANGED");
      const insecureSecure = securePython.replace(
        "if (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino):",
        "if False and (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino):",
      );
      const insecureSecureResult = runSecure(insecureSecure);
      expect(insecureSecureResult.status, String(insecureSecureResult.stderr)).toBe(0);

      const reader = runReader(readerPython);
      expect(reader.status).not.toBe(0);
      expect(reader.stderr).toContain("STATE_PATH_CHANGED");
      const insecureReader = readerPython.replace(
        "if (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino): raise ValueError(\"STATE_PATH_CHANGED\")",
        "if False and (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino): raise ValueError(\"STATE_PATH_CHANGED\")",
      );
      expect(runReader(insecureReader).status).toBe(0);
    } finally {
      removeFixture(root);
    }
  });

  test("read_bound_text parses the descriptor bytes even if the path is replaced after hashing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-a3-parse-race-"));
    const common = source(files.common);
    const target = path.join(root, "record");
    const original = "status=original\n";
    const replacement = "status=replaced\n";
    writeFileSync(target, original, { mode: 0o600 });
    const readerStart = common.indexOf("read_bound_text() {");
    const marker = 'python3 - "$path" "$limit" "$expected_uid" "$expected_digest" "$single_line" <<\'PY\'\n';
    const start = common.indexOf(marker, readerStart);
    const end = common.indexOf("\nPY\n}", start);
    const readerPython = common.slice(start + marker.length, end);
    const mutated = readerPython.replace(
      "if expected_digest and hashlib.sha256(data).hexdigest() != expected_digest: print(\"CHECKSUM_MISMATCH\", file=sys.stderr); raise SystemExit(1)",
      "if expected_digest and hashlib.sha256(data).hexdigest() != expected_digest: print(\"CHECKSUM_MISMATCH\", file=sys.stderr); raise SystemExit(1)\nwith open(path, 'rb') as reopened: data = bytearray(reopened.read())",
    );
    const run = (body: string) => {
      const encoded = Buffer.from(body, "utf8").toString("base64");
      const script = [
        "import base64, os as real_os, sys, types",
        "proxy = types.ModuleType('os')",
        "for name in dir(real_os): setattr(proxy, name, getattr(real_os, name))",
        `target = ${JSON.stringify(target)}`,
        "swapped = {'done': False}",
        "def fake_read(fd, length):",
        "    data = real_os.read(fd, length)",
        "    if not data and not swapped['done']:",
        "        swapped['done'] = True",
        "        real_os.rename(target, target + '.old')",
        "        with real_os.fdopen(real_os.open(target, real_os.O_WRONLY | real_os.O_CREAT | real_os.O_EXCL, 0o600), 'wb') as handle:",
        `            handle.write(${JSON.stringify(replacement)}.encode())`,
        "    return data",
        "proxy.read = fake_read",
        "sys.modules['os'] = proxy",
        `sys.argv = ['reader', ${JSON.stringify(target)}, '65536', ${JSON.stringify(String(process.getuid?.() ?? 0))}, ${JSON.stringify(sha256(original))}, '0']`,
        `exec(compile(base64.b64decode(${JSON.stringify(encoded)}), '<reader>', 'exec'), {})`,
      ].join("\n");
      return spawnSync("python3", ["-c", script], { encoding: "utf8" });
    };
    try {
      const safe = run(readerPython);
      expect(safe.status, String(safe.stderr)).toBe(0);
      expect(safe.stdout).toBe(original.slice(0, -1));
      writeFileSync(target, original, { mode: 0o600 });
      const reopen = run(mutated);
      expect(reopen.status, String(reopen.stderr)).toBe(0);
      expect(reopen.stdout).toBe(replacement.slice(0, -1));
      expect(reopen.stdout).not.toBe(safe.stdout);
    } finally {
      removeFixture(root);
    }
  });

  test("bounded record checksum and parse use the same descriptor bytes", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-record-digest-"));
    const target = path.join(root, "record.json");
    const common = path.join(repoRoot, files.common);
    const payload = "status=candidate\n";
    const uid = process.getuid?.() ?? 0;
    writeFileSync(target, payload, { mode: 0o600 });
    const valid = runShell(
      `source ${JSON.stringify(common)}\nread_bounded_record ${JSON.stringify(target)} 64 ${uid} ${sha256(payload)}`,
      { CATERING_BACKUP_ROOT: root },
    );
    const wrong = runShell(
      `source ${JSON.stringify(common)}\nread_bounded_record ${JSON.stringify(target)} 64 ${uid} ${"0".repeat(64)}`,
      { CATERING_BACKUP_ROOT: root },
    );
    try {
      expect(valid.status, String(valid.stderr)).toBe(0);
      expect(valid.stdout).toBe(payload);
      expect(wrong.status).not.toBe(0);
      expect(String(wrong.stderr)).toContain("CHECKSUM_MISMATCH");
    } finally {
      removeFixture(root);
    }
  });

  test("operator attestations are closed-world, digest-bound and age-limited", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-attestation-"));
    const common = path.join(repoRoot, files.common);
    const offhost = path.join(root, "offhost-attestation");
    const secret = path.join(root, "secret-attestation");
    const uid = process.getuid?.() ?? 0;
    const repositoryId = "b".repeat(64);
    const hostDigest = "c".repeat(64);
    // The backup runs on the production host, so both fields bind the same
    // host identity.  Off-host safety comes from the endpoint/address-set
    // comparison, not from manufacturing two different host digests.
    const productionHostDigest = hostDigest;
    const locatorDigest = sha256("s3:s3.example/catering");
    const resolvedDigest = sha256("8.8.8.8");
    const productionAddressesDigest = sha256("1.1.1.1");
    const sourceType = "offline_vault";
    const sourceReference = "offline_vault:/recovery/catering-v1";
    const secretSchema = "operator-secret-schema-v2|restic_encryption_password,offhost_repository_access,POSTGRES_PASSWORD,CATERING_TRUSTED_ACTOR_SECRET,CATERING_BASIC_AUTH_PASSWORD_HASH";
    const secretReference = sha256(sourceReference);
    const nowEpoch = String(Math.floor(Date.parse("2026-09-04T01:00:00Z") / 1000));
    const offhostText = `status=operator_attested\nlocator_digest=${locatorDigest}\nendpoint_host=s3.example\nresolved_addresses_digest=${resolvedDigest}\nproduction_addresses=1.1.1.1\nproduction_external_addresses=none\nproduction_addresses_digest=${productionAddressesDigest}\nrepository_identity=${repositoryId}\nhost_binding=${hostDigest}\nproduction_host_binding=${productionHostDigest}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=2026-09-04T00:00:00Z\nvalid_until=2026-09-05T00:00:00Z\nattestation_id=${"a".repeat(64)}\n`;
    const sourceReferenceDigest = secretReference;
    const secretSchemaDigest = sha256(secretSchema);
    const secretText = `status=operator_attested\nsource_type=${sourceType}\nsource_reference=${sourceReference}\nsource_reference_digest=${sourceReferenceDigest}\nrequired_secret_schema_digest=${secretSchemaDigest}\nrepository_identity=${repositoryId}\nhost_binding=${hostDigest}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=2026-09-04T00:00:00Z\nvalid_until=2026-09-05T00:00:00Z\nattestation_id=${"f".repeat(64)}\n`;
    writeFileSync(offhost, offhostText, { mode: 0o600 });
    writeFileSync(secret, secretText, { mode: 0o600 });
    const env = {
      CATERING_BACKUP_ROOT: root,
      CATERING_BACKUP_EXPECTED_UID: String(uid),
      CATERING_BACKUP_TEST_MODE: "1",
      CATERING_BACKUP_ATTESTATION_NOW_EPOCH: nowEpoch,
      CATERING_BACKUP_RESOLVED_ADDRESSES: "8.8.8.8",
      CATERING_BACKUP_LOCAL_ADDRESSES: "1.1.1.1",
      CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES: "1.1.1.1",
      CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES: "none",
      CATERING_BACKUP_PRODUCTION_ADDRESSES_SHA256: productionAddressesDigest,
      CATERING_BACKUP_PRODUCTION_HOST_SHA256: productionHostDigest,
      CATERING_SECRET_RECOVERY_SOURCE_TYPE: sourceType,
      CATERING_SECRET_RECOVERY_SOURCE_REFERENCE: sourceReference,
      CATERING_SECRET_RECOVERY_REFERENCE_SHA256: secretReference,
      CATERING_REQUIRED_SECRET_SCHEMA_SHA256: secretSchemaDigest,
      CATERING_BACKUP_REPOSITORY_VALUE: "s3:s3.example/catering",
      CATERING_BACKUP_EXPECTED_REPOSITORY_SHA256: locatorDigest,
      CATERING_OFFHOST_ATTESTATION_FILE: offhost,
      CATERING_SECRET_RECOVERY_ATTESTATION_FILE: secret,
      CATERING_OFFHOST_ATTESTATION_SHA256: sha256(offhostText),
      CATERING_SECRET_RECOVERY_ATTESTATION_SHA256: sha256(secretText),
    };
    const valid = runShell(
      `source ${JSON.stringify(common)}\nvalidate_offhost_attestation ${JSON.stringify(offhost)} ${repositoryId} ${hostDigest} ${locatorDigest} ${resolvedDigest} ${productionHostDigest} ${productionAddressesDigest}\nvalidate_secret_recovery_attestation ${JSON.stringify(secret)} ${repositoryId} ${hostDigest} ${secretReference}`,
      env,
    );
    const aggregate = (extraEnv: NodeJS.ProcessEnv = {}) =>
      runShell(
        `source ${JSON.stringify(common)}\nvalidate_operator_attestations ${repositoryId} ${hostDigest} ${locatorDigest} ${resolvedDigest} ${productionHostDigest} ${productionAddressesDigest}`,
        { ...env, ...extraEnv },
      );
    const rewriteSecret = (replacement: string): NodeJS.ProcessEnv => {
      writeFileSync(secret, replacement, { mode: 0o600 });
      return { CATERING_SECRET_RECOVERY_ATTESTATION_SHA256: sha256(replacement) };
    };
    expect(aggregate().status).toBe(0);
    const unknownSecret = `${secretText}unknown_field=1\n`;
    expect(aggregate(rewriteSecret(unknownSecret)).status).not.toBe(0);
    const genericSource = secretText.replace(`source_type=${sourceType}`, "source_type=operator-secret-manifest-v1");
    expect(aggregate(rewriteSecret(genericSource)).status).not.toBe(0);
    const wrongSourceClass = secretText.replace(`source_type=${sourceType}`, "source_type=github_environment");
    expect(aggregate(rewriteSecret(wrongSourceClass)).status).not.toBe(0);
    const wrongSourceReference = secretText
      .replace("source_reference=offline_vault:/recovery/catering-v1", "source_reference=offline_vault:/recovery/other-v1")
      .replace(`source_reference_digest=${secretReference}`, `source_reference_digest=${sha256("offline_vault:/recovery/other-v1")}`);
    expect(aggregate(rewriteSecret(wrongSourceReference)).status).not.toBe(0);
    const wrongSchema = secretText.replace(`required_secret_schema_digest=${secretSchemaDigest}`, `required_secret_schema_digest=${"2".repeat(64)}`);
    expect(aggregate(rewriteSecret(wrongSchema)).status).not.toBe(0);
    writeFileSync(secret, secretText, { mode: 0o600 });
    const stale = "2026-09-03T17:00:00Z";
    expect(runShell(`source ${JSON.stringify(common)}\nattestation_time_allowed ${stale} 2026-09-04T17:00:00Z`, env).status).toBe(0);
    expect(runShell(`source ${JSON.stringify(common)}\nattestation_time_allowed 2026-09-03T18:59:59Z 2026-09-03T18:00:00Z`, env).status).not.toBe(0);
    expect(runShell(`source ${JSON.stringify(common)}\nattestation_time_allowed 2026-09-04T01:00:01Z 2026-09-05T00:00:00Z`, env).status).not.toBe(0);
    expect(runShell(`source ${JSON.stringify(common)}\nattestation_time_allowed 2026-09-04T00:00:00Z 2026-10-05T00:00:00Z`, env).status).not.toBe(0);
    expect(aggregate({ CATERING_BACKUP_RESOLVED_ADDRESSES: "1.1.1.1" }).status).not.toBe(0);
    writeFileSync(offhost, offhostText.replace("endpoint_host=s3.example", "endpoint_host=metadata.google.internal"), { mode: 0o600 });
    const drift = runShell(
      `source ${JSON.stringify(common)}\nvalidate_offhost_attestation ${JSON.stringify(offhost)} ${repositoryId} ${hostDigest} ${locatorDigest} ${resolvedDigest} ${productionHostDigest} ${productionAddressesDigest}`,
      { ...env, CATERING_OFFHOST_ATTESTATION_SHA256: sha256(offhostText) },
    );
    try {
      expect(valid.status, String(valid.stderr)).toBe(0);
      expect(drift.status).not.toBe(0);
      expect(String(drift.stderr)).toMatch(/ATTESTATION|REPOSITORY|STATE_|CHECKSUM/);
    } finally {
      removeFixture(root);
    }
  });

  test("production addresses use one canonical interface plus operator-external set", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-production-addresses-"));
    const common = path.join(repoRoot, files.common);
    const uid = process.getuid?.() ?? 0;
    const env = {
      CATERING_BACKUP_ROOT: root,
      CATERING_BACKUP_EXPECTED_UID: String(uid),
      CATERING_BACKUP_TEST_MODE: "1",
      CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES: "192.0.2.4,2001:0db8:0:0::1",
      CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES: "1.1.1.1,2001:db8::2,192.0.2.4",
      CATERING_BACKUP_RESOLVED_ADDRESSES: "8.8.8.8",
    };
    const canonical = runShell(`source ${JSON.stringify(common)}\ncanonical_production_addresses`, env);
    const digest = runShell(`source ${JSON.stringify(common)}\nproduction_address_digest`, env);
    const overlap = runShell(
      `source ${JSON.stringify(common)}\nCATERING_BACKUP_RESOLVED_ADDRESSES=1.1.1.1 resolved_address_digest s3.example`,
      env,
    );
    try {
      expect(canonical.status, String(canonical.stderr)).toBe(0);
      expect(canonical.stdout).toBe("1.1.1.1,192.0.2.4,2001:db8::1,2001:db8::2\n");
      expect(digest.status, String(digest.stderr)).toBe(0);
      expect(String(digest.stdout).trim()).toBe(sha256("1.1.1.1,192.0.2.4,2001:db8::1,2001:db8::2"));
      expect(overlap.status).not.toBe(0);
    } finally {
      removeFixture(root);
    }
  });

  test("A3 captures one immutable address generation and requires explicit external none", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-a3-address-generation-"));
    const common = path.join(repoRoot, files.common);
    const env = {
      CATERING_BACKUP_ROOT: root,
      CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 501),
      CATERING_BACKUP_TEST_MODE: "1",
      CATERING_BACKUP_PRODUCTION_INTERFACE_ADDRESSES: "192.0.2.4,2001:0db8:0:0::1",
      CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES: "none",
      CATERING_BACKUP_RESOLVED_ADDRESSES: "8.8.8.8",
    };
    const generation = runShell(
      `source ${JSON.stringify(common)}\ncapture_address_generation s3:s3.example/catering`,
      env,
    );
    const missingExternal = runShell(
      `source ${JSON.stringify(common)}\nunset CATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES\ncanonical_production_addresses`,
      env,
    );
    const mixedNone = runShell(
      `source ${JSON.stringify(common)}\nCATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES='none,8.8.8.8' canonical_production_addresses`,
      env,
    );
    const malformedRepository = runShell(
      `source ${JSON.stringify(common)}\ncapture_address_generation s3:s3.example/catering//invalid`,
      env,
    );
    const malformedExternal = ["", " ", "none,8.8.8.8", "backup.example", "1.1.1.1,", ",1.1.1.1", "999.1.1.1"].map((value) =>
      runShell(
        `source ${JSON.stringify(common)}\nCATERING_BACKUP_PRODUCTION_EXTERNAL_ADDRESSES=${JSON.stringify(value)} canonical_external_addresses`,
        env,
      ),
    );
    try {
      expect(generation.status, String(generation.stderr)).toBe(0);
      const fields = String(generation.stdout).trim().split("\t");
      expect(fields).toHaveLength(6);
      expect(fields[0]).toBe("s3.example");
      expect(fields[1]).toBe("8.8.8.8");
      expect(fields[3]).toBe("none");
      expect(fields[4]).toBe("192.0.2.4,2001:db8::1");
      expect(missingExternal.status).not.toBe(0);
      expect(mixedNone.status).not.toBe(0);
      expect(malformedRepository.status).not.toBe(0);
      malformedExternal.forEach((result) => expect(result.status).not.toBe(0));
    } finally {
      removeFixture(root);
    }
  });

  test("A3 attestation admission uses a renewable 30-day validity and operation window", () => {
    const common = path.join(repoRoot, files.common);
    const env = {
      CATERING_BACKUP_EXPECTED_UID: String(process.getuid?.() ?? 501),
      CATERING_BACKUP_TEST_MODE: "1",
      CATERING_BACKUP_ATTESTATION_NOW_EPOCH: "1788480000",
    };
    const validBackup = runShell(
      `source ${JSON.stringify(common)}\nattestation_time_allowed 2026-09-04T00:00:00Z 2026-09-04T06:00:00Z 21600`,
      env,
    );
    const shortBackup = runShell(
      `source ${JSON.stringify(common)}\nattestation_time_allowed 2026-09-04T00:00:00Z 2026-09-04T05:59:59Z 21600`,
      env,
    );
    const maxRenewal = runShell(
      `source ${JSON.stringify(common)}\nattestation_time_allowed 2026-09-04T00:00:00Z 2026-10-04T00:00:00Z 18000`,
      env,
    );
    try {
      expect(validBackup.status, String(validBackup.stderr)).toBe(0);
      expect(shortBackup.status).not.toBe(0);
      expect(maxRenewal.status, String(maxRenewal.stderr)).toBe(0);
    } finally {
      // No filesystem fixture is created; this keeps the test hermetic.
    }
  });

  test("secret recovery binds a real closed-world source class and required schema roles", () => {
    const root = mkdtempSync(path.join(tmpdir(), "catering-backup-secret-source-"));
    const common = path.join(repoRoot, files.common);
    const secret = path.join(root, "secret-attestation");
    const uid = process.getuid?.() ?? 0;
    const repositoryId = "b".repeat(64);
    const hostDigest = "c".repeat(64);
    const sourceType = "offline_vault";
    const sourceReference = "offline_vault:/recovery/catering-v1";
    const schema = "operator-secret-schema-v2|restic_encryption_password,offhost_repository_access,POSTGRES_PASSWORD,CATERING_TRUSTED_ACTOR_SECRET,CATERING_BASIC_AUTH_PASSWORD_HASH";
    const sourceDigest = sha256(sourceReference);
    const schemaDigest = sha256(schema);
    const text = `status=operator_attested\nsource_type=${sourceType}\nsource_reference=${sourceReference}\nsource_reference_digest=${sourceDigest}\nrequired_secret_schema_digest=${schemaDigest}\nrepository_identity=${repositoryId}\nhost_binding=${hostDigest}\nscope=postgres,sites,platform-caddy,shared-edge-caddy\nverified_at=2026-09-04T00:00:00Z\nvalid_until=2026-09-05T00:00:00Z\nattestation_id=${"f".repeat(64)}\n`;
    writeFileSync(secret, text, { mode: 0o600 });
    const result = runShell(
      `source ${JSON.stringify(common)}\nvalidate_secret_recovery_attestation ${JSON.stringify(secret)} ${repositoryId} ${hostDigest} ${sourceDigest}`,
      {
        CATERING_BACKUP_ROOT: root,
        CATERING_BACKUP_EXPECTED_UID: String(uid),
        CATERING_BACKUP_TEST_MODE: "1",
        CATERING_BACKUP_ATTESTATION_NOW_EPOCH: "1788480000",
        CATERING_SECRET_RECOVERY_SOURCE_TYPE: sourceType,
        CATERING_SECRET_RECOVERY_SOURCE_REFERENCE: sourceReference,
        CATERING_SECRET_RECOVERY_REFERENCE_SHA256: sourceDigest,
        CATERING_REQUIRED_SECRET_SCHEMA_SHA256: schemaDigest,
        CATERING_SECRET_RECOVERY_ATTESTATION_SHA256: sha256(text),
      },
    );
    try {
      expect(result.status, String(result.stderr)).toBe(0);
    } finally {
      removeFixture(root);
    }
  });

  test("restore revalidates the fresh repository/attestation pair before writing its receipt", () => {
    const restore = source(files.restore);
    const refresh = restore.indexOf("refresh_repository_identity() {");
    const receipt = restore.indexOf("if ! write_restore_receipt; then", refresh);
    const recheck = restore.indexOf("validate_restore_attestations", refresh);
    expect(refresh).toBeGreaterThanOrEqual(0);
    expect(receipt).toBeGreaterThan(refresh);
    expect(recheck).toBeGreaterThan(refresh);
    expect(recheck).toBeLessThan(receipt);
  });
});
