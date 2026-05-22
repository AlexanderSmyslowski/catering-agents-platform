import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkScript = readFileSync("scripts/check-local-ops.sh", "utf8");
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
});
