import { describe, expect, it } from "vitest";
import { buildProductionStatusSummaryState } from "../backoffice-ui/src/production-status-summary-state.js";

describe("production status summary state", () => {
  it("builds the focused production status and handoff labels from existing formatters", () => {
    const state = buildProductionStatusSummaryState({
      focusedProductionSpec: {
        specId: "spec-1",
        readiness: { status: "partial" },
        event: { type: "lunch", date: "2026-06-01" },
        attendees: { expected: 80 }
      },
      selectedPlan: {
        planId: "plan-1",
        eventSpecId: "spec-1",
        readiness: { status: "complete" }
      },
      selectedPlanSpec: {
        specId: "spec-1",
        event: { type: "lunch", date: "2026-06-01" },
        attendees: { expected: 80 }
      },
      currentSpecPlans: [{ planId: "plan-1", eventSpecId: "spec-1" }],
      currentSpecPurchaseLists: [
        {
          purchaseListId: "purchase-1",
          eventSpecId: "spec-1",
          totals: { itemCount: 7 }
        }
      ],
      productionQuestions: ["Teilnehmerzahl bestätigen"],
      filteredAuditEvents: [
        {
          auditId: "audit-1",
          at: "2026-05-21T10:00:00.000Z",
          action: "production.plan.created",
          summary: "Produktionsplan erstellt",
          actor: { name: "Küche" }
        }
      ],
      intakeRequestDetail: {
        requestId: "request-1",
        source: { channel: "text", receivedAt: "2026-05-26T01:00:00.000Z" }
      },
      currentIntakeRequestId: "request-fallback",
      productionWorkspaceCleared: false
    });

    expect(state).toMatchObject({
      activeProductionContextLabel: "Lunch · 80 Teilnehmer · 2026-06-01",
      focusedSpecReadinessLabel: "teilweise vollständig",
      selectedPlanReadinessLabel: "vollständig",
      productionPlanStatusLabel: "vollständig",
      productionObjectStatusLabel: "1 Plan(e) · vollständig",
      purchaseZoneStatusLabel: "1 Liste · 7 Positionen",
      productionIntakeOriginLabel: "text · 2026-05-26T01:00:00.000Z · request-1",
      productionAuditTrailLabel:
        "Produktionsplan erstellt · Küche · production.plan.created · 2026-05-21T10:00:00.000Z",
      productionHandoffExportLabel: "Produktionsblatt vorhanden · Einkaufsliste vorhanden",
      productionHandoffContextLabel: "planId plan-1 · specId spec-1 · purchaseListId purchase-1"
    });
    expect(state.productionNextStep.title).toBe("Rückfragen beantworten");
  });

  it("keeps the empty and cleared production defaults in one state object", () => {
    const state = buildProductionStatusSummaryState({
      currentSpecPlans: [],
      currentSpecPurchaseLists: [],
      productionQuestions: [],
      filteredAuditEvents: [],
      productionWorkspaceCleared: true
    });

    expect(state).toMatchObject({
      activeProductionContextLabel: "Kein aktiver Vorgang",
      focusedSpecReadinessLabel: "-",
      selectedPlanReadinessLabel: undefined,
      productionPlanStatusLabel: "offen",
      productionObjectStatusLabel: "noch kein Plan",
      purchaseZoneStatusLabel: "noch keine Liste",
      productionIntakeOriginLabel: "kein Intake-Ursprung verknüpft",
      productionAuditTrailLabel: "keine Audit-Ereignisse geladen",
      productionHandoffExportLabel: "Produktionsblatt offen · Einkaufsliste offen",
      productionHandoffContextLabel: undefined
    });
    expect(state.productionNextStep.title).toBe("Auftrag einfügen oder Datei ablegen");
  });

  it("does not surface stale intake origin after the production workspace was cleared", () => {
    const state = buildProductionStatusSummaryState({
      currentSpecPlans: [],
      currentSpecPurchaseLists: [],
      productionQuestions: [],
      filteredAuditEvents: [
        {
          auditId: "audit-stale",
          at: "2026-05-21T10:00:00.000Z",
          action: "production.plan.created",
          summary: "Alter Produktionsplan erstellt",
          actor: { name: "Küche" }
        }
      ],
      intakeRequestDetail: {
        requestId: "request-stale",
        source: { channel: "pdf_upload", receivedAt: "2026-05-26T01:00:00.000Z" }
      },
      currentIntakeRequestId: "request-stale",
      productionWorkspaceCleared: true
    });

    expect(state).toMatchObject({
      activeProductionContextLabel: "Kein aktiver Vorgang",
      productionIntakeOriginLabel: "kein Intake-Ursprung verknüpft",
      productionAuditTrailLabel: "keine Audit-Ereignisse geladen",
      productionHandoffContextLabel: undefined
    });
  });

  it("keeps the initial production loading state from looking like an empty active workflow", () => {
    const state = buildProductionStatusSummaryState({
      isInitialProductionLoading: true,
      currentSpecPlans: [],
      currentSpecPurchaseLists: [],
      productionQuestions: [],
      filteredAuditEvents: [],
      productionWorkspaceCleared: false
    });

    expect(state).toMatchObject({
      activeProductionContextLabel: "Produktionsdaten werden geladen; noch kein Vorgang bewertet.",
      focusedSpecReadinessLabel: "wird geladen",
      productionPlanStatusLabel: "wird geladen",
      productionObjectStatusLabel: "Produktionspläne werden geladen",
      purchaseZoneStatusLabel: "Einkaufslisten werden geladen",
      productionIntakeOriginLabel: "Intake-Ursprung wird geladen",
      productionAuditTrailLabel: "Audit-Ereignisse werden geladen",
      productionHandoffExportLabel: "Exportstatus wird geladen"
    });
    expect(state.productionNextStep).toEqual({
      title: "Produktionsdaten laden",
      description: "Bestehende Vorgänge, Pläne, Einkaufslisten und Rückfragen werden gerade geladen."
    });
  });
});
