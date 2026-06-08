# Critical Path Rehearsal

## Objective

Create one deterministic synthetic end-to-end rehearsal for the MVP critical path.

The critical path is:

Intake -> EventSpec -> Offer Draft -> Promote -> Production Plan -> Purchase List -> Export/Audit evidence.

This goal proves that the platform can perform its core internal job once, using synthetic data only.

## Hard constraints

Do not do any of the following:

- use real customer data
- call a real LLM provider
- call external web recipe search
- add UI behavior
- weaken auth
- enable global dev auth
- change persistence semantics unless strictly required for test isolation
- change pricing semantics
- add broad product behavior
- add new API endpoints unless the current critical path is otherwise impossible
- refactor services broadly
- reorganize documentation
- change Docker/runtime boundary behavior

Prefer the following:

- existing fixtures
- existing service APIs
- existing stores
- deterministic synthetic data
- HTTP-level flow if stable
- service/domain-level flow only if HTTP-level flow is not currently expressible
- one clear rehearsal test over many fragile tests
- business assertions over snapshots
- explicit remaining risks

## Current context

Recent hardening already happened:

- trusted actor auth is fail-closed
- dev auth requires CATERING_DEV_AUTH=1
- mutating MVP route auth matrix is complete
- local services default to 127.0.0.1
- Docker Compose explicitly opts service containers into 0.0.0.0
- TS-source-only runtime is guarded
- local runtime smoke exists
- Docker Compose runtime smoke exists

The platform target is an internal controlled MVP, not public SaaS and not production use with real data.

## Tasks

### 1. Inspect the current flow

Inspect:

- intake-service routes
- offer-service routes
- production-service routes
- print-export routes
- shared-core fixtures
- existing browser rehearsal tests
- existing local stack checks
- audit log helpers
- export helpers

Find the smallest existing deterministic path that can produce:

- accepted event spec or equivalent structured event specification
- offer draft or offer variant
- promoted offer or equivalent offer handoff
- production plan
- purchase list
- export, handoff, or audit evidence

### 2. Decide the test level

Prefer an HTTP-level test if the existing app builders and routes make it stable.

If the full HTTP path is not currently expressible without large fixture complexity, use the smallest service/domain-level rehearsal that still proves the same business flow.

Do not create broad new endpoints just to make the test pass.

### 3. Add one focused rehearsal

Add preferably:

- tests/critical-path-rehearsal.test.ts

The rehearsal must:

- use synthetic data only
- use explicit trusted test actors
- avoid global CATERING_DEV_AUTH unless scoped only to the test harness
- avoid real LLM calls
- avoid external web calls
- avoid real uploads
- avoid real customer/person/event data
- avoid snapshot-only assertions

### 4. Required flow assertions

Assert at least:

- synthetic event/request/spec exists
- guest count is preserved through the flow
- menu components or catering components flow through
- offer draft or offer variant exists
- offer promotion or handoff evidence exists, if supported by current API
- production plan exists
- production plan has batches, tasks, or production-relevant output
- purchase list exists
- purchase list has ingredients/items
- export, handoff, or audit evidence exists
- actor/source information is present where current code supports it
- no LLM provider is required
- no web recipe search is required

### 5. Audit and evidence

The test should prefer evidence that a human operator could understand:

- ids are linked across the flow where possible
- source references are preserved where current code supports them
- audit or handoff records identify the relevant action
- exports are read-only evidence, not silent product approval

Do not claim legal compliance.

### 6. Gap handling

If the current APIs cannot express one step, do not silently fake it.

Instead:

- assert the strongest available existing artifact
- document the exact missing link in the test name, comment, or goal output
- do not implement broad product behavior to close the gap

Examples:

- if promote exists but production consumes a different id, document the handoff gap
- if export exists but audit is separate, assert both where possible
- if pricing is placeholder-level, assert explicit placeholder rather than pretending final pricing exists

### 7. Validation

Run:

- npx vitest run tests/critical-path-rehearsal.test.ts
- npm test
- npm run build

Also run any targeted existing rehearsal test if directly relevant.

## Success criteria

The goal is complete only when:

- one deterministic critical-path rehearsal exists
- no external services are required
- no real customer data is used
- no real LLM provider is called
- no external web recipe search is called
- the rehearsal proves the core MVP user journey as far as current APIs support it
- any missing flow link is explicit
- tests pass
- build passes
- no unrelated behavior changed
- remaining risks are explicit

## Output format

Report:

1. Branch name
2. Changed files
3. Removed files
4. Flow implemented
5. Synthetic data used
6. Auth setup used
7. Commands run
8. Test/build result
9. Missing critical-path links, if any
10. Remaining risks
11. Whether this is commit-worthy

## Stop conditions

Stop and report instead of broad refactoring if:

- the current APIs cannot express the critical path
- a required step exists only in UI and not service/domain code
- the flow needs external LLM calls
- the flow needs external web calls
- correct auth setup requires broad changes
- production artifacts require real data
- implementing the rehearsal would require broad product behavior changes
- the test would become brittle or fake the business flow
