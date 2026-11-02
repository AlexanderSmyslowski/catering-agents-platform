import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { CATERING_SESSION_COOKIE, cateringSessionBinding, deriveCateringAuthKeys } from "../shared-core/src/catering-session-auth.js";
import { hashCateringPin } from "../shared-core/src/catering-pin-crypto.js";
import { CateringUserStore, createCateringUserRecord } from "../shared-core/src/catering-user-store.js";
const xml = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>INV-1</cbc:ID><cbc:IssueDate>2026-10-01</cbc:IssueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Testlieferant</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">10.00</cbc:TaxExclusiveAmount></cac:LegalMonetaryTotal><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="KGM">2.5</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Testware</cbc:Name></cac:Item></cac:InvoiceLine></Invoice>`;
const secret = "synthetic-session-secret-123456789";
const context = { businessId: "alpha" };
const sameOrigin = { host: "catering.test", origin: "https://catering.test" };
const url = "/v1/offers/supplier-invoices/preview";
const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
describe("supplier invoice preview", () => {
  it("enforces session, origin, role and business boundaries and returns only provisional candidates", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "ubl-session-"));
    const userStore = new CateringUserStore({ rootDir });
    const keys = deriveCateringAuthKeys(secret);
    const cookie = async (id: string, role: "offer_operator" | "production_operator", business = context.businessId) => {
      const c = { businessId: business };
      const user = createCateringUserRecord({ businessId: business, userId: id, loginCode: id, displayName: id, role, pinHash: await hashCateringPin("482731"), active: true, now: new Date() });
      expect(await userStore.create(c, user)).toBe("created");
      const now = Math.floor(Date.now() / 1000);
      const header = b64({ alg: "HS256", typ: "JWT" });
      const claims = b64({ sub: id, sessionBinding: cateringSessionBinding({ userId: id, authEpoch: user.authEpoch }, keys.bindingKey), iat: now - 1, exp: now + 3600, iss: "catering-agents-platform", aud: "catering-backoffice" });
      const signature = createHmac("sha256", keys.jwtKey).update(`${header}.${claims}`).digest("base64url");
      return `${CATERING_SESSION_COOKIE}=${header}.${claims}.${signature}`;
    };
    const offerCookie = await cookie("offer", "offer_operator");
    const prodCookie = await cookie("prod", "production_operator");
    const otherCookie = await cookie("other", "offer_operator", "beta");
    const app = buildOfferApp({ rootDir, userStore, trustedActorSecret: secret, env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret } });
    try {
      const send = (headers: Record<string, string>, payload: Record<string, string> = { xml }) => app.inject({ method: "POST", url, headers, payload });
      expect((await send(sameOrigin)).statusCode).toBe(403);
      expect((await send({ ...sameOrigin, cookie: prodCookie })).statusCode).toBe(403);
      expect((await send({ ...sameOrigin, cookie: otherCookie })).statusCode).toBe(403);
      expect((await send({ ...sameOrigin, origin: "https://other.test", cookie: offerCookie })).statusCode).toBe(403);
      const result = await send({ ...sameOrigin, cookie: offerCookie });
      expect(result.statusCode, result.body).toBe(200);
      expect(result.headers["cache-control"]).toBe("private, no-store");
      expect(result.json().candidates[0]).toMatchObject({ supplier: "Testlieferant", quantity: "2.5", lineNetEur: "10.00", reviewRequired: true });
      const invalid = await send({ ...sameOrigin, cookie: offerCookie }, { xml: "<bad>synthetic-private-marker</bad>" });
      expect(invalid.statusCode).toBe(422);
      expect(invalid.body).not.toContain("synthetic-private-marker");
      expect((await send({ ...sameOrigin, cookie: offerCookie }, { xml, unexpected: "x" })).statusCode).toBe(400);
      expect((await send({ ...sameOrigin, cookie: offerCookie }, { xml: "x".repeat(64001) })).statusCode).toBe(413);
    } finally { await app.close(); }
  }, 15000);
});
