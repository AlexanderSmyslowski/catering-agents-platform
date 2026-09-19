import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildProductionApp, InMemoryRecipeRepository, ProductionStore, RecipeDiscoveryService, productionDecisionRepositoryFor } from "@catering/production-service";
import { buildPrintExportApp } from "@catering/print-export";
import { createEventRequestFromText, normalizeEventRequestToSpec, type AcceptedEventSpec, type ProductionDraft, type ProductionHandoff, type Recipe } from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";

const context = { businessId: "local" };
const secret = "synthetic-applied-snapshot-test";
const headers = { "x-catering-actor-name": "Produktions-Mitarbeiter", "x-catering-trusted-secret": secret };

async function approvedDescendant() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-applied-snapshot-"));
  const store = new ProductionStore({ rootDir });
  const repository = new InMemoryRecipeRepository({ rootDir });
  const intakeRecords = new InMemoryIntakeRecordsPort();
  const normalized = normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "synthetic-applied-source", channel: "text", rawText: "Lunch am 2026-09-22 für 35 Personen." }));
  const spec: AcceptedEventSpec = {
    ...normalized, specId: "spec-applied-snapshot", lifecycle: { commercialState: "accepted" },
    attendees: { expected: 35 },
    event: { ...normalized.event, date: "2026-09-22", schedule: [] },
    menuPlan: ["soup", "salad", "purchased"].map(componentId => ({ componentId, label: componentId, servings: 35, serviceStyle: "buffet" })),
    budgetContext: { pricingSummary: { subtotal: { amount: 9876, currency: "EUR" } } },
    uncertainties: [{ field: "event.schedule", severity: "low", message: 'Zeitangabe in "Lunch" ist nicht als vollständiger Termin belastbar.', suggestedQuestion: "Wie lautet das verbindliche Zeitfenster?" }]
  };
  const handoff: ProductionHandoff = {
    schemaVersion: "1.0", businessId: "local", handoffId: "handoff-applied-snapshot", approvedOfferId: "offer-applied-snapshot", approvalRequestId: "offer-approval-applied-snapshot",
    createdAt: "2026-09-19T10:00:00.000Z", eventSpecSnapshot: structuredClone(spec), pricingSnapshot: spec.budgetContext!.pricingSummary!,
    source: { draftId: "offer-draft-applied-snapshot", revision: 1, selectedVariantId: "variant-applied-snapshot" }
  };
  const recipes: Recipe[] = ["soup", "salad"].map(name => ({
    schemaVersion: "1.0", recipeId: `recipe-applied-${name}`, name: `Approved ${name}`,
    source: { tier: "digitized_cookbook", originType: "cookbook", reference: `synthetic:approved-${name}`, retrievedAt: handoff.createdAt, approvalState: "review_required", qualityScore: 1, fitScore: 1, extractionCompleteness: 1 },
    baseYield: { servings: 10, unit: "servings" }, ingredients: [{ ingredientId: name, name: `${name} ingredient`, quantity: { amount: 1, unit: "kg" }, group: "produce" }],
    steps: [{ index: 1, instruction: `Prepare approved ${name}.` }], scalingRules: { defaultLossFactor: 1, batchSize: 10 }, allergens: [], dietTags: ["vegetarian"]
  }));
  for (const recipe of recipes) await repository.save(context, recipe);
  await intakeRecords.insertSpec(context, spec);
  const app = buildProductionApp({ dataRoot: rootDir, store, repository, intakeRecords,
    discoveryService: new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }),
    trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1" }, handoffReader: { get: async (actor, id) => actor.businessId === "local" && id === handoff.handoffId ? handoff : undefined } });
  const createdCase = await app.inject({ method: "POST", url: `/v1/production/cases/from-handoff/${handoff.handoffId}`, headers, payload: {} });
  expect(createdCase.statusCode, createdCase.body).toBe(201);
  const caseId = createdCase.json().case.caseId as string;
  const createdDraft = await app.inject({ method: "POST", url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`, headers, payload: { caseId } });
  expect(createdDraft.statusCode, createdDraft.body).toBe(201);
  const rootDraft = createdDraft.json().draft as ProductionDraft;
  const revisedResponse = await app.inject({ method: "POST", url: `/v1/production/drafts/${rootDraft.draftId}/revise`, headers, payload: {
    caseId, expectedRevision: rootDraft.revision,
    componentClassifications: spec.menuPlan.map(component => ({ componentId: component.componentId, menuCategory: "vegetarian" })),
    componentUpdates: [
      ...recipes.map((recipe, index) => ({ componentId: spec.menuPlan[index]!.componentId, productionMode: "scratch", recipeOverrideId: recipe.recipeId, notes: "Explicit reviewed preparation" })),
      { componentId: "purchased", productionMode: "convenience_purchase", purchasedElements: ["Croissants", "Wasser"], purchasedQuantities: [{ element: "Croissants", amountPerPerson: 1, unit: "Stück" }, { element: "Wasser", amountPerPerson: 0.5, unit: "l" }], notes: "Explicit purchased quantities" }
    ], eventSchedule: [{ label: "Service", start: "12:00", end: "14:00" }]
  } });
  expect(revisedResponse.statusCode, revisedResponse.body).toBe(201);
  const revision = revisedResponse.json().draft as ProductionDraft;
  for (const [index, recipe] of recipes.entries()) {
    const componentId = spec.menuPlan[index]!.componentId;
    const evidence = await app.inject({ method: "POST", url: `/v1/production/cases/${caseId}/planning-evidence`, headers, payload: {
      draftId: revision.draftId, draftRevision: revision.revision, componentId, recipeId: recipe.recipeId,
      quantityDecision: { decisionId: `quantity-${componentId}`, eventSpecId: spec.specId, componentId, guestCount: 35, serviceFormat: "buffet", dishRole: "other", basis: "servings_per_person", perUnitAmount: 1, perUnitUnit: "servings", targetAmount: 35, targetUnit: "servings", rationale: "Explicit synthetic portions", evidence: { kind: "operator_instruction", reference: "synthetic-operator" }, reviewStatus: "approved" },
      recipeEventUseReview: { eventSpecId: spec.specId, recipeId: recipe.recipeId, reviewedBy: "Produktions-Mitarbeiter", reviewedAt: "2026-09-19T11:00:00.000Z", decision: "accepted_for_event", confirmations: { quantitiesAndYield: true, methodAndEquipment: true, allergensAndDiet: true, holdingAndRegeneration: true } }
    } });
    expect(evidence.statusCode, evidence.body).toBe(201);
  }
  const preparedResponse = await app.inject({ method: "POST", url: `/v1/production/drafts/${revision.draftId}/prepare`, headers, payload: {} });
  expect(preparedResponse.statusCode, preparedResponse.body).toBe(201);
  const prepared = preparedResponse.json().draft as ProductionDraft;
  for (const card of prepared.reviewCards) {
    const review = await app.inject({ method: "PATCH", url: `/v1/production/drafts/${prepared.draftId}/review-cards/${card.cardId}`, headers, payload: { decision: "fits" } });
    expect(review.statusCode, review.body).toBe(200);
  }
  const approval = await app.inject({ method: "POST", url: `/v1/production/drafts/${prepared.draftId}/decision`, headers, payload: { decision: "approved" } });
  expect(approval.statusCode, approval.body).toBe(201);
  const approvedId = approval.json().approvedProductionSpec.approvedProductionSpecId as string;
  return { app, store, repository, intakeRecords, handoff, rootDir, caseId, rootDraft, revision, prepared, approvedId,
    apply: () => app.inject({ method: "POST", url: `/v1/production/approved-specs/${approvedId}/apply`, headers }) };
}

describe("applied canonical snapshots", () => {
  it("exports exact applied artifacts and frozen recipe content despite same-spec and live-store drift", async () => {
    const fixture = await approvedDescendant();
    const exports = buildPrintExportApp({ rootDir: fixture.rootDir, trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1" } });
    try {
      const apply = await fixture.apply();
      expect(apply.statusCode, apply.body).toBe(200);
      const approved = (await fixture.store.getApprovedProductionSpec(context, fixture.approvedId))!;
      const { productionPlan: plan, purchaseList, recipes } = approved.artifacts;
      await fixture.store.savePurchaseList(context, { ...purchaseList, purchaseListId: "000-decoy-list", items: [{ ...purchaseList.items[0]!, displayName: "WRONG PURCHASE", purchaseQty: 999 }] });
      for (const recipe of recipes) await fixture.repository.save(context, { ...recipe, name: "WRONG LIVE RECIPE", steps: [{ index: 1, instruction: "WRONG LIVE METHOD" }] });
      for (const kind of ["production-plans", "production-folders"]) {
        // A publication restored between the initial route lookup and the
        // anchor read must not make that earlier mutable value exportable.
        const stalePlan = structuredClone(plan);
        stalePlan.productionBatches[0]!.steps = [{ index: 1, instruction: "WRONG STALE PLAN" }];
        stalePlan.kitchenSheets[0]!.title = "WRONG STALE SHEET";
        const initialRead = vi.spyOn(ProductionStore.prototype, "getPlan").mockResolvedValueOnce(stalePlan);
        const response = await exports.inject({ method: "GET", url: `/v1/exports/${kind}/${plan.planId}/html`, headers });
        initialRead.mockRestore();
        expect(response.statusCode, response.body).toBe(200);
        for (const text of [fixture.caseId, fixture.approvedId, approved.sourceDraft.draftId, `Revision ${approved.sourceDraft.revision}`, "Apply", plan.planId, purchaseList.purchaseListId, "35 Portionen", "Chargen: 4", "3,5 kg", "Approved soup", "Approved salad", "synthetic:approved-soup", "Prüfung nötig", "Croissants", "17,5 l"]) expect(response.body).toContain(text);
        for (const text of ["WRONG PURCHASE", "WRONG LIVE", "WRONG STALE", "9876", "9.876"]) expect(response.body).not.toContain(text);
      }
      const csv = await exports.inject({ method: "GET", url: `/v1/exports/purchase-lists/${purchaseList.purchaseListId}/csv`, headers });
      expect(csv.statusCode).toBe(200);
      expect(csv.body).toContain('"Wasser für purchased","17.5","l","17.5","l"');
      expect(csv.body).not.toContain("WRONG");
      const decoyCsv = await exports.inject({ method: "GET", url: "/v1/exports/purchase-lists/000-decoy-list/csv", headers });
      expect(decoyCsv.statusCode, decoyCsv.body).toBe(409);
    } finally { await exports.close(); await fixture.app.close(); }
  });

  it("rejects forbidden changes at every lineage step even when a later revision restores the approved values", async () => {
    const fixture = await approvedDescendant();
    try {
      const predecessor = (await fixture.store.getProductionDraft(context, fixture.revision.draftId))!;
      const mutations: Array<[string, (spec: AcceptedEventSpec) => void]> = [
        ["source", spec => { spec.sourceLineage[0]!.reference = "foreign-source"; }],
        ["budget", spec => { spec.budgetContext!.pricingSummary!.subtotal.amount = 1; }],
        ["attendees", spec => { spec.attendees.expected = 36; }],
        ["date", spec => { spec.event.date = "2026-09-23"; }],
        ["lifecycle", spec => { spec.lifecycle.commercialState = "provisional"; }],
        ["service", spec => { spec.servicePlan.modules = []; spec.servicePlan.serviceForm = "plated"; }],
        ["label", spec => { spec.menuPlan[0]!.label = "foreign-component"; }],
        ["identity", spec => { spec.menuPlan[0]!.componentId = "foreign-component"; }],
        ["order", spec => { spec.menuPlan.reverse(); }],
        ["component count", spec => { spec.menuPlan.pop(); }],
        ["servings", spec => { spec.menuPlan[0]!.servings = 36; }],
        ["assumptions", spec => { spec.assumptions = [{ code: "foreign", message: "Foreign assumption", applied: true }]; }],
        ["evidence", spec => { spec.evidence = [{ kind: "document_ref", sourceId: "foreign", confidence: 1 }]; }],
        ["service modules", spec => { spec.servicePlan.modules = [{ moduleId: "foreign", label: "Foreign service", category: "staffing" }]; }],
        ["uncertainty", spec => { spec.uncertainties = [{ field: "event.schedule", severity: "medium", message: "Independent source requirement" }]; }],
        ["archive", spec => { spec.operationalArchive = { status: "archived", mode: "soft_archive", archivedAt: "2026-09-19T12:00:00.000Z", archivedBy: "synthetic", reasonCode: "operator_rehearsal_cleanup" }; }]
      ];
      for (const [name, mutate] of mutations) {
        const changed = structuredClone(predecessor);
        mutate(changed.draftArtifacts.eventSpec!);
        await productionDecisionRepositoryFor(fixture.store).withTargetCriticalSection(context, { kind: "production_draft", artifactId: predecessor.draftId, revision: predecessor.revision }, scope => scope.setDraft(changed));
        const response = await fixture.apply();
        expect(response.statusCode, `${name}: ${response.body}`).toBe(409);
        expect(await fixture.store.listPlans(context)).toEqual([]);
        expect(await fixture.store.listApplyManifests(context)).toEqual([]);
      }
      await productionDecisionRepositoryFor(fixture.store).withTargetCriticalSection(context, { kind: "production_draft", artifactId: predecessor.draftId, revision: predecessor.revision }, scope => scope.setDraft(predecessor));
      expect((await fixture.apply()).statusCode).toBe(200);
    } finally { await fixture.app.close(); }
  });

  it("fails closed for missing, conflicting and cross-business Apply anchors on all export routes", async () => {
    const fixture = await approvedDescendant();
    const exports = buildPrintExportApp({ rootDir: fixture.rootDir, trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1" } });
    try {
      expect((await fixture.apply()).statusCode).toBe(200);
      const manifest = (await fixture.store.getApplyManifest(context, fixture.approvedId))!;
      const urls = [`/v1/exports/production-plans/${manifest.planId}/html`, `/v1/exports/production-folders/${manifest.planId}/html`, `/v1/exports/purchase-lists/${manifest.purchaseListId}/csv`];
      const assertStatuses = async (status: number, requestHeaders = headers) => {
        for (const url of urls) {
          const response = await exports.inject({ method: "GET", url, headers: requestHeaders });
          expect(response.statusCode, `${url}: ${response.body}`).toBe(status);
          if (status !== 200) expect(response.body).not.toContain("soup ingredient");
        }
      };
      await assertStatuses(403, { ...headers, "x-catering-actor-name": "Angebots-Mitarbeiter" });
      await assertStatuses(404, { ...headers, "x-catering-business-id": "foreign" } as typeof headers);
      await fixture.store.deleteApplyManifestIfExact(context, manifest);
      await assertStatuses(409);
      for (const changed of [{ ...manifest, planId: "foreign-plan" }, { ...manifest, recipeIds: [] }, { ...manifest, purchaseListId: "foreign-list" }, { ...manifest, eventSpecId: "foreign-spec" }]) {
        await fixture.store.insertApplyManifest(context, changed);
        await assertStatuses(409);
        await fixture.store.deleteApplyManifestIfExact(context, changed);
      }
      await fixture.store.insertApplyManifest(context, manifest);
      const productionCase = (await fixture.store.getCase(context, fixture.caseId))!;
      await fixture.store.updateCase(context, fixture.caseId, productionCase.version, { ...productionCase, currentPurchaseListId: "foreign-list", version: productionCase.version + 1 });
      await assertStatuses(409);
      await fixture.store.updateCase(context, fixture.caseId, productionCase.version + 1, { ...productionCase, version: productionCase.version + 2 });
      const list = (await fixture.store.getPurchaseList(context, manifest.purchaseListId))!;
      await fixture.store.deletePurchaseListIfExact(context, list);
      for (const url of urls.slice(0, 2)) {
        const response = await exports.inject({ method: "GET", url, headers });
        expect(response.statusCode, response.body).toBe(409);
      }
      expect((await exports.inject({ method: "GET", url: urls[2]!, headers })).statusCode).toBe(404);
      await fixture.store.insertPurchaseList(context, { ...list, items: [] });
      await assertStatuses(409);
      await fixture.store.deletePurchaseListIfExact(context, { ...list, items: [] });
      await fixture.store.insertPurchaseList(context, list);
      await assertStatuses(200);
    } finally { await exports.close(); await fixture.app.close(); }
  });

  it("rejects all canonical Intake drift against the exact immutable root", async () => {
    const fixture = await approvedDescendant();
    try {
      const original = fixture.handoff.eventSpecSnapshot;
      for (const mutate of [
        (spec: AcceptedEventSpec) => { spec.attendees.expected = 36; },
        (spec: AcceptedEventSpec) => { spec.event.date = "2026-09-23"; },
        (spec: AcceptedEventSpec) => { spec.menuPlan[0]!.productionDecision = { mode: "scratch" }; },
        (spec: AcceptedEventSpec) => { spec.budgetContext!.pricingSummary!.subtotal.amount = 1; }
      ]) {
        const changed = structuredClone(original);
        mutate(changed);
        await fixture.intakeRecords.replaceSpec(context, original, changed);
        const response = await fixture.apply();
        expect(response.statusCode, response.body).toBe(409);
        expect(await fixture.store.listPlans(context)).toEqual([]);
        await fixture.intakeRecords.replaceSpec(context, changed, original);
      }
      expect((await fixture.apply()).statusCode).toBe(200);
    } finally { await fixture.app.close(); }
  });

  it("rejects missing, cyclic, skipped and source-changing ancestry without publishing", async () => {
    const fixture = await approvedDescendant();
    try {
      const original = (await fixture.store.getProductionDraft(context, fixture.revision.draftId))!;
      for (const changed of [
        { ...original, supersedesDraftId: "missing-draft" },
        { ...original, supersedesDraftId: original.draftId },
        { ...original, revision: original.revision + 1 },
        { ...original, source: { ...original.source, sourceRef: "offer-handoff:foreign" } }
      ]) {
        await productionDecisionRepositoryFor(fixture.store).withTargetCriticalSection(context, { kind: "production_draft", artifactId: original.draftId, revision: original.revision }, scope => scope.setDraft(changed));
        const response = await fixture.apply();
        expect(response.statusCode, response.body).toBe(409);
        expect(await fixture.store.listApplyManifests(context)).toEqual([]);
        expect(await fixture.store.listPlans(context)).toEqual([]);
      }
    } finally { await fixture.app.close(); }
  });

  it("rejects ancestry associated with a second case as a controlled conflict", async () => {
    const fixture = await approvedDescendant();
    try {
      const originalCase = (await fixture.store.getCase(context, fixture.caseId))!;
      const foreignCase = { ...originalCase, caseId: "second-case", approvedProductionSpecId: undefined, currentPlanId: undefined, currentPurchaseListId: undefined };
      await fixture.store.createCase(context, foreignCase);
      await fixture.store.appendEvent(context, foreignCase.caseId, { at: fixture.revision.createdAt, kind: "revision_created", role: "system", text: "Conflicting synthetic association", artifactId: fixture.revision.draftId,
        revisionRef: { artifactType: "ProductionDraft", artifactId: fixture.revision.draftId, revision: fixture.revision.revision, createdAt: fixture.revision.createdAt, supersedesArtifactId: fixture.revision.supersedesDraftId } });
      const response = await fixture.apply();
      expect(response.statusCode, response.body).toBe(409);
      expect(await fixture.store.listApplyManifests(context)).toEqual([]);
      expect(await fixture.store.listPlans(context)).toEqual([]);
    } finally { await fixture.app.close(); }
  });

  it("applies the fully reviewed authorized descendant without rewriting Intake or Handoff and retries identically", async () => {
    const fixture = await approvedDescendant();
    try {
      const originalHandoff = structuredClone(fixture.handoff);
      const response = await fixture.apply();
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().plan.productionBatches).toEqual(expect.arrayContaining([expect.objectContaining({ scaledYield: { amount: 35, unit: "servings" }, batchCount: 4 })]));
      expect(response.json().purchaseList.items).toEqual(expect.arrayContaining([expect.objectContaining({ displayName: "Wasser für purchased", purchaseQty: 17.5, purchaseUnit: "l" }), expect.objectContaining({ displayName: "Croissants für purchased", purchaseQty: 35, purchaseUnit: "Stück" })]));
      expect(await fixture.intakeRecords.getSpec(context, fixture.handoff.eventSpecSnapshot.specId)).toEqual(originalHandoff.eventSpecSnapshot);
      expect(fixture.handoff).toEqual(originalHandoff);
      const manifest = await fixture.store.getApplyManifest(context, fixture.approvedId);
      const events = await fixture.store.listEvents(context, fixture.caseId);
      const retry = await fixture.apply();
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json()).toEqual(response.json());
      expect(await fixture.store.getApplyManifest(context, fixture.approvedId)).toEqual(manifest);
      expect(await fixture.store.listEvents(context, fixture.caseId)).toEqual(events);
    } finally { await fixture.app.close(); }
  });
});
