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
    expect(script).toContain("Browser-Navigations- und Markerpruefung");
    expect(script).toContain("click_rehearsal_link");
    expect(script).toContain("keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage");
  });

  it("does not pretend that the public Playwright CLI supports the Codex browser session protocol", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("Browser-Rehearsal benoetigt die Codex-kompatible Browser-CLI");
    expect(script).toContain("CATERING_BROWSER_CLI");
    expect(script).toContain("Die oeffentliche Playwright-CLI ist kein kompatibler Fallback");
    expect(script).not.toContain("npx --yes --package @playwright/cli playwright-cli");
  });

  it("guards the route, export and audit markers that make the synthetic core path browser-checkable", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    for (const marker of [
      "Internes Beta-Kontrollzentrum",
      "Beta-Weg: Start → Angebot → Produktion → Rückfragen → Exporte/Audit.",
      "Kundenanfrage einfügen und ruhigen Entwurf erzeugen",
      "Angebotsagent öffnen",
      "Zur Produktion",
      "Was braucht die Produktion als Nächstes?",
      "Produktionsobjekte und Downloads prüfen",
      "Produktionsblatt exportieren",
      "Einkaufsliste exportieren",
      "Plan-Kontext: planId",
      "purchaseListId:",
      "Audit-Spur",
      "/api/exports/v1/exports/production-plans/",
      "/api/exports/v1/exports/purchase-lists/"
    ]) {
      expect(script).toContain(marker);
    }
  });

  it("requires the browser flow to navigate through visible app links instead of route-only checks", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("Start -> Angebot");
    expect(script).toContain("Angebot -> Produktion");
    expect(script).toContain("local attempts=30");
    expect(script).toContain("wartet auf ${target_path}");
    expect(script).toContain("navigierte nicht stabil nach ${target_path}");
    expect(script).toContain("click_rehearsal_link \"Start -> Angebot\" \"/angebot\"");
    expect(script).toContain("click_rehearsal_link \"Angebot -> Produktion\" \"/produktion\"");
    expect(script).toContain("link.click()");
  });

  it("guards current production context against stale artifact confusion", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("aktueller Plan-Kontext fehlt");
    expect(script).toContain("aktueller Produktionsplan-Exportlink passt nicht");
    expect(script).toContain("aktueller Einkaufslisten-Kontext fehlt");
    expect(script).toContain("aktueller Einkaufslisten-Exportlink passt nicht");
    expect(script).toContain("ältere Listen sind kein aktueller Vorgang");
    expect(script).toContain("nicht das aktuelle Ergebnis");
  });
});
