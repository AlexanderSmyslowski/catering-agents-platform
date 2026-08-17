# Production Intake & Clarification Contract v1

Status: approved direction for implementation.
Base: stacked on `feature/production-knowledge-foundation-v1` head `23f7f8776cef52cd4e4d19c6a43658a5e0a4c244`.

## Goal

Replace the first phase of the current manual ChatGPT production workflow with a deterministic intake-readiness contract. The application must know which missing facts actually block quantity planning or production, which only weaken commercial plausibility, and which may be handled by an explicit assumption.

This slice reuses the existing clarification-question machinery. It does not add a second chat system.

## Decision

Add a pure evaluator `evaluateProductionIntakeReadiness` in shared-core. It consumes the structured `AcceptedEventSpec` plus safe source-ingestion markers and returns capability readiness plus typed requirement findings.

The evaluator distinguishes four requirement classes:

- `required_for_quantity_planning`
- `required_for_production`
- `commercial_context`
- `explicit_assumption_allowed`

Each finding is `known | missing | assumption_applied | source_verification_required` and carries a stable field key, reason, blocking scope, and optional suggested clarification key.

## Initial contract

### Quantity-planning blockers

- no positive attendee count (`guaranteed` preferred, otherwise `expected`);
- no meaningful event/occasion signal (`event.type` or `event.title`);
- no menu components;
- source marked fallback/failed when the structured event facts depend on that source.

### Production blockers

All quantity blockers plus:

- a menu component has no explicit production decision mode (`scratch | hybrid | convenience_purchase | external_finished`);
- a `hybrid` component has no purchased-elements declaration;
- the spec itself declares a blocking missing field relevant to production.

### Non-blocking commercial context

Missing `budgetContext.targetBudget` or `budgetContext.pricingSummary` must never by itself block quantity or production planning. It only makes `commercialPlausibilityReady=false`.

### Explicit-assumption corridor

Special portion/service logic may be absent without creating a hard production blocker if the spec contains an applied, explicit assumption for that subject. Silent assumptions are not created by this evaluator.

## Result

```ts
interface ProductionIntakeReadinessResult {
  status: "clarification_required" | "ready_for_quantity_planning" | "ready_for_production_planning";
  quantityPlanningReady: boolean;
  productionPlanningReady: boolean;
  commercialPlausibilityReady: boolean;
  findings: ProductionIntakeRequirementFinding[];
  blockingFieldKeys: string[];
}
```

`ready_for_production_planning` implies quantity readiness. A result may be production-ready while commercial plausibility remains false.

## Compatibility

- No changes to persisted `AcceptedEventSpec` are required.
- Existing `buildProductionClarificationQuestions` remains authoritative for rendering operator questions.
- The new evaluator is additive and can later feed `missingFields`/clarification generation without replacing the existing route/UI in this slice.
- No LLM/provider call, persistence migration, UI redesign, deployment, or real customer data.

## Acceptance cases

1. Missing attendee count blocks quantity and production.
2. Missing price/budget does not block production but marks commercial plausibility incomplete.
3. Missing event type/title blocks quantity because portion logic lacks event context.
4. Empty menu blocks quantity and production.
5. Missing component production mode blocks production but not quantity planning.
6. `hybrid` without declared purchased elements blocks production.
7. Fallback/failed document source creates source-verification blocker.
8. Fully structured spec with explicit production modes is production-ready even with no price context.
9. An applied explicit assumption can satisfy an assumption-allowed requirement; the evaluator never invents one.
10. Findings and blocker ordering are deterministic.