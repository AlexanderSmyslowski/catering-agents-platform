import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const frameworkDoc = readFileSync("docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const checkScript = readFileSync("scripts/check-local-ops.sh", "utf8");

const gateBindingAnchors = [
  "P9-N2 Gate-Bindung gegen Scheingruenheit",
  "`npm run local:status` allein ist kein Rehearsal-Go",
  "`npm run local:check` allein ist kein Rehearsal-Go",
  "UI-/Smoke-Anker allein sind kein Rehearsal-Go",
  "Rehearsal-Go darf nur vergeben werden, wenn Status, Check, manuelle UI-Routen, Evidence-Paket und Reibungslog gemeinsam widerspruchsfrei sind",
  "Rote lokale Gates, fehlende Export-/Auditanker oder offene Stop-Gates sind als `blocked` oder `decision needed` zu dokumentieren",
  "keine Produktionsfreigabe",
  "keine rechtssichere Audit-/Compliance-Aussage",
  "keine echten Daten"
];

describe("P9-N2 local rehearsal gate binding contract", () => {
  it("binds the rehearsal framework to all required local gates instead of a single green signal", () => {
    for (const anchor of gateBindingAnchors) {
      expect(frameworkDoc).toContain(anchor);
    }

    expect(frameworkDoc).toContain("npm run local:status -> npm run local:check -> manuelle UI-Routen -> P7-B65-Evidence-Paket -> P6-B58-Reibungslog");
  });

  it("keeps C8 and TESTING explicit that local green is not enough for production-like approval", () => {
    for (const doc of [c8Doc, testingDoc]) {
      expect(doc).toContain("P9-N2 Gate-Bindung gegen Scheingruenheit");
      expect(doc).toContain("`npm run local:status` allein ist kein Rehearsal-Go");
      expect(doc).toContain("`npm run local:check` allein ist kein Rehearsal-Go");
      expect(doc).toContain("Rehearsal-Go darf nur vergeben werden, wenn Status, Check, manuelle UI-Routen, Evidence-Paket und Reibungslog gemeinsam widerspruchsfrei sind");
      expect(doc).toContain("Rote lokale Gates, fehlende Export-/Auditanker oder offene Stop-Gates sind als `blocked` oder `decision needed` zu dokumentieren");
    }
  });

  it("prints the bounded local check result in the existing script without adding new runtime scope", () => {
    expect(checkScript).toContain("Lokaler Betriebsweg reproduzierbar bestaetigt: Start -> Status -> Health -> Export -> Bootstrap/Audit.");
    expect(checkScript).toContain("Rehearsal-Grenze: local:check ist nur ein lokaler Betriebs-/Seed-/Export-/Auditbeleg.");
    expect(checkScript).toContain("Kein Rehearsal-Go ohne manuelle UI-Sichtung, Evidence-Paket und Reibungslog.");
    expect(checkScript).toContain("Keine Produktionsfreigabe, keine echten Daten, keine rechtssichere Audit-/Compliance-Aussage.");
    expect(checkScript).not.toContain("event.schedule");
    expect(checkScript).not.toContain("Zeitfenster-Rehearsal-Notiz");
  });
});
