# Task 3 Fix Round 2 Report

## Scope

This round closes only the independently reproduced Task 3 gaps in approval retry identity, immutable handoff publication, audit recovery, cross-process file CAS, PostgreSQL revision backfill, and draft-bound UI state.

## RED Evidence

- Approval/backend slice: 3 of 11 focused tests failed before the fixes. A retry after source revision advance returned `201` instead of `409`; divergent comment/actor retries returned `201`; and retry after audit failure left no durable audit event.
- Persistence slice: 3 of 7 focused tests failed. Two processes both returned `updated`, an abandoned lock remained, and a legacy PostgreSQL row with `payload.revision` but no `version_number` returned `conflict`.
- UI slice: 6 focused assertions failed. Draft A actions leaked into draft B, unavailable focused drafts fell back to unrelated drafts, and load failures had no local recovery state.

## Implemented Behavior

1. Approval retries are identical only for the same revision, decision, selected variant, normalized comment, and trusted actor. A revision change or divergent retry fails closed with `409`.
2. Approved-offer, handoff, and handoff-derived production audit entries use stable artifact-derived identities and recover idempotently after publication failures.
3. Handoff-derived ProductionDrafts are built before collision checks and inserted once. Existing payloads are accepted only when structurally identical; poison and cross-business collisions fail closed.
4. Manual ProductionDraft import is insert-only, preventing it from overwriting a handoff-derived identity.
5. File-backed compare-and-set holds a per-record inter-process lock across version read and atomic replacement, with PID/token ownership and abandoned-lock recovery.
6. PostgreSQL schema v3 and the pg-mem mirror backfill `version_number` from a valid integer `payload.revision` when `payload.version` is absent.
7. Offer UI state is bound to the originating draft. A requested unavailable production draft never falls back to an unrelated draft; load errors have a distinct retry state.

## GREEN Evidence

- Focused integration command covering approval, handoff, production, persistence, UI and boundary tests: 8 files passed, 1 opt-in PostgreSQL file skipped; 53 tests passed, 4 skipped.
- Expanded Task 3 regression surface: 214 passed, 4 opt-in PostgreSQL tests skipped.
- Full `npm test`: 1,400 passed, 4 opt-in PostgreSQL tests skipped.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Dependency Audit

- `npm audit --omit=dev`: 4 high findings (`fast-uri`, `find-my-way`, `nanoid`, `postcss`).
- `npm audit`: 5 high findings (the same four plus dev-only `immutable`).
- Both are the known baseline; this round changed no dependency.

## Remaining Environment Note

Four real-PostgreSQL schema/concurrency tests remain explicit environment-gated tests and were skipped locally. The pg-mem upgrade/backfill path and the file multi-process race are committed regression tests. Independent review of the full Task 3 diff follows before publication.
