# BYO LLM Boundary

## Objective

Make the Bring Your Own LLM boundary explicit, provider-neutral and testable.

The LLM may help with thinking, research summaries, clarification drafts and
candidate explanations.

The LLM must not write final product objects, approve allergens, approve
pricing, approve production plans, approve purchase lists or receive real
customer data without an explicit gate.

## Hard constraints

Do not do any of the following:

- add broad product behavior
- add UI behavior
- call a real LLM provider in tests
- send real customer data to any provider
- enable provider calls by default
- let LLM output write OfferDraft, AcceptedEventSpec, ProductionPlan or PurchaseList directly
- let LLM approve allergens, pricing, margins or production decisions
- weaken data-safety gates
- weaken auth
- weaken the critical path rehearsal
- add recipe research behavior
- add web search behavior
- change persistence semantics
- perform broad refactors

Prefer the following:

- provider-neutral naming
- explicit policy objects
- schema-validated outputs
- synthetic/demo-only test fixtures
- existing LLM readiness code
- small tests
- no external calls
- fail-closed defaults
- human approval required
- writesProductObject false

## Current context

Recent hardening already happened:

- fail-closed auth
- mutating route auth matrix
- local runtime smoke
- Docker Compose runtime smoke
- deterministic critical path rehearsal
- data safety and audit gate contract
- dependency audit clean

The system is an internal controlled MVP, not public SaaS and not real-data
production.

Existing LLM code appears to be readiness/probe oriented and should remain
tightly bounded.

## Tasks

### 1. Inventory current LLM surface

Inspect existing LLM-related files, including but not limited to:

- shared-core/src/llm-readiness*
- shared-core/src/llm-readiness-openai-transport.ts
- shared-core/src/llm-readiness-provider-adapter.ts
- shared-core/src/llm-readiness-synthetic-live-slice.ts
- shared-core/src/data-safety-audit-gates.ts
- tests related to LLM readiness
- package scripts related to LLM checks

Inventory:

- provider adapters
- env vars
- prompt/schema registries
- allowed draft types
- output validation
- provider call gates
- audit/evidence records
- synthetic-only assumptions

### 2. Define BYO LLM policy boundary

Add or clarify a small policy contract if needed.

The policy must express:

- provider calls disabled by default
- provider calls require explicit opt-in
- real customer data is rejected by default
- synthetic/demo-only use is allowed only when explicitly marked
- output must be schema validated
- humanApprovalRequired must remain true
- writesProductObject must remain false
- allowed use cases are draft-only

Allowed draft use cases:

- clarification_question_draft
- recipe_research_summary_draft, only as a draft summary if already represented safely
- search_query_suggestion_draft, only if no external call is performed by default
- uncertainty_summary_draft

If a use case is not currently represented, do not build broad product behavior
for it. Document it as future allowed shape.

### 3. Provider neutrality

Ensure names and tests do not imply OpenAI is the only possible provider where a
provider-neutral abstraction already exists or can be clarified with small
changes.

OpenAI can remain one adapter.

Do not remove the OpenAI adapter if tests depend on it.

Do not implement additional real providers.

### 4. Tests

Add or improve tests so they prove:

- BYO/provider calls are disabled by default
- unsafe real-customer-data provider input is rejected
- synthetic/demo-only draft input is accepted only under explicit provider opt-in
- generated output cannot write product objects
- generated output must require human approval
- allowed draft types are explicit
- OpenAI-specific transport is behind the provider boundary
- no test calls a real provider

Prefer a focused test file, for example:

- tests/byo-llm-boundary.test.ts

### 5. Audit/evidence

If current LLM readiness audit helpers exist, verify they preserve:

- provider name or provider kind
- model name if provided
- draft type
- synthetic/demo classification
- no product write
- human approval required

Do not create compliance claims.

### 6. Validation

Run:

- npx vitest run tests/byo-llm-boundary.test.ts
- npm test
- npm run build
- npm audit --omit=dev
- npm audit

Run existing LLM readiness tests if directly relevant.

## Success criteria

The goal is complete only when:

- BYO LLM boundary is explicit
- provider calls remain disabled by default
- real customer data is rejected by default
- synthetic/demo provider input is gated
- LLM output cannot write product objects
- human approval remains required
- tests pass
- build passes
- audit remains clean
- no external provider is called
- no unrelated product behavior changed
- remaining risks are explicit

## Output format

Report:

1. Branch name
2. Changed files
3. Removed files
4. Current LLM surface inventory
5. BYO policy added or verified
6. Provider neutrality changes
7. Gates tested
8. Commands run
9. Test/build/audit result
10. Remaining risks
11. Whether this is commit-worthy

## Stop conditions

Stop and report instead of broad changes if:

- current LLM code is too entangled for a small boundary patch
- enforcing the boundary requires changing product behavior
- adding provider neutrality requires broad refactoring
- tests would need real provider calls
- data classification is ambiguous
- real-data gating requires a product decision
- recipe research behavior would need to be implemented to proceed
