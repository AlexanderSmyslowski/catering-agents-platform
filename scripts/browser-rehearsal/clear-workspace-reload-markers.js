async () => {
  const storedContext = sessionStorage.getItem("capClearWorkspaceContext");
  const missing = [];
  if (!storedContext) {
    throw new Error("Clear-Check Reload ohne gespeicherten Vor-Reload-Kontext");
  }
  const { planId, planExport, handoffContext, auditTrailLabel } =
    JSON.parse(storedContext);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const text = document.body.innerText;
    const html = document.body.innerHTML;
    if (
      text.includes("Produktionsagent") &&
      text.includes("Angebot hochladen oder Produktionsauftrag beschreiben") &&
      !/\/api\/exports\/v1\/exports\/(?:production-plans|purchase-lists)\//.test(html)
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
  const reloadedClearButton = reloadedButtons.find((button) =>
    button.text.startsWith("Demo-Arbeitsstand zurücksetzen")
  );
  const reloadedArchiveButton = reloadedButtons.find((button) =>
    button.text.startsWith("Fehlgeschlagenen Demo-Upload ausblenden")
  );
  if (!reloadedText.includes("Angebot hochladen oder Produktionsauftrag beschreiben")) {
    missing.push("Clear-Check Reload ohne stabilen Empty-first-Einstieg");
  }
  if (reloadedText.includes("Plan-Kontext: aktueller Produktionsplan")) {
    missing.push("Clear-Check Reload stellt den alten Produktionskontext wieder her");
  }
  if (reloadedText.includes(`Plan-Kontext: planId ${planId}`) || reloadedHtml.includes(planExport)) {
    missing.push(`Clear-Check Reload zeigt alten Produktionsplan ${planId}`);
  }
  if (reloadedText.includes("purchaseListId:") || /\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv/.test(reloadedHtml)) {
    missing.push("Clear-Check Reload zeigt eine alte Einkaufsliste oder deren CSV-Export");
  }
  if (/\/api\/exports\/v1\/exports\/(?:production-plans|purchase-lists)\//.test(reloadedHtml)) {
    missing.push("Clear-Check Reload zeigt aktuelle Exporte im leeren Arbeitsbereich");
  }
  if (reloadedText.includes(handoffContext) || reloadedText.includes("Abschluss-Kontext:")) {
    missing.push("Clear-Check Reload zeigt alten Abschluss-Kontext");
  }
  if (auditTrailLabel && auditTrailLabel !== "keine Audit-Ereignisse geladen" && reloadedText.includes(auditTrailLabel)) {
    missing.push("Clear-Check Reload zeigt alte Audit-Spur im leeren Arbeitsbereich");
  }
  if (!reloadedClearButton) {
    missing.push("Clear-Check Reload ohne Clear-Aktion");
  } else if (
    !reloadedClearButton.disabled ||
    reloadedClearButton.title !== "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren."
  ) {
    missing.push("Clear-Check Reload laesst Clear-Aktion aktiv oder falsch beschriftet");
  }
  if (!reloadedArchiveButton) {
    missing.push("Clear-Check Reload ohne Fehlupload-Archiv-Aktion");
  } else if (
    !reloadedArchiveButton.disabled ||
    reloadedArchiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
  ) {
    missing.push("Clear-Check Reload laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal Reload fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-clear-reload-ok", planId };
}
