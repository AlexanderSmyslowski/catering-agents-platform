export type OfferSpecEditStateInput = {
  editingSpecId?: string;
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
};

export type OfferSpecEditState = OfferSpecEditStateInput;

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
