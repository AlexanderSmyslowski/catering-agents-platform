import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const c8AcceptanceDoc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const pa9Adr = readFileSync("docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md", "utf8");
const pa8ReadPathAuthTest = readFileSync("tests/pa8-read-path-auth.test.ts", "utf8");

describe("B6 trusted actor export acceptance boundary", () => {
  it("keeps the three existing read-only export artifacts tied to PA8 trusted actor coverage", () => {
    for (const requiredExportPath of [
      "/v1/exports/offers/${draftId}/html",
      "/v1/exports/production-plans/${planId}/html",
      "/v1/exports/purchase-lists/${purchaseListId}/csv"
    ]) {
      expect(pa8ReadPathAuthTest).toContain(requiredExportPath);
    }

    for (const requiredArtifact of ["Angebots-HTML", "Produktionsblatt-/Produktionsplan-HTML", "Einkaufslisten-CSV"]) {
      expect(c8AcceptanceDoc).toContain(requiredArtifact);
      expect(testingDoc).toContain(requiredArtifact);
    }
  });

  it("documents exports as internal work evidence under trusted actor context without release or compliance claims", () => {
    for (const doc of [c8AcceptanceDoc, testingDoc, pa9Adr]) {
      expect(doc).toContain("interne read-only Arbeitsbelege");
      expect(doc).toContain("Trusted-Actor-Kontext");
      expect(doc).toContain("keine externe Freigabe");
      expect(doc).toContain("keine Produktionsfreigabe");
      expect(doc).toContain("keine rechtssichere Audit-/Compliance-Behauptung");
      expect(doc).toContain("kein OIDC/Login");
    }
  });
});
