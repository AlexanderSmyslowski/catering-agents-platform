# UI Inline Source Metadata

## Objective

Make recipe source metadata visible inline in the Backoffice production UI,
using existing source metadata already present in production, purchase and export
objects.

This closes the known missing UI link from PR 468.

## Hard Constraints

- Do not add broad UI behavior.
- Do not redesign the UI.
- Do not add recipe review workflow.
- Do not call external web recipe search.
- Do not call a real LLM provider.
- Do not use real customer data.
- Do not weaken recipe candidate review gate.
- Do not weaken data-safety gates.
- Do not weaken BYO LLM boundary.
- Do not change auth semantics.
- Do not change pricing, margin or allergen semantics.
- Do not change persistence backend.
- Do not change production or purchase calculations.
- Do not make source metadata imply recipe, allergen, pricing or margin
  approval.

## Current Context

- Export source metadata readability is merged.
- UI critical path rehearsal is merged.
- The UI rehearsal currently verifies source metadata through export links and
  export output.
- Recipe source metadata is not yet rendered inline in the Backoffice production
  UI.

## Tasks

1. Inspect Backoffice production UI components and routes.
2. Inspect `tests/ui-critical-path-rehearsal.test.ts`.
3. Inspect source metadata fields available on ProductionBatch, KitchenSheet and
   PurchaseItem.
4. Add the smallest UI rendering change so production UI shows human-readable
   recipe source evidence where production batches, purchase items or production
   evidence are already shown.
5. Use existing formatter output if available.
6. Add or update tests for internal, reviewed web and missing metadata.
7. Preserve existing export source metadata and UI critical path tests.
8. Commit, push and open a PR if all checks pass.
9. Do not merge the PR.

## Success Criteria

- Recipe source metadata is visible inline in the Backoffice production UI.
- Existing export source metadata remains visible.
- UI critical path rehearsal remains green.
- No calculations change.
- No approval semantics are added.
- No external calls are made.
- Tests, build and audit pass.
- PR is opened and not merged.
