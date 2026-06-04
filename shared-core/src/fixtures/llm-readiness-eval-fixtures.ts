import {
  llmReadinessContractVersion,
  llmReadinessForbiddenPayloadKeys,
  validateLlmReadinessModelInputCandidate,
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelInput,
  type LlmReadinessModelInputKind,
  type LlmReadinessModelOutputCandidate
} from "../llm-readiness.js";
import {
  findLlmReadinessDraftContractByInputKind,
  llmReadinessDraftContracts,
  type LlmReadinessDraftContract
} from "../llm-readiness-draft-registry.js";

export interface LlmReadinessEvalFixture {
  fixtureId: string;
  title: string;
  input: LlmReadinessModelInput;
  expectedOutput: LlmReadinessModelOutputCandidate;
  disallowedPayloadKeys: string[];
}

export interface LlmReadinessEvalFixtureValidation {
  valid: boolean;
  errors: string[];
}

export interface LlmReadinessEvalFixtureCoverageValidation {
  valid: boolean;
  errors: string[];
}

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
] as const satisfies readonly LlmReadinessEvalFixture[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

interface SourceRefIdentity {
  objectType: unknown;
  objectId: unknown;
}

function collectSourceRefs(sourceRefs: unknown): SourceRefIdentity[] {
  if (!Array.isArray(sourceRefs)) {
    return [];
  }

  return sourceRefs
    .filter(isRecord)
    .map((sourceRef) => ({
      objectType: sourceRef.objectType,
      objectId: sourceRef.objectId
    }));
}

function collectSourceObjectTypes(sourceRefs: unknown): unknown[] {
  return collectSourceRefs(sourceRefs).map((sourceRef) => sourceRef.objectType);
}

function getFixtureId(fixture: unknown, index: number): string {
  return isRecord(fixture) && typeof fixture.fixtureId === "string" ? fixture.fixtureId : `fixture[${index}]`;
}

function fixtureCoversDraftContract(fixture: unknown, contract: LlmReadinessDraftContract): boolean {
  return (
    isRecord(fixture) &&
    isRecord(fixture.input) &&
    isRecord(fixture.expectedOutput) &&
    fixture.input.kind === contract.inputKind &&
    fixture.expectedOutput.kind === contract.outputKind &&
    validateLlmReadinessEvalFixture(fixture).valid
  );
}

export function validateLlmReadinessEvalFixture(
  fixture: unknown
): LlmReadinessEvalFixtureValidation {
  const errors: string[] = [];

  if (!isRecord(fixture)) {
    return { valid: false, errors: ["fixture must be an object"] };
  }

  if (typeof fixture.fixtureId !== "string" || !fixture.fixtureId.includes("synthetic")) {
    errors.push("fixtureId must be a synthetic fixture id");
  }

  const inputValidation = validateLlmReadinessModelInputCandidate(fixture.input);
  for (const inputError of inputValidation.errors) {
    errors.push(`input.${inputError}`);
  }

  const outputValidation = validateLlmReadinessModelOutputCandidate(fixture.expectedOutput);
  for (const outputError of outputValidation.errors) {
    errors.push(`expectedOutput.${outputError}`);
  }

  if (!isRecord(fixture.input)) {
    errors.push("input must be an object");
  }

  if (!isRecord(fixture.expectedOutput)) {
    errors.push("expectedOutput must be an object");
  }

  const inputKind = isRecord(fixture.input) ? fixture.input.kind : undefined;
  const contract = typeof inputKind === "string"
    ? findLlmReadinessDraftContractByInputKind(inputKind as LlmReadinessModelInputKind)
    : undefined;

  if (!contract) {
    errors.push("fixture input kind must have a draft contract");
  } else {
    if (isRecord(fixture.expectedOutput) && fixture.expectedOutput.kind !== contract.outputKind) {
      errors.push("expectedOutput.kind must match the draft contract outputKind");
    }

    if (isRecord(fixture.input) && isRecord(fixture.input.policy)) {
      if (fixture.input.policy.providerCalls !== contract.providerCalls) {
        errors.push("input.policy.providerCalls must match the draft contract");
      }

      if (fixture.input.policy.dataMode !== contract.dataMode) {
        errors.push("input.policy.dataMode must match the draft contract");
      }

      if (
        !Array.isArray(fixture.input.policy.allowedToolEffects) ||
        !sameStringList(fixture.input.policy.allowedToolEffects, contract.allowedToolEffects)
      ) {
        errors.push("input.policy.allowedToolEffects must match the draft contract");
      }
    }

    if (isRecord(fixture.expectedOutput)) {
      if (fixture.expectedOutput.humanApprovalRequired !== contract.humanApprovalRequired) {
        errors.push("expectedOutput.humanApprovalRequired must match the draft contract");
      }

      if (fixture.expectedOutput.writesProductObject !== contract.writesProductObject) {
        errors.push("expectedOutput.writesProductObject must match the draft contract");
      }
    }

    if (isRecord(fixture.input) && Array.isArray(fixture.input.sourceRefs)) {
      const inputSourceTypes = collectSourceObjectTypes(fixture.input.sourceRefs);

      for (const requiredSourceObjectType of contract.requiredSourceObjectTypes) {
        if (!inputSourceTypes.includes(requiredSourceObjectType)) {
          errors.push(`input.sourceRefs must include ${requiredSourceObjectType}`);
        }
      }
    }

    if (
      isRecord(fixture.input) &&
      Array.isArray(fixture.input.sourceRefs) &&
      isRecord(fixture.expectedOutput) &&
      Array.isArray(fixture.expectedOutput.sourceRefs)
    ) {
      const inputSourceRefs = collectSourceRefs(fixture.input.sourceRefs);
      const outputSourceRefs = collectSourceRefs(fixture.expectedOutput.sourceRefs);
      const outputSourceTypes = outputSourceRefs.map((sourceRef) => sourceRef.objectType);

      for (const requiredSourceObjectType of contract.requiredSourceObjectTypes) {
        if (!outputSourceTypes.includes(requiredSourceObjectType)) {
          errors.push(`expectedOutput.sourceRefs must include ${requiredSourceObjectType}`);
          continue;
        }

        const requiredInputSourceRefs = inputSourceRefs.filter((sourceRef) =>
          sourceRef.objectType === requiredSourceObjectType &&
          typeof sourceRef.objectId === "string" &&
          sourceRef.objectId.trim().length > 0
        );

        for (const requiredInputSourceRef of requiredInputSourceRefs) {
          const hasMatchingOutputSourceRef = outputSourceRefs.some((sourceRef) =>
            sourceRef.objectType === requiredSourceObjectType &&
            sourceRef.objectId === requiredInputSourceRef.objectId
          );

          if (!hasMatchingOutputSourceRef) {
            errors.push(
              `expectedOutput.sourceRefs must include ${requiredSourceObjectType} source ${requiredInputSourceRef.objectId}`
            );
          }
        }
      }
    }
  }

  if (!Array.isArray(fixture.disallowedPayloadKeys)) {
    errors.push("disallowedPayloadKeys must list the forbidden payload keys");
  } else if (!sameStringList(fixture.disallowedPayloadKeys, llmReadinessForbiddenPayloadKeys)) {
    errors.push("disallowedPayloadKeys must match llmReadinessForbiddenPayloadKeys");
  }

  for (const forbiddenKey of llmReadinessForbiddenPayloadKeys) {
    if (isRecord(fixture.input) && hasOwn(fixture.input, forbiddenKey)) {
      errors.push(`input.${forbiddenKey} is not allowed`);
    }

    if (isRecord(fixture.expectedOutput) && hasOwn(fixture.expectedOutput, forbiddenKey)) {
      errors.push(`expectedOutput.${forbiddenKey} is not allowed`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateLlmReadinessEvalFixtureCoverage(
  fixtures: unknown = llmReadinessEvalFixtures
): LlmReadinessEvalFixtureCoverageValidation {
  const errors: string[] = [];

  if (!Array.isArray(fixtures)) {
    return { valid: false, errors: ["fixtures must be an array"] };
  }

  fixtures.forEach((fixture, index) => {
    const validation = validateLlmReadinessEvalFixture(fixture);

    if (!validation.valid) {
      errors.push(`${getFixtureId(fixture, index)} must be a valid readiness eval fixture`);
    }
  });

  for (const contract of llmReadinessDraftContracts) {
    if (!fixtures.some((fixture) => fixtureCoversDraftContract(fixture, contract))) {
      errors.push(`draft contract ${contract.contractId} must have a valid synthetic eval fixture`);
    }
  }

  return { valid: errors.length === 0, errors };
}
