# Task 4 Report: Approved Production Specification And Apply Boundary

## Outcome

- Added the immutable, business-owned `ApprovedProductionSpec` contract and validation. A snapshot can be created only from a matching persisted approved `ApprovalRequestRecord`, and it contains the complete event, plan, purchase-list, and recipe artifacts.
- Added revisioned preparation through `POST /v1/production/drafts/:draftId/prepare`. Preparation uses deterministic planning without product-store writes, keeps web winners in the draft snapshot only, and creates required review cards/open questions for recipes and planning blockers.
- Replaced draft authorization with the canonical decision route. Required or blocking cards must be confirmed `fits`; an identical retry resumes missing snapshot publication, while a competing decision returns `409`.
- Added insert-only Apply through `POST /v1/production/approved-specs/:id/apply`. It reads only the immutable snapshot, compare-or-inserts every artifact, and publishes `ProductionApplyManifest` last. Fault coverage proves retry after every write boundary produces one complete result.
- Removed the old draft Apply route and browser-writable production-plan route. The retired URLs return `404`; the UI now retains the returned approved-spec ID and applies that exact snapshot.
- Business-scoped all ProductionStore collections and the private recipe library. Hosted database-backed libraries do not auto-seed fixtures; local recipe fixtures remain isolated per business context.
- Added the append-only migration unit named exactly `stage-a-004-production-v2`. It scopes and verifies plans, purchase lists, clarification records, drafts, feedback, and recipes. Legacy approved/applied drafts return to `pending_review` with `legacyApprovalState: "unverified"`; former state and source hash are retained as migration evidence without inventing an approval.
- Updated print-export reads, import commands, access control, mutation/data-safety inventories, and the ProductionDraft review panel/API.

## TDD Evidence

- RED: the initial `approved-production-spec` and Apply tests failed because there was no approved snapshot contract, drafts lacked the required revision/business shape, and Apply still depended on mutable draft state.
- RED: the migration regression failed before `stage-a-004-production-v2` and its production evidence column existed.
- GREEN focused corridor: 6 files / 41 tests passed across approved snapshots, review state, Apply, end-to-end draft flow, web-search gating, and local migration.
- Fault injection covers `after_approval_insert`, `after_event_spec_write`, `after_plan_write`, `after_purchase_list_write`, `after_recipe_write`, and `before_manifest_publish`.

## Verification

Implementation commit: `278150c` (`feat: apply approved production snapshots`).

```text
npm test
287 files passed, 1 skipped; 1456 tests passed, 13 skipped.

npx tsc --noEmit
passed (also executed by the final build).

npm run build
passed; Vite transformed 183 modules.

git diff --check
passed.
```

No provider call, provider dependency, live external data, `.impeccable/`, or `docs/agent-memory/` change was introduced.

## Remaining Boundary

`AcceptedEventSpec` persistence is insert-only during Apply but remains on the existing unscoped IntakeStore boundary. Trusted business scoping for Intake/EventSpec is deliberately deferred to Task 5, so this task does not claim hosted multi-business readiness; the code-owned hosted readiness gate remains closed.

## Root-Fix Round

The post-implementation review findings are closed in the current root-fix commit:

- Offer and Production decisions now share one business-and-target critical-section primitive. File storage uses a durable FIFO ticket queue across OS processes, real PostgreSQL uses a transaction-scoped signed 64-bit advisory lock on a checked-out client, and only pg-mem uses the explicit in-process test fallback. Released ticket history is excluded from the 4,096-active-ticket guard.
- Decision, review-card update, Prepare, Revise, and direct draft persistence all use the same target lock. The insert-only `ProductionDecisionAggregate` stores source draft, approval, decided projection, and approved snapshot together; a retry after `after_approval_insert` repairs projections from that immutable aggregate rather than rereading mutable source state.
- Public `insertApprovedProductionSpec` now requires the persisted approved Approval and authoritative aggregate for the same business, target, and revision. It verifies deterministic approval/spec IDs and the approval timestamp before compare-or-insert.
- ProductionStore and RecipeLibrary no longer expose context-free overloads or implicit `local` fallbacks. Recipe reads are side-effect free; fixtures are written only by the explicit local demo seed route or explicit import commands.
- `stage-a-004-production-v2` uses the real clarification-answer, clarification-draft, feedback-draft, production-draft, plan, purchase-list, and recipe validators. It upgrades a completed Stage-A-003 draft only when the persisted target is exactly the recognized old projection, aborts on malformed/divergent input, and publishes no completion evidence on failure.
- Hosted Production remains hard-disabled. Local Production rejects a trusted business that differs from its configured single business, containing the intentionally deferred unscoped Intake/EventSpec boundary.
- The main browser workflow now performs accepted-event import, Prepare, review, Decision, and Apply. Draft-list projections recover the approved-spec ID and applied state after reload; the dead `createProductionPlan` path is removed.
- Decision and Apply audit entries use stable idempotency keys, so successful request retries do not duplicate audit evidence.

### Root-Fix Verification

```text
npm test -- --reporter=dot
289 files passed, 1 skipped; 1476 tests passed, 14 skipped.
Wall-clock duration: 38.64 seconds.

npm run build
passed; TypeScript passed and Vite transformed 183 modules.

git diff --check
passed.
```

The opt-in real PostgreSQL critical-section test is present and is skipped when `CATERING_TEST_POSTGRES_URL` is not configured. File-process serialization, both decision/mutation lock orderings, crash recovery after Approval projection, migration crash/retry, explicit scope/seeding, and UI reload recovery run in the default suite.

## Root-Fix Round 2

The remaining production-boundary review findings are closed:

- A ProductionDraft ID now has one immutable revision identity. All revisions of the same business-and-draft ID share the decision lock, and a persisted revision cannot be replaced before or after a decision.
- `stage-a-004-production-v2` replaces only an exact recognized Stage-A-003 payload. File storage performs the comparison under the record lock; PostgreSQL performs one atomic `UPDATE ... WHERE payload = expected::jsonb`. A concurrent writer wins without being overwritten, and the migration publishes no completion evidence.
- Exported recipe discovery and production planning APIs require an explicit `BusinessContext`. The implicit `local` fallback is removed from both type signatures and runtime behavior, and every caller now supplies its scope.
- `ProductionApplyManifest` persists the first Apply actor's name and source. Apply always rereads and validates the authoritative manifest after insert or a lost insert race, then projects the idempotent audit actor and timestamp from that persisted claim rather than the retry request.

### Round 2 TDD Evidence

- RED: a decided revision could be replaced under the same draft ID; the sequential and serialized replacement promises resolved, and both concurrent first saves fulfilled.
- RED: both file and PostgreSQL migration races overwrote a concurrent scoped writer and still published `stage-a-004-production-v2` completion.
- RED: erased context-free discovery and planning calls resolved through the implicit local fallback; tightening the signatures then enumerated every remaining caller at compile time.
- RED: after a manifest write and injected audit failure, the retry manifest contained only an actor-name string and the audit used the retrying actor.
- GREEN: 17 focused test files / 104 tests passed, covering ApprovedProductionSpec decisions and Apply, file/PostgreSQL migration, explicit scope, and every migrated planning corridor.

```text
npx tsc --noEmit
passed.

npm run build
passed; TypeScript passed and Vite transformed 183 modules.

git diff --check
passed.
```

The full suite was intentionally not repeated in this slice because the parent Stage A verification run follows the separate lock-hardening work. Lock transport hardening is not part of this round.

## Target-Lock Liveness Hardening

- PostgreSQL now sets a transaction-local 10-second `lock_timeout` before acquiring the advisory lock. SQLSTATE `55P03` is translated to the existing domain timeout, the transaction is rolled back, and the checked-out client is released.
- File-backed tickets carry a renewable heartbeat plus host, process-incarnation, and process-start evidence. A fresh lease is never overtaken; an expired ticket from a terminated worker or reused PID is reclaimed without trusting the PID alone.
- The queued leader also owns the legacy lock path for the duration of the operation, closing the rolling-version race after the one-time preflight.
- RED covered the missing PostgreSQL deadline, a stale live-PID ticket, a non-renewed active lease, a same-PID worker race, and a legacy-lock entry after preflight. GREEN covered 74 focused tests across the shared lock and its Offer/Production callers; 3 optional real-PostgreSQL tests remained skipped without `CATERING_TEST_POSTGRES_URL`.

Implementation commits through this round: `c87e8a1`, `a94bbd5`, and `97f91a2`.

### Bounded-History Follow-Up

Released ticket and marker history remains durable per target, so acquisition scans grow linearly with repeated operations on that same target. The active 4,096-ticket pressure check is also advisory under simultaneous allocation. This does not weaken mutual exclusion or normal Task 4 behavior, where each immutable draft target has few operations, but safe queue compaction remains a focused maintenance follow-up rather than an untested cleanup inside this boundary change.

## Final Protocol-Transition Boundary

Task 4 does not claim a rolling upgrade between arbitrary Production-service builds. The supported Stage-A transition is the local launcher with all previous Production writers stopped:

- New Production decisions acquire the canonical revision-independent draft lock and, during this transition, the prior revision-specific compatibility lock in deterministic order. This closes same-target overlap with the immediately preceding writer protocol without pretending that every historical revision key can be locked dynamically.
- File-lock ownership now treats a matching live OS process fingerprint as authoritative even when a worker heartbeat is stale. Missing or unverifiable ownership evidence fails closed; a lock is reclaimed only with positive termination or process-incarnation evidence.
- `start-local-stack.sh` holds one port-wide startup lock across worktrees and data roots before migration until its own Production process answers health. macOS uses the atomic PID-aware `shlock`; Linux uses an advisory `flock`. Signals release the lock and terminate the launcher.
- The launcher checks screen sessions, repository processes, launchd supervision, and port 3103 before migration and immediately before starting Production. Health must return both `targetLockProtocol: "canonical-v2"` and the launcher's unique startup token, so an older or foreign process cannot satisfy readiness.
- Hosted Production remains hard-disabled. Starting an old or manually managed Production binary outside this launcher is not a supported Stage-A transition path.

The startup tests exercise two concurrent worktrees with different data roots, two concurrent stale-lock reclaimers, `SIGTERM` cleanup and takeover, a Production session appearing after migration, and a foreign canonical-v2 health response with the wrong startup token.

Implementation commits through the transition boundary: `7ddce71`, `059dad0`, and `890c628`.

### Final Focused Verification

```text
bash -n scripts/start-local-stack.sh
passed.

shellcheck scripts/start-local-stack.sh
passed.

npx vitest run tests/local-stack-migration-guard.test.ts tests/platform.test.ts \
  --reporter=dot -t "local stack migration guard|exposes health endpoints"
2 files passed; 9 tests passed, 50 skipped by the filter.

npx tsc --noEmit
passed.

npm run build
passed; TypeScript passed and Vite transformed 183 modules.

git diff --check
passed.
```

## Crash-Race Closure

The final adversarial review reproduced three additional process-crash races and one bounded-liveness issue. They are closed in `828c091`, `e3062be`, and `7f1543a`:

- Only the canonical file-queue leader may inspect, reclaim, or acquire the compatibility lock. Multiple contenders can no longer act on the same stale observation and delete a freshly replaced legacy lock.
- A terminated same-host ticket without a process fingerprint is reclaimable after its lease expires. A live or unverifiable owner still fails closed.
- On macOS, the local launcher gives the migration worker its own PID lock before allowing migration to start. Killing only the launcher therefore cannot release the safety boundary while the migration continues. A normal signal waits for the worker and cleans up immediately. The migration is executed directly as the resolved `node --import tsx` process, rather than through an npm supervisor or configurable wrapper whose child could outlive the lock-owning PID. On Linux, the direct migration process inherits the `flock` descriptor and the kernel keeps the lock until it exits.
- The migration worker uses a separate Bash process and `$$`, rather than `BASHPID`, so the implementation remains compatible with macOS Bash 3.2.

Focused verification on the committed fix:

```text
npx vitest run tests/target-critical-section.test.ts \
  tests/production-decision-critical-section.test.ts \
  tests/approved-production-spec.test.ts \
  tests/production-draft-apply.test.ts \
  tests/local-stack-migration-guard.test.ts \
  tests/platform.test.ts --reporter=dot
6 files passed; 103 tests passed, 1 skipped.

npx tsc --noEmit
passed.

npm run build
passed; TypeScript passed and Vite transformed 183 modules.

bash -n scripts/start-local-stack.sh
passed.

shellcheck scripts/start-local-stack.sh
passed.

git diff --check
passed.
```

## Final Repository Verification

```text
npm test -- --reporter=dot
291 files passed, 1 skipped; 1509 tests passed, 14 skipped.
Wall-clock duration: 54.79 seconds.

npx tsc --noEmit
passed.

npm run build
passed; TypeScript passed and Vite transformed 183 modules.

bash -n scripts/start-local-stack.sh
passed.

shellcheck scripts/start-local-stack.sh
passed.

git diff --check
passed.

hidden/Bidi/control scan
96 changed files scanned; 0 findings.
```

The current advisory database reports four production and five total high-severity npm findings. Task 4 changes no package manifest or lockfile relative to its base, so this is an unchanged repository-baseline gate failure rather than a dependency regression introduced here. It is reported without claiming a green audit and without mixing dependency maintenance into the production-contract change.
