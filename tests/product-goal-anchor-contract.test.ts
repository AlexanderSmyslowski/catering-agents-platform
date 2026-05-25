import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productGoalPath = "docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md";
const productGoalDoc = existsSync(productGoalPath) ? readFileSync(productGoalPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const memoryDoc = readFileSync("memory.md", "utf8");

describe("product goal anchor contract", () => {
  it("keeps the internal catering platform target explicit", () => {
    expect(existsSync(productGoalPath)).toBe(true);

    for (const anchor of [
      "interne, praxistaugliche Catering-Arbeitsplattform",
      "Intake -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit",
      "kontrollierter interner MVP-/Beta-Korridor",
      "Externe Kundennutzung",
      "echte Multi-Tenant-Plattform",
      "produktionsnahe echte Datenverarbeitung"
    ]) {
      expect(productGoalDoc).toContain(anchor);
    }
  });

  it("keeps the current work mode and no-go boundaries explicit", () => {
    for (const boundary of [
      "kleine echte Bausteine statt grosser Architekturverschiebungen",
      "keine neue Persistenzwelt / kein Prisma",
      "`ApprovalRequestRecord` bleibt fuehrende Freigabewahrheit",
      "Finalize ist nicht gleich Freigabe",
      "neue Produktflaeche ohne ausdruecklichen Auftrag",
      "neue Auth-/Login-/OIDC-/Session-Welt",
      "neue API-Endpunkte",
      "Deployment, SSH, Secrets",
      "rechtssichere Compliance"
    ]) {
      expect(productGoalDoc).toContain(boundary);
    }
  });

  it("allows more autonomous local build slices while preserving gate decisions", () => {
    for (const allowed of [
      "Autonomer Umsetzungskorridor",
      "nicht fuer jeden kleinen planfolgenden Schritt stoppen",
      "kleine, lokale, testbare und reversible Slices",
      "synthetische Produktionskern-Smokes",
      "enge Rezept-Matching-, Import-, Einkaufslisten-, Export- und UI-Haertungen",
      "verhaltensgleiche UI-Wartbarkeitsschnitte",
      "lokale Browser-/Rehearsal-Evidenz"
    ]) {
      expect(productGoalDoc).toContain(allowed);
    }

    for (const gate of [
      "echte Daten oder echte Google-Drive-Angebote",
      "Auth/OIDC/IAP/Proxy",
      "PII/Retention/Backup/Restore",
      "Sandbox/Worker/AV",
      "neue API-Endpunkte",
      "neue Persistenz",
      "echte `ConversationSession`-Runtime",
      "LLM-Provider",
      "Tool-Orchestrierung mit Schreibwirkung"
    ]) {
      expect(productGoalDoc).toContain(gate);
    }
  });

  it("keeps the maturity status honest and separated", () => {
    for (const status of [
      "Lokaler interner Demo-/Rehearsal-Korridor: nutzbar/pruefbar",
      "Begrenzter interner Pilot mit anonymisierten oder synthetischen Daten: entscheidungsbeduerftig / not assessed",
      "Produktionsnahe Nutzung mit echten Daten: blocked",
      "Externe Kundennutzung / oeffentlicher Rollout: blocked"
    ]) {
      expect(productGoalDoc).toContain(status);
    }
  });

  it("keeps the product goal discoverable from core repo references", () => {
    expect(readmeDoc).toContain(productGoalPath);
    expect(testingDoc).toContain(productGoalPath);
    expect(testingDoc).toContain("tests/product-goal-anchor-contract.test.ts");
    expect(memoryDoc).toContain(productGoalPath);
  });
});
