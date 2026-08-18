# Production Quantity Workflow v1 — Design

Status: approved design direction.
Base: `main` at `a75910324ca53d8fb11a353eb75af48d11ccecab`.

## Goal

Expose the already implemented Quantity Recommendation, User Quantity Override / Bidirectional Recalculation, and Nonlinear Production Scaling contracts through the real production-service and backoffice product workflow.

This slice turns the shared-core domain chain into an operator-usable workflow without weakening any existing kitchen, recipe-event-use, quantity-decision, or production gates.

## Core UX

The quantity workflow is visible directly in the existing production plan for each dish/component. Recipe details remain secondary and expandable.

A component quantity card shows at minimum:

- concrete recommended quantity, e.g. `55 g pro Person`;
- professional corridor, e.g. `50–65 g`;
- total target amount for the event;
- recommendation / review status;
- concise rationale / evidence references;
- proportional baseline and effective amount when an approved nonlinear rule changes the result;
- action `Menge ändern`.

If compatible professional evidence is absent, the card must not invent a value. It shows a clear review-required state such as `Noch keine belastbare Mengenempfehlung – Küchenentscheidung erforderlich.`

## Two edit entry points

### 1. Production-plan quantity card

The operator may change the per-person / target quantity for a dish/component.

The edit is preview-first:

1. operator enters the requested quantity;
2. product requests a quantity-override preview;
3. preview displays resulting target output, recipe scale, changed recipe ingredients, changed purchasing quantities and any applicable approved nonlinear scaling adjustments;
4. nothing authoritative changes yet;
5. operator explicitly selects `Änderung übernehmen`;
6. the server confirms the override and regenerates the quantity lineage through existing gates.

### 2. Purchase-list row

A purchase row that is uniquely traceable to one event recipe ingredient is editable.

Changing e.g. `2.75 kg` to `3.00 kg` means by default: derive the implied recipe scale, recalculate the complete proportional recipe baseline, apply approved nonlinear rules, and regenerate all dependent purchase rows.

The UI must show this impact before confirmation. It must not patch one purchase row independently.

If the operator intends to change only one ingredient ratio while keeping the overall recipe scale, that is not a purchase quantity override. The UI must route or label it as a recipe/production correction workflow rather than silently changing composition. Full Experience Rule administration is out of scope for this UI slice.

## Architecture

### Shared-core

Existing domain functions remain authoritative and are not duplicated in UI code:

- `recommendQuantity()`;
- `previewQuantityOverride()`;
- `confirmQuantityOverride()`;
- `recalculateQuantityLineage()`;
- `applyNonlinearProductionScaling()` through the existing recalculation path.

The product layer may add DTO/projection helpers but must not reimplement their calculation logic.

### Production service

Add a thin operator-authenticated quantity workflow surface under the existing production case/artifact routing conventions.

The service exposes three conceptual operations:

1. **read/recommend** — obtain quantity workflow projections for current production components;
2. **preview override** — validate and calculate a side-effect-free preview from either target-output or purchase-row input;
3. **confirm override** — confirm exactly the previewed change, create the new quantity authority, and return regenerated current projections or an explicit review-required result.

Mutation routes use the existing production-operator authorization model and audit conventions.

The server, not the browser, is responsible for authoritative domain recalculation.

### Backoffice API layer

Add typed DTOs and API functions for:

- quantity workflow cards;
- quantity override preview;
- quantity override confirmation;
- purchase-row traceability/editability metadata.

The browser must not calculate scale factors independently as authoritative values. It may format values returned by the server.

### Backoffice production UI

Integrate the quantity card into the existing production plan/component presentation.

Integrate editable purchase quantities into the existing purchase-list presentation only for rows marked `editable: true` and carrying an unambiguous recipe ingredient binding.

Use the existing visual system and interaction patterns; no broad UI redesign.

## Quantity workflow projection

A server projection for one component contains enough information for the UI without exposing internal implementation details:

- `componentId`;
- `label`;
- `status` (`recommended | evidence_insufficient | conflicting_evidence | review_required | approved` as applicable to product state);
- `recommendedAmount` / unit when available;
- `professionalRange` when available;
- `targetTotal` / unit when available;
- concise rationale;
- evidence labels/references;
- current authoritative amount when one exists;
- proportional baseline when recipe scale exists;
- effective quantity when nonlinear scaling changes it;
- applied Experience Rule ids/labels when applicable;
- `canEdit` and blocking reason when editing is unavailable.

The UI distinguishes recommendation from current authority. An operator override must not visually overwrite the historical recommendation.

## Override preview projection

A preview contains:

- stable preview identity/fingerprint;
- edit origin (`target_output | purchase_ingredient` in this UI slice);
- previous and requested values;
- implied scale factor when applicable;
- resulting target output;
- recipe before/after quantities;
- purchase before/after quantities;
- proportional baseline vs effective values where nonlinear rules apply;
- applicable approved rule trace;
- warnings / review requirements;
- `confirmable` boolean.

Preview is side-effect free.

## Confirmation integrity

Confirmation must bind to the exact preview state. The server must reject confirmation if the relevant source quantity/revision changed after preview or if the preview identity does not match the submitted change.

This prevents a stale browser preview from overwriting a newer production decision.

Confirmation does not bypass existing human-review gates. If a new QuantityDecision or RecipeEventUse still requires approval, the response returns `review_required` and the UI shows the existing review need rather than pretending the recalculation is production-authoritative.

## Purchase-list editing

Only recipe-derived rows with an unambiguous event/component/recipe/ingredient lineage are editable.

Rows for fixed purchased products, manual procurement entries, aggregated ambiguous ingredients, or unit-incompatible mappings remain read-only in v1 unless the server can establish a unique reversible lineage.

The UI explains why a row is not editable rather than presenting a non-functional control.

## Nonlinear scaling visibility

Approved nonlinear Experience Rules already apply through the shared-core recalculation path once existing quantity and recipe-use review gates permit it.

The first UI integration does not administer Experience Rules. It only explains their effect:

- proportional baseline;
- applied rule / rationale label;
- effective production amount.

Candidate rules never affect quantities automatically and are not promoted from this screen.

## Error and fail-closed behavior

The product must not partially update quantities.

Return a non-confirmable preview or explicit error when:

- evidence is insufficient for a new recommendation;
- source purchase row is not uniquely traceable;
- units are incompatible;
- current quantity/revision changed since preview;
- event/component/recipe bindings are ambiguous;
- existing QuantityDecision or RecipeEventUse gates block authoritative recalculation;
- approved nonlinear rules conflict.

Existing current artifacts remain current until a confirmed valid override creates a new authority and regeneration succeeds according to the existing contract.

## Audit

Confirmed quantity mutations use existing production audit conventions and record at minimum:

- operator;
- event/case/component;
- edit origin;
- previous/requested value;
- preview identity;
- resulting quantity authority / review status;
- affected recipe and purchase projections;
- applied nonlinear rule ids when applicable.

Preview reads do not create mutation audit events.

## Scope boundary

In scope:

- production-service API integration;
- typed backoffice API integration;
- production-plan quantity cards;
- preview-first target quantity editing;
- preview-first purchase-row editing;
- confirmation and regenerated projection display;
- nonlinear baseline/effective explanation.

Out of scope:

- Experience Rule creation/approval UI;
- recipe-family generalization;
- persistence redesign or broad schema migration unless an existing persistence seam strictly requires a minimal compatible addition;
- offer-side quantity workflow;
- broad production UI redesign;
- provider/LLM changes;
- automatic deployment as part of implementation.

## Acceptance cases

1. Production plan renders a quantity card for each supported component.
2. A valid professional recommendation shows concrete value plus professional corridor.
3. Missing compatible evidence shows review-required/no-number state.
4. Recommendation and current operator authority are visually distinct.
5. Editing target quantity produces a side-effect-free preview before any mutation.
6. Preview shows resulting target, recipe and purchase changes.
7. Confirmation is required before mutation.
8. Confirmation of a stale/mismatched preview fails closed.
9. Existing QuantityDecision and RecipeEventUse review gates remain authoritative.
10. Purchase rows are editable only when uniquely traceable to one recipe ingredient lineage.
11. Editing one purchase amount previews proportional rescaling of the complete recipe, not a one-row patch.
12. Confirmed purchase edit regenerates all dependent purchase quantities.
13. A non-proportional single-ingredient intent is not silently treated as a quantity override.
14. Approved nonlinear rules are reflected as baseline → rule → effective quantity.
15. Candidate nonlinear rules never affect displayed authoritative purchasing amounts.
16. Backoffice does not duplicate authoritative scaling math.
17. Mutation routes require existing production-operator authorization.
18. Confirmed mutations produce audit evidence; previews do not create mutation audit events.
19. Existing production plan, purchase list and recipe workflows remain usable when no quantity recommendation exists.
20. Existing CI and browser rehearsal remain green.