import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProductionProductData } from "../backoffice-ui/src/api.js";

function productionCaseDetail(overrides: Record<string, unknown> = {}) {
  return {
    case: {
      schemaVersion: "1.0",
      businessId: "local",
      caseId: "case-a",
      product: "production",
      displayName: "Produktion A",
      status: "open",
      version: 4,
      createdAt: "2026-08-27T08:00:00.000Z",
      updatedAt: "2026-08-27T09:00:00.000Z",
      sourceSpecId: "spec-a",
      approvedProductionSpecId: "approved-a",
      currentPlanId: "plan-a",
      currentPurchaseListId: "purchase-a",
      ...overrides
    },
    events: [{
      businessId: "local",
      eventId: "event-revision-a",
      caseId: "case-a",
      sequence: 4,
      at: "2026-08-27T08:30:00.000Z",
      role: "assistant",
      kind: "revision_created",
      text: "Freigegebene Revision erstellt.",
      artifactId: "draft-a",
      revisionRef: {
        artifactType: "ProductionDraft",
        artifactId: "draft-a",
        revision: 2,
        createdAt: "2026-08-27T08:30:00.000Z"
      }
    }]
  };
}

function productionDraft(draftId = "draft-a", revision = 2, specId = "spec-a") {
  return {
    businessId: "local",
    draftId,
    revision,
    status: "approved",
    createdAt: "2026-08-27T08:30:00.000Z",
    source: { kind: "handoff", receivedAt: "2026-08-27T08:00:00.000Z" },
    reviewCards: [],
    draftArtifacts: {
      eventSpec: {
        schemaVersion: "1.0",
        specId,
        lifecycle: { commercialState: "accepted" },
        readiness: { status: "complete", reasons: [] },
        sourceLineage: [{ sourceType: "manual_input", reference: "request-a" }],
        event: { title: "Operativer Auftrag" },
        attendees: { expected: 45 },
        servicePlan: { eventType: "Dinner", serviceForm: "Buffet", modules: [] },
        menuPlan: []
      }
    }
  };
}

function plan(specId = "spec-a") {
  return {
    schemaVersion: "1.0",
    planId: "plan-a",
    eventSpecId: specId,
    readiness: { status: "complete", reasons: [] },
    productionBatches: [],
    timeline: [],
    kitchenSheets: [],
    recipeSelections: [],
    unresolvedItems: []
  };
}

function purchaseList(specId = "spec-a") {
  return {
    schemaVersion: "1.0",
    purchaseListId: "purchase-a",
    eventSpecId: specId,
    items: [],
    groupingMode: "group",
    totals: { itemCount: 0, groups: [] }
  };
}

function installCanonicalFetch(options: {
  draftId?: string;
  draftRevision?: number;
  draftSpecId?: string;
  approvalId?: string;
  approvalDraftId?: string;
  approvalRevision?: number;
  planSpecId?: string;
  purchaseSpecId?: string;
} = {}) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/api/production/v1/production/cases")) {
      return Response.json({ items: [{ caseId: "case-a", product: "production", displayName: "Produktion A", status: "open", createdAt: "", updatedAt: "" }] });
    }
    if (url.endsWith("/api/production/v1/production/cases/case-a")) {
      return Response.json(productionCaseDetail());
    }
    if (url.endsWith("/api/production/v1/production/drafts?caseId=case-a")) {
      return Response.json({
        items: [productionDraft(
          options.draftId ?? "draft-a",
          options.draftRevision ?? 2,
          options.draftSpecId ?? "spec-a"
        )],
        approvedProductionSpecs: [{
          approvedProductionSpecId: options.approvalId ?? "approved-a",
          sourceDraft: {
            draftId: options.approvalDraftId ?? "draft-a",
            revision: options.approvalRevision ?? 2
          },
          applied: false
        }]
      });
    }
    if (url.endsWith("/api/production/v1/production/plans/plan-a")) {
      return Response.json(plan(options.planSpecId));
    }
    if (url.endsWith("/api/production/v1/production/purchase-lists/purchase-a")) {
      return Response.json(purchaseList(options.purchaseSpecId));
    }
    if (url.endsWith("/api/production/health")) {
      return Response.json({ service: "production", status: "ok", timestamp: "", counts: {} });
    }
    if (url.includes("/api/intake/")) {
      return Response.json({
        specId: "spec-a",
        budgetContext: { pricingSummary: { subtotal: { amount: 8192.44, currency: "EUR" } } },
        forbiddenSentinel: "8.192,44 EUR"
      });
    }
    throw new Error(`Unerwarteter Produktionsloader-Abruf: ${url}`);
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gate B production UI snapshot confidentiality", () => {
  it("rehydrates the exact approved ProductionDraft projection without any Intake GET", async () => {
    const calls = installCanonicalFetch();

    const result = await loadProductionProductData("case-a");

    expect(result.workspace.currentDraft?.draftId).toBe("draft-a");
    expect(result.workspace.currentDraft?.revision).toBe(2);
    expect(result.workspace.approvedProductionSpec?.approvedProductionSpecId).toBe("approved-a");
    expect(result.acceptedSpecs.map((spec) => spec.specId)).toEqual(["spec-a"]);
    expect(result.intakeRequests).toEqual([]);
    expect(calls).toContain("/api/production/v1/production/drafts?caseId=case-a");
    expect(calls.some((url) => url.includes("/api/intake/"))).toBe(false);
    expect(JSON.stringify(result)).not.toContain("8.192,44 EUR");
  });

  it.each([
    ["wrong draft id", { draftId: "draft-b" }],
    ["wrong draft revision", { draftRevision: 1 }],
    ["wrong approval id", { approvalId: "approved-b" }],
    ["wrong approval draft", { approvalDraftId: "draft-b" }],
    ["wrong approval revision", { approvalRevision: 1 }],
    ["wrong draft spec", { draftSpecId: "spec-b" }],
    ["wrong plan spec", { planSpecId: "spec-b" }],
    ["wrong purchase-list spec", { purchaseSpecId: "spec-b" }]
  ])("fails closed on %s without an Intake fallback", async (_label, options) => {
    const calls = installCanonicalFetch(options);

    await expect(loadProductionProductData("case-a")).rejects.toThrow(/Produktionssnapshot|Produktionsartefakt/);
    expect(calls.some((url) => url.includes("/api/intake/"))).toBe(false);
  });

  it("does not reload a pre-case focused spec from Intake", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/production/v1/production/cases")) return Response.json({ items: [] });
      if (url.endsWith("/api/production/health")) {
        return Response.json({ service: "production", status: "ok", timestamp: "", counts: {} });
      }
      throw new Error(`Unerwarteter Pre-Case-Abruf: ${url}`);
    }));

    const result = await loadProductionProductData(undefined, "spec-new");

    expect(result.acceptedSpecs).toEqual([]);
    expect(calls.some((url) => url.includes("/api/intake/"))).toBe(false);
  });
});
