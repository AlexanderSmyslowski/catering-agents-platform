import type {
  DashboardState,
  ServiceHealthState
} from "./api.js";

export type AppDashboardRefreshInput = {
  loadDashboardState: () => Promise<DashboardState>;
  loadServiceHealth: () => Promise<ServiceHealthState>;
  setDashboard: (state: DashboardState) => void;
  setServiceHealth: (state: ServiceHealthState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | undefined) => void;
  transition: (callback: () => void) => void;
};

export async function refreshAppDashboardState({
  loadDashboardState,
  loadServiceHealth,
  setDashboard,
  setServiceHealth,
  setLoading,
  setError,
  transition
}: AppDashboardRefreshInput): Promise<void> {
  setLoading(true);
  setError(undefined);

  try {
    const [dashboard, serviceHealth] = await Promise.all([loadDashboardState(), loadServiceHealth()]);
    transition(() => {
      setDashboard(dashboard);
      setServiceHealth(serviceHealth);
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
}
