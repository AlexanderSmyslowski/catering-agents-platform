import {
  areJsonValuesEqual,
  createBusinessScopedPersistentCollection,
  llmReadinessForbiddenPayloadKeys,
  validateAcceptedEventSpec,
  validateEventRequest,
  withBusinessTargetCriticalSection,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type AcceptedEventSpec,
  type EventRequest,
  type OperationalArchiveReasonCode,
  type OperationalArchiveState
} from "@catering/shared-core";

export type IntakeShadowSafetyMode = "synthetic_demo" | "anonymized_reference";

export interface IntakeShadowValueSummary {
  present: boolean;
  valueHash?: string;
  numericValue?: number;
}

export interface IntakeShadowDifference {
  field: "eventType" | "serviceForm" | "eventDate" | "attendeeCount" | "menuItems";
  matches: boolean;
  baseline: IntakeShadowValueSummary;
  llm: IntakeShadowValueSummary;
}

export interface IntakeShadowRun {
  shadowRunId: string;
  createdAt: string;
  status: "pending_review";
  safetyMode: IntakeShadowSafetyMode;
  source: {
    channel: EventRequest["source"]["channel"];
    inputHash: string;
    sourceRef?: string;
  };
  baseline: {
    requestId: string;
    specId: string;
    summary: Record<IntakeShadowDifference["field"], IntakeShadowValueSummary>;
  };
  llm: {
    inputId: string;
    outputId?: string;
    outputHash?: string;
    providerId?: string;
    providerRequestId?: string;
    adapterId: string;
    adapterMode: string;
    promptSchemaId?: string;
    summary: Record<IntakeShadowDifference["field"], IntakeShadowValueSummary>;
  };
  differences: IntakeShadowDifference[];
  guardrails: {
    draftOnly: true;
    humanApprovalRequired: true;
    writesProductObjects: false;
    rawPayloadStored: false;
    dataMode: "synthetic_or_demo_only";
  };
}

interface ArchiveRequestContextInput {
  requestId: string;
  reasonCode: OperationalArchiveReasonCode;
  archivedAt: string;
  archivedBy: string;
}

const shadowDifferenceFields = [
  "eventType",
  "serviceForm",
  "eventDate",
  "attendeeCount",
  "menuItems"
] as const satisfies readonly IntakeShadowDifference["field"][];

const intakeSourceChannels = [
  "agent1_json",
  "manual_form",
  "email",
  "pdf_upload",
  "text",
  "api"
] as const satisfies readonly EventRequest["source"]["channel"][];

function shadowValidationError(detail: string): never {
  throw new Error(`Intake shadow run validation failed: ${detail}`);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return shadowValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

const shadowForbiddenPayloadKeys = new Set<string>([
  ...llmReadinessForbiddenPayloadKeys,
  "providerPayload",
  "rawPrompt",
  "rawProviderPayload",
  "rawResponse",
  "systemPrompt",
  "toolOutput",
  "userPrompt"
]);

function collectForbiddenShadowPayloadKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectForbiddenShadowPayloadKeys(item, `${path}[${index}]`)
    );
  }
  if (!value || typeof value !== "object") return [];

  const errors: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (shadowForbiddenPayloadKeys.has(key)) {
      errors.push(`${path}.${key} is not allowed in IntakeShadowRun`);
    }
    errors.push(...collectForbiddenShadowPayloadKeys(nested, `${path}.${key}`));
  }
  return errors;
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) shadowValidationError(`${label}.${key} is an additional property`);
  }
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return shadowValidationError(`${label}.${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, label: string): void {
  const value = record[key];
  if (value !== undefined && (typeof value !== "string" || value.trim().length === 0)) {
    shadowValidationError(`${label}.${key} must be a non-empty string when present`);
  }
}

function validateShadowValueSummary(value: unknown, label: string): void {
  const item = asRecord(value, label);
  assertOnlyKeys(item, ["present", "valueHash", "numericValue"], label);
  if (typeof item.present !== "boolean") {
    shadowValidationError(`${label}.present must be boolean`);
  }
  optionalString(item, "valueHash", label);
  if (item.numericValue !== undefined && (
    typeof item.numericValue !== "number" || !Number.isFinite(item.numericValue)
  )) {
    shadowValidationError(`${label}.numericValue must be finite when present`);
  }
}

function validateShadowSummary(value: unknown, label: string): void {
  const summary = asRecord(value, label);
  assertOnlyKeys(summary, shadowDifferenceFields, label);
  for (const field of shadowDifferenceFields) {
    validateShadowValueSummary(summary[field], `${label}.${field}`);
  }
}

export function validateIntakeShadowRunForStorage(value: IntakeShadowRun): IntakeShadowRun {
  const forbiddenErrors = collectForbiddenShadowPayloadKeys(value);
  if (forbiddenErrors.length > 0) shadowValidationError([...new Set(forbiddenErrors)].join("; "));
  const run = asRecord(value, "shadowRun");
  assertOnlyKeys(
    run,
    ["shadowRunId", "createdAt", "status", "safetyMode", "source", "baseline", "llm", "differences", "guardrails"],
    "shadowRun"
  );
  requireString(run, "shadowRunId", "shadowRun");
  const createdAt = requireString(run, "createdAt", "shadowRun");
  if (Number.isNaN(Date.parse(createdAt))) shadowValidationError("shadowRun.createdAt must be a timestamp");
  if (run.status !== "pending_review") shadowValidationError("shadowRun.status must be pending_review");
  if (run.safetyMode !== "synthetic_demo" && run.safetyMode !== "anonymized_reference") {
    shadowValidationError("shadowRun.safetyMode is invalid");
  }

  const source = asRecord(run.source, "shadowRun.source");
  assertOnlyKeys(source, ["channel", "inputHash", "sourceRef"], "shadowRun.source");
  if (!intakeSourceChannels.includes(source.channel as EventRequest["source"]["channel"])) {
    shadowValidationError("shadowRun.source.channel is invalid");
  }
  requireString(source, "inputHash", "shadowRun.source");
  optionalString(source, "sourceRef", "shadowRun.source");

  const baseline = asRecord(run.baseline, "shadowRun.baseline");
  assertOnlyKeys(baseline, ["requestId", "specId", "summary"], "shadowRun.baseline");
  requireString(baseline, "requestId", "shadowRun.baseline");
  requireString(baseline, "specId", "shadowRun.baseline");
  validateShadowSummary(baseline.summary, "shadowRun.baseline.summary");

  const llm = asRecord(run.llm, "shadowRun.llm");
  assertOnlyKeys(
    llm,
    ["inputId", "outputId", "outputHash", "providerId", "providerRequestId", "adapterId", "adapterMode", "promptSchemaId", "summary"],
    "shadowRun.llm"
  );
  requireString(llm, "inputId", "shadowRun.llm");
  requireString(llm, "adapterId", "shadowRun.llm");
  requireString(llm, "adapterMode", "shadowRun.llm");
  for (const key of ["outputId", "outputHash", "providerId", "providerRequestId", "promptSchemaId"]) {
    optionalString(llm, key, "shadowRun.llm");
  }
  validateShadowSummary(llm.summary, "shadowRun.llm.summary");

  if (!Array.isArray(run.differences)) shadowValidationError("shadowRun.differences must be an array");
  for (const [index, rawDifference] of run.differences.entries()) {
    const difference = asRecord(rawDifference, `shadowRun.differences[${index}]`);
    assertOnlyKeys(
      difference,
      ["field", "matches", "baseline", "llm"],
      `shadowRun.differences[${index}]`
    );
    if (!shadowDifferenceFields.includes(difference.field as IntakeShadowDifference["field"])) {
      shadowValidationError(`shadowRun.differences[${index}].field is invalid`);
    }
    if (typeof difference.matches !== "boolean") {
      shadowValidationError(`shadowRun.differences[${index}].matches must be boolean`);
    }
    validateShadowValueSummary(difference.baseline, `shadowRun.differences[${index}].baseline`);
    validateShadowValueSummary(difference.llm, `shadowRun.differences[${index}].llm`);
  }

  const guardrails = asRecord(run.guardrails, "shadowRun.guardrails");
  assertOnlyKeys(
    guardrails,
    ["draftOnly", "humanApprovalRequired", "writesProductObjects", "rawPayloadStored", "dataMode"],
    "shadowRun.guardrails"
  );
  if (
    guardrails.draftOnly !== true ||
    guardrails.humanApprovalRequired !== true ||
    guardrails.writesProductObjects !== false ||
    guardrails.rawPayloadStored !== false ||
    guardrails.dataMode !== "synthetic_or_demo_only"
  ) {
    shadowValidationError("shadowRun.guardrails do not match the draft-only safety contract");
  }

  return value;
}

interface IntakeCollections {
  requests: BusinessScopedPersistentCollection<EventRequest>;
  specs: BusinessScopedPersistentCollection<AcceptedEventSpec>;
  shadowRuns: BusinessScopedPersistentCollection<IntakeShadowRun>;
}

export interface IntakeStoreOptions extends CollectionStorageOptions {
  fileFaultInjector?: (
    phase:
      | "before_record_publish"
      | "after_record_publish"
      | "before_record_replace"
      | "after_record_replace"
  ) => void;
}

function createIntakeCollections(options: IntakeStoreOptions = {}): IntakeCollections {
  return {
    requests: createBusinessScopedPersistentCollection<EventRequest>({
      collectionName: "intake/requests",
      getId: (request) => request.requestId,
      validate: validateEventRequest,
      ...options
    }),
    specs: createBusinessScopedPersistentCollection<AcceptedEventSpec>({
      collectionName: "intake/specs",
      getId: (spec) => spec.specId,
      validate: validateAcceptedEventSpec,
      ...options
    }),
    shadowRuns: createBusinessScopedPersistentCollection<IntakeShadowRun>({
      collectionName: "intake/shadow-runs",
      getId: (run) => run.shadowRunId,
      validate: validateIntakeShadowRunForStorage,
      ...options
    })
  };
}

export class IntakeStoreConflictError extends Error {
  readonly code = "INTAKE_STORE_CONFLICT";

  constructor(entity: "request" | "spec", id: string) {
    super(`Konflikt beim Archivieren von ${entity} ${id}. Bitte Daten neu laden und erneut versuchen.`);
    this.name = "IntakeStoreConflictError";
  }
}

function isOperationallyArchived(
  item: { operationalArchive?: OperationalArchiveState }
): boolean {
  return item.operationalArchive?.status === "archived";
}

function activeOnly<T extends { operationalArchive?: OperationalArchiveState }>(
  items: T[],
  includeArchived?: boolean
): T[] {
  return includeArchived ? items : items.filter((item) => !isOperationallyArchived(item));
}

export class IntakeStore {
  private readonly requests: BusinessScopedPersistentCollection<EventRequest>;

  private readonly specs: BusinessScopedPersistentCollection<AcceptedEventSpec>;

  private readonly shadowRuns: BusinessScopedPersistentCollection<IntakeShadowRun>;

  readonly storageOptions?: CollectionStorageOptions;

  constructor(options?: IntakeStoreOptions) {
    this.storageOptions = options;
    const collections = createIntakeCollections(options);
    this.requests = collections.requests;
    this.specs = collections.specs;
    this.shadowRuns = collections.shadowRuns;
  }

  async saveRequest(context: BusinessContext, request: EventRequest): Promise<void> {
    await this.saveRecord(context, this.requests, request.requestId, request, "request");
  }

  async getRequest(context: BusinessContext, requestId: string): Promise<EventRequest | undefined> {
    return this.requests.get(context, requestId);
  }

  async saveSpec(context: BusinessContext, spec: AcceptedEventSpec): Promise<void> {
    await this.saveRecord(context, this.specs, spec.specId, spec, "spec");
  }

  async insertSpec(context: BusinessContext, spec: AcceptedEventSpec): Promise<"created" | "exists"> {
    return this.specs.insert(context, spec);
  }

  async replaceSpec(
    context: BusinessContext,
    expectedInput: AcceptedEventSpec,
    replacementInput: AcceptedEventSpec
  ): Promise<"updated" | "same_content" | "conflict" | "missing"> {
    const expected = validateAcceptedEventSpec(expectedInput);
    const replacement = validateAcceptedEventSpec(replacementInput);
    if (expected.specId !== replacement.specId) {
      throw new Error("AcceptedEventSpec-Ersetzung muss dieselbe specId behalten.");
    }
    const existing = await this.specs.get(context, expected.specId);
    if (!existing) return "missing";
    // A repeated service call after a successful write is safe even when its old expected snapshot is now stale.
    if (areJsonValuesEqual(existing, replacement)) return "same_content";
    if (isOperationallyArchived(existing)) return "conflict";
    return this.specs.compareAndSetExact(
      context,
      expected.specId,
      expected,
      replacement
    );
  }

  async getSpec(context: BusinessContext, specId: string): Promise<AcceptedEventSpec | undefined> {
    return this.specs.get(context, specId);
  }

  async listRequests(
    context: BusinessContext,
    options?: { includeArchived?: boolean }
  ): Promise<EventRequest[]> {
    return activeOnly(await this.requests.list(context), options?.includeArchived);
  }

  async listSpecs(
    context: BusinessContext,
    options?: { includeArchived?: boolean }
  ): Promise<AcceptedEventSpec[]> {
    return activeOnly(await this.specs.list(context), options?.includeArchived);
  }

  async saveShadowRun(context: BusinessContext, run: IntakeShadowRun): Promise<void> {
    await this.shadowRuns.set(context, run);
  }

  async listShadowRuns(context: BusinessContext): Promise<IntakeShadowRun[]> {
    return this.shadowRuns.list(context);
  }

  async archiveRequestContext(
    context: BusinessContext,
    input: ArchiveRequestContextInput
  ): Promise<{ request?: EventRequest; specs: AcceptedEventSpec[]; alreadyArchived: boolean }> {
    const storage = this.storageOptions ?? {};
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "intake_request", artifactId: input.requestId, revision: 0 },
      collectionNamespace: "intake/archive",
      queueFullMessage: "Die Warteschlange für Intake-Archive benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Intake-Archive ist ausgeschöpft.",
      timeoutMessage: "Der Intake-Kontext konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Intake-Kontext konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Intake-Archive benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable) => {
        const collections = transactionalQueryable
          ? createIntakeCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { requests: this.requests, specs: this.specs, shadowRuns: this.shadowRuns };
        return this.archiveWithinCollections(context, input, collections, Boolean(transactionalQueryable));
      }
    });
  }

  private async archiveWithinCollections(
    context: BusinessContext,
    input: ArchiveRequestContextInput,
    collections: IntakeCollections,
    transactional: boolean
  ): Promise<{ request?: EventRequest; specs: AcceptedEventSpec[]; alreadyArchived: boolean }> {
    const request = await collections.requests.get(context, input.requestId);
    if (!request) {
      return {
        request: undefined,
        specs: [],
        alreadyArchived: false
      };
    }

    const archiveState: OperationalArchiveState = {
      status: "archived",
      mode: "soft_archive",
      reasonCode: input.reasonCode,
      archivedAt: input.archivedAt,
      archivedBy: input.archivedBy
    };
    const alreadyArchived = isOperationallyArchived(request);
    const archivedRequest: EventRequest = {
      ...request,
      operationalArchive: request.operationalArchive ?? archiveState
    };
    const specs = await collections.specs.list(context);
    const relatedSpecs = specs.filter((spec) =>
      spec.sourceLineage.some((source) => source.reference === input.requestId)
    );
    const changed: Array<{
      collection: BusinessScopedPersistentCollection<EventRequest | AcceptedEventSpec>;
      id: string;
      before: EventRequest | AcceptedEventSpec;
      after: EventRequest | AcceptedEventSpec;
    }> = [];
    const archivedSpecs: AcceptedEventSpec[] = relatedSpecs.map((spec) => ({
      ...spec,
      operationalArchive: spec.operationalArchive ?? archiveState
    }));

    try {
      if (!alreadyArchived) {
        const result = await collections.requests.compareAndSetExact(
          context,
          input.requestId,
          request,
          archivedRequest
        );
        if (result !== "updated") throw new IntakeStoreConflictError("request", input.requestId);
        changed.push({
          collection: collections.requests,
          id: input.requestId,
          before: request,
          after: archivedRequest
        });
      }

      for (const [index, spec] of relatedSpecs.entries()) {
        if (isOperationallyArchived(spec)) continue;
        const archivedSpec = archivedSpecs[index] as AcceptedEventSpec;
        const result = await collections.specs.compareAndSetExact(
          context,
          spec.specId,
          spec,
          archivedSpec
        );
        if (result !== "updated") throw new IntakeStoreConflictError("spec", spec.specId);
        changed.push({
          collection: collections.specs,
          id: spec.specId,
          before: spec,
          after: archivedSpec
        });
      }
    } catch (error) {
      if (!transactional) {
        for (const change of changed.reverse()) {
          const rollback = await change.collection.compareAndSetExact(
            context,
            change.id,
            change.after,
            change.before
          );
          if (rollback !== "updated") {
            throw new Error(`Intake-Archiv konnte nach Fehler nicht konsistent zurückgerollt werden: ${change.id}`, {
              cause: error
            });
          }
        }
      }
      throw error;
    }

    return {
      request: archivedRequest,
      specs: archivedSpecs,
      alreadyArchived
    };
  }

  private async saveRecord<T extends EventRequest | AcceptedEventSpec>(
    context: BusinessContext,
    collection: BusinessScopedPersistentCollection<T>,
    id: string,
    item: T,
    entity: "request" | "spec"
  ): Promise<void> {
    let existing = await collection.get(context, id);
    if (!existing) {
      if (await collection.insert(context, item) === "created") return;
      existing = await collection.get(context, id);
    }
    if (!existing) throw new IntakeStoreConflictError(entity, id);
    if (areJsonValuesEqual(existing, item)) return;
    if (isOperationallyArchived(existing)) throw new IntakeStoreConflictError(entity, id);
    const result = await collection.compareAndSetExact(context, id, existing, item);
    if (result !== "updated") throw new IntakeStoreConflictError(entity, id);
  }
}
