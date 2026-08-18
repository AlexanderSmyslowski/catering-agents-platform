# Production Quantity Workflow v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose quantity recommendation, preview-first bidirectional quantity overrides, confirmation, and effective nonlinear recipe/purchasing quantities through the real production-service and backoffice production workflow.

**Architecture:** Keep all authoritative math in `@catering/shared-core`. Add a thin production-service projection/command layer that binds current production artifacts to the existing domain contracts, then add typed backoffice API calls and focused production-plan/purchase-list UI components. Confirmation is fingerprint-bound and operator-authenticated; existing QuantityDecision and RecipeEventUse review gates remain authoritative.

**Tech Stack:** TypeScript, Fastify, React, Vitest, existing `@catering/shared-core`, existing production-service repository/audit/auth patterns.

## Global Constraints

- Recommendation must never invent a number when compatible professional evidence is absent.
- Preview must be side-effect free.
- Confirmation must bind to the exact preview/source revision and fail closed when stale.
- Purchase-row edits must rescale the complete recipe lineage rather than patch one row.
- Non-proportional ingredient-ratio changes are not quantity overrides.
- Approved nonlinear rules may affect effective quantities only through the existing shared-core recalculation path.
- Candidate nonlinear rules never affect authoritative quantities.
- Existing QuantityDecision, RecipeEventUse, Quantity→Recipe, and ProductionBatch gates remain authoritative.
- Mutation routes require existing production-operator authorization and audit conventions.
- No broad UI redesign, provider/LLM change, or automatic deployment in this implementation slice.

---

## File structure

- `production-service/src/quantity-workflow/service.ts` — focused server-side projection/preview/confirm orchestration; only product binding, no duplicated scaling math.
- `production-service/src/routes/quantity-workflow-routes.ts` — Fastify read/preview/confirm routes and operator authorization.
- `production-service/src/server.ts` — register quantity workflow routes with existing dependencies.
- `backoffice-ui/src/api.ts` — typed quantity workflow DTOs and HTTP functions.
- `backoffice-ui/src/production-quantity-workflow-panel.tsx` — production-plan quantity cards and preview/confirm interaction.
- `backoffice-ui/src/production-purchase-list-panel.tsx` — expose editable uniquely traced purchase rows and invoke the same preview/confirm interaction.
- `backoffice-ui/src/production-route-main-layout.tsx` plus state/boundary files — pass workflow state/actions into the existing production layout.
- focused tests under `tests/` for server routes, projections, stale preview behavior, UI cards and purchase editing.

### Task 1: Server quantity workflow projection and preview contract

**Files:**
- Create: `production-service/src/quantity-workflow/service.ts`
- Create: `tests/production-quantity-workflow-service.test.ts`

**Interfaces:**
- Consumes: existing `recommendQuantity()`, `previewQuantityOverride()`, `recalculateQuantityLineage()` types/contracts and current ProductionPlan/PurchaseList/Recipe artifacts.
- Produces: `buildQuantityWorkflowProjection(input)`, `previewProductionQuantityOverride(input)` and DTO types used by routes/UI.

- [ ] **Step 1: Write failing projection tests**

Cover: valid recommendation exposes recommended value + corridor; evidence-insufficient projection contains no invented amount; current authority is distinct from recommendation; purchase rows expose `editable` only when lineage is unique.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/production-quantity-workflow-service.test.ts`
Expected: FAIL because `production-service/src/quantity-workflow/service.ts` does not exist.

- [ ] **Step 3: Implement minimal projection service**

Use shared-core results directly. Define product DTOs with `componentId`, `status`, `recommendedAmount`, `professionalRange`, `targetTotal`, `currentAuthority`, `proportionalBaseline`, `effectiveAmount`, `appliedRuleIds`, `canEdit`, and purchase-row lineage metadata. Do not duplicate recommendation/scaling formulas.

- [ ] **Step 4: Add failing preview tests**

Cover target-output preview and purchase-ingredient preview. Assert side-effect-free result includes before/after recipe and purchase quantities, scale factor where applicable, nonlinear trace, warnings and `confirmable`.

- [ ] **Step 5: Implement minimal preview orchestration**

Call `previewQuantityOverride()` and, where a reviewed recalculation context is supplied, existing `recalculateQuantityLineage()` only for derived preview projections; do not persist or mutate stores.

- [ ] **Step 6: Run focused tests GREEN and commit**

Run: `npm test -- --run tests/production-quantity-workflow-service.test.ts`
Expected: PASS.
Commit: `feat: add production quantity workflow projection`

### Task 2: Fingerprint-bound confirmation and routes

**Files:**
- Modify: `production-service/src/quantity-workflow/service.ts`
- Create: `production-service/src/routes/quantity-workflow-routes.ts`
- Modify: `production-service/src/server.ts`
- Create: `tests/production-quantity-workflow-routes.test.ts`

**Interfaces:**
- Consumes: Task 1 projection/preview service plus existing production store, operator auth and audit log dependencies.
- Produces: authenticated GET projection, POST preview and POST confirm route contracts.

- [ ] **Step 1: Write failing route tests**

Cover unauthorized mutation rejection, projection read, preview success without mutation audit, confirm requiring preview fingerprint, stale source revision rejection, and confirmed mutation audit evidence.

- [ ] **Step 2: Run focused route tests RED**

Run: `npm test -- --run tests/production-quantity-workflow-routes.test.ts`
Expected: FAIL because routes are not registered.

- [ ] **Step 3: Implement stable preview fingerprint**

Fingerprint canonical input including business/case/component/edit origin/source revision/current value/requested value and relevant recipe/purchase identity. Confirmation recomputes/validates it before calling `confirmQuantityOverride()` and `recalculateQuantityLineage()`.

- [ ] **Step 4: Implement routes using existing auth/audit patterns**

Register under the existing production API namespace. Read may follow existing production read authorization; preview/confirm require production operator. Confirm returns `review_required` when existing domain gates do not permit authoritative recalculation rather than bypassing them.

- [ ] **Step 5: Register routes in server and run tests GREEN**

Run: `npm test -- --run tests/production-quantity-workflow-routes.test.ts`
Expected: PASS.
Commit: `feat: expose production quantity workflow routes`

### Task 3: Typed backoffice API client

**Files:**
- Modify: `backoffice-ui/src/api.ts`
- Create: `tests/backoffice-production-quantity-api.test.ts`

**Interfaces:**
- Consumes: Task 2 route DTOs.
- Produces: `fetchProductionQuantityWorkflow`, `previewProductionQuantityOverride`, `confirmProductionQuantityOverride` plus UI-facing TypeScript types.

- [ ] **Step 1: Write failing API-client tests**

Assert route paths, actor headers for mutations, request bodies, response parsing, and no browser-side recalculation.

- [ ] **Step 2: Run focused tests RED**

Run: `npm test -- --run tests/backoffice-production-quantity-api.test.ts`
Expected: FAIL on missing exports.

- [ ] **Step 3: Implement typed API functions**

Follow existing `api.ts` fetch helpers and actor-name conventions. Keep all scale factors and derived values server-provided.

- [ ] **Step 4: Run focused tests GREEN and commit**

Run: `npm test -- --run tests/backoffice-production-quantity-api.test.ts`
Expected: PASS.
Commit: `feat: add backoffice quantity workflow api`

### Task 4: Production-plan quantity cards

**Files:**
- Create: `backoffice-ui/src/production-quantity-workflow-panel.tsx`
- Create: `backoffice-ui/src/production-quantity-workflow-state.ts`
- Modify: `backoffice-ui/src/production-route-main-layout.tsx`
- Modify: `backoffice-ui/src/production-route-main-layout-state.ts`
- Modify: `backoffice-ui/src/app-production-route-state.ts`
- Modify: `backoffice-ui/src/app-production-route-app-boundary.ts`
- Create: `tests/production-quantity-workflow-panel.test.tsx`

**Interfaces:**
- Consumes: Task 3 DTOs/API functions and existing production route state.
- Produces: quantity cards in the production-plan area with preview-first target editing.

- [ ] **Step 1: Write failing UI tests**

Cover visible recommended amount, corridor, no-number evidence-insufficient state, distinct current authority, nonlinear baseline/effective explanation, `Menge ändern`, preview details, and disabled confirmation when `confirmable=false`.

- [ ] **Step 2: Run focused UI tests RED**

Run: `npm test -- --run tests/production-quantity-workflow-panel.test.tsx`
Expected: FAIL because panel/state do not exist.

- [ ] **Step 3: Implement focused state builder and panel**

Use existing panel classes and German UI copy. Show one card per component. Editing sends a preview request; render returned recipe/purchase impacts; `Änderung übernehmen` calls confirm only after a confirmable preview.

- [ ] **Step 4: Thread state/actions through existing production route boundary**

Add only the required props/state; do not refactor unrelated production panels.

- [ ] **Step 5: Run focused UI tests GREEN and commit**

Run: `npm test -- --run tests/production-quantity-workflow-panel.test.tsx`
Expected: PASS.
Commit: `feat: show quantity workflow in production plan`

### Task 5: Editable purchase-list rows using the same preview flow

**Files:**
- Modify: `backoffice-ui/src/production-purchase-list-panel.tsx`
- Modify: `backoffice-ui/src/production-purchase-list-panel-state.ts`
- Modify: quantity workflow state/action files from Task 4
- Create: `tests/production-purchase-quantity-edit.test.tsx`

**Interfaces:**
- Consumes: Task 3 preview/confirm API and Task 4 shared quantity-workflow interaction state.
- Produces: edit controls only on uniquely traceable recipe-derived purchase rows.

- [ ] **Step 1: Write failing purchase-edit tests**

Cover editable row control, read-only ambiguous/fixed row explanation, `2.75 kg → 3.00 kg` preview showing complete recipe/purchase impact, no one-row patch, and explicit copy that a ratio-only change belongs to recipe correction.

- [ ] **Step 2: Run focused test RED**

Run: `npm test -- --run tests/production-purchase-quantity-edit.test.tsx`
Expected: FAIL because current panel only renders static preview rows.

- [ ] **Step 3: Implement purchase-row edit controls**

Reuse the same server preview/confirm actions. Never calculate recipe scale in the browser. Keep archived purchase lists read-only.

- [ ] **Step 4: Run focused tests GREEN and commit**

Run: `npm test -- --run tests/production-purchase-quantity-edit.test.tsx`
Expected: PASS.
Commit: `feat: edit recipe-derived purchase quantities`

### Task 6: Integration, regression and browser rehearsal

**Files:**
- Modify/create focused integration tests only as required by actual route wiring.
- Update: `docs/agent-memory/PRODUCTION_QUANTITY_WORKFLOW_V1_TDD.md`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: end-to-end verified product slice ready for merge/deployment decision.

- [ ] **Step 1: Add end-to-end contract test**

Exercise recommendation projection → target or purchase preview → explicit confirm → review-required or regenerated effective recipe/purchase projection. Assert candidate nonlinear rules never alter authoritative output.

- [ ] **Step 2: Run all new focused tests**

Run the five focused test files plus integration test. Expected: PASS.

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: all existing and new tests PASS with only repository-standard skips.

- [ ] **Step 4: Run repository build/static checks**

Run the repository's standard CI-equivalent build/check commands from `package.json`/CI workflow. Expected: PASS.

- [ ] **Step 5: Run browser rehearsal**

Use the existing browser-rehearsal workflow/smoke path. Verify production quantity card, target preview, purchase preview, confirm affordance, and no regression to existing production workspace.

- [ ] **Step 6: Record TDD evidence and commit**

Document RED/GREEN heads, focused tests, full-suite counts, CI run ids and browser rehearsal in `docs/agent-memory/PRODUCTION_QUANTITY_WORKFLOW_V1_TDD.md`.
Commit: `docs: record production quantity workflow verification`

- [ ] **Step 7: Final exact-head verification**

Run/observe CI on the documentation head. Require both `build-and-test` and `browser-rehearsal` SUCCESS before claiming completion or merging.
