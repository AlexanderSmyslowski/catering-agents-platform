async () => {
  const missing = [];
  if (sessionStorage.getItem("capArchiveRehearsalChecked") !== "1") {
    missing.push("Archive-Rehearsal Reload ohne vorherigen Archiv-Beleg");
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const reloadedText = document.body.innerText;
    if (
      reloadedText.includes("Kein aktiver Vorgang") &&
      reloadedText.includes("Auftrag einfügen oder Datei ablegen")
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
  const reloadedArchiveButton = reloadedButtons.find((button) => button.text === "Fehlupload archivieren");
  if (!reloadedText.includes("Kein aktiver Vorgang")) {
    missing.push("Archive-Rehearsal Reload ohne leeren aktiven Vorgang");
  }
  if (!reloadedText.includes("Auftrag einfügen oder Datei ablegen")) {
    missing.push("Archive-Rehearsal Reload ohne sichere naechste Eingabe");
  }
  if (reloadedText.includes("requestId: demo-production-answered-clarification")) {
    missing.push("Archive-Rehearsal Reload zeigt archivierten Intake wieder als aktiven Kontext");
  }
  if (reloadedText.includes("Lunch · 42 Teilnehmer · 2026-12-16")) {
    missing.push("Archive-Rehearsal Reload zeigt archivierte Spezifikation wieder als aktiven Vorgang");
  }
  if (reloadedHtml.includes("/api/intake/v1/intake/requests/demo-production-answered-clarification")) {
    missing.push("Archive-Rehearsal Reload behaelt archivierten Intake-Detailanker im DOM");
  }
  if (reloadedText.includes("Abschluss-Kontext:")) {
    missing.push("Archive-Rehearsal Reload zeigt alten Abschluss-Kontext");
  }
  if (reloadedHtml.includes("/api/exports/v1/exports/production-plans/")) {
    missing.push("Archive-Rehearsal Reload behaelt Produktionsplan-Exportlink");
  }
  if (reloadedHtml.includes("/api/exports/v1/exports/purchase-lists/")) {
    missing.push("Archive-Rehearsal Reload behaelt Einkaufslisten-Exportlink");
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
