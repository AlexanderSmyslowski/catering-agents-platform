import { createEventRequestFromText } from "../request-factory.js";
import { normalizeEventRequestToSpec } from "../rules/normalization.js";
import type { AcceptedEventSpec, EventRequest } from "../types.js";

export function getDemoIntakeRequests(): EventRequest[] {
  return [
    createEventRequestFromText({
      requestId: "demo-intake-conference-lunch",
      channel: "text",
      rawText:
        "Konferenz am 2026-09-18 fuer 120 Teilnehmer mit Lunchbuffet, Caesar Salad Buffet und Filterkaffee Station."
    }),
    createEventRequestFromText({
      requestId: "demo-intake-reception-evening",
      channel: "email",
      rawText:
        "Abendempfang am 2026-10-04 fuer 60 Gaeste mit Fingerfood, Dessert und Wasserservice."
    })
  ];
}

export function getDemoOfferRequests(): EventRequest[] {
  return [
    createEventRequestFromText({
      requestId: "demo-offer-meeting-coffee",
      channel: "text",
      rawText:
        "Meeting am 2026-11-06 fuer 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
    }),
    createEventRequestFromText({
      requestId: "demo-offer-conference-buffet",
      channel: "manual_form",
      rawText:
        "Konferenz am 2026-11-20 fuer 180 Teilnehmer mit Lunchbuffet, Tomatensuppe und Kaffeestation."
    })
  ];
}

export function getDemoProductionSpecs(): AcceptedEventSpec[] {
  return [
    normalizeEventRequestToSpec(
      createEventRequestFromText({
        requestId: "demo-production-coffee",
        channel: "text",
        rawText:
          "Konferenz am 2026-12-02 fuer 90 Teilnehmer mit Filterkaffee Station."
      }),
      {
        sourceType: "manual_input",
        reference: "demo-production-coffee",
        commercialState: "manual"
      }
    ),
    normalizeEventRequestToSpec(
      createEventRequestFromText({
        requestId: "demo-production-salad",
        channel: "text",
        rawText:
          "Lunch am 2026-12-09 fuer 70 Teilnehmer mit Caesar Salad Buffet."
      }),
      {
        sourceType: "manual_input",
        reference: "demo-production-salad",
        commercialState: "manual"
      }
    )
  ];
}
