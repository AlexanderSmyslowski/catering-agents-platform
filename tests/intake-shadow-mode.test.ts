import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp, IntakeStore } from "@catering/intake-service";
import {
  AuditLogStore,
  llmReadinessContractVersion,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest
} from "@catering/shared-core";

const TRUSTED_SECRET = "intake-shadow-mode-secret";
const trustedIntakeHeaders = {
  "x-catering-actor-name": "Intake-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

const safeText = "Synthetische Demo: Business Lunch fuer 40 Personen als Buffet mit Tomatensuppe.";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-intake-shadow-mode-"));
}

function extractionResponse(request: LlmReadinessProviderAdapterRequest) {
  return {
    ok: true,
    errors: [],
    adapterId: "mock-intake-shadow-adapter",
    adapterMode: "synthetic_live" as const,
    providerId: "openai-responses",
    providerRequestId: "req-intake-shadow-1",
    promptSchemaId: request.promptSchemaId,
    outputCandidate: {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-intake-shadow-1",
      kind: "intake_shadow_extraction" as const,
      sourceRefs: request.input.sourceRefs,
      humanApprovalRequired: true as const,
      writesProductObject: false as const,
      text: JSON.stringify({
        eventType: "lunch",
        serviceForm: "buffet",
        eventDate: null,
        attendeeCount: 40,
        menuItems: ["Business Lunch", "Tomatensuppe"]
      })
    }
  };
}

describe("intake shadow mode", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("compares regex baseline and LLM extraction without writing product objects or raw text", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new IntakeStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const requests: LlmReadinessProviderAdapterRequest[] = [];
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-intake-shadow-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => {
        requests.push(request);
        return extractionResponse(request);
      }
    };
    const app = buildIntakeApp({
      rootDir: dataRoot,
      store,
      auditLog,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/intake/shadow/normalize",
        headers: trustedIntakeHeaders,
        payload: {
          text: safeText,
          safetyMode: "synthetic_demo",
          requestId: "shadow-demo-1"
        }
      });
      const body = response.json();
      const shadowRuns = await store.listShadowRuns();
      const auditJson = JSON.stringify(await auditLog.listRecent(10));

      expect(response.statusCode, response.body).toBe(201);
      expect(requests).toHaveLength(1);
      expect(requests[0].input.kind).toBe("intake_shadow_request");
      expect(requests[0].input.policy.dataMode).toBe("synthetic_or_demo_only");
      expect(requests[0].promptContext).toContain("Business Lunch");
      expect(await store.listRequests()).toHaveLength(0);
      expect(await store.listSpecs()).toHaveLength(0);
      expect(shadowRuns).toHaveLength(1);
      expect(body.shadowRun).toMatchObject({
        status: "pending_review",
        safetyMode: "synthetic_demo",
        guardrails: {
          draftOnly: true,
          humanApprovalRequired: true,
          writesProductObjects: false,
          rawPayloadStored: false,
          dataMode: "synthetic_or_demo_only"
        }
      });
      expect(body.shadowRun.differences.map((difference: { field: string }) => difference.field)).toEqual([
        "eventType",
        "serviceForm",
        "eventDate",
        "attendeeCount",
        "menuItems"
      ]);
      expect(body.shadowRun.differences.find((difference: { field: string }) => difference.field === "eventDate")).toMatchObject({
        matches: true,
        baseline: { present: false },
        llm: { present: false }
      });
      expect(JSON.stringify(shadowRuns)).not.toContain("Business Lunch");
      expect(JSON.stringify(shadowRuns)).not.toContain("Tomatensuppe");
      expect(auditJson).toContain("intake.shadow_extraction_compared");
      expect(auditJson).not.toContain("Business Lunch");
      expect(auditJson).not.toContain("Tomatensuppe");
      expect(auditJson).not.toContain("promptContext");
      expect(auditJson).not.toContain("providerResponse");
    } finally {
      await app.close();
    }
  });

  it("rejects unapproved real-text shadow runs before provider execution", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new IntakeStore({ rootDir: dataRoot });
    const requests: LlmReadinessProviderAdapterRequest[] = [];
    const adapter: LlmReadinessProviderAdapter = {
      adapterId: "mock-intake-shadow-adapter",
      adapterMode: "synthetic_live",
      run: async (request) => {
        requests.push(request);
        return extractionResponse(request);
      }
    };
    const app = buildIntakeApp({
      rootDir: dataRoot,
      store,
      llmAdapter: adapter,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/intake/shadow/normalize",
        headers: trustedIntakeHeaders,
        payload: {
          text: "Echte Anfrage ohne Freigabe",
          safetyMode: "real_customer_data"
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.body).toContain("safetyMode synthetic_demo oder anonymized_reference");
      expect(requests).toHaveLength(0);
      expect(await store.listShadowRuns()).toHaveLength(0);
      expect(await store.listRequests()).toHaveLength(0);
      expect(await store.listSpecs()).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
