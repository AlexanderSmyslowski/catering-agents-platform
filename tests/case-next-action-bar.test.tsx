// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CaseNextActionBar } from "../backoffice-ui/src/case-next-action-bar.js";
import type { CaseNextAction } from "../backoffice-ui/src/case-next-action.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("case next action bar", () => {
  it("renders exactly one primary command and sends the typed action", async () => {
    const action: CaseNextAction = { kind: "add_source", label: "Quelle hinzufügen" };
    const onAction = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(CaseNextActionBar, { action, onAction })));
    expect(container.querySelectorAll("button[data-action='case-next-action']")).toHaveLength(1);
    expect(container.textContent).toContain("Quelle hinzufügen");

    await act(async () => {
      (container.querySelector("button[data-action='case-next-action']") as HTMLButtonElement).click();
    });
    expect(onAction).toHaveBeenCalledWith(action);
    await act(async () => root.unmount());
  });

  it("renders terminal cases without a clickable command and exposes errors", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(CaseNextActionBar, {
      action: { kind: "complete", label: "Auftrag abgeschlossen" },
      onAction: vi.fn(),
      error: "Status konnte nicht geladen werden."
    })));
    expect(container.querySelector("button[data-action='case-next-action']")).toBeNull();
    expect(container.querySelector("[data-state='complete']")?.textContent).toBe("Auftrag abgeschlossen");
    expect(container.querySelector("[role='alert']")?.textContent).toBe("Status konnte nicht geladen werden.");
    await act(async () => root.unmount());
  });

  it("disables the command while a mutating action is in flight", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(CaseNextActionBar, {
      action: { kind: "approve_production", label: "Produktionsstand freigeben", draftId: "draft-a" },
      onAction: vi.fn(),
      busy: true
    })));

    const button = container.querySelector("button[data-action='case-next-action']") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Wird ausgeführt");
    await act(async () => root.unmount());
  });

  it("keeps the global bar sticky at the bottom and names the draft phase as KI-Entwurf", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(CaseNextActionBar, {
      action: { kind: "review_draft", label: "Nächsten Prüfpunkt öffnen", targetId: "draft-a" },
      onAction: vi.fn()
    })));

    expect(container.querySelector(".case-next-action-bar")?.textContent).toContain("KI-Entwurf");
    const styles = readFileSync(resolve(process.cwd(), "backoffice-ui/src/styles.css"), "utf8");
    expect(styles).toMatch(/\.case-next-action-bar\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*0/s);
    await act(async () => root.unmount());
  });
});
