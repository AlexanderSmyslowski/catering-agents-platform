import { describe, expect, it } from "vitest";
import { buildProductionWorkbenchSummaryState } from "../backoffice-ui/src/production-workbench-summary-state.js";

describe("production workbench summary state", () => {
  it("maps current production labels, question counts, and artifact counts into the workbench summary", () => {
    const summary = buildProductionWorkbenchSummaryState({
      activeProductionContextLabel: "Lunch · 42 Pax",
      focusedSpecReadinessLabel: "teilweise vollständig",
      productionPlanStatusLabel: "1 aktueller Plan",
      purchaseZoneStatusLabel: "1 aktuelle Liste",
      productionQuestions: ["Pax bestätigen?", "Zeitfenster klären?"],
      clarificationStatusCounts: { answered: 1, unanswered: 2 },
      currentSpecPlans: [{ planId: "plan-1" }, { planId: "plan-2" }],
      productionObjectStatusLabel: "2 aktuelle Pläne",
      currentSpecPurchaseLists: [{ purchaseListId: "purchase-1", totals: { itemCount: 3 } }]
    });

    expect(summary).toEqual({
      activeSpecLabel: "Lunch · 42 Pax",
      activeTechnicalContextLabel: undefined,
      readinessLabel: "teilweise vollständig",
      planStatusLabel: "1 aktueller Plan",
      purchaseStatusLabel: "1 aktuelle Liste",
      questionCount: 3,
      answeredQuestionCount: 1,
      unansweredQuestionCount: 2,
      productionObjectCount: 2,
      productionObjectStatusLabel: "2 aktuelle Pläne",
      purchaseListCount: 1,
      purchaseItemCount: 3
    });
  });

  it("counts remaining questions and confirmed answers once each", () => {
    const summary = buildProductionWorkbenchSummaryState({
      activeProductionContextLabel: "Synthetischer Auftrag", focusedSpecReadinessLabel: "Prüfung nötig", productionPlanStatusLabel: "offen",
      purchaseZoneStatusLabel: "noch keine Liste", productionQuestions: ["Frage 2", "Frage 3", "Frage 4"],
      clarificationStatusCounts: { answered: 1, unanswered: 3 }, currentSpecPlans: [], productionObjectStatusLabel: "noch kein Plan", currentSpecPurchaseLists: []
    });
    expect(summary.questionCount).toBe(4);
    expect(summary.questionCount - summary.answeredQuestionCount).toBe(3);
  });

  const base = {
    activeProductionContextLabel: "Wissenschaftliche Abendveranstaltung · 100 Gäste · 13.11.2026", focusedSpecReadinessLabel: "Prüfung nötig",
    productionPlanStatusLabel: "offen", purchaseZoneStatusLabel: "noch keine Liste", productionQuestions: [],
    clarificationStatusCounts: { answered: 0, unanswered: 0 }, currentSpecPlans: [], productionObjectStatusLabel: "noch kein Plan", currentSpecPurchaseLists: []
  };
  const requestConstraints = [
    "Zeit-/Logistikangabe aus Anfrage (ungeprüft): Empfang 18:00–19:00",
    "Zeit-/Logistikangabe aus Anfrage (ungeprüft): Abendbuffet 19:00–21:00.",
    "Sonderkost angefragt; separat klären: 4 Gäste benötigen glutenfreie Sonderkost",
    "Sonderkost-Antwort von 158c749c-1d2e-4f3a-8b9c-0d1e2f3a4b5c: Getrennte Zubereitung, eigene Ausgabe — Keine Allergen- oder Küchenfreigabe."
  ];

  it("shows a confirmed time once and keeps unconfirmed, differing and dietary evidence", () => {
    const summary = buildProductionWorkbenchSummaryState({ ...base, focusedProductionSpec: {
      event: { date: "2026-11-13", schedule: [{ label: "Empfang", start: "18:00", end: "19:00" }] },
      productionConstraints: requestConstraints
    } });
    const notes = summary.productionNotes ?? [];
    expect(notes.filter(note => note.includes("18:00"))).toEqual(["Empfang: 18:00–19:00"]);
    // Not in the confirmed schedule: stays an unverified request hint.
    expect(notes).toContain("Zeit-/Logistikangabe aus Anfrage (ungeprüft): Abendbuffet 19:00–21:00.");
    expect(notes).toContain("Sonderkost angefragt; separat klären: 4 Gäste benötigen glutenfreie Sonderkost");
    expect(notes).toContain("Sonderkost-Antwort: Getrennte Zubereitung, eigene Ausgabe — Keine Allergen- oder Küchenfreigabe.");
    expect(notes.join("\n")).not.toContain("158c749c");
    // Raw lineage remains available for the technical details.
    expect(summary.productionNoteLineage).toEqual([requestConstraints[0], requestConstraints[3]]);
  });

  it("keeps a request time that differs from the confirmed slot as an unverified hint", () => {
    const summary = buildProductionWorkbenchSummaryState({ ...base, focusedProductionSpec: {
      event: { schedule: [{ label: "Empfang", start: "18:00", end: "19:30" }] },
      productionConstraints: [requestConstraints[0], "Sonderkost-Antwort von Produktions-Mitarbeiter: Getrennt — Keine Allergen- oder Küchenfreigabe."]
    } });
    expect(summary.productionNotes).toEqual([
      requestConstraints[0],
      "Sonderkost-Antwort von Produktions-Mitarbeiter: Getrennt — Keine Allergen- oder Küchenfreigabe.",
      "Empfang: 18:00–19:30"
    ]);
    expect(summary.productionNoteLineage).toBeUndefined();
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
    expect(summary.purchaseItemCount).toBe(0);
    expect(summary.activeSpecLabel).toBe("Kein aktiver Vorgang");
  });
});
