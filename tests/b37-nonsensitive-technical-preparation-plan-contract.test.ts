import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

const requiredInputs = [
  "docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md",
  "docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md",
  "docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md",
  "docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md",
  "docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md",
  "docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md",
  "docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md",
  "docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md",
  "docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md",
  "docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md",
  "docs/deployment/B35_OPTION_B_PREPARATION_BOUNDARY.md",
  "docs/deployment/B36_BACKUP_RETENTION_DECISION.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md",
  "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md",
  "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md",
  "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md",
  "TESTING.md"
];

const preparationOrder = [
  "1. Gate-Konsistenz pruefen: B25-B37, B13/B14, PA9/B9 und TESTING",
  "2. Zugriffsschutz als Typ festhalten: Tailscale/VPN-only",
  "3. Nicht-Exposition als Regel bestaetigen",
  "4. Trusted-Header-Grenze pruefen",
  "5. Evidence-Regeln anwenden",
  "6. Backup-Retention als Entscheidungsanker uebernehmen",
  "7. Uploads weiter `blocked until B14 go` halten",
  "8. Stop-, Rollback- und Incident-Notizen nicht-sensitiv vorbereiten"
];

const forbiddenBoundaries = [
  "kein Deployment-Go",
  "kein SSH-Go",
  "keine Serveraenderung",
  "keine Secret-/ENV-Erstellung",
  "kein Echtdatenstart",
  "keine Backup-Aktivierung",
  "keine echten Uploads",
  "keine neue API",
  "keine neue Persistenz",
  "keine Migration",
  "keine Compliance-/DSGVO-Freigabe"
];

describe("B37 non-sensitive technical preparation plan contract", () => {
  it("creates a non-sensitive technical preparation plan without granting implementation", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("B37 Nicht-sensitiver technischer Vorbereitungsplan fuer Option-B-Pilot");
    expect(doc).toContain("Status: Doku-/Vertragstest-only technischer Vorbereitungsplan");
    expect(doc).toContain("reine Arbeitsreihenfolge fuer einen spaeteren technischen Vorbereitungslauf");
    expect(doc).toContain("B37 fuehrt keinen Serverlauf aus");
  });

  it("uses the complete B25-B37, B13/B14, PA9/B9 and TESTING consistency inputs", () => {
    for (const input of requiredInputs) {
      expect(doc).toContain(input);
    }
  });

  it("defines the required non-sensitive preparation order", () => {
    for (const item of preparationOrder) {
      expect(doc).toContain(item);
    }
  });

  it("keeps access, non-exposure and trusted headers bounded to safe types and server-side context", () => {
    expect(doc).toContain("Tailscale/VPN-only als Zugriffsschutz-Typ");
    expect(doc).toContain("ohne Tailnet-, Geraete-, IP-, Hostname- oder Serverdetails");
    expect(doc).toContain("App/API/Serviceports nicht direkt oeffentlich erreichbar");
    expect(doc).toContain("serverseitiger Trusted-Kontext");
    expect(doc).toContain("Header-Stripping");
    expect(doc).toContain("keine clientseitige Rollen-/Trusted-Header-Freigabe");
  });

  it("limits evidence to status signals and excludes sensitive operational material", () => {
    expect(doc).toContain("nur Status-/Existenz-/Testsignale");
    expect(doc).toContain("keine PII");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine IPs");
    expect(doc).toContain("keine Hostnames");
    expect(doc).toContain("keine echten Inhalte");
    expect(doc).toContain("keine produktiven Logs");
  });

  it("keeps B36 backup retention and B14 uploads as decision anchors only", () => {
    expect(doc).toContain("14 Tage Pilot-Default aus B36");
    expect(doc).toContain("nur als Entscheidungsanker");
    expect(doc).toContain("keine Backup-Aktivierung");
    expect(doc).toContain("Uploads weiter `blocked until B14 go`");
  });

  it("protects the full no-implementation boundary", () => {
    for (const boundary of forbiddenBoundaries) {
      expect(doc).toContain(boundary);
    }

    expect(doc).toContain("kein Serverzugriff");
    expect(doc).toContain("keine produktive ENV");
    expect(doc).toContain("kein Login/OIDC/Session-Ausbau");
    expect(doc).toContain("keine Produktlogik");
    expect(doc).toContain("keine AVV-Freigabe");
  });
});
