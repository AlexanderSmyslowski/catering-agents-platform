import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const evidencePackPath = "docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md";
const evidencePackDoc = existsSync(evidencePackPath) ? readFileSync(evidencePackPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const startCardDoc = readFileSync("docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md", "utf8");
const frictionLogDoc = readFileSync("docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md", "utf8");

const requiredEvidenceAnchors = [
  "P7-B65 Evidenzpaket fuer Export/Audit/Route",
  "Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit",
  "Route",
  "Erwartung",
  "Beobachtung",
  "Beleg",
  "Reibung",
  "Naechste Entscheidung",
  "Export-/Auditbeleg",
  "Screenshot-Hinweis ohne PII"
];

const requiredBoundaryAnchors = [
  "read-only",
  "keine externe Ablage",
  "kein Upload",
  "keine echten Dateien mit personenbezogenen Daten",
  "keine Produktionsfreigabe",
  "keine rechtssichere Audit-/Compliance-Aussage",
  "keine neue Betriebsintegration"
];

describe("P7-B65 export audit route evidence pack contract", () => {
  it("anchors a structured evidence checklist for the manual beta rehearsal", () => {
    expect(existsSync(evidencePackPath)).toBe(true);

    for (const anchor of requiredEvidenceAnchors) {
      expect(evidencePackDoc).toContain(anchor);
    }
  });

  it("keeps export and audit evidence within the existing read-only safe corridor", () => {
    for (const boundary of requiredBoundaryAnchors) {
      expect(evidencePackDoc).toContain(boundary);
    }

    expect(evidencePackDoc).toContain("Angebots-HTML");
    expect(evidencePackDoc).toContain("Produktionsblatt-/Produktionsplan-HTML");
    expect(evidencePackDoc).toContain("Einkaufsliste-CSV");
    expect(evidencePackDoc).toContain("Audit-Spur");
  });

  it("keeps the evidence pack discoverable from existing beta rehearsal anchors", () => {
    for (const doc of [readmeDoc, testingDoc, startCardDoc, frictionLogDoc]) {
      expect(doc).toContain("P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md");
    }

    expect(testingDoc).toContain("tests/p7-b65-export-audit-route-evidence-pack-contract.test.ts");
    expect(readmeDoc).toContain("P7-B65");
  });
});
