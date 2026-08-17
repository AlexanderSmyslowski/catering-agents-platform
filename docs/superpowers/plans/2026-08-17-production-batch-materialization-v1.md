# Production Batch Materialization v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a `ready_for_scaling` Quantity→Recipe bridge result the only authoritative recipe-backed input for ProductionBatch materialization.

**Architecture:** Add a focused shared-core materializer that validates the bridge result and delegates scaling exclusively to the existing `scaleRecipe()`. Then update the production-service resolved-recipe path so it consumes that proven bridge result rather than a raw servings number. Existing operational decoration (batch id, station, prep window, GN plan, kitchen sheet, timeline) remains in production-service.

**Tech Stack:** TypeScript, shared-core package, production-service package, Vitest, GitHub Actions CI.

## Global Constraints

- Accept only `bridgeResult.status === "ready_for_scaling"` for recipe-backed batch materialization.
- Require exact event/component/recipe identity binding.
- Require finite positive `targetServings`.
- `scaleRecipe()` remains unchanged and is the sole scaling authority.
- `defaultLossFactor` remains metadata only and must not inflate ingredients.
- No safety factor, shrinkage, yield correction, overproduction or procurement multiplier.
- No persistence migration, UI change, provider/LLM call, deployment or release.

---

### Task 1: Shared-core materialization contract

**Files:**
- Create: `shared-core/src/production-batch-materialization.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/production-batch-materialization.test.ts`

**Interfaces:**
- Consumes: `QuantityRecipeProductionBridgeResult`, `Recipe`, existing `scaleRecipe()` and recipe source metadata.
- Produces: `materializeProductionBatchFromBridge(input)` returning `Omit<ProductionBatch, "batchId" | "station" | "prepWindow" | "gnPlan">` or throwing deterministic fail-closed error codes.

- [ ] **Step 1: Write failing materializer tests**

Cover exact success scaling plus: blocked bridge, review-required bridge, event mismatch, component mismatch, recipe mismatch, missing/zero/negative/non-finite target servings, and loss-factor metadata-only behavior.

- [ ] **Step 2: Run RED verification**

Run CI against a PR temporarily targeted at `main` if stacked-PR CI does not trigger. Expected: build/test failure because `materializeProductionBatchFromBridge` is not exported/implemented.

- [ ] **Step 3: Implement minimal materializer**

Pseudo-interface:

```ts
export interface ProductionBatchMaterializationInput {
  eventSpecId: string;
  componentId: string;
  recipe: Recipe;
  bridgeResult: QuantityRecipeProductionBridgeResult;
}

export function materializeProductionBatchFromBridge(
  input: ProductionBatchMaterializationInput
): Omit<ProductionBatch, "batchId" | "station" | "prepWindow" | "gnPlan">;
```

Implementation order:
1. require `ready_for_scaling`;
2. validate event/component/recipe bindings;
3. validate finite positive `targetServings`;
4. call `scaleRecipe(recipe, targetServings)` once;
5. build batch fields from the scaled result;
6. carry `defaultLossFactor` unchanged as metadata;
7. attach recipe source metadata.

Use deterministic error messages/codes:
- `bridge_not_ready_for_scaling`
- `bridge_event_binding_mismatch`
- `bridge_component_binding_mismatch`
- `bridge_recipe_binding_mismatch`
- `bridge_target_servings_invalid`

- [ ] **Step 4: Run focused GREEN tests**

Expected: all materializer contract tests pass.

- [ ] **Step 5: Export from shared-core and commit**

Commit message: `feat: gate production batch materialization`

---

### Task 2: Remove raw-servings authority from resolved recipe artifacts

**Files:**
- Modify: `production-service/src/rules/planning-resolved-recipe-artifacts.ts`
- Test: `tests/production-batch-materialization.test.ts` or a focused production-service planning test if an existing fixture is more appropriate.

**Interfaces:**
- Consumes: `QuantityRecipeProductionBridgeResult` with `ready_for_scaling` status and the new `materializeProductionBatchFromBridge()`.
- Produces: unchanged `ResolvedRecipePlanningArtifacts` shape.

- [ ] **Step 1: Add failing integration test**

Prove that `buildResolvedRecipePlanningArtifacts()` no longer accepts a raw `servings` value as recipe-scaling authority and that a ready bridge produces the expected batch, kitchen sheet and timeline metadata.

- [ ] **Step 2: Verify RED**

Expected failure: current function still requires/uses `servings` and calls `toProductionBatch()` directly.

- [ ] **Step 3: Modify resolved-recipe builder**

Change input from:

```ts
{ eventSpec, component, recipe, servings }
```

to conceptually:

```ts
{ eventSpec, component, recipe, bridgeResult }
```

Call `materializeProductionBatchFromBridge({
  eventSpecId: eventSpec.specId,
  componentId: component.componentId,
  recipe,
  bridgeResult
})`.

Use `bridgeResult.targetServings` only for presentation helpers such as `gnPlanFor()` after the hard materializer has validated it. Do not derive a replacement target from component or attendee data.

- [ ] **Step 4: Run focused GREEN tests**

Expected: resolved-recipe artifacts remain behaviorally compatible except that unproven raw servings can no longer create recipe-backed batches.

- [ ] **Step 5: Commit**

Commit message: `refactor: require proven scaling bridge for recipe batches`

---

### Task 3: Wire planner to fail closed when bridge proof is absent

**Files:**
- Modify only the narrow planning branch files necessary to supply a proven bridge result; likely `production-service/src/rules/planning-recipe-component-artifacts.ts`, `production-service/src/rules/planning-component-branch.ts`, and/or `production-service/src/rules/planning.ts` after inspecting current call flow.
- Test: extend existing production planning tests.

**Interfaces:**
- Consumes: current quantity/recipe decision data available in the stacked Stage-B path.
- Produces: recipe-backed planning artifacts only when a `ready_for_scaling` bridge is present; otherwise existing unresolved/blocking issue artifacts.

- [ ] **Step 1: Trace exact current call chain**

Identify where `buildResolvedRecipePlanningArtifacts()` is invoked and where raw `servings` originates. Limit changes to that chain.

- [ ] **Step 2: Write failing bypass-prevention test**

Construct a recipe-backed component where attendee/component servings exist but no ready bridge proof is supplied. Expected: no ProductionBatch, component remains unresolved/blocking.

- [ ] **Step 3: Implement minimal fail-closed wiring**

Remove direct recipe-batch authority from `component.servings ?? eventSpec.attendees.expected`. Existing servings values may remain as intake/context data, but cannot independently authorize recipe scaling.

If the current stacked branch does not yet have persisted bridge results in planner inputs, represent the missing proof as an explicit blocker rather than synthesizing an approval. Do not invent quantity decisions or mappings in this slice.

- [ ] **Step 4: Run planning tests**

Expected: bypass test passes; non-recipe procurement branches remain unchanged.

- [ ] **Step 5: Commit**

Commit message: `fix: close raw servings production batch bypass`

---

### Task 4: Full verification and evidence

**Files:**
- Create: `docs/agent-memory/PRODUCTION_BATCH_MATERIALIZATION_V1_TDD.md`
- Update PR body only; no product code changes after verification unless a failing test requires them.

- [ ] **Step 1: Run focused tests**

Expected: all new materialization and integration tests pass.

- [ ] **Step 2: Run full build/test**

Expected: zero failures.

- [ ] **Step 3: Run browser rehearsal**

Expected: SUCCESS.

- [ ] **Step 4: Record RED and GREEN evidence**

Document RED head/run, GREEN code head/run, final evidence head/run, focused test counts, full-suite counts, and browser result.

- [ ] **Step 5: Restore stacked PR base**

PR should target `feature/quantity-recipe-production-bridge-v1` after independent CI evidence against `main` has completed.

- [ ] **Step 6: Final scope check**

Verify only intended files changed; no deployment, release, persistence migration, UI change or provider call.
