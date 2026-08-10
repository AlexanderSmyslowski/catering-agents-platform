import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";

const trustedSecret = "offer-approval-test-secret";
const trustedHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "local"
};

function buildTestApp() {
  return buildOfferApp({
    rootDir: mkdtempSync(path.join(tmpdir(), "catering-offer-approval-")),
    trustedActorSecret: trustedSecret
  });
}

async function createDraft(app: ReturnType<typeof buildTestApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers: trustedHeaders,
    payload: { text: "Business Lunch fuer 35 Personen." }
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
}

describe("offer approval request", () => {
  it("creates an approved offer only after explicit variant approval", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "approved", variantId: draft.variantSet[1]?.variantId, decidedBy: "spoofed" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ approval: { decidedBy: { name: string } } }>().approval.decidedBy.name).toBe("Angebots-Mitarbeiter");
    expect(response.json<{ approvedOffer: { selectedVariantId: string } }>().approvedOffer.selectedVariantId)
      .toBe(draft.variantSet[1]?.variantId);
  });

  it("does not create an approved offer for a rejected draft", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders,
      payload: { decision: "rejected" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).not.toHaveProperty("approvedOffer");
  });

  it("does not expose a draft from another business", async () => {
    const app = buildTestApp();
    const draft = await createDraft(app);

    const response = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: { ...trustedHeaders, "x-catering-business-id": "other" },
      payload: { decision: "approved", variantId: draft.variantSet[0]?.variantId }
    });

    expect(response.statusCode).toBe(404);
  });
});
