import { describe, expect, it } from "vitest";
import { buildProductionRouteMainLayoutState } from "../backoffice-ui/src/production-route-main-layout-state.js";
import type { ProductionRouteMainLayoutStateInput } from "../backoffice-ui/src/production-route-main-layout-state.js";

describe("production route main layout state", () => {
  it("combines route view state and action props without changing references", () => {
    const viewState = {
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
        title: "Produktionsarbeit prüfen",
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
        documentPhase: "idle" as const,
        productionWorkspaceCleared: false
      },
      objectPanelProgress: {
        planPhase: "idle" as const,
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
    } satisfies ProductionRouteMainLayoutStateInput["viewState"];
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
    const questionActions = { openSpecForQuestions: (_specId: string) => undefined };
    const editorState = {
      editingEventType: "",
      editingEventDate: "",
      editingEventSchedule: "",
      editingAttendeeCount: "",
      editingServiceForm: "",
      editingMenuItems: "",
      editingComponentStates: {},
      hasFocusedSpecEditChanges: false,
      recipes: []
    };
    const editorActions = {
      setEditingEventType: (_value: string) => undefined,
      setEditingEventDate: (_value: string) => undefined,
      setEditingEventSchedule: (_value: string) => undefined,
      setEditingAttendeeCount: (_value: string) => undefined,
      setEditingServiceForm: (_value: string) => undefined,
      setEditingMenuItems: (_value: string) => undefined,
      updateEditingComponentState: (_componentId: string, _patch: Record<string, unknown>) => undefined,
      beginSpecEdit: (_spec: Record<string, unknown>) => undefined,
      saveSpecEdit: async () => undefined,
      createPlan: async (_spec: Record<string, unknown>) => undefined,
      resetSpecEdit: (_markDismissed?: boolean) => undefined
    };
    const objectPanelActions = { setSelectedPlanId: (_planId: string) => undefined };
    const recipeActions = {
      setRecipeName: (_value: string) => undefined,
      setRecipeFile: (_file: File | null) => undefined,
      uploadRecipe: async (_target: "offer" | "production") => undefined,
      reviewRecipe: async (
        _target: "offer" | "production",
        _recipeId: string,
        _decision: "approve" | "verify" | "reject"
      ) => undefined
    };

    const state = buildProductionRouteMainLayoutState({
      viewState,
      submitting: true,
      sourceInput,
      sourceInputActions,
      manualInput,
      manualInputActions,
      questionActions,
      editorState,
      editorActions,
      objectPanelActions,
      recipeActions,
      miniPilotRawResult: "",
      setMiniPilotRawResult: (_value: string) => undefined,
      miniPilotReportState: {
        statusLabel: "noch kein Ergebnis",
        reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
        nextStepLabel:
          "Check lokal ausfuehren, JSON einfuellen und dann erst mit dem Draft weiterarbeiten.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }
    });

    expect(state.workbenchSummary).toBe(viewState.workbenchSummary);
    expect(state.questionState).toBe(viewState.questionState);
    expect(state.handoffState).toBe(viewState.handoffState);
    expect(state.sourceInput).toBe(sourceInput);
    expect(state.sourceInputActions).toBe(sourceInputActions);
    expect(state.manualInput).toBe(manualInput);
    expect(state.manualInputActions).toBe(manualInputActions);
    expect(state.questionActions).toBe(questionActions);
    expect(state.editorState).toBe(editorState);
    expect(state.editorActions).toBe(editorActions);
    expect(state.objectPanelActions).toBe(objectPanelActions);
    expect(state.recipeActions).toBe(recipeActions);
    expect(state.miniPilotReportState.commandLabel).toBe("npm run llm:synthetic-live:check:mini-pilot");
    expect(state.submitting).toBe(true);
  });
});
