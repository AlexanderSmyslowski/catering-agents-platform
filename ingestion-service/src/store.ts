import {
  createPersistentCollection,
  resolveDataRoot,
  type CollectionStorageOptions,
  type PersistentCollection
} from "@catering/shared-core";

export type TelegramSourceClass =
  | "recipe_candidate"
  | "offer_reference"
  | "visual_inspiration"
  | "company_note"
  | "customer_or_event_context"
  | "unclassified";

export type TelegramSourceStatus =
  | "raw_received"
  | "classified"
  | "compiled_to_knowledge"
  | "review_candidate"
  | "failed"
  | "archived";

export type ReviewState =
  | "not_reviewed"
  | "needs_review"
  | "in_review"
  | "approved"
  | "rejected"
  | "deferred";

export type ContentType = "text" | "image" | "pdf" | "file" | "url" | "video";

export interface TelegramSenderMeta {
  telegramUserId?: string;
  username?: string;
  displayName?: string;
}

export interface TelegramChatMeta {
  chatId: string;
  type?: string;
  title?: string;
  username?: string;
}

export interface TelegramMessageMeta {
  messageId: string;
  updateId?: string;
  replyToMessageId?: string;
}

export interface TelegramAttachment {
  attachmentId: string;
  kind: "image" | "pdf" | "file" | "video";
  filename?: string;
  mimeType?: string;
  telegramFileId?: string;
  telegramFileUniqueId?: string;
  sizeBytes?: number;
  vaultOriginalPath?: string;
  downloadStatus: "stored" | "skipped" | "failed";
}

export interface TelegramSourceItem {
  sourceId: string;
  channel: "telegram";
  receivedAt: string;
  status: TelegramSourceStatus;
  reviewState: ReviewState;
  sender?: TelegramSenderMeta;
  chat: TelegramChatMeta;
  message: TelegramMessageMeta;
  contentTypes: ContentType[];
  text?: string;
  urls: string[];
  attachments: TelegramAttachment[];
  classification: {
    primaryClass: TelegramSourceClass;
    confidence: "low" | "medium" | "high";
    reasons: string[];
  };
  processingFlags: {
    knowledgeCompiled: boolean;
    clarificationOpen: boolean;
    attachmentDownloadAttempted: boolean;
  };
  vault: {
    sourceDir: string;
    sourceJsonPath: string;
    sourceMarkdownPath: string;
  };
  knowledgeEntryIds: string[];
  clarificationIds: string[];
}

export interface KnowledgeEntry {
  kbId: string;
  createdAt: string;
  sourceIds: string[];
  domain: "telegram_ingestion";
  subtype: TelegramSourceClass;
  title: string;
  summary: string;
  extractedPoints: string[];
  uncertainties: string[];
  recommendedNextSteps: string[];
  status: "draft" | "compiled" | "archived";
  reviewState: ReviewState;
  markdownPath: string;
}

export interface ClarificationRecord {
  clarificationId: string;
  sourceId: string;
  createdAt: string;
  question: string;
  suggestedAnswers: string[];
  state: "open" | "answered" | "dismissed";
  response?: {
    answeredAt: string;
    text: string;
    actor?: string;
  };
}

export class IngestionStore {
  private readonly telegramSources: PersistentCollection<TelegramSourceItem>;

  private readonly knowledgeEntries: PersistentCollection<KnowledgeEntry>;

  private readonly clarifications: PersistentCollection<ClarificationRecord>;

  readonly storageOptions?: CollectionStorageOptions;

  readonly dataRoot: string;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options;
    this.dataRoot = resolveDataRoot(options?.rootDir);
    this.telegramSources = createPersistentCollection<TelegramSourceItem>({
      collectionName: "ingestion/telegram/sources",
      getId: (item) => item.sourceId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.knowledgeEntries = createPersistentCollection<KnowledgeEntry>({
      collectionName: "ingestion/knowledge-entries",
      getId: (entry) => entry.kbId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.clarifications = createPersistentCollection<ClarificationRecord>({
      collectionName: "ingestion/clarifications",
      getId: (entry) => entry.clarificationId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async saveTelegramSource(item: TelegramSourceItem): Promise<void> {
    await this.telegramSources.set(item);
  }

  async getTelegramSource(sourceId: string): Promise<TelegramSourceItem | undefined> {
    return this.telegramSources.get(sourceId);
  }

  async listTelegramSources(): Promise<TelegramSourceItem[]> {
    const items = await this.telegramSources.list();
    return items.sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
  }

  async saveKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
    await this.knowledgeEntries.set(entry);
  }

  async getKnowledgeEntry(kbId: string): Promise<KnowledgeEntry | undefined> {
    return this.knowledgeEntries.get(kbId);
  }

  async listKnowledgeEntries(): Promise<KnowledgeEntry[]> {
    const items = await this.knowledgeEntries.list();
    return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async saveClarification(entry: ClarificationRecord): Promise<void> {
    await this.clarifications.set(entry);
  }

  async getClarification(clarificationId: string): Promise<ClarificationRecord | undefined> {
    return this.clarifications.get(clarificationId);
  }

  async listClarifications(): Promise<ClarificationRecord[]> {
    const items = await this.clarifications.list();
    return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
