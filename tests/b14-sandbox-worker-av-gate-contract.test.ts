import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b14Path = "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md";
const b14Doc = existsSync(b14Path) ? readFileSync(b14Path, "utf8") : "";
const b10Doc = readFileSync("docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md", "utf8");
const b11Doc = readFileSync("docs/product/B11_LOCAL_DEMO_PILOT_ACCEPTANCE_RUN.md", "utf8");
const b12Doc = readFileSync("docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md", "utf8");
const b13Doc = readFileSync("docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md", "utf8");
const pa14Test = readFileSync("tests/pa14-document-ingestion-corridor-readiness.test.ts", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B14 sandbox/worker/AV gate contract", () => {
  it("adds a narrow decision anchor without implementing sandbox, worker, AV, parser, API, persistence, or runtime", () => {
    expect(existsSync(b14Path)).toBe(true);
    expect(b14Doc).toContain("B14 Sandbox/Worker/AV-Gate");
    expect(b14Doc).toContain("Doku-/Vertragstest-only");

    for (const outOfScope of [
      "keine Sandbox-Implementierung",
      "keine Worker-Isolation-Implementierung",
      "keine Antivirus-/Malware-Scan-Implementierung",
      "keine neue Parser-/OCR-/LLM-Engine",
      "keine neue Upload-/Ingestion-Produktlogik",
      "keine neue API",
      "keine neue Persistenz",
      "keine Migration",
      "keine neue Runtime",
      "keine produktionsnahe Dateiverarbeitungsfreigabe",
      "keine rechtssichere Compliance-Behauptung",
      "keine Multi-Tenancy-/White-Label-/Plattform-Erweiterung"
    ]) {
      expect(b14Doc).toContain(outOfScope);
    }
  });

  it("keeps demo ingestion/upload green signals separate from production-like arbitrary file processing", () => {
    for (const boundary of [
      "aktueller Demo-/Ingestion-/Upload-Korridor ist intern/testbezogen",
      "keine produktionsnahe Verarbeitung beliebiger Dateien",
      "Health-/Demo-/Read-only-Export-Gruensignale ersetzen keine Sandbox/AV-Freigabe",
      "PA14 DocumentIngestion-Korridor bleibt read-only Abnahmeanker",
      "Produktionsnahe Verarbeitung echter Uploads bleibt `blocked`",
      "Sandbox/Worker-Isolation/AV bzw. Malware-Scan-Entscheidung"
    ]) {
      expect(b14Doc).toContain(boundary);
    }
  });

  it("requires the minimal missing file-processing decisions before real uploads are processed", () => {
    for (const requiredDecision of [
      "erlaubte Dateitypen",
      "Groessenlimits",
      "Quarantaene-/Reject-Verhalten",
      "Scan-/Sandbox-Verantwortung",
      "Fehler-/Warnpfad",
      "Worker-Isolation",
      "Timeout-/Ressourcenlimit",
      "Betreiber-/Betriebsverantwortung"
    ]) {
      expect(b14Doc).toContain(requiredDecision);
    }
  });

  it("protects safe metadata-only evidence without claiming raw text, hash, or file-content release", () => {
    for (const noLeakBoundary of [
      "keine Rohtext-Leaks",
      "keine Vollhash-Leaks",
      "keine Dateiinhalts-Leaks",
      "UI/Logs/Exports behaupten daraus keine Freigabe",
      "sichere Metadaten-/Warnmarker",
      "gekürzte Quellenmetadaten"
    ]) {
      expect(b14Doc).toContain(noLeakBoundary);
    }

    expect(pa14Test).toContain("not.toContain(\"PA14 Rohtext\")");
    expect(pa14Test).toContain("sourceMetadata");
  });

  it("keeps B13 separate and B10/B11/B12 production-like pilot use blocked without the gate", () => {
    expect(b14Doc).toContain("B13 PII/Retention/Backup bleibt separat");
    expect(b14Doc).toContain("B14 loest Datenschutz/Backup nicht");
    expect(b13Doc).toContain("B13 PII/Retention/Backup-Gate");

    for (const doc of [b10Doc, b11Doc, b12Doc]) {
      expect(doc).toContain("B14_SANDBOX_WORKER_AV_GATE.md");
      expect(doc).toContain("produktionsnah");
      expect(doc).toContain("blocked");
    }
  });

  it("keeps B14 discoverable from TESTING", () => {
    expect(testingDoc).toContain("tests/b14-sandbox-worker-av-gate-contract.test.ts");
    expect(testingDoc).toContain("B14 Sandbox/Worker/AV-Gate");
  });
});
