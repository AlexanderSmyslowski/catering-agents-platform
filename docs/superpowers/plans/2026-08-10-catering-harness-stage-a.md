# Catering-Harness Stage A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first trustworthy product slice of the Catering-Harness: business-scoped data, canonical human approval, immutable offer-to-production handoff, persistent cases, two independent calm product shells, and a proven real-data BYO-AI corridor.

**Architecture:** Keep the existing monorepo, Fastify services, file/PostgreSQL persistence, React application, provider adapters, production planning, and print exports. Add explicit business-scoped ports and immutable approved artifacts at the current boundaries; do not add a runtime service or a second persistence system. `ApprovalRequestRecord` remains the sole approval truth, while review-card decisions remain mutable working state.

**Tech Stack:** TypeScript, Node.js, Fastify, React, Vite, Vitest, JSON Schema, existing file/PostgreSQL adapters, existing OpenAI and Codex CLI provider transports.

## Global Constraints

- Follow `docs/product/PFLICHTENHEFT_BYO_AI_CATERING_HARNESS.md`; this plan implements only Stage A.
- No new npm dependency, runtime service, ORM, or persistence system.
- `ApprovalRequestRecord` is the sole approval truth. Do not introduce a parallel `ApprovalDecision` record.
- AI output remains draft-only and cannot write approved product objects or reviewed knowledge.
- No raw prompt, provider response, customer document text, or secret in audit events or operational logs.
- `openai` and `codex_cli` both count as external processing because data leaves the installation.
- Local single-business operation binds one configured `businessId`; hosted operation rejects requests without a trusted business context.
- Hosted multi-business startup remains hard-disabled until Task 12 flips the code-owned readiness constant after the complete route/store isolation matrix passes. No environment flag may bypass this hold.
- Do not claim hosted multi-business readiness until every route exposed by that profile uses business-scoped storage.
- Existing local records remain readable through an explicit, idempotent migration; do not silently discard or globally expose them.
- Visible UI copy is clear German without gender forms, provider jargon, schema names, or technical IDs.
- Start screens are empty. Demo data never appears as a current real order.
- One product route loads only its own product data. The portal is navigation, not a combined dashboard.
- Original sources stay available after reload. The case record stores metadata and references, never document bytes or provider raw output.
- A blocked review item blocks only its dependent artifact; unrelated work may continue.
- No compatibility path remains without a named consumer and removal test.
- Do not touch `docs/agent-memory/` or `.impeccable/`.
- Each task is one reviewable `loop/stage-a-*` branch and Draft PR. Begin the next task only from the merged predecessor.
- Each task ends with focused tests, the complete `npm test`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, and its stated behavioral acceptance.

---

## Target File Structure

The following structure is locked for Stage A. Existing large route files are changed only where listed; new responsibilities live in focused files.

```text
shared-core/src/
  business-context.ts                 trusted business identity and storage scoping
  data-classification.ts              shared source and provider data classes
  approval-request.ts                 canonical approval record helpers
  case-contracts.ts                   OfferCase, ProductionCase, messages and summaries
  byo-llm-provider-data-policy.ts      external-processing runtime gate
  production-reference-quality.ts     deterministic reference-case assessment
  schemas/
    approval-request.ts
    case.ts
    approved-offer.ts
    production-handoff.ts
    approved-production-spec.ts

intake-service/src/
  source-document-store.ts            persistent source metadata and bytes
  routes/source-document-routes.ts    scoped source upload/read endpoints

offer-service/src/
  routes/case-routes.ts                OfferCase lifecycle/search/copy
  routes/approval-routes.ts            draft approval and immutable handoff

production-service/src/
  ports/production-handoff-reader.ts  product-boundary interface
  gateways/http-production-handoff-reader.ts
  routes/case-routes.ts                ProductionCase lifecycle/search/copy
  routes/approval-routes.ts            approved production snapshot and apply

backoffice-ui/src/
  home-portal-app.tsx
  offer-product-app.tsx
  production-product-app.tsx
  use-offer-workspace-data.ts
  use-production-workspace-data.ts
  case-history-state.ts
  case-history-panel.tsx
  case-workspace-state.ts
  case-workspace.tsx
  case-document-pane.tsx
  case-conversation-pane.tsx
  case-next-action.ts
  case-next-action-bar.tsx

tests/fixtures/production-reference-cases/
  koepff-flying-buffet-45p.expected.json
```

## Canonical Contracts

These signatures are defined once and reused by every later task.

```ts
export type BusinessId = string;

export interface BusinessContext {
  businessId: BusinessId;
}

export type ApprovalTargetKind = "offer_draft" | "production_draft";

export interface ApprovalRequestRecord {
  schemaVersion: "1.0";
  approvalRequestId: string;
  businessId: BusinessId;
  target: {
    kind: ApprovalTargetKind;
    artifactId: string;
    revision: number;
  };
  decision: "approved" | "rejected";
  selectedVariantId?: string;
  requestedAt: string;
  decidedAt: string;
  decidedBy: {
    name: string;
    role: MinimalMvpRole;
    source: TrustedActor["source"];
  };
  comment?: string;
}

export interface ApprovedOffer {
  schemaVersion: "1.0";
  businessId: BusinessId;
  approvedOfferId: string;
  sourceDraft: { draftId: string; revision: number };
  selectedVariantId: string;
  approvalRequestId: string;
  approvedAt: string;
  eventSummary: string;
  customerFacingText: string;
  serviceModules: ServiceModule[];
  pricingSummary: PricingSummary;
  selectedVariant: OfferVariant;
}

export interface ProductionHandoff {
  schemaVersion: "1.0";
  businessId: BusinessId;
  handoffId: string;
  approvedOfferId: string;
  approvalRequestId: string;
  createdAt: string;
  eventSpecSnapshot: AcceptedEventSpec;
  pricingSnapshot: PricingSummary;
  source: {
    draftId: string;
    revision: number;
    selectedVariantId: string;
  };
}

export interface ApprovedProductionSpec {
  schemaVersion: "1.0";
  businessId: BusinessId;
  approvedProductionSpecId: string;
  sourceDraft: { draftId: string; revision: number };
  approvalRequestId: string;
  approvedAt: string;
  artifacts: ProductionDraftArtifacts;
}
```

`ApprovedOffer`, `ProductionHandoff`, and `ApprovedProductionSpec` are insert-only. There is no update route for them. A correction creates a new draft revision and a new approval record.

---

### Task 1: Business Context And Scoped Persistence

**Branch:** `loop/stage-a-business-context`

**Files:**
- Create: `shared-core/src/business-context.ts`
- Create: `tests/business-scoped-persistence.test.ts`
- Modify: `shared-core/src/access-control.ts:10-25`
- Modify: `shared-core/src/persistence.ts:11-281`
- Modify: `shared-core/src/audit-log.ts:34-70`
- Modify: `shared-core/src/types.ts:32-44`
- Modify: `shared-core/src/index.ts`
- Create: `scripts/migrate-local-business-scope.ts`
- Create: `tests/local-business-scope-migration.test.ts`
- Modify: `package.json`
- Modify: `scripts/start-local-stack.sh`
- Modify: `intake-service/src/app.ts`
- Modify: `intake-service/src/routes/document-routes.ts`
- Modify: `intake-service/src/routes/work-item-routes.ts`
- Modify: `offer-service/src/app.ts`
- Modify: `offer-service/src/routes/draft-routes.ts`
- Modify: `production-service/src/app.ts`
- Modify: `production-service/src/routes/artifact-routes.ts`
- Modify: `production-service/src/routes/recipe-routes.ts`
- Modify: `tests/access-control.test.ts`
- Modify: `tests/p4-audit-traceability.test.ts`
- Modify: audit-log callers in `tests/byo-llm-runtime-clarification-drafts.test.ts`, `tests/codex-cli-byo-provider.test.ts`, `tests/intake-shadow-mode.test.ts`, `tests/intake-soft-archive.test.ts`, `tests/production-draft-apply.test.ts`, `tests/production-draft-document-byo.test.ts`, `tests/production-draft-import.test.ts`, `tests/production-draft-review-state.test.ts`, and `tests/production-feedback-knowledge.test.ts`

**Interfaces:**
- Consumes: existing `CollectionStorageOptions`, `PersistentCollection<T>`, `TrustedActor`, and `AuditLogStore`.
- Produces: `BusinessContext`, `BusinessScopedPersistentCollection<T>`, `createBusinessScopedPersistentCollection<T>()`, trusted actor resolution with a server-owned `businessId`, and the versioned local migration runner used before any existing store is switched.

- [ ] **Step 1: Write the failing isolation and actor tests**

```ts
it.each(["file", "postgres"] as const)("isolates equal record ids in %s storage", async (mode) => {
  const collection = createScopedTestCollection(mode);
  await collection.insert({ businessId: "alpha" }, { id: "same", value: "A" });
  await collection.insert({ businessId: "beta" }, { id: "same", value: "B" });

  await expect(collection.get({ businessId: "alpha" }, "same")).resolves.toMatchObject({ value: "A" });
  await expect(collection.get({ businessId: "beta" }, "same")).resolves.toMatchObject({ value: "B" });
});

it("rejects a hosted request without a trusted business header", () => {
  expect(() => trustedActorFromHeaders({}, {
    fallbackActorName: "Operator",
    fallbackBusinessId: "local",
    requireTrustedBusinessId: true,
    trustedActorSecret: "secret"
  })).toThrow("Vertrauenswürdiger Betriebskontext erforderlich");
});
```

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```bash
npx vitest run tests/access-control.test.ts tests/business-scoped-persistence.test.ts tests/p4-audit-traceability.test.ts
```

Expected: FAIL because the scoped collection and actor business context do not exist.

- [ ] **Step 3: Implement the business context and scoped collection**

```ts
export interface BusinessScopedPersistentCollection<T> {
  list(context: BusinessContext): Promise<T[]>;
  get(context: BusinessContext, id: string): Promise<T | undefined>;
  set(context: BusinessContext, item: T): Promise<void>;
  insert(context: BusinessContext, item: T): Promise<"created" | "exists">;
  compareAndSet(context: BusinessContext, id: string, expectedVersion: number, item: T): Promise<"updated" | "conflict" | "missing">;
}

export function createBusinessScopedPersistentCollection<T>(
  options: PersistentCollectionOptions<T>
): BusinessScopedPersistentCollection<T>;
```

For file storage, resolve only beneath `<root>/businesses/<safeBusinessId>/<collectionName>`. `insert` uses exclusive creation rather than read-then-write; compare-and-set uses the single local service owner's guarded write path. For PostgreSQL, create and use `catering_business_records` with primary key `(business_id, collection_name, record_id)`; `insert` uses `ON CONFLICT DO NOTHING` and compare-and-set uses one conditional `UPDATE`. Key schema initialization by both pool and table name so `catering_records`, `catering_business_records` and later source tables never share the wrong cached initializer. Validate `businessId` against `/^[a-z0-9][a-z0-9_-]{1,63}$/`; never interpolate an unchecked value into a path or SQL identifier. A scoped write rejects any canonical payload whose embedded `businessId` differs from the trusted context.

Extend trusted actors exactly as follows:

```ts
export interface TrustedActor {
  name: string;
  businessId: BusinessId;
  source: TrustedActorSource;
  trusted: boolean;
}

export interface TrustedActorOptions {
  fallbackActorName: string;
  fallbackBusinessId: string;
  requireTrustedBusinessId?: boolean;
  trustedActorSecret?: string;
  allowDevActorHeader?: boolean;
}
```

Read `x-catering-business-id` only when the trusted proxy secret is valid. Local mode uses `fallbackBusinessId`; hosted mode throws before route work if the trusted business header is absent.

Add a code-owned `hostedMultiBusinessReady = false` readiness constant. A hosted profile fails startup while it is false, even with valid proxy headers. Task 12 changes it only after all current stores, routes, exports and audits pass the isolation matrix. Unit tests exercise trusted-header resolution without claiming the hosted application is ready.

- [ ] **Step 4: Add the versioned migration runner before switching a store**

Add:

```json
{
  "migrate:business-scope": "tsx scripts/migrate-local-business-scope.ts"
}
```

The script requires `--business-id`. It runs named, versioned migration units and records each completed unit in a non-sensitive manifest. The first unit, `stage-a-001-audit`, copies legacy `audit/events` records into the scoped collection. Each unit compares source and target counts plus canonical JSON hashes before marking itself complete. It never deletes legacy data. A second run reports `already_migrated` for that unit and creates no duplicate.

`local:start` invokes the runner with `CATERING_DEFAULT_BUSINESS_ID` before scoped services start. Hosted startup never guesses a business ID and never runs this local migration.

- [ ] **Step 5: Scope audit writes and reads**

Add `businessId` to `AuditEntry`. Add `AuditLogStore.logFor(context, input)`, `listRecentFor(context, limit)` and `countFor(context)` backed by the scoped collection. Update every product call site listed above to use these methods with the trusted actor context; do not derive it from request bodies. Local health counts use the configured local context. Hosted unauthenticated health endpoints report process readiness only and expose no cross-business totals. Once focused and full tests are green, use `rg` to prove there is no caller and remove the old unscoped `log(input)`, `listRecent(limit)` and `count()` methods in this same slice.

- [ ] **Step 6: Run focused and full validation**

```bash
npx vitest run tests/access-control.test.ts tests/business-scoped-persistence.test.ts tests/local-business-scope-migration.test.ts tests/p4-audit-traceability.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Expected: both storage modes isolate identical IDs; hosted requests without trusted business context fail before storage access; audit events are visible only within their business; `stage-a-001-audit` is idempotent and preserves the legacy source.

- [ ] **Step 7: Commit and open the Draft PR**

```bash
git add shared-core/src intake-service/src offer-service/src production-service/src scripts/migrate-local-business-scope.ts scripts/start-local-stack.sh package.json tests
git commit -m "feat: add business-scoped persistence boundary"
gh pr create --draft --base main --head loop/stage-a-business-context --title "Add Stage A business context" --body-file /tmp/stage-a-business-context-pr.md
```

---

### Task 2: Canonical Approval Request Contract

**Branch:** `loop/stage-a-approval-contract`

**Files:**
- Create: `shared-core/src/approval-request.ts`
- Create: `shared-core/src/schemas/approval-request.ts`
- Create: `tests/approval-request-contract.test.ts`
- Modify: `shared-core/src/schemas/index.ts`
- Modify: `shared-core/src/validation.ts`
- Modify: `shared-core/src/types.ts`
- Modify: `shared-core/src/index.ts`

**Interfaces:**
- Consumes: `BusinessId`, `MinimalMvpRole`, `TrustedActor`, existing JSON-schema validation helpers.
- Produces: `ApprovalRequestRecord`, `validateApprovalRequestRecord(value)`, `createApprovalRequestRecord(input)`.

- [ ] **Step 1: Write the contract tests**

```ts
it.each(["approved", "rejected"] as const)("accepts a server-authored %s decision", (decision) => {
  expect(validateApprovalRequestRecord(validApproval({ decision }))).toMatchObject({ decision });
});

it.each([
  ["businessId", ""],
  ["target.revision", 0],
  ["decidedBy.name", ""],
  ["decidedAt", "not-a-date"]
])("rejects invalid %s", (path, value) => {
  expect(() => validateApprovalRequestRecord(withPath(validApproval(), path, value))).toThrow();
});

it("does not accept review-card working states as approval", () => {
  expect(() => validateApprovalRequestRecord(validApproval({ decision: "fits" }))).toThrow();
});

it("uses one target key for competing final decisions", () => {
  expect(approvalRequestIdForTarget(approvalFor("approved"))).toBe(
    approvalRequestIdForTarget(approvalFor("rejected"))
  );
});
```

- [ ] **Step 2: Run the focused test and verify red**

```bash
npx vitest run tests/approval-request-contract.test.ts
```

Expected: FAIL because the canonical contract is not implemented.

- [ ] **Step 3: Implement schema, validation and server factory**

Use the exact `ApprovalRequestRecord` signature from this plan. `createApprovalRequestRecord()` accepts a trusted actor, target, decision, optional selected variant and comment; it creates timestamps server-side. It never accepts `businessId`, `decidedAt`, `decidedBy`, or role from client JSON.

`approvalRequestIdForTarget()` is deterministic from `businessId`, target kind, artifact ID and revision, but not from the requested decision. Therefore approve and reject compete for the same insert-only key. The first final decision wins; an identical retry is idempotent and a different retry returns `409`. File and PostgreSQL stores use the exclusive insert behavior from Task 1, never read-then-set.

```ts
export function createApprovalRequestRecord(input: {
  actor: TrustedActor;
  role: MinimalMvpRole;
  target: ApprovalRequestRecord["target"];
  decision: ApprovalRequestRecord["decision"];
  selectedVariantId?: string;
  comment?: string;
  now?: Date;
}): ApprovalRequestRecord;

export function approvalRequestIdForTarget(input: {
  businessId: BusinessId;
  target: ApprovalRequestRecord["target"];
}): string;
```

- [ ] **Step 4: Validate and commit**

```bash
npx vitest run tests/approval-request-contract.test.ts tests/production-draft-contract.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
git add shared-core/src tests/approval-request-contract.test.ts
git commit -m "feat: define canonical approval request contract"
```

Expected: approve and reject are valid final records; review working states are rejected; no second approval record type exists.

---

### Task 3: Approved Offer And Immutable Production Handoff

**Branch:** `loop/stage-a-approved-offer-handoff`

**Files:**
- Create: `shared-core/src/schemas/approved-offer.ts`
- Create: `shared-core/src/schemas/production-handoff.ts`
- Create: `offer-service/src/routes/approval-routes.ts`
- Create: `production-service/src/ports/production-handoff-reader.ts`
- Create: `production-service/src/gateways/http-production-handoff-reader.ts`
- Create: `backoffice-ui/src/offer-approval-action.ts`
- Create: `tests/offer-approval-request.test.ts`
- Create: `tests/offer-production-handoff.test.ts`
- Create: `tests/offer-approval-action.test.ts`
- Create: `tests/production-handoff-port.test.ts`
- Modify: `shared-core/src/types.ts:252-311`
- Modify: `shared-core/src/rules/offer.ts`
- Modify: `shared-core/src/schemas/offer-draft.ts`
- Modify: `shared-core/src/schemas/index.ts`
- Modify: `shared-core/src/validation.ts`
- Modify: `shared-core/src/index.ts`
- Modify: `offer-service/src/store.ts`
- Modify: `offer-service/src/routes/draft-routes.ts:19-179`
- Modify: `offer-service/src/app.ts`
- Modify: `shared-core/src/access-control.ts`
- Modify: `shared-core/src/data-safety-audit-gates.ts`
- Modify: `backoffice-ui/src/api.ts`
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/app-offer-route-app-boundary.ts`
- Modify: `backoffice-ui/src/app-offer-route-state.ts`
- Modify: `backoffice-ui/src/offer-workbench.tsx`
- Modify: `backoffice-ui/src/offer-workbench-state.ts`
- Modify: `production-service/src/app.ts`
- Modify: `production-service/src/routes/artifact-routes.ts`
- Modify: `platform-infra/docker-compose.yml`
- Modify: `print-export/src/index.ts`
- Modify: `scripts/migrate-local-business-scope.ts`
- Modify: `tests/local-business-scope-migration.test.ts`
- Modify: `tests/offer-gold-run.test.ts`
- Modify: `tests/mutating-route-auth-matrix.test.ts`
- Modify: `tests/data-safety-audit-gates.test.ts`
- Modify: `tests/app-offer-route-app-boundary.test.ts`
- Modify: `tests/app-offer-route-state.test.ts`
- Modify: `tests/offer-workbench-state.test.ts`
- Modify: `tests/backoffice-route-smoke.test.ts`
- Delete after replacement tests pass: `backoffice-ui/src/offer-draft-promote-action.ts`

**Interfaces:**
- Consumes: `BusinessContext`, `ApprovalRequestRecord`, `OfferDraft`, `OfferVariant`, scoped collections.
- Produces: `ApprovedOffer`, immutable `ProductionHandoff`, approval and handoff routes, scoped offer/export reads, and an immediately usable explicit approval UI. Removes the `IntakeStore` dependency from offer draft routes.

- [ ] **Step 1: Write failing approval behavior tests**

```ts
it("creates an approved offer only after explicit variant approval", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/v1/offers/drafts/${draft.draftId}/decision`,
    headers: trustedOfferHeaders,
    payload: { decision: "approved", variantId: "balanced", decidedBy: "spoofed" }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().approval.decidedBy.name).toBe("Angebots-Mitarbeiter");
  expect(response.json().approvedOffer.selectedVariantId).toBe("balanced");
  expect(await intakeStore.listSpecs()).toHaveLength(0);
});

it.each(["rejected", "missing-variant", "other-business"])("does not create an approved offer for %s", async (kind) => {
  const result = await runOfferApprovalCase(kind);
  expect(result.approvedOffers).toHaveLength(0);
});

it("stores exactly one decision during concurrent approve and reject", async () => {
  const responses = await Promise.all([approveDraft(), rejectDraft()]);
  expect(responses.map((item) => item.statusCode).sort()).toEqual([201, 409]);
  expect(await store.listApprovalsForTarget(context, target)).toHaveLength(1);
});

it("resumes idempotently after approval was stored before the approved offer", async () => {
  injectFailureAfter("approval_insert");
  await expect(approveDraft()).rejects.toThrow();
  clearInjectedFailure();
  expect((await approveDraft()).statusCode).toBe(201);
  expect(await store.listApprovalsForTarget(context, target)).toHaveLength(1);
  expect(await store.listApprovedOffers(context)).toHaveLength(1);
});
```

- [ ] **Step 2: Run the new tests and verify red**

```bash
npx vitest run tests/offer-approval-request.test.ts tests/offer-production-handoff.test.ts
```

Expected: FAIL because the routes and immutable artifacts do not exist.

- [ ] **Step 3: Move handoff creation out of draft construction**

Add required `businessId` and `revision` to `OfferDraft`; initial drafts use revision `1`. Remove `productionHandoff` from `OfferDraft` and remove the pre-review handoff builder from `shared-core/src/rules/offer.ts`. Update the gold-run expectation so a new draft has no handoff.

- [ ] **Step 4: Add scoped insert-only offer collections**

```ts
class OfferStore {
  saveDraft(context: BusinessContext, draft: OfferDraft): Promise<void>;
  getDraft(context: BusinessContext, draftId: string): Promise<OfferDraft | undefined>;
  listDrafts(context: BusinessContext): Promise<OfferDraft[]>;
  insertApproval(context: BusinessContext, record: ApprovalRequestRecord): Promise<"created" | "exists">;
  insertApprovedOffer(context: BusinessContext, offer: ApprovedOffer): Promise<"created" | "exists">;
  getApprovedOffer(context: BusinessContext, id: string): Promise<ApprovedOffer | undefined>;
  listApprovedOffers(context: BusinessContext): Promise<ApprovedOffer[]>;
  insertHandoff(context: BusinessContext, handoff: ProductionHandoff): Promise<"created" | "exists">;
  getHandoff(context: BusinessContext, id: string): Promise<ProductionHandoff | undefined>;
}
```

Before switching `OfferStore`, add migration unit `stage-a-002-offers`. It copies legacy `offers/drafts`, adds the configured `businessId`, sets a missing initial `revision` to `1`, and removes the old embedded `productionHandoff` from the scoped copy. The manifest records the stripped handoff hash and `legacyHandoffDiscarded: true`; it never turns that unapproved payload into an approved artifact. Validate every transformed draft and compare source/target counts plus hashes. Update `print-export` offer reads to pass the trusted business context in the same commit.

- [ ] **Step 5: Implement approval and handoff routes**

```text
POST /v1/offers/drafts/:draftId/decision
  body: { decision: "approved" | "rejected", variantId?: string, comment?: string }
  approved -> { approval, approvedOffer }
  rejected -> { approval }

POST /v1/offers/approved/:approvedOfferId/handoffs
  body: {}
  response: { handoff }

GET /v1/offers/handoffs/:handoffId
```

Approval requires an existing explicit variant, records the trusted server actor, and rejects a competing second decision with `409`. Approval, approved-offer and handoff IDs are deterministic. If a file write or process stops after the approval insert, an identical retry resumes creation of the missing approved offer; it never creates another decision. Handoff creation is idempotent for the same approved offer and returns `409` if an existing deterministic ID has different content. Snapshot the selected variant's event spec and pricing; never look up the mutable draft when reading the handoff.

- [ ] **Step 6: Migrate the UI and remove direct promotion writes in the same slice**

Delete the `IntakeStore` dependency from `OfferDraftRouteDependencies`. Replace `promoteOfferDraft()` with `decideOfferDraft()` and `createProductionHandoff()` in `backoffice-ui/src/offer-approval-action.ts`. The selected variant is first explicitly approved; only the subsequent, separately visible action creates the handoff. Show the returned approval and handoff state immediately.

After the new action tests pass, delete `backoffice-ui/src/offer-draft-promote-action.ts` and remove `/v1/offers/drafts/:draftId/promote` plus its access-control template. The old URL returns `404`, not a compatibility response. No intermediate commit or merge may leave the visible UI calling the removed route, and no AcceptedEventSpec is written by the offer service.

In the same slice, production receives `POST /v1/production/drafts/from-handoff/:handoffId`. It loads the immutable handoff through `ProductionHandoffReader`, never from browser JSON, and creates the existing draft/spec working state for that snapshot. Runtime uses `CATERING_OFFER_SERVICE_URL`, trusted service secret and server-owned business header; Compose supplies only the internal service URL. The offer UI's handoff result links to this production entry, so the existing Offer-to-Production capability is never absent between merged tasks.

Update access-control paths, mutation inventory and data-safety route inventory in this slice. No new or removed mutating route may wait for Task 12 governance updates.

- [ ] **Step 7: Run focused and full validation**

```bash
npx vitest run tests/offer-approval-request.test.ts tests/offer-production-handoff.test.ts tests/offer-approval-action.test.ts tests/production-handoff-port.test.ts tests/local-business-scope-migration.test.ts tests/offer-gold-run.test.ts tests/mutating-route-auth-matrix.test.ts tests/data-safety-audit-gates.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Expected: rejected or unreviewed drafts never produce an approved offer or handoff; spoofed provenance is ignored; snapshots remain unchanged if a source draft object is later changed.

- [ ] **Step 8: Commit**

```bash
git add shared-core/src offer-service/src backoffice-ui/src print-export/src scripts/migrate-local-business-scope.ts tests
git commit -m "feat: add approved offer handoff boundary"
```

---

### Task 4: Approved Production Specification And Apply Boundary

**Branch:** `loop/stage-a-approved-production-spec`

**Files:**
- Create: `shared-core/src/schemas/approved-production-spec.ts`
- Create: `shared-core/src/production-apply-manifest.ts`
- Create: `production-service/src/routes/approval-routes.ts`
- Create: `tests/approved-production-spec.test.ts`
- Modify: `shared-core/src/types.ts:313-361,535-564`
- Modify: `shared-core/src/schemas/production-draft.ts`
- Modify: `shared-core/src/schemas/index.ts`
- Modify: `shared-core/src/validation.ts`
- Modify: `shared-core/src/index.ts`
- Modify: `shared-core/src/data-safety-audit-gates.ts`
- Modify: `production-service/src/repositories/production-store.ts:301-425`
- Modify: `shared-core/src/recipe-library.ts`
- Modify: `production-service/src/routes/artifact-routes.ts:1157-1543`
- Modify: `production-service/src/routes/recipe-routes.ts`
- Modify: `production-service/src/recipe-discovery/service.ts`
- Modify: `production-service/src/recipe-discovery/web-recipe-candidate-resolution.ts`
- Modify: `production-service/src/repositories/in-memory-recipe-repository.ts`
- Modify: `production-service/src/app.ts`
- Modify: `offer-service/src/app.ts`
- Modify: `print-export/src/index.ts`
- Modify: `scripts/migrate-local-business-scope.ts`
- Modify: `scripts/import-catering-recipes.ts`
- Modify: `scripts/import-koepff-recipes.ts`
- Modify: `tests/local-business-scope-migration.test.ts`
- Modify: `backoffice-ui/src/api.ts:427-480`
- Modify: `backoffice-ui/src/production-draft-review-panel.tsx`
- Modify: `tests/production-draft-review-state.test.ts`
- Modify: `tests/production-draft-apply.test.ts`
- Modify: `tests/production-draft-e2e-chain.test.ts`
- Modify: `tests/recipe-review-access.test.ts`
- Modify: `tests/recipe-discovery-service.test.ts`
- Modify: `tests/internal-recipe-candidate-resolution.test.ts`
- Modify: `tests/koepff-recipe-import-command.test.ts`
- Modify: `tests/production-folder-export.test.ts`
- Modify: `tests/data-safety-audit-gates.test.ts`
- Modify: `tests/mutating-route-auth-matrix.test.ts`

**Interfaces:**
- Consumes: `ApprovalRequestRecord`, `ProductionDraft`, `ProductionDraftArtifacts`, business-scoped `ProductionStore`.
- Produces: `ApprovedProductionSpec`, apply-from-approved-snapshot route, and business-scoped production artifacts plus the current private recipe library.

- [ ] **Step 1: Write the failing approved snapshot tests**

```ts
it.each(["rejected", "superseded"] as const)(
  "does not create ApprovedProductionSpec from %s",
  async (status) => {
    const response = await decideProductionDraft(status, "approved");
    expect(response.statusCode).toBe(409);
    expect(await store.listApprovedProductionSpecs(context)).toHaveLength(0);
  }
);

it("resumes an identical approved decision when its snapshot write was interrupted", async () => {
  const first = await interruptAfterApprovalRecord();
  expect(first.approval.decision).toBe("approved");
  expect((await retrySameApprovedDecision()).statusCode).toBe(201);
  expect(await store.listApprovedProductionSpecs(context)).toHaveLength(1);
});

it("rejects a competing decision for an already decided target", async () => {
  await approveFullyReviewedDraft();
  expect((await decideSameRevision("rejected")).statusCode).toBe(409);
});

it("returns 422 when a pending draft still has open required cards", async () => {
  expect((await approveDraftWithOpenCards()).statusCode).toBe(422);
});

it("creates one approved snapshot from a fully reviewed pending draft", async () => {
  expect((await approveFullyReviewedDraft()).statusCode).toBe(201);
});

it("applies only the immutable approved snapshot", async () => {
  const approved = await approveReviewedDraft();
  await overwriteSourceDraftForTest(approved.sourceDraft.draftId);
  const response = await applyApprovedSpec(approved.approvedProductionSpecId);
  expect(response.json().plan.eventSpecId).toBe(approved.artifacts.eventSpec?.specId);
});
```

- [ ] **Step 2: Run and verify red**

```bash
npx vitest run tests/approved-production-spec.test.ts tests/production-draft-apply.test.ts
```

Expected: FAIL because the approved snapshot does not exist and apply still reads a mutable draft.

- [ ] **Step 3: Add revision and approval references**

Give initial `ProductionDraft` revision `1`; `POST /revise` uses parent revision plus one. Replace inline approval authority with `approvalRequestId?: string`. Keep `approvedBy` and `approvedAt` for one compatibility cycle as a projection from the approval record; tests must prove they are not accepted as authorization.

- [ ] **Step 4: Add scoped approval and approved-spec collections**

```ts
insertApproval(context: BusinessContext, record: ApprovalRequestRecord): Promise<"created" | "exists">;
insertApprovedProductionSpec(context: BusinessContext, value: ApprovedProductionSpec): Promise<"created" | "exists">;
getApprovedProductionSpec(context: BusinessContext, id: string): Promise<ApprovedProductionSpec | undefined>;
listApprovedProductionSpecs(context: BusinessContext): Promise<ApprovedProductionSpec[]>;
```

Convert every existing `ProductionStore` collection and the current `RecipeLibrary` collection to take `BusinessContext`. Existing `ProductionPlan`, `PurchaseList`, `Recipe`, clarification and feedback payload schemas stay unchanged; their business ownership lives in the required scoped storage key/envelope. `ProductionDraft` and every new canonical Stage A contract carry `businessId` directly. Update all RecipeLibrary callers in offer, production, print-export, `scripts/import-catering-recipes.ts`, `scripts/import-koepff-recipes.ts` and their affected tests. In Stage A, every existing recipe is private business knowledge; the globally curated recipe area is introduced only in Stage B. Hosted scoped libraries never auto-seed `internalRecipes`; explicit local demo commands seed only their configured business.

Add migration unit `stage-a-003-production` before switching the stores. It copies and validates legacy plans, purchase lists, clarification answers/drafts, production drafts, feedback drafts and recipes and gives missing draft revisions the value `1`. A legacy `approved` or `applied` draft is copied as `pending_review` with `legacyApprovalState: "unverified"`; the manifest preserves its former status and hash, but no ApprovalRequestRecord is invented. Such a draft requires a new human review. Update `print-export` reads to use the trusted business context in this same slice.

- [ ] **Step 5: Make the complete production snapshot reviewable before approval**

Add `POST /v1/production/drafts/:draftId/prepare`. It runs the existing deterministic planning, recipe selection, scaling and purchasing logic without writing product stores, then creates a new draft revision whose `draftArtifacts` contain the complete event spec, plan, purchase list and recipe snapshots. If any required artifact cannot be produced, it adds a focused review card or open question rather than silently omitting it. Approval rejects an incomplete snapshot with `422`.

- [ ] **Step 6: Implement canonical decision and resumable apply routes**

```text
POST /v1/production/drafts/:draftId/decision
  body: { decision: "approved" | "rejected", comment?: string }
  approved -> { approval, approvedProductionSpec }
  rejected -> { approval }

POST /v1/production/approved-specs/:approvedProductionSpecId/apply
  body: {}
  response: { eventSpec, plan, purchaseList, recipes }
```

Approval requires every required review card to be `fits`. A card with `riskLevel: "blocking"` blocks only while its decision is `pending`, `change_requested`, `unclear` or `blocked`; once a human has confirmed it as `fits`, its risk classification remains visible but is no longer a permanent veto. The decision route creates no plan, recipe or purchase list. Apply reads only `ApprovedProductionSpec.artifacts`.

Stage A keeps the final `ApprovedProductionSpec` atomic: one unresolved required card prevents final approval and complete folder application. This does not freeze the working process. Preparation, correction and review of unrelated dishes continue, and the UI marks only the dependent artifact as blocked. Partial production release is deliberately outside Stage A and must not be implied by card-level progress.

Approval uses the deterministic target key from Task 2. An identical retry completes a missing `ApprovedProductionSpec` after an interrupted write; a competing decision returns `409`. Apply uses an insert-only `ProductionApplyManifest` keyed by approved-spec ID. Artifact IDs are deterministic, every write is compare-or-insert, and a retry resumes the first incomplete step. PostgreSQL may wrap the steps in one transaction, but the manifest remains the common behavior for file mode. Inject a failure after each spec/plan/list/recipe write and prove one retry produces exactly one complete result with no conflicting partial state.

- [ ] **Step 7: Update the UI API and review panel**

Rename the API action from `approveProductionDraft(draftId, boolean)` to `decideProductionDraft(draftId, decision, comment?)`. Store the returned `approvedProductionSpecId`; the next action calls `applyApprovedProductionSpec(id)`. Do not infer approval from `approvedBy` or a review-card count.

After the replacement flow tests pass, remove `/v1/production/drafts/:draftId/apply` and its access-control template in this same slice. The old URL returns `404`. No intermediate commit or merge may leave the visible UI calling the removed route.

Update access-control paths, mutation inventory and data-safety route inventory in this same slice.

- [ ] **Step 8: Validate and commit**

```bash
npx vitest run tests/approved-production-spec.test.ts tests/production-draft-review-state.test.ts tests/production-draft-apply.test.ts tests/production-draft-e2e-chain.test.ts tests/local-business-scope-migration.test.ts tests/recipe-review-access.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
git add shared-core/src production-service/src print-export/src backoffice-ui/src/api.ts backoffice-ui/src/production-draft-review-panel.tsx scripts/migrate-local-business-scope.ts tests
git commit -m "feat: apply approved production snapshots"
```

Expected: decision is draft-only; only a valid approval record creates an immutable approved snapshot; only that snapshot can materialize product objects.

---

### Task 5: Persistent Cases And Original Sources

**Branch:** `loop/stage-a-cases-and-sources`

**Files:**
- Create: `shared-core/src/data-classification.ts`
- Create: `shared-core/src/case-contracts.ts`
- Create: `shared-core/src/schemas/case.ts`
- Create: `intake-service/src/source-document-store.ts`
- Create: `intake-service/src/routes/source-document-routes.ts`
- Create: `tests/case-contracts.test.ts`
- Create: `tests/offer-case-store.test.ts`
- Create: `tests/production-case-store.test.ts`
- Create: `tests/source-document-store.test.ts`
- Create: `tests/source-document-routes.test.ts`
- Create: `tests/case-event-concurrency.test.ts`
- Modify: `shared-core/src/schemas/index.ts`
- Modify: `shared-core/src/validation.ts`
- Modify: `shared-core/src/index.ts`
- Modify: `intake-service/src/store.ts`
- Modify: `offer-service/src/store.ts`
- Modify: `production-service/src/repositories/production-store.ts`
- Modify: `intake-service/src/app.ts`
- Modify: `intake-service/src/routes/document-routes.ts`
- Modify: `intake-service/src/routes/work-item-routes.ts`
- Modify: `print-export/src/index.ts`
- Modify: `scripts/migrate-local-business-scope.ts`
- Modify: `tests/local-business-scope-migration.test.ts`

**Interfaces:**
- Consumes: `BusinessContext`, scoped persistence, existing document parsing and upload limits.
- Produces: the shared `ByoLlmDataClass`, stable `OfferCase`, `ProductionCase`, summaries, append-only case history, business-scoped intake records, and reload-safe source documents.

- [ ] **Step 1: Write case contract and chronology tests**

```ts
it("appends messages and revisions without overwriting history", async () => {
  await Promise.all([
    store.appendEvent(context, caseId, userInstruction("Bitte Dessert entfernen")),
    store.appendEvent(context, caseId, revisionCreated(2))
  ]);
  expect((await store.listEvents(context, caseId)).map((item) => item.kind)).toEqual([
    "case_created", "instruction", "revision_created"
  ]);
});

it("copies a case without copying prior approvals", () => {
  const copy = copyCaseForNewEvent(validApprovedOfferCase(), { caseId: "offer-case-copy", now: fixedNow });
  expect(copy.copiedFromCaseId).toBe("offer-case-original");
  expect(copy.approvedOfferId).toBeUndefined();
  expect(copy.initialEvents.map((item) => item.kind)).toEqual(["case_copied"]);
});
```

- [ ] **Step 2: Define data classes once, then define the case contracts**

Create the source/provider-neutral classification in `shared-core/src/data-classification.ts` so cases, stored files and provider policy share one type:

```ts
export type ByoLlmDataClass =
  | "synthetic_demo"
  | "anonymized"
  | "pseudonymized"
  | "private_business"
  | "personal_confidential";
```

```ts
export type CaseStatus = "open" | "completed" | "archived";
export type CaseProduct = "offer" | "production";

export interface CaseSourceRef {
  sourceId: string;
  documentId?: string;
  requestId?: string;
  filename?: string;
  mimeType?: string;
  sha256?: string;
  dataClass: ByoLlmDataClass;
  addedAt: string;
}

export interface CaseEvent {
  businessId: BusinessId;
  eventId: string;
  caseId: string;
  at: string;
  role: "user" | "assistant" | "system";
  kind:
    | "case_created"
    | "case_copied"
    | "source_added"
    | "instruction"
    | "draft_created"
    | "review_decision"
    | "revision_created"
    | "approval"
    | "result"
    | "legacy_unverified"
    | "error";
  text: string;
  sourceId?: string;
  artifactId?: string;
}

export interface CaseRevisionRef {
  artifactType: "OfferDraft" | "ProductionDraft";
  artifactId: string;
  revision: number;
  createdAt: string;
  supersedesArtifactId?: string;
}

export interface CaseBase {
  schemaVersion: "1.0";
  businessId: BusinessId;
  caseId: string;
  displayName: string;
  status: CaseStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  copiedFromCaseId?: string;
}

export interface OfferCase extends CaseBase {
  product: "offer";
  approvedOfferId?: string;
  productionHandoffId?: string;
}

export interface ProductionCase extends CaseBase {
  product: "production";
  productionHandoffId?: string;
  approvedProductionSpecId?: string;
  currentPlanId?: string;
  currentPurchaseListId?: string;
}
```

Provider prompts and raw responses are forbidden in `CaseEvent`. Human instructions and concise product results are allowed because the case is the business-owned working record. Sources, messages and revision history are derived from append-only events; they are not mutable arrays inside the case row.

- [ ] **Step 3: Run case tests and verify red**

```bash
npx vitest run tests/case-contracts.test.ts tests/offer-case-store.test.ts tests/production-case-store.test.ts
```

Expected: FAIL until validators, helpers and scoped store collections exist.

- [ ] **Step 4: Implement insert, append, search and copy helpers**

Add scoped `OfferCase`, `ProductionCase` and append-only `CaseEvent` collections to their existing stores. Case metadata updates use the atomic compare-and-set primitive with `version`; a stale version returns `409`. Event appends use server-authored unique IDs and exclusive insert, so simultaneous messages or artifact events cannot overwrite each other. Search lowercases and Unicode-normalizes `displayName`, customer, event type and source filename only after the business-scoped list is loaded.

Generate display names with this deterministic fallback order:

```ts
formatCaseDisplayName({ customerName, eventTypeLabel, eventDate, attendeeCount })
// "CommCats - Empfang - 14.06.2026 - 45 Personen"
// Missing values are omitted; an entirely empty result becomes "Neuer Auftrag - 14.06.2026".
```

Convert `IntakeStore` to business-scoped requests, specs and shadow runs before any new case may reference them. These legacy payload schemas stay unchanged; their business ownership is enforced by scoped storage. Add migration unit `stage-a-004-intake`, which copies and validates the three legacy intake collections and creates deterministic `OfferCase`/`ProductionCase` records for existing offer and production drafts. Old approvals are not inherited; legacy result references are retained as `legacy_unverified` case events. Update intake routes, local health counts and `print-export` spec reads to pass trusted context in the same slice; hosted health remains count-free.

- [ ] **Step 5: Write persistent source tests**

```ts
it.each(["file", "postgres"] as const)("persists source bytes in %s mode", async (mode) => {
  await store.insert(context, metadata, Buffer.from("pdf-bytes"));
  await expect(store.getContent(context, metadata.documentId)).resolves.toEqual(Buffer.from("pdf-bytes"));
});

it("does not return another business source", async () => {
  await store.insert(alpha, metadata, Buffer.from("secret"));
  await expect(store.getContent(beta, metadata.documentId)).resolves.toBeUndefined();
});
```

- [ ] **Step 6: Implement source storage and routes**

```ts
export interface StoredSourceDocument {
  businessId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  dataClass: ByoLlmDataClass;
  createdAt: string;
}

export interface SourceDocumentStore {
  insert(context: BusinessContext, metadata: StoredSourceDocument, content: Uint8Array): Promise<"created" | "same_content">;
  getMetadata(context: BusinessContext, documentId: string): Promise<StoredSourceDocument | undefined>;
  getContent(context: BusinessContext, documentId: string): Promise<Uint8Array | undefined>;
}
```

File mode writes bytes beneath the business root and metadata through a scoped collection. PostgreSQL mode uses a separately initialized `catering_source_documents` table with `(business_id, document_id)` primary key and `bytea` content. The server creates an unpredictable document ID; a repeated ID with the same SHA-256 is idempotent and different content returns `409`. Existing multipart and JSON document routes persist original bytes before extraction. Keep the existing 25 MB limit and MIME checks.

```text
POST /v1/intake/source-documents
GET  /v1/intake/source-documents/:documentId
GET  /v1/intake/source-documents/:documentId/content
```

Every direct upload is classified conservatively server-side as `personal_confidential`; seeded synthetic sources are `synthetic_demo`. A separate validated minimization or pseudonymization result may create a lower-class derived source while retaining a reference to the original. The client cannot lower the class.

- [ ] **Step 7: Validate and commit**

```bash
npx vitest run tests/case-contracts.test.ts tests/offer-case-store.test.ts tests/production-case-store.test.ts tests/case-event-concurrency.test.ts tests/source-document-store.test.ts tests/source-document-routes.test.ts tests/local-business-scope-migration.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
git add shared-core/src intake-service/src offer-service/src/store.ts production-service/src/repositories/production-store.ts print-export/src scripts/migrate-local-business-scope.ts tests
git commit -m "feat: persist business cases and source documents"
```

Expected: cases and source bytes survive reload, copies do not inherit approval, and equal IDs remain isolated between businesses.

---

### Task 6: Case Routes And Explicit Product Ports

**Branch:** `loop/stage-a-case-routes-ports`

**Files:**
- Create: `offer-service/src/routes/case-routes.ts`
- Create: `production-service/src/routes/case-routes.ts`
- Modify: `production-service/src/ports/production-handoff-reader.ts`
- Modify: `production-service/src/gateways/http-production-handoff-reader.ts`
- Create: `production-service/src/ports/source-document-reader.ts`
- Create: `production-service/src/gateways/http-source-document-reader.ts`
- Create: `production-service/src/ports/intake-records-port.ts`
- Create: `production-service/src/gateways/http-intake-records-port.ts`
- Create: `tests/offer-case-routes.test.ts`
- Create: `tests/production-case-routes.test.ts`
- Create: `tests/intake-records-port.test.ts`
- Create: `tests/case-message-routes.test.ts`
- Modify: `offer-service/src/app.ts`
- Modify: `offer-service/src/routes/draft-routes.ts`
- Modify: `production-service/src/app.ts`
- Modify: `production-service/src/routes/artifact-routes.ts`
- Modify: `backoffice-ui/src/api.ts`
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/offer-workbench.tsx`
- Modify: `backoffice-ui/src/production-input-panel.tsx`
- Modify: `backoffice-ui/src/production-document-submit-action.ts`
- Modify: `platform-infra/docker-compose.yml`
- Modify: `platform-infra/Caddyfile`
- Modify: `shared-core/src/access-control.ts`
- Modify: `shared-core/src/data-safety-audit-gates.ts`
- Modify: `tests/mutating-route-auth-matrix.test.ts`
- Modify: `tests/data-safety-audit-gates.test.ts`
- Modify: `tests/production-input-panel-transition.test.tsx`
- Modify: `tests/production-draft-document-byo.test.ts`

**Interfaces:**
- Consumes: cases, persistent source documents, `ProductionHandoff`, existing draft routes.
- Produces: product-owned case APIs and reader ports; production no longer imports offer-store or intake-store implementations.

- [ ] **Step 1: Write route and port tests**

```ts
it("lists only cases for the trusted business and supports search", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/offers/cases?search=empfang", headers: alphaHeaders });
  expect(response.json().items.map((item: CaseSummary) => item.caseId)).toEqual(["offer-alpha"]);
});

it("creates a production case from an immutable handoff read through the port", async () => {
  const reader: ProductionHandoffReader = { get: vi.fn(async () => approvedHandoff) };
  const response = await createProductionCaseFromHandoff(reader);
  expect(response.statusCode).toBe(201);
  expect(reader.get).toHaveBeenCalledWith(alphaContext, approvedHandoff.handoffId);
});
```

- [ ] **Step 2: Run and verify red**

```bash
npx vitest run tests/offer-case-routes.test.ts tests/production-case-routes.test.ts tests/production-handoff-port.test.ts
```

- [ ] **Step 3: Implement case APIs**

```text
GET  /v1/offers/cases?search=
POST /v1/offers/cases
GET  /v1/offers/cases/:caseId
POST /v1/offers/cases/:caseId/copies
POST /v1/offers/cases/:caseId/messages

GET  /v1/production/cases?search=
POST /v1/production/cases
GET  /v1/production/cases/:caseId
POST /v1/production/cases/:caseId/copies
POST /v1/production/cases/from-handoff/:handoffId
POST /v1/production/cases/:caseId/messages
```

New draft calls require `caseId`. Message bodies contain `{text, sourceId?}` only; the server authors IDs, actor and time and appends one `instruction` event. Initial draft creation appends one `draft_created` event with a revision reference. Existing review, revision, approval, handoff, apply and error routes append their event only after the owning write succeeds. A continuation remains in the same case; a copy starts a new case with no inherited approval.

- [ ] **Step 4: Implement explicit reader ports**

```ts
export interface ProductionHandoffReader {
  get(context: BusinessContext, handoffId: string): Promise<ProductionHandoff | undefined>;
}

export interface SourceDocumentReader {
  getMetadata(context: BusinessContext, documentId: string): Promise<StoredSourceDocument | undefined>;
  getContent(context: BusinessContext, documentId: string): Promise<Uint8Array | undefined>;
}

export interface IntakeRecordsPort {
  getRequest(context: BusinessContext, requestId: string): Promise<EventRequest | undefined>;
  getSpec(context: BusinessContext, specId: string): Promise<AcceptedEventSpec | undefined>;
  insertSpec(context: BusinessContext, spec: AcceptedEventSpec): Promise<"created" | "same_content">;
}
```

Production tests inject in-memory ports. Runtime uses HTTP gateways configured with `CATERING_OFFER_SERVICE_URL` and `CATERING_INTAKE_SERVICE_URL`; forward a service identity, trusted service secret and server-owned business ID. Compose and Caddy define those internal paths without exposing the secret to the browser. Remove direct `IntakeStore` imports from `production-service`. Production never trusts a handoff, request or spec supplied by the browser.

- [ ] **Step 5: Change from-document ingestion to stable references**

The canonical body becomes:

```ts
interface ProductionDraftDocumentBody {
  caseId: string;
  documentId: string;
}
```

Migrate the visible UI in this same task: it first uploads the original file to `POST /v1/intake/source-documents`, receives `documentId`, creates or uses the active `ProductionCase`, then calls the canonical body above. The route loads bytes via `SourceDocumentReader`, parses them, and appends the result to the case. After the UI flow test passes, remove inline Base64 and direct multipart production-draft ingestion; no merged commit leaves the upload button calling an obsolete body.

Offer text/file draft creation follows the same case rule. If the user starts from the empty offer screen, the UI creates the case first and sends its ID with the draft request.

Update access-control paths, mutation inventory and data-safety route inventory in this slice.

- [ ] **Step 6: Validate and commit**

```bash
npx vitest run tests/offer-case-routes.test.ts tests/production-case-routes.test.ts tests/intake-records-port.test.ts tests/case-message-routes.test.ts tests/mutating-route-auth-matrix.test.ts tests/data-safety-audit-gates.test.ts tests/production-draft-document-byo.test.ts tests/production-input-panel-transition.test.tsx
npm test
npx tsc --noEmit
npm run build
git diff --check
git add offer-service/src production-service/src backoffice-ui/src platform-infra shared-core/src/access-control.ts shared-core/src/data-safety-audit-gates.ts tests
git commit -m "feat: add product case APIs and handoff ports"
```

Expected: each product owns its cases; production reads offer handoffs and source documents only through explicit ports; the browser cannot inject a canonical snapshot.

---

### Task 7: Runtime Gate For Real Business Data

**Branch:** `loop/stage-a-provider-data-gate`

**Files:**
- Create: `shared-core/src/byo-llm-provider-data-policy.ts`
- Create: `tests/byo-llm-provider-data-policy.test.ts`
- Create: `tests/byo-llm-raw-transport-boundary.test.ts`
- Modify: `shared-core/src/byo-llm-boundary.ts`
- Modify: `shared-core/src/llm-readiness-provider-adapter.ts`
- Modify: `shared-core/src/byo-llm-runtime.ts`
- Modify: `shared-core/src/index.ts`
- Modify: `intake-service/src/app.ts`
- Modify: `production-service/src/app.ts`
- Modify: `production-service/src/routes/artifact-routes.ts`
- Modify: `scripts/run-offer-package-batch-pilot.ts`
- Modify: `tests/byo-llm-boundary.test.ts`
- Modify: `tests/production-draft-document-byo.test.ts`
- Modify: `tests/codex-cli-byo-provider.test.ts`
- Modify: `tests/intake-shadow-mode.test.ts`
- Modify: `tests/offer-package-batch-pilot.test.ts`

**Interfaces:**
- Consumes: `BusinessContext`, the shared `ByoLlmDataClass` from Task 5, source metadata, and the existing boundary-guarded provider adapter.
- Produces: a server-owned gate that permits or rejects every external provider call before fetch or subprocess execution.

- [ ] **Step 1: Write the policy matrix tests**

```ts
it.each(["openai", "codex_cli"] as const)("blocks %s for private data without approval", async (providerKind) => {
  for (const dataClass of ["private_business", "personal_confidential"] as const) {
    const delegate = vi.fn();
    const result = await runGuarded({ providerKind, dataClass, approval: undefined, delegate });
    expect(result.ok).toBe(false);
    expect(delegate).not.toHaveBeenCalled();
  }
});

it.each([
  "wrong-business",
  "wrong-purpose",
  "wrong-region",
  "wrong-model",
  "missing-capability",
  "over-budget",
  "expired",
  "training-allowed"
])("blocks %s approval", async (kind) => {
  expect(evaluateCase(kind)).toMatchObject({ allowed: false });
});

it("allows exactly one matching external call", async () => {
  const delegate = vi.fn(async () => validAdapterResponse());
  await runGuarded({ providerKind: "codex_cli", dataClass: "private_business", approval: validApproval(), delegate });
  expect(delegate).toHaveBeenCalledTimes(1);
});

it.each(["openai", "codex_cli"] as const)("cannot label %s as local processing", (providerKind) => {
  expect(() => createProviderDescriptor({ providerKind, dataLeavesInstallation: false })).toThrow();
});
```

- [ ] **Step 2: Define the policy contracts**

```ts
export type ByoLlmProcessingPurpose =
  | "production_draft_extraction"
  | "production_draft_revision"
  | "clarification_draft"
  | "intake_shadow_extraction"
  | "offer_package_classification";

export type ByoLlmProviderCapability =
  | "structured_output"
  | "document_understanding"
  | "text_generation";

export interface ByoLlmExternalProcessingApproval {
  approvalId: string;
  businessId: string;
  providerKind: Exclude<ByoLlmProviderKind, "fixture">;
  allowedDataClasses: readonly ByoLlmDataClass[];
  allowedPurposes: readonly ByoLlmProcessingPurpose[];
  allowedModels: readonly string[];
  allowedCapabilities: readonly ByoLlmProviderCapability[];
  allowedRegions: readonly string[];
  maxCostEurPerCall: number;
  retentionPolicy: string;
  trainingUse: "contractually_excluded";
  legalBasisReference: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
}

export interface ByoLlmProviderDescriptor {
  providerKind: ByoLlmProviderKind;
  dataLeavesInstallation: boolean;
  providerModel: string;
  capability: ByoLlmProviderCapability;
  actualRegion: string;
  maximumEstimatedCostEur: number;
}

export interface ByoLlmProviderDataContext {
  businessId: string;
  dataClass: ByoLlmDataClass;
  purpose: ByoLlmProcessingPurpose;
}
```

Import `ByoLlmDataClass` from `shared-core/src/data-classification.ts`; do not redefine provider-specific data classes.

- [ ] **Step 3: Run and verify red**

```bash
npx vitest run tests/byo-llm-provider-data-policy.test.ts tests/byo-llm-boundary.test.ts
```

- [ ] **Step 4: Implement the pre-transport gate**

```ts
export function evaluateByoLlmProviderDataGate(input: {
  provider: ByoLlmProviderDescriptor;
  context: ByoLlmProviderDataContext;
  approval?: ByoLlmExternalProcessingApproval;
  now?: Date;
}): { allowed: boolean; errors: string[]; approvalId?: string };
```

`fixture` has `dataLeavesInstallation: false`; `openai` and `codex_cli` have `true`. A future local adapter may use `false` only if no data leaves the installation. Compare the actual configured model, capability, processing region and conservative per-call cost estimate with the approval. Missing or unknown runtime metadata fails closed.

Enforce the policy at the use-case boundary, not only in an adapter factory. Product applications receive only a `BoundaryGuardedLlmAdapter`; its `execute(request, dataContext)` method resolves the approval server-side and evaluates the gate immediately before its private delegate call. The full approval record and data context are never forwarded in `LlmReadinessProviderAdapterRequest` to provider code. Dependency injection may supply a raw delegate plus a server-owned descriptor, but `intake-service` and `production-service` must always wrap them before routes are registered; injected adapters cannot bypass the guard.

Raw OpenAI/Codex CLI transport constructors remain importable only from their explicit transport modules for focused tests. Remove them from the public `shared-core` application surface and add an architecture test that rejects raw-transport imports from `intake-service`, `offer-service`, `production-service` and ordinary batch scripts. The synthetic-live probe is explicitly test/evaluation-only, accepts only `synthetic_demo`, and is covered by the same import boundary; it is not a product runtime exception.

- [ ] **Step 5: Load the business approval server-side**

Local single-business mode reads a validated JSON record from `CATERING_LLM_PROCESSING_APPROVAL_FILE`; the file is outside the repo and contains no API secret. The guarded adapter owns approval lookup. Production routes derive `businessId`, `dataClass`, and `purpose` from trusted context, case and stored source metadata. Provider model, capability, actual region and maximum estimated cost come from server-owned runtime configuration. Intake shadow mode derives source fields from its stored request/source record. The batch command takes business, data-class and purpose from its server-side run configuration and approval file, never from each input document. Ignore matching fields in client JSON.

Before an external call, create the smallest purpose-specific projection and remove contact data that the task does not require. Preserve the original source locally and link the derived projection by hash. A direct `personal_confidential` source may leave the installation only when that exact data class and purpose are explicitly approved and minimization cannot satisfy the task; it is never silently relabelled as `private_business` or `pseudonymized`.

Continue accepting the legacy technical data modes through this explicit mapping only:

```ts
const legacyDataModeMap = {
  synthetic_or_demo_only: "synthetic_demo",
  pseudonymized_approved: "pseudonymized"
} as const;
```

Do not treat `pseudonymized_approved` as provider consent.

- [ ] **Step 6: Add audit metadata without raw text**

Audit records contain `businessId`, approval ID, provider kind, model ID, capability, actual region, conservative maximum cost, purpose, data class, input hash, output hash and success/error class. They never contain source text, prompt context, raw response or authorization-file contents. Tests assert that denied OpenAI, Codex CLI and app-injected delegates are invoked zero times; a fully matching approval invokes exactly once. Descriptor construction rejects `openai` or `codex_cli` with `dataLeavesInstallation: false`.

- [ ] **Step 7: Validate and commit**

```bash
npx vitest run tests/byo-llm-provider-data-policy.test.ts tests/byo-llm-raw-transport-boundary.test.ts tests/byo-llm-boundary.test.ts tests/production-draft-document-byo.test.ts tests/codex-cli-byo-provider.test.ts tests/intake-shadow-mode.test.ts tests/offer-package-batch-pilot.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
git add shared-core/src intake-service/src production-service/src scripts/run-offer-package-batch-pilot.ts tests
git commit -m "feat: gate external AI processing by business policy"
```

Expected: no external call can run without a matching business, provider, model, capability, region, budget, data class and purpose approval; injected raw adapters cannot bypass the use-case gate; subscription billing does not bypass data governance.

---

### Task 8: Independent Product Loaders And Shells

**Branch:** `loop/stage-a-product-shells`

**Files:**
- Create: `backoffice-ui/src/home-portal-app.tsx`
- Create: `backoffice-ui/src/offer-product-app.tsx`
- Create: `backoffice-ui/src/production-product-app.tsx`
- Create: `backoffice-ui/src/use-offer-workspace-data.ts`
- Create: `backoffice-ui/src/use-production-workspace-data.ts`
- Create: `tests/product-shell-data-boundary.test.tsx`
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/api.ts:189-225`
- Modify: `backoffice-ui/src/main.tsx`
- Modify: `backoffice-ui/src/app-route-content.tsx`
- Modify: `package.json`
- Modify: `scripts/start-local-stack.sh`
- Modify: `scripts/start-fresh-local-stack.sh`
- Modify: `tests/app-offer-route-app-boundary.test.ts`
- Modify: `tests/app-production-route-app-boundary.test.ts`
- Modify: `tests/local-ops-check-contract.test.ts`

**Interfaces:**
- Consumes: case summary APIs and existing typed product endpoints.
- Produces: independently loaded portal, offer and production applications within the current Vite build.

- [ ] **Step 1: Write fetch-boundary tests**

```ts
it("loads no production endpoint on /angebot", async () => {
  window.history.replaceState({}, "", "/angebot");
  const root = createRoot(container);
  await act(async () => root.render(<App />));
  expect(container.textContent).toContain("Angebotsassistent");
  expect(fetchUrls()).not.toContainEqual(expect.stringContaining("/api/production/"));
});

it("loads no offer endpoint on /produktion", async () => {
  window.history.replaceState({}, "", "/produktion");
  const root = createRoot(container);
  await act(async () => root.render(<App />));
  expect(container.textContent).toContain("Produktionsassistent");
  expect(fetchUrls()).not.toContainEqual(expect.stringContaining("/api/offers/"));
});
```

Use the repository's existing `// @vitest-environment jsdom`, React `createRoot`/`act`, native-value setter and DOM-event pattern. Do not add Testing Library.

- [ ] **Step 2: Run and verify red**

```bash
npx vitest run tests/product-shell-data-boundary.test.tsx tests/app-offer-route-app-boundary.test.ts tests/app-production-route-app-boundary.test.ts
```

Expected: FAIL because `loadDashboardState()` fetches all product domains.

- [ ] **Step 3: Add typed product loaders**

```ts
export interface OfferWorkspaceState {
  cases: CaseSummary[];
  activeCase?: OfferCase;
  activeEvents: CaseEvent[];
  activeSources: CaseSourceRef[];
  currentDraft?: OfferDraft;
  approvedOffer?: ApprovedOffer;
  handoff?: ProductionHandoff;
}

export interface ProductionWorkspaceState {
  cases: CaseSummary[];
  activeCase?: ProductionCase;
  activeEvents: CaseEvent[];
  activeSources: CaseSourceRef[];
  currentDraft?: ProductionDraft;
  approvedProductionSpec?: ApprovedProductionSpec;
  currentPlan?: ProductionPlan;
  currentPurchaseList?: PurchaseList;
  referencedRecipes: Recipe[];
}

export function loadOfferWorkspaceState(activeCaseId?: string): Promise<OfferWorkspaceState>;
export function loadProductionWorkspaceState(activeCaseId?: string): Promise<ProductionWorkspaceState>;
```

The summary request returns only case summaries. Detail, events, sources, drafts, approvals and results load only for the explicitly active case. Product-specific command clients expose source upload, message, review, revision, approval and handoff/apply actions without passing the old mega-workbench state through the shell. Production may read source documents and immutable handoffs through the explicit ports, but it never loads the offer dashboard; Offer never loads plans, purchase lists or recipes. Replace `Record<string, unknown>` at these new boundaries with shared contract types. Do not refactor unrelated legacy helpers in this task.

- [ ] **Step 4: Build three small shells**

`App.tsx` only resolves `/`, `/angebot`, and `/produktion`. `HomePortalApp` shows two product links and no operational data. Each product shell owns its hook, loading/error state, refresh and workbench. There is no shared dashboard hook.

- [ ] **Step 5: Validate desktop and mobile empty starts**

Make the operational default honest before the visual check: `npm run local:start` and `npm run local:start:fresh` start without `--seed-demo`. Add explicitly named `local:start:demo` and `local:start:fresh:demo` commands for synthetic demonstrations. Existing data remains reachable only through `Frühere Aufträge`; no route auto-focuses it.

```bash
npx vitest run tests/product-shell-data-boundary.test.tsx tests/app-offer-route-app-boundary.test.ts tests/app-production-route-app-boundary.test.ts tests/local-ops-check-contract.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Use Playwright at `1440x900` and `390x844`. On both product routes, verify that an empty business shows only `Neuen Auftrag beginnen` and `Frühere Aufträge`; no demo plan, export or old draft is focused automatically.

- [ ] **Step 6: Commit**

```bash
git add backoffice-ui/src package.json scripts/start-local-stack.sh scripts/start-fresh-local-stack.sh tests/product-shell-data-boundary.test.tsx tests/app-offer-route-app-boundary.test.ts tests/app-production-route-app-boundary.test.ts tests/local-ops-check-contract.test.ts
git commit -m "refactor: split offer and production product shells"
```

Expected: the routes are independently usable and independently loaded, while remaining in one deployable UI package for Stage A.

---

### Task 9: History, Search, Copy And Document Conversation

**Branch:** `loop/stage-a-case-workspace`

**Files:**
- Create: `backoffice-ui/src/case-history-state.ts`
- Create: `backoffice-ui/src/case-history-panel.tsx`
- Create: `backoffice-ui/src/case-workspace-state.ts`
- Create: `backoffice-ui/src/case-workspace.tsx`
- Create: `backoffice-ui/src/case-document-pane.tsx`
- Create: `backoffice-ui/src/case-conversation-pane.tsx`
- Create: `tests/case-history-state.test.ts`
- Create: `tests/case-history-panel.test.tsx`
- Create: `tests/case-workspace.test.tsx`
- Modify: `backoffice-ui/src/api.ts`
- Modify: `backoffice-ui/src/offer-product-app.tsx`
- Modify: `backoffice-ui/src/production-product-app.tsx`
- Modify: `backoffice-ui/src/offer-workbench.tsx`
- Modify: `backoffice-ui/src/production-route-main-layout.tsx`
- Modify: `backoffice-ui/src/styles.css`
- Modify: `tests/backoffice-output-praesentation-smoke.test.ts`
- Modify: `tests/backoffice-intake-request-detail.test.ts`
- Modify: `tests/backoffice-route-smoke.test.ts`
- Modify: `tests/backoffice-production-acceptance-smoke.test.ts`

**Interfaces:**
- Consumes: `OfferCase`, `ProductionCase`, `CaseSummary`, persistent source URLs and product case routes.
- Produces: empty start, chronological/searchable history, safe copy, persistent conversation, desktop document comparison and mobile pane switching.

- [ ] **Step 1: Write history behavior tests**

```ts
it("sorts cases newest first without auto-opening one", () => {
  const state = buildCaseHistoryState(cases, "", undefined);
  expect(state.items.map((item) => item.caseId)).toEqual(["new", "old"]);
  expect(state.activeCaseId).toBeUndefined();
});

it("finds a case by human name and source filename", () => {
  expect(buildCaseHistoryState(cases, "koepff", undefined).items.map((item) => item.caseId)).toEqual(["koepff-case"]);
});
```

- [ ] **Step 2: Write workspace interaction tests**

```tsx
it("keeps document and conversation positions while switching on mobile", async () => {
  const root = createRoot(container);
  await act(async () => root.render(
    <CaseWorkspace {...props} mobilePane="document" documentPosition={{ page: 3, paneScrollTop: 480 }} conversationPosition={920} />
  ));
  await act(async () => findButton(container, "Dialog").click());
  expect(props.onMobilePaneChange).toHaveBeenCalledWith("conversation");
  expect(props.onDocumentPositionChange).not.toHaveBeenCalledWith({ page: 1, paneScrollTop: 0 });
});

it("shows an immediate pending message after submit", async () => {
  const input = container.querySelector<HTMLTextAreaElement>('[aria-label="Nachricht"]')!;
  await act(async () => setNativeValue(input, "120 statt 100 Personen"));
  await act(async () => findButton(container, "Senden").click());
  expect(container.textContent).toContain("Wird verarbeitet ...");
});
```

Use the existing JSDOM plus `createRoot`/`act` test pattern and native DOM events; add no UI test dependency.

- [ ] **Step 3: Run and verify red**

```bash
npx vitest run tests/case-history-state.test.ts tests/case-history-panel.test.tsx tests/case-workspace.test.tsx
```

- [ ] **Step 4: Implement the history panel**

```ts
export interface CaseHistoryPanelProps {
  product: CaseProduct;
  items: CaseSummary[];
  activeCaseId?: string;
  search: string;
  onSearchChange(value: string): void;
  onOpen(caseId: string): void;
  onCopy(caseId: string): Promise<void>;
}
```

The initial surface has two commands: `Neuen Auftrag beginnen` and `Frühere Aufträge`. The latter reveals search and chronological results. `Weiterbearbeiten` opens the same case; `Als neuen Auftrag verwenden` calls the copy route and opens the new case. Neither action rewrites old history.

- [ ] **Step 5: Implement the two-pane case workspace**

```ts
export interface DocumentPosition { page?: number; paneScrollTop: number }

export interface CaseWorkspaceProps {
  caseRecord: OfferCase | ProductionCase;
  events: CaseEvent[];
  sources: CaseSourceRef[];
  activeSourceId?: string;
  documentUrl?: string;
  documentPosition: DocumentPosition;
  conversationPosition: number;
  mobilePane: "document" | "conversation";
  onActiveSourceChange(sourceId: string): void;
  onMobilePaneChange(pane: "document" | "conversation"): void;
  onDocumentPositionChange(position: DocumentPosition): void;
  onConversationPositionChange(scrollTop: number): void;
  onSubmitMessage(text: string, sourceId?: string): Promise<CaseEvent>;
}
```

Desktop uses a stable two-column grid with the source and conversation. Mobile uses a two-option segmented control. Persist active source, outer document-pane scroll, optional requested PDF page, conversation scroll and mobile pane under `case-workspace:<businessId>:<product>:<caseId>`; events and source metadata remain server-owned. The browser's native PDF viewer is opaque: internal plugin scroll is not promised. On load or pane return, append `#page=n` as a best-effort page hint and restore the outer pane position; never claim exact native-viewer scroll restoration. Render PDFs through the scoped content URL, images directly and text in a scrollable `<pre>`. Do not copy original bytes into React state.

- [ ] **Step 6: Render the conversation chronologically**

Messages are projections of append-only `CaseEvent` records and include upload, instructions, draft result, review decision, revision, approval, result and errors. A submit appends an optimistic pending row immediately, then replaces it with the persisted event returned by the message route or an explicit error row. A reload fetches the same event order from the server; it does not reconstruct history from local UI state. Technical IDs and provider metadata remain in a collapsed `Technische Details` disclosure.

- [ ] **Step 7: Validate visual behavior**

```bash
npx vitest run tests/case-history-state.test.ts tests/case-history-panel.test.tsx tests/case-workspace.test.tsx tests/backoffice-output-praesentation-smoke.test.ts tests/backoffice-intake-request-detail.test.ts tests/backoffice-route-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
```

With Playwright, capture `1440x900`, `1024x768`, `390x844`, and `844x390`. Verify no overlap, no nested-card wall, readable document, a visible conversation composer, restored active source/conversation position and best-effort PDF page after pane switches and reload. The component test rerenders from fetched `CaseEvent[]` and persisted workspace state to prove that the optimistic row becomes the server event and survives reload.

- [ ] **Step 8: Commit**

```bash
git add backoffice-ui/src tests/case-history-state.test.ts tests/case-history-panel.test.tsx tests/case-workspace.test.tsx tests/backoffice-output-praesentation-smoke.test.ts tests/backoffice-intake-request-detail.test.ts tests/backoffice-route-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts
git commit -m "feat: add persistent document conversation workspace"
```

Expected: an operator can compare the original source, talk through changes, find or copy an old order, and always understand which case is being changed.

---

### Task 10: One Next Action And Simple Review

**Branch:** `loop/stage-a-simple-review`

**Files:**
- Create: `backoffice-ui/src/case-next-action.ts`
- Create: `backoffice-ui/src/case-next-action-bar.tsx`
- Create: `tests/case-next-action.test.ts`
- Create: `tests/case-next-action-bar.test.tsx`
- Create: `tests/offer-case-workspace-flow.test.tsx`
- Create: `tests/production-case-workspace-flow.test.tsx`
- Modify: `backoffice-ui/src/offer-workbench.tsx`
- Modify: `backoffice-ui/src/offer-approval-action.ts`
- Modify: `backoffice-ui/src/production-workbench.tsx`
- Modify: `backoffice-ui/src/production-input-panel.tsx`
- Modify: `backoffice-ui/src/production-draft-review-panel.tsx`
- Modify: `backoffice-ui/src/styles.css`
- Modify: `shared-core/src/types.ts`
- Modify: `shared-core/src/schemas/production-draft.ts`
- Modify: `production-service/src/routes/artifact-routes.ts`
- Modify: `tests/production-draft-review-state.test.ts`
- Modify: `tests/production-draft-import.test.ts`
- Modify: `tests/offer-approval-action.test.ts`
- Modify: `tests/production-input-panel-transition.test.tsx`
- Modify: `tests/production-draft-review-panel.test.tsx`

**Interfaces:**
- Consumes: case state, draft revisions, approval and apply routes.
- Produces: exactly one global next action, visible progress, grouped low-risk confirmation and inline revision feedback.

- [ ] **Step 1: Write the state-machine tests**

```ts
it.each([
  [emptyCase(), "add_source"],
  [caseWithPendingDraft(), "review_draft"],
  [caseWithRequestedChanges(), "request_revision"],
  [offerCaseReadyForApproval(), "approve_offer"],
  [productionCaseReadyForApproval(), "approve_production"],
  [caseWithApprovedOffer(), "send_handoff"],
  [caseWithApprovedSpec(), "apply_approved"],
  [caseWithResult(), "inspect_result"]
])("returns one next action", (input, expected) => {
  expect(buildCaseNextAction(input)).toMatchObject({ kind: expected });
});

it("does not offer handoff creation again when the handoff already exists", () => {
  expect(buildCaseNextAction(offerWithApprovedOfferAndHandoff())).toMatchObject({ kind: "inspect_handoff" });
});

it("does not offer apply again when result artifacts already exist", () => {
  expect(buildCaseNextAction(productionWithApprovedSpecAndResult())).toMatchObject({ kind: "inspect_result" });
});

it("renders an archived case without a result as terminal, not actionable", () => {
  expect(buildCaseNextAction(archivedCaseWithoutResult())).toMatchObject({ kind: "complete" });
});

it.each(["price", "allergen", "food_safety", "blocking"] as const)(
  "never bulk-confirms %s review cards",
  (reviewScope) => {
    expect(isBulkConfirmableReviewCard(lowRiskSourcedCard({ reviewScope }))).toBe(false);
  }
);
```

- [ ] **Step 2: Define the single action union**

```ts
export interface CaseNextActionInput {
  product: CaseProduct;
  caseStatus: CaseStatus;
  hasSource: boolean;
  currentDraftId?: string;
  selectedVariantId?: string;
  draftState?: "pending_review" | "change_requested" | "ready_for_approval";
  nextReviewTargetId?: string;
  approvedOfferId?: string;
  handoffId?: string;
  approvedProductionSpecId?: string;
  resultArtifactId?: string;
}

export type CaseNextAction =
  | { kind: "add_source"; label: "Quelle hinzufügen" }
  | { kind: "review_draft"; label: "Nächsten Prüfpunkt öffnen"; targetId: string }
  | { kind: "request_revision"; label: "Überarbeitung erstellen"; draftId: string }
  | { kind: "approve_offer"; label: "Angebot freigeben"; draftId: string; variantId: string }
  | { kind: "send_handoff"; label: "An Produktion übergeben"; approvedOfferId: string }
  | { kind: "inspect_handoff"; label: "Übergabe öffnen"; handoffId: string }
  | { kind: "approve_production"; label: "Produktionsstand freigeben"; draftId: string }
  | { kind: "apply_approved"; label: "Plan und Einkauf erstellen"; approvedProductionSpecId: string }
  | { kind: "inspect_result"; label: "Ergebnis öffnen"; artifactId: string }
  | { kind: "complete"; label: "Auftrag abgeschlossen" };
```

The precedence is explicit and product-specific. Existing result wins over apply; existing handoff wins over handoff creation; a requested revision wins over approval; unresolved review wins over approval; missing source is considered only when no later persisted artifact exists. `complete` is rendered as status, not as a clickable primary button. Archived cases never expose mutating commands.

- [ ] **Step 3: Run and verify red**

```bash
npx vitest run tests/case-next-action.test.ts tests/case-next-action-bar.test.tsx
```

- [ ] **Step 4: Replace fake phase buttons with status**

Render `Quelle -> KI-Entwurf -> Prüfung -> Plan` as an ordered status list with `aria-current="step"`, not buttons. `CaseNextActionBar` is sticky at the bottom of the active workspace and contains one primary action. Secondary actions use links or a menu and never compete visually.

- [ ] **Step 5: Simplify review behavior**

Show only the next undecided review unit plus overall progress. Confirmed units collapse. Add `Alle unkritischen Quellenpositionen bestätigen` only for cards with `reviewScope: "source_fidelity"`, `riskLevel: "low"`, `requiredApproval !== true`, and a source reference. Price, allergen, food-safety and blocking scopes always remain individual even if another field accidentally marks them low-risk.

Extend `ProductionDraftReviewCard` and its schema with `reviewScope` (`source_fidelity`, `price`, `allergen`, `food_safety`, `production`, `blocking`), structured `sourceRefs` (`documentId`, optional page and non-reversible text-anchor hash) and `dependentArtifactIds`. The source link opens the operator-owned document; it never stores source text in the card. `dependentArtifactIds` defines the narrow scope of `Blockiert`, so unrelated dishes and artifacts remain actionable.

Review choices remain:

```text
Passt | Änderung nötig | Unklar | Blockiert
```

`Blockiert` disables only its dependent artifact. It does not hide unrelated dishes or stop other review work.

- [ ] **Step 6: Put change request and revision together**

After `Änderung nötig`, show the operator comment, `Überarbeitung erstellen`, visible processing state and the revised result in the same conversation thread. The server compares the prior and revised normalized artifacts and maps changed paths/target IDs to review cards. It resets only cards whose `targetPath`, `targetId` or dependent artifacts changed. It never trusts a client-supplied affected-card list; if the server cannot prove a card unaffected, it resets that card conservatively. The existing draft stays immutable or becomes `superseded`; it is never overwritten.

Add backend tests for two behavioral classes: a garnish-only correction resets only the dessert card, while an attendee-count change resets event data plus dependent quantity, purchase and timeline cards but preserves unrelated source-fidelity decisions. A confirmed card with `riskLevel: "blocking"` no longer blocks approval; a card whose decision remains `blocked`, `unclear`, `change_requested` or `pending` still does.

- [ ] **Step 7: Use the new approval/handoff APIs**

Replace `promoteOfferDraft()` with `decideOfferDraft()` followed by a distinct `createProductionHandoff()` action. Replace draft apply with `applyApprovedProductionSpec()`. Every success adds a case message and visible result; every error adds an error row. No action completes silently.

- [ ] **Step 8: Run flow tests and browser rehearsal**

```bash
npx vitest run tests/case-next-action.test.ts tests/case-next-action-bar.test.tsx tests/offer-case-workspace-flow.test.tsx tests/production-case-workspace-flow.test.tsx tests/offer-approval-action.test.ts tests/production-input-panel-transition.test.tsx tests/production-draft-review-panel.test.tsx tests/production-draft-review-state.test.ts tests/production-draft-import.test.ts
npm test
npx tsc --noEmit
npm run build
npm run browser:rehearsal:full-fresh
git diff --check
```

Expected: upload, review, change, revision, approval, handoff and apply each show an immediate state change; only one global primary action is visible; fake phase buttons are gone.

- [ ] **Step 9: Commit**

```bash
git add backoffice-ui/src shared-core/src/types.ts shared-core/src/schemas/production-draft.ts production-service/src/routes/artifact-routes.ts tests
git commit -m "feat: make review and next action explicit"
```

---

### Task 11: Shared API And Subscription Quality Corridor

**Branch:** `loop/stage-a-production-reference-quality`

**Files:**
- Create: `shared-core/src/production-reference-quality.ts`
- Create: `tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json`
- Create: `tests/production-draft-provider-parity.test.ts`
- Create: `scripts/check-production-reference-case.ts`
- Create: `tests/production-reference-quality-command.test.ts`
- Create: `tests/koepff-production-reference-corridor.test.ts`
- Modify: `shared-core/src/index.ts`
- Modify: `package.json`
- Modify: `tests/production-draft-document-byo.test.ts`
- Modify: `tests/production-folder-export.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: existing OpenAI and Codex CLI transports, production draft schema, production map renderer, Koepff recipe seeds and provider data gate.
- Produces: one deterministic expectation contract and one manually authorized real-provider command.

- [ ] **Step 1: Write the deterministic completeness tests**

```ts
it.each(["openai", "codex_cli"] as const)("assesses %s against the same expected positions", async (provider) => {
  const candidate = await runMockTransport(provider, completeStructuredOutput);
  expect(assessProductionDraftReference(expectation, candidate)).toMatchObject({ passed: true });
});

it("names every omitted or duplicate position", () => {
  const result = assessProductionDraftReference(expectation, outputMissingVitelloWithDuplicateDessert);
  expect(result.missingComponentLabels).toEqual(["Vitello Tonnato | Riesenkapern | weisser Thunfisch"]);
  expect(result.duplicateComponentLabels).toEqual(["Kokos-Cheesecake | Brombeere"]);
});
```

- [ ] **Step 2: Define the expectation and assessor**

```ts
export interface ProductionDraftReferenceExpectation {
  caseId: string;
  sourceSha256: string;
  requiredComponentLabels: readonly string[];
  allowedOpenQuestionFields: readonly string[];
  forbiddenComponentLabels: readonly string[];
}

export function assessProductionDraftReference(
  expectation: ProductionDraftReferenceExpectation,
  output: LlmReadinessModelOutputCandidate
): {
  passed: boolean;
  missingComponentLabels: string[];
  duplicateComponentLabels: string[];
  forbiddenComponentLabels: string[];
  errors: string[];
};
```

Normalize Unicode, whitespace and case only. Do not use fuzzy matching. The expectation file contains anonymous labels and source hash, not PDF bytes or customer data.

- [ ] **Step 3: Run and verify red, then implement the assessor**

```bash
npx vitest run tests/production-draft-provider-parity.test.ts
```

Expected before implementation: FAIL. Expected after implementation: both mocked transports pass the identical contract; silent omission fails by item name.

- [ ] **Step 4: Implement the manually authorized provider command**

Add:

```json
{
  "quality:production-reference": "tsx scripts/check-production-reference-case.ts"
}
```

The command requires `--source`, `--expectation`, `--provider`, `--report`, and the external-processing approval file from Task 7. It refuses mixed providers and never falls back. Its JSON report contains only source hash, provider/model/schema/prompt IDs, counts, missing labels, error classes and usage metadata.

```bash
npm run quality:production-reference -- \
  --source data/gate1/angebot_flying_buffet_45p_anonymisiert.pdf \
  --expectation tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json \
  --provider codex_cli \
  --report /tmp/koepff-codex-cli.json
```

The same command may run with `--provider openai` only after separate human budget approval. Automated tests inject transports and perform no network or CLI call.

- [ ] **Step 5: Lock the known kitchen-quality reference**

The focused corridor proves:

```text
- every offered main component, side, sauce, garnish and purchase component appears or becomes an explicit question
- all nine production-folder sections render
- each recipe starts on a new printed page
- purchase groups stay in canonical Metro order and avoid splitting a group when the group fits on the next page
- every recipe ingredient is purchased or has a documented exception
- thermal recipes carry oven and core temperatures or remain visibly review-required
- Roastbeef is seared whole in pan or tilting skillet, then finished gently in the UNOX to target core temperature
- Drillinge are fully coated with rapeseed/olive oil and sea salt, no pepper, 230 C, no steam, 30-35 minutes
- Kokos-Cheesecake uses blackberries only as garnish, two per tartlet calculated, one to three allowed
- no raw prompt, provider response, internal ID or developer term appears in the kitchen document
```

- [ ] **Step 6: Validate and commit**

```bash
npx vitest run tests/production-draft-provider-parity.test.ts tests/production-reference-quality-command.test.ts tests/koepff-production-reference-corridor.test.ts tests/production-draft-document-byo.test.ts tests/production-folder-export.test.ts
npm test
npx tsc --noEmit
npm run build
git diff --check
git add shared-core/src/production-reference-quality.ts shared-core/src/index.ts scripts/check-production-reference-case.ts tests package.json .gitignore
git commit -m "test: add production reference quality corridor"
```

Expected: API and subscription transports share one measurable contract; mocked CI cannot masquerade as real-provider proof; real reports contain no source text.

---

### Task 12: Stage A End-To-End Proof, Local Migration And Ballast Removal

**Branch:** `loop/stage-a-complete-chain`

**Files:**
- Create: `tests/stage-a-contract-chain.test.ts`
- Create: `tests/stage-a-business-isolation.test.ts`
- Create: `tests/stage-a-product-flow.test.tsx`
- Modify: `scripts/migrate-local-business-scope.ts`
- Modify: `tests/local-business-scope-migration.test.ts`
- Modify: `package.json`
- Modify: `scripts/start-local-stack.sh`
- Modify: `scripts/start-fresh-local-stack.sh`
- Modify: `scripts/check-browser-rehearsal-full-fresh.sh`
- Modify: `tests/data-safety-audit-gates.test.ts`
- Modify: `tests/mutating-route-auth-matrix.test.ts`
- Modify: `tests/backoffice-route-smoke.test.ts`
- Modify: `shared-core/src/persistence.ts`
- Modify: `shared-core/src/business-context.ts`
- Modify: `shared-core/src/index.ts`
- Create: `tests/unscoped-persistence-import-boundary.test.ts`
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/app-production-route-app-boundary.ts`
- Modify: `tests/app-production-route-app-boundary.test.ts`
- Modify: `tests/app-feedback-shell.test.ts`
- Modify: `backoffice-ui/src/styles.css`
- Modify: `docs/product/CANONICAL_USER_STORY_TRACKER.csv`
- Delete after replacement tests pass: `backoffice-ui/src/use-app-dashboard-data.ts`
- Delete after replacement tests pass: `backoffice-ui/src/app-route-content.tsx`
- Delete after replacement tests pass: `backoffice-ui/src/app-route-content-state.ts`
- Delete after replacement tests pass: `backoffice-ui/src/production-route-filter-panel.tsx`
- Delete after replacement tests pass: `backoffice-ui/src/production-route-filter-state.ts`
- Delete after replacement tests pass: `tests/use-app-dashboard-data.test.ts`
- Delete after replacement tests pass: `tests/app-route-content.test.ts`
- Delete after replacement tests pass: `tests/app-route-content-state.test.ts`
- Delete after replacement tests pass: `tests/production-route-filter-state.test.ts`

**Interfaces:**
- Consumes: every Stage A contract and route.
- Produces: final proof of every versioned local migration, the complete cross-product chain, hosted-readiness activation, and removal of remaining global-dashboard compatibility paths.

- [ ] **Step 1: Extend the migration test to cover the complete legacy surface**

```ts
it("copies every exposed legacy collection into one business exactly once", async () => {
  await seedAllLegacyCollections(root);
  await runMigration(root, "commcats-local");
  await runMigration(root, "commcats-local");

  expect(await scopedOfferStore.listDrafts({ businessId: "commcats-local" })).toHaveLength(2);
  expect(await scopedProductionStore.listPlans({ businessId: "commcats-local" })).toHaveLength(1);
  expect(await scopedIntakeStore.listRequests({ businessId: "commcats-local" })).toHaveLength(1);
  expect(await readMigrationManifest(root)).toMatchObject({
    businessId: "commcats-local",
    completedUnits: ["stage-a-001-audit", "stage-a-002-offers", "stage-a-003-production", "stage-a-004-intake"]
  });
});
```

- [ ] **Step 2: Close migration gaps before the end-to-end proof**

Inventory every collection constructed by `createPersistentCollection` and every source-document table. Compare that inventory with the four registered migration units. If a user-visible legacy collection is missing, add it to the owning unit and a concrete count/hash assertion. Run the complete migration twice in file mode and PostgreSQL mode. The second run must report every unit as `already_migrated`; legacy sources remain untouched.

- [ ] **Step 3: Write the full contract-chain test**

```ts
it("keeps the approved chain scoped and immutable", async () => {
  const offerDraft = await createOfferDraft(alpha);
  const approvedOffer = await approveOffer(alpha, offerDraft);
  const handoff = await createHandoff(alpha, approvedOffer);
  const productionCase = await createProductionCaseFromHandoff(alpha, handoff);
  const productionDraft = await createAndReviewProductionDraft(alpha, productionCase);
  const approvedSpec = await approveProductionDraft(alpha, productionDraft);
  const result = await applyApprovedSpec(alpha, approvedSpec);

  expect(result.plan).toBeDefined();
  expect(await getHandoff(beta, handoff.handoffId)).toBeUndefined();
  expect(await getApprovedSpec(beta, approvedSpec.approvedProductionSpecId)).toBeUndefined();
  expect(await auditText(alpha)).not.toMatch(/VITELLO|promptContext|providerResponse/);
});
```

- [ ] **Step 4: Write the product-flow browser test**

Before the browser flow, add a profile-independent route/store isolation matrix in `tests/stage-a-business-isolation.test.ts`. It constructs route handlers with trusted test resolvers for `alpha` and `beta` while the hosted startup hold is still false. Seed the same record IDs, then exercise intake requests/specs/sources, offer cases/drafts/approvals/handoffs, production cases/drafts/plans/purchase lists/recipes/audit and the code-owned inventory of every HTML/CSV export. Each call must return only its trusted business record. This matrix proves isolation without bypassing or prematurely enabling the hosted profile.

Then write the product-flow browser test:

```text
empty offer start -> create/open OfferCase -> add source -> draft -> review -> approve -> immutable handoff
empty production start -> open handoff -> draft -> review -> change request -> revision -> approve -> apply -> plan/purchase/folder
reload -> same case, document and conversation remain
search -> finds human display name
continue -> revision in same case
copy -> new case with no inherited approval
```

Assert that every action immediately exposes progress, result or error and that each product route calls only its own APIs plus the explicit source/handoff ports.

- [ ] **Step 5: Remove remaining compatibility paths only after green replacement proof**

Remove the five listed UI files and their four direct contract tests using `apply_patch` deletion only after the Task 8–10 replacement tests pass and `rg` shows no production import. Remove the production-filter dependency from `app-production-route-app-boundary.ts` and its surviving boundary test; remove obsolete imports from `App.tsx`; update `app-feedback-shell.test.ts`, the old filter/history selectors in surviving smoke tests, obsolete CSS and tracker rows `US-001`, `US-002` and `US-037` to the actual replacement files. Inline Base64/multipart production-draft ingestion was already removed in Task 6 and must remain absent. Replace removed-route tests with `404` expectations where applicable. Confirm that the unscoped audit methods, offer promote route and production draft-apply route were already removed in Tasks 1, 3 and 4. Do not remove parsing, planning, recipe, purchase or export logic.

Stop wildcard-exporting `persistence.ts` from `shared-core/src/index.ts`. Explicitly preserve `CollectionStorageOptions`, `Queryable`, the scoped collection interfaces and `createBusinessScopedPersistentCollection`; do not expose the writable unscoped factory through the barrel. Add a genuinely read-only `createLegacyMigrationReader` exposing only `get` and `list`; only `scripts/migrate-local-business-scope.ts` may import it through the direct module path. `tests/unscoped-persistence-import-boundary.test.ts` scans product services, UI and ordinary scripts and fails on any import of the legacy reader or unscoped factory, and asserts the barrel has no wildcard persistence export.

Only after the profile-independent route/store isolation matrix is green, change `hostedMultiBusinessReady` in `shared-core/src/business-context.ts` from `false` to `true`. There is still no environment bypass. Then start the real hosted profile in tests: startup succeeds because the code-owned readiness gate is open; each request still requires a valid trusted business context. Missing or forged context fails before store, export or provider access, while a valid signed context reaches only its business.

- [ ] **Step 6: Run the complete validation battery**

```bash
npx vitest run tests/local-business-scope-migration.test.ts tests/stage-a-contract-chain.test.ts tests/stage-a-business-isolation.test.ts tests/stage-a-product-flow.test.tsx tests/unscoped-persistence-import-boundary.test.ts tests/data-safety-audit-gates.test.ts tests/mutating-route-auth-matrix.test.ts tests/backoffice-route-smoke.test.ts tests/app-production-route-app-boundary.test.ts
npm test
npx tsc --noEmit
npm run build
npm audit --omit=dev
npm audit
npm run browser:rehearsal:full-fresh
bash scripts/check-internal-beta-gate.sh
git diff --check
```

Expected:

```text
- identical IDs in two businesses never cross storage, APIs, audit or exports
- no unapproved draft creates a product object
- offer and production artifacts reference exactly one ApprovalRequestRecord
- approved snapshots stay immutable across later revisions
- local pre-Stage-A data is present after one idempotent migration
- start pages are empty and product loaders remain separate
- original document, case history and conversation survive reload
- API and subscription quality use one reference contract
- no compatibility route or obsolete dashboard loader remains
```

If `npm audit` is red on the unchanged baseline, report the exact dependency paths in the PR and create a separate hardening slice; do not run `npm audit fix --force` and do not hide the result.

- [ ] **Step 7: Inspect product-code reduction and commit**

```bash
git diff --stat origin/main...HEAD
rg -n "promoteOfferDraft|loadDashboardState|use-app-dashboard-data|AppRouteContent|app-route-content-state|ProductionRouteFilterPanel|production-route-filter-state|production-filter-details|legacy inline document|createPersistentCollection" backoffice-ui offer-service production-service intake-service shared-core/src/index.ts scripts tests
git status --short
git add package.json scripts shared-core intake-service offer-service production-service backoffice-ui tests docs/product/CANONICAL_USER_STORY_TRACKER.csv
git commit -m "feat: complete Stage A trusted product flow"
```

Expected: the replacement flow is green before old files disappear; tracked product code added for cases and trust boundaries is offset by removal of the combined dashboard and direct promotion path where practical.

---

## Stage A Human Acceptance

Automated green is necessary but not sufficient. Before Stage A is called complete, Alexander performs these two short probes on a fresh local business root:

1. **Offer product:** start empty, upload one approved real or anonymized offer source, compare the original with the draft, request one correction, approve one variant, and create the handoff. The operator must always know the next action and see no production dashboard data.
2. **Production product:** open that handoff or a direct source, verify every offered component, request the Kokos-Cheesecake garnish correction, approve the revised production specification, create plan/purchase list/folder, reload, search the case and reopen the source. No content may silently disappear.

The probe records blockers, confusing steps, trust failures and keepers. A cosmetic preference alone does not reopen Stage A; a blocked, misleading or unsafe behavior does.

## Stage A Completion Gate

Stage A is complete only when all statements are true:

- local single-business operation passes the full chain without code handwork
- hosted mode starts only after the code-owned readiness gate is open, and every hosted request requires a trusted business context
- no cross-business read succeeds in file or PostgreSQL mode
- `ApprovalRequestRecord` is the only approval authority
- no direct OfferDraft-to-AcceptedEventSpec or ProductionDraft-to-plan path remains
- offer and production start empty, load independently and retain their own cases
- source, conversation, review, revision and results survive reload
- API and Codex CLI pass the same deterministic reference contract
- a real provider run is separately authorized and identified as human evidence, never CI evidence
- full tests, typecheck, build, browser rehearsal, audit report and internal beta gate are attached to the final PR
