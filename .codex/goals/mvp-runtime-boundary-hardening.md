# MVP Runtime Boundary Hardening Goal

## Objective

Prove and harden the MVP runtime boundary without adding product behavior.

The platform should remain an internal controlled MVP with:
- fail-closed auth
- explicit dev auth
- localhost-only default binds
- one TS source of truth
- critical mutating routes protected by role checks
- services startable in the current TS-source workspace runtime

## Hard constraints

Do not:
- add new product behavior
- add new UI
- add new persistence behavior
- add BYO-LLM features
- add recipe research features
- reorganize documentation
- convert to build-to-dist
- perform broad route refactors
- rename domain concepts
- create speculative architecture
- make unrelated cleanup changes

Prefer:
- small patches
- tests over prose
- existing scripts
- existing conventions
- minimal edits
- fail-closed behavior
- explicit remaining risks

## Current context

Recent hardening already happened:
- trusted actor auth was made fail-closed
- dev auth requires CATERING_DEV_AUTH=1
- offer draft promotion route was protected
- mutating route auth matrix exists
- services should bind to 127.0.0.1 by default
- stale JS companions were removed
- TS source only is the current workspace runtime strategy
- build-to-dist is intentionally not part of this goal

## Tasks

### 1. Runtime smoke

Inspect scripts and service entrypoints for:
- intake-service
- offer-service
- production-service
- print-export

Verify each service:
- starts with the existing runtime/dev command or smallest equivalent command
- binds to 127.0.0.1 by default
- does not bind to 0.0.0.0 by default
- responds on one safe health/readiness/root endpoint if such endpoint exists
- can be stopped cleanly

If a stable automated test is simple, add:
- tests/runtime-service-smoke.test.ts

If automation would be brittle, do not force it. Output exact manual commands and observations.

### 2. Runtime single-source guard

Keep the existing TS-source-only strategy.

Verify:
- no committed .js file has a .ts or .tsx companion
- direct .js import specifiers in TS are compatible with NodeNext and do not require physical stale .js source files
- package exports do not point at deleted stale JS source files

Do not convert to dist.

### 3. Auth boundary review

Review critical mutating MVP routes.

Verify:
- anonymous/no trusted actor is rejected
- wrong role is rejected for critical routes
- correct role gets past auth for critical routes, even if later domain validation fails
- promote route remains protected by offer operator

Add tests only where coverage is clearly missing and can be added without large fixtures.

### 4. Localhost bind guard

Verify all service server entrypoints default to 127.0.0.1.

Add or update a simple static test if needed.

Do not require runtime socket inspection if it becomes brittle, but prefer real runtime verification if straightforward.

### 5. Validation

Run:
- npm test
- npm run build

Also run targeted tests if changed:
- npx vitest run tests/runtime-single-source.test.ts
- npx vitest run tests/mutating-route-auth-matrix.test.ts
- npx vitest run tests/runtime-service-smoke.test.ts, if added

## Success criteria

The goal is complete only when:
- tests pass
- build passes
- runtime smoke is either automated or manually verified with exact commands
- no stale JS companions remain
- localhost defaults remain guarded
- auth boundary tests still pass
- no product behavior was added
- changed files are minimal and directly related to this goal

## Output format

At the end, report:

1. Branch name
2. Changed files
3. Removed files
4. Commands run
5. Runtime smoke result per service
6. Test/build result
7. Remaining risks
8. Whether this is commit-worthy

## Stop conditions

Stop and report instead of broad refactoring if:
- a service cannot start
- package resolution is unclear
- a runtime smoke requires invasive changes
- tests fail for reasons unrelated to this goal
- fixing an issue would require product behavior changes
