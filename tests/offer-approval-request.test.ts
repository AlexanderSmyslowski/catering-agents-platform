import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { Pool as PostgresPool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  AuditLogStore,
  approvalRequestIdForTarget,
  createApprovalRequestRecord,
  createBusinessScopedPersistentCollection,
  createEventRequestFromText,
  createOfferDraft,
  validateApprovalRequestRecord,
  validateApprovedOffer,
  validateProductionHandoff,
  type ApprovalRequestRecord,
  type ApprovedOffer,
  type OfferDraft,
  type ProductionHandoff,
  type Queryable
} from "@catering/shared-core";
import { buildOfferApp } from "../offer-service/src/app.js";
import { approvedOfferIdForApproval } from "../offer-service/src/offer-decision-aggregate.js";
import { OfferStore, offerDecisionRepositoryFor } from "../offer-service/src/store.js";

const trustedSecret = "offer-approval-test-secret";
const trustedHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "local"
};
const postgresConnectionString = process.env.CATERING_TEST_POSTGRES_URL;
const itWithPostgres = postgresConnectionString ? it : it.skip;

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

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

function decisionsFor(store: OfferStore) {
  return offerDecisionRepositoryFor(store);
}

async function createDraft(app: ReturnType<typeof buildTestApp>) {
  const caseResponse = await app.inject({
    method: "POST",
    url: "/v1/offers/cases",
    headers: trustedHeaders,
    payload: { eventTypeLabel: "Business Lunch", attendeeCount: 35 }
  });
  expect(caseResponse.statusCode).toBe(201);
  const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
  const response = await app.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers: trustedHeaders,
    payload: { caseId, text: "Business Lunch fuer 35 Personen." }
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
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[1]?.variantId, decidedBy: "spoofed" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ approval: { decidedBy: { name: string } } }>().approval.decidedBy.name).toBe("Angebots-Mitarbeiter");
    expect(response.json<{ approvedOffer: { selectedVariantId: string } }>().approvedOffer.selectedVariantId)
      .toBe(draft.variantSet[1]?.variantId);
  });

  it("fails closed on an old malformed file target lock without creating approval or removing the lock", async () => {
    const { app, store, rootDir } = buildTestHarness();
    const draft = await createDraft(app);
    const targetIdentity = JSON.stringify({
      businessId: "local",
      kind: "offer_draft",
      artifactId: draft.draftId,
      revision: 1
    });
    const lockPath = path.join(
      rootDir,
      "businesses",
      "local",
      "offers",
      ".decision-target-locks",
      `${createHash("sha256").update(targetIdentity).digest("hex")}.lock`
    );
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, "", { mode: 0o600 });
    const oldTimestamp = new Date(Date.now() - 60_000);
    utimesSync(lockPath, oldTimestamp, oldTimestamp);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });

    expect(response.statusCode, response.body).toBe(500);
    expect(response.json<{ message: string }>().message).toContain("nicht rechtzeitig entsperrt");
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(lockPath, "utf8")).toBe("");
    expect(await store.listApprovalsForDraft({ businessId: "local" }, draft.draftId)).toEqual([]);
    expect(await store.listApprovedOffers({ businessId: "local" })).toEqual([]);
  });

  it("does not let a later file target ticket overtake an active earlier ticket", async () => {
    const { store, rootDir } = buildTestHarness();
    const target = { kind: "offer_draft" as const, artifactId: "draft-recovery-guard", revision: 1 };
    const targetIdentity = JSON.stringify({ businessId: "local", ...target });
    const lockPath = path.join(
      rootDir,
      "businesses",
      "local",
      "offers",
      ".decision-target-locks",
      `${createHash("sha256").update(targetIdentity).digest("hex")}.lock`
    );
    const queuePath = `${lockPath}.queue`;
    mkdirSync(queuePath, { recursive: true });
    writeFileSync(
      path.join(queuePath, "ticket-000000000001.json"),
      JSON.stringify({ pid: process.pid, token: "earlier-ticket" }),
      { mode: 0o600 }
    );
    let entered = false;

    const pending = decisionsFor(store).withTargetCriticalSection(
      { businessId: "local" },
      target,
      async () => { entered = true; }
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(entered).toBe(false);
    writeFileSync(
      path.join(queuePath, "released-000000000001"),
      "earlier-ticket",
      { mode: 0o600, flag: "wx" }
    );
    await pending;
    expect(entered).toBe(true);
  });

  it("does not admit an expired file target ticket when the earlier ticket is released at the deadline", async () => {
    const { store, rootDir } = buildTestHarness();
    const target = { kind: "offer_draft" as const, artifactId: "draft-expired-ticket", revision: 1 };
    const targetIdentity = JSON.stringify({ businessId: "local", ...target });
    const lockPath = path.join(
      rootDir,
      "businesses",
      "local",
      "offers",
      ".decision-target-locks",
      `${createHash("sha256").update(targetIdentity).digest("hex")}.lock`
    );
    const queuePath = `${lockPath}.queue`;
    mkdirSync(queuePath, { recursive: true });
    writeFileSync(
      path.join(queuePath, "ticket-000000000001.json"),
      JSON.stringify({ pid: process.pid, token: "earlier-ticket" }),
      { mode: 0o600 }
    );
    let entered = false;
    vi.useFakeTimers();
    try {
      const pending = decisionsFor(store).withTargetCriticalSection(
        { businessId: "local" },
        target,
        async () => { entered = true; }
      );
      const rejected = expect(pending).rejects.toThrow(
        "Die zielbezogene Angebotsentscheidung konnte nicht rechtzeitig gesperrt werden."
      );
      await vi.advanceTimersByTimeAsync(9_999);
      writeFileSync(
        path.join(queuePath, "released-000000000001"),
        "",
        { mode: 0o600, flag: "wx" }
      );
      await vi.advanceTimersByTimeAsync(1);

      await rejected;
      expect(entered).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not count released ticket history against the active queue limit", async () => {
    const { store, rootDir } = buildTestHarness();
    const target = { kind: "offer_draft" as const, artifactId: "draft-released-history", revision: 1 };
    const targetIdentity = JSON.stringify({ businessId: "local", ...target });
    const lockPath = path.join(
      rootDir,
      "businesses",
      "local",
      "offers",
      ".decision-target-locks",
      `${createHash("sha256").update(targetIdentity).digest("hex")}.lock`
    );
    const queuePath = `${lockPath}.queue`;
    mkdirSync(queuePath, { recursive: true });
    for (let sequence = 1; sequence <= 4_096; sequence += 1) {
      const suffix = String(sequence).padStart(12, "0");
      writeFileSync(
        path.join(queuePath, `ticket-${suffix}.json`),
        JSON.stringify({ pid: process.pid, token: `released-${suffix}` }),
        { mode: 0o600 }
      );
      writeFileSync(path.join(queuePath, `released-${suffix}`), "", { mode: 0o600 });
    }

    let entered = false;
    await decisionsFor(store).withTargetCriticalSection(
      { businessId: "local" },
      target,
      async () => { entered = true; }
    );

    expect(entered).toBe(true);
  }, 60_000);

  it("does not create an approved offer for a rejected draft", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1 }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).not.toHaveProperty("approvedOffer");
  });

  it("rejects public ApprovedOffer insertion after the matching target was rejected", async () => {
    const { app, store } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(draft).toBeDefined();
    const rejection = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1 }
    });
    expect(rejection.statusCode).toBe(201);
    const approval = rejection.json<{ approval: ApprovalRequestRecord }>().approval;
    const selectedVariant = draft!.variantSet[0]!;
    const invalidApprovedOffer = validateApprovedOffer({
      schemaVersion: "1.0",
      businessId: "local",
      approvedOfferId: approvedOfferIdForApproval(approval),
      sourceDraft: { draftId: draft!.draftId, revision: 1 },
      selectedVariantId: selectedVariant.variantId,
      approvalRequestId: approval.approvalRequestId,
      approvedAt: approval.decidedAt,
      eventSummary: draft!.eventSummary,
      customerFacingText: draft!.customerFacingText,
      serviceModules: structuredClone(draft!.serviceModules),
      pricingSummary: structuredClone(selectedVariant.proposedEventSpec.budgetContext!.pricingSummary!),
      selectedVariant: structuredClone(selectedVariant)
    });

    await expect(store.insertApprovedOffer({ businessId: "local" }, invalidApprovedOffer))
      .rejects.toThrow("Freigegebenes Angebot benötigt eine exakt passende genehmigte Approval-Projektion.");
    await expect(store.getApprovedOffer(
      { businessId: "local" },
      invalidApprovedOffer.approvedOfferId
    )).resolves.toBeUndefined();
  });

  it("does not create an approved offer when the requested variant is missing", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);

    const response = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: "missing" } });

    expect(response.statusCode).toBe(422);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
  });

  it("does not persist or approve an OfferDraft with duplicate variant IDs", async () => {
    const { app, store } = buildTestHarness();
    const base = {
      ...createOfferDraft(createEventRequestFromText({
        requestId: "duplicate-variant-persistence",
        channel: "text",
        rawText: "Lunch fuer 20 Personen."
      })),
      businessId: "local" as const,
      revision: 1
    };
    const duplicateVariantId = base.variantSet[0]!.variantId;
    const duplicateDraft: OfferDraft = {
      ...base,
      variantSet: base.variantSet.map((variant, index) => index === 1
        ? { ...structuredClone(variant), variantId: duplicateVariantId }
        : structuredClone(variant))
    };

    await expect(store.saveDraft({ businessId: "local" }, duplicateDraft))
      .rejects.toThrow("OfferDraft-Varianten müssen eindeutige variantId-Werte besitzen.");
    await expect(store.getDraft({ businessId: "local" }, duplicateDraft.draftId)).resolves.toBeUndefined();

    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${duplicateDraft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: duplicateVariantId }
    });

    expect(decision.statusCode).toBe(404);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: duplicateDraft.draftId, revision: 1 }
    )).resolves.toHaveLength(0);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
  });

  it("stores exactly one decision during concurrent approve and reject", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const target = { kind: "offer_draft" as const, artifactId: draft.draftId, revision: 1 };

    const responses = await Promise.all([
      app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } }),
      app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "rejected", revision: 1 } })
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const approvals = await store.listApprovalsForTarget({ businessId: "local" }, target);
    expect(approvals).toHaveLength(1);
    const winningAggregate = await decisionsFor(store).getDecisionAggregate(
      { businessId: "local" },
      approvals[0]!.approvalRequestId
    );
    expect(winningAggregate?.approval).toEqual(approvals[0]);
    expect(Boolean(winningAggregate?.approvedOffer)).toBe(approvals[0]!.decision === "approved");
  });

  it("keeps one approved artifact and audit for concurrent identical decisions", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draft = await createDraft(app);
    const request = () => app.inject({
      method: "POST" as const,
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });

    const responses = await Promise.all([request(), request()]);

    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const approvalAudits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(approvalAudits).toHaveLength(1);
  });

  it("resumes after an Approval staging crash and emits approval audit evidence once", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draft = await createDraft(app);
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let injectFailure = true;
    decisionRepository.withTargetCriticalSection = async (context, target, operation) =>
      withTargetCriticalSection(context, target, (scope) => operation({
        ...scope,
        insertApproval: async (approval) => {
          const result = await scope.insertApproval(approval);
          if (result === "created" && injectFailure) {
            injectFailure = false;
            throw new Error("injected after Approval staging");
          }
          return result;
        }
      }));

    const first = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });
    expect(first.statusCode).toBe(500);
    const retry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });
    const identicalRetry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });

    expect(retry.statusCode).toBe(201);
    expect(identicalRetry.statusCode).toBe(201);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const approvalAudits = (await auditLog.listRecentFor({ businessId: "local" }, 20)).filter((entry) => entry.action === "offer.approved");
    expect(approvalAudits).toHaveLength(1);
  });

  it("repairs a crashed approval projection after the source revision advances", async () => {
    const { app, store, rootDir } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(draft).toBeDefined();
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    decisionRepository.withTargetCriticalSection = async (context, target, operation) =>
      withTargetCriticalSection(context, target, (scope) => operation({
        ...scope,
        insertApproval: async () => "created",
        insertApprovedOffer: async () => "created"
      }));
    store.insertApproval = async () => {
      throw new Error("injected legacy crash before approval projection repair");
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });
    expect(first.statusCode).toBe(500);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(0);
    const aggregateId = approvalRequestIdForTarget({
      businessId: "local",
      target: { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    });
    const storedAggregate = await decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      aggregateId
    );
    expect(storedAggregate).toMatchObject({
      approvedOffer: {
        sourceDraft: { draftId: draftSummary.draftId, revision: 1 },
        selectedVariantId: draftSummary.variantSet[0]!.variantId
      }
    });
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(draft!),
      revision: 2,
      variantSet: draft!.variantSet.map((variant) => ({
        ...structuredClone(variant),
        variantId: `${variant.variantId}-revision-2`
      })),
      customerFacingText: `${draft!.customerFacingText}\nNeue, noch nicht freigegebene Fassung.`
    });
    const restartedStore = new OfferStore({ rootDir });
    const restartedAuditLog = new AuditLogStore({ rootDir });
    const restartedApp = buildOfferApp({
      rootDir,
      store: restartedStore,
      auditLog: restartedAuditLog,
      trustedActorSecret: trustedSecret
    });
    const getDraft = restartedStore.getDraft.bind(restartedStore);
    let draftReads = 0;
    restartedStore.getDraft = async (...args) => {
      draftReads += 1;
      return getDraft(...args);
    };

    const retry = await restartedApp.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });
    const identicalRetry = await restartedApp.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });

    expect(retry.statusCode).toBe(201);
    expect(identicalRetry.statusCode).toBe(201);
    expect(identicalRetry.json()).toEqual(retry.json());
    expect(retry.json()).toMatchObject({
      approval: storedAggregate!.approval,
      approvedOffer: {
        sourceDraft: { draftId: draftSummary.draftId, revision: 1 },
        selectedVariantId: draftSummary.variantSet[0]!.variantId,
        customerFacingText: draft!.customerFacingText
      }
    });
    expect(draftReads).toBe(0);
    await expect(restartedStore.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(1);
    await expect(restartedStore.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 2 }
    )).resolves.toHaveLength(0);
    await expect(restartedStore.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const approvalAudits = (await restartedAuditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(approvalAudits).toHaveLength(1);
  });

  it("resumes after crashing with only the Approval staging claim persisted", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const target = { kind: "offer_draft" as const, artifactId: draft.draftId, revision: 1 };
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let crashBeforeApprovedOffer = true;
    decisionRepository.withTargetCriticalSection = async (context, scopedTarget, operation) =>
      withTargetCriticalSection(context, scopedTarget, (scope) => operation({
        ...scope,
        insertApprovedOffer: async (offer) => {
          if (crashBeforeApprovedOffer) {
            crashBeforeApprovedOffer = false;
            throw new Error("injected crash before ApprovedOffer staging");
          }
          return scope.insertApprovedOffer(offer);
        }
      }));

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    const [stagedApproval] = await store.listApprovalsForTarget({ businessId: "local" }, target);

    expect(first.statusCode).toBe(500);
    expect(stagedApproval).toBeDefined();
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      stagedApproval!.approvalRequestId
    )).resolves.toBeUndefined();

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toMatchObject({
      approval: stagedApproval,
      approvedOffer: { approvalRequestId: stagedApproval!.approvalRequestId }
    });
  });

  it("resumes after crashing with both approved projection staging claims persisted", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const target = { kind: "offer_draft" as const, artifactId: draft.draftId, revision: 1 };
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let crashBeforeAggregate = true;
    decisionRepository.withTargetCriticalSection = async (context, scopedTarget, operation) =>
      withTargetCriticalSection(context, scopedTarget, (scope) => operation({
        ...scope,
        insertDecisionAggregate: async (aggregate) => {
          if (crashBeforeAggregate) {
            crashBeforeAggregate = false;
            throw new Error("injected crash before aggregate publication");
          }
          return scope.insertDecisionAggregate(aggregate);
        }
      }));

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    const [stagedApproval] = await store.listApprovalsForTarget({ businessId: "local" }, target);
    const [stagedApprovedOffer] = await store.listApprovedOffers({ businessId: "local" });

    expect(first.statusCode).toBe(500);
    expect(stagedApproval).toBeDefined();
    expect(stagedApprovedOffer).toBeDefined();
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      stagedApproval!.approvalRequestId
    )).resolves.toBeUndefined();

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual({ approval: stagedApproval, approvedOffer: stagedApprovedOffer });
  });

  it("resumes a rejection after crashing with its Approval staging claim persisted", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const target = { kind: "offer_draft" as const, artifactId: draft.draftId, revision: 1 };
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let crashBeforeAggregate = true;
    decisionRepository.withTargetCriticalSection = async (context, scopedTarget, operation) =>
      withTargetCriticalSection(context, scopedTarget, (scope) => operation({
        ...scope,
        insertDecisionAggregate: async (aggregate) => {
          if (crashBeforeAggregate) {
            crashBeforeAggregate = false;
            throw new Error("injected rejected-decision crash before aggregate publication");
          }
          return scope.insertDecisionAggregate(aggregate);
        }
      }));

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1, comment: "Budget nicht freigegeben" }
    });
    const [stagedApproval] = await store.listApprovalsForTarget({ businessId: "local" }, target);

    expect(first.statusCode).toBe(500);
    expect(stagedApproval).toMatchObject({ decision: "rejected" });
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      stagedApproval!.approvalRequestId
    )).resolves.toBeUndefined();

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1, comment: "Budget nicht freigegeben" }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual({ approval: stagedApproval });
  });

  it("keeps staged projections intact after a crash immediately after aggregate publication", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(draft).toBeDefined();
    const decisionRepository = decisionsFor(store);
    const insertDecisionAggregate = decisionRepository.insertDecisionAggregate.bind(decisionRepository);
    decisionRepository.insertDecisionAggregate = async (...args) => {
      const result = await insertDecisionAggregate(...args);
      if (result === "created") throw new Error("injected after decision aggregate insert");
      return result;
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });

    expect(first.statusCode).toBe(500);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(1);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const aggregateId = approvalRequestIdForTarget({
      businessId: "local",
      target: { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    });
    const aggregate = await decisionRepository.getDecisionAggregate({ businessId: "local" }, aggregateId);
    expect(aggregate?.approvedOffer).toBeDefined();

    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(draft!),
      revision: 2,
      customerFacingText: `${draft!.customerFacingText}\nKorrigierte Fassung.`,
      variantSet: draft!.variantSet.map((variant) => ({
        ...structuredClone(variant),
        variantId: `${variant.variantId}-revision-2`
      }))
    });
    store.getDraft = async () => {
      throw new Error("an exact aggregate retry must not read the current draft");
    };

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual({ approval: aggregate!.approval, approvedOffer: aggregate!.approvedOffer });
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(1);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const approvalAudits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(approvalAudits).toHaveLength(1);
  });

  it("repairs audit evidence after a crash immediately after approved-offer projection", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(draft).toBeDefined();
    const logFor = auditLog.logFor.bind(auditLog);
    let failAudit = true;
    auditLog.logFor = async (...args) => {
      if (failAudit && args[1].action === "offer.approved") {
        failAudit = false;
        throw new Error("injected after approved-offer projection");
      }
      return logFor(...args);
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });

    expect(first.statusCode).toBe(500);
    const [storedApproval] = await store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    );
    const [storedApprovedOffer] = await store.listApprovedOffers({ businessId: "local" });
    expect(storedApproval).toBeDefined();
    expect(storedApprovedOffer).toBeDefined();
    expect((await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved")).toHaveLength(0);

    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(draft!),
      revision: 2,
      customerFacingText: `${draft!.customerFacingText}\nKorrigierte Fassung.`
    });
    store.getDraft = async () => {
      throw new Error("an exact aggregate retry must not read the current draft");
    };

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual({ approval: storedApproval, approvedOffer: storedApprovedOffer });
    expect((await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved")).toHaveLength(1);
  });

  it("repairs a rejected projection from an approval-only aggregate", async () => {
    const { app, store } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(draft).toBeDefined();
    const decisionRepository = decisionsFor(store);
    const insertDecisionAggregate = decisionRepository.insertDecisionAggregate.bind(decisionRepository);
    decisionRepository.insertDecisionAggregate = async (...args) => {
      const result = await insertDecisionAggregate(...args);
      if (result === "created") throw new Error("injected after rejected decision aggregate insert");
      return result;
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1, comment: "Kalkulation nicht freigegeben" }
    });
    expect(first.statusCode).toBe(500);
    const aggregateId = approvalRequestIdForTarget({
      businessId: "local",
      target: { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    });
    const aggregate = await decisionRepository.getDecisionAggregate({ businessId: "local" }, aggregateId);
    expect(aggregate).toMatchObject({ approval: { decision: "rejected" } });
    expect(aggregate).not.toHaveProperty("approvedOffer");

    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(draft!),
      revision: 2,
      customerFacingText: `${draft!.customerFacingText}\nKorrigierte Fassung.`
    });
    store.getDraft = async () => {
      throw new Error("an exact aggregate retry must not read the current draft");
    };

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1, comment: "Kalkulation nicht freigegeben" }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual({ approval: aggregate!.approval });
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(1);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
  });

  it("adopts an exact legacy approval pair without changing its stored decision", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const revisionOne = await store.getDraft({ businessId: "local" }, draft.draftId);
    expect(revisionOne).toBeDefined();
    const decisionRepository = decisionsFor(store);
    const insertDecisionAggregate = decisionRepository.insertDecisionAggregate.bind(decisionRepository);
    decisionRepository.insertDecisionAggregate = async () => "created";
    const legacyDecision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: {
        decision: "approved",
        revision: 1,
        variantId: draft.variantSet[0]!.variantId,
        comment: "Freigabe aus Altbestand"
      }
    });
    decisionRepository.insertDecisionAggregate = insertDecisionAggregate;
    const legacyResponse = legacyDecision.json<{ approval: { approvalRequestId: string }; approvedOffer: ApprovedOffer }>();
    expect(legacyDecision.statusCode).toBe(201);
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      legacyResponse.approval.approvalRequestId
    )).resolves.toBeUndefined();
    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(revisionOne!),
      revision: 2,
      customerFacingText: `${revisionOne!.customerFacingText}\nKorrigierte Fassung.`,
      variantSet: revisionOne!.variantSet.map((variant) => ({
        ...structuredClone(variant),
        variantId: `${variant.variantId}-revision-2`
      }))
    });
    store.getDraft = async () => {
      throw new Error("an exact legacy projection retry must not read the current draft");
    };

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: {
        decision: "approved",
        revision: 1,
        variantId: draft.variantSet[0]!.variantId,
        comment: "Freigabe aus Altbestand"
      }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual(legacyDecision.json());
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      legacyResponse.approval.approvalRequestId
    )).resolves.toEqual({
      schemaVersion: "1.0",
      businessId: "local",
      approval: legacyDecision.json().approval,
      approvedOffer: legacyResponse.approvedOffer
    });
  });

  it.each(["file", "postgres"] as const)(
    "adopts an exact legacy pair that commits after the final empty legacy read in %s mode",
    async (mode) => {
      const rootDir = mkdtempSync(path.join(tmpdir(), `catering-offer-mixed-version-${mode}-`));
      const pgPool: Queryable | undefined = mode === "postgres"
        ? new (newDb().adapters.createPg().Pool)()
        : undefined;
      const store = new OfferStore({ rootDir, pgPool });
      const app = buildOfferApp({ rootDir, pgPool, store, trustedActorSecret: trustedSecret });
      const draftSummary = await createDraft(app);
      const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
      expect(draft).toBeDefined();
      const selectedVariant = draft!.variantSet[0]!;
      const legacyApproval = createApprovalRequestRecord({
        actor: {
          name: "Angebots-Mitarbeiter",
          businessId: "local",
          source: "trusted-proxy:x-catering-actor-name",
          trusted: true
        },
        role: "offer_operator",
        target: { kind: "offer_draft", artifactId: draft!.draftId, revision: 1 },
        decision: "approved",
        selectedVariantId: selectedVariant.variantId,
        now: new Date("2026-01-02T03:04:05.000Z")
      });
      const legacyApprovedOffer = validateApprovedOffer({
        schemaVersion: "1.0",
        businessId: "local",
        approvedOfferId: approvedOfferIdForApproval(legacyApproval),
        sourceDraft: { draftId: draft!.draftId, revision: 1 },
        selectedVariantId: selectedVariant.variantId,
        approvalRequestId: legacyApproval.approvalRequestId,
        approvedAt: legacyApproval.decidedAt,
        eventSummary: draft!.eventSummary,
        customerFacingText: draft!.customerFacingText,
        serviceModules: structuredClone(draft!.serviceModules),
        pricingSummary: structuredClone(selectedVariant.proposedEventSpec.budgetContext!.pricingSummary!),
        selectedVariant: structuredClone(selectedVariant)
      });
      const storage = { rootDir, pgPool };
      const approvals = createBusinessScopedPersistentCollection<ApprovalRequestRecord>({
        collectionName: "offers/approvals",
        getId: (approval) => approval.approvalRequestId,
        validate: validateApprovalRequestRecord,
        ...storage
      });
      const approvedOffers = createBusinessScopedPersistentCollection<ApprovedOffer>({
        collectionName: "offers/approved",
        getId: (offer) => offer.approvedOfferId,
        validate: validateApprovedOffer,
        ...storage
      });
      const listApprovalsForTarget = store.listApprovalsForTarget.bind(store);
      const getApprovedOffer = store.getApprovedOffer.bind(store);
      let sawEmptyApprovalRead = false;
      let emptyApprovedOfferReads = 0;
      let injectedLegacyPair = false;
      store.listApprovalsForTarget = async (...args) => {
        const result = await listApprovalsForTarget(...args);
        if (args[1].artifactId === draft!.draftId && result.length === 0) sawEmptyApprovalRead = true;
        return result;
      };
      store.getApprovedOffer = async (...args) => {
        const result = await getApprovedOffer(...args);
        if (sawEmptyApprovalRead && args[1] === legacyApprovedOffer.approvedOfferId && result === undefined) {
          emptyApprovedOfferReads += 1;
        }
        if (!injectedLegacyPair && emptyApprovedOfferReads === 2) {
          injectedLegacyPair = true;
          await approvals.insert({ businessId: "local" }, legacyApproval);
          await approvedOffers.insert({ businessId: "local" }, legacyApprovedOffer);
        }
        return result;
      };

      const response = await app.inject({
        method: "POST",
        url: `/v1/offers/drafts/${draft!.draftId}/decision`,
        headers: trustedHeaders,
        payload: { decision: "approved", revision: 1, variantId: selectedVariant.variantId }
      });

      expect(response.statusCode, response.body).toBe(201);
      expect(injectedLegacyPair).toBe(true);
      expect(emptyApprovedOfferReads).toBe(2);
      await expect(decisionsFor(store).getDecisionAggregate(
        { businessId: "local" },
        legacyApproval.approvalRequestId
      )).resolves.toEqual({
        schemaVersion: "1.0",
        businessId: "local",
        approval: legacyApproval,
        approvedOffer: legacyApprovedOffer
      });
      await expect(store.listApprovalsForTarget(
        { businessId: "local" },
        legacyApproval.target
      )).resolves.toEqual([legacyApproval]);
      await expect(store.getApprovedOffer(
        { businessId: "local" },
        legacyApprovedOffer.approvedOfferId
      )).resolves.toEqual(legacyApprovedOffer);
    }
  );

  itWithPostgres(
    "adopts a real PostgreSQL legacy pair that commits after the final empty read",
    async () => {
      const schema = `offer_mixed_version_${process.pid}_${Date.now()}`;
      const postgres = new PostgresPool({ connectionString: postgresConnectionString });
      let app: ReturnType<typeof buildOfferApp> | undefined;
      await postgres.query(`CREATE SCHEMA ${quotedIdentifier(schema)}`);
      try {
        let sawEmptyApprovalRead = false;
        let emptyApprovedOfferReads = 0;
        let injectedLegacyPair = false;
        let legacyApproval: ApprovalRequestRecord | undefined;
        let legacyApprovedOffer: ApprovedOffer | undefined;
        const connect = async () => {
          const client = await postgres.connect();
          await client.query(`SET search_path TO ${quotedIdentifier(schema)}`);
          const query = client.query.bind(client);
          return {
            async query(sql: string, params?: unknown[]) {
              const result = await query(sql, params);
              const collectionName = params?.[1];
              const isCollectionRead = sql.trimStart().startsWith("SELECT payload");
              if (isCollectionRead && collectionName === "offers/approvals" && result.rows.length === 0) {
                sawEmptyApprovalRead = true;
              }
              if (
                isCollectionRead
                && sawEmptyApprovalRead
                && collectionName === "offers/approved"
                && result.rows.length === 0
                && legacyApproval
                && legacyApprovedOffer
              ) {
                emptyApprovedOfferReads += 1;
              }
              if (!injectedLegacyPair && emptyApprovedOfferReads === 2 && legacyApproval && legacyApprovedOffer) {
                injectedLegacyPair = true;
                await postgres.query(
                  `INSERT INTO ${quotedIdentifier(schema)}.catering_business_records
                    (business_id, collection_name, record_id, payload, version_number)
                   VALUES
                    ($1, 'offers/approvals', $2, $3::jsonb, NULL),
                    ($1, 'offers/approved', $4, $5::jsonb, NULL)`,
                  [
                    "local",
                    legacyApproval.approvalRequestId,
                    JSON.stringify(legacyApproval),
                    legacyApprovedOffer.approvedOfferId,
                    JSON.stringify(legacyApprovedOffer)
                  ]
                );
              }
              return { rows: result.rows };
            },
            release: () => client.release()
          };
        };
        const scopedPool = {
          async query(sql: string, params?: unknown[]) {
            const client = await connect();
            try {
              return await client.query(sql, params);
            } finally {
              client.release();
            }
          },
          connect
        };
        const store = new OfferStore({ pgPool: scopedPool });
        app = buildOfferApp({ store, trustedActorSecret: trustedSecret });
        const draftSummary = await createDraft(app);
        const draft = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
        expect(draft).toBeDefined();
        const selectedVariant = draft!.variantSet[0]!;
        legacyApproval = createApprovalRequestRecord({
          actor: {
            name: "Angebots-Mitarbeiter",
            businessId: "local",
            source: "trusted-proxy:x-catering-actor-name",
            trusted: true
          },
          role: "offer_operator",
          target: { kind: "offer_draft", artifactId: draft!.draftId, revision: 1 },
          decision: "approved",
          selectedVariantId: selectedVariant.variantId,
          now: new Date("2026-01-02T03:04:05.000Z")
        });
        legacyApprovedOffer = validateApprovedOffer({
          schemaVersion: "1.0",
          businessId: "local",
          approvedOfferId: approvedOfferIdForApproval(legacyApproval),
          sourceDraft: { draftId: draft!.draftId, revision: 1 },
          selectedVariantId: selectedVariant.variantId,
          approvalRequestId: legacyApproval.approvalRequestId,
          approvedAt: legacyApproval.decidedAt,
          eventSummary: draft!.eventSummary,
          customerFacingText: draft!.customerFacingText,
          serviceModules: structuredClone(draft!.serviceModules),
          pricingSummary: structuredClone(selectedVariant.proposedEventSpec.budgetContext!.pricingSummary!),
          selectedVariant: structuredClone(selectedVariant)
        });

        const response = await app.inject({
          method: "POST",
          url: `/v1/offers/drafts/${draft!.draftId}/decision`,
          headers: trustedHeaders,
          payload: { decision: "approved", revision: 1, variantId: selectedVariant.variantId }
        });
        const aggregateRows = await postgres.query(
          `SELECT payload FROM ${quotedIdentifier(schema)}.catering_business_records
           WHERE business_id = 'local' AND collection_name = 'offers/decision-aggregates'`
        );

        expect(response.statusCode, response.body).toBe(201);
        expect(injectedLegacyPair).toBe(true);
        expect(emptyApprovedOfferReads).toBe(2);
        expect(aggregateRows.rows).toEqual([{
          payload: {
            schemaVersion: "1.0",
            businessId: "local",
            approval: legacyApproval,
            approvedOffer: legacyApprovedOffer
          }
        }]);
      } finally {
        await app?.close();
        await postgres.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
        await postgres.end();
      }
    }
  );

  it("does not let a divergent legacy retry claim a new aggregate", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const decisionRepository = decisionsFor(store);
    const insertDecisionAggregate = decisionRepository.insertDecisionAggregate.bind(decisionRepository);
    decisionRepository.insertDecisionAggregate = async () => "created";
    const legacyDecision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    decisionRepository.insertDecisionAggregate = insertDecisionAggregate;
    expect(legacyDecision.statusCode).toBe(201);
    const approvalRequestId = legacyDecision.json<{ approval: { approvalRequestId: string } }>().approval.approvalRequestId;

    const divergent = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1 }
    });

    expect(divergent.statusCode).toBe(409);
    await expect(decisionRepository.getDecisionAggregate({ businessId: "local" }, approvalRequestId)).resolves.toBeUndefined();
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draft.draftId, revision: 1 }
    )).resolves.toEqual([legacyDecision.json().approval]);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
  });

  it("recovers an incomplete legacy approval only from the still-current source revision", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let crashBeforeApprovedOffer = true;
    decisionRepository.withTargetCriticalSection = async (context, target, operation) =>
      withTargetCriticalSection(context, target, (scope) => operation({
        ...scope,
        insertApprovedOffer: async (approvedOffer) => {
          if (crashBeforeApprovedOffer) {
            crashBeforeApprovedOffer = false;
            throw new Error("injected legacy crash before ApprovedOffer staging");
          }
          return scope.insertApprovedOffer(approvedOffer);
        }
      }));
    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: {
        decision: "approved",
        revision: 1,
        variantId: draft.variantSet[0]!.variantId,
        comment: "Bestehende Freigabe"
      }
    });
    expect(first.statusCode).toBe(500);
    const [legacyApproval] = await store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draft.draftId, revision: 1 }
    );
    expect(legacyApproval).toBeDefined();
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: {
        decision: "approved",
        revision: 1,
        variantId: draft.variantSet[0]!.variantId,
        comment: "Bestehende Freigabe"
      }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toMatchObject({
      approval: legacyApproval,
      approvedOffer: {
        approvalRequestId: legacyApproval!.approvalRequestId,
        approvedAt: legacyApproval!.decidedAt,
        sourceDraft: { draftId: draft.draftId, revision: 1 }
      }
    });
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      legacyApproval!.approvalRequestId
    )).resolves.toEqual({
      schemaVersion: "1.0",
      businessId: "local",
      approval: legacyApproval,
      approvedOffer: retry.json().approvedOffer
    });
  });

  it("leaves an incomplete legacy approval fail-closed after the draft advances", async () => {
    const { app, store } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const revisionOne = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(revisionOne).toBeDefined();
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let crashBeforeApprovedOffer = true;
    decisionRepository.withTargetCriticalSection = async (context, target, operation) =>
      withTargetCriticalSection(context, target, (scope) => operation({
        ...scope,
        insertApprovedOffer: async (approvedOffer) => {
          if (crashBeforeApprovedOffer) {
            crashBeforeApprovedOffer = false;
            throw new Error("injected legacy crash before ApprovedOffer staging");
          }
          return scope.insertApprovedOffer(approvedOffer);
        }
      }));
    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });
    expect(first.statusCode).toBe(500);
    const [legacyApproval] = await store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    );
    expect(legacyApproval).toBeDefined();
    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(revisionOne!),
      revision: 2,
      customerFacingText: `${revisionOne!.customerFacingText}\nKorrigierte Fassung.`
    });

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draftSummary.variantSet[0]!.variantId }
    });

    expect(retry.statusCode).toBe(409);
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      legacyApproval!.approvalRequestId
    )).resolves.toBeUndefined();
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
  });

  it("adopts a legacy rejection without an ApprovedOffer or current-draft read", async () => {
    const { app, store } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const revisionOne = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(revisionOne).toBeDefined();
    const decisionRepository = decisionsFor(store);
    const insertDecisionAggregate = decisionRepository.insertDecisionAggregate.bind(decisionRepository);
    decisionRepository.insertDecisionAggregate = async () => "created";
    const legacyDecision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1, comment: "Altbestand abgelehnt" }
    });
    decisionRepository.insertDecisionAggregate = insertDecisionAggregate;
    expect(legacyDecision.statusCode).toBe(201);
    const approval = legacyDecision.json<{ approval: { approvalRequestId: string } }>().approval;
    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(revisionOne!),
      revision: 2,
      customerFacingText: `${revisionOne!.customerFacingText}\nKorrigierte Fassung.`
    });
    store.getDraft = async () => {
      throw new Error("an exact legacy rejection retry must not read the current draft");
    };

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1, comment: "Altbestand abgelehnt" }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual(legacyDecision.json());
    await expect(decisionRepository.getDecisionAggregate(
      { businessId: "local" },
      approval.approvalRequestId
    )).resolves.toEqual({
      schemaVersion: "1.0",
      businessId: "local",
      approval: legacyDecision.json().approval
    });
  });

  it("does not create a handoff from a conflicting approved-offer projection", async () => {
    const { app, rootDir } = buildTestHarness();
    const draft = await createDraft(app);
    const approval = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    expect(approval.statusCode).toBe(201);
    const approvedOffer = approval.json<{ approvedOffer: ApprovedOffer }>().approvedOffer;
    const approvedOffers = createBusinessScopedPersistentCollection<ApprovedOffer>({
      collectionName: "offers/approved",
      getId: (item) => item.approvedOfferId,
      rootDir,
      validate: validateApprovedOffer
    });
    await approvedOffers.set({ businessId: "local" }, validateApprovedOffer({
      ...structuredClone(approvedOffer),
      selectedVariant: {
        ...structuredClone(approvedOffer.selectedVariant),
        proposedEventSpec: {
          ...structuredClone(approvedOffer.selectedVariant.proposedEventSpec),
          attendees: {
            ...structuredClone(approvedOffer.selectedVariant.proposedEventSpec.attendees),
            expected: (approvedOffer.selectedVariant.proposedEventSpec.attendees.expected ?? 0) + 7
          }
        }
      }
    }));

    const handoff = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOffer.approvedOfferId}/handoffs`,
      headers: trustedHeaders,
      payload: {}
    });

    expect(handoff.statusCode).toBe(409);
  });

  it("rejects a persisted handoff whose selected variant is not the immutable approved variant", async () => {
    const { app, store, rootDir } = buildTestHarness();
    const draft = await createDraft(app);
    const approval = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    expect(approval.statusCode).toBe(201);
    const approvedOffer = approval.json<{ approvedOffer: ApprovedOffer }>().approvedOffer;
    const created = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOffer.approvedOfferId}/handoffs`,
      headers: trustedHeaders,
      payload: {}
    });
    expect(created.statusCode).toBe(201);
    const handoff = created.json<{ handoff: ProductionHandoff }>().handoff;
    const handoffs = createBusinessScopedPersistentCollection<ProductionHandoff>({
      collectionName: "offers/handoffs",
      getId: (item) => item.handoffId,
      rootDir,
      validate: validateProductionHandoff
    });
    await handoffs.set({ businessId: "local" }, validateProductionHandoff({
      ...handoff,
      source: { ...handoff.source, selectedVariantId: "variant-not-approved" }
    }));

    const response = await app.inject({
      method: "GET",
      url: `/v1/offers/handoffs/${handoff.handoffId}`,
      headers: { ...trustedHeaders, "x-catering-actor-name": "Production-Service" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: "Produktionsübergabe stimmt nicht mit der autoritativen Freigabeevidenz überein."
    });
    await app.close();
  });

  it("repairs a missing approved-offer projection before creating handoff from the aggregate", async () => {
    const { app, store } = buildTestHarness();
    const draft = await createDraft(app);
    const decisionRepository = decisionsFor(store);
    const withTargetCriticalSection = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let suppressApprovedOfferProjection = true;
    decisionRepository.withTargetCriticalSection = async (context, target, operation) =>
      withTargetCriticalSection(context, target, (scope) => operation({
        ...scope,
        insertApprovedOffer: (approvedOffer) => suppressApprovedOfferProjection
          ? Promise.resolve("created" as const)
          : scope.insertApprovedOffer(approvedOffer)
      }));
    const approval = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    suppressApprovedOfferProjection = false;
    expect(approval.statusCode).toBe(201);
    const approvedOffer = approval.json<{ approvedOffer: ApprovedOffer }>().approvedOffer;
    await expect(store.getApprovedOffer(
      { businessId: "local" },
      approvedOffer.approvedOfferId
    )).resolves.toBeUndefined();

    const handoff = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOffer.approvedOfferId}/handoffs`,
      headers: trustedHeaders,
      payload: {}
    });

    expect(handoff.statusCode).toBe(201);
    expect(handoff.json()).toMatchObject({
      handoff: {
        approvedOfferId: approvedOffer.approvedOfferId,
        eventSpecSnapshot: {
          ...approvedOffer.selectedVariant.proposedEventSpec,
          lifecycle: { commercialState: "accepted" }
        }
      }
    });
    await expect(store.getApprovedOffer(
      { businessId: "local" },
      approvedOffer.approvedOfferId
    )).resolves.toEqual(approvedOffer);
  });

  it("keeps unknown-draft 404 priority before decision-body and target validation", async () => {
    const app = buildTestApp();
    const missingWithEmptyBody = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts/unknown-draft/decision",
      headers: trustedHeaders,
      payload: {}
    });
    const missingWithInvalidTarget = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts/%20%20/decision",
      headers: trustedHeaders,
      payload: { decision: "rejected", revision: 1 }
    });

    expect(missingWithEmptyBody.statusCode).toBe(404);
    expect(missingWithInvalidTarget.statusCode).toBe(404);
  });

  it("keeps aggregate internals out of the offer-service package barrel", async () => {
    const packageExports = await import("@catering/offer-service");
    const publicStoreMethods = Object.getOwnPropertyNames(OfferStore.prototype);

    expect(packageExports).toHaveProperty("OfferStore");
    expect(packageExports).not.toHaveProperty("approvedOfferIdForApproval");
    expect(packageExports).not.toHaveProperty("offerDecisionRepositoryFor");
    expect(publicStoreMethods).not.toContain("insertDecisionAggregate");
    expect(publicStoreMethods).not.toContain("getDecisionAggregate");
    expect(publicStoreMethods).not.toContain("listDecisionAggregatesForApprovedOffer");
  });

  it("uses distinct 64-bit PostgreSQL advisory keys for a concrete 32-bit collision", async () => {
    const lockCalls: Array<{ sql: string; params: unknown[] }> = [];
    const pgPool = {
      async query() {
        return { rows: [] };
      },
      async connect() {
        return {
          async query(sql: string, params: unknown[] = []) {
            if (sql.includes("pg_advisory_xact_lock")) lockCalls.push({ sql, params });
            return { rows: [] };
          },
          release() {}
        };
      }
    };
    const store = new OfferStore({ pgPool });
    const decisionRepository = decisionsFor(store);
    const collisionTargets = [
      {
        context: { businessId: "alpha" },
        target: { kind: "offer_draft" as const, artifactId: "draft-53055", revision: 1 }
      },
      {
        context: { businessId: "beta" },
        target: { kind: "offer_draft" as const, artifactId: "draft-45855", revision: 1 }
      }
    ];
    const oldKeys = collisionTargets.map(({ context, target }) => createHash("sha256")
      .update(JSON.stringify({ businessId: context.businessId, target }))
      .digest()
      .readInt32BE(0));
    expect(oldKeys).toEqual([-1_036_745_492, -1_036_745_492]);

    for (const { context, target } of collisionTargets) {
      await decisionRepository.withTargetCriticalSection(context, target, async () => undefined);
    }

    expect(lockCalls).toHaveLength(2);
    expect(lockCalls.map(({ sql }) => sql)).toEqual([
      "SELECT pg_catalog.pg_advisory_xact_lock($1::bigint)",
      "SELECT pg_catalog.pg_advisory_xact_lock($1::bigint)"
    ]);
    const fullKeys = lockCalls.map(({ params }) => String(params[0]));
    expect(fullKeys[0]).not.toBe(fullKeys[1]);
    expect(fullKeys.every((key) => BigInt(key) >= -(1n << 63n) && BigInt(key) < (1n << 63n))).toBe(true);
  });

  it("uses one signed 64-bit advisory key for reordered versions of the same target", async () => {
    const lockArguments: string[] = [];
    const pgPool = {
      async query() {
        return { rows: [] };
      },
      async connect() {
        return {
          async query(sql: string, params: unknown[] = []) {
            if (sql.includes("pg_advisory_xact_lock")) lockArguments.push(String(params[0]));
            return { rows: [] };
          },
          release() {}
        };
      }
    };
    const store = new OfferStore({ pgPool });
    const decisionRepository = decisionsFor(store);
    const routeTarget = { kind: "offer_draft" as const, artifactId: "draft-jsonb-order", revision: 1 };
    const reorderedTarget = {
      kind: routeTarget.kind,
      revision: routeTarget.revision,
      artifactId: routeTarget.artifactId
    };

    await decisionRepository.withTargetCriticalSection(
      { businessId: "local" },
      routeTarget,
      async () => undefined
    );
    await decisionRepository.withTargetCriticalSection(
      { businessId: "local" },
      reorderedTarget,
      async () => undefined
    );

    expect(lockArguments).toHaveLength(2);
    expect(lockArguments[0]).toBe(lockArguments[1]);
    expect(BigInt(lockArguments[0]!)).toBeGreaterThanOrEqual(-(1n << 63n));
    expect(BigInt(lockArguments[0]!)).toBeLessThan(1n << 63n);
  });

  itWithPostgres("serializes a JSONB-reordered target on the same real PostgreSQL advisory key", async () => {
    const postgres = new PostgresPool({ connectionString: postgresConnectionString });
    const routeTarget = { kind: "offer_draft" as const, artifactId: "draft-jsonb-order", revision: 1 };
    const roundTrip = await postgres.query(
      "SELECT $1::jsonb AS target",
      [JSON.stringify(routeTarget)]
    );
    const jsonbTarget = roundTrip.rows[0]!.target as typeof routeTarget;
    const lockArguments: string[] = [];
    const pgPool = {
      async query(sql: string, params?: unknown[]) {
        return postgres.query(sql, params);
      },
      async connect() {
        const client = await postgres.connect();
        const query = client.query.bind(client);
        return {
          async query(sql: string, params?: unknown[]) {
            if (sql.includes("pg_advisory_xact_lock")) lockArguments.push(String(params?.[0]));
            return query(sql, params);
          },
          release: () => client.release()
        };
      }
    };
    const decisionRepository = decisionsFor(new OfferStore({ pgPool }));
    let releaseFirst = () => {};
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let signalFirstEntered = () => {};
    const firstEntered = new Promise<void>((resolve) => { signalFirstEntered = resolve; });
    let secondEntered = false;
    let overlapped = false;
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    try {
      first = decisionRepository.withTargetCriticalSection(
        { businessId: "local" },
        routeTarget,
        async () => {
          signalFirstEntered();
          await firstGate;
        }
      );
      await firstEntered;
      second = decisionRepository.withTargetCriticalSection(
        { businessId: "local" },
        jsonbTarget,
        async () => {
          secondEntered = true;
        }
      );
      for (let attempt = 0; attempt < 100 && lockArguments.length < 2; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
      overlapped = secondEntered;
    } finally {
      releaseFirst();
      await Promise.allSettled([first, second].filter((value): value is Promise<void> => value !== undefined));
      await postgres.end();
    }

    expect(Object.keys(jsonbTarget)).not.toEqual(Object.keys(routeTarget));
    expect(lockArguments).toHaveLength(2);
    expect(lockArguments[0]).toBe(lockArguments[1]);
    expect(overlapped).toBe(false);
  });

  it("rejects retries with a divergent normalized comment or trusted actor", async () => {
    const { app } = buildTestHarness();
    const draft = await createDraft(app);
    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId, comment: "  Freigabe laut Kalkulation  " }
    });
    expect(first.statusCode).toBe(201);

    const sameNormalizedComment = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId, comment: "Freigabe laut Kalkulation" }
    });
    const changedComment = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId, comment: "Andere Begruendung" }
    });
    const changedActor = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: { ...trustedHeaders, "x-catering-actor-name": "ANGEBOTS-MITARBEITER" },
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId, comment: "Freigabe laut Kalkulation" }
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
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });

    expect(first.statusCode).toBe(500);
    expect(retry.statusCode).toBe(201);
    const audits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(audits).toHaveLength(1);
  });

  it("repairs an older revision retry only from its stored approval and immutable approved offer", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const revisionOne = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(revisionOne).toBeDefined();
    const revisionOneVariantId = revisionOne!.variantSet[0]!.variantId;
    const logFor = auditLog.logFor.bind(auditLog);
    let failAudit = true;
    auditLog.logFor = async (...args) => {
      if (failAudit && args[1].action === "offer.approved") {
        failAudit = false;
        throw new Error("injected approval audit failure");
      }
      return logFor(...args);
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: revisionOneVariantId }
    });
    expect(first.statusCode).toBe(500);
    const [storedApproval] = await store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    );
    const [storedApprovedOffer] = await store.listApprovedOffers({ businessId: "local" });
    expect(storedApproval).toBeDefined();
    expect(storedApprovedOffer).toBeDefined();

    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(revisionOne!),
      revision: 2,
      customerFacingText: `${revisionOne!.customerFacingText}\nKorrigierte Fassung.`,
      variantSet: revisionOne!.variantSet.map((variant) => ({
        ...structuredClone(variant),
        variantId: `${variant.variantId}-revision-2`
      }))
    });

    let approvalInsertCalls = 0;
    let approvedOfferInsertCalls = 0;
    const insertApproval = store.insertApproval.bind(store);
    const insertApprovedOffer = store.insertApprovedOffer.bind(store);
    store.insertApproval = async (...args) => {
      approvalInsertCalls += 1;
      return insertApproval(...args);
    };
    store.insertApprovedOffer = async (...args) => {
      approvedOfferInsertCalls += 1;
      return insertApprovedOffer(...args);
    };

    const divergentResponses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
        headers: { ...trustedHeaders, "x-catering-actor-name": "ANGEBOTS-MITARBEITER" },
        payload: { decision: "approved", revision: 1, variantId: revisionOneVariantId }
      }),
      app.inject({
        method: "POST",
        url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
        headers: trustedHeaders,
        payload: { decision: "approved", revision: 1, variantId: revisionOneVariantId, comment: "Andere Begruendung" }
      }),
      app.inject({
        method: "POST",
        url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
        headers: trustedHeaders,
        payload: { decision: "rejected", revision: 1 }
      }),
      app.inject({
        method: "POST",
        url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
        headers: trustedHeaders,
        payload: { decision: "approved", revision: 1, variantId: revisionOne!.variantSet[1]!.variantId }
      })
    ]);

    expect(divergentResponses.map((response) => response.statusCode)).toEqual([409, 409, 409, 409]);
    expect((await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved")).toHaveLength(0);

    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: revisionOneVariantId }
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual({ approval: storedApproval, approvedOffer: storedApprovedOffer });
    expect(approvalInsertCalls).toBe(0);
    expect(approvedOfferInsertCalls).toBe(0);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(1);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(1);
    const audits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(audits).toHaveLength(1);
  });

  it("returns a conflict when a deterministic approved-offer identity has divergent content", async () => {
    const { app, rootDir } = buildTestHarness();
    const draft = await createDraft(app);
    const approved = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });
    const approvedOffer = approved.json<{ approvedOffer: ApprovedOffer }>().approvedOffer;
    const collection = createBusinessScopedPersistentCollection<ApprovedOffer>({ collectionName: "offers/approved", getId: (item) => item.approvedOfferId, rootDir, validate: validateApprovedOffer });
    await collection.set({ businessId: "local" }, validateApprovedOffer({ ...approvedOffer, customerFacingText: "divergent" }));

    const retry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });
    expect(retry.statusCode).toBe(409);
  });

  it("accepts identical approved-offer and handoff retries after PostgreSQL JSONB key reordering", async () => {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    const app = buildOfferApp({ pgPool: pool, trustedActorSecret: trustedSecret });
    const draft = await createDraft(app);
    const firstApproval = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });
    const approvedOfferId = firstApproval.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
    const approvedRow = await pool.query("SELECT payload FROM catering_business_records WHERE collection_name = 'offers/approved'");
    const reorderedApproved = Object.fromEntries(Object.entries(approvedRow.rows[0]!.payload as Record<string, unknown>).reverse());
    await pool.query("UPDATE catering_business_records SET payload = $1::jsonb WHERE collection_name = 'offers/approved'", [JSON.stringify(reorderedApproved)]);
    const approvalRetry = await app.inject({ method: "POST", url: `/v1/offers/drafts/${draft.draftId}/decision`, headers: trustedHeaders, payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId } });
    expect(approvalRetry.statusCode).toBe(201);

    const firstHandoff = await app.inject({ method: "POST", url: `/v1/offers/approved/${approvedOfferId}/handoffs`, headers: trustedHeaders, payload: {} });
    const handoffRow = await pool.query("SELECT payload FROM catering_business_records WHERE collection_name = 'offers/handoffs'");
    const reorderedHandoff = Object.fromEntries(Object.entries(handoffRow.rows[0]!.payload as Record<string, unknown>).reverse());
    await pool.query("UPDATE catering_business_records SET payload = $1::jsonb WHERE collection_name = 'offers/handoffs'", [JSON.stringify(reorderedHandoff)]);
    const handoffRetry = await app.inject({ method: "POST", url: `/v1/offers/approved/${approvedOfferId}/handoffs`, headers: trustedHeaders, payload: {} });
    expect(firstHandoff.statusCode).toBe(201);
    expect(handoffRetry.statusCode).toBe(201);
  });

  it("rejects a request for another business before looking up its draft", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: { ...trustedHeaders, "x-catering-business-id": "other" },
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]?.variantId }
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows a deliberate corrected-revision decision while replaying the completed older decision exactly", async () => {
    const { app, store } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const revisionOne = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(revisionOne).toBeDefined();
    const revisionOneVariantId = revisionOne!.variantSet[0]!.variantId;
    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: revisionOneVariantId }
    });
    expect(first.statusCode).toBe(201);

    const revisionTwo = {
      ...structuredClone(revisionOne!),
      revision: 2,
      customerFacingText: `${revisionOne!.customerFacingText}\nKorrigierte Fassung.`,
      variantSet: revisionOne!.variantSet.map((variant) => ({
        ...structuredClone(variant),
        variantId: `${variant.variantId}-revision-2`
      }))
    };
    await store.saveDraft({ businessId: "local" }, revisionTwo);

    const staleRetry = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: revisionOneVariantId }
    });
    const revisionTwoDecision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 2, variantId: revisionTwo.variantSet[0]!.variantId }
    });

    expect(staleRetry.statusCode).toBe(201);
    expect(staleRetry.json()).toEqual(first.json());
    expect(revisionTwoDecision.statusCode).toBe(201);
    expect(revisionTwoDecision.json()).toMatchObject({ approvedOffer: { sourceDraft: { draftId: draftSummary.draftId, revision: 2 } } });
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(1);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 2 }
    )).resolves.toHaveLength(1);
  });

  it("rejects an older revision that has no exact stored approval", async () => {
    const { app, store } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const revisionOne = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(revisionOne).toBeDefined();
    await store.saveDraft({ businessId: "local" }, {
      ...structuredClone(revisionOne!),
      revision: 2,
      customerFacingText: `${revisionOne!.customerFacingText}\nKorrigierte Fassung.`,
      variantSet: revisionOne!.variantSet.map((variant) => ({
        ...structuredClone(variant),
        variantId: `${variant.variantId}-revision-2`
      }))
    });

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 1, variantId: revisionOne!.variantSet[0]!.variantId }
    });

    expect(response.statusCode).toBe(409);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 1 }
    )).resolves.toHaveLength(0);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
  });

  it("requires a server-validated draft revision on every decision request", async () => {
    const missingRevisionApp = buildTestApp();
    const missingRevisionDraft = await createDraft(missingRevisionApp);
    const missingRevision = await missingRevisionApp.inject({
      method: "POST",
      url: `/v1/offers/drafts/${missingRevisionDraft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: missingRevisionDraft.variantSet[0]!.variantId }
    });

    const mismatchedRevisionApp = buildTestApp();
    const mismatchedRevisionDraft = await createDraft(mismatchedRevisionApp);
    const mismatchedRevision = await mismatchedRevisionApp.inject({
      method: "POST",
      url: `/v1/offers/drafts/${mismatchedRevisionDraft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 2, variantId: mismatchedRevisionDraft.variantSet[0]!.variantId }
    });

    expect(missingRevision.statusCode).toBe(422);
    expect(mismatchedRevision.statusCode).toBe(409);
  });

  it("rejects an unpriceable selected snapshot before persisting approval evidence", async () => {
    const { app, store, auditLog } = buildTestHarness();
    const draftSummary = await createDraft(app);
    const revisionOne = await store.getDraft({ businessId: "local" }, draftSummary.draftId);
    expect(revisionOne).toBeDefined();
    const revisionTwo = {
      ...structuredClone(revisionOne!),
      revision: 2,
      variantSet: revisionOne!.variantSet.map((variant, index) => index === 0
        ? {
            ...structuredClone(variant),
            proposedEventSpec: {
              ...structuredClone(variant.proposedEventSpec),
              budgetContext: undefined
            }
          }
        : structuredClone(variant))
    };
    await store.saveDraft({ businessId: "local" }, revisionTwo);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draftSummary.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", revision: 2, variantId: revisionTwo.variantSet[0]!.variantId }
    });

    expect(response.statusCode).toBe(422);
    await expect(store.listApprovalsForTarget(
      { businessId: "local" },
      { kind: "offer_draft", artifactId: draftSummary.draftId, revision: 2 }
    )).resolves.toHaveLength(0);
    await expect(store.listApprovedOffers({ businessId: "local" })).resolves.toHaveLength(0);
    const approvalAudits = (await auditLog.listRecentFor({ businessId: "local" }, 20))
      .filter((entry) => entry.action === "offer.approved");
    expect(approvalAudits).toHaveLength(0);
  });
});
