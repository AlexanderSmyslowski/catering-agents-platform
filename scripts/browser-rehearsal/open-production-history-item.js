async () => {
  if (location.pathname !== "/produktion") {
    throw new Error(`Produktionsfall kann nur auf /produktion geöffnet werden, aktuell ${location.pathname}`);
  }
  const expectedLabel = "Besprechung · 35 Teilnehmer · 2026-11-06";
  const expectedSpecId = sessionStorage.getItem("catering.browser-rehearsal.production-spec-id")?.trim();
  const expectedCaseId = sessionStorage.getItem("catering.browser-rehearsal.production-case-id")?.trim();
  const expectedHandoffId = sessionStorage.getItem("catering.browser-rehearsal.production-handoff-id")?.trim();
  if (!expectedSpecId || !expectedCaseId || !expectedHandoffId) {
    throw new Error("Produktionsfall ist nicht über den Rehearsal-Handoff gebunden.");
  }
  const response = await fetch(`/api/production/v1/production/cases/${encodeURIComponent(expectedCaseId)}`, {
    headers: { "x-actor-name": "Produktions-Mitarbeiter" },
  });
  const payload = await response.json();
  if (!response.ok || payload?.case?.caseId !== expectedCaseId || payload.case.product !== "production" ||
    payload.case.productionHandoffId !== expectedHandoffId || payload.case.sourceSpecId !== expectedSpecId) {
    throw new Error("Produktionsfall passt nicht zur gespeicherten Handoff-/AcceptedEventSpec-Identität.");
  }

  const historyDetails = [...document.querySelectorAll("details")].find((details) =>
    (details.querySelector("summary")?.textContent ?? "").includes("Frühere Produktionsaufträge öffnen")
  );
  if (!historyDetails) throw new Error("Produktions-Historie fehlt");
  historyDetails.open = true;
  const historyButton = [...historyDetails.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").includes(expectedLabel)
  );
  if (!historyButton) throw new Error(`Synthetischer Produktionsauftrag fehlt: ${expectedLabel}`);
  historyButton.click();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const text = document.body.innerText;
    const hasWorkflowContext = ["Produktionsplan berechnen", "Rückfragen beantworten", "Produktionsarbeit prüfen"]
      .some((marker) => text.includes(marker));
    if (text.includes(expectedLabel) && hasWorkflowContext) {
      return { selected: expectedLabel, caseId: expectedCaseId, handoffId: expectedHandoffId, sourceSpecId: expectedSpecId };
    }
  }
  throw new Error(`Produktionsauftrag wurde geöffnet, aber kein fallgebundener Arbeitskontext fokussiert: ${expectedLabel}`);
}
