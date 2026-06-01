import { llmReadinessContractVersion } from "../llm-readiness.js";

export const llmReadinessEvalFixtures = [
  {
    fixtureId: "llm-eval-synthetic-coffee-break-missing-attendees",
    title: "Synthetic coffee break clarification draft for missing attendee count",
    input: {
      contractVersion: llmReadinessContractVersion,
      inputId: "input-llm-eval-coffee-break-001",
      kind: "clarification_draft_request",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-coffee-break",
          label: "synthetic coffee break spec"
        }
      ],
      policy: {
        providerCalls: "disabled",
        dataMode: "synthetic_or_demo_only",
        allowedToolEffects: ["read", "draft"]
      }
    },
    expectedOutput: {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-llm-eval-coffee-break-001",
      kind: "clarification_question_draft",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-coffee-break",
          label: "synthetic coffee break spec"
        }
      ],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: "Bitte klaeren, fuer wie viele Personen die Kaffeepause geplant werden soll.",
      structuredCandidate: {
        reason: "missingFields",
        reasonCode: "attendees.expected"
      }
    },
    disallowedPayloadKeys: [
      "rawText",
      "extractedText",
      "prompt",
      "messages",
      "providerResponse",
      "toolCalls",
      "secret",
      "apiKey"
    ]
  },
  {
    fixtureId: "llm-eval-synthetic-buffet-operator-summary",
    title: "Synthetic buffet operator summary draft from existing product objects",
    input: {
      contractVersion: llmReadinessContractVersion,
      inputId: "input-llm-eval-buffet-summary-001",
      kind: "operator_summary_request",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-buffet",
          label: "synthetic buffet spec"
        },
        {
          objectType: "production_plan",
          objectId: "plan-synthetic-buffet",
          label: "synthetic buffet production plan"
        },
        {
          objectType: "purchase_list",
          objectId: "purchase-synthetic-buffet",
          label: "synthetic buffet purchase list"
        }
      ],
      policy: {
        providerCalls: "disabled",
        dataMode: "synthetic_or_demo_only",
        allowedToolEffects: ["read"]
      }
    },
    expectedOutput: {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-llm-eval-buffet-summary-001",
      kind: "operator_summary_draft",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-buffet",
          label: "synthetic buffet spec"
        },
        {
          objectType: "production_plan",
          objectId: "plan-synthetic-buffet",
          label: "synthetic buffet production plan"
        },
        {
          objectType: "purchase_list",
          objectId: "purchase-synthetic-buffet",
          label: "synthetic buffet purchase list"
        }
      ],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: "Entwurf fuer Operatoren: Buffet-Spezifikation, Produktionsplan und Einkaufsliste liegen als synthetische Arbeitsbelege vor.",
      structuredCandidate: {
        summaryKind: "operator_context",
        dataMode: "synthetic_or_demo_only"
      }
    },
    disallowedPayloadKeys: [
      "rawText",
      "extractedText",
      "prompt",
      "messages",
      "providerResponse",
      "toolCalls",
      "secret",
      "apiKey"
    ]
  }
];
