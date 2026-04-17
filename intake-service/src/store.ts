import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection,
  type AcceptedEventSpec,
  type EventRequest
} from "@catering/shared-core";

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

  async listRequests(): Promise<EventRequest[]> {
    return this.requests.list();
  }

  async listSpecs(): Promise<AcceptedEventSpec[]> {
    return this.specs.list();
  }
}
