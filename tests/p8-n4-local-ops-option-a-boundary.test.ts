import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const startStatusDoc = readFileSync("docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md", "utf8");
const checkScript = readFileSync("scripts/check-local-ops.sh", "utf8");

describe("P8-N4 local ops option A boundary", () => {
  it("keeps local status and check as bounded smoke signals after Option A", () => {
    for (const doc of [c8Doc, testingDoc, startStatusDoc]) {
      expect(doc).toContain("Option-A-Zeitfenster-Grenze im lokalen Smoke-Korridor");
      expect(doc).toContain("lokale Gruensignale aus `npm run local:status` und `npm run local:check` belegen keine strukturierte Zeitfensterloesung");
      expect(doc).toContain("die `Zeitfenster-Rehearsal-Notiz` bleibt eine manuelle Copy-/Anleitungsnotiz");
      expect(doc).toContain("keine automatische `event.schedule`-Uebernahme");
      expect(doc).toContain("kein Schedule-/Zeitfenster-Datenmodell");
    }
  });

  it("keeps the local check focused on existing smoke anchors without schedule processing", () => {
    expect(checkScript).toContain("Start -> Status -> Health -> Rueckfragenanker -> Export -> Bootstrap/Audit");
    expect(checkScript).toContain("/v1/production/audit/events?limit=200");
    expect(checkScript).toContain("plan-spec-demo-production-coffee");
    expect(checkScript).not.toContain("event.schedule");
    expect(checkScript).not.toContain("Zeitfenster-Rehearsal-Notiz");
  });
});
