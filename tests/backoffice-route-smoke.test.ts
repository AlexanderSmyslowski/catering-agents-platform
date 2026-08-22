// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";

type RouteSmokeRecord = Record<string, unknown>;
type RouteSmokeDashboardFixture = {
  intakeRequests?: Array<RouteSmokeRecord & { requestId?: string }>;
  acceptedSpecs?: Array<RouteSmokeRecord & { specId?: string }>;
  offerDrafts?: Array<RouteSmokeRecord & {
    draftId?: string;
    revision?: number;
    proposedEventSpec?: RouteSmokeRecord;
  }>;
  productionPlans?: Array<RouteSmokeRecord & { planId?: string }>;
  purchaseLists?: Array<RouteSmokeRecord & { purchaseListId?: string }>;
  recipes?: Array<RouteSmokeRecord & { recipeId?: string }>;
  auditEvents?: Array<RouteSmokeRecord>;
  intakeRequestDetails?: Record<string, RouteSmokeRecord>;
};

function installBackofficeEnvironmentMocks(fixture: RouteSmokeDashboardFixture = {}) {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    }
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true
  });
  vi.stubGlobal("localStorage", localStorageMock);

  const firstOfferDraft = fixture.offerDrafts?.[0];
  const firstProductionPlan = fixture.productionPlans?.[0];
  const firstPurchaseList = fixture.purchaseLists?.[0];
  const firstSpec = fixture.acceptedSpecs?.[0];
  const firstRequest = fixture.intakeRequests?.[0];
  const offerCaseId = firstOfferDraft?.draftId ? `offer-case-${String(firstOfferDraft.draftId)}` : undefined;
  const productionCaseId = firstSpec?.specId || firstProductionPlan?.planId || firstPurchaseList?.purchaseListId
    ? `production-case-${String(firstSpec?.specId ?? firstProductionPlan?.planId ?? firstPurchaseList?.purchaseListId)}`
    : undefined;
  const sourceRef = firstRequest?.requestId
    ? {
        sourceId: `source-${String(firstRequest.requestId)}`,
        requestId: String(firstRequest.requestId),
        dataClass: "synthetic_demo",
        addedAt: "2026-04-10T09:30:00.000Z"
      }
    : undefined;
  const offerDraft = firstOfferDraft
    ? {
        ...firstOfferDraft,
        proposedEventSpec: firstOfferDraft.proposedEventSpec ?? firstSpec
      }
    : undefined;
  const offerEvents = offerCaseId && offerDraft
    ? [{
        businessId: "local",
        eventId: `${offerCaseId}-draft-created`,
        caseId: offerCaseId,
        sequence: 1,
        at: "2026-04-10T09:30:00.000Z",
        role: "system",
        kind: "draft_created",
        text: "Angebotsentwurf erstellt.",
        ...(sourceRef ? { sourceRef } : {}),
        revisionRef: {
          artifactType: "OfferDraft",
          artifactId: String(offerDraft.draftId),
          revision: Number(offerDraft.revision ?? 1),
          createdAt: "2026-04-10T09:30:00.000Z"
        }
      }]
    : [];
  const productionEvents = productionCaseId
    ? [{
        businessId: "local",
        eventId: `${productionCaseId}-created`,
        caseId: productionCaseId,
        sequence: 1,
        at: "2026-04-10T09:30:00.000Z",
        role: "system",
        kind: "case_created",
        text: "Produktionsauftrag angelegt.",
        ...(sourceRef ? { sourceRef } : {})
      }]
    : [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/offers/v1/offers/cases")) {
        return new Response(
          JSON.stringify({
            items: offerCaseId
              ? [{ caseId: offerCaseId, product: "offer", displayName: "Angebotsfall", status: "open", createdAt: "2026-04-10T09:30:00.000Z", updatedAt: "2026-04-10T09:30:00.000Z" }]
              : []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (offerCaseId && url.endsWith(`/api/offers/v1/offers/cases/${encodeURIComponent(offerCaseId)}`)) {
        return new Response(
          JSON.stringify({
            case: {
              caseId: offerCaseId,
              product: "offer",
              displayName: "Angebotsfall",
              status: "open",
              schemaVersion: "1.0",
              businessId: "local",
              version: 1,
              createdAt: "2026-04-10T09:30:00.000Z",
              updatedAt: "2026-04-10T09:30:00.000Z"
            },
            events: offerEvents,
            ...(offerDraft ? { currentDraft: offerDraft } : {})
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/production/v1/production/cases")) {
        return new Response(
          JSON.stringify({
            items: productionCaseId
              ? [{ caseId: productionCaseId, product: "production", displayName: "Produktionsfall", status: "open", createdAt: "2026-04-10T09:30:00.000Z", updatedAt: "2026-04-10T09:30:00.000Z" }]
              : []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.startsWith("/api/production/v1/production/drafts")) {
        return new Response(JSON.stringify({ items: [], approvedProductionSpecs: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (productionCaseId && url.endsWith(`/api/production/v1/production/cases/${encodeURIComponent(productionCaseId)}`)) {
        return new Response(
          JSON.stringify({
            case: {
              caseId: productionCaseId,
              product: "production",
              displayName: "Produktionsfall",
              status: "open",
              schemaVersion: "1.0",
              businessId: "local",
              version: 1,
              createdAt: "2026-04-10T09:30:00.000Z",
              updatedAt: "2026-04-10T09:30:00.000Z",
              ...(firstSpec?.specId ? { sourceSpecId: String(firstSpec.specId) } : {}),
              ...(firstProductionPlan?.planId ? { currentPlanId: String(firstProductionPlan.planId) } : {}),
              ...(firstPurchaseList?.purchaseListId ? { currentPurchaseListId: String(firstPurchaseList.purchaseListId) } : {})
            },
            events: productionEvents
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      const offerDraftDetailMatch = url.match(/\/api\/offers\/v1\/offers\/drafts\/([^/?#]+)$/);
      if (offerDraftDetailMatch && offerDraft && String(offerDraft.draftId) === decodeURIComponent(offerDraftDetailMatch[1])) {
        return new Response(JSON.stringify(offerDraft), { status: 200, headers: { "content-type": "application/json" } });
      }

      const productionPlanDetailMatch = url.match(/\/api\/production\/v1\/production\/plans\/([^/?#]+)$/);
      if (productionPlanDetailMatch) {
        const plan = fixture.productionPlans?.find((item) => String(item.planId) === decodeURIComponent(productionPlanDetailMatch[1]));
        if (plan) return new Response(JSON.stringify(plan), { status: 200, headers: { "content-type": "application/json" } });
      }

      const purchaseListDetailMatch = url.match(/\/api\/production\/v1\/production\/purchase-lists\/([^/?#]+)$/);
      if (purchaseListDetailMatch) {
        const purchaseList = fixture.purchaseLists?.find((item) => String(item.purchaseListId) === decodeURIComponent(purchaseListDetailMatch[1]));
        if (purchaseList) return new Response(JSON.stringify(purchaseList), { status: 200, headers: { "content-type": "application/json" } });
      }

      const recipeDetailMatch = url.match(/\/api\/production\/v1\/production\/recipes\/([^/?#]+)$/);
      if (recipeDetailMatch) {
        const recipe = fixture.recipes?.find((item) => String(item.recipeId) === decodeURIComponent(recipeDetailMatch[1]));
        if (recipe) return new Response(JSON.stringify(recipe), { status: 200, headers: { "content-type": "application/json" } });
      }

      const specDetailMatch = url.match(/\/api\/intake\/v1\/intake\/specs\/([^/?#]+)$/);
      if (specDetailMatch) {
        const spec = fixture.acceptedSpecs?.find((item) => String(item.specId) === decodeURIComponent(specDetailMatch[1]));
        if (spec) return new Response(JSON.stringify(spec), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.endsWith("/api/intake/v1/intake/requests")) {
        return new Response(JSON.stringify({ items: fixture.intakeRequests ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/intake/v1/intake/specs")) {
        return new Response(JSON.stringify({ items: fixture.acceptedSpecs ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/offers/v1/offers/drafts")) {
        return new Response(JSON.stringify({ items: fixture.offerDrafts ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/plans")) {
        return new Response(JSON.stringify({ items: fixture.productionPlans ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return new Response(JSON.stringify({ items: fixture.purchaseLists ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/recipes")) {
        return new Response(JSON.stringify({ items: fixture.recipes ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.includes("/api/production/v1/production/audit/events")) {
        return new Response(JSON.stringify({ items: fixture.auditEvents ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      const intakeRequestDetailMatch = url.match(/\/api\/intake\/v1\/intake\/requests\/([^/?#]+)$/);
      if (intakeRequestDetailMatch) {
        const requestId = decodeURIComponent(intakeRequestDetailMatch[1]);
        const detail = fixture.intakeRequestDetails?.[requestId];
        if (detail) {
          return new Response(JSON.stringify(detail), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      }

      if (
        url.endsWith("/api/intake/health") ||
        url.endsWith("/api/offers/health") ||
        url.endsWith("/api/production/health") ||
        url.endsWith("/api/exports/health")
      ) {
        return new Response(
          JSON.stringify({ service: "ok", status: "ok", timestamp: "2026-04-10T09:30:00.000Z", counts: {} }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

async function renderRoute(pathname: string): Promise<{ text: string; html: string }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", pathname);

  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
    await Promise.resolve();
  });

  const result = {
    text: document.body.textContent ?? "",
    html: document.body.innerHTML
  };

  await act(async () => {
    root.unmount();
  });
  container.remove();

  return result;
}

async function renderRouteLive(pathname: string): Promise<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", pathname);

  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
    await Promise.resolve();
  });

  return { root, container };
}

async function renderRouteWithFirstHistorySelection(
  pathname: "/angebot" | "/produktion"
): Promise<{ text: string; html: string }> {
  const { root, container } = await renderRouteLive(pathname);
  const historySelector = pathname === "/angebot" ? ".offer-history-details" : ".production-history-details";
  const history = container.querySelector(historySelector) as HTMLDetailsElement | null;
  if (history) {
    history.open = true;
  }
  const firstJob = history?.querySelector(".quiet-list__button") as HTMLButtonElement | null;
  if (!firstJob) {
    throw new Error(`No history item found on ${pathname}`);
  }

  await act(async () => {
    firstJob.click();
    await flush(20);
  });

  const result = {
    text: document.body.textContent ?? "",
    html: document.body.innerHTML
  };
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return result;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function findButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find((el) =>
    (el.textContent ?? "").includes(text)
  );
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button as HTMLButtonElement;
}

function findAnchorByText(document: Document, text: string): HTMLAnchorElement {
  const anchor = Array.from(document.querySelectorAll("a")).find((el) => (el.textContent ?? "").includes(text));
  if (!anchor) {
    throw new Error(`Anchor not found: ${text}`);
  }
  return anchor as HTMLAnchorElement;
}

function findRouteCardAnchor(document: Document, cardMarker: string): HTMLAnchorElement {
  const card = Array.from(document.querySelectorAll("article")).find((el) => (el.textContent ?? "").includes(cardMarker));
  const anchor = card?.querySelector("a");
  if (!anchor) {
    throw new Error(`Route card anchor not found: ${cardMarker}`);
  }
  return anchor as HTMLAnchorElement;
}

async function flush(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function installPendingBackofficeEnvironmentMocks() {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    }
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true
  });
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("backoffice route smoke", () => {
  it("renders the three core routes with stable markers", async () => {
    installBackofficeEnvironmentMocks();

    const home = (await renderRoute("/")).text;
    expect(home).toContain("Catering-Agenten");
    expect(home).toMatch(/gemeinsam.*regelkern/i);
    expect(home).toContain("Neuen Auftrag beginnen");
    expect(home).toContain("Frühere Aufträge");
    expect(home).not.toContain("Interner Arbeitsstand");
    expect(home).not.toContain("Operative Spezifikationen");
    expect(home).not.toContain("Produktionspläne");
    expect(home).not.toContain("Änderungsprotokoll");
    expect(home).not.toContain("Reviewer-Hinweis");
    expect(home).not.toContain("Rehearsal-Go");
    expect(home).not.toContain("Interner Mini-Pilot");
    expect(home).not.toContain("Draft-Probe lokal und kontrolliert prüfen");
    expect(home).not.toContain("ready oder blocked mit Grund und nächstem sicheren Schritt direkt im JSON-Ergebnis.");
    expect(home).not.toContain("Anfrage, Angebot, Produktion, Einkauf und Export gemeinsam prüfen.");

    const offer = await renderRoute("/angebot");
    expect(offer.text).toContain("Angebotsagent");
    expect(offer.text).toContain("Kundenanfrage einfügen und Entwurf prüfen");
    expect(offer.text).not.toContain("Catering-Betriebssystem");
    expect(offer.html).not.toContain("Bearbeitername");
    expect(offer.text).not.toContain("Demo-Daten laden");
    expect(offer.text).not.toContain("Aktualisieren");
    expect(offer.text).not.toContain("Ruhige Workbench für Kundenanfragen und Angebotsentwürfe.");

    const production = await renderRoute("/produktion");
    expect(production.text).toContain("Produktionsagent");
    expect(production.text).toContain("Angebot hochladen oder Produktionsauftrag beschreiben");
    expect(production.text).toContain("Angebot hochladen oder Produktionsauftrag beschreiben");
    expect(production.text).toContain("Frühere Produktionsaufträge öffnen");
    expect(production.text).not.toContain("Bestandsdaten im Hintergrund");
    expect(production.html).not.toContain('aria-label="Kompakte Produktionszusammenfassung"');
  });

  it("keeps the home initial loading state from looking like an empty data set", async () => {
    installPendingBackofficeEnvironmentMocks();

    const home = (await renderRoute("/")).text;

    expect(home).toContain("Neuen Auftrag beginnen");
    expect(home).toContain("Frühere Aufträge");
    expect(home).not.toContain("Plattformdaten werden geladen");
    expect(home).not.toContain("operative Datensätze");
    expect(home).not.toContain("Healthcheck läuft");
    expect(home).not.toContain("Änderungen werden geladen");
  });

  it("keeps the production initial loading state from looking like an empty production workspace", async () => {
    installPendingBackofficeEnvironmentMocks();

    const production = (await renderRoute("/produktion")).text;

    expect(production).toContain("Produktionsdaten werden geladen; noch kein Vorgang bewertet.");
    expect(production).toContain("Aufträge werden geladen");
    expect(production).toContain("Aktuelle Plattformdaten werden geladen...");
    expect(production).not.toContain("Produktionspläne werden geladen; noch keine Planbewertung.");
    expect(production).not.toContain("Einkaufslisten werden geladen; noch keine Beschaffungsbewertung.");
    expect(production).toContain("Aktuelle Plattformdaten werden geladen...");
    expect(production).not.toContain("Noch kein aktiver Vorgang");
    expect(production).not.toContain("0 Pläne · 0 Einkaufslisten · 0 Rezepte");
    expect(production).not.toContain("0 Küchenpläne mit Zeit- und Rezeptbezug sind vorhanden.");
  });

  it("keeps the home navigation entries wired to route-stable offer and production markers", async () => {
    installBackofficeEnvironmentMocks();

    const home = await renderRoute("/");
    const homeDocument = new DOMParser().parseFromString(home.html, "text/html");

    const offerNav = findAnchorByText(homeDocument, "Neuen Auftrag beginnen");
    const historyNav = findAnchorByText(homeDocument, "Frühere Aufträge");

    expect(offerNav.getAttribute("href")).toBe("/angebot");
    expect(historyNav.getAttribute("href")).toBe("/angebot#history");

    const offer = (await renderRoute(offerNav.getAttribute("href") ?? "")).text;
    expect(offer).toContain("Angebotsagent");
    expect(offer).toContain("Kundenanfrage einfügen und Entwurf prüfen");

    const production = (await renderRoute("/produktion")).text;
    expect(production).toContain("Produktionsagent");
    expect(production).toContain("Angebot hochladen oder Produktionsauftrag beschreiben");
    expect(production).toContain("Frühere Produktionsaufträge öffnen");
    expect(production).not.toContain("Bestandsdaten im Hintergrund");
    expect(production).not.toContain("Ready oder blocked direkt im Arbeitsfluss lesen");
  });

  it("keeps the synthetic core corridor visible from start through offer handoff to production exports", async () => {
    installBackofficeEnvironmentMocks({
      intakeRequests: [
        {
          requestId: "corridor-request-1",
          source: { channel: "pdf_upload", receivedAt: "2026-08-20T09:00:00.000Z" }
        }
      ],
      acceptedSpecs: [
        {
          schemaVersion: 1,
          specId: "corridor-spec-1",
          requestId: "corridor-request-1",
          sourceLineage: [{ sourceType: "offer_draft", reference: "corridor-draft-1" }],
          readiness: { status: "partial", reasons: ["Lieferfenster fehlt."] },
          event: { type: "lunch", date: "2026-09-15" },
          servicePlan: { eventType: "lunch", serviceForm: "buffet" },
          attendees: { expected: 64 },
          menuPlan: [
            {
              componentId: "corridor-component-lentil-stew",
              label: "Linseneintopf vegan",
              menuCategory: "vegan",
              productionDecision: { mode: "scratch" }
            }
          ]
        }
      ],
      offerDrafts: [
        {
          draftId: "corridor-draft-1",
          eventSummary: "Korridor Lunchangebot",
          variantSet: [{ variantId: "balanced", label: "Ausgewogen" }],
          openQuestions: ["Lieferfenster klären"]
        }
      ],
      productionPlans: [
        {
          planId: "corridor-plan-1",
          eventSpecId: "corridor-spec-1",
          readiness: { status: "partial", reasons: ["Lieferfenster fehlt."] },
          productionBatches: [],
          kitchenSheets: [{ sheetId: "corridor-sheet-1" }],
          recipeSelections: []
        }
      ],
      purchaseLists: [
        {
          purchaseListId: "corridor-purchase-1",
          eventSpecId: "corridor-spec-1",
          totals: { itemCount: 2 },
          items: [
            { articleName: "Linsen", purchaseQty: 5, purchaseUnit: "kg" },
            { articleName: "Karotten", purchaseQty: 3, purchaseUnit: "kg" }
          ]
        }
      ],
      auditEvents: [
        {
          auditId: "corridor-audit-1",
          summary: "Korridor-Demo vorbereitet",
          action: "production.seed_demo",
          at: "2026-08-20T09:05:00.000Z",
          actor: { name: "Betriebs-/Audit-Operator" }
        }
      ],
      intakeRequestDetails: {
        "corridor-request-1": {
          requestId: "corridor-request-1",
          source: { channel: "pdf_upload", receivedAt: "2026-08-20T09:00:00.000Z" },
          rawInputs: [
            {
              kind: "pdf",
              mimeType: "application/pdf",
              documentId: "corridor-document-1",
              sourceMetadata: {
                filename: "corridor-angebot.pdf",
                mimeType: "application/pdf",
                sizeBytes: 3072,
                sha256: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                ingestedAt: "2026-08-20T09:00:00.000Z",
                uploadContext: "intake"
              },
              documentIngestion: { status: "ok", warnings: [] }
            }
          ]
        }
      }
    });

    const home = (await renderRoute("/")).text;
    expect(home).toContain("Neuen Auftrag beginnen");
    expect(home).toContain("Frühere Aufträge");
    expect(home).not.toContain("operative Datensätze");
    expect(home).not.toContain("Korridor-Demo vorbereitet");

    const offer = await renderRouteWithFirstHistorySelection("/angebot");
    expect(offer.text).toContain("Aktueller Entwurf: Korridor Lunchangebot");
    expect(offer.text).toContain("aktueller Vorgang: Lunch · 64 Teilnehmer · 2026-09-15 (teilweise vollständig)");
    expect(offer.text).toContain("Zur Produktion");

    const offerDocument = new DOMParser().parseFromString(offer.html, "text/html");
    const offerExportLink = Array.from(offerDocument.querySelectorAll("a")).find((anchor) =>
      (anchor.textContent ?? "").includes("Angebot exportieren")
    ) as HTMLAnchorElement | undefined;
    const productionHandoffLink = Array.from(offerDocument.querySelectorAll("a")).find((anchor) =>
      (anchor.textContent ?? "").includes("Zur Produktion")
    ) as HTMLAnchorElement | undefined;

    expect(offerExportLink?.getAttribute("href")).toBe("/api/exports/v1/exports/offers/corridor-draft-1/html");
    expect(productionHandoffLink?.getAttribute("href")).toBe("/produktion");

    const production = await renderRouteWithFirstHistorySelection("/produktion");
    expect(production.text).toContain("Lunch · 64 Teilnehmer · 2026-09-15");
    expect(production.text).toContain("Rückfragen beantworten");
    expect(production.text).toContain("Intake-Ursprung: Dateiupload · erhalten 2026-08-20T09:00:00.000Z");
    expect(production.text).not.toContain("requestId: corridor-request-1");
    expect(production.text).toContain("Nächster Arbeitsschritt");
    expect(production.text).toContain("Produktionsplan");
    expect(production.text).not.toContain("Produktionsobjekte und Downloads prüfen");
    expect(production.text).not.toContain("Ready oder blocked direkt im Arbeitsfluss lesen");
    expect(production.text).not.toContain("Status: noch kein Ergebnis");
    expect(production.text).not.toContain("Mini-Pilot-Status vor Export");
    expect(production.text).not.toContain("Export erst nach gruenem Mini-Pilot-Check");
    expect(production.text).toContain("Produktionsblatt exportieren für diesen Produktionsplan");
    expect(production.html).toContain("/api/exports/v1/exports/production-plans/corridor-plan-1/html");
    expect(production.text).toContain("Einkaufsliste exportieren für aktuellen Vorgang");
    expect(production.html).toContain("/api/exports/v1/exports/purchase-lists/corridor-purchase-1/csv");
    expect(production.text).toContain("Audit-Spur");
    expect(production.text).toContain("Produktionsauftrag angelegt.");
    expect(production.text).not.toContain("Korridor-Demo vorbereitet");
    expect(production.text).not.toContain("Produktionsfreigabe erteilt");
  });

  it("keeps the intake status summary anchored on safe source and ingestion warning markers", async () => {
    installBackofficeEnvironmentMocks({
      intakeRequests: [
        {
          requestId: "intake-source-warning-1",
          source: {
            channel: "pdf_upload",
            receivedAt: "2026-05-22T09:15:00.000Z"
          },
          rawInputs: [
            {
              kind: "document",
              documentIngestion: {
                status: "fallback",
                warnings: ["document_text_extraction_fallback"]
              },
              sourceMetadata: {
                filename: "kundenanfrage-b21.pdf",
                mimeType: "application/pdf",
                sizeBytes: 3072,
                sha256: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                ingestedAt: "2026-05-22T09:16:00.000Z",
                uploadContext: "intake"
              }
            }
          ]
        }
      ]
    });

    const home = (await renderRoute("/")).text;

    expect(home).not.toContain("Erfassung");
    expect(home).not.toContain("letzte Erfassung: Dateiupload");
    expect(home).not.toContain("intake-source-warning-1");
    expect(home).not.toContain("Quelle: kundenanfrage-b21.pdf");
    expect(home).not.toContain("Dokumentprüfung: Lesbarkeit: Textextraktion unsicher");
    expect(home).not.toContain("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  });

  it("keeps existing offer drafts in history until the operator opens one", async () => {
    installBackofficeEnvironmentMocks({
      acceptedSpecs: [
        { specId: "offer-spec-complete", readiness: { status: "complete" }, event: { type: "lunch" } },
        { specId: "offer-spec-partial", readiness: { status: "partial" }, event: { type: "meeting" } }
      ],
      offerDrafts: [
        {
          draftId: "offer-draft-buffet",
          eventSummary: "Sommerfest mit Buffet",
          proposedEventSpec: {
            specId: "offer-draft-buffet-spec",
            readiness: { status: "partial" },
            sourceLineage: [{ sourceType: "offer_service", reference: "offer-draft-buffet" }]
          },
          variantSet: [
            {
              variantId: "basis",
              label: "Basis"
            }
          ],
          openQuestions: ["Getränkepaket noch klären"]
        }
      ]
    });

    const offer = (await renderRoute("/angebot")).text;

    expect(offer).toContain("Kundenanfrage einfügen und Entwurf prüfen");
    expect(offer).toContain("Frühere Angebotsaufträge öffnen");
    expect(offer).toContain("1 Auftrag");
    expect(offer).toContain("Angebotsfall");
    expect(offer).not.toContain("Sommerfest mit Buffet · 1 Variante · 1 offener Punkt");
    expect(offer).not.toContain("Zusammenfassung");
    expect(offer).not.toContain("Angebotsentwurf prüfen");
    expect(offer).not.toContain("Variante übernehmen: Basis");
    expect(offer).not.toContain("Angebot exportieren");
    expect(offer).not.toContain("offer-draft-buffet-spec");
  });

  it("keeps the empty offer route clear about next step and missing export approval artifacts", async () => {
    installBackofficeEnvironmentMocks();

    const offer = await renderRoute("/angebot");

    expect(offer.text).toContain("Kundenanfrage einfügen und Entwurf prüfen");
    expect(offer.text).toContain("Als Nächstes: Anfrage einfügen");
    expect(offer.text).toContain("Frühere Angebotsaufträge öffnen");
    expect(offer.text).toContain("0 Aufträge");
    expect(offer.text).toContain("Datei auswählen");
    expect(offer.text).not.toContain("normalisieren");
    expect(offer.text).not.toContain("Spezifikation anlegen");
    expect(offer.text).not.toContain("Operative Übergabe und Audit");
    expect(offer.text).not.toContain("Noch kein Angebotsentwurf vorhanden.");
    expect(offer.text).not.toContain("Export/Freigabe");
    expect(offer.text).not.toContain("Entwurf lokal gegen den Mini-Pilot-Rahmen prüfen");
    expect(offer.text).not.toContain("Ready oder blocked direkt im Arbeitsfluss lesen");
    expect(offer.text).not.toContain("Status: noch kein Ergebnis");
    expect(offer.text).not.toContain("Grenze: nur interne Demo- oder Testdaten");
    expect(offer.text).not.toContain("Angebots-HTML für");
    expect(offer.text).not.toContain("Angebot exportieren");
    expect(offer.text).not.toContain("Produktionsfreigabe erteilt");
    expect(offer.text).not.toContain("Compliance-Freigabe erteilt");
    expect(offer.text).not.toContain("externe Freigabe erteilt");
  });

  it("walks the offer happy path from central request input to focused draft and handoff anchors", async () => {
    const acceptedSpecs: Array<Record<string, unknown>> = [
      { specId: "c3-spec-complete", readiness: { status: "complete" }, event: { type: "lunch" } }
    ];
    const offerDrafts: Array<Record<string, unknown>> = [
      {
        draftId: "c3-draft-existing",
        revision: 1,
        eventSummary: "Bestehender Lunch-Entwurf",
        variantSet: [{ variantId: "existing", label: "Bestehend" }],
        openQuestions: []
      }
    ];
    const postedBodies: Array<Record<string, unknown>> = [];
    const approvalBodies: Array<Record<string, unknown>> = [];
    let createdOfferDraft: Record<string, unknown> | undefined;

    installBackofficeEnvironmentMocks({ acceptedSpecs, offerDrafts });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (
        url.endsWith("/api/offers/v1/offers/cases") &&
        (init?.method ?? "GET").toUpperCase() === "GET"
      ) {
        return new Response(
          JSON.stringify({
            items: createdOfferDraft
              ? [
                  {
                    caseId: "offer-case-c3",
                    product: "offer",
                    displayName: "C3 Sommerfest-Angebot",
                    status: "open",
                    createdAt: "2026-08-20T09:00:00.000Z",
                    updatedAt: "2026-08-20T09:00:00.000Z"
                  }
                ]
              : []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (
        url.endsWith("/api/offers/v1/offers/cases/offer-case-c3") &&
        (init?.method ?? "GET").toUpperCase() === "GET"
      ) {
        return new Response(
          JSON.stringify({
            case: {
              schemaVersion: "1.0",
              businessId: "local",
              caseId: "offer-case-c3",
              product: "offer",
              displayName: "C3 Sommerfest-Angebot",
              status: "open",
              version: 1,
              createdAt: "2026-08-20T09:00:00.000Z",
              updatedAt: "2026-08-20T09:00:00.000Z"
            },
            events: [
              {
                businessId: "local",
                eventId: "offer-case-c3-draft",
                caseId: "offer-case-c3",
                sequence: 1,
                at: "2026-08-20T09:00:00.000Z",
                role: "system",
                kind: "artifact_attached",
                text: "Angebotsentwurf verknüpft.",
                revisionRef: {
                  artifactType: "OfferDraft",
                  artifactId: "c3-draft-created",
                  revision: 1,
                  createdAt: "2026-08-20T09:00:00.000Z"
                }
              }
            ],
            ...(createdOfferDraft ? { currentDraft: createdOfferDraft } : {})
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (
        url.endsWith("/api/offers/v1/offers/cases") &&
        (init?.method ?? "GET").toUpperCase() === "POST"
      ) {
        return new Response(JSON.stringify({ case: { caseId: "offer-case-c3" } }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/offers/v1/offers/from-text")) {
        postedBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        const createdDraft = {
          draftId: "c3-draft-created",
          revision: 1,
          eventSummary: "C3 Sommerfest-Angebot für 80 Personen",
          variantSet: [{ variantId: "classic", label: "Klassisch" }],
          openQuestions: ["Getränkepaket noch klären"],
          customerFacingText: "Gerne bieten wir ein Sommerfest für 80 Personen an.",
          internalWorkingText: "Interne Angebotsnotiz: Buffet und Getränkepaket prüfen."
        };
        createdOfferDraft = { ...createdDraft, proposedEventSpec: acceptedSpecs[0] };
        offerDrafts.push(createdOfferDraft);
        return new Response(JSON.stringify(createdOfferDraft), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/offers/v1/offers/drafts/c3-draft-created/decision")) {
        approvalBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return new Response(JSON.stringify({ approvedOffer: { approvedOfferId: "c3-offer-approved" } }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/intake/v1/intake/requests/c3-request-promoted")) {
        return new Response(
          JSON.stringify({
            requestId: "c3-request-promoted",
            source: { channel: "offer", receivedAt: "2026-08-20T09:00:00.000Z" },
            rawInputs: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/intake/v1/intake/requests")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/intake/v1/intake/specs/c3-spec-complete")) {
        return new Response(
          JSON.stringify({
            ...acceptedSpecs[0],
            specId: "c3-spec-complete",
            requestId: "c3-request-promoted",
            event: { type: "lunch", date: "2026-08-20" },
            servicePlan: { serviceForm: "buffet", eventType: "lunch" },
            attendees: { expected: 80 },
            readiness: { status: "complete", reasons: [] }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/intake/v1/intake/specs")) {
        return new Response(JSON.stringify({ items: acceptedSpecs }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/offers/v1/offers/drafts")) {
        return new Response(JSON.stringify({ items: offerDrafts }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/plans")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/recipes")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.includes("/api/production/v1/production/audit/events")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (
        url.endsWith("/api/intake/health") ||
        url.endsWith("/api/offers/health") ||
        url.endsWith("/api/production/health") ||
        url.endsWith("/api/exports/health")
      ) {
        return new Response(
          JSON.stringify({ service: "ok", status: "ok", timestamp: "2026-04-10T09:30:00.000Z", counts: {} }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { root, container } = await renderRouteLive("/angebot");
    expect(document.body.textContent ?? "").toContain("Kundenanfrage einfügen und Entwurf prüfen");
    expect(document.body.textContent ?? "").not.toContain("Aktueller Entwurf: Bestehender Lunch-Entwurf");
    expect(document.body.textContent ?? "").toContain("Frühere Angebotsaufträge öffnen");

    const offerInput = document.querySelector(
      "textarea[aria-label='Kundenanfrage als Text']"
    ) as HTMLTextAreaElement | null;
    if (!offerInput) {
      throw new Error("Central offer request input not found");
    }
    expect(offerInput.value).toBe("");

    await act(async () => {
      setNativeValue(
        offerInput,
        "C3 Sommerfest am 2026-08-20 für 80 Personen mit Buffet, Getränkepaket und Dessertstation."
      );
      findButtonByText("Entwurf aus Text erstellen").click();
      await flush();
    });

    const text = document.body.textContent ?? "";
    const createdExport = Array.from(document.querySelectorAll("a")).find((anchor) =>
      (anchor.textContent ?? "").includes("Angebot exportieren")
    ) as HTMLAnchorElement | undefined;

    expect(postedBodies).toEqual([
      {
        caseId: "offer-case-c3",
        requestId: expect.stringMatching(/^request-ui-/),
        text: "C3 Sommerfest am 2026-08-20 für 80 Personen mit Buffet, Getränkepaket und Dessertstation."
      }
    ]);
    expect(text).toContain("Angebotsentwurf wurde erstellt.");
    expect(text).toContain("Aktueller Entwurf: C3 Sommerfest-Angebot für 80 Personen");
    expect(text).toContain("C3 Sommerfest-Angebot für 80 Personen · 1 Variante · 1 offener Punkt");
    expect(text).toContain("Getränkepaket noch klären");
    expect(text).toContain("Variante freigeben: Klassisch");
    expect(createdExport?.getAttribute("href")).toBe("/api/exports/v1/exports/offers/c3-draft-created/html");
    expect(text).toContain("Für die Produktion übernommene Veranstaltungen");
    expect(text).toContain("Status: vollständig");
    expect(text).toContain("Zur Produktion");

    await act(async () => {
      findButtonByText("Variante freigeben: Klassisch").click();
      await flush();
    });

    const approvedText = document.body.textContent ?? "";
    expect(approvalBodies).toEqual([{ decision: "approved", revision: 1, variantId: "classic" }]);
    expect(approvedText).toContain("Angebotsvariante wurde freigegeben.");

    await act(async () => {
      root.unmount();
    });
    container.remove();

    const production = await renderRoute("/produktion");
    expect(production.text).toContain("Angebot hochladen oder Produktionsauftrag beschreiben");
  });

  it("keeps production upload limit errors visible in the workbench", async () => {
    installBackofficeEnvironmentMocks();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = fetchMock.getMockImplementation() as typeof fetch | undefined;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/intake/v1/intake/source-documents")) {
        return new Response(JSON.stringify({ message: "Datei ist zu gross fuer den Import." }), {
          status: 413,
          statusText: "Payload Too Large",
          headers: { "content-type": "application/json" }
        });
      }

      return await defaultFetch?.(input, init);
    });

    const { root, container } = await renderRouteLive("/produktion");
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement | null;
    if (!fileInput) {
      throw new Error("Production upload input not found");
    }

    const oversizedFile = new File(["x".repeat(64)], "zu-gross.txt", { type: "text/plain" });
    Object.defineProperty(fileInput, "files", {
      value: [oversizedFile],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await flush(8);
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Die Datei ist zu groß. Maximal erlaubt sind 25 MB.");
    expect(text).not.toContain("Datei ist zu gross fuer den Import.");
    expect(text).not.toContain("Dokument zu-gross.txt wird analysiert");
    expect(text).not.toContain("Dokument zu-gross.txt wurde übernommen und analysiert.");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps offer and production handoff anchored on the same request, spec, and export markers", async () => {
    installBackofficeEnvironmentMocks({
      acceptedSpecs: [
        {
          schemaVersion: 1,
          specId: "c4-spec-handoff",
          requestId: "c4-request-handoff",
          sourceLineage: [{ sourceType: "offer_draft", reference: "c4-draft-handoff" }],
          readiness: { status: "complete", reasons: [] },
          event: { type: "lunch", date: "2026-08-21" },
          servicePlan: { eventType: "lunch", serviceForm: "buffet" },
          attendees: { expected: 80 },
          menuPlan: [
            {
              componentId: "c4-component-buffet",
              label: "Sommerbuffet",
              menuCategory: "classic",
              productionDecision: { mode: "scratch" }
            }
          ]
        }
      ],
      offerDrafts: [
        {
          draftId: "c4-draft-handoff",
          eventSummary: "C4 Sommerbuffet-Angebot",
          variantSet: [{ variantId: "classic", label: "Klassisch" }],
          openQuestions: []
        }
      ],
      productionPlans: [
        {
          planId: "c4-plan-handoff",
          eventSpecId: "c4-spec-handoff",
          readiness: { status: "complete", reasons: [] },
          productionBatches: [],
          kitchenSheets: [],
          recipeSelections: []
        }
      ],
      purchaseLists: [
        {
          purchaseListId: "c4-purchase-handoff",
          eventSpecId: "c4-spec-handoff",
          totals: { itemCount: 1 },
          items: [{ articleName: "Tomaten", purchaseQty: 8, purchaseUnit: "kg" }]
        }
      ],
      intakeRequestDetails: {
        "c4-request-handoff": {
          requestId: "c4-request-handoff",
          source: { channel: "offer", receivedAt: "2026-05-22T11:30:00.000Z" },
          rawInputs: [
            {
              kind: "pdf",
              mimeType: "application/pdf",
              content: "%PDF B5 Rohtext darf im Demo-Warnanker nicht erscheinen.",
              documentId: "c4-document-upload-warning",
              sourceMetadata: {
                filename: "c4-angebot.pdf",
                mimeType: "application/pdf",
                sizeBytes: 2048,
                sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                ingestedAt: "2026-05-22T11:29:00.000Z",
                uploadContext: "intake"
              },
              documentIngestion: {
                status: "fallback",
                warnings: ["document_text_extraction_fallback"]
              }
            }
          ]
        }
      }
    });

    const offer = await renderRouteWithFirstHistorySelection("/angebot");

    expect(offer.text).toContain("Aktueller Entwurf: C4 Sommerbuffet-Angebot");
    expect(offer.text).toContain("aktueller Vorgang: Lunch · 80 Teilnehmer · 2026-08-21 (vollständig)");
    expect(offer.text).toContain("specId: c4-spec-handoff");
    expect(offer.text).toContain("requestId: c4-request-handoff");

    const offerDocument = new DOMParser().parseFromString(offer.html, "text/html");
    const productionHandoffLink = Array.from(offerDocument.querySelectorAll("a")).find((anchor) =>
      (anchor.textContent ?? "").includes("Zur Produktion")
    ) as HTMLAnchorElement | undefined;
    expect(productionHandoffLink?.getAttribute("href")).toBe("/produktion");

    const production = await renderRouteWithFirstHistorySelection("/produktion");

    expect(production.text).toContain("Lunch · 80 Teilnehmer · 2026-08-21");
    expect(production.text).toContain("Spezifikation im Fokus");
    expect(production.text).not.toContain("specId: c4-spec-handoff");
    expect(production.text).not.toContain("requestId: c4-request-handoff");
    expect(production.text).toContain(
      "Dokumentprüfung: Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    );
    expect(production.text).toContain("Quellenmetadaten (gekürzt): c4-angebot.pdf · application/pdf · 2.0 KB · sha256:abcdef123456 · intake");
    expect(production.text).not.toContain("B5 Rohtext");
    expect(production.text).not.toContain("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    expect(production.text).toContain("Produktionsblatt exportieren für aktuellen Produktionsplan");
    expect(production.html).toContain("/api/exports/v1/exports/production-plans/c4-plan-handoff/html");
    expect(production.text).toContain("Einkaufsliste exportieren für aktuellen Vorgang");
    expect(production.html).toContain("/api/exports/v1/exports/purchase-lists/c4-purchase-handoff/csv");
  });

  it("keeps production plan details anchored on plan and spec identifiers before export", async () => {
    installBackofficeEnvironmentMocks({
      acceptedSpecs: [
        {
          specId: "b23-spec-detail",
          requestId: "b23-request-detail",
          readiness: { status: "complete", reasons: [] },
          event: { type: "lunch", date: "2026-09-12" },
          servicePlan: { serviceForm: "buffet" },
          attendees: { expected: 42 },
          menuPlan: [
            {
              componentId: "b23-component-salat",
              label: "Herbstsalat",
              menuCategory: "vegetarian",
              productionDecision: { mode: "scratch" }
            }
          ]
        }
      ],
      productionPlans: [
        {
          planId: "b23-plan-detail",
          eventSpecId: "b23-spec-detail",
          readiness: { status: "complete", reasons: [] },
          productionBatches: [],
          kitchenSheets: [{ sheetId: "b23-sheet-1" }],
          recipeSelections: []
        }
      ]
    });

    const production = await renderRouteWithFirstHistorySelection("/produktion");

    expect(production.text).toContain("Downloadbereich");
    expect(production.text).toContain("Plan-Kontext: aktueller Produktionsplan");
    expect(production.text).not.toContain("Mini-Pilot-Status vor Export");
    expect(production.text).toContain("Einzelheiten zu diesem Produktionsplan");
    expect(production.text).toContain("Produktionsblatt exportieren für diesen Produktionsplan");
    expect(production.html).toContain("/api/exports/v1/exports/production-plans/b23-plan-detail/html");
  });

  it("keeps the start overview anchored on existing operational counts", async () => {
    installBackofficeEnvironmentMocks({
      intakeRequests: [
        {
          requestId: "start-intake-old",
          source: { channel: "email", receivedAt: "2026-07-01T09:00:00.000Z" }
        },
        {
          requestId: "start-intake-new",
          source: { channel: "manual_form", receivedAt: "2026-07-01T10:00:00.000Z" }
        }
      ],
      acceptedSpecs: [
        { specId: "start-spec-complete", readiness: { status: "complete" } },
        { specId: "start-spec-partial", readiness: { status: "partial" } }
      ],
      offerDrafts: [{ draftId: "start-offer-1" }],
      productionPlans: [{ planId: "start-plan-1" }],
      purchaseLists: [{ purchaseListId: "start-purchase-1" }],
      recipes: [
        { recipeId: "start-recipe-approved", source: { approvalState: "approved_internal" } },
        { recipeId: "start-recipe-review", source: { approvalState: "review_required" } }
      ],
      auditEvents: [
        {
          auditId: "start-audit-1",
          summary: "Demo-Daten geladen",
          action: "seed_demo",
          at: "2026-07-01T10:05:00.000Z",
          actor: { name: "Mia" }
        }
      ]
    });

    const home = (await renderRoute("/")).text;

    expect(home).toContain("Neuen Auftrag beginnen");
    expect(home).toContain("Frühere Aufträge");
    expect(home).not.toContain("Operative Spezifikationen");
    expect(home).not.toContain("operative Datensätze");
    expect(home).not.toContain("Demo-Daten geladen");
  });

  it("keeps home audit and handoff markers framed as internal working evidence", async () => {
    installBackofficeEnvironmentMocks({
      auditEvents: [
        {
          auditId: "home-audit-handoff-boundary",
          summary: "Demo-Startweg belegt",
          action: "production.seed_demo",
          at: "2026-07-02T08:15:00.000Z",
          actor: { name: "Betriebs-/Audit-Operator" }
        }
      ]
    });

    const home = (await renderRoute("/")).text;

    expect(home).toContain("Neuen Auftrag beginnen");
    expect(home).toContain("Frühere Aufträge");
    expect(home).not.toContain("Änderungsprotokoll");
    expect(home).not.toContain("Demo-Startweg belegt");
    expect(home).not.toContain("Produktionsfreigabe erteilt");
    expect(home).not.toContain("Compliance-Nachweis erbracht");
    expect(home).not.toContain("echte Daten freigegeben");
  });
});
