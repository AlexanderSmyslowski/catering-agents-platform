async () => {
  const sourceRoute = location.pathname;
  if (sourceRoute !== "/angebot") {
    throw new Error(`Angebots-Handoff kann nur auf /angebot gestartet werden, aktuell ${sourceRoute}`);
  }
  const caseId = sessionStorage.getItem("catering.browser-rehearsal.offer-case-id")?.trim();
  const approvedOfferId = sessionStorage.getItem("catering.browser-rehearsal.offer-approved-offer-id")?.trim();
  if (!caseId || !approvedOfferId) {
    throw new Error("Angebots-Handoff ist nicht an den serverseitig bestätigten Angebotsfall gebunden.");
  }
  const waitFor = async (label, predicate, attempts = 60) => {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = predicate();
        if (result) return result;
      } catch (error) { lastError = error; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
    throw new Error(`${label} wurde nach ${attempts} Versuchen nicht sichtbar${detail}`);
  };
  const handoffButton = await waitFor("Freigegebene Handoff-Aktion", () => [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/gu, " ").trim() === "An Produktion übergeben" &&
    !button.disabled && button.getAttribute("aria-disabled") !== "true"
  ));
  if (!handoffButton) {
    throw new Error("Freigegebener Angebotsfall bietet keine aktive Handoff-Aktion an.");
  }
  handoffButton.click();
  return { route: sourceRoute, target: "/produktion", clicked: true, caseId, approvedOfferId };
}
