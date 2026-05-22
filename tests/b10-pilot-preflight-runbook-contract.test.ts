import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runbookPath = "docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md";
const b9Path = "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md";
const testingPath = "TESTING.md";

describe("B10 pilot preflight runbook contract", () => {
  it("names the concrete target environment frame without claiming implementation", () => {
    const doc = readFileSync(runbookPath, "utf8");

    expect(doc).toContain("## Zielumgebung und Betreiberrahmen");
    expect(doc).toContain("Zielumgebung");
    expect(doc).toContain("Betreiber");
    expect(doc).toContain("Proxy-/IAP-Rahmen");
    expect(doc).toContain("noch nicht implementiert");
    expect(doc).toContain("keine neue Runtime");
    expect(doc).toContain("kein Deployment-Code");
  });

  it("makes every B9 must-condition assessable with explicit result states", () => {
    const doc = readFileSync(runbookPath, "utf8");

    expect(doc).toContain("Ergebniszustand");
    expect(doc).toContain("`go`");
    expect(doc).toContain("`blocked`");
    expect(doc).toContain("`not assessed`");
    expect(doc).toContain("direkte Service-Exposition");
    expect(doc).toContain("Header-Stripping am aeusseren Rand");
    expect(doc).toContain("Trusted-Header-Injektion erfolgt nur durch Proxy/IAP");
    expect(doc).toContain("`CATERING_TRUSTED_ACTOR_SECRET` ist serverseitig gesetzt");
    expect(doc).toContain("Health-Endpunkte bleiben nicht-sensitiv");
    expect(doc).toContain("Exporte/read-only Arbeitsbelege bleiben hinter Trusted-Actor-/Proxy-Kontext");
  });

  it("keeps compliance and release gates separate and blocks unfilled preflight release", () => {
    const doc = readFileSync(runbookPath, "utf8");

    expect(doc).toContain("PII");
    expect(doc).toContain("Retention");
    expect(doc).toContain("Backup");
    expect(doc).toContain("Sandbox");
    expect(doc).toContain("AV");
    expect(doc).toContain("separate Gates");
    expect(doc).toContain("nicht durch B10 geloest");
    expect(doc).toContain("Keine produktionsnahe Freigabe ohne ausgefuellten und erfuellten Preflight");
    expect(doc).toContain("keine rechtssichere Compliance-Behauptung");
  });

  it("links the runbook from B9 and TESTING as the current pilot preflight anchor", () => {
    const b9 = readFileSync(b9Path, "utf8");
    const testing = readFileSync(testingPath, "utf8");

    expect(b9).toContain("B10 Pilot-Preflight-Runbook");
    expect(testing).toContain("tests/b10-pilot-preflight-runbook-contract.test.ts");
    expect(testing).toContain("B10 Pilot-Preflight-Runbook");
  });
});
