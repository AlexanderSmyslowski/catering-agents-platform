import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionDraftFromAcceptedEventSpec,
  createProductionDraftFromDocument,
  offerExportUrl,
  productionExportUrl,
  purchaseListExportUrl,
  reviewRecipe,
  seedDemoData
} from "../backoffice-ui/src/api.js";

function installFetchSpy() {
  const calls: Array<{ url: string; method?: string; actor: string | null; contentType: string | null }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        method: init?.method,
        actor: headers.get("x-actor-name"),
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

describe("backoffice API actor defaults", () => {
  it("sends role-specific default actors for mutating UI helpers", async () => {
    const calls = installFetchSpy();

    await createAcceptedSpecFromText("Konferenz am 2026-06-18 fuer 90 Teilnehmer.");
    await createOfferFromText("Lunchangebot fuer 80 Personen.");
    await reviewRecipe("offer", "recipe-offer-1", "approve");
    await reviewRecipe("production", "recipe-production-1", "verify");

    expect(calls).toEqual([
      {
        url: "/api/intake/v1/intake/normalize",
        method: "POST",
        actor: "Intake-Mitarbeiter",
        contentType: "application/json"
      },
      {
        url: "/api/offers/v1/offers/from-text",
        method: "POST",
        actor: "Angebots-Mitarbeiter",
        contentType: "application/json"
      },
      {
        url: "/api/offers/v1/offers/recipes/recipe-offer-1/review",
        method: "PATCH",
        actor: "Angebots-Mitarbeiter",
        contentType: "application/json"
      },
      {
        url: "/api/production/v1/production/recipes/recipe-production-1/review",
        method: "PATCH",
        actor: "Produktions-Mitarbeiter",
        contentType: "application/json"
      }
    ]);
  });

  it("keeps audit/seed paths on the Betriebs-/Audit-Operator", async () => {
    const calls = installFetchSpy();

    await seedDemoData();

    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.actor)).toEqual([
      "Betriebs-/Audit-Operator",
      "Betriebs-/Audit-Operator",
      "Betriebs-/Audit-Operator"
    ]);
    expect(calls.map((call) => call.contentType)).toEqual(["application/json", "application/json", "application/json"]);
  });

  it("uploads production documents as multipart draft requests with the production actor", async () => {
    const calls = installFetchSpy();

    await createProductionDraftFromDocument(
      new File(["%PDF-1.4 fixture"], "angebot.pdf", { type: "application/pdf" })
    );

    expect(calls).toEqual([{
      url: "/api/production/v1/production/drafts/from-document",
      method: "POST",
      actor: "Produktions-Mitarbeiter",
      contentType: null
    }]);
  });

  it("imports an AcceptedEventSpec as a guarded draft-only production review", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T09:30:00.000Z"));
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-1234-4123-8123-123456789abc" });
    const requests: Array<{ url: string; method?: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        requests.push({ url: String(input), method: init?.method, body });

        return new Response(JSON.stringify({ draft: body }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        });
      })
    );

    await createProductionDraftFromAcceptedEventSpec({
      schemaVersion: "1.0.0",
      specId: "spec-safe",
      event: { title: "Sommerfest" },
      attendees: { expected: 80 },
      menuPlan: []
    });

    expect(requests).toEqual([{
      url: "/api/production/v1/production/drafts",
      method: "POST",
      body: {
        schemaVersion: "1.0.0",
        draftId: "production-draft-12345678-1234-4123-8123-123456789abc",
        revision: 1,
        status: "pending_review",
        createdAt: "2026-08-11T09:30:00.000Z",
        source: {
          kind: "manual_import",
          receivedAt: "2026-08-11T09:30:00.000Z",
          sourceRef: "accepted-event-spec:spec-safe"
        },
        guardrails: {
          draftOnly: true,
          humanApprovalRequired: true,
          writesProductObjects: false,
          rawProviderPayloadStored: false,
          knowledgeWritePolicy: "reviewed_only"
        },
        reviewCards: [{
          cardId: "card-imported-event-spec",
          kind: "event_data",
          title: "Eventdaten prüfen",
          summary: "Übernommene Eventdaten vor der Produktionsplanung fachlich prüfen.",
          decision: "pending",
          targetPath: "$.draftArtifacts.eventSpec",
          targetId: "spec-safe",
          requiredApproval: true
        }],
        draftArtifacts: {
          eventSpec: {
            schemaVersion: "1.0.0",
            specId: "spec-safe",
            event: { title: "Sommerfest" },
            attendees: { expected: 80 },
            menuPlan: []
          }
        }
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
