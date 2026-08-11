async () => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Angebot hochladen oder Produktionsauftrag beschreiben",
    "Ablauf: Quelle → KI-Entwurf → Prüfung → Plan",
    "BESTANDSDATEN IM HINTERGRUND",
    "Konferenz · 90 Teilnehmer · 2026-12-02",
    "Rückfragen und Antworten",
    "PRÜFUNG VOR BERECHNUNG",
    "Produktionsplan nacharbeiten",
    "Produktionsblatt exportieren",
    "1 Liste ohne Positionen",
    "Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.",
    "Audit-Spur",
    "Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.",
    "Keine rechtssichere Audit-Behauptung."
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
  if (purchaseExportLink || purchaseListId) {
    missing.push("leere Einkaufsliste bietet faelschlich einen CSV-Export an");
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
      if (
        !planExportBody.includes("<h1>Produktionsplan</h1>") ||
        !planExportBody.includes("Klassifikation für Filterkaffee Station fehlt.")
      ) {
        missing.push("aktueller Produktionsplan-Exportinhalt passt nicht zum ausgewaehlten Vorgang");
      }
    }
  }
  if (!text.includes("Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste ohne Positionen")) {
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
  const questionSummary = text.match(/Rückfragen:\s*offen (\d+) · beantwortet (\d+)/);
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
  const clearWorkspaceButton = buttons.find((button) =>
    button.title.startsWith("Lokalen Arbeitsbereich leeren:")
  );
  if (!clearWorkspaceButton) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion fehlt");
  } else if (clearWorkspaceButton.disabled) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion ist trotz aktuellem Ergebnis deaktiviert");
  } else if (!clearWorkspaceButton.title.includes("Konferenz · 90 Teilnehmer · 2026-12-02")) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion ist nicht mit aktuellem Kontext beschriftet");
  }
  const archiveButton = buttons.find((button) =>
    button.title.startsWith("Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen:")
  );
  if (!archiveButton) {
    missing.push("Fehlupload-Archiv-Aktion fehlt");
  } else if (archiveButton.disabled || !archiveButton.title.includes("Intake-Anfrage im Fokus")) {
    missing.push("Fehlupload-Archiv-Aktion ist nicht sicher an den aktuellen Intake-Kontext gebunden");
  }
  const createDraftButton = buttons.find((button) => button.text === "KI-Entwurf erstellen");
  if (!createDraftButton) {
    missing.push("KI-Entwurf-erstellen-Aktion fehlt");
  } else if (!createDraftButton.disabled) {
    missing.push("KI-Entwurf-erstellen-Aktion ist ohne ausgewaehlte Datei nicht sicher deaktiviert");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-ok" };
}
