// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductionEventAnswerFields } from "../backoffice-ui/src/production-event-answer-fields.js";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderProductionEventAnswerFields() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

    const actions = {
      setEditingEventType: vi.fn((_: string) => undefined),
      setEditingEventDate: vi.fn((_: string) => undefined),
      setEditingEventSchedule: vi.fn((_: string) => undefined),
      setEditingAttendeeCount: vi.fn((_: string) => undefined),
    setEditingServiceForm: vi.fn((_: string) => undefined),
    setEditingMenuItems: vi.fn((_: string) => undefined)
  };

  act(() => {
    root.render(
      createElement(ProductionEventAnswerFields, {
        editingEventType: "",
        editingEventDate: "",
        editingEventSchedule: "",
        editingAttendeeCount: "",
        editingServiceForm: "",
        editingMenuItems: "",
        ...actions
      })
    );
  });

  return { container, actions };
}

describe("production event answer fields", () => {
  it("labels event and service select controls while keeping callbacks separate", () => {
    const { container, actions } = renderProductionEventAnswerFields();
    const selects = Array.from(container.querySelectorAll("select"));

    expect(selects).toHaveLength(2);
    expect(selects[0].getAttribute("aria-label")).toBe("Veranstaltungstyp");
    expect(selects[1].getAttribute("aria-label")).toBe("Serviceform");

    act(() => {
      selects[0].value = "lunch";
      selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    });

    act(() => {
      selects[1].value = "buffet";
      selects[1].dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(actions.setEditingEventType).toHaveBeenCalledWith("lunch");
    expect(actions.setEditingServiceForm).toHaveBeenCalledWith("buffet");
  });

  it("offers a direct answer field for the time-window clarification", () => {
    const { container, actions } = renderProductionEventAnswerFields();
    const timeWindowInput = container.querySelector<HTMLInputElement>("input[aria-label='Zeitfenster']");

    expect(timeWindowInput).not.toBeNull();

    act(() => {
      if (!timeWindowInput) {
        return;
      }
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        timeWindowInput,
        "16:30-23:00"
      );
      timeWindowInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(actions.setEditingEventSchedule).toHaveBeenCalledWith("16:30-23:00");
  });
});
