import { validateAcceptedEventSpec, withEvaluatedReadiness, type AcceptedEventSpec, type Uncertainty } from "@catering/shared-core";
import { isValidEventDate } from "../../shared-core/src/intake-signals.js";

export type OfferEventDetails = {
  eventDate?: string;
  eventType?: string;
  serviceForm?: string;
  attendeeCount?: number;
  eventSchedule?: Array<{ label: string; start?: string; end?: string }>;
};

export function validateOfferEventDetails(raw: unknown): OfferEventDetails | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.keys(raw).length ||
    Object.keys(raw).some(key => !["eventDate", "eventType", "serviceForm", "attendeeCount", "eventSchedule"].includes(key))) {
    throw new Error("Veranstaltungsdaten sind ungültig.");
  }
  const details = raw as OfferEventDetails;
  for (const key of ["eventType", "serviceForm"] as const) {
    if (key in details && (typeof details[key] !== "string" || !details[key]!.trim() || details[key]!.length > 200)) {
      throw new Error("Veranstaltungstyp und Serviceform dürfen nicht leer sein.");
    }
  }
  if ("eventDate" in details && (typeof details.eventDate !== "string" || !isValidEventDate(details.eventDate))) {
    throw new Error("Gültiges Veranstaltungsdatum im Format JJJJ-MM-TT erforderlich.");
  }
  if ("attendeeCount" in details && (!Number.isInteger(details.attendeeCount) || details.attendeeCount! <= 0 || details.attendeeCount! > 100000)) {
    throw new Error("Positive ganze Gästezahl erforderlich.");
  }
  if ("eventSchedule" in details && (!Array.isArray(details.eventSchedule) || !details.eventSchedule.length || details.eventSchedule.length > 20 ||
    details.eventSchedule.some(slot => !slot || typeof slot !== "object" || Array.isArray(slot) ||
      Object.keys(slot).some(key => !["label", "start", "end"].includes(key)) ||
      typeof slot.label !== "string" || !slot.label.trim() || slot.label.length > 200 ||
      typeof slot.start !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start) ||
      typeof slot.end !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end) || slot.start >= slot.end))) {
    throw new Error("Zeitfenster mit Beginn und späterem Ende am selben Tag erforderlich.");
  }
  return details;
}

export function amendOfferEvent(spec: AcceptedEventSpec, details?: OfferEventDetails): AcceptedEventSpec {
  if (!details) return spec;
  const dateChanged = details.eventDate !== undefined && details.eventDate !== spec.event.date;
  const attendeesChanged = details.attendeeCount !== undefined && details.attendeeCount !== spec.attendees.expected;
  const scheduleChanged = details.eventSchedule !== undefined && JSON.stringify(details.eventSchedule) !== JSON.stringify(spec.event.schedule);
  const answeredExtraction = (question: Uncertainty): boolean => {
    if (dateChanged && question.field === "event.date") {
      return (question.severity === "high" && question.message === "No exact event date could be extracted." && question.suggestedQuestion === "An welchem Datum findet das Event statt?") ||
        (question.severity === "medium" && question.message === "Mehrere oder ungültige Datumsangaben; Veranstaltungstermin nicht eindeutig." && question.suggestedQuestion === "Welches gültige Veranstaltungsdatum gilt verbindlich?") ||
        (question.severity === "medium" && /^Datum in "[\s\S]*" wirkt nur als ungefähre Angabe\.$/.test(question.message) && question.suggestedQuestion === "Welches Datum gilt verbindlich?");
    }
    if (dateChanged && question.field === "event.date_or_schedule") return question.severity === "high" && question.message === "No event date or schedule was found." && question.suggestedQuestion === "An welchem Datum oder in welchem Zeitfenster findet das Event statt?";
    if (attendeesChanged && question.field === "attendees.expected") return question.suggestedQuestion === "Wie viele Teilnehmer werden verbindlich erwartet?" &&
      ((question.severity === "high" && question.message === "Participant count could not be extracted reliably.") ||
        (question.severity === "medium" && /^Teilnehmerzahl nur ungefähr aus "[\s\S]*" abgeleitet\.$/.test(question.message)));
    return scheduleChanged && question.field === "event.schedule" && question.severity === "low" &&
      question.suggestedQuestion === "Wie lautet das verbindliche Zeitfenster?" && /^Zeitangabe in "[\s\S]*" ist nicht als vollständiger Termin belastbar\.$/.test(question.message);
  };
  return validateAcceptedEventSpec(withEvaluatedReadiness({
    ...spec,
    event: { ...spec.event, ...(details.eventDate ? { date: details.eventDate } : {}),
      ...(details.eventType ? { type: details.eventType.trim() } : {}),
      ...(details.serviceForm ? { serviceForm: details.serviceForm.trim() } : {}),
      ...(details.eventSchedule ? { schedule: details.eventSchedule } : {}) },
    attendees: { ...spec.attendees, ...(details.attendeeCount ? { expected: details.attendeeCount } : {}) },
    servicePlan: { ...spec.servicePlan, ...(details.eventType ? { eventType: details.eventType.trim() } : {}),
      ...(details.serviceForm ? { serviceForm: details.serviceForm.trim() } : {}) },
    uncertainties: spec.uncertainties?.filter(item => !answeredExtraction(item))
  }));
}
