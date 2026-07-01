async () => {
  const beforeText = document.body.innerText;
  const beforeHtml = document.body.innerHTML;
  const missing = [];
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return href ? new URL(href, location.origin).pathname : "";
    });
  const planExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/production-plans\/[^/]+\/html$/.test(href)
  );
  const purchaseExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv$/.test(href)
  );
  const planId = planExport?.match(/^\/api\/exports\/v1\/exports\/production-plans\/([^/]+)\/html$/)?.[1];
  const purchaseListId = purchaseExport?.match(/^\/api\/exports\/v1\/exports\/purchase-lists\/([^/]+)\/csv$/)?.[1];
  const handoffContext = "Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste vorhanden";
  const clearButton = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/g, " ").trim().startsWith("Arbeitsbereich lokal leeren")
  );

  if (!planExport || !planId) {
    missing.push("Clear-Check vor Klick ohne aktuellen Produktionsplan-Exportlink");
  }
  if (!purchaseExport || !purchaseListId) {
    missing.push("Clear-Check vor Klick ohne aktuellen Einkaufslisten-Exportlink");
  }
  if (beforeText.includes("Plan-Kontext: planId ") || beforeText.includes("purchaseListId: ")) {
    missing.push("Clear-Check vor Klick zeigt technische IDs im sichtbaren Kontext");
  }
  if (!clearButton) {
    missing.push("Clear-Check ohne Arbeitsbereich-lokal-leeren-Aktion");
  } else if (clearButton.disabled) {
    missing.push("Clear-Check kann nicht klicken, Aktion ist deaktiviert");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal vor Klick unsicher: ${missing.join(" | ")}`);
  }

  const auditTrailLabel = beforeText.match(/Audit-Spur\s+([^\n]+)/)?.[1]?.trim();

  if (!beforeHtml.includes(planExport)) {
    missing.push(`Clear-Check vor Klick ohne Produktionsplan-Export ${planExport}`);
  }
  if (!beforeHtml.includes(purchaseExport)) {
    missing.push(`Clear-Check vor Klick ohne Einkaufslisten-Export ${purchaseExport}`);
  }
  if (!beforeText.includes(handoffContext)) {
    missing.push("Clear-Check vor Klick ohne lesbaren Abschluss-Kontext");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal vor Klick unvollstaendig: ${missing.join(" | ")}`);
  }

  clearButton.click();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const text = document.body.innerText;
    const html = document.body.innerHTML;
    if (
      text.includes("Kein aktiver Vorgang") &&
      text.includes("Auftrag einfügen oder Datei ablegen") &&
      !text.includes("Plan-Kontext: aktueller Produktionsplan") &&
      !text.includes(`Plan-Kontext: planId ${planId}`) &&
      !text.includes(`purchaseListId: ${purchaseListId}`) &&
      !text.includes(handoffContext) &&
      !html.includes(planExport) &&
      !html.includes(purchaseExport)
    ) {
      break;
    }
  }

  const afterText = document.body.innerText;
  const afterHtml = document.body.innerHTML;
  const buttons = [...document.querySelectorAll("button")].map((button) => ({
    text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
    disabled: button.disabled,
    title: button.getAttribute("title") ?? ""
  }));
  const clearedClearButton = buttons.find((button) => button.text.startsWith("Arbeitsbereich lokal leeren"));
  const clearedArchiveButton = buttons.find((button) => button.text === "Fehlupload archivieren");

  if (!afterText.includes("Kein aktiver Vorgang")) {
    missing.push("Clear-Check nach Klick ohne leeren Vorgang");
  }
  if (!afterText.includes("Auftrag einfügen oder Datei ablegen")) {
    missing.push("Clear-Check nach Klick ohne sichere naechste Eingabe");
  }
  if (afterText.includes(`Plan-Kontext: planId ${planId}`) || afterHtml.includes(planExport)) {
    missing.push(`Clear-Check nach Klick zeigt alten Produktionsplan ${planId}`);
  }
  if (afterText.includes(`purchaseListId: ${purchaseListId}`) || afterHtml.includes(purchaseExport)) {
    missing.push(`Clear-Check nach Klick zeigt alte Einkaufsliste ${purchaseListId}`);
  }
  if (
    afterText.includes(handoffContext) ||
    (afterText.includes("Abschluss-Kontext:") &&
      (afterText.includes(planId) || afterText.includes(purchaseListId)))
  ) {
    missing.push("Clear-Check nach Klick zeigt alten Abschluss-Kontext");
  }
  if (auditTrailLabel && auditTrailLabel !== "keine Audit-Ereignisse geladen" && afterText.includes(auditTrailLabel)) {
    missing.push("Clear-Check nach Klick zeigt alte Audit-Spur");
  }
  if (!afterText.includes("Audit-Spur\nkeine Audit-Ereignisse geladen")) {
    missing.push("Clear-Check nach Klick ohne neutralisierte Audit-Spur");
  }
  if (!clearedClearButton) {
    missing.push("Clear-Check nach Klick ohne Clear-Aktion");
  } else if (!clearedClearButton.disabled || clearedClearButton.title !== "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.") {
    missing.push("Clear-Check nach Klick laesst Clear-Aktion aktiv oder falsch beschriftet");
  }
  if (!clearedArchiveButton) {
    missing.push("Clear-Check nach Klick ohne Fehlupload-Archiv-Aktion");
  } else if (!clearedArchiveButton.disabled || clearedArchiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.") {
    missing.push("Clear-Check nach Klick laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
  }
  sessionStorage.setItem("capClearWorkspaceContext", JSON.stringify({
    planId,
    purchaseListId,
    planExport,
    purchaseExport,
    handoffContext,
    auditTrailLabel
  }));
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-clear-ok", planId, purchaseListId };
}
