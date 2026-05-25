import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection,
  type AcceptedEventSpec,
  type EventRequest,
  type OperationalArchiveReasonCode,
  type OperationalArchiveState
} from "@catering/shared-core";

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
