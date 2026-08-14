async () => {
  if (location.pathname !== "/angebot") {
    throw new Error(`Angebotsfall kann nur auf /angebot geöffnet werden, aktuell ${location.pathname}`);
  }

  const expectedSpecId = "spec-browser-rehearsal-offer-case";
  const expectedCaseId = sessionStorage.getItem("catering.browser-rehearsal.offer-case-id")?.trim();
  if (!expectedCaseId) throw new Error("Synthetischer Angebotsfall ist nicht im Browserkontext gebunden.");

  const fetchJson = async (path, headers = {}) => {
    const response = await fetch(path, { headers });
    const raw = typeof response.text === "function"
      ? await response.text()
      : JSON.stringify(await response.json());
    let payload;
    try { payload = raw ? JSON.parse(raw) : null; } catch {
      throw new Error(`${path} lieferte keine lesbare JSON-Antwort (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(`${path} schlug mit HTTP ${response.status} fehl: ${payload?.message ?? raw}`);
    return payload;
  };
  const offerHeaders = { "x-actor-name": "Angebots-Mitarbeiter" };
  const readOfferCase = () => fetchJson(
    `/api/offers/v1/offers/cases/${encodeURIComponent(expectedCaseId)}`,
    offerHeaders,
  );
  const draftForCase = (casePayload) => [...(casePayload?.events ?? [])]
    .reverse()
    .find((event) => event.revisionRef?.artifactType === "OfferDraft")?.revisionRef?.artifactId;
  const waitFor = async (label, predicate, attempts = 60) => {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await predicate();
        if (result) return result;
      } catch (error) { lastError = error; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
    throw new Error(`${label} wurde nach ${attempts} Versuchen nicht serverseitig bestätigt${detail}`);
  };

  const initialCasePayload = await readOfferCase();
  if (initialCasePayload?.case?.caseId !== expectedCaseId || initialCasePayload.case.product !== "offer") {
    throw new Error("Synthetischer Angebotsfall passt nicht zur angeforderten Fallidentität.");
  }
  const draftId = draftForCase(initialCasePayload);
  if (typeof draftId !== "string" || draftId.length === 0) throw new Error("Synthetischer Angebotsfall enthält keinen fallgebundenen Entwurf.");
  const draft = await fetchJson(`/api/offers/v1/offers/drafts/${encodeURIComponent(draftId)}`, offerHeaders);
  if (draft?.draftId !== draftId || draft.eventSummary !== "Besprechung für 35 Teilnehmer als Kaffeepause." ||
    draft.proposedEventSpec?.specId !== expectedSpecId) {
    throw new Error("Synthetischer Angebotsentwurf ist nicht über den aktiven Fall und seine AcceptedEventSpec gebunden.");
  }

  const historyDetails = [...document.querySelectorAll("details")].find((details) =>
    (details.querySelector("summary")?.textContent ?? "").includes("Frühere Angebotsaufträge öffnen") &&
    details.querySelectorAll("button[data-action='open-case']").length > 0
  );
  if (!historyDetails) throw new Error("Angebots-Historie fehlt");
  historyDetails.open = true;
  const historyButton = [...historyDetails.querySelectorAll("button[data-action='open-case']")].find((button) => {
    const label = button.textContent ?? "";
    return label.includes("Browser-Rehearsal") && label.includes(initialCasePayload.case.displayName);
  });
  if (!historyButton) throw new Error("Synthetischer Angebotsfall Browser-Rehearsal fehlt");
  historyButton.click();
  await waitFor("Fallauswahl", () =>
    location.pathname === "/angebot" && historyButton.getAttribute("aria-pressed") === "true" &&
    document.body.innerText.includes("Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause.") &&
    document.querySelector("[aria-label='Kompakte Ergebniszusammenfassung']")
  );

  const handoffDetails = [...document.querySelectorAll("details")].find((details) =>
    (details.querySelector("summary")?.textContent ?? "").includes("Für die Produktion übernommene Veranstaltungen")
  );
  if (!handoffDetails) throw new Error("Angebots-Handoff-Bereich fehlt nach bewusster Auftragsauswahl");
  handoffDetails.open = true;
  const approvalButton = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/gu, " ").trim().startsWith("Variante freigeben:")
  );
  if (!approvalButton) throw new Error("Synthetischer Angebotsentwurf bietet keine explizite Freigabevariante an");
  approvalButton.click();

  const approvedCasePayload = await waitFor("Freigabezustand", async () => {
    const payload = await readOfferCase();
    const approvedOfferId = payload?.case?.approvedOfferId;
    const approvalEvent = (payload?.events ?? []).find((event) => event.kind === "approval" && event.artifactId === approvedOfferId);
    return typeof approvedOfferId === "string" && approvalEvent ? payload : undefined;
  });
  const approvedOfferId = approvedCasePayload.case.approvedOfferId;
  sessionStorage.setItem("catering.browser-rehearsal.offer-draft-id", draftId);
  sessionStorage.setItem("catering.browser-rehearsal.offer-approved-offer-id", approvedOfferId);
  sessionStorage.setItem("catering.browser-rehearsal.offer-spec-id", expectedSpecId);
  return { selected: historyButton.textContent?.trim() ?? "", caseId: expectedCaseId, draftId, approvedOfferId };
}
