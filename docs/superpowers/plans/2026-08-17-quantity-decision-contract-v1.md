# Quantity Decision Contract v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic shared-core contract that computes and validates event-specific dish/component target quantities before any recipe scaling.

**Architecture:** Introduce one focused `quantity-decision.ts` module with types plus a pure evaluator. Export it from `shared-core/src/index.ts`. Keep recipe scaling untouched so the new contract remains a pre-scaling decision layer.

**Tech Stack:** TypeScript, Vitest, existing `@catering/shared-core` public package surface.

## Global Constraints

- No UI redesign.
- No persistence migration.
- No provider or LLM calls.
- No deployment or release.
- No real customer data.
- No automatic safety, loss, yield, overproduction, or buffer factor.
- Quantity decision remains separate from recipe scaling.

---

### Task 1: RED contract tests

**Files:**
- Create: `tests/quantity-decision-contract.test.ts`

**Interfaces:**
- Consumes: public package `@catering/shared-core`.
- Produces: expected public types `QuantityDecisionInput`, `QuantityDecisionResult`, and function `evaluateQuantityDecision(input)`.

- [ ] **Step 1: Write failing tests** covering `per_person_weight`, `pieces_per_person`, `servings_per_person`, `fixed_total`, contradictory target amount, invalid numeric values, fixed-total field conflicts, evidence/review incompatibility, rejected decisions, and no hidden safety factor.

```ts
import { describe, expect, it } from "vitest";
import { evaluateQuantityDecision } from "@catering/shared-core";

it("computes 55 g per person for 50 guests as 2750 g", () => {
  const result = evaluateQuantityDecision({
    decisionId: "qd-1",
    eventSpecId: "event-1",
    componentId: "roastbeef",
    guestCount: 50,
    serviceFormat: "buffet",
    dishRole: "main",
    basis: "per_person_weight",
    perUnitAmount: 55,
    perUnitUnit: "g",
    targetAmount: 2750,
    targetUnit: "g",
    rationale: "Geplante Ausgabemenge je Gast.",
    evidence: { kind: "operator_instruction", reference: "event-spec" },
    reviewStatus: "approved"
  });

  expect(result.valid).toBe(true);
  expect(result.usableForPlanning).toBe(true);
  expect(result.decision.targetAmount).toBe(2750);
});
```

- [ ] **Step 2: Run the focused test to prove RED**

Run: `npm test -- tests/quantity-decision-contract.test.ts`

Expected: build/test failure because `evaluateQuantityDecision` is not exported.

- [ ] **Step 3: Commit RED evidence**

```bash
git add tests/quantity-decision-contract.test.ts
git commit -m "test: define quantity decision contract"
```

### Task 2: Minimal quantity-decision evaluator

**Files:**
- Create: `shared-core/src/quantity-decision.ts`
- Modify: `shared-core/src/index.ts`
- Test: `tests/quantity-decision-contract.test.ts`

**Interfaces:**
- Consumes: only primitive TypeScript values.
- Produces:
  - `QuantityDecisionBasis = "per_person_weight" | "pieces_per_person" | "servings_per_person" | "fixed_total"`
  - `QuantityDecisionDishRole`
  - `QuantityDecisionEvidenceKind`
  - `QuantityDecisionReviewStatus`
  - `QuantityDecisionInput`
  - `QuantityDecisionIssue`
  - `QuantityDecisionResult`
  - `evaluateQuantityDecision(input: QuantityDecisionInput): QuantityDecisionResult`

- [ ] **Step 1: Implement exact public types** with stable string unions and a plain evidence object `{ kind, reference? }`.

- [ ] **Step 2: Implement deterministic validation** with stable issue codes:

```ts
"invalid_guest_count"
"invalid_per_unit_amount"
"missing_per_unit_unit"
"unexpected_per_unit_fields"
"invalid_target_amount"
"target_amount_mismatch"
"target_unit_mismatch"
"invalid_rationale"
"review_status_incompatible_with_evidence"
"decision_rejected"
```

- [ ] **Step 3: Implement calculation rules**

```ts
expectedTarget = basis === "fixed_total"
  ? input.targetAmount
  : input.perUnitAmount! * input.guestCount;
```

Round only floating-point noise to a deterministic precision; do not add any multiplier or buffer.

- [ ] **Step 4: Export the module** from `shared-core/src/index.ts` using:

```ts
export * from "./quantity-decision.js";
```

Preserve every pre-existing export in the index.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/quantity-decision-contract.test.ts`

Expected: all focused tests pass.

- [ ] **Step 6: Run build**

Run: `npm run build`

Expected: success.

- [ ] **Step 7: Commit GREEN implementation**

```bash
git add shared-core/src/quantity-decision.ts shared-core/src/index.ts tests/quantity-decision-contract.test.ts
git commit -m "feat: add quantity decision contract"
```

### Task 3: Full regression verification and TDD evidence

**Files:**
- Create: `docs/agent-memory/QUANTITY_DECISION_CONTRACT_V1_TDD.md`

**Interfaces:**
- Consumes: final CI/build/test results.
- Produces: durable RED/GREEN evidence for the slice.

- [ ] **Step 1: Run full suite**

Run: `npm test`

Expected: all existing and new tests pass, excluding intentional skips.

- [ ] **Step 2: Run browser rehearsal through repository CI**

Expected: `build-and-test` and `browser-rehearsal` succeed for the final head.

- [ ] **Step 3: Record RED and GREEN evidence** including commit SHAs, CI run IDs, focused test count, full-suite counts, and explicit statement that `rules/scaling.ts` was not changed.

- [ ] **Step 4: Commit evidence**

```bash
git add docs/agent-memory/QUANTITY_DECISION_CONTRACT_V1_TDD.md
git commit -m "docs: record quantity decision contract verification"
```

## Self-review

- Spec coverage: all four quantity bases, validation, review/evidence compatibility, rejected state, deterministic issues, and no hidden buffer are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: public type/function names are identical across all tasks.
- Scope check: one shared-core contract only; no UI, persistence, recipe scaling, provider, or deployment work.