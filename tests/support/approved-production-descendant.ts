import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { buildProductionApp, InMemoryRecipeRepository, ProductionStore, RecipeDiscoveryService } from "@catering/production-service";
import { createEventRequestFromText, normalizeEventRequestToSpec, type AcceptedEventSpec, type CollectionStorageOptions, type ProductionDraft, type ProductionHandoff, type Recipe } from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./in-memory-intake-records-port.js";

export const context = { businessId: "local" };
export const secret = "synthetic-applied-snapshot-test";
export const headers = { "x-catering-actor-name": "Produktions-Mitarbeiter", "x-catering-trusted-secret": secret };

export async function approvedDescendant(pgPool?: CollectionStorageOptions["pgPool"], existing?: { rootDir: string; suffix: string }, options?: { dietaryQuestions?: boolean; extraDraftNotes?: boolean }) {
  const rootDir = existing?.rootDir ?? mkdtempSync(path.join(tmpdir(), "catering-applied-snapshot-"));
  const store = new ProductionStore({ rootDir, pgPool });
  const repository = new InMemoryRecipeRepository({ rootDir, pgPool });
  const intakeRecords = new InMemoryIntakeRecordsPort();
  const normalized = normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "synthetic-applied-source", channel: "text", rawText: "Lunch am 2026-09-22 für 35 Personen." }));
  const spec: AcceptedEventSpec = {
    ...normalized, specId: "spec-applied-snapshot", lifecycle: { commercialState: "accepted" },
    attendees: { expected: 35 },
    event: { ...normalized.event, date: "2026-09-22", schedule: [] },
    menuPlan: ["soup", "salad", "purchased", ...(options?.dietaryQuestions ? ["drinks"] : [])].map(componentId => ({ componentId, label: componentId, servings: 35, serviceStyle: "buffet" })),
    budgetContext: { pricingSummary: { subtotal: { amount: 9876, currency: "EUR" } } },
    uncertainties: [{ field: "event.schedule", severity: "low", message: 'Zeitangabe in "Lunch" ist nicht als vollständiger Termin belastbar.', suggestedQuestion: "Wie lautet das verbindliche Zeitfenster?" }]
  };
  if (options?.dietaryQuestions) spec.uncertainties = [...spec.uncertainties!, ...spec.menuPlan.map(component => ({ field: "menuPlan", severity: "medium" as const,
    message: `Ernährungsangabe für ${component.label}: vegetarisch. Kennzeichnung vor Freigabe anhand des Rezepts prüfen.`,
    suggestedQuestion: `Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für ${component.label}?` }))];
  const handoff: ProductionHandoff = {
    schemaVersion: "1.0", businessId: "local", handoffId: `handoff-applied-snapshot${existing?.suffix ?? ""}`, approvedOfferId: `offer-applied-snapshot${existing?.suffix ?? ""}`, approvalRequestId: `offer-approval-applied-snapshot${existing?.suffix ?? ""}`,
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
  const app = buildProductionApp({ dataRoot: rootDir, pgPool, store, repository, intakeRecords,
    discoveryService: new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }),
    trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1" }, handoffReader: { get: async (actor, id) => actor.businessId === "local" && id === handoff.handoffId ? handoff : undefined } });
  const createdCase = await app.inject({ method: "POST", url: `/v1/production/cases/from-handoff/${handoff.handoffId}`, headers, payload: {} });
  assert.equal(createdCase.statusCode, 201, createdCase.body);
  const caseId = createdCase.json().case.caseId as string;
  const createdDraft = await app.inject({ method: "POST", url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`, headers, payload: { caseId } });
  assert.equal(createdDraft.statusCode, 201, createdDraft.body);
  const rootDraft = createdDraft.json().draft as ProductionDraft;
  const revisedResponse = await app.inject({ method: "POST", url: `/v1/production/drafts/${rootDraft.draftId}/revise`, headers, payload: {
    caseId, expectedRevision: rootDraft.revision,
    componentClassifications: spec.menuPlan.map(component => ({ componentId: component.componentId, menuCategory: "vegetarian" })),
    componentUpdates: [
      ...recipes.map((recipe, index) => ({ componentId: spec.menuPlan[index]!.componentId, productionMode: "scratch", recipeOverrideId: recipe.recipeId, notes: "Explicit reviewed preparation" })),
      ...spec.menuPlan.slice(2).map(component => ({ componentId: component.componentId, productionMode: "convenience_purchase", purchasedElements: ["Croissants", "Wasser"], purchasedQuantities: [{ element: "Croissants", amountPerPerson: 1, unit: "Stück" }, { element: "Wasser", amountPerPerson: 0.5, unit: "l" }], notes: "Explicit purchased quantities" }))
    ], eventSchedule: [{ label: "Service", start: "12:00", end: "14:00" }]
  } });
  assert.equal(revisedResponse.statusCode, 201, revisedResponse.body);
  const revision = revisedResponse.json().draft as ProductionDraft;
  for (const [index, recipe] of recipes.entries()) {
    const componentId = spec.menuPlan[index]!.componentId;
    const evidence = await app.inject({ method: "POST", url: `/v1/production/cases/${caseId}/planning-evidence`, headers, payload: {
      draftId: revision.draftId, draftRevision: revision.revision, componentId, recipeId: recipe.recipeId,
      quantityDecision: { decisionId: `quantity-${componentId}`, eventSpecId: spec.specId, componentId, guestCount: 35, serviceFormat: "buffet", dishRole: "other", basis: "servings_per_person", perUnitAmount: 1, perUnitUnit: "servings", targetAmount: 35, targetUnit: "servings", rationale: "Explicit synthetic portions", evidence: { kind: "operator_instruction", reference: "synthetic-operator" }, reviewStatus: "approved" },
      recipeEventUseReview: { eventSpecId: spec.specId, recipeId: recipe.recipeId, reviewedBy: "Produktions-Mitarbeiter", reviewedAt: "2026-09-19T11:00:00.000Z", decision: "accepted_for_event", confirmations: { quantitiesAndYield: true, methodAndEquipment: true, allergensAndDiet: true, holdingAndRegeneration: true } }
    } });
    assert.equal(evidence.statusCode, 201, evidence.body);
  }
  const preparedResponse = await app.inject({ method: "POST", url: `/v1/production/drafts/${revision.draftId}/prepare`, headers, payload: {} });
  assert.equal(preparedResponse.statusCode, 201, preparedResponse.body);
  const prepared = preparedResponse.json().draft as ProductionDraft;
  if (options?.extraDraftNotes) {
    const raw = (await store.getProductionDraft(context, prepared.draftId))!;
    await store.saveProductionDraft(context, { ...raw, draftArtifacts: { ...raw.draftArtifacts, notes: ["Synthetischer Küchenhinweis"],
      openQuestions: [{ field: "internal.kitchen_note", severity: "low", message: "Synthetischer Hinweis für die Küche" }] } });
  }
  for (const card of prepared.reviewCards) {
    const review = await app.inject({ method: "PATCH", url: `/v1/production/drafts/${prepared.draftId}/review-cards/${card.cardId}`, headers, payload: { decision: "fits" } });
    assert.equal(review.statusCode, 200, review.body);
  }
  const approval = await app.inject({ method: "POST", url: `/v1/production/drafts/${prepared.draftId}/decision`, headers, payload: { decision: "approved" } });
  assert.equal(approval.statusCode, 201, approval.body);
  const approvedId = approval.json().approvedProductionSpec.approvedProductionSpecId as string;
  return { app, store, repository, intakeRecords, handoff, rootDir, caseId, rootDraft, revision, prepared, approvedId,
    apply: () => app.inject({ method: "POST", url: `/v1/production/approved-specs/${approvedId}/apply`, headers }) };
}
