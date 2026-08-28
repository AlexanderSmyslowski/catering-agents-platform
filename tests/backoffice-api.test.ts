import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAcceptedSpecFromText,
  createOfferCase,
  createOfferDraftFromRequest,
  createOfferFromText,
  createProductionCase,
  createProductionDraftFromAcceptedEventSpec,
  createProductionDraftFromDocument,
  offerExportUrl,
  productionExportUrl,
  purchaseListExportUrl,
  reviewRecipe,
  seedDemoData,
  uploadSourceDocument
} from "../backoffice-ui/src/api.js";

function installFetchSpy() {
  const calls: Array<{
    url: string;
    method?: string;
    credentials?: RequestCredentials;
    identityHeaders: string[];
    contentType: string | null;
  }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        method: init?.method,
        credentials: init?.credentials,
        identityHeaders: [...headers.keys()].filter((name) =>
          name === "authorization" ||
          name === "x-actor-name" ||
          name.startsWith("x-catering-") ||
          /(?:actor|subject|role|business|identity)/u.test(name)
        ),
        contentType: headers.get("content-type")
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    })
  );

  return calls;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("backoffice API session requests", () => {
  it("uses same-origin cookies without browser-supplied identity for mutating UI helpers", async () => {
    const calls = installFetchSpy();

    await createAcceptedSpecFromText("Konferenz am 2026-06-18 fuer 90 Teilnehmer.");
    await createOfferCase({ eventTypeLabel: "Lunch", attendeeCount: 80 });
    await createOfferFromText("offer-case-1", "Lunchangebot fuer 80 Personen.", "request-offer-ui-1");
    await reviewRecipe("offer", "recipe-offer-1", "approve");
    await reviewRecipe("production", "recipe-production-1", "verify");

    expect(calls).toEqual([
      {
        url: "/api/intake/v1/intake/normalize",
        method: "POST",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: "application/json"
      },
      {
        url: "/api/offers/v1/offers/cases",
        method: "POST",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: "application/json"
      },
      {
        url: "/api/offers/v1/offers/from-text",
        method: "POST",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: "application/json"
      },
      {
        url: "/api/offers/v1/offers/recipes/recipe-offer-1/review",
        method: "PATCH",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: "application/json"
      },
      {
        url: "/api/production/v1/production/recipes/recipe-production-1/review",
        method: "PATCH",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: "application/json"
      }
    ]);
  });

  it("keeps audit/seed paths free of browser identity claims", async () => {
    const calls = installFetchSpy();

    await seedDemoData();

    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.credentials)).toEqual(["same-origin", "same-origin", "same-origin"]);
    expect(calls.map((call) => call.identityHeaders)).toEqual([[], [], []]);
    expect(calls.map((call) => call.contentType)).toEqual(["application/json", "application/json", "application/json"]);
  });

  it("uploads originals to intake and sends only stable references to production", async () => {
    const calls = installFetchSpy();
    const file = new File(["%PDF-1.4 fixture"], "angebot.pdf", { type: "application/pdf" });

    await uploadSourceDocument(file);
    await createProductionCase({ eventTypeLabel: "Empfang", attendeeCount: 45 });
    await createProductionDraftFromDocument("production-case-1", "source-document-1");

    expect(calls).toEqual([
      {
        url: "/api/intake/v1/intake/source-documents",
        method: "POST",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: null
      },
      {
        url: "/api/production/v1/production/cases",
        method: "POST",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: "application/json"
      },
      {
        url: "/api/production/v1/production/drafts/from-document",
        method: "POST",
        credentials: "same-origin",
        identityHeaders: [],
        contentType: "application/json"
      }
    ]);
  });

  it("imports an AcceptedEventSpec as a guarded draft-only production review", async () => {
    const requests: Array<{ url: string; method?: string; credentials?: RequestCredentials; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        requests.push({ url: String(input), method: init?.method, credentials: init?.credentials, body });

        return new Response(JSON.stringify({ draft: body }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        });
      })
    );

    await createProductionDraftFromAcceptedEventSpec("production-case-safe", {
      schemaVersion: "1.0.0",
      specId: "spec-safe",
      event: { title: "Sommerfest" },
      attendees: { expected: 80 },
      menuPlan: []
    });

    expect(requests).toEqual([{
      url: "/api/production/v1/production/drafts",
      method: "POST",
      credentials: "same-origin",
      body: {
        caseId: "production-case-safe",
        specId: "spec-safe"
      }
    }]);
  });

  it("creates an offer draft with a stable case reference after intake normalization", async () => {
    const requests: Array<{ url: string; method?: string; credentials?: RequestCredentials; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        requests.push({ url: String(input), method: init?.method, credentials: init?.credentials, body });
        return new Response(JSON.stringify({ draftId: "offer-draft-upload-1" }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      })
    );

    await createOfferDraftFromRequest("offer-case-1", {
      requestId: "request-upload-1",
      channel: "pdf_upload",
      receivedAt: "2026-07-10T10:00:00.000Z",
      rawText: "Lunch fuer 40 Personen",
      signals: {},
      ambiguities: []
    });

    expect(requests).toEqual([{
      url: "/api/offers/v1/offers/drafts",
      method: "POST",
      credentials: "same-origin",
      body: {
        requestId: "request-upload-1",
        channel: "pdf_upload",
        receivedAt: "2026-07-10T10:00:00.000Z",
        rawText: "Lunch fuer 40 Personen",
        signals: {},
        ambiguities: [],
        caseId: "offer-case-1"
      }
    }]);
  });

  it("keeps export links on the read-only export service paths", () => {
    expect(offerExportUrl("draft-ops-1")).toBe("/api/exports/v1/exports/offers/draft-ops-1/html");
    expect(productionExportUrl("plan-ops-1")).toBe("/api/exports/v1/exports/production-plans/plan-ops-1/html");
    expect(purchaseListExportUrl("purchase-ops-1")).toBe(
      "/api/exports/v1/exports/purchase-lists/purchase-ops-1/csv"
    );
  });
});
