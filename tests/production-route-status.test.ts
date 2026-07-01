import { describe, expect, it } from "vitest";
import {
  buildWorkbenchSpecFacts,
  formatProductionReadinessLabelForQuestionCount
} from "../backoffice-ui/src/production-route-status.js";

describe("production route status", () => {
  it("builds the current workbench facts from the focused spec", () => {
    expect(
      buildWorkbenchSpecFacts({
        readiness: { status: "complete" },
        event: {
          date: "2026-06-12",
          schedule: [{ label: "Service", start: "12:00", end: "14:00" }]
        },
        attendees: { expected: 48 },
        servicePlan: { serviceForm: "buffet" },
        menuPlan: [{ componentId: "starter" }, { componentId: "main" }]
      })
    ).toEqual([
      { label: "Status", value: "vollständig" },
      { label: "Zeit", value: "Datum: 2026-06-12 · Terminfenster: Service 12:00–14:00" },
      { label: "Gäste", value: "48 Personen" },
        { label: "Service", value: "Buffet" },
        { label: "Menü", value: "2 Komponenten" }
      ]);
  });

  it("downgrades the operator readiness label while production questions are open", () => {
    expect(formatProductionReadinessLabelForQuestionCount({ readiness: { status: "complete" } }, 2)).toBe(
      "teilweise vollständig"
    );
    expect(
      buildWorkbenchSpecFacts(
        {
          readiness: { status: "complete" },
          event: { date: "2026-06-12" },
          attendees: { expected: 48 },
          servicePlan: { serviceForm: "buffet" },
          menuPlan: [{ componentId: "starter" }]
        },
        { questionCount: 1 }
      )[0]
    ).toEqual({ label: "Status", value: "teilweise vollständig" });
  });
});
