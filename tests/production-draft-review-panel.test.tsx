// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
      }
    ],
    draftArtifacts: {
      eventSpec: {
        event: {
          title: "Kundenbuffet"
        }
      }
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
        url === "/api/production/v1/production/drafts/draft-review-ui-1/review-cards/card-event" &&
        method === "PATCH"
      ) {
        draft = {
          ...draft,
          reviewCards: draft.reviewCards.map((card) =>
            card.cardId === "card-event" ? { ...card, decision: "fits" } : card
          )
        };
        return jsonResponse({ draft, reviewCard: draft.reviewCards[0] });
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

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, { submitting: false }));
      await flushPromises();
    });

    expect(document.body.textContent ?? "").toContain("Kundenbuffet");
    expect(document.body.textContent ?? "").toContain("Buffetdaten prüfen");
    expect(document.body.textContent ?? "").toContain("offen");

    const fitsButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Passt"
    ) as HTMLButtonElement | undefined;
    expect(fitsButton).toBeDefined();

    await act(async () => {
      fitsButton?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/production/v1/production/drafts/draft-review-ui-1/review-cards/card-event",
      expect.objectContaining({
        method: "PATCH"
      })
    );

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

    await act(async () => {
      root.unmount();
    });
  });
});
