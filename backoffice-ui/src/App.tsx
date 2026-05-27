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
import { DashboardShell } from "../components/dashboard-shell.js";
import {
  detectRoute,
  emptyDashboardState,
  emptyServiceHealthState,
  formatCounts,
  formatLatestIntakeRequest,
  getBaseUrl,
  getPathname,
  getRouteSubtitle,
  getRouteTitle,
  translateHealthStatus
} from "./app-shell-state.js";
import {
  countOfferHandoffReadiness,
  filterDashboardRecords,
  isInitialHomeDashboardLoading,
  selectActiveOfferSpec,
  selectRecordByStringId
} from "./app-dashboard-selectors.js";
import { HomeRoute } from "./home-route.js";
import {
  buildOfferSpecEditActions,
  buildOfferSpecEditState
} from "./offer-spec-edit-state.js";
import { OfferConversationalWorkbench } from "./offer-workbench.js";
import { ProductionRouteFilterPanel } from "./production-route-filter-panel.js";
import { ProductionRouteMainLayout } from "./production-route-main-layout.js";
import { RouteMasthead } from "./route-masthead.js";
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
import { getSpecLabel } from "./production-language.js";
import { buildProductionConversationState } from "./production-conversation-state.js";
import { buildProductionCurrentArtifactsState } from "./production-current-artifacts-state.js";
import { buildProductionDashboardRecordsState } from "./production-dashboard-records-state.js";
import { buildProductionFocusState } from "./production-focus-state.js";
import {
  buildProductionManualInputActions,
  buildProductionManualInputStateFromForm
} from "./production-manual-input-state.js";
import { buildProductionSelectedPlanState } from "./production-selected-plan-state.js";
import {
  extractAcceptedSpecId,
  extractProductionPlanId
} from "./production-api-response-ids.js";
import { channelForFile } from "./production-document-channel.js";
import { resetProductionStateAfterDocumentFailure } from "./production-document-failure-reset.js";
import { buildProductionQuestionEditorState } from "./production-question-editor-state.js";
import {
  buildProductionObjectsActions,
  buildProductionQuestionActions,
  buildProductionQuestionEditorActions,
  buildProductionRecipeActions
} from "./production-route-actions.js";
import { buildProductionRouteViewState } from "./production-route-view-state.js";
import {
  buildProductionSourceInputActions,
  buildProductionSourceInputState
} from "./production-source-input-state.js";
import { buildProductionStatusSummaryState } from "./production-status-summary-state.js";
import { buildProductionRecipeStatusSummaryState } from "./production-recipe-status-state.js";
import { buildProductionWorkspaceActionState } from "./production-workspace-action-state.js";
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
  const manualSpecForm = useProductionManualSpecForm();
  const {
    buildCurrentManualSpecInput,
    resetManualSpecDraft
  } = manualSpecForm;
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
      resetProductionStateAfterDocumentFailure(file, {
        failIncomingProductionFile,
        failDocumentProgress,
        setProductionWorkspaceCleared,
        clearFocusedProductionSpecId: () => setFocusedProductionSpecId(undefined),
        clearSelectedPlanId: () => setSelectedPlanId(undefined),
        resetPlanProgress,
        resetIntakeRequestDetail,
        resetSpecEdit
      });
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

  function handleOpenSpecForQuestions(specId: string) {
    setProductionWorkspaceCleared(false);
    setFocusedProductionSpecId(specId);
  }

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
  const productionQuestionActions = buildProductionQuestionActions({
    openSpecForQuestions: handleOpenSpecForQuestions
  });
  const productionQuestionEditorActions = buildProductionQuestionEditorActions({
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
  });
  const productionObjectsActions = buildProductionObjectsActions({ setSelectedPlanId });
  const productionRecipeActions = buildProductionRecipeActions({
    setRecipeName,
    setRecipeFile,
    uploadRecipe: handleRecipeUpload,
    reviewRecipe: handleRecipeReview
  });
  const offerSpecEdit = buildOfferSpecEditState({
    editingSpecId,
    eventType: editingEventType,
    eventDate: editingEventDate,
    attendeeCount: editingAttendeeCount,
    serviceForm: editingServiceForm,
    menuItems: editingMenuItems
  });
  const offerSpecEditActions = buildOfferSpecEditActions({
    beginSpecEdit,
    setEventType: setEditingEventType,
    setEventDate: setEditingEventDate,
    setAttendeeCount: setEditingAttendeeCount,
    setServiceForm: setEditingServiceForm,
    setMenuItems: setEditingMenuItems,
    saveSpecEdit: handleSaveSpecEdit,
    resetSpecEdit
  });

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
          recipeCount={recipeCount}
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
          manualInput={manualSpecInput}
          manualActions={manualSpecActions}
          filteredOfferDrafts={filteredOfferDrafts}
          activeDraft={activeOfferDraft}
          selectedDraft={selectedDraft}
          setSelectedDraftId={setSelectedDraftId}
          promoteDraft={handlePromoteDraft}
          filteredSpecs={filteredSpecs}
          activeSpec={activeOfferSpec}
          completeSpecCount={offerHandoffCounts.complete}
          partialSpecCount={offerHandoffCounts.partial}
          specEdit={offerSpecEdit}
          specEditActions={offerSpecEditActions}
        />
      ) : null}
      {route === "production" ? (
        <ProductionRouteMainLayout
          {...productionRouteViewState}
          submitting={submitting}
          sourceInput={productionSourceInput}
          sourceInputActions={productionSourceInputActions}
          manualInput={manualSpecInput}
          manualInputActions={manualSpecActions}
          questionActions={productionQuestionActions}
          editorState={productionQuestionEditorState}
          editorActions={productionQuestionEditorActions}
          objectPanelActions={productionObjectsActions}
          recipeActions={productionRecipeActions}
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
