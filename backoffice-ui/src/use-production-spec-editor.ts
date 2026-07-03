import { useMemo, useState } from "react";
import type { ComponentEditState } from "./production-answer-types.js";
import {
  normalizedSpecEditSnapshot,
  specEditSnapshotFromSpec,
  type SpecEditSnapshot
} from "./production-spec-edit-snapshot.js";
import {
  buildSpecEditUpdateInput,
  type SpecEditUpdateInput
} from "./production-spec-edit-update.js";

export type UseProductionSpecEditorOptions = {
  focusedProductionSpec?: Record<string, unknown>;
};

export function useProductionSpecEditor({ focusedProductionSpec }: UseProductionSpecEditorOptions = {}) {
  const [editingSpecId, setEditingSpecId] = useState<string>();
  const [dismissedProductionAnswerSpecId, setDismissedProductionAnswerSpecId] = useState<string>();
  const [editingEventType, setEditingEventType] = useState("");
  const [editingEventDate, setEditingEventDate] = useState("");
  const [editingEventSchedule, setEditingEventSchedule] = useState("");
  const [editingAttendeeCount, setEditingAttendeeCount] = useState("");
  const [editingServiceForm, setEditingServiceForm] = useState("");
  const [editingMenuItems, setEditingMenuItems] = useState("");
  const [editingComponentStates, setEditingComponentStates] = useState<Record<string, ComponentEditState>>({});

  const hasFocusedSpecEditChanges = useMemo(() => {
    if (!focusedProductionSpec || editingSpecId !== String(focusedProductionSpec.specId ?? "")) {
      return false;
    }

    const baseline = specEditSnapshotFromSpec(focusedProductionSpec);
    const current: SpecEditSnapshot = {
      eventType: editingEventType,
      eventDate: editingEventDate,
      eventSchedule: editingEventSchedule,
      attendeeCount: editingAttendeeCount,
      serviceForm: editingServiceForm,
      menuItems: editingMenuItems,
      components: Object.entries(editingComponentStates)
    };

    return normalizedSpecEditSnapshot(baseline) !== normalizedSpecEditSnapshot(current);
  }, [
    editingAttendeeCount,
    editingComponentStates,
    editingEventDate,
    editingEventSchedule,
    editingEventType,
    editingMenuItems,
    editingServiceForm,
    editingSpecId,
    focusedProductionSpec
  ]);

  function loadSpecIntoEditor(spec: Record<string, unknown>): string {
    const snapshot = specEditSnapshotFromSpec(spec);
    const nextComponentStates = Object.fromEntries(snapshot.components);
    const specId = String(spec.specId);

    setEditingSpecId(specId);
    setDismissedProductionAnswerSpecId(undefined);
    setEditingEventType(snapshot.eventType);
    setEditingEventDate(snapshot.eventDate);
    setEditingEventSchedule(snapshot.eventSchedule ?? "");
    setEditingAttendeeCount(snapshot.attendeeCount);
    setEditingServiceForm(snapshot.serviceForm);
    setEditingMenuItems(snapshot.menuItems);
    setEditingComponentStates(nextComponentStates);

    return specId;
  }

  function beginSpecEdit(spec: Record<string, unknown>): string {
    return loadSpecIntoEditor(spec);
  }

  function resetSpecEdit(markDismissed = true) {
    if (markDismissed) {
      setDismissedProductionAnswerSpecId(editingSpecId);
    } else {
      setDismissedProductionAnswerSpecId(undefined);
    }
    setEditingSpecId(undefined);
    setEditingEventType("");
    setEditingEventDate("");
    setEditingEventSchedule("");
    setEditingAttendeeCount("");
    setEditingServiceForm("");
    setEditingMenuItems("");
    setEditingComponentStates({});
  }

  function updateEditingComponentState(componentId: string, patch: Partial<ComponentEditState>) {
    setEditingComponentStates((current) => ({
      ...current,
      [componentId]: {
        menuCategory: current[componentId]?.menuCategory ?? "",
        productionMode: current[componentId]?.productionMode ?? "",
        purchasedElements: current[componentId]?.purchasedElements ?? "",
        recipeOverrideId: current[componentId]?.recipeOverrideId ?? "",
        notes: current[componentId]?.notes ?? "",
        ...patch
      }
    }));
  }

  function buildCurrentSpecUpdateInput(): SpecEditUpdateInput {
    return buildSpecEditUpdateInput({
      eventType: editingEventType,
      eventDate: editingEventDate,
      eventSchedule: editingEventSchedule,
      attendeeCount: editingAttendeeCount,
      serviceForm: editingServiceForm,
      menuItems: editingMenuItems,
      componentStates: editingComponentStates
    });
  }

  return {
    editingSpecId,
    dismissedProductionAnswerSpecId,
    editingEventType,
    editingEventDate,
    editingEventSchedule,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    setEditingEventType,
    setEditingEventDate,
    setEditingEventSchedule,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    loadSpecIntoEditor,
    beginSpecEdit,
    resetSpecEdit,
    updateEditingComponentState,
    buildCurrentSpecUpdateInput
  };
}
