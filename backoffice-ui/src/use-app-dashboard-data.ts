import { startTransition, useEffect, useEffectEvent, useState } from "react";
import {
  loadDashboardState,
  loadServiceHealth,
  type DashboardState,
  type ServiceHealthState
} from "./api.js";
import { refreshAppDashboardState } from "./app-dashboard-refresh.js";
import { emptyDashboardState, emptyServiceHealthState } from "./app-shell-state.js";

export type UseAppDashboardDataInput = {
  setError: (error: string | undefined) => void;
};

export function useAppDashboardData({ setError }: UseAppDashboardDataInput) {
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboardState);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyServiceHealthState);
  const [loading, setLoading] = useState(true);

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

  return {
    dashboard,
    serviceHealth,
    loading,
    refreshDashboard
  };
}
