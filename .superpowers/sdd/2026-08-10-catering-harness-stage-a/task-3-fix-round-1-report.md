# Task 3 Fix Round 1 Report

## Status

Complete. Every valid High, Medium, and Low finding in the corrective brief was reproduced, fixed with focused regression coverage, and verified on the complete repository suite.

## Corrective Outcomes

1. Added a narrowly scoped trusted read guard for `GET /v1/offers/handoffs/:handoffId`. A production service actor can read a handoff but remains forbidden from offer approval and mutation routes.
2. Bound the HTTP handoff reader to its request: only `404` returns `undefined`; malformed `200` responses and handoff ID or business mismatches are protocol errors. The production route repeats the identity/business check before persistence.
3. Made the selected variant's `budgetContext.pricingSummary` authoritative for both ApprovedOffer and ProductionHandoff snapshots.
4. Unified local stack seeding, direct operational checks, and Vite proxies on server-owned trusted actor headers for intake, offer, production, audit, and export while preserving strict offer approval authorization.
5. Replaced draft check-then-set identity handling with insert/CAS semantics backed by the draft revision. Concurrent divergent writes now produce one success and one conflict in file and PostgreSQL-backed modes.
6. Added JSON-normalized structural equality and applied it to drafts, approved offers, and handoffs so JSONB key reordering and omitted `undefined` fields do not break idempotent retries.
7. Completed the UI chain from approval to handoff to `POST /v1/production/drafts/from-handoff/:handoffId`, retained the resulting production draft ID, and exposed a human-readable production-entry action that focuses the exact draft without displaying the raw handoff ID.
8. Rejected cross-business handoffs before production persistence and retained server-owned `businessId` on the created ProductionDraft contract.
9. Completed Stage A migration evidence in file and PostgreSQL modes: discarded handoff flag/count/hash, preserved legacy source, `stage-a-002-offers` reporting for empty and already-complete runs, crash/resume coverage, and evidence backfill for older completion records.
10. Covered approval absence, concurrency, post-insert failure recovery, identical retry, deterministic identity conflicts, handoff retry, and single-write audit behavior.
11. Removed the unused `promoteOfferVariant` helper/export and retained an assertion that the legacy HTTP promotion route remains absent.

## RED Evidence

The following focused runs failed before their corresponding production changes:

- `npx vitest run tests/production-handoff-port.test.ts`: 5 failed, 2 passed. It reproduced missing/malformed envelope acceptance, requested ID/business mismatch acceptance, the real production-reader route failure, and cross-business persistence.
- `npx vitest run tests/offer-production-handoff.test.ts tests/offer-approval-request.test.ts tests/business-scoped-persistence.test.ts`: 6 failed, 7 passed in the new cases. It reproduced draft-midpoint pricing, two-success concurrent file/PostgreSQL writes, JSONB reordered retry conflicts, duplicate audit evidence, and reordered approved/handoff retry conflicts.
- `npx vitest run tests/offer-approval-action.test.ts`: 1 failed. The action stopped after creating a handoff and never created/opened the production draft.
- `npx vitest run tests/production-draft-review-panel.test.tsx -t "focuses the production draft selected by the handoff entry URL"`: 1 failed, 6 skipped. The panel selected the newest draft instead of the handed-off draft.
- `npx vitest run tests/task-3-local-trusted-channel.test.ts`: 2 failed, 1 passed initially; the subsequently added direct-check assertion also failed before script wiring. Vite proxies and local seed/check scripts lacked the consistent trusted channel.
- `npx vitest run tests/local-business-scope-migration.test.ts`: 5 failed, 1 passed initially. Migration completion metadata omitted discarded-handoff evidence and required empty/retry/crash behavior. The upgrade/backfill case then failed 1 test with 6 skipped until older completion records were repaired from their preserved source.
- `npx vitest run tests/task-1-review-fixes.test.ts tests/local-ops-check-contract.test.ts`: 2 failed, 8 passed for the targeted assertions. It reproduced the remaining legacy helper/export and incomplete local trusted-channel checks.

Each RED was followed by the minimal implementation change and a focused GREEN rerun before the next behavior was addressed. Existing assertions were retained and strengthened where migration evidence needed to name both units explicitly.

## Final Verification

- `npx vitest run tests/offer-approval-request.test.ts tests/offer-production-handoff.test.ts tests/offer-approval-action.test.ts tests/production-handoff-port.test.ts tests/local-business-scope-migration.test.ts tests/offer-gold-run.test.ts tests/mutating-route-auth-matrix.test.ts tests/data-safety-audit-gates.test.ts tests/app-offer-route-app-boundary.test.ts tests/app-offer-route-state.test.ts tests/offer-workbench-state.test.ts tests/production-draft-review-panel.test.tsx tests/task-3-local-trusted-channel.test.ts tests/local-ops-check-contract.test.ts tests/business-scoped-persistence.test.ts tests/task-1-review-fixes.test.ts`: 16 files passed, 192 tests passed.
- `npm test`: 283 files passed, 1 skipped; 1,383 tests passed, 4 skipped. The four skipped tests are the repository's explicit opt-in external PostgreSQL schema/concurrency suite; PostgreSQL-backed behavior in this correction was exercised through the repository's `pg-mem` test mode.
- `npx tsc --noEmit`: passed (also executed by the final build).
- `npm run build`: passed; TypeScript validation and the Vite production build completed with 183 modules transformed.
- `git diff --check f4399a3..HEAD`: passed with exit code 0 and no output.

## Audit Baseline

- `npm audit --omit=dev --json`: exit 1 with 4 high, 0 critical vulnerabilities (`fast-uri`, `find-my-way`, `nanoid`, `postcss`).
- `npm audit --json`: exit 1 with 5 high, 0 critical vulnerabilities (the production set plus development-only `immutable`).

These are known transitive dependency findings and were not changed because dependency upgrades are outside this corrective Task 3 scope.
