# Deployment Manifest Sudo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is acceptable here) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the non-root Hetzner deploy user able to publish `.deploy-manifest` atomically after a successful smoke check by elevating only the temporary-file write and final move.

**Architecture:** Keep the existing remote manifest block and its ordering unchanged. Write the manifest contents through `sudo tee` to the per-process temporary path, then use `sudo mv` for the atomic replacement; leave validation, snapshot, rsync, Compose, smoke, and all other SSH commands unchanged. Add a fake-SSH hardening contract that models `codex` being unable to write under `/opt` unless both manifest operations are individually privileged.

**Tech Stack:** Bash, OpenSSH command execution, `sudo`, `tee`, `mv`, Vitest, TypeScript, npm, Playwright-backed browser rehearsal, GitHub CLI.

**Spec:** Current user request in this task; no narrower repository design document exists for this deployment permission fix.

## Global Constraints

- Work only in the isolated worktree branch `fix/deployment-manifest-sudo-20260818` based on the current `origin/main`.
- Leave the original checkout and the existing rollback-fix worktree untouched.
- Change only the manifest temporary write and atomic move privilege boundary plus its focused hardening test.
- Preserve the existing snapshot exclusions, smoke ordering, and no-deploy/no-server-change scope.
- Do not use a broad `sudo sh -c` wrapper or elevate unrelated deployment operations.

---

### Task 1: Verify the isolated baseline and plan

**Files:**
- Create: `docs/superpowers/plans/2026-08-18-deployment-manifest-sudo.md`

**Interfaces:**
- Consumes: `origin/main` at `b6d1a5f5c091b011ef2eccc71c63b42f0334cefc`.
- Produces: a clean worktree and a bounded implementation checklist.

- [x] **Step 1: Verify branch and worktree boundaries**

Run:

```bash
git status --short --untracked-files=all
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
```

Expected: no status output, branch `fix/deployment-manifest-sudo-20260818`, and identical HEAD/origin-main IDs equal to the commit above.

- [x] **Step 2: Confirm unrelated checkouts remain unchanged**

Run `git status --short --untracked-files=all` in the original checkout and the existing rollback-fix worktree; preserve their pre-existing state exactly.

### Task 2: Add the codex manifest-permission regression test (RED)

**Files:**
- Modify: `tests/hetzner-deploy-hardening.test.ts`

**Interfaces:**
- Consumes: `platform-infra/scripts/deploy-hetzner.sh` through the temporary fake-SSH harness.
- Produces: a contract requiring `sudo tee` for the temporary manifest and `sudo mv` for the final atomic replacement, with the manifest command after smoke.

- [x] **Step 1: Write the failing test**

Add a test named `codex deployment user requires sudo for atomic manifest publication`. Its fake `ssh` should succeed for environment validation, rollback snapshot, directory chmod, and Compose; for the manifest command it should exit 13 unless the command contains `sudo tee`, `sudo mv`, the expected temporary suffix, and no `sudo sh -c`/`sudo bash -c`. Fake `rsync` and `curl` should succeed. Assert the deploy exits successfully only after the implementation and that the manifest command is after the smoke/rsync calls.

- [x] **Step 2: Run the focused test to prove RED**

Run:

```bash
npx vitest run tests/hetzner-deploy-hardening.test.ts -t "codex deployment user requires sudo for atomic manifest publication"
```

Expected: FAIL with exit 13 because the current block uses unprivileged redirection and `mv`.

### Task 3: Apply the minimal manifest sudo fix (GREEN)

**Files:**
- Modify: `platform-infra/scripts/deploy-hetzner.sh:82-96`
- Test: `tests/hetzner-deploy-hardening.test.ts`

**Interfaces:**
- Consumes: the RED fake-SSH permission contract.
- Produces: individually privileged manifest writes with preserved content and atomic replacement.

- [x] **Step 1: Replace only the manifest write operations**

Change the existing remote block to stream the exact manifest content to the temporary path and move it atomically:

```bash
  printf '%s\n' \
    'commit=${DEPLOY_COMMIT_SHA}' \
    "deployed_at=\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    'rollback_root=${DEPLOY_ROLLBACK_ROOT}' \
    | sudo tee "\${temporary}" >/dev/null
  sudo mv "\${temporary}" "\${manifest}"
```

- [x] **Step 2: Run the focused test to prove GREEN**

Run the same focused Vitest command and expect PASS.

- [x] **Step 3: Run the deployment contracts**

```bash
npx vitest run tests/hetzner-deploy-hardening.test.ts tests/hetzner-deploy-script.test.ts
```

Expected: PASS.

### Task 4: Run all local verification gates

**Files:**
- Test: `tests/hetzner-deploy-hardening.test.ts`
- Test: `tests/hetzner-deploy-script.test.ts`

**Interfaces:**
- Consumes: the GREEN implementation.
- Produces: local evidence for full Vitest, build, diff hygiene, and the synthetic browser rehearsal.

- [x] **Step 1: Run full Vitest**

Run `npm test -- --testTimeout=60000` and require zero failures.

- [x] **Step 2: Run build and shell/diff checks**

Run `npm run build`, `bash -n platform-infra/scripts/deploy-hetzner.sh`, and `git diff --check`; all must pass.

- [x] **Step 3: Run the full fresh browser rehearsal**

After confirming `command -v npx`, run `npm run browser:rehearsal:full-fresh` against temporary synthetic data only.

### Task 5: Commit, push, and open a review-only PR

**Files:**
- Modify: only the deployment script, hardening test, and this plan.

**Interfaces:**
- Consumes: final verified branch.
- Produces: one commit and one draft PR against `main`; no merge and no deployment.

- [ ] **Step 1: Review and commit only intended files**

```bash
git add platform-infra/scripts/deploy-hetzner.sh tests/hetzner-deploy-hardening.test.ts docs/superpowers/plans/2026-08-18-deployment-manifest-sudo.md
git diff --cached --check
git commit -m "fix: publish deployment manifest with sudo"
```

- [ ] **Step 2: Push and create the draft PR**

```bash
git push -u origin fix/deployment-manifest-sudo-20260818
gh pr create --base main --head fix/deployment-manifest-sudo-20260818 --draft --title "Fix Hetzner deployment manifest permissions" --body <review-summary>
```

The PR body must include RED/GREEN evidence, full local gates, exact least-privilege scope, and an explicit statement that no server change, merge, or deploy was performed.
