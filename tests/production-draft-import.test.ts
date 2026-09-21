import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProductionApp,
  ProductionStore
} from "@catering/production-service";
import {
  AuditLogStore,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type ProductionCase,
  type ProductionDraft
} from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";

const TRUSTED_SECRET = "production-draft-import-secret";
const localBusiness = { businessId: "local" };
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-draft-import-"));
}

function productionDraft(draftId = "production-draft-import-1"): ProductionDraft {
  const eventSpec = normalizeEventRequestToSpec(
    createEventRequestFromText({
      requestId: "production-draft-import-request-1",
      channel: "text",
      rawText: "Buffet am 2026-09-18 fuer 45 Personen mit Vitello tonnato."
    })
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    businessId: "local",
    draftId,
    revision: 1,
    status: "pending_review",
    createdAt: "2026-07-01T12:00:00.000Z",
    source: {
      kind: "agent_cli",
      receivedAt: "2026-07-01T12:00:00.000Z",
      sourceRef: "upload:angebot-koepff.pdf",
      providerId: "local-codex-cli",
      modelId: "operator-selected-model",
      inputHash: "sha256:input-redacted",
      outputHash: "sha256:output-structured",
      runId: "run-production-draft-import-1"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [
      {
        cardId: "card-event",
        kind: "event_data",
        title: "Buffetdaten pruefen",
        summary: "SECRET_REVIEW_SUMMARY darf nicht im Audit auftauchen.",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: eventSpec.specId,
        requiredApproval: true
      }
    ],
    draftArtifacts: {
      eventSpec,
      openQuestions: [
        {
          field: "recipe.temperature",
          message: "Kerntemperatur offen.",
          severity: "medium",
          suggestedQuestion: "Welche Kerntemperatur soll fachlich freigegeben werden?"
        }
      ],
      notes: ["SECRET_DRAFT_NOTE bleibt nur im gespeicherten Draft."]
    }
  };
}

async function createProductionCase(app: ReturnType<typeof buildProductionApp>): Promise<ProductionCase> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/production/cases",
    headers: trustedProductionHeaders,
    payload: {
      customerName: "Synthetischer Kunde",
      eventTypeLabel: "Buffet",
      eventDate: "2026-09-18",
      attendeeCount: 45
    }
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ case: ProductionCase }>().case;
}

describe("ProductionDraft import", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("creates and lists a pending ProductionDraft from stable case and spec references", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    const spec = productionDraft().draftArtifacts.eventSpec!;

    try {
      await intakeRecords.insertSpec(localBusiness, spec);
      const productionCase = await createProductionCase(app);
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: { caseId: productionCase.caseId, specId: spec.specId }
      });
      const listResponse = await app.inject({
        method: "GET",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders
      });
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 5));

      expect(response.statusCode).toBe(201);
      expect(response.json<{ draft: ProductionDraft }>().draft.status).toBe("pending_review");
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json<{ items: ProductionDraft[] }>().items).toHaveLength(1);
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
      expect(auditJson).toContain("production.production_draft_imported");
      expect(auditJson).toContain(spec.specId);
      expect(auditJson).not.toContain("SECRET_REVIEW_SUMMARY");
      expect(auditJson).not.toContain("SECRET_DRAFT_NOTE");
      expect(auditJson).not.toContain("systemPrompt");
      expect(auditJson).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("rejects legacy snapshot payloads without echoing raw content or persisting them", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    const invalidDraft = {
      ...productionDraft(),
      prompt: "SECRET_RAW_PROMPT_PAYLOAD"
    };

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: invalidDraft
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("caseId und specId");
      expect(response.body).not.toContain("SECRET_RAW_PROMPT_PAYLOAD");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects client-owned fields alongside stable references", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    const spec = productionDraft().draftArtifacts.eventSpec!;

    try {
      await intakeRecords.insertSpec(localBusiness, spec);
      const productionCase = await createProductionCase(app);
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: { caseId: productionCase.caseId, specId: spec.specId, status: "approved" }
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("als einzige Referenzen");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("returns 404 for an unknown production case without persisting a draft", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    const spec = productionDraft().draftArtifacts.eventSpec!;

    try {
      await intakeRecords.insertSpec(localBusiness, spec);
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: { caseId: "production-case-unknown", specId: spec.specId }
      });

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain("Produktionsauftrag nicht gefunden");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("returns 404 for an unknown spec without persisting a draft", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    try {
      const productionCase = await createProductionCase(app);
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: { caseId: productionCase.caseId, specId: "spec-unknown" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain("AcceptedEventSpec nicht gefunden");
      expect(await store.listProductionDrafts(localBusiness)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
