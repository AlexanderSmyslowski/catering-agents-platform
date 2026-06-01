import { describe, expect, it, vi } from "vitest";
import {
  buildAppProductionRouteAppBoundary,
  type AppProductionRouteAppBoundaryInput
} from "../backoffice-ui/src/app-production-route-app-boundary.js";
import type { ProductionRouteMainLayoutStateInput } from "../backoffice-ui/src/production-route-main-layout-state.js";

function viewState(): ProductionRouteMainLayoutStateInput["viewState"] {
  return {
    workbenchSummary: {
      activeSpecLabel: "Lunch",
      readinessLabel: "vollständig",
      planStatusLabel: "vollständig",
      purchaseStatusLabel: "1 Liste",
      questionCount: 0,
      answeredQuestionCount: 0,
      unansweredQuestionCount: 0,
      productionObjectCount: 1,
      productionObjectStatusLabel: "1 Plan",
      purchaseListCount: 1
    },
    workbenchNextStep: {
      title: "Produktionsobjekte prüfen",
      description: "Plan, Einkaufsliste und Exporte prüfen."
    },
    questionState: {
      focusedSpecReadinessLabel: "vollständig",
      currentSpecPurchaseLists: [],
      productionQuestions: [],
      productionAssumptions: [],
      productionConversationProjection: { sessionId: "session-spec-1", messages: [] },
      workbenchSpecFacts: [],
      intakeRequestDetail: null,
      filteredSpecs: [],
      documentPhase: "idle",
      productionWorkspaceCleared: false
    },
    objectPanelProgress: {
      planPhase: "idle",
      planProgress: 0
    },
    objectPanelState: {
      productionWorkspaceCleared: false,
      currentSpecPlans: [],
      selectedPlanComponentsById: new Map<string, Record<string, unknown>>(),
      archivedPlans: [],
      specById: new Map<string, Record<string, unknown>>()
    },
    purchaseListState: {
      currentPurchaseLists: [],
      archivedPurchaseLists: [],
      specById: new Map<string, Record<string, unknown>>(),
      statusLabel: "noch keine Liste"
    },
    handoffState: {
      intakeOriginLabel: "kein Intake-Ursprung verknüpft",
      auditTrailLabel: "keine Audit-Ereignisse geladen",
      exportLabel: "Produktionsblatt offen · Einkaufsliste offen"
    },
    recipeStatus: {
      recipeReviewStatusLabel: "keine Rezepte",
      recipeUsageStatusLabel: "keine Rezeptprüfung offen",
      recipeReviewCounts: { approved: 0, reviewRequired: 0, rejected: 0 },
      recipeCount: 0
    },
    recipeUpload: {
      recipeName: "",
      recipeFile: null
    },
    recipeLibrary: {
      filteredRecipes: []
    }
  };
}

function input(
  overrides: Partial<AppProductionRouteAppBoundaryInput> = {}
): AppProductionRouteAppBoundaryInput {
  const uploadInputRef = { current: null };
  const manualInput = {
    eventType: "",
    eventDate: "",
    attendeeCount: "",
    serviceForm: "",
    menuItems: "",
    customerName: "",
    venueName: "",
    notes: ""
  };
  const manualInputActions = {
    setEventType: vi.fn(),
    setEventDate: vi.fn(),
    setAttendeeCount: vi.fn(),
    setServiceForm: vi.fn(),
    setMenuItems: vi.fn(),
    setCustomerName: vi.fn(),
    setVenueName: vi.fn(),
    setNotes: vi.fn(),
    submitManualSpec: vi.fn(async () => undefined)
  };
  const recipes = [{ recipeId: "recipe-1", name: "Tomatensuppe" }];
  const recipeActions = {
    setRecipeName: vi.fn(),
    setRecipeFile: vi.fn(),
    uploadRecipe: vi.fn(async () => undefined),
    reviewRecipe: vi.fn(async () => undefined)
  };

  return {
    viewState: viewState(),
    submitting: false,
    dragActive: true,
    intakeFile: null,
    intakeChannel: "pdf_upload",
    documentPhase: "idle",
    documentProgress: 0,
    intakeText: "Lunch fuer 40 Personen.",
    canClearWorkspace: true,
    canArchiveCurrentIntake: false,
    clearWorkspaceContextLabel: "Lunch · 40 Teilnehmer",
    uploadInputRef,
    setDragActive: vi.fn(),
    setIntakeChannel: vi.fn(),
    setIntakeText: vi.fn(),
    setIntakeFile: vi.fn(),
    processIncomingProductionFile: vi.fn(),
    clearWorkspace: vi.fn(),
    archiveCurrentIntake: vi.fn(async () => undefined),
    submitDocument: vi.fn(async () => undefined),
    submitText: vi.fn(async () => undefined),
    editingSpecId: "spec-1",
    editingEventType: "lunch",
    editingEventDate: "2026-06-01",
    editingAttendeeCount: "40",
    editingServiceForm: "buffet",
    editingMenuItems: "Tomatensuppe",
    editingComponentStates: {},
    hasFocusedSpecEditChanges: true,
    recipes,
    isInitialProductionLoading: false,
    productionPlanCount: 2,
    purchaseListCount: 1,
    recipeCount: 5,
    approvedRecipeCount: 4,
    reviewRequiredRecipeCount: 1,
    productionServiceStatus: "ok",
    productionServiceCounts: { productionPlans: 2, purchaseLists: 1 },
    search: "Lunch",
    setSearch: vi.fn(),
    manualInput,
    manualInputActions,
    openSpecForQuestions: vi.fn(),
    setEditingEventType: vi.fn(),
    setEditingEventDate: vi.fn(),
    setEditingAttendeeCount: vi.fn(),
    setEditingServiceForm: vi.fn(),
    setEditingMenuItems: vi.fn(),
    updateEditingComponentState: vi.fn(),
    beginSpecEdit: vi.fn(),
    saveSpecEdit: vi.fn(async () => undefined),
    createPlan: vi.fn(async () => undefined),
    resetSpecEdit: vi.fn(),
    setSelectedPlanId: vi.fn(),
    recipeActions,
    ...overrides
  };
}

describe("app production route app boundary", () => {
  it("builds source input, editor, filter and main layout from one production route boundary", () => {
    const boundaryInput = input();
    const boundary = buildAppProductionRouteAppBoundary(boundaryInput);

    expect(boundary.productionSourceInput).toMatchObject({
      dragActive: true,
      intakeText: "Lunch fuer 40 Personen.",
      clearWorkspaceTitle: "Lokalen Arbeitsbereich leeren: Lunch · 40 Teilnehmer"
    });
    expect(boundary.productionQuestionEditorState).toMatchObject({
      editingSpecId: "spec-1",
      hasFocusedSpecEditChanges: true
    });
    expect(boundary.productionQuestionEditorState.recipes).toBe(boundaryInput.recipes);
    expect(boundary.productionRouteFilterState).toMatchObject({
      productionPlanCount: 2,
      purchaseListCount: 1,
      productionServiceStatusLabel: "bereit",
      productionServiceCountsLabel: "Produktionspläne: 2 · Einkaufslisten: 1"
    });
    expect(boundary.productionRouteMainLayoutState.sourceInput).toBe(boundary.productionSourceInput);
    expect(boundary.productionRouteMainLayoutState.sourceInputActions).toBe(boundary.productionSourceInputActions);
    expect(boundary.productionRouteMainLayoutState.editorState).toBe(boundary.productionQuestionEditorState);
    expect(boundary.productionRouteMainLayoutState.manualInput).toBe(boundaryInput.manualInput);
    expect(boundary.productionRouteMainLayoutState.manualInputActions).toBe(boundaryInput.manualInputActions);
    expect(boundary.productionRecipeActions).toBe(boundaryInput.recipeActions);
    expect(boundary.productionQuestionEditorActions.saveSpecEdit).toBe(boundaryInput.saveSpecEdit);
    expect(boundary.productionObjectsActions.setSelectedPlanId).toBe(boundaryInput.setSelectedPlanId);
  });

  it("keeps generated file actions wired through the source input app boundary", () => {
    const selectedFile = new File(["Lunch"], "angebot.txt", { type: "text/plain" });
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const boundary = buildAppProductionRouteAppBoundary(
      input({
        setIntakeFile,
        processIncomingProductionFile
      })
    );
    const target = { files: [selectedFile], value: "C:\\fakepath\\angebot.txt" };

    boundary.productionSourceInputActions.handleFileSelection({ target } as never);

    expect(setIntakeFile).toHaveBeenCalledWith(selectedFile);
    expect(processIncomingProductionFile).toHaveBeenCalledWith(selectedFile, "text");
    expect(target.value).toBe("");
  });
});
