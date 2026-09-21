import { buildSpecEditUpdateInput } from "../backoffice-ui/src/production-spec-edit-update.js";
import { specEditSnapshotFromSpec } from "../backoffice-ui/src/production-spec-edit-snapshot.js";
import { describe, expect, it, vi } from "vitest";
import {
  buildProductionSpecEditPersistAction,
  type ProductionSpecEditPersistActionInput
} from "../backoffice-ui/src/production-spec-edit-persist-action.js";

function input(
  overrides: Partial<ProductionSpecEditPersistActionInput> = {}
): ProductionSpecEditPersistActionInput {
  return {
    editingSpecId: "spec-lunch",
    updateAcceptedSpec: vi.fn(async () => ({
      acceptedEventSpec: { specId: "spec-lunch-updated", eventType: "Lunch" }
    })),
    buildCurrentSpecUpdateInput: vi.fn(() => ({ attendeeCount: 42 })),
    setProductionWorkspaceCleared: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    resetSpecEdit: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    ...overrides
  };
}

describe("production spec edit persist action", () => {
  it("returns undefined without touching the API when no spec edit is active", async () => {
    const actionInput = input({ editingSpecId: undefined });
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await expect(persistCurrentSpecEdit()).resolves.toBeUndefined();

    expect(actionInput.buildCurrentSpecUpdateInput).not.toHaveBeenCalled();
    expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
    expect(actionInput.refreshDashboard).not.toHaveBeenCalled();
  });

  it("persists the current update input and focuses the returned spec", async () => {
    const calls: string[] = [];
    const updatedSpec = { specId: "spec-returned", eventType: "Dinner" };
    const actionInput = input({
      updateAcceptedSpec: vi.fn(async () => {
        calls.push("updateAcceptedSpec");
        return { acceptedEventSpec: updatedSpec };
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
      }),
      resetSpecEdit: vi.fn((markDismissed) => {
        calls.push(`resetSpecEdit:${markDismissed}`);
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await expect(persistCurrentSpecEdit()).resolves.toBe(updatedSpec);

    expect(actionInput.updateAcceptedSpec).toHaveBeenCalledWith("spec-lunch", { attendeeCount: 42 });
    expect(calls).toEqual([
      "updateAcceptedSpec",
      "setProductionWorkspaceCleared:false",
      "setFocusedProductionSpecId:spec-returned",
      "resetSpecEdit:false",
      "refreshDashboard",
      "setNotice:Spezifikation wurde gespeichert."
    ]);
  });

  it("keeps the existing quiet save path silent after refresh", async () => {
    const actionInput = input();
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await persistCurrentSpecEdit({ quiet: true });

    expect(actionInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionInput.setNotice).not.toHaveBeenCalled();
  });

  it("falls back to the edited spec id when the API response has no spec id", async () => {
    const actionInput = input({
      updateAcceptedSpec: vi.fn(async () => ({
        acceptedEventSpec: { eventType: "Lunch ohne ID" }
      }))
    });
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await persistCurrentSpecEdit();

    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-lunch");
  });
});


it("saves handoff classifications through the pinned canonical draft and preserves unrelated fields", async () => {
  const source = { specId: "spec-lunch", event: { type: "meeting", date: "2026-09-22" }, attendees: { expected: 35 },
    menuPlan: [{ componentId: "coffee", label: "Coffee" }] };
  const draft = { draftId: "canonical-r2", revision: 2, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
  const updated = { ...source, menuPlan: [{ ...source.menuPlan[0], menuCategory: "classic" }] };
  const actionInput = input({
    productionDraftContext: { caseId: "case-1", draft },
    reviseProductionDraft: vi.fn(async () => ({ draft: { ...draft, draftId: "canonical-r3", revision: 3, draftArtifacts: { eventSpec: updated } } })),
    buildCurrentSpecUpdateInput: () => ({ eventType: "meeting", eventDate: "2026-09-22", attendeeCount: 35, menuItems: ["Coffee"], componentUpdates: [{ componentId: "coffee", menuCategory: "classic", purchasedElements: [], recipeOverrideId: "" }] })
  });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  const result = await buildProductionSpecEditPersistAction(actionInput)();
  expect(result).toEqual(updated);
  expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
  expect(actionInput.reviseProductionDraft).toHaveBeenCalledWith("canonical-r2", { caseId: "case-1", expectedRevision: 2, componentClassifications: [{ componentId: "coffee", menuCategory: "classic" }] });
});

it("does not report success or discard nonclassification edits in a handoff answer form", async () => {
  const actionInput = input({
    productionDraftContext: { caseId: "case-1", draft: { draftId: "draft-1", revision: 2, status: "pending_review", createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: { specId: "spec-lunch", attendees: { expected: 35 }, menuPlan: [] } } } },
    reviseProductionDraft: vi.fn(),
    buildCurrentSpecUpdateInput: () => ({ attendeeCount: 99, menuItems: [], componentUpdates: [] })
  });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow(/Klassifikationen/);
  expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
  expect(actionInput.reviseProductionDraft).not.toHaveBeenCalled();
  expect(actionInput.setNotice).not.toHaveBeenCalled();
});


it("rejects an unchanged canonical save when its pinned case is no longer active", async () => {
  const source = { specId: "spec-lunch", menuPlan: [] };
  const draft = { draftId: "old-draft", revision: 2, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
  const actionInput = input({ productionDraftContext: { caseId: "old-case", draft },
    getCurrentProductionDraftContext: () => ({ caseId: "new-case", draft: { ...draft, draftId: "new-draft" } }),
    reviseProductionDraft: vi.fn(), buildCurrentSpecUpdateInput: () => ({ menuItems: [], componentUpdates: [] })
  });
  await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow(/Produktionsfall/);
  expect(actionInput.reviseProductionDraft).not.toHaveBeenCalled();
  expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
  expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
});


it("sends only changed manufacturing fields and timewindow in one canonical revision", async () => {
  const source = { specId: "spec-lunch", event: { type: "meeting" }, menuPlan: [{ componentId: "coffee", label: "Coffee", menuCategory: "classic" }] };
  const draft = { draftId: "canonical-r4", revision: 4, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
  const schedule = [{ label: "Service", start: "09:00", end: "12:00" }];
  const actionInput = input({ productionDraftContext: { caseId: "case-1", draft },
    reviseProductionDraft: vi.fn(async () => ({ draft: { ...draft, draftId: "canonical-r5", revision: 5 } })),
    buildCurrentSpecUpdateInput: () => ({ eventType: "meeting", menuItems: ["Coffee"], eventSchedule: schedule,
      componentUpdates: [{ componentId: "coffee", menuCategory: "classic", productionMode: "convenience_purchase", purchasedElements: ["Kaffee"], notes: "synthetisch", recipeOverrideId: "" }] })
  });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  await buildProductionSpecEditPersistAction(actionInput)();
  expect(actionInput.reviseProductionDraft).toHaveBeenCalledWith("canonical-r4", { caseId: "case-1", expectedRevision: 4, componentClassifications: [], eventSchedule: schedule,
    componentUpdates: [{ componentId: "coffee", productionMode: "convenience_purchase", purchasedElements: ["Kaffee"], notes: "synthetisch" }] });
  expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
});


it("preserves untouched structured source values while explicitly clearing a note and recipe choice", async () => {
  const source = { specId: "spec-lunch", event: { schedule: [{ label: "Aufbau", start: "08:00", end: "09:00" }, { label: "Station 2", start: "09:00", end: "12:00" }] },
    menuPlan: [{ componentId: "coffee", label: "Coffee", menuCategory: "classic", recipeOverrideId: "existing-recipe", productionDecision: { mode: "hybrid", purchasedElements: ["Gebäck, geschnitten"], notes: "alte Notiz" } }] };
  const snapshot = specEditSnapshotFromSpec(source);
  const componentStates = Object.fromEntries(snapshot.components);
  componentStates.coffee = { ...componentStates.coffee!, notes: "", recipeOverrideId: "" };
  const draft = { draftId: "canonical-r4", revision: 4, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
  const actionInput = input({ productionDraftContext: { caseId: "case-1", draft },
    reviseProductionDraft: vi.fn(async () => ({ draft: { ...draft, draftId: "canonical-r5", revision: 5 } })),
    buildCurrentSpecUpdateInput: () => buildSpecEditUpdateInput({ ...snapshot, componentStates })
  });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  await buildProductionSpecEditPersistAction(actionInput)();
  expect(actionInput.reviseProductionDraft).toHaveBeenCalledWith("canonical-r4", { caseId: "case-1", expectedRevision: 4, componentClassifications: [],
    componentUpdates: [{ componentId: "coffee", notes: "", recipeOverrideId: "" }] });
});


it("never interprets omitted optional component fields as explicit clearing", async () => {
  const source = { specId: "spec-lunch", menuPlan: [{ componentId: "coffee", label: "Coffee", menuCategory: "classic", recipeOverrideId: "existing-recipe", productionDecision: { mode: "hybrid", purchasedElements: ["Gebäck"], notes: "alt" } }] };
  const draft = { draftId: "canonical-r4", revision: 4, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
  const actionInput = input({ productionDraftContext: { caseId: "case-1", draft },
    reviseProductionDraft: vi.fn(async () => ({ draft: { ...draft, draftId: "canonical-r5", revision: 5 } })),
    buildCurrentSpecUpdateInput: () => ({ menuItems: ["Coffee"], componentUpdates: [{ componentId: "coffee", notes: "neu" }] })
  });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  await buildProductionSpecEditPersistAction(actionInput)();
  expect(actionInput.reviseProductionDraft).toHaveBeenCalledWith("canonical-r4", { caseId: "case-1", expectedRevision: 4, componentClassifications: [], componentUpdates: [{ componentId: "coffee", notes: "neu" }] });
});


it("persists a quantity-only edit via canonical revise and reopens the stored decision", async () => {
  const purchasedQuantities = [{ element: "Wasser", amountPerPerson: 0.5, unit: "l" }];
  const source = { specId: "spec-lunch", attendees: { expected: 35 }, menuPlan: [{ componentId: "water", label: "Wasser", productionDecision: { mode: "convenience_purchase", purchasedElements: ["Wasser"], purchasedQuantities } }] };
  const snapshot = specEditSnapshotFromSpec(source);
  const componentStates = Object.fromEntries(snapshot.components);
  componentStates.water = { ...componentStates.water!, purchasedQuantities: [{ element: "Wasser", amountPerPerson: "0.75", unit: "l" }] };
  const stored = { ...source, menuPlan: [{ ...source.menuPlan[0]!, productionDecision: { ...source.menuPlan[0]!.productionDecision, purchasedQuantities: [{ element: "Wasser", amountPerPerson: 0.75, unit: "l" }] } }] };
  const draft = { draftId: "canonical-r4", revision: 4, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
  const actionInput = input({ productionDraftContext: { caseId: "case-1", draft },
    reviseProductionDraft: vi.fn(async () => ({ draft: { ...draft, draftId: "canonical-r5", revision: 5, draftArtifacts: { eventSpec: stored } } })),
    buildCurrentSpecUpdateInput: () => buildSpecEditUpdateInput({ ...snapshot, componentStates })
  });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  const saved = await buildProductionSpecEditPersistAction(actionInput)();
  expect(saved).toEqual(stored);
  expect(actionInput.reviseProductionDraft).toHaveBeenCalledWith("canonical-r4", { caseId: "case-1", expectedRevision: 4, componentClassifications: [], componentUpdates: [{ componentId: "water", purchasedQuantities: [{ element: "Wasser", amountPerPerson: 0.75, unit: "l" }] }] });
  expect(Object.fromEntries(specEditSnapshotFromSpec(saved!).components).water!.purchasedQuantities).toEqual(componentStates.water.purchasedQuantities);
});

it("refuses to silently lose structured quantities on the legacy intake save path", async () => {
  const actionInput = input({ buildCurrentSpecUpdateInput: () => ({ componentUpdates: [{ componentId: "water", purchasedQuantities: [{ element: "Wasser", amountPerPerson: 0.5, unit: "l" }] }] }) });
  await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow(/Produktionsentwurf/);
  expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
});
