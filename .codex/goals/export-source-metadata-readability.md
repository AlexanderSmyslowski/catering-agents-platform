# Export Source Metadata Readability

## Objective

Make recipe source metadata human-readable in production and purchase exports.

Exports should make recipe source metadata visible as read-only evidence. Exports
must not approve recipes, allergens, pricing, margins or production decisions.

## Context

The system now enforces that unreviewed web recipe candidates cannot be trusted
production inputs. Reviewed web candidates preserve source metadata such as
originType, reference, url and publisher.

PurchaseItem.sourceRecipes is preserved object-side, but exports currently do
not expose enough of that information to humans.

## Hard constraints

- Do not add UI behavior.
- Do not add recipe review workflow.
- Do not call external web recipe search.
- Do not call a real LLM provider.
- Do not send real customer data anywhere.
- Do not weaken recipe candidate review gate.
- Do not weaken data-safety gates.
- Do not weaken BYO LLM boundary.
- Do not change auth semantics.
- Do not change pricing or margin semantics.
- Do not add allergen approval behavior.
- Do not change persistence backend.
- Do not perform broad refactors.
- Do not remove existing export fields.
- Prefer appending export fields over changing existing ones.
- Exports remain read-only evidence, not approval.

## Tasks

1. Inspect export surfaces:
   - print-export service
   - purchase CSV export
   - production/kitchen sheet export
   - existing export tests
   - critical path rehearsal
   - purchase-list and production-plan types

2. Inventory:
   - where sourceRecipes exists object-side
   - where source metadata is lost in export
   - current CSV headers
   - current production/kitchen sheet source labels
   - tests that assert export content

3. Add a small deterministic source metadata formatter if useful.

The formatter should produce human-readable labels from available metadata:
   - recipe title
   - recipe id
   - origin type
   - approval/review state
   - publisher
   - url/reference
   - internal/web/reviewed status

Missing metadata must be explicit:
   - source unknown
   - internal recipe
   - web recipe, reviewed
   - web recipe, review required

Do not invent source truth.

4. Update exports narrowly:
   - Purchase CSV should include source recipe metadata.
   - Prefer appended columns such as source_recipes, source_recipe_origins,
     source_recipe_references.
   - Do not reorder existing columns unless clearly safe.
   - Production/kitchen export should include a human-readable source label
     where recipe/component details are already shown.

5. Add focused tests, preferably:
   - tests/export-source-metadata-readability.test.ts

Tests must prove:
   - purchase export includes sourceRecipes when present
   - reviewed web source metadata remains visible
   - internal source metadata remains visible
   - missing metadata produces explicit fallback text
   - quantities do not change
   - production tasks/batches do not change
   - exports remain read-only evidence
   - unreviewed web candidates remain blocked by the review gate
   - no external web call is made
   - no real LLM call is made

6. Run:
   - npx vitest run tests/export-source-metadata-readability.test.ts
   - npx vitest run tests/recipe-candidate-review-gate.test.ts
   - npx vitest run tests/recipe-research-calculation-boundary.test.ts
   - npx vitest run tests/critical-path-rehearsal.test.ts
   - npx vitest run tests/data-safety-audit-gates.test.ts
     tests/byo-llm-boundary.test.ts
   - npm test
   - npm run build
   - npm audit --omit=dev
   - npm audit
   - git diff --check

## Success criteria

- source metadata is human-readable in purchase CSV
- source metadata is human-readable in production/kitchen export
- no existing export fields are removed
- quantities do not change
- production tasks and batches do not change
- exports remain read-only evidence
- recipe candidate review gate remains green
- tests pass
- build passes
- audit remains clean
- remaining risks are explicit

## Stop conditions

- Stop if source metadata is unavailable in the export path.
- Stop if adding metadata would require broad production planning redesign.
- Stop if reviewed web source metadata is lost before export.
- Stop if fixing metadata loss requires persistence changes.
- Stop if tests would require external web calls.
- Stop if tests would require real LLM calls.
- Stop if allergen, pricing or margin semantics become necessary.
- Stop if UI behavior would be required.
