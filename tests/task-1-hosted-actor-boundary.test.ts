import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@catering/shared-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@catering/shared-core")>();
  return {
    ...actual,
    hostedMultiBusinessReady: true
  };
});

import { IntakeStore } from "../intake-service/src/store.js";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import { AuditLogStore, RecipeLibrary } from "../shared-core/src/index.js";

const hostedEnv = {
  CATERING_DEPLOYMENT_PROFILE: "hosted",
  CATERING_TRUSTED_ACTOR_SECRET: "task-one-hosted-session-secret-123456"
};

function trustedHeaders(actorName: string) {
  return {
    "x-catering-actor-name": actorName,
    "x-catering-trusted-secret": "task-one-hosted-session-secret-123456"
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hosted builder actor boundary", () => {
  it("rejects Intake before the first store write when the session cookie is missing", async () => {
    const storeAccess = vi.spyOn(IntakeStore.prototype, "saveRequest").mockRejectedValue(new Error("store touched"));
    const app = buildIntakeApp({ env: hostedEnv });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/intake/seed-demo",
        headers: trustedHeaders("Betriebs-/Audit-Operator")
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: "Ungültige Sitzung." });
      expect(storeAccess).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects Offer before the first store read when the session cookie is missing", async () => {
    const storeAccess = vi.spyOn(RecipeLibrary.prototype, "list").mockRejectedValue(new Error("store touched"));
    const app = buildOfferApp({ env: hostedEnv });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/offers/recipes",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: "Ungültige Sitzung." });
      expect(storeAccess).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects Production before the first store read when the session cookie is missing", async () => {
    const storeAccess = vi.spyOn(AuditLogStore.prototype, "listRecentFor").mockRejectedValue(new Error("store touched"));
    const app = buildProductionApp({ env: hostedEnv });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/production/audit/events",
        headers: trustedHeaders("Betriebs-/Audit-Operator")
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: "Ungültige Sitzung." });
      expect(storeAccess).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects Print Export before the first store read when the session cookie is missing", async () => {
    const storeAccess = vi.spyOn(OfferStore.prototype, "getDraft").mockRejectedValue(new Error("store touched"));
    const app = buildPrintExportApp({ env: hostedEnv });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/exports/offers/missing/html",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: "Ungültige Sitzung." });
      expect(storeAccess).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
