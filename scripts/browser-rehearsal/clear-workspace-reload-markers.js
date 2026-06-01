async () => {
  const storedContext = sessionStorage.getItem("capClearWorkspaceContext");
  const missing = [];
  if (!storedContext) {
    throw new Error("Clear-Check Reload ohne gespeicherten Vor-Reload-Kontext");
  }
  const { planId, planSpecId, purchaseListId, planExport, purchaseExport, handoffContext, auditTrailLabel } =
    JSON.parse(storedContext);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const text = document.body.innerText;
    if (
      text.includes("Produktionsagent") &&
      (text.includes("Kein aktiver Vorgang") || text.includes("Plan-Kontext: planId ") || text.includes("purchaseListId: "))
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
  const reloadedClearButton = reloadedButtons.find((button) => button.text.startsWith("Arbeitsbereich lokal leeren"));
  const reloadedArchiveButton = reloadedButtons.find((button) => button.text === "Fehlupload archivieren");
  const reloadIsEmpty =
    reloadedText.includes("Kein aktiver Vorgang") &&
    reloadedText.includes("Auftrag einfügen oder Datei ablegen") &&
    !reloadedText.includes(`Plan-Kontext: planId ${planId}`) &&
    !reloadedText.includes(`purchaseListId: ${purchaseListId}`) &&
    !reloadedHtml.includes(planExport) &&
    !reloadedHtml.includes(purchaseExport);
  const reloadRestoredCurrentContext =
    reloadedText.includes(`Plan-Kontext: planId ${planId} · specId ${planSpecId}`) &&
    reloadedText.includes(`purchaseListId: ${purchaseListId}`) &&
    reloadedText.includes(handoffContext) &&
    reloadedHtml.includes(planExport) &&
    reloadedHtml.includes(purchaseExport);
  if (!reloadIsEmpty && !reloadRestoredCurrentContext) {
    missing.push("Clear-Check Reload zeigt weder leeren Arbeitsbereich noch konsistent wiederhergestellten aktuellen Kontext");
  }
  if (
    reloadIsEmpty &&
    auditTrailLabel &&
    auditTrailLabel !== "keine Audit-Ereignisse geladen" &&
    reloadedText.includes(auditTrailLabel)
  ) {
    missing.push("Clear-Check Reload zeigt alte Audit-Spur im leeren Arbeitsbereich");
  }
  if (reloadIsEmpty && !reloadedText.includes("Audit-Spur\nkeine Audit-Ereignisse geladen")) {
    missing.push("Clear-Check Reload ohne neutralisierte Audit-Spur im leeren Arbeitsbereich");
  }
  if (!reloadedClearButton) {
    missing.push("Clear-Check Reload ohne Clear-Aktion");
  } else if (reloadIsEmpty && (
    !reloadedClearButton.disabled ||
    reloadedClearButton.title !== "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren."
  )) {
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
  return { route: location.pathname, markers: "production-clear-reload-ok", planId, purchaseListId };
}
