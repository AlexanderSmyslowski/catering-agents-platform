import type { AcceptedEventSpec } from "@catering/shared-core";
import {
  classifyImpact,
  finalizeClassifiedChangeSet,
  summarizeClassifiedRuleKeys,
  type ClassifyImpactInput,
  type ClassifiedChangeSet,
  type JsonObject
} from "./impact-classifier.js";
import type { AcceptedEventSpecPersistenceAdapter } from "./accepted-event-spec-adapter.js";
import {
  createOpenSpecChangeSet,
  finalizeOpenSpecChangeSet,
  mergeIntoOpenSpecChangeSet,
  type SpecChangeSetRecord,
  type SpecChangeSetStore
} from "./spec-change-set.js";

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export interface ClassifyAndSaveArgs {
  specId: string;
  nextDocument: AcceptedEventSpec;
  lastHardApprovedDocument?: AcceptedEventSpec | null;
  milestones?: ClassifyImpactInput["milestones"];
}

export interface ClassifyAndSaveResult {
  currentDocument: AcceptedEventSpec;
  persistedDocument: AcceptedEventSpec;
  classifiedChangeSet: ClassifiedChangeSet;
  finalizedChangeSet: ReturnType<typeof finalizeClassifiedChangeSet>;
}

export interface ClassifyOnlyResult {
  currentDocument: AcceptedEventSpec;
  classifiedChangeSet: ClassifiedChangeSet;
  finalizedChangeSet: ReturnType<typeof finalizeClassifiedChangeSet>;
}

export interface ClassifyAndTrackArgs extends ClassifyAndSaveArgs {
  actorName: string;
}

export interface ClassifyAndTrackResult extends ClassifyOnlyResult {
  openChangeSet: SpecChangeSetRecord | null;
}

export class SpecGovernanceService {
  constructor(
    private readonly adapter: AcceptedEventSpecPersistenceAdapter<AcceptedEventSpec>,
    private readonly changeSetStore?: SpecChangeSetStore
  ) {}

  async classify(args: ClassifyAndSaveArgs): Promise<ClassifyOnlyResult> {
    const currentDocument = await this.adapter.loadCurrentDocument(args.specId);
    const classifiedChangeSet = classifyImpact({
      currentDocument: toJsonObject(currentDocument),
      nextDocument: toJsonObject(args.nextDocument),
      lastHardApprovedDocument: toJsonObject(args.lastHardApprovedDocument ?? currentDocument),
      milestones: args.milestones
    });

    return {
      currentDocument,
      classifiedChangeSet,
      finalizedChangeSet: finalizeClassifiedChangeSet(classifiedChangeSet.items)
    };
  }

  async classifyAndSave(args: ClassifyAndSaveArgs): Promise<ClassifyAndSaveResult> {
    const { currentDocument, classifiedChangeSet, finalizedChangeSet } = await this.classify(args);
    const persistedDocument = await this.adapter.persistCurrentDocument(args.specId, args.nextDocument);

    return {
      currentDocument,
      persistedDocument,
      classifiedChangeSet,
      finalizedChangeSet
    };
  }

  async classifyAndTrack(args: ClassifyAndTrackArgs): Promise<ClassifyAndTrackResult> {
    const classified = await this.classify(args);
    const classifiedRuleKeys = Array.from(
      new Set(classified.classifiedChangeSet.items.map((item) => item.fieldGroupKey))
    );
    const openChangeSet = await this.upsertOpenChangeSet({
      specId: args.specId,
      actorName: args.actorName,
      activeRuleKeys: classifiedRuleKeys,
      highestImpactLevel: classified.finalizedChangeSet.highestImpactLevel,
      summary: classified.finalizedChangeSet.summary
    });

    return {
      ...classified,
      openChangeSet
    };
  }

  async finalizeChangeSet(input: {
    actorName: string;
    specId?: string;
    changeSetId?: string;
  }): Promise<SpecChangeSetRecord> {
    if (!this.changeSetStore) {
      throw new Error("SpecChangeSet-Store nicht konfiguriert.");
    }

    const existing = input.changeSetId
      ? await this.changeSetStore.getSpecChangeSet(input.changeSetId)
      : input.specId
        ? await this.changeSetStore.getOpenSpecChangeSetForSpec(input.specId)
        : undefined;

    if (!existing) {
      throw new Error("Kein offenes SpecChangeSet gefunden.");
    }

    const finalized = finalizeOpenSpecChangeSet(existing, input.actorName);
    await this.changeSetStore.saveSpecChangeSet(finalized);
    return finalized;
  }

  private async upsertOpenChangeSet(input: {
    specId: string;
    actorName: string;
    activeRuleKeys: string[];
    highestImpactLevel: ReturnType<typeof finalizeClassifiedChangeSet>["highestImpactLevel"];
    summary: string | null;
  }): Promise<SpecChangeSetRecord | null> {
    if (!this.changeSetStore || input.activeRuleKeys.length === 0) {
      return null;
    }

    const existing = await this.changeSetStore.getOpenSpecChangeSetForSpec(input.specId);
    const combinedRuleKeys = existing
      ? Array.from(new Set([...existing.activeRuleKeys, ...input.activeRuleKeys]))
      : input.activeRuleKeys;
    const summary = summarizeClassifiedRuleKeys(combinedRuleKeys) ?? input.summary;
    const record = existing
      ? mergeIntoOpenSpecChangeSet(existing, {
          actorName: input.actorName,
          activeRuleKeys: input.activeRuleKeys,
          highestImpactLevel: input.highestImpactLevel,
          summary
        })
      : createOpenSpecChangeSet({
          specId: input.specId,
          actorName: input.actorName,
          activeRuleKeys: input.activeRuleKeys,
          highestImpactLevel: input.highestImpactLevel,
          summary
        });

    await this.changeSetStore.saveSpecChangeSet(record);
    return record;
  }
}
