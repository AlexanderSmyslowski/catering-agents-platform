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
    const context = {
      specId: "spec-pa16-missing",
      productionSessionId: "production-session-spec-pa16-missing"
    };
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
        context,
        reason: "missingFields",
        reasonCode: "attendees.expected",
        severity: "blocking",
        blocking: true,
        prompt: "Bitte klären: erwartete Personenzahl.",
        sourceAnchors: [],
        suggestedAnswerType: "short_text"
      },
      {
        questionId: "spec-pa16-missing-readiness-reasons-teilnehmerzahl-noch-nicht-verbindlich",
        context,
        reason: "readiness.reasons",
        reasonCode: "Teilnehmerzahl noch nicht verbindlich.",
        severity: "warning",
        blocking: false,
        prompt: "Bitte prüfen: Teilnehmerzahl noch nicht verbindlich.",
        sourceAnchors: [],
        suggestedAnswerType: "short_text"
      }
    ]);
  });

  it("keeps complete readiness confirmation quiet after structured production answers", () => {
    const questions = buildProductionClarificationQuestions({
      spec: {
        specId: "spec-pa16-complete-confirmation",
        readiness: {
          status: "complete",
          reasons: ["Alle Pflichtangaben für die Produktionsplanung sind vorhanden."]
        },
        missingFields: []
      },
      sourceInputs: []
    });

    expect(questions).toEqual([]);
  });

  it("creates typed clarification questions from fallback or warning document ingestion markers without raw text", () => {
    const context = {
      specId: "spec-pa16-ingestion",
      productionSessionId: "production-session-spec-pa16-ingestion"
    };
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
        context,
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
        questionId: "spec-pa16-ingestion-documentIngestion-warnings-document-pa16-1-document-text-extraction-fallback",
        context,
        reason: "documentIngestion.warnings",
        reasonCode: "document_text_extraction_fallback",
        severity: "warning",
        blocking: false,
        prompt: "Bitte Ingestion-Warnung prüfen: Textextraktion unsicher.",
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

  it("deduplicates identical causes and orders blocking questions before warnings deterministically", () => {
    const questions = buildProductionClarificationQuestions({
      spec: {
        specId: "spec-pa17-quality",
        readiness: {
          status: "partial",
          reasons: ["Teilnehmerzahl noch nicht verbindlich.", "Teilnehmerzahl noch nicht verbindlich."]
        },
        missingFields: ["event.date", "attendees.expected", "event.date"]
      },
      sourceInputs: [
        {
          kind: "pdf",
          content: "Rohtext darf nicht gespiegelt werden.",
          documentId: "document-pa17-1",
          documentIngestion: {
            status: "fallback",
            warnings: ["document_text_extraction_fallback", "document_text_extraction_fallback"]
          },
          sourceMetadata: safeSourceMetadata
        }
      ]
    });

    expect(questions.map((question) => question.questionId)).toEqual([
      "spec-pa17-quality-missingFields-attendees-expected",
      "spec-pa17-quality-missingFields-event-date",
      "spec-pa17-quality-documentIngestion-status-document-pa17-1",
      "spec-pa17-quality-documentIngestion-warnings-document-pa17-1-document-text-extraction-fallback",
      "spec-pa17-quality-readiness-reasons-teilnehmerzahl-noch-nicht-verbindlich"
    ]);
    expect(questions.map((question) => question.severity)).toEqual(["blocking", "blocking", "blocking", "warning", "warning"]);
    expect(new Set(questions.map((question) => question.questionId)).size).toBe(questions.length);
    expect(JSON.stringify(questions)).not.toContain("Rohtext darf nicht gespiegelt werden");
  });

  it("uses neutral human-readable labels for known keys and safe technical fallback for unknown keys", () => {
    const questions = buildProductionClarificationQuestions({
      spec: {
        specId: "spec-pa17-labels",
        readiness: { status: "partial", reasons: ["custom.unknown_reason"] },
        missingFields: ["event.date", "custom.unknown_field", "extractedText"]
      },
      sourceInputs: [
        {
          kind: "pdf",
          content: "Dieser extrahierte Text darf nicht im Prompt stehen.",
          documentId: "document-pa17-labels",
          documentIngestion: {
            status: "fallback",
            warnings: ["document_text_extraction_fallback", "unknown_warning_key"]
          },
          sourceMetadata: safeSourceMetadata
        }
      ]
    });

    expect(questions.find((question) => question.reasonCode === "event.date")?.prompt).toBe("Bitte klären: Veranstaltungsdatum.");
    expect(questions.find((question) => question.reasonCode === "document_text_extraction_fallback")?.prompt).toBe(
      "Bitte Ingestion-Warnung prüfen: Textextraktion unsicher."
    );
    expect(questions.find((question) => question.reasonCode === "custom.unknown_field")?.prompt).toBe(
      "Bitte klären: custom.unknown_field."
    );
    expect(questions.find((question) => question.reasonCode === "unknown_warning_key")?.prompt).toBe(
      "Bitte Ingestion-Warnung prüfen: unknown_warning_key."
    );
    expect(JSON.stringify(questions)).not.toContain("Dieser extrahierte Text");
    expect(JSON.stringify(questions)).not.toContain("extractedText");
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
      title: "Agent fragt · offen",
      text: "Bitte klären: Veranstaltungsdatum.",
      questionIndex: 1,
      clarificationQuestion: {
        questionId: "spec-pa16-projection-missingFields-event-date",
        reason: "missingFields",
        blocking: true
      }
    });
  });
});
