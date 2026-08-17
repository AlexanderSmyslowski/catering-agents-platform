# Quantity Recipe Production Bridge v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert an approved event quantity decision into a recipe-specific `targetServings` value only when all event, component, recipe and conversion bindings are proven.

**Architecture:** Add one shared-core evaluator that composes `evaluateQuantityDecision()` and `evaluateRecipeEventUse()`. Direct serving targets pass through unchanged; all non-serving targets require an explicit reviewed `RecipeOutputMapping`. The bridge never changes or calls `scaleRecipe()`.

**Tech Stack:** TypeScript, Vitest, existing shared-core contracts.

## Global Constraints

- No inferred servings for weight, volume or piece targets.
- No safety, loss, yield, shrinkage, overproduction or procurement factors.
- Quantity must be `approved` for `ready_for_scaling`.
- Recipe must be `event_usable` for `ready_for_scaling`.
- Non-serving conversion requires exact-unit reviewed evidence.
- No provider calls, migration, UI redesign, deployment, release or real customer data.

### Task 1 — RED contract

Create `tests/quantity-recipe-production-bridge.test.ts` covering:
- approved servings → direct `targetServings`;
- 2,750 g with reviewed mapping 550 g = 10 servings → 50 servings;
- non-serving target without mapping → `review_required`;
- unit, recipe, numeric, reviewer and timestamp mapping defects → `blocked`;
- event/component binding mismatches → `blocked`;
- quantity pending review → `review_required`;
- rejected/invalid quantity → `blocked`;
- recipe pending event review → `review_required`;
- blocked recipe → `blocked`;
- zero-seed recipe accepted for the exact event → eligible;
- no hidden multiplier fields in output.

Run CI while the draft PR is temporarily based on `main` if needed. RED must fail because the bridge export does not yet exist.

### Task 2 — Minimal GREEN evaluator

Create `shared-core/src/quantity-recipe-production-bridge.ts` with:

```ts
export interface RecipeOutputMapping {
  recipeId: string;
  outputAmount: number;
  outputUnit: string;
  recipeServings: number;
  reviewedBy: string;
  reviewedAt: string;
}

export type QuantityRecipeProductionBridgeStatus =
  | "blocked"
  | "review_required"
  | "ready_for_scaling";
```

The evaluator input carries `eventSpecId`, `componentId`, `quantityDecision`, `recipe`, optional `recipeEventUseReview` and optional `outputMapping`.

Rules:
1. call `evaluateQuantityDecision()`;
2. reject event/component mismatches;
3. valid but non-approved quantity stays `review_required`;
4. call `evaluateRecipeEventUse()` and preserve blocked/review-required semantics;
5. if target unit is `servings`, set `targetServings = targetAmount`;
6. otherwise require mapping bound to the recipe, with same exact unit, positive finite amounts, reviewer and valid timestamp;
7. calculate only `targetAmount / outputAmount * recipeServings`, normalized to six decimals;
8. return exact approved target output, conversion method and deterministic issues.

Export the module from `shared-core/src/index.ts` without removing existing exports.

Run focused tests and the full suite, then commit the minimal implementation.

### Task 3 — Verification

Create `docs/agent-memory/QUANTITY_RECIPE_PRODUCTION_BRIDGE_V1_TDD.md` containing RED head/run, final GREEN head/run, focused/full test counts and both CI gate conclusions.

Restore PR base to `feature/quantity-decision-contract-v1`, verify the slice-only changed-file list and keep the PR Draft. Do not merge or deploy.
