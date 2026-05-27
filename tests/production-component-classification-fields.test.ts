// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductionComponentClassificationFields } from "../backoffice-ui/src/production-component-classification-fields.js";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderProductionComponentClassificationFields(options: {
  menuCategory?: string;
  productionMode?: string;
  onMenuCategoryChange?: (menuCategory: string) => void;
  onProductionModeChange?: (productionMode: string) => void;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  const onMenuCategoryChange = options.onMenuCategoryChange ?? vi.fn((_: string) => undefined);
  const onProductionModeChange = options.onProductionModeChange ?? vi.fn((_: string) => undefined);

  act(() => {
    root.render(
      createElement(ProductionComponentClassificationFields, {
        menuCategory: options.menuCategory ?? "",
        productionMode: options.productionMode ?? "",
        onMenuCategoryChange,
        onProductionModeChange
      })
    );
  });

  return { container, onMenuCategoryChange, onProductionModeChange };
}

describe("production component classification fields", () => {
  it("keeps menu category and production mode as separate editor state patches", () => {
    const onMenuCategoryChange = vi.fn((_: string) => undefined);
    const onProductionModeChange = vi.fn((_: string) => undefined);
    const { container } = renderProductionComponentClassificationFields({
      onMenuCategoryChange,
      onProductionModeChange
    });

    const selects = Array.from(container.querySelectorAll("select"));
    expect(selects).toHaveLength(2);
    expect(selects[0].getAttribute("aria-label")).toBe("Kategorie im Angebot");
    expect(selects[1].getAttribute("aria-label")).toBe("Herstellungsart");

    act(() => {
      selects[0].value = "vegetarian";
      selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    });

    act(() => {
      selects[1].value = "hybrid";
      selects[1].dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onMenuCategoryChange).toHaveBeenCalledWith("vegetarian");
    expect(onProductionModeChange).toHaveBeenCalledWith("hybrid");
  });
});
