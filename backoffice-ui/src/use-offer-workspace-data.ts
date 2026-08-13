import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadOfferProductData,
  type OfferWorkspaceState,
  type ServiceHealthState
} from "./api.js";
import { emptyServiceHealthState } from "./app-shell-state.js";

const emptyState: OfferWorkspaceState = { cases: [], activeEvents: [], activeSources: [] };

export function useOfferWorkspaceData(activeCaseId?: string) {
  const [data, setData] = useState<OfferWorkspaceState>(emptyState);
  const [intakeRequests, setIntakeRequests] = useState<Awaited<ReturnType<typeof loadOfferProductData>>["intakeRequests"]>([]);
  const [acceptedSpecs, setAcceptedSpecs] = useState<Awaited<ReturnType<typeof loadOfferProductData>>["acceptedSpecs"]>([]);
  const [offerDrafts, setOfferDrafts] = useState<Awaited<ReturnType<typeof loadOfferProductData>>["offerDrafts"]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyServiceHealthState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const refreshVersion = useRef(0);
  const requestedCaseId = useRef(activeCaseId);
  const loadedCaseId = useRef<string | undefined>(undefined);
  requestedCaseId.current = activeCaseId;

  const refresh = useCallback(async () => {
    const requestedActiveCaseId = activeCaseId;
    if (requestedCaseId.current !== requestedActiveCaseId) {
      return;
    }
    const version = ++refreshVersion.current;
    setLoading(true);
    try {
      const productData = await loadOfferProductData(requestedActiveCaseId);
      if (
        version !== refreshVersion.current ||
        requestedCaseId.current !== requestedActiveCaseId
      ) {
        return;
      }
      loadedCaseId.current = requestedActiveCaseId;
      setData(productData.workspace);
      setIntakeRequests(productData.intakeRequests);
      setAcceptedSpecs(productData.acceptedSpecs);
      setOfferDrafts(productData.offerDrafts);
      setServiceHealth(productData.serviceHealth);
      setError(undefined);
    } catch (cause) {
      if (
        version !== refreshVersion.current ||
        requestedCaseId.current !== requestedActiveCaseId
      ) {
        return;
      }
      setError(cause instanceof Error ? cause.message : "Angebotsdaten konnten nicht geladen werden.");
    } finally {
      if (version === refreshVersion.current) {
        setLoading(false);
      }
    }
  }, [activeCaseId]);

  useEffect(() => {
    setData((current) => ({
      cases: current.cases,
      activeEvents: [],
      activeSources: []
    }));
    setIntakeRequests([]);
    setAcceptedSpecs([]);
    setOfferDrafts([]);
    loadedCaseId.current = undefined;
    void refresh();
  }, [activeCaseId, refresh]);

  const visibleData = loadedCaseId.current === activeCaseId
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
    intakeRequests: loadedCaseId.current === activeCaseId ? intakeRequests : [],
    acceptedSpecs: loadedCaseId.current === activeCaseId ? acceptedSpecs : [],
    offerDrafts: loadedCaseId.current === activeCaseId ? offerDrafts : [],
    serviceHealth,
    loading,
    error,
    refresh
  };
}
