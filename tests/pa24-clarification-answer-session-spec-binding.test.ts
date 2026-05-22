import { describe, expect, it } from "vitest";
import {
  buildProductionClarificationQuestions,
  buildProductionConversationProjection,
  createSubmittedProductionClarificationAnswer,
  type ProductionClarificationContextBinding
} from "@catering/shared-core";

const specA = {
  specId: "spec-pa24-a",
  readiness: { status: "partial", reasons: [] },
  missingFields: ["attendees.expected"],
  event: { type: "conference" }
};

const specB = {
  specId: "spec-pa24-b",
  readiness: { status: "partial", reasons: [] },
  missingFields: ["attendees.expected"],
  event: { type: "conference" }
};

function contextFor(specId: string): ProductionClarificationContextBinding {
  return {
    specId,
    productionSessionId: `production-session-${specId}`
  };
}

describe("PA24 clarification answer session/spec binding anchor", () => {
  it("anchors submitted answers to the existing spec and production conversation session context", () => {
    const [question] = buildProductionClarificationQuestions({ spec: specA });

    const answer = createSubmittedProductionClarificationAnswer({
      questions: [question],
      context: contextFor(specA.specId),
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      answerText: "42 Personen",
      now: "2026-05-22T08:00:00.000Z"
    });

    expect(question.context).toEqual(contextFor(specA.specId));
    expect(answer.context).toEqual(contextFor(specA.specId));

    const projection = buildProductionConversationProjection({
      spec: specA,
      questions: [],
      clarificationAnswers: [answer],
      productionPlans: [],
      purchaseLists: []
    });

    expect(projection.sessionId).toBe(contextFor(specA.specId).productionSessionId);
    expect(projection.sourceSpecId).toBe(specA.specId);
    expect(projection.messages.filter((message) => message.type === "user_structured_answer")).toHaveLength(1);
  });

  it("does not project an otherwise matching answer into a different spec/session context", () => {
    const [questionA] = buildProductionClarificationQuestions({ spec: specA });
    const answerForA = createSubmittedProductionClarificationAnswer({
      questions: [questionA],
      context: contextFor(specA.specId),
      questionId: questionA.questionId,
      questionKey: { reason: questionA.reason, reasonCode: questionA.reasonCode },
      answerType: "shortText",
      answerText: "42 Personen",
      now: "2026-05-22T08:01:00.000Z"
    });

    const forgedForB = {
      ...answerForA,
      answerId: "answer-forged-cross-session",
      questionId: "spec-pa24-b-missingFields-attendees-expected",
      context: contextFor(specA.specId)
    };

    const projection = buildProductionConversationProjection({
      spec: specB,
      questions: [],
      clarificationAnswers: [forgedForB],
      productionPlans: [],
      purchaseLists: []
    });

    expect(projection.sessionId).toBe(contextFor(specB.specId).productionSessionId);
    expect(projection.messages.filter((message) => message.type === "user_structured_answer")).toHaveLength(0);
  });

  it("rejects answers when the existing spec/session binding is missing or mismatched", () => {
    const [question] = buildProductionClarificationQuestions({ spec: specA });
    const baseInput = {
      questions: [question],
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      answerText: "42 Personen"
    };

    expect(() =>
      createSubmittedProductionClarificationAnswer({
        ...baseInput,
        context: undefined as never
      })
    ).toThrow("Eindeutige Spec-/Session-Bindung erforderlich.");

    expect(() =>
      createSubmittedProductionClarificationAnswer({
        ...baseInput,
        context: contextFor(specB.specId)
      })
    ).toThrow("Spec-/Session-Bindung passt nicht zur Rückfrage.");

    const [draftQuestion] = buildProductionClarificationQuestions({
      spec: { readiness: { status: "partial", reasons: [] }, missingFields: ["attendees.expected"] }
    });
    expect(draftQuestion.context).toBeUndefined();
    expect(() =>
      createSubmittedProductionClarificationAnswer({
        questions: [draftQuestion],
        context: contextFor("draft"),
        questionId: draftQuestion.questionId,
        questionKey: { reason: draftQuestion.reason, reasonCode: draftQuestion.reasonCode },
        answerType: "shortText",
        answerText: "42 Personen"
      })
    ).toThrow("Rückfrage ohne eindeutige Spec-/Session-Bindung kann nicht beantwortet werden.");
  });
});
