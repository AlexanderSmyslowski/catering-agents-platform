import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ProductionRouteMainLayout,
  type ProductionRouteMainLayoutProps
} from "../backoffice-ui/src/production-route-main-layout.js";

const noop = () => undefined;
const noopAsync = async () => undefined;

function buildProps(
  overrides: Partial<ProductionRouteMainLayoutProps> = {}
): ProductionRouteMainLayoutProps {
  const selectedPlanSpec = {
    specId: "spec-plan-1",
    event: { type: "conference", date: "2026-09-03" },
    attendees: { expected: 90 },
    servicePlan: { serviceForm: "buffet" },
    readiness: { status: "partial" },
    menuPlan: [
      {
        componentId: "lunch",
        label: "Lunchbuffet",
        menuCategory: "classic",
        productionDecision: { mode: "scratch" }
      },
      {
        componentId: "coffee",
        label: "Kaffeestation",
        menuCategory: "classic",
        productionDecision: { mode: "convenience_purchase", purchasedElements: ["Kaffee"] }
      }
    ]
  };

  return {
    workbenchSummary: {
      activeSpecLabel: "Konferenz · 90 Teilnehmer · 2026-09-03",
      readinessLabel: "teilweise vollständig",
      planStatusLabel: "unzureichend",
      purchaseStatusLabel: "1 Liste · 0 Positionen",
      questionCount: 0,
      answeredQuestionCount: 0,
      unansweredQuestionCount: 0,
      productionObjectCount: 1,
      productionObjectStatusLabel: "1 Plan · unzureichend",
      purchaseListCount: 1
    },
    workbenchNextStep: {
      title: "Produktionsarbeit prüfen",
      description: "Plan, Einkaufsliste und Exporte prüfen."
    },
    submitting: false,
    sourceInput: {
      dragActive: false,
      intakeFile: null,
      intakeChannel: "pdf_upload",
      documentPhase: "done",
      activeDocumentName: "Angebot_Koepff.pdf",
      documentProgress: 100,
      intakeText: "",
      canClearWorkspace: false,
      canArchiveCurrentIntake: false,
      clearWorkspaceTitle: "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.",
      archiveCurrentIntakeTitle: "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
    },
    sourceInputActions: {
      uploadInputRef: { current: null },
      setDragActive: noop,
      setIntakeChannel: noop,
      setIntakeText: noop,
      openFilePicker: noop,
      clearWorkspace: noop,
      archiveCurrentIntake: noopAsync,
      handleDrop: noop,
      handleFileSelection: noop,
      submitDocument: noopAsync,
      submitText: noopAsync
    },
    manualInput: {
      eventType: "",
      eventDate: "",
      attendeeCount: "",
      serviceForm: "",
      menuItems: "",
      customerName: "",
      venueName: "",
      notes: ""
    },
    manualInputActions: {
      setEventType: noop,
      setEventDate: noop,
      setAttendeeCount: noop,
      setServiceForm: noop,
      setMenuItems: noop,
      setCustomerName: noop,
      setVenueName: noop,
      setNotes: noop,
      submitManualSpec: noopAsync
    },
    questionState: {
      focusedProductionSpec: undefined,
      focusedSpecReadinessLabel: "-",
      selectedPlan: { planId: "plan-1", eventSpecId: "spec-plan-1" },
      selectedPlanReadinessLabel: "unzureichend",
      currentSpecPurchaseLists: [],
      productionQuestions: [],
      productionAssumptions: [],
      productionConversationProjection: { sessionId: "session-plan-1", messages: [] },
      workbenchSpecFacts: [],
      intakeRequestDetail: null,
      filteredSpecs: [],
      documentPhase: "done",
      productionWorkspaceCleared: false
    },
    questionActions: {
      openSpecForQuestions: noop
    },
    editorState: {
      editingSpecId: undefined,
      editingEventType: "",
      editingEventDate: "",
      editingAttendeeCount: "",
      editingServiceForm: "",
      editingMenuItems: "",
      editingComponentStates: {},
      hasFocusedSpecEditChanges: false,
      recipes: []
    },
    editorActions: {
      setEditingEventType: noop,
      setEditingEventDate: noop,
      setEditingAttendeeCount: noop,
      setEditingServiceForm: noop,
      setEditingMenuItems: noop,
      updateEditingComponentState: noop,
      beginSpecEdit: noop,
      saveSpecEdit: noopAsync,
      createPlan: noopAsync,
      resetSpecEdit: noop
    },
    objectPanelProgress: {
      planPhase: "idle",
      planProgress: 0
    },
    objectPanelState: {
      focusedProductionSpec: undefined,
      productionWorkspaceCleared: false,
      currentSpecPlans: [{ planId: "plan-1", eventSpecId: "spec-plan-1" }],
      selectedPlan: { planId: "plan-1", eventSpecId: "spec-plan-1" },
      selectedPlanSpec,
      selectedPlanComponentsById: new Map(),
      archivedPlans: [],
      specById: new Map([["spec-plan-1", selectedPlanSpec]])
    },
    objectPanelActions: {
      setSelectedPlanId: noop
    },
    purchaseListState: {
      currentPurchaseLists: [],
      archivedPurchaseLists: [],
      specById: new Map(),
      statusLabel: "1 Liste · 0 Positionen"
    },
    handoffState: {
      intakeOriginLabel: "kein Intake-Ursprung verknüpft",
      auditTrailLabel: "keine Audit-Ereignisse geladen",
      exportLabel: "Produktionsblatt offen · Einkaufsliste offen"
    },
    recipeStatus: {
      recipeReviewStatusLabel: "keine offene Prüfung",
      recipeUsageStatusLabel: "Noch keine freigegebenen Rezepte im Bestand",
      recipeReviewCounts: { approved: 0, reviewRequired: 0, rejected: 0 },
      recipeCount: 0
    },
    recipeUpload: {
      recipeName: "",
      recipeFile: null
    },
    recipeLibrary: {
      filteredRecipes: []
    },
    recipeActions: {
      setRecipeName: noop,
      setRecipeFile: noop,
      uploadRecipe: noopAsync,
      reviewRecipe: noopAsync
    },
    miniPilotRawResult: "",
    setMiniPilotRawResult: noop,
    miniPilotReportState: {
      statusLabel: "noch kein Ergebnis",
      reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
      nextStepLabel: "Check lokal ausfuehren, JSON einfuellen und dann erst weiterarbeiten.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    },
    ...overrides
  };
}

describe("production route main layout", () => {
  it("uses the selected plan spec for the upload summary without focusing the question panel", () => {
    const markup = renderToStaticMarkup(createElement(ProductionRouteMainLayout, buildProps()));

    expect(markup).toContain("Erkannte Produktionsdaten");
    expect(markup).toContain("Eventtyp: Konferenz · Datum: 2026-09-03");
    expect(markup).toContain("Teilnehmerzahl: 90 · Serviceform: Buffet");
    expect(markup).toContain("Lunchbuffet");
    expect(markup).toContain("Kaffeestation");
    expect(markup).not.toContain("Datei hier ablegen oder Dateiauswahl öffnen");
    expect(markup).toContain("Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheinen hier die Rückfragen des Agenten.");
  });
});
