() => {
  const text = document.body.innerText;
  const missing = [];
  if (!text.includes("Teilnehmerzahl: 43")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne gespeicherte strukturierte Teilnehmerzahl");
  }
  if (!text.includes("Plan-Kontext: planId ")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne aktuellen Plan-Kontext");
  }
  if (!text.includes("purchaseListId: ")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne aktuelle Einkaufsliste");
  }
  if (text.includes("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.")) {
    missing.push("Answer-Submit-Rehearsal Reload faellt in leeren Ergebniszustand zurueck");
  }
  if (missing.length > 0) {
    throw new Error(`Answer-Submit-Rehearsal Reload fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "submit-reload-ok" };
}
