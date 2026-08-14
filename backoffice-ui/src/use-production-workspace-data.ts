import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadProductionProductData,
  type WorkspaceRefreshOptions,
  type ProductionWorkspaceState,
  type ServiceHealthState
} from "./api.js";
import { emptyServiceHealthState } from "./app-shell-state.js";

const emptyState: ProductionWorkspaceState = {
  cases: [],
  activeEvents: [],
  activeSources: [],
  referencedRecipes: []
};

export function useProductionWorkspaceData(activeCaseId?: string, focusedSpecId?: string) {
  const [data, setData] = useState<ProductionWorkspaceState>(emptyState);
  const [intakeRequests, setIntakeRequests] = useState<Awaited<ReturnType<typeof loadProductionProductData>>["intakeRequests"]>([]);
  const [acceptedSpecs, setAcceptedSpecs] = useState<Awaited<ReturnType<typeof loadProductionProductData>>["acceptedSpecs"]>([]);
  const [productionPlans, setProductionPlans] = useState<Awaited<ReturnType<typeof loadProductionProductData>>["productionPlans"]>([]);
  const [purchaseLists, setPurchaseLists] = useState<Awaited<ReturnType<typeof loadProductionProductData>>["purchaseLists"]>([]);
  const [recipes, setRecipes] = useState<Awaited<ReturnType<typeof loadProductionProductData>>["recipes"]>([]);
  const [auditEvents, setAuditEvents] = useState<Awaited<ReturnType<typeof loadProductionProductData>>["auditEvents"]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyServiceHealthState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const refreshVersion = useRef(0);
  const requestedIdentity = useRef<{ activeCaseId?: string; focusedSpecId?: string }>({ activeCaseId, focusedSpecId });
  const loadedIdentity = useRef<{ activeCaseId?: string; focusedSpecId?: string } | undefined>(undefined);
  requestedIdentity.current = { activeCaseId, focusedSpecId };

  const refresh = useCallback(async (options?: WorkspaceRefreshOptions) => {
    const requestedFocusedSpecId = options?.focusedSpecId ?? focusedSpecId;
    const requestedCaseId = activeCaseId;
    if (requestedIdentity.current.activeCaseId !== requestedCaseId) {
      return;
    }
    const identity = { activeCaseId: requestedCaseId, focusedSpecId: requestedFocusedSpecId };
    const version = ++refreshVersion.current;
    setLoading(true);
    try {
      const productData = requestedFocusedSpecId === undefined
        ? await loadProductionProductData(requestedCaseId)
        : await loadProductionProductData(requestedCaseId, requestedFocusedSpecId);
      const currentIdentity = requestedIdentity.current;
      if (
        version !== refreshVersion.current ||
        currentIdentity.activeCaseId !== identity.activeCaseId ||
        currentIdentity.focusedSpecId !== identity.focusedSpecId
      ) {
        return;
      }
      loadedIdentity.current = identity;
      setData(productData.workspace);
      setIntakeRequests(productData.intakeRequests);
      setAcceptedSpecs(productData.acceptedSpecs);
      setProductionPlans(productData.productionPlans);
      setPurchaseLists(productData.purchaseLists);
      setRecipes(productData.recipes);
      setAuditEvents(productData.auditEvents);
      setServiceHealth(productData.serviceHealth);
      setError(undefined);
    } catch (cause) {
      const currentIdentity = requestedIdentity.current;
      if (
        version !== refreshVersion.current ||
        currentIdentity.activeCaseId !== identity.activeCaseId ||
        currentIdentity.focusedSpecId !== identity.focusedSpecId
      ) {
        return;
      }
      setError(cause instanceof Error ? cause.message : "Produktionsdaten konnten nicht geladen werden.");
    } finally {
      if (version === refreshVersion.current) {
        setLoading(false);
      }
    }
  }, [activeCaseId, focusedSpecId]);

  useEffect(() => {
    setData((current) => ({
      cases: current.cases,
      activeEvents: [],
      activeSources: [],
      referencedRecipes: []
    }));
    setIntakeRequests([]);
    setAcceptedSpecs([]);
    setProductionPlans([]);
    setPurchaseLists([]);
    setRecipes([]);
    setAuditEvents([]);
    loadedIdentity.current = undefined;
    void refresh();
  }, [activeCaseId, focusedSpecId, refresh]);

  const loadedForCurrentIdentity = loadedIdentity.current?.activeCaseId === activeCaseId &&
    loadedIdentity.current?.focusedSpecId === focusedSpecId;
  const visibleData = loadedForCurrentIdentity
    ? data
    : {
        ...data,
        activeCase: undefined,
        activeEvents: [],
        activeSources: [],
        currentDraft: undefined,
        approvedProductionSpec: undefined,
        currentPlan: undefined,
        currentPurchaseList: undefined,
        referencedRecipes: [],
        ...(activeCaseId ? {} : { cases: data.cases })
      };

  return {
    data: visibleData,
    intakeRequests: loadedForCurrentIdentity ? intakeRequests : [],
    acceptedSpecs: loadedForCurrentIdentity ? acceptedSpecs : [],
    productionPlans: loadedForCurrentIdentity ? productionPlans : [],
    purchaseLists: loadedForCurrentIdentity ? purchaseLists : [],
    recipes: loadedForCurrentIdentity ? recipes : [],
    auditEvents: loadedForCurrentIdentity ? auditEvents : [],
    serviceHealth: loadedForCurrentIdentity ? serviceHealth : emptyServiceHealthState,
    loading,
    error,
    refresh
  };
}
