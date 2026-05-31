import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from "react";
import { DashboardShell } from "../components/dashboard-shell.js";
import {
  detectRoute,
  emptyDashboardState,
  emptyServiceHealthState,
  formatLatestIntakeRequest,
  getBaseUrl,
  getPathname
} from "./app-shell-state.js";
import { AppFeedbackShell } from "./app-feedback-shell.js";
import { buildAppRouteShellState } from "./app-route-shell-state.js";
import {
  countOfferHandoffReadiness,
  filterDashboardRecords,
  isInitialHomeDashboardLoading,
  isInitialProductionDashboardLoading,
  selectActiveOfferSpec,
  selectRecordByStringId
} from "./app-dashboard-selectors.js";
import { buildAppOfferRouteState } from "./app-offer-route-state.js";
import { AppRouteContent } from "./app-route-content.js";
import { buildAppRouteContentState } from "./app-route-content-state.js";
import { RouteMasthead } from "./route-masthead.js";
import { refreshAppDashboardState } from "./app-dashboard-refresh.js";
import { buildAppSeedDemoAction } from "./app-seed-demo-action.js";
import {
  archiveIntakeRequest,
  createAcceptedSpecFromDocument,
  createAcceptedSpecFromManualForm,
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionPlan,
  loadDashboardState,
  loadServiceHealth,
  promoteOfferDraft,
  reviewRecipe,
  seedDemoData,
  updateAcceptedSpec,
  uploadRecipeFile,
  type DashboardState,
  type IntakeDocumentChannel,
  type ServiceHealthState
} from "./api.js";
import { buildProductionConversationState } from "./production-conversation-state.js";
import { buildProductionCurrentArtifactsState } from "./production-current-artifacts-state.js";
import { buildProductionDashboardRecordsState } from "./production-dashboard-records-state.js";
import { buildProductionFocusState } from "./production-focus-state.js";
import {
  buildProductionManualInputActions,
  buildProductionManualInputStateFromForm
} from "./production-manual-input-state.js";
import { buildProductionManualSpecSubmitAction } from "./production-manual-spec-submit-action.js";
import { buildProductionSelectedPlanState } from "./production-selected-plan-state.js";
import { extractAcceptedSpecId } from "./production-api-response-ids.js";
import { buildProductionDocumentSubmitActions } from "./production-document-submit-action.js";
import { buildProductionTextIntakeSubmitAction } from "./production-text-intake-submit-action.js";
import { startProductionDocumentUpload } from "./production-document-upload-start.js";
import { buildProductionPlanSubmissionAction } from "./production-plan-submission-action.js";
import { buildProductionSpecSaveAction } from "./production-spec-save-action.js";
import {
  buildProductionQuestionEditorState,
  completeProductionQuestionEditSuccess
} from "./production-question-editor-state.js";
import { buildProductionQuestionAutoOpenState } from "./production-question-auto-open-state.js";
import { buildAppProductionRouteState } from "./app-production-route-state.js";
import { buildOfferDraftPromoteAction } from "./offer-draft-promote-action.js";
import { buildOfferTextSubmitAction } from "./offer-text-submit-action.js";
import { buildProductionRouteFilterState } from "./production-route-filter-state.js";
import { buildProductionRouteViewState } from "./production-route-view-state.js";
import {
  buildProductionSourceInputActions,
  buildProductionSourceInputState
} from "./production-source-input-state.js";
import { buildProductionSourceFileUploadActions } from "./production-source-file-actions.js";
import { buildProductionStatusSummaryState } from "./production-status-summary-state.js";
import { buildProductionRecipeStatusSummaryState } from "./production-recipe-status-state.js";
import { buildProductionRecipeSubmissionActions } from "./production-recipe-submission-actions.js";
import { buildProductionIntakeArchiveAction } from "./production-intake-archive-action.js";
import { buildProductionSpecFocusActions } from "./production-spec-focus-actions.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";
import { buildProductionWorkspaceActionState } from "./production-workspace-action-state.js";
import { buildProductionWorkspaceUiActions } from "./production-workspace-ui-actions.js";
import {
  buildProductionWindowFileActions
} from "./production-window-file-actions.js";
import { useProductionSpecEditor } from "./use-production-spec-editor.js";
import { useProductionDocumentProgress } from "./use-production-document-progress.js";
import { useProductionIntakeDraft } from "./use-production-intake-draft.js";
import { useProductionIntakeRequestDetail } from "./use-production-intake-request-detail.js";
import { useProductionManualSpecForm } from "./use-production-manual-spec-form.js";
import { useProductionPlanProgress } from "./use-production-plan-progress.js";
import { useOperatorNameState } from "./use-operator-name-state.js";
import { useRecipeUploadDraft } from "./use-recipe-upload-draft.js";

export function App() {
  const route = useMemo(() => detectRoute(getPathname()), []);
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboardState);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyServiceHealthState);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const {
    operatorName,
    handleOperatorNameChange
  } = useOperatorNameState();
  const [offerText, setOfferText] = useState(
    "Besprechung am 2026-06-25 für 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
  );
  const {
    recipeName,
    setRecipeName,
    recipeFile,
    setRecipeFile,
    clearRecipeUploadDraft
  } = useRecipeUploadDraft();
  const [search, setSearch] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [focusedProductionSpecId, setFocusedProductionSpecId] = useState<string>();
  const [productionWorkspaceCleared, setProductionWorkspaceCleared] = useState(false);
  const {
    intakeText,
    setIntakeText,
    intakeFile,
    setIntakeFile,
    intakeChannel,
    setIntakeChannel,
    dragActive,
    setDragActive,
    resetIntakeDraft,
    startIncomingProductionFile,
    completeIncomingProductionFile,
    failIncomingProductionFile
  } = useProductionIntakeDraft();
  const {
    activeDocumentName,
    documentPhase,
    documentProgress,
    documentEtaSeconds,
    resetDocumentProgress,
    startDocumentProgress,
    completeDocumentProgress,
    failDocumentProgress
  } = useProductionDocumentProgress();
  const {
    planPhase,
    planningSpecLabel,
    planProgress,
    planEtaSeconds,
    resetPlanProgress,
    startPlanProgress,
    completePlanProgress,
    failPlanProgress
  } = useProductionPlanProgress();
  const manualSpecForm = useProductionManualSpecForm();
  const {
    buildCurrentManualSpecInput,
    resetManualSpecDraft
  } = manualSpecForm;
  const deferredSearch = useDeferredValue(search);
  const productionUploadInputRef = useRef<HTMLInputElement | null>(null);

  const refreshDashboard = useEffectEvent(async () => {
    await refreshAppDashboardState({
      loadDashboardState,
      loadServiceHealth,
      setDashboard,
      setServiceHealth,
      setLoading,
      setError,
      transition: startTransition
    });
  });

  useEffect(() => {
    void refreshDashboard();
  }, []);

  const filteredOfferDrafts = useMemo(
    () => filterDashboardRecords(dashboard.offerDrafts, deferredSearch),
    [dashboard.offerDrafts, deferredSearch]
  );

  const {
    filteredSpecs,
    filteredAuditEvents,
    filteredRecipes,
    orderedPlans,
    orderedPurchaseLists,
    specById,
    productionArtifactSpecIds
  } = useMemo(
    () =>
      buildProductionDashboardRecordsState({
        acceptedSpecs: dashboard.acceptedSpecs,
        productionPlans: dashboard.productionPlans,
        purchaseLists: dashboard.purchaseLists,
        auditEvents: dashboard.auditEvents,
        recipes: dashboard.recipes,
        searchText: deferredSearch
      }),
    [
      dashboard.acceptedSpecs,
      dashboard.auditEvents,
      dashboard.productionPlans,
      dashboard.purchaseLists,
      dashboard.recipes,
      deferredSearch
    ]
  );

  const {
    recipeReviewCounts,
    recipeReviewStatusLabel,
    recipeUsageStatusLabel,
    recipeCount
  } = useMemo(
    () => buildProductionRecipeStatusSummaryState({ recipes: dashboard.recipes }),
    [dashboard.recipes]
  );

  const offerHandoffCounts = useMemo(
    () => countOfferHandoffReadiness(dashboard.acceptedSpecs),
    [dashboard.acceptedSpecs]
  );

  const latestIntakeRequestSummary = useMemo(
    () => formatLatestIntakeRequest(dashboard.intakeRequests),
    [dashboard.intakeRequests]
  );
  const isInitialHomeLoading = isInitialHomeDashboardLoading({ route, loading, dashboard });
  const isInitialProductionLoading = isInitialProductionDashboardLoading({ route, loading, dashboard });

  const selectedDraft = useMemo(
    () => selectRecordByStringId(dashboard.offerDrafts, "draftId", selectedDraftId),
    [dashboard.offerDrafts, selectedDraftId]
  );

  const activeOfferDraft = selectedDraft ?? filteredOfferDrafts[0];
  const activeOfferSpec = selectActiveOfferSpec(dashboard.acceptedSpecs, filteredSpecs);

  const {
    focusedProductionSpec,
    focusedProductionSpecRecord,
    currentIntakeRequestId
  } = useMemo(
    () =>
      buildProductionFocusState({
        acceptedSpecs: dashboard.acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId,
        productionArtifactSpecIds,
        productionWorkspaceCleared,
        route,
        searchText: deferredSearch
      }),
    [
      dashboard.acceptedSpecs,
      deferredSearch,
      filteredSpecs,
      focusedProductionSpecId,
      productionArtifactSpecIds,
      productionWorkspaceCleared,
      route
    ]
  );

  const {
    intakeRequestDetail,
    intakeRequestDetailError,
    resetIntakeRequestDetail
  } = useProductionIntakeRequestDetail({ currentIntakeRequestId });

  const {
    editingSpecId,
    dismissedProductionAnswerSpecId,
    editingEventType,
    editingEventDate,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    setEditingEventType,
    setEditingEventDate,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    loadSpecIntoEditor: loadSpecIntoEditorState,
    resetSpecEdit,
    updateEditingComponentState,
    buildCurrentSpecUpdateInput
  } = useProductionSpecEditor({ focusedProductionSpec: focusedProductionSpecRecord });

  const currentProductionSpecId = String(focusedProductionSpec?.specId ?? "");

  const {
    currentSpecPlans,
    archivedPlans,
    currentSpecPurchaseLists,
    archivedPurchaseLists
  } = useMemo(
    () =>
      buildProductionCurrentArtifactsState({
        currentProductionSpecId,
        orderedPlans,
        orderedPurchaseLists,
        productionWorkspaceCleared
      }),
    [currentProductionSpecId, orderedPlans, orderedPurchaseLists, productionWorkspaceCleared]
  );

  const {
    selectedPlan,
    selectedPlanSpec,
    selectedPlanComponentsById
  } = useMemo(
    () =>
      buildProductionSelectedPlanState({
        currentProductionSpecId,
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared,
        selectedPlanId,
        specById
      }),
    [currentProductionSpecId, currentSpecPlans, orderedPlans, productionWorkspaceCleared, selectedPlanId, specById]
  );

  const {
    productionQuestions,
    productionAssumptions,
    productionConversationProjection,
    clarificationStatusCounts,
    workbenchSpecFacts
  } = useMemo(
    () =>
      buildProductionConversationState({
        focusedProductionSpec,
        focusedProductionSpecRecord,
        intakeRequestDetail,
        currentSpecPlans,
        currentSpecPurchaseLists
      }),
    [
      currentSpecPlans,
      currentSpecPurchaseLists,
      focusedProductionSpec,
      focusedProductionSpecRecord,
      intakeRequestDetail
    ]
  );

  const {
    activeProductionContextLabel,
    focusedSpecReadinessLabel,
    selectedPlanReadinessLabel,
    productionPlanStatusLabel,
    productionObjectStatusLabel,
    purchaseZoneStatusLabel,
    productionIntakeOriginLabel,
    productionAuditTrailLabel,
    productionHandoffExportLabel,
    productionHandoffContextLabel,
    productionNextStep
  } = useMemo(
    () =>
      buildProductionStatusSummaryState({
        isInitialProductionLoading,
        focusedProductionSpec,
        selectedPlan,
        selectedPlanSpec,
        currentSpecPlans,
        currentSpecPurchaseLists,
        productionQuestions,
        filteredAuditEvents,
        intakeRequestDetail,
        currentIntakeRequestId,
        productionWorkspaceCleared
      }),
    [
      currentIntakeRequestId,
      currentSpecPlans,
      currentSpecPurchaseLists,
      filteredAuditEvents,
      focusedProductionSpec,
      intakeRequestDetail,
      isInitialProductionLoading,
      productionQuestions,
      productionWorkspaceCleared,
      selectedPlan,
      selectedPlanSpec
    ]
  );

  const productionRouteViewState = buildProductionRouteViewState({
    activeProductionContextLabel,
    focusedSpecReadinessLabel,
    productionPlanStatusLabel,
    purchaseZoneStatusLabel,
    productionQuestions,
    clarificationStatusCounts,
    currentSpecPlans,
    productionObjectStatusLabel,
    currentSpecPurchaseLists,
    productionNextStep,
    focusedProductionSpec,
    selectedPlan,
    selectedPlanReadinessLabel,
    productionAssumptions,
    productionConversationProjection,
    workbenchSpecFacts,
    intakeRequestDetailError,
    intakeRequestDetail,
    filteredSpecs,
    documentPhase,
    productionWorkspaceCleared,
    planPhase,
    planningSpecLabel,
    planProgress,
    planEtaSeconds,
    selectedPlanSpec,
    selectedPlanComponentsById,
    archivedPlans,
    specById,
    archivedPurchaseLists,
    productionIntakeOriginLabel,
    productionAuditTrailLabel,
    productionHandoffExportLabel,
    productionHandoffContextLabel,
    recipeReviewStatusLabel,
    recipeUsageStatusLabel,
    recipeReviewCounts,
    recipeCount,
    recipeName,
    recipeFile,
    filteredRecipes
  });
  const {
    canClearProductionWorkspace,
    canArchiveCurrentIntake
  } = buildProductionWorkspaceActionState({
    hasFocusedProductionSpec: Boolean(focusedProductionSpec),
    hasSelectedPlan: Boolean(selectedPlan),
    hasIntakeFile: Boolean(intakeFile),
    hasActiveDocumentName: Boolean(activeDocumentName),
    documentPhase,
    planPhase,
    hasFocusedProductionSpecId: Boolean(focusedProductionSpecId),
    hasSelectedPlanId: Boolean(selectedPlanId),
    currentIntakeRequestId,
    productionWorkspaceCleared
  });

  const {
    clearMessages,
    resetProductionWorkspaceState,
    clearProductionWorkspace
  } = buildProductionWorkspaceUiActions({
    setError,
    setNotice,
    setProductionWorkspaceCleared,
    resetIntakeDraft,
    resetDocumentProgress,
    clearFocusedProductionSpecId: () => setFocusedProductionSpecId(undefined),
    clearSelectedPlanId: () => setSelectedPlanId(undefined),
    resetPlanProgress,
    resetIntakeRequestDetail,
    resetSpecEdit,
    clearUploadInput: () => {
      if (productionUploadInputRef.current) {
        productionUploadInputRef.current.value = "";
      }
    }
  });

  const handleArchiveCurrentIntake = buildProductionIntakeArchiveAction({
    archiveIntakeRequest,
    currentIntakeRequestId,
    setSubmitting,
    clearMessages,
    resetProductionWorkspaceState,
    refreshDashboard,
    setNotice,
    setError
  });

  const handleIntakeSubmit = buildProductionTextIntakeSubmitAction({
    createAcceptedSpecFromText,
    intakeText,
    setSubmitting,
    setProductionWorkspaceCleared,
    clearMessages,
    setFocusedProductionSpecId,
    refreshDashboard,
    setNotice,
    setError
  });

  const handleOfferSubmit = buildOfferTextSubmitAction({
    createOfferFromText,
    offerText,
    setSubmitting,
    clearMessages,
    setSelectedDraftId,
    refreshDashboard,
    setNotice,
    setError
  });

  const {
    submitSelectedDocument: handleIntakeDocumentSubmit,
    processIncomingProductionFile
  } = buildProductionDocumentSubmitActions({
    createAcceptedSpecFromDocument,
    intakeFile,
    intakeChannel,
    setSubmitting,
    setProductionWorkspaceCleared,
    clearMessages,
    startIncomingProductionFile,
    startDocumentProgress,
    setFocusedProductionSpecId,
    completeIncomingProductionFile,
    completeDocumentProgress,
    refreshDashboard,
    setNotice,
    failIncomingProductionFile,
    failDocumentProgress,
    clearFocusedProductionSpecId: () => setFocusedProductionSpecId(undefined),
    clearSelectedPlanId: () => setSelectedPlanId(undefined),
    resetPlanProgress,
    resetIntakeRequestDetail,
    resetSpecEdit,
    setError
  });

  const handleManualSpecSubmit = buildProductionManualSpecSubmitAction({
    createAcceptedSpecFromManualForm,
    buildCurrentManualSpecInput,
    setSubmitting,
    setProductionWorkspaceCleared,
    clearMessages,
    setFocusedProductionSpecId,
    resetManualSpecDraft,
    refreshDashboard,
    setNotice,
    setError
  });

  const handleCreatePlan = buildProductionPlanSubmissionAction({
    createProductionPlan,
    editingSpecId,
    setSubmitting,
    setProductionWorkspaceCleared,
    clearMessages,
    persistCurrentSpecEdit,
    startPlanProgress,
    clearSelectedPlanId: () => setSelectedPlanId(undefined),
    setSelectedPlanId,
    refreshDashboard,
    completePlanProgress,
    failPlanProgress,
    setNotice,
    setError
  });

  const {
    loadSpecIntoEditor,
    beginSpecEdit,
    openSpecForQuestions
  } = buildProductionSpecFocusActions({
    loadSpecIntoEditorState,
    setProductionWorkspaceCleared,
    setFocusedProductionSpecId
  });

  async function persistCurrentSpecEdit(options?: { quiet?: boolean }) {
    if (!editingSpecId) {
      return undefined;
    }

    const response = await updateAcceptedSpec(editingSpecId, buildCurrentSpecUpdateInput());
    const updatedSpec = response.acceptedEventSpec;
    await completeProductionQuestionEditSuccess(
      updatedSpec,
      editingSpecId,
      {
        setProductionWorkspaceCleared,
        setFocusedProductionSpecId,
        resetSpecEdit,
        refreshDashboard,
        setNotice
      },
      options
    );
    return updatedSpec;
  }

  const handleSaveSpecEdit = buildProductionSpecSaveAction({
    editingSpecId,
    persistCurrentSpecEdit,
    setSubmitting,
    clearMessages,
    setError
  });

  useEffect(() => {
    const autoOpenState = buildProductionQuestionAutoOpenState({
      route,
      focusedProductionSpec,
      productionQuestionCount: productionQuestions.length,
      editingSpecId,
      dismissedProductionAnswerSpecId
    });

    if (autoOpenState.shouldAutoOpen && autoOpenState.specId && focusedProductionSpec) {
      loadSpecIntoEditor(focusedProductionSpec);
    }
  }, [
    dismissedProductionAnswerSpecId,
    editingSpecId,
    focusedProductionSpec,
    productionQuestions.length,
    route
  ]);

  useEffect(() => {
    if (route !== "production") {
      return;
    }

    const {
      handleWindowDragOver,
      handleWindowDrop,
      handleWindowDragLeave
    } = buildProductionWindowFileActions({
      setDragActive,
      setIntakeFile,
      processIncomingProductionFile
    });

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
    };
  }, [route]);

  const handlePromoteDraft = buildOfferDraftPromoteAction({
    promoteOfferDraft,
    setSubmitting,
    clearMessages,
    refreshDashboard,
    setNotice,
    setError
  });

  const handleSeedDemoData = buildAppSeedDemoAction({
    seedDemoData,
    setSubmitting,
    clearMessages,
    refreshDashboard,
    setNotice,
    setError
  });

  const {
    handleRecipeUpload,
    handleRecipeReview
  } = buildProductionRecipeSubmissionActions({
    uploadRecipeFile,
    reviewRecipe,
    recipeFile,
    recipeName,
    setSubmitting,
    clearMessages,
    clearRecipeUploadDraft,
    refreshDashboard,
    setNotice,
    setError
  });

  const {
    openProductionFilePicker,
    handleProductionDrop,
    handleProductionFileSelection
  } = buildProductionSourceFileUploadActions({
    uploadInputRef: productionUploadInputRef,
    setDragActive,
    setIntakeFile,
    processIncomingProductionFile
  });

  const manualSpecInput = buildProductionManualInputStateFromForm(manualSpecForm);
  const manualSpecActions = buildProductionManualInputActions({
    ...manualSpecForm,
    submitManualSpec: handleManualSpecSubmit
  });
  const productionSourceInput = buildProductionSourceInputState({
    dragActive,
    intakeFile,
    intakeChannel,
    documentPhase,
    activeDocumentName,
    documentProgress,
    documentEtaSeconds,
    intakeText,
    canClearWorkspace: canClearProductionWorkspace,
    canArchiveCurrentIntake
  });
  const productionSourceInputActions = buildProductionSourceInputActions({
    uploadInputRef: productionUploadInputRef,
    setDragActive,
    setIntakeChannel,
    setIntakeText,
    openFilePicker: openProductionFilePicker,
    clearWorkspace: clearProductionWorkspace,
    archiveCurrentIntake: handleArchiveCurrentIntake,
    handleDrop: handleProductionDrop,
    handleFileSelection: handleProductionFileSelection,
    submitDocument: handleIntakeDocumentSubmit,
    submitText: handleIntakeSubmit
  });
  const productionQuestionEditorState = buildProductionQuestionEditorState({
    editingSpecId,
    editingEventType,
    editingEventDate,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    recipes: dashboard.recipes
  });
  const productionRouteFilterState = buildProductionRouteFilterState({
    isInitialProductionLoading,
    productionPlanCount: dashboard.productionPlans.length,
    purchaseListCount: dashboard.purchaseLists.length,
    recipeCount,
    approvedRecipeCount: recipeReviewCounts.approved,
    reviewRequiredRecipeCount: recipeReviewCounts.reviewRequired,
    productionServiceStatus: serviceHealth.production.status,
    productionServiceCounts: serviceHealth.production.counts,
    search,
    setSearch
  });
  const { offerWorkbenchState } = buildAppOfferRouteState({
    submitting,
    latestSourceLabel: latestIntakeRequestSummary,
    offerText,
    setOfferText,
    submitOfferText: handleOfferSubmit,
    intakeText,
    setIntakeText,
    submitIntakeText: handleIntakeSubmit,
    intakeChannel,
    setIntakeChannel,
    intakeFile,
    setIntakeFile,
    submitIntakeDocument: handleIntakeDocumentSubmit,
    manualInput: manualSpecInput,
    manualActions: manualSpecActions,
    filteredOfferDrafts,
    activeDraft: activeOfferDraft,
    selectedDraft,
    setSelectedDraftId,
    promoteDraft: handlePromoteDraft,
    filteredSpecs,
    activeSpec: activeOfferSpec,
    completeSpecCount: offerHandoffCounts.complete,
    partialSpecCount: offerHandoffCounts.partial,
    editingSpecId,
    eventType: editingEventType,
    eventDate: editingEventDate,
    attendeeCount: editingAttendeeCount,
    serviceForm: editingServiceForm,
    menuItems: editingMenuItems,
    beginSpecEdit,
    setEventType: setEditingEventType,
    setEventDate: setEditingEventDate,
    setAttendeeCount: setEditingAttendeeCount,
    setServiceForm: setEditingServiceForm,
    setMenuItems: setEditingMenuItems,
    saveSpecEdit: handleSaveSpecEdit,
    resetSpecEdit
  });
  const { productionRouteMainLayoutState } = buildAppProductionRouteState({
    viewState: productionRouteViewState,
    submitting,
    sourceInput: productionSourceInput,
    sourceInputActions: productionSourceInputActions,
    manualInput: manualSpecInput,
    manualInputActions: manualSpecActions,
    editorState: productionQuestionEditorState,
    openSpecForQuestions,
    setEditingEventType,
    setEditingEventDate,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    updateEditingComponentState,
    beginSpecEdit,
    saveSpecEdit: handleSaveSpecEdit,
    createPlan: handleCreatePlan,
    resetSpecEdit,
    setSelectedPlanId,
    setRecipeName,
    setRecipeFile,
    uploadRecipe: handleRecipeUpload,
    reviewRecipe: handleRecipeReview
  });
  const appRouteShellState = buildAppRouteShellState({
    route,
    baseUrl,
    operatorName,
    loading,
    submitting,
    onOperatorNameChange: handleOperatorNameChange,
    onSeedDemoData: handleSeedDemoData,
    onRefreshDashboard: refreshDashboard
  });
  const appRouteContentState = buildAppRouteContentState({
    route,
    home: {
      isInitialHomeLoading,
      dashboard,
      serviceHealth,
      offerHandoffCounts,
      recipeReviewCounts,
      latestIntakeRequestSummary,
      filteredAuditEvents
    },
    offerWorkbench: offerWorkbenchState,
    productionFilter: productionRouteFilterState,
    productionMain: productionRouteMainLayoutState
  });

  return (
    <DashboardShell {...appRouteShellState.shell}>
      <RouteMasthead {...appRouteShellState.masthead} />

      <AppRouteContent {...appRouteContentState} />

      <AppFeedbackShell error={error} notice={notice} loading={loading} />
    </DashboardShell>
  );
}
