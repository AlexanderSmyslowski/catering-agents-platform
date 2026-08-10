import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";
import { AuditLogStore, createBusinessScopedPersistentCollection, validateApprovedOffer, type ApprovedOffer } from "@catering/shared-core";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";

const trustedSecret = "offer-approval-test-secret";
const trustedHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "local"
};

function buildTestApp() {
  return buildOfferApp({
    rootDir: mkdtempSync(path.join(tmpdir(), "catering-offer-approval-")),
    trustedActorSecret: trustedSecret
  });
}

function buildTestHarness() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-approval-harness-"));
  const store = new OfferStore({ rootDir });
  const auditLog = new AuditLogStore({ rootDir });
  const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
  return { app, store, auditLog, rootDir };
}

async function createDraft(app: ReturnType<typeof buildTestApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers: trustedHeaders,
    payload: { text: "Business Lunch fuer 35 Personen." }
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
}

describe("offer approval request", () => {
  it("creates an approved offer only after explicit variant approval", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[1]?.variantId, decidedBy: "spoofed" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ approval: { decidedBy: { name: string } } }>().approval.decidedBy.name).toBe("Angebots-Mitarbeiter");
    expect(response.json<{ approvedOffer: { selectedVariantId: string } }>().approvedOffer.selectedVariantId)
      .toBe(draft.variantSet[1]?.variantId);
  });

  it("does not create an approved offer for a rejected draft", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).not.toHaveProperty("approvedOffer");
  });

  it("does not create an approved offer when the requested variant is missing", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);

    const response = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: "missing" } });

    expect(response.statusCode).toBe(422);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
  });

  it("stores exactly one decision during concurrent approve and reject", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const target = { kind: "offer_draft" as const, artifactId: draft.draftId, revision: 1 };

    const responses = await Promise.all([
      app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } }),
      app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "rejected" } })
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    await expect(store.listApprovalsForTarget({ businessId: "local" }, target)).resolves.toHaveLength(1);
  });

  it("keeps one approved artifact and audit for concurrent identical decisions", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draft = await createDraft(app);
    const request = () => app.inject({
      method: "POST" as const,
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId }
    });

    const responses = await Promise.all([request(), request()]);

    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const approvalAudits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(approvalAudits).toHaveLength(1);
  });

  it("resumes after approval publication and emits approval audit evidence once", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draft = await createDraft(app);
    const insertApproval = store.insertApproval.bind(store);
    let injectFailure = true;
    store.insertApproval = async (...args) => {
      const result = await insertApproval(...args);
      if (result === "created" && injectFailure) throw new Error("injected after approval insert");
      return result;
    };

    const first = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });
    expect(first.statusCode).toBe(500);
    injectFailure = false;
    const retry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });
    const identicalRetry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });

    expect(retry.statusCode).toBe(201);
    expect(identicalRetry.statusCode).toBe(201);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const approvalAudits = (await auditLog.listRecentFor({ businessId: "local" }, 20)).filter((entry) => entry.action === "offer.approved");
    expect(approvalAudits).toHaveLength(1);
  });

  it("fails closed when the approved source revision advances after approval publication", async () => {
    const { app, store } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(draft).toBeDefined();
    const insertApproval = store.insertApproval.bind(store);
    let injectFailure = true;
    store.insertApproval = async (...args) => {
      const result = await insertApproval(...args);
      if (result === "created" && injectFailure) throw new Error("injected after approval insert");
      return result;
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draftSummary.variantSet[0]!.variantId }
    });
    expect(first.statusCode).toBe(500);
    injectFailure = false;
    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(draft!),
      revision: 2,
      variantSet: draft!.variantSet.map((variant) => ({
        ...structuredClone(variant),
        variantId: `${variant.variantId}-revision-2`
      })),
      customerFacingText: `${draft!.customerFacingText}\nNeue, noch nicht freigegebene Fassung.`
    });

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draftSummary.variantSet[0]!.variantId }
    });

    expect(retry.statusCode).toBe(409);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(1);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 2 }
    )).resolves.toHaveLength(0);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
  });

  it("rejects retries with a divergent normalized comment or trusted actor", async () => {
    const { app } = buildTestHarness();
    const draft = await createDraft(app);
    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId, comment: "  Freigabe laut Kalkulation  " }
    });
    expect(first.statusCode).toBe(201);

    const sameNormalizedComment = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId, comment: "Freigabe laut Kalkulation" }
    });
    const changedComment = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId, comment: "Andere Begruendung" }
    });
    const changedActor = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: { ...trustedHeaders, "x-catering-actor-name": "ANGEBOTS-MITARBEITER" },
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId, comment: "Freigabe laut Kalkulation" }
    });

    expect(sameNormalizedComment.statusCode).toBe(201);
    expect(changedComment.statusCode).toBe(409);
    expect(changedActor.statusCode).toBe(409);
  });

  it("repairs approved-offer audit evidence after publication succeeds but audit logging fails", async () => {
    const { app, auditLog } = buildTestHarness();
    const draft = await createDraft(app);
    const logFor = auditLog.logFor.bind(auditLog);
    let injectFailure = true;
    auditLog.logFor = async (...args) => {
      if (injectFailure && args[1].action === "offer.approved") {
        injectFailure = false;
        throw new Error("injected approval audit failure");
      }
      return logFor(...args);
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId }
    });
    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId }
    });

    expect(first.statusCode).toBe(500);
    expect(retry.statusCode).toBe(201);
    const audits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(audits).toHaveLength(1);
  });

  it("returns a conflict when a deterministic approved-offer identity has divergent content", async () => {
    const { app, rootDir } = buildTestHarness();
    const draft = await createDraft(app);
    const approved = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });
    const approvedOffer = approved.json<{ approvedOffer: ApprovedOffer }>().approvedOffer;
    const collection = createBusinessScopedPersistentCollection<ApprovedOffer>({ collectionName: "offers/approved", getId: (item) => item.approvedOfferId, rootDir, validate: validateApprovedOffer });
    await collection.set({ businessId: "local" }, validateApprovedOffer({ ...approvedOffer, customerFacingText: "divergent" }));

    const retry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });
    expect(retry.statusCode).toBe(409);
  });

  it("accepts identical approved-offer and handoff retries after PostgreSQL JSONB key reordering", async () => {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    const app = buildOfferApp({ pgPool: pool, trustedActorSecret: trustedSecret });
    const draft = await createDraft(app);
    const firstApproval = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });
    const approvedOfferId = firstApproval.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
    const approvedRow = await pool.query("SELECT payload FROM catering_business_records WHERE collection_name = 'offers/approved'");
    const reorderedApproved = Object.fromEntries(Object.entries(approvedRow.rows[0]!.payload as Record<string, unknown>).reverse());
    await pool.query("UPDATE catering_business_records SET payload = $1::jsonb WHERE collection_name = 'offers/approved'", [JSON.stringify(reorderedApproved)]);
    const approvalRetry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", variantId: draft.variantSet[0]!.variantId } });
    expect(approvalRetry.statusCode).toBe(201);

    const firstHandoff = await app.inject({ method: "POST", url: `/v1/offers/approved/${approvedOfferId}/handoffs`, headers: trustedHeaders, payload: {} });
    const handoffRow = await pool.query("SELECT payload FROM catering_business_records WHERE collection_name = 'offers/handoffs'");
    const reorderedHandoff = Object.fromEntries(Object.entries(handoffRow.rows[0]!.payload as Record<string, unknown>).reverse());
    await pool.query("UPDATE catering_business_records SET payload = $1::jsonb WHERE collection_name = 'offers/handoffs'", [JSON.stringify(reorderedHandoff)]);
    const handoffRetry = await app.inject({ method: "POST", url: `/v1/offers/approved/${approvedOfferId}/handoffs`, headers: trustedHeaders, payload: {} });
    expect(firstHandoff.statusCode).toBe(201);
    expect(handoffRetry.statusCode).toBe(201);
  });

  it("does not expose a draft from another business", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: { ...trustedHeaders, "x-catering-business-id": "other" },
      payload: { decision: "approved", variantId: draft.variantSet[0]?.variantId }
    });

    expect(response.statusCode).toBe(404);
  });
});
