// @vitest-environment jsdom
import { act, createElement, useState } from "react";
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


it("edits operator quantities and derives totals from the current attendee count", () => {
  function Editor() {
    const [purchasedQuantities, setQuantities] = useState([{ element: "Croissants", amountPerPerson: "1", unit: "Stück" }, { element: "Wasser", amountPerPerson: "0.5", unit: "l" }]);
    return createElement(ProductionComponentDetailFields, { canEditPurchasedQuantities: true, purchasedElements: "Croissants, Wasser", notes: "", onNotesChange: () => {}, onPurchasedElementsChange: () => {}, purchasedQuantities, onPurchasedQuantitiesChange: setQuantities, attendeeCount: 35 });
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container); roots.push(root);
  act(() => root.render(createElement(Editor)));
  expect(container.textContent).toMatch(/Operatorentscheidung/);
  expect(container.textContent).toContain("35 Stück");
  expect(container.textContent).toContain("17.5 l");
  const waterAmount = container.querySelector<HTMLInputElement>('input[aria-label="Wasser Menge pro Person"]');
  expect(waterAmount).not.toBeNull();
  act(() => setNativeValue(waterAmount!, "0.75"));
  expect(container.textContent).toContain("26.25 l");
  const waterUnit = container.querySelector<HTMLInputElement>('input[aria-label="Wasser Einheit"]');
  act(() => setNativeValue(waterUnit!, "Liter"));
  expect(container.textContent).toContain("26.25 Liter");
});
