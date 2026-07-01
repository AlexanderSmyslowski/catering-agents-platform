import { describe, expect, it } from "vitest";
import {
  compareNewestRecordsBy,
  detectRoute,
  formatAuditEventHandoffLabel,
  formatCounts,
  formatLatestAuditOverviewLabel,
  formatLatestIntakeRequest,
  getRouteSubtitle,
  getRouteTitle,
  translateHealthStatus
} from "../backoffice-ui/src/app-shell-state.js";

describe("app shell state helpers", () => {
  it("keeps route titles and subtitles stable outside App.tsx", () => {
    expect(detectRoute("/angebot")).toBe("offer");
    expect(detectRoute("/produktion")).toBe("production");
    expect(detectRoute("/")).toBe("home");
    expect(getRouteTitle("offer")).toBe("Angebotsagent");
    expect(getRouteTitle("production")).toBe("Produktionsagent");
    expect(getRouteTitle("home")).toBe("Catering-Agenten");
    expect(getRouteSubtitle("home")).toBe(
      "Zwei spezialisierte Arbeitsflächen mit gemeinsamem Regelkern und klar getrennten Zuständigkeiten."
    );
  });

  it("formats health, intake and audit labels without exposing full source hashes", () => {
    expect(translateHealthStatus("ok")).toBe("bereit");
    expect(translateHealthStatus("degraded")).toBe("degraded");
    expect(formatCounts({ requests: 2, productionPlans: 1 })).toBe("Anfragen: 2 · Produktionspläne: 1");

    const intakeLabel = formatLatestIntakeRequest([
      {
        requestId: "old-request",
        source: { channel: "email", receivedAt: "2026-05-21T08:00:00.000Z" }
      },
      {
        requestId: "new-request",
        source: { channel: "pdf_upload", receivedAt: "2026-05-21T09:00:00.000Z" },
        rawInputs: [
          {
            sourceMetadata: {
              filename: "synthetisches-angebot.pdf",
              sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
            },
            documentIngestion: {
              status: "fallback",
              warnings: ["document_text_extraction_fallback"]
            }
          }
        ]
      }
    ]);

    expect(intakeLabel).toContain("letzte Erfassung: new-request via pdf_upload");
    expect(intakeLabel).toContain("Quelle: synthetisches-angebot.pdf");
    expect(intakeLabel).toContain(
      "Dokumentprüfung: Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    );
    expect(intakeLabel).not.toContain("abcdef1234567890");

    const auditEvent = {
      auditId: "audit-1",
      at: "2026-05-21T10:00:00.000Z",
      action: "production.plan.created",
      summary: "Produktionsplan erstellt",
      actor: { name: "Küche" }
    };
    expect(formatAuditEventHandoffLabel(auditEvent)).toBe(
      "Produktionsplan erstellt · Küche · production.plan.created · 2026-05-21T10:00:00.000Z"
    );
    expect(formatLatestAuditOverviewLabel(auditEvent)).toBe(
      "Produktionsplan erstellt · Actor: Küche · Action: production.plan.created · 2026-05-21T10:00:00.000Z"
    );
  });

  it("keeps numeric newest sorting limited to generated id suffixes", () => {
    const sortedPlans = [
      { planId: "plan-spec-20260520" },
      { planId: "plan-spec-20260522" },
      { planId: "manual-3" }
    ].sort(compareNewestRecordsBy("planId"));

    expect(sortedPlans.map((plan) => plan.planId)).toEqual([
      "plan-spec-20260522",
      "plan-spec-20260520",
      "manual-3"
    ]);
  });
});
