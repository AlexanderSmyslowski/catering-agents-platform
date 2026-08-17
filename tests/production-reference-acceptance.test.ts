import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  createCuratedOfferDraft,
  createEventRequestFromManualForm,
  internalRecipes,
  loadCuratedOfferPackages,
  normalizeEventRequestToSpec,
  type OfferDraft,
  type Recipe
} from "@catering/shared-core";
import { AuditLogStore } from "../shared-core/src/index.js";
import {
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  RecipeDiscoveryService
} from "@catering/production-service";
import {
  evaluateProductionReferenceAcceptance,
  resolveProductionReferenceValidatedEvidence,
  type ProductionReferenceAcceptanceInput
} from "../shared-core/src/production-reference-acceptance.js";
import { createTrustedProductionReferencePersistenceCapability } from "../shared-core/src/production-reference-acceptance-internal.js";
import * as publicSharedCore from "../shared-core/src/index.js";
import { createOfferProductionReferencePersistenceCapability } from "../offer-service/src/production-reference-acceptance-boundary.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";

const syntheticSourceHash = "sha256:" + "a".repeat(64);

function loadKoepffRecipes(): Recipe[] {
  return readdirSync(path.join(process.cwd(), "data-seeds/recipes-koepff"))
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => JSON.parse(readFileSync(
      path.join(process.cwd(), "data-seeds/recipes-koepff", entry),
      "utf8"
    )) as Recipe);
}

function syntheticOffer(): OfferDraft {
  const request = createEventRequestFromManualForm({
    requestId: "reference-acceptance-synthetic",
    eventType: "internes Probe-Catering",
    eventDate: "2099-10-15",
    attendeeCount: 42,
    serviceForm: "buffet",
    menuItems: ["Filterkaffee Station"],
    notes: "Synthetischer Testlauf aus der vorhandenen Szenariokarte."
  });
  return createCuratedOfferDraft(request, loadCuratedOfferPackages().find(
    (item) => item.id === "business_lunch_basic"
  )!);
}

async function syntheticProductionArtifacts() {
  const root = mkdtempSync(path.join(tmpdir(), "catering-reference-acceptance-"));
  const repository = new InMemoryRecipeRepository({ rootDir: root });
  await repository.save({ businessId: "local" }, internalRecipes[0]!);
  const request = createEventRequestFromManualForm({
    requestId: "reference-acceptance-synthetic",
    eventType: "internes Probe-Catering",
    eventDate: "2099-10-15",
    attendeeCount: 42,
    serviceForm: "buffet",
    menuItems: ["Filterkaffee Station"],
    notes: "Synthetischer Testlauf aus der vorhandenen Szenariokarte."
  });
  const spec = normalizeEventRequestToSpec(request, {
    sourceType: "manual_input",
    reference: request.requestId,
    commercialState: "manual"
  });
  const plannedSpec = {
    ...spec,
    menuPlan: spec.menuPlan.map((component) => ({
      ...component,
      menuCategory: "classic" as const,
      recipeOverrideId: "recipe-filter-coffee",
      productionDecision: { mode: "scratch" as const }
    }))
  };
  const artifacts = await buildProductionArtifacts(
    plannedSpec,
    new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }),
    { context: { businessId: "local" } }
  );
  return { root, artifacts };
}

function acceptanceInput(
  artifacts: Awaited<ReturnType<typeof syntheticProductionArtifacts>>["artifacts"],
  overrides: Partial<ProductionReferenceAcceptanceInput> = {}
): ProductionReferenceAcceptanceInput {
  return {
    caseId: "reference-acceptance-synthetic",
    source: {
      expectedCaseId: "reference-acceptance-synthetic",
      expectedSha256: syntheticSourceHash,
      observedSha256: syntheticSourceHash,
      lineageReferences: ["audit:source-reference-acceptance-synthetic"]
    },
    offer: {
      offerId: "offer-reference-acceptance-synthetic",
      pricingSummary: syntheticOffer().pricingSummary,
      pricingBasis: "module_catalog_estimate",
      approved: true,
      reviewStatus: {
        priceReviewStatus: "verified",
        taxReviewStatus: "verified",
        allergenReviewStatus: "verified",
        hygieneTemperatureReviewStatus: "verified",
        sourceSecured: true,
        publishApproved: true
      }
    },
    production: {
      plan: artifacts.productionPlan,
      purchaseList: artifacts.purchaseList,
      recipes: internalRecipes
    },
    operatorAcceptance: {
      accepted: true,
      acceptedBy: "synthetic-kitchen-reviewer",
      acceptedAt: "2099-10-15T12:00:00.000Z",
      rescueChatUsed: false
    },
    ...overrides
  };
}

function syntheticEvidenceInput() {
  return {
    sourceCaseId: "reference-acceptance-synthetic",
    sourceSha256: syntheticSourceHash,
    sourceLineageId: "audit:source-reference-acceptance-synthetic",
    eventSpecId: "spec-reference-acceptance-synthetic",
    offerId: "offer-reference-acceptance-synthetic",
    approvalRequestId: "approval-reference-acceptance-synthetic",
    handoffId: "handoff-reference-acceptance-synthetic",
    approvalAuditId: "audit-approval-reference-acceptance-synthetic",
    handoffAuditId: "audit-handoff-reference-acceptance-synthetic",
    kitchenAcceptanceAuditId: "audit-kitchen-reference-acceptance-synthetic",
    pricingSummary: syntheticOffer().pricingSummary,
    pricingBasis: "module_catalog_estimate",
    rescueChatUsed: false
  } as const;
}

async function createPersistedFullCostEvidence() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-reference-full-cost-persisted-"));
  const store = new OfferStore({ rootDir });
  const auditLog = new AuditLogStore({ rootDir });
  const trustedSecret = "reference-full-cost-test-secret";
  const headers = {
    "x-catering-trusted-secret": trustedSecret,
    "x-catering-actor-name": "Angebots-Mitarbeiter",
    "x-catering-business-id": "local"
  };
  const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });

  const caseResponse = await app.inject({
    method: "POST",
    url: "/v1/offers/cases",
    headers,
    payload: { eventTypeLabel: "Synthetischer Full-Cost-Referenzfall", attendeeCount: 12 }
  });
  expect(caseResponse.statusCode).toBe(201);
  const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
  const draftResponse = await app.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers,
    payload: { caseId, text: "Synthetischer Full-Cost-Testfall." }
  });
  expect(draftResponse.statusCode).toBe(201);
  const draft = draftResponse.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
  const persistedDraft = await store.getDraft({ businessId: "local" }, draft.draftId);
  if (!persistedDraft) throw new Error("OfferDraft wurde nicht persistiert.");
  const reviewedDraft = {
    ...persistedDraft,
    revision: persistedDraft.revision + 1,
    reviewStatus: {
      priceReviewStatus: "verified" as const,
      taxReviewStatus: "verified" as const,
      allergenReviewStatus: "verified" as const,
      hygieneTemperatureReviewStatus: "verified" as const,
      sourceSecured: true,
      publishApproved: true
    }
  };
  await store.saveDraft({ businessId: "local" }, reviewedDraft);
  const decisionResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/drafts/${draft.draftId}/decision`,
    headers,
    payload: { decision: "approved", revision: reviewedDraft.revision, variantId: draft.variantSet[0]!.variantId }
  });
  expect(decisionResponse.statusCode).toBe(201);
  const approvedOfferId = decisionResponse.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
  const handoffResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
    headers,
    payload: {}
  });
  expect(handoffResponse.statusCode).toBe(201);
  const handoff = handoffResponse.json<{
    handoff: { handoffId: string; approvalRequestId: string; approvedOfferId: string }
  }>().handoff;

  const context = { businessId: "local" };
  const approval = await store.getApproval(context, handoff.approvalRequestId);
  const approvedOffer = await store.getApprovedOffer(context, approvedOfferId);
  const persistedHandoff = await store.getHandoff(context, handoff.handoffId);
  const sourceSha256 = syntheticSourceHash;
  const sourceAudit = await auditLog.logFor(context, {
    action: "reference.source_verified",
    entityType: "OfferCase",
    entityId: caseId,
    actor: { name: "Full-Cost-Test", source: "synthetic" },
    summary: "Synthetische Quelle geprüft.",
    details: { sourceCaseId: caseId, sourceSha256 }
  });
  const kitchenAudit = await auditLog.logFor(context, {
    action: "production.kitchen_acceptance",
    entityType: "ProductionHandoff",
    entityId: handoff.handoffId,
    actor: { name: "Test-Küche", source: "synthetic" },
    summary: "Synthetische Küchenabnahme ohne Rettungschat.",
    details: { rescueChatUsed: false }
  });
  const audits = await auditLog.listRecentFor(context, 50);
  const approvalAudit = audits.find((entry) => entry.action === "offer.approved" && entry.entityId === approvedOfferId);
  const handoffAudit = audits.find((entry) => entry.action === "offer.production_handoff_created" && entry.entityId === handoff.handoffId);
  if (!approval || !approvedOffer || !persistedHandoff || !approvalAudit || !handoffAudit) {
    throw new Error("Persistierter Full-Cost-Testpfad konnte die Approval-/Handoff-/Audit-Kette nicht vollständig lesen.");
  }

  const input = {
    sourceCaseId: caseId,
    sourceSha256,
    sourceLineageId: `audit:${sourceAudit.auditId}`,
    eventSpecId: persistedHandoff.eventSpecSnapshot.specId,
    offerId: approvedOffer.approvedOfferId,
    approvalRequestId: approval.approvalRequestId,
    handoffId: persistedHandoff.handoffId,
    approvalAuditId: approvalAudit.auditId,
    handoffAuditId: handoffAudit.auditId,
    kitchenAcceptanceAuditId: kitchenAudit.auditId,
    pricingSummary: approvedOffer.pricingSummary,
    pricingBasis: "full_cost_model" as const,
    rescueChatUsed: false as const
  };
  const evidence = await resolveProductionReferenceValidatedEvidence(
    input,
    createOfferProductionReferencePersistenceCapability({ store, auditLog, context })
  );
  return { app, rootDir, input, evidence };
}

function validatedSyntheticEvidence() {
  const input = syntheticEvidenceInput();
  return resolveProductionReferenceValidatedEvidence(input, createTrustedProductionReferencePersistenceCapability(() => ({
    sourceCaseId: input.sourceCaseId,
    sourceSha256: input.sourceSha256,
    sourceLineageId: input.sourceLineageId,
    eventSpecId: input.eventSpecId,
    approvalRequestId: input.approvalRequestId,
    approvedOfferId: input.offerId,
    handoffId: input.handoffId,
    approvalAuditId: input.approvalAuditId,
    handoffAuditId: input.handoffAuditId,
    kitchenAcceptanceAuditId: input.kitchenAcceptanceAuditId,
    acceptedBy: "synthetic-kitchen-reviewer",
    acceptedAt: "2099-10-15T12:00:00.000Z",
    pricingSummary: input.pricingSummary,
    pricingBasis: input.pricingBasis,
    rescueChatUsed: input.rescueChatUsed
  })))!;
}

describe("production reference acceptance contract", () => {
  it("does not expose a caller-reader capability factory through the public core API", () => {
    expect(publicSharedCore).toHaveProperty("evaluateProductionReferenceAcceptance");
    for (const privateExport of [
      "createProductionReferencePersistenceCapability",
      "createTrustedProductionReferencePersistenceCapability",
      "issueTrustedProductionReferenceValidatedEvidence",
      "isRegisteredProductionReferencePersistenceCapability",
      "isTrustedProductionReferenceValidatedEvidence"
    ]) {
      expect(publicSharedCore).not.toHaveProperty(privateExport);
    }
  });

  it("rejects a caller callback capability because no public reader factory exists", () => {
    const input = syntheticEvidenceInput();
    const fakeSnapshot = {
      sourceCaseId: input.sourceCaseId,
      sourceSha256: input.sourceSha256,
      sourceLineageId: input.sourceLineageId,
      eventSpecId: input.eventSpecId,
      approvalRequestId: input.approvalRequestId,
      approvedOfferId: input.offerId,
      handoffId: input.handoffId,
      approvalAuditId: input.approvalAuditId,
      handoffAuditId: input.handoffAuditId,
      kitchenAcceptanceAuditId: input.kitchenAcceptanceAuditId,
      pricingSummary: input.pricingSummary,
      pricingBasis: input.pricingBasis,
      rescueChatUsed: input.rescueChatUsed
    };

    expect(publicSharedCore).not.toHaveProperty("createProductionReferencePersistenceCapability");
    expect(resolveProductionReferenceValidatedEvidence(input, {
      readPersistedEvidence: () => ({ ...fakeSnapshot, approvedOfferId: input.offerId })
    } as never)).toBeUndefined();
  });

  it("keeps the existing Koepff reference blocked when source and review evidence are absent", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const expectation = JSON.parse(readFileSync(
        path.join(process.cwd(), "tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json"),
        "utf8"
      )) as { caseId: string; sourceSha256: string };
      const result = evaluateProductionReferenceAcceptance({
        caseId: expectation.caseId,
        source: {
          expectedCaseId: expectation.caseId,
          expectedSha256: expectation.sourceSha256,
          lineageReferences: []
        },
        offer: {
          offerId: "koepff-offer-not-persisted",
          pricingBasis: "module_catalog_estimate",
          approved: false,
          reviewStatus: {
            priceReviewStatus: "review_required",
            taxReviewStatus: "review_required",
            allergenReviewStatus: "review_required",
            hygieneTemperatureReviewStatus: "review_required",
            sourceSecured: false,
            publishApproved: false
          }
        },
        production: {
          plan: artifacts.productionPlan,
          purchaseList: artifacts.purchaseList,
          recipes: loadKoepffRecipes()
        }
      });

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
        "source_provenance_missing",
        "offer_review_incomplete",
        "recipe_missing",
        "operator_kitchen_acceptance_missing"
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reaches ready only when provenance, production, purchasing, recipes and kitchen evidence are complete", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence()
      }));

      expect(result.status).toBe("ready");
      expect(result.blockers).toEqual([]);
      expect(result.checklist.every((item) => item.status === "passed")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never treats missing allergens or a parallel GPT rescue chat as kitchen acceptance", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const recipeWithoutAllergens = internalRecipes.map((recipe) =>
        recipe.recipeId === "recipe-filter-coffee" ? { ...recipe, allergens: undefined as never } : recipe
      );
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        production: {
          plan: artifacts.productionPlan,
          purchaseList: artifacts.purchaseList,
          recipes: recipeWithoutAllergens
        },
        operatorAcceptance: {
          accepted: true,
          acceptedBy: "synthetic-kitchen-reviewer",
          acceptedAt: "2099-10-15T12:00:00.000Z",
          rescueChatUsed: true
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
        "recipe_allergen_status_missing",
        "kitchen_acceptance_rescue_chat_used"
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks a complete-looking bundle without resolver-issued persisted evidence", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("persisted_evidence_unverified");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects caller-shaped evidence even when its IDs look plausible", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const issued = validatedSyntheticEvidence();
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: { ...issued }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("persisted_evidence_unverified");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not treat a caller-supplied persisted snapshot as a resolver capability", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const input = {
        sourceCaseId: "caller-fake-case",
        sourceSha256: syntheticSourceHash,
        sourceLineageId: "caller-fake-audit",
        eventSpecId: artifacts.productionPlan.eventSpecId,
        offerId: "caller-fake-offer",
        approvalRequestId: "caller-fake-approval",
        handoffId: "caller-fake-handoff",
        approvalAuditId: "caller-fake-approval-audit",
        handoffAuditId: "caller-fake-handoff-audit",
        kitchenAcceptanceAuditId: "caller-fake-kitchen-audit",
        pricingSummary: syntheticOffer().pricingSummary,
        pricingBasis: "module_catalog_estimate" as const,
        rescueChatUsed: false as const
      };
      const result = resolveProductionReferenceValidatedEvidence(input, {
        ...input,
        approvedOfferId: input.offerId
      } as never);

      expect(result).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires an explicit false rescue-chat decision", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        operatorAcceptance: {
          accepted: true,
          acceptedBy: "synthetic-kitchen-reviewer",
          acceptedAt: "2099-10-15T12:00:00.000Z"
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("kitchen_acceptance_rescue_chat_unproven");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("binds the evaluated pricing summary to the resolver-issued evidence", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const baseline = acceptanceInput(artifacts);
      const result = evaluateProductionReferenceAcceptance({
        ...baseline,
        validatedEvidence: validatedSyntheticEvidence(),
        offer: {
          ...baseline.offer,
          pricingSummary: {
            ...baseline.offer.pricingSummary!,
            subtotal: {
              ...baseline.offer.pricingSummary!.subtotal,
              amount: baseline.offer.pricingSummary!.subtotal.amount + 1
            }
          }
        }
      });

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("persisted_offer_evidence_mismatch");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the resolver-issued pricing evidence immutable after caller mutation", async () => {
    const input = {
      ...syntheticEvidenceInput(),
      pricingSummary: {
        ...syntheticEvidenceInput().pricingSummary,
        subtotal: { ...syntheticEvidenceInput().pricingSummary.subtotal }
      }
    };
    const originalAmount = input.pricingSummary.subtotal.amount;
    const token = resolveProductionReferenceValidatedEvidence(
      input,
      createTrustedProductionReferencePersistenceCapability(() => ({
        sourceCaseId: input.sourceCaseId,
        sourceSha256: input.sourceSha256,
        sourceLineageId: input.sourceLineageId,
        eventSpecId: input.eventSpecId,
        approvalRequestId: input.approvalRequestId,
        approvedOfferId: input.offerId,
        handoffId: input.handoffId,
        approvalAuditId: input.approvalAuditId,
        handoffAuditId: input.handoffAuditId,
        kitchenAcceptanceAuditId: input.kitchenAcceptanceAuditId,
        acceptedBy: "synthetic-kitchen-reviewer",
        acceptedAt: "2099-10-15T12:00:00.000Z",
        pricingSummary: input.pricingSummary,
        pricingBasis: input.pricingBasis,
        rescueChatUsed: input.rescueChatUsed
      }))
    );

    expect(token).toBeDefined();
    input.pricingSummary.subtotal.amount = originalAmount + 99;
    expect(token?.pricingSummary.subtotal.amount).toBe(originalAmount);
    expect(Object.isFrozen(token?.pricingSummary)).toBe(true);
    expect(Object.isFrozen(token?.pricingSummary.subtotal)).toBe(true);
  });

  it("does not treat an unsupported full-cost claim as a complete cost basis", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    const persisted = await createPersistedFullCostEvidence();
    try {
      expect(persisted.evidence).toBeDefined();
      const validatedEvidence = persisted.evidence;
      const fullCostAcceptanceInput = acceptanceInput(artifacts, {
        caseId: persisted.input.sourceCaseId,
        source: {
          expectedCaseId: persisted.input.sourceCaseId,
          expectedSha256: persisted.input.sourceSha256,
          observedSha256: persisted.input.sourceSha256,
          lineageReferences: [persisted.input.sourceLineageId]
        },
        offer: {
          ...acceptanceInput(artifacts).offer,
          offerId: persisted.input.offerId,
          pricingBasis: "full_cost_model"
        },
        production: {
          ...acceptanceInput(artifacts).production,
          plan: {
            ...artifacts.productionPlan,
            eventSpecId: persisted.input.eventSpecId
          }
        },
        validatedEvidence
      });
      const result = evaluateProductionReferenceAcceptance(fullCostAcceptanceInput);

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).not.toContain("persisted_evidence_unverified");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("full_cost_basis_unavailable");

      const missingEvidenceResult = evaluateProductionReferenceAcceptance({
        ...fullCostAcceptanceInput,
        validatedEvidence: undefined
      });
      expect(missingEvidenceResult.blockers.map((blocker) => blocker.code)).toContain("persisted_evidence_unverified");
    } finally {
      rmSync(root, { recursive: true, force: true });
      await persisted.app.close();
      rmSync(persisted.rootDir, { recursive: true, force: true });
    }
  });

  it("requires readiness rows to match every production batch and kitchen sheet", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          plan: {
            ...artifacts.productionPlan,
            componentReadiness: artifacts.productionPlan.componentReadiness?.map((entry) => ({
              ...entry,
              componentId: "unrelated-component"
            }))
          }
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("production_component_readiness_mismatch");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires exactly one approved recipe selection for every recipe-bound batch", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const recipeBoundBatch = artifacts.productionPlan.productionBatches[0]!;
      const cases = [
        [],
        [{ ...artifacts.productionPlan.recipeSelections[0]!, componentId: recipeBoundBatch.componentId }, { ...artifacts.productionPlan.recipeSelections[0]!, componentId: recipeBoundBatch.componentId }],
        [{ ...artifacts.productionPlan.recipeSelections[0]!, componentId: recipeBoundBatch.componentId, recipeId: "foreign-recipe" }]
      ];
      for (const recipeSelections of cases) {
        const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
          validatedEvidence: validatedSyntheticEvidence(),
          production: {
            ...acceptanceInput(artifacts).production,
            plan: { ...artifacts.productionPlan, recipeSelections }
          }
        }));
        expect(result.status).toBe("blocked");
        expect(result.blockers.map((blocker) => blocker.code)).toContain("production_recipe_selection_mismatch");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires each kitchen sheet to use the recipe selected by its batch", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const recipeBoundBatch = artifacts.productionPlan.productionBatches.find((batch) => batch.recipeId)!;
      const alternateRecipe = internalRecipes.find((recipe) => recipe.recipeId !== recipeBoundBatch.recipeId)!;
      const plan = {
        ...artifacts.productionPlan,
        kitchenSheets: artifacts.productionPlan.kitchenSheets.map((sheet) =>
          sheet.componentId === recipeBoundBatch.componentId
            ? { ...sheet, recipeId: alternateRecipe.recipeId }
            : sheet
        )
      };

      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          plan
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("kitchen_sheet_incomplete");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not let procurement notes bypass a recipe-bound kitchen-sheet binding", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const recipeBoundBatch = artifacts.productionPlan.productionBatches.find((batch) => batch.recipeId);
      expect(recipeBoundBatch?.recipeId).toBeTruthy();
      const plan = {
        ...artifacts.productionPlan,
        kitchenSheets: artifacts.productionPlan.kitchenSheets.map((sheet) =>
          sheet.componentId === recipeBoundBatch?.componentId
            ? {
              ...sheet,
              recipeId: undefined,
              ingredients: [],
              steps: [],
              procurementNotes: ["Extern beziehen und bei Wareneingang prüfen."]
            }
            : sheet
        )
      };

      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          plan
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("kitchen_sheet_incomplete");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks allergen and approval status only for selected recipes", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const selectedRecipeIds = new Set(artifacts.productionPlan.recipeSelections.map((selection) => selection.recipeId));
      const unusedRecipe = internalRecipes.find((recipe) => !selectedRecipeIds.has(recipe.recipeId));
      expect(unusedRecipe).toBeDefined();
      const recipes = internalRecipes.map((recipe) => recipe.recipeId === unusedRecipe?.recipeId
        ? {
          ...recipe,
          source: { ...recipe.source, approvalState: "rejected" as const },
          allergens: undefined as never,
          dietTags: undefined as never
        }
        : recipe);

      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          recipes
        }
      }));

      expect(result.status).toBe("ready");
      expect(result.blockers).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires procurement notes when a component has no recipe", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const procurementPlan = (procurementNotes: string[]) => ({
        ...artifacts.productionPlan,
        productionBatches: artifacts.productionPlan.productionBatches.map((batch) => ({
          ...batch,
          recipeId: "",
          ingredients: []
        })),
        recipeSelections: [],
        kitchenSheets: artifacts.productionPlan.kitchenSheets.map((sheet) => ({
          ...sheet,
          recipeId: undefined,
          ingredients: [],
          steps: [],
          procurementNotes
        }))
      });

      for (const procurementNotes of [[], [""], ["   "]]) {
        const incomplete = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
          validatedEvidence: validatedSyntheticEvidence(),
          production: {
            ...acceptanceInput(artifacts).production,
            plan: procurementPlan(procurementNotes),
            recipes: []
          }
        }));
        expect(incomplete.status).toBe("blocked");
        expect(incomplete.blockers.map((blocker) => blocker.code)).toContain("kitchen_sheet_incomplete");
      }

      const complete = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          plan: procurementPlan(["Extern beziehen und bei Wareneingang prüfen."]),
          recipes: []
        }
      }));
      expect(complete.status).toBe("ready");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires a recipe-less procurement sheet to omit recipe identity", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const plan = {
        ...artifacts.productionPlan,
        productionBatches: artifacts.productionPlan.productionBatches.map((batch) => ({
          ...batch,
          recipeId: "",
          ingredients: []
        })),
        recipeSelections: [],
        kitchenSheets: artifacts.productionPlan.kitchenSheets.map((sheet) => ({
          ...sheet,
          recipeId: "foreign-recipe",
          ingredients: [],
          steps: [],
          allergens: [],
          dietTags: [],
          procurementNotes: ["Extern beziehen und bei Wareneingang prüfen."]
        }))
      };

      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          plan,
          recipes: []
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("kitchen_sheet_incomplete");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires the versioned 5.362 reference-acceptance handoff entry", () => {
    const memory = readFileSync(path.join(process.cwd(), "memory.md"), "utf8");
    expect(memory).toContain("### 5.362");
    expect(memory).toContain("PR-#616");
    expect(memory).toContain("Cross-Case");
    expect(memory).toContain("### 5.363");
    expect(memory).toContain("production.kitchen_acceptance");
    expect(memory).toContain("### 5.364");
    expect(memory).toContain("procurementNotes");
    expect(memory).toContain("### 5.365");
    expect(memory).toContain("KitchenSheet.recipeId");
  });

  it("rejects non-positive or non-finite ingredient quantities", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          plan: {
            ...artifacts.productionPlan,
            productionBatches: artifacts.productionPlan.productionBatches.map((batch) => ({
              ...batch,
              ingredients: batch.ingredients.map((ingredient) => ({
                ...ingredient,
                quantity: { ...ingredient.quantity, amount: Number.NaN }
              }))
            }))
          }
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("ingredient_quantity_invalid");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects non-positive or non-finite purchase quantities", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        production: {
          ...acceptanceInput(artifacts).production,
          purchaseList: {
            ...artifacts.purchaseList,
            items: artifacts.purchaseList.items.map((item) => ({
              ...item,
              purchaseQty: 0
            }))
          }
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("purchase_quantity_invalid");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("turns malformed runtime evidence into a deterministic block", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        validatedEvidence: validatedSyntheticEvidence(),
        source: {
          ...acceptanceInput(artifacts).source,
          lineageReferences: undefined as never
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("source_evidence_malformed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires every operational kitchen sheet to carry quantities and usable steps", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        production: {
          plan: {
            ...artifacts.productionPlan,
            kitchenSheets: artifacts.productionPlan.kitchenSheets.map((sheet) => ({
              ...sheet,
              productionQty: { amount: 0, unit: sheet.productionQty.unit },
              ingredients: [],
              steps: []
            }))
          },
          purchaseList: artifacts.purchaseList,
          recipes: internalRecipes
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("kitchen_sheet_incomplete");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not accept an operational recipe batch without ingredient quantities", async () => {
    const { root, artifacts } = await syntheticProductionArtifacts();
    try {
      const result = evaluateProductionReferenceAcceptance(acceptanceInput(artifacts, {
        production: {
          plan: {
            ...artifacts.productionPlan,
            productionBatches: artifacts.productionPlan.productionBatches.map((batch) => ({
              ...batch,
              ingredients: []
            }))
          },
          purchaseList: artifacts.purchaseList,
          recipes: internalRecipes
        }
      }));

      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("production_batch_incomplete");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
