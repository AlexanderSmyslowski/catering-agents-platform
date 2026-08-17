# Quantity Recommendation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, evidence-backed quantity recommendation contract that produces a concrete kitchen-review candidate plus professional range, without auto-approval or hidden scaling multipliers.

**Architecture:** Implement one focused shared-core evaluator that consumes structured event/component context, professional quantity evidence and explicit named adjustments. It emits a recommendation plus a `QuantityDecisionInput` candidate with `kitchen_review_required`; existing quantity-decision, bridge and production-batch contracts remain unchanged. User quantity overrides and nonlinear production scaling remain separate follow-on slices.

**Tech Stack:** TypeScript, shared-core, Vitest, GitHub Actions CI.

## Global Constraints

- Recommendation is a candidate, never an approval.
- Professional-reference output must use `reviewStatus: "kitchen_review_required"`.
- Missing or conflicting evidence must return no invented numeric recommendation.
- No safety, yield, shrinkage, procurement or overproduction multiplier.
- Existing `evaluateQuantityDecision()`, Quantity→Recipe Bridge and ProductionBatch gate remain behaviorally unchanged.
- No provider/LLM call, persistence migration, UI redesign, deployment or release.
- User-editable quantity lineage and nonlinear Experience Rules are explicitly out of implementation scope for this slice.

---

### Task 1: Define recommendation contract with RED tests

**Files:**
- Create: `tests/quantity-recommendation.test.ts`
- Create later in GREEN: `shared-core/src/quantity-recommendation.ts`
- Modify later in GREEN: `shared-core/src/index.ts`

**Interfaces:**
- Consumes existing `QuantityDecisionBasis`, `QuantityDecisionDishRole`, `QuantityDecisionInput`.
- Produces `recommendQuantity(input): QuantityRecommendationResult`.

- [ ] **Step 1: Write failing contract tests**

Create fixtures covering:

```ts
const professionalEvidence = {
  evidenceId: "portion-guide-main-buffet",
  sourceKind: "professional_reference" as const,
  reference: "Professional catering portion guide",
  dishRole: "main" as const,
  serviceFormats: ["buffet"],
  basis: "per_person_weight" as const,
  unit: "g",
  minAmount: 50,
  preferredAmount: 55,
  maxAmount: 65,
  rationale: "Cooked output corridor for a buffet main component."
};
```

Required tests:

1. one compatible evidence row → `recommended`, 55 g, corridor 50–65 g, target 2,750 g for 50 guests;
2. emitted decision candidate is `kitchen_review_required`, never `approved`;
3. two overlapping evidence corridors produce deterministic intersection and supported recommendation;
4. no compatible evidence → `evidence_insufficient`, no `recommendedAmount`, no decision candidate;
5. disjoint compatible evidence → `conflicting_evidence`, no numeric recommendation;
6. invalid guest count for per-person basis → `invalid_input`;
7. basis/unit mismatch evidence is ignored and can lead to `evidence_insufficient`;
8. explicit adjustment records before/after trace and clamps inside professional corridor;
9. adjustment cannot introduce hidden safety/yield/procurement semantics;
10. `fixed_total` uses the evidence-supported total directly without multiplying by guest count;
11. operator instruction remains explicit and `kitchen_review_required`;
12. evidence references, issues and traces are deterministically ordered.

- [ ] **Step 2: Run RED verification**

Open a draft PR against `main` so CI runs. Expected build failure: `recommendQuantity` / recommendation types do not exist on the public shared-core surface.

- [ ] **Step 3: Commit RED contract**

Commit message: `test: define quantity recommendation contract`

---

### Task 2: Implement minimal recommendation evaluator

**Files:**
- Create: `shared-core/src/quantity-recommendation.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/quantity-recommendation.test.ts`

**Interfaces:**

```ts
export type QuantityRecommendationStatus =
  | "recommended"
  | "evidence_insufficient"
  | "conflicting_evidence"
  | "invalid_input";

export interface QuantityRecommendationEvidence {
  evidenceId: string;
  sourceKind: "professional_reference" | "internal_rule" | "operator_instruction";
  reference: string;
  dishRole: QuantityDecisionDishRole;
  serviceFormats?: string[];
  basis: QuantityDecisionBasis;
  unit: string;
  minAmount: number;
  preferredAmount: number;
  maxAmount: number;
  rationale: string;
}

export interface QuantityRecommendationAdjustment {
  factorId: string;
  factorKind: "menu_competition" | "service_format" | "explicit_portion_instruction" | "dish_role" | "operator_adjustment";
  reason: string;
  multiplier: number;
}

export interface QuantityRecommendationInput {
  decisionId: string;
  eventSpecId: string;
  componentId: string;
  guestCount: number;
  serviceFormat: string;
  dishRole: QuantityDecisionDishRole;
  basis: QuantityDecisionBasis;
  evidence: QuantityRecommendationEvidence[];
  adjustments?: QuantityRecommendationAdjustment[];
}
```

Result contains status, optional concrete recommendation, professional range, evidence references, trace, rationale, optional generated `QuantityDecisionInput`, and deterministic issues.

- [ ] **Step 1: Validate recommendation input**

Reject blank ids/service format, invalid per-person guest count, malformed evidence ranges (`min <= preferred <= max`, all finite/positive), blank unit/reference/rationale, or invalid adjustment multiplier.

- [ ] **Step 2: Select compatible evidence**

Compatibility requires exact basis, exact unit within the compatible set, matching dish role and service format when evidence constrains service formats.

- [ ] **Step 3: Derive professional corridor**

For multiple compatible evidence rows use intersection:

```ts
const min = Math.max(...rows.map((row) => row.minAmount));
const max = Math.min(...rows.map((row) => row.maxAmount));
```

If `min > max`, return `conflicting_evidence`.

Preferred recommendation is the deterministic median of compatible preferred values, clamped to `[min, max]`.

- [ ] **Step 4: Apply explicit named adjustments**

Apply adjustments in deterministic `factorId` order. Each adjustment records before/after amount and reason. Clamp after each adjustment to `[min, max]`. No adjustment kind represents safety, yield, shrinkage, procurement or overproduction.

- [ ] **Step 5: Emit quantity decision candidate**

For non-`fixed_total`:

```ts
perUnitAmount = recommendedAmount;
targetAmount = recommendedAmount * guestCount;
perUnitUnit = unit;
targetUnit = unit;
```

For `fixed_total`, omit per-unit fields and set target directly to recommended amount.

Evidence kind maps to `operator_instruction` only when the recommendation is supported exclusively by operator-instruction evidence; otherwise `professional_reference`.

Always emit `reviewStatus: "kitchen_review_required"`.

- [ ] **Step 6: Export from shared-core**

Add `export * from "./quantity-recommendation.js";` to `shared-core/src/index.ts`.

- [ ] **Step 7: Run focused GREEN tests**

Expected: all quantity-recommendation tests pass.

- [ ] **Step 8: Commit GREEN implementation**

Commit message: `feat: add quantity recommendation contract`

---

### Task 3: Regression and final verification

**Files:**
- Create: `docs/agent-memory/QUANTITY_RECOMMENDATION_V1_TDD.md`
- No product behavior changes beyond Task 2.

**Interfaces:**
- Consumes final recommendation evaluator and existing downstream contracts.
- Produces verification evidence only.

- [ ] **Step 1: Run focused compatibility tests**

Run the new recommendation suite plus existing quantity-decision, quantity-recipe-bridge and production-batch-materialization suites. Expected: all green.

- [ ] **Step 2: Run full CI**

Require both:

- `build-and-test`: SUCCESS;
- `browser-rehearsal`: SUCCESS.

- [ ] **Step 3: Record TDD evidence**

Document RED head/run, GREEN head/run, focused counts, full-suite counts, and explicit scope boundaries.

- [ ] **Step 4: Re-run CI on final documentation head**

Because the docs commit changes the final head, require fresh `build-and-test` and `browser-rehearsal` success on that exact head.

- [ ] **Step 5: Keep PR draft until independently verified**

No merge, deployment or release in this plan.