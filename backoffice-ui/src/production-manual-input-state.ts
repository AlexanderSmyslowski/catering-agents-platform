import type { ProductionManualInputValues } from "./production-input-panel.js";

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
