import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contractPath = "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md";
const pa9Path = "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md";
const pa6Path = "docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md";
const testingPath = "TESTING.md";

describe("B9 proxy/IAP authn preflight contract", () => {
  it("defines the minimal proxy/IAP preflight gates before production-near exposure", () => {
    const doc = readFileSync(contractPath, "utf8");

    expect(doc).toContain("## Mindestbedingungen vor produktionsnahem Pilot");
    expect(doc).toContain("Header-Stripping am aeusseren Proxy-/IAP-Rand");
    expect(doc).toContain("keine ungeprueften Client-Header als Trusted Actor");
    expect(doc).toContain("kontrollierte Trusted-Header-Injektion ausschliesslich durch Proxy/IAP");
    expect(doc).toContain("serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`");
    expect(doc).toContain("kein clientseitiges oder oeffentliches Secret");
    expect(doc).toContain("keine direkte Service-Exposition der App/API am Proxy vorbei");
  });

  it("keeps health non-sensitive and read-only work evidence behind trusted actor context", () => {
    const doc = readFileSync(contractPath, "utf8");

    expect(doc).toContain("Health-Endpunkte bleiben nicht-sensitiv");
    expect(doc).toContain("keine Kunden-, Event-, Rezept-, Angebots-, Produktions-, Einkaufs- oder Auditdaten");
    expect(doc).toContain("Exporte und read-only Arbeitsbelege bleiben hinter dem Trusted-Actor-/Proxy-Kontext");
    expect(doc).toContain("Angebots-HTML, Produktionsplan-/Produktionsblatt-HTML und Einkaufslisten-CSV");
    expect(doc).toContain("Audit-Read-Pfade bleiben interne Betriebs-/Kontrollnachweise");
  });

  it("states non-goals and prevents production auth/compliance overclaims", () => {
    const doc = readFileSync(contractPath, "utf8");

    expect(doc).toContain("keine Login-/Session-/OIDC-Implementierung in der App");
    expect(doc).toContain("kein echter Proxy-/IAP-Deployment-Code");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine neue Persistenz");
    expect(doc).toContain("keine produktionsreife Auth");
    expect(doc).toContain("keine externe Freigabe");
    expect(doc).toContain("keine rechtssichere Compliance");
  });

  it("links B9 to PA9, PA6 and TESTING as the current contract anchor", () => {
    const contract = readFileSync(contractPath, "utf8");
    const pa9 = readFileSync(pa9Path, "utf8");
    const pa6 = readFileSync(pa6Path, "utf8");
    const testing = readFileSync(testingPath, "utf8");

    expect(contract).toContain("docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md");
    expect(pa9).toContain("B9 Proxy/IAP-AuthN-Preflight-Vertrag");
    expect(pa6).toContain("B9 Proxy/IAP-AuthN-Preflight-Vertrag");
    expect(testing).toContain("tests/b9-proxy-iap-authn-preflight-contract.test.ts");
    expect(testing).toContain("B9 Proxy/IAP-AuthN-Preflight-Vertrag");
  });
});
