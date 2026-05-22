import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flowMapPath = "docs/product/P5_BETA_DURCHLAUF_IST_KARTE.md";
const flowMapDoc = existsSync(flowMapPath) ? readFileSync(flowMapPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");

describe("P5-B49 beta flow map contract", () => {
  it("anchors the user-visible beta flow from start to offer to production to exports and audit", () => {
    expect(existsSync(flowMapPath)).toBe(true);
    expect(flowMapDoc).toContain("P5-B49 Beta-Durchlauf Ist-Karte");
    expect(flowMapDoc).toContain("Start -> Angebot -> Produktion -> Exporte/Audit");

    for (const route of ["/", "/angebot", "/produktion"]) {
      expect(flowMapDoc).toContain(route);
    }

    for (const artifact of [
      "Angebots-HTML",
      "Produktionsblatt-/Produktionsplan-HTML",
      "Einkaufsliste-CSV",
      "Audit-Trail"
    ]) {
      expect(flowMapDoc).toContain(artifact);
    }
  });

  it("separates usable, documented-only, blocked, and testable states", () => {
    for (const section of [
      "Intern nutzbar",
      "Nur dokumentiert / nur intern abnahmefaehig",
      "Blockiert",
      "Schon testbar"
    ]) {
      expect(flowMapDoc).toContain(section);
    }

    for (const blockedBoundary of [
      "keine echten Daten",
      "keine Produktionsfreigabe",
      "kein Deployment",
      "keine SSH-Verbindung",
      "keine neue Persistenz",
      "kein OAuth/Login/OIDC",
      "keine automatische Spec-Korrektur",
      "keine Rezept-/Allergenautomatik"
    ]) {
      expect(flowMapDoc).toContain(blockedBoundary);
    }
  });

  it("keeps the map discoverable from README, TESTING, and C8", () => {
    expect(readmeDoc).toContain("P5_BETA_DURCHLAUF_IST_KARTE.md");
    expect(testingDoc).toContain("tests/p5-b49-beta-flow-map-contract.test.ts");
    expect(testingDoc).toContain("P5-B49 Beta-Durchlauf Ist-Karte");
    expect(c8Doc).toContain("P5_BETA_DURCHLAUF_IST_KARTE.md");
  });
});
