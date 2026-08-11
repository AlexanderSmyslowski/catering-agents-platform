import { createHash } from "node:crypto";
import {
  llmReadinessContractVersion,
  type LlmReadinessModelInput
} from "../llm-readiness.js";
import {
  type LlmReadinessProviderUsage
} from "../llm-readiness-provider-adapter.js";
import type { ByoLlmProcessingPolicyMetadata } from "../byo-llm-provider-data-policy.js";
import {
  loadCuratedOfferPackages,
  type CuratedOfferPackage
} from "./curated-offer-selection.js";

export const offerPackageClassificationDataMode = "pseudonymized_approved" as const;

export interface PseudonymizedOfferText {
  sourceHash: string;
  pseudonymizedHash: string;
  text: string;
  keptLineCount: number;
  removedLineCount: number;
  riskFlags: string[];
}

export interface OfferPackageClassificationDraft {
  packageId: string | null;
  confidence: number;
  rationale: string;
  signals: string[];
  alternatives: Array<{
    packageId: string;
    confidence: number;
  }>;
}

export interface OfferPackageClassificationPrediction {
  sourceId: string;
  sourceHash: string;
  pseudonymizedHash: string;
  model: string;
  ok: boolean;
  packageId?: string | null;
  confidence?: number;
  alternatives?: string[];
  providerId?: string;
  providerRequestId?: string;
  usage?: LlmReadinessProviderUsage;
  processingPolicy?: ByoLlmProcessingPolicyMetadata;
  reviewFlags?: string[];
  errors: string[];
}

export interface OfferPackagePilotReport {
  reportKind: "offer_package_classification_pilot";
  dataMode: typeof offerPackageClassificationDataMode;
  sourceCount: number;
  modelCount: number;
  requestCount: number;
  providerRequestCount: number;
  failedBeforeProviderCount: number;
  packageIds: string[];
  budget: {
    maxRequests: number;
    maxEur?: number;
  };
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  predictions: OfferPackageClassificationPrediction[];
  disagreements: Array<{
    sourceId: string;
    packageIds: string[];
  }>;
  reviewLists: {
    lowConfidence: Array<{
      sourceId: string;
      model: string;
      packageId: string | null;
      confidence: number;
    }>;
    nullClassifications: Array<{
      sourceId: string;
      model: string;
      confidence: number;
    }>;
    noOfferEvidence: Array<{
      sourceId: string;
      model: string;
    }>;
    flyingBoilerplateReview: Array<{
      sourceId: string;
      model: string;
      packageId: string;
      confidence: number;
      reason: "flying_boilerplate_without_glass_evidence";
    }>;
  };
  guardrails: {
    rawTextStored: false;
    rawPromptStored: false;
    rawResponseStored: false;
    fullBatchRunBlocked: boolean;
  };
}

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phonePattern = /(?:\+?\d[\d\s()./-]{7,}\d)/;
const contactKeywordPattern = /\b(?:telefon|tel\.?|mobil|mobile|e-?mail|mail|kontakt|ansprechpartner|rechnung|kundennummer|ust-?id|iban|bic|www\.|https?:\/\/)\b/i;
const addressPattern = /\b(?:strasse|str\.|straße|weg|platz|allee|gasse|ufer|ring)\b/i;
const salutationPattern = /^(?:sehr geehrte|sehr geehrter|liebe|lieber|dear)\b/i;
const customerMarkerPattern = /^(?:an|kunde|kundin|firma|institut|adresse|veranstalter)\s*[:|-]/i;

const offerEvidencePattern =
  /\b(?:personen|teilnehmer|gaeste|gäste|pax|buffet|flying|fingerfood|lunch|brunch|breakfast|fruehstueck|frühstück|dinner|abendessen|hochzeit|reception|empfang|conference|konferenz|tagung|meeting|kaffee|coffee|bbq|barbecue|crew|menue|menü|speisen|service|preis|eur|euro|netto|brutto|mwst|vitello|roastbeef|garnelen|spargel|dessert|brot|baguette|kaese|käse|getraenke|getränke|vegetarisch|vegan)\b/i;

function hashText(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function isSensitiveLine(line: string): boolean {
  return (
    emailPattern.test(line) ||
    phonePattern.test(line) ||
    contactKeywordPattern.test(line) ||
    addressPattern.test(line) ||
    salutationPattern.test(line) ||
    customerMarkerPattern.test(line)
  );
}

function isOfferEvidenceLine(line: string): boolean {
  return offerEvidencePattern.test(line) || /[0-9][,.]?[0-9]*\s*(?:€|eur|euro|personen|pax|teilnehmer)/i.test(line);
}

export function pseudonymizeOfferText(rawText: string, options: { maxChars?: number } = {}): PseudonymizedOfferText {
  const maxChars = options.maxChars ?? 12_000;
  const sourceHash = hashText(rawText);
  const keptLines: string[] = [];
  let removedLineCount = 0;

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (line.length === 0) {
      continue;
    }

    if (isSensitiveLine(line) || !isOfferEvidenceLine(line)) {
      removedLineCount += 1;
      continue;
    }

    keptLines.push(line);
  }

  const text = keptLines.join("\n").slice(0, maxChars).trim();
  const riskFlags: string[] = [];
  if (text.length === 0) {
    riskFlags.push("no_offer_evidence_retained");
  }
  if (text.length === maxChars) {
    riskFlags.push("pseudonymized_text_truncated");
  }

  return {
    sourceHash,
    pseudonymizedHash: hashText(text),
    text,
    keptLineCount: keptLines.length,
    removedLineCount,
    riskFlags
  };
}

export function buildOfferPackageClassificationInput(input: {
  sourceHash: string;
  sourceId: string;
}): LlmReadinessModelInput {
  return {
    contractVersion: llmReadinessContractVersion,
    inputId: `input-offer-package-classification-${input.sourceId}`,
    kind: "offer_package_classification_request",
    sourceRefs: [
      {
        objectType: "safe_source_anchor",
        objectId: input.sourceHash,
        label: "pseudonymized approved offer text"
      }
    ],
    policy: {
      providerCalls: "disabled",
      dataMode: offerPackageClassificationDataMode,
      allowedToolEffects: ["read", "draft"]
    }
  };
}

export function buildOfferPackageClassificationPromptContext(input: {
  pseudonymizedText: string;
  packages?: readonly CuratedOfferPackage[];
}): string {
  const packages = input.packages ?? loadCuratedOfferPackages();
  const packageLines = packages.map((item) => JSON.stringify({
    id: item.id,
    name: item.name,
    event_types: item.event_types ?? [],
    min_pax: item.min_pax,
    price_band_pp: item.price_band_pp,
    food_modules: item.food_modules ?? [],
    service_modules: item.service_modules ?? []
  }));

  return [
    "Pseudonymisierter Angebotstext:",
    input.pseudonymizedText.trim(),
    "",
    "Abgrenzungsregeln:",
    "- institution_framework_catering nur waehlen, wenn der Text einen Rahmenvertrag, Serien-/Wiederholungsauftrag oder explizite institutionelle Rahmenvereinbarung belegt. Kundentyp, Institutsname oder Hochschul-/Klinikbezug allein reichen nicht.",
    "- wedding_buffet_premium und wedding_reception_addon nur waehlen, wenn der Text Hochzeit, Trauung, Brautpaar, Wedding oder eindeutige Hochzeitsbegriffe nennt.",
    "- packageId null ist ein erwuenschtes Ergebnis, wenn keine Paket-ID mit Textbelegen passt; null ist besser als ein geratenes Paket.",
    "",
    "Zulaessige Paket-IDs mit Evidenz:",
    packageLines.join("\n")
  ].join("\n");
}

export function parseOfferPackageClassificationDraft(
  text: string,
  allowedPackageIds: readonly string[]
): { draft?: OfferPackageClassificationDraft; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { errors: ["classification draft must be valid JSON"] };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { errors: ["classification draft must be a JSON object"] };
  }

  const record = parsed as Record<string, unknown>;
  const packageId = typeof record.packageId === "string" ? record.packageId : null;
  const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence)
    ? Math.max(0, Math.min(1, record.confidence))
    : undefined;
  const rationale = typeof record.rationale === "string" ? record.rationale.trim() : "";
  const signals = Array.isArray(record.signals)
    ? record.signals.filter((signal): signal is string => typeof signal === "string").slice(0, 3)
    : [];
  const alternatives = Array.isArray(record.alternatives)
    ? record.alternatives
        .filter((alternative): alternative is { packageId: string; confidence: number } =>
          typeof (alternative as { packageId?: unknown }).packageId === "string" &&
          typeof (alternative as { confidence?: unknown }).confidence === "number" &&
          Number.isFinite((alternative as { confidence: number }).confidence)
        )
        .slice(0, 3)
    : [];

  if (packageId !== null && !allowedPackageIds.includes(packageId)) {
    errors.push("packageId must be null or one of the curated package ids");
  }
  if (confidence === undefined) {
    errors.push("confidence must be a finite number");
  }
  if (rationale.length === 0) {
    errors.push("rationale must be a non-empty string");
  }
  for (const alternative of alternatives) {
    if (!allowedPackageIds.includes(alternative.packageId)) {
      errors.push("alternative packageId must be one of the curated package ids");
    }
  }

  if (errors.length > 0 || confidence === undefined) {
    return { errors: [...new Set(errors)] };
  }

  return {
    draft: {
      packageId,
      confidence,
      rationale,
      signals,
      alternatives
    },
    errors: []
  };
}

export function buildOfferPackagePilotReport(input: {
  packageIds: readonly string[];
  maxRequests: number;
  maxEur?: number;
  predictions: readonly OfferPackageClassificationPrediction[];
  fullBatchRunAllowed?: boolean;
}): OfferPackagePilotReport {
  const sourceIds = [...new Set(input.predictions.map((prediction) => prediction.sourceId))];
  const models = [...new Set(input.predictions.map((prediction) => prediction.model))];
  const providerRequestCount = input.predictions.filter((prediction) =>
    prediction.providerId !== undefined ||
    prediction.providerRequestId !== undefined ||
    prediction.usage !== undefined
  ).length;
  const usage = input.predictions.reduce<OfferPackagePilotReport["usage"]>((total, prediction) => ({
    inputTokens: addOptional(total.inputTokens, prediction.usage?.inputTokens),
    outputTokens: addOptional(total.outputTokens, prediction.usage?.outputTokens),
    totalTokens: addOptional(total.totalTokens, prediction.usage?.totalTokens)
  }), {});
  const disagreements = sourceIds
    .map((sourceId) => {
      const packageIds = [...new Set(input.predictions
        .filter((prediction) => prediction.sourceId === sourceId && prediction.ok)
        .map((prediction) => prediction.packageId ?? "none"))].sort();
      return { sourceId, packageIds };
    })
    .filter((item) => item.packageIds.length > 1);
  const lowConfidence = input.predictions
    .filter((prediction) =>
      prediction.ok &&
      typeof prediction.confidence === "number" &&
      prediction.confidence < 0.7
    )
    .map((prediction) => ({
      sourceId: prediction.sourceId,
      model: prediction.model,
      packageId: prediction.packageId ?? null,
      confidence: prediction.confidence!
    }));
  const nullClassifications = input.predictions
    .filter((prediction) =>
      prediction.ok &&
      prediction.packageId === null &&
      typeof prediction.confidence === "number"
    )
    .map((prediction) => ({
      sourceId: prediction.sourceId,
      model: prediction.model,
      confidence: prediction.confidence!
    }));
  const noOfferEvidence = input.predictions
    .filter((prediction) => prediction.errors.includes("no_offer_evidence_retained"))
    .map((prediction) => ({
      sourceId: prediction.sourceId,
      model: prediction.model
    }));
  const flyingBoilerplateReview = input.predictions
    .filter((prediction) =>
      prediction.ok &&
      prediction.packageId === "flying_buffet_premium" &&
      typeof prediction.confidence === "number" &&
      prediction.reviewFlags?.includes("flying_boilerplate_without_glass_evidence")
    )
    .map((prediction) => ({
      sourceId: prediction.sourceId,
      model: prediction.model,
      packageId: prediction.packageId!,
      confidence: prediction.confidence!,
      reason: "flying_boilerplate_without_glass_evidence" as const
    }));

  return {
    reportKind: "offer_package_classification_pilot",
    dataMode: offerPackageClassificationDataMode,
    sourceCount: sourceIds.length,
    modelCount: models.length,
    requestCount: input.predictions.length,
    providerRequestCount,
    failedBeforeProviderCount: input.predictions.length - providerRequestCount,
    packageIds: [...input.packageIds],
    budget: {
      maxRequests: input.maxRequests,
      maxEur: input.maxEur
    },
    usage,
    predictions: input.predictions.map((prediction) => ({ ...prediction })),
    disagreements,
    reviewLists: {
      lowConfidence,
      nullClassifications,
      noOfferEvidence,
      flyingBoilerplateReview
    },
    guardrails: {
      rawTextStored: false,
      rawPromptStored: false,
      rawResponseStored: false,
      fullBatchRunBlocked: !input.fullBatchRunAllowed
    }
  };
}

function addOptional(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }

  return (left ?? 0) + (right ?? 0);
}
