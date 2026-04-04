import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection,
  type AcceptedEventSpec,
  type Money,
  type EventDemand,
  type EventRequest
} from "@catering/shared-core";

interface StoredSpecRecord {
  specId: string;
  spec: AcceptedEventSpec;
  archivedAt?: string;
}

export type ApprovalRole = "KitchenEditor" | "ProcurementEditor" | "Approver";

export interface ApprovalRequestRecord {
  approvalRequestId: string;
  specId: string;
  status: "pending" | "approved";
  requestedAt: string;
  requestedBy: {
    name: string;
    role: ApprovalRole;
  };
  criticalFields: string[];
  requestedChange: Record<string, unknown>;
  approvedAt?: string;
  approvedBy?: {
    name: string;
    role: ApprovalRole;
  };
}

export interface DocumentImportRecord {
  documentImportId: string;
  requestId: string;
  sourceChannel: EventRequest["source"]["channel"];
  createdAt: string;
  documents: Array<{
    documentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    extractedTextPreview: string;
  }>;
}

export interface ExtractedField<T> {
  value?: T;
  status: "extracted" | "uncertain" | "missing";
  note?: string;
}

export interface ExtractedContextRecord {
  extractedContextId: string;
  documentImportId: string;
  requestId: string;
  specId: string;
  status: "draft";
  fields: {
    pax: ExtractedField<number>;
    serviceForm: ExtractedField<string>;
    menuOrServiceWish: ExtractedField<string>;
    budgetTarget: ExtractedField<Money>;
    eventType: ExtractedField<string>;
    date: ExtractedField<string>;
    restrictions: ExtractedField<string[]>;
  };
  uncertainties: string[];
  missingFields: string[];
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

  private readonly eventDemands: PersistentCollection<EventDemand>;

  private readonly specs: PersistentCollection<StoredSpecRecord>;

  private readonly approvalRequests: PersistentCollection<ApprovalRequestRecord>;

  private readonly documentImports: PersistentCollection<DocumentImportRecord>;

  private readonly extractedContexts: PersistentCollection<ExtractedContextRecord>;

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
    this.eventDemands = createPersistentCollection<EventDemand>({
      collectionName: "intake/event-demands",
      getId: (demand) => demand.demandId,
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
    this.approvalRequests = createPersistentCollection<ApprovalRequestRecord>({
      collectionName: "intake/approval-requests",
      getId: (record) => record.approvalRequestId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.documentImports = createPersistentCollection<DocumentImportRecord>({
      collectionName: "intake/document-imports",
      getId: (record) => record.documentImportId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.extractedContexts = createPersistentCollection<ExtractedContextRecord>({
      collectionName: "intake/extracted-contexts",
      getId: (record) => record.extractedContextId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async saveRequest(request: EventRequest): Promise<void> {
    await this.requests.set(request);
  }

  async saveEventDemand(demand: EventDemand): Promise<void> {
    await this.eventDemands.set(demand);
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

  async getEventDemand(demandId: string): Promise<EventDemand | undefined> {
    return this.eventDemands.get(demandId);
  }

  async listEventDemands(): Promise<EventDemand[]> {
    return this.eventDemands.list();
  }

  async saveApprovalRequest(record: ApprovalRequestRecord): Promise<void> {
    await this.approvalRequests.set(record);
  }

  async getApprovalRequest(approvalRequestId: string): Promise<ApprovalRequestRecord | undefined> {
    return this.approvalRequests.get(approvalRequestId);
  }

  async listApprovalRequests(): Promise<ApprovalRequestRecord[]> {
    return this.approvalRequests.list();
  }

  async saveDocumentImport(record: DocumentImportRecord): Promise<void> {
    await this.documentImports.set(record);
  }

  async getDocumentImport(documentImportId: string): Promise<DocumentImportRecord | undefined> {
    return this.documentImports.get(documentImportId);
  }

  async listDocumentImports(): Promise<DocumentImportRecord[]> {
    return this.documentImports.list();
  }

  async saveExtractedContext(record: ExtractedContextRecord): Promise<void> {
    await this.extractedContexts.set(record);
  }

  async getExtractedContext(extractedContextId: string): Promise<ExtractedContextRecord | undefined> {
    return this.extractedContexts.get(extractedContextId);
  }

  async listExtractedContexts(): Promise<ExtractedContextRecord[]> {
    return this.extractedContexts.list();
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
