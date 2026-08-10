import { describe, expect, it } from "vitest";
import {
  approvalRequestIdForTarget,
  createApprovalRequestRecord,
  validateApprovalRequestRecord,
  type ApprovalRequestRecord
} from "@catering/shared-core";

const target = {
  kind: "offer_draft" as const,
  artifactId: "draft-42",
  revision: 1
};

type ApprovalOverrides = Omit<Partial<ApprovalRequestRecord>, "target" | "decidedBy"> & {
  target?: Partial<ApprovalRequestRecord["target"]>;
  decidedBy?: Partial<ApprovalRequestRecord["decidedBy"]>;
};

function validApproval(
  overrides: ApprovalOverrides = {}
): ApprovalRequestRecord {
  const businessId = overrides.businessId ?? "alpha";
  const approvalTarget = { ...target, ...overrides.target };

  return {
    schemaVersion: "1.0",
    approvalRequestId: approvalRequestIdForTarget({ businessId, target: approvalTarget }),
    businessId,
    target: approvalTarget,
    decision: "approved",
    requestedAt: "2026-08-10T12:00:00.000Z",
    decidedAt: "2026-08-10T12:00:00.000Z",
    decidedBy: {
      name: "Angebots-Mitarbeiter",
      role: "offer_operator",
      source: "trusted-proxy:x-catering-actor-name",
      ...overrides.decidedBy
    },
    ...overrides
  } as ApprovalRequestRecord;
}

describe("ApprovalRequestRecord contract", () => {
  it.each(["approved", "rejected"] as const)("accepts a server-authored %s decision", (decision) => {
    expect(validateApprovalRequestRecord(validApproval({ decision }))).toMatchObject({ decision });
  });

  it.each([
    ["businessId", () => validApproval({ businessId: "" })],
    ["target.revision", () => validApproval({ target: { revision: 0 } })],
    ["decidedBy.name", () => validApproval({ decidedBy: { name: "" } })],
    ["decidedAt", () => validApproval({ decidedAt: "not-a-date" })],
    ["selectedVariantId", () => validApproval({ selectedVariantId: "x".repeat(161) })],
    ["comment", () => validApproval({ comment: "x".repeat(1001) })]
  ])("rejects invalid %s", (_path, createInvalidApproval) => {
    expect(() => validateApprovalRequestRecord(createInvalidApproval())).toThrow();
  });

  it("does not accept review-card working states as approval", () => {
    expect(() => validateApprovalRequestRecord(validApproval({ decision: "fits" as never }))).toThrow();
  });

  it("uses one target key for competing final decisions", () => {
    expect(approvalRequestIdForTarget({ businessId: "alpha", target })).toBe(
      approvalRequestIdForTarget({ businessId: "alpha", target: { ...target } })
    );
  });

  it("uses delimiter-safe target identity without canonicalizing artifact IDs", () => {
    expect(approvalRequestIdForTarget({
      businessId: "alpha",
      target: { kind: "offer_draft", artifactId: "draft:one", revision: 2 }
    })).not.toBe(approvalRequestIdForTarget({
      businessId: "alpha",
      target: { kind: "offer_draft", artifactId: "draft", revision: 2 }
    }));
  });

  it("derives approval authorship and timestamps from trusted server input", () => {
    const record = createApprovalRequestRecord({
      actor: {
        name: "Angebots-Mitarbeiter",
        businessId: "alpha",
        source: "trusted-proxy:x-catering-actor-name",
        trusted: true
      },
      role: "offer_operator",
      target,
      decision: "approved",
      selectedVariantId: "variant-standard",
      comment: "Freigegeben.",
      now: new Date("2026-08-10T12:00:00.000Z")
    });

    expect(record).toEqual({
      schemaVersion: "1.0",
      approvalRequestId: approvalRequestIdForTarget({ businessId: "alpha", target }),
      businessId: "alpha",
      target,
      decision: "approved",
      selectedVariantId: "variant-standard",
      requestedAt: "2026-08-10T12:00:00.000Z",
      decidedAt: "2026-08-10T12:00:00.000Z",
      decidedBy: {
        name: "Angebots-Mitarbeiter",
        role: "offer_operator",
        source: "trusted-proxy:x-catering-actor-name"
      },
      comment: "Freigegeben."
    });
  });

  it("does not create a final approval from an untrusted actor", () => {
    expect(() => createApprovalRequestRecord({
      actor: {
        name: "Untrusted client",
        businessId: "alpha",
        source: "untrusted",
        trusted: false
      },
      role: "offer_operator",
      target,
      decision: "approved"
    })).toThrow();
  });

  it("rejects a record whose ID does not belong to its target", () => {
    expect(() => validateApprovalRequestRecord(validApproval({ approvalRequestId: "approval-wrong-target" }))).toThrow();
  });

  it("rejects unexpected fields so client-authored approval metadata cannot enter the record", () => {
    expect(() => validateApprovalRequestRecord({
      ...validApproval(),
      clientDecidedBy: "untrusted-client"
    } as ApprovalRequestRecord)).toThrow();
  });
});
