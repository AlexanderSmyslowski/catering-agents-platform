import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adrPath = "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md";

describe("PA9 proxy deployment readiness ADR", () => {
  it("keeps the trusted actor deployment requirements explicit", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("Edge/Reverse Proxy entfernt clientseitig mitgelieferte Trusted-Header");
    expect(doc).toContain("Proxy oder Identity-Aware Proxy setzt Trusted-Header kontrolliert");
    expect(doc).toContain("`CATERING_TRUSTED_ACTOR_SECRET` ist in produktionsnaher Umgebung Pflicht");
    expect(doc).toContain("Das Trusted Secret darf nie an Browser oder Clients ausgeliefert werden");
    expect(doc).toContain("Services duerfen nicht direkt aus dem oeffentlichen Netz erreichbar sein");
  });

  it("anchors health boundaries, preflight checks and non-goals without adding login scope", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("`GET /health` auf Intake, Offer, Production und Export darf offen bleiben");
    expect(doc).toContain("keine Kunden-, Event-, Rezept-, Angebots-, Produktions-, Einkaufs- oder Auditdaten");
    expect(doc).toContain("Ein externer Request mit selbst gesetztem `x-catering-actor-name`, `x-catering-trusted-secret` oder `x-actor-name` wird am Edge entfernt bzw. ueberschrieben.");
    expect(doc).toContain("keine OIDC-/SSO-/OAuth-Implementierung");
    expect(doc).toContain("keine applikationsinterne Login- oder Session-Welt");
  });
});
