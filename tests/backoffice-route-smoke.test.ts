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

async function flush(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
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
    expect(offer).toContain("Sommerfest mit Buffet · 1 Varianten · 1 offene Punkte");
    expect(offer).toContain("Übergabe: 1 vollständig · 1 teilweise");
    expect(offer).toContain("offer-draft-buffet");
    expect(offer).toContain("Ausgewählter Entwurf");
    expect(offer).toContain("Variante übernehmen: Basis");
    expect(offer).toContain("Angebot exportieren");
    expect(offer).toContain("Operative Übergabe und Audit");
    expect(offer).toContain("Status: vollständig");
    expect(offer).toContain("Status: teilweise vollständig");
    expect(offer).not.toContain("1 Entwürfe mit Varianten und Export stehen bereit.");
    expect(offer).not.toContain("Angebotsdienst");
  });

  it("walks the offer happy path from central request input to focused draft and handoff anchors", async () => {
    const acceptedSpecs = [
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
      root.unmount();
    });
    container.remove();
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
    expect(production.text).toContain("Produktionsblatt exportieren");
    expect(production.html).toContain("/api/exports/v1/exports/production-plans/c4-plan-handoff/html");
    expect(production.text).toContain("Einkaufsliste herunterladen");
    expect(production.html).toContain("/api/exports/v1/exports/purchase-lists/c4-purchase-handoff/csv");
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
    expect(home).toContain("1 Küchenpläne mit Rezept- und Einkaufsbezug sind verfügbar.");
    expect(home).toContain("2 Rezepte · 1 intern freigegeben · 1 Prüfung nötig");
    expect(home).toContain("letzte Erfassung: start-intake-new via manual_form");
    expect(home).toContain("1 Änderungen geladen · neueste: Demo-Daten geladen");
  });
});
