// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatProductionDraftArtifactSummary,
  formatProductionDraftReviewDecisionLabel,
  formatProductionDraftSourceLabel,
  formatProductionDraftStatusLabel,
  ProductionDraftReviewPanel
} from "../backoffice-ui/src/production-draft-review-panel.js";
import type {
  ProductionDraft,
  ProductionDraftReviewDecision
} from "../backoffice-ui/src/api.js";

const originalFetch = globalThis.fetch;

function draftFixture(): ProductionDraft {
  return {
    draftId: "draft-review-ui-1",
    status: "pending_review",
    createdAt: "2026-07-01T12:00:00.000Z",
    source: {
      kind: "agent_cli",
      receivedAt: "2026-07-01T12:00:00.000Z"
    },
    reviewCards: [
      {
        cardId: "card-event",
        kind: "event_data",
        title: "Buffetdaten prüfen",
        summary: "Personenzahl und Datum fachlich bestätigen.",
        decision: "pending",
        targetId: "event",
        requiredApproval: true
      },
      {
        cardId: "card-plan",
        kind: "timeline",
        title: "Produktionsplan prüfen",
        summary: "Ablauf und Zeiten fachlich bestätigen.",
        decision: "pending",
        targetId: "plan-review-ui-1",
        requiredApproval: true
      },
      {
        cardId: "card-purchase",
        kind: "purchase_item",
        title: "Einkaufsliste prüfen",
        summary: "Mengen und Warengruppen fachlich bestätigen.",
        decision: "pending",
        targetId: "purchase-review-ui-1",
        requiredApproval: true
      },
      {
        cardId: "card-recipe-1",
        kind: "recipe",
        title: "Rezeptkarte 1 prüfen",
        summary: "Rezept, Allergene und Mengen fachlich bestätigen.",
        decision: "pending",
        targetId: "recipe-review-ui-1",
        requiredApproval: true
      },
      {
        cardId: "card-recipe-2",
        kind: "recipe",
        title: "Rezeptkarte 2 prüfen",
        summary: "Rezept, Allergene und Mengen fachlich bestätigen.",
        decision: "pending",
        targetId: "recipe-review-ui-2",
        requiredApproval: true
      }
    ],
    draftArtifacts: {
      eventSpec: {
        event: {
          title: "Kundenbuffet"
        }
      },
      productionPlan: {
        planId: "plan-review-ui-1"
      },
      purchaseList: {
        purchaseListId: "purchase-review-ui-1"
      },
      recipes: [
        { recipeId: "recipe-review-ui-1" },
        { recipeId: "recipe-review-ui-2" }
      ],
      openQuestions: [
        { question: "Ist eine vegetarische Alternative gewünscht?" }
      ],
      notes: ["Mengen vor Produktion prüfen."]
    }
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function buttonForReviewCard(cardTitle: string, buttonLabel: string): HTMLButtonElement | undefined {
  const cardItem = Array.from(document.querySelectorAll("li")).find((item) =>
    item.querySelector("strong")?.textContent === cardTitle
  );

  return Array.from(cardItem?.querySelectorAll("button") ?? []).find((button) =>
    button.textContent === buttonLabel
  ) as HTMLButtonElement | undefined;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: undefined
  });
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("ProductionDraftReviewPanel", () => {
  it("keeps raw source, status and decision values out of operator-facing labels", () => {
    const draft = draftFixture();

    expect(formatProductionDraftSourceLabel(draft)).toBe("Agenten-Entwurf");
    expect(formatProductionDraftSourceLabel(draft)).not.toContain("agent_cli");
    expect(formatProductionDraftStatusLabel("pending_review")).toBe("wartet auf Prüfung");
    expect(formatProductionDraftStatusLabel("pending_review")).not.toContain("pending_review");
    expect(formatProductionDraftReviewDecisionLabel("change_requested")).toBe("Änderung nötig");
    expect(formatProductionDraftReviewDecisionLabel("change_requested")).not.toContain("change_requested");
  });

  it("summarizes contained draft artifacts for review before takeover", () => {
    expect(formatProductionDraftArtifactSummary(draftFixture())).toBe(
      "Eventdaten, Produktionsplan, Einkaufsliste, 2 Rezeptkarten, 1 Rückfrage, 1 Notiz"
    );
    expect(formatProductionDraftArtifactSummary({
      ...draftFixture(),
      draftArtifacts: undefined
    })).toBe("keine Fachartefakte");
  });

  it("loads pending ProductionDrafts and calls the draft-only review endpoints", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
    });
    let draft = draftFixture();
    let approvedProductionSpecs: Array<{
      approvedProductionSpecId: string;
      sourceDraft: { draftId: string; revision: number };
      applied: boolean;
    }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/production/v1/production/drafts" && method === "GET") {
        return jsonResponse({ items: [draft], approvedProductionSpecs });
      }

      if (
        url.startsWith("/api/production/v1/production/drafts/draft-review-ui-1/review-cards/") &&
        method === "PATCH"
      ) {
        const cardId = url.split("/").at(-1);
        draft = {
          ...draft,
          reviewCards: draft.reviewCards.map((card) =>
            card.cardId === cardId ? { ...card, decision: "fits" } : card
          )
        };
        return jsonResponse({ draft, reviewCard: draft.reviewCards.find((card) => card.cardId === cardId) });
      }

      if (url === "/api/production/v1/production/drafts/draft-review-ui-1/decision" && method === "POST") {
        draft = {
          ...draft,
          status: "approved"
        };
        approvedProductionSpecs = [{
          approvedProductionSpecId: "approved-production-spec-ui-1",
          sourceDraft: { draftId: draft.draftId, revision: draft.revision ?? 1 },
          applied: false
        }];
        return jsonResponse({
          approval: { approvalRequestId: "approval-ui-1", decision: "approved" },
          approvedProductionSpec: { approvedProductionSpecId: "approved-production-spec-ui-1" }
        }, 201);
      }

      if (url === "/api/production/v1/production/approved-specs/approved-production-spec-ui-1/apply" && method === "POST") {
        approvedProductionSpecs = approvedProductionSpecs.map((projection) => ({
          ...projection,
          applied: true
        }));
        return jsonResponse({
          eventSpec: { specId: "spec-review-ui-1" },
          plan: {},
          purchaseList: {},
          recipes: []
        });
      }

      return jsonResponse({ message: "not found" }, 404);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const onDraftChanged = vi.fn(async () => undefined);

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, { submitting: false, onDraftChanged }));
      await flushPromises();
    });

    expect(document.body.textContent ?? "").toContain("Kundenbuffet");
    expect(document.body.textContent ?? "").toContain(
      "Enthält: Eventdaten, Produktionsplan, Einkaufsliste, 2 Rezeptkarten, 1 Rückfrage, 1 Notiz."
    );
    expect(document.body.textContent ?? "").toContain("5 Prüfpunkte");
    expect(document.body.textContent ?? "").toContain("Buffetdaten prüfen");
    expect(document.body.textContent ?? "").toContain("Produktionsplan prüfen");
    expect(document.body.textContent ?? "").toContain("Einkaufsliste prüfen");
    expect(document.body.textContent ?? "").toContain("Rezeptkarte 1 prüfen");
    expect(document.body.textContent ?? "").toContain("Rezeptkarte 2 prüfen");
    expect(document.body.textContent ?? "").toContain("offen");

    for (const card of draft.reviewCards) {
      const approveButtonBefore = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent === "Entwurf freigeben"
      ) as HTMLButtonElement | undefined;
      expect(approveButtonBefore).toBeDefined();
      expect(approveButtonBefore?.disabled).toBe(true);

      const fitsButton = buttonForReviewCard(card.title, "Passt");
      expect(fitsButton).toBeDefined();

      await act(async () => {
        fitsButton?.click();
        await flushPromises();
        await flushPromises();
      });

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/production/v1/production/drafts/draft-review-ui-1/review-cards/${card.cardId}`,
        expect.objectContaining({
          method: "PATCH"
        })
      );
    }

    await act(async () => {
      await flushPromises();
    });

    const approveButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Entwurf freigeben"
    ) as HTMLButtonElement | undefined;
    expect(approveButton).toBeDefined();
    expect(approveButton?.disabled).toBe(false);

    await act(async () => {
      approveButton?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/production/v1/production/drafts/draft-review-ui-1/decision",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(document.body.textContent ?? "").toContain("Produktionsentwurf freigegeben.");
    expect(onDraftChanged).toHaveBeenCalledWith();

    const applyButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Entwurf übernehmen"
    ) as HTMLButtonElement | undefined;
    expect(applyButton).toBeDefined();

    await act(async () => {
      applyButton?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/production/v1/production/approved-specs/approved-production-spec-ui-1/apply",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(document.body.textContent ?? "").toContain("Produktionsentwurf übernommen.");
    expect(onDraftChanged).toHaveBeenLastCalledWith("spec-review-ui-1");

    await act(async () => {
      root.unmount();
    });
  });

  it("prepares an event-only draft before showing the complete snapshot review", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    });
    const sourceDraft: ProductionDraft = {
      ...draftFixture(),
      draftId: "draft-event-only",
      revision: 1,
      reviewCards: [{ ...draftFixture().reviewCards[0]!, decision: "fits" }],
      draftArtifacts: {
        eventSpec: { event: { title: "Noch vorzubereitendes Sommerfest" } }
      }
    };
    const preparedDraft: ProductionDraft = {
      ...draftFixture(),
      draftId: "draft-prepared",
      revision: 2,
      supersedesDraftId: sourceDraft.draftId,
      draftArtifacts: {
        ...draftFixture().draftArtifacts,
        eventSpec: { event: { title: "Vorbereitetes Sommerfest" } }
      }
    };
    let drafts = [sourceDraft];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/production/v1/production/drafts" && method === "GET") {
        return jsonResponse({ items: drafts, approvedProductionSpecs: [] });
      }
      if (
        url === "/api/production/v1/production/drafts/draft-event-only/prepare" &&
        method === "POST"
      ) {
        drafts = [{ ...sourceDraft, status: "superseded" }, preparedDraft];
        return jsonResponse({ draft: preparedDraft }, 201);
      }
      return jsonResponse({ message: "not found" }, 404);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, { submitting: false }));
      await flushPromises();
    });

    const prepareButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Entwurf vorbereiten"
    );
    const approveButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Entwurf freigeben"
    ) as HTMLButtonElement | undefined;
    expect(prepareButton).toBeDefined();
    expect(approveButton?.disabled).toBe(true);

    await act(async () => {
      prepareButton?.click();
      await flushPromises();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/production/v1/production/drafts/draft-event-only/prepare",
      expect.objectContaining({ method: "POST" })
    );
    expect(document.body.textContent ?? "").toContain("Vorbereitetes Sommerfest");
    expect(document.body.textContent ?? "").toContain("Produktionsentwurf wurde vorbereitet.");
    expect(document.body.textContent ?? "").not.toContain("Noch vorzubereitendes Sommerfest");

    await act(async () => root.unmount());
  });

  it("recovers an unapplied approved snapshot on a fresh panel mount", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    });
    const approvedDraft: ProductionDraft = {
      ...draftFixture(),
      draftId: "draft-approved-reload",
      revision: 3,
      status: "approved",
      reviewCards: draftFixture().reviewCards.map((card) => ({ ...card, decision: "fits" }))
    };
    let applied = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/production/v1/production/drafts" && method === "GET") {
        return jsonResponse({
          items: [approvedDraft],
          approvedProductionSpecs: [{
            approvedProductionSpecId: "approved-production-spec-reload",
            sourceDraft: { draftId: approvedDraft.draftId, revision: 3 },
            applied
          }]
        });
      }
      if (
        url === "/api/production/v1/production/approved-specs/approved-production-spec-reload/apply" &&
        method === "POST"
      ) {
        applied = true;
        return jsonResponse({
          eventSpec: { specId: "spec-approved-reload" },
          plan: {},
          purchaseList: {},
          recipes: []
        });
      }
      return jsonResponse({ message: "not found" }, 404);
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const onDraftChanged = vi.fn(async () => undefined);

    const firstContainer = document.createElement("div");
    document.body.appendChild(firstContainer);
    const firstRoot = createRoot(firstContainer);
    await act(async () => {
      firstRoot.render(createElement(ProductionDraftReviewPanel, { submitting: false }));
      await flushPromises();
      firstRoot.unmount();
    });
    firstContainer.remove();

    const reloadedContainer = document.createElement("div");
    document.body.appendChild(reloadedContainer);
    const reloadedRoot = createRoot(reloadedContainer);
    await act(async () => {
      reloadedRoot.render(createElement(ProductionDraftReviewPanel, {
        submitting: false,
        onDraftChanged
      }));
      await flushPromises();
    });

    expect(document.body.textContent ?? "").toContain("Kundenbuffet");
    const applyButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Entwurf übernehmen"
    );
    expect(applyButton).toBeDefined();

    await act(async () => {
      applyButton?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/production/v1/production/approved-specs/approved-production-spec-reload/apply",
      expect.objectContaining({ method: "POST" })
    );
    expect(onDraftChanged).toHaveBeenCalledWith("spec-approved-reload");
    expect(document.body.textContent ?? "").not.toContain("Entwurf übernehmen");

    await act(async () => reloadedRoot.unmount());
  });

  it("collects one concrete change request before offering a new AI revision", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
    });
    let draft = draftFixture();
    let predecessor: ProductionDraft | undefined;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/production/v1/production/drafts" && method === "GET") {
        return jsonResponse({ items: predecessor ? [draft, predecessor] : [draft] });
      }
      if (
        url === "/api/production/v1/production/drafts/draft-review-ui-1/review-cards/card-event" &&
        method === "PATCH"
      ) {
        const body = JSON.parse(String(init?.body)) as {
          decision: ProductionDraft["reviewCards"][number]["decision"];
          operatorComment?: string;
        };
        draft = {
          ...draft,
          reviewCards: draft.reviewCards.map((card) =>
            card.cardId === "card-event"
              ? { ...card, decision: body.decision, operatorComment: body.operatorComment }
              : card
          )
        };
        return jsonResponse({ draft, reviewCard: draft.reviewCards[0] });
      }
      if (
        url === "/api/production/v1/production/drafts/draft-review-ui-1/revise" &&
        method === "POST"
      ) {
        predecessor = {
          ...draft,
          status: "superseded"
        };
        draft = {
          ...draft,
          draftId: "draft-review-ui-2",
          createdAt: "2026-07-01T12:30:00.000Z",
          supersedesDraftId: predecessor.draftId,
          reviewCards: draft.reviewCards.map((card) => ({
            ...card,
            summary: card.cardId === "card-event"
              ? "120 Personen und Datum fachlich bestätigen."
              : card.summary,
            decision: "pending",
            operatorComment: undefined
          })),
          draftArtifacts: {
            ...draft.draftArtifacts,
            eventSpec: {
              event: { title: "Kundenbuffet" },
              attendees: { expected: 120 }
            }
          }
        };
        return jsonResponse({ draft }, 201);
      }

      return jsonResponse({ message: "not found" }, 404);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, { submitting: false }));
      await flushPromises();
    });

    const changeButton = buttonForReviewCard("Buffetdaten prüfen", "Änderung nötig");
    expect(changeButton).toBeDefined();
    await act(async () => {
      changeButton?.click();
      await flushPromises();
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/review-cards/card-event"),
      expect.anything()
    );
    const commentField = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Was soll geändert werden?"]'
    );
    expect(commentField).not.toBeNull();
    const changeRequest = "Statt 100 kommen 120 Gäste.";
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(commentField, changeRequest);
      commentField?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const rememberButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Änderung vormerken"
    );
    expect(rememberButton).toBeDefined();
    await act(async () => {
      rememberButton?.click();
      await flushPromises();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/production/v1/production/drafts/draft-review-ui-1/review-cards/card-event",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          decision: "change_requested",
          operatorComment: changeRequest
        })
      })
    );
    const reviseButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Änderungen von KI einarbeiten"
    );
    expect(reviseButton).toBeDefined();

    await act(async () => {
      reviseButton?.click();
      await flushPromises();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/production/v1/production/drafts/draft-review-ui-1/revise",
      expect.objectContaining({ method: "POST" })
    );
    expect(document.body.textContent ?? "").toContain(
      "Neuer KI-Entwurf erstellt. Änderungswunsch und Ergebnis sind markiert."
    );
    expect(document.body.textContent ?? "").toContain(`Dein Änderungswunsch: ${changeRequest}`);
    expect(document.body.textContent ?? "").toContain("Im neuen Entwurf: 120 Personen und Datum fachlich bestätigen.");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest", behavior: "auto" });

    await act(async () => root.unmount());
  });

  it("stores a recipe comment without offering the source-extraction revision action", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
    });
    let draft = draftFixture();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/production/v1/production/drafts" && method === "GET") {
        return jsonResponse({ items: [draft] });
      }
      if (url.endsWith("/review-cards/card-recipe-1") && method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as { decision: ProductionDraftReviewDecision; operatorComment: string };
        draft = {
          ...draft,
          reviewCards: draft.reviewCards.map((card) =>
            card.cardId === "card-recipe-1" ? { ...card, ...body } : card
          )
        };
        return jsonResponse({ draft, reviewCard: draft.reviewCards[3] });
      }
      return jsonResponse({ message: "not found" }, 404);
    }) as typeof fetch;

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, { submitting: false }));
      await flushPromises();
    });
    await act(async () => {
      buttonForReviewCard("Rezeptkarte 1 prüfen", "Änderung nötig")?.click();
      await flushPromises();
    });
    const commentField = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Was soll geändert werden?"]');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(commentField, "Kerntemperatur ergänzen.");
      commentField?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const rememberButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Änderung vormerken"
    );
    await act(async () => {
      rememberButton?.click();
      await flushPromises();
      await flushPromises();
    });

    expect(document.body.textContent ?? "").toContain(
      "Rezept- und Planänderungen bleiben als Prüfnotiz gespeichert"
    );
    expect(document.body.textContent ?? "").not.toContain("Änderungen von KI einarbeiten");
    await act(async () => root.unmount());
  });

  it("embeds only the newest actionable draft in the upload flow", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
    });
    const olderDraft = {
      ...draftFixture(),
      draftId: "draft-older",
      createdAt: "2026-07-01T10:00:00.000Z",
      draftArtifacts: { eventSpec: { event: { title: "Älterer Entwurf" } } }
    };
    const newerDraft = {
      ...draftFixture(),
      draftId: "draft-newer",
      createdAt: "2026-07-01T12:00:00.000Z",
      draftArtifacts: { eventSpec: { event: { title: "Neuer Entwurf" } } }
    };
    globalThis.fetch = vi.fn(async () => jsonResponse({ items: [olderDraft, newerDraft] })) as typeof fetch;

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, {
        submitting: false,
        embedded: true,
        latestOnly: true
      }));
      await flushPromises();
    });

    expect(document.body.textContent ?? "").toContain("Neuer Entwurf");
    expect(document.body.textContent ?? "").not.toContain("Älterer Entwurf");
    expect(document.body.textContent ?? "").not.toContain("Produktionsentwürfe prüfen");
    await act(async () => root.unmount());
  });

  it("exposes and focuses the production draft selected by the handoff entry URL", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    });
    const selectedDraft = {
      ...draftFixture(),
      draftId: "draft-from-handoff",
      createdAt: "2026-07-01T10:00:00.000Z",
      draftArtifacts: { eventSpec: { event: { title: "Übergebener Entwurf" } } }
    };
    const newerDraft = {
      ...draftFixture(),
      draftId: "draft-newer",
      createdAt: "2026-07-01T12:00:00.000Z",
      draftArtifacts: { eventSpec: { event: { title: "Neuer Entwurf" } } }
    };
    window.history.pushState({}, "", "/produktion?productionDraftId=draft-from-handoff#production-draft-draft-from-handoff");
    globalThis.fetch = vi.fn(async () => jsonResponse({ items: [selectedDraft, newerDraft] })) as typeof fetch;

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, { submitting: false, embedded: true, latestOnly: true }));
      await flushPromises();
    });

    expect(document.body.textContent ?? "").toContain("Übergebener Entwurf");
    expect(document.body.textContent ?? "").not.toContain("Neuer Entwurf");
    expect(document.activeElement?.id).toBe("production-draft-draft-from-handoff");
    await act(async () => root.unmount());
  });

  it.each([
    ["missing", undefined],
    ["rejected", "rejected"],
    ["already applied", "applied"]
  ] as const)("shows an unavailable state for a %s requested production draft", async (_case, targetState) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    });
    const requestedDraft = targetState
      ? {
          ...draftFixture(),
          draftId: "draft-requested",
          status: targetState === "rejected" ? "rejected" as const : "approved" as const,
          appliedAt: targetState === "applied" ? "2026-07-01T12:30:00.000Z" : undefined,
          draftArtifacts: { eventSpec: { event: { title: "Nicht mehr verfügbarer Entwurf" } } }
        }
      : undefined;
    const unrelatedDraft = {
      ...draftFixture(),
      draftId: "draft-unrelated",
      createdAt: "2026-07-01T13:00:00.000Z",
      draftArtifacts: { eventSpec: { event: { title: "Fremder neuer Entwurf" } } }
    };
    window.history.pushState({}, "", "/produktion?productionDraftId=draft-requested");
    globalThis.fetch = vi.fn(async () => jsonResponse({
      items: requestedDraft ? [requestedDraft, unrelatedDraft] : [unrelatedDraft]
    })) as typeof fetch;

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, {
        submitting: false,
        embedded: true,
        latestOnly: true
      }));
      await flushPromises();
    });

    expect(document.body.textContent ?? "").toContain("angeforderte Produktionsentwurf ist nicht verfügbar");
    expect(document.body.textContent ?? "").not.toContain("Fremder neuer Entwurf");
    expect(document.body.textContent ?? "").not.toContain("Keine Produktionsentwürfe zur Prüfung");
    expect(document.body.textContent ?? "").not.toContain("draft-requested");

    await act(async () => root.unmount());
  });

  it("distinguishes a load failure and retries the requested production draft locally", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    });
    const requestedDraft = {
      ...draftFixture(),
      draftId: "draft-requested",
      draftArtifacts: { eventSpec: { event: { title: "Erneut geladener Entwurf" } } }
    };
    window.history.pushState({}, "", "/produktion?productionDraftId=draft-requested");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Dienst vorübergehend nicht erreichbar." }, 503))
      .mockResolvedValueOnce(jsonResponse({ items: [requestedDraft] }));
    globalThis.fetch = fetchMock as typeof fetch;

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, {
        submitting: false,
        embedded: true,
        latestOnly: true
      }));
      await flushPromises();
    });

    expect(document.querySelector('[role="alert"]')?.textContent ?? "").toContain(
      "Produktionsentwürfe konnten nicht geladen werden"
    );
    expect(document.body.textContent ?? "").not.toContain("Keine Produktionsentwürfe zur Prüfung");
    expect(document.body.textContent ?? "").not.toContain("angeforderte Produktionsentwurf ist nicht verfügbar");
    const retryButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Erneut versuchen"
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.body.textContent ?? "").toContain("Erneut geladener Entwurf");
    expect(document.querySelector('[role="alert"]')).toBeNull();

    await act(async () => root.unmount());
  });
});
