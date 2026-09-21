// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../backoffice-ui/src/api.js";
import * as session from "../backoffice-ui/src/session-boundary.js";
import { ProductionPlanningEvidencePanel } from "../backoffice-ui/src/production-planning-evidence-panel.js";

const recipe = { recipeId: "test-recipe", name: "Synthetische Kaffeepause", source: { approvalState: "review_required", reference: "synthetic:test" }, baseYield: { servings: 10, unit: "servings" }, ingredients: [], steps: [], allergens: [], dietTags: [] };
const planningRecipes = [{ recipe, recipeSnapshotHash: `sha256:${"a".repeat(64)}` }];
function draft(recipeId: string | undefined = recipe.recipeId, revision = 1): api.ProductionDraft {
  return { draftId: `draft-${revision}`, revision, status: "pending_review", createdAt: "2026-09-19",
    source: { sourceRef: "offer-handoff:test" }, reviewCards: [],
    draftArtifacts: { eventSpec: { specId: "spec-1", attendees: { expected: 35 }, servicePlan: { eventType: "coffee_break", serviceForm: "buffet" },
      menuPlan: [{ componentId: "coffee", label: "Kaffeepause kompakt", servings: 35, recipeOverrideId: recipeId, productionDecision: { mode: "scratch" } },
        { componentId: "purchase", label: "Croissants Zukauf", servings: 35, productionDecision: { mode: "convenience_purchase" } }] } } };
}
let root: Root;
let container: HTMLDivElement;
async function render(caseId = "case-1") {
  await act(async () => root.render(createElement(ProductionPlanningEvidencePanel, { caseId, submitting: false })));
}
function button(label: string) { return [...container.querySelectorAll("button")].find(item => item.textContent === label)!; }
async function click(label: string) { await act(async () => button(label).click()); }
async function input(label: string, value: string) {
  const element = container.querySelector(`[aria-label="${label}"]`)! as HTMLInputElement;
  await act(async () => {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
async function setup(initial = draft()) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  vi.spyOn(session, "useCateringSession").mockReturnValue({ session: { authenticated: true, user: { userId: "synthetic-session-id", displayName: "Unrelated display name" }, access: { capabilities: [] } }, logout: vi.fn() });
  vi.spyOn(api, "loadProductionDrafts").mockResolvedValue({ items: [initial], planningEvidence: [], planningRecipes });
  vi.spyOn(api, "loadProductionRecipeLibrary").mockResolvedValue({ items: [recipe] });
  await render();
}
async function completeReview() {
  await input("Mengenbegründung", "Explizite synthetische Portionenentscheidung");
  await input("Mengenherkunft", "synthetic:operator-fixture");
  for (const checkbox of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    await act(async () => checkbox.click());
  }
}
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.restoreAllMocks(); });

describe("planning evidence operator panel", () => {
  it("allows corrected input after a definitive 422 and requires all confirmations again", async () => {
    await setup(); await completeReview();
    const transport = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ message: "Mengenherkunft korrigieren" }), { status: 422 }));
    await click("Menge und Eventprüfung speichern");
    expect(container.textContent).toContain("Mengenherkunft korrigieren");
    expect(button("Identisch erneut senden")).toBeUndefined();
    expect((container.querySelector("fieldset") as HTMLFieldSetElement).disabled).toBe(false);
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
    await input("Mengenherkunft", "synthetic:corrected");
    expect((container.querySelector('[aria-label="Mengenherkunft"]') as HTMLInputElement).value).toBe("synthetic:corrected");
    expect(button("Menge und Eventprüfung speichern").disabled).toBe(true);
    for (const checkbox of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      await act(async () => checkbox.click());
    }
    await click("Menge und Eventprüfung speichern");
    const previous = JSON.parse(String(transport.mock.calls[0]![1]!.body));
    const corrected = JSON.parse(String(transport.mock.calls[1]![1]!.body));
    expect(corrected.quantityDecision.evidence.reference).toBe("synthetic:corrected");
    expect(corrected.quantityDecision.decisionId).not.toBe(previous.quantityDecision.decisionId);
  });
  it("reloads the canonical recipe after 409 without carrying previous confirmations", async () => {
    await setup(); await completeReview();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      vi.mocked(api.loadProductionDrafts).mockResolvedValue({ items: [draft()], planningEvidence: [],
        planningRecipes: [{ recipe: { ...recipe, name: "Changed canonical recipe" }, recipeSnapshotHash: `sha256:${"b".repeat(64)}` }] });
      return new Response(JSON.stringify({ message: "Rezeptstand geändert" }), { status: 409 });
    });
    await click("Menge und Eventprüfung speichern");
    expect(container.textContent).toContain("Changed canonical recipe");
    expect(button("Identisch erneut senden")).toBeUndefined();
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
  });
  it("keeps an uncertain HTTP 503 write as an identical retry", async () => {
    await setup(); await completeReview();
    const transport = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ message: "Speicherantwort unklar" }), { status: 503 }));
    await click("Menge und Eventprüfung speichern");
    const original = transport.mock.calls[0]![1]!.body;
    expect((container.querySelector("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    await click("Identisch erneut senden");
    expect(transport.mock.calls[1]![1]!.body).toBe(original);
  });
  it("loads a newly uploaded candidate with the visible refresh action", async () => {
    await setup();
    const newRecipe = { ...recipe, recipeId: "uploaded-new", name: "Neue synthetische Uploadgrundlage" };
    vi.mocked(api.loadProductionRecipeLibrary).mockResolvedValue({ items: [recipe, newRecipe] });
    await click("Planungsstand neu laden");
    expect([...container.querySelectorAll("option")].some(item => item.value === "uploaded-new")).toBe(true);
    await input("Rezeptgrundlage", "uploaded-new");
    expect(container.textContent).toContain("Neue synthetische Uploadgrundlage");
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
  it("requires reviewed output mapping for non-servings and binds it to the session actor", async () => {
    await setup();
    await input("Mengenbasis", "per_person_weight");
    await input("Mengeneinheit", "kg");
    await input("Menge pro Person", "0.1");
    await completeReview();
    expect(button("Menge und Eventprüfung speichern").disabled).toBe(true);
    await input("Rezept-Ausgabemenge", "1");
    await input("Rezeptportionen", "10");
    await completeReview();
    const posted = vi.spyOn(api, "saveProductionPlanningEvidence").mockRejectedValue(new Error("Synthetic retry"));
    await click("Menge und Eventprüfung speichern");
    expect(posted.mock.calls[0]![1].outputMapping).toMatchObject({ recipeId: recipe.recipeId, outputAmount: 1, outputUnit: "kg", recipeServings: 10, reviewedBy: "synthetic-session-id" });
    expect(posted.mock.calls[0]![1].quantityDecision.targetAmount).toBe(3.5);
  });
  it("clears confirmations after changing quantity or recipe selection", async () => {
    await setup(); await completeReview();
    await input("Menge pro Person", "2");
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
    await completeReview();
    await input("Rezeptgrundlage", "");
    await input("Rezeptgrundlage", recipe.recipeId);
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
  });
  it("retains the exact retry command when a refresh after an uncertain write fails", async () => {
    await setup(); await completeReview();
    const posted = vi.spyOn(api, "saveProductionPlanningEvidence").mockRejectedValue(new Error("Antwort unklar"));
    await click("Menge und Eventprüfung speichern");
    const original = posted.mock.calls[0]![1];
    vi.mocked(api.loadProductionDrafts).mockRejectedValueOnce(new Error("Readback nicht verfügbar"));
    await click("Planungsstand neu laden");
    expect(container.textContent).toContain("Readback nicht verfügbar");
    await click("Planungsstand neu laden");
    await click("Identisch erneut senden");
    expect(posted.mock.calls[1]![1]).toEqual(original);
  });
  it("blocks an in-flight preflight after case change and resets a changed recipe snapshot", async () => {
    await setup(); await completeReview();
    const posted = vi.spyOn(api, "saveProductionPlanningEvidence");
    let resolve!: (value: api.ProductionDraftListResponse) => void;
    vi.mocked(api.loadProductionDrafts).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await click("Menge und Eventprüfung speichern");
    await render("case-2");
    await act(async () => resolve({ items: [draft()], planningRecipes }));
    expect(posted).not.toHaveBeenCalled();
    await completeReview();
    vi.mocked(api.loadProductionDrafts).mockResolvedValue({ items: [draft()], planningEvidence: [],
      planningRecipes: [{ recipe: { ...recipe, name: "Changed candidate" }, recipeSnapshotHash: `sha256:${"b".repeat(64)}` }] });
    await click("Menge und Eventprüfung speichern");
    expect(posted).not.toHaveBeenCalled();
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
  });
  it("shows only scratch/hybrid and requires four conscious confirmations with trusted session identity", async () => {
    await setup();
    expect(container.textContent).toContain("Kaffeepause kompakt");
    expect(container.textContent).not.toContain("Croissants Zukauf");
    expect(container.textContent).toContain("review_required");
    expect(container.textContent).toContain("35");
    const confirmations = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(confirmations).toHaveLength(4);
    expect([...confirmations].every(item => !item.checked)).toBe(true);
    expect(button("Menge und Eventprüfung speichern").disabled).toBe(true);
    const posted = vi.spyOn(api, "saveProductionPlanningEvidence").mockRejectedValue(new Error("Unklare Antwort"));
    await completeReview();
    await click("Menge und Eventprüfung speichern");
    const payload = posted.mock.calls[0]![1];
    expect(payload.expectedRecipeSnapshotHash).toBe(planningRecipes[0]!.recipeSnapshotHash);
    expect(payload.recipeEventUseReview.reviewedBy).toBe("synthetic-session-id");
    expect(payload.quantityDecision).toMatchObject({ guestCount: 35, targetAmount: 35, basis: "servings_per_person", perUnitAmount: 1, reviewStatus: "approved", evidence: { kind: "operator_instruction" } });
    await click("Identisch erneut senden");
    expect(posted.mock.calls[1]![1]).toEqual(payload);
  });

  it("selects an unrelated unreviewed candidate, persists revision then freshly reads before review", async () => {
    await setup(draft(undefined));
    // Explicit undefined is a missing assignment, not a request for the fixture default.
    vi.mocked(api.loadProductionDrafts).mockResolvedValue({ items: [{ ...draft(), draftArtifacts: { eventSpec: { ...draft().draftArtifacts!.eventSpec, menuPlan: [{ componentId: "coffee", label: "Sammelposition", servings: 35, productionDecision: { mode: "scratch" } }] } } }], planningEvidence: [] });
    await act(async () => window.dispatchEvent(new Event("catering:production-draft-refresh")));
    expect([...container.querySelectorAll("option")].some(option => option.value === recipe.recipeId)).toBe(true);
    await input("Rezeptgrundlage", recipe.recipeId);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    const revised = vi.spyOn(api, "reviseProductionDraft").mockResolvedValue({ draft: draft(recipe.recipeId, 2) });
    vi.mocked(api.loadProductionDrafts).mockResolvedValueOnce(await vi.mocked(api.loadProductionDrafts).getMockImplementation()!())
      .mockResolvedValue({ items: [draft(recipe.recipeId, 2)], planningEvidence: [], planningRecipes });
    await click("Rezeptzuordnung speichern");
    expect(revised.mock.calls[0]![1]).toMatchObject({ caseId: "case-1", expectedRevision: 1, componentUpdates: [{ componentId: "coffee", recipeOverrideId: recipe.recipeId }] });
    expect(container.textContent).toContain("Revision 2");
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
  });

  it("blocks stale revisions before POST and clears case inputs", async () => {
    await setup(); await completeReview();
    const posted = vi.spyOn(api, "saveProductionPlanningEvidence");
    vi.mocked(api.loadProductionDrafts).mockResolvedValue({ items: [draft(recipe.recipeId, 2)], planningEvidence: [], planningRecipes });
    await click("Menge und Eventprüfung speichern");
    expect(posted).not.toHaveBeenCalled();
    await render("case-2");
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
    expect((container.querySelector('[aria-label="Mengenbegründung"]') as HTMLTextAreaElement).value).toBe("");
  });

  it("reopens canonical evidence and does not transfer predecessor approval", async () => {
    await setup();
    const evidence = { caseId: "case-1", draftId: "draft-1", draftRevision: 1, eventSpecId: "spec-1", componentId: "coffee", recipeId: recipe.recipeId,
      quantityDecision: { targetAmount: 35, targetUnit: "servings", rationale: "Gespeicherte Entscheidung", evidence: { reference: "synthetic:stored" } },
      recipeEventUseReview: { reviewedBy: "synthetic-reviewer", reviewedAt: "2026-09-19T12:00:00Z" }, recipeSnapshotHash: "sha256:test", evidenceId: "evidence-1" } as api.ProductionPlanningEvidence;
    vi.mocked(api.loadProductionDrafts).mockResolvedValue({ items: [draft()], planningEvidence: [evidence], planningRecipes });
    await act(async () => window.dispatchEvent(new Event("catering:production-draft-refresh")));
    expect(container.textContent).toContain("Gespeicherte Entscheidung");
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    vi.mocked(api.loadProductionDrafts).mockResolvedValue({ items: [draft(recipe.recipeId, 2)], planningEvidence: [evidence], planningRecipes });
    await act(async () => window.dispatchEvent(new Event("catering:production-draft-refresh")));
    expect(container.textContent).toContain("Vorgänger");
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(item => !item.checked)).toBe(true);
  });
});
