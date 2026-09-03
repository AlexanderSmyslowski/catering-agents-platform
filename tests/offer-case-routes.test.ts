import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuditLogStore,
  approvalRequestIdForTarget,
  createEventRequestFromText,
  createOfferDraft as buildOfferDraft,
  validateOfferDraft,
  type OfferCase
} from "@catering/shared-core";
import { buildOfferApp } from "@catering/offer-service";
import { OfferStore, offerDecisionRepositoryFor } from "../offer-service/src/store.js";

const trustedSecret = "offer-case-route-secret";
const alphaHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "alpha"
};
const betaHeaders = {
  ...alphaHeaders,
  "x-catering-business-id": "beta"
};
const roots: string[] = [];

function buildHarness(configuredBusinessId = "alpha") {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-case-routes-"));
  roots.push(rootDir);
  const store = new OfferStore({ rootDir });
  const app = buildOfferApp({
    rootDir,
    store,
    auditLog: new AuditLogStore({ rootDir }),
    trustedActorSecret: trustedSecret,
    env: {
      CATERING_DEV_AUTH: "1",
      CATERING_DEFAULT_BUSINESS_ID: configuredBusinessId,
      CATERING_TRUSTED_ACTOR_SECRET: trustedSecret
    }
  });
  const auditLog = new AuditLogStore({ rootDir });
  return { app, store, auditLog, rootDir };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function createOfferCase(
  app: ReturnType<typeof buildOfferApp>,
  headers = alphaHeaders,
  overrides: Record<string, unknown> = {}
) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/offers/cases",
    headers,
    payload: {
      customerName: "CommCats",
      eventTypeLabel: "Empfang",
      eventDate: "2026-06-14",
      attendeeCount: 45,
      ...overrides
    }
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ case: OfferCase }>().case;
}

async function createOfferDraft(
  app: ReturnType<typeof buildOfferApp>,
  caseId: string
): Promise<{ draftId: string; variantSet: Array<{ variantId: string }> }> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers: alphaHeaders,
    payload: {
      caseId,
      requestId: `request-initial-${caseId}`,
      text: "Empfang für 45 Personen mit Fingerfood."
    }
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json();
}

function targetLockPath(
  rootDir: string,
  businessId: string,
  collectionNamespace: string,
  target: { kind: string; artifactId: string; revision: number }
): string {
  const identity = JSON.stringify({ businessId, ...target });
  return path.join(
    rootDir,
    "businesses",
    businessId,
    collectionNamespace,
    ".decision-target-locks",
    `${createHash("sha256").update(identity).digest("hex")}.lock`
  );
}

async function waitUntil(predicate: () => boolean | Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    if (await predicate()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error("Expected synchronization signal was not observed.");
}

async function completeOfferCase(
  app: ReturnType<typeof buildOfferApp>,
  caseId: string
): Promise<{ approvedOfferId: string; productionHandoffId: string }> {
  const draft = await createOfferDraft(app, caseId);
  const decision = await app.inject({
    method: "POST",
    url: `/v1/offers/drafts/${draft.draftId}/decision`,
    headers: alphaHeaders,
    payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
  });
  expect(decision.statusCode, decision.body).toBe(201);
  const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>()
    .approvedOffer.approvedOfferId;
  const handoff = await app.inject({
    method: "POST",
    url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
    headers: alphaHeaders,
    payload: {}
  });
  expect(handoff.statusCode, handoff.body).toBe(201);
  return {
    approvedOfferId,
    productionHandoffId: handoff.json<{ handoff: { handoffId: string } }>().handoff.handoffId
  };
}

describe("offer case routes", () => {
  it("creates server-owned cases and formats their concise display names", async () => {
    const { app } = buildHarness();

    const response = await app.inject({
      method: "POST",
      url: "/v1/offers/cases",
      headers: alphaHeaders,
      payload: {
        customerName: " CommCats ",
        eventTypeLabel: "Empfang",
        eventDate: "2026-06-14",
        attendeeCount: 45,
        caseId: "client-controlled-case",
        businessId: "beta",
        status: "completed"
      }
    });

    expect(response.statusCode).toBe(422);

    const created = await createOfferCase(app);
    expect(created).toMatchObject({
      businessId: "alpha",
      product: "offer",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "open",
      version: 1
    });
    expect(created.caseId).toMatch(/^offer-case-/);
    expect(Date.parse(created.createdAt)).not.toBeNaN();
    expect(created.updatedAt).toBe(created.createdAt);
  });

  it("lists cases for the configured business, supports search, and rejects another trusted business", async () => {
    const { app } = buildHarness();
    const alpha = await createOfferCase(app, alphaHeaders);
    await createOfferCase(app, alphaHeaders, {
      customerName: "Andere Firma",
      eventTypeLabel: "Lunch",
      eventDate: "2026-07-01",
      attendeeCount: 20
    });
    const crossBusiness = await app.inject({
      method: "POST",
      url: "/v1/offers/cases",
      headers: betaHeaders,
      payload: {
        customerName: "CommCats",
        eventTypeLabel: "Empfang",
        eventDate: "2026-06-14",
        attendeeCount: 45
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/offers/cases?search=empfang",
      headers: alphaHeaders
    });

    expect(crossBusiness.statusCode).toBe(403);
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([{
      caseId: alpha.caseId,
      product: "offer",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "open",
      createdAt: alpha.createdAt,
      updatedAt: alpha.updatedAt
    }]);
  });

  it("returns case history and hides cases owned by another business", async () => {
    const { app } = buildHarness();
    const alpha = await createOfferCase(app, alphaHeaders);

    const detail = await app.inject({
      method: "GET",
      url: `/v1/offers/cases/${alpha.caseId}`,
      headers: alphaHeaders
    });
    const hidden = await app.inject({
      method: "GET",
      url: `/v1/offers/cases/${alpha.caseId}`,
      headers: betaHeaders
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().case.caseId).toBe(alpha.caseId);
    expect(detail.json().events).toMatchObject([{
      sequence: 1,
      role: "system",
      kind: "case_created"
    }]);
    expect(hidden.statusCode).toBe(403);
  });

  it("copies a case into a new open case without inherited approvals", async () => {
    const { app, store } = buildHarness();
    const source: OfferCase = {
      schemaVersion: "1.0",
      businessId: "alpha",
      caseId: "offer-case-approved-source",
      product: "offer",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "completed",
      version: 3,
      createdAt: "2026-06-10T08:00:00.000Z",
      updatedAt: "2026-06-14T09:00:00.000Z",
      approvedOfferId: "approved-offer-1",
      productionHandoffId: "handoff-1"
    };
    await store.createCase({ businessId: "alpha" }, source);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/cases/${source.caseId}/copies`,
      headers: alphaHeaders,
      payload: {}
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().case).toMatchObject({
      product: "offer",
      copiedFromCaseId: source.caseId,
      displayName: source.displayName,
      status: "open",
      version: 1
    });
    expect(response.json().case.caseId).not.toBe(source.caseId);
    expect(response.json().case.approvedOfferId).toBeUndefined();
    expect(response.json().case.productionHandoffId).toBeUndefined();
    expect(response.json().events).toMatchObject([{
      sequence: 1,
      kind: "case_copied",
      artifactId: source.caseId
    }]);
  });

  it("requires an owned case before creating an offer draft", async () => {
    const { app, store } = buildHarness();

    const missingCaseId = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: { text: "Empfang für 45 Personen." }
    });
    const unknownCase = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: { caseId: "offer-case-unknown", text: "Empfang für 45 Personen." }
    });

    expect(missingCaseId.statusCode).toBe(422);
    expect(unknownCase.statusCode).toBe(404);
    await expect(store.listDrafts({ businessId: "alpha" })).resolves.toHaveLength(0);
  });

  it("appends a draft_created event only after the structured draft was saved", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const eventRequest = createEventRequestFromText({
      requestId: "request-structured-offer",
      channel: "text",
      rawText: "Empfang für 45 Personen mit Fingerfood."
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers: alphaHeaders,
      payload: { ...eventRequest, caseId: offerCase.caseId }
    });

    expect(response.statusCode, response.body).toBe(201);
    const draft = response.json();
    await expect(store.getDraft({ businessId: "alpha" }, draft.draftId)).resolves.toMatchObject({
      draftId: draft.draftId,
      revision: 1
    });
    await expect(store.listEvents({ businessId: "alpha" }, offerCase.caseId)).resolves.toMatchObject([
      { sequence: 1, kind: "case_created" },
      {
        sequence: 2,
        role: "assistant",
        kind: "draft_created",
        artifactId: draft.draftId,
        revisionRef: {
          artifactType: "OfferDraft",
          artifactId: draft.draftId,
          revision: 1
        }
      }
    ]);
  });

  it("fails closed when a persisted draft has no matching case timeline event", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const caseEvents = (store as any).caseEvents as { insert: (...args: any[]) => Promise<unknown> };
    vi.spyOn(caseEvents, "insert").mockRejectedValueOnce(new Error("injected draft timeline failure"));

    const draftResponse = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        ...createEventRequestFromText({
          requestId: "request-orphaned-draft",
          channel: "text",
          rawText: "Empfang für 45 Personen mit Fingerfood."
        })
      }
    });
    expect(draftResponse.statusCode).toBe(500);
    const orphan = (await store.listDrafts({ businessId: "alpha" }))[0];
    expect(orphan).toBeDefined();
    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${orphan!.draftId}/decision`,
      headers: alphaHeaders,
      payload: {
        decision: "approved",
        revision: orphan!.revision,
        variantId: orphan!.variantSet[0]!.variantId
      }
    });

    expect(decision.statusCode, decision.body).toBe(409);
    expect(await store.listApprovalsForDraft({ businessId: "alpha" }, orphan!.draftId)).toEqual([]);
    expect(await store.listApprovedOffers({ businessId: "alpha" })).toEqual([]);
    expect(await store.listEvents({ businessId: "alpha" }, offerCase.caseId)).toHaveLength(1);
  });

  it("requires the exact draft_created event instead of accepting revision_created alone", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const context = { businessId: "alpha" };
    const request = createEventRequestFromText({
      requestId: "request-revision-only-draft",
      channel: "text",
      rawText: "Empfang für 45 Personen mit Fingerfood."
    });
    const draft = validateOfferDraft({
      ...buildOfferDraft(request),
      businessId: context.businessId,
      revision: 1
    });
    await store.saveDraft(context, draft);
    const draftCreatedAt = "2026-08-30T01:40:00.000Z";
    await store.appendEvent(context, offerCase.caseId, {
      at: draftCreatedAt,
      role: "assistant",
      kind: "revision_created",
      text: "Angebotsentwurf erstellt.",
      artifactId: draft.draftId,
      revisionRef: {
        artifactType: "OfferDraft",
        artifactId: draft.draftId,
        revision: draft.revision,
        createdAt: draftCreatedAt,
        supersedesArtifactId: "offer-draft-prior"
      }
    });
    const eventsBefore = await store.listEvents(context, offerCase.caseId);

    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: {
        decision: "approved",
        revision: draft.revision,
        variantId: draft.variantSet[0]!.variantId
      }
    });

    expect(decision.statusCode, decision.body).toBe(409);
    expect(await store.listApprovalsForTarget(context, {
      kind: "offer_draft",
      artifactId: draft.draftId,
      revision: draft.revision
    })).toEqual([]);
    expect(await offerDecisionRepositoryFor(store).getDecisionAggregate(
      context,
      approvalRequestIdForTarget({
        businessId: context.businessId,
        target: { kind: "offer_draft", artifactId: draft.draftId, revision: draft.revision }
      })
    )).toBeUndefined();
    expect(await store.listApprovedOffers(context)).toEqual([]);
    expect(await store.listEvents(context, offerCase.caseId)).toEqual(eventsBefore);
  });

  it("keeps a free-text continuation inside its trusted case", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        requestId: "request-free-text-offer",
        text: "Empfang für 45 Personen mit Fingerfood."
      }
    });

    expect(response.statusCode, response.body).toBe(201);
    const events = await store.listEvents({ businessId: "alpha" }, offerCase.caseId);
    expect(events.at(-1)).toMatchObject({
      role: "assistant",
      kind: "draft_created",
      artifactId: response.json().draftId
    });
  });

  it("recovers the same free-text draft when an omitted request ID is retried", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const request = () => app.inject({
      method: "POST" as const,
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        text: "Empfang für 45 Personen mit Fingerfood."
      }
    });

    const first = await request();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const retry = await request();

    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(retry.json()).toEqual(first.json());
    expect(await store.listDrafts({ businessId: "alpha" })).toHaveLength(1);
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
      .filter((event) => event.kind === "draft_created")).toHaveLength(1);
  });

  it("reopens a completed case after a new free-text draft and keeps retries idempotent", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const completed = await completeOfferCase(app, offerCase.caseId);
    await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toMatchObject({
      status: "completed",
      approvedOfferId: completed.approvedOfferId,
      productionHandoffId: completed.productionHandoffId,
      version: 3
    });
    const request = () => app.inject({
      method: "POST" as const,
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        requestId: "request-offer-continuation-text",
        text: "Bitte das Angebot für 50 Personen neu berechnen."
      }
    });

    const first = await request();
    const retry = await request();

    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toEqual(
      expect.objectContaining({ status: "open", version: 4 })
    );
    const reopened = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    expect(reopened).not.toHaveProperty("approvedOfferId");
    expect(reopened).not.toHaveProperty("productionHandoffId");
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
      .filter((event) => event.kind === "draft_created" && event.artifactId === first.json().draftId)).toHaveLength(1);
  });

  it("reopens a completed case after a new structured draft", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    await completeOfferCase(app, offerCase.caseId);
    const continuation = createEventRequestFromText({
      requestId: "request-offer-continuation-document",
      channel: "pdf_upload",
      rawText: "Empfang für 55 Personen mit Flying Buffet."
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers: alphaHeaders,
      payload: { ...continuation, caseId: offerCase.caseId }
    });

    expect(response.statusCode, response.body).toBe(201);
    const reopened = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    expect(reopened).toMatchObject({ status: "open", version: 4 });
    expect(reopened).not.toHaveProperty("approvedOfferId");
    expect(reopened).not.toHaveProperty("productionHandoffId");
  });

  it("serializes two different continuation drafts in one completed case", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    await completeOfferCase(app, offerCase.caseId);
    const drafts = [
      createEventRequestFromText({
        requestId: "request-concurrent-continuation-a",
        channel: "text",
        rawText: "Empfang für 50 Personen mit Fingerfood."
      }),
      createEventRequestFromText({
        requestId: "request-concurrent-continuation-b",
        channel: "text",
        rawText: "Empfang für 60 Personen mit Flying Buffet."
      })
    ].map((request) => validateOfferDraft({
      ...buildOfferDraft(request),
      businessId: "alpha",
      revision: 1
    }));

    const results = await Promise.all(drafts.map((draft) =>
      store.saveDraftForCase({ businessId: "alpha" }, offerCase.caseId, draft)
    ));
    const reopened = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    const events = await store.listEvents({ businessId: "alpha" }, offerCase.caseId);
    const continuationEvents = events.filter((event) =>
      event.kind === "draft_created" && drafts.some((draft) => draft.draftId === event.artifactId)
    );

    expect(results).toEqual(["saved", "saved"]);
    expect(continuationEvents).toHaveLength(2);
    expect(new Set(events.map((event) => event.sequence)).size).toBe(events.length);
    expect(events.map((event) => event.sequence)).toEqual(
      Array.from({ length: events.length }, (_, index) => index + 1)
    );
    expect(reopened).toMatchObject({ status: "open", version: 4 });
    expect(reopened).not.toHaveProperty("approvedOfferId");
    expect(reopened).not.toHaveProperty("productionHandoffId");
  });

  it("does not reopen a completed case when the already handed-off draft is merely retried", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    await completeOfferCase(app, offerCase.caseId);
    const completed = await store.getCase({ businessId: "alpha" }, offerCase.caseId);

    const retry = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        requestId: `request-initial-${offerCase.caseId}`,
        text: "Empfang für 45 Personen mit Fingerfood."
      }
    });

    expect(retry.statusCode, retry.body).toBe(201);
    await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toEqual(completed);
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
      .filter((event) => event.kind === "draft_created")).toHaveLength(1);
  });

  it("repairs the open projection when a continuation draft and event survived an interrupted request", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    await completeOfferCase(app, offerCase.caseId);
    const eventRequest = createEventRequestFromText({
      requestId: "request-offer-continuation-repair",
      channel: "text",
      rawText: "Besprechung für 5 Personen mit Kaffeepause."
    });
    const draft = validateOfferDraft({
      ...buildOfferDraft(eventRequest),
      businessId: "alpha",
      revision: 1
    });
    await store.saveDraft({ businessId: "alpha" }, draft);
    const createdAt = new Date().toISOString();
    await store.appendEvent({ businessId: "alpha" }, offerCase.caseId, {
      at: createdAt,
      role: "assistant",
      kind: "draft_created",
      text: "Angebotsentwurf erstellt.",
      artifactId: draft.draftId,
      revisionRef: {
        artifactType: "OfferDraft",
        artifactId: draft.draftId,
        revision: 1,
        createdAt
      }
    });
    await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toMatchObject({
      status: "completed",
      version: 3
    });

    const retry = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers: alphaHeaders,
      payload: { ...eventRequest, caseId: offerCase.caseId }
    });

    expect(retry.statusCode, retry.body).toBe(201);
    const reopened = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    expect(reopened).toMatchObject({ status: "open", version: 4 });
    expect(reopened).not.toHaveProperty("approvedOfferId");
    expect(reopened).not.toHaveProperty("productionHandoffId");
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
      .filter((event) => event.kind === "draft_created" && event.artifactId === draft.draftId)).toHaveLength(1);
  });

  it("leaves a completed case unchanged when a continuation draft cannot be saved", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    await completeOfferCase(app, offerCase.caseId);
    const completed = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    store.saveDraftForCase = async () => {
      throw new Error("injected draft write failure");
    };

    const response = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        requestId: "request-offer-continuation-failed",
        text: "Bitte das Angebot ändern."
      }
    });

    expect(response.statusCode).toBe(500);
    await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toEqual(completed);
  });

  it("keeps a deterministic draft in one case and records draft creation only once", async () => {
    const { app, store } = buildHarness();
    const firstCase = await createOfferCase(app);
    const secondCase = await createOfferCase(app, alphaHeaders, { customerName: "Andere Firma" });
    const eventRequest = createEventRequestFromText({
      requestId: "request-shared-offer",
      channel: "text",
      rawText: "Besprechung für 5 Personen mit Kaffeepause."
    });
    const createInCase = (caseId: string) => app.inject({
      method: "POST" as const,
      url: "/v1/offers/drafts",
      headers: alphaHeaders,
      payload: { ...eventRequest, caseId }
    });

    const first = await createInCase(firstCase.caseId);
    const retry = await createInCase(firstCase.caseId);
    const conflictingCase = await createInCase(secondCase.caseId);

    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(retry.json()).toEqual(first.json());
    expect(conflictingCase.statusCode, conflictingCase.body).toBe(409);
    expect((await store.listEvents({ businessId: "alpha" }, firstCase.caseId))
      .filter((event) => event.kind === "draft_created")).toHaveLength(1);
    expect((await store.listEvents({ businessId: "alpha" }, secondCase.caseId))
      .filter((event) => event.kind === "draft_created")).toHaveLength(0);
  });

  it("repairs a missing draft_created event after the draft itself was persisted", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const eventRequest = createEventRequestFromText({
      requestId: "request-draft-event-repair",
      channel: "text",
      rawText: "Besprechung für 5 Personen mit Kaffeepause."
    });
    const draft = validateOfferDraft({
      ...buildOfferDraft(eventRequest),
      businessId: "alpha",
      revision: 1
    });
    await store.saveDraft({ businessId: "alpha" }, draft);

    const repaired = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers: alphaHeaders,
      payload: { ...eventRequest, caseId: offerCase.caseId }
    });

    expect(repaired.statusCode, repaired.body).toBe(201);
    expect(repaired.json()).toEqual(draft);
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
      .filter((event) => event.kind === "draft_created")).toMatchObject([{
        artifactId: draft.draftId,
        revisionRef: {
          artifactType: "OfferDraft",
          artifactId: draft.draftId,
          revision: 1
        }
      }]);
  });

  it("records one review and approval only after the authoritative decision succeeds", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const request = () => app.inject({
      method: "POST" as const,
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });

    const first = await request();
    const retry = await request();

    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    const decision = first.json<{
      approval: { approvalRequestId: string };
      approvedOffer: { approvedOfferId: string };
    }>();
    const events = await store.listEvents({ businessId: "alpha" }, offerCase.caseId);
    expect(events.filter((event) => event.kind === "review_decision")).toMatchObject([{
      role: "user",
      artifactId: decision.approval.approvalRequestId
    }]);
    expect(events.filter((event) => event.kind === "approval")).toMatchObject([{
      role: "system",
      artifactId: decision.approvedOffer.approvedOfferId
    }]);
    await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toMatchObject({
      approvedOfferId: decision.approvedOffer.approvedOfferId,
      status: "open",
      version: 2
    });

    const conflicting = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "rejected", revision: 1 }
    });
    expect(conflicting.statusCode).toBe(409);
    await expect(store.listEvents({ businessId: "alpha" }, offerCase.caseId)).resolves.toHaveLength(events.length);
  });

  it("records a rejection as review evidence without claiming an approval", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "rejected", revision: 1, comment: "Budget nicht freigegeben" }
    });

    expect(response.statusCode, response.body).toBe(201);
    const approvalRequestId = response.json<{ approval: { approvalRequestId: string } }>().approval.approvalRequestId;
    const events = await store.listEvents({ businessId: "alpha" }, offerCase.caseId);
    expect(events.filter((event) => event.kind === "review_decision")).toMatchObject([{
      role: "user",
      artifactId: approvalRequestId,
      text: "Angebotsentwurf abgelehnt."
    }]);
    expect(events.some((event) => event.kind === "approval")).toBe(false);
  });

  it("records the handoff result once and never before a handoff write succeeds", async () => {
    const { app, store } = buildHarness();
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    expect(decision.statusCode, decision.body).toBe(201);
    const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
    const originalInsertHandoff = store.insertHandoff.bind(store);
    store.insertHandoff = async () => { throw new Error("injected handoff write failure"); };

    const failed = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(failed.statusCode).toBe(500);
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId)).some((event) => event.kind === "result")).toBe(false);

    store.insertHandoff = originalInsertHandoff;
    const first = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });
    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });

    expect(first.statusCode, first.body).toBe(201);
    expect(retry.statusCode, retry.body).toBe(201);
    const handoffId = first.json<{ handoff: { handoffId: string } }>().handoff.handoffId;
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
      .filter((event) => event.kind === "result")).toMatchObject([{
      role: "system",
      artifactId: handoffId,
      text: "Angebot an die Produktion übergeben."
    }]);
    await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toMatchObject({
      approvedOfferId,
      productionHandoffId: handoffId,
      status: "completed",
      version: 3
    });
  });

  it("rejects an old handoff after a later continuation reopened the OfferCase", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const completed = await completeOfferCase(app, offerCase.caseId);
    const continuation = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        requestId: "request-offer-case-after-handoff",
        text: "Bitte das Angebot für 50 Personen neu berechnen."
      }
    });
    expect(continuation.statusCode, continuation.body).toBe(201);
    const openCase = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    expect(openCase?.status).toBe("open");
    expect(openCase).not.toHaveProperty("approvedOfferId");
    expect(openCase).not.toHaveProperty("productionHandoffId");
    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${completed.approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });
    const read = await app.inject({
      method: "GET",
      url: `/v1/offers/handoffs/${completed.productionHandoffId}`,
      headers: alphaHeaders
    });

    expect(retry.statusCode, retry.body).toBe(409);
    expect(read.statusCode, read.body).toBe(409);
    expect(await store.getCase({ businessId: "alpha" }, offerCase.caseId)).toEqual(openCase);
    expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
      .filter((event) => event.kind === "result" && event.artifactId === completed.productionHandoffId)).toHaveLength(1);
  });

  it("checks the current continuation before recovering a stale Handoff projection", async () => {
    const { app, store, auditLog } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: {
        decision: "approved",
        revision: 1,
        variantId: draft.variantSet[0]!.variantId
      }
    });
    expect(decision.statusCode, decision.body).toBe(201);
    const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>()
      .approvedOffer.approvedOfferId;
    const approvalRequestId = decision.json<{ approval: { approvalRequestId: string } }>()
      .approval.approvalRequestId;
    const continuation = await app.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: alphaHeaders,
      payload: {
        caseId: offerCase.caseId,
        requestId: "request-stale-handoff-after-continuation",
        text: "Bitte das Angebot für 50 Personen neu berechnen."
      }
    });
    expect(continuation.statusCode, continuation.body).toBe(201);

    // Simulate a recoverable, partially projected old aggregate. The current
    // continuation is real; a stale Handoff must not repair A before rejecting.
    const approval = await store.getApproval({ businessId: "alpha" }, approvalRequestId);
    const approvedOffer = await store.getApprovedOffer({ businessId: "alpha" }, approvedOfferId);
    if (!approval || !approvedOffer) throw new Error("Expected the initial decision projections.");
    const approvalCollection = (store as any).approvals as { deleteIfExact: (...args: any[]) => Promise<unknown> };
    const approvedOfferCollection = (store as any).approvedOffers as { deleteIfExact: (...args: any[]) => Promise<unknown> };
    await approvalCollection.deleteIfExact({ businessId: "alpha" }, approvalRequestId, approval);
    await approvedOfferCollection.deleteIfExact({ businessId: "alpha" }, approvedOfferId, approvedOffer);

    const before = {
      case: await store.getCase({ businessId: "alpha" }, offerCase.caseId),
      events: await store.listEvents({ businessId: "alpha" }, offerCase.caseId),
      approvals: await store.listApprovalsForDraft({ businessId: "alpha" }, draft.draftId),
      approvedOffers: await store.listApprovedOffers({ businessId: "alpha" }),
      handoffs: await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
        .list({ businessId: "alpha" }),
      audits: await auditLog.listRecentFor({ businessId: "alpha" }, 100)
    };
    const retry = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });

    expect(retry.statusCode, retry.body).toBe(409);
    expect(await store.getCase({ businessId: "alpha" }, offerCase.caseId)).toEqual(before.case);
    expect(await store.listEvents({ businessId: "alpha" }, offerCase.caseId)).toEqual(before.events);
    expect(await store.listApprovalsForDraft({ businessId: "alpha" }, draft.draftId)).toEqual(before.approvals);
    expect(await store.listApprovedOffers({ businessId: "alpha" })).toEqual(before.approvedOffers);
    expect(await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
      .list({ businessId: "alpha" })).toEqual(before.handoffs);
    expect(await auditLog.listRecentFor({ businessId: "alpha" }, 100)).toEqual(before.audits);
  });

  it("rejects a Handoff GET that loses the OfferCase to a continuation after its initial check", async () => {
    const { app, store, auditLog } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: {
        decision: "approved",
        revision: 1,
        variantId: draft.variantSet[0]!.variantId
      }
    });
    expect(decision.statusCode, decision.body).toBe(201);
    const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>()
      .approvedOffer.approvedOfferId;
    const approvalRequestId = decision.json<{ approval: { approvalRequestId: string } }>()
      .approval.approvalRequestId;
    const handoff = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(handoff.statusCode, handoff.body).toBe(201);
    const handoffId = handoff.json<{ handoff: { handoffId: string } }>().handoff.handoffId;

    // Leave a recoverable aggregate while removing the projections that GET would otherwise repair.
    const approval = await store.getApproval({ businessId: "alpha" }, approvalRequestId);
    const approvedOffer = await store.getApprovedOffer({ businessId: "alpha" }, approvedOfferId);
    if (!approval || !approvedOffer) throw new Error("Expected the initial Decision projections.");
    const approvalCollection = (store as any).approvals as { deleteIfExact: (...args: any[]) => Promise<unknown> };
    const approvedOfferCollection = (store as any).approvedOffers as { deleteIfExact: (...args: any[]) => Promise<unknown> };
    await approvalCollection.deleteIfExact({ businessId: "alpha" }, approvalRequestId, approval);
    await approvedOfferCollection.deleteIfExact({ businessId: "alpha" }, approvedOfferId, approvedOffer);

    const repository = offerDecisionRepositoryFor(store);
    const originalWithTargetCriticalSection = repository.withTargetCriticalSection.bind(repository);
    const originalSaveDraftForCase = store.saveDraftForCase.bind(store);
    let releaseBeforeLock!: () => void;
    const beforeLockReleased = new Promise<void>((resolve) => { releaseBeforeLock = resolve; });
    let signalBeforeLock!: () => void;
    const beforeLock = new Promise<void>((resolve) => { signalBeforeLock = resolve; });
    let signalContinuationRequest!: () => void;
    const continuationRequest = new Promise<void>((resolve) => { signalContinuationRequest = resolve; });
    repository.withTargetCriticalSection = async (context, target, operation, compatibilityTargets) => {
      signalBeforeLock();
      await beforeLockReleased;
      return originalWithTargetCriticalSection(context, target, operation, compatibilityTargets);
    };
    store.saveDraftForCase = async (context, caseId, nextDraft, sourceRefs) => {
      signalContinuationRequest();
      return originalSaveDraftForCase(context, caseId, nextDraft, sourceRefs);
    };

    try {
      const before = {
        approvals: await store.listApprovalsForDraft({ businessId: "alpha" }, draft.draftId),
        approvedOffers: await store.listApprovedOffers({ businessId: "alpha" }),
        handoffs: await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
          .list({ businessId: "alpha" }),
        audits: await auditLog.listRecentFor({ businessId: "alpha" }, 100)
      };
      const handoffPromise = app.inject({
        method: "GET",
        url: `/v1/offers/handoffs/${handoffId}`,
        headers: alphaHeaders
      });
      await beforeLock;
      const continuationPromise = app.inject({
        method: "POST",
        url: "/v1/offers/from-text",
        headers: alphaHeaders,
        payload: {
          caseId: offerCase.caseId,
          requestId: "request-handoff-get-race",
          text: "Bitte das Angebot für 50 Personen neu berechnen."
        }
      });
      await continuationRequest;
      releaseBeforeLock();
      const continuation = await continuationPromise;
      expect(continuation.statusCode, continuation.body).toBe(201);
      const afterContinuation = {
        case: await store.getCase({ businessId: "alpha" }, offerCase.caseId),
        events: await store.listEvents({ businessId: "alpha" }, offerCase.caseId),
        approvals: await store.listApprovalsForDraft({ businessId: "alpha" }, draft.draftId),
        approvedOffers: await store.listApprovedOffers({ businessId: "alpha" }),
        handoffs: await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
          .list({ businessId: "alpha" }),
        audits: await auditLog.listRecentFor({ businessId: "alpha" }, 100)
      };
      const response = await handoffPromise;
      expect(response.statusCode, response.body).toBe(409);
      expect(await store.getCase({ businessId: "alpha" }, offerCase.caseId)).toEqual(afterContinuation.case);
      expect(await store.listEvents({ businessId: "alpha" }, offerCase.caseId)).toEqual(afterContinuation.events);
      expect(await store.listApprovalsForDraft({ businessId: "alpha" }, draft.draftId)).toEqual(afterContinuation.approvals);
      expect(await store.listApprovedOffers({ businessId: "alpha" })).toEqual(afterContinuation.approvedOffers);
      expect(await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
        .list({ businessId: "alpha" })).toEqual(afterContinuation.handoffs);
      expect(await auditLog.listRecentFor({ businessId: "alpha" }, 100)).toEqual(afterContinuation.audits);
      expect(before.approvals).toEqual([]);
    } finally {
      releaseBeforeLock();
      repository.withTargetCriticalSection = originalWithTargetCriticalSection;
      store.saveDraftForCase = originalSaveDraftForCase;
      await app.close();
    }
  });

  it("rejects a corrupted Handoff before GET repairs missing Decision projections", async () => {
    const { app, store, auditLog } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    expect(decision.statusCode, decision.body).toBe(201);
    const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>()
      .approvedOffer.approvedOfferId;
    const approvalRequestId = decision.json<{ approval: { approvalRequestId: string } }>()
      .approval.approvalRequestId;
    const handoffResponse = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(handoffResponse.statusCode, handoffResponse.body).toBe(201);
    const handoff = handoffResponse.json<{ handoff: Record<string, unknown> }>().handoff;
    const handoffCollection = (store as any).handoffs as {
      set: (context: { businessId: string }, value: Record<string, unknown>) => Promise<void>
    };
    await handoffCollection.set({ businessId: "alpha" }, {
      ...handoff,
      pricingSnapshot: {
        ...(handoff.pricingSnapshot as Record<string, unknown>),
        subtotal: { amount: 9999.99, currency: "EUR" }
      }
    });
    const approval = await store.getApproval({ businessId: "alpha" }, approvalRequestId);
    const approvedOffer = await store.getApprovedOffer({ businessId: "alpha" }, approvedOfferId);
    if (!approval || !approvedOffer) throw new Error("Expected Decision projections.");
    const approvals = (store as any).approvals as { deleteIfExact: (...args: any[]) => Promise<unknown> };
    const approvedOffers = (store as any).approvedOffers as { deleteIfExact: (...args: any[]) => Promise<unknown> };
    await approvals.deleteIfExact({ businessId: "alpha" }, approvalRequestId, approval);
    await approvedOffers.deleteIfExact({ businessId: "alpha" }, approvedOfferId, approvedOffer);
    const before = {
      approval: await store.getApproval({ businessId: "alpha" }, approvalRequestId),
      approvedOffer: await store.getApprovedOffer({ businessId: "alpha" }, approvedOfferId),
      handoff: await store.getHandoff({ businessId: "alpha" }, handoff.handoffId as string),
      audits: await auditLog.listRecentFor({ businessId: "alpha" }, 100)
    };
    const response = await app.inject({
      method: "GET",
      url: `/v1/offers/handoffs/${handoff.handoffId as string}`,
      headers: alphaHeaders
    });
    expect(response.statusCode, response.body).toBe(409);
    expect(await store.getApproval({ businessId: "alpha" }, approvalRequestId)).toEqual(before.approval);
    expect(await store.getApprovedOffer({ businessId: "alpha" }, approvedOfferId)).toEqual(before.approvedOffer);
    expect(await store.getHandoff({ businessId: "alpha" }, handoff.handoffId as string)).toEqual(before.handoff);
    expect(await auditLog.listRecentFor({ businessId: "alpha" }, 100)).toEqual(before.audits);
  });

  it("rejects a Handoff GET when the Case points at a different approved offer", async () => {
    const { app, store, auditLog } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const completed = await completeOfferCase(app, offerCase.caseId);
    const current = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    if (!current) throw new Error("Expected the completed OfferCase.");
    expect(await store.updateCase({ businessId: "alpha" }, offerCase.caseId, current.version, {
      ...current,
      approvedOfferId: "foreign-approved-offer",
      version: current.version + 1
    })).toBe("updated");
    const before = {
      case: await store.getCase({ businessId: "alpha" }, offerCase.caseId),
      events: await store.listEvents({ businessId: "alpha" }, offerCase.caseId),
      handoffs: await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
        .list({ businessId: "alpha" }),
      audits: await auditLog.listRecentFor({ businessId: "alpha" }, 100)
    };
    const response = await app.inject({
      method: "GET",
      url: `/v1/offers/handoffs/${completed.productionHandoffId}`,
      headers: alphaHeaders
    });
    expect(response.statusCode, response.body).toBe(409);
    expect(await store.getCase({ businessId: "alpha" }, offerCase.caseId)).toEqual(before.case);
    expect(await store.listEvents({ businessId: "alpha" }, offerCase.caseId)).toEqual(before.events);
    expect(await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
      .list({ businessId: "alpha" })).toEqual(before.handoffs);
    expect(await auditLog.listRecentFor({ businessId: "alpha" }, 100)).toEqual(before.audits);
  });

  it("rejects a Handoff GET when its Case is still open despite matching Handoff binding", async () => {
    const { app, store, auditLog } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const completed = await completeOfferCase(app, offerCase.caseId);
    const current = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
    if (!current) throw new Error("Expected the completed OfferCase.");
    expect(await store.updateCase({ businessId: "alpha" }, offerCase.caseId, current.version, {
      ...current,
      status: "open",
      version: current.version + 1
    })).toBe("updated");
    const before = {
      case: await store.getCase({ businessId: "alpha" }, offerCase.caseId),
      events: await store.listEvents({ businessId: "alpha" }, offerCase.caseId),
      handoffs: await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
        .list({ businessId: "alpha" }),
      audits: await auditLog.listRecentFor({ businessId: "alpha" }, 100)
    };
    const response = await app.inject({
      method: "GET",
      url: `/v1/offers/handoffs/${completed.productionHandoffId}`,
      headers: alphaHeaders
    });
    expect(response.statusCode, response.body).toBe(409);
    expect(await store.getCase({ businessId: "alpha" }, offerCase.caseId)).toEqual(before.case);
    expect(await store.listEvents({ businessId: "alpha" }, offerCase.caseId)).toEqual(before.events);
    expect(await ((store as any).handoffs as { list: (context: { businessId: string }) => Promise<unknown[]> })
      .list({ businessId: "alpha" })).toEqual(before.handoffs);
    expect(await auditLog.listRecentFor({ businessId: "alpha" }, 100)).toEqual(before.audits);
  });

  it("keeps a Handoff GET and continuation serialized when GET acquires the Case lock first", async () => {
    const { app, store } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    expect(decision.statusCode, decision.body).toBe(201);
    const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>()
      .approvedOffer.approvedOfferId;
    const handoff = await app.inject({
      method: "POST",
      url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
      headers: alphaHeaders,
      payload: {}
    });
    expect(handoff.statusCode, handoff.body).toBe(201);
    const handoffId = handoff.json<{ handoff: { handoffId: string } }>().handoff.handoffId;

    const repository = offerDecisionRepositoryFor(store);
    const originalWithTargetCriticalSection = repository.withTargetCriticalSection.bind(repository);
    const originalSaveDraftForCase = store.saveDraftForCase.bind(store);
    let releaseGet!: () => void;
    const getReleased = new Promise<void>((resolve) => { releaseGet = resolve; });
    let signalGetLock!: () => void;
    const getLock = new Promise<void>((resolve) => { signalGetLock = resolve; });
    let signalContinuationRequest!: () => void;
    const continuationRequest = new Promise<void>((resolve) => { signalContinuationRequest = resolve; });
    let continuationFinished = false;
    repository.withTargetCriticalSection = async (context, target, operation, compatibilityTargets) =>
      originalWithTargetCriticalSection(
        context,
        target,
        async (scope, transactionalQueryable) => {
          signalGetLock();
          const result = await operation(scope, transactionalQueryable);
          await getReleased;
          return result;
        },
        compatibilityTargets
      );
    store.saveDraftForCase = async (context, caseId, nextDraft, sourceRefs) => {
      signalContinuationRequest();
      const result = await originalSaveDraftForCase(context, caseId, nextDraft, sourceRefs);
      continuationFinished = true;
      return result;
    };

    try {
      const getPromise = app.inject({
        method: "GET",
        url: `/v1/offers/handoffs/${handoffId}`,
        headers: alphaHeaders
      });
      await getLock;
      const continuationPromise = app.inject({
        method: "POST",
        url: "/v1/offers/from-text",
        headers: alphaHeaders,
        payload: {
          caseId: offerCase.caseId,
          requestId: "request-handoff-get-serial",
          text: "Bitte das Angebot für 50 Personen neu berechnen."
        }
      });
      await continuationRequest;
      expect(continuationFinished).toBe(false);
      await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toMatchObject({
        status: "completed",
        productionHandoffId: handoffId
      });
      releaseGet();
      const response = await getPromise;
      expect(response.statusCode, response.body).toBe(200);
      const continuation = await continuationPromise;
      expect(continuation.statusCode, continuation.body).toBe(201);
      expect(continuationFinished).toBe(true);
      await expect(store.getCase({ businessId: "alpha" }, offerCase.caseId)).resolves.toMatchObject({ status: "open" });
    } finally {
      releaseGet();
      repository.withTargetCriticalSection = originalWithTargetCriticalSection;
      store.saveDraftForCase = originalSaveDraftForCase;
      await app.close();
    }
  });

  it("does not let a continuation overwrite the current OfferCase after a Decision check", async () => {
    const { app, store, rootDir } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const originalAppendEventInCaseScope = store.appendEventInCaseScope.bind(store);
    const originalSaveDraftForCase = store.saveDraftForCase.bind(store);
    let releaseDecision!: () => void;
    const decisionRelease = new Promise<void>((resolve) => { releaseDecision = resolve; });
    let signalDecisionAppend!: () => void;
    const decisionAppend = new Promise<void>((resolve) => { signalDecisionAppend = resolve; });
    let signalContinuationRequest!: () => void;
    const continuationRequest = new Promise<void>((resolve) => { signalContinuationRequest = resolve; });
    let continuationSignalled = false;
    store.appendEventInCaseScope = async (context, caseId, input, eventIdentity) => {
      if (input.kind === "review_decision") {
        signalDecisionAppend();
        await decisionRelease;
      }
      return originalAppendEventInCaseScope(context, caseId, input, eventIdentity);
    };
    store.saveDraftForCase = async (context, caseId, nextDraft, sourceRefs) => {
      if (!continuationSignalled) {
        continuationSignalled = true;
        signalContinuationRequest();
      }
      return originalSaveDraftForCase(context, caseId, nextDraft, sourceRefs);
    };

    try {
      const decisionPromise = app.inject({
        method: "POST",
        url: `/v1/offers/drafts/${draft.draftId}/decision`,
        headers: alphaHeaders,
        payload: {
          decision: "approved",
          revision: 1,
          variantId: draft.variantSet[0]!.variantId
        }
      });
      await decisionAppend;
      const continuationPromise = app.inject({
        method: "POST",
        url: "/v1/offers/from-text",
        headers: alphaHeaders,
        payload: {
          caseId: offerCase.caseId,
          requestId: "request-offer-case-decision-race",
          text: "Bitte das Angebot für 50 Personen neu berechnen."
        }
      });
      await continuationRequest;
      const caseLock = targetLockPath(rootDir, "alpha", "offers/case-events", {
        kind: "offer_case",
        artifactId: offerCase.caseId,
        revision: 0
      });
      await waitUntil(() => readdirSync(`${caseLock}.queue`).some((entry) => entry.startsWith("ticket-")));
      expect(existsSync(targetLockPath(rootDir, "alpha", "offers", {
        kind: "offer_draft",
        artifactId: draft.draftId,
        revision: 1
      }))).toBe(true);
      expect(existsSync(targetLockPath(rootDir, "alpha", "offers/case-events", {
        kind: "offer_draft",
        artifactId: draft.draftId,
        revision: 1
      }))).toBe(true);
      expect(existsSync(caseLock)).toBe(true);
      expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
        .filter((event) => event.kind === "draft_created")).toHaveLength(1);

      releaseDecision();
      const [decision, continuation] = await Promise.all([decisionPromise, continuationPromise]);
      expect(decision.statusCode, decision.body).toBe(201);
      expect(continuation.statusCode, continuation.body).toBe(201);
      const current = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
      expect(current).toMatchObject({ status: "open" });
      expect(current).not.toHaveProperty("approvedOfferId");
      expect(current).not.toHaveProperty("productionHandoffId");
      const events = await store.listEvents({ businessId: "alpha" }, offerCase.caseId);
      const continuationBody = continuation.json<{ draftId: string }>();
      expect(events.at(-1)).toMatchObject({ kind: "draft_created", artifactId: continuationBody.draftId });
    } finally {
      releaseDecision();
      await app.close();
    }
  });

  it("holds the same Case lock while a continuation competes with Handoff", async () => {
    const { app, store, rootDir } = buildHarness("alpha");
    const offerCase = await createOfferCase(app);
    const draft = await createOfferDraft(app, offerCase.caseId);
    const decision = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: alphaHeaders,
      payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
    });
    expect(decision.statusCode, decision.body).toBe(201);
    const approvedOfferId = decision.json<{ approvedOffer: { approvedOfferId: string } }>()
      .approvedOffer.approvedOfferId;
    const originalAppendEventInCaseScope = store.appendEventInCaseScope.bind(store);
    const originalSaveDraftForCase = store.saveDraftForCase.bind(store);
    let releaseHandoff!: () => void;
    const handoffRelease = new Promise<void>((resolve) => { releaseHandoff = resolve; });
    let signalHandoffAppend!: () => void;
    const handoffAppend = new Promise<void>((resolve) => { signalHandoffAppend = resolve; });
    let signalContinuationRequest!: () => void;
    const continuationRequest = new Promise<void>((resolve) => { signalContinuationRequest = resolve; });
    let continuationSignalled = false;
    store.appendEventInCaseScope = async (context, caseId, input, eventIdentity) => {
      if (input.kind === "result") {
        signalHandoffAppend();
        await handoffRelease;
      }
      return originalAppendEventInCaseScope(context, caseId, input, eventIdentity);
    };
    store.saveDraftForCase = async (context, caseId, nextDraft, sourceRefs) => {
      if (!continuationSignalled) {
        continuationSignalled = true;
        signalContinuationRequest();
      }
      return originalSaveDraftForCase(context, caseId, nextDraft, sourceRefs);
    };

    try {
      const handoffPromise = app.inject({
        method: "POST",
        url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
        headers: alphaHeaders,
        payload: {}
      });
      await handoffAppend;
      const continuationPromise = app.inject({
        method: "POST",
        url: "/v1/offers/from-text",
        headers: alphaHeaders,
        payload: {
          caseId: offerCase.caseId,
          requestId: "request-offer-case-handoff-race",
          text: "Bitte das Angebot für 50 Personen neu berechnen."
        }
      });
      await continuationRequest;
      const caseLock = targetLockPath(rootDir, "alpha", "offers/case-events", {
        kind: "offer_case",
        artifactId: offerCase.caseId,
        revision: 0
      });
      await waitUntil(() => readdirSync(`${caseLock}.queue`).some((entry) => entry.startsWith("ticket-")));
      expect(existsSync(caseLock)).toBe(true);
      expect((await store.listEvents({ businessId: "alpha" }, offerCase.caseId))
        .some((event) => event.kind === "result")).toBe(false);

      releaseHandoff();
      const [handoff, continuation] = await Promise.all([handoffPromise, continuationPromise]);
      expect(handoff.statusCode, handoff.body).toBe(201);
      expect(continuation.statusCode, continuation.body).toBe(201);
      const current = await store.getCase({ businessId: "alpha" }, offerCase.caseId);
      expect(current).toMatchObject({ status: "open" });
      expect(current).not.toHaveProperty("productionHandoffId");
    } finally {
      releaseHandoff();
      await app.close();
    }
  });
});
