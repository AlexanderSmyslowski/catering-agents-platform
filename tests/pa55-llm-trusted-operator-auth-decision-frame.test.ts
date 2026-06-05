import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA55_LLM_TRUSTED_OPERATOR_AUTH_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA55 LLM trusted operator/auth decision frame", () => {
  it("anchors the next auth/operator frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA55 LLM Trusted-Operator-/Auth-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neuen APIs");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("OIDC-/Login-Implementierung");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("uses B8, B9, and PA9 as leading auth/proxy gates above the local corridor", () => {
    for (const anchor of [
      "PA51 hat den lokalen Operator-, Kosten- und Human-Approval-Rahmen",
      "PA54 hat direkt danach den",
      "Datenscope oberhalb von `synthetic_live`",
      "Trusted-Actor-Grenze fuer bestehende interne Read-/Export-/Audit-Pfade",
      "Proxy-/IAP-Preflight als produktionsnaher Auth-Anker",
      "ob freie Client-Header oder lokales `x-actor-name` jemals als belastbare",
      "LLM-Operatoridentitaet"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends only a trusted proxy/IAP context for any non-local provider-capable draft path", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "nicht-lokaler Draft-Pfad nur hinter Trusted-Proxy/IAP-Kontext",
      "kein freier Client-Header als LLM-Operatoridentitaet",
      "lokales `x-actor-name` bleibt Dev-/Test-Kompatibilitaet",
      "keine App-Login-/Session-/OIDC-Implementierung"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the new auth/operator frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa55-llm-trusted-operator-auth-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
