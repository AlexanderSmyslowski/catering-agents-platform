import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildOfferApp } from "@catering/offer-service";

const TRUSTED_SECRET = "uni-packages-api-secret";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "uni-packages-offer-api-"));
}

const trustedHeaders = (actorName: string) => ({
  "x-catering-actor-name": actorName,
  "x-catering-trusted-secret": TRUSTED_SECRET
});

describe("Uni package offer API", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("requires the offer operator role for Uni package reads", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildOfferApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/offers/uni-packages?pax=50"
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ message: "Angebots-Operator erforderlich." });
    } finally {
      await app.close();
    }
  });

  it("exposes the existing pax and event type selection behavior over HTTP", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildOfferApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET });

    try {
      const tooSmall = await app.inject({
        method: "GET",
        url: "/v1/offers/uni-packages?pax=10",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(tooSmall.statusCode).toBe(200);
      expect(tooSmall.json<{ items: Array<{ id: string }> }>().items).toEqual([]);

      const minimum = await app.inject({
        method: "GET",
        url: "/v1/offers/uni-packages?pax=12",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(minimum.statusCode).toBe(200);
      expect(minimum.json<{ items: Array<{ id: string }> }>().items.map((item) => item.id)).toEqual([
        "uni_quick_lunch"
      ]);

      const posterSession = await app.inject({
        method: "GET",
        url: "/v1/offers/uni-packages?eventType=Poster%20Session&pax=200",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(posterSession.statusCode).toBe(200);
      expect(posterSession.json<{ items: Array<{ id: string }> }>().items.map((item) => item.id)).toContain(
        "uni_reception_gettogether"
      );
    } finally {
      await app.close();
    }
  });

  it("returns side cost estimates with the package options", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildOfferApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/offers/uni-packages?pax=50&deliveries=1&staffHours=19.5",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        input: {
          pax: 50,
          deliveries: 1,
          staffHours: 19.5
        },
        sideCosts: {
          transport: 150,
          staff: 888.23,
          total: 1038.23
        }
      });
      expect(response.json<{ items: Array<{ id: string }> }>().items).toHaveLength(6);
    } finally {
      await app.close();
    }
  });

  it("rejects invalid query parameters without falling back to guessed values", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildOfferApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET });

    try {
      const missingPax = await app.inject({
        method: "GET",
        url: "/v1/offers/uni-packages",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(missingPax.statusCode).toBe(400);
      expect(missingPax.json()).toEqual({ message: "pax muss als positive Zahl übergeben werden." });

      const fractionalDeliveries = await app.inject({
        method: "GET",
        url: "/v1/offers/uni-packages?pax=50&deliveries=1.5",
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(fractionalDeliveries.statusCode).toBe(400);
      expect(fractionalDeliveries.json()).toEqual({ message: "deliveries muss als ganze Zahl übergeben werden." });
    } finally {
      await app.close();
    }
  });
});
