import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const boundaryPath = "docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md";
const pa6Path = "docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md";
const testingPath = "TESTING.md";

describe("B8 auth gate decision boundary", () => {
  it("separates implemented trusted read-path protection from still-open production auth decisions", () => {
    const doc = readFileSync(boundaryPath, "utf8");

    expect(doc).toContain("## Tatsaechlich umgesetzt / intern geschuetzt");
    expect(doc).toContain("PA8 Read-path Auth Hardening Slice 1");
    expect(doc).toContain("`CATERING_TRUSTED_ACTOR_SECRET` aktiviert den Trusted-Actor-Modus");
    expect(doc).toContain("frei gesetztes `x-actor-name` reicht bei gesetztem Secret nicht aus");
    expect(doc).toContain("Health-Endpunkte bleiben offen, solange sie keine sensiblen Daten liefern");

    expect(doc).toContain("## Read-only Pfade am Trusted-Actor-/internen Kontext");
    expect(doc).toContain("Intake-Read: Requests und Specs");
    expect(doc).toContain("Offer-Read: Drafts und Rezepte");
    expect(doc).toContain("Production-Read: Plaene, Einkaufslisten und Rezepte");
    expect(doc).toContain("Export-Read: Angebots-HTML, Produktionsplan-/Produktionsblatt-HTML und Einkaufslisten-CSV");
    expect(doc).toContain("Audit-Read: `GET /v1/production/audit/events`");
  });

  it("marks paths that must not be used production-near before Alexander decides the auth corridor", () => {
    const doc = readFileSync(boundaryPath, "utf8");

    expect(doc).toContain("## Nicht produktionsnah nutzbar ohne naechste Auth-Entscheidung");
    expect(doc).toContain("direkte oeffentliche Service-Exposition");
    expect(doc).toContain("echte Daten in Detail-, Export- oder Auditpfaden ohne vorgeschalteten Proxy/IAP");
    expect(doc).toContain("Deployments ohne serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`");
    expect(doc).toContain("Trusted-Actor allein ist keine echte Nutzer-AuthN");
    expect(doc).toContain("keine produktionsnahe Freigabe");
  });

  it("states the next minimal decision and keeps forbidden implementation scope out", () => {
    const doc = readFileSync(boundaryPath, "utf8");

    expect(doc).toContain("## Minimalentscheidung fuer Alexander als B9-Einstieg");
    expect(doc).toContain("Soll B9 den kleinsten produktionsnahen Auth-Korridor als Reverse-Proxy/OIDC-/Identity-Aware-Proxy-Korridor festlegen");
    expect(doc).toContain("weiterhin nur vorhandene Trusted-Actor-/Rollenpruefung in den Services nutzen");
    expect(doc).toContain("keine applikationsinterne Login-/Session-Welt");

    expect(doc).toContain("## Out of scope fuer B8 und die Entscheidungsvorbereitung");
    expect(doc).toContain("kein OIDC-/Login-Bau");
    expect(doc).toContain("keine externe Rollen-/Mandantenlogik");
    expect(doc).toContain("keine neue Exportlogik");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine neue Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine rechtssichere Audit-/Compliance-Behauptung");
  });

  it("keeps PA6 and TESTING linked to the B8 decision boundary", () => {
    const pa6 = readFileSync(pa6Path, "utf8");
    const testing = readFileSync(testingPath, "utf8");

    expect(pa6).toContain("B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze");
    expect(pa6).toContain("docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md");
    expect(testing).toContain("tests/b8-auth-gate-decision-boundary.test.ts");
    expect(testing).toContain("B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze");
  });
});
