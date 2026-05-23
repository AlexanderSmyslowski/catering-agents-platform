import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const triageDoc = readFileSync("docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md", "utf8");
const managementDoc = readFileSync("docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md", "utf8");
const frictionLogDoc = readFileSync("docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

const requiredOutcomeAnchors = [
  "P9-N3 Rehearsal-Reibung-zu-Entscheidung",
  "`go`",
  "`fix`",
  "`blocked`",
  "`decision needed`",
  "kein automatisches Ticket",
  "keine Backlog- oder QA-Plattform"
];

const requiredClassificationAnchors = [
  "go: Rehearsal-Kette widerspruchsfrei",
  "fix: klein, beobachtet, lokal reproduzierbar",
  "blocked: Stop-Gate oder rotes lokales Gate",
  "decision needed: bewusste Alexander-Entscheidung erforderlich"
];

describe("P9-N3 rehearsal friction decision contract", () => {
  it("sharpens the triage template with go/fix/blocked/decision needed outcome anchors", () => {
    for (const anchor of requiredOutcomeAnchors) {
      expect(triageDoc).toContain(anchor);
    }

    for (const anchor of requiredClassificationAnchors) {
      expect(triageDoc).toContain(anchor);
    }
  });

  it("keeps management and friction-log wording aligned to the same four outcomes", () => {
    for (const doc of [managementDoc, frictionLogDoc]) {
      expect(doc).toContain("P9-N3 Rehearsal-Reibung-zu-Entscheidung");
      expect(doc).toContain("`go` / `fix` / `blocked` / `decision needed`");
      expect(doc).toContain("keine automatische Ticket-/Backlog-/QA-Plattform");
    }
  });

  it("keeps the sharpened decision contract discoverable from testing guidance", () => {
    expect(testingDoc).toContain("P9-N3 Rehearsal-Reibung-zu-Entscheidung");
    expect(testingDoc).toContain("tests/p9-n3-rehearsal-friction-decision-contract.test.ts");
    expect(testingDoc).toContain("go/fix/blocked/decision needed");
  });
});
