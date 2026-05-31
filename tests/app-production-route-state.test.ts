import { describe, expect, it } from "vitest";
import { buildAppProductionRouteState } from "../backoffice-ui/src/app-production-route-state.js";
import type { AppProductionRouteStateInput } from "../backoffice-ui/src/app-production-route-state.js";
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

describe("app production route state", () => {
  it("builds production actions and main layout state without wrapping callback references", () => {
    const sourceInput = {
      dragActive: false,
      intakeFile: null,
      intakeChannel: "pdf_upload" as const,
      documentPhase: "idle" as const,
      documentProgress: 0,
      intakeText: "",
      canClearWorkspace: false,
      canArchiveCurrentIntake: false,
      clearWorkspaceTitle: "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.",
      archiveCurrentIntakeTitle: "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
    };
    const sourceInputActions = {
      uploadInputRef: { current: null },
      setDragActive: (_active: boolean) => undefined,
      setIntakeChannel: (_channel: "pdf_upload" | "email" | "text") => undefined,
      setIntakeText: (_value: string) => undefined,
      openFilePicker: () => undefined,
      clearWorkspace: () => undefined,
      archiveCurrentIntake: async () => undefined,
      handleDrop: () => undefined,
      handleFileSelection: () => undefined,
      submitDocument: async () => undefined,
      submitText: async () => undefined
    };
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
      setEventType: (_value: string) => undefined,
      setEventDate: (_value: string) => undefined,
      setAttendeeCount: (_value: string) => undefined,
      setServiceForm: (_value: string) => undefined,
      setMenuItems: (_value: string) => undefined,
      setCustomerName: (_value: string) => undefined,
      setVenueName: (_value: string) => undefined,
      setNotes: (_value: string) => undefined,
      submitManualSpec: async () => undefined
    };
    const editorState = {
      editingEventType: "",
      editingEventDate: "",
      editingAttendeeCount: "",
      editingServiceForm: "",
      editingMenuItems: "",
      editingComponentStates: {},
      hasFocusedSpecEditChanges: false,
      recipes: []
    };
    const input: AppProductionRouteStateInput = {
      viewState: viewState(),
      submitting: true,
      sourceInput,
      sourceInputActions,
      manualInput,
      manualInputActions,
      editorState,
      openSpecForQuestions: (_specId) => undefined,
      setEditingEventType: (_value) => undefined,
      setEditingEventDate: (_value) => undefined,
      setEditingAttendeeCount: (_value) => undefined,
      setEditingServiceForm: (_value) => undefined,
      setEditingMenuItems: (_value) => undefined,
      updateEditingComponentState: (_componentId, _patch) => undefined,
      beginSpecEdit: (_spec) => undefined,
      saveSpecEdit: async () => undefined,
      createPlan: async (_spec) => undefined,
      resetSpecEdit: (_markDismissed) => undefined,
      setSelectedPlanId: (_planId) => undefined,
      setRecipeName: (_value) => undefined,
      setRecipeFile: (_file) => undefined,
      uploadRecipe: async (_target) => undefined,
      reviewRecipe: async (_target, _recipeId, _decision) => undefined
    };

    const state = buildAppProductionRouteState(input);

    expect(state.productionQuestionActions.openSpecForQuestions).toBe(input.openSpecForQuestions);
    expect(state.productionQuestionEditorActions.saveSpecEdit).toBe(input.saveSpecEdit);
    expect(state.productionQuestionEditorActions.createPlan).toBe(input.createPlan);
    expect(state.productionObjectsActions.setSelectedPlanId).toBe(input.setSelectedPlanId);
    expect(state.productionRecipeActions.uploadRecipe).toBe(input.uploadRecipe);
    expect(state.productionRecipeActions.reviewRecipe).toBe(input.reviewRecipe);
    expect(state.productionRouteMainLayoutState.workbenchSummary).toBe(input.viewState.workbenchSummary);
    expect(state.productionRouteMainLayoutState.sourceInput).toBe(sourceInput);
    expect(state.productionRouteMainLayoutState.sourceInputActions).toBe(sourceInputActions);
    expect(state.productionRouteMainLayoutState.manualInput).toBe(manualInput);
    expect(state.productionRouteMainLayoutState.manualInputActions).toBe(manualInputActions);
    expect(state.productionRouteMainLayoutState.questionActions).toBe(state.productionQuestionActions);
    expect(state.productionRouteMainLayoutState.editorActions).toBe(state.productionQuestionEditorActions);
    expect(state.productionRouteMainLayoutState.objectPanelActions).toBe(state.productionObjectsActions);
    expect(state.productionRouteMainLayoutState.recipeActions).toBe(state.productionRecipeActions);
  });
});
