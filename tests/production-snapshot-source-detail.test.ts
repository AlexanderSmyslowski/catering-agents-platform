import { describe, expect, it } from "vitest";
import { buildProductionConversationState } from "../backoffice-ui/src/production-conversation-state.js";
import { buildProductionIntakeOriginCardState } from "../backoffice-ui/src/production-intake-origin-card-state.js";
import { buildProductionSnapshotSourceDetail } from "../backoffice-ui/src/production-snapshot-source-detail.js";
import type { ProductionWorkspaceState } from "../backoffice-ui/src/api.js";

function workspace(): ProductionWorkspaceState {
  return {
    cases: [],
    activeEvents: [],
    activeSources: [{
      sourceId: "source-document-a",
      documentId: "document-a",
      requestId: "request-a",
      filename: "produktion-angebot.pdf",
      mimeType: "application/pdf",
      sha256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      dataClass: "synthetic_demo",
      addedAt: "2026-05-21T08:30:00.000Z"
    }],
    currentDraft: {
      businessId: "local",
      draftId: "draft-a",
      revision: 1,
      status: "approved",
      createdAt: "2026-05-21T08:31:00.000Z",
      source: {
        kind: "manual_import",
        receivedAt: "2026-04-18T10:30:00.000Z",
        sourceRef: "accepted-event-spec:spec-a"
      },
      reviewCards: [],
      draftArtifacts: {
        eventSpec: {
          schemaVersion: "1.0",
          specId: "spec-a",
          lifecycle: { commercialState: "accepted" },
          readiness: { status: "complete", reasons: [] },
          sourceLineage: [{ sourceType: "manual_input", reference: "request-a" }],
          event: { type: "conference" },
          attendees: { expected: 36 },
          servicePlan: { eventType: "conference", serviceForm: "buffet", modules: [] },
          menuPlan: [],
          budgetContext: {
            pricingSummary: { subtotal: { amount: 8_192.44, currency: "EUR" } }
          }
        }
      }
    },
    referencedRecipes: []
  };
}

describe("Gate B production snapshot source projection", () => {
  it("projects only persisted operational provenance without Intake or commercial data", () => {
    const sourceDetail = buildProductionSnapshotSourceDetail(workspace());

    expect(sourceDetail).toEqual({
      requestId: "request-a",
      source: {
        channel: "manual_form",
        receivedAt: "2026-04-18T10:30:00.000Z"
      },
      rawInputs: [{
        kind: "pdf",
        documentId: "document-a",
        mimeType: "application/pdf",
        sourceMetadata: {
          filename: "produktion-angebot.pdf",
          mimeType: "application/pdf",
          sha256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
          ingestedAt: "2026-05-21T08:30:00.000Z",
          uploadContext: "production"
        }
      }]
    });
    expect(JSON.stringify(sourceDetail)).not.toContain("8192.44");
    expect(JSON.stringify(sourceDetail)).not.toContain("content");
  });

  it("keeps source anchors useful when the Production source has no byte count", () => {
    const sourceDetail = buildProductionSnapshotSourceDetail(workspace());
    expect(sourceDetail).toBeDefined();

    const origin = buildProductionIntakeOriginCardState(sourceDetail!);
    const conversation = buildProductionConversationState({
      focusedProductionSpec: workspace().currentDraft?.draftArtifacts?.eventSpec,
      focusedProductionSpecRecord: workspace().currentDraft?.draftArtifacts?.eventSpec,
      intakeRequestDetail: sourceDetail,
      currentSpecPlans: [],
      currentSpecPurchaseLists: []
    });

    expect(origin.requestSummaryLabel).toBe(
      "Intake-Ursprung: manuelle Eingabe · erhalten 2026-04-18T10:30:00.000Z"
    );
    expect(origin.rawInputs[0]?.sourceMetadataSummary).toBe(
      "produktion-angebot.pdf · application/pdf · sha256:fedcba987654 · production · 2026-05-21T08:30:00.000Z"
    );
    const sourceAnchor = conversation.productionConversationProjection.messages.find(
      (message) => message.type === "source_provenance_anchor"
    );
    expect(sourceAnchor).toMatchObject({
      title: "Quellenanker",
      text: "produktion-angebot.pdf · application/pdf · sha256:fedcba987654 · production · 2026-05-21T08:30:00.000Z"
    });
    expect(sourceAnchor).not.toHaveProperty("sourceAnchors");
  });
});
