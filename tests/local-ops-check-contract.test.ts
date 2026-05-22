import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const checkScript = readFileSync("scripts/check-local-ops.sh", "utf8");
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

  it("documents local:check as a local operational proof without CI, production, or legal-audit claims", () => {
    expect(testingDoc).toContain("`npm run local:status` ist eine lokale Prozess- und Erreichbarkeitsuebersicht");
    expect(testingDoc).toContain("`npm run local:check` ist der lokale Betriebs-/Seed-/Export-/Auditbeleg");
    expect(testingDoc).toContain("keine CI-Pflicht");
    expect(testingDoc).toContain("keine Produktionsfreigabe");
    expect(testingDoc).toContain("keine rechtssichere Audit-Aussage");
  });

  it("keeps the C8 acceptance path discoverable and tied to real repo anchors", () => {
    expect(packageJson.scripts["local:status"]).toBe("bash ./scripts/status-local-stack.sh");
    expect(packageJson.scripts["local:check"]).toBe("bash ./scripts/check-local-ops.sh");
    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts.build).toContain("tsc --noEmit");

    expect(existsSync("scripts/status-local-stack.sh")).toBe(true);
    expect(existsSync("scripts/check-local-ops.sh")).toBe(true);
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
