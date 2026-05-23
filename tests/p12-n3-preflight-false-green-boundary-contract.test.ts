import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = (path: string) => readFileSync(path, "utf8");

const preflightIndex = doc("docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md");
const preflightRunbook = doc("docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md");
const decisionPacket = doc("docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md");

const docsUnderReview = [preflightIndex, preflightRunbook, decisionPacket];

describe("P12-N3 preflight false-green boundary contract", () => {
  it("keeps local green signals separate from a real internal pilot go", () => {
    for (const reviewedDoc of docsUnderReview) {
      expect(reviewedDoc).toContain("`go`");
      expect(reviewedDoc).toContain("`not assessed`");
      expect(reviewedDoc).toContain("`blocked`");
    }

    expect(preflightIndex).toContain("Ein lokales Gruensignal aus Plan 9/10 darf nicht als Pilot-Go gelesen werden");
    expect(preflightRunbook).toContain("Ein Pilot-Go muss spaeter bewusst entschieden werden");
    expect(decisionPacket).toContain("Ein lokales Gruensignal aus Status, Check, UI, Export oder Audit ersetzt kein Management-Go");
  });

  it("requires a conscious management decision before the real limited internal pilot can be read as go", () => {
    expect(decisionPacket).toContain(
      "echter begrenzter interner Pilot mit anonymisierten/synthetischen Daten | `not assessed`"
    );
    expect(decisionPacket).toContain(
      "`go` nur nach Alexanders bewusster Managemententscheidung"
    );
    expect(decisionPacket).toContain(
      "Wenn eines dieser Mussfelder fehlt, widerspruechlich ist oder ein Stop-Gate beruehrt, bleibt der echte begrenzte interne Pilot `not assessed` oder `blocked`."
    );
  });

  it("keeps Option A and stop gates out of any local-preflight success interpretation", () => {
    for (const boundary of [
      "keine strukturierte Schedule-/Zeitfenster-Runtime",
      "keine automatische Spec-Korrektur",
      "echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten",
      "Deployment, Hetzner, SSH, Secrets",
      "OAuth/Login/OIDC/Session/Nutzerverwaltung",
      "neue API, API-Vertragsaenderung, neue Persistenz, Prisma oder Migration"
    ]) {
      expect(decisionPacket).toContain(boundary);
    }
  });
});
