// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductionComponentDetailFields } from "../backoffice-ui/src/production-component-detail-fields.js";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderProductionComponentDetailFields(options: {
  purchasedElements?: string;
  notes?: string;
  onPurchasedElementsChange?: (purchasedElements: string) => void;
  onNotesChange?: (notes: string) => void;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  const onPurchasedElementsChange = options.onPurchasedElementsChange ?? vi.fn((_: string) => undefined);
  const onNotesChange = options.onNotesChange ?? vi.fn((_: string) => undefined);

  act(() => {
    root.render(
      createElement(ProductionComponentDetailFields, {
        purchasedElements: options.purchasedElements ?? "",
        notes: options.notes ?? "",
        onPurchasedElementsChange,
        onNotesChange
      })
    );
  });

  return { container, onPurchasedElementsChange, onNotesChange };
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("production component detail fields", () => {
  it("keeps purchased elements and notes as separate editor state patches", () => {
    const onPurchasedElementsChange = vi.fn((_: string) => undefined);
    const onNotesChange = vi.fn((_: string) => undefined);
    const { container } = renderProductionComponentDetailFields({
      onPurchasedElementsChange,
      onNotesChange
    });

    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs).toHaveLength(2);

    act(() => {
      setNativeValue(inputs[0], "fertiger Boden");
    });

    act(() => {
      setNativeValue(inputs[1], "separat rueckfragen");
    });

    expect(onPurchasedElementsChange).toHaveBeenCalledWith("fertiger Boden");
    expect(onNotesChange).toHaveBeenCalledWith("separat rueckfragen");
  });
});
