import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/product/C9_FEHLUPLOAD_ARCHIV_LOESCH_ENTSCHEIDUNG.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
const testing = existsSync("TESTING.md") ? readFileSync("TESTING.md", "utf8") : "";
const memory = existsSync("memory.md") ? readFileSync("memory.md", "utf8") : "";

const leadingInputs = [
  "docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md",
  "docs/product/P6_AUFBEWAHRUNG_LOESCHUNG_ARCHIVIERUNG_MINISPEZ.md",
  "docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md",
  "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md",
  "scripts/check-local-ops.sh"
];

const hardBoundaries = [
  "keine Runtime-Implementierung",
  "keine neue API",
  "keine neue Persistenz",
  "keine Migration",
  "keine Backend-Archivierung",
  "keine Datenloeschung",
  "keine automatische Bereinigung",
  "keine echten Daten",
  "keine echten Uploads",
  "keine Retention-/Backup-/Restore-Implementierung",
  "keine Sandbox-/Worker-/AV-Implementierung",
  "keine Deployment- oder Serveraenderung",
  "keine Auth-/OIDC-/IAP-Aenderung"
];

describe("C9 Fehlupload archive/delete decision contract", () => {
  it("creates a decision-only anchor for backend Fehlupload handling", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("C9 Fehlupload-Archiv-/Loeschentscheidung");
    expect(doc).toContain("Status: Doku-/Vertragstest-only Entscheidungsvorlage");
    expect(doc).toContain("Backend-Pfad fuer Fehluploads im internen MVP-Korridor");
    expect(doc).toContain("Ziel ist eine entscheidbare Grenze fuer spaeteren Code");
  });

  it("uses the existing product, retention, upload and local rehearsal gates as inputs", () => {
    for (const input of leadingInputs) {
      expect(doc).toContain(input);
    }
  });

  it("compares status quo, soft archive and hard delete with a clear recommendation", () => {
    expect(doc).toContain("Option A: Status quo plus UI-Arbeitsbereich leeren");
    expect(doc).toContain("Option B: Soft-Archiv aus aktivem Arbeitsfokus");
    expect(doc).toContain("Option C: Hard-Delete");
    expect(doc).toContain("Empfehlung: Option B, Soft-Archiv aus aktivem Arbeitsfokus");
    expect(doc).toContain("Option A als sicherer Default");
    expect(doc).toContain("erst nach explizitem Alexander-Go");
  });

  it("keeps the decision bounded away from implementation and real data gates", () => {
    for (const boundary of hardBoundaries) {
      expect(doc).toContain(boundary);
    }

    expect(doc).toContain("keine Retention-/Compliance-Freigabe");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine Hard-Delete-Kaskade");
  });

  it("defines the smallest allowed follow-up block without granting it", () => {
    expect(doc).toContain("Minimaler technischer Folgeblock nach Go");
    expect(doc).toContain("nur Soft-Archiv, kein Hard-Delete");
    expect(doc).toContain("archivierter Fehlupload erscheint nicht mehr als aktiver Vorgang");
    expect(doc).toContain("Abbruchkriterien");
    expect(doc).toContain("neue Persistenzwelt oder Migration wird noetig");
  });

  it("is discoverable from README, TESTING and memory", () => {
    expect(readme).toContain("docs/product/C9_FEHLUPLOAD_ARCHIV_LOESCH_ENTSCHEIDUNG.md");
    expect(testing).toContain("C9 Fehlupload-Archiv-/Loeschentscheidung");
    expect(memory).toContain("C9 Fehlupload-Archiv-/Loeschentscheidung");
  });
});
