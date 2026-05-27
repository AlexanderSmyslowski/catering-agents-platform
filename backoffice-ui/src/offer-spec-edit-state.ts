export type OfferSpecEditStateInput = {
  editingSpecId?: string;
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
};

export type OfferSpecEditState = OfferSpecEditStateInput;

export type OfferSpecEditActionsInput = {
  beginSpecEdit: (spec: Record<string, unknown>) => void;
  setEventType: (value: string) => void;
  setEventDate: (value: string) => void;
  setAttendeeCount: (value: string) => void;
  setServiceForm: (value: string) => void;
  setMenuItems: (value: string) => void;
  saveSpecEdit: () => Promise<void>;
  resetSpecEdit: () => void;
};

export type OfferSpecEditActions = OfferSpecEditActionsInput;

export function buildOfferSpecEditState({
  editingSpecId,
  eventType,
  eventDate,
  attendeeCount,
  serviceForm,
  menuItems
}: OfferSpecEditStateInput): OfferSpecEditState {
  return {
    editingSpecId,
    eventType,
    eventDate,
    attendeeCount,
    serviceForm,
    menuItems
  };
}

export function buildOfferSpecEditActions({
  beginSpecEdit,
  setEventType,
  setEventDate,
  setAttendeeCount,
  setServiceForm,
  setMenuItems,
  saveSpecEdit,
  resetSpecEdit
}: OfferSpecEditActionsInput): OfferSpecEditActions {
  return {
    beginSpecEdit,
    setEventType,
    setEventDate,
    setAttendeeCount,
    setServiceForm,
    setMenuItems,
    saveSpecEdit,
    resetSpecEdit
  };
}
