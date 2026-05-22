import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const b11Path = "docs/product/B11_LOCAL_DEMO_PILOT_ACCEPTANCE_RUN.md";
const b11Doc = existsSync(b11Path) ? readFileSync(b11Path, "utf8") : "";
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const b10Doc = readFileSync("docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B11 local demo/pilot data acceptance run contract", () => {
  it("adds a discoverable B11 acceptance-run anchor without introducing product runtime", () => {
    expect(existsSync(b11Path)).toBe(true);
    expect(b11Doc).toContain("B11 Lokaler Demo-/Pilotdaten-Abnahmedurchlauf");
    expect(b11Doc).toContain("Doku-/Vertragstest-only");
    expect(b11Doc).toContain("keine neue Produktlogik");
    expect(b11Doc).toContain("keine neue API");
    expect(b11Doc).toContain("keine neue Persistenz");
    expect(b11Doc).toContain("keine neue Exportlogik");
  });

  it("binds the run to existing local commands, demo smokes, export proofs, and standard gates", () => {
    expect(packageJson.scripts["local:status"]).toBe("bash ./scripts/status-local-stack.sh");
    expect(packageJson.scripts["local:check"]).toBe("bash ./scripts/check-local-ops.sh");
    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts.build).toContain("tsc --noEmit");

    for (const requiredAnchor of [
      "`npm run local:status`",
      "`npm run local:check`",
      "tests/backoffice-route-smoke.test.ts",
      "tests/backoffice-production-acceptance-smoke.test.ts",
      "tests/backoffice-internal-usage-smoke.test.ts",
      "tests/pa8-read-path-auth.test.ts",
      "tests/pa14-document-ingestion-corridor-readiness.test.ts",
      "Angebots-HTML",
      "Produktionsblatt-/Produktionsplan-HTML",
      "Einkaufslisten-CSV",
      "Demo-Start-/Auditbeleg",
      "`npm test`",
      "`npm run build`",
      "`npm audit --omit=dev`",
      "`git diff --check`"
    ]) {
      expect(b11Doc).toContain(requiredAnchor);
    }
  });

  it("defines go, blocked, and not assessed without allowing local green to mean production readiness", () => {
    for (const requiredAnchor of ["`go`", "`blocked`", "`not assessed`", "Gesamtzustand"]) {
      expect(b11Doc).toContain(requiredAnchor);
    }

    expect(b11Doc).toContain("Ein gruenes lokales B11-Ergebnis bedeutet nur interne Demo-/Abnahmefaehigkeit");
    expect(b11Doc).toContain("kein produktionsnaher Pilot-Go");
    expect(b11Doc).toContain("Fehlende Nachweise bleiben `not assessed`");
    expect(b11Doc).toContain("rote Muss-Gates bleiben `blocked`");
  });

  it("keeps production-like pilot use blocked without B10, PII/retention/backup, and sandbox/AV gates", () => {
    for (const requiredAnchor of [
      "B10 Pilot-Preflight-Runbook",
      "PII",
      "Retention",
      "Backup",
      "Sandbox",
      "AV",
      "produktionsnaher Pilot bleibt `blocked`",
      "keine rechtssichere Compliance-/Audit-Freigabe"
    ]) {
      expect(b11Doc).toContain(requiredAnchor);
    }

    expect(b10Doc).toContain("Keine produktionsnahe Freigabe ohne ausgefuellten und erfuellten Preflight");
    expect(b10Doc).toContain("PII, Retention, Backup, Sandbox und AV sind separate Gates");
  });

  it("keeps C8 and TESTING pointing at the B11 acceptance classification", () => {
    expect(c8Doc).toContain("B11_LOCAL_DEMO_PILOT_ACCEPTANCE_RUN.md");
    expect(testingDoc).toContain("tests/b11-local-demo-pilot-acceptance-contract.test.ts");
    expect(testingDoc).toContain("B11 Lokaler Demo-/Pilotdaten-Abnahmedurchlauf");
  });
});
