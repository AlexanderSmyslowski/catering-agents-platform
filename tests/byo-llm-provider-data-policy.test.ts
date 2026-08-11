import { chmodSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BoundaryGuardedLlmAdapter,
  buildBoundaryGuardedLlmAdapterFromEnv,
  byoLlmProviderDescriptorFromEnv,
  createByoLlmProviderDescriptor,
  evaluateByoLlmProviderDataGate,
  llmReadinessEvalFixtures,
  loadByoLlmExternalProcessingApprovalFromEnv,
  redactByoLlmEndpointForAudit,
  FixtureOnlyLlmReadinessProviderAdapter,
  type ByoLlmExternalProcessingApproval,
  type ByoLlmProviderDataContext,
  type LlmReadinessProviderAdapter
} from "@catering/shared-core";
import { buildByoLlmAdapterFromEnv } from "../shared-core/src/byo-llm-runtime.js";

const context: ByoLlmProviderDataContext = {
  businessId: "local",
  dataClass: "private_business",
  purpose: "production_draft_extraction"
};

function validApproval(
  providerKind: ByoLlmExternalProcessingApproval["providerKind"] = "openai"
): ByoLlmExternalProcessingApproval {
  return {
    approvalId: `approval-local-${providerKind}-production-v1`,
    businessId: "local",
    providerKind,
    allowedDataClasses: ["private_business"],
    allowedPurposes: ["production_draft_extraction"],
    allowedModels: ["gpt-test"],
    allowedCapabilities: ["document_understanding"],
    allowedRegions: ["eu"],
    allowedEndpoints: ["https://api.example.test/v1/responses"],
    maxCostEurPerCall: 0.12,
    retentionPolicy: "zero-retention",
    trainingUse: "contractually_excluded",
    legalBasisReference: "DPA-2026-01",
    approvedBy: "privacy-officer",
    approvedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-12-31T00:00:00.000Z"
  };
}

function externalDescriptor(providerKind: "openai" | "codex_cli" = "openai") {
  return createByoLlmProviderDescriptor({
    providerKind,
    dataLeavesInstallation: true,
    providerModel: "gpt-test",
    capability: "document_understanding",
    actualRegion: "eu",
    maximumEstimatedCostEur: 0.12,
    retentionPolicy: "zero-retention",
    trainingUse: "contractually_excluded",
    endpoint: "https://api.example.test/v1/responses",
    metadataVerified: true
  });
}

describe("BYO LLM provider data policy", () => {
  it.each([
    ["openai", "private_business"],
    ["openai", "personal_confidential"],
    ["codex_cli", "private_business"],
    ["codex_cli", "personal_confidential"]
  ] as const)("blocks %s %s data without approval before delegation", async (providerKind, dataClass) => {
    const delegate = vi.fn<LlmReadinessProviderAdapter["run"]>(async (_request) => ({
      ok: true,
      errors: [],
      adapterId: "test-delegate",
      adapterMode: "synthetic_live" as const
    }));
    const descriptor = createByoLlmProviderDescriptor({
      providerKind,
      dataLeavesInstallation: true,
      providerModel: "test-model",
      capability: "text_generation",
      actualRegion: "eu",
      maximumEstimatedCostEur: 0.01,
      retentionPolicy: "zero-retention",
      trainingUse: "contractually_excluded",
      endpoint: "https://api.example.test/v1/responses",
      metadataVerified: true
    });
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor,
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      delegate: {
        adapterId: "test-delegate",
        adapterMode: "synthetic_live",
        run: delegate
      }
    });

    const result = await guarded.execute(
      { input: structuredClone(llmReadinessEvalFixtures[0].input) },
      { ...context, dataClass }
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("external provider calls require a matching processing approval");
    expect(delegate).not.toHaveBeenCalled();
  });

  it("fails closed with complete policy metadata when approval loading fails", async () => {
    const delegate = vi.fn<LlmReadinessProviderAdapter["run"]>();
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(),
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => {
        throw new Error("sensitive approval path details");
      },
      delegate: {
        adapterId: "test-delegate",
        adapterMode: "synthetic_live",
        run: delegate
      }
    });

    const result = await guarded.execute(
      { input: structuredClone(llmReadinessEvalFixtures[0].input) },
      context
    );

    expect(result).toMatchObject({
      ok: false,
      errors: ["external processing approval could not be loaded"],
      processingPolicy: {
        businessId: "local",
        providerKind: "openai",
        providerModel: "gpt-test",
        capability: "document_understanding",
        actualRegion: "eu",
        endpoint: "https://api.example.test",
        maximumEstimatedCostEur: 0.12,
        retentionPolicy: "zero-retention",
        trainingUse: "contractually_excluded",
        purpose: "production_draft_extraction",
        dataClass: "private_business",
        inputHash: expect.stringMatching(/^sha256:/),
        sourceHash: expect.stringMatching(/^sha256:/),
        projectionHash: expect.stringMatching(/^sha256:/),
        successClass: "policy_rejected"
      }
    });
    expect(JSON.stringify(result)).not.toContain("sensitive approval path details");
    expect(delegate).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong business", { businessId: "other" }],
    ["wrong purpose", { allowedPurposes: ["clarification_draft"] }],
    ["wrong region", { allowedRegions: ["us"] }],
    ["wrong model", { allowedModels: ["other-model"] }],
    ["missing capability", { allowedCapabilities: ["text_generation"] }],
    ["over budget", { maxCostEurPerCall: 0.01 }],
    ["expired", { expiresAt: "2026-01-01T00:00:00.000Z" }],
    ["training allowed", { trainingUse: "allowed" }]
  ])("fails closed for a %s approval", (_name, mutation) => {
    const approval = { ...validApproval(), ...mutation } as ByoLlmExternalProcessingApproval;

    const result = evaluateByoLlmProviderDataGate({
      provider: externalDescriptor(),
      context,
      approval,
      now: new Date("2026-08-11T00:00:00.000Z")
    });

    expect(result.allowed).toBe(false);
  });

  it("retains a validated approval id on a rejected policy decision", () => {
    const result = evaluateByoLlmProviderDataGate({
      provider: externalDescriptor(),
      context,
      approval: { ...validApproval(), allowedModels: ["different-model"] },
      now: new Date("2026-08-11T00:00:00.000Z")
    });

    expect(result).toMatchObject({
      allowed: false,
      approvalId: "approval-local-openai-production-v1"
    });
  });

  it.each(["openai", "codex_cli"] as const)("allows exactly one matching %s external call", async (providerKind) => {
    const delegate = vi.fn<LlmReadinessProviderAdapter["run"]>(async (_request) => ({
      ok: true,
      errors: [],
      adapterId: "test-delegate",
      adapterMode: "synthetic_live" as const
    }));
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(providerKind),
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => validApproval(providerKind),
      delegate: {
        adapterId: "test-delegate",
        adapterMode: "synthetic_live",
        run: delegate
      }
    });

    const result = await guarded.execute({ input: structuredClone(llmReadinessEvalFixtures[0].input) }, context);

    expect(result.ok).toBe(true);
    expect(delegate).toHaveBeenCalledTimes(1);
    expect(result.processingPolicy).toMatchObject({
      approvalId: `approval-local-${providerKind}-production-v1`,
      providerKind,
      providerModel: "gpt-test",
      capability: "document_understanding",
      actualRegion: "eu",
      endpoint: "https://api.example.test",
      purpose: "production_draft_extraction",
      dataClass: "private_business",
      successClass: "success"
    });
    expect(result.processingPolicy?.inputHash).toMatch(/^sha256:/);
    expect(JSON.stringify(result.processingPolicy)).not.toContain("approval.local");
  });

  it("blocks an injected external adapter before execution without synthetic opt-in", async () => {
    const delegate = vi.fn<LlmReadinessProviderAdapter["run"]>(async (_request) => ({
      ok: true,
      errors: [],
      adapterId: "test-delegate",
      adapterMode: "synthetic_live" as const
    }));
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(),
      env: {},
      approvalResolver: () => validApproval(),
      delegate: { adapterId: "test-delegate", adapterMode: "synthetic_live", run: delegate }
    });

    const result = await guarded.execute({ input: structuredClone(llmReadinessEvalFixtures[0].input) }, context);

    expect(result).toMatchObject({
      ok: false,
      errors: ["provider calls require explicit synthetic-live opt-in"],
      processingPolicy: { successClass: "policy_rejected" }
    });
    expect(delegate).not.toHaveBeenCalled();
  });

  it("sanitizes external provider failures and never returns a raw output candidate", async () => {
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(),
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => validApproval(),
      delegate: {
        adapterId: "test-delegate",
        adapterMode: "synthetic_live",
        run: async () => ({
          ok: false,
          errors: ["provider returned secret prompt and response: customer@example.test"],
          adapterId: "test-delegate",
          adapterMode: "synthetic_live" as const,
          providerId: "provider returned customer@example.test",
          providerRequestId: "request contained customer@example.test",
          outputCandidate: structuredClone(llmReadinessEvalFixtures[0].expectedOutput)
        })
      }
    });

    const result = await guarded.execute({ input: structuredClone(llmReadinessEvalFixtures[0].input) }, context);

    expect(result).toMatchObject({
      ok: false,
      errors: ["BYO LLM provider call failed"],
      outputCandidate: undefined,
      processingPolicy: { successClass: "provider_rejected" }
    });
    expect(JSON.stringify(result)).not.toContain("customer@example.test");
  });

  it("fails closed when an external delegate reports success with errors", async () => {
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(),
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => validApproval(),
      delegate: {
        adapterId: "test-delegate",
        adapterMode: "synthetic_live",
        run: async () => ({
          ok: true,
          errors: ["provider leaked secret: customer@example.test"],
          adapterId: "test-delegate",
          adapterMode: "synthetic_live" as const,
          outputCandidate: structuredClone(llmReadinessEvalFixtures[0].expectedOutput)
        })
      }
    });

    const result = await guarded.execute({ input: structuredClone(llmReadinessEvalFixtures[0].input) }, context);

    expect(result).toMatchObject({
      ok: false,
      errors: ["BYO LLM provider call failed"],
      outputCandidate: undefined,
      processingPolicy: { successClass: "provider_rejected" }
    });
    expect(JSON.stringify(result)).not.toContain("customer@example.test");
  });

  it("projects contact-bearing prompt context before an external delegate sees it", async () => {
    const delegate = vi.fn<LlmReadinessProviderAdapter["run"]>(async (_request) => ({
      ok: true,
      errors: [],
      adapterId: "test-delegate",
      adapterMode: "synthetic_live" as const,
      outputCandidate: { ...structuredClone(llmReadinessEvalFixtures[0].expectedOutput), text: "{}" }
    }));
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(),
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => validApproval(),
      delegate: { adapterId: "test-delegate", adapterMode: "synthetic_live", run: delegate }
    });
    const promptContext = [
      "Max Mustermann",
      "Musterweg 12",
      "+49 151 12345678",
      "Max Mustermann | +49 151 12345678",
      "Musterweg 12, 12345 Berlin",
      "Max Mustermann | 0151 12345678",
      "Telefon Max Mustermann 0151 12345678",
      "Max Mustermann, 0151/12345678",
      "Musterweg 12 · 12345 Berlin",
      "Anrede: Frau Beispiel",
      "Kontakt: Maria Muster, maria@example.test, +49 151 12345678",
      "Adresse: Musterstrasse 1, 12345 Berlin",
      "Kunde: Beispiel GmbH",
      "Firma: Muster Catering",
      "Veranstalter: Max Mustermann",
      "Sehr geehrte Frau Beispiel,",
      "Menu: vegetarisches Sommerbuffet",
      "Budget: 42 EUR pro Person",
      "Termin: 2026-07-24",
      "Ofen: 180 C fuer 25 Minuten"
    ].join("\n");
    const fixtureInput = structuredClone(llmReadinessEvalFixtures[0].input);
    const input = {
      ...fixtureInput,
      sourceRefs: fixtureInput.sourceRefs.map((sourceRef) => ({
        ...sourceRef,
        label: "Angebot_Max_Mustermann.pdf"
      }))
    };

    const result = await guarded.execute(
      { input, promptContext },
      context
    );

    const forwardedRequest = delegate.mock.calls[0]?.[0];
    const forwarded = forwardedRequest?.promptContext ?? "";
    expect(result.ok).toBe(true);
    expect(forwarded).toContain("vegetarisches Sommerbuffet");
    expect(forwarded).toContain("42 EUR pro Person");
    expect(forwarded).toContain("2026-07-24");
    expect(forwarded).toContain("180 C fuer 25 Minuten");
    expect(forwarded).not.toMatch(/maria@example\.test|\+49 151|Musterstrasse|Musterweg|Frau Beispiel|Beispiel GmbH|Muster Catering|Max Mustermann|12345 Berlin/i);
    expect(forwardedRequest?.input.sourceRefs).toEqual([
      {
        objectType: input.sourceRefs[0].objectType,
        objectId: input.sourceRefs[0].objectId,
        label: "external-source-1"
      }
    ]);
    expect(result.processingPolicy).toMatchObject({
      sourceHash: expect.stringMatching(/^sha256:/),
      projectionHash: expect.stringMatching(/^sha256:/)
    });
  });

  it("drops inline address and contact labels from an external projection", async () => {
    const delegate = vi.fn<LlmReadinessProviderAdapter["run"]>(async (_request) => ({
      ok: true,
      errors: [],
      adapterId: "test-delegate",
      adapterMode: "synthetic_live" as const
    }));
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(),
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => validApproval(),
      delegate: { adapterId: "test-delegate", adapterMode: "synthetic_live", run: delegate }
    });

    await guarded.execute(
      {
        input: structuredClone(llmReadinessEvalFixtures[0].input),
        promptContext: "Bitte senden Sie an Max Mustermann, Musterweg 12, 12345 Berlin\nKunde: Ada Lovelace GmbH\nMenu: Sommerbuffet"
      },
      context
    );

    const forwarded = delegate.mock.calls[0]?.[0].promptContext ?? "";
    expect(forwarded).toBe("Menu: Sommerbuffet");
    expect(forwarded).not.toMatch(/Max Mustermann|Musterweg|Ada Lovelace|Berlin/i);
  });

  it("removes customer and venue objects from a structured revision context", async () => {
    const delegate = vi.fn<LlmReadinessProviderAdapter["run"]>(async (_request) => ({
      ok: true,
      errors: [],
      adapterId: "test-delegate",
      adapterMode: "synthetic_live" as const
    }));
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: externalDescriptor(),
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => validApproval(),
      delegate: { adapterId: "test-delegate", adapterMode: "synthetic_live", run: delegate }
    });

    await guarded.execute(
      {
        input: structuredClone(llmReadinessEvalFixtures[0].input),
        promptContext: JSON.stringify({
          event: { customer: { name: "Max Mustermann" }, venue: { name: "Musterhalle" } },
          menu: [{ label: "Sommerbuffet" }],
          budget: 42
        })
      },
      context
    );

    const forwarded = delegate.mock.calls[0]?.[0].promptContext ?? "";
    expect(forwarded).toContain("Sommerbuffet");
    expect(forwarded).toContain("budget");
    expect(forwarded).not.toMatch(/Max Mustermann|Musterhalle|customer|venue/i);
  });

  it("keeps credentials out of processing provenance", async () => {
    const descriptor = createByoLlmProviderDescriptor({
      ...externalDescriptor(),
      endpoint: "https://user:secret@example.test/v1/responses?api_key=secret#fragment"
    });
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor,
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      approvalResolver: () => ({
        ...validApproval(),
        allowedEndpoints: [descriptor.endpoint]
      }),
      delegate: {
        adapterId: "test-delegate",
        adapterMode: "synthetic_live",
        run: async () => ({ ok: true, errors: [], adapterId: "test-delegate", adapterMode: "synthetic_live" as const })
      }
    });

    const result = await guarded.execute({ input: structuredClone(llmReadinessEvalFixtures[0].input) }, context);

    expect(result.processingPolicy?.endpoint).toBe("https://example.test");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(redactByoLlmEndpointForAudit("codex --unsafe")).toMatch(/^sha256:/);
  });

  it("marks an unknown external provider capability as unverified", () => {
    const descriptor = byoLlmProviderDescriptorFromEnv({
      CATERING_LLM_PROVIDER: "openai",
      CATERING_LLM_MODEL: "gpt-test",
      CATERING_LLM_PROVIDER_CAPABILITY: "definitely-invalid",
      CATERING_LLM_PROCESSING_REGION: "eu",
      CATERING_LLM_MAX_ESTIMATED_COST_EUR: "0.12",
      CATERING_LLM_RETENTION_POLICY: "zero-retention",
      CATERING_LLM_TRAINING_USE: "contractually_excluded"
    });

    expect(descriptor.metadataVerified).toBe(false);
  });

  it("fails closed when external runtime metadata uses unknown placeholders", () => {
    const descriptor = byoLlmProviderDescriptorFromEnv({
      CATERING_LLM_PROVIDER: "openai",
      CATERING_LLM_MODEL: "unknown",
      CATERING_LLM_PROVIDER_CAPABILITY: "structured_output",
      CATERING_LLM_PROCESSING_REGION: " unknown ",
      CATERING_LLM_MAX_ESTIMATED_COST_EUR: "0.12",
      CATERING_LLM_RETENTION_POLICY: "unknown",
      CATERING_LLM_TRAINING_USE: "contractually_excluded",
      CATERING_LLM_BASE_URL: "https://api.example.test/v1/responses"
    });

    expect(descriptor.metadataVerified).toBe(false);
    const result = evaluateByoLlmProviderDataGate({
      provider: descriptor,
      context,
      approval: validApproval()
    });
    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("provider runtime metadata is incomplete or unverified");
  });

  it("does not trust unknown metadata on an injected descriptor marked verified", () => {
    const descriptor = createByoLlmProviderDescriptor({
      providerKind: "openai",
      dataLeavesInstallation: true,
      providerModel: "unknown",
      capability: "structured_output",
      actualRegion: "unknown",
      maximumEstimatedCostEur: 0.12,
      retentionPolicy: "unknown",
      trainingUse: "contractually_excluded",
      endpoint: "unknown",
      metadataVerified: true
    });

    const result = evaluateByoLlmProviderDataGate({
      provider: descriptor,
      context,
      approval: {
        ...validApproval(),
        allowedModels: ["unknown"],
        allowedRegions: ["unknown"],
        allowedEndpoints: ["unknown"],
        retentionPolicy: "unknown"
      }
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("provider runtime metadata contains unknown or unsafe values");
  });

  it("does not treat the unset-cost sentinel as verified provider metadata", () => {
    const descriptor = createByoLlmProviderDescriptor({
      ...externalDescriptor(),
      maximumEstimatedCostEur: Number.MAX_VALUE
    });
    const result = evaluateByoLlmProviderDataGate({
      provider: descriptor,
      context,
      approval: { ...validApproval(), maxCostEurPerCall: Number.MAX_VALUE }
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("provider runtime metadata contains unknown or unsafe values");
  });

  it.each(["synthetic_live", "fixture_only"] as const)("blocks an injected %s adapter behind a fixture descriptor before it runs", async (adapterMode) => {
    const delegate = vi.fn();
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: createByoLlmProviderDescriptor({
        providerKind: "fixture",
        dataLeavesInstallation: false,
        providerModel: "fixture",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "local://fixture",
        metadataVerified: true
      }),
      delegate: { adapterId: "injected-openai-looking-adapter", adapterMode, run: delegate }
    });

    const result = await guarded.execute({ input: structuredClone(llmReadinessEvalFixtures[0].input) }, context);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("fixture provider descriptors require the built-in fixture adapter");
    expect(delegate).not.toHaveBeenCalled();
  });

  it.each([
    ["public fixture instance", () => new FixtureOnlyLlmReadinessProviderAdapter()],
    ["runtime fixture wrapper", () => buildByoLlmAdapterFromEnv({ CATERING_LLM_PROVIDER: "fixture" })]
  ] as const)("does not trust a mutated %s", async (_name, createDelegate) => {
    const delegate = createDelegate();
    const maliciousRun = vi.fn(async () => ({
      ok: true,
      errors: [],
      adapterId: delegate.adapterId,
      adapterMode: "fixture_only" as const
    }));
    try {
      Object.defineProperty(delegate, "run", {
        configurable: true,
        value: maliciousRun,
        writable: true
      });
    } catch {
      // An immutable intrinsic implementation is also an acceptable outcome.
    }
    const guarded = new BoundaryGuardedLlmAdapter({
      descriptor: createByoLlmProviderDescriptor({
        providerKind: "fixture",
        dataLeavesInstallation: false,
        providerModel: "fixture",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "local://fixture",
        metadataVerified: true
      }),
      delegate
    });

    const result = await guarded.execute(
      { input: structuredClone(llmReadinessEvalFixtures[0].input) },
      context
    );

    expect(maliciousRun).not.toHaveBeenCalled();
    if (_name === "public fixture instance") {
      expect(result.errors).toContain("fixture provider descriptors require the built-in fixture adapter");
    }
  });

  it("allows the runtime-created fixture adapter without an external approval", async () => {
    const adapter = buildBoundaryGuardedLlmAdapterFromEnv({ CATERING_LLM_PROVIDER: "fixture" });

    const result = await adapter.execute(
      { input: structuredClone(llmReadinessEvalFixtures[0].input) },
      context
    );

    expect(result).toMatchObject({
      ok: true,
      adapterMode: "fixture_only",
      fixtureId: llmReadinessEvalFixtures[0].fixtureId
    });
  });

  it.each(["openai", "codex_cli"] as const)("cannot label %s as local processing", (providerKind) => {
    expect(() => createByoLlmProviderDescriptor({
      providerKind,
      dataLeavesInstallation: false,
      providerModel: "test-model",
      capability: "text_generation",
      actualRegion: "eu",
      maximumEstimatedCostEur: 0.01,
      retentionPolicy: "zero-retention",
      trainingUse: "contractually_excluded",
      endpoint: "https://api.example.test/v1/responses",
      metadataVerified: true
    })).toThrow("must set dataLeavesInstallation to true");
  });

  it("keeps fixture processing local without an approval", () => {
    const result = evaluateByoLlmProviderDataGate({
      provider: createByoLlmProviderDescriptor({
        providerKind: "fixture",
        dataLeavesInstallation: false,
        providerModel: "fixture",
        capability: "structured_output",
      actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "local://fixture",
        metadataVerified: true
      }),
      context
    });

    expect(result).toEqual({ allowed: true, errors: [] });
  });

  it.each([
    ["retention", { retentionPolicy: "30-days" }],
    ["training", { trainingUse: "allowed" }],
    ["endpoint", { endpoint: "https://unapproved.example.test" }]
  ])("blocks mismatched provider %s facts", (_name, mutation) => {
    const result = evaluateByoLlmProviderDataGate({
      provider: { ...externalDescriptor(), ...mutation } as ReturnType<typeof externalDescriptor>,
      context,
      approval: validApproval(),
      now: new Date("2026-08-11T00:00:00.000Z")
    });

    expect(result.allowed).toBe(false);
  });

  it("does not let custom providers self-label as local processing", () => {
    expect(() => createByoLlmProviderDescriptor({
      providerKind: "custom_byo_provider",
      dataLeavesInstallation: false,
      providerModel: "local-looking-model",
      capability: "text_generation",
      actualRegion: "local",
      maximumEstimatedCostEur: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      endpoint: "local://custom",
      metadataVerified: true
    })).toThrow("must set dataLeavesInstallation to true");
  });

  it("loads a private approval file outside the repository", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "catering-approval-valid-"));
    const approvalPath = path.join(directory, "approval.json");
    writeFileSync(approvalPath, JSON.stringify(validApproval()), { mode: 0o600 });

    expect(loadByoLlmExternalProcessingApprovalFromEnv(
      { CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath },
      process.cwd()
    )).toEqual(validApproval());
  });

  it("rejects an approval file inside the repository", () => {
    expect(() => loadByoLlmExternalProcessingApprovalFromEnv(
      { CATERING_LLM_PROCESSING_APPROVAL_FILE: path.join(process.cwd(), "package.json") },
      process.cwd()
    )).toThrow("must point outside the repository");
  });

  it("rejects an approval file reached through a parent symlink into the repository", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "catering-approval-parent-link-"));
    const linkedRepository = path.join(directory, "linked-repository");
    symlinkSync(process.cwd(), linkedRepository, "dir");

    expect(() => loadByoLlmExternalProcessingApprovalFromEnv(
      { CATERING_LLM_PROCESSING_APPROVAL_FILE: path.join(linkedRepository, "package.json") },
      process.cwd()
    )).toThrow("must point outside the repository");
  });

  it("rejects symlinked, writable and oversized approval files", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "catering-approval-unsafe-"));
    const validPath = path.join(directory, "valid.json");
    const symlinkPath = path.join(directory, "approval-link.json");
    const writablePath = path.join(directory, "writable.json");
    const oversizedPath = path.join(directory, "oversized.json");
    writeFileSync(validPath, JSON.stringify(validApproval()), { mode: 0o600 });
    symlinkSync(validPath, symlinkPath);
    writeFileSync(writablePath, JSON.stringify(validApproval()), { mode: 0o600 });
    chmodSync(writablePath, 0o622);
    writeFileSync(oversizedPath, " ".repeat(64 * 1024 + 1), { mode: 0o600 });

    for (const approvalPath of [symlinkPath, writablePath, oversizedPath]) {
      expect(() => loadByoLlmExternalProcessingApprovalFromEnv(
        { CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath },
        process.cwd()
      )).toThrow(/CATERING_LLM_PROCESSING_APPROVAL_FILE/);
    }
  });
});
