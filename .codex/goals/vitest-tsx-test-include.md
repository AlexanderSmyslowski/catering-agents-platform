# Vitest .test.tsx Include

## Objective

Ensure `.test.tsx` files under `tests/` run in the normal Vitest/npm test run.

## Context

PR #476 discovered that `tests/shared-mini-pilot-workbench-flow.test.tsx` never runs:
`vitest.config.ts` uses `include: ["tests/**/*.test.ts"]`, which does not match `.tsx`.
It is the only `.test.tsx` file in the repo today.

## Decision

Smallest safe fix: add `tests/**/*.test.tsx` to the Vitest `include` list.
Renaming the test to `.test.ts` was rejected — the file contains JSX and would need
`createElement` rewrites, a larger and riskier diff. The added pattern only matches
files explicitly named `*.test.tsx` under `tests/`, so no non-test files can be
pulled in.

## Constraints

No product/UI behavior change, no test renames, no weakened includes, no skipped
tests, minimal patch, no PR merge.

## Validation

- Previously excluded test runs standalone and repeatedly (flake check).
- `npm test` now includes the `.tsx` test file; total file count increases by exactly 1.
- `npm run build`, `npm audit --omit=dev`, `npm audit`, `git diff --check` clean.
- Hidden/bidi/control-character scan on changed files; exact-SHA raw checks after push.
- Draft PR; Ready for Review only if CI and checks are clean. Do not merge.
