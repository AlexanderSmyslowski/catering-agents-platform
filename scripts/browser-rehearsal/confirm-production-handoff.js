async () => {
  if (location.pathname !== "/produktion") {
    throw new Error(`Produktions-Handoff kann nur auf /produktion bestätigt werden, aktuell ${location.pathname}`);
  }

  const expectedSpecId = sessionStorage.getItem("catering.browser-rehearsal.offer-spec-id")?.trim();
  const expectedCaseId = sessionStorage.getItem("catering.browser-rehearsal.offer-case-id")?.trim();
  const expectedDraftId = sessionStorage.getItem("catering.browser-rehearsal.offer-draft-id")?.trim();
  const expectedApprovedOfferId = sessionStorage.getItem("catering.browser-rehearsal.offer-approved-offer-id")?.trim();
  if (!expectedSpecId || !expectedCaseId || !expectedDraftId || !expectedApprovedOfferId) {
    throw new Error("Produktions-Handoff ist nicht über den bestätigten Angebotskontext gebunden.");
  }

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
  const productionHeaders = { "x-actor-name": "Produktions-Mitarbeiter" };
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

  const offerCase = await waitFor("Produktions-Handoff", async () => {
    const payload = await fetchJson(
      `/api/offers/v1/offers/cases/${encodeURIComponent(expectedCaseId)}`,
      offerHeaders,
    );
    if (payload?.case?.caseId !== expectedCaseId || payload.case.product !== "offer") {
      throw new Error("Angebotsfall passt nach der Navigation nicht zur gespeicherten Fallidentität.");
    }
    const handoffId = payload.case.productionHandoffId;
    const resultEvent = (payload.events ?? []).find((event) => event.kind === "result" && event.artifactId === handoffId);
    return typeof handoffId === "string" && resultEvent ? payload : undefined;
  });
  const handoffId = offerCase.case.productionHandoffId;
  const handoffPayload = await fetchJson(
    `/api/offers/v1/offers/handoffs/${encodeURIComponent(handoffId)}`,
    productionHeaders,
  );
  const handoff = handoffPayload?.handoff;
  if (handoff?.handoffId !== handoffId || handoff.approvedOfferId !== expectedApprovedOfferId ||
    handoff.source?.draftId !== expectedDraftId || handoff.eventSpecSnapshot?.specId !== expectedSpecId) {
    throw new Error("Produktions-Handoff ist nicht vollständig an Freigabe, Entwurf und AcceptedEventSpec gebunden.");
  }

  const productionCase = await waitFor("Produktionsfall", async () => {
    const productionList = await fetchJson(
      `/api/production/v1/production/cases?search=${encodeURIComponent(offerCase.case.displayName)}`,
      productionHeaders,
    );
    return (productionList?.items ?? []).find((item) =>
      item.product === "production" && item.displayName === "Besprechung · 35 Teilnehmer · 2026-11-06" &&
      item.productionHandoffId === handoffId && item.sourceSpecId === expectedSpecId
    );
  });
  if (!productionCase?.caseId) {
    throw new Error("Produktionsfall aus dem bestätigten Handoff fehlt oder passt nicht zur Angebotsidentität.");
  }
  const productionDetail = await fetchJson(
    `/api/production/v1/production/cases/${encodeURIComponent(productionCase.caseId)}`,
    productionHeaders,
  );
  if (productionDetail?.case?.caseId !== productionCase.caseId ||
    productionDetail.case.productionHandoffId !== handoffId || productionDetail.case.sourceSpecId !== expectedSpecId) {
    throw new Error("Produktionsfall ist nicht über Handoff und AcceptedEventSpec gebunden.");
  }

  sessionStorage.setItem("catering.browser-rehearsal.production-case-id", productionCase.caseId);
  sessionStorage.setItem("catering.browser-rehearsal.production-handoff-id", handoffId);
  sessionStorage.setItem("catering.browser-rehearsal.production-spec-id", expectedSpecId);
  return { route: location.pathname, caseId: productionCase.caseId, handoffId, sourceSpecId: expectedSpecId };
}
