import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProductionClarificationQuestions,
  buildProductionConversationProjection,
  createSubmittedProductionClarificationAnswer,
  type ProductionClarificationQuestion
} from "@catering/shared-core";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";

const specWithClarification = {
  specId: "spec-pa23-1",
  readiness: { status: "partial", reasons: [] },
  missingFields: ["attendees.expected"],
  event: { type: "conference" }
};

const specContext = {
  specId: specWithClarification.specId,
  productionSessionId: `production-session-${specWithClarification.specId}`
};

function firstQuestion(): ProductionClarificationQuestion {
  const [question] = buildProductionClarificationQuestions({ spec: specWithClarification });
  if (!question) {
    throw new Error("Expected PA23 clarification question fixture to create a question");
  }
  return question;
}

function createTempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-pa23-"));
}

let tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  tempRoots = [];
});

describe("PA23 clarification answer runtime minimal slice", () => {
  it("stores a submitted shortText answer for an existing clarification question and displays it read-only in the production conversation projection", async () => {
    const question = firstQuestion();
    const answer = createSubmittedProductionClarificationAnswer({
      questions: [question],
      context: specContext,
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      answerText: "  42 Personen final bestätigt.  ",
      actorName: "Kuechenleitung",
      now: "2026-05-21T12:00:00.000Z"
    });

    expect(answer).toMatchObject({
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      status: "submitted",
      answerText: { kind: "shortText", value: "42 Personen final bestätigt." },
      actor: { actorName: "Kuechenleitung" },
      createdAt: "2026-05-21T12:00:00.000Z",
      updatedAt: "2026-05-21T12:00:00.000Z"
    });

    const dataRoot = createTempRoot();
    tempRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    await store.saveClarificationAnswer(answer);

    const storedAnswers = await store.listClarificationAnswers();
    expect(storedAnswers).toHaveLength(1);
    expect(storedAnswers[0]).toEqual(answer);
    expect(await store.getClarificationAnswer(answer.answerId)).toEqual(answer);

    const projection = buildProductionConversationProjection({
      spec: specWithClarification,
      questions: [],
      clarificationAnswers: storedAnswers,
      productionPlans: [],
      purchaseLists: []
    });

    const answerMessage = projection.messages.find(
      (message) => message.type === "user_structured_answer" && message.messageId.includes(answer.answerId)
    );
    expect(answerMessage).toMatchObject({
      role: "user",
      title: "Antwort auf Rückfrage",
      text: "42 Personen final bestätigt.",
      clarificationAnswer: answer
    });
  });

  it("rejects unknown question ids and mismatching stable question keys", () => {
    const question = firstQuestion();

    expect(() =>
      createSubmittedProductionClarificationAnswer({
        questions: [question],
        context: specContext,
        questionId: "unknown-question-id",
        questionKey: { reason: question.reason, reasonCode: question.reasonCode },
        answerType: "shortText",
        answerText: "42 Personen"
      })
    ).toThrow("Bekannte Rückfrage erforderlich.");

    expect(() =>
      createSubmittedProductionClarificationAnswer({
        questions: [question],
        context: specContext,
        questionId: question.questionId,
        questionKey: { reason: question.reason, reasonCode: "wrong-key" },
        answerType: "shortText",
        answerText: "42 Personen"
      })
    ).toThrow("Question-Key passt nicht zur Rückfrage.");
  });

  it("rejects wrong answer type empty answers and answers over 500 characters", () => {
    const question = firstQuestion();
    const baseInput = {
      questions: [question],
      context: specContext,
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode }
    };

    expect(() =>
      createSubmittedProductionClarificationAnswer({
        ...baseInput,
        answerType: "yesNo",
        answerText: "Ja"
      })
    ).toThrow("Nur shortText-Antworten sind aktiv erlaubt.");

    expect(() =>
      createSubmittedProductionClarificationAnswer({
        ...baseInput,
        answerType: "shortText",
        answerText: "   \n\t  "
      })
    ).toThrow("Antwort darf nicht leer sein.");

    expect(() =>
      createSubmittedProductionClarificationAnswer({
        ...baseInput,
        answerType: "shortText",
        answerText: "x".repeat(501)
      })
    ).toThrow("Antwort darf maximal 500 Zeichen lang sein.");
  });

  it("escapes HTML and script input for read-only display without triggering domain interpretation or spec correction", () => {
    const question = firstQuestion();
    const answer = createSubmittedProductionClarificationAnswer({
      questions: [question],
      context: specContext,
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      answerText: "<script>alert('x')</script><b>42</b>",
      now: "2026-05-21T12:01:00.000Z"
    });

    expect(answer.status).toBe("submitted");
    expect(answer.status).not.toBe("draft");
    expect(answer.status).not.toBe("reviewed");
    expect(answer.answerText.value).toBe("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&lt;b&gt;42&lt;/b&gt;");
    expect(answer.answerText.value).not.toContain("<script>");
    expect(answer.answerText.value).not.toContain("<b>");

    const projection = buildProductionConversationProjection({
      spec: specWithClarification,
      questions: [],
      clarificationAnswers: [answer],
      productionPlans: [],
      purchaseLists: []
    });
    const serializedProjection = JSON.stringify(projection.messages);

    expect(serializedProjection).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&lt;b&gt;42&lt;/b&gt;");
    expect(serializedProjection).not.toContain("<script>");
    expect(serializedProjection).not.toContain("<b>");
    expect(JSON.stringify(specWithClarification)).not.toContain("42");
    expect(projection.messages.some((message) => message.type === "production_output_anchor")).toBe(false);
  });

  it("sanitizes forged persisted answers before projection display", () => {
    const question = firstQuestion();
    const forgedRawAnswer = {
      answerId: "answer-forged-raw-html",
      context: specContext,
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      status: "submitted",
      answerText: { kind: "shortText", value: "<img src=x onerror=alert('x')>" }
    } as never;

    const projection = buildProductionConversationProjection({
      spec: specWithClarification,
      questions: [],
      clarificationAnswers: [forgedRawAnswer],
      productionPlans: [],
      purchaseLists: []
    });

    const answerMessage = projection.messages.find(
      (message) => message.type === "user_structured_answer" && message.messageId.includes("answer-forged-raw-html")
    );
    const serializedProjection = JSON.stringify(projection.messages);

    expect(answerMessage?.text).toBe("&lt;img src=x onerror=alert(&#39;x&#39;)&gt;");
    expect(answerMessage?.clarificationAnswer?.answerText.value).toBe("&lt;img src=x onerror=alert(&#39;x&#39;)&gt;");
    expect(serializedProjection).not.toContain("<img");
    expect(serializedProjection).not.toContain("onerror=alert('x')");
  });

  it("does not display answers for other missing questions draft reviewed or wrong typed answers", () => {
    const question = firstQuestion();
    const baseAnswer = createSubmittedProductionClarificationAnswer({
      questions: [question],
      context: specContext,
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      answerText: "42 Personen",
      now: "2026-05-21T12:02:00.000Z"
    });

    const projection = buildProductionConversationProjection({
      spec: specWithClarification,
      questions: [],
      clarificationAnswers: [
        { ...baseAnswer, answerId: "answer-wrong-key", questionKey: { ...baseAnswer.questionKey, reasonCode: "wrong-key" } },
        { ...baseAnswer, answerId: "answer-draft", status: "draft" },
        { ...baseAnswer, answerId: "answer-reviewed", status: "reviewed" },
        { ...baseAnswer, answerId: "answer-wrong-type", answerType: "yesNo" },
        { ...baseAnswer, answerId: "answer-wrong-kind", answerText: { kind: "longText", value: "42 Personen" } }
      ] as never,
      productionPlans: [],
      purchaseLists: []
    });

    const answerMessages = projection.messages.filter((message) => message.type === "user_structured_answer");
    expect(answerMessages).toHaveLength(0);
  });

  it("rejects invalid clarification answer records at the production store boundary", async () => {
    const question = firstQuestion();
    const validAnswer = createSubmittedProductionClarificationAnswer({
      questions: [question],
      context: specContext,
      questionId: question.questionId,
      questionKey: { reason: question.reason, reasonCode: question.reasonCode },
      answerType: "shortText",
      answerText: "42 Personen",
      now: "2026-05-21T12:03:00.000Z"
    });
    const dataRoot = createTempRoot();
    tempRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });

    await expect(store.saveClarificationAnswer({ ...validAnswer, status: "draft" } as never)).rejects.toThrow(
      "Nur submitted shortText-Klärungsantworten dürfen gespeichert werden."
    );
    await expect(store.saveClarificationAnswer({ ...validAnswer, answerType: "yesNo" } as never)).rejects.toThrow(
      "Nur submitted shortText-Klärungsantworten dürfen gespeichert werden."
    );
    await expect(
      store.saveClarificationAnswer({ ...validAnswer, answerText: { kind: "longText", value: "42 Personen" } } as never)
    ).rejects.toThrow("Nur submitted shortText-Klärungsantworten dürfen gespeichert werden.");
    await expect(store.saveClarificationAnswer({ ...validAnswer, answerText: undefined } as never)).rejects.toThrow(
      "Nur submitted shortText-Klärungsantworten dürfen gespeichert werden."
    );
    await expect(
      store.saveClarificationAnswer({ ...validAnswer, answerText: { kind: "shortText", value: "x".repeat(501) } } as never)
    ).rejects.toThrow("Nur submitted shortText-Klärungsantworten dürfen gespeichert werden.");

    expect(await store.listClarificationAnswers()).toEqual([]);

    await store.saveClarificationAnswer({
      ...validAnswer,
      answerId: "answer-store-raw-html",
      answerText: { kind: "shortText", value: "<script>alert('store')</script>" }
    });
    expect((await store.getClarificationAnswer("answer-store-raw-html"))?.answerText.value).toBe(
      "&lt;script&gt;alert(&#39;store&#39;)&lt;/script&gt;"
    );
  });
});
