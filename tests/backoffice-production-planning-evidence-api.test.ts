import { afterEach, expect, it, vi } from "vitest";
import * as api from "../backoffice-ui/src/api.js";
afterEach(() => vi.restoreAllMocks());
it.each([409, 422, 503])("preserves HTTP %i as typed failure information without changing the Error contract", async status => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Kontrollierter Fehler" }), { status }));
  const result = await api.saveProductionPlanningEvidence("case", {} as api.ProductionPlanningEvidenceInput).catch(error => error);
  expect(result).toBeInstanceOf(Error);
  expect(result).toMatchObject({ status, message: "Kontrollierter Fehler" });
});
it("reads selectable library candidates through the existing session-bound recipe endpoint", async () => {
  const candidates = [{ recipeId: "synthetic-candidate", source: { approvalState: "review_required" } }];
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: candidates }), { status: 200 }));
  expect(await api.loadProductionRecipeLibrary()).toEqual({ items: candidates });
  expect(fetcher.mock.calls[0]![0]).toBe("/api/production/v1/production/recipes");
  expect(fetcher.mock.calls[0]![1]?.credentials).toBe("same-origin");
});
it("sends the immutable evidence command unchanged through session auth and preserves controlled conflicts", async () => {
  const payload = { draftId: "draft", draftRevision: 4, componentId: "component", recipeId: "recipe",
    quantityDecision: { decisionId: "quantity-stable" }, recipeEventUseReview: { reviewedBy: "synthetic-user-id", reviewedAt: "2026-09-19T12:00:00Z" } } as api.ProductionPlanningEvidenceInput;
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Abweichende Evidenz" }), { status: 409 }));
  await expect(api.saveProductionPlanningEvidence("case / 1", payload)).rejects.toThrow("Abweichende Evidenz");
  expect(fetcher.mock.calls[0]![0]).toBe("/api/production/v1/production/cases/case%20%2F%201/planning-evidence");
  const init = fetcher.mock.calls[0]![1]!;
  expect(JSON.parse(String(init.body))).toEqual(payload);
  expect(init.credentials).toBe("same-origin");
  expect(new Headers(init.headers).get("x-catering-actor-name")).toBeNull();
});
