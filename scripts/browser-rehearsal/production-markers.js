async () => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Was braucht die Produktion als Nächstes?",
    "Beta-Pfad: Rückfragen -> Ergebnisobjekte -> Exporte/Audit.",
    "Interner Arbeitsstand: Produktion, Einkauf, Exporte, Herkunft und offene Punkte bleiben sichtbar.",
    "keine automatische Allergen-, Preis- oder Margenfreigabe",
    "Rückfragenstatus:",
    "Rückfragen und Antworten",
    "Produktionsarbeit prüfen",
    "Produktionsblatt exportieren",
    "Einkaufsliste exportieren",
    "Audit-Spur",
    "Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.",
    "keine rechtssichere Audit-Behauptung"
  ].filter((marker) => !text.includes(marker));
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return href ? new URL(href, location.origin).pathname : "";
    });
  const buttons = [...document.querySelectorAll("button")].map((button) => ({
    text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
    disabled: button.disabled,
    title: button.getAttribute("title") ?? ""
  }));
  const planExportLink = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/production-plans\/[^/]+\/html$/.test(href)
  );
  const purchaseExportLink = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv$/.test(href)
  );
  const planId = planExportLink?.match(/^\/api\/exports\/v1\/exports\/production-plans\/([^/]+)\/html$/)?.[1];
  const purchaseListId = purchaseExportLink?.match(/^\/api\/exports\/v1\/exports\/purchase-lists\/([^/]+)\/csv$/)?.[1];
  if (!planExportLink || !planId) {
    missing.push("Produktionsplan-Exportlink fehlt");
  }
  if (!purchaseExportLink || !purchaseListId) {
    missing.push("Einkaufslisten-Exportlink fehlt");
  }
  if (!text.includes("Plan-Kontext: aktueller Produktionsplan")) {
    missing.push("lesbarer aktueller Plan-Kontext fehlt");
  }
  if (text.includes("Plan-Kontext: planId ") || text.includes("purchaseListId: ")) {
    missing.push("sichtbarer Produktionskontext enthaelt technische IDs");
  }
  if (text.includes("für Plan ") || text.includes("Spezifikation spec-")) {
    missing.push("sichtbare Exportlabels enthalten technische Plan-/Spezifikations-IDs");
  }
  if (planExportLink && planId) {
    const planExportResponse = await fetch(planExportLink);
    if (!planExportResponse.ok) {
      missing.push(`aktueller Produktionsplan-Export ist im Browser nicht abrufbar: ${planExportResponse.status}`);
    } else {
      const planExportBody = await planExportResponse.text();
      if (!planExportBody.includes(`Produktionsplan ${planId}`)) {
        missing.push(`aktueller Produktionsplan-Exportinhalt passt nicht zu ${planId}`);
      }
    }
  }
  if (purchaseExportLink && purchaseListId) {
    const purchaseExportResponse = await fetch(purchaseExportLink);
    if (!purchaseExportResponse.ok) {
      missing.push(`aktueller Einkaufslisten-Export ist im Browser nicht abrufbar: ${purchaseExportResponse.status}`);
    } else {
      const purchaseExportBody = await purchaseExportResponse.text();
      if (
        !purchaseExportBody.includes(
          `"group","item","normalizedQty","normalizedUnit","purchaseQty","purchaseUnit","supplierHint"`
        )
      ) {
        missing.push(`aktueller Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header fuer ${purchaseListId}`);
      }
    }
  }
  if (!text.includes("Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste vorhanden")) {
    missing.push("lesbarer Abschluss-Kontext fehlt");
  }
  if (text.includes("Abschluss-Kontext: planId ")) {
    missing.push("sichtbarer Abschluss-Kontext enthaelt technische IDs");
  }
  if (text.includes("ÄLTERE EINKAUFSLISTEN") && !text.includes("Nur bei Bedarf aufklappen; ältere Listen sind kein aktueller Vorgang.")) {
    missing.push("aeltere Einkaufslisten sind nicht klar als nicht aktuell markiert");
  }
  if (text.includes("Ältere Produktionsläufe") && !text.includes("Diese früheren Produktionsläufe sind Kontext aus anderen Vorgängen, nicht das aktuelle Ergebnis.")) {
    missing.push("aeltere Produktionslaeufe sind nicht klar als nicht aktuell markiert");
  }
  const questionSummary = text.match(/Rückfragenstatus: offen (\d+) · beantwortet (\d+)/);
  const questionPanelSummary = text.match(/Rückfragen und Antworten\s+offen (\d+) · beantwortet (\d+)/);
  if (!questionSummary) {
    missing.push("Rückfragenstatus-Zaehler fehlt");
  }
  if (!questionPanelSummary) {
    missing.push("Rückfragen-und-Antworten-Zaehler fehlt");
  }
  if (
    questionSummary &&
    questionPanelSummary &&
    (questionSummary[1] !== questionPanelSummary[1] || questionSummary[2] !== questionPanelSummary[2])
  ) {
    missing.push("Rückfragenstatus und Rückfragenpanel zeigen unterschiedliche Zaehler");
  }
  const clearWorkspaceButton = buttons.find((button) => button.text.startsWith("Arbeitsbereich lokal leeren"));
  if (!clearWorkspaceButton) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion fehlt");
  } else if (clearWorkspaceButton.disabled) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion ist trotz aktuellem Ergebnis deaktiviert");
  } else if (!clearWorkspaceButton.title.includes("Lokalen Arbeitsbereich leeren:")) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion ist nicht mit aktuellem Kontext beschriftet");
  }
  const archiveButton = buttons.find((button) => button.text === "Fehlupload archivieren");
  if (!archiveButton) {
    missing.push("Fehlupload-Archiv-Aktion fehlt");
  } else if (!archiveButton.disabled || archiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.") {
    missing.push("Fehlupload-Archiv-Aktion ist ohne aktiven Intake-Kontext nicht sicher deaktiviert");
  }
  const reprocessButton = buttons.find((button) => button.text === "Erneut mit ausgewähltem Typ verarbeiten");
  if (!reprocessButton) {
    missing.push("Wiederverarbeitungs-Aktion fehlt");
  } else if (!reprocessButton.disabled) {
    missing.push("Wiederverarbeitungs-Aktion ist ohne ausgewählte Datei nicht sicher deaktiviert");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-ok" };
}
