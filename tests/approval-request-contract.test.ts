import { readFileSync } from "node:fs";
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

const actorSources = [
  "trusted-proxy:x-catering-actor-name",
  "dev-header:x-actor-name",
  "dev-default",
  "service-default",
  "untrusted"
] as const;

const roles = [
  "intake_operator",
  "offer_operator",
  "production_operator",
  "operations_audit_operator"
] as const;

const trustedFactoryActor = {
  name: "Angebots-Mitarbeiter",
  businessId: "alpha",
  source: "trusted-proxy:x-catering-actor-name" as const,
  trusted: true
};

type ApprovalOverrides = Omit<Partial<ApprovalRequestRecord>, "target" | "decidedBy"> & {
  target?: Partial<ApprovalRequestRecord["target"]>;
  decidedBy?: Partial<ApprovalRequestRecord["decidedBy"]>;
};

function validApproval(
  overrides: ApprovalOverrides = {}
): ApprovalRequestRecord {
  const { target: targetOverrides, decidedBy: decidedByOverrides, ...recordOverrides } = overrides;
  const businessId = recordOverrides.businessId ?? "alpha";
  const approvalTarget = { ...target, ...targetOverrides };

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
      ...decidedByOverrides
    },
    ...recordOverrides
  } as ApprovalRequestRecord;
}

function createFactoryRecord(overrides: {
  actor?: Record<string, unknown>;
  target?: Record<string, unknown>;
  selectedVariantId?: string;
  comment?: string;
} = {}): ApprovalRequestRecord {
  return createApprovalRequestRecord({
    actor: { ...trustedFactoryActor, ...overrides.actor },
    role: "offer_operator",
    target: { ...target, ...overrides.target },
    decision: "approved",
    ...(overrides.selectedVariantId === undefined ? {} : { selectedVariantId: overrides.selectedVariantId }),
    ...(overrides.comment === undefined ? {} : { comment: overrides.comment })
  } as never);
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

  it.each(["aa", "a".repeat(64)])("accepts a business ID at the valid boundary", (businessId) => {
    expect(validateApprovalRequestRecord(validApproval({ businessId }))).toMatchObject({ businessId });
  });

  it.each(["a", "a".repeat(65)])("rejects a business ID outside its boundary", (businessId) => {
    expect(() => validateApprovalRequestRecord(validApproval({ businessId }))).toThrow();
  });

  it.each(roles)("accepts the minimal MVP approval role %s", (role) => {
    expect(validateApprovalRequestRecord(validApproval({ decidedBy: { role } }))).toMatchObject({
      decidedBy: { role }
    });
  });

  it.each([1, 2147483647])("accepts target revision %s at the valid boundary", (revision) => {
    expect(validateApprovalRequestRecord(validApproval({ target: { revision } }))).toMatchObject({
      target: { revision }
    });
  });

  it("does not accept review-card working states as approval", () => {
    expect(() => validateApprovalRequestRecord(validApproval({ decision: "fits" as never }))).toThrow();
  });

  it("uses one target key for competing final decisions", () => {
    const approvalFor = (decision: "approved" | "rejected") => createApprovalRequestRecord({
      actor: {
        name: "Angebots-Mitarbeiter",
        businessId: "alpha",
        source: "trusted-proxy:x-catering-actor-name",
        trusted: true
      },
      role: "offer_operator",
      target,
      decision,
      now: new Date("2026-08-10T12:00:00.000Z")
    });

    const approved = approvalFor("approved");
    const rejected = approvalFor("rejected");

    expect(approved.decision).toBe("approved");
    expect(rejected.decision).toBe("rejected");
    expect(approved.approvalRequestId).toBe(rejected.approvalRequestId);
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

  it("always returns a record accepted by the public validator", () => {
    const record = createFactoryRecord({
      selectedVariantId: "variant-standard",
      comment: "Freigegeben."
    });

    expect(validateApprovalRequestRecord(record)).toEqual(record);
  });

  it.each(["", "x".repeat(161)])("rejects an invalid runtime actor name", (name) => {
    expect(() => createFactoryRecord({ actor: { name } })).toThrow();
  });

  it.each(["", "   ", "x".repeat(161)])("rejects an invalid selected variant ID", (selectedVariantId) => {
    expect(() => createFactoryRecord({ selectedVariantId })).toThrow();
  });

  it("rejects an overlong runtime comment", () => {
    expect(() => createFactoryRecord({ comment: "x".repeat(1001) })).toThrow();
  });

  it("rejects runtime unknown target and actor fields", () => {
    expect(() => createFactoryRecord({ target: { clientTargetField: "untrusted-client" } })).toThrow();
    expect(() => createFactoryRecord({ actor: { clientActorField: "untrusted-client" } })).toThrow();
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

  it.each(actorSources.flatMap((source) => [true, false].map((trusted) => [source, trusted] as const)))(
    "accepts only the resolver-trusted %s actor source when trusted is %s",
    (source, trusted) => {
      const create = () => createApprovalRequestRecord({
        actor: {
          name: "Angebots-Mitarbeiter",
          businessId: "alpha",
          source,
          trusted
        },
        role: "offer_operator",
        target,
        decision: "approved"
      });

      if (source === "trusted-proxy:x-catering-actor-name" && trusted) {
        expect(create()).toMatchObject({ decidedBy: { source } });
      } else {
        expect(create).toThrow();
      }
    }
  );

  it.each(actorSources)("accepts only trusted-proxy provenance in a final record: %s", (source) => {
    const record = validApproval({ decidedBy: { source } });
    if (source === "trusted-proxy:x-catering-actor-name") {
      expect(validateApprovalRequestRecord(record)).toEqual(record);
    } else {
      expect(() => validateApprovalRequestRecord(record)).toThrow();
    }
  });

  it("uses a fixed SHA-256 target ID for reserved characters and Unicode", () => {
    const artifactId = "draft:%/😀";
    const id = approvalRequestIdForTarget({
      businessId: "alpha",
      target: { kind: "offer_draft", artifactId, revision: 2 }
    });

    expect(id).toMatch(/^approval-[a-f0-9]{64}$/);
    expect(id).not.toBe(approvalRequestIdForTarget({
      businessId: "alpha",
      target: { kind: "offer_draft", artifactId: "draft:%/😀x", revision: 2 }
    }));
  });

  it("accepts the target ID boundary as Unicode code points", () => {
    const artifactId = "😀".repeat(160);
    expect(validateApprovalRequestRecord(validApproval({ target: { artifactId } }))).toMatchObject({
      target: { artifactId }
    });
    expect(createApprovalRequestRecord({
      actor: {
        name: "Angebots-Mitarbeiter",
        businessId: "alpha",
        source: "trusted-proxy:x-catering-actor-name",
        trusted: true
      },
      role: "offer_operator",
      target: { kind: "offer_draft", artifactId, revision: 1 },
      decision: "approved"
    }).target.artifactId).toBe(artifactId);
  });

  it("accepts the target ID boundary as ASCII code points", () => {
    const artifactId = "x".repeat(160);
    expect(approvalRequestIdForTarget({
      businessId: "alpha",
      target: { kind: "offer_draft", artifactId, revision: 1 }
    })).toMatch(/^approval-[a-f0-9]{64}$/);
  });

  it.each([
    "😀".repeat(161),
    "draft\ud800"
  ])("rejects an invalid Unicode target ID", (artifactId) => {
    expect(() => approvalRequestIdForTarget({
      businessId: "alpha",
      target: { kind: "offer_draft", artifactId, revision: 1 }
    })).toThrow();
  });

  it.each([
    ["equal timestamps", "2026-08-10T12:00:00.000Z", "2026-08-10T12:00:00.000Z", false],
    ["later decision", "2026-08-10T12:00:00.000Z", "2026-08-10T12:00:01.000Z", false],
    ["inverted timestamps", "2026-08-11T12:00:00.000Z", "2026-08-10T12:00:00.000Z", true],
    ["equivalent offset timestamps", "2026-08-10T14:00:00.000+02:00", "2026-08-10T12:00:00.000Z", false]
  ])("enforces approval chronology for %s", (_caseName, requestedAt, decidedAt, shouldReject) => {
    const validate = () => validateApprovalRequestRecord(validApproval({ requestedAt, decidedAt }));
    if (shouldReject) {
      expect(validate).toThrow();
    } else {
      expect(validate()).toMatchObject({ requestedAt, decidedAt });
    }
  });

  it.each(["", "   ", "\t\n"])("rejects a blank comment", (comment) => {
    expect(() => validateApprovalRequestRecord(validApproval({ comment }))).toThrow();
  });

  it("keeps approval identity cycle-free while preserving direct and barrel imports", async () => {
    const approvalModule = readFileSync("shared-core/src/approval-request.ts", "utf8");
    const validationModule = readFileSync("shared-core/src/validation.ts", "utf8");

    expect(approvalModule).toContain('from "./validation.js"');
    expect(validationModule).not.toContain('from "./approval-request.js"');
    await expect(import("../shared-core/src/approval-request.js")).resolves.toHaveProperty("createApprovalRequestRecord");
    await expect(import("../shared-core/src/validation.js")).resolves.toHaveProperty("validateApprovalRequestRecord");
    await expect(import("@catering/shared-core")).resolves.toHaveProperty("approvalRequestIdForTarget");
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

  it("rejects unexpected nested target and actor fields", () => {
    expect(() => validateApprovalRequestRecord({
      ...validApproval(),
      target: { ...target, clientArtifactId: "untrusted-client" }
    } as ApprovalRequestRecord)).toThrow();
    expect(() => validateApprovalRequestRecord({
      ...validApproval(),
      decidedBy: { ...validApproval().decidedBy, clientRole: "untrusted-client" }
    } as ApprovalRequestRecord)).toThrow();
  });
});
