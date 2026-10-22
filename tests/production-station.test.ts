import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildProductionApp, InMemoryRecipeRepository, ProductionStore, RecipeDiscoveryService } from "@catering/production-service";
import { createEventRequestFromText, normalizeEventRequestToSpec, type AcceptedEventSpec, type ProductionDraft, type ProductionHandoff } from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import { buildResolvedRecipePlanningArtifacts } from "../production-service/src/rules/planning-resolved-recipe-artifacts.js";
import { procurementKitchenSheet, unresolvedKitchenSheet } from "../production-service/src/rules/production-sheet-builders.js";
import { specEditSnapshotFromSpec } from "../backoffice-ui/src/production-spec-edit-snapshot.js";
import { buildProductionSpecEditPersistAction } from "../backoffice-ui/src/production-spec-edit-persist-action.js";
import { buildSpecEditUpdateInput } from "../backoffice-ui/src/production-spec-edit-update.js";

const stations = ["hot-kitchen", "cold-kitchen", "beverage-station", "pastry"] as const;
const actor = { businessId: "local" };
const headers = { "x-catering-actor-name": "Produktions-Mitarbeiter", "x-catering-trusted-secret": "synthetic-station-test" };

async function fixture() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-station-"));
  const store = new ProductionStore({ rootDir });
  const repository = new InMemoryRecipeRepository({ rootDir });
  const intakeRecords = new InMemoryIntakeRecordsPort();
  const base = normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "synthetic-station", channel: "text", rawText: "Lunch am 2026-11-13 für 100 Personen." }));
  const spec: AcceptedEventSpec = { ...base, lifecycle: { commercialState: "accepted" }, uncertainties: [],
    budgetContext: { pricingSummary: { subtotal: { amount: 1000, currency: "EUR" } } },
    menuPlan: stations.map((_, index) => ({ componentId: `dish-${index}`, label: "Dessert", servings: 25, menuCategory: "vegetarian",
      productionDecision: { mode: "external_finished", purchasedElements: ["Dessert"], purchasedQuantities: [{ element: "Dessert", amountPerPerson: 0.25, unit: "Stück" }] } })) };
  await intakeRecords.insertSpec(actor, spec);
  const handoff: ProductionHandoff = { schemaVersion: "1.0", businessId: "local", handoffId: "handoff-station", approvedOfferId: "offer-station", approvalRequestId: "approval-station", createdAt: "2026-10-22T10:00:00Z", eventSpecSnapshot: spec, pricingSnapshot: spec.budgetContext!.pricingSummary!, source: { draftId: "offer-draft-station", revision: 1, selectedVariantId: "variant-station" } };
  const app = buildProductionApp({ dataRoot: rootDir, store, repository, intakeRecords, discoveryService: new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }), trustedActorSecret: headers["x-catering-trusted-secret"], env: { CATERING_DEV_AUTH: "1" }, handoffReader: { get: async (_actor, id) => id === handoff.handoffId ? handoff : undefined } });
  const createdCase = await app.inject({ method: "POST", url: `/v1/production/cases/from-handoff/${handoff.handoffId}`, headers, payload: {} });
  expect(createdCase.statusCode, createdCase.body).toBe(201);
  const caseId = createdCase.json().case.caseId as string;
  const createdDraft = await app.inject({ method: "POST", url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`, headers, payload: { caseId } });
  expect(createdDraft.statusCode, createdDraft.body).toBe(201);
  const draft = createdDraft.json().draft as ProductionDraft;
  const revise = (current: ProductionDraft, updates: unknown[], override: object = {}) => app.inject({ method: "POST", url: `/v1/production/drafts/${current.draftId}/revise`, headers, payload: { caseId, expectedRevision: current.revision, componentClassifications: [], componentUpdates: updates, ...override } });
  return { app, store, draft, caseId, revise };
}

describe("explicit production work areas", () => {
  it("round-trips a chosen area and an explicit clearing through the existing editor", () => {
    const snapshot = specEditSnapshotFromSpec({ event: {}, attendees: { expected: 100 }, menuPlan: [{ componentId: "dish", label: "Dessert", productionStation: "pastry" }] });
    expect(snapshot.components[0]![1]).toMatchObject({ productionStation: "pastry" });
    const state = { ...snapshot, componentStates: Object.fromEntries(snapshot.components) };
    expect(buildSpecEditUpdateInput(state).componentUpdates?.[0]).toMatchObject({ productionStation: "pastry" });
    state.componentStates.dish!.productionStation = "";
    expect(buildSpecEditUpdateInput(state).componentUpdates?.[0]).toMatchObject({ productionStation: "" });
  });


  it.each(["hot-kitchen", ""] as const)("sends only an explicit changed area (%s) through the pinned draft editor", async productionStation => {
    const source = { specId: "station-editor", event: { type: "meeting" }, attendees: { expected: 100 }, menuPlan: [{ componentId: "dessert", label: "Dessert", productionStation: "pastry" }] };
    const snapshot = specEditSnapshotFromSpec(source);
    const componentStates = Object.fromEntries(snapshot.components);
    componentStates.dessert!.productionStation = productionStation;
    const draft = { draftId: "draft-station-editor", revision: 2, status: "pending_review" as const, createdAt: "2026-10-22", source: { sourceRef: "offer-handoff:station" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
    const context = { caseId: "case-station-editor", draft };
    const revise = vi.fn(async () => ({ draft: { ...draft, draftId: "draft-station-editor-r3", revision: 3 } }));
    const updateAcceptedSpec = vi.fn();
    await buildProductionSpecEditPersistAction({ editingSpecId: source.specId, productionDraftContext: context, getCurrentProductionDraftContext: () => context, reviseProductionDraft: revise, updateAcceptedSpec,
      buildCurrentSpecUpdateInput: () => buildSpecEditUpdateInput({ ...snapshot, componentStates }), setProductionWorkspaceCleared: vi.fn(), setFocusedProductionSpecId: vi.fn(), resetSpecEdit: vi.fn(), refreshDashboard: async () => undefined, setNotice: vi.fn() })();
    expect(revise).toHaveBeenCalledWith(draft.draftId, { caseId: context.caseId, expectedRevision: 2, componentClassifications: [], componentUpdates: [{ componentId: "dessert", productionStation }] });
    expect(updateAcceptedSpec).not.toHaveBeenCalled();
  });

  it("saves all four areas immutably, retains them on unrelated revisions and freezes them in the approved plan", async () => {
    const { app, store, draft, revise } = await fixture();
    try {
      const response = await revise(draft, stations.map((productionStation, index) => ({ componentId: `dish-${index}`, productionStation })));
      expect(response.statusCode, response.body).toBe(201);
      const revised = response.json().draft as ProductionDraft;
      expect(revised.draftArtifacts.eventSpec!.menuPlan.map(c => c.productionStation)).toEqual(stations);
      expect((await store.getProductionDraft(actor, draft.draftId))!.draftArtifacts.eventSpec!.menuPlan.every(c => c.productionStation === undefined)).toBe(true);
      const unrelated = await revise(revised, [{ componentId: "dish-0", notes: "Nur der Servierhinweis ändert sich." }]);
      expect(unrelated.statusCode, unrelated.body).toBe(201);
      const retained = unrelated.json().draft as ProductionDraft;
      expect(retained.draftArtifacts.eventSpec!.menuPlan.map(c => c.productionStation)).toEqual(stations);
      const preparedResponse = await app.inject({ method: "POST", url: `/v1/production/drafts/${retained.draftId}/prepare`, headers, payload: {} });
      expect(preparedResponse.statusCode, preparedResponse.body).toBe(201);
      const prepared = preparedResponse.json().draft as ProductionDraft;
      expect(prepared.draftArtifacts.productionPlan!.kitchenSheets.map(s => s.station)).toEqual(stations);
      for (const card of prepared.reviewCards) {
        const review = await app.inject({ method: "PATCH", url: `/v1/production/drafts/${prepared.draftId}/review-cards/${card.cardId}`, headers, payload: { decision: "fits" } });
        expect(review.statusCode, review.body).toBe(200);
      }
      const approval = await app.inject({ method: "POST", url: `/v1/production/drafts/${prepared.draftId}/decision`, headers, payload: { decision: "approved" } });
      expect(approval.statusCode, approval.body).toBe(201);
      const approved = approval.json().approvedProductionSpec;
      expect(approved.artifacts.productionPlan.kitchenSheets.map((s: { station: string }) => s.station)).toEqual(stations);
      const applied = await app.inject({ method: "POST", url: `/v1/production/approved-specs/${approved.approvedProductionSpecId}/apply`, headers });
      expect(applied.statusCode, applied.body).toBe(200);
      const frozen = (await store.getApprovedProductionSpec(actor, approved.approvedProductionSpecId))!;
      expect(frozen.artifacts.productionPlan.kitchenSheets.map(s => s.station)).toEqual(stations);
      expect((await revise(prepared, [{ componentId: "dish-0", productionStation: "" }])).statusCode).toBe(409);
      expect((await store.getApprovedProductionSpec(actor, approved.approvedProductionSpecId))!.artifacts).toEqual(frozen.artifacts);
    } finally { await app.close(); }
  });

  it("clears only an explicitly cleared area and rejects invalid, stale or foreign-case assignments", async () => {
    const { app, store, draft, revise } = await fixture();
    try {
      for (const productionStation of ["oven", null, ["hot-kitchen"], 3]) {
        expect((await revise(draft, [{ componentId: "dish-0", productionStation }])).statusCode).toBe(422);
      }
      expect((await revise(draft, [{ componentId: "dish-0", productionStation: "pastry" }], { caseId: "other-case" })).statusCode).toBe(409);
      const set = await revise(draft, [{ componentId: "dish-0", productionStation: "pastry" }]);
      expect(set.statusCode, set.body).toBe(201);
      const current = set.json().draft as ProductionDraft;
      expect((await revise(current, [{ componentId: "dish-0", productionStation: "" }], { expectedRevision: draft.revision })).statusCode).toBe(409);
      const cleared = await revise(current, [{ componentId: "dish-0", productionStation: "" }]);
      expect(cleared.statusCode, cleared.body).toBe(201);
      expect(cleared.json().draft.draftArtifacts.eventSpec.menuPlan[0]).not.toHaveProperty("productionStation");
      expect((await store.getProductionDraft(actor, current.draftId))!.draftArtifacts.eventSpec!.menuPlan[0]!.productionStation).toBe("pastry");
    } finally { await app.close(); }
  });

  it.each(stations)("uses explicit %s in recipe batches and marks label-only fallback as unverified", productionStation => {
    const spec = { specId: "spec-station", event: { date: "2026-11-13" } } as AcceptedEventSpec;
    const component = { componentId: "dessert", label: "Dessert", productionStation };
    const recipe = { recipeId: "recipe", name: "Dessert", baseYield: { servings: 1, unit: "servings" }, ingredients: [], steps: [], scalingRules: { defaultLossFactor: 1 }, source: { reference: "synthetic" } } as any;
    const artifacts = buildResolvedRecipePlanningArtifacts({ eventSpec: spec, component, recipe, bridgeResult: { status: "ready_for_scaling", eventSpecId: spec.specId, componentId: component.componentId, recipeId: recipe.recipeId, targetServings: 25, targetOutput: { amount: 25, unit: "servings" }, conversionMethod: "direct_servings", issues: [] } });
    expect(artifacts.batch.station).toBe(productionStation);
    expect(artifacts.kitchenSheet.station).toBe(productionStation);
    expect(procurementKitchenSheet(component, 25, spec).station).toBe(productionStation);
    expect(unresolvedKitchenSheet(component, 25, "Rezept fehlt", spec).station).toBe(productionStation);
    expect(procurementKitchenSheet({ componentId: "dessert", label: "Dessert" }, 25, spec).station).toContain("Vorschlag");
    expect(artifacts.batch.ingredients).toEqual([]);
  });
});
