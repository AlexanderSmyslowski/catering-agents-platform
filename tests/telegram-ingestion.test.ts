import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIngestionApp, IngestionStore } from "../ingestion-service/src/index.js";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-ingestion-"));
}

describe("telegram ingestion mvp 1", () => {
  it("creates a telegram source item and a compiled knowledge entry from a webhook message", async () => {
    const dataRoot = createDataRoot();
    const app = buildIngestionApp({
      store: new IngestionStore({ rootDir: dataRoot }),
      dataRoot
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/ingestion/telegram/webhook",
      payload: {
        update_id: 1001,
        message: {
          message_id: 77,
          date: 1_775_000_000,
          text: "Rezeptidee fuer Karottensuppe\nZutaten: 1 kg Karotten\nhttps://example.com/rezept",
          from: {
            id: 44,
            username: "chef"
          },
          chat: {
            id: 9001,
            type: "private"
          }
        }
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.sourceItem.classification.primaryClass).toBe("recipe_candidate");
    expect(body.sourceItem.status).toBe("compiled_to_knowledge");
    expect(body.knowledgeEntry.subtype).toBe("recipe_candidate");
    expect(body.knowledgeEntry.sourceIds).toEqual([body.sourceItem.sourceId]);

    const sourceJsonPath = path.join(dataRoot, body.sourceItem.vault.sourceJsonPath);
    const sourceMdPath = path.join(dataRoot, body.sourceItem.vault.sourceMarkdownPath);
    const knowledgeMdPath = path.join(dataRoot, body.knowledgeEntry.markdownPath);
    const mappingPath = path.join(
      dataRoot,
      body.sourceItem.vault.sourceDir,
      "derived",
      "knowledge-link.json"
    );

    expect(existsSync(sourceJsonPath)).toBe(true);
    expect(existsSync(sourceMdPath)).toBe(true);
    expect(existsSync(knowledgeMdPath)).toBe(true);
    expect(existsSync(mappingPath)).toBe(true);
    expect(readFileSync(knowledgeMdPath, "utf8")).toContain("Karottensuppe");

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("stores media-oriented telegram inputs in the source vault and opens a clarification when needed", async () => {
    const dataRoot = createDataRoot();
    const app = buildIngestionApp({
      store: new IngestionStore({ rootDir: dataRoot }),
      dataRoot
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/ingestion/telegram/webhook",
      payload: {
        chat: {
          chatId: "group-77",
          type: "group",
          title: "Ideensammlung"
        },
        message: {
          messageId: "155"
        },
        attachments: [
          {
            kind: "image",
            filename: "moodboard.jpg",
            mimeType: "image/jpeg",
            contentBase64: Buffer.from("visual").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.sourceItem.classification.primaryClass).toBe("visual_inspiration");
    expect(body.sourceItem.status).toBe("review_candidate");
    expect(body.sourceItem.processingFlags.clarificationOpen).toBe(true);
    expect(Array.isArray(body.clarifications)).toBe(true);
    expect(body.clarifications.length).toBeGreaterThan(0);

    const originalPath = path.join(
      dataRoot,
      body.sourceItem.vault.sourceDir,
      "original",
      "moodboard.jpg"
    );
    expect(existsSync(originalPath)).toBe(true);

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("stores clarification answers and closes the open source-item clarification flag", async () => {
    const dataRoot = createDataRoot();
    const store = new IngestionStore({ rootDir: dataRoot });
    const app = buildIngestionApp({
      store,
      dataRoot
    });

    const created = await app.inject({
      method: "POST",
      url: "/v1/ingestion/telegram/webhook",
      payload: {
        chat: {
          chatId: "chat-clar",
          type: "private"
        },
        message: {
          messageId: "201"
        },
        text: "Inspiration fuer neue Tellerbilder",
        attachments: [
          {
            kind: "image",
            filename: "plate.jpg",
            mimeType: "image/jpeg"
          }
        ]
      }
    });

    const createdBody = created.json();
    const clarificationId = createdBody.clarifications[0].clarificationId;

    const answered = await app.inject({
      method: "POST",
      url: `/v1/ingestion/clarifications/${clarificationId}/respond`,
      payload: {
        response: "Zur Review vormerken"
      }
    });

    expect(answered.statusCode).toBe(200);
    const answeredBody = answered.json();
    expect(answeredBody.clarification.state).toBe("answered");
    expect(answeredBody.clarification.response.text).toBe("Zur Review vormerken");

    const sourceItem = await store.getTelegramSource(createdBody.sourceItem.sourceId);
    expect(sourceItem?.processingFlags.clarificationOpen).toBe(false);
    expect(sourceItem?.status).toBe("compiled_to_knowledge");
    expect(sourceItem?.reviewState).toBe("in_review");

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });
});
