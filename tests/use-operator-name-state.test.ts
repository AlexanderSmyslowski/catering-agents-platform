// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOperatorNameState } from "../backoffice-ui/src/use-operator-name-state.js";

type OperatorNameState = ReturnType<typeof useOperatorNameState>;

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
  window.localStorage.clear();
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function renderOperatorNameState() {
  let state: OperatorNameState | undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe() {
    state = useOperatorNameState();
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    get state() {
      if (!state) {
        throw new Error("Operator name state hook did not render.");
      }
      return state;
    }
  };
}

describe("useOperatorNameState", () => {
  it("starts with the generic operator name when no value is stored", () => {
    const probe = renderOperatorNameState();

    expect(probe.state.operatorName).toBe("Mitarbeiter");
  });

  it("trims and persists operator name changes", () => {
    const probe = renderOperatorNameState();

    act(() => {
      probe.state.handleOperatorNameChange("  Kueche Nord  ");
    });

    expect(probe.state.operatorName).toBe("Kueche Nord");
    expect(window.localStorage.getItem("catering.operatorName")).toBe("Kueche Nord");
  });

  it("falls back to the generic name for blank input", () => {
    const probe = renderOperatorNameState();

    act(() => {
      probe.state.handleOperatorNameChange("   ");
    });

    expect(probe.state.operatorName).toBe("Mitarbeiter");
    expect(window.localStorage.getItem("catering.operatorName")).toBe("Mitarbeiter");
  });
});
