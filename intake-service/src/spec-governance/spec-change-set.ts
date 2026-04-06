import type { ImpactLevel } from "./spec-change-rules.js";
import { summarizeClassifiedRuleKeys } from "./impact-classifier.js";

export interface SpecChangeSetRecord {
  changeSetId: string;
  specId: string;
  status: "open" | "finalized";
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  summary: string | null;
  highestImpactLevel: ImpactLevel | null;
  activeRuleKeys: string[];
  finalizedAt: string | null;
  finalizedBy: string | null;
}

export interface SpecChangeSetStore {
  saveSpecChangeSet(record: SpecChangeSetRecord): Promise<void>;
  getSpecChangeSet(changeSetId: string): Promise<SpecChangeSetRecord | undefined>;
  getOpenSpecChangeSetForSpec(specId: string): Promise<SpecChangeSetRecord | undefined>;
  listSpecChangeSetsForSpec(specId: string): Promise<SpecChangeSetRecord[]>;
}

function impactRank(level: ImpactLevel): number {
  return level === "L3" ? 3 : level === "L2" ? 2 : 1;
}

function maxImpact(left: ImpactLevel | null, right: ImpactLevel | null): ImpactLevel | null {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return impactRank(left) >= impactRank(right) ? left : right;
}

function uniqueRuleKeys(existing: string[], incoming: string[]): string[] {
  return Array.from(new Set([...existing, ...incoming]));
}

export function createOpenSpecChangeSet(input: {
  specId: string;
  actorName: string;
  activeRuleKeys: string[];
  highestImpactLevel: ImpactLevel | null;
  summary: string | null;
}): SpecChangeSetRecord {
  const now = new Date().toISOString();
  const activeRuleKeys = uniqueRuleKeys([], input.activeRuleKeys);

  return {
    changeSetId: `change-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    specId: input.specId,
    status: "open",
    createdAt: now,
    createdBy: input.actorName,
    updatedAt: now,
    updatedBy: input.actorName,
    summary: input.summary ?? summarizeClassifiedRuleKeys(activeRuleKeys),
    highestImpactLevel: input.highestImpactLevel,
    activeRuleKeys,
    finalizedAt: null,
    finalizedBy: null
  };
}

export function mergeIntoOpenSpecChangeSet(
  existing: SpecChangeSetRecord,
  input: {
    actorName: string;
    activeRuleKeys: string[];
    highestImpactLevel: ImpactLevel | null;
    summary: string | null;
  }
): SpecChangeSetRecord {
  const activeRuleKeys = uniqueRuleKeys(existing.activeRuleKeys, input.activeRuleKeys);

  return {
    ...existing,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actorName,
    summary: input.summary ?? summarizeClassifiedRuleKeys(activeRuleKeys),
    highestImpactLevel: maxImpact(existing.highestImpactLevel, input.highestImpactLevel),
    activeRuleKeys
  };
}

export function finalizeOpenSpecChangeSet(
  existing: SpecChangeSetRecord,
  actorName: string
): SpecChangeSetRecord {
  if (existing.status !== "open") {
    throw new Error(`SpecChangeSet ist nicht offen: ${existing.changeSetId}`);
  }

  const now = new Date().toISOString();
  return {
    ...existing,
    status: "finalized",
    updatedAt: now,
    updatedBy: actorName,
    finalizedAt: now,
    finalizedBy: actorName
  };
}
