# Nonlinear Production Scaling & Experience Learning v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recipe-specific, human-approved nonlinear ingredient scaling plus structured production observations, Experience Rule Candidates, approval and evidence-strength evaluation without changing proportional `scaleRecipe()` semantics.

**Architecture:** Keep `scaleRecipe()` as the immutable proportional baseline. Add a focused `nonlinear-production-scaling.ts` domain module that evaluates approved rules into an effective recipe and a focused `experience-learning.ts` module that turns production observations into candidates, approvals and evidence summaries. No persistence or UI is added in this slice; all authority boundaries remain explicit shared-core contracts.

**Tech Stack:** TypeScript, shared-core domain contracts, Vitest, existing GitHub Actions CI and browser rehearsal.

## Global Constraints

- `scaleRecipe()` remains the proportional baseline and is not modified semantically.
- Only `approved` rules may automatically change effective production quantities.
- Candidate/rejected/superseded/revoked rules never auto-apply.
- One valid observation may create a candidate; no minimum observation count is required for human approval.
- Approval status and evidence strength are independent.
- Rules are exact-`recipeId` scoped in v1; no family generalization.
- No implicit unit conversion.
- No hidden safety, yield, loss, procurement or overproduction multiplier.
- No persistence migration, provider/LLM call, UI redesign, deployment or release.

---

### Task 1: Approved nonlinear ingredient scaling

**Files:**
- Create: `shared-core/src/nonlinear-production-scaling.ts`
- Modify: `shared-core/src/index.ts`
- Create/Test: `tests/nonlinear-production-scaling.test.ts`

**Interfaces:**
- Consumes: `Recipe`, `IngredientLine`, `ScaledRecipeResult`, `scaleRecipe(recipe, targetServings)`.
- Produces: `applyNonlinearProductionScaling(input)`, `ProductionScalingRule`, `EffectiveRecipeScalingResult`.

- [ ] **Step 1: Write the failing scaling contract tests**

Cover exact cases:

```ts
it("keeps the proportional baseline when no approved rule applies", () => {
  const result = applyNonlinearProductionScaling({ recipe, targetServings: 120, rules: [] });
  expect(result.effectiveRecipe.ingredients).toEqual(result.proportionalBaseline.ingredients);
});

it("applies an approved factor rule only to the bound ingredient", () => {
  const result = applyNonlinearProductionScaling({
    recipe,
    targetServings: 120,
    rules: [{
      ruleId: "cream-120",
      recipeId: recipe.recipeId,
      ingredientId: "cream",
      minServings: 100,
      maxServings: 150,
      model: { kind: "factor", factor: 0.9 },
      rationale: "Reviewed production correction",
      supportingObservationIds: ["obs-1"],
      reviewStatus: "approved",
      approvedBy: "chef-1",
      approvedAt: "2026-08-17T20:00:00.000Z"
    }]
  });
  expect(result.adjustments[0]).toMatchObject({ ingredientId: "cream", ruleId: "cream-120" });
  expect(result.effectiveRecipe.ingredients.find((x) => x.ingredientId === "cream")!.quantity.amount)
    .toBeLessThan(result.proportionalBaseline.ingredients.find((x) => x.ingredientId === "cream")!.quantity.amount);
});
```

Also test `cap`, `floor`, exact-size `anchor`, recipe mismatch, servings-range mismatch, context mismatch, unit mismatch, inactive lifecycle states and conflicting approved rules.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npx vitest run tests/nonlinear-production-scaling.test.ts`

Expected: FAIL because `applyNonlinearProductionScaling` and its types are not exported.

- [ ] **Step 3: Implement minimal scaling domain**

Define:

```ts
export type ProductionScalingRuleReviewStatus =
  | "candidate"
  | "approved"
  | "rejected"
  | "superseded"
  | "revoked";

export type ProductionScalingCorrectionModel =
  | { kind: "factor"; factor: number }
  | { kind: "cap"; amount: number; unit: string }
  | { kind: "floor"; amount: number; unit: string }
  | { kind: "anchor"; servings: number; amount: number; unit: string };

export interface ProductionScalingRule {
  ruleId: string;
  recipeId: string;
  ingredientId: string;
  minServings: number;
  maxServings: number;
  requiredContext?: string[];
  model: ProductionScalingCorrectionModel;
  rationale: string;
  supportingObservationIds: string[];
  reviewStatus: ProductionScalingRuleReviewStatus;
  approvedBy?: string;
  approvedAt?: string;
}

export function applyNonlinearProductionScaling(input: {
  recipe: Recipe;
  targetServings: number;
  rules: ProductionScalingRule[];
  context?: string[];
}): EffectiveRecipeScalingResult;
```

Implementation rules:

1. call `scaleRecipe()` once for proportional baseline;
2. filter only exact recipe, approved, in-range and context-compatible rules;
3. group applicable rules by ingredient;
4. if >1 applicable approved rule targets one ingredient, leave that ingredient at baseline and emit `conflicting_approved_rules:<ingredientId>`;
5. validate unit and numeric correction data before applying;
6. factor/cap/floor apply directly to the proportional baseline amount;
7. anchor applies only when `targetServings === model.servings`;
8. return baseline, effective recipe, adjustment trace, applied rule ids, relevant inactive candidate ids and deterministic issues.

- [ ] **Step 4: Run focused tests to GREEN**

Run: `npx vitest run tests/nonlinear-production-scaling.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add approved nonlinear production scaling`.

---

### Task 2: Production observations and Experience Rule Candidates

**Files:**
- Create: `shared-core/src/experience-learning.ts`
- Modify: `shared-core/src/index.ts`
- Create/Test: `tests/experience-learning.test.ts`

**Interfaces:**
- Produces: `createExperienceRuleCandidate(observation, proposal)`, `approveExperienceRuleCandidate(input)`, `summarizeExperienceEvidence(input)`.
- Consumes: `ProductionScalingRule` from Task 1.

- [ ] **Step 1: Write failing observation/candidate tests**

Cover:

```ts
it("creates a candidate from one valid production observation", () => {
  const result = createExperienceRuleCandidate(observation(), {
    candidateId: "cand-1",
    minServings: 100,
    maxServings: 150,
    model: { kind: "factor", factor: 0.9 },
    rationale: "At large batches cream repeatedly needs reduction"
  });
  expect(result.status).toBe("candidate_created");
  expect(result.candidate.supportingObservationIds).toEqual(["obs-1"]);
  expect(result.candidate.reviewStatus).toBe("candidate");
});
```

Also test invalid/non-positive quantities, unit mismatch, missing rationale, explicit finite applicability range and that candidate creation never returns `approved`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/experience-learning.test.ts`

Expected: FAIL on missing exports.

- [ ] **Step 3: Implement observation and candidate contracts**

Define `ProductionObservation` with event/component/recipe/servings/ingredient, proportional/planned/actual amounts, unit, context, rationale, outcome, operator and timestamp.

Candidate creation must:

- validate all amounts as finite positive;
- require one common v1 unit;
- require explicit finite `minServings <= maxServings`;
- bind candidate to the exact observation `recipeId` and `ingredientId`;
- preserve the observation id;
- emit `reviewStatus: "candidate"` only.

- [ ] **Step 4: Run focused tests to GREEN**

Run: `npx vitest run tests/experience-learning.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: capture production experience candidates`.

---

### Task 3: Explicit human approval and evidence strength

**Files:**
- Modify: `shared-core/src/experience-learning.ts`
- Modify/Test: `tests/experience-learning.test.ts`

**Interfaces:**
- `approveExperienceRuleCandidate(input)` returns an approved recipe-specific `ProductionScalingRule`.
- `summarizeExperienceEvidence(input)` returns transparent counts/coverage plus `low | medium | high` presentation classification.

- [ ] **Step 1: Add failing approval/evidence tests**

Required cases:

```ts
it("allows explicit human approval with one supporting observation", () => {
  const approved = approveExperienceRuleCandidate({
    candidate,
    reviewerId: "chef-1",
    approvedAt: "2026-08-17T21:00:00.000Z"
  });
  expect(approved.status).toBe("approved");
  expect(approved.rule.reviewStatus).toBe("approved");
  expect(approved.rule.supportingObservationIds).toHaveLength(1);
});

it("keeps evidence strength separate from approval", () => {
  const evidence = summarizeExperienceEvidence({ rule, observations: [observation()] });
  expect(evidence.classification).toBe("low");
  expect(rule.reviewStatus).toBe("approved");
});
```

Also test confirming vs contradicting counts, outcome counts, observed min/max servings, range coverage, low/medium/high thresholds, and that contradiction emits `reviewNeeded: true` without revoking the rule.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/experience-learning.test.ts`

Expected: new approval/evidence tests FAIL.

- [ ] **Step 3: Implement minimal approval/evidence logic**

Approval requires non-empty reviewer id, valid timestamp and a candidate. It may accept explicit approved range/model overrides, records them, and never checks for a minimum observation count.

Evidence summary calculates:

- `totalMatchingObservations`;
- `confirmingObservations`;
- `contradictingObservations`;
- outcome counts;
- observed min/max servings;
- whether observations cover lower and upper halves of rule range;
- context match count;
- `reviewNeeded` if a material contradiction exists;
- classification: `low`, `medium`, `high` exactly per spec thresholds.

- [ ] **Step 4: Run focused tests to GREEN**

Run: `npx vitest run tests/experience-learning.test.ts tests/nonlinear-production-scaling.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: approve and evaluate experience rules`.

---

### Task 4: Quantity-override integration contract

**Files:**
- Modify: `shared-core/src/user-quantity-override.ts`
- Modify/Test: `tests/user-quantity-override.test.ts`

**Interfaces:**
- Reuse `applyNonlinearProductionScaling()` after bridge resolution.
- Extend recalculation input with optional `productionScalingRules` and `productionContext`.
- Preserve current behavior when rules are omitted.

- [ ] **Step 1: Add failing integration tests**

Verify:

1. confirmed quantity override still produces unchanged proportional result with no nonlinear rules;
2. an approved matching rule alters `effectiveRecipeQuantity` and `purchaseQuantities` after the new event scale is established;
3. candidate rule does not alter purchasing;
4. changing target scale can move the event into or out of a rule's servings range.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/user-quantity-override.test.ts`

Expected: integration tests FAIL because recalculation does not yet consume nonlinear rules.

- [ ] **Step 3: Implement integration**

After Quantity→Recipe bridge returns `ready_for_scaling`, call:

```ts
applyNonlinearProductionScaling({
  recipe: input.recipe,
  targetServings: bridge.targetServings,
  rules: input.productionScalingRules ?? [],
  context: input.productionContext
});
```

Return the proportional baseline separately from `effectiveRecipeQuantity`; derive `purchaseQuantities` exclusively from the effective recipe ingredients. Preserve all existing fail-closed bridge behavior.

- [ ] **Step 4: Run integration and regression tests**

Run: `npx vitest run tests/user-quantity-override.test.ts tests/nonlinear-production-scaling.test.ts tests/experience-learning.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: apply nonlinear rules after quantity overrides`.

---

### Task 5: Full verification and TDD evidence

**Files:**
- Create: `docs/superpowers/plans/2026-08-17-nonlinear-production-scaling-experience-learning-v1-tdd-evidence.md`

- [ ] **Step 1: Run full build and test suite**

Run: `npm run build && npm test`

Expected: build success, full suite success.

- [ ] **Step 2: Verify unchanged neighboring contracts**

Run focused suites for quantity recommendation, quantity decision, quantity-recipe bridge, production batch materialization and user quantity override.

Expected: PASS with no behavior regression.

- [ ] **Step 3: Trigger/observe GitHub CI against `main` for independent evidence**

Expected gates: `build-and-test` SUCCESS and `browser-rehearsal` SUCCESS.

- [ ] **Step 4: Write TDD evidence**

Record RED head/run, GREEN head/run, focused tests, full-suite counts and explicit statement that no persistence/UI/provider/deployment/release change occurred.

- [ ] **Step 5: Commit**

Commit message: `docs: record nonlinear scaling tdd evidence`.
