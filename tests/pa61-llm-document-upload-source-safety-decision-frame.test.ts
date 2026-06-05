import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA61_LLM_DOCUMENT_UPLOAD_SOURCE_SAFETY_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const normalizedDoc = doc.replace(/\s+/g, " ");
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA61 LLM document/upload source safety decision frame", () => {
  it("anchors the new source-material frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA61 LLM Dokument-/Upload-Quellen-Sicherheitsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine Sandbox-Implementierung");
    expect(doc).toContain("keine Worker-Isolation");
    expect(doc).toContain("keine AV-Implementierung");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("uses PA54, PA14 and B14 as leading anchors for source safety", () => {
    for (const anchor of [
      "PA54 blockiert Rohdokumente, E-Mails, PDFs und ganze Specs",
      "B14 bleibt fuehrendes Gate fuer echte oder beliebige Uploads",
      "PA14 bleibt read-only Nachweisanker",
      "Tool-, Runtime-, Evidence- und Human-Approval-Schwesterrahmen"
    ]) {
      expect(normalizedDoc).toContain(anchor);
    }
  });

  it("recommends keeping provider-capable draft paths free from direct uploads and raw document material", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "keine direkten Upload-Payloads fuer Intake-, Offer- oder Production-Pfade",
      "keine PDFs, E-Mails, Pages-Dateien",
      "Dateibloecke bleiben ausserhalb des Providerpfads",
      "keine Rohtext-Extrakte, kein Parser-Fallback-Text",
      "keine OCR-Rohresultate",
      "B14 bleibt fuehrendes Gate fuer alles Upload-",
      "Worker-/AV-Nahe",
      "PA14 bleibt read-only Nachweisanker",
      "nicht zu einem stillen Dokumentfeed fuer Provider umgedeutet"
    ]) {
      expect(normalizedDoc).toContain(anchor);
    }
  });

  it("keeps the new frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa61-llm-document-upload-source-safety-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
