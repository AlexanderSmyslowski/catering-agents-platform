// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseHistoryPanel } from "../backoffice-ui/src/case-history-panel.js";
import type { CaseSummary } from "@catering/shared-core";

const item: CaseSummary = {
  caseId: "case-a",
  product: "production",
  displayName: "Fall A - Sommerfest",
  status: "open",
  createdAt: "2026-07-12T09:00:00.000Z",
  updatedAt: "2026-07-12T09:00:00.000Z"
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("case history panel", () => {
  it("keeps the history closed until the operator asks for earlier cases", async () => {
    const onSearchChange = vi.fn();
    const onOpen = vi.fn();
    const onCopy = vi.fn(async () => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CaseHistoryPanel, {
        product: "production",
        items: [item],
        activeCaseId: undefined,
        search: "",
        onSearchChange,
        onOpen,
        onCopy
      }));
    });

    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(container.textContent).toContain("Frühere Produktionsaufträge");
    expect(container.textContent).toContain("Fall A - Sommerfest");
    expect(container.textContent).toContain("Als neuen Auftrag verwenden");

    await act(async () => {
      const input = container.querySelector("input") as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
      setter?.call(input, "sommer");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onSearchChange).toHaveBeenCalledWith("sommer");

    await act(async () => {
      (container.querySelector("button[data-action='open-case']") as HTMLButtonElement).click();
      (container.querySelector("button[data-action='copy-case']") as HTMLButtonElement).click();
    });
    expect(onOpen).toHaveBeenCalledWith("case-a");
    expect(onCopy).toHaveBeenCalledWith("case-a");

    await act(async () => root.unmount());
  });

  it("reports a copy failure without changing the active selection", async () => {
    const onCopy = vi.fn(async () => {
      throw new Error("Kopie konnte nicht angelegt werden.");
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(CaseHistoryPanel, {
        product: "offer",
        items: [item],
        activeCaseId: "case-a",
        search: "",
        onSearchChange: vi.fn(),
        onOpen: vi.fn(),
        onCopy
      }));
    });
    await act(async () => {
      (container.querySelector("button[data-action='copy-case']") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("Kopie konnte nicht angelegt werden.");
    expect(container.querySelector("button[data-action='open-case']")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => root.unmount());
  });
});
