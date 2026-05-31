import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser rehearsal script contract", () => {
  it("keeps the real-browser rehearsal script wired as an explicit optional npm command", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(packageJson.scripts?.["browser:rehearsal"]).toBe("bash ./scripts/check-browser-rehearsal.sh");
    expect(script).toContain("playwright");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_BASE_URL");
    expect(script).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit");
    expect(script).toContain("keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage");
  });

  it("guards the route, export and audit markers that make the synthetic core path browser-checkable", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    for (const marker of [
      "Internes Beta-Kontrollzentrum",
      "Beta-Weg: Start → Angebot → Produktion → Rückfragen → Exporte/Audit.",
      "Kundenanfrage einfügen und ruhigen Entwurf erzeugen",
      "Zur Produktion",
      "Was braucht die Produktion als Nächstes?",
      "Produktionsobjekte und Downloads prüfen",
      "Produktionsblatt exportieren",
      "Einkaufsliste exportieren",
      "Audit-Spur",
      "/api/exports/v1/exports/production-plans/",
      "/api/exports/v1/exports/purchase-lists/"
    ]) {
      expect(script).toContain(marker);
    }
  });
});
