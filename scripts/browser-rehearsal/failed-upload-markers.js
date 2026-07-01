async () => {
  const missing = [];
  const beforeText = document.body.innerText;
  const beforeHtml = document.body.innerHTML;
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return href ? new URL(href, location.origin).pathname : "";
    });
  const stalePlanExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/production-plans\/[^/]+\/html$/.test(href)
  );
  const stalePurchaseExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv$/.test(href)
  );
  const planId = stalePlanExport?.match(/^\/api\/exports\/v1\/exports\/production-plans\/([^/]+)\/html$/)?.[1];
  const purchaseListId = stalePurchaseExport?.match(/^\/api\/exports\/v1\/exports\/purchase-lists\/([^/]+)\/csv$/)?.[1];
  const fileInput = document.querySelector("input[type='file']");

  if (!stalePlanExport || !planId) {
    missing.push("Failed-Upload-Rehearsal vor Upload ohne aktuellen Produktionsplan-Exportlink");
  }
  if (!stalePurchaseExport || !purchaseListId) {
    missing.push("Failed-Upload-Rehearsal vor Upload ohne aktuellen Einkaufslisten-Exportlink");
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

  if (!beforeHtml.includes(stalePlanExport)) {
    missing.push(`Failed-Upload-Rehearsal vor Upload ohne Produktionsplan-Export ${stalePlanExport}`);
  }
  if (!beforeHtml.includes(stalePurchaseExport)) {
    missing.push(`Failed-Upload-Rehearsal vor Upload ohne Einkaufslisten-Export ${stalePurchaseExport}`);
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
      text.includes("Kein aktiver Vorgang") &&
      text.includes("Auftrag einfügen oder Datei ablegen") &&
      !text.includes(`Plan-Kontext: planId ${planId}`) &&
      !text.includes(`purchaseListId: ${purchaseListId}`) &&
      !html.includes(stalePlanExport) &&
      !html.includes(stalePurchaseExport)
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
  const clearButton = buttons.find((button) => button.text.startsWith("Arbeitsbereich lokal leeren"));
  const archiveButton = buttons.find((button) => button.text === "Fehlupload archivieren");
  const reprocessButton = buttons.find((button) => button.text === "Erneut mit ausgewähltem Typ verarbeiten");

  if (!afterText.includes("Dateityp .exe ist nicht erlaubt.")) {
    missing.push("Failed-Upload-Rehearsal ohne sichtbare Upload-Fehlermeldung");
  }
  if (!afterText.includes("Ausgewählt: falsches-angebot.exe")) {
    missing.push("Failed-Upload-Rehearsal verliert die retrybare Fehldatei");
  }
  if (!afterText.includes("Kein aktiver Vorgang")) {
    missing.push("Failed-Upload-Rehearsal ohne leeren aktiven Vorgang nach Fehler");
  }
  if (!afterText.includes("Auftrag einfügen oder Datei ablegen")) {
    missing.push("Failed-Upload-Rehearsal ohne sichere naechste Eingabe nach Fehler");
  }
  if (afterText.includes(`Plan-Kontext: planId ${planId}`) || afterHtml.includes(stalePlanExport)) {
    missing.push(`Failed-Upload-Rehearsal zeigt alten Produktionsplan ${planId}`);
  }
  if (afterText.includes(`purchaseListId: ${purchaseListId}`) || afterHtml.includes(stalePurchaseExport)) {
    missing.push(`Failed-Upload-Rehearsal zeigt alte Einkaufsliste ${purchaseListId}`);
  }
  if (!clearButton) {
    missing.push("Failed-Upload-Rehearsal ohne Clear-Aktion");
  } else if (clearButton.disabled || clearButton.title !== "Lokalen Arbeitsbereich leeren: Kein aktiver Vorgang") {
    missing.push("Failed-Upload-Rehearsal laesst Clear-Aktion nicht fuer den leeren Fehlerkontext aktiv");
  }
  if (!archiveButton) {
    missing.push("Failed-Upload-Rehearsal ohne Fehlupload-Archiv-Aktion");
  } else if (!archiveButton.disabled || archiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.") {
    missing.push("Failed-Upload-Rehearsal laesst Fehlupload-Archiv ohne aktiven Intake-Kontext aktiv oder falsch beschriftet");
  }
  if (!reprocessButton) {
    missing.push("Failed-Upload-Rehearsal ohne Wiederverarbeitungs-Aktion");
  } else if (reprocessButton.disabled) {
    missing.push("Failed-Upload-Rehearsal kann retrybare Fehldatei nicht erneut verarbeiten");
  }
  if (missing.length > 0) {
    throw new Error(`Failed-Upload-Browserpfad fehlgeschlagen: ${missing.join(" | ")}`);
  }

  return { route: location.pathname, markers: "failed-upload-ok", planId, purchaseListId };
}
