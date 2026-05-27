import type {
  ProductionManualInputActions,
  ProductionManualInputValues
} from "./production-input-panel.js";

export type ProductionManualInputStateInput = {
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
  customerName: string;
  venueName: string;
  notes: string;
};

export type ProductionManualInputFormStateInput = {
  manualEventType: string;
  manualEventDate: string;
  manualAttendeeCount: string;
  manualServiceForm: string;
  manualMenuItems: string;
  manualCustomerName: string;
  manualVenueName: string;
  manualNotes: string;
};

export function buildProductionManualInputState({
  eventType,
  eventDate,
  attendeeCount,
  serviceForm,
  menuItems,
  customerName,
  venueName,
  notes
}: ProductionManualInputStateInput): ProductionManualInputValues {
  return {
    eventType,
    eventDate,
    attendeeCount,
    serviceForm,
    menuItems,
    customerName,
    venueName,
    notes
  };
}

export function buildProductionManualInputStateFromForm(
  input: ProductionManualInputFormStateInput
): ProductionManualInputValues {
  return buildProductionManualInputState({
    eventType: input.manualEventType,
    eventDate: input.manualEventDate,
    attendeeCount: input.manualAttendeeCount,
    serviceForm: input.manualServiceForm,
    menuItems: input.manualMenuItems,
    customerName: input.manualCustomerName,
    venueName: input.manualVenueName,
    notes: input.manualNotes
  });
}

export type ProductionManualInputActionsInput = {
  setManualEventType: (value: string) => void;
  setManualEventDate: (value: string) => void;
  setManualAttendeeCount: (value: string) => void;
  setManualServiceForm: (value: string) => void;
  setManualMenuItems: (value: string) => void;
  setManualCustomerName: (value: string) => void;
  setManualVenueName: (value: string) => void;
  setManualNotes: (value: string) => void;
  submitManualSpec: () => Promise<void>;
};

export function buildProductionManualInputActions(
  actions: ProductionManualInputActionsInput
): ProductionManualInputActions {
  return {
    setEventType: actions.setManualEventType,
    setEventDate: actions.setManualEventDate,
    setAttendeeCount: actions.setManualAttendeeCount,
    setServiceForm: actions.setManualServiceForm,
    setMenuItems: actions.setManualMenuItems,
    setCustomerName: actions.setManualCustomerName,
    setVenueName: actions.setManualVenueName,
    setNotes: actions.setManualNotes,
    submitManualSpec: actions.submitManualSpec
  };
}
