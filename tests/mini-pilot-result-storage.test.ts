// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  persistMiniPilotRawResult,
  persistMiniPilotStoredResult,
  readMiniPilotRawResult,
  readMiniPilotStoredResult
} from "../backoffice-ui/src/api.js";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function installStorage() {
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
}

describe("mini pilot result storage", () => {
  it("persists and reloads the local mini-pilot JSON across route reloads", () => {
    installStorage();

    const value = persistMiniPilotRawResult('{"ok":true,"summary":{"status":"ready"}}');

    expect(value).toBe('{"ok":true,"summary":{"status":"ready"}}');
    expect(readMiniPilotRawResult()).toBe('{"ok":true,"summary":{"status":"ready"}}');
    expect(readMiniPilotStoredResult().updatedAt).toBeTypeOf("string");
  });

  it("clears stored mini-pilot JSON when the result is emptied", () => {
    installStorage();

    persistMiniPilotRawResult('{"ok":true}');
    expect(readMiniPilotRawResult()).toBe('{"ok":true}');

    expect(persistMiniPilotRawResult("   ")).toBe("");
    expect(readMiniPilotRawResult()).toBe("");
  });

  it("keeps reading legacy raw storage while writing the new structured format", () => {
    installStorage();

    window.localStorage.setItem("catering.miniPilotRawResult", '{"ok":true,"summary":{"status":"ready"}}');
    expect(readMiniPilotStoredResult()).toEqual({
      rawResult: '{"ok":true,"summary":{"status":"ready"}}'
    });

    const stored = persistMiniPilotStoredResult('{"ok":false}');
    expect(stored.rawResult).toBe('{"ok":false}');
    expect(stored.updatedAt).toBeTypeOf("string");
    expect(readMiniPilotStoredResult().rawResult).toBe('{"ok":false}');
  });
});
