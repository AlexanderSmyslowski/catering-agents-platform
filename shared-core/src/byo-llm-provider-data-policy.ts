import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { ByoLlmProviderKind } from "./byo-llm-boundary.js";
import type { ByoLlmDataClass } from "./data-classification.js";

export type ByoLlmProcessingPurpose =
  | "production_draft_extraction"
  | "production_draft_revision"
  | "clarification_draft"
  | "intake_shadow_extraction"
  | "offer_package_classification";

export type ByoLlmProviderCapability =
  | "structured_output"
  | "document_understanding"
  | "text_generation";

export interface ByoLlmExternalProcessingApproval {
  approvalId: string;
  businessId: string;
  providerKind: Exclude<ByoLlmProviderKind, "fixture">;
  allowedDataClasses: readonly ByoLlmDataClass[];
  allowedPurposes: readonly ByoLlmProcessingPurpose[];
  allowedModels: readonly string[];
  allowedCapabilities: readonly ByoLlmProviderCapability[];
  allowedRegions: readonly string[];
  allowedEndpoints: readonly string[];
  maxCostEurPerCall: number;
  retentionPolicy: string;
  trainingUse: "contractually_excluded";
  legalBasisReference: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
}

export interface ByoLlmProviderDescriptor {
  providerKind: ByoLlmProviderKind;
  dataLeavesInstallation: boolean;
  providerModel: string;
  capability: ByoLlmProviderCapability;
  actualRegion: string;
  maximumEstimatedCostEur: number;
  retentionPolicy: string;
  trainingUse: "contractually_excluded" | "allowed" | "unknown";
  endpoint: string;
  metadataVerified: boolean;
}

export interface ByoLlmProviderDataContext {
  businessId: string;
  dataClass: ByoLlmDataClass;
  purpose: ByoLlmProcessingPurpose;
}

export interface ByoLlmProviderDataGateResult {
  allowed: boolean;
  errors: string[];
  approvalId?: string;
}

export interface ByoLlmProcessingPolicyMetadata {
  approvalId?: string;
  businessId: string;
  providerKind: ByoLlmProviderKind;
  providerModel: string;
  capability: ByoLlmProviderCapability;
  actualRegion: string;
  endpoint: string;
  maximumEstimatedCostEur: number;
  retentionPolicy: string;
  trainingUse: ByoLlmProviderDescriptor["trainingUse"];
  purpose: ByoLlmProcessingPurpose;
  dataClass: ByoLlmDataClass;
  inputHash: string;
  sourceHash: string;
  projectionHash: string;
  outputHash?: string;
  successClass: "success" | "policy_rejected" | "provider_rejected";
}

export interface ByoLlmExternalPromptProjection {
  text: string;
  sourceHash: string;
  projectionHash: string;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Endpoint configuration is needed for an approval comparison, but a raw
 * endpoint is not safe audit data: URLs may contain credentials or secret
 * query parameters and CLI paths may reveal local operator details. Keep the
 * exact value inside the in-process descriptor and expose only a safe form in
 * processing provenance.
 */
export function redactByoLlmEndpointForAudit(endpoint: string): string {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "local:") {
      parsed.username = "";
      parsed.password = "";
      parsed.search = "";
      parsed.hash = "";
      // Keep only the authority. Provider paths can contain tenant ids or
      // credentials, so they are not safe provenance even after query
      // parameters and fragments have been removed.
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    // Non-URL provider identifiers are represented by a one-way identifier below.
  }

  return sha256(endpoint);
}

/**
 * External providers receive only the operational content needed for the task.
 * Contact and salutation lines are removed wholesale so a partial regex match
 * cannot leave a person's identity or address beside otherwise useful menu data.
 */
export function projectByoLlmExternalPromptContext(promptContext: string | undefined): ByoLlmExternalPromptProjection {
  const source = promptContext ?? "";
  const structuredProjection = (() => {
    try {
      const parsed = JSON.parse(source) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
      const stripSensitiveFields = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(stripSensitiveFields);
        if (!value || typeof value !== "object") return value;
        return Object.fromEntries(Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !/^(?:customer|customerName|client|company|contact|contacts|organizer|organizerName|venue|email|phone|telephone|mobile|address|street|postalCode|zip|city|filename|fileName)$/iu.test(key))
          .map(([key, nested]) => [key, stripSensitiveFields(nested)]));
      };
      return JSON.stringify(stripSensitiveFields(parsed));
    } catch {
      return undefined;
    }
  })();
  const lines = (structuredProjection ?? source).split(/\r?\n/);
  const directlyIdentifying = lines.map((line) => (
      /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(line) ||
      /\b(?:https?:\/\/|www\.)\S+/i.test(line) ||
      /\+\d(?:[\d\s()./-]*\d){6,}/.test(line) ||
      /(?:^|[^\d])0\d(?:[\d\s()./-]*\d){7,}(?:$|[^\d])/.test(line) ||
      /^\s*(?:\+?\d[\d\s()./-]{6,})\s*$/.test(line) ||
      /\b[\p{L}][\p{L} .'-]*(?:straße|strasse|str\.?|weg|allee|platz|gasse|ring|ufer|damm)\s+\d+[\p{L}\d/-]*(?:\s*[,·]\s*\d{5}\s+[\p{L} .'-]+)?/iu.test(line) ||
      /\b(?:anrede|kontakt|contact|e-?mail|telefon|phone|adresse|address|kunde|customer|firma|company|veranstalter|organizer)\s*:/i.test(line) ||
      /^\s*(?:sehr\s+geehrt\w*|liebe[rsn]?|dear)\b/i.test(line)
  ));
  const standalonePerson = (line: string) =>
    /^\s*\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){1,3}\s*$/u.test(line);
  const projected = lines
    .filter((line, index) => !(
      directlyIdentifying[index] ||
      (standalonePerson(line) && (directlyIdentifying[index - 1] || directlyIdentifying[index + 1]))
    ))
    .join("\n");
  return { text: projected, sourceHash: sha256(source), projectionHash: sha256(projected) };
}

const providerKinds = new Set<ByoLlmProviderKind>(["fixture", "openai", "codex_cli", "custom_byo_provider"]);
const dataClasses = new Set<ByoLlmDataClass>([
  "synthetic_demo",
  "anonymized",
  "pseudonymized",
  "private_business",
  "personal_confidential"
]);
const purposes = new Set<ByoLlmProcessingPurpose>([
  "production_draft_extraction",
  "production_draft_revision",
  "clarification_draft",
  "intake_shadow_extraction",
  "offer_package_classification"
]);
const capabilities = new Set<ByoLlmProviderCapability>([
  "structured_output",
  "document_understanding",
  "text_generation"
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function validDate(value: string | undefined): boolean {
  return value !== undefined && !Number.isNaN(new Date(value).getTime());
}

function hasConcreteExternalProviderMetadata(descriptor: ByoLlmProviderDescriptor): boolean {
  if (descriptor.providerKind === "fixture") return true;
  const isConcrete = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 && !new Set(["unknown", "unset", "n/a", "not_available", "null", "undefined"]).has(normalized);
  };
  return isConcrete(descriptor.providerModel) &&
    isConcrete(descriptor.actualRegion) &&
    isConcrete(descriptor.retentionPolicy) &&
    isConcrete(descriptor.endpoint) &&
    descriptor.trainingUse === "contractually_excluded" &&
    descriptor.maximumEstimatedCostEur !== Number.MAX_VALUE;
}

export function createByoLlmProviderDescriptor(
  descriptor: ByoLlmProviderDescriptor
): ByoLlmProviderDescriptor {
  if (!providerKinds.has(descriptor.providerKind)) {
    throw new Error("providerKind must be a registered BYO LLM provider kind");
  }
  if (descriptor.providerKind !== "fixture" && descriptor.dataLeavesInstallation !== true) {
    throw new Error(`${descriptor.providerKind} must set dataLeavesInstallation to true`);
  }
  if (descriptor.providerKind === "fixture" && descriptor.dataLeavesInstallation !== false) {
    throw new Error("fixture must set dataLeavesInstallation to false");
  }
  if (!nonEmpty(descriptor.providerModel)) throw new Error("providerModel must be a non-empty string");
  if (!capabilities.has(descriptor.capability)) throw new Error("capability must be a registered provider capability");
  if (!nonEmpty(descriptor.actualRegion)) throw new Error("actualRegion must be a non-empty string");
  if (!Number.isFinite(descriptor.maximumEstimatedCostEur) || descriptor.maximumEstimatedCostEur < 0) {
    throw new Error("maximumEstimatedCostEur must be a non-negative finite number");
  }
  if (!nonEmpty(descriptor.retentionPolicy)) throw new Error("retentionPolicy must be a non-empty string");
  if (descriptor.trainingUse !== "contractually_excluded" && descriptor.trainingUse !== "allowed" && descriptor.trainingUse !== "unknown") {
    throw new Error("trainingUse must be contractually_excluded, allowed or unknown");
  }
  if (!nonEmpty(descriptor.endpoint)) throw new Error("endpoint must be a non-empty string");
  if (typeof descriptor.metadataVerified !== "boolean") throw new Error("metadataVerified must be a boolean");
  return Object.freeze({ ...descriptor });
}

export function validateByoLlmExternalProcessingApproval(
  approval: unknown
): { valid: boolean; errors: string[]; approval?: ByoLlmExternalProcessingApproval } {
  const errors: string[] = [];
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    return { valid: false, errors: ["approval must be a JSON object"] };
  }
  const record = approval as Record<string, unknown>;
  if (!nonEmpty(record.approvalId)) errors.push("approvalId must be a non-empty string");
  if (!nonEmpty(record.businessId)) errors.push("businessId must be a non-empty string");
  if (record.providerKind === "fixture" || !providerKinds.has(record.providerKind as ByoLlmProviderKind)) {
    errors.push("providerKind must name an external BYO LLM provider");
  }
  if (!nonEmptyList(record.allowedDataClasses) || !record.allowedDataClasses.every((value) => dataClasses.has(value as ByoLlmDataClass))) {
    errors.push("allowedDataClasses must contain only registered data classes");
  }
  if (!nonEmptyList(record.allowedPurposes) || !record.allowedPurposes.every((value) => purposes.has(value as ByoLlmProcessingPurpose))) {
    errors.push("allowedPurposes must contain only registered processing purposes");
  }
  if (!nonEmptyList(record.allowedModels) || !record.allowedModels.every(nonEmpty)) errors.push("allowedModels must contain non-empty model ids");
  if (!nonEmptyList(record.allowedCapabilities) || !record.allowedCapabilities.every((value) => capabilities.has(value as ByoLlmProviderCapability))) {
    errors.push("allowedCapabilities must contain only registered capabilities");
  }
  if (!nonEmptyList(record.allowedRegions) || !record.allowedRegions.every(nonEmpty)) errors.push("allowedRegions must contain non-empty regions");
  if (!nonEmptyList(record.allowedEndpoints) || !record.allowedEndpoints.every(nonEmpty)) errors.push("allowedEndpoints must contain non-empty endpoints");
  if (!Number.isFinite(record.maxCostEurPerCall) || Number(record.maxCostEurPerCall) < 0) errors.push("maxCostEurPerCall must be a non-negative finite number");
  if (!nonEmpty(record.retentionPolicy)) errors.push("retentionPolicy must be a non-empty string");
  if (record.trainingUse !== "contractually_excluded") errors.push("trainingUse must be contractually_excluded");
  if (!nonEmpty(record.legalBasisReference)) errors.push("legalBasisReference must be a non-empty string");
  if (!nonEmpty(record.approvedBy)) errors.push("approvedBy must be a non-empty string");
  if (!validDate(record.approvedAt as string | undefined)) errors.push("approvedAt must be a valid ISO date");
  if (!validDate(record.expiresAt as string | undefined)) errors.push("expiresAt must be a valid ISO date");

  return errors.length === 0
    ? { valid: true, errors: [], approval: record as unknown as ByoLlmExternalProcessingApproval }
    : { valid: false, errors };
}

export function evaluateByoLlmProviderDataGate(input: {
  provider: ByoLlmProviderDescriptor;
  context: ByoLlmProviderDataContext;
  approval?: ByoLlmExternalProcessingApproval;
  now?: Date;
}): ByoLlmProviderDataGateResult {
  const errors: string[] = [];
  const { provider, context } = input;
  const descriptor = (() => {
    try {
      return createByoLlmProviderDescriptor(provider);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "provider descriptor is invalid");
      return undefined;
    }
  })();
  if (!descriptor) return { allowed: false, errors };
  if (!nonEmpty(context.businessId)) errors.push("businessId must be a non-empty string");
  if (!dataClasses.has(context.dataClass)) errors.push("dataClass must be a registered data class");
  if (!purposes.has(context.purpose)) errors.push("purpose must be a registered processing purpose");

  if (!descriptor.dataLeavesInstallation) {
    return { allowed: errors.length === 0, errors };
  }
  if (!descriptor.metadataVerified) errors.push("provider runtime metadata is incomplete or unverified");
  if (!hasConcreteExternalProviderMetadata(descriptor)) {
    errors.push("provider runtime metadata contains unknown or unsafe values");
  }
  if (!input.approval) {
    return { allowed: false, errors: [...errors, "external provider calls require a matching processing approval"] };
  }
  const approvalValidation = validateByoLlmExternalProcessingApproval(input.approval);
  if (!approvalValidation.valid || !approvalValidation.approval) {
    return { allowed: false, errors: [...errors, ...approvalValidation.errors] };
  }
  const approval = approvalValidation.approval;
  if (approval.businessId !== context.businessId) errors.push("approval businessId does not match the server-owned business context");
  if (approval.providerKind !== descriptor.providerKind) errors.push("approval providerKind does not match the configured provider");
  if (!approval.allowedDataClasses.includes(context.dataClass)) errors.push("approval does not allow this data class");
  if (!approval.allowedPurposes.includes(context.purpose)) errors.push("approval does not allow this processing purpose");
  if (!approval.allowedModels.includes(descriptor.providerModel)) errors.push("approval does not allow the configured provider model");
  if (!approval.allowedCapabilities.includes(descriptor.capability)) errors.push("approval does not allow the configured provider capability");
  if (!approval.allowedRegions.includes(descriptor.actualRegion)) errors.push("approval does not allow the configured processing region");
  if (!approval.allowedEndpoints.includes(descriptor.endpoint)) errors.push("approval does not allow the configured provider endpoint");
  if (descriptor.maximumEstimatedCostEur > approval.maxCostEurPerCall) errors.push("configured maximum estimated cost exceeds the approval limit");
  if (descriptor.retentionPolicy !== approval.retentionPolicy) errors.push("configured provider retention policy does not match the approval");
  if (descriptor.trainingUse !== "contractually_excluded") errors.push("configured provider training use is not contractually excluded");
  if (approval.trainingUse !== "contractually_excluded") errors.push("approval must exclude provider training use");
  const now = input.now ?? new Date();
  if (new Date(approval.expiresAt).getTime() <= now.getTime()) errors.push("approval has expired");
  if (new Date(approval.approvedAt).getTime() > now.getTime()) errors.push("approval approvedAt must not be in the future");

  return errors.length === 0
    ? { allowed: true, errors: [], approvalId: approval.approvalId }
    : { allowed: false, errors, approvalId: approval.approvalId };
}

export function loadByoLlmExternalProcessingApprovalFromEnv(
  env: Record<string, string | undefined> = process.env,
  repositoryRoot = process.cwd()
): ByoLlmExternalProcessingApproval | undefined {
  const configuredPath = env.CATERING_LLM_PROCESSING_APPROVAL_FILE?.trim();
  if (!configuredPath) return undefined;
  if (!path.isAbsolute(configuredPath)) throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE must be an absolute path outside the repository");
  const normalizedFile = path.resolve(configuredPath);
  const normalizedRepository = path.resolve(repositoryRoot);
  if (normalizedFile === normalizedRepository || normalizedFile.startsWith(`${normalizedRepository}${path.sep}`)) {
    throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE must point outside the repository");
  }
  let fileDescriptor: number | undefined;
  try {
    const canonicalFile = realpathSync(normalizedFile);
    const canonicalRepository = realpathSync(normalizedRepository);
    if (canonicalFile === canonicalRepository || canonicalFile.startsWith(`${canonicalRepository}${path.sep}`)) {
      throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE must point outside the repository");
    }
    const beforeOpen = lstatSync(normalizedFile);
    if (!beforeOpen.isFile() || beforeOpen.isSymbolicLink()) {
      throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE must be a regular non-symlink file");
    }
    if (beforeOpen.size > 64 * 1024) throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE is too large");
    if ((beforeOpen.mode & 0o022) !== 0) throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE must not be group or world writable");
    if (typeof process.getuid === "function" && beforeOpen.uid !== process.getuid()) {
      throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE must be owned by the current user");
    }
    fileDescriptor = openSync(normalizedFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(fileDescriptor);
    if (!opened.isFile() || opened.dev !== beforeOpen.dev || opened.ino !== beforeOpen.ino || opened.size > 64 * 1024) {
      throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE changed while being opened");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CATERING_LLM_PROCESSING_APPROVAL_FILE")) throw error;
    throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE cannot be read safely");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(fileDescriptor!, "utf8"));
  } catch {
    throw new Error("CATERING_LLM_PROCESSING_APPROVAL_FILE must contain valid JSON");
  } finally {
    if (fileDescriptor !== undefined) closeSync(fileDescriptor);
  }
  const validation = validateByoLlmExternalProcessingApproval(parsed);
  if (!validation.valid || !validation.approval) throw new Error(`CATERING_LLM_PROCESSING_APPROVAL_FILE is invalid: ${validation.errors.join("; ")}`);
  return validation.approval;
}
