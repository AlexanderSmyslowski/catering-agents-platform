// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useProductionIntakeDraft } from "../backoffice-ui/src/use-production-intake-draft.js";

type ProductionIntakeDraft = ReturnType<typeof useProductionIntakeDraft>;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderProductionIntakeDraft() {
  let draft: ProductionIntakeDraft | undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe() {
    draft = useProductionIntakeDraft();
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    get draft() {
      if (!draft) {
        throw new Error("Production intake draft hook did not render.");
      }
      return draft;
    }
  };
}

describe("useProductionIntakeDraft", () => {
  it("keeps the existing text and document channel defaults", () => {
    const probe = renderProductionIntakeDraft();

    expect(probe.draft.intakeText).toContain("Konferenz am 2026-06-18");
    expect(probe.draft.intakeChannel).toBe("pdf_upload");
    expect(probe.draft.intakeFile).toBeNull();
    expect(probe.draft.dragActive).toBe(false);
    expect(probe.draft.uploadResultSpec).toBeUndefined();
  });

  it("tracks incoming file processing without changing the text draft", () => {
    const probe = renderProductionIntakeDraft();
    const file = new File(["Angebot"], "angebot.eml");

    act(() => {
      probe.draft.setIntakeText("Manueller Kontext");
      probe.draft.setDragActive(true);
      probe.draft.startIncomingProductionFile(file, "email");
    });

    expect(probe.draft.intakeText).toBe("Manueller Kontext");
    expect(probe.draft.intakeFile).toBe(file);
    expect(probe.draft.intakeChannel).toBe("email");
    expect(probe.draft.dragActive).toBe(true);

    act(() => {
      probe.draft.completeIncomingProductionFile({ specId: "spec-upload-1" });
    });

    expect(probe.draft.intakeFile).toBeNull();
    expect(probe.draft.dragActive).toBe(false);
    expect(probe.draft.intakeChannel).toBe("email");
    expect(probe.draft.uploadResultSpec).toEqual({ specId: "spec-upload-1" });

    act(() => {
      probe.draft.startIncomingProductionFile(file, "pdf_upload");
    });

    expect(probe.draft.uploadResultSpec).toBeUndefined();
  });

  it("restores failed files and clears only file/drag state on reset", () => {
    const probe = renderProductionIntakeDraft();
    const file = new File(["Angebot"], "angebot.pdf");

    act(() => {
      probe.draft.setIntakeText("Bleibt erhalten");
      probe.draft.setDragActive(true);
      probe.draft.failIncomingProductionFile(file);
    });

    expect(probe.draft.intakeFile).toBe(file);
    expect(probe.draft.dragActive).toBe(true);

    act(() => {
      probe.draft.resetIntakeDraft();
    });

    expect(probe.draft.intakeText).toBe("Bleibt erhalten");
    expect(probe.draft.intakeFile).toBeNull();
    expect(probe.draft.dragActive).toBe(false);
    expect(probe.draft.uploadResultSpec).toBeUndefined();
  });
});
