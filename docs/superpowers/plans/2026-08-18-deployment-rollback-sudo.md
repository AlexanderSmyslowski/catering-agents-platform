# Deployment Rollback Sudo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hetzner rollback-root and snapshot writes work for the non-root deployment user by applying `sudo` only to the individual privileged operations, with a regression test for the observed `codex` permission failure.

**Architecture:** Keep `platform-infra/scripts/deploy-hetzner.sh` as the single deployment orchestration script. In its existing remote snapshot block, elevate only `mkdir`, `tar`, and the `latest` marker write; leave validation, timestamp generation, command sequencing, rsync, Compose, smoke checks, and manifest handling unchanged. Extend the existing Vitest hardening contract with a fake-SSH permission gate that rejects unprivileged rollback writes while preserving the existing snapshot exclusions.

**Tech Stack:** Bash, OpenSSH command execution, `sudo`, `tar`, `tee`, Vitest, TypeScript, npm, Playwright-backed browser rehearsal, GitHub CLI.

**Spec:** Current user request in this task; the repository does not contain a narrower design document for this deployment fix.

## Global Constraints

- Work only in the isolated worktree branch `fix/deployment-rollback-sudo-20260818` based on the current `origin/main`.
- Leave the original checkout's `AGENTS.md`, `.impeccable/`, and existing branch changes untouched.
- Change only the rollback-root/snapshot privilege boundary and its hardening test; do not broaden `sudo` to the whole remote shell.
- Keep `.env`, `data`, and `platform-infra/sites` excluded from snapshots and rsync.
- Do not connect to or modify the Hetzner server, change secrets, start a deployment run, merge, or modify application code.

---

### Task 1: Record the isolated baseline and plan

**Files:**
- Create: `docs/superpowers/plans/2026-08-18-deployment-rollback-sudo.md`

**Interfaces:**
- Consumes: current `origin/main` at `bc58ce5f4cc602c795187a836950d2dd7b74f59a`.
- Produces: a clean, reproducible worktree and an implementation checklist for the remaining tasks.

- [x] **Step 1: Verify the worktree boundary**

Run:

```bash
git status --short --untracked-files=all
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
```

Expected: no status output, the fix branch name, and identical commit IDs equal to `bc58ce5f4cc602c795187a836950d2dd7b74f59a`.

- [x] **Step 2: Confirm the original checkout remains separate**

Run the same status check in `/Users/alexandersmyslowski/Projects/catering-agents-platform` and verify its pre-existing `AGENTS.md` and `.impeccable/` changes remain present without copying into this worktree.

### Task 2: Add the codex permission regression test (RED)

**Files:**
- Modify: `tests/hetzner-deploy-hardening.test.ts`

**Interfaces:**
- Consumes: `platform-infra/scripts/deploy-hetzner.sh` through the existing temporary fake `ssh`, `rsync`, and `curl` harness.
- Produces: a failing contract that requires privileged rollback-root creation, archive creation, and `latest` marker writes while retaining all three snapshot exclusions.

- [x] **Step 1: Write the failing test**

Add a test whose fake `ssh` succeeds for the remote `.env` check, then treats the snapshot command as the `codex` user: it exits non-zero unless the command contains `sudo mkdir -p`, `sudo tar -czf`, and `sudo tee`, and it records the command for ordering/exclusion assertions. Keep later fake SSH calls successful, make fake rsync and curl succeed, assert the deploy exits successfully after the implementation, and assert the snapshot command occurs before rsync and includes `--exclude=./data`, `--exclude=./platform-infra/.env`, and `--exclude=./platform-infra/sites`.

- [x] **Step 2: Run the focused test to prove RED**

Run:

```bash
npx vitest run tests/hetzner-deploy-hardening.test.ts -t "codex deployment user requires sudo for rollback writes"
```

Expected: FAIL because the current script emits unprivileged `mkdir`, `tar`, and marker redirection.

### Task 3: Apply the minimal rollback privilege fix (GREEN)

**Files:**
- Modify: `platform-infra/scripts/deploy-hetzner.sh:38-52`
- Test: `tests/hetzner-deploy-hardening.test.ts`

**Interfaces:**
- Consumes: the existing remote snapshot shell block and the RED contract.
- Produces: a remote snapshot sequence with least-privilege elevation: `sudo mkdir -p`, `sudo tar -czf`, and `printf ... | sudo tee ... >/dev/null`; no broad `sudo sh -c` wrapper.

- [x] **Step 1: Implement only the privileged operations**

Replace the three rollback writes in the existing remote block with the exact forms below, preserving variable quoting, archive naming, ordering, and exclusions:

```bash
  sudo mkdir -p "\${rollback_root}"
  archive="\${rollback_root}/catering-agents-platform-\${timestamp}.tar.gz"
  sudo tar -czf "\${archive}" \
    --exclude=./data \
    --exclude=./platform-infra/.env \
    --exclude=./platform-infra/sites \
    -C '${DEPLOY_PATH}' .
  printf '%s\n' "\${archive}" | sudo tee "\${rollback_root}/latest" >/dev/null
```

- [x] **Step 2: Run the focused test to prove GREEN**

Run:

```bash
npx vitest run tests/hetzner-deploy-hardening.test.ts -t "codex deployment user requires sudo for rollback writes"
```

Expected: PASS, with the permission gate satisfied and no change to rsync or later deployment phases.

- [x] **Step 3: Run the complete deployment-script contracts**

Run:

```bash
npx vitest run tests/hetzner-deploy-hardening.test.ts tests/hetzner-deploy-script.test.ts
```

Expected: PASS.

### Task 4: Verify the complete local gates and browser rehearsal

**Files:**
- Test: `tests/hetzner-deploy-hardening.test.ts`
- Test: `tests/hetzner-deploy-script.test.ts`
- Runtime: local synthetic stack only; no Hetzner access.

**Interfaces:**
- Consumes: the GREEN branch state.
- Produces: recorded results for the full Vitest suite, TypeScript/build checks, diff hygiene, and the repository's fresh browser rehearsal.

- [x] **Step 1: Run the full test suite**

Run `npm test -- --testTimeout=60000` and require a zero exit status; the default 15-second run had one unrelated audit-fixture timeout, while the same test passes independently.

- [x] **Step 2: Run the build and diff checks**

Run `npm run build` and `git diff --check`; both must succeed.

- [x] **Step 3: Run the browser rehearsal**

Verify `npx` is available, then run `npm run browser:rehearsal:full-fresh` against the repository's isolated synthetic fresh-data lifecycle. Do not point it at production and do not enable real-data or deployment flags.

### Task 5: Publish a review-only pull request

**Files:**
- Modify: only the script, hardening test, and this plan.

**Interfaces:**
- Consumes: verified branch and test evidence.
- Produces: one commit pushed to the fix branch and one pull request targeting `main`; no merge and no deployment run.

- [ ] **Step 1: Review the final diff and scope**

Run `git diff --check`, `git diff --stat`, and `git status --short --untracked-files=all`; confirm no server, secret, application-code, or unrelated-file changes.

- [ ] **Step 2: Commit the focused change**

```bash
git add platform-infra/scripts/deploy-hetzner.sh tests/hetzner-deploy-hardening.test.ts docs/superpowers/plans/2026-08-18-deployment-rollback-sudo.md
git commit -m "fix: use sudo for Hetzner rollback snapshots"
```

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin fix/deployment-rollback-sudo-20260818
gh pr create --base main --head fix/deployment-rollback-sudo-20260818 --draft --title "Fix Hetzner rollback snapshot permissions" --body-file <review-body>
```

The PR body must summarize the least-privilege scope, RED/GREEN evidence, full local gates, browser rehearsal, and explicitly state that no deployment or merge was performed.
