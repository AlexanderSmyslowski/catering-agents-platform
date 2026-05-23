import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const evidencePackDoc = readFileSync("docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md", "utf8");

const optionAExportAuditBoundaryAnchors = [
  "Export-/Auditbelege beweisen keine strukturierte Zeitfensterloesung",
  "Export-/Auditbelege duerfen nicht als Nachweis gelesen werden, dass `event.schedule` fachlich strukturiert geloest ist",
  "Die `Zeitfenster-Rehearsal-Notiz` bleibt eine manuelle Copy-/Anleitungsnotiz",
  "kein strukturiertes Schedule-/Zeitfenster-Datenmodell",
  "keine automatische oder halbautomatische Spec-Korrektur"
];

describe("P8-N3 export audit option A evidence boundary", () => {
  it("keeps export and audit evidence from implying a structured schedule solution", () => {
    for (const anchor of optionAExportAuditBoundaryAnchors) {
      expect(evidencePackDoc).toContain(anchor);
    }

    expect(evidencePackDoc).toContain("Produktionsblatt-/Produktionsplan-HTML");
    expect(evidencePackDoc).toContain("Einkaufsliste-CSV");
    expect(evidencePackDoc).toContain("Audit-Spur");
    expect(evidencePackDoc).toContain("nicht automatisch in event.schedule uebernommen");
  });
});
