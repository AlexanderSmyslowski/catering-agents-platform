import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionPlan,
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
  vi.unstubAllGlobals();
});

describe("backoffice API actor defaults", () => {
  it("sends role-specific default actors for mutating UI helpers", async () => {
    const calls = installFetchSpy();

    await createAcceptedSpecFromText("Konferenz am 2026-06-18 fuer 90 Teilnehmer.");
    await createOfferFromText("Lunchangebot fuer 80 Personen.");
    await createProductionPlan({ eventType: "conference" });
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
        url: "/api/production/v1/production/plans",
        method: "POST",
        actor: "Produktions-Mitarbeiter",
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
});
