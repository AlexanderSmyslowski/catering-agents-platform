// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";
import { ProductionConversationalWorkbench } from "../backoffice-ui/src/production-workbench.js";
import {
  buildProductionClarificationQuestions,
  createSubmittedProductionClarificationAnswer
} from "../shared-core/src/production-clarification.js";

function installProductionAcceptanceMocks(
  options: {
    stalePlanOnly?: boolean;
    withCurrentPurchaseList?: boolean;
    completeSpec?: boolean;
    withoutPlans?: boolean;
    withRecipeReviewStates?: boolean;
    withAuditEvent?: boolean;
    withSubmittedClarificationAnswer?: boolean;
    withoutSpecs?: boolean;
    withQuickLunchMixedPlan?: boolean;
    withArchivedProductionContext?: boolean;
    withSearchTargetSpec?: boolean;
    withPlanOnlyArtifacts?: boolean;
    withSecondPlanOnlyArtifact?: boolean;
    withInstructionLikeCurrentPurchaseItem?: boolean;
  } = {}
) {
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

  const requestId = "request-production-fallback-1";
  const specId = "spec-production-fallback-1";
  const previousSpecId = "spec-production-previous-1";
  const searchRequestId = "request-production-search-target-1";
  const searchSpecId = "spec-production-search-target-1";
  const planSpecId = options.stalePlanOnly
    ? previousSpecId
    : options.withPlanOnlyArtifacts
    ? "spec-production-plan-only-1"
    : specId;
  const purchaseListSpecId = options.withPlanOnlyArtifacts ? planSpecId : specId;
  const archivedRequestIds = new Set<string>();
  const archivedSpecIds = new Set<string>();
  const requestSpecIds = new Map<string, string>([
    [requestId, specId],
    [searchRequestId, searchSpecId]
  ]);
  const quickLunchMenuPlan = [
    {
      componentId: "quick-lunch-kalbsbuletten",
      label: "KALBSBULETTEN | SCHMORZWIEBELN",
      menuCategory: "classic",
      productionDecision: { mode: "scratch" }
    },
    {
      componentId: "quick-lunch-kartoffelsalat",
      label: "KARTOFFELSALAT | DE LUX",
      menuCategory: "classic",
      productionDecision: { mode: "scratch" }
    },
    {
      componentId: "quick-lunch-nudelsalat",
      label: "NUDELSALAT | FRISCHGEDÖNS",
      menuCategory: "classic",
      productionDecision: { mode: "scratch" }
    },
    {
      componentId: "quick-lunch-kraut-karottensalat",
      label: "KRAUT-KAROTTENSALAT | NUSS-TOPPING",
      menuCategory: "classic",
      productionDecision: { mode: "scratch" }
    },
    {
      componentId: "quick-lunch-mandel-curry",
      label: "MANDEL-CURRY | BASMATIREIS & KORIANDER-TOPPING",
      menuCategory: "vegan",
      productionDecision: { mode: "scratch" }
    },
    {
      componentId: "quick-lunch-gemuesepfanne",
      label: "ZUCCHINI | PILZE | ZUCKERSCHOTEN | BABY-PAK-CHOI",
      menuCategory: "vegan",
      productionDecision: { mode: "scratch" }
    },
    {
      componentId: "quick-lunch-wildkraeutersalat",
      label: "WILDKRÄUTERSALAT | PETERSILIEN-VINAIGRETTE",
      menuCategory: "vegan",
      productionDecision: { mode: "scratch" }
    },
    {
      componentId: "quick-lunch-brot-baguette",
      label: "BROT & BAGUETTE"
    },
    {
      componentId: "quick-lunch-schokoladenkuchen",
      label: "SCHOKOLADENKUCHEN | vegan",
      menuCategory: "vegan",
      productionDecision: { mode: "scratch" }
    }
  ];
  const focusedSpec: Record<string, unknown> = {
    schemaVersion: 1,
    specId,
    requestId,
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: requestId
      }
    ],
    readiness: options.completeSpec
      ? {
          status: "complete",
          reasons: []
        }
      : {
          status: "insufficient",
          reasons: ["Glutenfrei-Konflikt mit Brot-Baguette und fehlender Ersatzklassifikation."]
        },
    event: {
      type: options.withQuickLunchMixedPlan ? "lunch" : "conference",
      date: options.withQuickLunchMixedPlan ? "2026-03-04" : "2026-07-13"
    },
    servicePlan: {
      eventType: options.withQuickLunchMixedPlan ? "lunch" : "conference",
      serviceForm: "buffet"
    },
    attendees: {
      expected: options.withQuickLunchMixedPlan ? 120 : 36
    },
    menuPlan: options.withQuickLunchMixedPlan
      ? quickLunchMenuPlan
      : [
          {
            componentId: "component-bread-baguette",
            label: "Brot-Baguette",
            menuCategory: "classic",
            productionDecision: {
              mode: "scratch"
            }
          }
        ]
  };
  const searchTargetSpec: Record<string, unknown> = {
    schemaVersion: 1,
    specId: searchSpecId,
    requestId: searchRequestId,
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: searchRequestId
      }
    ],
    readiness: {
      status: "complete",
      reasons: []
    },
    event: {
      type: "Archivsuche Ziel",
      date: "2099-05-26"
    },
    servicePlan: {
      eventType: "Archivsuche Ziel",
      serviceForm: "buffet"
    },
    attendees: {
      expected: 12
    },
    menuPlan: [
      {
        componentId: "component-search-target",
        label: "Test-Baguette"
      }
    ]
  };
  const quickLunchPlan = {
    planId: "plan-quick-lunch-mixed-1",
    eventSpecId: specId,
    readiness: {
      status: "complete",
      reasons: []
    },
    isFallback: false,
    unresolvedItems: [],
    productionBatches: quickLunchMenuPlan
      .filter((component) => component.componentId !== "quick-lunch-brot-baguette")
      .map((component) => ({
        batchId: `batch-${component.componentId}`,
        title: `Rezeptblatt ${component.label}`
      })),
    kitchenSheets: quickLunchMenuPlan.map((component) => ({
      title: component.componentId === "quick-lunch-brot-baguette"
        ? "Bäcker-Zukauf BROT & BAGUETTE"
        : `Küchenblatt ${component.label}`,
      instructions: component.componentId === "quick-lunch-brot-baguette"
        ? ["Baguette und Brot beim Bäcker beschaffen.", "Als Einkaufsposition führen, nicht als Rezeptblatt."]
        : [`120 Portionen vorbereiten: ${component.label}.`]
    })),
    recipeSelections: quickLunchMenuPlan.map((component) =>
      component.componentId === "quick-lunch-brot-baguette"
        ? {
            componentId: component.componentId,
            selectionReason:
              "Brot/Baguette ist als klarer Bäcker-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.",
            autoUsedInternetRecipe: false
          }
        : {
            componentId: component.componentId,
            recipeId: `recipe-${component.componentId}`,
            selectionReason: "Passendes Rezept in der internen Bibliothek gefunden.",
            autoUsedInternetRecipe: false,
            sourceTier: "internal_approved",
            qualityScore: 0.9,
            fitScore: 0.95,
            searchTrace: ["Interner Rezeptanker", "kein Internet-Fallback"]
          }
    )
  };

  if (options.withSubmittedClarificationAnswer) {
    const questions = buildProductionClarificationQuestions({ spec: focusedSpec });
    const [question] = questions;
    focusedSpec.clarificationAnswers = [
      createSubmittedProductionClarificationAnswer({
        questions,
        context: {
          specId,
          productionSessionId: `production-session-${specId}`
        },
        questionId: question.questionId,
        questionKey: {
          reason: question.reason,
          reasonCode: question.reasonCode
        },
        answerType: "shortText",
        answerText: "Glutenfreies Baguette wird separat ersetzt.",
        actorName: "Küche",
        now: "2026-05-22T20:30:00.000Z"
      })
    ];
  }

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/intake/v1/intake/requests")) {
        return new Response(
          JSON.stringify({
            items: archivedRequestIds.has(requestId)
              ? []
              : [
                  {
                    requestId,
                    source: {
                      channel: "manual_form",
                      receivedAt: "2026-04-18T10:30:00.000Z"
                    },
                    rawInputs: [
                      {
                        kind: "form",
                        content:
                          "Konferenz am 2026-07-13 fuer 36 Teilnehmer. Bitte glutenfrei. Buffet mit Brot-Baguette."
                      }
                    ]
                  }
                ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/intake/v1/intake/specs")) {
        return new Response(
          JSON.stringify({
            items: [
              ...(options.withoutSpecs
                ? []
                : options.stalePlanOnly || options.withArchivedProductionContext
                ? [
                    {
                      schemaVersion: 1,
                      specId: previousSpecId,
                      requestId: "request-production-previous-1",
                      sourceLineage: [],
                      readiness: { status: "complete", reasons: [] },
                      event: { type: "meeting", date: "2026-07-12" },
                      servicePlan: { eventType: "meeting", serviceForm: "buffet" },
                      attendees: { expected: 12 },
                      menuPlan: []
                    }
                  ]
                : []),
              ...(options.withoutSpecs || !options.withSearchTargetSpec ? [] : [searchTargetSpec]),
              ...(options.withoutSpecs || archivedSpecIds.has(specId) ? [] : [focusedSpec])
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      const archiveMatch = url.match(/\/api\/intake\/v1\/intake\/requests\/([^/]+)\/archive$/);
      if (archiveMatch) {
        const archivedRequestId = archiveMatch[1];
        const archivedSpecId = requestSpecIds.get(archivedRequestId);

        if (!archivedSpecId) {
          return new Response(JSON.stringify({ message: "Intake request not found" }), {
            status: 404,
            headers: { "content-type": "application/json" }
          });
        }

        if (init?.method !== "POST") {
          return new Response(JSON.stringify({ message: "Method not allowed" }), {
            status: 405,
            headers: { "content-type": "application/json" }
          });
        }

        archivedRequestIds.add(archivedRequestId);
        archivedSpecIds.add(archivedSpecId);

        return new Response(
          JSON.stringify({
            eventRequest: {
              requestId: archivedRequestId,
              operationalArchive: {
                reasonCode: "wrong_upload",
                archivedAt: "2026-05-26T10:00:00.000Z"
              }
            },
            archivedSpecIds: [archivedSpecId],
            hardDeleted: false
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/offers/v1/offers/drafts")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/plans")) {
        return new Response(
          JSON.stringify({
            items: options.withoutPlans
              ? []
              : [
                  ...(archivedSpecIds.has(planSpecId)
                    ? []
                    : [
                        options.withQuickLunchMixedPlan
                          ? quickLunchPlan
                          : {
                              planId: "plan-production-fallback-1",
                              eventSpecId: planSpecId,
                              readiness: options.completeSpec
                                ? {
                                    status: "complete",
                                    reasons: []
                                  }
                                : {
                                    status: "insufficient",
                                    reasons: ["Glutenfrei-Konflikt bleibt ungelöst."]
                                  },
                              isFallback: !options.completeSpec,
                              fallbackReason: options.completeSpec ? undefined : "Glutenfrei-Konflikt bleibt ungelöst.",
                              unresolvedItems: options.completeSpec
                                ? []
                                : ["Glutenfrei-Konflikt bleibt ungelöst.", "Klassifikation für Brot-Baguette fehlt."],
                              productionBatches: [],
                              kitchenSheets: [],
                              recipeSelections: []
                            }
                      ]),
                  ...(options.withArchivedProductionContext
                    ? [
                        {
                          planId: "plan-production-previous-1",
                          eventSpecId: previousSpecId,
                          readiness: {
                            status: "complete",
                            reasons: []
                          },
                          isFallback: false,
                          unresolvedItems: [],
                          productionBatches: [],
                          kitchenSheets: [],
                          recipeSelections: []
                        }
                      ]
                    : []),
                  ...(options.withSecondPlanOnlyArtifact
                    ? [
                        {
                          planId: "plan-production-other-0",
                          eventSpecId: "spec-production-plan-only-other",
                          readiness: {
                            status: "complete",
                            reasons: []
                          },
                          isFallback: false,
                          unresolvedItems: [],
                          productionBatches: [],
                          kitchenSheets: [],
                          recipeSelections: []
                        }
                      ]
                    : [])
                ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return new Response(
          JSON.stringify({
            items: options.withQuickLunchMixedPlan
              ? [
                  {
                    purchaseListId: "purchase-quick-lunch-mixed-1",
                    eventSpecId: specId,
                    totals: { itemCount: 3 },
                    items: [
                      {
                        displayName: "Baguette",
                        purchaseQty: 120,
                        purchaseUnit: "Stück"
                      },
                      {
                        displayName: "Brot",
                        purchaseQty: 120,
                        purchaseUnit: "Stück"
                      },
                      {
                        displayName: "Petersilie",
                        purchaseQty: 2,
                        purchaseUnit: "kg"
                      }
                    ]
                  }
                ]
              : options.withCurrentPurchaseList && !archivedSpecIds.has(purchaseListSpecId)
              ? [
                  {
                    purchaseListId: "purchase-production-current-1",
                    eventSpecId: purchaseListSpecId,
                    totals: { itemCount: 2 },
                    items: [
                      {
                        articleName: "Glutenfreies Baguette",
                        purchaseQty: 4,
                        purchaseUnit: "Stück"
                      },
                      {
                        articleName: "Olivenöl",
                        purchaseQty: 1,
                        purchaseUnit: "l"
                      },
                      ...(options.withInstructionLikeCurrentPurchaseItem
                        ? [
                            {
                              articleName: "Mix veal, breadcrumbs and eggs.",
                              purchaseQty: 16.2,
                              purchaseUnit: "pcs"
                            }
                          ]
                        : [])
                    ]
                  },
                  ...(options.withArchivedProductionContext
                    ? [
                        {
                          purchaseListId: "purchase-production-previous-1",
                          eventSpecId: previousSpecId,
                          totals: { itemCount: 1 },
                          items: [
                            {
                              articleName: "Alte Testposition",
                              purchaseQty: 1,
                              purchaseUnit: "kg"
                            }
                          ]
                        }
                      ]
                    : []),
                  ...(options.withSecondPlanOnlyArtifact
                    ? [
                        {
                          purchaseListId: "purchase-production-other-0",
                          eventSpecId: "spec-production-plan-only-other",
                          totals: { itemCount: 1 },
                          items: [
                            {
                              articleName: "Andere Plan-Only Position",
                              purchaseQty: 1,
                              purchaseUnit: "kg"
                            }
                          ]
                        }
                      ]
                    : [])
                ]
              : []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/production/v1/production/recipes")) {
        return new Response(
          JSON.stringify({
            items: options.withRecipeReviewStates
              ? [
                  {
                    recipeId: "recipe-approved-1",
                    name: "Freigegebenes Baguette",
                    source: { tier: "internal_verified", approvalState: "approved_internal" }
                  },
                  {
                    recipeId: "recipe-review-1",
                    name: "Baguette in Prüfung",
                    source: { tier: "digitized_cookbook", approvalState: "review_required" }
                  },
                  {
                    recipeId: "recipe-rejected-1",
                    name: "Abgelehnte Baguette-Variante",
                    source: { tier: "internet_fallback", approvalState: "rejected" }
                  }
                ]
              : []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.includes("/api/production/v1/production/audit/events")) {
        return new Response(JSON.stringify({
          items: options.withAuditEvent
            ? [
                {
                  auditId: "audit-production-handoff-1",
                  at: "2026-05-21T09:15:00.000Z",
                  action: "production.plan.created",
                  summary: "Produktionsplan erstellt",
                  actor: { name: "Küche" }
                }
              ]
            : []
        }), {
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

      if (url.endsWith(`/api/intake/v1/intake/requests/${requestId}`)) {
        return new Response(
          JSON.stringify({
            requestId,
            source: {
              channel: "manual_form",
              receivedAt: "2026-04-18T10:30:00.000Z"
            },
            rawInputs: [
              {
                kind: "form",
                content:
                  "Konferenz am 2026-07-13 fuer 36 Teilnehmer. Bitte glutenfrei. Buffet mit Brot-Baguette.",
                documentId: "document-production-fallback-1",
                sourceMetadata: {
                  filename: "produktion-angebot.pdf",
                  mimeType: "application/pdf",
                  sizeBytes: 24816,
                  sha256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
                  ingestedAt: "2026-05-21T08:30:00.000Z",
                  uploadContext: "intake"
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith(`/api/intake/v1/intake/requests/${searchRequestId}`)) {
        return new Response(
          JSON.stringify({
            requestId: searchRequestId,
            source: {
              channel: "manual_form",
              receivedAt: "2026-05-26T08:30:00.000Z"
            },
            rawInputs: [
              {
                kind: "form",
                content: "Archivsuche Ziel fuer 12 Teilnehmer. Nur synthetischer UI-Fokustest."
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

async function renderProductionRouteMarkup(): Promise<{ text: string; html: string }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", "/produktion");

  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
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

async function renderProductionRouteInteractive() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", "/produktion");

  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    container,
    root
  };
}

async function flushProductionRouteUpdates(cycles = 8) {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function renderProductionRoute(): Promise<string> {
  return (await renderProductionRouteMarkup()).text;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("backoffice production acceptance smoke", () => {
  it("shows a blocking fallback plan and the linked intake request on the production route", async () => {
    installProductionAcceptanceMocks();

    const rendered = await renderProductionRouteMarkup();
    const content = rendered.text;

    expect(content).toContain("Produktionsagent");
    expect(content).toContain("Produktionsarbeitsstand");
    expect(content).toContain("Produktionsdaten aus der Analyse");
    expect(content).toContain(
      "Rückfragen, Pläne, Einkaufslisten und Exporte erscheinen im aktuellen Vorgang nach Verfügbarkeit."
    );
    expect(content).not.toContain("Plan, Einkaufsliste, Rückfragen und Exporte stehen im aktuellen Vorgang.");
    expect(content).toContain("Anfrageeingang");
    expect(content).toContain("Kundenanfrage übernehmen");
    expect(content).toContain("Maximal 25 MB");
    expect(content).toContain("Der Inhalt wird als Catering-Anfrage erfasst.");
    expect(content).not.toContain("Intake-Pfad");
    expect(content).toContain("Datei auswählen");
    expect(content).toContain("Demo-/Wartungsaktionen");
    expect(content).toContain("Demo-Arbeitsstand zurücksetzen");
    expect(content).toContain("Fehlgeschlagenen Demo-Upload ausblenden");
    expect(content).toContain("Datei hier ablegen");
    expect(content).toContain("Downloadbereich");
    expect(content).toContain("Aktiver Produktionsauftrag");
    expect(rendered.html).toContain('aria-label="Kompakte Produktionszusammenfassung"');
    expect(content).toContain("Interner Arbeitsstand: Produktion, Einkauf, Exporte, Herkunft und offene Punkte bleiben sichtbar.");
    expect(content).toContain("Bitte vor Freigabe prüfen: keine automatische Allergen-, Preis- oder Margenfreigabe.");
    expect(content).toContain("Grenze: nur interne Demo- oder Testdaten; keine externen Kunden und keine Produktionsfreigabe.");
    expect(content).not.toContain("Reviewer-Hinweis");
    expect(content).not.toContain("Option-A-Zeitfenster");
    expect(content).toContain("production-objects-zone");
    expect(content).toContain("Nächster Arbeitsschritt");
    expect(content).toContain("Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.");
    expect(content).toContain("Erkannte Eckdaten");
    expect(rendered.html).toContain('aria-label="Erkannte Produktionsdaten"');
    expect(content).toContain("Veranstaltung");
    expect(content).toContain("Konferenz");
    expect(content).toContain("36 Personen");
    expect(content).toContain("Produktionsplan");
    expect(content).not.toContain("Produktionsplan1");
    expect(content).not.toContain("Einkaufsliste1");
    expect(content).not.toContain("Bestand und SuchePläne");
    expect(content).not.toContain("Sekundäre DetailsÄltere");
    expect(content).not.toContain("Produktionsplan und Einkaufsliste liegen vor.");
    expect(content).not.toContain("Nächster Agent-Schritt");
    expect(content).not.toContain("Produktionsobjekte und Downloads prüfen");
    expect(content).not.toContain("prüfbare Ergebniszonen");
    expect(content).not.toContain("Schritt 3");
    expect(content).toContain("Workbench-Projektion");
    expect(content).toContain("Arbeitsverlauf");
    expect(content).toContain("Aktueller Vorgang");
    expect(content).not.toContain("production-session-");
    expect(content).toContain("Session-Grundlage");
    expect(content).toContain("Strukturierte Veranstaltungsdaten bleiben führend");
    expect(content).toContain("Quellenanker");
    expect(content).toContain("produktion-angebot.pdf · application/pdf · 24.2 KB · sha256:fedcba987654 · intake");
    expect(content).toContain("Produktionsoutput / Downloadanker");
    expect(content).toContain("Vorhandene Produktionspläne, Einkaufslisten und Exportanker bleiben prüfbare Ergebnisobjekte.");
    expect(content).toContain("Klärbereich");
    expect(content).toContain("1 offene Rückfrage");
    expect(content).toContain("Strukturierte Rückfragen im Chatfluss");
    expect(content).toContain("Agent fragt");
    expect(content).toContain("Rückfrage offen");
    expect(content).toContain("Rückfragen beantworten");
    expect(content).toContain("Deine strukturierte Antwort im Chatfluss");
    expect(content).toContain("Antwort direkt zur Agentenfrage");
    expect(content).toContain("kein freier LLM-Chat");
    expect(content).toContain("Status");
    expect(content).toContain("unzureichend");
    expect(content).toContain("Offene Punkte:");
    expect(content).toContain("Glutenfrei-Konflikt bleibt ungelöst.");
    expect(content).toContain("Klassifikation für Brot-Baguette fehlt.");
    expect(content).toContain("Ursprüngliche Intake-Anfrage");
    expect(content).toContain("Intake-Ursprung: manuelle Eingabe · erhalten 2026-04-18T10:30:00.000Z");
    expect(content).not.toContain("requestId: request-production-fallback-1");
    expect(content).toContain("Quellenmetadaten (gekürzt): produktion-angebot.pdf · application/pdf · 24.2 KB · sha256:fedcba987654 · intake");
    expect(content).not.toContain("sha256:fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210");
    expect(content).not.toContain("Konferenz am 2026-07-13 fuer 36 Teilnehmer");
    expect(content).not.toContain("Offene Punkte: keine");
  });

  it("keeps switchable production specs addressable by unique question action labels", async () => {
    installProductionAcceptanceMocks({ withSearchTargetSpec: true });

    const { container, root } = await renderProductionRouteInteractive();

    try {
      const actionLabels = Array.from(
        container.querySelectorAll("button[aria-label^='Rückfragen öffnen:']")
      ).map((button) => button.getAttribute("aria-label"));

      expect(actionLabels).toContain(
        "Rückfragen öffnen: Archivsuche Ziel · 12 Teilnehmer · 2099-05-26 · Klarheit: vollständig"
      );
      expect(actionLabels).toContain(
        "Rückfragen öffnen: Konferenz · 36 Teilnehmer · 2026-07-13 · Klarheit: unzureichend"
      );
      expect(new Set(actionLabels).size).toBe(actionLabels.length);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("clears stale production context after a failed replacement upload while keeping the file retryable", async () => {
    installProductionAcceptanceMocks();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const defaultFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/intake/v1/intake/documents/upload")) {
        return new Response(JSON.stringify({ message: "Upload passt nicht zum Angebot." }), {
          status: 422,
          statusText: "Unprocessable Content",
          headers: { "content-type": "application/json" }
        });
      }

      return await defaultFetch?.(input, init);
    });

    const { container, root } = await renderProductionRouteInteractive();

    try {
      expect(document.body.textContent ?? "").toContain("Intake-Anfrage im Fokus");

      const fileInput = container.querySelector("input[type='file']") as HTMLInputElement | null;
      if (!fileInput) {
        throw new Error("Production upload input not found");
      }

      const wrongFile = new File(["falsches angebot"], "falsches-angebot.txt", { type: "text/plain" });
      Object.defineProperty(fileInput, "files", {
        value: [wrongFile],
        configurable: true
      });

      await act(async () => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await flushProductionRouteUpdates(12);
      });

      const content = document.body.textContent ?? "";
      const archiveButton = Array.from(container.querySelectorAll("button")).find((button) =>
        (button.textContent ?? "").includes("Fehlgeschlagenen Demo-Upload ausblenden")
      ) as HTMLButtonElement | undefined;

      expect(content).toContain("Upload passt nicht zum Angebot.");
      expect(content).toContain("Ausgewählt: falsches-angebot.txt");
      expect(content).toContain("Kein aktiver Vorgang");
      expect(content).toContain("Auftrag einfügen oder Datei ablegen");
      expect(content).not.toContain("requestId: request-production-fallback-1");
      expect(content).not.toContain("Glutenfrei-Konflikt bleibt ungelöst.");
      expect(content).not.toContain("Klassifikation für Brot-Baguette fehlt.");
      expect(content).not.toContain("Produktionsblatt exportieren");
      expect(archiveButton?.disabled).toBe(true);
      expect(archiveButton?.getAttribute("title")).toBe("Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("archives the focused intake context from the production route without hard delete", async () => {
    installProductionAcceptanceMocks({ withCurrentPurchaseList: true });

    const { container, root } = await renderProductionRouteInteractive();
    let mounted = true;

    try {
      expect(document.body.textContent ?? "").toContain("Produktionsblatt exportieren");
      expect(document.body.textContent ?? "").toContain("Einkaufsliste exportieren");

      const archiveButton = Array.from(container.querySelectorAll("button")).find((button) =>
        (button.textContent ?? "").includes("Fehlgeschlagenen Demo-Upload ausblenden")
      ) as HTMLButtonElement | undefined;

      expect(archiveButton).toBeTruthy();
      expect(archiveButton?.disabled).toBe(false);
      expect(archiveButton?.textContent).toContain(
        "Fehlgeschlagenen Demo-Upload ausblenden für Intake-Anfrage im Fokus"
      );
      expect(archiveButton?.getAttribute("title")).toBe(
        "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage im Fokus"
      );

      await act(async () => {
        archiveButton?.click();
        await flushProductionRouteUpdates();
      });

      const content = document.body.textContent ?? "";
      const fetchMock = vi.mocked(fetch);
      const archiveCall = fetchMock.mock.calls.find(([input]) =>
        String(input).endsWith("/api/intake/v1/intake/requests/request-production-fallback-1/archive")
      );

      expect(archiveCall).toBeTruthy();
      expect(archiveCall?.[1]).toMatchObject({
        method: "POST",
        body: JSON.stringify({ reasonCode: "wrong_upload" })
      });
      expect(content).toContain(
        "Fehlupload request-production-fallback-1 wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
      );
      expect(content).toContain("Kein aktiver Vorgang");
      expect(content).toContain("Rückfragen: keine offenen Rückfragen");
      expect(content).toContain("Rückfragenstatus: offen 0 · beantwortet 0");
      expect(content).toContain("Auftrag einfügen oder Datei ablegen");
      expect(content).not.toContain("requestId: request-production-fallback-1");
      expect(content).not.toContain("Rückfragen: 1 offene Rückfrage");
      expect(content).not.toContain("Glutenfrei-Konflikt bleibt ungelöst.");
      expect(content).not.toContain("Klassifikation für Brot-Baguette fehlt.");
      expect(content).not.toContain("Produktionsblatt exportieren");
      expect(content).not.toContain("Einkaufsliste exportieren");
      expect(content).not.toContain("Löschen");

      await act(async () => {
        root.unmount();
      });
      container.remove();
      mounted = false;

      const freshContent = await renderProductionRoute();
      expect(freshContent).toContain("Noch kein aktiver Vorgang");
      expect(freshContent).not.toContain("requestId: request-production-fallback-1");
      expect(freshContent).not.toContain("Glutenfrei-Konflikt bleibt ungelöst.");
      expect(freshContent).not.toContain("Klassifikation für Brot-Baguette fehlt.");
      expect(freshContent).not.toContain("Produktionsblatt exportieren");
      expect(freshContent).not.toContain("Einkaufsliste exportieren");
    } finally {
      if (mounted) {
        await act(async () => {
          root.unmount();
        });
        container.remove();
      }
    }
  });

  it("clears the active production workspace without leaving result artifacts as current context", async () => {
    installProductionAcceptanceMocks({ withCurrentPurchaseList: true });

    const { container, root } = await renderProductionRouteInteractive();

    try {
      const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
        (button.textContent ?? "").includes("Demo-Arbeitsstand zurücksetzen")
      ) as HTMLButtonElement | undefined;

      expect(clearButton).toBeTruthy();
      expect(clearButton?.disabled).toBe(false);
      expect(clearButton?.textContent).toContain("Demo-Arbeitsstand zurücksetzen für Konferenz · 36 Teilnehmer · 2026-07-13");
      expect(clearButton?.getAttribute("title")).toBe(
        "Lokalen Arbeitsbereich leeren: Konferenz · 36 Teilnehmer · 2026-07-13"
      );
      expect(document.body.textContent ?? "").toContain("Intake-Anfrage im Fokus");
      expect(document.body.textContent ?? "").toContain("Plan-Kontext: aktueller Produktionsplan");
      expect(document.body.textContent ?? "").toContain("Aktueller Vorgang");
      expect(document.body.textContent ?? "").toContain("Produktionsblatt exportieren");
      expect(document.body.textContent ?? "").toContain("Einkaufsliste exportieren");
      expect(container.innerHTML).toContain(
        "/api/exports/v1/exports/production-plans/plan-production-fallback-1/html"
      );
      expect(container.innerHTML).toContain(
        "/api/exports/v1/exports/purchase-lists/purchase-production-current-1/csv"
      );

      await act(async () => {
        clearButton?.click();
        await flushProductionRouteUpdates();
      });

      const content = document.body.textContent ?? "";

      expect(content).toContain("Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert.");
      expect(content).toContain("Kein aktiver Vorgang");
      expect(content).toContain("Auftrag einfügen oder Datei ablegen");
      expect(content).not.toContain("requestId: request-production-fallback-1");
      expect(content).not.toContain("Plan-Kontext: aktueller Produktionsplan");
      expect(content).not.toContain("purchase-production-current-1");
      expect(content).not.toContain("Glutenfrei-Konflikt bleibt ungelöst.");
      expect(content).not.toContain("Klassifikation für Brot-Baguette fehlt.");
      expect(content).not.toContain("Produktionsblatt exportieren");
      expect(content).not.toContain("Einkaufsliste exportieren");
      expect(container.innerHTML).not.toContain(
        "/api/exports/v1/exports/production-plans/plan-production-fallback-1/html"
      );
      expect(container.innerHTML).not.toContain(
        "/api/exports/v1/exports/purchase-lists/purchase-production-current-1/csv"
      );

      const clearedClearButton = Array.from(container.querySelectorAll("button")).find((button) =>
        (button.textContent ?? "").includes("Demo-Arbeitsstand zurücksetzen")
      ) as HTMLButtonElement | undefined;
      const clearedArchiveButton = Array.from(container.querySelectorAll("button")).find((button) =>
        (button.textContent ?? "").includes("Fehlgeschlagenen Demo-Upload ausblenden")
      ) as HTMLButtonElement | undefined;

      expect(clearedClearButton).toBeTruthy();
      expect(clearedClearButton?.disabled).toBe(true);
      expect(clearedClearButton?.getAttribute("title")).toBe(
        "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren."
      );
      expect(clearedArchiveButton).toBeTruthy();
      expect(clearedArchiveButton?.disabled).toBe(true);
      expect(clearedArchiveButton?.getAttribute("title")).toBe(
        "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
      );
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("archives the narrowed search result instead of the previous active production context", async () => {
    installProductionAcceptanceMocks({ withSearchTargetSpec: true });

    const { container, root } = await renderProductionRouteInteractive();

    try {
      const currentSpecItem = Array.from(container.querySelectorAll("li")).find((item) =>
        (item.textContent ?? "").includes("Konferenz · 36 Teilnehmer · 2026-07-13")
      );
      const currentSpecButton = currentSpecItem?.querySelector("button") as HTMLButtonElement | undefined;

      expect(currentSpecButton).toBeTruthy();

      await act(async () => {
        currentSpecButton?.click();
        await flushProductionRouteUpdates();
      });

      expect(document.body.textContent ?? "").toContain("Intake-Anfrage im Fokus");

      const filterDetails = container.querySelector(".production-filter-details") as HTMLDetailsElement | null;
      if (filterDetails) {
        filterDetails.open = true;
      }
      const searchInput = container.querySelector(
        "input[placeholder='Plan, Einkaufsliste oder Rezept suchen']"
      ) as HTMLInputElement | null;

      expect(searchInput).toBeTruthy();

      await act(async () => {
        setNativeValue(searchInput!, "Archivsuche Ziel");
        await flushProductionRouteUpdates();
      });

      const content = document.body.textContent ?? "";
      expect(content).toContain("Archivsuche Ziel · 12 Teilnehmer · 2099-05-26");
      expect(content).toContain("Intake-Ursprung: manuelle Eingabe · erhalten 2026-05-26T08:30:00.000Z");
      expect(content).not.toContain("requestId: request-production-search-target-1");
      expect(content).not.toContain("requestId: request-production-fallback-1");

      const archiveButton = Array.from(container.querySelectorAll("button")).find((button) =>
        (button.textContent ?? "").includes("Fehlgeschlagenen Demo-Upload ausblenden")
      ) as HTMLButtonElement | undefined;

      expect(archiveButton).toBeTruthy();
      expect(archiveButton?.disabled).toBe(false);
      expect(archiveButton?.textContent).toContain(
        "Fehlgeschlagenen Demo-Upload ausblenden für Intake-Anfrage im Fokus"
      );
      expect(archiveButton?.getAttribute("title")).toBe(
        "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage im Fokus"
      );

      await act(async () => {
        archiveButton?.click();
        await flushProductionRouteUpdates();
      });

      const fetchMock = vi.mocked(fetch);
      const archiveCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/api/intake/v1/intake/requests/")
      );
      const searchTargetArchiveCall = archiveCalls.find(([input]) =>
        String(input).endsWith("/api/intake/v1/intake/requests/request-production-search-target-1/archive")
      );
      const fallbackArchiveCall = archiveCalls.find(([input]) =>
        String(input).endsWith("/api/intake/v1/intake/requests/request-production-fallback-1/archive")
      );
      const archivedContent = document.body.textContent ?? "";

      expect(searchTargetArchiveCall).toBeTruthy();
      expect(searchTargetArchiveCall?.[1]).toMatchObject({
        method: "POST",
        body: JSON.stringify({ reasonCode: "wrong_upload" })
      });
      expect(fallbackArchiveCall).toBeUndefined();
      expect(archivedContent).toContain(
        "Fehlupload request-production-search-target-1 wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
      );
      expect(archivedContent).toContain("Kein aktiver Vorgang");
      expect(archivedContent).not.toContain("requestId: request-production-search-target-1");
      expect(archivedContent).not.toContain("requestId: request-production-fallback-1");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("does not offer reopening answers while the focused answer editor is already open", async () => {
    installProductionAcceptanceMocks();

    const route = await renderProductionRouteMarkup();

    expect(route.text).toContain("Antwort direkt zur Agentenfrage");
    expect(route.text).toContain("Antworten speichern");
    expect(route.html).toMatch(/<button[^>]*disabled=""[^>]*>\s*Antworten bearbeiten\s*<\/button>/);
    expect(route.html).toMatch(/<button[^>]*disabled=""[^>]*>\s*Antworten speichern\s*<\/button>/);
  });

  it("shows handoff provenance without claiming legal audit certainty", async () => {
    installProductionAcceptanceMocks({ withCurrentPurchaseList: true, withAuditEvent: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Herkunft und Übergabe");
    expect(content).toContain("Intake-Ursprung");
    expect(content).toContain("manuelle Eingabe · 2026-04-18T10:30:00.000Z · Intake-Anfrage verknüpft");
    expect(content).toContain("Audit-Spur");
    expect(content).toContain("Produktionsplan erstellt · Küche · production.plan.created · 2026-05-21T09:15:00.000Z");
    expect(content).toContain("Übergabe-/Exportartefakte");
    expect(content).toContain("Produktionsblatt vorhanden · Einkaufsliste vorhanden");
    expect(content).toContain("Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.");
    expect(content).toContain("Fehlende Artefakte bleiben offen markiert; keine externe Freigabe, Signatur- oder Compliance-Behauptung.");
    expect(content).toContain("Keine rechtssichere Audit-Behauptung");
    expect(content).not.toContain("Konferenz am 2026-07-13 fuer 36 Teilnehmer");
    expect(content).not.toContain("sha256:fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210");
  });

  it("does not surface a previous plan as current results for a newly focused production spec", async () => {
    installProductionAcceptanceMocks({ stalePlanOnly: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Aktueller Vorgang");
    expect(content).toContain("Noch keine Produktionspläne vorhanden.");
    expect(content).toContain("Einkauf: offen");
    expect(content).not.toContain("Klassifikation für Brot-Baguette fehlt.");
    expect(content).not.toContain("Produktionsblatt exportieren");
  });

  it("labels loaded production plans honestly when no spec is focused yet", async () => {
    installProductionAcceptanceMocks({ withoutSpecs: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Aktiver Produktionsauftrag");
    expect(content).toContain("Produktionsplan aus gespeicherter Spezifikation");
    expect(content).toContain("Status: Prüfung nötig");
    expect(content).toContain("Freigabe: nicht erteilt.");
    expect(content).toContain("Technische Details");
    expect(content).toContain("Plan plan-production-fallback-1 · Spezifikation spec-production-fallback-1");
    expect(content).not.toContain("Plan-Kontext geladen: plan-production-fallback-1 · Spezifikation: spec-production-fallback-1");
    expect(content).toContain("Einzelheiten zu diesem Produktionsplan");
    expect(content).toContain("Produktionsblatt exportieren für diesen Produktionsplan");
    expect(content).not.toContain("Noch kein aktiver Vorgang");
  });

  it("surfaces plan-only production artifacts instead of focusing an unrelated accepted spec", async () => {
    installProductionAcceptanceMocks({ withCurrentPurchaseList: true, withPlanOnlyArtifacts: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsplan aus gespeicherter Spezifikation");
    expect(content).toContain("Plan plan-production-fallback-1 · Spezifikation spec-production-plan-only-1");
    expect(content).not.toContain("Plan-Kontext geladen: plan-production-fallback-1 · Spezifikation: spec-production-plan-only-1");
    expect(content).toContain("Einzelheiten zu diesem Produktionsplan");
    expect(content).toContain("Produktionsarbeit prüfen");
    expect(content).toContain("Produktionsblatt exportieren für diesen Produktionsplan");
    expect(content).toContain("Einkaufsliste exportieren");
    expect(content).toContain("Produktionsblatt vorhanden · Einkaufsliste vorhanden");
    expect(content).not.toContain("Rückfragen beantworten");
    expect(content).not.toContain("requestId: request-production-fallback-1");
  });

  it("keeps plan-centered purchase lists scoped to the visible plan context", async () => {
    installProductionAcceptanceMocks({
      withCurrentPurchaseList: true,
      withPlanOnlyArtifacts: true,
      withSecondPlanOnlyArtifact: true
    });

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsplan aus gespeicherter Spezifikation");
    expect(content).toContain("Technische Details");
    expect(content).toContain("Plan plan-production-fallback-1 · Spezifikation spec-production-plan-only-1");
    expect(content).not.toContain("Plan-Kontext geladen: plan-production-fallback-1 · Spezifikation: spec-production-plan-only-1");
    expect(content).toContain("1 Liste · 2 Positionen");
    expect(content).toContain("Aktueller Vorgang");
    expect(content).toContain("Einkaufsliste exportieren für aktuellen Vorgang");
    expect(content).toContain("Einkaufsliste exportieren aus älterem Vorgang");
    expect(content).toContain("Ältere Einkaufslisten");
    expect(content).toContain("1 frühere Listen");
    expect(content).not.toContain("2 Listen · 3 Positionen");
  });

  it("keeps the clear action inactive when no upload or production context exists", async () => {
    installProductionAcceptanceMocks({ withoutSpecs: true, withoutPlans: true });

    const route = await renderProductionRouteMarkup();

    expect(route.text).toContain("Demo-Arbeitsstand zurücksetzen");
    expect(route.text).toContain("Fehlgeschlagenen Demo-Upload ausblenden");
    expect(route.text).toContain("Rückfragen: keine offenen Rückfragen");
    expect(route.text).toContain("Rückfragenstatus: offen 0 · beantwortet 0");
    expect(route.html).toContain("Demo-Arbeitsstand zurücksetzen");
    expect(route.html).toMatch(/<button[^>]+disabled=""[^>]*>\s*Demo-Arbeitsstand zurücksetzen/);
    expect(route.html).toMatch(/<button[^>]+disabled=""[^>]*>\s*Fehlgeschlagenen Demo-Upload ausblenden/);
    expect(route.text).not.toContain("Löschen");
  });

  it("keeps purchase lists reachable through a quiet progressive workbench zone", async () => {
    installProductionAcceptanceMocks({ withCurrentPurchaseList: true });

    const content = await renderProductionRoute();

    expect(content).toContain("production-purchase-zone");
    expect(content).toContain("Einkaufsliste");
    expect(content).toContain(
      "Die sichtbare Liste gehört zum aktuellen Vorgang; ältere Einkaufslisten bleiben getrennt darunter."
    );
    expect(content).toContain("1 Liste · 2 Positionen");
    expect(content).toContain("Aktueller Vorgang");
    expect(content).toContain("Einkaufsliste exportieren für aktuellen Vorgang");
    expect(content).toContain("Glutenfreies Baguette");
    expect(content).toContain("Olivenöl");
    expect(content).not.toContain("Aktueller Vorgang zuerst");
  });

  it("flags current purchase lists that look polluted by recipe instructions", async () => {
    installProductionAcceptanceMocks({
      withCurrentPurchaseList: true,
      withInstructionLikeCurrentPurchaseItem: true
    });

    const content = await renderProductionRoute();

    expect(content).toContain("Prüfhinweis: 1 mögliche Rezept-Arbeitsschritte als Einkaufspositionen erkannt.");
    expect(content).toContain(
      "Für das Rehearsal als lokalen Stale-Datenbefund markieren; Beispiele: Mix veal, breadcrumbs and eggs."
    );
    expect(content).toContain("Aktueller Vorgang");
  });

  it("marks older production objects and purchase lists as non-current context", async () => {
    installProductionAcceptanceMocks({
      completeSpec: true,
      withCurrentPurchaseList: true,
      withArchivedProductionContext: true
    });

    const content = await renderProductionRoute();

    expect(content).toContain(
      "Hier erscheinen die Ergebnisse für den aktuell ausgewählten Vorgang. Ältere geladene Läufe bleiben eingeklappt getrennt und sind kein aktueller Vorgang."
    );
    expect(content).toContain("Nur bei Bedarf aufklappen; ältere Läufe sind nicht der aktuelle Vorgang.");
    expect(content).toContain("Ältere Produktionsläufe");
    expect(content).toContain("Einzelheiten zu diesem Produktionsplan");
    expect(content).toContain(
      "Diese früheren Produktionsläufe sind Kontext aus anderen Vorgängen, nicht das aktuelle Ergebnis."
    );
    expect(content).toContain("Ältere Einkaufslisten");
    expect(content).toContain("Nur bei Bedarf aufklappen; ältere Listen sind kein aktueller Vorgang.");
    expect(content).toContain("Ältere Einkaufsliste aus anderem Vorgang - nicht aktueller Vorgang.");
    expect(content).toContain("Aktueller Vorgang");
  });

  it("shows the next step to calculate a production plan when the spec is clear but no plan exists", async () => {
    installProductionAcceptanceMocks({ completeSpec: true, withoutPlans: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsplan berechnen");
    expect(content).toContain("Aus der Spezifikation kann jetzt ein Produktionsplan mit Einkaufsliste vorbereitet werden.");
    expect(content).toContain("Noch kein Produktionsplan für den aktuellen Vorgang. Nächster Schritt: Berechnung starten.");
    expect(content).toContain("Noch keine Einkaufsliste für den aktuellen Vorgang. Sie entsteht mit dem Produktionsplan.");
    expect(content).toContain("Exportlinks erscheinen erst, wenn Produktionsplan und Einkaufsliste vorhanden sind.");
    expect(content).not.toContain("Produktionsarbeit prüfen");
    expect(content).not.toContain("Produktionsplan, Einkaufsliste und Exporte liegen bereit. Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen.");
    expect(content).not.toContain("Produktionsblatt exportieren");
    expect(content).not.toContain("Einkaufsliste exportieren");
    expect(content).not.toContain("Produktionsblatt vorhanden · Einkaufsliste vorhanden");
  });

  it("shows the purchase-list gap when a production plan exists but the purchase list is still missing", async () => {
    installProductionAcceptanceMocks({ completeSpec: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsplan");
    expect(content).toContain("Produktionsblatt exportieren");
    expect(content).toContain("Produktionsblatt vorhanden · Einkaufsliste offen");
    expect(content).toContain("Einkaufsliste noch offen");
    expect(content).toContain("Produktionsplan ist vorhanden; Einkaufsliste und Einkaufslisten-Export fehlen noch.");
    expect(content).toContain("Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.");
    expect(content).toContain("Noch keine Einkaufsliste für den aktuellen Vorgang. Sie entsteht mit dem Produktionsplan.");
    expect(content).not.toContain("Produktionsplan, Einkaufsliste und Exporte liegen bereit.");
    expect(content).not.toContain("Produktionsplan und Einkaufsliste liegen vor.");
  });

  it("shows the next step to inspect downloads when production objects already exist", async () => {
    installProductionAcceptanceMocks({ completeSpec: true, withCurrentPurchaseList: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsarbeit prüfen");
    expect(content).toContain("Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen.");
    expect(content).toContain("Exportlinks prüfen; Freigabe offen");
    expect(content).not.toContain("Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.");
    expect(content).toContain("Produktionsergebnis: 1 Plan · vollständig, Freigabe offen");
  });

  it("shows a synthetic Quick Lunch plan with internal recipe hits and baker purchase as one current result", async () => {
    installProductionAcceptanceMocks({ completeSpec: true, withQuickLunchMixedPlan: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsarbeit prüfen");
    expect(content).toContain("Plan-Kontext: aktueller Produktionsplan");
    expect(content).toContain("Status: vollständig · Serviceform: Buffet · Arbeitsblätter: 9 · Rezeptblätter: 8 · Rezeptauswahl: 9");
    expect(content).toContain("Offene Punkte: keine");
    expect(content).toContain("KALBSBULETTEN | SCHMORZWIEBELN");
    expect(content).toContain("KARTOFFELSALAT | DE LUX");
    expect(content).toContain("NUDELSALAT | FRISCHGEDÖNS");
    expect(content).toContain("BROT & BAGUETTE");
    expect(content).toContain("Passendes Rezept in der internen Bibliothek gefunden.");
    expect(content).toContain("Brot/Baguette ist als klarer Bäcker-Zukauf markiert");
    expect(content).toContain("Bäcker-Zukauf BROT & BAGUETTE");
    expect(content).toContain("Aktueller Vorgang");
    expect(content).toContain("Baguette");
    expect(content).toContain("Menge: 120");
    expect(content).toContain("Einkaufsliste exportieren");
    expect(content).toContain("Rückfragenstatus: offen 0 · beantwortet 0");
    expect(content).toContain("kein Internet-Fallback");
    expect(content).not.toContain("BROT & BAGUETTE: Herstellungsentscheidung fehlt");
    expect(content).not.toContain("BROT & BAGUETTE: Kategorie fehlt");
    expect(content).not.toContain("Einkaufsliste noch offen");
  });

  it("anchors the production export and audit closure to the same visible plan and purchase context", async () => {
    installProductionAcceptanceMocks({ completeSpec: true, withCurrentPurchaseList: true, withAuditEvent: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Plan-Kontext: aktueller Produktionsplan");
    expect(content).toContain("Aktueller Vorgang");
    expect(content).toContain("Produktionsblatt exportieren für aktuellen Produktionsplan");
    expect(content).toContain("Einkaufsliste exportieren für aktuellen Vorgang");
    expect(content).toContain("Audit-Spur");
    expect(content).toContain("Produktionsplan erstellt · Küche · production.plan.created · 2026-05-21T09:15:00.000Z");
    expect(content).toContain(
      "Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste vorhanden"
    );
    expect(content).toContain("Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.");
    expect(content).toContain("keine externe Freigabe, Signatur- oder Compliance-Behauptung");
    expect(content).toContain("Keine rechtssichere Audit-Behauptung");
  });

  it("shows answered clarification questions as read-only status anchors", async () => {
    installProductionAcceptanceMocks({ withSubmittedClarificationAnswer: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Rückfragenstatus: offen 0 · beantwortet 1");
    expect(content).toContain("Rückfrage beantwortet");
    expect(content).toContain("Antwort auf Rückfrage");
    expect(content).toContain("Glutenfreies Baguette wird separat ersetzt.");
    expect(content).not.toContain("Rückfragenstatus: offen 1 · beantwortet 0");
  });

  it("keeps the compact clarification status aligned with the visible open question count", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          ProductionConversationalWorkbench,
          {
            summary: {
              activeSpecLabel: "internes Probe-Catering · 42 Teilnehmer · 2099-10-15",
              readinessLabel: "vollständig",
              planStatusLabel: "offen",
              purchaseStatusLabel: "noch keine Liste",
              questionCount: 7,
              answeredQuestionCount: 0,
              unansweredQuestionCount: 1,
              productionObjectCount: 0,
              productionObjectStatusLabel: "noch kein Plan",
              purchaseListCount: 0
            },
            nextStep: {
              title: "Rückfragen klären",
              description: "Offene Rückfragen prüfen."
            },
            miniPilotRawResult: "",
            setMiniPilotRawResult: () => undefined,
            miniPilotReportState: {
              statusLabel: "noch kein Ergebnis",
              reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
              nextStepLabel:
                "Check lokal ausfuehren, JSON einfuellen und dann erst mit dem Draft weiterarbeiten.",
              commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
              errorLabels: []
            },
            slots: {
              inputSlot: createElement("div", { className: "production-column production-column--input" }, "input"),
              questionsSlot: createElement(
                "div",
                { className: "production-column production-column--questions" },
                "fragen"
              ),
              productionObjectsSlot: createElement(
                "div",
                { className: "production-column production-column--objects" },
                "objekte"
              ),
              purchaseListSlot: createElement(
                "div",
                { className: "production-column production-column--purchase" },
                "einkauf"
              ),
              lowerSlots: createElement(
                "div",
                { className: "production-column production-column--handoff" },
                "unten"
              )
            }
          }
        )
      );
    });

    const content = document.body.textContent ?? "";

    expect(content).toContain("Rückfragen: 7 offene Rückfragen");
    expect(content).toContain("Rückfragenstatus: offen 7 · beantwortet 0");
    expect(content).toContain("offen 7 · beantwortet 0");
    expect(content).toContain("Arbeitsstruktur der Produktion");
    expect(content).toContain("Verständnis des Angebots");
    expect(content).toContain("Rückfragen");
    expect(content).toContain("Annahmen & Festlegungen");
    expect(content).toContain("Kalkulationsübersicht");
    expect(content).toContain("Mengenkalkulation je Gericht");
    expect(content).toContain("Rezeptkarten");
    expect(content).toContain("Metro-Einkaufsliste");
    expect(content).toContain("Mise-en-Place");
    expect(content).toContain("Abschlussprüfung & Exporte");
    expect(content).toContain("7 Rückfragen sichtbar");
    expect(content).toContain("noch nicht berechnet");
    expect(content).toContain("Freigabe: nicht erteilt.");
    expect(content).not.toContain("Rückfragenstatus: offen 1 · beantwortet 0");
    expect(document.querySelector(".production-input-zone .production-column--input")?.textContent).toContain("input");
    expect(document.querySelector(".production-input-collapse summary")?.textContent).toContain("Neue Eingabe oder Korrektur");
    expect(document.querySelector(".production-input-collapse summary")?.textContent).not.toContain(
      "AnfrageeingangNeue Eingabe"
    );
    expect(document.querySelector(".production-objects-panel summary")?.textContent).not.toContain("Produktionsplannoch");
    expect(document.querySelector(".production-purchase-panel summary")?.textContent).toContain(
      "Einkaufsliste noch keine Liste"
    );
    expect(document.querySelector(".production-purchase-panel summary")?.textContent).not.toContain(
      "Einkaufslistenoch"
    );
    expect(document.querySelector(".production-progressive-zone summary")?.textContent).not.toContain(
      "Rückfragen und Antwortenoffen"
    );
    expect(document.querySelector(".production-progressive-zone .production-column--questions")?.textContent).toContain("fragen");
    expect(document.querySelector(".production-objects-zone .production-column--objects")?.textContent).toContain("objekte");
    expect(document.querySelector(".production-purchase-zone .production-column--purchase")?.textContent).toContain("einkauf");
    expect(document.querySelector(".production-lower-zones .production-column--handoff")?.textContent).toContain("unten");

    await act(async () => {
      root.unmount();
    });
  });

  it("moves focus to the production results when analysis creates visible work", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });

    const renderWorkbench = (productionObjectCount: number) =>
      createElement(
        ProductionConversationalWorkbench,
        {
          summary: {
            activeSpecLabel:
              productionObjectCount > 0 ? "Business Lunch · 42 Teilnehmer" : "Noch kein aktiver Vorgang",
            readinessLabel: productionObjectCount > 0 ? "vollständig" : "-",
            planStatusLabel: productionObjectCount > 0 ? "vollständig" : "offen",
            purchaseStatusLabel: productionObjectCount > 0 ? "1 Liste · 1 Positionen" : "noch keine Liste",
            questionCount: 0,
            answeredQuestionCount: 0,
            unansweredQuestionCount: 0,
            productionObjectCount,
            productionObjectStatusLabel: productionObjectCount > 0 ? "1 Plan · vollständig" : "noch kein Plan",
            purchaseListCount: productionObjectCount > 0 ? 1 : 0
          },
          nextStep: {
            title: productionObjectCount > 0 ? "Produktionsarbeit prüfen" : "Auftrag einfügen oder Datei ablegen",
            description:
              productionObjectCount > 0
                ? "Produktionsplan und Einkaufsliste liegen vor."
                : "Starte mit Angebot, E-Mail, Text oder manuellen Veranstaltungsdaten."
          },
          miniPilotRawResult: "",
          setMiniPilotRawResult: () => undefined,
          miniPilotReportState: {
            statusLabel: "noch kein Ergebnis",
            reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
            nextStepLabel:
              "Check lokal ausfuehren, JSON einfuellen und dann erst mit dem Draft weiterarbeiten.",
            commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
            errorLabels: []
          },
          slots: {
            inputSlot: createElement("div", { className: "production-column production-column--input" }, "input"),
            questionsSlot: createElement("div", null),
            productionObjectsSlot: createElement(
              "div",
              { className: "production-column production-column--objects" },
              "objekte"
            ),
            purchaseListSlot: createElement("div", null),
            lowerSlots: createElement("div", null)
          }
        }
      );

    try {
      await act(async () => {
        root.render(renderWorkbench(0));
      });

      const initialResults = document.querySelector<HTMLElement>('[aria-label="Aktuelle Produktionsergebnisse"]');
      expect(initialResults).not.toBeNull();
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(document.activeElement).not.toBe(initialResults);

      await act(async () => {
        root.render(renderWorkbench(1));
      });

      const focusedResults = document.querySelector<HTMLElement>('[aria-label="Aktuelle Produktionsergebnisse"]');
      expect(focusedResults).not.toBeNull();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
      expect(document.activeElement).toBe(focusedResults);
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          value: originalScrollIntoView
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("does not claim an existing production plan while the summary is loading", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          ProductionConversationalWorkbench,
          {
            summary: {
              activeSpecLabel: "Produktionsdaten werden geladen; noch kein Vorgang bewertet.",
              readinessLabel: "wird geladen",
              planStatusLabel: "wird geladen",
              purchaseStatusLabel: "Einkaufslisten werden geladen",
              questionCount: 0,
              answeredQuestionCount: 0,
              unansweredQuestionCount: 0,
              productionObjectCount: 0,
              productionObjectStatusLabel: "Produktionspläne werden geladen",
              purchaseListCount: 0
            },
            nextStep: {
              title: "Produktionsdaten laden",
              description: "Bestehende Vorgänge, Pläne, Einkaufslisten und Rückfragen werden gerade geladen."
            },
            miniPilotRawResult: "",
            setMiniPilotRawResult: () => undefined,
            miniPilotReportState: {
              statusLabel: "noch kein Ergebnis",
              reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
              nextStepLabel:
                "Check lokal ausfuehren, JSON einfuellen und dann erst mit dem Draft weiterarbeiten.",
              commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
              errorLabels: []
            },
            slots: {
              inputSlot: createElement("div", { className: "production-column production-column--input" }, "input"),
              questionsSlot: createElement("div", null),
              productionObjectsSlot: createElement("div", null),
              purchaseListSlot: createElement("div", null),
              lowerSlots: createElement("div", null)
            }
          }
        )
      );
    });

    const content = document.body.textContent ?? "";

    expect(content).toContain("Aktiver Produktionsauftrag");
    expect(content).toContain("Plan: wird geladen · Einkaufsliste: Einkaufslisten werden geladen");
    expect(content).toContain("Freigabe: nicht erteilt.");
    expect(content).not.toContain("Plan: vorhanden, wird geladen");
    expect(document.querySelector(".production-composer .production-column--input")?.textContent).toContain("input");
    expect(document.querySelector(".production-input-zone")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps recipe review and library states visible on the production route", async () => {
    installProductionAcceptanceMocks({ withRecipeReviewStates: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Rezeptprüfung");
    expect(content).toContain("1 zu prüfen");
    expect(content).toContain("Freigegebene Rezepte bleiben verwendbar");
    expect(content).toContain("1 abgelehnt · 3 Rezepte insgesamt · Review-Actions bleiben in der");
    expect(content).toContain("Rezeptbibliothek");
    expect(content).toContain("Rezepte verwalten");
    expect(content).toContain("3 Rezepte · 1 freigegeben · 1 Prüfung nötig");
    expect(content).toContain("Freigegebenes Baguette");
    expect(content).toContain("intern verifiziert · intern freigegeben");
    expect(content).toContain("Baguette in Prüfung");
    expect(content).toContain("digitalisiertes Kochbuch · Prüfung nötig");
    expect(content).toContain("Abgelehnte Baguette-Variante");
    expect(content).toContain("Internet-Ausweichquelle · abgelehnt");
    expect(content).toContain("Freigeben");
    expect(content).toContain("Verifizieren");
    expect(content).toContain("Ablehnen");
  });
});
