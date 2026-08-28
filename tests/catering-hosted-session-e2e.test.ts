import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import type { OutgoingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  activateCateringSessionRequests,
  deactivateCateringSessionRequests,
  resolveCateringSession
} from "../backoffice-ui/src/session-api.js";
import { loadProductionRouteAccessData } from "../backoffice-ui/src/api.js";
import { buildIntakeApp, IntakeStore } from "../intake-service/src/index.js";
import { buildOfferApp } from "../offer-service/src/index.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import {
  buildProductionApp,
  ProductionStore,
  type ProductionFeedbackDraft
} from "../production-service/src/index.js";
import {
  CATERING_SESSION_COOKIE,
  CateringUserStore,
  RecipeLibrary,
  SCHEMA_VERSION,
  createCateringUserRecord,
  hashCateringPin,
  type AcceptedEventSpec,
  type MinimalMvpRole,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "../shared-core/src/index.js";

const businessContext = { businessId: "the-one" } as const;
const rootSecret = "catering-hosted-e2e-root-secret-20260828-strong";
const commercialSentinel = "HOSTED_COMMERCIAL_SENTINEL_9876_54";
const operationalSentinel = "Operatives Hosted-Kontrollgericht";
const renderedCommercialSentinels = [
  "8.192,44 EUR",
  "913,57 EUR",
  "7.314,29 EUR"
] as const;
const sessionEnv = {
  CATERING_DEFAULT_BUSINESS_ID: businessContext.businessId,
  CATERING_TRUSTED_ACTOR_SECRET: rootSecret,
  CATERING_DEV_AUTH: "0"
};

interface SessionUserFixture {
  userId: string;
  loginCode: string;
  displayName: string;
  pin: string;
  role: MinimalMvpRole;
}

const users = {
  admin: {
    userId: "hosted-e2e-admin-user",
    loginCode: "hosted-admin",
    displayName: "Hosted Admin",
    pin: "482731",
    role: "admin"
  },
  production: {
    userId: "hosted-e2e-production-user",
    loginCode: "hosted-production",
    displayName: "Hosted Produktion",
    pin: "592731",
    role: "production_operator"
  },
  readOnly: {
    userId: "hosted-e2e-read-only-user",
    loginCode: "hosted-reader",
    displayName: "Hosted Nur-Lese",
    pin: "692731",
    role: "read_only_operator"
  }
} satisfies Record<string, SessionUserFixture>;

function commercialSpec(): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-hosted-session-e2e",
    lifecycle: { commercialState: "accepted" },
    readiness: { status: "complete", reasons: [] },
    sourceLineage: [{ sourceType: "manual_input", reference: "hosted-session-e2e" }],
    customer: { name: "Pseudonymisierte Hosted-Organisation" },
    event: { date: "2026-09-18", serviceForm: "buffet" },
    attendees: { expected: 45 },
    venue: { name: "Hosted-Testsaal", address: "Teststraße 1" },
    servicePlan: {
      eventType: "conference",
      serviceForm: "buffet",
      modules: [
        {
          moduleId: "module-hosted-commercial",
          label: "Hosted-Service",
          category: "service",
          pricing: { amount: 5555.55, currency: "EUR" }
        }
      ]
    },
    menuPlan: [
      {
        componentId: "component-hosted-operational",
        label: operationalSentinel,
        servings: 45,
        menuCategory: "classic"
      }
    ],
    budgetContext: {
      targetBudget: { amount: 8192.44, currency: "EUR" },
      pricingSummary: {
        perPerson: { amount: 913.57, currency: "EUR" },
        subtotal: { amount: 7314.29, currency: "EUR" },
        notes: [commercialSentinel]
      }
    },
    assumptions: [
      { code: "hosted-operational", message: "Operative Kücheninformation bleibt sichtbar.", applied: true }
    ]
  };
}

function operationalRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-hosted-operational",
    name: operationalSentinel,
    source: {
      tier: "internal_approved",
      originType: "approved_import",
      reference: "internal:hosted-session-e2e",
      retrievedAt: "2026-09-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: { servings: 45, unit: "servings" },
    ingredients: [
      {
        ingredientId: "ingredient-hosted-operational",
        name: "Operative Hosted-Zutat",
        quantity: { amount: 3.1, unit: "kg" },
        group: "fleisch"
      }
    ],
    steps: [{ index: 1, instruction: "Operativen Hosted-Kontrollschritt ausführen." }],
    scalingRules: { defaultLossFactor: 1.1, batchSize: 45 },
    allergens: ["egg"],
    dietTags: []
  };
}

function productionPlan(spec: AcceptedEventSpec, recipe: Recipe): ProductionPlan {
  // The extra commercial properties model persisted legacy/commercial data and
  // make a missing server projection observable instead of trusting the UI.
  return {
    schemaVersion: SCHEMA_VERSION,
    planId: "plan-hosted-session-e2e",
    eventSpecId: spec.specId,
    readiness: { status: "complete", reasons: [] },
    productionBatches: [
      {
        batchId: "batch-hosted-operational",
        componentId: "component-hosted-operational",
        recipeId: recipe.recipeId,
        scaledYield: { amount: 45, unit: "servings" },
        batchCount: 1,
        lossFactor: 1.1,
        gnPlan: [{ container: "GN 1/1 65 mm", count: 2 }],
        station: "Warme Küche",
        prepWindow: "2026-09-18T09:00:00.000Z",
        ingredients: [
          {
            ...recipe.ingredients[0]!,
            purchasePrice: 9876.54
          }
        ],
        steps: recipe.steps,
        unitCost: 9876.54
      }
    ],
    timeline: [{ label: "Mise en Place", at: "2026-09-18T09:00:00.000Z" }],
    kitchenSheets: [
      {
        title: operationalSentinel,
        instructions: ["Operativen Hosted-Kontrollschritt ausführen."],
        componentId: "component-hosted-operational",
        recipeId: recipe.recipeId,
        productionQty: { amount: 45, unit: "servings" },
        station: "Warme Küche",
        prepWindow: "2026-09-18T09:00:00.000Z",
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        allergens: ["egg"],
        pricing: { internalNote: commercialSentinel }
      }
    ],
    recipeSelections: [
      {
        componentId: "component-hosted-operational",
        recipeId: recipe.recipeId,
        selectionReason: "Operative Hosted-Rezeptkarte.",
        autoUsedInternetRecipe: false
      }
    ],
    unresolvedItems: [],
    pricingSnapshot: { internalNote: commercialSentinel },
    targetBudget: { amount: 9876.54, currency: "EUR" },
    margin: 9876.54
  } as unknown as ProductionPlan;
}

function purchaseList(spec: AcceptedEventSpec, recipe: Recipe): PurchaseList {
  return {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: "purchase-hosted-session-e2e",
    eventSpecId: spec.specId,
    groupingMode: "group",
    items: [
      {
        ingredientId: "ingredient-hosted-operational",
        displayName: "Operative Hosted-Zutat",
        normalizedQty: 3.1,
        normalizedUnit: "kg",
        purchaseQty: 3.1,
        purchaseUnit: "kg",
        group: "fleisch",
        supplierHint: "Operativer Hosted-Lieferhinweis",
        sourceRecipes: [recipe.recipeId],
        mappingConfidence: 1,
        purchasePrice: 9876.54,
        cost: commercialSentinel
      }
    ],
    totals: { itemCount: 1, groups: ["fleisch"] },
    pricingSummary: { internalNote: commercialSentinel },
    margin: 9876.54
  } as unknown as PurchaseList;
}

type Apps = {
  intake: ReturnType<typeof buildIntakeApp>;
  offer: ReturnType<typeof buildOfferApp>;
  production: ReturnType<typeof buildProductionApp>;
  print: ReturnType<typeof buildPrintExportApp>;
};

type RoleKey = keyof typeof users;

interface Harness {
  rootDir: string;
  apps: Apps;
  userStore: CateringUserStore;
  productionStore: ProductionStore;
  plan: ProductionPlan;
  purchaseList: PurchaseList;
  offerDraftId: string;
  cookies: Record<RoleKey, string>;
  pinHashes: Record<RoleKey, string>;
}

let harness!: Harness;

function cookieFrom(headers: OutgoingHttpHeaders): string {
  const setCookie = headers["set-cookie"];
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof value !== "string") throw new Error("Login hat kein Sitzungscookie geliefert.");
  const cookie = value.split(";", 1)[0] ?? "";
  expect(cookie.startsWith(`${CATERING_SESSION_COOKIE}=`)).toBe(true);
  return cookie;
}

function cookieHeaders(cookie: string, mutation = false): Record<string, string> {
  return {
    cookie,
    host: "catering.test",
    ...(mutation ? { origin: "https://catering.test" } : {})
  };
}

function expectStatus(response: { statusCode: number; body: string }, expected: number): void {
  expect(response.statusCode, response.body).toBe(expected);
}

function forbiddenBrowserIdentityHeaders(headers: Headers): string[] {
  return [...headers.keys()].filter((name) => {
    const normalized = name.toLowerCase();
    return normalized === "authorization" ||
      normalized === "proxy-authorization" ||
      normalized === "x-actor-name" ||
      normalized.startsWith("x-catering-") ||
      /(?:^|[-_])(?:actor|subject|role|business|identity|principal|trusted|user-id|userid)(?:$|[-_])/u.test(normalized);
  });
}

function commercialKeyPaths(value: unknown, prefix = "$"): string[] {
  const commercialKeys = new Set([
    "pricing",
    "pricingsnapshot",
    "pricingsummary",
    "targetbudget",
    "estimatedprice",
    "price",
    "unitprice",
    "salesprice",
    "purchaseprice",
    "cost",
    "costs",
    "margin",
    "maximumestimatedcosteur",
    "policymaximumestimatedcosteur"
  ]);
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => commercialKeyPaths(entry, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    commercialKeys.has(key.toLowerCase())
      ? [`${prefix}.${key}`]
      : commercialKeyPaths(nested, `${prefix}.${key}`)
  );
}

function expectCommercialsAbsent(value: unknown): void {
  expect(commercialKeyPaths(value)).toEqual([]);
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  expect(serialized).not.toContain(commercialSentinel);
  expect(serialized).not.toContain("9876.54");
  for (const sentinel of renderedCommercialSentinels) {
    expect(serialized).not.toContain(sentinel);
  }
}

async function createUser(
  store: CateringUserStore,
  fixture: SessionUserFixture
): Promise<string> {
  const record = createCateringUserRecord({
    businessId: businessContext.businessId,
    userId: fixture.userId,
    loginCode: fixture.loginCode,
    displayName: fixture.displayName,
    pinHash: await hashCateringPin(fixture.pin),
    role: fixture.role,
    active: true,
    now: new Date("2026-08-28T10:00:00.000Z")
  });
  expect(await store.create(businessContext, record)).toBe("created");
  return record.pinHash;
}

async function loginCookie(
  intake: ReturnType<typeof buildIntakeApp>,
  fixture: SessionUserFixture
): Promise<string> {
  const response = await intake.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: { host: "catering.test", origin: "https://catering.test" },
    payload: { loginCode: fixture.loginCode, pin: fixture.pin }
  });
  expectStatus(response, 200);
  return cookieFrom(response.headers);
}

interface UiBrowserCall {
  url: string;
  method: string;
  credentials: RequestCredentials | undefined;
  browserCookieHeader: string | null;
  forbiddenIdentityHeaders: string[];
  jarCookie: string;
}

async function loadUiAccessForRole(role: RoleKey) {
  const cookie = harness.cookies[role];
  const calls: UiBrowserCall[] = [];

  // Browsers do not expose Cookie to application code. This adapter models a
  // same-origin cookie jar and adds the exact Intake cookie only at transport.
  const browserFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const browserHeaders = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? "GET",
      credentials: init?.credentials,
      browserCookieHeader: browserHeaders.get("cookie"),
      forbiddenIdentityHeaders: forbiddenBrowserIdentityHeaders(browserHeaders),
      jarCookie: cookie
    });

    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET") throw new Error(`Unerwartete Hosted-UI-Methode: ${method}`);
    const targetUrl = url.startsWith("/api/intake/")
      ? url.slice("/api/intake".length)
      : url.startsWith("/api/production/")
        ? url.slice("/api/production".length)
        : undefined;
    if (!targetUrl) throw new Error(`Unerwarteter Hosted-UI-Abruf: ${url}`);

    const injectOptions = {
      method: "GET" as const,
      url: targetUrl,
      headers: {
        ...Object.fromEntries(browserHeaders.entries()),
        cookie,
        host: "catering.test"
      }
    };
    const response = url.startsWith("/api/intake/")
      ? await harness.apps.intake.inject(injectOptions)
      : await harness.apps.production.inject(injectOptions);
    const rawContentType = response.headers["content-type"];
    const contentType = Array.isArray(rawContentType) ? rawContentType[0] : rawContentType;
    return new Response(response.body, {
      status: response.statusCode,
      headers: { "content-type": typeof contentType === "string" ? contentType : "application/json" }
    });
  });

  deactivateCateringSessionRequests();
  vi.stubGlobal("fetch", browserFetch);
  try {
    const session = await resolveCateringSession();
    expect(session).toEqual({
      kind: "authenticated",
      session: {
        authenticated: true,
        user: {
          userId: users[role].userId,
          displayName: users[role].displayName
        },
        access: { capabilities: expect.any(Array) }
      }
    });
    activateCateringSessionRequests();
    const access = await loadProductionRouteAccessData();
    return { session, access, calls };
  } finally {
    deactivateCateringSessionRequests();
    vi.unstubAllGlobals();
  }
}

function forgedRoleHeaders(
  cookie: string,
  actorName: string,
  role: MinimalMvpRole
): Record<string, string> {
  return {
    ...cookieHeaders(cookie),
    "x-actor-name": actorName,
    "x-catering-actor-name": actorName,
    "x-catering-business-id": businessContext.businessId,
    "x-catering-trusted-secret": rootSecret,
    "x-auth-request-user": actorName,
    "x-auth-request-role": role,
    "x-forwarded-user": actorName,
    "x-forwarded-role": role,
    authorization: `Bearer forged-${role}`
  };
}

beforeAll(async () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-hosted-session-e2e-"));
  const userStore = new CateringUserStore({ rootDir });
  const pinHashes = {
    admin: await createUser(userStore, users.admin),
    production: await createUser(userStore, users.production),
    readOnly: await createUser(userStore, users.readOnly)
  };

  const spec = commercialSpec();
  const recipe = operationalRecipe();
  const plan = productionPlan(spec, recipe);
  const seededPurchaseList = purchaseList(spec, recipe);
  const intakeStore = new IntakeStore({ rootDir });
  const productionStore = new ProductionStore({ rootDir });
  const recipeLibrary = new RecipeLibrary({ rootDir });
  await intakeStore.saveSpec(businessContext, spec);
  await productionStore.savePlan(businessContext, plan);
  await productionStore.savePurchaseList(businessContext, seededPurchaseList);
  await recipeLibrary.save(businessContext, recipe);

  const apps = {
    intake: buildIntakeApp({ rootDir, userStore, env: sessionEnv }),
    offer: buildOfferApp({ rootDir, userStore, env: sessionEnv }),
    production: buildProductionApp({ dataRoot: rootDir, store: productionStore, userStore, env: sessionEnv }),
    print: buildPrintExportApp({ rootDir, userStore, env: sessionEnv })
  };
  const cookies = {
    admin: await loginCookie(apps.intake, users.admin),
    production: await loginCookie(apps.intake, users.production),
    readOnly: await loginCookie(apps.intake, users.readOnly)
  };

  const seededOffers = await apps.offer.inject({
    method: "POST",
    url: "/v1/offers/seed-demo",
    headers: cookieHeaders(cookies.admin, true)
  });
  expectStatus(seededOffers, 201);
  const offerDraftId = seededOffers.json<{ seeded: Array<{ draftId: string }> }>().seeded[0]?.draftId;
  if (!offerDraftId) throw new Error("Die Hosted-Fixture hat keinen Angebotsentwurf erzeugt.");

  harness = {
    rootDir,
    apps,
    userStore,
    productionStore,
    plan,
    purchaseList: seededPurchaseList,
    offerDraftId,
    cookies,
    pinHashes
  };
}, 30_000);

afterAll(async () => {
  deactivateCateringSessionRequests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (!harness) return;
  await Promise.all(Object.values(harness.apps).map((app) => app.close()));
  try {
    execFileSync("/usr/bin/trash", [harness.rootDir], { stdio: "ignore" });
  } catch {
    // Testdaten liegen außerhalb des Repositorys; fehlendes Trash darf den Vertragsnachweis nicht maskieren.
  }
});

describe("Hosted Session E2E mit drei echten Catering-Rollen", () => {
  it("erkennt gerenderte kommerzielle Beträge in der Export-Redaktionsprüfung", () => {
    for (const sentinel of renderedCommercialSentinels) {
      expect(() => expectCommercialsAbsent(sentinel)).toThrow();
    }
  });

  it("verbindet den echten Session- und Production-UI-Loader ohne Browser-Identitätsheader", async () => {
    expect(Object.keys(cookieHeaders(harness.cookies.admin)).sort()).toEqual(["cookie", "host"]);

    for (const role of ["admin", "production", "readOnly"] as const) {
      const result = await loadUiAccessForRole(role);
      expect(result.access.access.canOperateProduction).toBe(role !== "readOnly");
      expect(result.calls.map((call) => call.url)).toEqual(role === "readOnly"
        ? [
            "/api/intake/v1/auth/session",
            "/api/production/v1/production/plans",
            "/api/production/v1/production/purchase-lists"
          ]
        : [
            "/api/intake/v1/auth/session",
            "/api/production/v1/production/plans"
          ]);
      for (const call of result.calls) {
        expect(call.method).toBe("GET");
        expect(call.credentials).toBe("same-origin");
        expect(call.browserCookieHeader).toBeNull();
        expect(call.forbiddenIdentityHeaders).toEqual([]);
        expect(call.jarCookie).toBe(harness.cookies[role]);
      }
      if (role !== "admin") expectCommercialsAbsent(result.access);
    }
  }, 30_000);

  it("gibt dem Admin die vollständige relevante API-, Export- und Auditsicht", async () => {
    const headers = cookieHeaders(harness.cookies.admin);
    const [offer, plan, purchase, offerExport, productionFolder, audit] = await Promise.all([
      harness.apps.offer.inject({
        method: "GET",
        url: `/v1/offers/drafts/${harness.offerDraftId}`,
        headers
      }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/plans/${harness.plan.planId}`,
        headers
      }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/purchase-lists/${harness.purchaseList.purchaseListId}`,
        headers
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/offers/${harness.offerDraftId}/html`,
        headers
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/production-folders/${harness.plan.planId}/html`,
        headers
      }),
      harness.apps.production.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=50",
        headers
      })
    ]);

    for (const response of [offer, plan, purchase, offerExport, productionFolder, audit]) {
      expectStatus(response, 200);
    }
    const offerSubtotal = offer.json<{ pricingSummary: { subtotal: { amount: number } } }>()
      .pricingSummary.subtotal.amount;
    expect(offerSubtotal).toBeGreaterThan(0);
    expect(offerExport.body).toContain(`Gesamt: ${offerSubtotal.toFixed(2)} EUR`);
    expect(plan.body).toContain(commercialSentinel);
    expect(plan.body).toContain("9876.54");
    expect(purchase.body).toContain(commercialSentinel);
    expect(productionFolder.body).toContain("Preisrahmen");
    expect(productionFolder.body).toContain("8.192,44 EUR");
    expect(audit.json<{ items: Array<{ actor?: { name?: string } }> }>().items)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ actor: expect.objectContaining({ name: users.admin.userId }) })
      ]));
  });

  it("hält Produktion operativ und Read-only redigiert, gesperrt und nebenwirkungsfrei", async () => {
    const productionHeaders = cookieHeaders(harness.cookies.production);
    const readOnlyHeaders = cookieHeaders(harness.cookies.readOnly);
    const [planList, plan, purchaseList, purchase, planExport, folderExport, purchaseExport] = await Promise.all([
      harness.apps.production.inject({ method: "GET", url: "/v1/production/plans", headers: productionHeaders }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/plans/${harness.plan.planId}`,
        headers: productionHeaders
      }),
      harness.apps.production.inject({
        method: "GET",
        url: "/v1/production/purchase-lists",
        headers: productionHeaders
      }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/purchase-lists/${harness.purchaseList.purchaseListId}`,
        headers: productionHeaders
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/production-plans/${harness.plan.planId}/html`,
        headers: productionHeaders
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/production-folders/${harness.plan.planId}/html`,
        headers: productionHeaders
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/purchase-lists/${harness.purchaseList.purchaseListId}/csv`,
        headers: productionHeaders
      })
    ]);
    for (const response of [planList, plan, purchaseList, purchase, planExport, folderExport, purchaseExport]) {
      expectStatus(response, 200);
      expectCommercialsAbsent(response.headers["content-type"]?.toString().includes("json") ? response.json() : response.body);
    }
    expect(planList.json()).toMatchObject({ access: { canOperateProduction: true } });
    expect(planExport.body).toContain(operationalSentinel);
    expect(folderExport.body).toContain("Operative Hosted-Zutat");
    expect(purchaseExport.body).toContain("Operative Hosted-Zutat");

    const [productionOffer, productionOfferExport, productionAudit] = await Promise.all([
      harness.apps.offer.inject({
        method: "GET",
        url: `/v1/offers/drafts/${harness.offerDraftId}`,
        headers: productionHeaders
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/offers/${harness.offerDraftId}/html`,
        headers: productionHeaders
      }),
      harness.apps.production.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=20",
        headers: productionHeaders
      })
    ]);
    expectStatus(productionOffer, 403);
    expectStatus(productionOfferExport, 403);
    expectStatus(productionAudit, 403);

    const createdFeedback = await harness.apps.production.inject({
      method: "POST",
      url: "/v1/production/feedback-drafts",
      headers: cookieHeaders(harness.cookies.production, true),
      payload: {
        target: { specId: "spec-hosted-feedback" },
        feedback: {
          summary: "Operative Hosted-Rückmeldung.",
          observations: ["Die Ausgabe war vollständig vorbereitet."],
          changeRequests: ["Warmhaltebehälter früher bereitstellen."]
        }
      }
    });
    expectStatus(createdFeedback, 201);
    const feedback = createdFeedback.json<{ draft: ProductionFeedbackDraft }>().draft;
    expect(feedback).toMatchObject({
      status: "pending_review",
      visibility: "operational",
      createdBy: { name: users.production.userId, source: "authenticated-session" }
    });

    const beforeReadOnlyDecision = await harness.productionStore.getProductionFeedbackDraft(
      businessContext,
      feedback.feedbackId
    );
    const [readOnlyPlans, readOnlyPlan, readOnlyPurchases, readOnlyPurchase] = await Promise.all([
      harness.apps.production.inject({ method: "GET", url: "/v1/production/plans", headers: readOnlyHeaders }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/plans/${harness.plan.planId}`,
        headers: readOnlyHeaders
      }),
      harness.apps.production.inject({
        method: "GET",
        url: "/v1/production/purchase-lists",
        headers: readOnlyHeaders
      }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/purchase-lists/${harness.purchaseList.purchaseListId}`,
        headers: readOnlyHeaders
      })
    ]);
    for (const response of [readOnlyPlans, readOnlyPlan, readOnlyPurchases, readOnlyPurchase]) {
      expectStatus(response, 200);
      expectCommercialsAbsent(response.json());
    }
    expect(readOnlyPlans.json()).toMatchObject({ access: { canOperateProduction: false } });

    const [readOnlyMutation, readOnlyPlanExport, readOnlyFolderExport, readOnlyPurchaseExport, readOnlyAudit] =
      await Promise.all([
        harness.apps.production.inject({
          method: "POST",
          url: `/v1/production/feedback-drafts/${feedback.feedbackId}/decision`,
          headers: cookieHeaders(harness.cookies.readOnly, true),
          payload: { approve: false }
        }),
        harness.apps.print.inject({
          method: "GET",
          url: `/v1/exports/production-plans/${harness.plan.planId}/html`,
          headers: readOnlyHeaders
        }),
        harness.apps.print.inject({
          method: "GET",
          url: `/v1/exports/production-folders/${harness.plan.planId}/html`,
          headers: readOnlyHeaders
        }),
        harness.apps.print.inject({
          method: "GET",
          url: `/v1/exports/purchase-lists/${harness.purchaseList.purchaseListId}/csv`,
          headers: readOnlyHeaders
        }),
        harness.apps.production.inject({
          method: "GET",
          url: "/v1/production/audit/events?limit=20",
          headers: readOnlyHeaders
        })
      ]);
    for (const response of [
      readOnlyMutation,
      readOnlyPlanExport,
      readOnlyFolderExport,
      readOnlyPurchaseExport,
      readOnlyAudit
    ]) {
      expectStatus(response, 403);
    }
    await expect(harness.productionStore.getProductionFeedbackDraft(businessContext, feedback.feedbackId))
      .resolves.toEqual(beforeReadOnlyDecision);

    const productionDecision = await harness.apps.production.inject({
      method: "POST",
      url: `/v1/production/feedback-drafts/${feedback.feedbackId}/decision`,
      headers: cookieHeaders(harness.cookies.production, true),
      payload: { approve: true }
    });
    expectStatus(productionDecision, 200);
    expect(productionDecision.json<{ draft: ProductionFeedbackDraft }>().draft).toMatchObject({
      status: "approved",
      visibility: "operational",
      approvedBy: { name: users.production.userId, source: "authenticated-session" }
    });

    const adminAudit = await harness.apps.production.inject({
      method: "GET",
      url: "/v1/production/audit/events?limit=100",
      headers: cookieHeaders(harness.cookies.admin)
    });
    expectStatus(adminAudit, 200);
    const productionEntries = adminAudit.json<{ items: Array<Record<string, unknown>> }>().items.filter((entry) =>
      entry.entityId === feedback.feedbackId
    );
    expect(productionEntries.length).toBeGreaterThanOrEqual(2);
    expect(productionEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "production.feedback_draft_created",
        actor: { name: users.production.userId, source: "authenticated-session" }
      }),
      expect.objectContaining({
        action: "production.feedback_draft_approved",
        actor: { name: users.production.userId, source: "authenticated-session" }
      })
    ]));
    const serializedAudit = JSON.stringify(productionEntries);
    for (const forbidden of [
      ...Object.values(users).flatMap((user) => [user.pin, user.loginCode]),
      ...Object.values(harness.pinHashes),
      ...Object.values(harness.cookies),
      CATERING_SESSION_COOKIE,
      rootSecret
    ]) {
      expect(serializedAudit).not.toContain(forbidden);
    }
  }, 30_000);

  it("weist Header- und Bearer-Fallbacks ab und lässt Header neben Cookies wirkungslos", async () => {
    const historicalAdminHeaders = {
      host: "catering.test",
      "x-actor-name": "Administrator",
      "x-catering-actor-name": "Administrator",
      "x-catering-business-id": businessContext.businessId,
      "x-catering-trusted-secret": rootSecret,
      "x-auth-request-user": "forged-admin",
      "x-auth-request-role": "admin"
    };
    const token = harness.cookies.production.slice(harness.cookies.production.indexOf("=") + 1);
    const bearerHeaders = { host: "catering.test", authorization: `Bearer ${token}` };

    for (const headers of [historicalAdminHeaders, bearerHeaders]) {
      const responses = await Promise.all([
        harness.apps.intake.inject({ method: "GET", url: "/v1/intake/requests", headers }),
        harness.apps.offer.inject({
          method: "GET",
          url: `/v1/offers/drafts/${harness.offerDraftId}`,
          headers
        }),
        harness.apps.production.inject({
          method: "GET",
          url: `/v1/production/plans/${harness.plan.planId}`,
          headers
        }),
        harness.apps.print.inject({
          method: "GET",
          url: `/v1/exports/offers/${harness.offerDraftId}/html`,
          headers
        })
      ]);
      expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401, 401]);
    }

    const forgedAdmin = forgedRoleHeaders(harness.cookies.production, "Administrator", "admin");
    const [elevatedOffer, elevatedPlan, elevatedOfferExport, elevatedAudit] = await Promise.all([
      harness.apps.offer.inject({
        method: "GET",
        url: `/v1/offers/drafts/${harness.offerDraftId}`,
        headers: forgedAdmin
      }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/plans/${harness.plan.planId}`,
        headers: forgedAdmin
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/offers/${harness.offerDraftId}/html`,
        headers: forgedAdmin
      }),
      harness.apps.production.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=20",
        headers: forgedAdmin
      })
    ]);
    expectStatus(elevatedOffer, 403);
    expectStatus(elevatedPlan, 200);
    expectCommercialsAbsent(elevatedPlan.json());
    expectStatus(elevatedOfferExport, 403);
    expectStatus(elevatedAudit, 403);

    const forgedLow = forgedRoleHeaders(
      harness.cookies.admin,
      "Read-only-Mitarbeiter",
      "read_only_operator"
    );
    const [downgradedOffer, downgradedPlan, downgradedOfferExport, downgradedAudit] = await Promise.all([
      harness.apps.offer.inject({
        method: "GET",
        url: `/v1/offers/drafts/${harness.offerDraftId}`,
        headers: forgedLow
      }),
      harness.apps.production.inject({
        method: "GET",
        url: `/v1/production/plans/${harness.plan.planId}`,
        headers: forgedLow
      }),
      harness.apps.print.inject({
        method: "GET",
        url: `/v1/exports/offers/${harness.offerDraftId}/html`,
        headers: forgedLow
      }),
      harness.apps.production.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=20",
        headers: forgedLow
      })
    ]);
    for (const response of [downgradedOffer, downgradedPlan, downgradedOfferExport, downgradedAudit]) {
      expectStatus(response, 200);
    }
    expect(downgradedPlan.body).toContain(commercialSentinel);
  });
});
