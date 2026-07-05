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
      productionObjectStatusLabel: "1 Plan · vollständig",
      purchaseZoneStatusLabel: "1 Liste · 7 Positionen",
      productionIntakeOriginLabel: "Text · 2026-05-26T01:00:00.000Z · Intake-Anfrage verknüpft",
      productionAuditTrailLabel:
        "Produktionsplan erstellt · Küche · production.plan.created · 2026-05-21T10:00:00.000Z",
      productionHandoffExportLabel: "Produktionsblatt vorhanden · Einkaufsliste vorhanden",
      productionHandoffContextLabel: "Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste vorhanden"
    });
    expect(state.productionNextStep.title).toBe("Rückfragen beantworten");
  });

  it("marks a technically complete spec as review required when production questions are still open", () => {
    const state = buildProductionStatusSummaryState({
      focusedProductionSpec: {
        specId: "spec-open-questions",
        readiness: { status: "complete" },
        event: { type: "conference", date: "2026-06-01" },
        attendees: { expected: 90 }
      },
      currentSpecPlans: [],
      currentSpecPurchaseLists: [],
      productionQuestions: ["Lunchbuffet: Kategorie fehlt. Bitte klassisch, vegetarisch oder vegan festlegen."],
      filteredAuditEvents: [],
      productionWorkspaceCleared: false
    });

    expect(state.focusedSpecReadinessLabel).toBe("Prüfung nötig");
    expect(state.productionNextStep.title).toBe("Rückfragen beantworten");
  });

  it("marks a technically complete spec as review required when the source has ingestion warnings", () => {
    const state = buildProductionStatusSummaryState({
      focusedProductionSpec: {
        specId: "spec-source-warning",
        readiness: { status: "complete" },
        event: { type: "conference", date: "2026-06-01" },
        attendees: { expected: 90 }
      },
      currentSpecPlans: [],
      currentSpecPurchaseLists: [],
      productionQuestions: [],
      filteredAuditEvents: [],
      intakeRequestDetail: {
        requestId: "request-source-warning",
        rawInputs: [
          {
            kind: "pdf",
            content: "%PDF Rohinhalt darf nicht sichtbar werden",
            documentId: "document-source-warning",
            sourceMetadata: {
              filename: "angebot.pdf"
            },
            documentIngestion: {
              status: "fallback",
              warnings: ["document_text_extraction_fallback"]
            }
          }
        ]
      },
      productionWorkspaceCleared: false
    });

    expect(state.focusedSpecReadinessLabel).toBe("Prüfung nötig");
    expect(state.productionNextStep).toEqual({
      title: "Quellenprüfung bestätigen",
      description: "Die Quelle wurde nur unsicher verarbeitet. Bitte Lesbarkeit und erkannte Daten prüfen."
    });
    expect(JSON.stringify(state)).not.toContain("%PDF Rohinhalt");
  });

  it("does not present an empty purchase-list shell as a usable handoff artifact", () => {
    const state = buildProductionStatusSummaryState({
      focusedProductionSpec: {
        specId: "spec-empty-purchase",
        readiness: { status: "complete" },
        event: { type: "lunch", date: "2026-06-01" },
        attendees: { expected: 80 }
      },
      selectedPlan: {
        planId: "plan-empty-purchase",
        eventSpecId: "spec-empty-purchase",
        readiness: { status: "complete" }
      },
      selectedPlanSpec: {
        specId: "spec-empty-purchase",
        event: { type: "lunch", date: "2026-06-01" },
        attendees: { expected: 80 }
      },
      currentSpecPlans: [{ planId: "plan-empty-purchase", eventSpecId: "spec-empty-purchase" }],
      currentSpecPurchaseLists: [
        {
          purchaseListId: "purchase-empty",
          eventSpecId: "spec-empty-purchase",
          totals: { itemCount: 0 },
          items: []
        }
      ],
      productionQuestions: [],
      filteredAuditEvents: [],
      productionWorkspaceCleared: false
    });

    expect(state).toMatchObject({
      purchaseZoneStatusLabel: "1 Liste ohne Positionen",
      productionHandoffExportLabel: "Produktionsblatt vorhanden · Einkaufsliste ohne Positionen",
      productionHandoffContextLabel:
        "Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste ohne Positionen"
    });
    expect(state.productionNextStep.title).toBe("Einkaufspositionen klären");
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
    expect(state.productionNextStep.title).toBe("Angebot hochladen oder Auftrag beschreiben");
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

  it("masks stale focused spec, selected plan, purchase list, and question state after a workspace clear", () => {
    const state = buildProductionStatusSummaryState({
      focusedProductionSpec: {
        specId: "spec-stale",
        readiness: { status: "complete" },
        event: { type: "Lunch", date: "2026-06-01" },
        attendees: { expected: 80 }
      },
      selectedPlan: {
        planId: "plan-stale",
        eventSpecId: "spec-stale",
        readiness: { status: "complete" }
      },
      selectedPlanSpec: {
        specId: "spec-stale",
        event: { type: "Lunch", date: "2026-06-01" },
        attendees: { expected: 80 }
      },
      currentSpecPlans: [{ planId: "plan-stale", eventSpecId: "spec-stale" }],
      currentSpecPurchaseLists: [
        {
          purchaseListId: "purchase-stale",
          eventSpecId: "spec-stale",
          totals: { itemCount: 7 }
        }
      ],
      productionQuestions: ["Stale Rückfrage"],
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
      productionHandoffExportLabel: "Produktionsblatt offen · Einkaufsliste offen",
      productionHandoffContextLabel: undefined
    });
    expect(state.productionNextStep).toEqual({
      title: "Angebot hochladen oder Auftrag beschreiben",
      description: "Starte mit PDF, E-Mail, Text oder manuellen Veranstaltungsdaten."
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
