// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppDashboardData } from "../backoffice-ui/src/use-app-dashboard-data.js";

type AppDashboardData = ReturnType<typeof useAppDashboardData>;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    }
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true
  });
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function flush(times = 5) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function stubDashboardFetch(options: { failHealth?: boolean } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/health")) {
      if (options.failHealth) {
        return Response.json({ message: "Healthcheck nicht erreichbar." }, { status: 503 });
      }
      return Response.json({
        service: "ok",
        status: "ok",
        timestamp: "2026-06-10T08:00:00.000Z",
        counts: {}
      });
    }

    if (url.endsWith("/api/intake/v1/intake/specs")) {
      return Response.json({ items: [{ specId: "spec-dashboard-data-1" }] });
    }

    return Response.json({ items: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderAppDashboardData(setError: (error: string | undefined) => void) {
  let state: AppDashboardData | undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe() {
    state = useAppDashboardData({ setError });
    return null;
  }

  await act(async () => {
    root.render(createElement(Probe));
    await flush();
  });
  await act(async () => {
    await flush();
  });

  return {
    get state() {
      if (!state) {
        throw new Error("App dashboard data hook did not render.");
      }
      return state;
    }
  };
}

describe("useAppDashboardData", () => {
  it("loads dashboard and service health on mount and clears loading", async () => {
    const fetchMock = stubDashboardFetch();
    const setError = vi.fn();

    const probe = await renderAppDashboardData(setError);

    expect(probe.state.loading).toBe(false);
    expect(probe.state.dashboard.acceptedSpecs).toEqual([{ specId: "spec-dashboard-data-1" }]);
    expect(probe.state.serviceHealth.production.status).toBe("ok");
    expect(setError).toHaveBeenCalledWith(undefined);
    expect(setError).not.toHaveBeenCalledWith(expect.any(String));
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toContain("/api/production/health");
  });

  it("refreshes via the returned refreshDashboard callback", async () => {
    const fetchMock = stubDashboardFetch();
    const setError = vi.fn();

    const probe = await renderAppDashboardData(setError);
    const callsAfterMount = fetchMock.mock.calls.length;

    await act(async () => {
      await probe.state.refreshDashboard();
      await flush();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterMount);
    expect(probe.state.loading).toBe(false);
  });

  it("reports the load error and stops loading when a request fails", async () => {
    stubDashboardFetch({ failHealth: true });
    const setError = vi.fn();

    const probe = await renderAppDashboardData(setError);

    expect(probe.state.loading).toBe(false);
    expect(setError).toHaveBeenLastCalledWith("Healthcheck nicht erreichbar.");
  });
});
