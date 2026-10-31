import { canEditProductionAnswers } from "../backoffice-ui/src/production-spec-edit-persist-action.js";
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


it("persists a special-diet-only answer as a new canonical revision instead of treating it as a no-op", async () => {
  const source = { specId:"spec-lunch",event:{type:"Abend",date:"2026-11-12",serviceForm:"buffet"},attendees:{expected:100},
    menuPlan:[{componentId:"main",label:"Hauptgericht",servings:55}] };
  const snapshot = specEditSnapshotFromSpec(source);
  const draft = { draftId:"answer-r1",revision:1,status:"pending_review" as const,createdAt:"2026-10-19",
    source:{sourceRef:"offer-handoff:h-1"},reviewCards:[],draftArtifacts:{eventSpec:source} };
  const stored = {...source,productionConstraints:["SYNTHETISCH: Freigaben offen"]};
  const actionInput = input({productionDraftContext:{caseId:"case-1",draft},
    buildCurrentSpecUpdateInput:()=>buildSpecEditUpdateInput({...snapshot,componentStates:Object.fromEntries(snapshot.components),specialDietResponse:"SYNTHETISCH: Freigaben offen"}),
    reviseProductionDraft:vi.fn(async()=>({draft:{...draft,draftId:"answer-r2",revision:2,draftArtifacts:{eventSpec:stored}}}))});
  actionInput.getCurrentProductionDraftContext=()=>actionInput.productionDraftContext;
  expect(await buildProductionSpecEditPersistAction(actionInput)()).toEqual(stored);
  expect(actionInput.reviseProductionDraft).toHaveBeenCalledWith("answer-r1",{caseId:"case-1",expectedRevision:1,componentClassifications:[],specialDietResponse:"SYNTHETISCH: Freigaben offen"});
  expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
});


describe("saving an imported accepted-spec snapshot", () => {
  function importedInput() {
    const source = { specId: "spec-lunch", menuPlan: [{ componentId: "dish", label: "Gericht", servings: 55 }] };
    const updated = { ...source, menuPlan: [{ ...source.menuPlan[0]!, productionStation: "cold-kitchen" }] };
    const draft = { draftId: "import-before", revision: 1, status: "pending_review" as const, createdAt: "2026-10-22", source: { sourceRef: "accepted-event-spec:spec-lunch" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
    const published = { ...draft, draftId: "import-after", draftArtifacts: { eventSpec: updated } };
    const actionInput = input({ productionDraftContext: { caseId: "case-import", draft },
      updateAcceptedSpec: vi.fn(async () => ({ acceptedEventSpec: updated })),
      publishAcceptedSpecDraft: vi.fn(async () => published), loadImportedSpecDrafts: vi.fn(async () => []), onImportedDraft: vi.fn(),
      buildCurrentSpecUpdateInput: () => ({ componentUpdates: [{ componentId: "dish", productionStation: "cold-kitchen" }] }) });
    actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
    return { actionInput, published, updated };
  }
  it("rejects a historical A-to-B-to-A reversal before changing Intake", async () => {
    const { actionInput, published } = importedInput();
    const spec = published.draftArtifacts.eventSpec;
    const snapshot = specEditSnapshotFromSpec(spec);
    actionInput.buildCurrentSpecUpdateInput = () => buildSpecEditUpdateInput({ ...snapshot, componentStates: Object.fromEntries(snapshot.components) });
    vi.mocked(actionInput.loadImportedSpecDrafts!).mockResolvedValue([published]);
    await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow("Rücknahme");
    expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
    expect(actionInput.publishAcceptedSpecDraft).not.toHaveBeenCalled();
    expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
  });
  it("allows a current-state retry despite a different or identically represented historical draft", async () => {
    const { actionInput, published } = importedInput();
    const current = actionInput.productionDraftContext!.draft.draftArtifacts!.eventSpec!;
    const snapshot = specEditSnapshotFromSpec(current);
    actionInput.buildCurrentSpecUpdateInput = () => buildSpecEditUpdateInput({ ...snapshot, componentStates: Object.fromEntries(snapshot.components) });
    vi.mocked(actionInput.loadImportedSpecDrafts!).mockResolvedValue([published, { ...published, draftId: "older-same-form", draftArtifacts: { eventSpec: current } }]);
    vi.mocked(actionInput.updateAcceptedSpec).mockResolvedValue({ acceptedEventSpec: current });
    vi.mocked(actionInput.publishAcceptedSpecDraft!).mockResolvedValue({ ...published, draftArtifacts: { eventSpec: current } });
    await expect(buildProductionSpecEditPersistAction(actionInput)()).resolves.toEqual(current);
    expect(actionInput.updateAcceptedSpec).toHaveBeenCalledOnce();
    expect(actionInput.resetSpecEdit).toHaveBeenCalled();
  });
  it("opens the exact newly fingerprinted snapshot before reporting success", async () => {
    const { actionInput, published, updated } = importedInput();
    expect(await buildProductionSpecEditPersistAction(actionInput)()).toEqual(updated);
    expect(actionInput.publishAcceptedSpecDraft).toHaveBeenCalledExactlyOnceWith("case-import", updated);
    expect(actionInput.onImportedDraft).toHaveBeenCalledExactlyOnceWith(published);
    expect(actionInput.resetSpecEdit).toHaveBeenCalled();
  });
  it("retains the editor and reports no success if publishing fails after the source save", async () => {
    const { actionInput } = importedInput();
    vi.mocked(actionInput.publishAcceptedSpecDraft!).mockRejectedValue(new Error("Prüffassung konnte nicht geladen werden"));
    await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow("Prüffassung");
    expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
    expect(actionInput.setNotice).not.toHaveBeenCalled();
  });
  it("refuses unsupported uploaded sources before changing Intake", async () => {
    const { actionInput } = importedInput();
    actionInput.productionDraftContext!.draft.source!.sourceRef = "upload:angebot.pdf";
    await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow("Quelle");
    expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
  });
  it("refuses a stale case before saving or after a delayed source response", async () => {
    const { actionInput } = importedInput();
    actionInput.getCurrentProductionDraftContext = () => ({ ...actionInput.productionDraftContext!, caseId: "other-case" });
    await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow("Produktionsfall");
    expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
    actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
    vi.mocked(actionInput.updateAcceptedSpec).mockImplementation(async () => {
      actionInput.productionDraftContext = { ...actionInput.productionDraftContext!, caseId: "other-case" };
      return { acceptedEventSpec: { specId: "spec-lunch" } };
    });
    const action = buildProductionSpecEditPersistAction(actionInput);
    await expect(action()).rejects.toThrow("Produktionsfall");
    expect(actionInput.publishAcceptedSpecDraft).not.toHaveBeenCalled();
    expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
  });
  it("rejects a newly imported snapshot changed by a concurrent source writer", async () => {
    const { actionInput, published } = importedInput();
    vi.mocked(actionInput.publishAcceptedSpecDraft!).mockResolvedValue({ ...published, draftArtifacts: { eventSpec: { specId: "spec-lunch" } } });
    await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow("stimmt nicht überein");
    expect(actionInput.onImportedDraft).not.toHaveBeenCalled();
    expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
  });
});


describe("production answer edit eligibility", () => {
  const draft = { draftId: "draft-a", revision: 3, status: "pending_review" as const, createdAt: "", reviewCards: [], draftArtifacts: { eventSpec: { specId: "spec-a" } } };
  const current = { caseId: "case-a", draftId: "draft-a", draft, specId: "spec-a" };
  it("permits the matching pending revision and unbound legacy editing", () => {
    expect(canEditProductionAnswers(current)).toBe(true);
    expect(canEditProductionAnswers({ specId: "legacy" })).toBe(true);
    expect(canEditProductionAnswers({ ...current, editingSpecId: "spec-a", editingContext: { caseId: "case-a", draft } })).toBe(true);
  });
  it("rejects decided, applied, missing and mismatched contexts including an already open editor", () => {
    expect(canEditProductionAnswers({ ...current, draft: { ...draft, status: "approved", appliedAt: "now" } })).toBe(false);
    expect(canEditProductionAnswers({ ...current, draft: { ...draft, appliedAt: "now" } })).toBe(false);
    expect(canEditProductionAnswers({ ...current, draft: undefined })).toBe(false);
    expect(canEditProductionAnswers({ specId: "spec-a", editingSpecId: "spec-a", editingContext: { caseId: "case-a", draft } })).toBe(false);
    expect(canEditProductionAnswers({ ...current, draftId: "other" })).toBe(false);
    expect(canEditProductionAnswers({ ...current, specId: "other" })).toBe(false);
    expect(canEditProductionAnswers({ ...current, editingSpecId: "spec-a", editingContext: { caseId: "case-b", draft } })).toBe(false);
    expect(canEditProductionAnswers({ ...current, editingSpecId: "spec-a", editingContext: { caseId: "case-a", draft: { ...draft, revision: 2 } } })).toBe(false);
  });
});


it("binds split saves to the open draft and preserves editing state on a save failure", async () => {
  const source = { specId: "spec-lunch", attendees: { expected: 35 }, menuPlan: [{ componentId: "coffee", label: "Coffee" }] };
  const draft = { draftId: "canonical-r2", revision: 2, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: source } };
  const splits = [{ parentComponentId: "coffee", reason: "Separat", children: [{ label: "A", servings: 18, recipeId: "recipe-a" }, { label: "B", servings: 18, recipeId: "recipe-b" }] }];
  const save = vi.fn(async () => { throw new Error("Revision veraltet"); });
  const actionInput = input({ productionDraftContext: { caseId: "case-1", draft }, reviseProductionDraft: save,
    buildCurrentSpecUpdateInput: () => ({ attendeeCount: 35, menuItems: ["Coffee"], componentUpdates: [{ componentId: "coffee", purchasedElements: [], recipeOverrideId: "", notes: "" }], componentSplits: splits }) });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  await expect(buildProductionSpecEditPersistAction(actionInput)()).rejects.toThrow("Revision veraltet");
  expect(save).toHaveBeenCalledWith("canonical-r2", { caseId: "case-1", expectedRevision: 2, componentClassifications: [], componentSplits: splits });
  expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
  expect(actionInput.setNotice).not.toHaveBeenCalled();
});
