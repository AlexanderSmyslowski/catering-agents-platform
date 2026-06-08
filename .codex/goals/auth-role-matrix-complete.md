# Auth Role Matrix Complete

## Objective

Make the MVP authorization boundary explicit and testable for all mutating MVP routes.

Every mutating MVP route must include role coverage for:
- no actor -> 403
- wrong role -> 403
- correct role -> passes auth boundary

"Passes auth boundary" does not require successful domain execution. A 400/404/422 after auth is acceptable if the payload or fixture is intentionally minimal.

## Hard constraints

Do not do any of the following:
- add product behavior
- add UI behavior
- change persistence behavior
- add BYO-LLM behavior
- add recipe research behavior
- weaken fail-closed auth
- enable dev auth globally
- refactor unrelated routes
- create broad architectural changes

Prefer the following:
- table-driven tests
- explicit route-to-role mapping
- minimal fixtures
- existing helpers
- small patches
- tests over prose

## Current context

Recent hardening already happened:
- trusted actor auth is fail-closed
- CATERING_DEV_AUTH=1 is required for dev actor headers
- services bind to 127.0.0.1 by default
- Docker Compose explicitly opts service containers into 0.0.0.0 binds
- TS-source-only runtime is guarded
- runtime service smoke exists
- critical mutating route auth matrix already exists

## Tasks

### 1. Discover mutating routes

Inspect all service route registration code for:
- POST
- PUT
- PATCH
- DELETE

Services:
- intake-service
- offer-service
- production-service
- print-export

Build a route inventory for MVP mutating routes.

### 2. Map each route to required role

For every mutating route, assign one expected role:
- intake_operator
- offer_operator
- production_operator
- operations_audit_operator
- or explicitly document why a route is public/non-MVP/test-only

Do not infer new roles unless absolutely necessary.

### 3. Extend auth matrix tests

Update or add tests so each mutating MVP route checks:

- no trusted actor -> 403
- wrong trusted actor role -> 403
- correct trusted actor role -> does not fail at auth layer

It is acceptable for the correct role case to return a later domain error such as 400, 404, or 422.

It is not acceptable for the correct role case to return 401 or 403.

### 4. Prevent silent gaps

Add a route inventory guard if straightforward:
- route exists in app code
- route appears in auth matrix
- mutating route is not silently omitted

Avoid brittle regexes if the route inventory is already explicit.

### 5. Validation

Run:
- npx vitest run tests/mutating-route-auth-matrix.test.ts
- npm test
- npm run build

Also run related targeted tests if changed.

## Success criteria

The goal is complete only when:
- all mutating MVP routes are inventoried
- all mutating MVP routes have no-actor coverage
- all mutating MVP routes have wrong-role coverage
- all mutating MVP routes have correct-role auth-boundary coverage
- tests pass
- build passes
- no product behavior changed
- remaining risks are explicit

## Output format

Report:
1. Branch name
2. Changed files
3. Route inventory summary
4. Role mapping summary
5. Commands run
6. Test/build result
7. Remaining risks
8. Whether this is commit-worthy

## Stop conditions

Stop and report instead of broad refactoring if:
- a route's intended role is ambiguous
- a correct-role test requires complex domain fixtures
- route discovery reveals inconsistent API design
- fixing the issue would require product behavior changes
