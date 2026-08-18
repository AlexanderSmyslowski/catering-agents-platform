import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmProductionQuantityOverride,
  fetchProductionQuantityWorkflow,
  previewProductionQuantityOverride
} from "../backoffice-ui/src/api.js";

afterEach(() => vi.restoreAllMocks());

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

describe("backoffice production quantity api", () => {
  it("fetches the server-owned workflow without browser calculation inputs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ items: [] }));
    await fetchProductionQuantityWorkflow("case 1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/production/v1/production/cases/case%201/quantity-workflow");
    expect(init?.method).toBeUndefined();
  });

  it("posts only the requested edit for preview", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ previewId: "p1", sourceRevision: "r1", preview: { status: "preview_ready" } }));
    await previewProductionQuantityOverride("case-1", "component-1", {
      origin: "target_output",
      perUnitAmount: 1.2,
      unit: "servings"
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/production/v1/production/cases/case-1/quantity-workflow/component-1/preview");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ edit: { origin: "target_output", perUnitAmount: 1.2, unit: "servings" } });
    expect(new Headers(init?.headers).get("x-actor-name")).toBe("Produktions-Mitarbeiter");
  });

  it("confirms the exact preview id plus original edit and nothing derived in the browser", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ status: "review_required" }));
    await confirmProductionQuantityOverride("case-1", "component-1", "quantity-preview-1", {
      origin: "purchase_ingredient",
      ingredientId: "beef",
      amount: 3,
      unit: "kg"
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/production/v1/production/cases/case-1/quantity-workflow/component-1/confirm");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      previewId: "quantity-preview-1",
      edit: { origin: "purchase_ingredient", ingredientId: "beef", amount: 3, unit: "kg" }
    });
  });
});
