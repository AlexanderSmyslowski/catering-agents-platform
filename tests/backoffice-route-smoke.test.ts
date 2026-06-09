// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";

type RouteSmokeDashboardFixture = {
  intakeRequests?: Array<Record<string, unknown>>;
  acceptedSpecs?: Array<Record<string, unknown>>;
  offerDrafts?: Array<Record<string, unknown>>;
  productionPlans?: Array<Record<string, unknown>>;
  purchaseLists?: Array<Record<string, unknown>>;
  recipes?: Array<Record<string, unknown>>;
  auditEvents?: Array<Record<string, unknown>>;
  intakeRequestDetails?: Record<string, Record<string, unknown>>;
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

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

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
    expect(home).toContain("Interner Arbeitsstand");
    expect(home).toContain("Arbeitsweg: Start → Angebot → Produktion → Rückfragen → Exporte.");
    expect(home).toContain("Grenze: nur interne Demo- oder Testdaten; keine externe Freigabe und keine Produktionsfreigabe.");
    expect(home).toContain("Prüfung: Quellen, offene Punkte und Exporte sichtbar halten; keine automatische Allergen-, Preis- oder Margenfreigabe.");
    expect(home).not.toContain("Reviewer-Hinweis");
    expect(home).not.toContain("Rehearsal-Go");
    expect(home).not.toContain("Interner Mini-Pilot");
    expect(home).not.toContain("Draft-Probe lokal und kontrolliert prüfen");
    expect(home).not.toContain("ready oder blocked mit Grund und nächstem sicheren Schritt direkt im JSON-Ergebnis.");
    expect(home).toContain("Anfrage, Angebot, Produktion, Einkauf und Export gemeinsam prüfen.");

    const offer = await renderRoute("/angebot");
    expect(offer.text).toContain("Angebotsagent");
    expect(offer.text).toContain("Kundenanfrage einfügen und ruhigen Entwurf erzeugen");
    expect(offer.text).not.toContain("Catering-Betriebssystem");
    expect(offer.html).not.toContain("Bearbeitername");
    expect(offer.text).not.toContain("Demo-Daten laden");
    expect(offer.text).not.toContain("Aktualisieren");
    expect(offer.text).not.toContain("Ruhige Workbench für Kundenanfragen und Angebotsentwürfe.");

    const production = (await renderRoute("/produktion")).text;
    expect(production).toContain("Produktionsagent");
    expect(production).toContain("Was braucht die Produktion als Nächstes?");
    expect(production).toContain("Auftrag einfügen oder Datei ablegen");
    expect(production).toContain("production-calm-summary");
    expect(production).toContain("Bestehende Spezifikationen, Pläne und Rezepte durchsuchen.");
  });

  it("keeps the home initial loading state from looking like an empty data set", async () => {
    installPendingBackofficeEnvironmentMocks();

    const home = (await renderRoute("/")).text;

    expect(home).toContain("Plattformdaten werden geladen; noch kein Datenbestand bewertet.");
    expect(home).toContain("Übergabe wird geladen; noch keine Übergabe-Bewertung.");
    expect(home).toContain("Angebotsdaten werden geladen; noch keine Entwurfsbewertung.");
    expect(home).toContain("Produktionsdaten werden geladen; noch keine Plan-/Einkaufslistenbewertung.");
    expect(home).toContain("Rezeptbestand wird geladen; noch keine Review-Bewertung.");
    expect(home).toContain("Healthcheck läuft · Zähler werden geladen · letzte Erfassung wird geladen");
    expect(home).toContain("Änderungen werden geladen; noch kein Audit-/Handoff-Befund.");
    expect(home).not.toContain("0 operative Datensätze stehen dienstübergreifend bereit.");
    expect(home).not.toContain("Noch keine Änderungen geladen.");
  });

  it("keeps the production initial loading state from looking like an empty production workspace", async () => {
    installPendingBackofficeEnvironmentMocks();

    const production = (await renderRoute("/produktion")).text;

    expect(production).toContain("Produktionsdaten werden geladen; noch kein Vorgang bewertet.");
    expect(production).toContain("Produktionsbestand wird geladen · Produktionsdienst wird geprüft");
    expect(production).toContain("Produktionsdaten laden");
    expect(production).toContain("Produktionspläne werden geladen; noch keine Planbewertung.");
    expect(production).toContain("Einkaufslisten werden geladen; noch keine Beschaffungsbewertung.");
    expect(production).toContain("Rezeptbestand wird geladen; noch keine Review-Bewertung.");
    expect(production).toContain("Healthcheck läuft · Produktionszähler werden geladen");
    expect(production).toContain("Aktuelle Plattformdaten werden geladen...");
    expect(production).not.toContain("Noch kein aktiver Vorgang");
    expect(production).not.toContain("0 Pläne · 0 Einkaufslisten · 0 Rezepte");
    expect(production).not.toContain("0 Küchenpläne mit Zeit- und Rezeptbezug sind vorhanden.");
  });

  it("keeps the home navigation entries wired to route-stable offer and production markers", async () => {
    installBackofficeEnvironmentMocks();

    const home = await renderRoute("/");
    const homeDocument = new DOMParser().parseFromString(home.html, "text/html");

    const offerNav = findAnchorByText(homeDocument, "Angebotsagent");
    const productionNav = findAnchorByText(homeDocument, "Produktionsagent");
    const offerShortcut = findAnchorByText(homeDocument, "Angebotsagent öffnen");
    const productionShortcut = findAnchorByText(homeDocument, "Produktionsagent öffnen");
    const offerCard = findRouteCardAnchor(homeDocument, "Kundenanfrage zu einem belastbaren Angebot verdichten");
    const productionCard = findRouteCardAnchor(homeDocument, "Küchenvorbereitung mit Rezepten und Einkaufslisten steuern");

    expect(offerNav.getAttribute("href")).toBe("/angebot");
    expect(offerShortcut.getAttribute("href")).toBe("/angebot");
    expect(offerCard.getAttribute("href")).toBe("/angebot");
    expect(productionNav.getAttribute("href")).toBe("/produktion");
    expect(productionShortcut.getAttribute("href")).toBe("/produktion");
    expect(productionCard.getAttribute("href")).toBe("/produktion");

    const offer = (await renderRoute(offerNav.getAttribute("href") ?? "")).text;
    expect(offer).toContain("Angebotsagent");
    expect(offer).toContain("Kundenanfrage einfügen und ruhigen Entwurf erzeugen");

    const production = (await renderRoute(productionNav.getAttribute("href") ?? "")).text;
    expect(production).toContain("Produktionsagent");
    expect(production).toContain("Was braucht die Produktion als Nächstes?");
    expect(production).toContain("Interner Arbeitsstand: Produktion, Einkauf, Exporte, Herkunft und offene Punkte bleiben sichtbar.");
    expect(production).toContain("Bitte vor Freigabe prüfen: keine automatische Allergen-, Preis- oder Margenfreigabe.");
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
    expect(home).toContain("Arbeitsweg: Start → Angebot → Produktion → Rückfragen → Exporte.");
    expect(home).toContain("1 operative Datensätze stehen dienstübergreifend bereit.");
    expect(home).toContain("1 kaufmännische Entwürfe können direkt übernommen werden.");
    expect(home).toContain("1 Küchenpläne · 1 Einkaufslisten mit Rezept- und Einkaufsbezug sind verfügbar.");
    expect(home).toContain("Korridor-Demo vorbereitet · Actor: Betriebs-/Audit-Operator · Action: production.seed_demo");

    const offer = await renderRoute("/angebot");
    expect(offer.text).toContain("Aktueller Fokus: corridor-draft-1");
    expect(offer.text).toContain("aktive Spezifikation: corridor-spec-1 (teilweise vollständig)");
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

    const production = await renderRoute(productionHandoffLink?.getAttribute("href") ?? "");
    expect(production.text).toContain("Lunch · 64 Teilnehmer · 2026-09-15");
    expect(production.text).toContain("Rückfragen beantworten");
    expect(production.text).toContain("requestId: corridor-request-1");
    expect(production.text).toContain("production-objects-zone");
    expect(production.text).toContain("Produktionsobjekte");
    expect(production.text).not.toContain("Ready oder blocked direkt im Arbeitsfluss lesen");
    expect(production.text).not.toContain("Status: noch kein Ergebnis");
    expect(production.text).not.toContain("Mini-Pilot-Status vor Export");
    expect(production.text).not.toContain("Export erst nach gruenem Mini-Pilot-Check");
    expect(production.text).toContain(
      "Produktionsblatt exportieren für Plan corridor-plan-1 · Spezifikation corridor-spec-1"
    );
    expect(production.html).toContain("/api/exports/v1/exports/production-plans/corridor-plan-1/html");
    expect(production.text).toContain(
      "Einkaufsliste exportieren für aktuellen Vorgang corridor-purchase-1 · Spezifikation corridor-spec-1"
    );
    expect(production.html).toContain("/api/exports/v1/exports/purchase-lists/corridor-purchase-1/csv");
    expect(production.text).toContain("Audit-Spur");
    expect(production.text).toContain("Korridor-Demo vorbereitet · Betriebs-/Audit-Operator · production.seed_demo");
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

    expect(home).toContain("Erfassung");
    expect(home).toContain("letzte Erfassung: intake-source-warning-1 via pdf_upload");
    expect(home).toContain("Quelle: kundenanfrage-b21.pdf");
    expect(home).toContain("Ingestion-Warnung: Status fallback · Warnkey document_text_extraction_fallback");
    expect(home).not.toContain("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  });

  it("keeps the offer route anchored on existing drafts and operative handoff status", async () => {
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

    expect(offer).toContain("Zusammenfassung");
    expect(offer).toContain("Interner Arbeitsstand: Anfrage, Entwurf, Export und Übergabe bleiben sichtbar.");
    expect(offer).toContain("Grenze: nur interne Demo- oder Testdaten; keine echten Kundendaten, keine externe Freigabe.");
    expect(offer).toContain("Bitte vor Freigabe prüfen: keine automatische Preis-, Margen- oder Produktionsfreigabe.");
    expect(offer).not.toContain("Reviewer-Hinweis");
    expect(offer).toContain("Nächster Angebotsschritt: Entwurf offer-draft-buffet prüfen, Variante übernehmen, Angebots-HTML exportieren und zur Produktion wechseln.");
    expect(offer).toContain("Sommerfest mit Buffet · 1 Varianten · 1 offene Punkte");
    expect(offer).toContain("Übergabe: 1 vollständig · 1 teilweise");
    expect(offer).toContain("Quelle: offer_service: offer-draft-buffet");
    expect(offer).toContain("aktive Spezifikation: offer-draft-buffet-spec (teilweise vollständig)");
    expect(offer).toContain("Export: Angebots-HTML für offer-draft-buffet bereit");
    expect(offer).not.toContain("Entwurf lokal gegen den Mini-Pilot-Rahmen prüfen");
    expect(offer).not.toContain("Ready oder blocked direkt im Arbeitsfluss lesen");
    expect(offer).not.toContain("Status: noch kein Ergebnis");
    expect(offer).not.toContain("Mini-Pilot-Status vor Uebernahme");
    expect(offer).not.toContain("Uebernahme erst nach gruenem Mini-Pilot-Check");
    expect(offer).toContain("offer-draft-buffet");
    expect(offer).toContain("Entwurfs-Spec: offer-draft-buffet-spec (teilweise vollständig)");
    expect(offer).toContain("Entwurfs-Quelle: offer_service: offer-draft-buffet");
    expect(offer).toContain("Ausgewählter Entwurf");
    expect(offer).toContain("Variante übernehmen: Basis");
    expect(offer).toContain("Angebot exportieren");
    expect(offer).toContain("Operative Übergabe und Audit");
    expect(offer).toContain("Status: vollständig");
    expect(offer).toContain("Status: teilweise vollständig");
    expect(offer).not.toContain("1 Entwürfe mit Varianten und Export stehen bereit.");
    expect(offer).not.toContain("Angebotsdienst");
  });

  it("keeps the empty offer route clear about next step and missing export approval artifacts", async () => {
    installBackofficeEnvironmentMocks();

    const offer = await renderRoute("/angebot");

    expect(offer.text).toContain("Kundenanfrage einfügen und ruhigen Entwurf erzeugen");
    expect(offer.text).toContain("Nächster Schritt: Anfrage einfügen");
    expect(offer.text).toContain("Nächster Angebotsschritt: Anfrage einfügen oder Demo über Start nutzen, dann Entwurf prüfen.");
    expect(offer.text).toContain("Noch kein Angebotsentwurf vorhanden.");
    expect(offer.text).toContain("Export/Freigabe: noch kein Entwurf, kein Exportartefakt und keine Freigabe vorhanden.");
    expect(offer.text).not.toContain("Entwurf lokal gegen den Mini-Pilot-Rahmen prüfen");
    expect(offer.text).not.toContain("Ready oder blocked direkt im Arbeitsfluss lesen");
    expect(offer.text).not.toContain("Status: noch kein Ergebnis");
    expect(offer.text).toContain("Grenze: nur interne Demo- oder Testdaten; keine echten Kundendaten, keine externe Freigabe.");
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
        eventSummary: "Bestehender Lunch-Entwurf",
        variantSet: [{ variantId: "existing", label: "Bestehend" }],
        openQuestions: []
      }
    ];
    const postedBodies: Array<Record<string, unknown>> = [];
    const promotedBodies: Array<Record<string, unknown>> = [];

    installBackofficeEnvironmentMocks({ acceptedSpecs, offerDrafts });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/offers/v1/offers/from-text")) {
        postedBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        const createdDraft = {
          draftId: "c3-draft-created",
          eventSummary: "C3 Sommerfest-Angebot für 80 Personen",
          variantSet: [{ variantId: "classic", label: "Klassisch" }],
          openQuestions: ["Getränkepaket noch klären"],
          customerFacingText: "Gerne bieten wir ein Sommerfest für 80 Personen an.",
          internalWorkingText: "Interne Angebotsnotiz: Buffet und Getränkepaket prüfen."
        };
        offerDrafts.push(createdDraft);
        return new Response(JSON.stringify(createdDraft), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/offers/v1/offers/drafts/c3-draft-created/promote")) {
        promotedBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        acceptedSpecs.push({
          specId: "c3-spec-promoted",
          requestId: "c3-request-promoted",
          draftId: "c3-draft-created",
          sourceLineage: [{ sourceType: "offer_draft", reference: "c3-draft-created" }],
          readiness: { status: "partial", reasons: ["Getränkepaket noch klären"] },
          event: { type: "sommerfest", date: "2026-08-20" },
          servicePlan: { serviceForm: "buffet" },
          attendees: { expected: 80 },
          menuPlan: [
            {
              componentId: "c3-component-buffet",
              label: "Buffet und Dessertstation",
              menuCategory: "classic",
              productionDecision: { mode: "scratch" }
            }
          ]
        });
        return new Response(JSON.stringify({ specId: "c3-spec-promoted" }), {
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
    expect(document.body.textContent ?? "").toContain("Kundenanfrage einfügen und ruhigen Entwurf erzeugen");
    expect(document.body.textContent ?? "").toContain("Aktueller Fokus: c3-draft-existing");

    const offerInput = document.querySelector(
      "textarea[placeholder='Kundenanfrage, E-Mail oder Angebotsnotiz hier einfügen ...']"
    ) as HTMLTextAreaElement | null;
    if (!offerInput) {
      throw new Error("Central offer request input not found");
    }

    await act(async () => {
      setNativeValue(
        offerInput,
        "C3 Sommerfest am 2026-08-20 für 80 Personen mit Buffet, Getränkepaket und Dessertstation."
      );
      findButtonByText("Angebotsentwurf erzeugen").click();
      await flush();
    });

    const text = document.body.textContent ?? "";
    const createdExport = Array.from(document.querySelectorAll("a")).find((anchor) =>
      (anchor.textContent ?? "").includes("Angebot exportieren")
    ) as HTMLAnchorElement | undefined;

    expect(postedBodies).toEqual([
      {
        text: "C3 Sommerfest am 2026-08-20 für 80 Personen mit Buffet, Getränkepaket und Dessertstation."
      }
    ]);
    expect(text).toContain("Angebotsentwurf wurde erstellt.");
    expect(text).toContain("Aktueller Fokus: c3-draft-created");
    expect(text).toContain("C3 Sommerfest-Angebot für 80 Personen · 1 Varianten · 1 offene Punkte");
    expect(text).toContain("Getränkepaket noch klären");
    expect(text).toContain("Variante übernehmen: Klassisch");
    expect(createdExport?.getAttribute("href")).toBe("/api/exports/v1/exports/offers/c3-draft-created/html");
    expect(text).toContain("Operative Übergabe und Audit");
    expect(text).toContain("Status: vollständig");
    expect(text).toContain("Zur Produktion");

    await act(async () => {
      findButtonByText("Variante übernehmen: Klassisch").click();
      await flush();
    });

    const promotedText = document.body.textContent ?? "";
    expect(promotedBodies).toEqual([{ variantId: "classic" }]);
    expect(promotedText).toContain("Angebotsvariante wurde als operative Spezifikation übernommen.");
    expect(promotedText).toContain("Übergabe: 1 vollständig · 1 teilweise");
    expect(promotedText).toContain("aktive Spezifikation: c3-spec-promoted (teilweise vollständig)");
    expect(promotedText).toContain("specId: c3-spec-promoted");
    expect(promotedText).toContain("requestId: c3-request-promoted");

    await act(async () => {
      root.unmount();
    });
    container.remove();

    const production = await renderRoute("/produktion");
    expect(production.text).toContain("sommerfest · 80 Teilnehmer · 2026-08-20");
    expect(production.text).toContain("specId: c3-spec-promoted");
    expect(production.text).toContain("requestId: c3-request-promoted");
    expect(production.text).toContain("Ursprüngliche Intake-AnfragerequestId: c3-request-promoted");
    expect(production.text).toContain("Intake-Ursprungoffer · 2026-08-20T09:00:00.000Z · c3-request-promoted");
    expect(production.text).not.toContain("Die ursprüngliche Intake-Anfrage konnte nicht geladen werden");
    expect(production.text).toContain("Nächster SchrittRückfragen beantworten");
    expect(production.text).toContain("Produktionsobjektenoch kein Plan");
  });

  it("keeps production upload limit errors visible in the workbench", async () => {
    installBackofficeEnvironmentMocks();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/intake/v1/intake/documents/upload")) {
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
    expect(text).toContain("Datei ist zu gross fuer den Import.");
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

    const offer = await renderRoute("/angebot");

    expect(offer.text).toContain("Aktueller Fokus: c4-draft-handoff");
    expect(offer.text).toContain("aktive Spezifikation: c4-spec-handoff (vollständig)");
    expect(offer.text).toContain("specId: c4-spec-handoff");
    expect(offer.text).toContain("requestId: c4-request-handoff");

    const offerDocument = new DOMParser().parseFromString(offer.html, "text/html");
    const productionHandoffLink = Array.from(offerDocument.querySelectorAll("a")).find((anchor) =>
      (anchor.textContent ?? "").includes("Zur Produktion")
    ) as HTMLAnchorElement | undefined;
    expect(productionHandoffLink?.getAttribute("href")).toBe("/produktion");

    const production = await renderRoute("/produktion");

    expect(production.text).toContain("Lunch · 80 Teilnehmer · 2026-08-21");
    expect(production.text).toContain("specId: c4-spec-handoff");
    expect(production.text).toContain("requestId: c4-request-handoff");
    expect(production.text).toContain("Ingestion-Warnung: Status fallback · Warnkey document_text_extraction_fallback");
    expect(production.text).toContain("Quellenmetadaten (gekürzt): c4-angebot.pdf · application/pdf · 2.0 KB · sha256:abcdef123456 · intake");
    expect(production.text).not.toContain("B5 Rohtext");
    expect(production.text).not.toContain("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    expect(production.text).toContain(
      "Produktionsblatt exportieren für Plan c4-plan-handoff · Spezifikation c4-spec-handoff"
    );
    expect(production.html).toContain("/api/exports/v1/exports/production-plans/c4-plan-handoff/html");
    expect(production.text).toContain(
      "Einkaufsliste exportieren für aktuellen Vorgang c4-purchase-handoff · Spezifikation c4-spec-handoff"
    );
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

    const production = await renderRoute("/produktion");

    expect(production.text).toContain("Downloadbereich");
    expect(production.text).toContain("Plan-Kontext: planId b23-plan-detail · specId b23-spec-detail");
    expect(production.text).not.toContain("Mini-Pilot-Status vor Export");
    expect(production.text).toContain("Einzelheiten zu Plan b23-plan-detail · Spezifikation b23-spec-detail");
    expect(production.text).toContain(
      "Produktionsblatt exportieren für Plan b23-plan-detail · Spezifikation b23-spec-detail"
    );
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

    expect(home).toContain("Operative Spezifikationen");
    expect(home).toContain("2 operative Datensätze stehen dienstübergreifend bereit.");
    expect(home).toContain("1 vollständig · 1 teilweise vollständig");
    expect(home).toContain("1 kaufmännische Entwürfe können direkt übernommen werden.");
    expect(home).toContain("1 Küchenpläne · 1 Einkaufslisten mit Rezept- und Einkaufsbezug sind verfügbar.");
    expect(home).toContain("2 Rezepte · 1 intern freigegeben · 1 Prüfung nötig");
    expect(home).toContain("letzte Erfassung: start-intake-new via manual_form");
    expect(home).toContain(
      "1 Änderungen geladen · neueste: Demo-Daten geladen · Actor: Mia · Action: seed_demo · 2026-07-01T10:05:00.000Z"
    );
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

    expect(home).toContain("Änderungsprotokoll");
    expect(home).toContain("Demo-Startweg belegt · Actor: Betriebs-/Audit-Operator · Action: production.seed_demo");
    expect(home).toContain(
      "Audit-/Handoff-Hinweis: interne Arbeitsbelege für Demo-/Beta-Prüfung; keine externe Freigabe, keine Produktionsfreigabe, keine echte-Daten-Freigabe und kein rechtssicherer Compliance-Nachweis."
    );
    expect(home).not.toContain("Produktionsfreigabe erteilt");
    expect(home).not.toContain("Compliance-Nachweis erbracht");
    expect(home).not.toContain("echte Daten freigegeben");
  });
});
