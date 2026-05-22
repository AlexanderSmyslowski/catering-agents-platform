import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readinessDocPath = "docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md";

describe("PA6 internal beta readiness summary", () => {
  it("keeps the readiness view grounded in existing repo signals and gates", () => {
    const doc = readFileSync(readinessDocPath, "utf8");

    expect(doc).toContain("Doku-only; keine neue Runtime-Funktion, keine neue API, keine neue Persistenz");
    expect(doc).toContain("`npm test`");
    expect(doc).toContain("`npm run build`");
    expect(doc).toContain("`npm audit --omit=dev`");
    expect(doc).toContain("`npm run local:status`");
    expect(doc).toContain("Upload-Provenance -> Conversation-Quellenanker -> Produktionsoutput/Exportdarstellung");
    expect(doc).toContain("docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md");
  });

  it("separates internal MVP readiness from external release and production-agent-v1 feature claims", () => {
    const doc = readFileSync(readinessDocPath, "utf8");

    expect(doc).toContain("Externe oder echte produktive Nutzung ist mit diesem Stand nicht freigegeben");
    expect(doc).toContain("OIDC/SSO");
    expect(doc).toContain("read-path Auth");
    expect(doc).toContain("Sandbox-/Worker- und AV-Entscheidung");
    expect(doc).toContain("PII-, Retention-, Backup-/Restore- und Access-Regeln");
    expect(doc).toContain("keine LLM-Orchestrierung");
    expect(doc).toContain("keine Tool-Use-Schicht fuer Agenten");
    expect(doc).toContain("keine LLM-Rezeptgenerierung");
    expect(doc).toContain("keine fachlich/rechtlich abgesicherte Allergen Engine Deutsch/Englisch");
  });

  it("keeps the management view explicit about implemented, internal-only, open, risk and Alexander decision", () => {
    const doc = readFileSync(readinessDocPath, "utf8");

    expect(doc).toContain("## 9. Management-/Lageuebersicht B7");
    expect(doc).toContain("### Tatsaechlich umgesetzt");
    expect(doc).toContain("### Nur dokumentiert / nur intern abnahmefaehig");
    expect(doc).toContain("### Offen");
    expect(doc).toContain("### Risiko");
    expect(doc).toContain("### Naechste Entscheidung fuer Alexander");
    expect(doc).toContain("Keine Produktionsfreigabe, keine externe Freigabe und keine rechtssichere Audit-/Compliance-Behauptung.");
    expect(doc).toContain("Alexander muss entscheiden, ob B8 zuerst AuthN/AuthZ/read-path Auth, PII-/Retention/Backup oder Sandbox-/Worker/AV schliesst.");
  });
});
