import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adrPath = "docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md";

describe("PA7 auth/read-path decision ADR", () => {
  it("keeps the decision scope as documentation-only and compares the expected options", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("Doku-only; keine Runtime-Implementierung");
    expect(doc).toContain("Option A: Reverse Proxy/OIDC/SSO setzt vertrauenswürdige Header");
    expect(doc).toContain("Option B: Applikationsinterne Session/Auth");
    expect(doc).toContain("Option C: Weiter nur interner trusted-proxy Korridor, aber read-paths härten");
    expect(doc).toContain("Option D: Mischform/Stufenmodell");
    expect(doc).toContain("Primärempfehlung: Option D");
  });

  it("anchors the next slice in read-path auth without introducing login or persistence work", () => {
    const doc = readFileSync(adrPath, "utf8");

    expect(doc).toContain("Alle sensiblen read-only Detail-/Listen-/Exportpfade inventarisieren");
    expect(doc).toContain("Audit: `GET /v1/production/audit/events` bleibt geschützt");
    expect(doc).toContain("Export-Read: Angebots-HTML, Produktionsblatt-HTML und Einkaufsliste-CSV");
    expect(doc).toContain("Dieser Slice darf keine neue Login-, OIDC-, Session-, Persistenz- oder Migrationsebene implementieren.");
    expect(doc).toContain("Der Proxy muss externe `x-catering-*`- und `x-actor-name`-Header entfernen bzw. kontrolliert neu setzen.");
  });
});
