import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const corridorPath = "docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md";
const corridorDoc = existsSync(corridorPath) ? readFileSync(corridorPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const gapMapDoc = readFileSync("docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

const requiredCommands = [
  "npm run local:start",
  "npm run local:status",
  "npm run local:check",
  "npm run local:stop"
];

const requiredUrls = [
  "http://127.0.0.1:3200/",
  "http://127.0.0.1:3200/angebot",
  "http://127.0.0.1:3200/produktion",
  "http://127.0.0.1:3101/health",
  "http://127.0.0.1:3102/health",
  "http://127.0.0.1:3103/health",
  "http://127.0.0.1:3104/health"
];

const requiredBoundaries = [
  "kein Deployment",
  "keine SSH-Verbindung",
  "keine Secrets",
  "keine echten Daten",
  "keine Produktionsfreigabe",
  "keine rechtssichere Audit-/Compliance-Aussage"
];

describe("P6-B57 local start/status corridor contract", () => {
  it("anchors the local beta start and status corridor with commands, URLs, and roles", () => {
    expect(existsSync(corridorPath)).toBe(true);
    expect(corridorDoc).toContain("P6-B57 Lokaler Start-/Status-Korridor");
    expect(corridorDoc).toContain("Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen");

    for (const command of requiredCommands) {
      expect(corridorDoc).toContain(command);
    }

    for (const url of requiredUrls) {
      expect(corridorDoc).toContain(url);
    }

    expect(corridorDoc).toContain("lokale Prozess- und Erreichbarkeitsuebersicht");
    expect(corridorDoc).toContain("lokaler Betriebs-/Seed-/Export-/Auditbeleg");
  });

  it("keeps package scripts, documentation anchors, and contract test discoverable", () => {
    expect(packageJson.scripts["local:start"]).toBe("bash ./scripts/start-local-stack.sh --seed-demo");
    expect(packageJson.scripts["local:status"]).toBe("bash ./scripts/status-local-stack.sh");
    expect(packageJson.scripts["local:check"]).toBe("bash ./scripts/check-local-ops.sh");
    expect(packageJson.scripts["local:stop"]).toBe("bash ./scripts/stop-local-stack.sh");

    for (const doc of [readmeDoc, testingDoc, c8Doc, gapMapDoc]) {
      expect(doc).toContain("P6_B57_LOKALER_START_STATUS_KORRIDOR.md");
    }

    expect(testingDoc).toContain("tests/p6-b57-local-start-status-corridor-contract.test.ts");
  });

  it("keeps the local start/status corridor bounded to internal synthetic beta use", () => {
    for (const boundary of requiredBoundaries) {
      expect(corridorDoc).toContain(boundary);
    }

    expect(corridorDoc).toContain("Demo-/Seed-/synthetischen Daten");
    expect(corridorDoc).toContain("Wenn `npm run local:status` rot ist");
    expect(corridorDoc).toContain("Wenn `npm run local:check` rot ist");
    expect(corridorDoc).toContain("lokalen Blocker dokumentieren");
  });
});
