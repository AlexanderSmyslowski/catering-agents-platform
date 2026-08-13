import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  detectRoute,
  getPathname,
  type AppRoute
} from "./app-shell-state.js";
import { AppFeedbackShell } from "./app-feedback-shell.js";
import { buildAppRouteShellState } from "./app-route-shell-state.js";
import { buildAppDashboardRouteState } from "./app-dashboard-route-state.js";
import { AppRouteContent } from "./app-route-content.js";
import { HomePortalApp } from "./home-portal-app.js";
import { OfferProductApp } from "./offer-product-app.js";
import { ProductionProductApp } from "./production-product-app.js";
import { buildAppRouteContentState } from "./app-route-content-state.js";
import {
  archiveIntakeRequest,
  createAcceptedSpecFromDocument,
  createAcceptedSpecFromManualForm,
  createAcceptedSpecFromText,
  createOfferCase,
  createOfferDraftFromRequest,
  createOfferFromText,
  createProductionCase,
  createProductionCaseFromHandoff,
  createProductionDraftFromAcceptedEventSpec,
  createProductionDraftFromDocument,
  decideOfferDraft,
  createProductionHandoff,
  createProductionDraftFromHandoff,
  reviewRecipe,
  prepareProductionDraft,
  updateAcceptedSpec,
  uploadRecipeFile,
  uploadSourceDocument
} from "./api.js";
import type {
  AcceptedEventSpec,
  AuditEntry,
  OfferDraft,
  ProductionPlan,
  PurchaseList,
  Recipe
} from "@catering/shared-core";
import type { IntakeRequestDetail } from "./api.js";
import { buildProductionConversationState } from "./production-conversation-state.js";
import { buildProductionArtifactSelectionAppBoundary } from "./production-artifact-selection-app-boundary.js";
import { buildProductionFocusState } from "./production-focus-state.js";
import { buildProductionIntakeActionsAppBoundary } from "./production-intake-actions-app-boundary.js";
import type { StagedProductionDocument } from "./production-document-submit-action.js";
import { buildMiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { extractAcceptedSpecId } from "./production-api-response-ids.js";
import { buildAppProductionRouteAppBoundary } from "./app-production-route-app-boundary.js";
import { buildAppOfferRouteAppBoundary } from "./app-offer-route-app-boundary.js";
import { buildProductionRouteViewAppBoundary } from "./production-route-view-app-boundary.js";
import { formatArchiveCurrentIntakeContextLabel } from "./production-source-input-state.js";
import { buildProductionRecipeControls } from "./production-recipe-controls.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";
import { buildProductionWorkspaceAppBoundary } from "./production-workspace-app-boundary.js";
import { buildProductionPlanningControls } from "./production-planning-controls.js";
import { useProductionSpecEditor } from "./use-production-spec-editor.js";
import { useProductionQuestionAutoOpen } from "./use-production-question-auto-open.js";
import { useProductionDocumentProgress } from "./use-production-document-progress.js";
import { useProductionIntakeDraft } from "./use-production-intake-draft.js";
import { useProductionIntakeRequestDetail } from "./use-production-intake-request-detail.js";
import { useProductionManualSpecForm } from "./use-production-manual-spec-form.js";
import { useProductionPlanProgress } from "./use-production-plan-progress.js";
import { useProductionWindowFileDrop } from "./use-production-window-file-drop.js";
import { useMiniPilotResultState } from "./use-mini-pilot-result-state.js";
import { useRecipeUploadDraft } from "./use-recipe-upload-draft.js";
import { openProductionDraftEntry } from "./production-entry-focus.js";
import { announceProductionDraftReview } from "./production-draft-review-panel.js";
import type { OfferApprovalBinding } from "./offer-approval-action.js";
import type { CaseSummary, ServiceHealthState, WorkspaceRefreshOptions } from "./api.js";
import type { OfferProductShellData } from "./offer-product-app.js";
import type { ProductionProductShellData } from "./production-product-app.js";

// Product shells render the masthead before this shared feedback and route content.
// <RouteMasthead />
// <AppFeedbackShell />
// <AppRouteContent />

const PROMOTED_PRODUCTION_SPEC_FOCUS_KEY = "catering.promotedProductionSpecFocus";

function rememberPromotedProductionSpecFocus(specId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PROMOTED_PRODUCTION_SPEC_FOCUS_KEY, specId);
}

function consumePromotedProductionSpecFocus(route: string): string | undefined {
  if (route !== "production" || typeof window === "undefined") {
    return undefined;
  }

  const specId = window.sessionStorage.getItem(PROMOTED_PRODUCTION_SPEC_FOCUS_KEY)?.trim();
  window.sessionStorage.removeItem(PROMOTED_PRODUCTION_SPEC_FOCUS_KEY);
  return specId || undefined;
}

type ProductDashboardProjection = {
  intakeRequests: IntakeRequestDetail[];
  acceptedSpecs: AcceptedEventSpec[];
  offerDrafts: OfferDraft[];
  productionPlans: ProductionPlan[];
  purchaseLists: PurchaseList[];
  recipes: Recipe[];
  auditEvents: AuditEntry[];
};

type PresentationDashboardRecord = Record<string, unknown>;

/**
 * The existing route presentation helpers still consume records because they
 * render several legacy cards. Keep that compatibility at one explicit edge;
 * product loaders and route-controller props remain domain-typed.
 */
function toPresentationRecord<T extends object>(record: T): PresentationDashboardRecord {
  return Object.fromEntries(Object.entries(record));
}

function toPresentationDashboardState(dashboard: ProductDashboardProjection) {
  return {
    intakeRequests: dashboard.intakeRequests.map(toPresentationRecord),
    acceptedSpecs: dashboard.acceptedSpecs.map(toPresentationRecord),
    offerDrafts: dashboard.offerDrafts.map(toPresentationRecord),
    productionPlans: dashboard.productionPlans.map(toPresentationRecord),
    purchaseLists: dashboard.purchaseLists.map(toPresentationRecord),
    recipes: dashboard.recipes.map(toPresentationRecord),
    auditEvents: dashboard.auditEvents.map(toPresentationRecord)
  };
}

type ProductWorkspaceProps = {
  route: Exclude<AppRoute, "home">;
  dashboard: ProductDashboardProjection;
  serviceHealth: ServiceHealthState;
  loading: boolean;
  loaderError?: string;
  refreshDashboard: (options?: WorkspaceRefreshOptions) => Promise<void>;
  activeOfferCaseId?: string;
  activeOfferDraftId?: string;
  setActiveOfferCaseId: (caseId: string | undefined) => void;
  activeProductionCaseId?: string;
  boundProductionCaseSpecId?: string;
  setActiveProductionCaseId: (caseId: string | undefined) => void;
  activeProductionSpecId?: string;
  setActiveProductionSpecId: (specId: string | undefined) => void;
  availableCases: CaseSummary[];
};

function projectOfferWorkspace(product: OfferProductShellData): ProductDashboardProjection {
  if (!product.data.activeCase) {
    return {
      intakeRequests: [],
      acceptedSpecs: [],
      offerDrafts: [],
      productionPlans: [],
      purchaseLists: [],
      recipes: [],
      auditEvents: []
    };
  }

  return {
    intakeRequests: product.intakeRequests,
    acceptedSpecs: product.acceptedSpecs,
    offerDrafts: product.data.currentDraft ? [product.data.currentDraft] : [],
    productionPlans: [],
    purchaseLists: [],
    recipes: [],
    auditEvents: []
  };
}

function projectProductionWorkspace(product: ProductionProductShellData): ProductDashboardProjection {
  if (!product.data.activeCase && product.acceptedSpecs.length === 0) {
    return {
      intakeRequests: [],
      acceptedSpecs: [],
      offerDrafts: [],
      productionPlans: [],
      purchaseLists: [],
      recipes: [],
      auditEvents: []
    };
  }

  return {
    intakeRequests: product.intakeRequests,
    acceptedSpecs: product.acceptedSpecs,
    offerDrafts: [],
    productionPlans: product.data.currentPlan ? [product.data.currentPlan] : [],
    purchaseLists: product.data.currentPurchaseList ? [product.data.currentPurchaseList] : [],
    recipes: product.data.referencedRecipes,
    auditEvents: product.auditEvents
  };
}

function ProductWorkspaceView({
  route,
  dashboard,
  serviceHealth,
  loading,
  loaderError,
  refreshDashboard,
  activeOfferCaseId,
  activeOfferDraftId,
  setActiveOfferCaseId,
  activeProductionCaseId,
  boundProductionCaseSpecId,
  setActiveProductionCaseId,
  setActiveProductionSpecId,
  availableCases
}: ProductWorkspaceProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [offerText, setOfferText] = useState("");
  const stagedOfferTextRequestRef = useRef<{ text: string; requestId: string } | undefined>(undefined);
  const [activeProductionCaseSpecId, setActiveProductionCaseSpecId] = useState<string>();
  const {
    miniPilotRawResult,
    setMiniPilotRawResult,
    miniPilotStorageHintLabel
  } = useMiniPilotResultState();
  const {
    recipeName,
    setRecipeName,
    recipeFile,
    setRecipeFile,
    clearRecipeUploadDraft
  } = useRecipeUploadDraft();
  const [search, setSearch] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [offerApprovalBinding, setOfferApprovalBinding] = useState<OfferApprovalBinding>();
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [initialProductionWorkspace] = useState(() => {
    const focusedSpecId = consumePromotedProductionSpecFocus(route);
    return {
      focusedSpecId,
      cleared: route === "production" && !focusedSpecId
    };
  });
  const [focusedProductionSpecId, setFocusedProductionSpecId] = useState<string | undefined>(
    initialProductionWorkspace.focusedSpecId
  );
  const [productionWorkspaceCleared, setProductionWorkspaceCleared] = useState(
    initialProductionWorkspace.cleared
  );

  const setProductionSpecFocus = (specId: string | undefined) => {
    setFocusedProductionSpecId(specId);
    if (route === "production") {
      setActiveProductionSpecId(specId);
    }
  };

  useEffect(() => {
    if (route !== "production" || !activeProductionCaseId) {
      return;
    }

    const caseSpecId = boundProductionCaseSpecId?.trim();
    setProductionSpecFocus(caseSpecId || undefined);
    setProductionWorkspaceCleared(!caseSpecId);
  }, [activeProductionCaseId, boundProductionCaseSpecId, route]);

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
  const deferredSearch = useDeferredValue(search);
  const presentationDashboard = useMemo(
    () => toPresentationDashboardState(dashboard),
    [dashboard]
  );
  const miniPilotReportState = useMemo(() => buildMiniPilotCheckReportState(miniPilotRawResult), [miniPilotRawResult]);
  const productionUploadInputRef = useRef<HTMLInputElement | null>(null);
  const stagedProductionDocumentRef = useRef<StagedProductionDocument | undefined>(undefined);

  const {
    filteredOfferDrafts,
    filteredSpecs,
    filteredAuditEvents,
    filteredRecipes,
    orderedPlans,
    orderedPurchaseLists,
    specById,
    productionArtifactSpecIds,
    recipeReviewCounts,
    recipeReviewStatusLabel,
    recipeUsageStatusLabel,
    recipeCount,
    offerHandoffCounts,
    latestIntakeRequestSummary,
    isInitialHomeLoading,
    isInitialProductionLoading,
    selectedDraft,
    activeOfferDraft,
    activeOfferSpec
  } = useMemo(
    () =>
      buildAppDashboardRouteState({
        dashboard: presentationDashboard,
        route,
        loading,
        searchText: deferredSearch,
        selectedDraftId
      }),
    [
      dashboard,
      deferredSearch,
      loading,
      presentationDashboard,
      route,
      selectedDraftId
    ]
  );

  useEffect(() => {
    if (route !== "offer") {
      return;
    }

    setSelectedDraftId(activeOfferDraftId);
  }, [activeOfferCaseId, activeOfferDraftId, route]);

  useEffect(() => {
    setOfferApprovalBinding(undefined);
  }, [activeOfferCaseId]);

  const {
    focusedProductionSpec,
    focusedProductionSpecRecord,
    currentIntakeRequestId
  } = useMemo(
    () =>
      buildProductionFocusState({
        acceptedSpecs: presentationDashboard.acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId,
        productionArtifactSpecIds,
        productionWorkspaceCleared,
        route,
        searchText: deferredSearch
      }),
    [
      presentationDashboard.acceptedSpecs,
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
    editingEventSchedule,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    setEditingEventType,
    setEditingEventDate,
    setEditingEventSchedule,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    loadSpecIntoEditor: loadSpecIntoEditorState,
    resetSpecEdit,
    updateEditingComponentState,
    buildCurrentSpecUpdateInput
  } = useProductionSpecEditor({ focusedProductionSpec: focusedProductionSpecRecord });

  const {
    currentProductionSpecId,
    currentSpecPlans,
    archivedPlans,
    currentSpecPurchaseLists,
    archivedPurchaseLists,
    selectedPlan,
    selectedPlanSpec,
    selectedPlanComponentsById
  } = useMemo(
    () =>
      buildProductionArtifactSelectionAppBoundary({
        focusedProductionSpecId: String(focusedProductionSpec?.specId ?? ""),
        orderedPlans,
        orderedPurchaseLists,
        productionWorkspaceCleared,
        selectedPlanId,
        specById
      }),
    [
      focusedProductionSpec?.specId,
      orderedPlans,
      orderedPurchaseLists,
      productionWorkspaceCleared,
      selectedPlanId,
      specById
    ]
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
    productionStatusSummary,
    productionRouteViewState
  } = buildProductionRouteViewAppBoundary({
    isInitialProductionLoading,
    productionQuestions,
    currentSpecPurchaseLists,
    currentSpecPlans,
    filteredAuditEvents,
    currentIntakeRequestId,
    focusedProductionSpec,
    selectedPlan,
    selectedPlanSpec,
    intakeRequestDetail,
    productionWorkspaceCleared,
    clarificationStatusCounts,
    productionAssumptions,
    productionConversationProjection,
    workbenchSpecFacts,
    intakeRequestDetailError,
    filteredSpecs,
    documentPhase,
    planPhase,
    planningSpecLabel,
    planProgress,
    planEtaSeconds,
    selectedPlanComponentsById,
    archivedPlans,
    specById,
    archivedPurchaseLists,
    recipeReviewStatusLabel,
    recipeUsageStatusLabel,
    recipeReviewCounts,
    recipeCount,
    recipeName,
    recipeFile,
    filteredRecipes
  });
  const {
    productionWorkspaceResetCallbacks,
    productionWorkspaceControls
  } = buildProductionWorkspaceAppBoundary({
    hasFocusedProductionSpec: Boolean(focusedProductionSpec),
    hasSelectedPlan: Boolean(selectedPlan),
    hasIntakeFile: Boolean(intakeFile),
    hasActiveDocumentName: Boolean(activeDocumentName),
    documentPhase,
    planPhase,
    hasFocusedProductionSpecId: Boolean(focusedProductionSpecId),
    hasSelectedPlanId: Boolean(selectedPlanId),
    currentIntakeRequestId,
    productionWorkspaceCleared,
    archiveIntakeRequest,
    setSubmitting,
    refreshDashboard,
    setError,
    setNotice,
    setProductionWorkspaceCleared,
    resetIntakeDraft,
    resetDocumentProgress,
    setFocusedProductionSpecId: setProductionSpecFocus,
    setSelectedPlanId,
    resetPlanProgress,
    resetIntakeRequestDetail,
    resetSpecEdit,
    clearActiveProductionCaseId: () => {
      setActiveProductionCaseId(undefined);
      setActiveProductionCaseSpecId(undefined);
      setProductionSpecFocus(undefined);
      stagedProductionDocumentRef.current = undefined;
    },
    uploadInputRef: productionUploadInputRef
  });
  const {
    canClearProductionWorkspace,
    canArchiveCurrentIntake,
    clearMessages,
    resetProductionWorkspaceState,
    clearProductionWorkspace,
    handleArchiveCurrentIntake
  } = productionWorkspaceControls;

  const {
    handleIntakeSubmit,
    submitSelectedDocument: handleIntakeDocumentSubmit,
    submitSelectedIntakeDocument: handleOfferIntakeDocumentSubmit,
    processIncomingProductionFile,
    manualSpecInput,
    manualSpecActions
  } = buildProductionIntakeActionsAppBoundary({
    createAcceptedSpecFromText,
    intakeText,
    createAcceptedSpecFromDocument,
    uploadSourceDocument,
    createProductionCase,
    createProductionDraftFromDocument,
    activeProductionCaseId,
    setActiveProductionCaseId,
    getStagedProductionDocument: () => stagedProductionDocumentRef.current,
    setStagedProductionDocument: (stage) => {
      stagedProductionDocumentRef.current = stage;
    },
    clearStagedProductionDocument: () => {
      stagedProductionDocumentRef.current = undefined;
    },
    createOfferCase,
    createOfferDraftFromRequest,
    activeOfferCaseId,
    setActiveOfferCaseId,
    setSelectedDraftId,
    intakeFile,
    intakeChannel,
    startIncomingProductionFile,
    startDocumentProgress,
    completeIncomingProductionFile,
    completeDocumentProgress,
    failIncomingProductionFile,
    failDocumentProgress,
    clearFocusedProductionSpecId: productionWorkspaceResetCallbacks.clearFocusedProductionSpecId,
    clearSelectedPlanId: productionWorkspaceResetCallbacks.clearSelectedPlanId,
    resetPlanProgress: productionWorkspaceResetCallbacks.resetPlanProgress,
    resetIntakeRequestDetail: productionWorkspaceResetCallbacks.resetIntakeRequestDetail,
    resetSpecEdit: productionWorkspaceResetCallbacks.resetSpecEdit,
    createAcceptedSpecFromManualForm,
    buildCurrentManualSpecInput: manualSpecForm.buildCurrentManualSpecInput,
    resetManualSpecDraft: manualSpecForm.resetManualSpecDraft,
    manualSpecForm,
    setSubmitting,
    setProductionWorkspaceCleared,
    clearMessages,
    setFocusedProductionSpecId: setProductionSpecFocus,
    refreshDashboard,
    setNotice,
    setError
  });

  const {
    persistCurrentSpecEdit,
    loadSpecIntoEditor,
    beginSpecEdit,
    openSpecForQuestions,
    handleCreatePlan,
    handleSaveSpecEdit
  } = buildProductionPlanningControls({
    editingSpecId,
    updateAcceptedSpec,
    buildCurrentSpecUpdateInput,
    loadSpecIntoEditorState,
    createProductionDraftFromAcceptedEventSpec,
    createProductionCase,
    activeProductionCaseId,
    activeProductionCaseSpecId,
    setActiveProductionCaseId,
    setActiveProductionCaseSpecId,
    prepareProductionDraft,
    setSubmitting,
    setProductionWorkspaceCleared,
    setFocusedProductionSpecId: setProductionSpecFocus,
    resetSpecEdit,
    refreshDashboard,
    clearMessages,
    startPlanProgress,
    clearSelectedPlanId: productionWorkspaceResetCallbacks.clearSelectedPlanId,
    completePlanProgress,
    failPlanProgress,
    setNotice,
    setError,
    showProductionDraftReview: announceProductionDraftReview
  });

  useProductionQuestionAutoOpen({
    route,
    focusedProductionSpec,
    productionQuestionCount: productionQuestions.length,
    editingSpecId,
    dismissedProductionAnswerSpecId,
    loadSpecIntoEditor
  });

  useProductionWindowFileDrop({
    route,
    setDragActive,
    setIntakeFile,
    resetDocumentProgress,
    clearMessages,
    setError,
    processIncomingProductionFile
  });

  const productionRecipeControls = buildProductionRecipeControls({
    uploadRecipeFile,
    reviewRecipe,
    recipeFile,
    recipeName,
    setRecipeName,
    setRecipeFile,
    setSubmitting,
    clearMessages,
    clearRecipeUploadDraft,
    refreshDashboard,
    setNotice,
    setError
  });

  const focusPromotedProductionSpec = (specId: string) => {
    rememberPromotedProductionSpecFocus(specId);
    setProductionWorkspaceCleared(false);
    if (activeProductionCaseSpecId !== specId) {
      setActiveProductionCaseId(undefined);
      setActiveProductionCaseSpecId(undefined);
    }
    setProductionSpecFocus(specId);
  };

  const refreshAfterProductionDraftDecision = async (appliedSpecId?: string) => {
    if (appliedSpecId) {
      setProductionWorkspaceCleared(false);
      setActiveProductionCaseSpecId(appliedSpecId);
      setProductionSpecFocus(appliedSpecId);
    }
    await refreshDashboard();
  };

  const {
    productionRouteFilterState,
    productionRouteMainLayoutState
  } = buildAppProductionRouteAppBoundary({
    activeProductionCaseId,
    viewState: productionRouteViewState,
    submitting,
    dragActive,
    intakeFile,
    intakeChannel,
    documentPhase,
    activeDocumentName,
    documentProgress,
    documentEtaSeconds,
    intakeText,
    canClearWorkspace: canClearProductionWorkspace,
    canArchiveCurrentIntake,
    clearWorkspaceContextLabel: productionStatusSummary.activeProductionContextLabel,
    archiveCurrentIntakeContextLabel: formatArchiveCurrentIntakeContextLabel({
      currentIntakeRequestId
    }),
    uploadInputRef: productionUploadInputRef,
    setDragActive,
    setIntakeChannel,
    setIntakeText,
    setIntakeFile,
    resetDocumentProgress,
    clearMessages,
    setError,
    processIncomingProductionFile,
    clearWorkspace: clearProductionWorkspace,
    archiveCurrentIntake: handleArchiveCurrentIntake,
    submitDocument: handleIntakeDocumentSubmit,
    submitText: handleIntakeSubmit,
    editingSpecId,
    editingEventType,
    editingEventDate,
    editingEventSchedule,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    recipes: presentationDashboard.recipes,
    isInitialProductionLoading,
    productionPlanCount: presentationDashboard.productionPlans.length,
    purchaseListCount: presentationDashboard.purchaseLists.length,
    recipeCount,
    approvedRecipeCount: recipeReviewCounts.approved,
    reviewRequiredRecipeCount: recipeReviewCounts.reviewRequired,
    productionServiceStatus: serviceHealth.production.status,
    productionServiceCounts: serviceHealth.production.counts,
    filteredSpecs,
    search,
    setSearch,
    manualInput: manualSpecInput,
    manualInputActions: manualSpecActions,
    openSpecForQuestions,
    refreshAfterDraftDecision: refreshAfterProductionDraftDecision,
    setEditingEventType,
    setEditingEventDate,
    setEditingEventSchedule,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    updateEditingComponentState,
    beginSpecEdit,
    saveSpecEdit: handleSaveSpecEdit,
    createPlan: handleCreatePlan,
    resetSpecEdit,
    setSelectedPlanId,
    recipeActions: productionRecipeControls,
    miniPilotRawResult,
    setMiniPilotRawResult,
    miniPilotReportState,
    miniPilotStorageHintLabel
  });
  const { offerWorkbenchState } = buildAppOfferRouteAppBoundary({
    createOfferCase,
    createOfferFromText,
    getOrCreateOfferRequestId: (text) => {
      const staged = stagedOfferTextRequestRef.current;
      if (staged?.text === text) return staged.requestId;
      const requestId = `request-ui-${globalThis.crypto.randomUUID()}`;
      stagedOfferTextRequestRef.current = { text, requestId };
      return requestId;
    },
    completeOfferRequestId: (requestId) => {
      if (stagedOfferTextRequestRef.current?.requestId === requestId) {
        stagedOfferTextRequestRef.current = undefined;
      }
    },
    activeOfferCaseId,
    setActiveOfferCaseId,
    decideOfferDraft,
    createProductionHandoff,
    createProductionCaseFromHandoff,
    createProductionDraftFromHandoff,
    setActiveProductionCaseId,
    clearActiveOfferCaseId: () => setActiveOfferCaseId(undefined),
    submitting,
    setSubmitting,
    clearMessages,
    refreshDashboard,
    setNotice,
    setError,
    setApprovalBinding: setOfferApprovalBinding,
    openProductionEntry: openProductionDraftEntry,
    latestSourceLabel: latestIntakeRequestSummary,
    offerText,
    setOfferText,
    intakeText,
    setIntakeText,
    submitIntakeText: handleIntakeSubmit,
    intakeChannel,
    setIntakeChannel,
    intakeFile,
    setIntakeFile,
    submitIntakeDocument: handleOfferIntakeDocumentSubmit,
    manualInput: manualSpecInput,
    manualActions: manualSpecActions,
    filteredOfferDrafts,
    activeDraft: activeOfferDraft,
    selectedDraft,
    approvalBinding: offerApprovalBinding,
    setSelectedDraftId,
    filteredSpecs,
    activeSpec: activeOfferSpec,
    completeSpecCount: offerHandoffCounts.complete,
    partialSpecCount: offerHandoffCounts.partial,
    miniPilotRawResult,
    setMiniPilotRawResult,
    miniPilotReportState,
    miniPilotStorageHintLabel,
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
  const appRouteContentState = buildAppRouteContentState({
    route,
    home: {
      isInitialHomeLoading,
      dashboard: presentationDashboard,
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

  const routeContent = (
    <>
      <AppFeedbackShell error={loaderError ?? error} notice={notice} loading={loading} route={route} />

      {availableCases.length > 0 ? (
        <details
          className={`panel secondary-workspace ${route === "offer" ? "offer-history-details" : "production-filter-details"}`}
        >
          <summary>Frühere {route === "offer" ? "Angebots" : "Produktions"}aufträge öffnen · {availableCases.length} {availableCases.length === 1 ? "Auftrag" : "Aufträge"}</summary>
          <ul className="quiet-list">
            {availableCases.map((currentCase) => (
              <li key={currentCase.caseId}>
                <button
                  className="quiet-list__button"
                  type="button"
                  onClick={() => {
                    if (route === "offer") {
                      setActiveOfferCaseId(currentCase.caseId);
                    } else {
                      setActiveProductionCaseId(currentCase.caseId);
                    }
                  }}
                >
                  <strong>{currentCase.displayName}</strong>
                  <span>{currentCase.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <AppRouteContent {...appRouteContentState} />
    </>
  );

  return routeContent;
}

type ProductRouteControllerProps = {
  route: Exclude<AppRoute, "home">;
  shell: Parameters<typeof OfferProductApp>[0]["shell"];
  masthead: Parameters<typeof OfferProductApp>[0]["masthead"];
};

/** Own the active case reference above each product shell so loaders can never
 * fall back to a global first record when the operator changes workspaces. */
function ProductRouteController({ route, shell, masthead }: ProductRouteControllerProps) {
  const [activeOfferCaseId, setActiveOfferCaseId] = useState<string>();
  const [activeProductionCaseId, setActiveProductionCaseId] = useState<string>();
  const [activeProductionSpecId, setActiveProductionSpecId] = useState<string>();

  if (route === "offer") {
    return (
      <OfferProductApp
        shell={shell}
        masthead={masthead}
        activeCaseId={activeOfferCaseId}
      >
        {(product) => (
          <ProductWorkspaceView
            route="offer"
            dashboard={projectOfferWorkspace(product)}
            serviceHealth={product.serviceHealth}
            loading={product.loading}
            loaderError={product.error}
            refreshDashboard={product.refresh}
            activeOfferCaseId={activeOfferCaseId}
            activeOfferDraftId={product.data.currentDraft?.draftId}
            setActiveOfferCaseId={setActiveOfferCaseId}
            activeProductionCaseId={activeProductionCaseId}
            activeProductionSpecId={activeProductionSpecId}
            setActiveProductionSpecId={setActiveProductionSpecId}
            setActiveProductionCaseId={setActiveProductionCaseId}
            availableCases={product.data.cases}
          />
        )}
      </OfferProductApp>
    );
  }

  return (
    <ProductionProductApp
      shell={shell}
      masthead={masthead}
      activeCaseId={activeProductionCaseId}
      activeSpecId={activeProductionCaseId ? undefined : activeProductionSpecId}
    >
      {(product) => (
        <ProductWorkspaceView
          route="production"
          dashboard={projectProductionWorkspace(product)}
          serviceHealth={product.serviceHealth}
          loading={product.loading}
          loaderError={product.error}
          refreshDashboard={product.refresh}
          activeOfferCaseId={activeOfferCaseId}
          setActiveOfferCaseId={setActiveOfferCaseId}
          activeProductionCaseId={activeProductionCaseId}
          boundProductionCaseSpecId={product.data.activeCase?.sourceSpecId}
          setActiveProductionCaseId={setActiveProductionCaseId}
          activeProductionSpecId={activeProductionSpecId}
          setActiveProductionSpecId={setActiveProductionSpecId}
          availableCases={product.data.cases}
        />
      )}
    </ProductionProductApp>
  );
}

/** Resolve the three product routes before handing control to the workbench. */
export function App() {
  const route = detectRoute(getPathname());
  const routeShellState = buildAppRouteShellState({
    route,
    baseUrl: typeof window === "undefined" ? "" : window.location.origin,
    operatorName: "",
    loading: false,
    submitting: false,
    onOperatorNameChange: () => undefined,
    onSeedDemoData: async () => undefined,
    onRefreshDashboard: async () => undefined
  });

  if (route === "home") {
    return <HomePortalApp shell={routeShellState.shell} />;
  }
  return (
    <ProductRouteController
      route={route}
      shell={routeShellState.shell}
      masthead={routeShellState.masthead}
    />
  );
}
