// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useProductionManualSpecForm } from "../backoffice-ui/src/use-production-manual-spec-form.js";

type ManualSpecForm = ReturnType<typeof useProductionManualSpecForm>;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderManualSpecForm() {
  let form: ManualSpecForm | undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe() {
    form = useProductionManualSpecForm();
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    get form() {
      if (!form) {
        throw new Error("Manual spec form hook did not render.");
      }
      return form;
    }
  };
}

describe("useProductionManualSpecForm", () => {
  it("keeps the existing defaults and builds normalized manual spec input", () => {
    const probe = renderManualSpecForm();

    expect(probe.form.manualEventType).toBe("conference");
    expect(probe.form.manualServiceForm).toBe("buffet");

    act(() => {
      probe.form.setManualEventDate(" 2026-06-12 ");
      probe.form.setManualAttendeeCount(" 42 ");
      probe.form.setManualMenuItems(" Hummus, Salat ");
      probe.form.setManualCustomerName(" ACME ");
      probe.form.setManualVenueName(" Loft ");
      probe.form.setManualNotes(" Bitte frueh liefern ");
    });

    expect(probe.form.buildCurrentManualSpecInput()).toEqual({
      eventType: "conference",
      eventDate: "2026-06-12",
      attendeeCount: 42,
      serviceForm: "buffet",
      menuItems: ["Hummus", "Salat"],
      customerName: "ACME",
      venueName: "Loft",
      notes: "Bitte frueh liefern"
    });
  });

  it("resets draft fields after successful creation while preserving stable defaults", () => {
    const probe = renderManualSpecForm();

    act(() => {
      probe.form.setManualEventType("lunch");
      probe.form.setManualEventDate("2026-06-12");
      probe.form.setManualAttendeeCount("42");
      probe.form.setManualServiceForm("flying buffet");
      probe.form.setManualMenuItems("Hummus");
      probe.form.setManualCustomerName("ACME");
      probe.form.setManualVenueName("Loft");
      probe.form.setManualNotes("Notiz");
    });
    act(() => {
      probe.form.resetManualSpecDraft();
    });

    expect(probe.form.manualEventType).toBe("lunch");
    expect(probe.form.manualServiceForm).toBe("flying buffet");
    expect(probe.form.manualEventDate).toBe("");
    expect(probe.form.manualAttendeeCount).toBe("");
    expect(probe.form.manualMenuItems).toBe("");
    expect(probe.form.manualCustomerName).toBe("");
    expect(probe.form.manualVenueName).toBe("");
    expect(probe.form.manualNotes).toBe("");
  });
});
