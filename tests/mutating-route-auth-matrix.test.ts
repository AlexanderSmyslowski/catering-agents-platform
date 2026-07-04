import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEventRequestFromText,
  MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES,
  SCHEMA_VERSION,
  type MinimalMvpRole,
  type ProductionDraft,
  normalizeEventRequestToSpec
} from "@catering/shared-core";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";

type MutableRoute = {
  service: "intake" | "offer" | "production";
  method: "POST" | "PATCH";
  pathTemplate: string;
  requiredRole: MinimalMvpRole;
  url?: string;
  payload?: unknown | (() => unknown);
  prepareCorrectRoleCase?: (
    app: unknown,
    headers: Record<string, string>
  ) => Promise<{
    url?: string;
    payload?: unknown;
  }>;
};

const mutatingMvpRoutes: MutableRoute[] = [
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/normalize",
    requiredRole: "intake_operator",
    payload: { text: "Lunch fuer 20 Personen.", requestId: "matrix-intake-1" }
  },
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/documents",
    requiredRole: "intake_operator",
    payload: { documents: [] }
  },
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/documents/upload",
    requiredRole: "intake_operator"
  },
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/shadow/normalize",
    requiredRole: "intake_operator",
    payload: {
      text: "Synthetische Demo: Business Lunch fuer 40 Personen.",
      safetyMode: "synthetic_demo"
    }
  },
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/specs/manual",
    requiredRole: "intake_operator",
    payload: { eventType: "Lunch", attendeeCount: 20 }
  },
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/seed-demo",
    requiredRole: "operations_audit_operator"
  },
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/requests/:requestId/archive",
    requiredRole: "intake_operator",
    url: "/v1/intake/requests/matrix-request/archive",
    payload: { reasonCode: "wrong_upload" }
  },
  {
    service: "intake",
    method: "PATCH",
    pathTemplate: "/v1/intake/specs/:specId",
    requiredRole: "intake_operator",
    url: "/v1/intake/specs/matrix-spec",
    payload: { attendeeCount: 22 }
  },
  {
    service: "intake",
    method: "POST",
    pathTemplate: "/v1/intake/spec-governance/finalize",
    requiredRole: "operations_audit_operator",
    payload: { specId: "matrix-spec", confirmCriticalFinalize: true }
  },
  {
    service: "offer",
    method: "POST",
    pathTemplate: "/v1/offers/drafts",
    requiredRole: "offer_operator",
    payload: () =>
      createEventRequestFromText({
        requestId: "matrix-offer-drafts-1",
        channel: "text",
        rawText: "Business Lunch fuer 35 Personen."
      })
  },
  {
    service: "offer",
    method: "POST",
    pathTemplate: "/v1/offers/from-text",
    requiredRole: "offer_operator",
    payload: { text: "Business Lunch fuer 35 Personen." }
  },
  {
    service: "offer",
    method: "POST",
    pathTemplate: "/v1/offers/seed-demo",
    requiredRole: "operations_audit_operator"
  },
  {
    service: "offer",
    method: "POST",
    pathTemplate: "/v1/offers/recipes/import-text",
    requiredRole: "offer_operator",
    payload: { recipeName: "Matrix Rezept", text: "Zutaten\n1 kg Wasser" }
  },
  {
    service: "offer",
    method: "POST",
    pathTemplate: "/v1/offers/recipes/upload",
    requiredRole: "offer_operator"
  },
  {
    service: "offer",
    method: "PATCH",
    pathTemplate: "/v1/offers/recipes/:recipeId/review",
    requiredRole: "offer_operator",
    url: "/v1/offers/recipes/matrix-recipe/review",
    payload: { decision: "verify" },
    prepareCorrectRoleCase: async (app, headers) => {
      const imported = await inject(app, {
        method: "POST",
        url: "/v1/offers/recipes/import-text",
        headers,
        payload: recipeImportPayload("offer-review")
      });
      expect(imported.statusCode).toBe(201);
      const recipeId = imported.json<{ recipe: { recipeId: string } }>().recipe.recipeId;
      return {
        url: `/v1/offers/recipes/${recipeId}/review`,
        payload: { decision: "verify" }
      };
    }
  },
  {
    service: "offer",
    method: "POST",
    pathTemplate: "/v1/offers/drafts/:draftId/promote",
    requiredRole: "offer_operator",
    url: "/v1/offers/drafts/matrix-draft/promote",
    payload: { variantId: "variant-2" }
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/plans",
    requiredRole: "production_operator",
    payload: () => ({ eventSpec: productionEventSpec() })
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/drafts",
    requiredRole: "production_operator",
    payload: () => productionDraftPayload()
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/drafts/from-document",
    requiredRole: "production_operator",
    payload: () => ({
      filename: "matrix-angebot.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from("Buffet fuer 45 Personen mit Vitello Tonnato.", "utf8").toString("base64")
    })
  },
  {
    service: "production",
    method: "PATCH",
    pathTemplate: "/v1/production/drafts/:draftId/review-cards/:cardId",
    requiredRole: "production_operator",
    url: "/v1/production/drafts/matrix-production-draft/review-cards/matrix-card-event",
    payload: { decision: "fits" },
    prepareCorrectRoleCase: async (app, headers) => {
      await seedProductionDraftForMatrix(app, headers);
      return {
        url: "/v1/production/drafts/matrix-production-draft/review-cards/matrix-card-event",
        payload: { decision: "fits" }
      };
    }
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/drafts/:draftId/decision",
    requiredRole: "production_operator",
    url: "/v1/production/drafts/matrix-production-draft/decision",
    payload: { approve: false },
    prepareCorrectRoleCase: async (app, headers) => {
      await seedProductionDraftForMatrix(app, headers);
      return {
        url: "/v1/production/drafts/matrix-production-draft/decision",
        payload: { approve: false }
      };
    }
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/drafts/:draftId/apply",
    requiredRole: "production_operator",
    url: "/v1/production/drafts/matrix-production-draft/apply",
    prepareCorrectRoleCase: async (app, headers) => {
      await seedApprovedProductionDraftForMatrix(app, headers);
      return {
        url: "/v1/production/drafts/matrix-production-draft/apply"
      };
    }
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/feedback-drafts",
    requiredRole: "production_operator",
    payload: () => productionFeedbackPayload()
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/feedback-drafts/:feedbackId/decision",
    requiredRole: "production_operator",
    url: "/v1/production/feedback-drafts/matrix-feedback/decision",
    payload: { approve: false },
    prepareCorrectRoleCase: async (app, headers) => {
      const created = await inject(app, {
        method: "POST",
        url: "/v1/production/feedback-drafts",
        headers,
        payload: productionFeedbackPayload()
      });
      expect(created.statusCode).toBe(201);
      const feedbackId = created.json<{ draft: { feedbackId: string } }>().draft.feedbackId;
      return {
        url: `/v1/production/feedback-drafts/${feedbackId}/decision`,
        payload: { approve: false }
      };
    }
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/specs/:specId/clarification-drafts",
    requiredRole: "production_operator",
    url: "/v1/production/specs/matrix-spec/clarification-drafts"
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/clarification-drafts/:draftId/decision",
    requiredRole: "production_operator",
    url: "/v1/production/clarification-drafts/matrix-draft/decision",
    payload: { approve: false }
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/seed-demo",
    requiredRole: "operations_audit_operator"
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/recipes/import-text",
    requiredRole: "production_operator",
    payload: recipeImportPayload("production-import")
  },
  {
    service: "production",
    method: "POST",
    pathTemplate: "/v1/production/recipes/upload",
    requiredRole: "production_operator"
  },
  {
    service: "production",
    method: "PATCH",
    pathTemplate: "/v1/production/recipes/:recipeId/review",
    requiredRole: "production_operator",
    url: "/v1/production/recipes/matrix-recipe/review",
    payload: { decision: "verify" },
    prepareCorrectRoleCase: async (app, headers) => {
      const imported = await inject(app, {
        method: "POST",
        url: "/v1/production/recipes/import-text",
        headers,
        payload: recipeImportPayload("production-review")
      });
      expect(imported.statusCode).toBe(201);
      const recipeId = imported.json<{ recipe: { recipeId: string } }>().recipe.recipeId;
      return {
        url: `/v1/production/recipes/${recipeId}/review`,
        payload: { decision: "verify" }
      };
    }
  }
];

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-route-auth-matrix-"));
}

const TRUSTED_SECRET = "route-auth-matrix-secret";

const trustedHeaders = (actorName: string) => ({
  "x-catering-actor-name": actorName,
  "x-catering-trusted-secret": TRUSTED_SECRET
});

const actorNameForRole = (role: MinimalMvpRole) => MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES[role];

const wrongActorNameForRole = (role: MinimalMvpRole) =>
  role === "operations_audit_operator"
    ? actorNameForRole("production_operator")
    : actorNameForRole("operations_audit_operator");

function routeUrl(route: MutableRoute): string {
  return route.url ?? route.pathTemplate;
}

function routePayload(route: MutableRoute): unknown {
  return typeof route.payload === "function" ? route.payload() : route.payload;
}

function recipeImportPayload(label: string) {
  return {
    recipeName: `Matrix Rezept ${label}`,
    text: [
      "Zutaten",
      "1 kg Wasser",
      "500 g Tomaten",
      "Zubereitung",
      "1. Alles erhitzen und abschmecken."
    ].join("\n")
  };
}

async function inject(
  app: unknown,
  options: {
    method: "POST" | "PATCH";
    url: string;
    headers?: Record<string, string>;
    payload?: object | string | Buffer;
  }
): Promise<{ statusCode: number; json: <T = unknown>() => T }> {
  return (app as {
    inject: (input: typeof options) => Promise<{ statusCode: number; json: <T = unknown>() => T }>;
  }).inject(options);
}

function productionEventSpec() {
  return normalizeEventRequestToSpec(
    createEventRequestFromText({
      requestId: "matrix-production-1",
      channel: "text",
      rawText: "Lunch am 2026-09-18 fuer 25 Personen mit vegetarischer Tomatensuppe."
    })
  );
}

function productionDraftPayload(): ProductionDraft {
  const eventSpec = productionEventSpec();
  return {
    schemaVersion: SCHEMA_VERSION,
    draftId: "matrix-production-draft",
    status: "pending_review",
    createdAt: "2026-07-01T12:00:00.000Z",
    source: {
      kind: "manual_import",
      receivedAt: "2026-07-01T12:00:00.000Z",
      sourceRef: "matrix-test"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [
      {
        cardId: "matrix-card-event",
        kind: "event_data",
        title: "Anfrage",
        summary: "Schema-valider Testentwurf für die Auth-Matrix.",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: eventSpec.specId,
        requiredApproval: true
      }
    ],
    draftArtifacts: {
      eventSpec
    }
  };
}

function productionFeedbackPayload() {
  return {
    target: {
      specId: "matrix-spec",
      planId: "matrix-plan"
    },
    feedback: {
      summary: "Mengen passten in der Produktion.",
      observations: ["Ausgabe lief ruhig."],
      changeRequests: ["Beim nächsten Lauf mehr Reserve einplanen."]
    }
  };
}

async function seedProductionDraftForMatrix(app: unknown, headers: Record<string, string>): Promise<void> {
  const imported = await inject(app, {
    method: "POST",
    url: "/v1/production/drafts",
    headers,
    payload: productionDraftPayload()
  });
  expect(imported.statusCode).toBe(201);
}

async function seedApprovedProductionDraftForMatrix(app: unknown, headers: Record<string, string>): Promise<void> {
  await seedProductionDraftForMatrix(app, headers);
  const reviewed = await inject(app, {
    method: "PATCH",
    url: "/v1/production/drafts/matrix-production-draft/review-cards/matrix-card-event",
    headers,
    payload: { decision: "fits" }
  });
  expect(reviewed.statusCode).toBe(200);
  const approved = await inject(app, {
    method: "POST",
    url: "/v1/production/drafts/matrix-production-draft/decision",
    headers,
    payload: { approve: true }
  });
  expect(approved.statusCode).toBe(200);
}

function buildAppForRoute(route: MutableRoute, dataRoot: string) {
  return route.service === "intake"
    ? buildIntakeApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET, env: {} })
    : route.service === "offer"
      ? buildOfferApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET, env: {} })
      : buildProductionApp({ dataRoot, trustedActorSecret: TRUSTED_SECRET, env: {} });
}

function discoverRegisteredMutatingRoutes(): string[] {
  const routeSources = [
    "intake-service/src/app.ts",
    "intake-service/src/routes/document-routes.ts",
    "intake-service/src/routes/work-item-routes.ts",
    "offer-service/src/app.ts",
    "offer-service/src/routes/draft-routes.ts",
    "production-service/src/app.ts",
    "production-service/src/routes/artifact-routes.ts",
    "production-service/src/routes/recipe-routes.ts",
    "print-export/src/index.ts"
  ];
  const routePattern = /app\.(post|put|patch|delete)(?:<[\s\S]{0,500}?>)?\(\s*["']([^"']+)["']/g;
  const routes = new Set<string>();

  for (const routeSource of routeSources) {
    const source = readFileSync(routeSource, "utf8");
    let match: RegExpExecArray | null;
    while ((match = routePattern.exec(source)) !== null) {
      routes.add(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }

  return [...routes].sort();
}

describe("mutating MVP route auth matrix", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("keeps the mutating route inventory aligned with service registrations", () => {
    expect(discoverRegisteredMutatingRoutes()).toEqual(
      mutatingMvpRoutes
        .map((route) => `${route.method} ${route.pathTemplate}`)
        .sort()
    );
  });

  it.each(mutatingMvpRoutes)(
    "fails closed for $method $pathTemplate without trusted actor or CATERING_DEV_AUTH",
    async (route) => {
      const dataRoot = createDataRoot();
      dataRoots.push(dataRoot);
      const app =
        route.service === "intake"
          ? buildIntakeApp({ rootDir: dataRoot, env: {} })
          : route.service === "offer"
            ? buildOfferApp({ rootDir: dataRoot, env: {} })
            : buildProductionApp({ dataRoot, env: {} });

      try {
        const response = await inject(app, {
          method: route.method,
          url: routeUrl(route),
          payload: routePayload(route) as object | string | Buffer | undefined
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    }
  );

  it.each(mutatingMvpRoutes)(
    "rejects the wrong trusted role for $method $pathTemplate",
    async (route) => {
      const dataRoot = createDataRoot();
      dataRoots.push(dataRoot);
      const app = buildAppForRoute(route, dataRoot);

      try {
        const response = await inject(app, {
          method: route.method,
          url: routeUrl(route),
          headers: trustedHeaders(wrongActorNameForRole(route.requiredRole)),
          payload: routePayload(route) as object | string | Buffer | undefined
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    }
  );

  it.each(mutatingMvpRoutes)(
    "lets the correct trusted role pass the auth boundary for $method $pathTemplate",
    async (route) => {
      const dataRoot = createDataRoot();
      dataRoots.push(dataRoot);
      const app = buildAppForRoute(route, dataRoot);
      const headers = trustedHeaders(actorNameForRole(route.requiredRole));

      try {
        const prepared = route.prepareCorrectRoleCase
          ? await route.prepareCorrectRoleCase(app, headers)
          : {};
        const response = await inject(app, {
          method: route.method,
          url: prepared.url ?? routeUrl(route),
          headers,
          payload: (prepared.payload ?? routePayload(route)) as object | string | Buffer | undefined
        });

        expect(response.statusCode).not.toBe(401);
        expect(response.statusCode).not.toBe(403);
      } finally {
        await app.close();
      }
    }
  );

  it("keeps service server defaults bound to localhost", () => {
    const serverFiles = [
      "intake-service/src/server.ts",
      "offer-service/src/server.ts",
      "production-service/src/server.ts",
      "print-export/src/server.ts"
    ];

    for (const serverFile of serverFiles) {
      const source = readFileSync(serverFile, "utf8");

      expect(source).toContain('"127.0.0.1"');
      expect(source).not.toContain('host: "0.0.0.0"');
    }
  });
});
