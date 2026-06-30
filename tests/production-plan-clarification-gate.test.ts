import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductionApp } from "@catering/production-service";
import {
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type AcceptedEventSpec
} from "@catering/shared-core";

function dataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

function specFromText(text: string, requestId: string): AcceptedEventSpec {
  return normalizeEventRequestToSpec({
    schemaVersion: SCHEMA_VERSION,
    requestId,
    source: {
      channel: "text",
      receivedAt: "2026-06-30T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: text
      }
    ]
  });
}

describe("production plan clarification gate", () => {
  it("rejects production planning while blocking clarification questions are open", async () => {
    const root = dataRoot();
    const app = buildProductionApp({ dataRoot: root });
    const spec = specFromText(
      "Konferenz fuer 60 Teilnehmer. Buffet mit Tomatensuppe.",
      "request-open-clarification"
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: spec
      }
    });
    const plans = await app.inject({ method: "GET", url: "/v1/production/plans" });
    const purchaseLists = await app.inject({ method: "GET", url: "/v1/production/purchase-lists" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "Blockierende Rückfragen müssen vor der Produktionsplanung geklärt werden.",
      specId: spec.specId
    });
    expect(response.json().blockingQuestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId: expect.stringContaining("event-date"),
          reasonCode: "event.date",
          prompt: "An welchem Datum findet das Event statt?"
        })
      ])
    );
    expect(plans.json().items).toEqual([]);
    expect(purchaseLists.json().items).toEqual([]);

    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("allows production planning when only non-blocking clarification warnings remain", async () => {
    const root = dataRoot();
    const app = buildProductionApp({ dataRoot: root });
    const spec = specFromText(
      "Lunch am 2026-06-01 fuer 40 Teilnehmer. Start 10 Uhr. Buffet mit Brot-Baguette.",
      "request-warning-clarification"
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: spec
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().productionPlan.eventSpecId).toBe(spec.specId);

    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
});
