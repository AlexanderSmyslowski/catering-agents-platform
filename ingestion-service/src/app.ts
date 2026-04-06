import Fastify from "fastify";
import {
  AuditLogStore,
  actorNameFromHeaders,
  type Queryable
} from "@catering/shared-core";
import { IngestionStore } from "./store.js";
import {
  applyClarificationResponse,
  createTelegramFileFetcher,
  ingestTelegramPayload,
  parseTelegramWebhookPayload,
  updateSourceArtifactsAfterClarification
} from "./telegram.js";

interface ClarificationResponseBody {
  response: string;
}

export interface IngestionAppOptions {
  store?: IngestionStore;
  auditLog?: AuditLogStore;
  dataRoot?: string;
  databaseUrl?: string;
  pgPool?: Queryable;
  telegramBotToken?: string;
}

function actorForRequest(request: { headers: Record<string, string | string[] | undefined> }) {
  return {
    name: actorNameFromHeaders(request.headers, "Ingestion-Mitarbeiter"),
    source: request.headers["x-actor-name"] ? "header:x-actor-name" : "service-default"
  };
}

export function buildIngestionApp(options: IngestionAppOptions = {}) {
  const store =
    options.store ??
    new IngestionStore({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const auditLog =
    options.auditLog ??
    new AuditLogStore({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const telegramBotToken = options.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const fileFetcher = telegramBotToken ? createTelegramFileFetcher(telegramBotToken) : undefined;

  const app = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024
  });

  app.get("/health", async () => {
    const [telegramSources, knowledgeEntries, clarifications, auditEvents] =
      await Promise.all([
        store.listTelegramSources(),
        store.listKnowledgeEntries(),
        store.listClarifications(),
        auditLog.count()
      ]);

    return {
      service: "ingestion-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        telegramSources: telegramSources.length,
        knowledgeEntries: knowledgeEntries.length,
        clarifications: clarifications.length,
        auditEvents
      }
    };
  });

  app.post("/v1/ingestion/telegram/webhook", async (request, reply) => {
    try {
      const payload = parseTelegramWebhookPayload(request.body);
      const artifacts = await ingestTelegramPayload(store.dataRoot, payload, fileFetcher);

      await store.saveTelegramSource(artifacts.sourceItem);
      await store.saveKnowledgeEntry(artifacts.knowledgeEntry);
      for (const clarification of artifacts.clarifications) {
        await store.saveClarification(clarification);
      }

      await auditLog.log({
        action: "ingestion.telegram_received",
        entityType: "TelegramSourceItem",
        entityId: artifacts.sourceItem.sourceId,
        actor: actorForRequest(request),
        summary: `Telegram-Eingang als ${artifacts.sourceItem.classification.primaryClass} erfasst.`,
        details: {
          sourceId: artifacts.sourceItem.sourceId,
          kbId: artifacts.knowledgeEntry.kbId,
          status: artifacts.sourceItem.status,
          reviewState: artifacts.sourceItem.reviewState,
          clarificationCount: artifacts.clarifications.length
        }
      });

      return reply.code(201).send(artifacts);
    } catch (error) {
      await auditLog.log({
        action: "ingestion.telegram_failed",
        entityType: "TelegramWebhook",
        entityId: `telegram-failed-${Date.now()}`,
        actor: actorForRequest(request),
        summary: "Telegram-Eingang konnte nicht verarbeitet werden.",
        details: {
          message: error instanceof Error ? error.message : String(error)
        }
      });

      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Telegram webhook processing failed."
      });
    }
  });

  app.get("/v1/ingestion/telegram/sources", async (_request, reply) => {
    return reply.send({
      items: await store.listTelegramSources()
    });
  });

  app.get("/v1/ingestion/knowledge", async (_request, reply) => {
    return reply.send({
      items: await store.listKnowledgeEntries()
    });
  });

  app.get("/v1/ingestion/clarifications", async (_request, reply) => {
    return reply.send({
      items: await store.listClarifications()
    });
  });

  app.post<{ Params: { clarificationId: string }; Body: ClarificationResponseBody }>(
    "/v1/ingestion/clarifications/:clarificationId/respond",
    async (request, reply) => {
      const clarification = await store.getClarification(request.params.clarificationId);
      if (!clarification) {
        return reply.code(404).send({ message: "Clarification nicht gefunden." });
      }

      if (clarification.state === "answered") {
        return reply.send({
          clarification
        });
      }

      const updatedClarification = {
        ...clarification,
        state: "answered" as const,
        response: {
          answeredAt: new Date().toISOString(),
          text: request.body.response.trim(),
          actor: actorForRequest(request).name
        }
      };
      await store.saveClarification(updatedClarification);

      const sourceItem = await store.getTelegramSource(updatedClarification.sourceId);
      if (sourceItem) {
        const updatedSource = applyClarificationResponse(sourceItem, request.body.response);
        await store.saveTelegramSource(updatedSource);
        const relatedClarifications = (await store.listClarifications()).filter(
          (entry) => entry.sourceId === updatedSource.sourceId
        );
        updateSourceArtifactsAfterClarification(store.dataRoot, updatedSource, relatedClarifications);
      }

      await auditLog.log({
        action: "ingestion.telegram_clarification_answered",
        entityType: "Clarification",
        entityId: updatedClarification.clarificationId,
        actor: actorForRequest(request),
        summary: "Telegram-Rueckfrage beantwortet.",
        details: {
          sourceId: updatedClarification.sourceId
        }
      });

      return reply.send({
        clarification: updatedClarification
      });
    }
  );

  return app;
}
