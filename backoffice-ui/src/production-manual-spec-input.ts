export type ManualSpecFormState = {
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
  customerName: string;
  venueName: string;
  notes: string;
};

export type ManualSpecInput = {
  eventType?: string;
  eventDate?: string;
  attendeeCount?: number;
  serviceForm?: string;
  menuItems?: string[];
  customerName?: string;
  venueName?: string;
  notes?: string;
};

function splitCommaList(value: string): string[] {
  if (/\r?\n/.test(value) && value.split(/\r?\n/).some(line => line.includes(",") && !/\d.*\b(?:Portionen?|Stück(?:e)?)\b/i.test(line))) {
    throw new Error("Bitte pro Zeile ein Gericht angeben. Bei Kommas im Gerichtsnamen eine feste Menge ergänzen, z. B. „Creme mit Apfel, Birne – 50 Portionen“.");
  }
  return value
    .split(/\r?\n|\d.*\b(?:Portionen?|Stück(?:e)?)\b/i.test(value) ? /\r?\n/ : ",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildManualSpecInput(state: ManualSpecFormState): ManualSpecInput {
  return {
    eventType: state.eventType.trim() || undefined,
    eventDate: state.eventDate.trim() || undefined,
    attendeeCount: state.attendeeCount.trim() ? Number(state.attendeeCount) : undefined,
    serviceForm: state.serviceForm.trim() || undefined,
    menuItems: splitCommaList(state.menuItems),
    customerName: state.customerName.trim() || undefined,
    venueName: state.venueName.trim() || undefined,
    notes: state.notes.trim() || undefined
  };
}
