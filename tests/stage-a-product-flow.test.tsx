// @vitest-environment jsdom
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventRequestFromText, createOfferDraft } from "@catering/shared-core";
import { buildOfferApp } from "@catering/offer-service";
import { OfferStore } from "../offer-service/src/store.js";
import { buildProductionApp } from "@catering/production-service";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import { CaseHistoryPanel } from "../backoffice-ui/src/case-history-panel.js";
import { CaseNextActionBar } from "../backoffice-ui/src/case-next-action-bar.js";
import { buildCaseHistoryState } from "../backoffice-ui/src/case-history-state.js";
import { buildCaseNextAction } from "../backoffice-ui/src/case-next-action.js";
import { App } from "../backoffice-ui/src/App.js";

const secret = "stage-a-product-flow-secret";
const offerHeaders = {
  "x-catering-trusted-secret": secret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "alpha"
};
const productionHeaders = {
  ...offerHeaders,
  "x-catering-actor-name": "Produktions-Mitarbeiter"
};
const roots: string[] = [];
const uiRoots: Array<ReturnType<typeof createRoot>> = [];

function root(): string {
  const value = mkdtempSync(path.join(tmpdir(), "catering-stage-a-product-flow-"));
  roots.push(value);
  return value;
}

describe("Stage A product route flow", () => {
  afterEach(() => {
    for (const dataRoot of roots.splice(0)) rmSync(dataRoot, { recursive: true, force: true });
    for (const uiRoot of uiRoots.splice(0)) act(() => uiRoot.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it("reloads, searches and copies offer and production cases without inherited approval", async () => {
    const dataRoot = root();
    const offerApp = buildOfferApp({
      rootDir: dataRoot,
      store: new OfferStore({ rootDir: dataRoot }),
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const productionApp = buildProductionApp({
      dataRoot,
      store: new ProductionStore({ rootDir: dataRoot }),
      intakeRecords: new InMemoryIntakeRecordsPort(),
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    try {
      const offerCreated = await offerApp.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: offerHeaders,
        payload: { customerName: "Reload Customer", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 12 }
      });
      expect(offerCreated.statusCode).toBe(201);
      const offerCase = offerCreated.json<{ case: { caseId: string; displayName: string } }>().case;
      const offerDetail = await offerApp.inject({
        method: "GET",
        url: `/v1/offers/cases/${offerCase.caseId}`,
        headers: offerHeaders
      });
      expect(offerDetail.statusCode).toBe(200);
      expect(offerDetail.json().case.caseId).toBe(offerCase.caseId);
      expect((await offerApp.inject({ method: "GET", url: "/v1/offers/cases?search=Reload", headers: offerHeaders })).json().items).toHaveLength(1);
      const offerCopy = await offerApp.inject({
        method: "POST",
        url: `/v1/offers/cases/${offerCase.caseId}/copies`,
        headers: offerHeaders,
        payload: {}
      });
      expect(offerCopy.statusCode).toBe(201);
      expect(offerCopy.json().case).toMatchObject({ status: "open", displayName: offerCase.displayName });
      expect(offerCopy.json().case.approvedOfferId).toBeUndefined();
      expect(offerCopy.json().case.productionHandoffId).toBeUndefined();

      const productionCreated = await productionApp.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers: productionHeaders,
        payload: { customerName: "Reload Customer", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 12 }
      });
      expect(productionCreated.statusCode).toBe(201);
      const productionCase = productionCreated.json<{ case: { caseId: string; displayName: string } }>().case;
      expect((await productionApp.inject({ method: "GET", url: `/v1/production/cases/${productionCase.caseId}`, headers: productionHeaders })).statusCode).toBe(200);
      expect((await productionApp.inject({ method: "GET", url: "/v1/production/cases?search=Reload", headers: productionHeaders })).json().items).toHaveLength(1);
      const productionCopy = await productionApp.inject({
        method: "POST",
        url: `/v1/production/cases/${productionCase.caseId}/copies`,
        headers: productionHeaders,
        payload: {}
      });
      expect(productionCopy.statusCode).toBe(201);
      expect(productionCopy.json().case).toMatchObject({ status: "open", displayName: productionCase.displayName });
      expect(productionCopy.json().case.approvedProductionSpecId).toBeUndefined();
    } finally {
      await Promise.all([offerApp.close(), productionApp.close()]);
    }
  });

  it("renders accessible history and next-action contracts for a revision and handoff", () => {
    const item = {
      caseId: "case-1",
      product: "offer" as const,
      displayName: "Reload Customer - Empfang - 14.06.2026 - 12 Personen",
      status: "open" as const,
      createdAt: "2026-06-14T08:00:00.000Z",
      updatedAt: "2026-06-14T08:00:00.000Z"
    };
    const history = buildCaseHistoryState([item], "Reload Customer", item.caseId);
    const historyMarkup = renderToStaticMarkup(createElement(CaseHistoryPanel, {
      product: "offer",
      items: history.items,
      activeCaseId: history.activeCaseId,
      search: history.query,
      onSearchChange: () => undefined,
      onOpen: () => undefined,
      onCopy: async () => undefined
    }));
    expect(historyMarkup).toContain('aria-label="Frühere Angebotsaufträge"');
    expect(historyMarkup).toContain("Als neuen Auftrag verwenden");

    const action = buildCaseNextAction({
      product: "offer",
      caseStatus: "open",
      hasSource: true,
      currentDraftId: "draft-1",
      draftState: "change_requested",
      approvalBindingState: "absent"
    });
    const actionMarkup = renderToStaticMarkup(createElement(CaseNextActionBar, {
      action,
      busy: true,
      onAction: () => undefined
    }));
    expect(action.kind).toBe("request_revision");
    expect(actionMarkup).toContain("Wird ausgeführt");
    expect(actionMarkup).toContain('disabled=""');
  });

  it("drives the real App adapter from case navigation through visible progress and a recoverable action error", async () => {
    const request = createEventRequestFromText({
      requestId: "app-flow-request",
      channel: "text",
      rawText: "Menu: Caesar Salad fuer 12 Personen am 2026-06-14."
    });
    const baseDraft = createOfferDraft(request);
    const draft = {
      ...baseDraft,
      businessId: "alpha",
      draftId: "app-flow-draft",
      revision: 1,
      reviewStatus: {
        priceReviewStatus: "verified" as const,
        taxReviewStatus: "verified" as const,
        allergenReviewStatus: "verified" as const,
        hygieneTemperatureReviewStatus: "verified" as const,
        sourceSecured: true,
        publishApproved: true
      }
    };
    const approvedOffer = {
      approvedOfferId: "app-flow-approved",
      sourceDraft: { draftId: draft.draftId, revision: draft.revision },
      selectedVariantId: draft.variantSet[0]!.variantId
    };
    const handoff = {
      handoffId: "app-flow-handoff",
      approvedOfferId: approvedOffer.approvedOfferId,
      source: approvedOffer.sourceDraft,
      eventSpecSnapshot: draft.proposedEventSpec
    };
    const caseSummary = {
      caseId: "app-flow-case",
      product: "offer" as const,
      displayName: "App-Integrationsfall",
      status: "open" as const,
      createdAt: "2026-06-14T08:00:00.000Z",
      updatedAt: "2026-06-14T08:00:00.000Z"
    };
    let resolveHandoffRequest: ((response: Response) => void) | undefined;
    const handoffRequest = new Promise<Response>((resolve) => {
      resolveHandoffRequest = resolve;
    });
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ method, url });
      if (url.endsWith("/api/offers/health")) {
        return Response.json({ service: "offer-service", status: "ok", timestamp: "", counts: {} });
      }
      if (method === "GET" && url.endsWith("/api/offers/v1/offers/cases")) {
        return Response.json({ items: [caseSummary] });
      }
      if (method === "GET" && url.endsWith(`/api/offers/v1/offers/cases/${caseSummary.caseId}`)) {
        return Response.json({
          case: { ...caseSummary, schemaVersion: "1.0", businessId: "alpha", version: 1, productionHandoffId: handoff.handoffId },
          events: [{
            businessId: "alpha",
            eventId: "app-flow-draft-created",
            caseId: caseSummary.caseId,
            sequence: 1,
            at: "2026-06-14T08:00:00.000Z",
            role: "system",
            kind: "draft_created",
            text: "Angebotsentwurf erstellt.",
            revisionRef: { artifactType: "OfferDraft", artifactId: draft.draftId, revision: draft.revision, createdAt: "2026-06-14T08:00:00.000Z" }
          }],
          currentDraft: draft,
          approvedOffer,
          handoff
        });
      }
      if (method === "POST" && url.endsWith(`/api/production/v1/production/cases/from-handoff/${handoff.handoffId}`)) {
        return handoffRequest;
      }
      if (url.startsWith("/api/intake/v1/intake/specs/")) {
        return Response.json({ message: "not available in this UI fixture" }, { status: 404 });
      }
      throw new Error(`Unexpected App request: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const storage = new Map<string, string>();
    const storageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: storageMock });
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: storageMock });
    window.history.replaceState({}, "", "/angebot");
    const container = document.createElement("div");
    document.body.append(container);
    const uiRoot = createRoot(container);
    uiRoots.push(uiRoot);

    await act(async () => {
      uiRoot.render(createElement(App));
      await Promise.resolve();
      await Promise.resolve();
    });
    const openCase = container.querySelector("button[data-action='open-case']") as HTMLButtonElement | null;
    expect(openCase).not.toBeNull();
    expect(container.querySelector("[data-testid='case-next-action-bar']")?.textContent).toContain("Quelle");

    await act(async () => {
      openCase!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calls.some(({ method, url }) => method === "GET" && url.endsWith(`/cases/${caseSummary.caseId}`))).toBe(true);
    expect(container.textContent).toContain("App-Integrationsfall");
    expect(container.querySelector("[data-testid='case-next-action-bar']")?.textContent).toContain("Prüfung");
    const nextAction = container.querySelector("button[data-action='case-next-action']") as HTMLButtonElement;
    expect(nextAction.textContent).toContain("Übergabe öffnen");

    await act(async () => {
      nextAction.click();
      await Promise.resolve();
    });
    expect(nextAction.disabled).toBe(true);
    expect(nextAction.textContent).toContain("Wird ausgeführt");
    resolveHandoffRequest!(Response.json({ message: "Produktionsfall konnte nicht angelegt werden." }, { status: 422 }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector("[role='alert']")?.textContent).toContain("Produktionsfall konnte nicht angelegt werden");
    expect(nextAction.disabled).toBe(false);
  });
});
