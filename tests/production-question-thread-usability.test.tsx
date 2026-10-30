// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProductionConversationProjection } from "../shared-core/src/conversation-projection.js";
import { ProductionQuestionThread } from "../backoffice-ui/src/production-question-thread.js";
import { ProductionConversationalWorkbench } from "../backoffice-ui/src/production-workbench.js";

function renderQuestions() {
  const projection: ProductionConversationProjection = {
    sessionId: "synthetic-session",
    messages: [
      { messageId: "context", type: "system_agent_hint", role: "system", title: "Session-Grundlage", text: "Kein freier LLM-Chat." },
      { messageId: "source", type: "source_provenance_anchor", role: "system", title: "Quellenanker", text: "sha256:synthetic-only" },
      { messageId: "warning", type: "ingestion_warning_anchor", role: "system", title: "Quelle prüfen", text: "PDF-Text nur unsicher extrahiert" },
      { messageId: "question", type: "structured_agent_question", role: "agent", title: "Agent fragt · offen", text: "Welche Ernährungskennzeichnung gilt für das Ofengemüse?", questionIndex: 1, clarificationAnswerStatus: "unanswered" },
      { messageId: "answer", type: "user_structured_answer", role: "user", title: "Antwort auf Rückfrage", text: "Vegan bestätigt", questionIndex: 1,
        clarificationAnswer: { answerId: "answer", context: { specId: "synthetic-spec", productionSessionId: "synthetic-session" }, questionId: "question", questionKey: { reason: "readiness.reasons", reasonCode: "menuPlan" }, answerType: "shortText", status: "submitted", answerText: { kind: "shortText", value: "Vegan bestätigt" } } },
      { messageId: "output", type: "production_output_anchor", role: "agent", title: "Produktionsoutput / Downloadanker", text: "Technischer Ergebnisanker" }
    ]
  };
  const node = document.createElement("div");
  node.innerHTML = renderToStaticMarkup(createElement(ProductionQuestionThread, {
    specLabel: "Synthetischer Auftrag · 100 Gäste", facts: [], questionCount: 1,
    readinessLabel: "Prüfung nötig", currentSpecPurchaseLists: [],
    productionConversationProjection: projection,
    answerEditor: createElement("button", {}, "Antwort bearbeiten")
  }));
  return node;
}

describe("production questions as an office task list", () => {
  it("shows numbered questions and their answers without chat avatars or agent jargon", () => {
    const node = renderQuestions();
    const list = node.querySelector('ol[aria-label="Rückfragen zum Auftrag"]');
    expect(list?.textContent).toContain("Frage 1 von 1");
    expect(list?.textContent).toContain("Welche Ernährungskennzeichnung gilt");
    expect(list?.textContent).toContain("Rückfrage offen");
    expect(list?.textContent).toContain("Vegan bestätigt");
    expect(list?.textContent).not.toContain("Agent fragt");
    expect(node.querySelector(".structured-chat-avatar")).toBeNull();
    expect(list?.querySelector("button")).toBeNull();
    expect(node.querySelector("button")?.textContent).toBe("Antwort bearbeiten");
  });

  it("keeps source quality warnings visible while technical provenance starts collapsed", () => {
    const node = renderQuestions();
    const details = node.querySelector("details.production-question-provenance");
    expect(details?.hasAttribute("open")).toBe(false);
    expect(details?.textContent).toContain("sha256:synthetic-only");
    const warning = Array.from(node.querySelectorAll("p")).find(p => p.textContent?.includes("PDF-Text nur unsicher"));
    expect(warning).toBeTruthy();
    expect(warning?.closest("details")).toBeNull();
  });

  it("places the actionable questions before detailed planning evidence", () => {
    const html = renderToStaticMarkup(createElement(ProductionConversationalWorkbench, {
      summary: { hasActiveContext: true, activeSpecLabel: "Synthetisch", readinessLabel: "Prüfung nötig", planStatusLabel: "offen", purchaseStatusLabel: "noch keine Liste", questionCount: 4, answeredQuestionCount: 0, unansweredQuestionCount: 4, productionObjectCount: 0, productionObjectStatusLabel: "noch kein Plan", purchaseListCount: 0 },
      nextStep: { title: "Rückfragen prüfen", description: "Vier Rückfragen" },
      miniPilotRawResult: "", setMiniPilotRawResult: () => {}, miniPilotReportState: {} as never,
      slots: { inputSlot: createElement("div", {}, "REVIEW_CONTROLS"), planningSlot: createElement("div", {}, "PLANNING_EVIDENCE"), questionsSlot: createElement("div", {}, "ACTIONABLE_QUESTIONS"), productionObjectsSlot: null, purchaseListSlot: null, lowerSlots: null }
    }));
    expect(html.indexOf("ACTIONABLE_QUESTIONS")).toBeLessThan(html.indexOf("REVIEW_CONTROLS"));
    expect(html.indexOf("REVIEW_CONTROLS")).toBeLessThan(html.indexOf("PLANNING_EVIDENCE"));
  });
});
