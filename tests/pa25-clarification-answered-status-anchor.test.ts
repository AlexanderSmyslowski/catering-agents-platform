import { describe, expect, it } from "vitest";
import {
  buildProductionClarificationQuestions,
  buildProductionConversationProjection,
  createSubmittedProductionClarificationAnswer,
  type ProductionClarificationAnswer,
  type ProductionClarificationContextBinding
} from "@catering/shared-core";

const spec = {
  specId: "spec-pa25",
  readiness: { status: "partial", reasons: [] },
  missingFields: ["attendees.expected"],
  event: { type: "conference" }
};

const context: ProductionClarificationContextBinding = {
  specId: spec.specId,
  productionSessionId: `production-session-${spec.specId}`
};

function firstQuestion() {
  const [question] = buildProductionClarificationQuestions({ spec });
  if (!question) {
    throw new Error("Expected PA25 fixture to create a clarification question");
  }
  return question;
}

function submittedAnswer(answerText = "42 Personen final bestätigt."): ProductionClarificationAnswer {
  const question = firstQuestion();
  return createSubmittedProductionClarificationAnswer({
    questions: [question],
    context,
    questionId: question.questionId,
    questionKey: { reason: question.reason, reasonCode: question.reasonCode },
    answerType: "shortText",
    answerText,
    now: "2026-05-22T10:00:00.000Z"
  });
}

function projectedQuestionStatus(answers: ProductionClarificationAnswer[]) {
  const projection = buildProductionConversationProjection({
    spec,
    questions: [],
    clarificationAnswers: answers,
    productionPlans: [],
    purchaseLists: []
  });
  const questionMessage = projection.messages.find((message) => message.type === "structured_agent_question");
  if (!questionMessage) {
    throw new Error("Expected projection to contain a structured clarification question");
  }
  return { projection, questionMessage };
}

describe("PA25 clarification answered status anchor", () => {
  it("marks a clarification question as unanswered when no matching submitted shortText answer exists", () => {
    const { questionMessage } = projectedQuestionStatus([]);

    expect(questionMessage.clarificationAnswerStatus).toBe("unanswered");
  });

  it("marks a clarification question as answered only for a matching submitted shortText answer in the same spec/session context", () => {
    const { projection, questionMessage } = projectedQuestionStatus([submittedAnswer()]);

    expect(questionMessage.clarificationAnswerStatus).toBe("answered");
    expect(projection.messages.filter((message) => message.type === "user_structured_answer")).toHaveLength(1);
  });

  it("keeps the question unanswered for wrong spec/session context wrong question key draft reviewed wrong type or malformed answers", () => {
    const answer = submittedAnswer();
    const invalidAnswers = [
      { ...answer, answerId: "answer-wrong-context", context: { specId: "other-spec", productionSessionId: "production-session-other-spec" } },
      { ...answer, answerId: "answer-wrong-session", context: { specId: context.specId, productionSessionId: "production-session-other" } },
      { ...answer, answerId: "answer-wrong-reason", questionKey: { ...answer.questionKey, reasonCode: "wrong-key" } },
      { ...answer, answerId: "answer-draft", status: "draft" },
      { ...answer, answerId: "answer-reviewed", status: "reviewed" },
      { ...answer, answerId: "answer-wrong-type", answerType: "yesNo" },
      { ...answer, answerId: "answer-malformed", answerText: { kind: "longText", value: "42 Personen" } }
    ] as never as ProductionClarificationAnswer[];

    const { projection, questionMessage } = projectedQuestionStatus(invalidAnswers);

    expect(questionMessage.clarificationAnswerStatus).toBe("unanswered");
    expect(projection.messages.filter((message) => message.type === "user_structured_answer")).toHaveLength(0);
  });

  it("keeps escaped answer display read-only and does not trigger spec correction or domain output", () => {
    const answer = submittedAnswer("<script>alert('x')</script><b>42</b>");
    const { projection, questionMessage } = projectedQuestionStatus([answer]);
    const serializedProjection = JSON.stringify(projection.messages);

    expect(questionMessage.clarificationAnswerStatus).toBe("answered");
    expect(serializedProjection).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&lt;b&gt;42&lt;/b&gt;");
    expect(serializedProjection).not.toContain("<script>");
    expect(serializedProjection).not.toContain("<b>");
    expect(JSON.stringify(spec)).not.toContain("42");
    expect(projection.messages.some((message) => message.type === "production_output_anchor")).toBe(false);
  });
});
