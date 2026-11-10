import { buildProductionConversationState } from "../backoffice-ui/src/production-conversation-state.js";
import { describe, expect, it } from "vitest";
import { createEventRequestFromText } from "../shared-core/src/request-factory.js";
import { createOfferDraft } from "../shared-core/src/rules/offer.js";
import { extractEventTimeWindow } from "../shared-core/src/event-time-window.js";
import { buildProductionQuestions } from "../backoffice-ui/src/production-question-language-state.js";

describe("time window with an open event date", () => {
  it("retains a time window and asks for the missing date once in each workspace", () => {
    const request = createEventRequestFromText({ requestId: "time-window", channel: "text", rawText: "Buffet für 45 Gäste von 18 bis 21 Uhr." });
    const draft = createOfferDraft(request);
    expect(draft.proposedEventSpec.event.schedule).toEqual([{ label: "Zeitfenster", start: "18:00", end: "21:00" }]);
    expect(draft.proposedEventSpec.event.date).toBeUndefined();
    expect(draft.openQuestions.filter(q => /datum/i.test(q))).toHaveLength(1);
    expect(draft.openQuestions.join(" ")).not.toMatch(/attendees\.expected|event\.date/);
    const questions = buildProductionQuestions(draft.proposedEventSpec as unknown as Record<string, unknown>);
    expect(questions.filter(q => /datum/i.test(q))).toHaveLength(1);
    const projection = buildProductionConversationState({ focusedProductionSpec: draft.proposedEventSpec as unknown as Record<string, unknown>, currentSpecPlans: [], currentSpecPurchaseLists: [] });
    expect(projection.productionQuestions.filter(q => /datum/i.test(q))).toHaveLength(1);
    expect(projection.productionQuestions.join(" ")).not.toContain("event.date");
  });
  it("extracts all four onboarding request forms", () => {
    const samples = [
      "Angebot für 80 Gäste von 18 bis 21 Uhr mit Kürbissuppe, Hähnchenragout, Quiche und Mousse.",
      "Angebot für 80 Gäste am 20.11.2026 von 18 bis 21 Uhr mit Kürbissuppe, Hähnchenragout, Quiche und Mousse.",
      "Guten Tag, wir planen am 20.11.2026 eine Veranstaltung mit 80 Gästen von 18 bis 21 Uhr. Wir hätten gern Kürbissuppe, Hähnchenragout, Quiche und Mousse. Viele Grüße",
      "Empfang\nDatum: 20.11.2026\n80 Gäste\nZeit: von 18 bis 21 Uhr\nMenü:\n- Kürbissuppe\n- Hähnchenragout\n- Quiche\n- Mousse"
    ];
    for (const text of samples) {
      const draft = createOfferDraft(createEventRequestFromText({ requestId: "onboarding", channel: "text", rawText: text }));
      expect(draft.proposedEventSpec.event.schedule, text).toEqual([{ label: "Zeitfenster", start: "18:00", end: "21:00" }]);
    }
  });
  it("only extracts a single unambiguous forward range", () => {
    expect(extractEventTimeWindow("von 8:30 bis 10:15 Uhr")).toEqual([{ label: "Zeitfenster", start: "08:30", end: "10:15" }]);
    expect(extractEventTimeWindow("von 18 bis 21 Uhr und von 20 bis 22 Uhr")).toBeUndefined();
    expect(extractEventTimeWindow("von 23 bis 2 Uhr")).toBeUndefined();
    for (const text of ["Die Feier ist nicht von 18 bis 21 Uhr", "Das Buffet findet eventuell von 18 bis 21 Uhr statt", "Unser Büro ist von 18 bis 21 Uhr erreichbar", "Die Lieferung ist von 18 bis 21 Uhr"]) {
      expect(extractEventTimeWindow(text), text).toBeUndefined();
    }
  });
  it("translates an absent guest count for the offer", () => {
    const draft = createOfferDraft(createEventRequestFromText({ requestId: "missing-guests", channel: "text", rawText: "Buffet von 18 bis 21 Uhr" }));
    expect(draft.openQuestions.join(" ")).not.toContain("attendees.expected");
    expect(draft.openQuestions.some(q => /Gäste/.test(q))).toBe(true);
  });
});
