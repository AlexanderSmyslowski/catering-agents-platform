import { SPEC_CHANGE_RULES, type ChangeRule, type ImpactLevel, type Milestone } from "./spec-change-rules.js";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type RawDiff = {
  fieldPath: string;
  oldValue: JsonValue | undefined;
  newValue: JsonValue | undefined;
};

export type PointOfNoReturnResult = {
  milestone: Milestone;
  severity: "warn" | "confirm" | "stop";
  prompt: string;
  active: boolean;
};

export type ClassifiedChangeItem = {
  fieldPath: string;
  fieldGroupKey: string;
  oldValue: JsonValue | undefined;
  newValue: JsonValue | undefined;
  oldValuePreview: string | null;
  newValuePreview: string | null;
  impactLevel: ImpactLevel;
  semanticMessage: string;
  thresholdMatched: boolean;
  triggers: string[];
  pointOfNoReturnResults: PointOfNoReturnResult[];
  affectedAggregates: string[];
};

export type ClassifiedChangeSet = {
  items: ClassifiedChangeItem[];
  highestImpactLevel: ImpactLevel | null;
  requiresReapproval: boolean;
  hasPointOfNoReturnConflict: boolean;
  summary: string | null;
};

export type ClassifyImpactInput = {
  currentDocument: JsonObject;
  nextDocument: JsonObject;
  lastHardApprovedDocument?: JsonObject | null;
  milestones?: {
    shoppingCompleted?: boolean;
    productionStarted?: boolean;
  };
};

type ResolvedMilestones = {
  shoppingCompleted: boolean;
  productionStarted: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function preview(value: JsonValue | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return stableStringify(value);
}

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

function diffJson(before: JsonValue | undefined, after: JsonValue | undefined, basePath = ""): RawDiff[] {
  if (deepEqual(before, after)) {
    return [];
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    return keys.flatMap((key) =>
      diffJson(
        before[key] as JsonValue | undefined,
        after[key] as JsonValue | undefined,
        joinPath(basePath, key)
      )
    );
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLen = Math.max(before.length, after.length);
    const arrayDiffs: RawDiff[] = [];
    for (let index = 0; index < maxLen; index += 1) {
      const oldValue = before[index] as JsonValue | undefined;
      const newValue = after[index] as JsonValue | undefined;
      arrayDiffs.push(...diffJson(oldValue, newValue, `${basePath}[${index}]`));
    }
    return arrayDiffs;
  }

  return [{ fieldPath: basePath, oldValue: before, newValue: after }];
}

function canonicalPath(value: string): string {
  return value.replace(/\[\d+\]/g, "").replace(/\.\./g, ".").replace(/\.$/, "");
}

function ruleMatchesFieldPath(rule: ChangeRule, fieldPath: string): boolean {
  const normalizedFieldPath = canonicalPath(fieldPath);
  return rule.fieldPaths.some((candidate) => {
    const normalizedCandidate = canonicalPath(candidate);
    return (
      normalizedFieldPath === normalizedCandidate ||
      normalizedFieldPath.startsWith(`${normalizedCandidate}.`) ||
      fieldPath.startsWith(`${candidate}[`)
    );
  });
}

function getByPath(source: JsonObject | null | undefined, fieldPath: string): JsonValue | undefined {
  if (!source) {
    return undefined;
  }

  const segments = fieldPath.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cursor: unknown = source;

  for (const segment of segments) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      cursor = Number.isNaN(index) ? undefined : cursor[index];
      continue;
    }
    if (typeof cursor !== "object") {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor as JsonValue | undefined;
}

function evaluateThreshold(
  rule: ChangeRule,
  oldValue: JsonValue | undefined,
  newValue: JsonValue | undefined
): boolean {
  switch (rule.threshold.kind) {
    case "ANY_CHANGE":
    case "SEMANTIC_CHANGE":
      return !deepEqual(oldValue, newValue);
    case "PERCENT_DELTA_GT": {
      if (typeof oldValue !== "number" || typeof newValue !== "number") {
        return false;
      }
      if (oldValue === 0) {
        return Math.abs(newValue) > 0;
      }
      const percentage = (Math.abs(newValue - oldValue) / Math.abs(oldValue)) * 100;
      return percentage > rule.threshold.value;
    }
    case "ABSOLUTE_DELTA_GT": {
      if (typeof oldValue !== "number" || typeof newValue !== "number") {
        return false;
      }
      return Math.abs(newValue - oldValue) > rule.threshold.value;
    }
    default: {
      const exhaustive: never = rule.threshold;
      return exhaustive;
    }
  }
}

function resolveBaselineValue(
  rule: ChangeRule,
  diff: RawDiff,
  lastHardApprovedDocument?: JsonObject | null
): JsonValue | undefined {
  if ("compareTo" in rule.threshold && rule.threshold.compareTo === "lastHardApproved") {
    return getByPath(lastHardApprovedDocument ?? null, diff.fieldPath);
  }

  if (rule.impactLevel === "L3" && lastHardApprovedDocument) {
    const baseline = getByPath(lastHardApprovedDocument, diff.fieldPath);
    return baseline === undefined ? diff.oldValue : baseline;
  }

  return diff.oldValue;
}

function pct(oldValue: number, newValue: number): string {
  if (oldValue === 0) {
    return "n/a";
  }
  const value = ((newValue - oldValue) / oldValue) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildSemanticMessage(
  rule: ChangeRule,
  baselineOldValue: JsonValue | undefined,
  newValue: JsonValue | undefined
): string {
  switch (rule.key) {
    case "guest_count":
      if (typeof baselineOldValue === "number" && typeof newValue === "number") {
        return `Gaeste-/Mengenbasis geaendert: ${baselineOldValue} -> ${newValue} (${pct(
          baselineOldValue,
          newValue
        )} vs last hard approved).`;
      }
      return "Gaeste-/Mengenbasis geaendert.";
    case "allergens":
      return "Allergen- oder Einschraenkungslage geaendert. Kueche und Kennzeichnung pruefen.";
    case "yield":
      if (typeof baselineOldValue === "number" && typeof newValue === "number") {
        return `Ausbeute/Verschnitt geaendert: ${baselineOldValue} -> ${newValue}. Rohwareneinsatz neu pruefen.`;
      }
      return "Ausbeute/Verschnitt geaendert.";
    case "procurement_units_equivalent":
      return "Gebinde/Bestelleinheit geaendert.";
    case "unit_conversion_with_qty_effect":
      return "Einheitenkonversion mit Mengenwirkung erkannt. Bestellmenge neu pruefen.";
    case "event_timing":
      return "Zeitfenster geaendert. Disposition und Produktionsablauf pruefen.";
    case "recipe_swap":
      return "Gericht/Rezept bzw. Herstellungsart geaendert. Einkauf, Produktion und Allergene neu pruefen.";
    case "prices":
      if (typeof baselineOldValue === "number" && typeof newValue === "number") {
        return `Kalkulation geaendert: ${baselineOldValue} -> ${newValue} (${pct(
          baselineOldValue,
          newValue
        )} vs last hard approved).`;
      }
      return "Kalkulation geaendert.";
    case "notes":
      return "Hinweise/Texte aktualisiert.";
    default:
      return rule.semanticLabel;
  }
}

function evaluatePointOfNoReturn(
  rule: ChangeRule,
  milestones: ResolvedMilestones
): PointOfNoReturnResult[] {
  return rule.pointOfNoReturn.map((check) => ({
    milestone: check.milestone,
    severity: check.severity,
    prompt: check.prompt,
    active:
      (check.milestone === "ShoppingCompleted" && milestones.shoppingCompleted) ||
      (check.milestone === "ProductionStarted" && milestones.productionStarted)
  }));
}

function impactRank(level: ImpactLevel): number {
  return level === "L3" ? 3 : level === "L2" ? 2 : 1;
}

function maxImpact(items: ClassifiedChangeItem[]): ImpactLevel | null {
  if (items.length === 0) {
    return null;
  }

  return items
    .map((item) => item.impactLevel)
    .sort((left, right) => impactRank(right) - impactRank(left))[0];
}

export function summarizeClassifiedRuleKeys(ruleKeys: string[]): string | null {
  if (ruleKeys.length === 0) {
    return null;
  }

  const labels = Array.from(
    new Set(
      ruleKeys.map((ruleKey) => SPEC_CHANGE_RULES.find((rule) => rule.key === ruleKey)?.semanticLabel ?? ruleKey)
    )
  );

  if (
    labels.every((label) =>
      ["Mengen geaendert", "Ausbeute/Verschnitt geaendert", "Einheitenkonversion mit Mengenwirkung"].includes(label)
    )
  ) {
    return "Mengen verfeinert";
  }

  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} & ${labels[1]}`;
  }
  if (labels.length === 3) {
    return `${labels[0]}, ${labels[1]} & ${labels[2]}`;
  }
  return `${labels[0]}, ${labels[1]} & ${labels.length - 2} weitere Bereiche`;
}

function buildChangeSetSummary(items: ClassifiedChangeItem[]): string | null {
  return summarizeClassifiedRuleKeys(
    Array.from(new Set(items.map((item) => item.fieldGroupKey)))
  );
}

export function classifyImpact(input: ClassifyImpactInput): ClassifiedChangeSet {
  const milestones: ResolvedMilestones = {
    shoppingCompleted: input.milestones?.shoppingCompleted ?? false,
    productionStarted: input.milestones?.productionStarted ?? false
  };

  const diffs = diffJson(input.currentDocument, input.nextDocument);
  const items: ClassifiedChangeItem[] = [];

  for (const diff of diffs) {
    if (!diff.fieldPath) {
      continue;
    }

    const matchingRules = SPEC_CHANGE_RULES.filter((rule) => ruleMatchesFieldPath(rule, diff.fieldPath));
    if (matchingRules.length === 0) {
      continue;
    }

    for (const rule of matchingRules) {
      const baselineOldValue = resolveBaselineValue(rule, diff, input.lastHardApprovedDocument ?? null);
      const thresholdMatched = evaluateThreshold(rule, baselineOldValue, diff.newValue);

      if (!thresholdMatched) {
        continue;
      }

      items.push({
        fieldPath: diff.fieldPath,
        fieldGroupKey: rule.key,
        oldValue: baselineOldValue,
        newValue: diff.newValue,
        oldValuePreview: preview(baselineOldValue),
        newValuePreview: preview(diff.newValue),
        impactLevel: rule.impactLevel,
        semanticMessage: buildSemanticMessage(rule, baselineOldValue, diff.newValue),
        thresholdMatched,
        triggers: [...rule.triggers],
        pointOfNoReturnResults: evaluatePointOfNoReturn(rule, milestones),
        affectedAggregates: [...rule.affectedAggregates]
      });
    }
  }

  const highestImpactLevel = maxImpact(items);
  const hasPointOfNoReturnConflict = items.some((item) =>
    item.pointOfNoReturnResults.some(
      (result) => result.active && (result.severity === "confirm" || result.severity === "stop")
    )
  );

  return {
    items,
    highestImpactLevel,
    requiresReapproval: highestImpactLevel === "L3",
    hasPointOfNoReturnConflict,
    summary: buildChangeSetSummary(items)
  };
}

export function finalizeClassifiedChangeSet(items: ClassifiedChangeItem[]): {
  summary: string | null;
  highestImpactLevel: ImpactLevel | null;
  requiresReapproval: boolean;
  hasPointOfNoReturnConflict: boolean;
} {
  const highestImpactLevel = maxImpact(items);
  return {
    summary: buildChangeSetSummary(items),
    highestImpactLevel,
    requiresReapproval: highestImpactLevel === "L3",
    hasPointOfNoReturnConflict: items.some((item) =>
      item.pointOfNoReturnResults.some(
        (result) => result.active && (result.severity === "confirm" || result.severity === "stop")
      )
    )
  };
}
