import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyOfferCase,
  copyProductionCase,
  loadOfferCaseSummaries,
  loadProductionCaseSummaries
} from "../backoffice-ui/src/api.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("case history API boundary", () => {
  it("uses the server-scoped search contract for both products", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    await loadOfferCaseSummaries("  koepff.pdf  ");
    await loadProductionCaseSummaries("koepff.pdf");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/offers/v1/offers/cases?search=koepff.pdf");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/production/v1/production/cases?search=koepff.pdf");
  });

  it("keeps copy routes product-scoped and returns the server-owned new case", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
      case: {
        caseId: "copied-case",
        product: String(input).includes("offers") ? "offer" : "production",
        displayName: "Kopie",
        status: "open",
        createdAt: "2026-07-13T09:00:00.000Z",
        updatedAt: "2026-07-13T09:00:00.000Z"
      },
      events: []
    }), { status: 201, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(copyOfferCase("offer-case-a")).resolves.toMatchObject({ case: { caseId: "copied-case", product: "offer" } });
    await expect(copyProductionCase("production-case-a")).resolves.toMatchObject({ case: { caseId: "copied-case", product: "production" } });
    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual([
      "/api/offers/v1/offers/cases/offer-case-a/copies",
      "/api/production/v1/production/cases/production-case-a/copies"
    ]);
  });
});
