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
import type { ProductionDraft } from "../backoffice-ui/src/api.js";

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
        targetId: "event"
      },
      {
        cardId: "card-plan",
        kind: "timeline",
        title: "Produktionsplan prüfen",
        summary: "Ablauf und Zeiten fachlich bestätigen.",
        decision: "pending",
        targetId: "plan-review-ui-1"
      },
      {
        cardId: "card-purchase",
        kind: "purchase_item",
        title: "Einkaufsliste prüfen",
        summary: "Mengen und Warengruppen fachlich bestätigen.",
        decision: "pending",
        targetId: "purchase-review-ui-1"
      },
      {
        cardId: "card-recipe-1",
        kind: "recipe",
        title: "Rezeptkarte 1 prüfen",
        summary: "Rezept, Allergene und Mengen fachlich bestätigen.",
        decision: "pending",
        targetId: "recipe-review-ui-1"
      },
      {
        cardId: "card-recipe-2",
        kind: "recipe",
        title: "Rezeptkarte 2 prüfen",
        summary: "Rezept, Allergene und Mengen fachlich bestätigen.",
        decision: "pending",
        targetId: "recipe-review-ui-2"
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/production/v1/production/drafts" && method === "GET") {
        return jsonResponse({ items: [draft] });
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
        return jsonResponse({ draft });
      }

      if (url === "/api/production/v1/production/drafts/draft-review-ui-1/apply" && method === "POST") {
        draft = {
          ...draft,
          appliedAt: "2026-07-01T12:30:00.000Z",
          appliedBy: "Produktions-Mitarbeiter",
          appliedArtifactIds: {
            specId: "spec-review-ui-1"
          }
        };
        return jsonResponse({ draft, applied: draft.appliedArtifactIds });
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
      "/api/production/v1/production/drafts/draft-review-ui-1/apply",
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/production/v1/production/drafts" && method === "GET") {
        return jsonResponse({ items: [draft] });
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
        draft = {
          ...draft,
          draftId: "draft-review-ui-2",
          createdAt: "2026-07-01T12:30:00.000Z",
          reviewCards: draft.reviewCards.map((card) => ({
            ...card,
            decision: "pending",
            operatorComment: undefined
          }))
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
    expect(document.body.textContent ?? "").toContain("Neuer KI-Entwurf ist bereit zur Prüfung.");

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
});
