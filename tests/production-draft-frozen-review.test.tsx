// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductionDraftReviewPanel } from "../backoffice-ui/src/production-draft-review-panel.js";
import type { ProductionDraft } from "../backoffice-ui/src/api.js";

function frozenDraft(): ProductionDraft {
  const ingredients = [
    { ingredientId: "beans", name: "Kaffeebohnen", quantity: { amount: 350, unit: "g" } },
    { ingredientId: "tea", name: "Tee", quantity: { amount: 70, unit: "g" } },
    { ingredientId: "oat", name: "Haferdrink", quantity: { amount: 3.5, unit: "l" } }
  ];
  const source = { recipeId: "recipe-frozen", recipeName: "Synthetische Kaffeepause", reference: "synthetic:coffee-fixture", approvalState: "review_required", originType: "approved_import", sourceTier: "B" };
  return {
    draftId: "draft-frozen", revision: 8, supersedesDraftId: "draft-previous", status: "pending_review", createdAt: "2026-09-19T17:00:00Z",
    reviewCards: [
      { cardId: "event", kind: "event_data", title: "Event prüfen", targetId: "spec-frozen", targetPath: "$.draftArtifacts.eventSpec" },
      { cardId: "plan", kind: "timeline", title: "Plan prüfen", targetId: "plan-frozen", targetPath: "$.draftArtifacts.productionPlan" },
      { cardId: "purchase", kind: "purchase_item", title: "Einkauf prüfen", targetId: "purchase-frozen", targetPath: "$.draftArtifacts.purchaseList" },
      { cardId: "recipe", kind: "recipe", title: "Rezept prüfen", targetId: "recipe-frozen", targetPath: "$.draftArtifacts.recipes[0]" }
    ].map(card => ({ ...card, summary: "Unveränderlichen Stand prüfen", decision: "pending", requiredApproval: true })),
    draftArtifacts: {
      eventSpec: { specId: "spec-frozen", event: { title: "Gefrorener Testfall", date: "2026-10-01", schedule: [{ label: "Service", start: "09:00", end: "12:00" }] }, attendees: { expected: 35 }, menuPlan: [
        { componentId: "coffee", label: "Kaffeepause", menuCategory: "vegan", servings: 35, productionDecision: { mode: "scratch" } },
        { componentId: "purchase", label: "Croissants und Wasser", menuCategory: "classic", servings: 35, productionDecision: { mode: "convenience_purchase", purchasedElements: ["Croissants", "Wasser"] } }
      ] },
      productionPlan: { planId: "plan-frozen", eventSpecId: "spec-frozen", readiness: { status: "complete", reasons: [] }, productionBatches: [
        { batchId: "batch-frozen", componentId: "coffee", recipeId: "recipe-frozen", scaledYield: { amount: 35, unit: "servings" }, batchCount: 4, ingredients, station: "Getränke", prepWindow: "08:00–09:00", steps: [{ index: 1, instruction: "Synthetischer Testschritt" }] }
      ], kitchenSheets: [
        { title: "Küchenblatt Kaffeepause", componentId: "coffee", recipeId: "recipe-frozen", productionQty: { amount: 35, unit: "servings" }, ingredients, instructions: ["Kaffee bereitstellen"], station: "Getränke", prepWindow: "08:00–09:00" },
        { title: "Küchenblatt Zukauf", componentId: "purchase", productionQty: { amount: 35, unit: "servings" }, ingredients: [], instructions: ["Zukauf bereitstellen"], procurementNotes: ["Gebinde und Lieferant noch fachlich klären"], station: "Ausgabe", prepWindow: "09:00" }
      ], recipeSelections: [{ componentId: "coffee", recipeId: "recipe-frozen" }], timeline: [{ label: "Ausgabe", at: "09:00" }], unresolvedItems: [] },
      purchaseList: { purchaseListId: "purchase-frozen", eventSpecId: "spec-frozen", items: [
        ...ingredients.map(line => ({ ingredientId: line.ingredientId, displayName: line.name, normalizedQty: line.quantity.amount, normalizedUnit: line.quantity.unit, purchaseQty: line.quantity.amount, purchaseUnit: line.quantity.unit, sourceRecipes: ["recipe-frozen"], sourceRecipeMetadata: [source] })),
        ...["Croissants", "Wasser"].map(displayName => ({ displayName, purchaseQty: 35, purchaseUnit: "servings", normalizedQty: 35, normalizedUnit: "servings", sourceRecipes: ["procurement:purchase"] }))
      ] },
      recipes: [{ recipeId: "recipe-frozen", name: source.recipeName, source: { reference: source.reference, approvalState: "review_required", originType: "approved_import" }, baseYield: { servings: 10, unit: "servings" }, ingredients: ingredients.map(line => ({ ...line, quantity: { ...line.quantity, amount: line.quantity.amount / 3.5 } })) }]
    }
  };
}
let root: Root | undefined;
let container: HTMLDivElement;
const originalFetch = globalThis.fetch;
async function mount(draft: ProductionDraft) {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  const predecessor = { ...frozenDraft(), draftId: "draft-previous", status: "superseded", reviewCards: draft.reviewCards.map(card => ({ ...card, decision: "fits", decidedBy: "synthetic-predecessor" })) };
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [predecessor, draft], approvedProductionSpecs: [], planningRecipes: [{ recipe: { recipeId: "recipe-frozen", name: "LIVE RECIPE MUST NOT APPEAR" } }] }), { status: 200 }));
  globalThis.fetch = fetchMock as typeof fetch;
  await act(async () => { root!.render(createElement(ProductionDraftReviewPanel, { submitting: false, caseId: "case-frozen" })); await new Promise(resolve => setTimeout(resolve, 0)); });
  return fetchMock;
}
function card(title: string) {
  return [...container.querySelectorAll("li")].find(item => item.querySelector(":scope > strong")?.textContent === title)!;
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; container?.remove(); globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe("frozen production review content", () => {
  it("shows event identity, date, attendance, schedule, categories and modes in its own card", async () => {
    await mount(frozenDraft());
    const text = card("Event prüfen").textContent;
    for (const value of ["spec-frozen", "2026-10-01", "35", "09:00", "12:00", "Kaffeepause", "vegan", "Eigenproduktion", "Croissants und Wasser", "classic", "Convenience-Zukauf"]) expect(text).toContain(value);
    expect(text).not.toContain("350 g");
  });
  it("distinguishes one 35-serving batch from four charges and includes both frozen kitchen sheets", async () => {
    await mount(frozenDraft());
    const text = card("Plan prüfen").textContent;
    for (const value of ["complete", "1 Produktionsbatch", "35 servings", "4 Chargen", "350 g", "70 g", "3.5 l", "Küchenblatt Kaffeepause", "Küchenblatt Zukauf", "Zukauf bereitstellen", "Gebinde und Lieferant noch fachlich klären"]) expect(text).toContain(value);
  });
  it("shows all five purchase quantities and human-readable frozen recipe/procurement lineage", async () => {
    await mount(frozenDraft());
    const rows = card("Einkauf prüfen").querySelectorAll("tbody tr");
    expect(rows).toHaveLength(5);
    for (const [index, name, amount] of [[0, "Kaffeebohnen", "350 g"], [1, "Tee", "70 g"], [2, "Haferdrink", "3.5 l"], [3, "Croissants", "35 servings"], [4, "Wasser", "35 servings"]] as const) {
      expect(rows[index]!.textContent).toContain(name); expect(rows[index]!.textContent).toContain(amount);
    }
    expect(rows[0]!.textContent).toContain("synthetic:coffee-fixture");
    expect(rows[3]!.textContent).toContain("procurement:purchase");
  });
  it("shows recipe base and linked scaling without transferring predecessor decisions or requesting live data", async () => {
    const fetchMock = await mount(frozenDraft());
    const text = card("Rezept prüfen").textContent;
    for (const value of ["recipe-frozen", "Synthetische Kaffeepause", "10 servings", "synthetic:coffee-fixture", "review_required", "35 servings", "4 Chargen", "350 g", "70 g", "3.5 l", "synthetische", "menschliche Küchenprüfung", "Allergenfreigabe"]) expect(text).toContain(value);
    expect(container.textContent).not.toContain("LIVE RECIPE MUST NOT APPEAR");
    expect(fetchMock.mock.calls).toHaveLength(1);
    for (const title of ["Event prüfen", "Plan prüfen", "Einkauf prüfen", "Rezept prüfen"]) {
      expect([...card(title).querySelectorAll("button")].map(button => button.textContent)).toEqual(["Passt", "Änderung nötig", "Unklar", "Blockiert"]);
      expect(card(title).textContent).toContain("offen");
    }
    expect([...container.querySelectorAll("button")].find(button => button.textContent === "Entwurf freigeben")!.disabled).toBe(true);
  });

  it("leaves malformed manufacturing modes as warnings instead of rendering inherited objects", async () => {
    const draft = frozenDraft();
    const menu = draft.draftArtifacts!.eventSpec!.menuPlan as Array<Record<string, unknown>>;
    menu[0]!.productionDecision = { mode: "__proto__" };
    await mount(draft);
    expect(card("Event prüfen").textContent).toContain("unvollständig");
  });
  it("sends only the clicked card decision and leaves actor attribution to the server", async () => {
    const transport = await mount(frozenDraft());
    transport.mockClear();
    await act(async () => {
      [...card("Rezept prüfen").querySelectorAll("button")].find(button => button.textContent === "Passt")!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const writes = transport.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const mutations = writes.filter(([, init]) => init?.method === "PATCH");
    expect(mutations).toHaveLength(1);
    expect(String(mutations[0]![0])).toBe("/api/production/v1/production/drafts/draft-frozen/review-cards/recipe");
    expect(JSON.parse(String(mutations[0]![1]?.body))).toEqual({ decision: "fits" });
    expect(card("Event prüfen").textContent).toContain("offen");
  });
  it("selects the referenced recipe index and only its linked frozen batches", async () => {
    const draft = frozenDraft();
    draft.draftArtifacts!.recipes!.unshift({ recipeId: "unrelated", name: "Unrelated snapshot" });
    draft.reviewCards[3]!.targetPath = "$.draftArtifacts.recipes[1]";
    await mount(draft);
    expect(card("Rezept prüfen").textContent).toContain("350 g");
    expect(card("Rezept prüfen").textContent).not.toContain("Unrelated snapshot");
  });
  it.each(["wrong-id", "wrong-index", "executable-path", "duplicate-id"])("warns instead of showing a different recipe for %s", async failure => {
    const draft = frozenDraft();
    if (failure === "wrong-id") draft.reviewCards[3]!.targetId = "different";
    if (failure === "wrong-index") draft.reviewCards[3]!.targetPath = "$.draftArtifacts.recipes[9]";
    if (failure === "executable-path") draft.reviewCards[3]!.targetPath = "$.draftArtifacts.recipes[globalThis.alert('bad')]";
    if (failure === "duplicate-id") draft.draftArtifacts!.recipes!.push({ ...draft.draftArtifacts!.recipes![0]! });
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    await mount(draft);
    expect(card("Rezept prüfen").textContent).toContain("Prüfziel nicht verfügbar");
    expect(card("Rezept prüfen").textContent).not.toContain("350 g");
    expect(alert).not.toHaveBeenCalled();
  });
  it.each(["missing-artifact", "null-recipe", "invalid-collections", "missing-purchase-fields"])("renders warnings without crashing for %s and leaves pending approval blocked", async failure => {
    const draft = frozenDraft();
    if (failure === "missing-artifact") delete draft.draftArtifacts!.purchaseList;
    if (failure === "null-recipe") draft.draftArtifacts!.recipes = [null] as unknown as Record<string, unknown>[];
    if (failure === "invalid-collections") { draft.draftArtifacts!.productionPlan!.productionBatches = [null]; draft.draftArtifacts!.productionPlan!.kitchenSheets = "invalid"; }
    if (failure === "missing-purchase-fields") draft.draftArtifacts!.purchaseList!.items = [{ displayName: "Croissants" }];
    await mount(draft);
    expect(container.textContent).toMatch(/nicht verfügbar|unvollständig/);
    expect([...container.querySelectorAll("button")].find(button => button.textContent === "Entwurf freigeben")!.disabled).toBe(true);
    if (failure === "missing-purchase-fields") for (const value of ["Menge fehlt", "Einheit fehlt", "Herkunft fehlt"]) expect(card("Einkauf prüfen").textContent).toContain(value);
  });
});
