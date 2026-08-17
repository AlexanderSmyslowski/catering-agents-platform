# Quantity Recommendation v1 — Design

Status: approved direction for implementation.
Base: `main` at `a9294b704cef9f6530bc6ceb54fbe985b7954461`.

## Goal

Replace the manual expert step that currently decides values such as `55 g Roastbeef pro Person` with a structured, evidence-backed recommendation contract. The system must be useful even when THE ONE has no internally verified quantity rule yet.

The primary operator-facing result is one concrete recommended value. A professional range remains available as transparent supporting evidence.

## Core decision

Quantity Recommendation v1 produces a **candidate**, never an approval.

A recommendation may use professional-reference evidence and later AI-assisted reasoning, but its resulting QuantityDecision must remain `kitchen_review_required` until a human kitchen reviewer explicitly approves it through the existing Quantity Decision contract.

No recommendation may silently become planning-authoritative.

## Inputs

The recommendation evaluator consumes structured facts only:

- `eventSpecId` and `componentId`;
- positive guest count;
- service format;
- dish role;
- quantity basis;
- professional evidence entries;
- optional explicit operator instruction;
- optional contextual adjustment factors.

Context factors are limited in v1 to named, reviewable influences:

- number of parallel food components competing for appetite;
- service style / serving format;
- explicit portion or piece instruction;
- dish role in the menu.

The evaluator does not infer allergens, dietary claims, shrinkage, yield, safety stock, procurement quantities, or recipe output.

## Professional evidence model

Each evidence entry contains:

- stable evidence id;
- source kind (`professional_reference | internal_rule | operator_instruction`);
- source reference / citation label;
- applicable dish role;
- applicable service formats, if constrained;
- quantity basis;
- unit;
- minimum professional amount;
- preferred professional amount;
- maximum professional amount;
- short rationale.

Amounts must be finite, positive and ordered `min <= preferred <= max`.

Professional references and operator instructions may support a recommendation but cannot themselves create `approved` review status.

## Recommendation result

The result contains:

- `status: recommended | evidence_insufficient | conflicting_evidence | invalid_input`;
- concrete `recommendedAmount` and unit when recommended;
- `professionalRange: { min, max, unit }`;
- normalized evidence references;
- explicit adjustment trace;
- rationale suitable for kitchen review;
- a generated `QuantityDecisionInput` candidate with `reviewStatus: kitchen_review_required`;
- deterministic issues/warnings.

The concrete recommended amount is the primary display value. The professional range is secondary but must remain available to the operator.

## Calculation contract

1. Validate event/component/guest/basis inputs.
2. Filter evidence to compatible basis, unit, dish role and service format.
3. If no compatible evidence remains, return `evidence_insufficient`; do not invent a number.
4. Normalize compatible evidence into a professional range.
5. If compatible evidence ranges do not overlap enough to support one defensible corridor, return `conflicting_evidence` rather than averaging incompatible facts.
6. Start from the evidence-backed preferred value.
7. Apply only explicit, named adjustment factors supplied to the evaluator.
8. Clamp the resulting recommendation to the evidence-supported professional range unless an explicit operator instruction supplies a different reviewed target. Any such override remains visible in the trace.
9. Calculate total target amount from the recommended per-person/per-unit amount and guest count for per-person bases. For `fixed_total`, use the explicitly supported total recommendation without multiplying by guests.
10. Emit a QuantityDecision candidate as `professional_reference` or `operator_instruction` evidence with `kitchen_review_required` status.

No hidden multiplier is permitted.

## Adjustment trace

Every adjustment records:

- factor id;
- factor kind;
- human-readable reason;
- input value;
- effect on the preferred amount;
- before/after amount.

V1 does not ship a large hard-coded catering heuristic table. It defines the safe contract into which professional rules and later AI-assisted recommendations can feed.

## AI boundary

AI is not required for this slice. Later AI may:

- select relevant professional evidence;
- propose explicit contextual adjustments;
- explain why one point inside the professional corridor is preferable.

AI may not:

- fabricate professional evidence;
- silently widen a professional corridor;
- bypass `kitchen_review_required`;
- add safety/yield/procurement multipliers;
- convert incompatible units without an explicit conversion contract.

## Example

For a buffet main component with 50 guests, compatible professional evidence may support `50–65 g cooked output per guest`, preferred `55 g`.

Primary result:

`55 g pro Person`

Supporting detail:

- professional corridor: `50–65 g`;
- total event target: `2,750 g`;
- evidence references;
- contextual adjustment trace;
- status: `kitchen_review_required`.

The recommendation is not production-authoritative until approved by the existing Quantity Decision review path.

## Fail-closed behavior

Return no numeric recommendation when:

- guest count is invalid for a per-person basis;
- evidence is missing;
- evidence unit/basis is incompatible;
- evidence is materially conflicting;
- required identifiers or rationale-bearing evidence are invalid.

## Compatibility

- Existing `evaluateQuantityDecision()` remains authoritative for validation and review status.
- Existing Quantity→Recipe Bridge remains unchanged.
- Existing ProductionBatch gate remains unchanged.
- No persistence migration.
- No provider/LLM call.
- No UI redesign.
- No deployment or release.

## Acceptance cases

1. One valid professional range yields its preferred value as the concrete recommendation.
2. Multiple compatible overlapping ranges yield a deterministic supported corridor and recommendation.
3. Missing compatible evidence returns `evidence_insufficient` with no invented amount.
4. Materially incompatible evidence returns `conflicting_evidence`.
5. Invalid guest count blocks per-person recommendations.
6. Recommendation total is mathematically consistent with guest count.
7. Resulting QuantityDecision candidate is always `kitchen_review_required` for professional-reference recommendations.
8. Recommendation cannot add safety, loss, yield or procurement factors.
9. Explicit named adjustment is visible in the trace and cannot silently exceed the professional corridor.
10. Operator instruction may be represented explicitly and remains review-visible.
11. Evidence and issue ordering are deterministic.
12. Existing quantity-decision, bridge and production-batch contracts remain behaviorally unchanged.