// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentEditState } from "../backoffice-ui/src/production-answer-types.js";
import { ProductionComponentAnswerCard } from "../backoffice-ui/src/production-component-answer-card.js";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderProductionComponentAnswerCard(options: {
  componentLabel: string;
  recipes: Array<Record<string, unknown>>;
  state?: Partial<ComponentEditState>;
  updateEditingComponentState?: (componentId: string, patch: Partial<ComponentEditState>) => void;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  const updateEditingComponentState =
    options.updateEditingComponentState ?? vi.fn((_: string, __: Partial<ComponentEditState>) => undefined);

  const state: ComponentEditState = {
    menuCategory: "",
    productionMode: "",
    purchasedElements: "",
    recipeOverrideId: "",
    notes: "",
    ...options.state
  };

  act(() => {
    root.render(
      createElement(ProductionComponentAnswerCard, {
        componentId: "component-kartoffelsalat",
        componentLabel: options.componentLabel,
        recipes: options.recipes,
        state,
        updateEditingComponentState
      })
    );
  });

  return { container, updateEditingComponentState };
}

function findRecipeSelect(container: HTMLElement, recipeId: string): HTMLSelectElement {
  const recipeSelect = Array.from(container.querySelectorAll("select")).find((select) =>
    Array.from(select.options).some((option) => option.value === recipeId)
  );

  if (!recipeSelect) {
    throw new Error(`Recipe select with ${recipeId} was not rendered.`);
  }

  return recipeSelect;
}

describe("production component answer card", () => {
  it("renders alias-backed recipe suggestions and sends selected overrides back to the editor state", () => {
    const updateEditingComponentState = vi.fn((_: string, __: Partial<ComponentEditState>) => undefined);
    const { container } = renderProductionComponentAnswerCard({
      componentLabel: "KARTOFFELSALAT | DE LUX",
      recipes: [
        {
          recipeId: "recipe-potato-salad",
          name: "Potato Salad with Herbs",
          source: { reference: "internal/potato-salad.md" }
        },
        {
          recipeId: "recipe-caesar-salad",
          name: "Caesar Salad Buffet",
          source: { reference: "internal/caesar-salad.md" }
        }
      ],
      updateEditingComponentState
    });

    const recipeSelect = findRecipeSelect(container, "recipe-potato-salad");
    const recipeOptionLabels = Array.from(recipeSelect.options).map((option) => option.textContent ?? "");

    expect(container.textContent ?? "").toContain("Vorgeschlagene Bibliotheksrezepte: Potato Salad with Herbs");
    expect(recipeOptionLabels).toContain("Potato Salad with Herbs (recipe-potato-salad)");
    expect(recipeOptionLabels).not.toContain("Caesar Salad Buffet (recipe-caesar-salad)");

    act(() => {
      recipeSelect.value = "recipe-potato-salad";
      recipeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updateEditingComponentState).toHaveBeenCalledWith("component-kartoffelsalat", {
      recipeOverrideId: "recipe-potato-salad"
    });
  });
});
