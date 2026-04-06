import { describe, expect, it } from "vitest";
import {
  createOpenSpecChangeSet,
  finalizeOpenSpecChangeSet,
  mergeIntoOpenSpecChangeSet
} from "../spec-change-set.js";

describe("SpecChangeSet", () => {
  it("creates an open change set for the first classified change", () => {
    const changeSet = createOpenSpecChangeSet({
      specId: "spec-1",
      actorName: "Kueche",
      activeRuleKeys: ["notes"],
      highestImpactLevel: "L1",
      summary: "Hinweise/Texte aktualisiert"
    });

    expect(changeSet.specId).toBe("spec-1");
    expect(changeSet.status).toBe("open");
    expect(changeSet.createdBy).toBe("Kueche");
    expect(changeSet.summary).toBe("Hinweise/Texte aktualisiert");
    expect(changeSet.activeRuleKeys).toEqual(["notes"]);
  });

  it("updates the existing open change set instead of creating a second one", () => {
    const existing = createOpenSpecChangeSet({
      specId: "spec-1",
      actorName: "Kueche",
      activeRuleKeys: ["notes"],
      highestImpactLevel: "L1",
      summary: "Hinweise/Texte aktualisiert"
    });

    const updated = mergeIntoOpenSpecChangeSet(existing, {
      actorName: "Einkauf",
      activeRuleKeys: ["guest_count"],
      highestImpactLevel: "L3",
      summary: "Hinweise/Texte aktualisiert & Mengen geaendert"
    });

    expect(updated.changeSetId).toBe(existing.changeSetId);
    expect(updated.updatedBy).toBe("Einkauf");
    expect(updated.highestImpactLevel).toBe("L3");
    expect(updated.activeRuleKeys).toEqual(["notes", "guest_count"]);
    expect(updated.summary).toBe("Hinweise/Texte aktualisiert & Mengen geaendert");
  });

  it("finalizes an open change set correctly", () => {
    const existing = createOpenSpecChangeSet({
      specId: "spec-1",
      actorName: "Kueche",
      activeRuleKeys: ["guest_count"],
      highestImpactLevel: "L3",
      summary: "Mengen geaendert"
    });

    const finalized = finalizeOpenSpecChangeSet(existing, "Leitung");

    expect(finalized.status).toBe("finalized");
    expect(finalized.finalizedBy).toBe("Leitung");
    expect(finalized.finalizedAt).toBeTruthy();
  });

  it("does not finalize the same change set twice", () => {
    const existing = finalizeOpenSpecChangeSet(
      createOpenSpecChangeSet({
        specId: "spec-1",
        actorName: "Kueche",
        activeRuleKeys: ["guest_count"],
        highestImpactLevel: "L3",
        summary: "Mengen geaendert"
      }),
      "Leitung"
    );

    expect(() => finalizeOpenSpecChangeSet(existing, "Leitung")).toThrow(
      /SpecChangeSet ist nicht offen/
    );
  });
});
