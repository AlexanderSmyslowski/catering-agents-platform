import { describe, expect, it, vi } from "vitest";
import { refreshAppDashboardState } from "../backoffice-ui/src/app-dashboard-refresh.js";
import type {
  DashboardState,
  ServiceHealthState
} from "../backoffice-ui/src/api.js";

function dashboardState(): DashboardState {
  return {
    intakeRequests: [{ requestId: "request-1" }],
    acceptedSpecs: [{ specId: "spec-1" }],
    offerDrafts: [],
    productionPlans: [],
    purchaseLists: [],
    recipes: [],
    auditEvents: []
  };
}

function serviceHealthState(): ServiceHealthState {
  return {
    intake: { service: "intake", status: "ok", timestamp: "2026-05-31T13:00:00.000Z", counts: { requests: 1 } },
    offers: { service: "offers", status: "ok", timestamp: "2026-05-31T13:00:00.000Z", counts: {} },
    production: { service: "production", status: "ok", timestamp: "2026-05-31T13:00:00.000Z", counts: {} },
    exports: { service: "exports", status: "ok", timestamp: "2026-05-31T13:00:00.000Z", counts: {} }
  };
}

describe("app dashboard refresh", () => {
  it("loads dashboard and health together and applies the result inside the provided transition", async () => {
    const calls: string[] = [];
    const dashboard = dashboardState();
    const serviceHealth = serviceHealthState();

    await refreshAppDashboardState({
      loadDashboardState: vi.fn(async () => {
        calls.push("loadDashboardState");
        return dashboard;
      }),
      loadServiceHealth: vi.fn(async () => {
        calls.push("loadServiceHealth");
        return serviceHealth;
      }),
      setDashboard: vi.fn((state) => {
        expect(state).toBe(dashboard);
        calls.push("setDashboard");
      }),
      setServiceHealth: vi.fn((state) => {
        expect(state).toBe(serviceHealth);
        calls.push("setServiceHealth");
      }),
      setLoading: vi.fn((loading) => {
        calls.push(`setLoading:${String(loading)}`);
      }),
      setError: vi.fn((error) => {
        calls.push(`setError:${String(error)}`);
      }),
      transition: vi.fn((callback) => {
        calls.push("transition:start");
        callback();
        calls.push("transition:end");
      })
    });

    expect(calls).toEqual([
      "setLoading:true",
      "setError:undefined",
      "loadDashboardState",
      "loadServiceHealth",
      "transition:start",
      "setDashboard",
      "setServiceHealth",
      "setLoading:false",
      "transition:end"
    ]);
  });

  it("clears loading and reports a stable message when refresh fails", async () => {
    const calls: string[] = [];

    await refreshAppDashboardState({
      loadDashboardState: vi.fn(async () => {
        throw new Error("Dashboard nicht erreichbar");
      }),
      loadServiceHealth: vi.fn(async () => serviceHealthState()),
      setDashboard: vi.fn(() => {
        calls.push("setDashboard");
      }),
      setServiceHealth: vi.fn(() => {
        calls.push("setServiceHealth");
      }),
      setLoading: vi.fn((loading) => {
        calls.push(`setLoading:${String(loading)}`);
      }),
      setError: vi.fn((error) => {
        calls.push(`setError:${String(error)}`);
      }),
      transition: vi.fn((callback) => callback())
    });

    expect(calls).toEqual([
      "setLoading:true",
      "setError:undefined",
      "setLoading:false",
      "setError:Dashboard nicht erreichbar"
    ]);
  });
});
