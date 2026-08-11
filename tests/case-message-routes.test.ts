import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuditLogStore } from "@catering/shared-core";
import { buildOfferApp } from "@catering/offer-service";
import { OfferStore } from "../offer-service/src/store.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";

const trustedSecret = "case-message-route-secret";
const headers = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "alpha"
};
const roots: string[] = [];

function buildHarness() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-case-message-routes-"));
  roots.push(rootDir);
  const store = new OfferStore({ rootDir });
  const app = buildOfferApp({
    rootDir,
    store,
    auditLog: new AuditLogStore({ rootDir }),
    trustedActorSecret: trustedSecret,
    env: {
      CATERING_DEFAULT_BUSINESS_ID: "alpha",
      CATERING_TRUSTED_ACTOR_SECRET: trustedSecret
    }
  });
  return { app, store };
}

function buildProductionHarness() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-production-case-message-routes-"));
  roots.push(rootDir);
  const store = new ProductionStore({ rootDir });
  const app = buildProductionApp({
    dataRoot: rootDir,
    store,
    trustedActorSecret: trustedSecret,
    env: {
      CATERING_DEFAULT_BUSINESS_ID: "alpha",
      CATERING_TRUSTED_ACTOR_SECRET: trustedSecret
    }
  });
  return { app, store };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("offer case messages", () => {
  it("appends one server-authored instruction and preserves an optional source reference", async () => {
    const { app, store } = buildHarness();
    const created = await app.inject({
      method: "POST",
      url: "/v1/offers/cases",
      headers,
      payload: { customerName: "CommCats", eventTypeLabel: "Empfang" }
    });
    const caseId = created.json().case.caseId as string;

    const before = Date.now();
    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/cases/${caseId}/messages`,
      headers,
      payload: {
        text: "Bitte Dessert ohne Alkohol kalkulieren.",
        sourceId: "source-offer-pdf"
      }
    });
    const after = Date.now();

    expect(response.statusCode).toBe(201);
    expect(response.json().event).toMatchObject({
      businessId: "alpha",
      caseId,
      sequence: 2,
      role: "user",
      kind: "instruction",
      text: "Bitte Dessert ohne Alkohol kalkulieren.",
      sourceId: "source-offer-pdf"
    });
    expect(response.json().event.eventId).toMatch(/^offer-case-event-/);
    expect(Date.parse(response.json().event.at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(response.json().event.at)).toBeLessThanOrEqual(after);
    await expect(store.listEvents({ businessId: "alpha" }, caseId)).resolves.toHaveLength(2);
  });

  it("rejects client-owned event metadata and does not append anything", async () => {
    const { app, store } = buildHarness();
    const created = await app.inject({
      method: "POST",
      url: "/v1/offers/cases",
      headers,
      payload: { eventTypeLabel: "Lunch" }
    });
    const caseId = created.json().case.caseId as string;

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/cases/${caseId}/messages`,
      headers,
      payload: {
        text: "Bitte vegetarisch planen.",
        eventId: "client-event",
        at: "2020-01-01T00:00:00.000Z",
        role: "system"
      }
    });

    expect(response.statusCode).toBe(422);
    await expect(store.listEvents({ businessId: "alpha" }, caseId)).resolves.toHaveLength(1);
  });

  it("rejects another business before looking up its case", async () => {
    const { app } = buildHarness();
    const created = await app.inject({
      method: "POST",
      url: "/v1/offers/cases",
      headers,
      payload: { eventTypeLabel: "Lunch" }
    });

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/cases/${created.json().case.caseId}/messages`,
      headers: { ...headers, "x-catering-business-id": "beta" },
      payload: { text: "Nicht sichtbar." }
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("production case messages", () => {
  const productionHeaders = {
    ...headers,
    "x-catering-actor-name": "Produktions-Mitarbeiter"
  };

  async function createCase(app: ReturnType<typeof buildProductionApp>) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/production/cases",
      headers: productionHeaders,
      payload: { customerName: "CommCats", eventTypeLabel: "Empfang" }
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().case.caseId as string;
  }

  it("appends one server-authored instruction with its optional source reference", async () => {
    const { app, store } = buildProductionHarness();
    const caseId = await createCase(app);
    const before = Date.now();

    const response = await app.inject({
      method: "POST",
      url: `/v1/production/cases/${caseId}/messages`,
      headers: productionHeaders,
      payload: {
        text: "Bitte 120 statt 100 Personen berücksichtigen.",
        sourceId: "source-production-pdf"
      }
    });
    const after = Date.now();

    expect(response.statusCode).toBe(201);
    expect(response.json().event).toMatchObject({
      businessId: "alpha",
      caseId,
      sequence: 2,
      role: "user",
      kind: "instruction",
      text: "Bitte 120 statt 100 Personen berücksichtigen.",
      sourceId: "source-production-pdf"
    });
    expect(response.json().event.eventId).toMatch(/^production-case-event-/);
    expect(Date.parse(response.json().event.at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(response.json().event.at)).toBeLessThanOrEqual(after);
    await expect(store.listEvents({ businessId: "alpha" }, caseId)).resolves.toHaveLength(2);
  });

  it("rejects client-owned event metadata and cross-business case identities", async () => {
    const { app, store } = buildProductionHarness();
    const caseId = await createCase(app);
    const existing = await store.getCase({ businessId: "alpha" }, caseId);
    await store.createCase({ businessId: "beta" }, {
      ...existing!,
      businessId: "beta",
      caseId: "production-case-beta-message"
    });

    const poisoned = await app.inject({
      method: "POST",
      url: `/v1/production/cases/${caseId}/messages`,
      headers: productionHeaders,
      payload: {
        text: "Client setzt Metadaten.",
        eventId: "client-event",
        at: "2020-01-01T00:00:00.000Z",
        role: "system"
      }
    });
    const hidden = await app.inject({
      method: "POST",
      url: "/v1/production/cases/production-case-beta-message/messages",
      headers: productionHeaders,
      payload: { text: "Nicht sichtbar." }
    });

    expect(poisoned.statusCode).toBe(422);
    expect(hidden.statusCode).toBe(404);
    await expect(store.listEvents({ businessId: "alpha" }, caseId)).resolves.toHaveLength(1);
  });
});
