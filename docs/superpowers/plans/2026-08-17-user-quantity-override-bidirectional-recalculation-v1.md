# User Quantity Override & Bidirectional Recalculation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preview-first, confirmable quantity overrides that keep target output, recipe scale and recipe-derived purchasing quantities in one auditable event-specific lineage.

**Architecture:** Add one focused shared-core module that owns pure preview, confirmation and recalculation contracts. It composes existing `evaluateQuantityDecision`, `evaluateQuantityRecipeProductionBridge` and `scaleRecipe` rather than bypassing them. V1 remains proportional only, but emits separate proportional-baseline and effective-recipe fields so later nonlinear scaling can layer on without changing this contract.

**Tech Stack:** TypeScript, Vitest, existing `@catering/shared-core` contracts.

## Global Constraints

- Preview is side-effect free and never mutates authoritative state.
- Confirmation requires an explicit valid preview plus supplied operator/timestamp metadata.
- Purchase-row edits are interpreted as recipe-scale changes, never silent recipe-ratio edits.
- No implicit unit conversion.
- No hidden safety, yield, loss, procurement or overproduction multiplier.
- `recommendQuantity()`, `evaluateQuantityDecision()`, `evaluateQuantityRecipeProductionBridge()`, `scaleRecipe()` and ProductionBatch gating remain authoritative and unchanged outside composition through the new contract.
- V1 is proportional only; `proportionalBaseline` and `effectiveRecipeQuantity` are both emitted and equal in this slice.
- No persistence migration, provider/LLM call, UI redesign, deployment or release.

---

### Task 1: Preview contract

**Files:**
- Create: `shared-core/src/user-quantity-override.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/user-quantity-override.test.ts`

**Interfaces:**
- Consumes: `Recipe`, `QuantityDecisionInput`, `RecipeOutputMapping`, `scaleRecipe()`.
- Produces: `previewQuantityOverride(input): QuantityOverridePreviewResult` and exported input/result types.

- [ ] **Step 1: Write failing preview tests**

Cover target-output, recipe-total and purchase-ingredient edits. Assert preview is `preview_ready`, computes the expected scale factor, recalculates every ingredient, emits separate but equal proportional/effective quantities, preserves recommendation reference metadata, and returns a deterministic stale-artifact list. Also cover invalid/non-positive quantities, unit mismatch, untraceable purchase ingredient and binding mismatch as `blocked`.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/user-quantity-override.test.ts`
Expected: FAIL because `previewQuantityOverride` and related types are not exported.

- [ ] **Step 3: Implement minimal preview contract**

Create explicit input types for the three edit origins. Normalize all paths to one proposed scale factor and proposed target authority. For purchase-origin edits, locate exactly one recipe ingredient by stable ingredient id and compute `newAmount/currentAmount`. Use `scaleRecipe()` only after bindings and units are validated. Return no confirmable payload when blocked.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/user-quantity-override.test.ts`
Expected: preview cases PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add quantity override preview contract`

### Task 2: Confirmation contract

**Files:**
- Modify: `shared-core/src/user-quantity-override.ts`
- Test: `tests/user-quantity-override.test.ts`

**Interfaces:**
- Consumes: successful `QuantityOverridePreviewResult`.
- Produces: `confirmQuantityOverride(input): ConfirmedQuantityOverrideResult`.

- [ ] **Step 1: Add failing confirmation tests**

Assert that only `preview_ready` previews can be confirmed; confirmation preserves previous/new authority, edit origin, recipe/component/event bindings, optional operator identity, supplied confirmation timestamp, purchase ingredient id where relevant, scale factor, recommendation reference and stale-artifact declarations. Assert blocked previews cannot be confirmed.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/user-quantity-override.test.ts`
Expected: FAIL on missing `confirmQuantityOverride`.

- [ ] **Step 3: Implement minimal confirmation contract**

Do not generate timestamps or persistence ids implicitly from wall clock. Require stable override id and `confirmedAt` from the application layer. Return a deterministic blocked result for invalid confirmation input rather than partially confirming.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/user-quantity-override.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: confirm quantity override lineage`

### Task 3: Recalculation contract

**Files:**
- Modify: `shared-core/src/user-quantity-override.ts`
- Test: `tests/user-quantity-override.test.ts`

**Interfaces:**
- Consumes: confirmed override, current `Recipe`, reviewed `RecipeOutputMapping`, optional recipe-event review.
- Produces: `recalculateQuantityLineage(input): QuantityLineageRecalculationResult`.

- [ ] **Step 1: Add failing recalculation tests**

Assert recalculation constructs a new operator-backed `QuantityDecisionInput`, evaluates it through the existing Quantity Decision contract, evaluates the resulting Quantity→Recipe bridge through `evaluateQuantityRecipeProductionBridge`, and only emits scaled recipe/purchase quantities when the bridge permits scaling. Assert no approval is invented. Assert all recipe-derived purchase quantities move together under a purchase-origin scale change.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/user-quantity-override.test.ts`
Expected: FAIL on missing `recalculateQuantityLineage`.

- [ ] **Step 3: Implement minimal recalculation**

Build the override QuantityDecision as explicit `operator_instruction` evidence with the review status required by the existing contract. Reuse the existing reviewed output mapping. If bridge status is not `ready_for_scaling`, return the gated result plus stale declarations and no current replacement ProductionBatch/purchase lineage. If ready, call `scaleRecipe()` with the bridge's exact `targetServings` and derive purchase rows directly from the scaled ingredient lines.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/user-quantity-override.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: recalculate quantity override lineage`

### Task 4: Regression and full verification

**Files:**
- Modify only if required by legitimate type/export regressions: `shared-core/src/index.ts`
- Test: existing quantity recommendation, quantity decision, bridge, production-batch and planning tests.

**Interfaces:**
- Produces: evidence that existing contracts remain behaviorally unchanged.

- [ ] **Step 1: Run focused neighboring contracts**

Run: `npm test -- --run tests/quantity-recommendation.test.ts tests/quantity-decision-contract.test.ts tests/quantity-recipe-production-bridge.test.ts tests/production-batch-materialization.test.ts tests/user-quantity-override.test.ts`
Expected: all PASS.

- [ ] **Step 2: Run full build and test suite**

Run: `npm run build && npm test`
Expected: 0 failures.

- [ ] **Step 3: Run browser rehearsal through repository CI**

Open/update draft PR against `feature/quantity-recommendation-v1`; temporarily retarget to `main` only if the repository requires it to trigger CI, then restore the stacked base after successful evidence.
Expected: `build-and-test` SUCCESS and `browser-rehearsal` SUCCESS.

- [ ] **Step 4: Record TDD evidence**

Create `docs/superpowers/plans/2026-08-17-user-quantity-override-bidirectional-recalculation-v1-tdd-evidence.md` with RED head/run, GREEN head/run, focused test count and final CI gates.

- [ ] **Step 5: Final verification commit and re-run exact final head**

Commit message: `docs: record quantity override tdd evidence`.
Run CI on the exact final documentation head and require both gates SUCCESS before declaring the PR GREEN.
