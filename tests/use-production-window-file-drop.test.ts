// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProductionWindowFileDrop } from "../backoffice-ui/src/use-production-window-file-drop.js";
import type { AppRoute } from "../backoffice-ui/src/app-shell-state.js";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function renderWindowFileDrop(input: {
  route?: AppRoute;
  setDragActive?: (active: boolean) => void;
  setIntakeFile?: (file: File) => void;
  processIncomingProductionFile?: (file: File, channel: "pdf_upload" | "email" | "text") => void | Promise<void>;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe() {
    useProductionWindowFileDrop({
      route: input.route ?? "production",
      setDragActive: input.setDragActive ?? vi.fn(),
      setIntakeFile: input.setIntakeFile ?? vi.fn(),
      processIncomingProductionFile: input.processIncomingProductionFile ?? vi.fn()
    });
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return root;
}

describe("useProductionWindowFileDrop", () => {
  it("registers production window file listeners only on the production route", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const root = renderWindowFileDrop({ route: "production" });

    expect(addEventListener).toHaveBeenCalledWith("dragover", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("drop", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("dragleave", expect.any(Function));

    act(() => {
      root.unmount();
    });
    roots.pop();

    expect(removeEventListener).toHaveBeenCalledWith("dragover", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("drop", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("dragleave", expect.any(Function));
  });

  it("keeps non-production routes inert", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    renderWindowFileDrop({ route: "offer" });

    expect(addEventListener).not.toHaveBeenCalledWith("drop", expect.any(Function));
  });

  it("routes dropped files through the existing production upload action", () => {
    const file = new File(["angebot"], "angebot.pdf", { type: "application/pdf" });
    const setDragActive = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { files: [file] }
    });

    renderWindowFileDrop({
      setDragActive,
      setIntakeFile,
      processIncomingProductionFile
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(setDragActive).toHaveBeenCalledWith(false);
    expect(setIntakeFile).toHaveBeenCalledWith(file);
    expect(processIncomingProductionFile).toHaveBeenCalledWith(file, "pdf_upload");
  });
});
