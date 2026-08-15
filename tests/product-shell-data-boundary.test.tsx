// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AcceptedEventSpec } from "@catering/shared-core";
import { App } from "../backoffice-ui/src/App.js";
import { OfferProductApp } from "../backoffice-ui/src/offer-product-app.js";
import { ProductionProductApp } from "../backoffice-ui/src/production-product-app.js";
import { ProductionDraftReviewPanel } from "../backoffice-ui/src/production-draft-review-panel.js";
import { ProductionQuestionPanel, type ProductionQuestionPanelProps } from "../backoffice-ui/src/production-question-panel.js";
import { useOfferWorkspaceData } from "../backoffice-ui/src/use-offer-workspace-data.js";
import { useProductionWorkspaceData } from "../backoffice-ui/src/use-production-workspace-data.js";
import * as api from "../backoffice-ui/src/api.js";
import type { ProductionDraft, ProductionProductData } from "../backoffice-ui/src/api.js";

const roots: Root[] = [];

function responseFor(url: string): Response {
  if (url.includes("/health")) {
    return Response.json({ service: "local", status: "ok", timestamp: "", counts: {} });
  }
  return Response.json({ items: [] });
}

function healthState(domain: "offer" | "production") {
  return {
    intake: { service: "intake", status: "unknown", timestamp: "", counts: {} },
    offers: { service: "offer", status: domain === "offer" ? "ok" : "unknown", timestamp: "", counts: {} },
    production: { service: "production", status: domain === "production" ? "ok" : "unknown", timestamp: "", counts: {} },
    exports: { service: "exports", status: "unknown", timestamp: "", counts: {} }
  };
}

function offerDraft(draftId: string, eventSummary: string) {
  return {
    schemaVersion: "1.0",
    businessId: "local",
    draftId,
    revision: 1,
    eventSummary,
    serviceModules: [],
    pricingSummary: {},
    assumptions: [],
    openQuestions: [],
    variantSet: [],
    customerFacingText: "",
    internalWorkingText: "",
    proposedEventSpec: { specId: `${draftId}-spec`, event: {} }
  } as never;
}

function offerProductData(draft?: unknown) {
  return {
    workspace: { cases: [], activeEvents: [], activeSources: [] },
    intakeRequests: [],
    acceptedSpecs: [],
    offerDrafts: draft ? [draft] : [],
    serviceHealth: healthState("offer")
  } as never;
}

function productionPlan(planId: string, eventSpecId: string) {
  return { planId, eventSpecId, readiness: { status: "complete", reasons: [] }, productionBatches: [], kitchenSheets: [], recipeSelections: [] };
}

function acceptedSpecSentinel(specId: string, title: string): AcceptedEventSpec {
  return {
    schemaVersion: "1.0",
    specId,
    lifecycle: { commercialState: "manual" },
    readiness: { status: "complete", reasons: [] },
    sourceLineage: [{ sourceType: "manual_input", reference: `${specId}-request` }],
    event: { title },
    attendees: { expected: 30 },
    servicePlan: { eventType: "Empfang", serviceForm: "Buffet", modules: [] },
    menuPlan: []
  };
}

function productionDraftSentinel(draftId: string, title: string): ProductionDraft {
  return {
    schemaVersion: "1.0",
    businessId: "local",
    draftId,
    revision: 1,
    status: "pending_review",
    createdAt: "2026-08-13T00:00:00.000Z",
    source: { kind: "fixture", receivedAt: "2026-08-13T00:00:00.000Z" },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [{
      cardId: `${draftId}-card`,
      kind: "event_data",
      title: "Fall prüfen",
      summary: title,
      decision: "pending",
      targetId: `${draftId}-spec`,
      requiredApproval: true
    }],
    draftArtifacts: {
      eventSpec: { specId: `${draftId}-spec`, event: { title } }
    }
  } as unknown as ProductionDraft;
}

function productionProductData(plan?: unknown, purchaseList?: unknown, activeCaseId?: string): ProductionProductData {
  return {
    workspace: {
      cases: activeCaseId
        ? [{ caseId: activeCaseId, product: "production", displayName: activeCaseId === "case-a" ? "Fall A" : "Fall B", status: "open", createdAt: "", updatedAt: "" }]
        : [],
      ...(activeCaseId
        ? {
            activeCase: {
              caseId: activeCaseId,
              product: "production",
              displayName: activeCaseId === "case-a" ? "Fall A" : "Fall B",
              status: "open",
              schemaVersion: "1.0",
              businessId: "local",
              version: 1,
              createdAt: "",
              updatedAt: "",
              sourceSpecId: activeCaseId === "case-a" ? "spec-a" : "spec-b",
              currentPlanId: plan ? String((plan as { planId?: string }).planId ?? "") : undefined,
              currentPurchaseListId: purchaseList
                ? String((purchaseList as { purchaseListId?: string }).purchaseListId ?? "")
                : undefined
            }
          }
        : {}),
      activeEvents: [],
      activeSources: [],
      referencedRecipes: []
    },
    intakeRequests: [],
    acceptedSpecs: [],
    productionPlans: plan ? [plan] : [],
    purchaseLists: purchaseList ? [purchaseList] : [],
    recipes: [],
    auditEvents: [],
    serviceHealth: healthState("production")
  } as unknown as ProductionProductData;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderAt(pathname: string) {
  window.history.replaceState({}, "", pathname);
  const storage = new Map<string, string>();
  const storageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear()
  };
  Object.defineProperty(window, "localStorage", { value: storageMock, configurable: true });
  Object.defineProperty(window, "sessionStorage", { value: storageMock, configurable: true });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
    await Promise.resolve();
  });

  return { container, fetchMock };
}

function WorkspaceProbe({
  domain,
  activeCaseId,
  focusedSpecId,
  onValue
}: {
  domain: "offer" | "production";
  activeCaseId?: string;
  focusedSpecId?: string;
  onValue: (value: { activeCaseId?: string; visibleCaseId?: string; refresh: () => Promise<void> }) => void;
}) {
  const product = domain === "offer"
    ? useOfferWorkspaceData(activeCaseId)
    : useProductionWorkspaceData(activeCaseId, focusedSpecId);
  onValue({
    activeCaseId,
    visibleCaseId: product.data.activeCase?.caseId,
    refresh: product.refresh
  });
  return createElement("output", null, product.data.activeCase?.displayName ?? "leer");
}

function productionQuestionPanelProps(activeCaseId?: string): ProductionQuestionPanelProps {
  const title = activeCaseId === "case-b" ? "Fall B" : "Fall A";
  const specId = activeCaseId === "case-b" ? "spec-b" : "spec-a";
  return {
    activeCaseId,
    questionState: {
      focusedProductionSpec: { specId, event: { title } },
      focusedSpecReadinessLabel: "vollständig",
      selectedPlan: undefined,
      selectedPlanReadinessLabel: undefined,
      currentSpecPurchaseLists: [],
      productionQuestions: [],
      productionAssumptions: [],
      productionConversationProjection: { sessionId: `session-${specId}`, messages: [] },
      workbenchSpecFacts: [],
      intakeRequestDetail: null,
      filteredSpecs: [],
      documentPhase: "done" as const,
      productionWorkspaceCleared: false
    },
    questionActions: {
      openSpecForQuestions: () => undefined,
      refreshAfterDraftDecision: async () => undefined
    },
    submitting: false,
    editorState: {
      editingSpecId: undefined,
      editingEventType: "",
      editingEventDate: "",
      editingAttendeeCount: "",
      editingServiceForm: "",
      editingMenuItems: "",
      editingComponentStates: {},
      hasFocusedSpecEditChanges: false,
      recipes: []
    },
    editorActions: {
      setEditingEventType: () => undefined,
      setEditingEventDate: () => undefined,
      setEditingEventSchedule: () => undefined,
      setEditingAttendeeCount: () => undefined,
      setEditingServiceForm: () => undefined,
      setEditingMenuItems: () => undefined,
      updateEditingComponentState: () => undefined,
      beginSpecEdit: () => undefined,
      saveSpecEdit: async () => undefined,
      createPlan: async () => undefined,
      resetSpecEdit: () => undefined
    }
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("independent product loader boundaries", () => {
  const shellProps = {
    shell: { title: "Test", subtitle: "Test" },
    masthead: {
      route: "offer" as const,
      baseUrl: "http://localhost",
      operatorName: "Mitarbeiter",
      loading: false,
      submitting: false,
      onOperatorNameChange: () => undefined,
      onSeedDemoData: async () => undefined,
      onRefreshDashboard: async () => undefined
    }
  };

  it("keeps the portal free of operational requests and health checks", async () => {
    const { fetchMock } = await renderAt("/");

    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContainEqual(
      expect.stringMatching(/\/api\/(intake|offers|production)\//)
    );
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContainEqual(
      expect.stringMatching(/\/api\/(intake|offers|production)\/health/)
    );
  });

  it("does not project an unbound offer artifact into the real app route", async () => {
    const loadProduct = vi.spyOn(api, "loadOfferProductData").mockResolvedValue(
      offerProductData(offerDraft("draft-b", "Fall B"))
    );

    const { container } = await renderAt("/angebot");

    expect(loadProduct).toHaveBeenCalledWith(undefined);
    expect(container.textContent).not.toContain("Fall B");
  });

  it("does not project unbound production artifacts into the real app route", async () => {
    const loadProduct = vi.spyOn(api, "loadProductionProductData").mockResolvedValue(
      productionProductData(
        productionPlan("plan-b", "spec-b"),
        { purchaseListId: "purchase-b", eventSpecId: "spec-b", items: [] }
      )
    );
    const loadDrafts = vi.spyOn(api, "loadProductionDrafts").mockResolvedValue({
      items: [
        productionDraftSentinel("draft-a", "Fall A"),
        productionDraftSentinel("draft-b", "Fall B")
      ],
      approvedProductionSpecs: []
    });

    const { container } = await renderAt("/produktion");

    expect(loadProduct).toHaveBeenCalledWith(undefined);
    expect(loadDrafts).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Fall A");
    expect(container.textContent).not.toContain("Fall B");
    expect(container.innerHTML).not.toContain("plan-b");
    expect(container.innerHTML).not.toContain("purchase-b");
  });

  it("does not load or display Fall-A/Fall-B production drafts without an active case", async () => {
    const loadDrafts = vi.spyOn(api, "loadProductionDrafts").mockResolvedValue({
      items: [
        productionDraftSentinel("draft-a", "Fall A"),
        productionDraftSentinel("draft-b", "Fall B")
      ],
      approvedProductionSpecs: []
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, {
        submitting: false,
        embedded: true,
        latestOnly: true,
        resumeMode: true
      }));
      await flush();
    });

    expect(loadDrafts).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Fall A");
    expect(container.textContent).not.toContain("Fall B");
  });

  it("loads and displays only the drafts bound to the active production case", async () => {
    const loadDrafts = vi.spyOn(api, "loadProductionDrafts").mockImplementation(async (caseId) => ({
      items: caseId === "case-a"
        ? [productionDraftSentinel("draft-a", "Fall A")]
        : caseId === "case-b"
          ? [productionDraftSentinel("draft-b", "Fall B")]
          : [],
      approvedProductionSpecs: []
    }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, {
        submitting: false,
        embedded: true,
        latestOnly: true,
        resumeMode: true,
        caseId: "case-a"
      } as never));
      await flush();
    });

    expect(loadDrafts).toHaveBeenCalledWith("case-a");
    expect(container.textContent).toContain("Fall A");
    expect(container.textContent).not.toContain("Fall B");

    await act(async () => {
      root.render(createElement(ProductionDraftReviewPanel, {
        submitting: false,
        embedded: true,
        latestOnly: true,
        resumeMode: true,
        caseId: "case-b"
      } as never));
      await flush();
    });

    expect(loadDrafts).toHaveBeenLastCalledWith("case-b");
    expect(container.textContent).toContain("Fall B");
    expect(container.textContent).not.toContain("Fall A");
  });

  it("carries the active case through the real production question review path", async () => {
    const loadDrafts = vi.spyOn(api, "loadProductionDrafts").mockImplementation(async (caseId) => ({
      items: caseId === "case-a"
        ? [productionDraftSentinel("draft-a", "Fall A")]
        : caseId === "case-b"
          ? [productionDraftSentinel("draft-b", "Fall B")]
          : [],
      approvedProductionSpecs: []
    }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(createElement(ProductionQuestionPanel, productionQuestionPanelProps("case-a")));
      await flush();
    });
    expect(loadDrafts).toHaveBeenCalledWith("case-a");
    expect(container.textContent).toContain("Fall A");
    expect(container.textContent).not.toContain("Fall B");

    await act(async () => {
      root.render(createElement(ProductionQuestionPanel, productionQuestionPanelProps("case-b")));
      await flush();
    });
    expect(loadDrafts).toHaveBeenLastCalledWith("case-b");
    expect(container.textContent).toContain("Fall B");
    expect(container.textContent).not.toContain("Fall A");

    await act(async () => {
      root.render(createElement(ProductionQuestionPanel, productionQuestionPanelProps(undefined)));
      await flush();
    });
    expect(container.textContent).not.toContain("Fall A");
    expect(container.textContent).not.toContain("Fall B");
  });

  it("reloads the actual offer shell with the newly created case reference", async () => {
    const activeCaseIds: Array<string | undefined> = [];
    const loadProduct = vi.spyOn(api, "loadOfferProductData").mockImplementation(async (activeCaseId) => {
      activeCaseIds.push(activeCaseId);
      return offerProductData(activeCaseId ? offerDraft("draft-a", "Fall A") : undefined);
    });
    const { container, fetchMock } = await renderAt("/angebot");
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/offers/v1/offers/cases") && (init?.method ?? "GET").toUpperCase() === "POST") {
        return Response.json({ case: { caseId: "case-a" } }, { status: 201 });
      }
      if (url.endsWith("/api/offers/v1/offers/from-text")) {
        return Response.json({ draftId: "draft-a" }, { status: 201 });
      }
      throw new Error(`Unerwartete Mutation: ${url}`);
    });

    const input = container.querySelector("textarea[aria-label='Kundenanfrage als Text']") as HTMLTextAreaElement;
    await act(async () => {
      setNativeValue(input, "Fall A");
    });
    const submit = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Entwurf aus Text erstellen"));
    await act(async () => {
      submit?.click();
      await flush();
    });
    await act(async () => {
      await flush();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await flush();
    });

    expect(activeCaseIds).toContain("case-a");
    expect(activeCaseIds.at(-1)).toBe("case-a");
    expect(container.textContent).toContain("Fall A");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  it("reloads the production shell with a selected case instead of retaining global artifacts", async () => {
    const activeCaseIds: Array<string | undefined> = [];
    const loadProduct = vi.spyOn(api, "loadProductionProductData").mockImplementation(async (activeCaseId) => {
      activeCaseIds.push(activeCaseId);
      if (!activeCaseId) {
        return {
          ...productionProductData(),
          workspace: {
            ...productionProductData().workspace,
            cases: [
              { caseId: "case-a", product: "production", displayName: "Fall A", status: "open", createdAt: "", updatedAt: "" },
              { caseId: "case-b", product: "production", displayName: "Fall B", status: "open", createdAt: "", updatedAt: "" }
            ]
          }
        } as unknown as ProductionProductData;
      }
      const productData = productionProductData(
        activeCaseId === "case-a" ? productionPlan("plan-a", "spec-a") : productionPlan("plan-b", "spec-b"),
        activeCaseId === "case-a" ? { purchaseListId: "purchase-a", eventSpecId: "spec-a", items: [] } : { purchaseListId: "purchase-b", eventSpecId: "spec-b", items: [] },
        activeCaseId
      );
      return {
        ...productData,
        acceptedSpecs: [acceptedSpecSentinel(
          activeCaseId === "case-a" ? "spec-a" : "spec-b",
          activeCaseId === "case-a" ? "Fall A" : "Fall B"
        )]
      };
    });
    const loadDrafts = vi.spyOn(api, "loadProductionDrafts").mockResolvedValue({
      items: [productionDraftSentinel("draft-a", "Fall A")],
      approvedProductionSpecs: []
    });
    const { container } = await renderAt("/produktion");

    const caseA = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Fall A"));
    expect(caseA).not.toBeUndefined();
    await act(async () => {
      caseA?.click();
      await flush();
    });

    const productionShell = container.querySelector(".app-shell--production-route");
    expect(productionShell).not.toBeNull();
    expect(activeCaseIds).toContain("case-a");
    expect(activeCaseIds.at(-1)).toBe("case-a");
    expect(loadDrafts).toHaveBeenCalledWith("case-a");
    expect(loadDrafts.mock.calls.filter(([caseId]) => caseId === "case-a")).toHaveLength(2);
    expect(container.textContent).toContain("Fall A");
    expect(container.innerHTML).not.toContain("plan-b");
    expect(container.innerHTML).not.toContain("purchase-b");
    expect(loadProduct).not.toHaveBeenCalledWith("case-b");
  });

  it("keeps the active production context when history search matches only a source filename", async () => {
    const caseA = {
      caseId: "case-a",
      product: "production" as const,
      displayName: "Fall A",
      status: "open",
      createdAt: "",
      updatedAt: ""
    };
    const loadProduct = vi.spyOn(api, "loadProductionProductData").mockImplementation(async (activeCaseId) => {
      if (!activeCaseId) {
        return {
          ...productionProductData(),
          workspace: {
            ...productionProductData().workspace,
            cases: [caseA]
          }
        } as unknown as ProductionProductData;
      }

      const acceptedSpec = acceptedSpecSentinel("spec-a", "Küchenkontext");
      acceptedSpec.menuPlan = [{ componentId: "context", label: "Küchenkontext" }] as never;
      return {
        ...productionProductData(
          productionPlan("plan-a", "spec-a"),
          { purchaseListId: "purchase-a", eventSpecId: "spec-a", items: [] },
          activeCaseId
        ),
        acceptedSpecs: [acceptedSpec]
      };
    });
    const { container, fetchMock } = await renderAt("/produktion?productionCaseId=case-a");
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/production/v1/production/cases?search=")) {
        return Response.json({ items: [caseA] });
      }
      return responseFor(url);
    });

    expect(loadProduct).toHaveBeenLastCalledWith("case-a");
    expect(container.textContent).toContain("Küchenkontext");

    const historySearch = container.querySelector("#production-case-history-search") as HTMLInputElement;
    await act(async () => {
      setNativeValue(historySearch, "menu.pdf");
      await flush();
    });

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/production/v1/production/cases?search=menu.pdf"))).toBe(true);
    expect(container.textContent).toContain("Küchenkontext");
  });

  it("passes a positive offer sentinel through the offer shell loader and health boundary", async () => {
    const loadProduct = vi.spyOn(api, "loadOfferProductData").mockResolvedValue({
      workspace: {
        cases: [{ caseId: "offer-a", product: "offer", displayName: "Angebot A", status: "open", createdAt: "", updatedAt: "" }],
        activeEvents: [],
        activeSources: []
      },
      intakeRequests: [],
      acceptedSpecs: [],
      offerDrafts: [],
      serviceHealth: {
        intake: { service: "intake", status: "unknown", timestamp: "", counts: {} },
        offers: { service: "offer", status: "ok", timestamp: "", counts: {} },
        production: { service: "production", status: "unknown", timestamp: "", counts: {} },
        exports: { service: "exports", status: "unknown", timestamp: "", counts: {} }
      }
    });
    const children = vi.fn((product: { data: { cases: Array<{ displayName: string }> }; serviceHealth: { offers: { status: string } } }) =>
      createElement("output", null, `${product.data.cases[0]?.displayName ?? "leer"} · ${product.serviceHealth.offers.status}`)
    );

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(OfferProductApp, { ...shellProps, children: children as never }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadProduct).toHaveBeenCalled();
    expect(children).toHaveBeenCalled();
    expect(container.textContent).toContain("Angebot A");
    expect(container.textContent).not.toContain("Produktionsplan B");
    await act(async () => root.unmount());
    container.remove();
  });

  it("passes a positive production sentinel through the production shell loader and health boundary", async () => {
    const loadProduct = vi.spyOn(api, "loadProductionProductData").mockResolvedValue({
      workspace: {
        cases: [{ caseId: "production-a", product: "production", displayName: "Produktion A", status: "open", createdAt: "", updatedAt: "" }],
        activeEvents: [],
        activeSources: [],
        referencedRecipes: []
      },
      intakeRequests: [],
      acceptedSpecs: [],
      productionPlans: [],
      purchaseLists: [],
      recipes: [],
      auditEvents: [],
      serviceHealth: {
        intake: { service: "intake", status: "unknown", timestamp: "", counts: {} },
        offers: { service: "offer", status: "unknown", timestamp: "", counts: {} },
        production: { service: "production", status: "ok", timestamp: "", counts: {} },
        exports: { service: "exports", status: "unknown", timestamp: "", counts: {} }
      }
    });
    const children = vi.fn((product: { data: { cases: Array<{ displayName: string }> }; serviceHealth: { production: { status: string } } }) =>
      createElement("output", null, `${product.data.cases[0]?.displayName ?? "leer"} · ${product.serviceHealth.production.status}`)
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ProductionProductApp, {
        ...shellProps,
        shell: { title: "Test", subtitle: "Test" },
        masthead: { ...shellProps.masthead, route: "production" },
        children: children as never
      }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadProduct).toHaveBeenCalled();
    expect(children).toHaveBeenCalled();
    expect(container.textContent).toContain("Produktion A");
    expect(container.textContent).not.toContain("Angebotsentwurf B");
    await act(async () => root.unmount());
    container.remove();
  });

  it("never selects an offer artifact without an event reference to the active case", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/offers/v1/offers/cases")) {
        return Response.json({ items: [{ caseId: "case-a", product: "offer", displayName: "A", status: "open", createdAt: "", updatedAt: "" }] });
      }
      if (url.endsWith("/api/offers/v1/offers/cases/case-a")) {
        return Response.json({ case: { caseId: "case-a", product: "offer", displayName: "A", status: "open", schemaVersion: "1.0", businessId: "local", version: 1, createdAt: "", updatedAt: "" }, events: [] });
      }
      throw new Error(`Unerwartete Artefaktladung: ${url}`);
    }));

    const state = await api.loadOfferWorkspaceState("case-a");
    expect(state.currentDraft).toBeUndefined();
    expect(calls.some((url) => url.endsWith("/api/offers/v1/offers/drafts"))).toBe(false);
  });

  it("keeps an active offer case tied to its referenced draft instead of another case", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/offers/v1/offers/cases")) {
        return Response.json({ items: [
          { caseId: "case-a", product: "offer", displayName: "A", status: "open", createdAt: "", updatedAt: "" },
          { caseId: "case-b", product: "offer", displayName: "B", status: "open", createdAt: "", updatedAt: "" }
        ] });
      }
      if (url.endsWith("/api/offers/v1/offers/cases/case-a")) {
        return Response.json({
          case: { caseId: "case-a", product: "offer", displayName: "A", status: "open", schemaVersion: "1.0", businessId: "local", version: 1, createdAt: "", updatedAt: "" },
          events: [{
            businessId: "local",
            eventId: "event-a",
            caseId: "case-a",
            sequence: 2,
            at: "",
            role: "system",
            kind: "draft_created",
            text: "Entwurf A",
            revisionRef: { artifactType: "OfferDraft", artifactId: "draft-a", revision: 1, createdAt: "" }
          }]
        });
      }
      if (url.endsWith("/api/offers/v1/offers/drafts/draft-a")) {
        return Response.json({ draftId: "draft-a", eventSummary: "Fall A" });
      }
      throw new Error(`Unerwartete Fremdladung: ${url}`);
    }));

    const state = await api.loadOfferWorkspaceState("case-a");

    expect(state.currentDraft?.draftId).toBe("draft-a");
    expect(calls.some((url) => url.endsWith("/api/offers/v1/offers/drafts"))).toBe(false);
    expect(calls.some((url) => url.endsWith("draft-b"))).toBe(false);
  });

  it("rehydrates the persisted offer approval and handoff for the active case", async () => {
    const approvedOffer = { approvedOfferId: "approved-offer-a" };
    const handoff = { handoffId: "handoff-a", approvedOfferId: "approved-offer-a" };
    const currentDraft = { draftId: "draft-a", revision: 2 };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/offers/v1/offers/cases")) {
        return Response.json({ items: [{ caseId: "case-a", product: "offer", displayName: "A", status: "open", createdAt: "", updatedAt: "" }] });
      }
      if (url.endsWith("/api/offers/v1/offers/cases/case-a")) {
        return Response.json({
          case: {
            caseId: "case-a", product: "offer", displayName: "A", status: "open",
            schemaVersion: "1.0", businessId: "local", version: 2, createdAt: "", updatedAt: "",
            approvedOfferId: "approved-offer-a", productionHandoffId: "handoff-a"
          },
          events: [],
          currentDraft,
          approvedOffer,
          handoff
        });
      }
      throw new Error(`Unerwartete persistierte Angebotsladung: ${url}`);
    }));

    const state = await api.loadOfferWorkspaceState("case-a");

    expect(state.currentDraft?.draftId).toBe("draft-a");
    expect(state.approvedOffer?.approvedOfferId).toBe("approved-offer-a");
    expect(state.handoff?.handoffId).toBe("handoff-a");
  });

  it("loads the production plan and purchase list only through the active case references", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [{ caseId: "case-a", product: "production", displayName: "A", status: "open", createdAt: "", updatedAt: "" }] });
      }
      if (url.endsWith("/api/production/v1/production/cases/case-a")) {
        return Response.json({ case: { caseId: "case-a", product: "production", displayName: "A", status: "open", schemaVersion: "1.0", businessId: "local", version: 1, createdAt: "", updatedAt: "", currentPlanId: "plan-a", currentPurchaseListId: "list-a" }, events: [] });
      }
      if (url.endsWith("/api/production/v1/production/plans/plan-a")) return Response.json({ planId: "plan-a", eventSpecId: "spec-a" });
      if (url.endsWith("/api/production/v1/production/purchase-lists/list-a")) return Response.json({ purchaseListId: "list-a", eventSpecId: "spec-a" });
      throw new Error(`Unerwartete globale Produktionsladung: ${url}`);
    }));

    const state = await api.loadProductionWorkspaceState("case-a");
    expect(state.currentPlan?.planId).toBe("plan-a");
    expect(state.currentPurchaseList?.purchaseListId).toBe("list-a");
    expect(calls.some((url) => url.endsWith("/api/production/v1/production/plans"))).toBe(false);
    expect(calls.some((url) => url.endsWith("/api/production/v1/production/purchase-lists"))).toBe(false);
  });

  it("rejects a plan response whose id differs from the active case reference", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [] });
      }
      if (url.endsWith("/api/production/v1/production/cases/case-a")) {
        return Response.json({
          case: {
            caseId: "case-a", product: "production", displayName: "A", status: "open",
            schemaVersion: "1.0", businessId: "local", version: 1, createdAt: "", updatedAt: "",
            currentPlanId: "plan-a"
          },
          events: []
        });
      }
      if (url.endsWith("/api/production/v1/production/plans/plan-a")) {
        return Response.json({ planId: "plan-b", eventSpecId: "spec-b" });
      }
      throw new Error(`Unerwartete Planladung: ${url}`);
    }));

    const state = await api.loadProductionWorkspaceState("case-a");

    expect(state.currentPlan).toBeUndefined();
  });

  it("rejects a purchase-list response whose id differs from the active case reference", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [] });
      }
      if (url.endsWith("/api/production/v1/production/cases/case-a")) {
        return Response.json({
          case: {
            caseId: "case-a", product: "production", displayName: "A", status: "open",
            schemaVersion: "1.0", businessId: "local", version: 1, createdAt: "", updatedAt: "",
            currentPurchaseListId: "list-a"
          },
          events: []
        });
      }
      if (url.endsWith("/api/production/v1/production/purchase-lists/list-a")) {
        return Response.json({ purchaseListId: "list-b", eventSpecId: "spec-b" });
      }
      throw new Error(`Unerwartete Einkaufslistenladung: ${url}`);
    }));

    const state = await api.loadProductionWorkspaceState("case-a");

    expect(state.currentPurchaseList).toBeUndefined();
  });

  it("rehydrates the persisted production draft and approved specification for the active case", async () => {
    const currentDraft = { draftId: "production-draft-a", revision: 1, status: "pending_review", reviewCards: [], createdAt: "" };
    const approvedProductionSpec = { approvedProductionSpecId: "approved-production-spec-a", sourceDraft: { draftId: "production-draft-a", revision: 1 } };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [{ caseId: "case-a", product: "production", displayName: "A", status: "open", createdAt: "", updatedAt: "" }] });
      }
      if (url.endsWith("/api/production/v1/production/cases/case-a")) {
        return Response.json({
          case: {
            caseId: "case-a", product: "production", displayName: "A", status: "open",
            schemaVersion: "1.0", businessId: "local", version: 2, createdAt: "", updatedAt: "",
            sourceSpecId: "spec-a", approvedProductionSpecId: "approved-production-spec-a"
          },
          events: [],
          currentDraft,
          approvedProductionSpec
        });
      }
      throw new Error(`Unerwartete persistierte Produktionsladung: ${url}`);
    }));

    const state = await api.loadProductionWorkspaceState("case-a");

    expect(state.currentDraft?.draftId).toBe("production-draft-a");
    expect(state.approvedProductionSpec?.approvedProductionSpecId).toBe("approved-production-spec-a");
  });

  it("loads no production endpoint on /angebot", async () => {
    const { container, fetchMock } = await renderAt("/angebot");

    expect(container.textContent).toContain("Angebotsassistent");
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContainEqual(
      expect.stringContaining("/api/production/")
    );
  });

  it("loads no offer endpoint on /produktion", async () => {
    const { container, fetchMock } = await renderAt("/produktion");

    expect(container.textContent).toContain("Produktionsassistent");
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContainEqual(
      expect.stringContaining("/api/offers/")
    );
  });

  it("does not render the previous case while a selected case reloads", async () => {
    let resolveB: ((value: ReturnType<typeof productionProductData>) => void) | undefined;
    const loadProduct = vi.spyOn(api, "loadProductionProductData").mockImplementation(async (activeCaseId) => {
      if (activeCaseId === "case-b") {
        return await new Promise((resolve) => {
          resolveB = resolve as (value: ReturnType<typeof productionProductData>) => void;
        });
      }
      return productionProductData(undefined, undefined, activeCaseId);
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkspaceProbe, {
        domain: "production",
        activeCaseId: "case-a",
        onValue: () => undefined
      }));
      await flush();
    });
    expect(container.textContent).toContain("Fall A");

    await act(async () => {
      root.render(createElement(WorkspaceProbe, {
        domain: "production",
        activeCaseId: "case-b",
        onValue: () => undefined
      }));
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Fall A");
    expect(container.textContent).toContain("leer");
    resolveB?.(productionProductData(undefined, undefined, "case-b"));
    await act(async () => {
      await flush();
    });
    expect(container.textContent).toContain("Fall B");
    await act(async () => root.unmount());
    container.remove();
    expect(loadProduct).toHaveBeenCalledWith("case-b");
  });

  it("ignores a refresh retained from case A after switching to case B", async () => {
    let resolveA: ((value: ReturnType<typeof productionProductData>) => void) | undefined;
    let resolveB: ((value: ReturnType<typeof productionProductData>) => void) | undefined;
    let initialACall = true;
    const refreshes: Array<() => Promise<void>> = [];
    vi.spyOn(api, "loadProductionProductData").mockImplementation(async (activeCaseId) => {
      if (activeCaseId === "case-a") {
        if (!initialACall) {
          return productionProductData(undefined, undefined, "case-a");
        }
        initialACall = false;
        return await new Promise((resolve) => {
          resolveA = resolve as (value: ReturnType<typeof productionProductData>) => void;
        });
      }
      return await new Promise((resolve) => {
        resolveB = resolve as (value: ReturnType<typeof productionProductData>) => void;
      });
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkspaceProbe, {
        domain: "production",
        activeCaseId: "case-a",
        onValue: ({ refresh }) => {
          if (!refreshes.includes(refresh)) refreshes.push(refresh);
        }
      }));
      await Promise.resolve();
    });
    resolveA?.(productionProductData(undefined, undefined, "case-a"));
    await act(async () => {
      await flush();
    });
    const refreshA = refreshes.at(-1);
    expect(refreshA).toBeDefined();

    await act(async () => {
      root.render(createElement(WorkspaceProbe, {
        domain: "production",
        activeCaseId: "case-b",
        onValue: ({ refresh }) => {
          if (!refreshes.includes(refresh)) refreshes.push(refresh);
        }
      }));
      await Promise.resolve();
    });
    await act(async () => {
      await refreshA?.();
    });
    resolveB?.(productionProductData(undefined, undefined, "case-b"));
    await act(async () => {
      await flush();
    });
    expect(container.textContent).not.toContain("Fall A");
    expect(container.textContent).toContain("Fall B");
    await act(async () => root.unmount());
    container.remove();
  });

  it("ignores a refresh retained from focused spec A after switching to focused spec B", async () => {
    let resolveA: ((value: ReturnType<typeof productionProductData>) => void) | undefined;
    let resolveB: ((value: ReturnType<typeof productionProductData>) => void) | undefined;
    vi.spyOn(api, "loadProductionProductData").mockImplementation(async (_activeCaseId, focusedSpecId) => {
      if (focusedSpecId === "spec-a") {
        return await new Promise((resolve) => {
          resolveA = resolve as (value: ReturnType<typeof productionProductData>) => void;
        });
      }
      return await new Promise((resolve) => {
        resolveB = resolve as (value: ReturnType<typeof productionProductData>) => void;
      });
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkspaceProbe, {
        domain: "production",
        focusedSpecId: "spec-a",
        onValue: () => undefined
      }));
      await Promise.resolve();
    });
    expect(resolveA).toBeDefined();

    await act(async () => {
      root.render(createElement(WorkspaceProbe, {
        domain: "production",
        focusedSpecId: "spec-b",
        onValue: () => undefined
      }));
      await Promise.resolve();
    });
    expect(resolveB).toBeDefined();
    resolveA?.(productionProductData(undefined, undefined, "case-a"));
    await act(async () => { await flush(); });
    expect(container.textContent).not.toContain("Fall A");
    resolveB?.(productionProductData(undefined, undefined, "case-b"));
    await act(async () => { await flush(); });
    expect(container.textContent).not.toContain("Fall A");
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps a newly created production spec addressable through an explicit detail refresh", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [] });
      }
      if (url.endsWith("/api/intake/v1/intake/specs/spec-new")) {
        return Response.json({ specId: "spec-new", lifecycle: { commercialState: "draft" }, readiness: { status: "complete", reasons: [] }, sourceLineage: [], event: {}, attendees: {}, servicePlan: { eventType: "lunch", serviceForm: "buffet", modules: [] }, menuPlan: [] });
      }
      if (url.endsWith("/api/production/health")) {
        return Response.json({ service: "production", status: "ok", timestamp: "", counts: {} });
      }
      throw new Error(`Unerwartete Spec-Ladung: ${url}`);
    }));

    const result = await api.loadProductionProductData(undefined, "spec-new");

    expect(result.acceptedSpecs).toHaveLength(1);
    expect(result.acceptedSpecs[0]?.specId).toBe("spec-new");
    expect(calls).toContain("/api/intake/v1/intake/specs/spec-new");
    expect(calls).not.toContain("/api/intake/v1/intake/specs");
  });
});
