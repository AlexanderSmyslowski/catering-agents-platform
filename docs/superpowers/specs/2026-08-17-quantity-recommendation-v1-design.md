# Quantity Recommendation v1 — Design

Status: approved direction for implementation.
Base: `main` at `a9294b704cef9f6530bc6ceb54fbe985b7954461`.

## Goal

Replace the manual expert step that currently decides values such as `55 g Roastbeef pro Person` with a structured, evidence-backed recommendation contract. The system must be useful even when THE ONE has no internally verified quantity rule yet.

The primary operator-facing result is one concrete recommended value. A professional range remains available as transparent supporting evidence.

A second core requirement is that **every operational quantity remains user-adjustable without allowing recipe, target quantity and purchasing to drift apart**.

A third core requirement is that recipe scaling must not assume that catering recipes are perfectly linear. Proportional scaling is the reproducible baseline, not necessarily the final production truth.

## Core decision

Quantity Recommendation v1 produces a **candidate**, never an approval.

A recommendation may use professional-reference evidence and later AI-assisted reasoning, but its resulting QuantityDecision must remain `kitchen_review_required` until a human kitchen reviewer explicitly approves it through the existing Quantity Decision contract.

No recommendation may silently become planning-authoritative.

Once an operator deliberately changes an operational quantity, that edit becomes a new explicit quantity authority for the event. All dependent recipe and purchasing quantities must be recalculated from that authority rather than patched independently.

Recipe scaling uses proportional scaling as a transparent baseline. Approved production-scaling rules may then adjust individual ingredients or process parameters nonlinearly. Any deviation from the proportional baseline must be explicit, attributable and reviewable.

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
- calculate the proportional recipe baseline;
- apply any approved nonlinear production-scaling rules for the resulting production size;
- regenerate all derived purchasing quantities from the effective scaled recipe;
- mark dependent artifacts stale until regenerated;
- retain `55 g` plus its evidence as the original recommendation.

### Editing total recipe quantity

If the operator changes the desired total recipe/output quantity, the system derives the corresponding event quantity authority, then follows the same bridge → proportional baseline → approved production-scaling rules → purchasing regeneration path.

It must not mutate only the recipe display while leaving the QuantityDecision unchanged.

### Editing a derived purchasing quantity

A purchasing row that represents an ingredient from a recipe is editable, but it is **not an independent truth**.

By default, changing one derived ingredient purchasing amount means: use that change to derive a new event recipe scale. The system first computes the proportional scale implied by the edit, then recalculates the complete recipe and applies any approved nonlinear production-scaling rules for the new production size.

Example: a scaled recipe requires `2.75 kg` of a reference ingredient and the operator enters `3.00 kg`. The system derives scale factor `3.00 / 2.75`, updates the event recipe/output scale, recalculates the proportional baseline for every ingredient, applies applicable approved nonlinear scaling rules, and regenerates every purchasing row.

The system must show the resulting total/output change before or with confirmation; it may not silently change only one shopping row.

### Editing recipe composition is different

If the operator intends to change one ingredient **without treating the edit as a recipe-scale change** — e.g. less salt, more cream, different spice ratio — that is a recipe-composition / production-scaling correction, not merely a quantity edit.

The operator must be able to classify the change as one of:

- `event_only_recipe_adjustment` — valid only for this production/event;
- `experience_rule_candidate` — observation believed to generalize to a production-size/context range;
- later, after review, `approved_experience_rule` / approved production-scaling rule.

A purchasing-row quantity edit must never silently mutate recipe ratios.

## Nonlinear catering recipe scaling

### Principle

`scaleRecipe()`-style proportional multiplication remains the mathematical baseline because it is simple, reproducible and auditable. It must not be treated as universally correct for large catering production.

The effective production recipe may differ from that baseline for specific ingredients and process parameters.

Examples include:

- salt, strong spices and acids that do not always scale linearly;
- thickening/binding agents;
- cream, stock or other liquids where evaporation/reduction behavior changes with vessel geometry;
- sauces and reductions;
- leavening or setting agents;
- cooking time, temperature, batch depth and holding time;
- equipment transitions such as saucepan → tilting pan or tray → combi oven;
- maximum sensible batch size requiring multiple production batches.

### Production-scaling rule

A production-scaling rule is explicit data, not hidden code magic. At minimum it identifies:

- recipe / recipe family or component scope;
- ingredient or process parameter affected;
- applicable production-size range;
- optional equipment / vessel / method context;
- baseline proportional value;
- effective rule or correction;
- rationale;
- provenance;
- review state.

Rules may represent, for example:

- a factor relative to proportional baseline;
- a piecewise factor by production range;
- a capped/floored amount;
- an explicit amount curve / anchor points;
- a process-parameter substitution;
- a maximum batch size and required batch count.

The data model must not force every nonlinear behavior into one universal multiplier.

### Rule precedence

For an event recipe:

1. establish approved quantity/output authority;
2. calculate proportional recipe baseline;
3. find applicable **approved** production-scaling rules;
4. apply them deterministically and record before/after values;
5. expose the effective recipe to kitchen review;
6. derive purchasing from the effective recipe, not from the untouched proportional baseline.

A candidate/observation may be displayed as guidance but cannot silently change production quantities until accepted for the event or promoted to an approved rule.

## Experience learning loop

The system is designed to turn kitchen experience into structured internal knowledge.

For each meaningful production correction, preserve:

- recipe and version;
- event/component;
- production size / target output;
- proportional baseline value;
- planned effective value;
- actual operator correction;
- ingredient/process affected;
- equipment/method context when relevant;
- operator rationale / observation;
- production outcome or later assessment when available.

A cook may classify a correction as:

### Event-only adjustment

Example: `Heute weniger Sahne, weil die Sauce länger reduziert wird.`

This changes the event recipe but does not teach a general rule.

### Experience Rule Candidate

Example: `Ab etwa 100 Portionen ist die proportional berechnete Sahnemenge bei diesem Verfahren regelmäßig zu hoch.`

This creates a structured candidate such as:

`base recipe → 120 portions → proportional cream 6.0 l → effective/actual 5.4 l → equipment/method/context → kitchen observation`.

The candidate is not automatically reused as truth.

### Approved Experience Rule

After sufficient human review — potentially supported by repeated observations — a candidate can become an approved internal production-scaling rule.

Only then may future event recipes apply it automatically within its defined applicability range.

The system must retain the observations that justified the rule.

## Quantity lineage and audit

Every operator quantity or recipe-scaling edit records:

- previous authoritative value;
- new value and unit;
- edit origin (`target_output | recipe_total | purchase_ingredient | recipe_composition | production_scaling`);
- affected event/component/recipe;
- operator identity when available;
- timestamp when persisted by the application layer;
- proportional baseline and effective value where relevant;
- derived scale factor where applicable;
- applied production-scaling rule ids;
- original recommendation/evidence reference;
- list or version identifiers of invalidated/regenerated downstream artifacts.

This makes recommendation → operator adjustment → proportional baseline → nonlinear production adjustment → purchasing traceable in both directions.

## Regeneration and stale-artifact rule

A quantity or effective-recipe edit invalidates all downstream artifacts derived from the old authority, including at minimum:

- Quantity→Recipe bridge result;
- effective event recipe / recipe scale;
- ProductionBatch;
- KitchenSheet quantities and process parameters;
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
- identify repeated production corrections as possible Experience Rule Candidates;
- suggest a nonlinear curve/range from reviewed observations;
- explain why one point inside the professional corridor is preferable.

AI may not:

- fabricate professional evidence or production observations;
- silently widen a professional corridor;
- bypass `kitchen_review_required`;
- invent or auto-approve an Experience Rule;
- apply unapproved nonlinear rules as production truth;
- add safety/yield/procurement multipliers without an explicit approved rule;
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

If the operator changes the target to `60 g`, the event target becomes `3,000 g`. The system first recalculates the proportional recipe baseline and then applies any approved production-size rules before generating the effective recipe and purchasing quantities.

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

Reject automatic nonlinear adjustment when:

- no approved rule applies;
- multiple approved rules conflict without deterministic precedence;
- production size or required equipment/method context falls outside the rule applicability range.

In those cases retain the proportional baseline and surface the review need; do not invent a correction.

## Compatibility and slice boundary

- Existing `evaluateQuantityDecision()` remains authoritative for validation and review status.
- Existing Quantity→Recipe Bridge remains authoritative for recipe scaling input.
- Existing ProductionBatch gate remains authoritative for batch materialization.
- Quantity Recommendation v1 implements the recommendation contract first.
- User-editable quantity lineage is a mandatory follow-on slice.
- Nonlinear Production Scaling / Experience Learning is a subsequent mandatory slice and must be implemented before the application can claim mature catering-recipe scaling.
- Existing proportional `scaleRecipe()` remains unchanged as the baseline calculator; nonlinear effective scaling is layered after it.
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

13. Editing target per-person quantity recalculates total output, proportional recipe baseline, effective recipe and all recipe-derived purchase quantities.
14. Editing total recipe/output quantity creates the corresponding event quantity override and regenerates purchasing.
15. Editing one recipe-derived purchasing quantity derives a new recipe scale and recalculates the complete recipe by default.
16. A purchasing quantity edit cannot leave other recipe ingredients at their old scale.
17. A non-proportional single-ingredient change requires an explicit event recipe adjustment or Experience Rule Candidate classification.
18. Original recommendation and professional corridor remain visible after operator override.
19. Downstream artifacts derived from the old quantity are marked stale and cannot be treated as current.
20. Untraceable or unit-incompatible purchasing edits fail closed rather than partially updating the chain.

### Mandatory nonlinear scaling / learning

21. Proportional scaling remains visible as baseline even when an effective nonlinear