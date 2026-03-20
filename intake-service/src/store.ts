import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection,
  type AcceptedEventSpec,
  type EventRequest
} from "@catering/shared-core";

interface StoredSpecRecord {
  specId: string;
  spec: AcceptedEventSpec;
  archivedAt?: string;
}

function isStoredSpecRecord(value: unknown): value is StoredSpecRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      "specId" in value &&
      "spec" in value &&
      typeof (value as { specId?: unknown }).specId === "string"
  );
}

function normalizeStoredSpecRecord(value: StoredSpecRecord | AcceptedEventSpec): StoredSpecRecord {
  if (isStoredSpecRecord(value)) {
    return value;
  }

  return {
    specId: value.specId,
    spec: value
  };
}

export class IntakeStore {
  private readonly requests: PersistentCollection<EventRequest>;

  private readonly specs: PersistentCollection<StoredSpecRecord>;

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
    this.specs = createPersistentCollection<StoredSpecRecord>({
      collectionName: "intake/specs",
      getId: (record) => record.specId,
      validate: normalizeStoredSpecRecord,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async saveRequest(request: EventRequest): Promise<void> {
    await this.requests.set(request);
  }

  async saveSpec(spec: AcceptedEventSpec): Promise<void> {
    const existing = await this.specs.get(spec.specId);
    await this.specs.set({
      specId: spec.specId,
      spec,
      archivedAt: existing?.archivedAt
    });
  }

  async getSpec(specId: string): Promise<AcceptedEventSpec | undefined> {
    const record = await this.specs.get(specId);
    if (!record || record.archivedAt) {
      return undefined;
    }

    return record.spec;
  }

  async listRequests(): Promise<EventRequest[]> {
    return this.requests.list();
  }

  async listSpecs(): Promise<AcceptedEventSpec[]> {
    const records = await this.specs.list();
    return records.filter((record) => !record.archivedAt).map((record) => record.spec);
  }

  async archiveSpec(specId: string): Promise<{ spec: AcceptedEventSpec; archivedAt: string } | undefined> {
    const record = await this.specs.get(specId);
    if (!record || record.archivedAt) {
      return undefined;
    }

    const archivedAt = new Date().toISOString();
    await this.specs.set({
      ...record,
      archivedAt
    });

    return {
      spec: record.spec,
      archivedAt
    };
  }
}
