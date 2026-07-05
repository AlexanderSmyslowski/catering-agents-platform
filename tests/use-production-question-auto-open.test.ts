// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProductionQuestionAutoOpen } from "../backoffice-ui/src/use-production-question-auto-open.js";
import type { AppRoute } from "../backoffice-ui/src/app-shell-state.js";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderAutoOpen(input: {
  route?: AppRoute;
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestionCount?: number;
  editingSpecId?: string;
  dismissedProductionAnswerSpecId?: string;
  loadSpecIntoEditor?: (spec: Record<string, unknown>) => void;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const loadSpecIntoEditor = input.loadSpecIntoEditor ?? vi.fn();

  function Probe() {
    useProductionQuestionAutoOpen({
      route: input.route ?? "production",
      focusedProductionSpec: input.focusedProductionSpec,
      productionQuestionCount: input.productionQuestionCount ?? 0,
      editingSpecId: input.editingSpecId,
      dismissedProductionAnswerSpecId: input.dismissedProductionAnswerSpecId,
      loadSpecIntoEditor
    });
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return { loadSpecIntoEditor };
}

describe("useProductionQuestionAutoOpen", () => {
  it("keeps the focused production spec closed until the operator opens it", () => {
    const spec = { specId: "spec-open", readiness: { status: "complete" } };
    const { loadSpecIntoEditor } = renderAutoOpen({
      focusedProductionSpec: spec,
      productionQuestionCount: 2
    });

    expect(loadSpecIntoEditor).not.toHaveBeenCalled();
  });

  it("keeps closed routes, edited specs and dismissed specs from auto-opening", () => {
    const spec = { specId: "spec-closed", readiness: { status: "partial" } };

    expect(
      renderAutoOpen({
        route: "offer",
        focusedProductionSpec: spec,
        productionQuestionCount: 1
      }).loadSpecIntoEditor
    ).not.toHaveBeenCalled();

    expect(
      renderAutoOpen({
        focusedProductionSpec: spec,
        productionQuestionCount: 1,
        editingSpecId: "spec-closed"
      }).loadSpecIntoEditor
    ).not.toHaveBeenCalled();

    expect(
      renderAutoOpen({
        focusedProductionSpec: spec,
        productionQuestionCount: 1,
        dismissedProductionAnswerSpecId: "spec-closed"
      }).loadSpecIntoEditor
    ).not.toHaveBeenCalled();
  });
});
