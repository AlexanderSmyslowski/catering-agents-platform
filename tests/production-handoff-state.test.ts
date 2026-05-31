import { describe, expect, it } from "vitest";
import { buildProductionHandoffState } from "../backoffice-ui/src/production-handoff-state.js";

describe("production handoff state", () => {
  it("maps existing handoff labels into panel state without recomputing behavior", () => {
    const handoffState = buildProductionHandoffState({
      productionIntakeOriginLabel: "PDF-Upload",
      productionAuditTrailLabel: "Audit geladen",
      productionHandoffExportLabel: "Plan und Einkaufsliste",
      productionHandoffContextLabel: "planId plan-1"
    });

    expect(handoffState).toEqual({
      intakeOriginLabel: "PDF-Upload",
      auditTrailLabel: "Audit geladen",
      exportLabel: "Plan und Einkaufsliste",
      contextLabel: "planId plan-1"
    });
  });

  it("leaves optional context label undefined when no handoff context exists", () => {
    const handoffState = buildProductionHandoffState({
      productionIntakeOriginLabel: "kein Intake-Ursprung verknüpft",
      productionAuditTrailLabel: "keine Audit-Ereignisse geladen",
      productionHandoffExportLabel: "Produktionsblatt offen · Einkaufsliste offen"
    });

    expect(handoffState.contextLabel).toBeUndefined();
    expect(handoffState.intakeOriginLabel).toBe("kein Intake-Ursprung verknüpft");
  });
});
