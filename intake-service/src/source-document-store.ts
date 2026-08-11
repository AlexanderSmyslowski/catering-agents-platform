import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import {
  assertBusinessId,
  resolveCollectionQueryable,
  resolveDataRoot,
  type AuditLogStore,
  type BusinessContext,
  type ByoLlmDataClass,
  type CollectionStorageOptions,
  type Queryable,
  type TrustedActor
} from "@catering/shared-core";

export interface StoredSourceDocument {
  businessId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  dataClass: ByoLlmDataClass;
  createdAt: string;
}

export interface SourceDocumentStore {
  insert(
    context: BusinessContext,
    metadata: StoredSourceDocument,
    content: Uint8Array
  ): Promise<"created" | "same_content">;
  getMetadata(
    context: BusinessContext,
    documentId: string
  ): Promise<StoredSourceDocument | undefined>;
  getContent(
    context: BusinessContext,
    documentId: string
  ): Promise<Uint8Array | undefined>;
}

export async function insertRegisteredSourceDocument(input: {
  store: SourceDocumentStore;
  auditLog: Pick<AuditLogStore, "logFor">;
  actor: TrustedActor;
  metadata: StoredSourceDocument;
  content: Uint8Array;
}): Promise<"created" | "same_content"> {
  // This is a write-ahead record, not a completion claim: audit failure must prevent confidential bytes from being published.
  await input.auditLog.logFor(input.actor, {
    action: "intake.source_document_storage_registered",
    entityType: "SourceDocument",
    entityId: input.metadata.documentId,
    actor: input.actor,
    summary: "Speicherung des Original-Quelldokuments registriert.",
    details: {
      documentId: input.metadata.documentId,
      sha256: input.metadata.sha256,
      sizeBytes: input.metadata.sizeBytes,
      mimeType: input.metadata.mimeType
    }
  });
  return input.store.insert(input.actor, input.metadata, input.content);
}

export interface SourceDocumentStoreOptions extends CollectionStorageOptions {
  fileFaultInjector?: (phase: "before_publish" | "after_publish") => void;
}

export class SourceDocumentConflictError extends Error {
  readonly statusCode = 409;

  constructor(documentId: string) {
    super(`Quelldokument ${documentId} existiert bereits mit anderem Inhalt.`);
    this.name = "SourceDocumentConflictError";
  }
}

export class SourceDocumentIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceDocumentIntegrityError";
  }
}

const SOURCE_DOCUMENT_TABLE = "catering_source_documents";
const SOURCE_DOCUMENT_DIRECTORY = "source-documents";
const METADATA_FILENAME = "metadata.json";
const CONTENT_FILENAME = "content.bin";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DATA_CLASSES = new Set<ByoLlmDataClass>([
  "synthetic_demo",
  "anonymized",
  "pseudonymized",
  "private_business",
  "personal_confidential"
]);
const sourceTableInitialization = new WeakMap<object, Promise<void>>();

interface SourceDocumentBackend extends SourceDocumentStore {}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function validateMetadata(
  context: BusinessContext,
  metadata: StoredSourceDocument,
  content?: Uint8Array
): StoredSourceDocument {
  const businessId = assertBusinessId(context.businessId);
  if (metadata.businessId !== businessId) {
    throw new Error("Quelldokument passt nicht zum vertrauenswürdigen Betriebskontext.");
  }

  assertNonEmpty(metadata.documentId, "documentId");
  assertNonEmpty(metadata.filename, "filename");
  assertNonEmpty(metadata.mimeType, "mimeType");
  if (!Number.isSafeInteger(metadata.sizeBytes) || metadata.sizeBytes < 0) {
    throw new Error("sizeBytes muss eine sichere nicht-negative Ganzzahl sein.");
  }
  if (!SHA256_PATTERN.test(metadata.sha256)) {
    throw new Error("sha256 muss ein kleingeschriebener SHA-256-Hexwert sein.");
  }
  if (!DATA_CLASSES.has(metadata.dataClass)) {
    throw new Error("dataClass ist nicht zulässig.");
  }
  if (!metadata.createdAt || Number.isNaN(Date.parse(metadata.createdAt))) {
    throw new Error("createdAt muss ein gültiger Zeitpunkt sein.");
  }

  if (content) {
    if (metadata.sizeBytes !== content.byteLength) {
      throw new Error("metadata.sizeBytes stimmt nicht mit dem Quelldokument überein.");
    }
    if (metadata.sha256 !== sha256(content)) {
      throw new Error("metadata.sha256 stimmt nicht mit dem Quelldokument überein.");
    }
  }

  return metadata;
}

function lstatIfPresent(filePath: string) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function ensureDirectorySegment(parent: string, segment: string): string {
  const directory = path.join(parent, segment);
  const existing = lstatIfPresent(directory);
  if (!existing) {
    mkdirSync(directory, { mode: 0o700 });
    return directory;
  }
  if (existing.isSymbolicLink()) {
    throw new Error(`Source document path contains a symbolic link: ${directory}`);
  }
  if (!existing.isDirectory()) {
    throw new Error(`Source document path is not a directory: ${directory}`);
  }
  return directory;
}

function sourceRoot(
  rootDir: string | undefined,
  context: BusinessContext,
  create: boolean
): string | undefined {
  const businessId = assertBusinessId(context.businessId);
  const configuredRoot = path.resolve(resolveDataRoot(rootDir));
  if (!existsSync(configuredRoot)) {
    if (!create) return undefined;
    mkdirSync(configuredRoot, { recursive: true, mode: 0o700 });
  }
  const root = realpathSync(configuredRoot);
  const segments = ["businesses", businessId, "intake", SOURCE_DOCUMENT_DIRECTORY];
  let current = root;
  for (const segment of segments) {
    const next = path.join(current, segment);
    const existing = lstatIfPresent(next);
    if (!existing) {
      if (!create) return undefined;
      current = ensureDirectorySegment(current, segment);
      continue;
    }
    if (existing.isSymbolicLink()) {
      throw new Error(`Source document path contains a symbolic link: ${next}`);
    }
    if (!existing.isDirectory()) {
      throw new Error(`Source document path is not a directory: ${next}`);
    }
    current = next;
  }
  return current;
}

function documentDirectoryName(documentId: string): string {
  assertNonEmpty(documentId, "documentId");
  // Only the digest becomes a path component; even a hostile ID cannot escape the business root.
  return createHash("sha256").update(documentId).digest("hex");
}

function assertRegularFile(filePath: string): void {
  const stats = lstatIfPresent(filePath);
  if (!stats) {
    throw new SourceDocumentIntegrityError(`Quelldokumentdatei fehlt: ${path.basename(filePath)}`);
  }
  if (stats.isSymbolicLink()) {
    throw new SourceDocumentIntegrityError(`Quelldokumentdatei ist ein symbolic link: ${filePath}`);
  }
  if (!stats.isFile()) {
    throw new SourceDocumentIntegrityError(`Quelldokumentpfad ist keine reguläre Datei: ${filePath}`);
  }
}

function readFileWithoutFollowingLinks(filePath: string): Buffer {
  assertRegularFile(filePath);
  const fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeDurableFile(filePath: string, content: Uint8Array | string): void {
  const fd = openSync(
    filePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600
  );
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function fsyncDirectory(directory: string): void {
  const fd = openSync(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function cleanupTemporaryDirectory(directory: string): void {
  if (!existsSync(directory)) return;
  for (const filename of [METADATA_FILENAME, CONTENT_FILENAME]) {
    const filePath = path.join(directory, filename);
    if (!existsSync(filePath)) continue;
    unlinkSync(filePath);
  }
  rmdirSync(directory);
}

function parseStoredMetadata(
  context: BusinessContext,
  expectedDocumentId: string,
  payload: Buffer
): StoredSourceDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.toString("utf8"));
  } catch {
    throw new SourceDocumentIntegrityError("Quelldokument-Metadaten sind kein gültiges JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new SourceDocumentIntegrityError("Quelldokument-Metadaten fehlen.");
  }
  const metadata = parsed as StoredSourceDocument;
  validateMetadata(context, metadata);
  if (metadata.documentId !== expectedDocumentId) {
    throw new SourceDocumentIntegrityError("Quelldokument-ID stimmt nicht mit dem Speicherpfad überein.");
  }
  return metadata;
}

class FileSourceDocumentStore implements SourceDocumentBackend {
  constructor(private readonly options: SourceDocumentStoreOptions) {}

  async insert(
    context: BusinessContext,
    metadata: StoredSourceDocument,
    contentInput: Uint8Array
  ): Promise<"created" | "same_content"> {
    const content = Buffer.from(contentInput);
    validateMetadata(context, metadata, content);
    const root = sourceRoot(this.options.rootDir, context, true) as string;
    const finalDirectory = path.join(root, documentDirectoryName(metadata.documentId));
    const existing = this.readExisting(context, finalDirectory, metadata.documentId);
    if (existing) return this.resolveExisting(existing, metadata);

    const temporaryDirectory = path.join(
      root,
      `.tmp-${documentDirectoryName(metadata.documentId)}-${randomUUID()}`
    );
    mkdirSync(temporaryDirectory, { mode: 0o700 });
    let published = false;
    try {
      writeDurableFile(path.join(temporaryDirectory, CONTENT_FILENAME), content);
      writeDurableFile(
        path.join(temporaryDirectory, METADATA_FILENAME),
        JSON.stringify(metadata, null, 2)
      );
      fsyncDirectory(temporaryDirectory);
      this.options.fileFaultInjector?.("before_publish");
      try {
        renameSync(temporaryDirectory, finalDirectory);
        published = true;
      } catch (error) {
        if (!["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "")) {
          throw error;
        }
        const racedExisting = this.readExisting(context, finalDirectory, metadata.documentId);
        if (!racedExisting) throw error;
        return this.resolveExisting(racedExisting, metadata);
      }
      fsyncDirectory(root);
      this.options.fileFaultInjector?.("after_publish");
      return "created";
    } finally {
      if (!published) cleanupTemporaryDirectory(temporaryDirectory);
    }
  }

  async getMetadata(
    context: BusinessContext,
    documentId: string
  ): Promise<StoredSourceDocument | undefined> {
    const root = sourceRoot(this.options.rootDir, context, false);
    if (!root) return undefined;
    const existing = this.readExisting(
      context,
      path.join(root, documentDirectoryName(documentId)),
      documentId
    );
    return existing?.metadata;
  }

  async getContent(
    context: BusinessContext,
    documentId: string
  ): Promise<Uint8Array | undefined> {
    const root = sourceRoot(this.options.rootDir, context, false);
    if (!root) return undefined;
    const existing = this.readExisting(
      context,
      path.join(root, documentDirectoryName(documentId)),
      documentId
    );
    if (!existing) return undefined;
    validateMetadata(context, existing.metadata, existing.content);
    return existing.content;
  }

  private readExisting(
    context: BusinessContext,
    directory: string,
    expectedDocumentId: string
  ): { metadata: StoredSourceDocument; content: Buffer } | undefined {
    const stats = lstatIfPresent(directory);
    if (!stats) return undefined;
    if (stats.isSymbolicLink()) {
      throw new Error(`Source document path contains a symbolic link: ${directory}`);
    }
    if (!stats.isDirectory()) {
      throw new SourceDocumentIntegrityError("Quelldokumentpfad ist kein Verzeichnis.");
    }
    const metadata = parseStoredMetadata(
      context,
      expectedDocumentId,
      readFileWithoutFollowingLinks(path.join(directory, METADATA_FILENAME))
    );
    const content = readFileWithoutFollowingLinks(path.join(directory, CONTENT_FILENAME));
    validateMetadata(context, metadata, content);
    return { metadata, content };
  }

  private resolveExisting(
    existing: { metadata: StoredSourceDocument; content: Buffer },
    incoming: StoredSourceDocument
  ): "same_content" {
    if (existing.metadata.sha256 !== incoming.sha256) {
      throw new SourceDocumentConflictError(incoming.documentId);
    }
    return "same_content";
  }
}

function byteaBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string" && value.startsWith("\\x")) {
    return Buffer.from(value.slice(2), "hex");
  }
  throw new SourceDocumentIntegrityError("PostgreSQL-Quelldokument enthält kein BYTEA.");
}

function timestampString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new SourceDocumentIntegrityError("PostgreSQL-Quelldokument enthält keinen gültigen Zeitpunkt.");
  }
  return parsed.toISOString();
}

function metadataFromRow(row: Record<string, unknown>): StoredSourceDocument {
  return {
    businessId: String(row.business_id),
    documentId: String(row.document_id),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    dataClass: String(row.data_class) as ByoLlmDataClass,
    createdAt: timestampString(row.created_at)
  };
}

class PostgresSourceDocumentStore implements SourceDocumentBackend {
  constructor(private readonly queryable: Queryable) {}

  async insert(
    context: BusinessContext,
    metadata: StoredSourceDocument,
    contentInput: Uint8Array
  ): Promise<"created" | "same_content"> {
    const content = Buffer.from(contentInput);
    validateMetadata(context, metadata, content);
    await this.ensureInitialized();
    const result = await this.queryable.query(
      `
        INSERT INTO ${SOURCE_DOCUMENT_TABLE} (
          business_id, document_id, filename, mime_type, size_bytes,
          sha256, data_class, created_at, content
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
        RETURNING document_id
      `,
      [
        assertBusinessId(context.businessId),
        metadata.documentId,
        metadata.filename,
        metadata.mimeType,
        metadata.sizeBytes,
        metadata.sha256,
        metadata.dataClass,
        metadata.createdAt,
        content
      ]
    );
    if (result.rows.length === 1) return "created";

    const existing = await this.getMetadata(context, metadata.documentId);
    if (existing?.sha256 === metadata.sha256) return "same_content";
    throw new SourceDocumentConflictError(metadata.documentId);
  }

  async getMetadata(
    context: BusinessContext,
    documentId: string
  ): Promise<StoredSourceDocument | undefined> {
    assertNonEmpty(documentId, "documentId");
    await this.ensureInitialized();
    const result = await this.queryable.query(
      `
        SELECT business_id, document_id, filename, mime_type, size_bytes,
               sha256, data_class, created_at
        FROM ${SOURCE_DOCUMENT_TABLE}
        WHERE business_id = $1 AND document_id = $2
        LIMIT 1
      `,
      [assertBusinessId(context.businessId), documentId]
    );
    if (!result.rows[0]) return undefined;
    const metadata = metadataFromRow(result.rows[0]);
    return validateMetadata(context, metadata);
  }

  async getContent(
    context: BusinessContext,
    documentId: string
  ): Promise<Uint8Array | undefined> {
    assertNonEmpty(documentId, "documentId");
    await this.ensureInitialized();
    const result = await this.queryable.query(
      `
        SELECT business_id, document_id, filename, mime_type, size_bytes,
               sha256, data_class, created_at, content
        FROM ${SOURCE_DOCUMENT_TABLE}
        WHERE business_id = $1 AND document_id = $2
        LIMIT 1
      `,
      [assertBusinessId(context.businessId), documentId]
    );
    if (!result.rows[0]) return undefined;
    const metadata = metadataFromRow(result.rows[0]);
    const content = byteaBuffer(result.rows[0].content);
    validateMetadata(context, metadata, content);
    return content;
  }

  private async ensureInitialized(): Promise<void> {
    const key = this.queryable as object;
    if (!sourceTableInitialization.has(key)) {
      sourceTableInitialization.set(
        key,
        this.queryable.query(
          `
            CREATE TABLE IF NOT EXISTS ${SOURCE_DOCUMENT_TABLE} (
              business_id TEXT NOT NULL,
              document_id TEXT NOT NULL,
              filename TEXT NOT NULL,
              mime_type TEXT NOT NULL,
              size_bytes BIGINT NOT NULL,
              sha256 TEXT NOT NULL,
              data_class TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL,
              content BYTEA NOT NULL,
              PRIMARY KEY (business_id, document_id)
            )
          `
        ).then(() => undefined)
      );
    }
    await sourceTableInitialization.get(key);
  }
}

export function createSourceDocumentStore(
  options: SourceDocumentStoreOptions = {}
): SourceDocumentStore {
  const queryable = resolveCollectionQueryable(options);
  return queryable
    ? new PostgresSourceDocumentStore(queryable)
    : new FileSourceDocumentStore(options);
}
