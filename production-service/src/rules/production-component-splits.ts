import { createHash } from "node:crypto";
import { areJsonValuesEqual, type AcceptedEventSpec } from "@catering/shared-core";

type Component = AcceptedEventSpec["menuPlan"][number];
export type ComponentSplit = { parentComponentId: string; reason: string; children: Array<{ label: string; servings: number; recipeId: string }> };

const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max && value === value.trim();
export function buildComponentSplit(parent: Component, split: ComponentSplit): Component[] | undefined {
  if (parent.productionSource || parent.componentId !== split.parentComponentId || !Number.isSafeInteger(parent.servings) || parent.servings! <= 0 ||
      !text(split.reason, 2000) || !Array.isArray(split.children) || split.children.length < 2 || split.children.length > 10 ||
      split.children.some(child => !child || Object.keys(child).some(key => !["label", "servings", "recipeId"].includes(key)) ||
        !text(child.label, 200) || !text(child.recipeId, 200) || !Number.isSafeInteger(child.servings) || child.servings <= 0)) return undefined;
  const keys = split.children.map(child => `${child.label.normalize("NFKC").toLowerCase()}\0${child.recipeId}`);
  if (new Set(keys).size !== keys.length) return undefined;
  const identity = JSON.stringify([parent.componentId, split.reason, split.children.map(c => [c.label, c.servings, c.recipeId])]);
  return split.children.map((child, index) => ({
    componentId: `split-${createHash("sha256").update(identity).update(`\0${index}`).digest("hex")}`,
    label: child.label,
    ...(parent.course !== undefined ? { course: parent.course } : {}),
    ...(parent.serviceStyle !== undefined ? { serviceStyle: parent.serviceStyle } : {}),
    servings: child.servings, recipeOverrideId: child.recipeId,
    productionSource: { parentComponentId: parent.componentId, parentLabel: parent.label, parentServings: parent.servings!, reason: split.reason, childIndex: index, childCount: split.children.length }
  }));
}

// Reconstruct the only permitted transition from the predecessor, including IDs
// and all source fields. This is also used when verifying the immutable lineage.
export function validateComponentSplitTransition(previous: AcceptedEventSpec, next: AcceptedEventSpec): { indexMap: Map<number, number> } | undefined {
  const rebuilt: Component[] = [];
  const indexMap = new Map<number, number>();
  let cursor = 0;
  let splitCount = 0;
  for (const [index, parent] of previous.menuPlan.entries()) {
    const candidate = next.menuPlan[cursor];
    if (candidate?.componentId === parent.componentId) {
      if (!areJsonValuesEqual(parent, candidate)) return undefined;
      indexMap.set(index, cursor++); rebuilt.push(parent); continue;
    }
    const source = candidate?.productionSource;
    if (!source || source.parentComponentId !== parent.componentId || source.childIndex !== 0 || source.childCount < 2 || source.childCount > 10) return undefined;
    const group = next.menuPlan.slice(cursor, cursor + source.childCount);
    const split: ComponentSplit = { parentComponentId: parent.componentId, reason: source.reason,
      children: group.map(child => ({ label: child.label, servings: child.servings!, recipeId: child.recipeOverrideId! })) };
    const children = buildComponentSplit(parent, split);
    if (!children || children.some(child => previous.menuPlan.some(old => old.componentId === child.componentId)) || !areJsonValuesEqual(children, group)) return undefined;
    rebuilt.push(...children); cursor += children.length; splitCount++;
  }
  if (!splitCount || cursor !== next.menuPlan.length || new Set(rebuilt.map(item => item.componentId)).size !== rebuilt.length) return undefined;
  const expected = { ...previous, menuPlan: rebuilt };
  return areJsonValuesEqual(expected, next) ? { indexMap } : undefined;
}

/** Find the immutable transition that originally created this child. */
export function hasVerifiedSplitOrigin(lineage: Array<{ draftArtifacts: { eventSpec?: AcceptedEventSpec } }>, component: Component): boolean {
  if (!component.productionSource) return false;
  for (let index = 0; index + 1 < lineage.length; index++) {
    const successor = lineage[index]?.draftArtifacts.eventSpec;
    const predecessor = lineage[index + 1]?.draftArtifacts.eventSpec;
    if (!successor || !predecessor || successor.menuPlan.length === predecessor.menuPlan.length ||
        !validateComponentSplitTransition(predecessor, successor)) continue;
    const created = successor.menuPlan.filter(item => item.componentId === component.componentId);
    if (created.length === 1 && !predecessor.menuPlan.some(item => item.componentId === component.componentId) &&
        areJsonValuesEqual(created[0]!.productionSource, component.productionSource)) return true;
  }
  return false;
}

export function validSplitCorrection(previous: Component, next: Component): boolean {
  return Boolean(previous.productionSource && previous.componentId === next.componentId &&
    areJsonValuesEqual(previous.productionSource, next.productionSource) &&
    text(next.label, 200) && Number.isSafeInteger(next.servings) && next.servings! > 0);
}

/** Preserve the original split's unique label/recipe pairs after a correction. */
export function validSplitCorrectionGroups(previous: AcceptedEventSpec, next: AcceptedEventSpec): boolean {
  const changedParents = new Set(previous.menuPlan.flatMap((component, index) => {
    const successor = next.menuPlan[index];
    return component.productionSource && successor && (component.label !== successor.label || component.servings !== successor.servings)
      ? [component.productionSource.parentComponentId] : [];
  }));
  for (const parentId of changedParents) {
    const keys = next.menuPlan.filter(component => component.productionSource?.parentComponentId === parentId)
      .map(component => `${component.label.normalize("NFKC").toLowerCase()}\0${component.recipeOverrideId ?? ""}`);
    if (new Set(keys).size !== keys.length) return false;
  }
  return true;
}
