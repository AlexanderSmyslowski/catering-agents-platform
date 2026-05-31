import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser rehearsal script contract", () => {
  it("keeps the real-browser rehearsal script wired as an explicit optional npm command", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(packageJson.scripts?.["browser:rehearsal"]).toBe("bash ./scripts/check-browser-rehearsal.sh");
    expect(packageJson.scripts?.["browser:rehearsal:answer-submit"]).toBe(
      "CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS=1 bash ./scripts/check-browser-rehearsal.sh"
    );
    expect(packageJson.scripts?.["browser:rehearsal:archive-intake"]).toBe(
      "CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE=1 bash ./scripts/check-browser-rehearsal.sh"
    );
    expect(script).toContain("playwright");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_BASE_URL");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE");
    expect(script).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit");
    expect(script).toContain("Browser-Navigations- und Markerpruefung");
    expect(script).toContain("click_rehearsal_link");
    expect(script).toContain("Produktion offene Rueckfragen");
    expect(script).toContain("Produktion Ergebnis-Kontext wiederhergestellt");
    expect(script).toContain("Produktion Submit-Reload gespeichert");
    expect(script).toContain("Produktion lokal geleert");
    expect(script).toContain("keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage");
  });

  it("does not pretend that the public Playwright CLI supports the Codex browser session protocol", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("Browser-Rehearsal benoetigt die Codex-kompatible Browser-CLI");
    expect(script).toContain("CATERING_BROWSER_CLI");
    expect(script).toContain("Die oeffentliche Playwright-CLI ist kein kompatibler Fallback");
    expect(script).not.toContain("npx --yes --package @playwright/cli playwright-cli");
  });

  it("guards the route, export and audit markers that make the synthetic core path browser-checkable", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    for (const marker of [
      "Internes Beta-Kontrollzentrum",
      "Beta-Weg: Start → Angebot → Produktion → Rückfragen → Exporte/Audit.",
      "Kundenanfrage einfügen und ruhigen Entwurf erzeugen",
      "Angebotsagent öffnen",
      "Zur Produktion",
      "Was braucht die Produktion als Nächstes?",
      "Beta-Prüfpunkt: prüfbar, wenn Rückfragenstatus, Produktionsobjekte und Export-/Auditanker sichtbar",
      "Rückfragenstatus:",
      "Rückfragen und Antworten",
      "Produktionsobjekte und Downloads prüfen",
      "Produktionsblatt exportieren",
      "Einkaufsliste exportieren",
      "Plan-Kontext: planId",
      "purchaseListId:",
      "Audit-Spur",
      "/api/exports/v1/exports/production-plans/",
      "/api/exports/v1/exports/purchase-lists/"
    ]) {
      expect(script).toContain(marker);
    }
  });

  it("requires the browser flow to navigate through visible app links instead of route-only checks", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("Start -> Angebot");
    expect(script).toContain("Angebot -> Produktion");
    expect(script).toContain("local attempts=30");
    expect(script).toContain("wartet auf ${target_path}");
    expect(script).toContain("navigierte nicht stabil nach ${target_path}");
    expect(script).toContain("click_rehearsal_link \"Start -> Angebot\" \"/angebot\"");
    expect(script).toContain("click_rehearsal_link \"Angebot -> Produktion\" \"/produktion\"");
    expect(script).toContain("link.click()");
  });

  it("guards current production context against stale artifact confusion", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("aktueller Plan-Kontext fehlt");
    expect(script).toContain("aktueller Produktionsplan-Exportlink passt nicht");
    expect(script).toContain("aktueller Einkaufslisten-Kontext fehlt");
    expect(script).toContain("aktueller Einkaufslisten-Exportlink passt nicht");
    expect(script).toContain("aktueller Produktionsplan-Export ist im Browser nicht abrufbar");
    expect(script).toContain("aktueller Produktionsplan-Exportinhalt passt nicht");
    expect(script).toContain("aktueller Einkaufslisten-Export ist im Browser nicht abrufbar");
    expect(script).toContain("aktueller Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header");
    expect(script).toContain("fetch(expectedPlanHref)");
    expect(script).toContain("fetch(expectedPurchaseHref)");
    expect(script).toContain("Rückfragenstatus-Zaehler fehlt");
    expect(script).toContain("Rückfragen-und-Antworten-Zaehler fehlt");
    expect(script).toContain("Rückfragenstatus und Rückfragenpanel zeigen unterschiedliche Zaehler");
    expect(script).toContain("ältere Listen sind kein aktueller Vorgang");
    expect(script).toContain("nicht das aktuelle Ergebnis");
  });

  it("clicks a synthetic partial production spec and guards the open question browser path", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("open_question_markers");
    expect(script).toContain("Rückfragen öffnen: Lunch");
    expect(script).toContain("teilweise vollständig");
    expect(script).toContain("Lunch · 42 Teilnehmer · 2026-12-16");
    expect(script).toContain("Rückfragenstatus: offen 5 · beantwortet 0");
    expect(script).toContain("Rückfragen und Antworten\\\\noffen 5 · beantwortet 0");
    expect(script).toContain("production-session-spec-demo-production-answered-clarification");
    expect(script).toContain("Bitte prüfen: Synthetischer Rueckfragenanker fuer Demo.");
    expect(script).toContain("Antwort direkt zur Agentenfrage");
    expect(script).toContain("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.");
    expect(script).toContain("Produktionsblatt offen · Einkaufsliste offen");
    expect(script).toContain("Offener-Rueckfragen-Pfad ohne Antworten-speichern-Aktion");
    expect(script).toContain("Antworten-speichern-Aktion ist vor einer strukturierten Aenderung aktiv");
    expect(script).toContain("Offener-Rueckfragen-Pfad ohne Speichern-und-Berechnung-starten-Aktion");
    expect(script).toContain("Offener-Rueckfragen-Pfad ohne Teilnehmerzahl-Feld");
    expect(script).toContain("Antworten-speichern-Aktion bleibt nach strukturierter Aenderung deaktiviert");
    expect(script).toContain("Strukturierte Antwort-Aenderung wurde vor dem Speichern als aktueller Spec-Text angezeigt");
    expect(script).toContain("shouldSubmitAnswers");
    expect(script).toContain("planWithSaveButton.click()");
    expect(script).toContain("Answer-Submit-Rehearsal ohne Plan-Erfolgsmeldung");
    expect(script).toContain("Answer-Submit-Rehearsal ohne gespeicherte strukturierte Teilnehmerzahl");
    expect(script).toContain("Answer-Submit-Rehearsal ohne aktuellen Plan-Kontext");
    expect(script).toContain("Answer-Submit-Rehearsal ohne aktuelle Einkaufsliste");
    expect(script).toContain("Answer-Submit-Rehearsal Produktionsplan-Exportlink passt nicht");
    expect(script).toContain("Answer-Submit-Rehearsal Produktionsplan-Export ist nicht abrufbar");
    expect(script).toContain("Answer-Submit-Rehearsal Produktionsplan-Exportinhalt passt nicht");
    expect(script).toContain("Answer-Submit-Rehearsal Einkaufslisten-Exportlink passt nicht");
    expect(script).toContain("Answer-Submit-Rehearsal Einkaufslisten-Export ist nicht abrufbar");
    expect(script).toContain("Answer-Submit-Rehearsal Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header");
    expect(script).toContain("Answer-Submit-Rehearsal ohne Produktionsplan-Exportlink");
    expect(script).toContain("Answer-Submit-Rehearsal ohne Einkaufslisten-Exportlink");
    expect(script).toContain("Answer-Submit-Rehearsal bleibt nach Berechnung in leerem Ergebniszustand");
    expect(script).toContain("submitted_reload_markers");
    expect(script).toContain("Answer-Submit-Rehearsal Reload ohne gespeicherte strukturierte Teilnehmerzahl");
    expect(script).toContain("Answer-Submit-Rehearsal Reload faellt in leeren Ergebniszustand zurueck");
    expect(script).toContain("Offener-Rueckfragen-Pfad zeigt alten Produktionsplan als aktuellen Kontext");
    expect(script).toContain("Offener-Rueckfragen-Pfad zeigt alte Einkaufsliste als aktuellen Kontext");
    expect(script).toContain("Offener-Rueckfragen-Pfad zeigt alten Produktionsplan-Exportlink");
    expect(script).toContain("Offener-Rueckfragen-Pfad zeigt alten Einkaufslisten-Exportlink");
    expect(script).toContain("Offener-Rueckfragen-Pfad ohne Fehlupload-Archiv-Aktion");
    expect(script).toContain("Offener-Rueckfragen-Pfad deaktiviert Fehlupload-Archiv trotz aktivem Intake-Kontext");
    expect(script).toContain("Offener-Rueckfragen-Pfad bindet Fehlupload-Archiv nicht an den aktuellen Intake-Kontext");
    expect(script).toContain("Offener-Rueckfragen-Pfad beschriftet Fehlupload-Archiv nicht mit dem aktuellen Intake-Kontext");
    expect(script).toContain("Intake-Anfrage demo-production-answered-clarification");
    expect(script).toContain("shouldArchiveIntake");
    expect(script).toContain("archiveButton.click()");
    expect(script).toContain("Archive-Rehearsal ohne Soft-Archiv-Erfolgsmeldung");
    expect(script).toContain("Archive-Rehearsal zeigt archivierten Intake weiter als aktiven Kontext");
    expect(script).toContain("Archive-Rehearsal laesst Fehlupload-Archiv nach Klick aktiv oder falsch beschriftet");
    expect(script).toContain("Browser-Rehearsal-Archivpfad bestaetigt");
  });

  it("keeps mutating browser rehearsals isolated to a fresh synthetic data root by default", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("Mutierender Browser-Rehearsal mutiert synthetische lokale Daten und erwartet einen Fresh-Run.");
    expect(script).toContain("npm run local:start:fresh");
    expect(script).toContain("catering-agents-rehearsal-");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_ALLOW_PERSISTENT_MUTATION");
    expect(script).toContain("Answer-Submit-Modus: aktiv");
    expect(script).toContain("Archiv-Modus: aktiv");
  });

  it("guards production workspace actions against unsafe stale or empty states", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("Arbeitsbereich-lokal-leeren-Aktion fehlt");
    expect(script).toContain("Arbeitsbereich-lokal-leeren-Aktion ist trotz aktuellem Ergebnis deaktiviert");
    expect(script).toContain("Arbeitsbereich-lokal-leeren-Aktion ist nicht mit aktuellem Kontext beschriftet");
    expect(script).toContain("Fehlupload-Archiv-Aktion fehlt");
    expect(script).toContain("Fehlupload-Archiv-Aktion ist ohne aktiven Intake-Kontext nicht sicher deaktiviert");
    expect(script).toContain("Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.");
    expect(script).toContain("Wiederverarbeitungs-Aktion ist ohne ausgewählte Datei nicht sicher deaktiviert");
  });

  it("clicks local clear in the browser and rejects stale production artifacts afterwards", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("clear_workspace_markers");
    expect(script).toContain("Clear-Check vor Klick ohne aktuellen Plan-Kontext");
    expect(script).toContain("clearButton.click()");
    expect(script).toContain("Kein aktiver Vorgang");
    expect(script).toContain("Auftrag einfügen oder Datei ablegen");
    expect(script).toContain("Clear-Check nach Klick zeigt alten Produktionsplan");
    expect(script).toContain("Clear-Check nach Klick zeigt alte Einkaufsliste");
    expect(script).toContain("Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.");
    expect(script).toContain("Clear-Check nach Klick laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
    expect(script).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit -> lokales Leeren");
  });
});
