# Recipe Research and Calculation Boundary

## Objective

Make the recipe research and calculation boundary explicit and testable.

The platform may use internal recipes, external recipe candidates, and future
LLM summaries to support operators.

The platform must keep final production artifacts deterministic and
human-reviewable.

The intended split is:

- internal recipe library and trusted fixtures provide known recipes
- web recipe search may provide candidate recipes only when explicitly enabled
- future LLM output may summarize, compare or explain candidates
- deterministic code performs scaling, purchase-list generation and production artifact creation
- a human operator reviews and accepts candidates or decisions
- audit/evidence records preserve source and decision context

## Hard Constraints

Do not do any of the following:

- call external web recipe search in default tests
- call a real LLM provider
- send real customer data to any provider
- let LLM output write final Recipe, ProductionPlan or PurchaseList objects
- let web recipe candidates become trusted recipes without review
- let recipe candidates silently approve allergens
- let recipe candidates silently approve pricing or margin
- change pricing semantics
- change auth semantics
- weaken data-safety gates
- weaken BYO LLM boundary
- weaken critical path rehearsal
- add UI behavior
- introduce broad product behavior
- introduce a new persistence backend
- perform broad refactors

Prefer the following:

- existing recipe discovery code
- existing internal recipe fixtures
- deterministic synthetic data
- explicit source metadata
- explicit candidate/review status
- small policy objects
- small tests
- no external calls
- fail-closed defaults
- human review required
- clear remaining risks

## Current Context

Recent work already established:

- fail-closed auth
- mutating route auth matrix
- local runtime smoke
- Docker Compose runtime smoke
- deterministic critical path rehearsal
- data safety and audit gate contract
- dependency audit clean
- BYO LLM boundary contract

The system is an internal controlled MVP, not a public SaaS and not a
production system for real customer data.

Existing production and recipe-discovery code should be used where possible.

## Tasks

### 1. Inventory current recipe and calculation surface

Inspect current code for:

- internal recipe library
- recipe discovery service
- web recipe search gate
- recipe provider interfaces
- recipe upload/review routes
- production planning rules
- scaling rules
- purchasing rules
- production artifact generation
- purchase list generation
- export behavior
- audit/evidence behavior

Inventory at least:

- where recipes come from
- how internal recipes are represented
- how web recipe candidates are represented
- whether candidates carry source metadata
- whether candidates have review status
- where scaling happens
- where purchase quantities are calculated
- where production artifacts are created
- where source recipes are preserved or lost
- where audit/evidence exists

### 2. Define the boundary contract

Add or clarify a small boundary contract if needed.

The contract must express:

- internal recipes may be trusted only if already in trusted library or fixture scope
- web recipes are candidates, not trusted recipes
- external recipe search is disabled by default
- web recipe search requires explicit opt-in
- recipe candidates require human review before trusted production use
- LLM summaries are explanation/draft only
- LLM summaries cannot write final Recipe, ProductionPlan or PurchaseList objects
- allergen, pricing and margin approval are outside LLM authority
- deterministic code owns scaling and purchase-list generation
- final production artifacts must be reproducible from accepted inputs

Suggested file if a new one is useful:

- shared-core/src/recipe-research-calculation-boundary.ts

Do not add broad product behavior just to create this file.

### 3. Tests

Add focused tests, preferably:

- tests/recipe-research-calculation-boundary.test.ts

Tests should prove:

- web recipe search is disabled by default
- web recipe search requires explicit opt-in
- web recipe candidates remain candidates until reviewed
- unreviewed recipe candidates cannot be treated as trusted production recipes
- LLM recipe summaries are draft/explanation only
- LLM recipe summaries cannot write product objects
- deterministic scaling produces reproducible quantities from accepted recipe input
- purchase-list generation is deterministic for accepted recipe input
- source recipe metadata is preserved where current code supports it
- missing source metadata is explicit if current export path drops it

Use synthetic data only.

Do not call external web search.

Do not call a real LLM provider.

### 4. Critical path integration check

Run or extend the existing critical path rehearsal only if needed.

The goal is not to expand the entire critical path.

The goal is to ensure the recipe/calculation boundary does not weaken:

- critical path rehearsal
- data safety gates
- BYO LLM boundary

### 5. Exports and evidence

Inspect whether production and purchase exports preserve enough source context.

If sourceRecipes are present in the object but not the CSV export, do not invent
a broad export redesign.

Instead:

- test the object-level source metadata if available
- document the export limitation as a remaining risk
- optionally add a small assertion if current export already exposes a stable field

### 6. Validation

Run:

- npx vitest run tests/recipe-research-calculation-boundary.test.ts
- npx vitest run tests/critical-path-rehearsal.test.ts
- npx vitest run tests/data-safety-audit-gates.test.ts
- npx vitest run tests/byo-llm-boundary.test.ts
- npm test
- npm run build
- npm audit --omit=dev
- npm audit

Run any existing production/recipe tests that are directly relevant.

## Success Criteria

The goal is complete only when:

- current recipe and calculation surface is inventoried
- recipe research vs deterministic calculation boundary is explicit
- external web recipe search remains disabled by default
- unreviewed recipe candidates cannot silently become trusted production inputs
- LLM summaries remain draft/explanation only
- deterministic scaling and purchase-list generation are tested
- source metadata preservation or loss is explicit
- tests pass
- build passes
- audit remains clean
- no external provider is called
- no unrelated product behavior changed
- remaining risks are explicit

## Output Format

Report:

1. Branch name
2. Changed files
3. Removed files
4. Recipe/research surface inventory
5. Calculation/scaling surface inventory
6. Boundary added or verified
7. Gates tested
8. Source metadata behavior
9. Commands run
10. Test/build/audit result
11. Remaining risks
12. Whether this is commit-worthy

## Stop Conditions

Stop and report instead of broad changes if:

- current recipe or production code is too entangled for a small boundary patch
- enforcing the boundary requires changing product behavior
- tests would need external web calls or real provider calls
- data classification is ambiguous
- source metadata behavior requires an export redesign
- deterministic calculation semantics would need to change
