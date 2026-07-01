import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProductionConversationProjection, createUploadSourceMetadata } from "@catering/shared-core";
import { renderProductionPlanHtml } from "@catering/print-export";

const acceptedSpec = {
  specId: "spec-pa14-1",
  readiness: { status: "ready", reasons: [] },
  event: { type: "conference", date: "2026-07-14" },
  attendees: { expected: 42 },
  servicePlan: { eventType: "conference", serviceForm: "buffet" },
  menuPlan: [],
  assumptions: [],
  missingFields: []
};

const productionPlan = {
  schemaVersion: "1.0.0",
  planId: "plan-pa14-1",
  eventSpecId: "spec-pa14-1",
  readiness: { status: "ready", reasons: [] },
  productionBatches: [],
  timeline: [],
  kitchenSheets: [],
  recipeSelections: [],
  unresolvedItems: []
};

const purchaseList = {
  purchaseListId: "purchase-pa14-1",
  eventSpecId: "spec-pa14-1",
  items: [],
  totals: { itemCount: 0 }
};

describe("PA14 document ingestion corridor readiness anchor", () => {
  it("anchors source, ingestion status, warning visibility and export safety without raw text", () => {
    const sourceMetadata = createUploadSourceMetadata({
      filename: "pa14-abnahme-angebot.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("PA14 source bytes", "utf8"),
      uploadContext: "intake",
      ingestedAt: "2026-05-21T14:00:00.000Z"
    });

    const projection = buildProductionConversationProjection({
      spec: acceptedSpec,
      questions: [],
      sourceInputs: [
        {
          kind: "pdf",
          content: "%PDF PA14 Rohtext darf nicht in Abnahme- oder Exportankern erscheinen.",
          documentId: "document-pa14-fallback-1",
          sourceMetadata,
          documentIngestion: {
            status: "fallback",
            warnings: ["document_text_extraction_fallback"]
          }
        }
      ],
      productionPlans: [productionPlan],
      purchaseLists: [purchaseList]
    });

    const sourceAnchor = projection.messages.find((message) => message.type === "source_provenance_anchor");
    const warningAnchor = projection.messages.find((message) => message.type === "ingestion_warning_anchor");
    const outputAnchor = projection.messages.find((message) => message.type === "production_output_anchor");

    expect(sourceAnchor?.text).toContain("pa14-abnahme-angebot.pdf");
    expect(sourceAnchor?.text).toContain("sha256:");
    expect(warningAnchor?.text).toBe(
      "Quelle prüfen: pa14-abnahme-angebot.pdf · Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    );
    expect(outputAnchor?.sourceAnchors).toEqual([
      expect.objectContaining({
        documentId: "document-pa14-fallback-1",
        filename: "pa14-abnahme-angebot.pdf",
        ingestionStatus: "fallback",
        ingestionWarnings: ["document_text_extraction_fallback"]
      })
    ]);
    expect(outputAnchor?.text).toContain("Dokumentprüfung");
    expect(JSON.stringify(projection.messages)).not.toContain("PA14 Rohtext");

    const exportHtml = renderProductionPlanHtml({
      ...productionPlan,
      sourceAnchors: outputAnchor?.sourceAnchors,
      extractedText: "%PDF PA14 Rohtext darf nicht im Export erscheinen."
    } as never);

    expect(exportHtml).toContain("Dokumentprüfungen");
    expect(exportHtml).toContain(
      "pa14-abnahme-angebot.pdf · Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    );
    expect(exportHtml).not.toContain("PA14 Rohtext");
    expect(exportHtml).not.toContain("%PDF");
  });

  it("documents the read-only PA14 acceptance anchor in the repo testing guide", () => {
    const testingGuide = readFileSync(new URL("../TESTING.md", import.meta.url), "utf8");
    const c8DemoPath = readFileSync(
      new URL("../docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", import.meta.url),
      "utf8"
    );

    expect(testingGuide).toContain("PA14 DocumentIngestion-Korridor");
    expect(testingGuide).toContain("Quelle vorhanden -> Dokumentpruefung sichtbar -> Warnungen sichtbar -> Exportanker sicher");
    expect(testingGuide).toContain("keine Rohtextspiegelung");
    expect(testingGuide).toContain(
      "Backoffice-Demo-Marker: `Dokumentprüfung: Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert`"
    );
    expect(testingGuide).toContain("Quellenmetadaten (gekürzt)");
    expect(testingGuide).toContain("keine vollen SHA-256-Hashes");
    expect(c8DemoPath).toContain(
      "Dokumentprüfung, zum Beispiel `Dokumentprüfung: Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert`"
    );
    expect(c8DemoPath).toContain("keine vollen SHA-256-Hashes");
  });

  it("makes upload limits and the beta sandbox risk visible without leaking raw document data", () => {
    const testingGuide = readFileSync(new URL("../TESTING.md", import.meta.url), "utf8");
    const c8DemoPath = readFileSync(
      new URL("../docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", import.meta.url),
      "utf8"
    );

    for (const document of [testingGuide, c8DemoPath]) {
      expect(document).toContain("P3-B37 Upload-Grenzen als Beta-Risiko");
      expect(document).toContain("Intake-Dokumentuploads: maximal 25 MB pro Datei und bis zu 3 Dateien pro Multipart-Request");
      expect(document).toContain("Rezeptuploads in Angebot und Produktion: maximal 5 MB und genau eine Datei pro Upload");
      expect(document).toContain("PDF/TXT/MD/EML/Pages");
      expect(document).toContain("Produktionsnahe Verarbeitung echter oder beliebiger Uploads bleibt ohne Sandbox/Worker/AV-Gate `blocked`");
      expect(document).toContain("Warnungen bleiben sichere Dokumentprüfungsmarker ohne Rohtext- oder Vollhash-Spiegelung");
      expect(document).not.toContain("sha256:44df5c6bb17828b242fa96cd873be7e535be26cc742aecadd77237b1f86db31d");
    }
  });

  it("anchors the beta real-data stop gate against PII and sandbox gate decisions", () => {
    const testingGuide = readFileSync(new URL("../TESTING.md", import.meta.url), "utf8");
    const c8DemoPath = readFileSync(
      new URL("../docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", import.meta.url),
      "utf8"
    );

    for (const document of [testingGuide, c8DemoPath]) {
      expect(document).toContain("P3-B38 Echte-Daten-Stop-Gate");
      expect(document).toContain("Demo-/Seed-/synthetische Daten bleiben der erlaubte interne Beta-Korridor");
      expect(document).toContain("echte Personen-/Kunden-/Einsatzdaten bleiben `blocked`");
      expect(document).toContain("PII/Retention/Backup-Gate");
      expect(document).toContain("Sandbox/Worker/AV-Gate");
      expect(document).toContain("kein Compliance-Freibrief");
      expect(document).not.toContain("echte Daten freigegeben");
    }
  });
});
