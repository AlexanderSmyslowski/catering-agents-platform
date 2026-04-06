import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import type {
  ClarificationRecord,
  ContentType,
  KnowledgeEntry,
  ReviewState,
  TelegramAttachment,
  TelegramChatMeta,
  TelegramMessageMeta,
  TelegramSenderMeta,
  TelegramSourceClass,
  TelegramSourceItem,
  TelegramSourceStatus
} from "./store.js";

export interface TelegramAttachmentInput {
  kind: "image" | "pdf" | "file" | "video";
  filename?: string;
  mimeType?: string;
  telegramFileId?: string;
  telegramFileUniqueId?: string;
  sizeBytes?: number;
  contentBase64?: string;
}

export interface NormalizedTelegramPayload {
  receivedAt?: string;
  sender?: TelegramSenderMeta;
  chat: TelegramChatMeta;
  message: TelegramMessageMeta;
  text?: string;
  urls?: string[];
  attachments?: TelegramAttachmentInput[];
}

export interface TelegramDownloadResult {
  filename?: string;
  mimeType?: string;
  buffer: Buffer;
}

export type TelegramFileFetcher = (
  attachment: TelegramAttachmentInput
) => Promise<TelegramDownloadResult | undefined>;

export interface IngestionArtifacts {
  sourceItem: TelegramSourceItem;
  knowledgeEntry: KnowledgeEntry;
  clarifications: ClarificationRecord[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function pick<T>(items: T[]): T | undefined {
  return items.find(Boolean);
}

function escapeMd(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function parseTelegramWebhookPayload(body: unknown): NormalizedTelegramPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Telegram webhook payload must be an object.");
  }

  const payload = body as Record<string, unknown>;

  if ("chat" in payload && "message" in payload) {
    return payload as unknown as NormalizedTelegramPayload;
  }

  const message = (payload.message ?? payload.edited_message) as Record<string, unknown> | undefined;
  if (!message) {
    throw new Error("Telegram webhook payload does not contain a message.");
  }

  const chat = (message.chat ?? {}) as Record<string, unknown>;
  const from = (message.from ?? {}) as Record<string, unknown>;
  const entities = Array.isArray(message.entities) ? message.entities : [];
  const captionEntities = Array.isArray(message.caption_entities) ? message.caption_entities : [];
  const baseText =
    (typeof message.text === "string" ? message.text : undefined) ??
    (typeof message.caption === "string" ? message.caption : undefined);

  const urls = [
    ...extractUrlsFromText(baseText),
    ...extractUrlsFromEntities(baseText, entities),
    ...extractUrlsFromEntities(baseText, captionEntities)
  ];

  const photo = Array.isArray(message.photo)
    ? pick(
        [...(message.photo as Array<Record<string, unknown>>)].sort(
          (left, right) =>
            Number(right.file_size ?? 0) - Number(left.file_size ?? 0)
        )
      )
    : undefined;

  const document = (message.document ?? undefined) as Record<string, unknown> | undefined;
  const video = (message.video ?? undefined) as Record<string, unknown> | undefined;
  const documentKind: TelegramAttachmentInput["kind"] | undefined = document
    ? typeof document.mime_type === "string" && /pdf/i.test(document.mime_type)
      ? "pdf"
      : "file"
    : undefined;

  const attachments: TelegramAttachmentInput[] = [
    ...(photo
      ? [
          {
            kind: "image" as const,
            telegramFileId: typeof photo.file_id === "string" ? photo.file_id : undefined,
            telegramFileUniqueId:
              typeof photo.file_unique_id === "string" ? photo.file_unique_id : undefined,
            sizeBytes:
              typeof photo.file_size === "number" ? photo.file_size : undefined
          }
        ]
      : []),
    ...(document
      ? [
          {
            kind: documentKind ?? "file",
            filename:
              typeof document.file_name === "string" ? document.file_name : undefined,
            mimeType:
              typeof document.mime_type === "string" ? document.mime_type : undefined,
            telegramFileId:
              typeof document.file_id === "string" ? document.file_id : undefined,
            telegramFileUniqueId:
              typeof document.file_unique_id === "string"
                ? document.file_unique_id
                : undefined,
            sizeBytes:
              typeof document.file_size === "number" ? document.file_size : undefined
          }
        ]
      : []),
    ...(video
      ? [
          {
            kind: "video" as const,
            mimeType: typeof video.mime_type === "string" ? video.mime_type : undefined,
            telegramFileId:
              typeof video.file_id === "string" ? video.file_id : undefined,
            telegramFileUniqueId:
              typeof video.file_unique_id === "string" ? video.file_unique_id : undefined,
            sizeBytes:
              typeof video.file_size === "number" ? video.file_size : undefined
          }
        ]
      : [])
  ];

  return {
    receivedAt: new Date().toISOString(),
    sender:
      typeof from.id === "number" || typeof from.id === "string"
        ? {
            telegramUserId: String(from.id),
            username: typeof from.username === "string" ? from.username : undefined,
            displayName: [from.first_name, from.last_name]
              .filter((part) => typeof part === "string" && part.trim().length > 0)
              .join(" ")
              .trim() || undefined
          }
        : undefined,
    chat: {
      chatId: String(chat.id ?? "unknown-chat"),
      type: typeof chat.type === "string" ? chat.type : undefined,
      title: typeof chat.title === "string" ? chat.title : undefined,
      username: typeof chat.username === "string" ? chat.username : undefined
    },
    message: {
      messageId: String(message.message_id ?? "unknown-message"),
      updateId:
        typeof payload.update_id === "number" || typeof payload.update_id === "string"
          ? String(payload.update_id)
          : undefined,
      replyToMessageId:
        typeof (message.reply_to_message as Record<string, unknown> | undefined)?.message_id === "number" ||
        typeof (message.reply_to_message as Record<string, unknown> | undefined)?.message_id === "string"
          ? String((message.reply_to_message as Record<string, unknown>).message_id)
          : undefined
    },
    text: baseText,
    urls: [...new Set(urls)],
    attachments
  };
}

function extractUrlsFromText(text?: string): string[] {
  if (!text) {
    return [];
  }

  return [...text.matchAll(/https?:\/\/\S+/gi)].map((match) => match[0]);
}

function extractUrlsFromEntities(
  text: string | undefined,
  entities: unknown[]
): string[] {
  if (!text) {
    return [];
  }

  return entities.flatMap((entity) => {
    const record = entity as Record<string, unknown>;
    if (record.type === "text_link" && typeof record.url === "string") {
      return [record.url];
    }
    if (record.type !== "url") {
      return [];
    }
    const offset = Number(record.offset ?? -1);
    const length = Number(record.length ?? 0);
    if (offset < 0 || length <= 0) {
      return [];
    }
    return [text.slice(offset, offset + length)];
  });
}

function classifyTelegramContent(input: NormalizedTelegramPayload): {
  primaryClass: TelegramSourceClass;
  confidence: "low" | "medium" | "high";
  reasons: string[];
} {
  const haystack = [
    input.text ?? "",
    ...(input.urls ?? []),
    ...((input.attachments ?? []).map((attachment) => attachment.filename ?? "")),
    ...((input.attachments ?? []).map((attachment) => attachment.mimeType ?? ""))
  ]
    .join(" \n")
    .toLowerCase();

  const hasImage = (input.attachments ?? []).some((attachment) => attachment.kind === "image");
  const hasVideo = (input.attachments ?? []).some((attachment) => attachment.kind === "video");
  const reasons: string[] = [];

  if (/(zutaten|zubereitung|rezept|marinade|backen|kochen|\bkg\b|\bml\b|\bg\b)/i.test(haystack)) {
    reasons.push("Starke Rezeptmarker im Text oder Dateinamen erkannt.");
    return {
      primaryClass: "recipe_candidate",
      confidence: reasons.length > 0 ? "high" : "medium",
      reasons
    };
  }

  if (/(angebot|gesamtkosten|kosten|pax|teilnehmer|buffet|lunch|menu|menü|catering)/i.test(haystack)) {
    reasons.push("Angebots- oder Catering-Referenz erkannt.");
    return {
      primaryClass: "offer_reference",
      confidence: "medium",
      reasons
    };
  }

  if (
    /(kunde|kundin|event|veranstaltung|konferenz|hochzeit|geburtstag|datum|ort|location|ansprechpartner)/i.test(
      haystack
    )
  ) {
    reasons.push("Kunden- oder Eventkontext erkannt.");
    return {
      primaryClass: "customer_or_event_context",
      confidence: "medium",
      reasons
    };
  }

  if (hasImage || hasVideo || /(inspiration|mood|look|style|referenzbild|visual)/i.test(haystack)) {
    reasons.push("Medien- oder Inspirationssignal erkannt.");
    return {
      primaryClass: "visual_inspiration",
      confidence: hasImage || hasVideo ? "medium" : "low",
      reasons
    };
  }

  if (/(notiz|intern|todo|meeting|besprechung|firma|unternehmen|prozess)/i.test(haystack)) {
    reasons.push("Interne Notizmarker erkannt.");
    return {
      primaryClass: "company_note",
      confidence: "medium",
      reasons
    };
  }

  return {
    primaryClass: "unclassified",
    confidence: "low",
    reasons: ["Keine klare Zielklasse aus dem Eingang ableitbar."]
  };
}

function reviewStateForClassification(
  classification: ReturnType<typeof classifyTelegramContent>
): ReviewState {
  return classification.primaryClass === "unclassified" || classification.confidence === "low"
    ? "needs_review"
    : "not_reviewed";
}

function nextStepsForClass(
  primaryClass: TelegramSourceClass,
  hasClarification: boolean
): string[] {
  const steps: Record<TelegramSourceClass, string[]> = {
    recipe_candidate: ["Fuer fachliche Review vormerken und Rezeptqualitaet pruefen."],
    offer_reference: ["Als Referenzquelle einordnen, aber nicht direkt in operative Objekte uebernehmen."],
    visual_inspiration: ["Als Inspiration sichtbar halten und bei Bedarf spaeter kuratieren."],
    company_note: ["Kurz pruefen, ob die Notiz in einen stabileren Wissenseintrag ueberfuehrt werden soll."],
    customer_or_event_context: ["Zuordnen, ob der Kontext spaeter mit Kunde oder Event referenziert werden soll."],
    unclassified: ["Eingang kurz sichten und Zielklasse manuell bestaetigen."]
  };
  return hasClarification
    ? [...steps[primaryClass], "Offene Rueckfrage beantworten, bevor weiter kuratiert wird."]
    : steps[primaryClass];
}

function buildTitle(input: NormalizedTelegramPayload, primaryClass: TelegramSourceClass): string {
  const firstLine = input.text?.split("\n").find((line) => line.trim().length > 0)?.trim();
  if (firstLine) {
    return firstLine.slice(0, 80);
  }

  const filename = input.attachments?.find((attachment) => attachment.filename)?.filename;
  if (filename) {
    return filename;
  }

  return {
    recipe_candidate: "Telegram-Rezeptkandidat",
    offer_reference: "Telegram-Angebotsreferenz",
    visual_inspiration: "Telegram-Inspiration",
    company_note: "Telegram-Unternehmensnotiz",
    customer_or_event_context: "Telegram-Kunden- oder Eventkontext",
    unclassified: "Telegram-Eingang"
  }[primaryClass];
}

function buildSummary(input: NormalizedTelegramPayload, primaryClass: TelegramSourceClass): string {
  if (input.text?.trim()) {
    return input.text.trim().replace(/\s+/g, " ").slice(0, 240);
  }

  const attachmentSummary = (input.attachments ?? [])
    .map((attachment) => attachment.filename ?? attachment.kind)
    .join(", ");
  if (attachmentSummary) {
    return `Telegram-Eingang vom Typ ${primaryClass} mit Anhaengen: ${attachmentSummary}.`;
  }

  return `Telegram-Eingang vom Typ ${primaryClass}.`;
}

function buildExtractedPoints(input: NormalizedTelegramPayload): string[] {
  const points = [
    ...((input.text ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 5)),
    ...((input.urls ?? []).map((url) => `URL: ${url}`)),
    ...((input.attachments ?? []).map((attachment) => {
      const name = attachment.filename ?? attachment.kind;
      return `Anhang: ${name}${attachment.mimeType ? ` (${attachment.mimeType})` : ""}`;
    }))
  ];

  return [...new Set(points)].slice(0, 8);
}

function buildUncertainties(
  input: NormalizedTelegramPayload,
  classification: ReturnType<typeof classifyTelegramContent>,
  clarifications: ClarificationRecord[]
): string[] {
  const items: string[] = [];

  if (classification.primaryClass === "unclassified") {
    items.push("Die Zielklasse ist aus dem Telegram-Eingang noch nicht belastbar klar.");
  }
  if ((input.attachments ?? []).some((attachment) => attachment.kind === "video")) {
    items.push("Videoinhalte werden in diesem MVP nur gespeichert, aber noch nicht tief analysiert.");
  }
  if (clarifications.length > 0) {
    items.push("Mindestens eine Rueckfrage ist noch offen.");
  }

  return items;
}

function inboxDirectoryForStatus(status: TelegramSourceStatus): string {
  if (status === "raw_received") {
    return "incoming";
  }
  if (status === "classified" || status === "review_candidate") {
    return "processing";
  }
  if (status === "failed") {
    return "failed";
  }
  return "archived";
}

function syncInboxSnapshot(
  dataRoot: string,
  sourceId: string,
  status: TelegramSourceStatus,
  payload: unknown
): void {
  const baseDir = path.join(dataRoot, "inbox", "telegram");
  const folders = ["incoming", "processing", "failed", "archived"];
  const targetFolder = inboxDirectoryForStatus(status);

  for (const folder of folders) {
    mkdirSync(path.join(baseDir, folder), { recursive: true });
    const filePath = path.join(baseDir, folder, `${sourceId}.json`);
    if (folder === targetFolder) {
      writeFileSync(filePath, JSON.stringify(payload, null, 2));
    } else if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
  }
}

function dateSegments(receivedAt: string): [string, string, string] {
  const iso = receivedAt.slice(0, 10);
  const [year, month, day] = iso.split("-");
  return [year ?? "unknown", month ?? "unknown", day ?? "unknown"];
}

function ensureDir(directory: string): void {
  mkdirSync(directory, { recursive: true });
}

async function storeOriginalAttachments(
  input: NormalizedTelegramPayload,
  sourceDir: string,
  fetcher?: TelegramFileFetcher
): Promise<{
  attachments: TelegramAttachment[];
  attemptedDownload: boolean;
}> {
  const originalDir = path.join(sourceDir, "original");
  ensureDir(originalDir);

  const attachments: TelegramAttachment[] = [];
  let attemptedDownload = false;

  for (const [index, attachment] of (input.attachments ?? []).entries()) {
    const attachmentId = attachment.telegramFileUniqueId ?? attachment.telegramFileId ?? `attachment-${index + 1}`;
    let filename =
      attachment.filename ??
      `${attachmentId}${attachment.kind === "pdf" ? ".pdf" : attachment.kind === "image" ? ".jpg" : attachment.kind === "video" ? ".mp4" : ".bin"}`;
    let downloadStatus: TelegramAttachment["downloadStatus"] = "skipped";
    let vaultOriginalPath: string | undefined;

    if (attachment.contentBase64) {
      const buffer = Buffer.from(attachment.contentBase64, "base64");
      const filePath = path.join(originalDir, filename);
      writeFileSync(filePath, buffer);
      vaultOriginalPath = path.relative(sourceDir, filePath);
      downloadStatus = "stored";
      attemptedDownload = true;
    } else if (fetcher && attachment.telegramFileId) {
      attemptedDownload = true;
      try {
        const result = await fetcher(attachment);
        if (result) {
          filename = result.filename ?? filename;
          const filePath = path.join(originalDir, filename);
          writeFileSync(filePath, result.buffer);
          vaultOriginalPath = path.relative(sourceDir, filePath);
          downloadStatus = "stored";
        }
      } catch {
        downloadStatus = "failed";
      }
    }

    attachments.push({
      attachmentId,
      kind: attachment.kind,
      filename,
      mimeType: attachment.mimeType,
      telegramFileId: attachment.telegramFileId,
      telegramFileUniqueId: attachment.telegramFileUniqueId,
      sizeBytes: attachment.sizeBytes,
      vaultOriginalPath,
      downloadStatus
    });
  }

  return {
    attachments,
    attemptedDownload
  };
}

function createSourceMarkdown(
  sourceItem: TelegramSourceItem,
  clarifications: ClarificationRecord[]
): string {
  return [
    `# Telegram Source ${sourceItem.sourceId}`,
    "",
    `- Kanal: ${sourceItem.channel}`,
    `- Empfangen: ${sourceItem.receivedAt}`,
    `- Status: ${sourceItem.status}`,
    `- Review: ${sourceItem.reviewState}`,
    `- Klasse: ${sourceItem.classification.primaryClass}`,
    `- Vertrauen: ${sourceItem.classification.confidence}`,
    `- Chat: ${sourceItem.chat.chatId}${sourceItem.chat.title ? ` (${sourceItem.chat.title})` : ""}`,
    `- Nachricht: ${sourceItem.message.messageId}`,
    "",
    "## Text",
    "",
    sourceItem.text ? escapeMd(sourceItem.text) : "_Kein Text vorhanden_",
    "",
    "## URLs",
    "",
    ...(sourceItem.urls.length > 0 ? sourceItem.urls.map((url) => `- ${url}`) : ["- Keine URLs erkannt."]),
    "",
    "## Anhänge",
    "",
    ...(sourceItem.attachments.length > 0
      ? sourceItem.attachments.map((attachment) => {
          const original = attachment.vaultOriginalPath
            ? ` -> ${attachment.vaultOriginalPath}`
            : "";
          return `- ${attachment.kind}: ${attachment.filename ?? attachment.attachmentId} (${attachment.downloadStatus})${original}`;
        })
      : ["- Keine Anhänge erkannt."]),
    "",
    "## Offene Rueckfragen",
    "",
    ...(clarifications.length > 0
      ? clarifications.map((clarification) => `- ${clarification.question}`)
      : ["- Keine Rueckfragen offen."])
  ].join("\n");
}

function createKnowledgeMarkdown(entry: KnowledgeEntry): string {
  return [
    `# ${escapeMd(entry.title)}`,
    "",
    `- KB-ID: ${entry.kbId}`,
    `- Domain: ${entry.domain}`,
    `- Subtyp: ${entry.subtype}`,
    `- Status: ${entry.status}`,
    `- Review: ${entry.reviewState}`,
    "",
    "## Kurzbeschreibung",
    "",
    escapeMd(entry.summary),
    "",
    "## Extrahierte Punkte",
    "",
    ...(entry.extractedPoints.length > 0
      ? entry.extractedPoints.map((point) => `- ${escapeMd(point)}`)
      : ["- Keine extrahierten Punkte."]),
    "",
    "## Unsicherheiten",
    "",
    ...(entry.uncertainties.length > 0
      ? entry.uncertainties.map((item) => `- ${escapeMd(item)}`)
      : ["- Keine expliziten Unsicherheiten vermerkt."]),
    "",
    "## Quellen",
    "",
    ...entry.sourceIds.map((sourceId) => `- ${sourceId}`),
    "",
    "## Empfohlene nächste Schritte",
    "",
    ...(entry.recommendedNextSteps.length > 0
      ? entry.recommendedNextSteps.map((step) => `- ${escapeMd(step)}`)
      : ["- Keine weiteren Schritte vorgeschlagen."])
  ].join("\n");
}

function clarificationDraftsFor(
  sourceId: string,
  receivedAt: string,
  classification: ReturnType<typeof classifyTelegramContent>,
  input: NormalizedTelegramPayload
): ClarificationRecord[] {
  const drafts: Array<{ question: string; suggestedAnswers: string[] }> = [];

  if (classification.primaryClass === "unclassified") {
    drafts.push({
      question: "Ist das ein Rezeptkandidat, eine Referenz oder nur eine Notiz?",
      suggestedAnswers: ["Rezeptkandidat", "Referenz", "Nur Notiz"]
    });
  } else if (classification.primaryClass === "visual_inspiration") {
    drafts.push({
      question: "Nur als Inspiration speichern oder zur Review vormerken?",
      suggestedAnswers: ["Nur speichern", "Zur Review vormerken"]
    });
  } else if (classification.primaryClass === "customer_or_event_context") {
    drafts.push({
      question: "Gehört das schon zu einem konkreten Kunden oder Event?",
      suggestedAnswers: ["Ja, zuordnen", "Noch offen", "Nur Kontext speichern"]
    });
  }

  if ((input.urls ?? []).length === 0 && !(input.text ?? "").trim() && (input.attachments ?? []).length > 0) {
    drafts.push({
      question: "Soll dieser Medieninhalt nur archiviert oder fachlich gesichtet werden?",
      suggestedAnswers: ["Nur archivieren", "Fachlich sichten"]
    });
  }

  return drafts.map((draft, index) => ({
    clarificationId: `clar-${sourceId}-${index + 1}`,
    sourceId,
    createdAt: receivedAt,
    question: draft.question,
    suggestedAnswers: draft.suggestedAnswers,
    state: "open"
  }));
}

export async function ingestTelegramPayload(
  dataRoot: string,
  payload: NormalizedTelegramPayload,
  fileFetcher?: TelegramFileFetcher
): Promise<IngestionArtifacts> {
  const receivedAt = payload.receivedAt ?? new Date().toISOString();
  const sourceId = `telegram-${payload.chat.chatId}-${payload.message.messageId}`;
  const [year, month, day] = dateSegments(receivedAt);
  const sourceDir = path.join(
    dataRoot,
    "source-vault",
    "telegram",
    "by-date",
    year,
    month,
    day,
    sourceId
  );
  ensureDir(sourceDir);
  ensureDir(path.join(sourceDir, "derived"));

  const classification = classifyTelegramContent(payload);
  const clarifications = clarificationDraftsFor(sourceId, receivedAt, classification, payload);
  const storedAttachments = await storeOriginalAttachments(payload, sourceDir, fileFetcher);
  const contentTypes = new Set<ContentType>();

  if ((payload.text ?? "").trim()) {
    contentTypes.add("text");
  }
  if ((payload.urls ?? []).length > 0) {
    contentTypes.add("url");
  }
  for (const attachment of storedAttachments.attachments) {
    contentTypes.add(attachment.kind === "pdf" ? "pdf" : attachment.kind);
  }

  const reviewState = reviewStateForClassification(classification);
  const status: TelegramSourceStatus = clarifications.length > 0 ? "review_candidate" : "compiled_to_knowledge";
  const title = buildTitle(payload, classification.primaryClass);
  const summary = buildSummary(payload, classification.primaryClass);
  const uncertainties = buildUncertainties(payload, classification, clarifications);
  const kbId = `kb-${slugify(sourceId)}`;
  const knowledgeDir = path.join(
    dataRoot,
    "compiled-knowledge",
    "inbox-derived",
    "telegram",
    year,
    month,
    day
  );
  ensureDir(knowledgeDir);
  const markdownPath = path.join(knowledgeDir, `${kbId}.md`);

  const sourceItem: TelegramSourceItem = {
    sourceId,
    channel: "telegram",
    receivedAt,
    status,
    reviewState,
    sender: payload.sender,
    chat: payload.chat,
    message: payload.message,
    contentTypes: [...contentTypes],
    text: payload.text?.trim() || undefined,
    urls: [...new Set(payload.urls ?? [])],
    attachments: storedAttachments.attachments,
    classification,
    processingFlags: {
      knowledgeCompiled: true,
      clarificationOpen: clarifications.length > 0,
      attachmentDownloadAttempted: storedAttachments.attemptedDownload
    },
    vault: {
      sourceDir: path.relative(dataRoot, sourceDir),
      sourceJsonPath: path.relative(dataRoot, path.join(sourceDir, "source.json")),
      sourceMarkdownPath: path.relative(dataRoot, path.join(sourceDir, "source.md"))
    },
    knowledgeEntryIds: [kbId],
    clarificationIds: clarifications.map((clarification) => clarification.clarificationId)
  };

  const knowledgeEntry: KnowledgeEntry = {
    kbId,
    createdAt: receivedAt,
    sourceIds: [sourceId],
    domain: "telegram_ingestion",
    subtype: classification.primaryClass,
    title,
    summary,
    extractedPoints: buildExtractedPoints(payload),
    uncertainties,
    recommendedNextSteps: nextStepsForClass(classification.primaryClass, clarifications.length > 0),
    status: "compiled",
    reviewState,
    markdownPath: path.relative(dataRoot, markdownPath)
  };

  writeFileSync(path.join(sourceDir, "source.json"), JSON.stringify(sourceItem, null, 2));
  writeFileSync(path.join(sourceDir, "source.md"), createSourceMarkdown(sourceItem, clarifications));
  writeFileSync(markdownPath, createKnowledgeMarkdown(knowledgeEntry));
  writeFileSync(
    path.join(sourceDir, "derived", "knowledge-link.json"),
    JSON.stringify(
      {
        sourceId,
        kbId,
        markdownPath: knowledgeEntry.markdownPath
      },
      null,
      2
    )
  );

  syncInboxSnapshot(dataRoot, sourceId, "raw_received", {
    sourceId,
    stage: "raw_received",
    receivedAt,
    messageId: payload.message.messageId
  });
  syncInboxSnapshot(dataRoot, sourceId, "classified", {
    sourceId,
    stage: "classified",
    classification
  });
  syncInboxSnapshot(dataRoot, sourceId, status, sourceItem);

  return {
    sourceItem,
    knowledgeEntry,
    clarifications
  };
}

export function applyClarificationResponse(
  sourceItem: TelegramSourceItem,
  responseText: string
): TelegramSourceItem {
  return {
    ...sourceItem,
    status: "compiled_to_knowledge",
    reviewState: "in_review",
    processingFlags: {
      ...sourceItem.processingFlags,
      clarificationOpen: false
    }
  };
}

export function updateSourceArtifactsAfterClarification(
  dataRoot: string,
  sourceItem: TelegramSourceItem,
  clarifications: ClarificationRecord[]
): void {
  const sourceDir = path.join(dataRoot, sourceItem.vault.sourceDir);
  writeFileSync(path.join(sourceDir, "source.json"), JSON.stringify(sourceItem, null, 2));
  writeFileSync(path.join(sourceDir, "source.md"), createSourceMarkdown(sourceItem, clarifications));
  syncInboxSnapshot(dataRoot, sourceItem.sourceId, sourceItem.status, sourceItem);
}

export function createTelegramFileFetcher(botToken: string): TelegramFileFetcher {
  return async (attachment) => {
    if (!attachment.telegramFileId) {
      return undefined;
    }

    const metaResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(attachment.telegramFileId)}`
    );
    if (!metaResponse.ok) {
      throw new Error(`Telegram getFile failed with ${metaResponse.status}.`);
    }

    const meta = (await metaResponse.json()) as {
      ok?: boolean;
      result?: { file_path?: string };
    };
    if (!meta.ok || !meta.result?.file_path) {
      return undefined;
    }

    const fileResponse = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${meta.result.file_path}`
    );
    if (!fileResponse.ok) {
      throw new Error(`Telegram file download failed with ${fileResponse.status}.`);
    }

    return {
      filename: attachment.filename ?? path.basename(meta.result.file_path),
      mimeType: attachment.mimeType,
      buffer: Buffer.from(await fileResponse.arrayBuffer())
    };
  };
}
