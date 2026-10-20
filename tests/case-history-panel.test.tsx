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
  window.history.replaceState({}, "", "/");
});

describe("case history panel", () => {
  it("shows existing orders immediately before a case has been selected", async () => {
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
    expect(details?.open).toBe(true);
    expect(container.textContent).toContain("Bestehenden Auftrag öffnen");
    expect(container.textContent).toContain("Fall A - Sommerfest");
    expect(container.textContent).toContain("Als Vorlage für neuen Auftrag");

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

  it("collapses the picker after selection even when the history hash remains", async () => {
    window.history.replaceState({}, "", "/angebot#history");
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const panelProps = { product: "offer" as const, items: [item], search: "", onSearchChange: vi.fn(), onOpen: vi.fn(), onCopy: vi.fn(async () => undefined) };
    await act(async () => root.render(createElement(CaseHistoryPanel, panelProps)));
    expect(document.querySelector("details")?.open).toBe(true);
    await act(async () => root.render(createElement(CaseHistoryPanel, { ...panelProps, activeCaseId: item.caseId })));
    expect(document.querySelector("details")?.open).toBe(false);
    await act(async () => root.unmount());
  });

  it("opens a linked history on first load and a later hash navigation without forcing it open on rerenders", async () => {
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    const panelProps = { product: "offer" as const, items: [item], search: "",
      onSearchChange: vi.fn(), onOpen: vi.fn(), onCopy: vi.fn(async () => undefined) };
    window.history.replaceState({}, "", "/angebot#history");
    await act(async () => root.render(createElement(CaseHistoryPanel, panelProps)));
    const details = container.querySelector("details")!;
    expect(details.open).toBe(true);
    expect(container.textContent).toContain("Offen");
    details.open = false;
    await act(async () => root.render(createElement(CaseHistoryPanel, { ...panelProps, search: "sommer" })));
    expect(details.open).toBe(false);
    await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")));
    expect(details.open).toBe(true);
    await act(async () => root.unmount());
    details.open = false;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(details.open).toBe(false);
  });

  it("distinguishes legacy duplicate names by their creation time and opens the chosen case", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const onOpen = vi.fn();
    await act(async () => root.render(createElement(CaseHistoryPanel, {
      product: "offer", search: "", onSearchChange: vi.fn(), onCopy: vi.fn(async () => undefined), onOpen,
      items: [item, { ...item, caseId: "case-b", createdAt: "2026-07-12T10:00:00.000Z" }]
    })));
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[data-action="open-case"]')];
    expect(buttons[0]!.querySelector("strong")?.textContent).toBe(buttons[1]!.querySelector("strong")?.textContent);
    expect(buttons[0]!.textContent).toContain("Angelegt");
    expect(buttons[0]!.textContent).not.toBe(buttons[1]!.textContent);
    await act(async () => buttons[1]!.click());
    expect(onOpen).toHaveBeenCalledExactlyOnceWith("case-b");
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
