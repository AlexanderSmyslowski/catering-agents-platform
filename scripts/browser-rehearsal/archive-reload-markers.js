async () => {
  const missing = [];
  if (sessionStorage.getItem("capArchiveRehearsalChecked") !== "1") {
    missing.push("Archive-Rehearsal Reload ohne vorherigen Archiv-Beleg");
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const reloadedText = document.body.innerText;
    const reloadedHtml = document.body.innerHTML;
    if (
      reloadedText.includes("Angebot hochladen oder Produktionsauftrag beschreiben") &&
      !reloadedHtml.includes("/api/intake/v1/intake/requests/demo-production-answered-clarification") &&
      !/\/api\/exports\/v1\/exports\/(?:production-plans|purchase-lists)\//.test(reloadedHtml)
    ) {
      break;
    }
  }

  const reloadedText = document.body.innerText;
  const reloadedHtml = document.body.innerHTML;
  const reloadedButtons = [...document.querySelectorAll("button")].map((button) => ({
    text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
    disabled: button.disabled,
    title: button.getAttribute("title") ?? ""
  }));
  const reloadedArchiveButton = reloadedButtons.find((button) =>
    button.text.startsWith("Fehlgeschlagenen Demo-Upload ausblenden")
  );
  if (!reloadedText.includes("Angebot hochladen oder Produktionsauftrag beschreiben")) {
    missing.push("Archive-Rehearsal Reload ohne stabilen Empty-first-Einstieg");
  }
  if (reloadedText.includes("requestId: demo-production-answered-clarification")) {
    missing.push("Archive-Rehearsal Reload zeigt archivierten Intake wieder als aktiven Kontext");
  }
  if (reloadedHtml.includes("/api/intake/v1/intake/requests/demo-production-answered-clarification")) {
    missing.push("Archive-Rehearsal Reload behaelt archivierten Intake-Detailanker im DOM");
  }
  if (
    reloadedText.includes("Aktueller Vorgang") ||
    reloadedText.includes("Plan-Kontext: aktueller Produktionsplan") ||
    reloadedText.includes("Rückfragen und Antworten")
  ) {
    missing.push("Archive-Rehearsal Reload zeigt weiterhin einen aktiven Detail- oder Produktionskontext");
  }
  if (reloadedText.includes("Abschluss-Kontext:")) {
    missing.push("Archive-Rehearsal Reload zeigt alten Abschluss-Kontext");
  }
  if (/\/api\/exports\/v1\/exports\/(?:production-plans|purchase-lists)\//.test(reloadedHtml)) {
    missing.push("Archive-Rehearsal Reload zeigt aktuelle Exporte im leeren Arbeitsbereich");
  }
  if (!reloadedArchiveButton) {
    missing.push("Archive-Rehearsal Reload ohne Fehlupload-Archiv-Aktion");
  } else if (
    !reloadedArchiveButton.disabled ||
    reloadedArchiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
  ) {
    missing.push("Archive-Rehearsal Reload laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
  }
  if (missing.length > 0) {
    throw new Error(`Archiv-Browserpfad Reload fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "archive-intake-reload-ok" };
}
