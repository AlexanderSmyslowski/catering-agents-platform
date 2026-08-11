import { describe, expect, it } from "vitest";
import {
  copyCaseForNewEvent,
  formatCaseDisplayName,
  normalizeCaseSearchText,
  summarizeCase,
  validateCaseEvent,
  validateOfferCase,
  validateProductionCase,
  type CaseEvent,
  type OfferCase,
  type ProductionCase
} from "@catering/shared-core";

const fixedNow = "2026-06-14T10:30:00.000Z";

function validOfferCase(overrides: Partial<OfferCase> = {}): OfferCase {
  return {
    schemaVersion: "1.0",
    businessId: "commcats",
    caseId: "offer-case-original",
    displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
    status: "completed",
    version: 4,
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-14T09:00:00.000Z",
    product: "offer",
    approvedOfferId: "approved-offer-1",
    productionHandoffId: "handoff-1",
    ...overrides
  };
}

function validProductionCase(overrides: Partial<ProductionCase> = {}): ProductionCase {
  return {
    schemaVersion: "1.0",
    businessId: "commcats",
    caseId: "production-case-original",
    displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
    status: "open",
    version: 2,
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-14T09:00:00.000Z",
    product: "production",
    productionHandoffId: "handoff-1",
    approvedProductionSpecId: "approved-production-spec-1",
    currentPlanId: "plan-1",
    currentPurchaseListId: "purchase-list-1",
    ...overrides
  };
}

function validInstructionEvent(overrides: Partial<CaseEvent> = {}): CaseEvent {
  return {
    businessId: "commcats",
    eventId: "event-2",
    caseId: "production-case-original",
    sequence: 2,
    at: fixedNow,
    role: "user",
    kind: "instruction",
    text: "Bitte Dessert entfernen.",
    ...overrides
  };
}

describe("case contracts", () => {
  it("validates product-specific cases and rejects cross-product result fields", () => {
    expect(validateOfferCase(validOfferCase())).toEqual(validOfferCase());
    expect(validateProductionCase(validProductionCase())).toEqual(validProductionCase());

    expect(() => validateOfferCase({
      ...validOfferCase(),
      currentPlanId: "plan-from-production"
    } as OfferCase)).toThrow(/additional properties|must NOT have additional properties/i);
  });

  it("requires a positive sequence for every append-only event", () => {
    expect(validateCaseEvent(validInstructionEvent()).sequence).toBe(2);
    expect(() => validateCaseEvent(validInstructionEvent({ sequence: 0 }))).toThrow(/sequence/i);
  });

  it("requires structured source metadata for source events", () => {
    const sourceEvent: CaseEvent = {
      ...validInstructionEvent(),
      eventId: "event-source",
      kind: "source_added",
      role: "system",
      sourceId: "source-1",
      sourceRef: {
        sourceId: "source-1",
        documentId: "document-1",
        filename: "Angebot.pdf",
        mimeType: "application/pdf",
        sha256: "a".repeat(64),
        dataClass: "personal_confidential",
        addedAt: fixedNow
      },
      text: "Originalangebot hinzugefügt."
    };

    expect(validateCaseEvent(sourceEvent).sourceRef).toEqual(sourceEvent.sourceRef);
    expect(() => validateCaseEvent({ ...sourceEvent, sourceRef: undefined })).toThrow(/sourceRef/i);
    expect(() => validateCaseEvent({ ...sourceEvent, sourceId: "source-2" })).toThrow(/sourceId/i);
  });

  it("requires structured revision metadata for revision events", () => {
    const revisionEvent: CaseEvent = {
      ...validInstructionEvent(),
      eventId: "event-revision",
      kind: "revision_created",
      role: "assistant",
      artifactId: "production-draft-2",
      revisionRef: {
        artifactType: "ProductionDraft",
        artifactId: "production-draft-2",
        revision: 2,
        createdAt: fixedNow,
        supersedesArtifactId: "production-draft-1"
      },
      text: "Produktionsentwurf überarbeitet."
    };

    expect(validateCaseEvent(revisionEvent).revisionRef).toEqual(revisionEvent.revisionRef);
    expect(() => validateCaseEvent({ ...revisionEvent, revisionRef: undefined })).toThrow(/revisionRef/i);
    expect(() => validateCaseEvent({ ...revisionEvent, artifactId: "another-draft" })).toThrow(/artifactId/i);
  });

  it("rejects event fields and roles that contradict the event kind", () => {
    expect(() => validateCaseEvent(validInstructionEvent({
      role: "assistant"
    }))).toThrow(/role|Rolle|user/i);
    expect(() => validateCaseEvent(validInstructionEvent({
      artifactId: "production-draft-hidden"
    }))).toThrow(/artifactId/i);
    expect(() => validateCaseEvent({
      ...validInstructionEvent(),
      eventId: "event-created",
      sequence: 1,
      kind: "case_created",
      role: "user"
    })).toThrow(/role|Rolle|system/i);
  });

  it("rejects forbidden raw provider keys recursively while allowing ordinary human text", () => {
    expect(validateCaseEvent(validInstructionEvent({
      text: "Bitte im Ergebnis nicht den Begriff rawResponse verwenden."
    })).text).toContain("rawResponse");

    expect(() => validateCaseEvent({
      ...validInstructionEvent(),
      metadata: {
        trace: {
          providerResponse: "raw provider output"
        }
      }
    } as unknown as CaseEvent)).toThrow(/providerResponse is not allowed in CaseEvent/i);
  });

  it("copies a case without carrying approvals or result references into the new event", () => {
    const copy = copyCaseForNewEvent(validOfferCase(), {
      caseId: "offer-case-copy",
      now: fixedNow
    });

    expect(copy.case).toMatchObject({
      caseId: "offer-case-copy",
      copiedFromCaseId: "offer-case-original",
      product: "offer",
      status: "open",
      version: 1,
      createdAt: fixedNow,
      updatedAt: fixedNow
    });
    expect(copy.case.approvedOfferId).toBeUndefined();
    expect(copy.case.productionHandoffId).toBeUndefined();
    expect(copy.initialEvents.map((event) => event.kind)).toEqual(["case_copied"]);
    expect(copy.initialEvents[0]).toMatchObject({
      businessId: "commcats",
      caseId: "offer-case-copy",
      sequence: 1,
      artifactId: "offer-case-original"
    });
  });

  it("clears every production result reference when copying a production case", () => {
    const copy = copyCaseForNewEvent(validProductionCase(), {
      caseId: "production-case-copy",
      now: fixedNow
    });

    expect(copy.case.product).toBe("production");
    if (copy.case.product !== "production") throw new Error("Expected production copy");
    expect(copy.case.productionHandoffId).toBeUndefined();
    expect(copy.case.approvedProductionSpecId).toBeUndefined();
    expect(copy.case.currentPlanId).toBeUndefined();
    expect(copy.case.currentPurchaseListId).toBeUndefined();
  });

  it("formats concise deterministic case names and uses an injected fallback date", () => {
    expect(formatCaseDisplayName({
      customerName: " CommCats ",
      eventTypeLabel: "Empfang",
      eventDate: "2026-06-14",
      attendeeCount: 45,
      fallbackDate: "2026-01-01"
    })).toBe("CommCats - Empfang - 14.06.2026 - 45 Personen");

    expect(formatCaseDisplayName({
      fallbackDate: "2026-06-14"
    })).toBe("Neuer Auftrag - 14.06.2026");
  });

  it("normalizes only the supplied search value with Unicode-compatible German casing", () => {
    expect(normalizeCaseSearchText("  CAFÉ\u00a0Empfang  ")).toBe("café empfang");
    expect(normalizeCaseSearchText("Ａｎｇｅｂｏｔ")).toBe("angebot");
  });

  it("projects either product into the same concise case summary", () => {
    expect(summarizeCase(validOfferCase())).toEqual({
      caseId: "offer-case-original",
      product: "offer",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "completed",
      createdAt: "2026-06-10T08:00:00.000Z",
      updatedAt: "2026-06-14T09:00:00.000Z"
    });
    expect(summarizeCase(validProductionCase())).toEqual({
      caseId: "production-case-original",
      product: "production",
      displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
      status: "open",
      createdAt: "2026-06-10T08:00:00.000Z",
      updatedAt: "2026-06-14T09:00:00.000Z"
    });
  });
});
