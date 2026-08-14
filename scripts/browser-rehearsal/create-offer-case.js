async () => {
  const actorName = "Angebots-Mitarbeiter";
  const intakeActorName = "Intake-Mitarbeiter";
  const requestId = "browser-rehearsal-offer-case";
  const text = "Besprechung am 2026-11-06 fuer 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice.";
  const expectedEventSummary = "Besprechung für 35 Teilnehmer als Kaffeepause.";

  const postJson = async (path, body, requestActorName = actorName) => {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-actor-name": requestActorName
      },
      body: JSON.stringify(body)
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(`${path} lieferte keine lesbare JSON-Antwort (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      throw new Error(`${path} schlug mit HTTP ${response.status} fehl: ${payload?.message ?? raw}`);
    }
    return payload;
  };

  const intake = await postJson(
    "/api/intake/v1/intake/normalize",
    { requestId, text },
    intakeActorName
  );
  const acceptedEventSpec = intake?.acceptedEventSpec;
  if (acceptedEventSpec?.specId !== `spec-${requestId}`) {
    throw new Error(
      `Synthetischer Angebotsfall hat keine fallgebundene AcceptedEventSpec erhalten: ${JSON.stringify({
        expectedSpecId: `spec-${requestId}`,
        actualSpecId: acceptedEventSpec?.specId
      })}`
    );
  }

  const casePayload = await postJson("/api/offers/v1/offers/cases", {
    customerName: "Browser-Rehearsal",
    eventTypeLabel: "Besprechung",
    eventDate: "2026-11-06",
    attendeeCount: 35
  });
  const caseId = casePayload?.case?.caseId;
  if (typeof caseId !== "string" || caseId.length === 0) {
    throw new Error("Synthetischer Angebotsfall wurde ohne caseId angelegt.");
  }

  const draft = await postJson("/api/offers/v1/offers/from-text", {
    caseId,
    requestId,
    text
  });
  if (draft?.eventSummary !== expectedEventSummary || typeof draft?.draftId !== "string") {
    throw new Error(
      `Synthetischer Angebotsentwurf ist nicht belastbar gebunden: ${JSON.stringify({
        caseId,
        draftId: draft?.draftId,
        eventSummary: draft?.eventSummary
      })}`
    );
  }

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("catering.browser-rehearsal.offer-case-id", caseId);
  }

  return { caseId, draftId: draft.draftId, eventSummary: draft.eventSummary };
}
