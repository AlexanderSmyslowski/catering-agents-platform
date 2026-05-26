import { existsSync, readFileSync } from "node:fs";
import { buildProductionConversationProjection } from "../shared-core/src/conversation-projection.js";
import { getDemoProductionAnsweredClarificationAnchor } from "../shared-core/src/fixtures/demo-scenarios.js";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const checkScript = readFileSync("scripts/check-local-ops.sh", "utf8");
const demoScenarios = readFileSync("shared-core/src/fixtures/demo-scenarios.ts", "utf8");
const c8AcceptanceDoc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("local ops check contract", () => {
  it("keeps the audit window wide enough for a running local stack and reports missing seed evidence deterministically", () => {
    expect(checkScript).toContain("/v1/production/audit/events?limit=200");
    expect(checkScript).toContain("Kein production.seed_demo-Beleg unter den letzten ${payload.items.length} Audit-Eintraegen gefunden.");
    expect(checkScript).toContain("Bitte lokalen Stack kontrolliert mit npm run local:start neu seed-en.");
    expect(checkScript).toContain("production.seed_demo-Beleg hat eine unerwartete Summary.");
    expect(checkScript).toContain("production.seed_demo-Beleg hat eine unerwartete entityId.");
  });

  it("warns when the local rehearsal data set looks accumulated without deleting anything", () => {
    expect(checkScript).toContain("json_item_count()");
    expect(checkScript).toContain("intake_spec_count");
    expect(checkScript).toContain("offer_draft_count");
    expect(checkScript).toContain("production_plan_count");
    expect(checkScript).toContain("Rehearsal-Datenhinweis: lokaler Datenbestand wirkt aufgefuellt");
    expect(checkScript).toContain("kein sauberer Frischlauf");
    expect(checkScript).toContain("UI-Evidenz und Reibungslog muessen Altlasten/Stale-Fokus beruecksichtigen");
    expect(checkScript).toContain("local:check loescht oder archiviert keine lokalen Daten automatisch");
  });

  it("warns when local purchase lists look polluted by recipe steps without deleting anything", () => {
    expect(checkScript).toContain("instruction_like_purchase_item_report()");
    expect(checkScript).toContain("production\", \"purchase-lists");
    expect(checkScript).toContain("instructionStartPattern");
    expect(checkScript).toContain("instructionPhrasePattern");
    expect(checkScript).toContain("moegliche Rezept-Arbeitsschritte als Einkaufspositionen");
    expect(checkScript).toContain("lokalen Stale-Datenbefund");
    expect(checkScript).toContain("local:check bereinigt diese Einkaufslisten nicht automatisch");
    expect(checkScript).toContain("kontrollierten Frischlauf oder Soft-Archiv nur bewusst ausloesen");
  });

  it("keeps local checks tied to the data root of the running local stack", () => {
    const startScript = readFileSync("scripts/start-local-stack.sh", "utf8");
    const statusScript = readFileSync("scripts/status-local-stack.sh", "utf8");
    const stopScript = readFileSync("scripts/stop-local-stack.sh", "utf8");

    expect(startScript).toContain("DATA_ROOT_FILE");
    expect(startScript).toContain("Lokale Datenwurzel");
    expect(startScript).toContain("Bitte npm run local:stop ausfuehren, bevor die lokale Datenwurzel gewechselt wird");
    expect(checkScript).toContain("recorded_data_root");
    expect(checkScript).toContain("requested_data_root");
    expect(checkScript).toContain("Lokaler Stack wurde mit anderer Datenwurzel gestartet");
    expect(checkScript).toContain("Bitte dieselbe Datenwurzel nutzen oder den Stack mit npm run local:stop kontrolliert neu starten");
    expect(statusScript).toContain("Datenwurzel:");
    expect(stopScript).toContain("rm -f \"${DATA_ROOT_FILE}\"");
  });

  it("documents the compact local demo runbook commands and their bounded roles", () => {
    expect(testingDoc).toContain("`npm run local:start` startet den lokalen Stack mit Demo-Seeding");
    expect(testingDoc).toContain("`npm run local:status` ist eine lokale Prozess- und Erreichbarkeitsuebersicht");
    expect(testingDoc).toContain("`npm run local:check` ist der lokale Betriebs-/Seed-/Export-/Auditbeleg");
    expect(testingDoc).toContain("`npm run local:stop` beendet die lokalen `screen`-Sitzungen");
    expect(testingDoc).toContain("keine CI-Pflicht");
    expect(testingDoc).toContain("keine Produktionsfreigabe");
    expect(testingDoc).toContain("keine rechtssichere Audit-Aussage");
    expect(testingDoc).toContain("Rehearsal-Datenhinweis");
    expect(testingDoc).toContain("kein sauberer Frischlauf");
    expect(testingDoc).toContain("keine automatische Loeschung oder Archivierung");
    expect(testingDoc).toContain("moegliche Rezept-Arbeitsschritte als Einkaufspositionen");
    expect(testingDoc).toContain("lokaler Stale-Datenbefund");
    expect(testingDoc).toContain("Lokale Datenwurzel");
    expect(testingDoc).toContain("CATERING_DATA_ROOT");
  });

  it("keeps Demo-Seed, local checks, and audit evidence narratively bounded across docs", () => {
    for (const doc of [readmeDoc, testingDoc, c8AcceptanceDoc]) {
      expect(doc).toContain("`npm run local:status` ist");
      expect(doc).toContain("`npm run local:check` ist");
      expect(doc).toContain("Demo-Seed ist eine interne Verifikationshilfe");
      expect(doc).toContain("kein Produktionsdatenmodell");
      expect(doc).toContain("Auditbeleg ist ein interner Betriebs-/Kontrollnachweis");
      expect(doc).toContain("keine rechtssichere Audit-/Compliance-Aussage");
      expect(doc).toContain("interner Demo-/Abnahmeweg");
      expect(doc).toContain("keine externe Freigabe");
      expect(doc).toContain("aufgefuellt");
    }
  });

  it("keeps the expected demo fixture anchors discoverable and covered by the local check", () => {
    for (const expectedFixtureAnchor of [
      "demo-intake-conference-lunch",
      "demo-offer-conference-buffet",
      "demo-production-coffee"
    ]) {
      expect(demoScenarios).toContain(expectedFixtureAnchor);
      expect(checkScript).toContain(expectedFixtureAnchor);
      expect(testingDoc).toContain(expectedFixtureAnchor);
    }

    for (const expectedLocalCheckAnchor of [
      "Startweg vorhanden",
      "Erwartungsankerpruefung",
      "/v1/intake/requests",
      "/v1/intake/specs",
      "/v1/offers/drafts",
      "/v1/production/plans",
      "draft-demo-offer-conference-buffet",
      "plan-spec-demo-production-coffee",
      "purchase-spec-demo-production-coffee"
    ]) {
      expect(checkScript).toContain(expectedLocalCheckAnchor);
    }

    expect(testingDoc).toContain("Start-, Intake-/Request-, Angebots-, Produktions- und Exportanker");
  });

  it("keeps a synthetic answered clarification demo anchor traceable without real data", () => {
    const anchor = getDemoProductionAnsweredClarificationAnchor();
    const projection = buildProductionConversationProjection({
      spec: anchor.spec as unknown as Record<string, unknown>,
      questions: [],
      clarificationAnswers: anchor.clarificationAnswers
    });

    expect(anchor.spec.specId).toBe("spec-demo-production-answered-clarification");
    expect(anchor.clarificationAnswers).toHaveLength(1);
    expect(anchor.clarificationAnswers[0]?.answerText.value).toContain("Synthetische Demo-Antwort");
    expect(projection.messages.some((message) => message.clarificationAnswerStatus === "answered")).toBe(true);
    expect(projection.messages.some((message) => message.type === "user_structured_answer")).toBe(true);
    expect(demoScenarios).toContain("demo-production-answered-clarification");
    expect(demoScenarios).toContain("Synthetische Demo-Antwort");

    for (const doc of [c8AcceptanceDoc, testingDoc]) {
      expect(doc).toContain("spec-demo-production-answered-clarification");
      expect(doc).toContain("Agent fragt · beantwortet");
      expect(doc).toContain("Agent fragt · offen");
      expect(doc).toContain("user_structured_answer");
      expect(doc).toContain("keine automatische Spec-Korrektur");
      expect(doc).toContain("keine Fachableitung");
      expect(doc).toContain("Produktionsobjekte/Downloads bleiben read-only Ergebnis-/Exportanker");
    }
  });

  it("keeps the C8 acceptance path discoverable and tied to real repo anchors", () => {
    expect(packageJson.scripts["local:start"]).toBe("bash ./scripts/start-local-stack.sh --seed-demo");
    expect(packageJson.scripts["local:status"]).toBe("bash ./scripts/status-local-stack.sh");
    expect(packageJson.scripts["local:check"]).toBe("bash ./scripts/check-local-ops.sh");
    expect(packageJson.scripts["local:stop"]).toBe("bash ./scripts/stop-local-stack.sh");
    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts.build).toContain("tsc --noEmit");

    expect(existsSync("scripts/start-local-stack.sh")).toBe(true);
    expect(existsSync("scripts/status-local-stack.sh")).toBe(true);
    expect(existsSync("scripts/check-local-ops.sh")).toBe(true);
    expect(existsSync("scripts/stop-local-stack.sh")).toBe(true);
    expect(existsSync("tests/backoffice-route-smoke.test.ts")).toBe(true);
    expect(existsSync("tests/backoffice-production-acceptance-smoke.test.ts")).toBe(true);
    expect(existsSync("tests/backoffice-internal-usage-smoke.test.ts")).toBe(true);
    expect(existsSync("tests/pa14-document-ingestion-corridor-readiness.test.ts")).toBe(true);
    expect(existsSync("tests/pa8-read-path-auth.test.ts")).toBe(true);

    for (const doc of [c8AcceptanceDoc, readmeDoc, testingDoc]) {
      expect(doc).toContain("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md");
    }

    for (const requiredAnchor of [
      "`npm run local:status`",
      "`npm run local:check`",
      "`/angebot`",
      "`/produktion`",
      "Angebot-Happy-Path",
      "Handoff-Anker",
      "Upload-/Import-Warnanker",
      "Trusted-Actor-Kontext",
      "Full Gates",
      "`npm test`",
      "`npm run build`",
      "`npm audit --omit=dev`",
      "`git diff --check`"
    ]) {
      expect(c8AcceptanceDoc).toContain(requiredAnchor);
      expect(testingDoc).toContain(requiredAnchor);
    }
  });
});
