# Recipe Candidate Review Gate

## Objective

Enforce the recipe candidate review gate at runtime.

Unreviewed web recipe candidates must not be used as trusted production inputs.

The system may discover or materialize web recipe candidates, but production
planning and purchase-list generation must only use:

- approved internal recipes
- explicitly reviewed or accepted recipe candidates
- deterministic operator-provided recipe decisions that are marked as reviewed

This goal turns the previously documented boundary into a small runtime
enforcement change.

## Hard constraints

Do not do any of the following:

- call external web recipe search in tests
- call a real LLM provider
- send real customer data to any provider
- add UI behavior
- add broad recipe review workflow
- add pricing or margin approval behavior
- add allergen approval behavior
- change auth semantics
- weaken data-safety gates
- weaken BYO LLM boundary
- weaken critical path rehearsal
- change persistence backend
- perform broad refactors
- make unreviewed web candidates silently trusted
- remove source metadata

Prefer the following:

- small runtime gate
- explicit review-status helper
- existing recipe source metadata
- existing recipe discovery code
- existing production planning code
- deterministic synthetic tests
- no external calls
- clear operator-review semantics
- fail-closed behavior
- narrow product behavior change
- explicit remaining risks

## Current context

Recent work already established:

- fail-closed auth
- mutating route auth matrix
- local runtime smoke
- Docker Compose runtime smoke
- deterministic critical path rehearsal
- data safety and audit gate contract
- dependency audit clean
- BYO LLM boundary contract
- recipe research/calculation boundary contract

The previous recipe boundary stated:

- internal approved recipes can be trusted production inputs
- web recipes remain candidates
- LLM summaries are draft/explanation only
- deterministic code owns scaling and purchase-list generation
- PurchaseItem.sourceRecipes is preserved on the object
- CSV export does not yet include sourceRecipes

Known gap:

- existing web recipe discovery can still mark candidates as `auto_usable`
- this goal must ensure `auto_usable` does not mean trusted for production
  planning without review

## Tasks

### 1. Inspect current runtime path

Inspect:

- production-service recipe discovery
- web recipe candidate materialization
- internal recipe resolution
- production planning rules
- resolved recipe artifact generation
- purchase-list generation
- recipe upload/review routes
- existing tests:
  - production-web-recipe-search-gate
  - web-recipe-resolution
  - planning-resolved-recipe-artifacts
  - purchase-coverage-check
  - critical-path-rehearsal
  - recipe-research-calculation-boundary

Find exactly where a web candidate can become a `Recipe` used by production
planning.

### 2. Define trusted production input

Add or clarify a small helper/policy if needed.

The runtime must distinguish:

- approved internal recipe
- reviewed/accepted web candidate
- unreviewed web candidate
- LLM draft/explanation
- unknown source

Suggested helper names if useful:

- `isTrustedProductionRecipe`
- `requiresRecipeOperatorReview`
- `assertTrustedProductionRecipe`
- `classifyRecipeProductionTrust`

Do not introduce a broad workflow engine.

### 3. Enforce the gate

Change the smallest runtime path so:

- approved internal recipes still work
- unreviewed web candidates do not silently feed final ProductionPlan or
  PurchaseList
- `auto_usable` from discovery does not bypass human review
- reviewed or accepted candidate can be used if current data model already
  supports such status
- if the current data model has no reviewed-web status, document this and fail
  closed for web candidates

Acceptable behavior for unreviewed web candidate:

- production artifact generation returns a review-required or missing-recipe
  decision
- or marks the component as requiring operator review
- or refuses to treat the recipe as trusted input

Do not fake success.

### 4. Tests

Add or update focused tests, preferably:

- tests/recipe-candidate-review-gate.test.ts

Tests must prove:

- internal approved recipe still produces deterministic production artifacts
- unreviewed web candidate is not trusted production input
- web `auto_usable` does not bypass review
- LLM recipe summary or draft cannot become trusted recipe input
- reviewed/accepted candidate works only if current model supports it
- source metadata is preserved where production/purchase objects support it
- no external web call is made
- no real LLM call is made

Update existing tests only if the new gate intentionally changes their expected
behavior.

### 5. Preserve existing core flow

Run the critical path rehearsal.

The critical path should remain green because it uses internal/trusted
synthetic recipe input.

If it fails, fix the test data or trust classification narrowly.

Do not weaken the gate to make tests pass.

### 6. Audit/evidence

If the current audit/evidence layer already records recipe decisions, preserve
or assert it.

If it does not, document as remaining risk.

Do not invent broad audit workflows in this PR.

### 7. Validation

Run:

- npx vitest run tests/recipe-candidate-review-gate.test.ts
- npx vitest run tests/recipe-research-calculation-boundary.test.ts
- npx vitest run tests/critical-path-rehearsal.test.ts
- npx vitest run tests/production-web-recipe-search-gate.test.ts
  tests/web-recipe-resolution.test.ts
  tests/planning-resolved-recipe-artifacts.test.ts
  tests/purchase-coverage-check.test.ts
- npx vitest run tests/data-safety-audit-gates.test.ts tests/byo-llm-boundary.test.ts
- npm test
- npm run build
- npm audit --omit=dev
- npm audit

## Success criteria

The goal is complete only when:

- unreviewed web candidates cannot be used as trusted production inputs
- web `auto_usable` does not bypass review
- approved internal recipes still work
- reviewed/accepted candidates are handled according to existing model
  capability
- LLM recipe drafts remain non-product-write explanations
- production/purchase generation remains deterministic for trusted inputs
- source metadata is preserved where currently supported
- critical path rehearsal remains green
- tests pass
- build passes
- audit remains clean
- no external web calls are made
- no real LLM calls are made
- no unrelated product behavior changed
- remaining risks are explicit

## Output format

Report:

1. Branch name
2. Changed files
3. Removed files
4. Runtime path inspected
5. Trust classification added or verified
6. Gate behavior implemented
7. Tests added or updated
8. Commands run
9. Test/build/audit result
10. Remaining risks
11. Whether this is commit-worthy
