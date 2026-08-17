# Nonlinear Production Scaling & Experience Learning v1 — Design

Status: approved design direction.
Base: `feature/user-quantity-override-v1` at `10bf264fe06fd3f1706a77b30488fd5b72cdf500`.

## Goal

Allow catering recipes to keep proportional scaling as a transparent mathematical baseline while applying explicit, human-approved nonlinear production rules for real kitchen production. Capture operator corrections as structured observations so THE ONE can develop its own production knowledge from real events.

The system must support learning from the first production without treating one observation, many observations, or AI inference as automatic truth.

## Core principles

1. Proportional scaling remains the visible and reproducible baseline.
2. Effective production quantities may differ from that baseline only through explicit event adjustments or approved production-scaling rules.
3. Every nonlinear deviation records before/after values, rationale, scope and provenance.
4. Experience Rule Candidates never apply automatically as production truth.
5. Only an authorized human review action can approve a reusable Experience Rule.
6. There is no fixed minimum number of observations required for human approval.
7. Evidence strength is separate from approval status.
8. Rules are recipe-specific by default. Generalization to a recipe family is a separate explicit human-approved action.
9. Purchasing is derived from the effective recipe, not from the untouched proportional baseline.
10. AI may identify or propose patterns later but cannot fabricate observations or approve rules.

## Scope

V1 covers nonlinear **ingredient quantity** scaling and the experience-learning contract around it.

The data model is deliberately extensible to process parameters such as cooking time, temperature, GN fill depth, batch size, equipment and holding time, but v1 does not automatically modify those process parameters.

## Production scaling model

### Baseline

The existing proportional `scaleRecipe()` result is the baseline. It remains unchanged.

For an event recipe:

`approved output authority → proportional scaleRecipe() baseline → applicable approved nonlinear rules → effective event recipe → purchasing`

### Rule scope

A v1 rule is scoped to one exact `recipeId` by default and identifies:

- `ruleId`;
- `recipeId`;
- affected `ingredientId`;
- production-size applicability range expressed in recipe servings;
- optional method/equipment context labels;
- correction model;
- rationale;
- provenance / supporting observation ids;
- review status;
- reviewer metadata when approved.

A rule must not silently apply to another recipe, even if ingredient names or recipe names are similar.

### Correction models

V1 supports explicit ingredient correction models rather than one universal multiplier:

- `factor`: effective amount = proportional baseline × approved factor;
- `cap`: effective amount cannot exceed an approved amount;
- `floor`: effective amount cannot fall below an approved amount;
- `anchor`: at the defined production size, use an explicit approved amount.

Rules must use the same unit as the affected scaled ingredient in v1. No implicit unit conversion.

A later slice may add piecewise curves/interpolation across multiple approved anchors. V1 may store anchor observations but does not invent interpolation between them.

## Applicability

A rule is applicable only when all required conditions match:

- exact `recipeId`;
- exact `ingredientId`;
- production servings inside the inclusive approved range;
- required method/equipment context, if present;
- `reviewStatus === approved`.

Candidate, rejected, superseded or otherwise non-approved rules are never applied automatically.

If multiple approved rules target the same ingredient and production context and their precedence is not unambiguous, nonlinear scaling fails closed for that ingredient and surfaces a rule conflict. It does not average corrections.

## Effective recipe result

The nonlinear scaling evaluator returns:

- proportional baseline recipe;
- effective recipe;
- applied rule ids;
- per-ingredient adjustment trace with baseline and effective amount;
- unapplied candidate ids that may be relevant for review;
- deterministic issues/warnings.

Ingredients without an applicable approved rule remain exactly at their proportional baseline amount.

Purchasing consumers must use the effective recipe quantities.

## Event-only recipe adjustment

An operator may deliberately change an ingredient ratio for one event without teaching a reusable rule.

This is classified as `event_only_recipe_adjustment` and records:

- event/component/recipe;
- production servings;
- ingredient;
- proportional baseline amount;
- previous effective amount if applicable;
- operator-selected amount;
- unit;
- rationale;
- operator/timestamp when persisted.

It affects only the current event recipe and downstream purchasing after confirmation. It does not create a reusable rule unless the operator separately classifies the observation as an Experience Rule Candidate.

## Production observation

A structured production observation captures what happened in the kitchen. It contains at minimum:

- `observationId`;
- event/component identifiers;
- exact recipe id and recipe version/schema reference when available;
- production servings / target scale;
- affected ingredient id;
- proportional baseline amount and unit;
- planned effective amount and unit;
- actual corrected/used amount and unit;
- method/equipment context labels when relevant;
- operator rationale / observation text;
- outcome assessment when available (`successful | mixed | unsuccessful | not_assessed`);
- operator identity and timestamp when persisted.

Amounts must be finite and positive. Units must match in v1.

## Experience Rule Candidate

Any one valid production observation may create an Experience Rule Candidate.

No minimum observation count is required.

A candidate contains:

- candidate id;
- exact recipe scope;
- ingredient scope;
- proposed servings applicability range;
- proposed correction model;
- supporting observation ids;
- rationale;
- evidence summary;
- review status `candidate`;
- creator metadata when persisted.

The proposed range/model must be explicit. The system must not infer an unlimited range from one production.

Candidates may be displayed to kitchen reviewers but cannot change production quantities automatically.

## Human approval

Approval is an explicit privileged action. Approval creates an approved recipe-specific production-scaling rule from a candidate.

There is **no automatic approval** and **no fixed minimum number of observations**.

A reviewer may approve a rule supported by one observation when professional judgment considers it sufficiently clear. The resulting rule still exposes that it has only one supporting observation.

Approval records:

- reviewer identity;
- approval timestamp;
- approved applicability range;
- approved correction model;
- rationale;
- supporting observation ids at approval time.

The approval action may narrow or modify the candidate's proposed range/model, but that modification must be explicit in the approval record.

## Evidence strength

Evidence strength does not grant authority. It is descriptive support for human judgment.

V1 exposes transparent evidence facts rather than a pseudo-scientific confidence percentage:

- total matching observations;
- confirming observations;
- contradicting observations;
- successful/mixed/unsuccessful/not-assessed outcome counts;
- minimum and maximum observed production servings;
- coverage of the approved/proposed applicability range;
- context matches for required method/equipment labels.

A simple display classification may be derived deterministically as `low | medium | high`, but the underlying counts and coverage remain visible and authoritative for explanation.

The classification must never change `reviewStatus` automatically.

### Suggested v1 classification

- `low`: fewer than 2 confirming observations, or any material contradiction not yet reviewed;
- `medium`: at least 2 confirming observations with no unresolved material contradiction and some production-size coverage;
- `high`: at least 4 confirming observations, no unresolved material contradiction, and observations cover both the lower and upper half of the approved/proposed servings range.

This classification is presentation metadata only and may be revised later without changing rule authority.

## Contradicting observations

A later observation may contradict an approved rule.

The system must preserve the observation and surface it for review. It must not silently delete, rewrite or automatically revoke the rule.

A material contradiction causes evidence strength to reflect the contradiction and creates a review-needed signal. A human reviewer may then:

- keep the rule unchanged;
- narrow its applicability range;
- change its correction model;
- supersede it with a new rule;
- revoke it.

Historical rule versions and supporting observations remain traceable.

## Rule lifecycle

V1 review states:

- `candidate` — proposed from one or more observations; never auto-applied;
- `approved` — human-approved and eligible for automatic application within scope;
- `rejected` — candidate explicitly rejected;
- `superseded` — replaced by a newer approved rule;
- `revoked` — previously approved but no longer eligible for automatic application.

Only `approved` rules are production-active.

## Recipe-specific first, family generalization later

An Experience Rule is always recipe-specific when first created and approved.

Example:

`recipe-sauce-rahm-v3 / cream / 100–150 servings / factor 0.90`

The system must not automatically generalize this to `Rahmsaucen`, `helle Saucen`, another recipe version, or another ingredient.

A later explicit `generalize_to_recipe_family` workflow may create a separate family-level candidate from multiple recipe-specific observations/rules. That future workflow requires human approval and is out of scope for v1.

## Interaction with quantity override lineage

The previous quantity-override slice establishes a new event quantity authority and proportional recipe baseline.

Nonlinear scaling is applied **after** that baseline is established:

1. user confirms quantity override;
2. Quantity Decision and Quantity→Recipe bridge resolve the new recipe scale;
3. proportional baseline is generated;
4. approved nonlinear rules are evaluated for that recipe/servings/context;
5. effective event recipe is generated;
6. purchasing is regenerated from effective ingredient quantities.

Changing an event quantity can therefore cause a different nonlinear rule to become applicable. The applied-rule trace must be regenerated with the event recipe.

## Audit and provenance

Every effective nonlinear change is traceable to:

`event quantity authority → proportional baseline → approved rule → supporting observations → effective ingredient quantity → purchasing quantity`.

No hidden nonlinear multiplier is allowed.

## Fail-closed behavior

Do not apply a nonlinear correction when:

- recipe binding differs;
- ingredient binding is missing or ambiguous;
- production servings are outside rule range;
- required context does not match;
- units differ;
- rule is not approved;
- two approved rules conflict without deterministic precedence;
- numeric correction data is invalid.

In these cases preserve the proportional baseline for unaffected ingredients and surface deterministic issues. For a direct conflict on one ingredient, that ingredient must not receive an invented effective correction.

## AI boundary

AI is optional and not required for v1.

Later AI may:

- detect repeated correction patterns;
- propose candidate applicability ranges;
- suggest candidate correction models;
- summarize supporting and contradicting observations;
- identify potential recipe-family generalization candidates.

AI may not:

- fabricate production observations;
- classify an unobserved correction as proven fact;
- approve, revoke or supersede a rule;
- silently widen applicability;
- transfer a recipe-specific rule to another recipe/family;
- suppress contradicting evidence.

## Compatibility and slice boundary

- Existing proportional `scaleRecipe()` remains unchanged.
- Existing Quantity Recommendation remains unchanged.
- Existing Quantity Override / Bidirectional Recalculation remains the source of event quantity authority and proportional baseline.
- Existing Quantity→Recipe Bridge and ProductionBatch gates remain authoritative.
- V1 is shared-core domain logic; no persistence migration.
- No provider/LLM call.
- No UI redesign.
- No deployment or release.
- Recipe-family generalization and automatic process-parameter changes are follow-on slices.

## Acceptance cases

1. With no approved nonlinear rule, effective recipe equals proportional baseline.
2. An approved recipe-specific factor rule changes only its target ingredient within its servings range.
3. Cap and floor rules apply deterministically in matching units.
4. An anchor rule applies only at its explicitly supported production size in v1.
5. Candidate/rejected/superseded/revoked rules never auto-apply.
6. A rule never applies to another recipe id.
7. A rule outside its servings range never applies.
8. Required equipment/method context mismatch prevents application.
9. Conflicting approved rules for one ingredient fail closed rather than averaging.
10. Effective purchasing quantities come from the effective recipe.
11. One valid production observation can create an Experience Rule Candidate.
12. Candidate creation never creates an approved rule.
13. Human approval may approve a candidate supported by one observation; approval remains explicit and records the evidence count.
14. Evidence strength facts expose confirming and contradicting observations separately.
15. Evidence-strength classification never changes approval status.
16. A contradicting later observation creates a review-needed signal without silently revoking an approved rule.
17. Event-only recipe adjustment changes only the event recipe and does not create a reusable rule by itself.
18. Approved rules retain supporting observation provenance.
19. Original proportional baseline remains visible beside effective values.
20. Quantity override followed by nonlinear scaling regenerates effective recipe and purchasing from the new event scale.
21. No safety/yield/procurement multiplier is introduced by nonlinear scaling unless represented by an explicit approved rule in a future compatible contract.
22. Existing quantity recommendation, override, bridge and production-batch behavior remains unchanged.