import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const architecturePath = "docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md";
const c10Path = "docs/product/C10_CURRENT_WORKTREE_PR_SLICES.md";

const architecture = existsSync(architecturePath) ? readFileSync(architecturePath, "utf8") : "";
const c10 = existsSync(c10Path) ? readFileSync(c10Path, "utf8") : "";
const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
const testing = existsSync("TESTING.md") ? readFileSync("TESTING.md", "utf8") : "";
const memory = existsSync("memory.md") ? readFileSync("memory.md", "utf8") : "";

describe("ProductionAgent 10/10 coding architecture contract", () => {
  it("keeps the 10/10 architecture as a documentation-only focus anchor", () => {
    expect(existsSync(architecturePath)).toBe(true);
    expect(architecture).toContain("ProductionAgent 10/10 Coding Architecture");
    expect(architecture).toContain("Status: aktualisierte Coding-Architektur, keine Runtime-Implementierung");
    expect(architecture).toContain("LLM anschliessen und es laeuft einfach");
    expect(architecture).toContain("keine Provider-Secrets");
    expect(architecture).toContain("keine echten Modellaufrufe mit echten Daten");
  });

  it("keeps deterministic product objects leading over LLM output", () => {
    for (const anchor of [
      "`AcceptedEventSpec` bleibt operative Spezifikationsgrundlage.",
      "`ProductionPlan` bleibt pruefbares Produktionsobjekt.",
      "`PurchaseList` bleibt abgeleitetes Einkaufsobjekt.",
      "`ProductionConversationProjection` bleibt Projektion aus vorhandenen Objekten",
      "LLM-Outputs duerfen nie direkt `AcceptedEventSpec`, `ProductionPlan` oder `PurchaseList` ersetzen.",
      "Jede Uebernahme in fuehrende Produktobjekte braucht Schema-Validierung, bestehenden Domain-Code und Human Approval."
    ]) {
      expect(architecture).toContain(anchor);
    }
  });

  it("defines concrete LLM-ready module boundaries before provider integration", () => {
    for (const moduleBoundary of [
      "`shared-core`",
      "`intake-service`",
      "`offer-service`",
      "`production-service`",
      "`print-export`",
      "`backoffice-ui`",
      "`ModelInput` / `ModelOutput`",
      "`ProviderAdapter`",
      "`Prompt-/Schema-Registry`",
      "`Tool-Registry`",
      "`Eval-Harness`",
      "`ConversationSession`",
      "`AgentAudit`"
    ]) {
      expect(architecture).toContain(moduleBoundary);
    }
  });

  it("keeps the level map focused from current review state to controlled internal production", () => {
    for (const level of [
      "Level 7: aktueller Arbeitsstand reviewbar und gruen",
      "Level 8: deterministischer Produktionskern beta-tauglich",
      "Level 8.5: LLM-ready ohne LLM",
      "Level 9: LLM synthetic-only",
      "Level 9.5: begrenzter interner Pilot",
      "Level 10: kontrollierter interner Produktionsagent"
    ]) {
      expect(architecture).toContain(level);
    }
  });

  it("keeps decision gates explicit for runtime, LLM and real-data work", () => {
    for (const gate of [
      "B8/B9/B10/B13/B14 plus Pilotdaten-Go",
      "C9 Fehlupload-Soft-Archiv als Runtime",
      "ConversationSession als Runtime-Objekt",
      "neue API-Endpunkte",
      "neue Persistenz oder Migration",
      "LLM Provider, Modell, Kosten, Logging, Secrets und Datenuebertragung",
      "echte Google-Drive-Angebote oder andere echte Daten",
      "Auth/OIDC/IAP/Proxy",
      "PII, Retention, Backup und Restore",
      "Sandbox, Worker und AV fuer Dateien",
      "Deployment, produktionsnahe Nutzung oder externe Freigabe"
    ]) {
      expect(architecture).toContain(gate);
    }
  });

  it("defines a broader autonomous coding corridor without weakening hard gates", () => {
    for (const allowed of [
      "Autonomie-Korridor fuer Codex/Hans",
      "klein, lokal, reviewbar, testbar und reversibel",
      "bleibt in vorhandenen Modulen, APIs, Datenmodellen und Persistenzgrenzen",
      "nutzt nur synthetische, Demo- oder lokale Testdaten",
      "Produktionskern-Smokes fuer synthetische Lunch-, Buffet-, Empfang-, Flying-Bites- und Kaffeepausenfaelle",
      "enge Rezept-Matching- und Importqualitaets-Haertungen",
      "UI-Wartbarkeit, Stale-Fokus-, Empty-/Loading-State- und Export-/Audit-Lesbarkeit",
      "Doku-/Contract-Klaerungen",
      "Nicht entscheidungspflichtig sind enge lokale Slices"
    ]) {
      expect(architecture).toContain(allowed);
    }

    for (const hardGate of [
      "echte Daten",
      "echte Google-Drive-Angebote",
      "Auth/OIDC/IAP/Proxy",
      "PII/Retention/Backup/Restore",
      "Sandbox/Worker/AV",
      "Deployment",
      "neue API",
      "neue Persistenz/Migration",
      "LLM-Provider/Secrets/Kosten/Logging/Datenuebertragung"
    ]) {
      expect(architecture).toContain(hardGate);
    }
  });

  it("keeps the current uncommitted worktree sorted into reviewable slices without granting release work", () => {
    expect(existsSync(c10Path)).toBe(true);
    expect(c10).toContain("Status: Arbeitsbaum-Sortierung, keine Commits, keine PR-Erstellung");
    expect(c10).toContain("Aktueller Git-Status-Snapshot");
    expect(c10).toContain("Reviewfaehige Commit-Schnittlogik");
    expect(c10).toContain("Slice 1: Produktziel, lokale Rehearsal-Grenzen und Fehlupload-Entscheidung");
    expect(c10).toContain("Slice 2: Produktionskern Quick-Lunch und Rezept-/Einkaufslistenqualitaet");
    expect(c10).toContain("Slice 3: Produktions-UI-Verhalten und Quick-Lunch-Smokes");
    expect(c10).toContain("Slice 4: Produktions-UI-Refactor ohne Verhaltensaenderung");
    expect(c10).toContain("Cross-Slice-Dateien");
    expect(c10).toContain("`README.md`, `TESTING.md` und `memory.md`");
    expect(c10).toContain("`backoffice-ui/src/App.tsx` enthaelt sowohl Slice-3-Verhaltensaenderungen als auch Slice-4-Refactor-Importe/-JSX-Reduktionen");
    expect(c10).toContain("keine LLM-/Tool-Orchestrierung");
    expect(c10).toContain("kein Deployment");
    expect(c10).toContain("`tmp/` bleibt untracked/unrelated und gehoert in keinen Slice.");
    expect(c10).toContain("Nicht stagen:");
    expect(c10).toContain("`tmp/`");
    expect(c10).toContain("97 Testdateien bestanden");
    expect(c10).toContain("453 Tests bestanden");
  });

  it("keeps the UI refactor slice complete and reviewable", () => {
    for (const componentPath of [
      "backoffice-ui/src/production-handoff-panel.tsx",
      "backoffice-ui/src/production-input-panel.tsx",
      "backoffice-ui/src/production-objects-panel.tsx",
      "backoffice-ui/src/production-plan-download-card.tsx",
      "backoffice-ui/src/production-plan-list.tsx",
      "backoffice-ui/src/production-plan-secondary-details.tsx",
      "backoffice-ui/src/production-purchase-list-panel.tsx",
      "backoffice-ui/src/production-question-panel.tsx",
      "backoffice-ui/src/production-recipe-library-panel.tsx",
      "backoffice-ui/src/production-spec-details.tsx"
    ]) {
      expect(c10).toContain(componentPath);
    }

    expect(c10).toContain("move/render-only");
    expect(c10).toContain("2163 Zeilen");
  });

  it("keeps both focus anchors discoverable from README, TESTING and memory", () => {
    for (const doc of [readme, testing, memory]) {
      expect(doc).toContain(architecturePath);
      expect(doc).toContain(c10Path);
    }

    expect(testing).toContain("tests/production-agent-10-10-coding-architecture-contract.test.ts");
  });
});
