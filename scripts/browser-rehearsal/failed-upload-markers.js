async () => {
  const missing = [];
  const beforeText = document.body.innerText;
  const beforeHtml = document.body.innerHTML;
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return href ? new URL(href, location.origin).pathname : "";
    });
  const currentPlanExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/production-plans\/[^/]+\/html$/.test(href)
  );
  const purchaseExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv$/.test(href)
  );
  const planId = currentPlanExport?.match(
    /^\/api\/exports\/v1\/exports\/production-plans\/([^/]+)\/html$/
  )?.[1];
  const fileInput = document.querySelector("input[type='file']");

  if (!beforeText.includes("Konferenz · 90 Teilnehmer · 2026-12-02")) {
    missing.push("Failed-Upload-Rehearsal vor Upload ohne Konferenz-90-Kontext");
  }
  if (!currentPlanExport || !planId) {
    missing.push("Failed-Upload-Rehearsal vor Upload ohne aktuellen Produktionsplan-Exportlink");
  }
  if (!beforeText.includes("1 Liste ohne Positionen")) {
    missing.push("Failed-Upload-Rehearsal vor Upload weist die leere Einkaufsliste nicht aus");
  }
  if (!beforeText.includes("Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.")) {
    missing.push("Failed-Upload-Rehearsal vor Upload erklaert den fehlenden Einkaufslisten-Export nicht");
  }
  if (purchaseExport) {
    missing.push("Failed-Upload-Rehearsal vor Upload bietet fuer die leere Einkaufsliste einen CSV-Export an");
  }
  if (beforeText.includes("Plan-Kontext: planId ") || beforeText.includes("purchaseListId: ")) {
    missing.push("Failed-Upload-Rehearsal vor Upload zeigt technische IDs im sichtbaren Kontext");
  }
  if (!fileInput) {
    missing.push("Failed-Upload-Rehearsal ohne Datei-Input");
  }
  if (missing.length > 0) {
    throw new Error(`Failed-Upload-Rehearsal vor Upload unsicher: ${missing.join(" | ")}`);
  }

  if (!beforeHtml.includes(currentPlanExport)) {
    missing.push(`Failed-Upload-Rehearsal vor Upload ohne Produktionsplan-Export ${currentPlanExport}`);
  }
  if (missing.length > 0) {
    throw new Error(`Failed-Upload-Rehearsal vor Upload unvollstaendig: ${missing.join(" | ")}`);
  }

  const wrongFile = new File(["synthetischer falscher upload"], "falsches-angebot.exe", {
    type: "application/x-msdownload"
  });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(wrongFile);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const text = document.body.innerText;
    const html = document.body.innerHTML;
    if (
      text.includes("Dateityp .exe ist nicht erlaubt.") &&
      text.includes("Ausgewählt: falsches-angebot.exe") &&
      text.includes("Angebot hochladen oder Produktionsauftrag beschreiben") &&
      !text.includes("Plan-Kontext: aktueller Produktionsplan") &&
      !html.includes(currentPlanExport) &&
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
  const clearButton = buttons.find((button) => button.text.startsWith("Demo-Arbeitsstand zurücksetzen"));
  const archiveButton = buttons.find((button) =>
    button.text.startsWith("Fehlgeschlagenen Demo-Upload ausblenden")
  );
  const retryButton = buttons.find((button) => button.text === "KI-Entwurf erstellen");

  if (!afterText.includes("Dateityp .exe ist nicht erlaubt.")) {
    missing.push("Failed-Upload-Rehearsal ohne sichtbare Upload-Fehlermeldung");
  }
  if (!afterText.includes("Ausgewählt: falsches-angebot.exe")) {
    missing.push("Failed-Upload-Rehearsal verliert die retrybare Fehldatei");
  }
  if (!afterText.includes("Angebot hochladen oder Produktionsauftrag beschreiben")) {
    missing.push("Failed-Upload-Rehearsal ohne Empty-first-Einstieg nach Fehler");
  }
  if (afterText.includes("Plan-Kontext: aktueller Produktionsplan") || afterHtml.includes(currentPlanExport)) {
    missing.push(`Failed-Upload-Rehearsal zeigt alten Produktionsplan ${planId}`);
  }
  if (/\/api\/exports\/v1\/exports\/(?:production-plans|purchase-lists)\//.test(afterHtml)) {
    missing.push("Failed-Upload-Rehearsal zeigt nach Fehler weiterhin aktuelle Exporte");
  }
  if (afterText.includes("Abschluss-Kontext:") || afterText.includes("1 Liste ohne Positionen")) {
    missing.push("Failed-Upload-Rehearsal zeigt nach Fehler weiterhin den alten Produktionsabschluss");
  }
  if (!clearButton) {
    missing.push("Failed-Upload-Rehearsal ohne Clear-Aktion");
  } else if (clearButton.disabled || clearButton.title !== "Lokalen Arbeitsbereich leeren: Kein aktiver Vorgang") {
    missing.push("Failed-Upload-Rehearsal kann den lokalen Fehlerkontext nicht sicher zuruecksetzen");
  }
  if (!archiveButton) {
    missing.push("Failed-Upload-Rehearsal ohne Fehlupload-Archiv-Aktion");
  } else if (!archiveButton.disabled || archiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.") {
    missing.push("Failed-Upload-Rehearsal laesst Fehlupload-Archiv ohne aktiven Intake-Kontext aktiv oder falsch beschriftet");
  }
  if (!retryButton) {
    missing.push("Failed-Upload-Rehearsal ohne KI-Entwurf-Retry");
  } else if (retryButton.disabled) {
    missing.push("Failed-Upload-Rehearsal kann die beibehaltene Fehldatei nicht erneut auswerten");
  }
  if (missing.length > 0) {
    throw new Error(`Failed-Upload-Browserpfad fehlgeschlagen: ${missing.join(" | ")}`);
  }

  return { route: location.pathname, markers: "failed-upload-ok", planId };
}
