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
