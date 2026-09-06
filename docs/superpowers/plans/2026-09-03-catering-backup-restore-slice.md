# Catering Backup and Restore Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-only, fail-closed Catering backup and isolated restore contract with a six-hour RPO target and four-hour RTO target, without installing or running it in production.

**Architecture:** A root-run backup script creates a PostgreSQL custom-format dump and one canonical, non-verbose Restic `--stdin` snapshot stream. Secret-bearing Caddy sources are streamed directly from their identity-checked mountpoints into the encrypted off-host repository; no local Caddy tar/bundle is persisted. Backup publishes only a versioned candidate and atomically advances its pointer. A separate isolated restore probe reads the exact stream into a root-only transient tree, validates whole-stream and component bindings, restores PostgreSQL inside an ephemeral `--network none` container with no published ports, and only then writes a versioned receipt, snapshot-independent repository status, and finally the existing production evidence. Inert systemd unit templates define the future six-hour cycle; no deployment or activation is part of this plan.

**Tech Stack:** Bash 5, Docker CLI, PostgreSQL 17 tools inside containers, Restic, GNU tar/coreutils, Python 3 standard library for strict parsing and durable atomic publication, systemd, Vitest.

**Spec:** User-authorized repository-only slice in the Server Separation session on 2026-09-03.

**Shared persistence primitive:** `platform-infra/backup/catering-backup-common.sh`
is the single implementation boundary for bounded record reads, canonical
payload validation, and durable atomic publication. Backup and restore source
this file; they do not duplicate its filesystem primitives.

**Replacement budget baseline (Alexander-approved for both turns):** The
four production files below are the authoritative counting surface.  The
count is reproducible with `awk 'BEGIN{n=0} /^[[:space:]]*#/ {next} NF{n++}
END{print n}'` per file: blank lines and shell comments (including shebangs)
are excluded, while every non-comment line is counted, including embedded
Python lines and heredoc code.  Tests and documentation are measured
separately and do not consume this production budget.

| file | replacement-baseline lines |
| --- | ---: |
| `platform-infra/backup/catering-backup-common.sh` | 1113 |
| `platform-infra/backup/catering-backup.sh` | 428 |
| `platform-infra/backup/catering-restore-probe.sh` | 542 |
| `platform-infra/scripts/catering-production-evidence.sh` | 1098 |
| **total** | **3181** |

The shared Turn-1/Turn-2 ceiling is 3581 lines (at most 400 additional
imperative non-comment lines over 3181). Report the cumulative measured increment
and remaining allowance across both turns; the allowance never resets at a
turn boundary. No helper code may be moved or compressed to evade this count.

### Authorized continuation gate (2026-09-06)

Resume the existing candidate, worktree, branch and shared correction budget;
this is not a fresh attempt. The replacement baseline remains 3181 lines
(digest `b30aec25cc34017081552155488eead5719946ed4b47d454be9ac12034a3c87a`),
with one cumulative 3581-line ceiling across both turns. The current production
count is 3273 (+92 over baseline, 308 remaining). Tests and documentation are
counted separately; all production helpers count wherever placed. No helper
relocation or compression may evade the shared budget.

Acceptance is currently HOLD. The previous complete primary run is historical:
test exit 1, protective-runner exit 97, 21 failed tests and 14 existing optional
PostgreSQL skips. It is not a successful or interrupted run and is not relabelled
as current evidence. The five corrected backup findings remain preserved:
Restic identity generations, Caddy capture generations, receipt/status late
publication, the synthetic PostgreSQL inner restore path, and executable
collector error/change fixtures. Their earlier evidence is retained; the
synthetic restore is not proof of a real PostgreSQL restore.

The current authorized order supersedes historical task ordering below:

1. Close SSH isolation first, preserving the BASHPID contract and fail-closed
   missing/broken substitute-command cases under the unchanged protective runner.
2. Explain and verify all 21 previous failures in order: operator fixtures,
   bootstrap fixtures, then timeouts. Preserve causal RED and exact case-level
   GREEN evidence; use minimal cause-proven fixes without weakening assertions,
   budgets, isolation or guards. SSH/operator/bootstrap have independently reviewed
   evidence. Three representative timeout contracts passed only in the explicitly
   bound local Python configuration below; remaining cases stay open until run.
3. Run the remaining ten named timeout cases, then both complete affected Phase-3
   files without name filters. After that gate is reviewed, run both complete
   focus files (`catering-backup-restore-contract.test.ts` and
   `catering-production-evidence-workflow-contract.test.ts`) without name filters.
4. Run required Bash, ShellCheck, TypeScript/Vite build and diff-hygiene gates.
   Only after all prior gates are green, execute exactly ONE newly authorized
   complete primary `npm test`. Record test exit and guard/runner exit separately;
   both must be 0. Preserve terminal counts, duration and the 14 existing optional
   real-PostgreSQL skips as unexecuted integration coverage. No added skips,
   automatic retry, timeout change or incomplete-run GO is authorized.
5. Obtain two fresh independent final reviews bound to the final HEAD/tree,
   complete dirty fingerprint and actual terminal evidence. Unresolved load-bearing
   findings retain HOLD. Previously authorized local commits remain allowed after
   the required checks and reviews; no commit is currently planned or required.
   No new worktree/branch, push, PR, merge, workflow dispatch, deployment or
   publishing is part of this continuation.

**Reproducible local test prerequisite:** the existing provided Python 3.12.14
arm64 runtime is selected only for these local synthetic verification commands;
it is not a portable project default or a production interpreter change. The
protective runner remains byte-identical, SHA256
`de184923b6de2f4516e89834e87e4c4a71c05d0f49d4cc76674cc7971ce9bb25`.
Its outer clean environment and operational deny guards are unchanged. The child
uses `/usr/bin/env PATH=<original guard directory>:<python3-only shim directory>:<exact original remaining PATH>`
before `/usr/bin/time -lp /opt/homebrew/bin/node ...`. The exact literal outer and
child PATH, selected executable/version/prefixes, guard hashes, shim bytes/mode,
and normal/missing/non-executable exec/PPID probes are recorded in
`.superpowers/sdd/2026-09-03-catering-backup-restore-slice/prim2-timeout-bundle-path-binding-final.json`;
complete command arrays are in the associated `prim2-timeout-*-bundle*.json`
runner records and `prim2-timeout-bundle-audit-result.json`.

The ignored shim directory is
`/Users/alexandersmyslowski/Projects/catering-agents-platform/.worktrees/catering-backup-restore-slice-20260903/.superpowers/sdd/2026-09-03-catering-backup-restore-slice/prim2-timeout-bundle-python-only-final`.
To reproduce it, create only a mode-0755 file named `python3` containing exactly
these two newline-terminated lines:

```sh
#!/bin/sh
exec '/Users/alexandersmyslowski/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3' "$@"
```

The shim SHA256 is
`fef82bf75b2094ea63199887411420a5cf0424e7bce2af32730261a80478c5f3`;
its existing absolute target SHA256 is
`ac60cfe0268614638d0ffa35f3b0284fc7b3a11482723793455e17eeb278509e`.
Verify these hashes, the directory's sole entry, actual child PATH and guard
precedence before/after each run. The unchanged harness still prepends its
per-fixture Docker/SSH/SCP/sudo fakes. The exec shim preserves parent/child identity
and fails closed for a missing or non-executable target; no fallback interpreter,
startup flag, dependency installation or global PATH change is permitted. This
selection covers all existing local Python integrity checks and fake commands
inside the synthetic pilot; it is not a fake-only optimization.

Only local synthetic commands and controlled fake operational executables are
allowed. No real Docker, PostgreSQL, Restic, SSH, systemd, production ENV,
credentials, operational Hub wrappers or other project strands. Stop for an
architecture P1, unexplained candidate mutation, budget risk or necessary
operational access. RPO=21600 and RTO=14400 remain exact boundary contracts.

## Global Constraints

- Authoritative base commit: `feb5434df995e025d0525ac4dfc882508c037edc`.
- Authoritative base tree: `78fa0f1f946a67516b76540b563faa66f2a81cda`.
- RPO target: exactly `21600` seconds.
- RTO target: exactly `14400` seconds.
- No production backup, restore, deployment, SSH, Docker, DNS, Caddy, secret, or host mutation.
- Final backup evidence must not advance until the exact snapshot has passed the isolated restore probe; Evidence is the last atomic publication.
- Existing successful evidence must remain unchanged on failure before its replacement. If replacement succeeds but the required directory fsync fails, report durability unknown and no success; do not claim unchanged prior evidence or attempt automatic recovery.
- Restic repository and password files are root-owned mode `0600`; repository must be non-local.
- Two separate root-owned `0600` operator-attestation records are required:
  an off-host endpoint/address binding and an independent secret-recovery
  binding. They are descriptor-read and digest-bound at every promotion;
  status is `operator_attested`, source type/reference/schema are closed-world,
  and the operator set is renewable for at most 30 days. Backup admission
  requires at least 21600 seconds remaining; restore admission requires at
  least 18000 seconds remaining. RPO remains a separate six-hour contract.
- Restore container uses a digest-pinned PostgreSQL image, `--network none`, no published ports, no production network, and no app services.
- The versioned backup scope is exactly `postgres,sites,platform-caddy,shared-edge-caddy`; no separate or ambiguous `data` scope exists.
- Scope components are fixed to the PostgreSQL custom dump, `/opt/catering-agents-platform/platform-infra/sites`, `platform-infra_caddy_data`, `platform-infra_caddy_config`, `/opt/shared-edge/Caddyfile`, `shared-edge_edge_caddy_data`, and `shared-edge_edge_caddy_config`.
- `catering_business_records` and `catering_source_documents` are proven only inside the restored PostgreSQL dump; no separate Catering `DATA_ROOT` is captured or restored.
- No secret values may be written to Git, logs, local Caddy archives, artifacts, evidence files, or manifests; an independent secret-recovery reference hash is bound end to end.

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
- Create: `platform-infra/backup/catering-backup-common.sh`
- Create: `platform-infra/backup/catering-backup.env.example`

**Interfaces:**
- Consumes:
  - root-owned Restic repository/password files;
  - `CATERING_BACKUP_EXPECTED_HOST_SHA256`;
  - `CATERING_BACKUP_SOURCE_COMMIT`;
  - `CATERING_BACKUP_SOURCE_TREE`;
  - exact Compose project/service/volume identities.
- Produces:
  - one encrypted off-host Restic stdin snapshot whose internal paths are relative and component-ID based;
  - `/var/lib/catering-backup/snapshots/<run-id>` non-secret artifact record;
  - `/var/lib/catering-backup/candidates/<run-id>` candidate;
  - `/var/lib/catering-backup/catering-backup-candidate` pointer.
- Does not produce final backup evidence.

- [ ] **Step 1: Validate runtime identity before capture**

Require root, exact host digest, exact PostgreSQL project/service identity, exact database/user, exact volume mountpoints, safe source commit/tree, secure Restic files, and non-local repository. Two separate root-owned `0600` operator-attestation records are mandatory: the off-host record binds the canonical locator, resolved endpoint address set, canonical live-plus-operator production address set and digest (including the exact external `none`/IP-CSV field), repository ID, production host binding, fixed scope and UTC validity; the independent secret-recovery record binds a closed-world `source_type` (`github_environment` or `offline_vault`), an operator-provided canonical non-secret `source_reference`, its SHA-256 computed from that locator, and a schema digest covering the Restic encryption password, off-host repository access, `POSTGRES_PASSWORD`, `CATERING_TRUSTED_ACTOR_SECRET`, and `CATERING_BASIC_AUTH_PASSWORD_HASH`, together with repository/host/scope and UTC validity. Each admission captures interface addresses, external addresses and endpoint answers exactly once and passes that immutable generation to all leaf validators. Both use `status=operator_attested` and are revalidated at every promotion; neither asserts external verification or carries secret values.

- [ ] **Step 2: Capture the fixed scope**

Create one closed manifest for:

- the PostgreSQL custom-format dump, with `public.catering_business_records` and `public.catering_source_documents` verified only after isolated restore;
- direct `sites`, platform Caddy data/config, Shared Edge Caddyfile/data/config sources under unique internal component IDs (never local archives), using the exact versioned scope names `postgres`, `sites`, `platform-caddy`, and `shared-edge-caddy`.

Compute SHA-256 for every component and write a closed artifact manifest with no secret values.

- [ ] **Step 3: Create and read back the Restic snapshot**

Back up exactly one `--stdin` stream (no file arguments), parse one 64-hex snapshot ID, read the repository identity before and after capture, hash that sole snapshot object with `restic dump`, and bind the resulting whole-stream checksum into the candidate. A repository-ID change prevents candidate/pointer promotion. The same closed-world scope and component identifiers are consumed by the restore and evidence collector.

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
  - `/var/lib/catering-backup/catering-backup-repository-status` (status,
    identity, host binding, scope, verified_at only);
  - a versioned restore receipt whose path/checksum are bound in final
    evidence.

- [ ] **Step 1: Strictly validate pointer and candidate**

Reject unknown, duplicate, missing, malformed, symlinked, non-root-owned, or non-`0600` records. Require exact host, scope, repository, snapshot, artifact, commit/tree, RPO, and RTO bindings.

- [ ] **Step 2: Restore exact snapshot to an isolated work root**

Use `restic dump <snapshot-id> <stdin-filename>` into a root-only transient tree. Validate the whole-stream checksum, relative manifest/postgres paths, and every expected Caddy component before Docker is invoked.

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

Require duration `0 <= elapsed <= 14400` for the complete probe path, then re-read repository identity immediately before receipt and status and once more before final evidence. Publish the versioned receipt, snapshot-independent repository status, and only then final evidence; keep previous successful evidence untouched on every earlier failure. The final evidence binds the versioned receipt path/checksum and the exact four-name scope; atomic publication includes the required parent-directory fsync, and no fallible operation follows its successful completion. A directory-fsync failure after replace is durability unknown, never success or a claim that old evidence is unchanged.

### Task 4: Add inert systemd contracts and runbook

**Files:**
- Create: `platform-infra/backup/catering-backup.service`
- Create: `platform-infra/backup/catering-backup.timer`
- Create: `platform-infra/backup/catering-restore-probe.service`
- Create: `docs/operations/CATERING_BACKUP_RESTORE.md`

**Interfaces:**
- Produces: future operator installation contract only; no installation or activation.

- [ ] **Step 1: Define the six-hour backup-and-restore cycle**

The timer runs at `00:00`, `06:00`, `12:00`, and `18:00` UTC with
`Persistent=true`; it starts only `catering-backup.service`. That service runs
the backup candidate producer and uses `OnSuccess=catering-restore-probe.service`
to start the separately timed restore probe. No inline backup-plus-restore
command is used.

- [ ] **Step 2: Define the manual restore-probe service**

Use the same protected environment file and four-hour timeout. It remains inert until separately installed and started.

- [ ] **Step 3: Document operator inputs and stop gates**

Document off-host target review, secret recovery reference, exact source commit/tree, digest-pinned PostgreSQL image, installation paths, evidence files, failure behavior, the monthly operator-led atomic attestation-set rotation (warning at 48 hours, no automatic refresh), and the separate approvals required for installation, first backup, first restore, and later Phase 3.

### Task 5: Verify the local reviewable candidate

**Files:**
- Delete: `.github/workflows/catering-backup-restore-slice-tdd.yml`
- Retain all final slice files above.

**Interfaces:**
- Produces: a reviewable local repository-only candidate; no external publication authorization.

- [ ] **Step 1: Run focused GREEN tests**

```bash
npx vitest run tests/catering-backup-restore-contract.test.ts tests/catering-production-evidence-workflow-contract.test.ts --maxWorkers=1
bash -n platform-infra/backup/catering-backup-common.sh
bash -n platform-infra/backup/catering-backup.sh
bash -n platform-infra/backup/catering-restore-probe.sh
bash -n platform-infra/scripts/catering-production-evidence.sh
shellcheck platform-infra/backup/catering-backup-common.sh \
  platform-infra/backup/catering-backup.sh \
  platform-infra/backup/catering-restore-probe.sh \
  platform-infra/scripts/catering-production-evidence.sh
```

Expected: all pass.

- [ ] **Step 2: Run required static/build gates, then the one primary run**

```bash
npx tsc --noEmit
npm run build
npm test
```

Expected: success. A real production backup/restore is explicitly not part of verification.

- [ ] **Step 3: Obtain two independent final reviews**

Bind both independent reviews to the final HEAD/tree, dirty fingerprint and command evidence. Confirm no credentials, private keys or private production data enter the diff or evidence; do not read protected runtime inputs to compute fingerprints.

- [ ] **Step 4: Finish the local handoff**

After all required gates pass, retain the reviewable local candidate and verification artifacts; a local commit is authorized. Push, PR, merge, workflow dispatch and deployment remain out of scope. Unit files remain inert; installation, timer activation, first backup, first restore, Phase 3 and cutover need separate explicit decisions.
