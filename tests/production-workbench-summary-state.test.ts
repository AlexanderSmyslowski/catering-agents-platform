import { describe, expect, it } from "vitest";
import { buildProductionWorkbenchSummaryState } from "../backoffice-ui/src/production-workbench-summary-state.js";

describe("production workbench summary state", () => {
  it("maps current production labels, question counts, and artifact counts into the workbench summary", () => {
    const summary = buildProductionWorkbenchSummaryState({
      activeProductionContextLabel: "Lunch · 42 Pax",
      productionIntakeOriginLabel: "Dateiupload · 2026-06-30T20:26:58.000Z · Intake-Anfrage verknüpft",
      focusedSpecReadinessLabel: "teilweise vollständig",
      productionPlanStatusLabel: "1 aktueller Plan",
      purchaseZoneStatusLabel: "1 aktuelle Liste",
      productionQuestions: ["Pax bestätigen?", "Zeitfenster klären?"],
      clarificationStatusCounts: { answered: 1, unanswered: 2 },
      currentSpecPlans: [{ planId: "plan-1" }, { planId: "plan-2" }],
      productionObjectStatusLabel: "2 aktuelle Pläne",
      currentSpecPurchaseLists: [{ purchaseListId: "purchase-1" }]
    });

    expect(summary).toEqual({
      activeSpecLabel: "Lunch · 42 Pax",
      activeTechnicalContextLabel: undefined,
      assuranceFacts: [
        {
          label: "Herkunft",
          value: "Dateiupload · 2026-06-30T20:26:58.000Z · Intake-Anfrage verknüpft"
        },
        { label: "Freigabe", value: "nicht erteilt" }
      ],
      readinessLabel: "teilweise vollständig",
      planStatusLabel: "1 aktueller Plan",
      purchaseStatusLabel: "1 aktuelle Liste",
      questionCount: 2,
      answeredQuestionCount: 1,
      unansweredQuestionCount: 2,
      productionObjectCount: 2,
      productionObjectStatusLabel: "2 aktuelle Pläne",
      purchaseListCount: 1
    });
  });

  it("keeps empty production artifacts and question counters explicit", () => {
    const summary = buildProductionWorkbenchSummaryState({
      activeProductionContextLabel: "Kein aktiver Vorgang",
      focusedSpecReadinessLabel: "-",
      productionPlanStatusLabel: "offen",
      purchaseZoneStatusLabel: "noch keine Liste",
      productionQuestions: [],
      clarificationStatusCounts: { answered: 0, unanswered: 0 },
      currentSpecPlans: [],
      productionObjectStatusLabel: "noch kein Plan",
      currentSpecPurchaseLists: []
    });

    expect(summary.questionCount).toBe(0);
    expect(summary.answeredQuestionCount).toBe(0);
    expect(summary.unansweredQuestionCount).toBe(0);
    expect(summary.productionObjectCount).toBe(0);
    expect(summary.purchaseListCount).toBe(0);
    expect(summary.activeSpecLabel).toBe("Kein aktiver Vorgang");
    expect(summary.assuranceFacts).toEqual([{ label: "Freigabe", value: "nicht erteilt" }]);
  });
});
