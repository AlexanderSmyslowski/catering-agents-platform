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
import {
  buildAppRouteContentState,
  buildDashboardViewProjection,
  buildRecordView,
  buildRecordViewMap,
  buildRecordViewProjection
} from "./app-route-content-state.js";
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
  applyApprovedProductionSpec,
  decideOfferDraft,
  decideProductionDraft,
  createProductionHandoff,
  createProductionDraftFromHandoff,
  copyOfferCase,
  copyProductionCase,
  loadOfferCaseSummaries,
  loadProductionCaseSummaries,
  reviewRecipe,
  reviseProductionDraft,
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
import { openProductionDraftEntry, productionDraftIdForHandoff } from "./production-entry-focus.js";
import {
  announceProductionDraftReview,
  announceProductionDraftRefresh,
  canApproveProductionDraft,
  canRequestProductionRevision
} from "./production-draft-review-panel.js";
import { CaseHistoryPanel } from "./case-history-panel.js";
import { buildCaseHistoryState } from "./case-history-state.js";
import {
  buildCaseNextAction,
  type CaseNextAction,
  type CaseNextActionInput,
  type CaseNextDraftState
} from "./case-next-action.js";
import { CaseNextActionBar } from "./case-next-action-bar.js";
import { createCaseNextActionRunner, type CaseNextActionRunner } from "./case-next-action-runner.js";
import {
  buildOfferApprovalBinding,
  type OfferApprovalBinding
} from "./offer-approval-action.js";
import type {
  CaseSummary,
  ProductRouteDashboard,
  ProductionDraft,
  ServiceHealthState,
  WorkspaceRefreshOptions
} from "./api.js";
import type { OfferProductShellData } from "./offer-product-app.js";
import type { ProductionProductShellData } from "./production-product-app.js";
import type { OfferWorkbenchProps } from "./offer-workbench.js";

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

type ProductWorkspaceProps = {
  route: Exclude<AppRoute, "home">;
  dashboard: ProductRouteDashboard;
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
  currentOfferApprovedOfferId?: string;
  currentOfferHandoffId?: string;
  currentOfferApprovalBinding?: OfferApprovalBinding;
  currentProductionDraftId?: string;
  currentProductionDraft?: ProductionDraft;
  currentApprovedProductionSpecId?: string;
  currentProductionResultArtifactId?: string;
};

function offerDraftNextState(draft?: OfferDraft): CaseNextDraftState | undefined {
  if (!draft) {
    return undefined;
  }

  const status = draft.reviewStatus;
  if (
    status?.priceReviewStatus === "verified" &&
    status.taxReviewStatus === "verified" &&
    status.allergenReviewStatus === "verified" &&
    status.hygieneTemperatureReviewStatus === "verified" &&
    status.sourceSecured &&
    status.publishApproved
  ) {
    return "ready_for_approval";
  }

  return "pending_review";
}

export function productionDraftNextState(draft?: ProductionDraft): CaseNextDraftState | undefined {
  if (!draft) {
    return undefined;
  }

  if (draft.status !== "pending_review") {
    return undefined;
  }

  if (draft.reviewCards.some((card) => card.decision === "change_requested") && canRequestProductionRevision(draft)) {
    return "change_requested";
  }

  return canApproveProductionDraft(draft) ? "ready_for_approval" : "pending_review";
}

export function buildOfferNextAction(input: CaseNextActionInput & { draft?: OfferDraft }): CaseNextAction {
  const { draft, ...actionInput } = input;
  return buildCaseNextAction({
    ...actionInput,
    product: "offer",
    draftState: draft ? offerDraftNextState(draft) : actionInput.draftState
  });
}

export function buildProductionNextAction(
  input: Omit<CaseNextActionInput, "product" | "draftState"> & { draft?: ProductionDraft }
): CaseNextAction {
  const { draft, ...actionInput } = input;
  return buildCaseNextAction({
    ...actionInput,
    product: "production",
    draftState: productionDraftNextState(draft)
  });
}

export type ProductWorkspaceNextActionContext = {
  route: Exclude<AppRoute, "home">;
  action: CaseNextAction;
  offerWorkbenchState: Pick<OfferWorkbenchProps, "approveDraft" | "createHandoff">;
  offerApprovalBinding?: OfferApprovalBinding;
  activeOfferDraft?: OfferDraft;
  openProductionEntry?: (draftId: string) => void;
  setSelectedDraftId?: (draftId: string) => void;
  decideProductionDraft?: (draftId: string, decision: "approved" | "rejected") => Promise<unknown>;
  reviseProductionDraft?: (draftId: string) => Promise<unknown>;
  applyApprovedProductionSpec?: (specId: string) => Promise<{ eventSpec: { specId?: unknown } }>;
  refreshDashboard?: (options?: WorkspaceRefreshOptions) => Promise<void>;
  setActiveProductionSpecId?: (specId: string | undefined) => void;
  setNotice: (message: string) => void;
  focus: (selector: string) => void;
};

/** Execute the same action path used by the global bar, with persisted route
 * state and the local production review panel kept in sync. */
export async function runProductWorkspaceNextAction(
  input: ProductWorkspaceNextActionContext
): Promise<void> {
  const { action } = input;
  switch (action.kind) {
    case "add_source":
      input.focus(input.route === "offer"
        ? '[aria-label="Kundenanfrage als Text"]'
        : ".production-column--input textarea");
      return;
    case "review_draft":
      if (input.route === "offer") {
        input.setSelectedDraftId?.(action.targetId);
        input.focus(".offer-calm-summary");
      } else {
        announceProductionDraftReview(action.targetId);
        input.focus('[aria-label="Produktionsentwurf-Prüfung"]');
      }
      return;
    case "approve_offer": {
      const revision = input.activeOfferDraft?.revision;
      if (input.route !== "offer" || revision === undefined) {
        throw new Error("Angebotsfreigabe ist ohne den aktiven Entwurf nicht zulässig.");
      }
      await input.offerWorkbenchState.approveDraft(action.draftId, revision, action.variantId);
      return;
    }
    case "send_handoff": {
      const binding = input.offerApprovalBinding;
      if (input.route !== "offer" || !binding || binding.approvedOfferId !== action.approvedOfferId || !input.offerWorkbenchState.createHandoff) {
        throw new Error("Produktionsübergabe ist ohne bestätigte Angebotsbindung nicht zulässig.");
      }
      await input.offerWorkbenchState.createHandoff(binding.offerDraftId, binding.offerDraftRevision, binding.approvedOfferId);
      return;
    }
    case "request_revision":
      if (input.route === "production") {
        if (!input.reviseProductionDraft || !input.refreshDashboard) {
          throw new Error("Produktionsüberarbeitung ist nicht verfügbar.");
        }
        await input.reviseProductionDraft(action.draftId);
        await input.refreshDashboard();
        announceProductionDraftRefresh();
        input.setNotice("Neuer Produktionsentwurf wurde für die angeforderte Überarbeitung erstellt.");
        input.focus('[aria-label="Produktionsentwurf-Prüfung"]');
      } else {
        input.setNotice("Der Änderungswunsch wird im aktiven Angebotsprüfpanel weiterbearbeitet.");
        input.focus(".offer-calm-summary");
      }
      return;
    case "inspect_handoff":
      input.setNotice(`Übergabe ${action.handoffId} wurde geöffnet.`);
      input.openProductionEntry?.(productionDraftIdForHandoff(action.handoffId));
      return;
    case "approve_production":
      if (input.route !== "production" || !input.decideProductionDraft || !input.refreshDashboard) {
        throw new Error("Produktionsfreigabe ist nur im Produktionsfall zulässig.");
      }
      await input.decideProductionDraft(action.draftId, "approved");
      await input.refreshDashboard();
      announceProductionDraftRefresh();
      input.setNotice("Produktionsentwurf wurde freigegeben.");
      input.focus('[aria-label="Produktionsentwurf-Prüfung"]');
      return;
    case "apply_approved":
      if (input.route !== "production" || !input.applyApprovedProductionSpec || !input.refreshDashboard) {
        throw new Error("Der Produktionsstand kann nur im Produktionsfall übernommen werden.");
      }
      const applied = await input.applyApprovedProductionSpec(action.approvedProductionSpecId);
      const appliedSpecId = typeof applied.eventSpec.specId === "string" ? applied.eventSpec.specId : undefined;
      input.setActiveProductionSpecId?.(appliedSpecId);
      await input.refreshDashboard({ focusedSpecId: appliedSpecId });
      announceProductionDraftRefresh();
      input.setNotice("Freigegebener Produktionsstand wurde als Plan und Einkauf übernommen.");
      input.focus(".production-column--objects");
      return;
    case "inspect_result":
      input.setNotice(`Produktionsresultat ${action.artifactId} ist bereits vorhanden.`);
      input.focus(".production-column--objects");
      return;
    case "complete":
      return;
  }
}

function projectOfferWorkspace(product: OfferProductShellData): ProductRouteDashboard {
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

function projectProductionWorkspace(product: ProductionProductShellData): ProductRouteDashboard {
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
  availableCases,
  currentOfferApprovedOfferId,
  currentOfferHandoffId,
  currentOfferApprovalBinding,
  currentProductionDraftId,
  currentProductionDraft,
  currentApprovedProductionSpecId,
  currentProductionResultArtifactId
}: ProductWorkspaceProps) {
  const [submitting, setSubmitting] = useState(false);
  const nextActionRunnerRef = useRef<CaseNextActionRunner | undefined>(undefined);
  if (!nextActionRunnerRef.current) {
    nextActionRunnerRef.current = createCaseNextActionRunner(setSubmitting);
  }
  const nextActionRunner = nextActionRunnerRef.current;
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
  const [historySearch, setHistorySearch] = useState("");
  const [historyItems, setHistoryItems] = useState(availableCases);
  const [historyServerFiltered, setHistoryServerFiltered] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>();
  const historyRequestVersion = useRef(0);
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [offerApprovalBinding, setOfferApprovalBinding] = useState<OfferApprovalBinding | undefined>(currentOfferApprovalBinding);
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

  useEffect(() => {
    setOfferApprovalBinding(currentOfferApprovalBinding);
  }, [
    currentOfferApprovalBinding?.approvedOfferId,
    currentOfferApprovalBinding?.handoffId,
    currentOfferApprovalBinding?.offerDraftId,
    currentOfferApprovalBinding?.offerDraftRevision,
    currentOfferApprovalBinding?.productionDraftId
  ]);

  useEffect(() => {
    if (!historySearch.trim()) {
      setHistoryItems(availableCases);
      setHistoryServerFiltered(false);
    }
  }, [availableCases, historySearch]);

  const historyState = useMemo(
    () => buildCaseHistoryState(
      historyItems,
      historySearch,
      route === "offer" ? activeOfferCaseId : activeProductionCaseId,
      { serverFiltered: historyServerFiltered, serverOrdered: true }
    ),
    [activeOfferCaseId, activeProductionCaseId, historyItems, historySearch, historyServerFiltered, route]
  );

  const handleHistorySearchChange = async (value: string) => {
    setHistorySearch(value);
    const version = ++historyRequestVersion.current;
    if (!value.trim()) {
      setHistoryItems(availableCases);
      setHistoryServerFiltered(false);
      setHistoryError(undefined);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(undefined);
    try {
      const items = route === "offer"
        ? await loadOfferCaseSummaries(value)
        : await loadProductionCaseSummaries(value);
      if (version === historyRequestVersion.current) {
        setHistoryItems(items);
        setHistoryServerFiltered(true);
      }
    } catch (cause) {
      if (version === historyRequestVersion.current) {
        setHistoryError(cause instanceof Error ? cause.message : "Aufträge konnten nicht gesucht werden.");
        setHistoryItems([]);
        setHistoryServerFiltered(true);
      }
    } finally {
      if (version === historyRequestVersion.current) {
        setHistoryLoading(false);
      }
    }
  };

  const handleHistoryCopy = async (caseId: string) => {
    const copied = route === "offer"
      ? await copyOfferCase(caseId)
      : await copyProductionCase(caseId);
    if (route === "offer") {
      setActiveOfferCaseId(copied.case.caseId);
    } else {
      setActiveProductionCaseId(copied.case.caseId);
    }
    setHistorySearch("");
    setHistoryServerFiltered(false);
    setHistoryItems([copied.case, ...historyItems.filter((item) => item.caseId !== copied.case.caseId)]);
    await refreshDashboard();
  };

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
  const viewDashboard = useMemo(() => buildDashboardViewProjection(dashboard), [dashboard]);
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
        dashboard,
        route,
        loading,
        searchText: deferredSearch,
        selectedDraftId
      }),
    [
      dashboard,
      deferredSearch,
      loading,
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
    setOfferApprovalBinding(currentOfferApprovalBinding);
  }, [
    activeOfferCaseId,
    currentOfferApprovalBinding?.approvedOfferId,
    currentOfferApprovalBinding?.handoffId,
    currentOfferApprovalBinding?.offerDraftId,
    currentOfferApprovalBinding?.offerDraftRevision,
    currentOfferApprovalBinding?.productionDraftId
  ]);

  useEffect(() => {
    if (route !== "offer") {
      setSelectedVariantId(undefined);
      return;
    }
    const variants = Array.isArray(activeOfferDraft?.variantSet) ? activeOfferDraft.variantSet : [];
    setSelectedVariantId((current) => current && variants.some((variant) => variant.variantId === current)
      ? current
      : undefined);
  }, [activeOfferDraft?.draftId, activeOfferDraft?.revision, route]);

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
  } = useProductionSpecEditor({
    focusedProductionSpec: focusedProductionSpecRecord
      ? buildRecordView(focusedProductionSpecRecord)
      : undefined
  });

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
        orderedPlans: buildRecordViewProjection(orderedPlans),
        orderedPurchaseLists: buildRecordViewProjection(orderedPurchaseLists),
        productionWorkspaceCleared,
        selectedPlanId,
        specById: buildRecordViewMap(specById)
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
       focusedProductionSpec: focusedProductionSpec ? buildRecordView(focusedProductionSpec) : undefined,
       focusedProductionSpecRecord: focusedProductionSpecRecord
         ? buildRecordView(focusedProductionSpecRecord)
         : undefined,
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
    filteredAuditEvents: buildRecordViewProjection(filteredAuditEvents),
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
    filteredSpecs: buildRecordViewProjection(filteredSpecs),
    documentPhase,
    planPhase,
    planningSpecLabel,
    planProgress,
    planEtaSeconds,
    selectedPlanComponentsById,
    archivedPlans,
    specById: buildRecordViewMap(specById),
    archivedPurchaseLists,
    recipeReviewStatusLabel,
    recipeUsageStatusLabel,
    recipeReviewCounts,
    recipeCount,
    recipeName,
    recipeFile,
    filteredRecipes: buildRecordViewProjection(filteredRecipes)
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
      recipes: buildRecordViewProjection(dashboard.recipes),
    isInitialProductionLoading,
    productionPlanCount: dashboard.productionPlans.length,
    purchaseListCount: dashboard.purchaseLists.length,
    recipeCount,
    approvedRecipeCount: recipeReviewCounts.approved,
    reviewRequiredRecipeCount: recipeReviewCounts.reviewRequired,
    productionServiceStatus: serviceHealth.production.status,
    productionServiceCounts: serviceHealth.production.counts,
     filteredSpecs: buildRecordViewProjection(filteredSpecs),
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
     filteredOfferDrafts: buildRecordViewProjection(filteredOfferDrafts),
     activeDraft: activeOfferDraft ? buildRecordView(activeOfferDraft) : undefined,
     selectedDraft: selectedDraft ? buildRecordView(selectedDraft) : undefined,
    approvalBinding: offerApprovalBinding,
    setSelectedDraftId,
    selectedVariantId,
    setSelectedVariantId,
      filteredSpecs: buildRecordViewProjection(filteredSpecs),
      activeSpec: activeOfferSpec ? buildRecordView(activeOfferSpec) : undefined,
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
      dashboard: viewDashboard,
      serviceHealth,
      offerHandoffCounts,
      recipeReviewCounts,
      latestIntakeRequestSummary,
      filteredAuditEvents: buildRecordViewProjection(filteredAuditEvents)
    },
    offerWorkbench: offerWorkbenchState,
    productionFilter: productionRouteFilterState,
    productionMain: productionRouteMainLayoutState
  });

  const activeCaseStatus = availableCases.find((candidate) =>
    candidate.caseId === (route === "offer" ? activeOfferCaseId : activeProductionCaseId)
  )?.status ?? "open";
  const nextActionInput: CaseNextActionInput = {
    product: route,
    caseStatus: activeCaseStatus,
    hasSource: dashboard.intakeRequests.length > 0 || dashboard.acceptedSpecs.length > 0,
    currentDraftId: route === "offer" ? activeOfferDraft?.draftId : currentProductionDraftId,
    selectedVariantId: route === "offer" ? selectedVariantId : undefined,
    draftState: route === "offer" ? offerDraftNextState(activeOfferDraft) : undefined,
    approvedOfferId: route === "offer"
      ? currentOfferApprovedOfferId ?? offerApprovalBinding?.approvedOfferId
      : undefined,
    handoffId: route === "offer"
      ? currentOfferHandoffId ?? offerApprovalBinding?.handoffId
      : undefined,
    approvedProductionSpecId: route === "production" ? currentApprovedProductionSpecId : undefined,
    resultArtifactId: route === "production" ? currentProductionResultArtifactId : undefined
  };
  const nextAction = useMemo(() => {
    if (route === "production") {
      return buildProductionNextAction({
        caseStatus: nextActionInput.caseStatus,
        hasSource: nextActionInput.hasSource,
        currentDraftId: nextActionInput.currentDraftId,
        approvedProductionSpecId: nextActionInput.approvedProductionSpecId,
        resultArtifactId: nextActionInput.resultArtifactId,
        draft: currentProductionDraft
      });
    }

    return buildOfferNextAction({ ...nextActionInput, draft: activeOfferDraft });
  }, [
    currentProductionDraft,
    nextActionInput.approvedOfferId,
    nextActionInput.approvedProductionSpecId,
    nextActionInput.caseStatus,
    nextActionInput.currentDraftId,
    nextActionInput.selectedVariantId,
    nextActionInput.draftState,
    nextActionInput.handoffId,
    nextActionInput.hasSource,
    nextActionInput.product,
    nextActionInput.resultArtifactId,
    route
  ]);

  async function runNextAction(action: CaseNextAction): Promise<void> {
    const focus = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      element?.focus({ preventScroll: true });
      element?.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "auto" });
    };

    const mutating = action.kind === "approve_offer" ||
      action.kind === "send_handoff" ||
      action.kind === "approve_production" ||
      action.kind === "apply_approved" ||
      (action.kind === "request_revision" && route === "production");

    await nextActionRunner.run(mutating, async () => {
      await runProductWorkspaceNextAction({
        route,
        action,
        offerWorkbenchState,
        offerApprovalBinding,
        activeOfferDraft,
        openProductionEntry: openProductionDraftEntry,
        setSelectedDraftId,
        decideProductionDraft,
        reviseProductionDraft,
        applyApprovedProductionSpec,
        refreshDashboard,
        setActiveProductionSpecId,
        setNotice,
        focus
      });
    });
  }

  const routeContent = (
    <>
      <AppFeedbackShell error={loaderError ?? error} notice={notice} loading={loading} route={route} />

      <CaseHistoryPanel
        product={route === "offer" ? "offer" : "production"}
        items={historyState.items}
        activeCaseId={historyState.activeCaseId}
        search={historySearch}
        onSearchChange={(value) => void handleHistorySearchChange(value)}
        onOpen={(caseId) => {
          if (route === "offer") {
            setActiveOfferCaseId(caseId);
          } else {
            setActiveProductionCaseId(caseId);
          }
        }}
        onCopy={handleHistoryCopy}
        loading={historyLoading}
        error={historyError}
      />

      <CaseNextActionBar
        action={nextAction}
        onAction={(action) => void runNextAction(action).catch((cause) => setError(cause instanceof Error ? cause.message : "Nächster Schritt konnte nicht ausgeführt werden."))}
        busy={submitting}
        error={error}
      />

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
            currentOfferApprovedOfferId={product.data.approvedOffer?.approvedOfferId}
            currentOfferHandoffId={product.data.handoff?.handoffId}
            currentOfferApprovalBinding={buildOfferApprovalBinding(product.data.approvedOffer, product.data.handoff)}
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
          currentProductionDraftId={product.data.currentDraft?.draftId}
          currentProductionDraft={product.data.currentDraft}
          currentApprovedProductionSpecId={product.data.approvedProductionSpec?.approvedProductionSpecId}
          currentProductionResultArtifactId={product.data.currentPlan?.planId ?? product.data.currentPurchaseList?.purchaseListId}
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
