import {
  startTransition,
  type ChangeEvent,
  type DragEvent,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from "react";
import { buildProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";
import { DashboardShell } from "../components/dashboard-shell.js";
import {
  compareNewestRecordsBy,
  detectRoute,
  emptyDashboardState,
  emptyServiceHealthState,
  formatAuditEventHandoffLabel,
  formatCounts,
  formatLatestIntakeRequest,
  getBaseUrl,
  getPathname,
  getRouteSubtitle,
  getRouteTitle,
  translateHealthStatus
} from "./app-shell-state.js";
import { HomeRoute } from "./home-route.js";
import { OfferConversationalWorkbench } from "./offer-workbench.js";
import { ProductionRouteFilterPanel } from "./production-route-filter-panel.js";
import { ProductionRouteMainLayout } from "./production-route-main-layout.js";
import { RouteMasthead } from "./route-masthead.js";
import {
  buildWorkbenchSpecFacts,
  buildProductionPlanComponentMap,
  canClearProductionWorkspace as canClearProductionWorkspaceFromState,
  countClarificationAnswerStatuses,
  countPurchaseListItems,
  formatActiveProductionContextLabel,
  formatProductionObjectStatusLabel,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatProductionPlanStatusLabel,
  formatProductionReadinessLabel,
  formatStructuredProductionAnswerSummary,
  formatProductionTimingWindow,
  formatPurchaseZoneStatusLabel,
  selectArchivedProductionItems,
  selectProductionArtifactSpecIds,
  selectCurrentProductionItems,
  selectFocusedProductionSpec,
  selectProductionIntakeRequestId,
  selectProductionPlanSpec,
  selectProductionWorkbenchPlan,
  selectProductionNextStep
} from "./production-route-state.js";
import {
  archiveIntakeRequest,
  createAcceptedSpecFromDocument,
  createAcceptedSpecFromManualForm,
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionPlan,
  loadDashboardState,
  loadServiceHealth,
  persistOperatorName,
  promoteOfferDraft,
  readOperatorName,
  reviewRecipe,
  seedDemoData,
  updateAcceptedSpec,
  uploadRecipeFile,
  type DashboardState,
  type IntakeDocumentChannel,
  type RecipeReviewDecision,
  type ServiceHealthState
} from "./api.js";
import {
  buildProductionAssumptions,
  buildProductionQuestions,
  getSpecLabel
} from "./production-language.js";
import {
  extractAcceptedSpecId,
  extractProductionPlanId
} from "./production-api-response-ids.js";
import { channelForFile } from "./production-document-channel.js";
import { buildProductionRouteViewState } from "./production-route-view-state.js";
import { useProductionSpecEditor } from "./use-production-spec-editor.js";
import { useProductionDocumentProgress } from "./use-production-document-progress.js";
import { useProductionIntakeDraft } from "./use-production-intake-draft.js";
import { useProductionIntakeRequestDetail } from "./use-production-intake-request-detail.js";
import { useProductionManualSpecForm } from "./use-production-manual-spec-form.js";
import { useProductionPlanProgress } from "./use-production-plan-progress.js";

export function App() {
  const route = useMemo(() => detectRoute(getPathname()), []);
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboardState);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyServiceHealthState);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [operatorName, setOperatorName] = useState(() => readOperatorName());
  const [offerText, setOfferText] = useState(
    "Besprechung am 2026-06-25 für 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
  );
  const [recipeName, setRecipeName] = useState("");
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
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
  const {
    manualEventType,
    manualEventDate,
    manualAttendeeCount,
    manualServiceForm,
    manualMenuItems,
    manualCustomerName,
    manualVenueName,
    manualNotes,
    setManualEventType,
    setManualEventDate,
    setManualAttendeeCount,
    setManualServiceForm,
    setManualMenuItems,
    setManualCustomerName,
    setManualVenueName,
    setManualNotes,
    buildCurrentManualSpecInput,
    resetManualSpecDraft
  } = useProductionManualSpecForm();
  const deferredSearch = useDeferredValue(search);
  const productionUploadInputRef = useRef<HTMLInputElement | null>(null);

  const refreshDashboard = useEffectEvent(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const [state, health] = await Promise.all([loadDashboardState(), loadServiceHealth()]);
      startTransition(() => {
        setDashboard(state);
        setServiceHealth(health);
        setLoading(false);
      });
    } catch (refreshError) {
      setLoading(false);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Arbeitsoberfläche konnte nicht geladen werden."
      );
    }
  });

  useEffect(() => {
    void refreshDashboard();
  }, []);

  const filteredSpecs = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.acceptedSpecs;
    }
    return dashboard.acceptedSpecs.filter((spec) =>
      JSON.stringify(spec).toLowerCase().includes(query)
    );
  }, [dashboard.acceptedSpecs, deferredSearch]);

  const filteredPlans = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.productionPlans;
    }
    return dashboard.productionPlans.filter((plan) =>
      JSON.stringify(plan).toLowerCase().includes(query)
    );
  }, [dashboard.productionPlans, deferredSearch]);

  const filteredAuditEvents = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.auditEvents;
    }
    return dashboard.auditEvents.filter((entry) =>
      JSON.stringify(entry).toLowerCase().includes(query)
    );
  }, [dashboard.auditEvents, deferredSearch]);

  const filteredOfferDrafts = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.offerDrafts;
    }
    return dashboard.offerDrafts.filter((draft) =>
      JSON.stringify(draft).toLowerCase().includes(query)
    );
  }, [dashboard.offerDrafts, deferredSearch]);

  const filteredRecipes = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.recipes;
    }
    return dashboard.recipes.filter((recipe) =>
      JSON.stringify(recipe).toLowerCase().includes(query)
    );
  }, [dashboard.recipes, deferredSearch]);

  const recipeReviewCounts = useMemo(() => {
    return dashboard.recipes.reduce(
      (counts: { approved: number; reviewRequired: number; rejected: number }, recipe) => {
        const approvalState = String((recipe.source as Record<string, unknown> | undefined)?.approvalState ?? "");
        if (approvalState === "approved_internal") {
          counts.approved += 1;
        } else if (approvalState === "review_required") {
          counts.reviewRequired += 1;
        } else if (approvalState === "rejected") {
          counts.rejected += 1;
        }
        return counts;
      },
      { approved: 0, reviewRequired: 0, rejected: 0 }
    );
  }, [dashboard.recipes]);

  const recipeReviewStatusLabel =
    recipeReviewCounts.reviewRequired > 0
      ? `${recipeReviewCounts.reviewRequired} zu prüfen`
      : "keine offene Prüfung";

  const recipeUsageStatusLabel =
    recipeReviewCounts.approved > 0
      ? "Freigegebene Rezepte bleiben verwendbar"
      : "Noch keine freigegebenen Rezepte im Bestand";

  const offerHandoffCounts = useMemo(() => {
    return dashboard.acceptedSpecs.reduce(
      (counts: { complete: number; partial: number }, spec) => {
        const readiness = String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "");
        if (readiness === "complete") {
          counts.complete += 1;
        } else if (readiness === "partial") {
          counts.partial += 1;
        }
        return counts;
      },
      { complete: 0, partial: 0 }
    );
  }, [dashboard.acceptedSpecs]);

  const latestIntakeRequestSummary = useMemo(
    () => formatLatestIntakeRequest(dashboard.intakeRequests),
    [dashboard.intakeRequests]
  );
  const isInitialHomeLoading =
    route === "home" &&
    loading &&
    dashboard.intakeRequests.length === 0 &&
    dashboard.acceptedSpecs.length === 0 &&
    dashboard.offerDrafts.length === 0 &&
    dashboard.productionPlans.length === 0 &&
    dashboard.purchaseLists.length === 0 &&
    dashboard.recipes.length === 0 &&
    dashboard.auditEvents.length === 0;

  const filteredPurchaseLists = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.purchaseLists;
    }
    return dashboard.purchaseLists.filter((purchaseList) =>
      JSON.stringify(purchaseList).toLowerCase().includes(query)
    );
  }, [dashboard.purchaseLists, deferredSearch]);

  const orderedPlans = useMemo(
    () => [...filteredPlans].sort(compareNewestRecordsBy("planId")),
    [filteredPlans]
  );

  const orderedPurchaseLists = useMemo(
    () => [...filteredPurchaseLists].sort(compareNewestRecordsBy("purchaseListId")),
    [filteredPurchaseLists]
  );

  const specById = useMemo(
    () =>
      new Map(
        dashboard.acceptedSpecs.map((spec) => [String(spec.specId ?? ""), spec] as const)
      ),
    [dashboard.acceptedSpecs]
  );

  const selectedDraft = useMemo(
    () => dashboard.offerDrafts.find((draft) => String(draft.draftId) === selectedDraftId),
    [dashboard.offerDrafts, selectedDraftId]
  );

  const activeOfferDraft = selectedDraft ?? filteredOfferDrafts[0];
  const activeOfferSpec =
    filteredSpecs[filteredSpecs.length - 1] ?? dashboard.acceptedSpecs[dashboard.acceptedSpecs.length - 1];

  const productionArtifactSpecIds = useMemo(
    () => selectProductionArtifactSpecIds([...orderedPlans, ...orderedPurchaseLists]),
    [orderedPlans, orderedPurchaseLists]
  );

  const focusedProductionSpec = useMemo(
    () =>
      selectFocusedProductionSpec({
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

  const currentIntakeRequestId = useMemo(() => {
    if (route !== "production" || !focusedProductionSpec) {
      return undefined;
    }

    return selectProductionIntakeRequestId(focusedProductionSpec as Record<string, unknown>);
  }, [focusedProductionSpec, route]);

  const {
    intakeRequestDetail,
    intakeRequestDetailError,
    resetIntakeRequestDetail
  } = useProductionIntakeRequestDetail({ currentIntakeRequestId });

  const focusedProductionSpecRecord = focusedProductionSpec as Record<string, unknown> | undefined;
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

  const currentSpecPlans = useMemo(() => {
    return selectCurrentProductionItems({
      currentProductionSpecId,
      items: orderedPlans,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPlans, productionWorkspaceCleared]);

  const archivedPlans = useMemo(() => {
    return selectArchivedProductionItems({
      currentProductionSpecId,
      items: orderedPlans,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPlans, productionWorkspaceCleared]);

  const currentSpecPurchaseLists = useMemo(() => {
    return selectCurrentProductionItems({
      currentProductionSpecId,
      items: orderedPurchaseLists,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPurchaseLists, productionWorkspaceCleared]);

  const archivedPurchaseLists = useMemo(() => {
    return selectArchivedProductionItems({
      currentProductionSpecId,
      items: orderedPurchaseLists,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPurchaseLists, productionWorkspaceCleared]);

  const selectedPlan = useMemo(
    () =>
      selectProductionWorkbenchPlan({
        currentProductionSpecId,
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared,
        selectedPlanId
      }),
    [currentProductionSpecId, currentSpecPlans, orderedPlans, productionWorkspaceCleared, selectedPlanId]
  );

  const selectedPlanSpec = useMemo(
    () => selectProductionPlanSpec({ selectedPlan, specsById: specById }),
    [selectedPlan, specById]
  );

  const selectedPlanComponentsById = useMemo(
    () => buildProductionPlanComponentMap(selectedPlanSpec),
    [selectedPlanSpec]
  );

  const productionQuestions = useMemo(
    () => (focusedProductionSpec ? buildProductionQuestions(focusedProductionSpec) : []),
    [focusedProductionSpec]
  );

  const productionAssumptions = useMemo(
    () => buildProductionAssumptions(focusedProductionSpec),
    [focusedProductionSpec]
  );

  const focusedClarificationAnswers = useMemo(
    () =>
      Array.isArray(focusedProductionSpecRecord?.clarificationAnswers)
        ? focusedProductionSpecRecord.clarificationAnswers
        : [],
    [focusedProductionSpecRecord]
  );

  const productionConversationProjection = useMemo(
    () =>
      buildProductionConversationProjection({
        spec: focusedProductionSpec,
        questions: productionQuestions,
        assumptions: productionAssumptions,
        answerSummary: formatStructuredProductionAnswerSummary(focusedProductionSpec),
        clarificationAnswers: focusedClarificationAnswers as Parameters<typeof buildProductionConversationProjection>[0]["clarificationAnswers"],
        sourceInputs: intakeRequestDetail?.rawInputs,
        productionPlans: currentSpecPlans,
        purchaseLists: currentSpecPurchaseLists
      }),
    [
      currentSpecPlans,
      currentSpecPurchaseLists,
      focusedClarificationAnswers,
      focusedProductionSpec,
      intakeRequestDetail?.rawInputs,
      productionAssumptions,
      productionQuestions
    ]
  );

  const clarificationStatusCounts = useMemo(
    () => countClarificationAnswerStatuses(productionConversationProjection.messages),
    [productionConversationProjection.messages]
  );

  const workbenchSpecFacts = useMemo(
    () => buildWorkbenchSpecFacts(focusedProductionSpecRecord),
    [focusedProductionSpecRecord]
  );

  const focusedSpecReadinessLabel = formatProductionReadinessLabel(focusedProductionSpecRecord);
  const selectedPlanReadinessLabel = selectedPlan ? formatProductionReadinessLabel(selectedPlan) : undefined;
  const productionPlanStatusLabel = formatProductionPlanStatusLabel(selectedPlan);
  const productionObjectStatusLabel = formatProductionObjectStatusLabel({
    currentSpecPlanCount: currentSpecPlans.length,
    selectedPlan
  });

  const currentPurchaseListItemCount = useMemo(
    () => countPurchaseListItems(currentSpecPurchaseLists),
    [currentSpecPurchaseLists]
  );

  const purchaseZoneStatusLabel = formatPurchaseZoneStatusLabel({
    purchaseListCount: currentSpecPurchaseLists.length,
    itemCount: currentPurchaseListItemCount
  });

  const productionIntakeOriginLabel = formatProductionIntakeOriginLabel({
    intakeRequestDetail,
    currentIntakeRequestId
  });

  const productionHandoffExportLabel = formatProductionHandoffExportLabel({
    hasSelectedPlan: Boolean(selectedPlan),
    purchaseListCount: currentSpecPurchaseLists.length
  });

  const productionHandoffContextLabel = formatProductionHandoffContextLabel({
    selectedPlan,
    selectedPlanSpec,
    purchaseLists: currentSpecPurchaseLists
  });

  const latestProductionAuditEvent = filteredAuditEvents[0];
  const productionAuditTrailLabel = latestProductionAuditEvent
    ? formatAuditEventHandoffLabel(latestProductionAuditEvent)
    : "keine Audit-Ereignisse geladen";

  const productionNextStep = useMemo(
    () =>
      selectProductionNextStep({
        hasFocusedProductionSpec: Boolean(focusedProductionSpec),
        questionCount: productionQuestions.length,
        hasSelectedPlan: Boolean(selectedPlan),
        purchaseListCount: currentSpecPurchaseLists.length
      }),
    [currentSpecPurchaseLists.length, focusedProductionSpec, productionQuestions.length, selectedPlan]
  );
  const activeProductionContextLabel = formatActiveProductionContextLabel({
    focusedProductionSpecLabel: focusedProductionSpec ? getSpecLabel(focusedProductionSpec) : undefined,
    selectedPlan,
    selectedPlanSpecLabel: selectedPlanSpec ? getSpecLabel(selectedPlanSpec) : undefined,
    productionWorkspaceCleared
  });

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
    recipeCount: dashboard.recipes.length,
    recipeName,
    recipeFile,
    filteredRecipes
  });
  const canClearProductionWorkspace = canClearProductionWorkspaceFromState({
    hasFocusedProductionSpec: Boolean(focusedProductionSpec),
    hasSelectedPlan: Boolean(selectedPlan),
    hasIntakeFile: Boolean(intakeFile),
    hasActiveDocumentName: Boolean(activeDocumentName),
    documentPhase,
    planPhase,
    hasFocusedProductionSpecId: Boolean(focusedProductionSpecId),
    hasSelectedPlanId: Boolean(selectedPlanId)
  });
  const canArchiveCurrentIntake = Boolean(currentIntakeRequestId) && !productionWorkspaceCleared;

  function clearMessages() {
    setError(undefined);
    setNotice(undefined);
  }

  function resetProductionWorkspaceState() {
    setProductionWorkspaceCleared(true);
    resetIntakeDraft();
    resetDocumentProgress();
    setFocusedProductionSpecId(undefined);
    setSelectedPlanId(undefined);
    resetPlanProgress();
    resetIntakeRequestDetail();
    resetSpecEdit(false);
    if (productionUploadInputRef.current) {
      productionUploadInputRef.current.value = "";
    }
  }

  function clearProductionWorkspace() {
    resetProductionWorkspaceState();
    clearMessages();
    setNotice("Aktueller Upload wurde verworfen. Rückfragen und Ergebnisse wurden geleert.");
  }

  async function handleArchiveCurrentIntake() {
    if (!currentIntakeRequestId) {
      setError("Kein verknüpfter Intake-Kontext zum Archivieren vorhanden.");
      return;
    }

    const archivedRequestId = currentIntakeRequestId;
    setSubmitting(true);
    clearMessages();
    try {
      await archiveIntakeRequest(archivedRequestId, "wrong_upload");
      resetProductionWorkspaceState();
      await refreshDashboard();
      setNotice(
        `Fehlupload ${archivedRequestId} wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen.`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Fehlupload konnte nicht archiviert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIntakeSubmit() {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromText(intakeText);
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      await refreshDashboard();
      setNotice("Freitext wurde in eine operative Spezifikation überführt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erfassungstext konnte nicht normalisiert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOfferSubmit() {
    setSubmitting(true);
    clearMessages();
    try {
      const response = await createOfferFromText(offerText);
      const createdDraftId = typeof response.draftId === "string" ? response.draftId : undefined;
      if (createdDraftId) {
        setSelectedDraftId(createdDraftId);
      }
      await refreshDashboard();
      setNotice("Angebotsentwurf wurde erstellt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Angebotsentwurf konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIntakeDocumentSubmit() {
    if (!intakeFile) {
      setError("Bitte wähle zuerst ein Dokument aus.");
      return;
    }

    await processIncomingProductionFile(intakeFile, intakeChannel);
  }

  async function processIncomingProductionFile(file: File, channel: IntakeDocumentChannel) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    startIncomingProductionFile(file, channel);
    startDocumentProgress(file);
    setNotice(`Dokument ${file.name} wird analysiert...`);

    try {
      const response = await createAcceptedSpecFromDocument(file, channel);
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      completeIncomingProductionFile();
      completeDocumentProgress();
      await refreshDashboard();
      setNotice(`Dokument ${file.name} wurde übernommen und analysiert.`);
    } catch (submitError) {
      failIncomingProductionFile(file);
      failDocumentProgress();
      setError(
        submitError instanceof Error ? submitError.message : "Dokument konnte nicht normalisiert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSpecSubmit() {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromManualForm(buildCurrentManualSpecInput());
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      resetManualSpecDraft();
      await refreshDashboard();
      setNotice("Manuelle Spezifikation wurde angelegt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Manuelle Spezifikation konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePlan(spec: Record<string, unknown>) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      let specForPlanning = spec;
      const focusedSpecId = String(spec.specId ?? "");

      if (editingSpecId && editingSpecId === focusedSpecId) {
        setNotice("Antworten werden übernommen...");
        const updatedSpec = await persistCurrentSpecEdit({ quiet: true });
        if (updatedSpec) {
          specForPlanning = updatedSpec;
        }
      }

      const specLabel = getSpecLabel(specForPlanning);
      startPlanProgress(specForPlanning, specLabel);
      setSelectedPlanId(undefined);
      setNotice("Rezeptsuche, Produktionsplanung und Einkaufsberechnung laufen...");
      const response = await createProductionPlan(specForPlanning);
      const planId = extractProductionPlanId(response);
      if (planId) {
        setSelectedPlanId(planId);
      }
      await refreshDashboard();
      completePlanProgress();
      setNotice("Produktionsplan wurde erzeugt.");
    } catch (submitError) {
      failPlanProgress();
      setError(
        submitError instanceof Error ? submitError.message : "Produktionsplan konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function loadSpecIntoEditor(spec: Record<string, unknown>) {
    const specId = loadSpecIntoEditorState(spec);
    setProductionWorkspaceCleared(false);
    setFocusedProductionSpecId(specId);
  }

  function beginSpecEdit(spec: Record<string, unknown>) {
    loadSpecIntoEditor(spec);
  }

  async function persistCurrentSpecEdit(options?: { quiet?: boolean }) {
    if (!editingSpecId) {
      return undefined;
    }

    const response = await updateAcceptedSpec(editingSpecId, buildCurrentSpecUpdateInput());
    const updatedSpec = response.acceptedEventSpec;
    const updatedSpecId = String(updatedSpec.specId ?? editingSpecId);
    setProductionWorkspaceCleared(false);
    setFocusedProductionSpecId(updatedSpecId);
    resetSpecEdit(false);
    await refreshDashboard();
    if (!options?.quiet) {
      setNotice("Spezifikation wurde gespeichert.");
    }
    return updatedSpec;
  }

  async function handleSaveSpecEdit() {
    if (!editingSpecId) {
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await persistCurrentSpecEdit();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Spezifikation konnte nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (route !== "production" || !focusedProductionSpec) {
      return;
    }

    const specId = String(focusedProductionSpec.specId ?? "");
    if (!specId) {
      return;
    }

    const readiness = String(
      (focusedProductionSpec.readiness as Record<string, unknown> | undefined)?.status ?? ""
    );
    const shouldAutoOpen = productionQuestions.length > 0 || readiness !== "complete";

    if (
      shouldAutoOpen &&
      editingSpecId !== specId &&
      dismissedProductionAnswerSpecId !== specId
    ) {
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

    const handleWindowDragOver = (event: globalThis.DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }
      event.preventDefault();
      setDragActive(true);
    };

    const handleWindowDrop = (event: globalThis.DragEvent) => {
      if (!event.dataTransfer?.files?.length) {
        return;
      }
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files[0];
      setIntakeFile(file);
      void processIncomingProductionFile(file, channelForFile(file));
    };

    const handleWindowDragLeave = (event: globalThis.DragEvent) => {
      if (event.relatedTarget === null) {
        setDragActive(false);
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
    };
  }, [route]);

  async function handlePromoteDraft(draftId: string, variantId?: string) {
    setSubmitting(true);
    clearMessages();
    try {
      await promoteOfferDraft(draftId, variantId);
      await refreshDashboard();
      setNotice("Angebotsvariante wurde als operative Spezifikation übernommen.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Angebotsvariante konnte nicht übernommen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecipeUpload(target: "offer" | "production") {
    if (!recipeFile) {
      setError("Bitte wähle zuerst eine Rezeptdatei aus.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await uploadRecipeFile(target, recipeFile, recipeName);
      setRecipeFile(null);
      setRecipeName("");
      await refreshDashboard();
      setNotice("Rezeptdatei wurde in die gemeinsame Bibliothek übernommen.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Rezept konnte nicht hochgeladen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSeedDemoData() {
    setSubmitting(true);
    clearMessages();
    try {
      await seedDemoData();
      await refreshDashboard();
      setNotice("Demo-Daten wurden geladen.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Demo-Daten konnten nicht geladen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecipeReview(
    target: "offer" | "production",
    recipeId: string,
    decision: RecipeReviewDecision
  ) {
    setSubmitting(true);
    clearMessages();
    try {
      await reviewRecipe(target, recipeId, decision);
      await refreshDashboard();
      setNotice("Rezeptprüfung wurde gespeichert.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Rezeptprüfung konnte nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOperatorNameChange(value: string) {
    const persisted = persistOperatorName(value);
    setOperatorName(persisted);
  }

  function handleProductionDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    setIntakeFile(file);
    void processIncomingProductionFile(file, channelForFile(file));
  }

  function handleProductionFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      return;
    }
    setDragActive(false);
    setIntakeFile(nextFile);
    void processIncomingProductionFile(nextFile, channelForFile(nextFile));
    event.target.value = "";
  }

  function openProductionFilePicker() {
    productionUploadInputRef.current?.click();
  }

  return (
    <DashboardShell
      title={getRouteTitle(route)}
      subtitle={getRouteSubtitle(route)}
      hideKicker={route !== "home"}
      className={
        route === "production"
          ? "app-shell--production-route"
          : route === "offer"
            ? "app-shell--offer-route"
            : undefined
      }
    >
      <RouteMasthead
        route={route}
        baseUrl={baseUrl}
        operatorName={operatorName}
        loading={loading}
        submitting={submitting}
        onOperatorNameChange={handleOperatorNameChange}
        onSeedDemoData={handleSeedDemoData}
        onRefreshDashboard={refreshDashboard}
      />

      {route === "home" ? (
        <HomeRoute
          isInitialHomeLoading={isInitialHomeLoading}
          dashboard={dashboard}
          serviceHealth={serviceHealth}
          offerHandoffCounts={offerHandoffCounts}
          recipeReviewCounts={recipeReviewCounts}
          latestIntakeRequestSummary={latestIntakeRequestSummary}
          filteredAuditEvents={filteredAuditEvents}
        />
      ) : null}

      {route === "production" ? (
        <ProductionRouteFilterPanel
          productionPlanCount={dashboard.productionPlans.length}
          purchaseListCount={dashboard.purchaseLists.length}
          recipeCount={dashboard.recipes.length}
          approvedRecipeCount={recipeReviewCounts.approved}
          reviewRequiredRecipeCount={recipeReviewCounts.reviewRequired}
          productionServiceStatusLabel={translateHealthStatus(serviceHealth.production.status)}
          productionServiceCountsLabel={formatCounts(serviceHealth.production.counts)}
          search={search}
          setSearch={setSearch}
        />
      ) : null}

      {error || notice ? (
        <div className="toast-stack" aria-live="polite">
          {error ? <p className="error-banner">{error}</p> : null}
          {notice ? <p className="notice-banner">{notice}</p> : null}
        </div>
      ) : null}

      {route === "offer" ? (
        <OfferConversationalWorkbench
          submitting={submitting}
          latestSourceLabel={latestIntakeRequestSummary}
          offerText={offerText}
          setOfferText={setOfferText}
          submitOfferText={handleOfferSubmit}
          intakeText={intakeText}
          setIntakeText={setIntakeText}
          submitIntakeText={handleIntakeSubmit}
          intakeChannel={intakeChannel}
          setIntakeChannel={setIntakeChannel}
          intakeFile={intakeFile}
          setIntakeFile={setIntakeFile}
          submitIntakeDocument={handleIntakeDocumentSubmit}
          manualInput={{
            eventType: manualEventType,
            eventDate: manualEventDate,
            attendeeCount: manualAttendeeCount,
            serviceForm: manualServiceForm,
            menuItems: manualMenuItems,
            customerName: manualCustomerName,
            venueName: manualVenueName,
            notes: manualNotes
          }}
          manualActions={{
            setEventType: setManualEventType,
            setEventDate: setManualEventDate,
            setAttendeeCount: setManualAttendeeCount,
            setServiceForm: setManualServiceForm,
            setMenuItems: setManualMenuItems,
            setCustomerName: setManualCustomerName,
            setVenueName: setManualVenueName,
            setNotes: setManualNotes,
            submitManualSpec: handleManualSpecSubmit
          }}
          filteredOfferDrafts={filteredOfferDrafts}
          activeDraft={activeOfferDraft}
          selectedDraft={selectedDraft}
          setSelectedDraftId={setSelectedDraftId}
          promoteDraft={handlePromoteDraft}
          filteredSpecs={filteredSpecs}
          activeSpec={activeOfferSpec}
          completeSpecCount={offerHandoffCounts.complete}
          partialSpecCount={offerHandoffCounts.partial}
          specEdit={{
            editingSpecId,
            eventType: editingEventType,
            eventDate: editingEventDate,
            attendeeCount: editingAttendeeCount,
            serviceForm: editingServiceForm,
            menuItems: editingMenuItems
          }}
          specEditActions={{
            beginSpecEdit,
            setEventType: setEditingEventType,
            setEventDate: setEditingEventDate,
            setAttendeeCount: setEditingAttendeeCount,
            setServiceForm: setEditingServiceForm,
            setMenuItems: setEditingMenuItems,
            saveSpecEdit: handleSaveSpecEdit,
            resetSpecEdit
          }}
        />
      ) : null}
      {route === "production" ? (
        <ProductionRouteMainLayout
          {...productionRouteViewState}
          submitting={submitting}
          sourceInput={{
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
          }}
          sourceInputActions={{
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
          }}
          manualInput={{
            eventType: manualEventType,
            eventDate: manualEventDate,
            attendeeCount: manualAttendeeCount,
            serviceForm: manualServiceForm,
            menuItems: manualMenuItems,
            customerName: manualCustomerName,
            venueName: manualVenueName,
            notes: manualNotes
          }}
          manualInputActions={{
            setEventType: setManualEventType,
            setEventDate: setManualEventDate,
            setAttendeeCount: setManualAttendeeCount,
            setServiceForm: setManualServiceForm,
            setMenuItems: setManualMenuItems,
            setCustomerName: setManualCustomerName,
            setVenueName: setManualVenueName,
            setNotes: setManualNotes,
            submitManualSpec: handleManualSpecSubmit
          }}
          questionActions={{
            openSpecForQuestions: (specId) => {
              setProductionWorkspaceCleared(false);
              setFocusedProductionSpecId(specId);
            }
          }}
          editorState={{
            editingSpecId,
            editingEventType,
            editingEventDate,
            editingAttendeeCount,
            editingServiceForm,
            editingMenuItems,
            editingComponentStates,
            hasFocusedSpecEditChanges,
            recipes: dashboard.recipes
          }}
          editorActions={{
            setEditingEventType,
            setEditingEventDate,
            setEditingAttendeeCount,
            setEditingServiceForm,
            setEditingMenuItems,
            updateEditingComponentState,
            beginSpecEdit,
            saveSpecEdit: handleSaveSpecEdit,
            createPlan: handleCreatePlan,
            resetSpecEdit
          }}
          objectPanelActions={{ setSelectedPlanId }}
          recipeActions={{
            setRecipeName,
            setRecipeFile,
            uploadRecipe: handleRecipeUpload,
            reviewRecipe: handleRecipeReview
          }}
        />
      ) : null}

      <footer className="footer-note">
        {loading
          ? "Aktuelle Plattformdaten werden geladen..."
          : "Aktuelle Daten aus Erfassung, Angebot und Produktion wurden geladen."}
      </footer>
    </DashboardShell>
  );
}
