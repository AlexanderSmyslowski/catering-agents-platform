import { describe, expect, it } from "vitest";
import { buildProductionClarificationQuestions, buildProductionConversationProjection } from "@catering/shared-core";

const safeSourceMetadata = {
  filename: "angebot-pa16.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  sha256: "ddddddddddddeeeeeeeeeeeeffffffffffffffffaaaaaaaabbbbbbbbbbbbcccccccc",
  ingestedAt: "2026-05-21T11:00:00.000Z",
  uploadContext: "intake"
};

describe("PA16 production clarification model slice 1", () => {
  it("creates typed clarification questions from missing fields and readiness reasons", () => {
    const questions = buildProductionClarificationQuestions({
      spec: {
        specId: "spec-pa16-missing",
        readiness: {
          status: "partial",
          reasons: ["Teilnehmerzahl noch nicht verbindlich."]
        },
        missingFields: ["attendees.expected"]
      },
      sourceInputs: []
    });

    expect(questions).toEqual([
      {
        questionId: "spec-pa16-missing-missingFields-attendees-expected",
        reason: "missingFields",
        reasonCode: "attendees.expected",
        severity: "blocking",
        blocking: true,
        prompt: "Bitte klären: attendees.expected.",
        sourceAnchors: [],
        suggestedAnswerType: "short_text"
      },
      {
        questionId: "spec-pa16-missing-readiness-reasons-1",
        reason: "readiness.reasons",
        reasonCode: "readiness_reason",
        severity: "warning",
        blocking: false,
        prompt: "Bitte prüfen: Teilnehmerzahl noch nicht verbindlich.",
        sourceAnchors: [],
        suggestedAnswerType: "short_text"
      }
    ]);
  });

  it("creates typed clarification questions from fallback or warning document ingestion markers without raw text", () => {
    const questions = buildProductionClarificationQuestions({
      spec: { specId: "spec-pa16-ingestion", readiness: { status: "complete", reasons: [] } },
      sourceInputs: [
        {
          kind: "pdf",
          content: "%PDF Rohtext darf nie in der Rückfrage erscheinen.",
          documentId: "document-pa16-1",
          documentIngestion: {
            status: "fallback",
            warnings: ["document_text_extraction_fallback"]
          },
          sourceMetadata: safeSourceMetadata
        }
      ]
    });

    expect(questions).toEqual([
      {
        questionId: "spec-pa16-ingestion-documentIngestion-status-document-pa16-1",
        reason: "documentIngestion.status",
        reasonCode: "fallback",
        severity: "blocking",
        blocking: true,
        prompt: "Bitte Quelle prüfen: angebot-pa16.pdf wurde nur unsicher/fallback verarbeitet.",
        sourceAnchors: [
          {
            documentId: "document-pa16-1",
            filename: "angebot-pa16.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            sha256Short: "dddddddddddd",
            ingestedAt: "2026-05-21T11:00:00.000Z",
            uploadContext: "intake",
            ingestionStatus: "fallback",
            ingestionWarnings: ["document_text_extraction_fallback"]
          }
        ],
        suggestedAnswerType: "confirm_or_correct"
      },
      {
        questionId: "spec-pa16-ingestion-documentIngestion-warnings-document-pa16-1-1",
        reason: "documentIngestion.warnings",
        reasonCode: "document_text_extraction_fallback",
        severity: "warning",
        blocking: false,
        prompt: "Bitte Ingestion-Warnung prüfen: document_text_extraction_fallback.",
        sourceAnchors: [
          {
            documentId: "document-pa16-1",
            filename: "angebot-pa16.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            sha256Short: "dddddddddddd",
            ingestedAt: "2026-05-21T11:00:00.000Z",
            uploadContext: "intake",
            ingestionStatus: "fallback",
            ingestionWarnings: ["document_text_extraction_fallback"]
          }
        ],
        suggestedAnswerType: "confirm_or_correct"
      }
    ]);
    expect(JSON.stringify(questions)).not.toContain("%PDF Rohtext");
  });

  it("keeps extracted ok sources quiet and transports clarification questions read-only in the existing projection", () => {
    const projection = buildProductionConversationProjection({
      spec: { specId: "spec-pa16-ok", readiness: { status: "complete", reasons: [] }, missingFields: [] },
      questions: [],
      sourceInputs: [
        {
          kind: "text",
          content: "Extrahierter Inhalt darf nicht gespiegelt werden.",
          documentId: "document-pa16-ok",
          documentIngestion: { status: "extracted", warnings: [] },
          sourceMetadata: { ...safeSourceMetadata, filename: "angebot-pa16.txt", mimeType: "text/plain" }
        }
      ],
      productionPlans: [],
      purchaseLists: []
    });

    expect(projection.messages.some((message) => message.type === "structured_agent_question")).toBe(false);
    expect(JSON.stringify(projection.messages)).not.toContain("Extrahierter Inhalt");

    const clarificationProjection = buildProductionConversationProjection({
      spec: { specId: "spec-pa16-projection", readiness: { status: "partial", reasons: [] }, missingFields: ["event.date"] },
      questions: [],
      sourceInputs: [],
      productionPlans: [],
      purchaseLists: []
    });

    const questionMessage = clarificationProjection.messages.find((message) => message.type === "structured_agent_question");
    expect(questionMessage).toMatchObject({
      role: "agent",
      title: "Agent fragt",
      text: "Bitte klären: event.date.",
      questionIndex: 1,
      clarificationQuestion: {
        questionId: "spec-pa16-projection-missingFields-event-date",
        reason: "missingFields",
        blocking: true
      }
    });
  });
});
