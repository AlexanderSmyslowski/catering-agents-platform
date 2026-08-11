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
  const demoContext = "Konferenz · 90 Teilnehmer · 2026-12-02";
  const handoffContext =
    "Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste ohne Positionen";
  const clearButton = [...document.querySelectorAll("button")].find((button) =>
    (button.getAttribute("title") ?? "").startsWith("Lokalen Arbeitsbereich leeren:")
  );

  if (!planExport || !planId) {
    missing.push("Clear-Check vor Klick ohne aktuellen Produktionsplan-Exportlink");
  }
  if (purchaseExport) {
    missing.push("Clear-Check vor Klick bietet fuer die leere Einkaufsliste einen CSV-Export an");
  }
  if (beforeText.includes("Plan-Kontext: planId ") || beforeText.includes("purchaseListId: ")) {
    missing.push("Clear-Check vor Klick zeigt technische IDs im sichtbaren Kontext");
  }
  if (!beforeText.includes(demoContext)) {
    missing.push("Clear-Check vor Klick ohne Konferenz-90-Demokontext");
  }
  if (!clearButton) {
    missing.push("Clear-Check ohne Arbeitsbereich-lokal-leeren-Aktion");
  } else if (clearButton.disabled) {
    missing.push("Clear-Check kann nicht klicken, Aktion ist deaktiviert");
  } else if (!(clearButton.getAttribute("title") ?? "").includes(demoContext)) {
    missing.push("Clear-Check Aktion ist nicht mit dem aktuellen Demokontext beschriftet");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal vor Klick unsicher: ${missing.join(" | ")}`);
  }

  const auditTrailLabel = beforeText.match(/Audit-Spur\s+([^\n]+)/)?.[1]?.trim();

  if (!beforeHtml.includes(planExport)) {
    missing.push(`Clear-Check vor Klick ohne Produktionsplan-Export ${planExport}`);
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
      text.includes("Angebot hochladen oder Produktionsauftrag beschreiben") &&
      text.includes("Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert.") &&
      !text.includes("Plan-Kontext: aktueller Produktionsplan") &&
      !text.includes(`Plan-Kontext: planId ${planId}`) &&
      !text.includes(handoffContext) &&
      !html.includes(planExport) &&
      !/\/api\/exports\/v1\/exports\/(?:production-plans|purchase-lists)\//.test(html)
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
  const clearedClearButton = buttons.find((button) => button.text.startsWith("Demo-Arbeitsstand zurücksetzen"));
  const clearedArchiveButton = buttons.find((button) =>
    button.text.startsWith("Fehlgeschlagenen Demo-Upload ausblenden")
  );

  if (!afterText.includes("Angebot hochladen oder Produktionsauftrag beschreiben")) {
    missing.push("Clear-Check nach Klick ohne Empty-first-Einstieg");
  }
  if (
    !afterText.includes(
      "Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert."
    )
  ) {
    missing.push("Clear-Check nach Klick ohne Hinweis zum lokal verworfenen Upload");
  }
  if (afterText.includes(`Plan-Kontext: planId ${planId}`) || afterHtml.includes(planExport)) {
    missing.push(`Clear-Check nach Klick zeigt alten Produktionsplan ${planId}`);
  }
  if (/\/api\/exports\/v1\/exports\/(?:production-plans|purchase-lists)\//.test(afterHtml)) {
    missing.push("Clear-Check nach Klick zeigt weiterhin aktuelle Exporte");
  }
  if (afterText.includes(handoffContext) || afterText.includes("Abschluss-Kontext:")) {
    missing.push("Clear-Check nach Klick zeigt alten Abschluss-Kontext");
  }
  if (auditTrailLabel && auditTrailLabel !== "keine Audit-Ereignisse geladen" && afterText.includes(auditTrailLabel)) {
    missing.push("Clear-Check nach Klick zeigt alte Audit-Spur");
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
    planExport,
    handoffContext,
    auditTrailLabel
  }));
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-clear-ok", planId };
}
