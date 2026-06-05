import { describe, expect, it } from "vitest";
import { buildProductionHandoffPanelState } from "../backoffice-ui/src/production-handoff-panel-state.js";

describe("production handoff panel state", () => {
  it("maps core handoff facts into a stable render list", () => {
    expect(
      buildProductionHandoffPanelState({
        intakeOriginLabel: "manual_form · 2026-04-18T10:30:00.000Z · request-1",
        auditTrailLabel: "Produktionsplan erstellt · Küche · production.plan.created · 2026-05-21T09:15:00.000Z",
        exportLabel: "Produktionsblatt vorhanden · Einkaufsliste vorhanden"
      })
    ).toEqual({
      facts: [
        {
          key: "intake-origin",
          label: "Intake-Ursprung",
          value: "manual_form · 2026-04-18T10:30:00.000Z · request-1"
        },
        {
          key: "audit-trail",
          label: "Audit-Spur",
          value: "Produktionsplan erstellt · Küche · production.plan.created · 2026-05-21T09:15:00.000Z"
        },
        {
          key: "export-artifacts",
          label: "Übergabe-/Exportartefakte",
          value: "Produktionsblatt vorhanden · Einkaufsliste vorhanden"
        }
      ]
    });
  });

  it("adds the optional handoff context as a fourth fact", () => {
    expect(
      buildProductionHandoffPanelState({
        intakeOriginLabel: "PDF-Upload",
        auditTrailLabel: "Audit geladen",
        exportLabel: "Plan und Einkaufsliste",
        contextLabel: "planId plan-1 · specId spec-1 · purchaseListId purchase-1"
      }).facts
    ).toEqual([
      {
        key: "intake-origin",
        label: "Intake-Ursprung",
        value: "PDF-Upload"
      },
      {
        key: "audit-trail",
        label: "Audit-Spur",
        value: "Audit geladen"
      },
      {
        key: "export-artifacts",
        label: "Übergabe-/Exportartefakte",
        value: "Plan und Einkaufsliste"
      },
      {
        key: "handoff-context",
        label: "Abschluss-Kontext",
        value: "Abschluss-Kontext: planId plan-1 · specId spec-1 · purchaseListId purchase-1"
      }
    ]);
  });
});
