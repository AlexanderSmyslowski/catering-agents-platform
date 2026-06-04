import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gapAuditPath = "docs/product/C11_10_10_GAP_AUDIT.md";
const gapAudit = existsSync(gapAuditPath) ? readFileSync(gapAuditPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("C11 10/10 gap audit contract", () => {
  it("anchors the 10/10 gap audit as documentation and contract only", () => {
    expect(existsSync(gapAuditPath)).toBe(true);
    expect(gapAudit).toContain("C11 10/10-Gap-Audit");
    expect(gapAudit).toContain("Status: Doku-/Vertragstest-only Gap-Audit");
    expect(gapAudit).toContain("keine echten Daten");
    expect(gapAudit).toContain("kein Deployment");
    expect(gapAudit).toContain("keine Auth-/LLM-/Persistenz-/API-Umsetzung");
  });

  it("requires a hard separation of implementation status categories", () => {
    for (const category of [
      "umgesetzt",
      "getestet",
      "dokumentiert",
      "geplant",
      "offen",
      "blockiert",
      "Entscheidung erforderlich"
    ]) {
      expect(gapAudit).toContain(category);
    }
  });

  it("keeps the proven 9/10 internal rehearsal scope explicit", () => {
    for (const anchor of [
      "Interner synthetischer Rehearsal-Kern",
      "Start -> Angebot -> Produktion -> Rueckfragen -> Produktionsplan -> Einkaufsliste -> Export",
      "Fehlupload, Soft-Archiv, Reload, Clear, stale Ergebniszonen",
      "`npm run browser:rehearsal:full-fresh`",
      "`npm test`",
      "`npm run build`",
      "Main-CI"
    ]) {
      expect(gapAudit).toContain(anchor);
    }
  });

  it("keeps all real 10/10 gates blocked or decision-required", () => {
    for (const gate of [
      "echte Daten und echte Google-Drive-Angebote",
      "Auth/OIDC/IAP/Proxy",
      "PII/Retention/Backup/Restore",
      "Sandbox/Worker/AV",
      "Deployment und Betriebsverantwortung",
      "echte `ConversationSession`-Runtime",
      "LLM-Provider, Kosten, Logging, Secrets und Datenuebertragung",
      "Tool-Orchestrierung mit Schreibwirkung",
      "Human Approval"
    ]) {
      expect(gapAudit).toContain(gate);
    }
  });

  it("keeps PA41 complete and redirects autonomous progress back to non-gated quality slices", () => {
    expect(gapAudit).toContain("PA41 hat die `Alexander-Entscheidungsvorlage fuer den ersten echten LLM-Slice` bereits geliefert");
    expect(gapAudit).toContain("providerlosen PA26-PA40-Korridor als abgeschlossen behandeln");
    expect(gapAudit).toContain("PA41 als vorhandene Entscheidungsvorlage");
    expect(gapAudit).toContain("Boundary-, State-, Selector-, Action- oder Smoke-/Rehearsal-Schnitt");

    for (const forbidden of [
      "keine echten Daten",
      "keine Runtime-`ConversationSession`",
      "keine Write-Tools",
      "keine neue API",
      "keine Persistenz",
      "keine Schreibwirkung"
    ]) {
      expect(gapAudit).toContain(forbidden);
    }
  });

  it("keeps the gap audit discoverable from core references", () => {
    expect(readme).toContain(gapAuditPath);
    expect(testing).toContain(gapAuditPath);
    expect(testing).toContain("tests/c11-10-10-gap-audit-contract.test.ts");
    expect(memory).toContain(gapAuditPath);
  });
});
