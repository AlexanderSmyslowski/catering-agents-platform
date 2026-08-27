import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEventRequestFromText,
  hasMinimalMvpCapability,
  normalizeEventRequestToSpec,
  trustedActorFromHeaders,
  type AcceptedEventSpec
} from "@catering/shared-core";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";

const TRUSTED_SECRET = "gate-b-intake-commercial-secret";
const TARGET_BUDGET_SENTINEL = 8192.44;
const PRICING_SUMMARY_SENTINEL = 7314.29;
const SERVICE_MODULE_PRICE_SENTINEL = 913.57;

function createDataRoot(): string {
  return mkdtempSync(path.join("/private/tmp", "catering-gate-b-intake-commercial-"));
}

function headersFor(actorName: string) {
  return {
    "x-catering-trusted-secret": TRUSTED_SECRET,
    "x-catering-actor-name": actorName,
    "x-catering-business-id": "local"
  };
}

function commercialSentinelSpec(): AcceptedEventSpec {
  const request = createEventRequestFromText({
    requestId: "intake-commercial-sentinel-request",
    channel: "text",
    rawText: "Interne Testveranstaltung für 42 Personen mit Buffet."
  });
  const normalized = normalizeEventRequestToSpec(request, {
    sourceType: "manual_input",
    reference: request.requestId,
    commercialState: "manual"
  });

  return {
    ...normalized,
    specId: "intake-commercial-sentinel-spec",
    servicePlan: {
      ...normalized.servicePlan,
      modules: [
        {
          moduleId: "intake-commercial-sentinel-module",
          label: "Interne Serviceleistung",
          category: "service",
          quantity: 1,
          pricing: { amount: SERVICE_MODULE_PRICE_SENTINEL, currency: "EUR" }
        }
      ]
    },
    budgetContext: {
      targetBudget: { amount: TARGET_BUDGET_SENTINEL, currency: "EUR" },
      pricingSummary: {
        subtotal: { amount: PRICING_SUMMARY_SENTINEL, currency: "EUR" },
        perPerson: { amount: 174.15, currency: "EUR" },
        notes: ["INTAKE_PRICING_SUMMARY_SENTINEL"]
      }
    }
  };
}

function expectCommercialsAbsent(spec: AcceptedEventSpec): void {
  expect(spec.budgetContext).toEqual({
    targetBudget: { amount: TARGET_BUDGET_SENTINEL, currency: "EUR" }
  });
  expect(spec.budgetContext?.pricingSummary).toBeUndefined();
  expect(spec.servicePlan.modules[0]?.pricing).toBeUndefined();

  const serialized = JSON.stringify(spec);
  expect(serialized).toContain(String(TARGET_BUDGET_SENTINEL));
  expect(serialized).not.toContain(String(PRICING_SUMMARY_SENTINEL));
  expect(serialized).not.toContain(String(SERVICE_MODULE_PRICE_SENTINEL));
  expect(serialized).not.toContain("INTAKE_PRICING_SUMMARY_SENTINEL");
}

describe("Gate B Slice 3 Intake commercial confidentiality", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [root], { stdio: "ignore" });
      } catch {
        // The test keeps cleanup recoverable and never removes a repository path.
      }
    }
  });

  it("hides commercial spec fields from Intake-Operator list and detail without changing Administrator or persistence", async () => {
    const rootDir = createDataRoot();
    roots.push(rootDir);
    const store = new IntakeStore({ rootDir });
    const spec = commercialSentinelSpec();
    await store.saveSpec({ businessId: "local" }, spec);
    const app = buildIntakeApp({ rootDir, store, trustedActorSecret: TRUSTED_SECRET });

    try {
      const intakeActor = trustedActorFromHeaders(headersFor("Intake-Mitarbeiter"), {
        fallbackActorName: "Intake-Mitarbeiter",
        fallbackBusinessId: "local",
        trustedActorSecret: TRUSTED_SECRET
      });
      expect(hasMinimalMvpCapability(intakeActor, "commercial")).toBe(false);

      const intakeList = await app.inject({
        method: "GET",
        url: "/v1/intake/specs",
        headers: headersFor("Intake-Mitarbeiter")
      });
      expect(intakeList.statusCode).toBe(200);
      const intakeListItem = intakeList.json<{ items: AcceptedEventSpec[] }>().items.find((item) => item.specId === spec.specId);
      expect(intakeListItem).toBeDefined();
      expectCommercialsAbsent(intakeListItem!);

      const intakeDetail = await app.inject({
        method: "GET",
        url: `/v1/intake/specs/${spec.specId}`,
        headers: headersFor("Intake-Mitarbeiter")
      });
      expect(intakeDetail.statusCode).toBe(200);
      expectCommercialsAbsent(intakeDetail.json<AcceptedEventSpec>());

      const adminList = await app.inject({
        method: "GET",
        url: "/v1/intake/specs",
        headers: headersFor("Administrator")
      });
      expect(adminList.statusCode).toBe(200);
      expect(adminList.json<{ items: AcceptedEventSpec[] }>().items).toContainEqual(spec);

      const adminDetail = await app.inject({
        method: "GET",
        url: `/v1/intake/specs/${spec.specId}`,
        headers: headersFor("Administrator")
      });
      expect(adminDetail.statusCode).toBe(200);
      expect(adminDetail.json<AcceptedEventSpec>()).toEqual(spec);

      const intakePatch = await app.inject({
        method: "PATCH",
        url: `/v1/intake/specs/${spec.specId}`,
        headers: headersFor("Intake-Mitarbeiter"),
        payload: { eventType: "Konferenz" }
      });
      expect(intakePatch.statusCode).toBe(200);
      expectCommercialsAbsent(
        intakePatch.json<{ acceptedEventSpec: AcceptedEventSpec }>().acceptedEventSpec
      );

      const internalDetail = await app.inject({
        method: "GET",
        url: `/v1/intake/internal/specs/${spec.specId}`,
        headers: headersFor("Production-Service")
      });
      expect(internalDetail.statusCode).toBe(200);
      expect(internalDetail.json<{ acceptedEventSpec: AcceptedEventSpec }>().acceptedEventSpec).toMatchObject({
        budgetContext: spec.budgetContext,
        servicePlan: { modules: [{ pricing: { amount: SERVICE_MODULE_PRICE_SENTINEL, currency: "EUR" } }] }
      });

      const reloaded = new IntakeStore({ rootDir });
      await expect(reloaded.getSpec({ businessId: "local" }, spec.specId)).resolves.toMatchObject({
        budgetContext: spec.budgetContext,
        servicePlan: { modules: [{ pricing: { amount: SERVICE_MODULE_PRICE_SENTINEL, currency: "EUR" } }] }
      });
    } finally {
      await app.close();
    }
  });
});
