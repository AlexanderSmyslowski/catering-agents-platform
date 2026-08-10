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
