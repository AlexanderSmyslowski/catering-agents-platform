# Catering Backup and Restore Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-only, fail-closed Catering backup and isolated restore contract with a six-hour RPO target and four-hour RTO target, without installing or running it in production.

**Architecture:** A root-run backup script creates a PostgreSQL custom-format dump and allowlisted filesystem archives, stores the bundle in an encrypted off-host Restic snapshot, and publishes only a versioned candidate. A separate isolated restore probe restores that exact snapshot, validates every component, restores PostgreSQL inside an ephemeral `--network none` container with no published ports, and only then atomically promotes the candidate to the existing production evidence files. Inert systemd unit templates define the future six-hour cycle; no deployment or activation is part of this plan.

**Tech Stack:** Bash 5, Docker CLI, PostgreSQL 17 tools inside containers, Restic, GNU tar/coreutils, Python 3 standard library for strict parsing and durable atomic publication, systemd, Vitest.

**Spec:** User-authorized repository-only slice in the Server Separation session on 2026-09-03.

## Global Constraints

- Authoritative base commit: `feb5434df995e025d0525ac4dfc882508c037edc`.
- Authoritative base tree: `78fa0f1f946a67516b76540b563faa66f2a81cda`.
- RPO target: exactly `21600` seconds.
- RTO target: exactly `14400` seconds.
- No production backup, restore, deployment, SSH, Docker, DNS, Caddy, secret, or host mutation.
- Final backup evidence must not advance until the exact snapshot has passed the isolated restore probe.
- Existing successful evidence must survive every failed backup or restore attempt.
- Restic repository and password files are root-owned mode `0600`; repository must be non-local.
- Restore container uses a digest-pinned PostgreSQL image, `--network none`, no published ports, no production network, and no app services.
- Backup scope is fixed to `postgres,data,sites,shared-edge`.
- No secret values may be written to Git, logs, artifacts, evidence files, or manifests.

---

### Task 1: Write RED contracts for the repository slice

**Files:**
- Create: `tests/catering-backup-restore-contract.test.ts`
- Create: `.github/workflows/catering-backup-restore-slice-tdd.yml`

**Interfaces:**
- Consumes: the fixed paths and evidence format described in Global Constraints.
- Produces: executable RED contracts for scripts, unit files, environment schema, atomic evidence promotion, RPO, RTO, and restore isolation.

- [ ] **Step 1: Add failing existence and contract tests**

The test must require:

- `platform-infra/backup/catering-backup.sh`
- `platform-infra/backup/catering-restore-probe.sh`
- `platform-infra/backup/catering-backup.service`
- `platform-infra/backup/catering-backup.timer`
- `platform-infra/backup/catering-restore-probe.service`
- `platform-infra/backup/catering-backup.env.example`
- `docs/operations/CATERING_BACKUP_RESTORE.md`

It must also assert the exact RPO/RTO constants, Restic/PG dump commands, fixed volume allowlist, candidate-before-evidence design, `--network none`, digest-pinned restore image, required restored tables, and absence of published ports.

- [ ] **Step 2: Run the focused workflow**

Run:

```bash
npx vitest run tests/catering-backup-restore-contract.test.ts --maxWorkers=1
```

Expected: FAIL because the repository slice files do not exist.

- [ ] **Step 3: Preserve the RED run ID and failure reason**

The workflow log must show the test file reached the intended missing-file assertions rather than failing in setup.

### Task 2: Implement the backup candidate producer

**Files:**
- Create: `platform-infra/backup/catering-backup.sh`
- Create: `platform-infra/backup/catering-backup.env.example`

**Interfaces:**
- Consumes:
  - root-owned Restic repository/password files;
  - `CATERING_BACKUP_EXPECTED_HOST_SHA256`;
  - `CATERING_BACKUP_SOURCE_COMMIT`;
  - `CATERING_BACKUP_SOURCE_TREE`;
  - exact Compose project/service/volume identities.
- Produces:
  - `/var/lib/catering-backup/snapshots/<run-id>` artifact manifest;
  - `/var/lib/catering-backup/candidates/<run-id>` candidate;
  - `/var/lib/catering-backup/catering-backup-candidate` pointer.
- Does not produce final backup evidence.

- [ ] **Step 1: Validate runtime identity before capture**

Require root, exact host digest, exact PostgreSQL project/service identity, exact database/user, exact volume mountpoints, safe source commit/tree, secure Restic files, and non-local repository.

- [ ] **Step 2: Capture the fixed scope**

Create:

- PostgreSQL custom-format dump;
- `sites` archive;
- platform Caddy data/config archives;
- Shared Edge Caddyfile/data/config archives.

Compute SHA-256 for every component and write a closed artifact manifest with no secret values.

- [ ] **Step 3: Create and read back the Restic snapshot**

Back up the exact bundle and artifact, parse one snapshot ID, read the repository ID, verify the artifact checksum by `restic dump`, and reject any mismatch.

- [ ] **Step 4: Publish candidate state durably**

Use temp file + file `fsync` + `os.replace` + parent-directory `fsync`. Publish the versioned candidate first and the fixed pointer last. Never change final evidence files.

### Task 3: Implement the isolated restore and evidence promotion

**Files:**
- Create: `platform-infra/backup/catering-restore-probe.sh`

**Interfaces:**
- Consumes:
  - the fixed candidate pointer;
  - exact candidate and artifact bindings;
  - root-owned Restic repository/password files;
  - digest-pinned `CATERING_RESTORE_POSTGRES_IMAGE`.
- Produces only after full success:
  - `/var/lib/catering-backup/catering-backup-evidence`;
  - `/var/lib/catering-backup/catering-backup-repository-status`;
  - `/var/lib/catering-backup/catering-restore-evidence`.

- [ ] **Step 1: Strictly validate pointer and candidate**

Reject unknown, duplicate, missing, malformed, symlinked, non-root-owned, or non-`0600` records. Require exact host, scope, repository, snapshot, artifact, commit/tree, RPO, and RTO bindings.

- [ ] **Step 2: Restore exact snapshot to an isolated work root**

Use `restic restore <snapshot-id> --target <temporary-root>`. Validate the restored artifact checksum and every component checksum before Docker is invoked.

- [ ] **Step 3: Restore PostgreSQL without production connectivity**

Require a `repository@sha256:<64hex>` PostgreSQL image. Start exactly one ephemeral container with:

```text
--network none
--pull never
--rm
```

Do not publish ports, join production networks, mount production data, run application services, send email, or invoke external providers.

- [ ] **Step 4: Verify restored schema and cleanup**

Restore the custom dump, require `catering_business_records` and `catering_source_documents`, remove the probe container and temporary data, and fail if cleanup is incomplete.

- [ ] **Step 5: Enforce RTO and promote evidence atomically**

Require duration `<= 14400`. Atomically publish repository status, final backup evidence, and restore evidence only after all verification and cleanup succeed. Keep previous successful evidence untouched on failure.

### Task 4: Add inert systemd contracts and runbook

**Files:**
- Create: `platform-infra/backup/catering-backup.service`
- Create: `platform-infra/backup/catering-backup.timer`
- Create: `platform-infra/backup/catering-restore-probe.service`
- Create: `docs/operations/CATERING_BACKUP_RESTORE.md`

**Interfaces:**
- Produces: future operator installation contract only; no installation or activation.

- [ ] **Step 1: Define the six-hour backup-and-restore cycle**

The timer runs at `00:00`, `06:00`, `12:00`, and `18:00` UTC with `Persistent=true`. The oneshot service executes backup and then restore probe.

- [ ] **Step 2: Define the manual restore-probe service**

Use the same protected environment file and four-hour timeout. It remains inert until separately installed and started.

- [ ] **Step 3: Document operator inputs and stop gates**

Document off-host target review, secret recovery reference, exact source commit/tree, digest-pinned PostgreSQL image, installation paths, evidence files, failure behavior, and the separate approvals required for installation, first backup, first restore, and later Phase 3.

### Task 5: Verify and prepare a draft PR

**Files:**
- Delete: `.github/workflows/catering-backup-restore-slice-tdd.yml`
- Retain all final slice files above.

**Interfaces:**
- Produces: a reviewable repository-only candidate; no merge authorization.

- [ ] **Step 1: Run focused GREEN tests**

```bash
npx vitest run tests/catering-backup-restore-contract.test.ts --maxWorkers=1
bash -n platform-infra/backup/catering-backup.sh
bash -n platform-infra/backup/catering-restore-probe.sh
```

Expected: all pass.

- [ ] **Step 2: Run repository build and exact-head CI**

```bash
npm run build
npm test
```

Expected: success. A real production backup/restore is explicitly not part of verification.

- [ ] **Step 3: Review scope and secrets**

Confirm no credentials, repository URLs, passwords, private keys, live hostnames, or production data appear in the diff.

- [ ] **Step 4: Open a draft PR**

The PR must state that unit files are inert and that installation, timer activation, first backup, first restore, Phase 3, and cutover remain separate explicit decisions.
