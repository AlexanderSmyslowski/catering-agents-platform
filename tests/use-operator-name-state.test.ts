// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOperatorNameState } from "../backoffice-ui/src/use-operator-name-state.js";

type OperatorNameState = ReturnType<typeof useOperatorNameState>;

const roots: Array<ReturnType<typeof createRoot>> = [];
let localValues: Map<string, string>;
let sessionValues: Map<string, string>;
let localSetItem: ReturnType<typeof vi.fn>;
let sessionSetItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localValues = new Map<string, string>();
  sessionValues = new Map<string, string>();
  localSetItem = vi.fn((key: string, value: string) => localValues.set(key, String(value)));
  sessionSetItem = vi.fn((key: string, value: string) => sessionValues.set(key, String(value)));
  const localStorageMock = {
    getItem: (key: string) => localValues.get(key) ?? null,
    setItem: localSetItem,
    removeItem: (key: string) => {
      localValues.delete(key);
    },
    clear: () => {
      localValues.clear();
    }
  };
  const sessionStorageMock = {
    getItem: (key: string) => sessionValues.get(key) ?? null,
    setItem: sessionSetItem,
    removeItem: (key: string) => sessionValues.delete(key),
    clear: () => sessionValues.clear()
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true
  });
  Object.defineProperty(window, "sessionStorage", {
    value: sessionStorageMock,
    configurable: true
  });
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
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
  it("exposes no identity outside an authenticated session", () => {
    const probe = renderOperatorNameState();

    expect(probe.state.operatorName).toBe("");
    expect(localSetItem).not.toHaveBeenCalled();
    expect(sessionSetItem).not.toHaveBeenCalled();
  });

  it("ignores browser attempts to change or persist identity", () => {
    const probe = renderOperatorNameState();

    act(() => {
      probe.state.handleOperatorNameChange("  Kueche Nord  ");
    });

    expect(probe.state.operatorName).toBe("");
    expect(localSetItem).not.toHaveBeenCalled();
    expect(sessionSetItem).not.toHaveBeenCalled();
  });

  it("ignores a legacy local operator value", () => {
    localValues.set("catering.operatorName", "Kueche Nord");
    const probe = renderOperatorNameState();

    expect(probe.state.operatorName).toBe("");
    expect(localSetItem).not.toHaveBeenCalled();
    expect(sessionSetItem).not.toHaveBeenCalled();
  });
});
