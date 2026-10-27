import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadOfferProductData,
  type OfferWorkspaceState,
  type WorkspaceRefreshOptions,
  type ServiceHealthState
} from "./api.js";
import { emptyServiceHealthState } from "./app-shell-state.js";

const emptyState: OfferWorkspaceState = { cases: [], activeEvents: [], activeSources: [] };

export const OFFER_RECOVERY_STORAGE_ERROR = "Der gespeicherte Angebotsstand kann nicht sicher geprüft werden. Bitte Browserdaten für diese Seite zulassen und den Auftrag erneut öffnen.";
export const OFFER_SAVED_DRAFT_SUPERSEDED_ERROR = "Die gespeicherte Fassung ist nicht mehr aktuell. Der Auftrag wurde danach verändert. Öffne und prüfe die aktuelle Fassung: Deine gespeicherten Änderungen sind darin möglicherweise nicht enthalten.";
const pendingDraftPrefix = "catering.pendingOfferDraft.v1:";

function pendingDraftKey(userId: string, caseId: string): string {
  if (!userId.trim() || !caseId.trim() || userId.length > 512 || caseId.length > 512) {
    throw new Error(OFFER_RECOVERY_STORAGE_ERROR);
  }
  return pendingDraftPrefix + JSON.stringify([userId, caseId]);
}

function pendingDraftStorage(userId: string, caseId: string) {
  try {
    const storage = window.sessionStorage;
    const key = pendingDraftKey(userId, caseId);
    const stored = storage.getItem(key);
    if (stored !== null && (!stored.trim() || stored.length > 512)) throw new Error("invalid pending draft");
    // A read-only or full store cannot protect a confirmed save across reloads.
    const probeKey = key + ":probe:" + Date.now() + ":" + Math.random();
    storage.setItem(probeKey, "ok");
    if (storage.getItem(probeKey) !== "ok") throw new Error("storage write failed");
    storage.removeItem(probeKey);
    if (storage.getItem(probeKey) !== null) throw new Error("storage cleanup failed");
    return { storage, key, stored: stored ?? undefined };
  } catch {
    throw new Error(OFFER_RECOVERY_STORAGE_ERROR);
  }
}

function hasVerifiedNewerDraft(
  productData: Awaited<ReturnType<typeof loadOfferProductData>>,
  caseId: string,
  savedDraftId: string
): boolean {
  const { activeCase, activeEvents, currentDraft } = productData.workspace;
  if (!activeCase || activeCase.caseId !== caseId || productData.workspace.caseEventsInScope !== true || !currentDraft ||
      currentDraft.businessId !== activeCase.businessId ||
      productData.offerDrafts.length !== 1 ||
      productData.offerDrafts[0]?.draftId !== currentDraft.draftId ||
      productData.offerDrafts[0]?.revision !== currentDraft.revision) return false;

  // A later event establishes ordering, not that the later draft contains this edit.
  if (activeEvents.some(event => event.caseId !== caseId || event.businessId !== activeCase.businessId ||
      !Number.isSafeInteger(event.sequence) || event.sequence < 1) ||
      new Set(activeEvents.map(event => event.sequence)).size !== activeEvents.length) return false;
  const createdEvents = activeEvents.filter(event => event.kind === "draft_created");
  if (createdEvents.some(event =>
      event.revisionRef?.artifactType !== "OfferDraft" || !event.artifactId ||
      event.artifactId !== event.revisionRef.artifactId) ||
      new Set(createdEvents.map(event => event.artifactId)).size !== createdEvents.length) return false;
  const references = activeEvents.filter(event => event.revisionRef?.artifactType === "OfferDraft");
  if (references.some(event => !event.revisionRef?.artifactId ||
      !Number.isSafeInteger(event.revisionRef.revision) || event.revisionRef.revision < 1)) return false;
  const created = (draftId: string) => createdEvents.filter(event => event.artifactId === draftId);
  const saved = created(savedDraftId);
  const current = created(currentDraft.draftId);
  if (saved.length !== 1 || current.length !== 1 || saved[0]!.sequence >= current[0]!.sequence ||
      current[0]!.revisionRef?.revision !== currentDraft.revision) return false;
  const latest = references.reduce((previous, event) => event.sequence > previous.sequence ? event : previous);
  return latest.revisionRef?.artifactId === currentDraft.draftId && latest.revisionRef.revision === currentDraft.revision;
}

export function useOfferWorkspaceData(activeCaseId?: string, userId?: string) {
  const [data, setData] = useState<OfferWorkspaceState>(emptyState);
  const [intakeRequests, setIntakeRequests] = useState<Awaited<ReturnType<typeof loadOfferProductData>>["intakeRequests"]>([]);
  const [acceptedSpecs, setAcceptedSpecs] = useState<Awaited<ReturnType<typeof loadOfferProductData>>["acceptedSpecs"]>([]);
  const [offerDrafts, setOfferDrafts] = useState<Awaited<ReturnType<typeof loadOfferProductData>>["offerDrafts"]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyServiceHealthState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const refreshVersion = useRef(0);
  // Keep a confirmed save bound to its case until that saved version is actually visible.
  const pendingSavedDrafts = useRef(new Map<string, string>());
  const requestedCaseId = useRef(activeCaseId);
  const requestedUserId = useRef(userId);
  const caseContext = useRef<{ caseId: string | undefined; userId: string | undefined }>({ caseId: activeCaseId, userId });
  const loadedContext = useRef<typeof caseContext.current | undefined>(undefined);
  const [settledContext, setSettledContext] = useState<typeof caseContext.current>();
  if (caseContext.current.caseId !== activeCaseId || caseContext.current.userId !== userId) {
    caseContext.current = { caseId: activeCaseId, userId };
  }
  requestedCaseId.current = activeCaseId;
  requestedUserId.current = userId;

  const refresh = useCallback(async (options?: WorkspaceRefreshOptions) => {
    // A text submission can create its case after capturing this callback.
    // Its explicit case must still be active; stale loads never change the view.
    const requestedActiveCaseId = options?.focusedOfferCaseId ?? activeCaseId;
    if (requestedCaseId.current !== requestedActiveCaseId || requestedUserId.current !== userId) {
      if (options?.requiredOfferDraftId) throw new Error("Die gespeicherte Angebotsfassung konnte nicht geladen werden. Bitte den Auftrag erneut öffnen.");
      return;
    }
    const requestedContext = caseContext.current;
    const pendingKey = JSON.stringify([userId ?? null, requestedActiveCaseId ?? null]);
    if (requestedActiveCaseId && options?.requiredOfferDraftId) {
      pendingSavedDrafts.current.set(pendingKey, options.requiredOfferDraftId);
    }
    const version = ++refreshVersion.current;
    setLoading(true);
    try {
      const persisted = userId && requestedActiveCaseId ? pendingDraftStorage(userId, requestedActiveCaseId) : undefined;
      let requiredDraftId = pendingSavedDrafts.current.get(pendingKey);
      if (requiredDraftId && persisted?.stored && requiredDraftId !== persisted.stored) {
        throw new Error(OFFER_RECOVERY_STORAGE_ERROR);
      }
      requiredDraftId ??= persisted?.stored;
      if (requiredDraftId) {
        pendingSavedDrafts.current.set(pendingKey, requiredDraftId);
        if (persisted && persisted.stored !== requiredDraftId) {
          try {
            persisted.storage.setItem(persisted.key, requiredDraftId);
            if (persisted.storage.getItem(persisted.key) !== requiredDraftId) throw new Error("storage write failed");
          } catch {
            throw new Error(OFFER_RECOVERY_STORAGE_ERROR);
          }
        }
      }
      const productData = await loadOfferProductData(requestedActiveCaseId);
      if (
        version !== refreshVersion.current ||
        requestedCaseId.current !== requestedActiveCaseId ||
        requestedContext !== caseContext.current
      ) {
        if (options?.requiredOfferDraftId) throw new Error("Die neue Angebotsfassung wurde gespeichert, aber das Laden wurde unterbrochen. Bitte erneut laden.");
        return;
      }
      if (requiredDraftId && !productData.offerDrafts.some(draft => draft.draftId === requiredDraftId)) {
        const newerDraftVerified = requestedActiveCaseId &&
          hasVerifiedNewerDraft(productData, requestedActiveCaseId, requiredDraftId);
        if (!newerDraftVerified) {
          throw new Error("Die neue Angebotsfassung konnte noch nicht geladen werden. Bitte erneut laden.");
        }
        if (!options?.acceptNewerOfferDraft) {
          throw new Error(OFFER_SAVED_DRAFT_SUPERSEDED_ERROR);
        }
      }
      if (requestedActiveCaseId && requiredDraftId && pendingSavedDrafts.current.get(pendingKey) === requiredDraftId) {
        if (persisted) {
          try {
            if (persisted.storage.getItem(persisted.key) !== requiredDraftId) throw new Error("pending draft changed");
            persisted.storage.removeItem(persisted.key);
            if (persisted.storage.getItem(persisted.key) !== null) throw new Error("storage cleanup failed");
          } catch {
            throw new Error(OFFER_RECOVERY_STORAGE_ERROR);
          }
        }
        pendingSavedDrafts.current.delete(pendingKey);
      }
      loadedContext.current = requestedContext;
      setSettledContext(requestedContext);
      setData(productData.workspace);
      setIntakeRequests(productData.intakeRequests);
      setAcceptedSpecs(productData.acceptedSpecs);
      setOfferDrafts(productData.offerDrafts);
      setServiceHealth(productData.serviceHealth);
      setError(undefined);
    } catch (cause) {
      if (
        version !== refreshVersion.current ||
        requestedCaseId.current !== requestedActiveCaseId ||
        requestedContext !== caseContext.current
      ) {
        if (options?.requiredOfferDraftId) throw cause;
        return;
      }
      setSettledContext(requestedContext);
      setError(cause instanceof Error ? cause.message : "Angebotsdaten konnten nicht geladen werden.");
      if (options?.requiredOfferDraftId) throw cause;
    } finally {
      if (version === refreshVersion.current && requestedContext === caseContext.current) {
        setLoading(false);
      }
    }
  }, [activeCaseId, userId]);

  useEffect(() => {
    setData((current) => ({
      cases: current.cases,
      activeEvents: [],
      activeSources: []
    }));
    setIntakeRequests([]);
    setAcceptedSpecs([]);
    setOfferDrafts([]);
    loadedContext.current = undefined;
    void refresh();
  }, [activeCaseId, refresh]);

  const visibleData = loadedContext.current === caseContext.current
    ? data
    : {
        ...data,
        activeCase: undefined,
        activeEvents: [],
        activeSources: [],
        currentDraft: undefined,
        approvedOffer: undefined,
        handoff: undefined
      };

  return {
    data: visibleData,
    intakeRequests: loadedContext.current === caseContext.current ? intakeRequests : [],
    acceptedSpecs: loadedContext.current === caseContext.current ? acceptedSpecs : [],
    offerDrafts: loadedContext.current === caseContext.current ? offerDrafts : [],
    serviceHealth,
    loading: loading || settledContext !== caseContext.current,
    error: settledContext === caseContext.current ? error : undefined,
    refresh
  };
}
