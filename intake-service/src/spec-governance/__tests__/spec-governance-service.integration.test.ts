import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "../../app.js";
import { IntakeStore } from "../../store.js";
import { IntakeStoreAcceptedEventSpecAdapter } from "../accepted-event-spec-adapter.js";
import { SpecGovernanceService } from "../spec-governance-service.js";

function createDataRoot() {
  return `/tmp/catering-governance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const cleanupRoots: string[] = [];

afterEach(() => {
  for (const root of cleanupRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("SpecGovernanceService integration", () => {
  it("PATCH with classified change creates and updates a single open change set", async () => {
    const dataRoot = createDataRoot();
    cleanupRoots.push(dataRoot);
    const store = new IntakeStore({ rootDir: dataRoot });
    const app = buildIntakeApp(store);

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/intake/specs/manual",
      payload: {
        eventType: "lunch",
        eventDate: "2026-10-10",
        attendeeCount: 40,
        serviceForm: "buffet",
        menuItems: ["Tomatensuppe"]
      }
    });

    const createdSpec = createResponse.json().acceptedEventSpec;

    const firstPatchResponse = await app.inject({
      method: "PATCH",
      url: `/v1/intake/specs/${createdSpec.specId}`,
      headers: {
        "x-actor-name": "Kueche",
        "x-actor-role": "KitchenEditor"
      },
      payload: {
        attendeeCount: 55
      }
    });

    expect(firstPatchResponse.statusCode).toBe(409);

    const firstChangeSet = await store.getOpenSpecChangeSetForSpec(createdSpec.specId);
    expect(firstChangeSet?.status).toBe("open");
    expect(firstChangeSet?.activeRuleKeys).toEqual(["guest_count"]);
    expect(firstChangeSet?.highestImpactLevel).toBe("L3");
    expect(firstChangeSet?.summary).toMatch(/Mengen geaendert|Mengen verfeinert/);

    const secondPatchResponse = await app.inject({
      method: "PATCH",
      url: `/v1/intake/specs/${createdSpec.specId}`,
      headers: {
        "x-actor-name": "Einkauf",
        "x-actor-role": "ProcurementEditor"
      },
      payload: {
        serviceForm: "plated"
      }
    });

    expect(secondPatchResponse.statusCode).toBe(409);

    const updatedChangeSet = await store.getOpenSpecChangeSetForSpec(createdSpec.specId);
    expect(updatedChangeSet?.changeSetId).toBe(firstChangeSet?.changeSetId);
    expect(updatedChangeSet?.highestImpactLevel).toBe("L3");
    expect(updatedChangeSet?.activeRuleKeys).toEqual(["guest_count", "event_timing"]);
    expect(updatedChangeSet?.summary).toBe("Mengen geaendert & Zeitfenster geaendert");

    await app.close();
  });

  it("finalizeChangeSet marks the open change set as finalized without mutating approval status", async () => {
    const dataRoot = createDataRoot();
    cleanupRoots.push(dataRoot);
    const store = new IntakeStore({ rootDir: dataRoot });
    const app = buildIntakeApp(store);

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/intake/specs/manual",
      payload: {
        eventType: "lunch",
        eventDate: "2026-10-10",
        attendeeCount: 40,
        serviceForm: "buffet",
        menuItems: ["Tomatensuppe"]
      }
    });

    const createdSpec = createResponse.json().acceptedEventSpec;

    await app.inject({
      method: "PATCH",
      url: `/v1/intake/specs/${createdSpec.specId}`,
      headers: {
        "x-actor-name": "Einkauf",
        "x-actor-role": "ProcurementEditor"
      },
      payload: {
        attendeeCount: 55
      }
    });

    const service = new SpecGovernanceService(
      new IntakeStoreAcceptedEventSpecAdapter(store),
      store
    );

    const beforeFinalizeGovernanceState = await store.getSpecGovernanceState(createdSpec.specId);
    expect(beforeFinalizeGovernanceState?.approvalStatus).toBe("pending_reapproval");

    const finalized = await service.finalizeChangeSet({
      specId: createdSpec.specId,
      actorName: "Leitung"
    });

    expect(finalized.status).toBe("finalized");
    expect(finalized.finalizedAt).toBeTruthy();
    expect(finalized.finalizedBy).toBe("Leitung");

    const storedChangeSets = await store.listSpecChangeSetsForSpec(createdSpec.specId);
    expect(storedChangeSets).toHaveLength(1);
    expect(storedChangeSets[0].status).toBe("finalized");

    const afterFinalizeGovernanceState = await store.getSpecGovernanceState(createdSpec.specId);
    expect(afterFinalizeGovernanceState?.approvalStatus).toBe("pending_reapproval");

    await expect(
      service.finalizeChangeSet({
        specId: createdSpec.specId,
        actorName: "Leitung"
      })
    ).rejects.toThrow(/Kein offenes SpecChangeSet gefunden/);

    await app.close();
  });
});
