# User Quantity Override & Bidirectional Recalculation v1 — Design

Status: approved direction for implementation.
Base: `feature/quantity-recommendation-v1` at `61c45aceb617601366c6fa46eb6a32d4cdc801fa`.

## Goal

Allow operators to adjust operational quantities at any relevant point without letting target quantity, event recipe, production batch and purchasing drift apart.

The system must support three editable views of one event-specific quantity lineage:

1. portion / target output;
2. event recipe total / recipe scale;
3. recipe-derived purchasing quantity.

An edit is not an independent patch. It produces a proposed new event quantity authority and a deterministic recalculation preview. Only after explicit confirmation does the new authority replace the current one.

## Primary UX decision

A purchase-quantity edit is **preview-first**.

Example:

Current derived purchase quantity: `2.75 kg`.
Operator enters: `3.00 kg`.

The application must show, before confirmation:

- entered quantity;
- current quantity;
- implied scale factor (`3.00 / 2.75 = 1.090909...`);
- resulting target/output change;
- resulting recipe-scale change;
- changed ingredient quantities across the whole recipe;
- downstream artifacts that will become stale/regenerated.

No authoritative state changes until the operator confirms.

The same preview → confirm model applies to target-output and recipe-total edits.

## Core principle: one quantity authority, multiple views

The following must never become independent competing truths:

- recommendation baseline;
- current approved/authoritative target output;
- event recipe scale;
- recipe-derived purchase quantities.

The original recommendation remains historical evidence. A confirmed operator override creates a new event-specific quantity authority with its own audit lineage.

## Scope

V1 supports proportional recalculation only.

It must already preserve both concepts:

- `proportionalBaseline`;
- `effectiveRecipeQuantity`.

In this slice they are equal unless a later nonlinear scaling layer changes the effective value.

Nonlinear catering production scaling, recipe-composition learning and Experience Rules are explicitly out of scope for implementation here, but the data contract must not prevent them.

## Edit origins

Supported edit origins:

- `target_output`;
- `recipe_total`;
- `purchase_ingredient`.

A non-proportional change to one ingredient is **not** a quantity override. It is a recipe-composition / production-scaling edit and must use a separate future action.

## Preview contract

`previewQuantityOverride()` is pure and side-effect free.

It receives the current event-specific quantity lineage and one proposed edit.

The preview returns:

- `status: preview_ready | blocked`;
- event/component/recipe binding identifiers;
- edit origin;
- previous authoritative target;
- proposed authoritative target;
- proportional scale factor;
- proportional baseline recipe quantities;
- effective recipe quantities (equal to baseline in v1);
- regenerated purchase quantities;
- deterministic stale-artifact list;
- issues;
- human-readable summary suitable for confirmation UI.

A blocked preview returns no confirmable override.

## Preview: target-output edit

Input example:

- current authority: `55 g/person`, `50` guests, total target `2,750 g`;
- proposed target: `60 g/person`.

Preview must derive:

- new total target `3,000 g`;
- scale factor `3,000 / 2,750`;
- new recipe scale through the existing reviewed Quantity→Recipe output mapping;
- proportional ingredient quantities;
- regenerated purchasing quantities.

The existing recommendation `55 g/person` remains preserved as baseline evidence.

## Preview: recipe-total edit

The operator may edit the event recipe/output total directly.

The system must derive the corresponding event target authority rather than treating the recipe total as an isolated display mutation.

The preview must then recompute the complete recipe and purchasing lineage.

If the recipe-total unit cannot be mapped back to the event target through the reviewed output mapping, fail closed.

## Preview: recipe-derived purchase edit

A purchase row must be traceable to exactly one event recipe ingredient.

Given:

- current ingredient amount `A_current`;
- proposed ingredient amount `A_new`;

compute:

`scaleFactor = A_new / A_current`.

Apply the factor to the complete event recipe scale, not only to the edited row.

Then derive:

- new target/output authority;
- new target servings/output mapping;
- proportional recipe baseline for every ingredient;
- effective recipe quantities (same as baseline in v1);
- regenerated purchase quantities for every recipe-derived purchase row.

The edited purchase row is therefore an input signal for a recipe-scale change, not an independent procurement truth.

## Recipe-composition boundary

If an operator wants to change one ingredient while keeping total recipe/output scale constant, that is not `purchase_ingredient` quantity override behavior.

The UI must eventually offer a distinct action such as:

`Rezeptur ändern statt skalieren`.

That action is outside this slice and will create an event recipe variant / Experience Rule Candidate in a later slice.

V1 must fail closed rather than silently interpreting an ambiguous single-ingredient edit as a composition change.

## Confirmation contract

`confirmQuantityOverride()` accepts only a previously valid preview plus explicit operator confirmation metadata.

Confirmation creates a new event-specific quantity override record containing:

- stable override id;
- eventSpecId;
- componentId;
- recipeId;
- edit origin;
- previous authority;
- new authority;
- unit;
- proportional scale factor;
- source purchase ingredient id when applicable;
- operator identity when supplied;
- confirmed timestamp supplied by application layer;
- originating recommendation/evidence reference when available;
- ids/types of downstream artifacts invalidated by the override.

The pure shared-core contract does not persist data or generate timestamps itself.

## Recalculation contract

`recalculateQuantityLineage()` consumes a confirmed override together with the current reviewed recipe/output mapping and recipe.

It produces the authoritative regenerated lineage:

- updated QuantityDecision input/result;
- updated Quantity→Recipe bridge input/result;
- proportional recipe baseline;
- effective event recipe quantities;
- recipe-derived purchase quantities;
- stale artifact declarations.

In v1, `effective event recipe = proportional baseline`.

The function must not invent approval. If the new quantity authority requires review under the existing Quantity Decision contract, downstream production remains gated accordingly.

## Stale-artifact semantics

Before confirmation, nothing is stale because no authoritative change occurred.

On confirmation, all artifacts derived from the previous quantity authority become stale at once.

At minimum:

- Quantity→Recipe bridge result;
- event recipe scale / effective event recipe;
- ProductionBatch;
- KitchenSheet quantities;
- purchase requirements / purchase-list rows;
- quantity-dependent cost calculations;
- quantity-dependent production summaries.

A stale artifact may remain in audit/history but must not appear current.

The recalculation result identifies which replacement artifacts are ready and which remain blocked by review or missing mappings.

## Units and conversions

V1 performs no implicit unit conversion.

A recalculation is blocked when:

- units differ and no explicit reviewed conversion/mapping exists;
- a purchase row cannot be uniquely traced to one recipe ingredient;
- current amount or proposed amount is non-finite or non-positive;
- recipe/output mapping is missing or not applicable;
- event/component/recipe bindings differ;
- current authoritative lineage is ambiguous.

No partial update is allowed.

## Recommendation preservation

The Quantity Recommendation remains immutable evidence.

A confirmed operator override does not rewrite:

- the original recommended amount;
- professional corridor;
- evidence references;
- recommendation rationale.

Instead the product can display:

`Empfehlung 55 g/person → Nutzerfreigabe 60 g/person`.

This supports both operational clarity and later learning.

## Audit lineage

Every confirmed override must be traceable through:

`recommendation/evidence → previous quantity authority → preview → operator confirmation → new quantity authority → recipe scale → purchase quantities`.

For a purchase-origin edit, also preserve:

`edited ingredient → old amount → new amount → derived scale factor`.

## Compatibility

- `recommendQuantity()` remains unchanged.
- `evaluateQuantityDecision()` remains the quantity validation/review authority.
- `evaluateQuantityRecipeProductionBridge()` remains the only recipe-scaling gate.
- `scaleRecipe()` remains the proportional baseline calculator.
- ProductionBatch materialization remains gated by `ready_for_scaling`.
- No nonlinear production rule is applied in this slice.
- No persistence migration.
- No UI redesign.
- No provider/LLM call.
- No deployment or release.

## Acceptance cases

1. A target-output edit produces a preview and does not mutate authoritative state.
2. Confirming the preview creates a new explicit event quantity override.
3. A target-output change recalculates total output, recipe scale and every recipe-derived purchase quantity.
4. A recipe-total edit derives a new event quantity authority and complete regenerated lineage.
5. A recipe-derived purchase edit computes an explicit proportional scale factor from the edited ingredient.
6. A purchase edit proportionally recalculates all recipe ingredients; no other ingredient remains at its previous scale.
7. A purchase edit shows the resulting total/output change before confirmation.
8. Cancelling or not confirming a preview leaves authoritative values and artifact freshness unchanged.
9. Original recommendation and professional corridor remain preserved after override.
10. Confirmation invalidates all quantity-dependent downstream artifacts from the previous authority atomically.
11. Recalculated lineage uses existing Quantity Decision and Quantity→Recipe gates rather than bypassing them.
12. No implicit safety, yield, loss, procurement or overproduction multiplier is introduced.
13. Non-positive or non-finite proposed quantities block preview.
14. Untraceable purchase rows block preview.
15. Incompatible units without explicit reviewed mapping block preview.
16. Event/component/recipe binding mismatches fail closed.
17. V1 reports proportional baseline and effective recipe quantities separately even though they are equal.
18. A single-ingredient non-proportional composition change is not represented as a quantity override.
19. Issues and stale-artifact declarations are deterministic.
20. Existing recommendation, bridge, scaling and ProductionBatch behavior remains unchanged outside the new override contract.