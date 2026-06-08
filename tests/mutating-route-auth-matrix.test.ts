import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEventRequestFromText,
  normalizeEventRequestToSpec
} from "@catering/shared-core";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";

type MutableRoute = {
  service: "intake" | "offer" | "production";
  method: "POST" | "PATCH";
  url: string;
  payload?: unknown;
};

const mutatingMvpRoutes: MutableRoute[] = [
  {
    service: "intake",
    method: "POST",
    url: "/v1/intake/normalize",
    payload: { text: "Lunch fuer 20 Personen.", requestId: "matrix-intake-1" }
  },
  {
    service: "intake",
    method: "POST",
    url: "/v1/intake/documents",
    payload: { documents: [] }
  },
  {
    service: "intake",
    method: "POST",
    url: "/v1/intake/documents/upload"
  },
  {
    service: "intake",
    method: "POST",
    url: "/v1/intake/specs/manual",
    payload: { eventType: "Lunch", attendeeCount: 20 }
  },
  {
    service: "intake",
    method: "POST",
    url: "/v1/intake/seed-demo"
  },
  {
    service: "intake",
    method: "POST",
    url: "/v1/intake/requests/matrix-request/archive",
    payload: { reasonCode: "wrong_upload" }
  },
  {
    service: "intake",
    method: "PATCH",
    url: "/v1/intake/specs/matrix-spec",
    payload: { attendeeCount: 22 }
  },
  {
    service: "intake",
    method: "POST",
    url: "/v1/intake/spec-governance/finalize",
    payload: { specId: "matrix-spec", confirmCriticalFinalize: true }
  },
  {
    service: "offer",
    method: "POST",
    url: "/v1/offers/drafts",
    payload: { schemaVersion: "1.0.0" }
  },
  {
    service: "offer",
    method: "POST",
    url: "/v1/offers/from-text",
    payload: { text: "Business Lunch fuer 35 Personen." }
  },
  {
    service: "offer",
    method: "POST",
    url: "/v1/offers/seed-demo"
  },
  {
    service: "offer",
    method: "POST",
    url: "/v1/offers/recipes/import-text",
    payload: { recipeName: "Matrix Rezept", text: "Zutaten\n1 kg Wasser" }
  },
  {
    service: "offer",
    method: "POST",
    url: "/v1/offers/recipes/upload"
  },
  {
    service: "offer",
    method: "PATCH",
    url: "/v1/offers/recipes/matrix-recipe/review",
    payload: { decision: "verify" }
  },
  {
    service: "offer",
    method: "POST",
    url: "/v1/offers/drafts/matrix-draft/promote",
    payload: { variantId: "variant-2" }
  },
  {
    service: "production",
    method: "POST",
    url: "/v1/production/plans",
    payload: { eventSpec: {} }
  },
  {
    service: "production",
    method: "POST",
    url: "/v1/production/seed-demo"
  },
  {
    service: "production",
    method: "POST",
    url: "/v1/production/recipes/import-text",
    payload: { recipeName: "Matrix Rezept", text: "Zutaten\n1 kg Wasser" }
  },
  {
    service: "production",
    method: "POST",
    url: "/v1/production/recipes/upload"
  },
  {
    service: "production",
    method: "PATCH",
    url: "/v1/production/recipes/matrix-recipe/review",
    payload: { decision: "verify" }
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

describe("mutating MVP route auth matrix", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it.each(mutatingMvpRoutes)(
    "fails closed for $method $url without trusted actor or CATERING_DEV_AUTH",
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
          url: route.url,
          payload: route.payload as object | string | Buffer | undefined
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    }
  );

  it("rejects wrong roles and accepts the correct role for critical intake mutations", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildIntakeApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET, env: {} });

    try {
      const wrongNormalize = await inject(app, {
        method: "POST",
        url: "/v1/intake/normalize",
        headers: trustedHeaders("Angebots-Mitarbeiter"),
        payload: { text: "Lunch fuer 20 Personen.", requestId: "matrix-intake-positive" }
      });
      expect(wrongNormalize.statusCode).toBe(403);

      const correctNormalize = await inject(app, {
        method: "POST",
        url: "/v1/intake/normalize",
        headers: trustedHeaders("Intake-Mitarbeiter"),
        payload: { text: "Lunch fuer 20 Personen.", requestId: "matrix-intake-positive" }
      });
      expect(correctNormalize.statusCode).toBe(201);
      const requestId = correctNormalize.json<{ eventRequest: { requestId: string } }>().eventRequest.requestId;

      const wrongArchive = await inject(app, {
        method: "POST",
        url: `/v1/intake/requests/${requestId}/archive`,
        headers: trustedHeaders("Angebots-Mitarbeiter"),
        payload: { reasonCode: "wrong_upload" }
      });
      expect(wrongArchive.statusCode).toBe(403);

      const correctArchive = await inject(app, {
        method: "POST",
        url: `/v1/intake/requests/${requestId}/archive`,
        headers: trustedHeaders("Intake-Mitarbeiter"),
        payload: { reasonCode: "wrong_upload" }
      });
      expect(correctArchive.statusCode).toBe(200);

      const wrongFinalize = await inject(app, {
        method: "POST",
        url: "/v1/intake/spec-governance/finalize",
        headers: trustedHeaders("Intake-Mitarbeiter"),
        payload: { specId: "matrix-spec", confirmCriticalFinalize: true }
      });
      expect(wrongFinalize.statusCode).toBe(403);

      const correctFinalize = await inject(app, {
        method: "POST",
        url: "/v1/intake/spec-governance/finalize",
        headers: trustedHeaders("Betriebs-/Audit-Operator"),
        payload: { specId: "matrix-spec", confirmCriticalFinalize: true }
      });
      expect(correctFinalize.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("rejects wrong roles and accepts the correct role for critical offer mutations", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildOfferApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET, env: {} });

    try {
      const wrongDraft = await inject(app, {
        method: "POST",
        url: "/v1/offers/from-text",
        headers: trustedHeaders("Produktions-Mitarbeiter"),
        payload: { text: "Business Lunch fuer 35 Personen.", requestId: "matrix-offer-positive" }
      });
      expect(wrongDraft.statusCode).toBe(403);

      const correctDraft = await inject(app, {
        method: "POST",
        url: "/v1/offers/from-text",
        headers: trustedHeaders("Angebots-Mitarbeiter"),
        payload: { text: "Business Lunch fuer 35 Personen.", requestId: "matrix-offer-positive" }
      });
      expect(correctDraft.statusCode).toBe(201);
      const draftId = correctDraft.json<{ draftId: string }>().draftId;

      const wrongPromote = await inject(app, {
        method: "POST",
        url: `/v1/offers/drafts/${draftId}/promote`,
        headers: trustedHeaders("Produktions-Mitarbeiter"),
        payload: { variantId: "variant-2" }
      });
      expect(wrongPromote.statusCode).toBe(403);

      const correctPromote = await inject(app, {
        method: "POST",
        url: `/v1/offers/drafts/${draftId}/promote`,
        headers: trustedHeaders("Angebots-Mitarbeiter"),
        payload: { variantId: "variant-2" }
      });
      expect(correctPromote.statusCode).toBe(201);

      const wrongSeed = await inject(app, {
        method: "POST",
        url: "/v1/offers/seed-demo",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(wrongSeed.statusCode).toBe(403);

      const correctSeed = await inject(app, {
        method: "POST",
        url: "/v1/offers/seed-demo",
        headers: trustedHeaders("Betriebs-/Audit-Operator")
      });
      expect(correctSeed.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });

  it("rejects wrong roles and accepts the correct role for critical production mutations", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildProductionApp({ dataRoot, trustedActorSecret: TRUSTED_SECRET, env: {} });

    try {
      const wrongPlan = await inject(app, {
        method: "POST",
        url: "/v1/production/plans",
        headers: trustedHeaders("Angebots-Mitarbeiter"),
        payload: { eventSpec: productionEventSpec() }
      });
      expect(wrongPlan.statusCode).toBe(403);

      const correctPlan = await inject(app, {
        method: "POST",
        url: "/v1/production/plans",
        headers: trustedHeaders("Produktions-Mitarbeiter"),
        payload: { eventSpec: productionEventSpec() }
      });
      expect(correctPlan.statusCode).toBe(201);

      const wrongRecipeImport = await inject(app, {
        method: "POST",
        url: "/v1/production/recipes/import-text",
        headers: trustedHeaders("Angebots-Mitarbeiter"),
        payload: { recipeName: "Matrix Rezept", text: "Zutaten\n1 kg Wasser\nZubereitung\n1. Kochen." }
      });
      expect(wrongRecipeImport.statusCode).toBe(403);

      const correctRecipeImport = await inject(app, {
        method: "POST",
        url: "/v1/production/recipes/import-text",
        headers: trustedHeaders("Produktions-Mitarbeiter"),
        payload: { recipeName: "Matrix Rezept", text: "Zutaten\n1 kg Wasser\nZubereitung\n1. Kochen." }
      });
      expect(correctRecipeImport.statusCode).toBe(201);

      const wrongSeed = await inject(app, {
        method: "POST",
        url: "/v1/production/seed-demo",
        headers: trustedHeaders("Produktions-Mitarbeiter")
      });
      expect(wrongSeed.statusCode).toBe(403);

      const correctSeed = await inject(app, {
        method: "POST",
        url: "/v1/production/seed-demo",
        headers: trustedHeaders("Betriebs-/Audit-Operator")
      });
      expect(correctSeed.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });

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
