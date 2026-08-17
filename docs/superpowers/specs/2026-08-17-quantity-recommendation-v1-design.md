# Quantity Recommendation v1 — Design

Status: approved direction for implementation.
Base: `main` at `a9294b704cef9f6530bc6ceb54fbe985b7954461`.

## Goal

Replace the manual expert step that currently decides values such as `55 g Roastbeef pro Person` with a structured, evidence-backed recommendation contract. The system must be useful even when THE ONE has no internally verified quantity rule yet.

The primary operator-facing result is one concrete recommended value. A professional range remains available as transparent supporting evidence.

A second core requirement is that **every operational quantity remains user-adjustable without allowing recipe, target quantity and purchasing to drift apart**.

## Core decision

Quantity Recommendation v1 produces a **candidate**, never an approval.

A recommendation may use professional-reference evidence and later AI-assisted reasoning, but its resulting QuantityDecision must remain `kitchen_review_required` until a human kitchen reviewer explicitly approves it through the existing Quantity Decision contract.

No recommendation may silently become planning-authoritative.

Once an operator deliberately changes an operational quantity, that edit becomes a new explicit quantity authority for the event. All dependent recipe and purchasing quantities must be recalculated from that authority rather than patched independently.

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

## User-editable quantity authority

The product must not expose disconnected editable numbers. It exposes different views of one event-specific quantity lineage.

Three operational views are user-editable:

1. **portion / target output** — e.g. `55 g per guest` or `2.75 kg cooked Roastbeef`;
2. **recipe scale / total recipe output** — the event-specific scaled recipe;
3. **derived purchasing quantity** — ingredient quantities required by that scaled recipe.

An edit on any of these views creates an explicit operator quantity override and triggers deterministic downstream recalculation.

The original recommendation and its professional corridor remain preserved for comparison; they are not overwritten.

### Editing target output

Example: operator changes Roastbeef target from `55 g` to `60 g per guest` for 50 guests.

The system must:

- create a new operator-backed QuantityDecision candidate/override;
- calculate target output `3,000 g`;
- recompute the Quantity→Recipe bridge;
- rescale the entire recipe proportionally;
- regenerate all derived purchasing quantities;
- mark dependent artifacts stale until regenerated;
- retain `55 g` plus its evidence as the original recommendation.

### Editing total recipe quantity

If the operator changes the desired total recipe/output quantity, the system derives the corresponding event quantity authority, then follows the same bridge → recipe scale → purchasing regeneration path.

It must not mutate only the recipe display while leaving the QuantityDecision unchanged.

### Editing a derived purchasing quantity

A purchasing row that represents an ingredient from a recipe is editable, but it is **not an independent truth**.

By default, changing one derived ingredient purchasing amount means: **scale the complete recipe proportionally so that this ingredient reaches the entered amount**.

Example: a scaled recipe requires `2.75 kg` of a reference ingredient and the operator enters `3.00 kg`. The system derives scale factor `3.00 / 2.75`, applies that factor to the complete event recipe, updates total recipe/output quantity, creates the corresponding operator quantity override, and regenerates every other recipe ingredient and purchasing row.

The system must show the resulting total/output change before or with confirmation; it may not silently change only one shopping row.

### Editing recipe composition is different

If the operator intends to change one ingredient **without proportional recipe scaling** — e.g. less salt, more cream, different spice ratio — that is a recipe-composition edit, not a quantity edit.

It must use a separate explicit recipe-edit action/version. Such a change creates a new event recipe variant/version and then regenerates purchasing from the changed recipe.

A purchasing-row quantity edit must never silently mutate recipe ratios.

## Quantity lineage and audit

Every operator quantity edit records:

- previous authoritative value;
- new value and unit;
- edit origin (`target_output | recipe_total | purchase_ingredient`);
- affected event/component/recipe;
- operator identity when available;
- timestamp when persisted by the application layer;
- derived scale factor where applicable;
- original recommendation/evidence reference;
- list or version identifiers of invalidated/regenerated downstream artifacts.

This makes recommendation → operator adjustment → recipe scale → purchasing traceable in both directions.

## Regeneration and stale-artifact rule

A quantity edit invalidates all downstream artifacts derived from the old quantity authority, including at minimum:

- Quantity→Recipe bridge result;
- ProductionBatch;
- KitchenSheet quantities;
- purchase requirements / purchase list rows;
- quantity-dependent cost calculations;
- quantity-dependent production summaries.

They must be regenerated from the new authority before being considered current. Old artifacts may remain in audit history but must not appear current.

## Adjustment trace

Every recommendation adjustment records:

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
- convert incompatible units without an explicit conversion contract;
- override an explicit operator quantity edit without a new explicit user action.

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

If the operator changes the target to `60 g`, the event target becomes `3,000 g`; after approval the recipe and all recipe-derived purchasing quantities are recalculated proportionally from that new target.

The recommendation remains visible as the original evidence-backed baseline.

## Fail-closed behavior

Return no numeric recommendation when:

- guest count is invalid for a per-person basis;
- evidence is missing;
- evidence unit/basis is incompatible;
- evidence is materially conflicting;
- required identifiers or rationale-bearing evidence are invalid.

Reject a quantity-edit recalculation when:

- the edited purchasing row cannot be uniquely traced to one recipe ingredient and event recipe;
- current or requested quantity is non-finite or non-positive;
- units are incompatible and no explicit conversion contract exists;
- the recipe/output mapping required to propagate the edit is missing;
- proportional scaling would rely on an unapproved or ambiguous recipe binding.

## Compatibility and slice boundary

- Existing `evaluateQuantityDecision()` remains authoritative for validation and review status.
- Existing Quantity→Recipe Bridge remains authoritative for recipe scaling input.
- Existing ProductionBatch gate remains authoritative for batch materialization.
- Quantity Recommendation v1 implements the recommendation contract first.
- The user-editable quantity lineage defined above is a mandatory follow-on slice and must be implemented before the application can claim end-to-end replacement of the current manual production workflow.
- No persistence migration in the recommendation slice.
- No provider/LLM call.
- No UI redesign.
- No deployment or release.

## Acceptance cases

### Recommendation

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

### Mandatory quantity-edit lineage

13. Editing target per-person quantity recalculates total output, recipe scale and all recipe-derived purchase quantities.
14. Editing total recipe/output quantity creates the corresponding event quantity override and regenerates purchasing.
15. Editing one recipe-derived purchasing quantity proportionally rescales the complete recipe by default.
16. A purchasing quantity edit cannot leave other recipe ingredients at their old scale.
17. A non-proportional single-ingredient change requires an explicit recipe-composition edit/version.
18. Original recommendation and professional corridor remain visible after operator override.
19. Downstream artifacts derived from the old quantity are marked stale and cannot be treated as current.
20. Untraceable or unit-incompatible purchasing edits fail closed rather than partially updating the chain.