import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection,
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
  private readonly requests: PersistentCollection<EventRequest>;

  private readonly specs: PersistentCollection<AcceptedEventSpec>;

  private readonly shadowRuns: PersistentCollection<IntakeShadowRun>;

  readonly storageOptions?: CollectionStorageOptions;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options;
    this.requests = createPersistentCollection<EventRequest>({
      collectionName: "intake/requests",
      getId: (request) => request.requestId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.specs = createPersistentCollection<AcceptedEventSpec>({
      collectionName: "intake/specs",
      getId: (spec) => spec.specId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.shadowRuns = createPersistentCollection<IntakeShadowRun>({
      collectionName: "intake/shadow-runs",
      getId: (run) => run.shadowRunId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async saveRequest(request: EventRequest): Promise<void> {
    await this.requests.set(request);
  }

  async getRequest(requestId: string): Promise<EventRequest | undefined> {
    return this.requests.get(requestId);
  }

  async saveSpec(spec: AcceptedEventSpec): Promise<void> {
    await this.specs.set(spec);
  }

  async getSpec(specId: string): Promise<AcceptedEventSpec | undefined> {
    return this.specs.get(specId);
  }

  async listRequests(options?: { includeArchived?: boolean }): Promise<EventRequest[]> {
    return activeOnly(await this.requests.list(), options?.includeArchived);
  }

  async listSpecs(options?: { includeArchived?: boolean }): Promise<AcceptedEventSpec[]> {
    return activeOnly(await this.specs.list(), options?.includeArchived);
  }

  async saveShadowRun(run: IntakeShadowRun): Promise<void> {
    await this.shadowRuns.set(run);
  }

  async listShadowRuns(): Promise<IntakeShadowRun[]> {
    return this.shadowRuns.list();
  }

  async archiveRequestContext(
    input: ArchiveRequestContextInput
  ): Promise<{ request?: EventRequest; specs: AcceptedEventSpec[]; alreadyArchived: boolean }> {
    const request = await this.requests.get(input.requestId);
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
    await this.requests.set(archivedRequest);

    const specs = await this.specs.list();
    const relatedSpecs = specs.filter((spec) =>
      spec.sourceLineage.some((source) => source.reference === input.requestId)
    );
    const archivedSpecs: AcceptedEventSpec[] = [];
    for (const spec of relatedSpecs) {
      const archivedSpec: AcceptedEventSpec = {
        ...spec,
        operationalArchive: spec.operationalArchive ?? archiveState
      };
      await this.specs.set(archivedSpec);
      archivedSpecs.push(archivedSpec);
    }

    return {
      request: archivedRequest,
      specs: archivedSpecs,
      alreadyArchived
    };
  }
}
