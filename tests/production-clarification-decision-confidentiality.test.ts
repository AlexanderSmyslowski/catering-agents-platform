import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type AcceptedEventSpec } from "@catering/shared-core";
import { buildProductionApp } from "../production-service/src/app.js";
import {
  ProductionStore,
  type ClarificationDraft
} from "../production-service/src/repositories/production-store.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";

const TRUSTED_SECRET = "clarification-decision-confidentiality-secret";
const localBusiness = { businessId: "local" } as const;
const productionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};
const adminHeaders = {
  "x-catering-actor-name": "Administrator",
  "x-catering-trusted-secret": TRUSTED_SECRET
};
const COMMERCIAL_SENTINEL = "clarification-decision-commercial-sentinel-7e79730f";
const COMMERCIAL_AMOUNT = 7421.37;
const commercialKeys = new Set(["budgetContext", "targetBudget", "pricingSummary", "pricing"]);

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-clarification-decision-confidentiality-"));
}

function createCanonicalSpec(): AcceptedEventSpec {
  const question = clarificationQuestion();
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-clarification-decision-commercial-boundary",
    lifecycle: { commercialState: "accepted" },
    readiness: { status: "complete", reasons: [] },
    sourceLineage: [{ sourceType: "manual_input", reference: "clarification-decision-fixture" }],
    event: { type: "business_lunch", date: "2026-09-18", serviceForm: "buffet" },
    attendees: { expected: 42 },
    servicePlan: {
      eventType: "business_lunch",
      serviceForm: "buffet",
      modules: [{
        moduleId: "service-commercial-boundary",
        label: "Service vor Ort",
        category: "service",
        quantity: 1,
        pricing: { amount: COMMERCIAL_AMOUNT, currency: "EUR" }
      }]
    },
    menuPlan: [{
      componentId: "menu-commercial-boundary",
      label: "Mittagsbuffet",
      menuCategory: "classic"
    }],
    budgetContext: {
      targetBudget: { amount: 8000, currency: "EUR" },
      pricingSummary: {
        subtotal: { amount: COMMERCIAL_AMOUNT, currency: "EUR" },
        perPerson: { amount: 176.7, currency: "EUR" },
        notes: [COMMERCIAL_SENTINEL]
      }
    },
    // Die passende Unschärfe durchläuft den kanonischen Ersetzungsweg, ohne
    // eine zweite fachliche Änderung an der gespeicherten Spec hinzuzufügen.
    uncertainties: [{
      field: question.reasonCode,
      message: `KI-Rückfragen-Entwurf: ${question.reason}`,
      severity: "medium",
      suggestedQuestion: question.text
    }]
  };
}

function clarificationQuestion() {
  return {
    text: "Bitte die Serviceform für das Mittagsbuffet bestätigen.",
    reason: "Die Produktionsplanung benötigt eine bestätigte Serviceform.",
    reasonCode: "servicePlan.serviceForm"
  };
}

function clarificationDraft(draftId: string, specId: string): ClarificationDraft {
  return {
    draftId,
    specId,
    questions: [clarificationQuestion()],
    status: "pending_review",
    createdAt: "2026-08-27T10:00:00.000Z",
    updatedAt: "2026-08-27T10:00:00.000Z",
    createdBy: {
      name: "Produktions-Mitarbeiter",
      source: "trusted-proxy:x-catering-actor-name"
    },
    modelMetadata: {
      adapterId: "clarification-decision-fixture",
      adapterMode: "fixture_only",
      inputId: `input-${draftId}`
    }
  };
}

function commercialKeyPaths(value: unknown, pathPrefix = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => commercialKeyPaths(entry, `${pathPrefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    commercialKeys.has(key)
      ? [`${pathPrefix}.${key}`]
      : commercialKeyPaths(nested, `${pathPrefix}.${key}`)
  );
}

async function createFixture() {
  const dataRoot = createDataRoot();
  const intakeRecords = new InMemoryIntakeRecordsPort();
  const store = new ProductionStore({ rootDir: dataRoot });
  const canonicalSpec = createCanonicalSpec();
  await intakeRecords.insertSpec(localBusiness, canonicalSpec);
  await store.saveClarificationDraft(
    localBusiness,
    clarificationDraft("clarification-operator-commercial-boundary", canonicalSpec.specId)
  );
  await store.saveClarificationDraft(
    localBusiness,
    clarificationDraft("clarification-admin-commercial-boundary", canonicalSpec.specId)
  );
  const app = buildProductionApp({
    dataRoot,
    store,
    intakeRecords,
    trustedActorSecret: TRUSTED_SECRET,
    env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_DEV_AUTH: "1" }
  });

  return { app, canonicalSpec, dataRoot, intakeRecords };
}

describe("clarification decision confidentiality", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [dataRoot], { stdio: "ignore" });
      } catch {
        // A denied cleanup must not target a repository path or hide the test result.
      }
    }
  });

  it("projects an approved clarification spec by role while preserving canonical commercial values", async () => {
    const fixture = await createFixture();
    dataRoots.push(fixture.dataRoot);
    try {
      const operatorResponse = await fixture.app.inject({
        method: "POST",
        url: "/v1/production/clarification-drafts/clarification-operator-commercial-boundary/decision",
        headers: productionHeaders,
        payload: { approve: true }
      });

      expect(operatorResponse.statusCode, operatorResponse.body).toBe(200);
      const operatorBody = operatorResponse.json<{
        draft: ClarificationDraft;
        acceptedEventSpec: AcceptedEventSpec;
      }>();
      expect(operatorBody.draft).toMatchObject({
        status: "approved",
        decisionBy: { name: "Produktions-Mitarbeiter" }
      });
      expect(operatorBody.acceptedEventSpec).toMatchObject({
        specId: fixture.canonicalSpec.specId,
        servicePlan: { modules: [{ moduleId: "service-commercial-boundary" }] }
      });
      expect(commercialKeyPaths(operatorBody)).toEqual([]);
      expect(JSON.stringify(operatorBody)).not.toContain(COMMERCIAL_SENTINEL);
      expect(JSON.stringify(operatorBody)).not.toContain(String(COMMERCIAL_AMOUNT));
      expect(await fixture.intakeRecords.getSpec(localBusiness, fixture.canonicalSpec.specId))
        .toEqual(fixture.canonicalSpec);

      const adminResponse = await fixture.app.inject({
        method: "POST",
        url: "/v1/production/clarification-drafts/clarification-admin-commercial-boundary/decision",
        headers: adminHeaders,
        payload: { approve: true }
      });

      expect(adminResponse.statusCode, adminResponse.body).toBe(200);
      const adminBody = adminResponse.json<{
        draft: ClarificationDraft;
        acceptedEventSpec: AcceptedEventSpec;
      }>();
      expect(adminBody.draft.decisionBy).toMatchObject({ name: "Administrator" });
      expect(adminBody.acceptedEventSpec).toEqual(fixture.canonicalSpec);
      expect(JSON.stringify(adminBody)).toContain(COMMERCIAL_SENTINEL);
      expect(JSON.stringify(adminBody)).toContain(String(COMMERCIAL_AMOUNT));
      expect(await fixture.intakeRecords.getSpec(localBusiness, fixture.canonicalSpec.specId))
        .toEqual(fixture.canonicalSpec);
    } finally {
      await fixture.app.close();
    }
  });
});
