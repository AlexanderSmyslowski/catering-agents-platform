function asRecord(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : undefined;
}

function stringListFromUnknown(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((item) => String(item)).filter(Boolean);
}

export function translateEventType(value?: string): string {
  const labels: Record<string, string> = {
    conference: "Konferenz",
    meeting: "Besprechung",
    reception: "Empfang",
    lunch: "Lunch",
    dinner: "Abendessen",
    trade_fair: "Messe",
    fair: "Messe",
    workshop: "Arbeitsseminar"
  };

  return value ? labels[value] ?? value : "Veranstaltung";
}

export function translateServiceForm(value?: string): string {
  const labels: Record<string, string> = {
    buffet: "Buffet",
    plated: "Menü am Platz",
    standing_reception: "Empfang / Flying",
    grab_and_go: "Ausgabe / Grab-and-go",
    coffee_break: "Kaffeepause"
  };

  return value ? labels[value] ?? value : "offen";
}

export function translateMenuCategory(value?: string): string {
  const labels: Record<string, string> = {
    classic: "klassisch",
    vegetarian: "vegetarisch",
    vegan: "vegan"
  };

  return value ? labels[value] ?? value : "offen";
}

export function translateProductionMode(value?: string): string {
  const labels: Record<string, string> = {
    scratch: "Eigenproduktion",
    hybrid: "Hybrid",
    convenience_purchase: "Convenience-Zukauf",
    external_finished: "Fertigprodukt / extern"
  };

  return value ? labels[value] ?? value : "offen";
}

function translateFieldLabel(field?: string): string {
  const labels: Record<string, string> = {
    "event.date": "Veranstaltungsdatum",
    "event.date_or_schedule": "Veranstaltungsdatum oder Servicefenster",
    "event.type": "Veranstaltungstyp",
    "attendees.expected": "verbindliche Teilnehmerzahl",
    menuPlan: "Gerichte und Komponenten",
    "servicePlan.serviceForm": "Serviceform"
  };

  return field ? labels[field] ?? field : "Angabe";
}

function questionForMissingField(field: string): string | undefined {
  const questions: Record<string, string> = {
    "event.date": "Welches Veranstaltungsdatum gilt verbindlich für die Produktion?",
    "event.date_or_schedule": "Welches Veranstaltungsdatum oder Servicefenster gilt verbindlich für die Produktion?",
    "event.type": "Welcher Veranstaltungstyp trifft fachlich zu?",
    "attendees.expected": "Mit welcher verbindlichen Teilnehmerzahl soll kalkuliert und produziert werden?",
    menuPlan: "Welche Gerichte oder Komponenten sollen konkret produziert werden?",
    "servicePlan.serviceForm": "Welche Serviceform gilt: Buffet, Menü, Flying oder Ausgabe?"
  };

  return questions[field];
}

function translateUncertaintyMessage(field?: string, message?: string): string | undefined {
  if (field === "attendees.expected") {
    return "Die Teilnehmerzahl konnte nicht zuverlässig aus dem Dokument abgeleitet werden.";
  }
  if (field === "event.date" || field === "event.date_or_schedule") {
    return "Im Dokument wurde kein belastbares Veranstaltungsdatum oder Servicefenster erkannt.";
  }
  if (
    field === "menuPlan" &&
    message &&
    /kaufmaennisch oder dokumentseitig fortgeschritten.*offene speiseauswahl/i.test(message)
  ) {
    return "Mindestens ein Speiseblock wirkt noch offen. Bitte vor der Produktionsplanung verbindlich bestätigen, welche Speisen in diesem Block gelten.";
  }
  if (
    field === "menuPlan" &&
    message &&
    /mindestens ein speiseblock wirkt wie auswahl, alternative oder beispiel/i.test(message)
  ) {
    return "Mindestens ein Speiseblock wirkt wie Auswahl, Alternative oder Beispiel. Bitte vor der Produktionsplanung verbindlich bestätigen, welche Speisen daraus tatsächlich gelten.";
  }

  if (!message) {
    return undefined;
  }

  if (/participant count could not be extracted reliably/i.test(message)) {
    return "Die Teilnehmerzahl konnte nicht zuverlässig aus dem Dokument abgeleitet werden.";
  }
  if (/no event date or service window was found/i.test(message)) {
    return "Im Dokument wurde kein belastbares Veranstaltungsdatum oder Servicefenster erkannt.";
  }
  if (/missing or incomplete field:\s*(.+)/i.test(message)) {
    const match = message.match(/missing or incomplete field:\s*(.+)/i);
    return `Bitte noch klären: ${translateFieldLabel(match?.[1]?.trim())}.`;
  }

  return message;
}

function translateSuggestedQuestion(field?: string, question?: string): string | undefined {
  if (field) {
    const mapped = questionForMissingField(field);
    if (mapped) {
      return mapped;
    }
  }

  if (!question) {
    return undefined;
  }

  return question;
}

function translateAssumption(item: unknown, spec?: Record<string, unknown>): string | undefined {
  const record = asRecord(item);
  const event = asRecord(spec?.event);
  const eventType = typeof event?.type === "string" ? event.type : undefined;
  const serviceForm =
    typeof event?.serviceForm === "string"
      ? event.serviceForm
      : typeof asRecord(spec?.servicePlan)?.serviceForm === "string"
        ? String(asRecord(spec?.servicePlan)?.serviceForm)
        : undefined;

  if (!record) {
    return typeof item === "string" ? translateUncertaintyMessage(undefined, item) ?? item : undefined;
  }

  const code = typeof record.code === "string" ? record.code : undefined;
  const message = typeof record.message === "string" ? record.message : undefined;

  if (code === "event_type_defaulted") {
    return `Veranstaltungstyp als ${translateEventType(eventType)} abgeleitet.`;
  }
  if (code === "service_form_defaulted") {
    return `Serviceform als ${translateServiceForm(serviceForm)} abgeleitet.`;
  }

  const eventTypeMatch = message?.match(/event type inferred as ([a-z_ -]+)\.?/i);
  if (eventTypeMatch) {
    return `Veranstaltungstyp als ${translateEventType(eventTypeMatch[1].trim())} abgeleitet.`;
  }

  const serviceFormMatch = message?.match(/service form inferred as ([a-z_ -]+)\.?/i);
  if (serviceFormMatch) {
    return `Serviceform als ${translateServiceForm(serviceFormMatch[1].trim())} abgeleitet.`;
  }

  return translateUncertaintyMessage(undefined, message);
}

export function buildProductionQuestions(spec?: Record<string, unknown>): string[] {
  if (!spec) {
    return ["Bitte ziehe zuerst ein Angebot hinein oder lade eine Datei hoch."];
  }

  const event = asRecord(spec.event);
  const attendees = asRecord(spec.attendees);
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];
  const missingFields = stringListFromUnknown(spec.missingFields);
  const uncertainties = Array.isArray(spec.uncertainties) ? spec.uncertainties : [];
  const readiness = String(asRecord(spec.readiness)?.status ?? "");
  const questions: string[] = [];
  const coveredFields = new Set<string>();

  const addFieldQuestion = (field: string) => {
    const question = questionForMissingField(field) ?? `Bitte noch klären: ${translateFieldLabel(field)}.`;
    coveredFields.add(field);
    questions.push(question);
  };

  const hasSchedule = Array.isArray(event?.schedule)
    ? event.schedule.some((slot) => Boolean(asRecord(slot)?.start))
    : false;

  if (!event?.date && !hasSchedule) {
    addFieldQuestion("event.date_or_schedule");
  }
  if (!attendees?.expected) {
    addFieldQuestion("attendees.expected");
  }
  if (!event?.serviceForm && !asRecord(spec.servicePlan)?.serviceForm) {
    addFieldQuestion("servicePlan.serviceForm");
  }
  if (menuPlan.length === 0) {
    addFieldQuestion("menuPlan");
  }

  const unresolvedSourcing = menuPlan.some((item) => {
    const component = asRecord(item);
    const productionDecision = asRecord(component?.productionDecision);
    return !productionDecision?.mode;
  });

  if (unresolvedSourcing) {
    questions.push(
      "Bitte je Gericht festlegen, ob es eigenproduziert, hybrid gefertigt, als Convenience-Komponente zugekauft oder als Fertigprodukt beschafft wird."
    );
  }

  const unresolvedConvenienceParts = menuPlan.some((item) => {
    const component = asRecord(item);
    const productionDecision = asRecord(component?.productionDecision);
    const mode = typeof productionDecision?.mode === "string" ? productionDecision.mode : "";
    const purchasedElements = Array.isArray(productionDecision?.purchasedElements)
      ? productionDecision.purchasedElements
      : [];

    return (
      (mode === "hybrid" || mode === "convenience_purchase") &&
      purchasedElements.length === 0
    );
  });

  if (unresolvedConvenienceParts) {
    questions.push(
      "Bitte bei Hybrid- oder Convenience-Gerichten angeben, welche Bestandteile zugekauft werden, zum Beispiel Teig, fertiger Boden oder Saucenbasis."
    );
  }

  const unresolvedCategories = menuPlan.some((item) => {
    const component = asRecord(item);
    return !component?.menuCategory;
  });

  if (unresolvedCategories) {
    questions.push(
      "Bitte je Gericht kennzeichnen, ob es klassisch, vegetarisch oder vegan ist, wenn das aus dem Angebot nicht eindeutig hervorgeht."
    );
  }

  for (const field of missingFields) {
    if (!coveredFields.has(field)) {
      addFieldQuestion(field);
    }
  }

  for (const entry of uncertainties) {
    const uncertainty = asRecord(entry);
    const field = typeof uncertainty?.field === "string" ? uncertainty.field : undefined;
    if (field && coveredFields.has(field)) {
      continue;
    }

    const translatedQuestion = translateSuggestedQuestion(
      field,
      typeof uncertainty?.suggestedQuestion === "string" ? uncertainty.suggestedQuestion : undefined
    );
    const translatedMessage = translateUncertaintyMessage(
      field,
      typeof uncertainty?.message === "string" ? uncertainty.message : undefined
    );
    const nextQuestion = translatedQuestion ?? translatedMessage;
    if (nextQuestion) {
      if (field) {
        coveredFields.add(field);
      }
      questions.push(nextQuestion);
    }
  }

  if (questions.length === 0 && readiness === "partial") {
    questions.push("Bitte prüfe die Annahmen des Agenten, bevor die Produktion final freigegeben wird.");
  }

  if (questions.length === 0 && readiness === "insufficient") {
    questions.push("Es fehlen noch Angaben, bevor belastbare Mengen und Einkaufslisten berechnet werden können.");
  }

  return [...new Set(questions)];
}

export function buildProductionAssumptions(spec?: Record<string, unknown>): string[] {
  if (!spec || !Array.isArray(spec.assumptions)) {
    return [];
  }

  return spec.assumptions
    .map((item) => translateAssumption(item, spec))
    .filter((item): item is string => Boolean(item));
}

export function getSpecLabel(spec: Record<string, unknown>): string {
  const event = asRecord(spec.event);
  const attendees = asRecord(spec.attendees);
  return `${translateEventType(typeof event?.type === "string" ? event.type : "")} · ${attendees?.expected ?? "?"} Teilnehmer · ${event?.date ?? "offen"}`;
}
