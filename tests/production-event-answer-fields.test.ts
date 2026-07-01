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

function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("production event answer fields", () => {
  it("labels event and service select controls while keeping callbacks separate", () => {
    const { container, actions } = renderProductionEventAnswerFields();
    const selects = Array.from(container.querySelectorAll("select"));
    const scheduleInput = container.querySelector('input[aria-label="Verbindliches Zeitfenster"]') as HTMLInputElement | null;

    expect(selects).toHaveLength(2);
    expect(selects[0].getAttribute("aria-label")).toBe("Veranstaltungstyp");
    expect(selects[1].getAttribute("aria-label")).toBe("Serviceform");
    expect(scheduleInput?.placeholder).toBe("Aufbau ab 10 Uhr, Service 12:00–14:00");

    act(() => {
      selects[0].value = "lunch";
      selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    });

    act(() => {
      selects[1].value = "buffet";
      selects[1].dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => {
      if (!scheduleInput) {
        throw new Error("Schedule input missing.");
      }
      setNativeValue(scheduleInput, "Service 12:00–14:00");
    });

    expect(actions.setEditingEventType).toHaveBeenCalledWith("lunch");
    expect(actions.setEditingServiceForm).toHaveBeenCalledWith("buffet");
    expect(actions.setEditingEventSchedule).toHaveBeenCalledWith("Service 12:00–14:00");
  });
});
