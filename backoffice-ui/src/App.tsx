import {
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
import { HomePortalApp } from "./home-portal-app.js";
import { OfferRouteAccessBoundary } from "./offer-route-access-boundary.js";
import type { OfferProductApp } from "./offer-product-app.js";
import { ProductionRouteAccessBoundary } from "./production-route-access-boundary.js";
import { SessionBoundary, useCateringSession } from "./session-boundary.js";
import {
  buildRecordView,
  buildRecordViewMap,
  buildRecordViewProjection
} from "./app-route-legacy-adapter.js";
import { OfferConversationalWorkbench } from "./offer-workbench.js";
import { ProductionRouteMainLayout } from "./production-route-main-layout.js";
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
import type { ProductionSourceDetail } from "./api.js";
import { buildProductionConversationState } from "./production-conversation-state.js";
import { buildProductionArtifactSelectionAppBoundary } from "./production-artifact-selection-app-boundary.js";
import { buildProductionFocusState } from "./production-focus-state.js";
import { buildProductionIntakeActionsAppBoundary } from "./production-intake-actions-app-boundary.js";
import { canEditProductionDraftQuantities, type ProductionDraftEditContext } from "./production-spec-edit-persist-action.js";
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
import { buildProductionSnapshotSourceDetail } from "./production-snapshot-source-detail.js";
import { useProductionManualSpecForm } from "./use-production-manual-spec-form.js";
import { useProductionPlanProgress } from "./use-production-plan-progress.js";
import { useProductionWindowFileDrop } from "./use-production-window-file-drop.js";
import { useMiniPilotResultState } from "./use-mini-pilot-result-state.js";
import { useRecipeUploadDraft } from "./use-recipe-upload-draft.js";
import { openProductionDraftEntry } from "./production-entry-focus.js";
import {
  announceProductionDraftReview,
  announceProductionDraftRefresh,
  canApproveProductionDraft,
  canRequestProductionRevision
} from "./production-draft-review-panel.js";
import { CaseHistoryPanel } from "./case-history-panel.js";
import { buildCaseHistoryState, formatCaseStatus } from "./case-history-state.js";
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
// Product route content is composed directly from the typed route boundaries.

const PROMOTED_PRODUCTION_SPEC_FOCUS_KEY = "catering.promotedProductionSpecFocus";
const OFFER_CASE_FOCUS_KEY = "catering.offerCaseFocus";

// The browser entry remembers only a case reference, and only for its authenticated user.
function offerCaseFocusFromHistory(userId?: string): string | undefined {
  if (!userId || typeof window === "undefined") return undefined;
  try {
    const state: unknown = window.history.state;
    if (!state || typeof state !== "object" || Array.isArray(state)) return undefined;
    const focus: unknown = (state as Record<string, unknown>)[OFFER_CASE_FOCUS_KEY];
    if (!focus || typeof focus !== "object" || Array.isArray(focus)) return undefined;
    const { caseId, userId: savedUserId } = focus as Record<string, unknown>;
    return savedUserId === userId && typeof caseId === "string" && caseId.trim() &&
      caseId.length <= 512 ? caseId : undefined;
  } catch {
    return undefined;
  }
}

function rememberOfferCaseFocus(userId: string | undefined, caseId: string | undefined) {
  if (!userId || typeof window === "undefined") return;
  try {
    const current: unknown = window.history.state;
    if (current !== null && (typeof current !== "object" || Array.isArray(current))) return;
    const next: Record<string, unknown> = { ...(current as Record<string, unknown> | null) };
    if (caseId && caseId.trim() && caseId.length <= 512) next[OFFER_CASE_FOCUS_KEY] = { userId, caseId };
    else delete next[OFFER_CASE_FOCUS_KEY];
    window.history.replaceState(next, "");
  } catch {
    // A blocked history state must not prevent normal use of the current page.
  }
}

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

function productionCaseIdFromLocation(route: string): string | undefined {
  if (route !== "production" || typeof window === "undefined") {
    return undefined;
  }
  const caseId = new URLSearchParams(window.location.search).get("productionCaseId")?.trim();
  return caseId || undefined;
}

type ProductWorkspaceProps = {
  route: Exclude<AppRoute, "home">;
  dashboard: ProductRouteDashboard;
  serviceHealth: ServiceHealthState;
  loading: boolean;
  loaderError?: string;
  refreshDashboard: (options?: WorkspaceRefreshOptions) => Promise<void>;
  activeOfferCaseId?: string;
  loadedOfferCaseId?: string;
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
  resolveProductionCaseFromHandoff?: (handoffId: string) => Promise<{ caseId: string }>;
  currentProductionDraftId?: string;
  currentProductionDraft?: ProductionDraft;
  productionSourceDetail?: ProductionSourceDetail;
  currentApprovedProductionSpecId?: string;
  currentProductionApprovalApplied?: boolean;
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
  openProductionEntry?: (draftId: string | undefined, productionCaseId?: string) => void;
  resolveProductionCaseFromHandoff?: (handoffId: string) => Promise<{ caseId: string }>;
  isCurrentOfferContext?: () => boolean;
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
      if (
        input.route !== "offer" ||
        !input.offerApprovalBinding?.handoffId ||
        input.offerApprovalBinding.handoffId !== action.handoffId
      ) {
        throw new Error("Übergabe ist ohne bestätigte Angebotsbindung nicht zulässig.");
      }
      if (!input.resolveProductionCaseFromHandoff) {
        throw new Error("Produktionsfall der Übergabe konnte nicht aufgelöst werden.");
      }
      let productionCase: { caseId: string };
      try {
        productionCase = await input.resolveProductionCaseFromHandoff(action.handoffId);
      } catch (cause) {
        if (input.isCurrentOfferContext?.() === false) return;
        throw cause;
      }
      if (input.isCurrentOfferContext?.() === false) return;
      input.setNotice(`Übergabe ${action.handoffId} wurde geöffnet.`);
      // The original handoff draft may have been superseded or applied.
      // Reopen the verified case so its current server-projected work is shown.
      input.openProductionEntry?.(undefined, productionCase.caseId);
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
      input.setNotice("Unterlagen und offene fachliche Hinweise stehen im Ergebnisbereich.");
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
    // Recipe candidates belong to the business library; case artifacts stay bound above.
    recipes: product.recipes,
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
  loadedOfferCaseId,
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
  resolveProductionCaseFromHandoff,
  currentProductionDraftId,
  currentProductionDraft,
  productionSourceDetail,
  currentApprovedProductionSpecId,
  currentProductionApprovalApplied,
  currentProductionResultArtifactId
}: ProductWorkspaceProps) {
  const [submitting, setSubmitting] = useState(false);
  const [offerMenuEditing, setOfferMenuEditing] = useState(false);
  const offerMenuEditingRef = useRef(false);
  const offerFocusRef = useRef({ caseId: activeOfferCaseId, draftId: activeOfferDraftId });
  offerFocusRef.current = { caseId: activeOfferCaseId, draftId: activeOfferDraftId };

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
  const [historySearch, setHistorySearch] = useState("");
  const [historyItems, setHistoryItems] = useState(availableCases);
  const [historyServerFiltered, setHistoryServerFiltered] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>();
  const historyRequestVersion = useRef(0);
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [offerApprovalBinding, setOfferApprovalBinding] = useState<OfferApprovalBinding | undefined>(currentOfferApprovalBinding);
  const persistedApprovalDataPresent = Boolean(currentOfferApprovedOfferId || currentOfferHandoffId);
  const localBindingForCurrentDraft = offerApprovalBinding &&
    offerApprovalBinding.offerDraftId === activeOfferDraftId
    ? offerApprovalBinding
    : undefined;
  const effectiveOfferApprovalBinding = currentOfferApprovalBinding ??
    (persistedApprovalDataPresent ? undefined : localBindingForCurrentDraft);
  const offerActionContextKey = JSON.stringify([
    activeOfferCaseId, activeOfferDraftId, selectedDraftId,
    effectiveOfferApprovalBinding?.offerDraftRevision,
    effectiveOfferApprovalBinding?.approvedOfferId, effectiveOfferApprovalBinding?.handoffId
  ]);
  const offerActionContextRef = useRef({ key: offerActionContextKey, generation: 0 });
  if (offerActionContextRef.current.key !== offerActionContextKey) {
    offerActionContextRef.current = { key: offerActionContextKey, generation: offerActionContextRef.current.generation + 1 };
  }
  const approvalBindingState = route === "offer"
    ? currentOfferApprovalBinding
      ? "valid"
      : currentOfferApprovedOfferId || currentOfferHandoffId
        ? "invalid"
        : localBindingForCurrentDraft
          ? "valid"
          : "absent"
    : undefined;
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
    if (!canChangeHistoryCase()) return;
    const copied = route === "offer"
      ? await copyOfferCase(caseId)
      : await copyProductionCase(caseId);
    setHistoryItems(items => [copied.case, ...items.filter(item => item.caseId !== copied.case.caseId)]);
    // Copying can finish after the operator has started a new input or editor.
    if (!historySwitchGuardRef.current?.()) return;
    if (route === "offer") {
      setActiveOfferCaseId(copied.case.caseId);
    } else {
      setActiveProductionCaseId(copied.case.caseId);
    }
    setHistorySearch("");
    setHistoryServerFiltered(false);
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
  const [workspaceSearchText, setWorkspaceSearchText] = useState("");
  const workspaceFilterRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (workspaceSearchText && workspaceFilterRef.current) workspaceFilterRef.current.open = true;
  }, [workspaceSearchText]);
  const acceptedSourceFileRef = useRef<File | undefined>(undefined);
  const sourceSwitchError = "Begonnene Eingaben zuerst übernehmen oder über „Eingabefelder leeren“ verwerfen. Gespeicherte Aufträge bleiben erhalten.";
  const unavailableSourceSwitchError = "Der Auftrag ist nicht verfügbar. Bitte Text kopieren oder über „Eingabefelder leeren“ verwerfen. Ausgewählte Dateien bleiben auf deinem Gerät.";
  const loadingSourceSwitchError = "Der Auftrag wird noch geladen. Bitte warte, bevor du zu einem anderen Auftrag wechselst.";
  const offerCaseNotReady = route === "offer" && Boolean(activeOfferCaseId) && loadedOfferCaseId !== activeOfferCaseId;
  const offerCaseUnavailable = offerCaseNotReady && !loading;
  const offerCaseRefreshFailed = route === "offer" && Boolean(activeOfferCaseId) && !offerCaseNotReady && !loading && Boolean(loaderError);
  useEffect(() => {
    setError(current => {
      if (current === loadingSourceSwitchError && !loading) return undefined;
      if (current === unavailableSourceSwitchError && (loading || !offerCaseNotReady)) return undefined;
      return current;
    });
  }, [loading, offerCaseNotReady]);
  const hasSourceInputs = Boolean(offerText.trim() || intakeText.trim() || (intakeFile && intakeFile !== acceptedSourceFileRef.current) ||
    manualSpecForm.manualCustomerName.trim() || manualSpecForm.manualEventDate.trim() ||
    manualSpecForm.manualAttendeeCount.trim() || manualSpecForm.manualMenuItems.trim() ||
    manualSpecForm.manualVenueName.trim() || manualSpecForm.manualNotes.trim() ||
    manualSpecForm.manualEventType !== "conference" || manualSpecForm.manualServiceForm !== "buffet");
  function canChangeHistoryCase() {
    if (submitting) { setError("Bitte den laufenden Vorgang abwarten."); return false; }
    if (route === "offer" && offerMenuEditingRef.current) {
      setError("Bitte Angebotsbearbeitung zuerst speichern oder abbrechen."); return false;
    }
    if (hasSourceInputs) {
      setError(offerCaseUnavailable ? unavailableSourceSwitchError : offerCaseNotReady ? loadingSourceSwitchError : sourceSwitchError);
      return false;
    }
    if (intakeFile && intakeFile === acceptedSourceFileRef.current) {
      setIntakeFile(null);
      resetDocumentProgress();
      acceptedSourceFileRef.current = undefined;
    }
    return true;
  }
  const historySwitchGuardRef = useRef<(() => boolean) | undefined>(canChangeHistoryCase);
  historySwitchGuardRef.current = canChangeHistoryCase;
  useEffect(() => {
    historySwitchGuardRef.current = canChangeHistoryCase;
    return () => { historySwitchGuardRef.current = undefined; };
  }, []);
  function clearSourceInputs() {
    setOfferText("");
    stagedOfferTextRequestRef.current = undefined;
    stagedProductionDocumentRef.current = undefined;
    acceptedSourceFileRef.current = undefined;
    setIntakeText("");
    resetIntakeDraft();
    resetDocumentProgress();
    manualSpecForm.resetManualSpecDraft();
    manualSpecForm.setManualEventType("conference");
    manualSpecForm.setManualServiceForm("buffet");
    setError(undefined);
  }
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
        searchText: workspaceSearchText,
        selectedDraftId
      }),
    [
      dashboard,
      loading,
      route,
      selectedDraftId,
      workspaceSearchText
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
        searchText: workspaceSearchText
      }),
    [
      dashboard.acceptedSpecs,
      filteredSpecs,
      focusedProductionSpecId,
      productionArtifactSpecIds,
      productionWorkspaceCleared,
      route,
      workspaceSearchText
    ]
  );

  const {
    intakeRequestDetail: loadedIntakeRequestDetail,
    intakeRequestDetailError: loadedIntakeRequestDetailError,
    resetIntakeRequestDetail
  } = useProductionIntakeRequestDetail({
    // Production renders the persisted, server-projected draft snapshot. A
    // request-detail lookup here would cross the commercial Intake boundary.
    currentIntakeRequestId: route === "production" ? undefined : currentIntakeRequestId
  });
  const intakeRequestDetail = route === "production"
    ? productionSourceDetail ?? null
    : loadedIntakeRequestDetail;
  const intakeRequestDetailError = route === "production"
    ? undefined
    : loadedIntakeRequestDetailError;

  const editingProductionDraftContext = useRef<ProductionDraftEditContext | undefined>(undefined);
  const liveProductionDraftContext = useRef<ProductionDraftEditContext | undefined>(undefined);
  liveProductionDraftContext.current = activeProductionCaseId && currentProductionDraft
    ? { caseId: activeProductionCaseId, draft: currentProductionDraft }
    : undefined;
  const {
    editingSpecId,
    dismissedProductionAnswerSpecId,
    editingEventType,
    editingEventDate,
    editingEventSchedule,
    editingSpecialDietResponse,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    setEditingEventType,
    setEditingEventDate,
    setEditingEventSchedule,
    setEditingSpecialDietResponse,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    loadSpecIntoEditor: loadSpecIntoEditorSnapshot,
    resetSpecEdit,
    updateEditingComponentState,
    buildCurrentSpecUpdateInput
  } = useProductionSpecEditor({
    focusedProductionSpec: focusedProductionSpecRecord
      ? buildRecordView(focusedProductionSpecRecord)
      : undefined
  });

  function loadSpecIntoEditorState(spec: Parameters<typeof loadSpecIntoEditorSnapshot>[0]): string {
    editingProductionDraftContext.current = activeProductionCaseId && currentProductionDraft &&
      currentProductionDraft.draftArtifacts?.eventSpec?.specId === spec.specId
      ? { caseId: activeProductionCaseId, draft: structuredClone(currentProductionDraft) }
      : undefined;
    return loadSpecIntoEditorSnapshot(spec);
  }

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
    onTextAccepted: (submittedText) => setIntakeText(current => current === submittedText ? "" : current),
    onFileAccepted: (file) => { acceptedSourceFileRef.current = file; },
    createAcceptedSpecFromDocument,
    uploadSourceDocument,
    createProductionCase,
    createProductionDraftFromAcceptedEventSpec,
    createProductionDraftFromDocument,
    activeProductionCaseId,
    setActiveProductionCaseId,
    setActiveProductionCaseSpecId,
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
    productionDraftContext: editingSpecId && editingProductionDraftContext.current
      ? editingProductionDraftContext.current
      : activeProductionCaseId && currentProductionDraft
        ? { caseId: activeProductionCaseId, draft: currentProductionDraft }
        : undefined,
    getCurrentProductionDraftContext: () => liveProductionDraftContext.current,
    reviseProductionDraft,
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
    productionRouteMainLayoutState
  } = buildAppProductionRouteAppBoundary({
    canEditPurchasedQuantities: canEditProductionDraftQuantities(editingSpecId, editingProductionDraftContext.current),
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
    editingSpecialDietResponse,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    recipes: buildRecordViewProjection(dashboard.recipes),
    manualInput: manualSpecInput,
    manualInputActions: manualSpecActions,
    openSpecForQuestions,
    refreshAfterDraftDecision: refreshAfterProductionDraftDecision,
    setEditingEventType,
    setEditingEventDate,
    setEditingEventSchedule,
    setEditingSpecialDietResponse,
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
        const submittedText = stagedOfferTextRequestRef.current.text;
        setOfferText(current => current === submittedText ? "" : current);
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
    approvalBinding: effectiveOfferApprovalBinding,
    openProductionHandoff: async (handoffId) => {
      await runNextAction({ kind: "inspect_handoff", label: "Übergabe öffnen", handoffId })
        .catch((cause) => setError(formatSubmitErrorMessage(cause, "Produktionsentwurf konnte nicht geöffnet werden.")));
    },
    onMenuEditingChange: (editing) => { offerMenuEditingRef.current = editing; setOfferMenuEditing(editing); },
    onMenuSaved: async (draftId) => {
      if (offerFocusRef.current.caseId !== activeOfferCaseId || offerFocusRef.current.draftId !== activeOfferDraftId) return;
      setOfferApprovalBinding(undefined);
      setSelectedVariantId(undefined);
      await refreshDashboard({ requiredOfferDraftId: draftId });
      if (offerFocusRef.current.caseId === activeOfferCaseId) {
        setSelectedDraftId(draftId);
        setNotice("Neue Angebotsfassung gespeichert. Bitte erneut prüfen.");
      }
    },
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
  const activeCase = availableCases.find(candidate => candidate.caseId === (route === "offer" ? activeOfferCaseId : activeProductionCaseId));
  const activeCaseStatus = activeCase?.status ?? "open";
  const nextActionInput: CaseNextActionInput = {
    product: route,
    caseStatus: activeCaseStatus,
    hasSource: dashboard.intakeRequests.length > 0 || dashboard.acceptedSpecs.length > 0,
    currentDraftId: route === "offer" ? activeOfferDraft?.draftId : currentProductionDraftId,
    selectedVariantId: route === "offer" ? selectedVariantId : undefined,
    draftState: route === "offer" ? offerDraftNextState(activeOfferDraft) : undefined,
    approvedOfferId: route === "offer"
      ? effectiveOfferApprovalBinding?.approvedOfferId
      : undefined,
    handoffId: route === "offer"
      ? effectiveOfferApprovalBinding?.handoffId
      : undefined,
    approvalBindingState,
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
    nextActionInput.approvalBindingState,
    nextActionInput.hasSource,
    nextActionInput.product,
    nextActionInput.resultArtifactId,
    route
  ]);

  async function runNextAction(action: CaseNextAction): Promise<void> {
    if (route === "offer" && offerMenuEditingRef.current && (action.kind === "approve_offer" || action.kind === "send_handoff")) {
      setError("Bitte Angebotsbearbeitung zuerst speichern oder abbrechen."); return;
    }
    const focus = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      // Focusing a task inside collapsed native details must reveal it first.
      for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      element?.focus({ preventScroll: true });
      element?.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "auto" });
    };

    const mutating = action.kind === "inspect_handoff" ||
      action.kind === "approve_offer" ||
      action.kind === "send_handoff" ||
      action.kind === "approve_production" ||
      action.kind === "apply_approved" ||
      (action.kind === "request_revision" && route === "production");

    const offerActionGeneration = offerActionContextRef.current.generation;
    await nextActionRunner.run(mutating, async () => {
      await runProductWorkspaceNextAction({
        route,
        action,
        offerWorkbenchState,
        offerApprovalBinding: effectiveOfferApprovalBinding,
        activeOfferDraft,
        openProductionEntry: openProductionDraftEntry,
        resolveProductionCaseFromHandoff,
        isCurrentOfferContext: () => offerActionContextRef.current.generation === offerActionGeneration,
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

      {(route === "offer" ? activeOfferCaseId : activeProductionCaseId) ? <section className="panel current-order-header" aria-label="Geöffneter Auftrag">
        <h2>{activeCase?.displayName ?? "Auftrag geöffnet"}</h2>
        <p role="status">{offerCaseUnavailable
          ? "Der Auftrag konnte nicht geladen werden. Bitte erneut versuchen oder zur Auftragsübersicht zurückkehren."
          : offerCaseRefreshFailed ? "Auftragsdaten konnten nicht aktualisiert werden. Der angezeigte Stand kann veraltet sein."
            : offerCaseNotReady ? "Auftragsdaten werden geladen …"
              : activeCase ? formatCaseStatus(route === "offer" ? "offer" : "production", activeCase.status)
                : loaderError ? "Auftragsname nicht verfügbar. Der Auftrag bleibt geöffnet." : "Auftragsdaten werden geladen …"}</p>
        {route === "production" && activeCase?.status === "completed" ? <p className="helper-text">Plan und Einkaufsliste sind gespeichert. Offene Rezept-, Allergen- und Hygieneprüfungen bleiben vor der tatsächlichen Produktion erforderlich.</p> : null}
        {offerCaseUnavailable || offerCaseRefreshFailed ? (
          <div className="quiet-action-row">
            <button type="button" className="secondary-button" disabled={submitting || offerMenuEditing} onClick={() => {
              setError(current => current === unavailableSourceSwitchError ? undefined : current);
              void refreshDashboard().catch((cause) => setError(cause instanceof Error ? cause.message : "Auftrag konnte nicht geladen werden."));
            }}>Erneut versuchen</button>
            <button type="button" className="secondary-button" disabled={submitting || offerMenuEditing} onClick={() => {
              if (canChangeHistoryCase()) {
                setActiveOfferCaseId(undefined);
                clearMessages();
              }
            }}>Zur Auftragsübersicht</button>
          </div>
        ) : null}
      </section> : null}
      {workspaceSearchText ? <p className="workspace-filter-notice" role="status">Ansicht ist gefiltert: „{workspaceSearchText}“ <button type="button" className="secondary-button" onClick={() => setWorkspaceSearchText("")}>Filter aufheben</button></p> : null}

      {(error === sourceSwitchError || error === unavailableSourceSwitchError) && hasSourceInputs ? <p className="workspace-filter-notice"><button type="button" className="secondary-button" disabled={submitting} onClick={clearSourceInputs}>Eingabefelder leeren</button><span>Nur aktuelle Eingaben; gespeicherte Aufträge bleiben erhalten.</span></p> : null}
      <CaseHistoryPanel
        product={route === "offer" ? "offer" : "production"}
        items={historyState.items}
        activeCaseId={historyState.activeCaseId}
        search={historySearch}
        onSearchChange={(value) => void handleHistorySearchChange(value)}
        onOpen={(caseId) => {
          if (!canChangeHistoryCase()) return;
          if (route === "offer") {
            setActiveOfferCaseId(caseId);
          } else {
            setActiveProductionCaseId(caseId);
          }
        }}
        onCopy={handleHistoryCopy}
        loading={historyLoading || loading}
        error={historyError}
      />

      {offerCaseNotReady ? (error ? <p className="form-error" role="alert">{error}</p> : null) : (
        <CaseNextActionBar
          product={route}
          action={nextAction}
          onAction={(action) => void runNextAction(action).catch((cause) => setError(cause instanceof Error ? cause.message : "Nächster Schritt konnte nicht ausgeführt werden."))}
          busy={submitting}
          disabled={route === "offer" && offerMenuEditing}
          error={error}
        />
      )}

      {route === "offer" ? <OfferConversationalWorkbench {...offerWorkbenchState} submitting={submitting || offerCaseNotReady} /> : null}
      {route === "production" ? <ProductionRouteMainLayout {...productionRouteMainLayoutState}
        workbenchSummary={{
          ...productionRouteMainLayoutState.workbenchSummary,
          approvalState: currentApprovedProductionSpecId
            ? currentProductionApprovalApplied === true ? "applied" : "approved"
            : "pending"
        }}
      /> : null}
      <details className="technical-context-details workspace-filter-details" ref={workspaceFilterRef} aria-labelledby={`${route}-workspace-filter-label`}>
        <summary>Einträge auf dieser Seite filtern</summary>
        <label
          className="field-label"
          id={`${route}-workspace-filter-label`}
          htmlFor={`${route}-workspace-search`}
        >
          Aktiven Arbeitsbereich filtern
        </label>
        <input
          id={`${route}-workspace-search`}
          type="search"
          value={workspaceSearchText}
          onChange={(event) => setWorkspaceSearchText(event.target.value)}
          placeholder="Veranstaltung, Planung oder Rezept suchen"
          autoComplete="off"
        />
        <p className="helper-text">
          Filtert nur sichtbare Arbeitsbereichsdaten; die Auftragshistorie bleibt unabhängig.
        </p>
      </details>
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
  const userId = useCateringSession()?.session.user.userId;
  const [activeOfferCaseId, setActiveOfferCaseId] = useState<string | undefined>(
    () => route === "offer" ? offerCaseFocusFromHistory(userId) : undefined
  );
  useEffect(() => {
    if (route === "offer") rememberOfferCaseFocus(userId, activeOfferCaseId);
  }, [route, userId, activeOfferCaseId]);
  const [activeProductionCaseId, setActiveProductionCaseId] = useState<string | undefined>(
    () => productionCaseIdFromLocation(route)
  );
  const [activeProductionSpecId, setActiveProductionSpecId] = useState<string>();

  if (route === "offer") {
    return (
      <OfferRouteAccessBoundary
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
            loadedOfferCaseId={product.data.activeCase?.caseId}
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
            resolveProductionCaseFromHandoff={async (handoffId) =>
              (await createProductionCaseFromHandoff(handoffId)).case}
          />
        )}
      </OfferRouteAccessBoundary>
    );
  }

  return (
    <ProductionRouteAccessBoundary
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
          productionSourceDetail={buildProductionSnapshotSourceDetail(product.data)}
          currentApprovedProductionSpecId={product.data.approvedProductionSpec?.approvedProductionSpecId}
          currentProductionApprovalApplied={product.data.approvedProductionSpec?.applied}
          currentProductionResultArtifactId={product.data.currentPlan?.planId ?? product.data.currentPurchaseList?.purchaseListId}
        />
      )}
    </ProductionRouteAccessBoundary>
  );
}

/** Resolve the three product routes only after the server has authenticated the browser session. */
function AuthenticatedApp() {
  const cateringSession = useCateringSession();
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
    return (
      <HomePortalApp shell={routeShellState.shell}>
        {cateringSession ? (
          <div className="masthead-actions">
            <span aria-label="Angemeldeter Benutzer">{cateringSession.session.user.displayName}</span>
            <button className="secondary-button" type="button" onClick={cateringSession.logout}>
              Abmelden
            </button>
          </div>
        ) : null}
      </HomePortalApp>
    );
  }
  return (
    <ProductRouteController
      route={route}
      shell={routeShellState.shell}
      masthead={routeShellState.masthead}
    />
  );
}

export function App() {
  return (
    <SessionBoundary>
      <AuthenticatedApp />
    </SessionBoundary>
  );
}
