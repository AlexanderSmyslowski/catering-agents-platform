import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser rehearsal script contract", () => {
  const readmeDoc = readFileSync("README.md", "utf8");
  const testingDoc = readFileSync("TESTING.md", "utf8");
  const browserShellHelpers = readFileSync("scripts/browser-rehearsal-shell.sh", "utf8");
  const browserRehearsalScripts = readdirSync("scripts/browser-rehearsal")
    .filter((fileName) => fileName.endsWith(".js"))
    .sort()
    .map((fileName) => readFileSync(`scripts/browser-rehearsal/${fileName}`, "utf8"))
    .join("\n");

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
    expect(packageJson.scripts?.["browser:rehearsal:failed-upload"]).toBe(
      "CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD=1 bash ./scripts/check-browser-rehearsal.sh"
    );
    expect(packageJson.scripts?.["browser:rehearsal:full-fresh"]).toBe(
      "bash ./scripts/check-browser-rehearsal-full-fresh.sh"
    );
    expect(script).toContain("browser-rehearsal-shell.sh");
    expect(script).toContain("load_rehearsal_script \"home-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"offer-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"production-markers.js\"");
    expect(script).toContain("load_rehearsal_script_with_modes \"open-question-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"submitted-reload-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"archive-reload-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"failed-upload-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"production-result-reload-pre-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"production-result-reload-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"clear-workspace-markers.js\"");
    expect(script).toContain("load_rehearsal_script \"clear-workspace-reload-markers.js\"");
    expect(browserShellHelpers).toContain("playwright");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_BASE_URL");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD");
    expect(script).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit");
    expect(script).toContain("Browser-Navigations- und Markerpruefung");
    expect(script).toContain("click_rehearsal_link");
    expect(script).toContain("Produktion offene Rueckfragen");
    expect(script).toContain("Produktion Ergebnis-Kontext wiederhergestellt");
    expect(script).toContain("Produktion Submit-Reload gespeichert");
    expect(script).toContain("Produktion Failed-Upload sicher");
    expect(script).toContain("Produktion lokal geleert");
    expect(script).toContain("keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage");
  });

  it("keeps the full fresh browser rehearsal wired to the four synthetic browser modes", () => {
    const script = readFileSync("scripts/check-browser-rehearsal-full-fresh.sh", "utf8");

    expect(script).toContain("start-fresh-local-stack.sh");
    expect(script).toContain("check-browser-rehearsal.sh");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS=1");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE=1");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD=1");
    expect(script).toContain("env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE");
    expect(script).toContain("env -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS=1");
    expect(script).toContain("env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE=1");
    expect(script).toContain("Normaler Kernpfad");
    expect(script).toContain("Answer-Submit-Pfad");
    expect(script).toContain("Archiv-Pfad");
    expect(script).toContain("Failed-Upload-Pfad");
    expect(script).toContain("keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage");
  });

  it("does not pretend that the public Playwright CLI supports the Codex browser session protocol", () => {
    expect(browserShellHelpers).toContain("Browser-Rehearsal benoetigt die Codex-kompatible Browser-CLI");
    expect(browserShellHelpers).toContain("CATERING_BROWSER_CLI");
    expect(browserShellHelpers).toContain("Die oeffentliche Playwright-CLI ist kein kompatibler Fallback");
    expect(browserShellHelpers).not.toContain("npx --yes --package @playwright/cli playwright-cli");
  });

  it("guards the route, export and audit markers that make the synthetic core path browser-checkable", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");
    const rehearsalBundle = `${script}\n${browserRehearsalScripts}`;

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
      expect(rehearsalBundle).toContain(marker);
    }
  });

  it("requires the browser flow to navigate through visible app links instead of route-only checks", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(script).toContain("Start -> Angebot");
    expect(script).toContain("Angebot -> Produktion");
    expect(browserShellHelpers).toContain("local attempts=30");
    expect(browserShellHelpers).toContain("wartet auf ${target_path}");
    expect(browserShellHelpers).toContain("navigierte nicht stabil nach ${target_path}");
    expect(script).toContain("click_rehearsal_link \"Start -> Angebot\" \"/angebot\"");
    expect(script).toContain("click_rehearsal_link \"Angebot -> Produktion\" \"/produktion\"");
    expect(browserRehearsalScripts).toContain("link.click()");
  });

  it("guards current production context against stale artifact confusion", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");
    const rehearsalBundle = `${script}\n${browserRehearsalScripts}`;

    expect(rehearsalBundle).toContain("aktueller Plan-Kontext fehlt");
    expect(rehearsalBundle).toContain("aktueller Produktionsplan-Exportlink passt nicht");
    expect(rehearsalBundle).toContain("aktueller Einkaufslisten-Kontext fehlt");
    expect(rehearsalBundle).toContain("aktueller Einkaufslisten-Exportlink passt nicht");
    expect(rehearsalBundle).toContain("Abschluss-Kontext passt nicht zum aktuellen Plan-/Einkaufslisten-Kontext");
    expect(rehearsalBundle).toContain("aktueller Produktionsplan-Export ist im Browser nicht abrufbar");
    expect(rehearsalBundle).toContain("aktueller Produktionsplan-Exportinhalt passt nicht");
    expect(rehearsalBundle).toContain("aktueller Einkaufslisten-Export ist im Browser nicht abrufbar");
    expect(rehearsalBundle).toContain("aktueller Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header");
    expect(rehearsalBundle).toContain("fetch(expectedPlanHref)");
    expect(rehearsalBundle).toContain("fetch(expectedPurchaseHref)");
    expect(rehearsalBundle).toContain("Rückfragenstatus-Zaehler fehlt");
    expect(rehearsalBundle).toContain("Rückfragen-und-Antworten-Zaehler fehlt");
    expect(rehearsalBundle).toContain("Rückfragenstatus und Rückfragenpanel zeigen unterschiedliche Zaehler");
    expect(rehearsalBundle).toContain("ältere Listen sind kein aktueller Vorgang");
    expect(rehearsalBundle).toContain("nicht das aktuelle Ergebnis");
    expect(script).toContain("production_result_reload_markers");
    expect(script).toContain("Produktion Ergebnis-Reload stabil");
    expect(rehearsalBundle).toContain("Produktions-Ergebnis-Reload verliert aktuellen Plan-Kontext");
    expect(rehearsalBundle).toContain("Produktions-Ergebnis-Reload verliert aktuelle Einkaufsliste");
    expect(rehearsalBundle).toContain("Produktions-Ergebnis-Reload verliert passenden Abschluss-Kontext");
    expect(rehearsalBundle).toContain("Produktions-Ergebnis-Reload verliert aktuellen Produktionsplan-Exportlink");
    expect(rehearsalBundle).toContain("Produktions-Ergebnis-Reload faellt in leeren Ergebniszustand zurueck");
  });

  it("clicks a synthetic partial production spec and guards the open question browser path", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");
    const rehearsalBundle = `${script}\n${browserRehearsalScripts}`;

    expect(rehearsalBundle).toContain("open_question_markers");
    expect(rehearsalBundle).toContain("Rückfragen öffnen: Lunch");
    expect(rehearsalBundle).toContain("teilweise vollständig");
    expect(rehearsalBundle).toContain("Lunch · 42 Teilnehmer · 2026-12-16");
    expect(rehearsalBundle).toContain("Rückfragenstatus: offen 5 · beantwortet 0");
    expect(rehearsalBundle).toContain("Rückfragen und Antworten\\\\noffen 5 · beantwortet 0");
    expect(rehearsalBundle).toContain("production-session-spec-demo-production-answered-clarification");
    expect(rehearsalBundle).toContain("Bitte prüfen: Synthetischer Rueckfragenanker fuer Demo.");
    expect(rehearsalBundle).toContain("Antwort direkt zur Agentenfrage");
    expect(rehearsalBundle).toContain("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.");
    expect(rehearsalBundle).toContain("Produktionsblatt offen · Einkaufsliste offen");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad ohne Antworten-speichern-Aktion");
    expect(rehearsalBundle).toContain("Antworten-speichern-Aktion ist vor einer strukturierten Aenderung aktiv");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad ohne Speichern-und-Berechnung-starten-Aktion");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad ohne Teilnehmerzahl-Feld");
    expect(rehearsalBundle).toContain("Antworten-speichern-Aktion bleibt nach strukturierter Aenderung deaktiviert");
    expect(rehearsalBundle).toContain("Strukturierte Antwort-Aenderung wurde vor dem Speichern als aktueller Spec-Text angezeigt");
    expect(rehearsalBundle).toContain("shouldSubmitAnswers");
    expect(rehearsalBundle).toContain("planWithSaveButton.click()");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal ohne Plan-Erfolgsmeldung");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal ohne gespeicherte strukturierte Teilnehmerzahl");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal ohne aktuellen Plan-Kontext");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal ohne aktuelle Einkaufsliste");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal ohne passenden Abschluss-Kontext");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Produktionsplan-Exportlink passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Produktionsplan-Export ist nicht abrufbar");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Produktionsplan-Exportinhalt passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Einkaufslisten-Exportlink passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Einkaufslisten-Export ist nicht abrufbar");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal ohne Produktionsplan-Exportlink");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal ohne Einkaufslisten-Exportlink");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal bleibt nach Berechnung in leerem Ergebniszustand");
    expect(rehearsalBundle).toContain("submitted_reload_markers");
    expect(rehearsalBundle).toContain(
      "Answer-Submit-Rehearsal Reload ohne gespeicherte strukturierte Teilnehmerzahl"
    );
    expect(rehearsalBundle).toContain(
      "Answer-Submit-Rehearsal Reload faellt in leeren Ergebniszustand zurueck"
    );
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Produktionsplan-Exportlink passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Produktionsplan-Export ist nicht abrufbar");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Produktionsplan-Exportinhalt passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Produktionsplan-Exportlabel passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Einkaufslisten-Exportlink passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Einkaufslisten-Export ist nicht abrufbar");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Einkaufslisten-Exportlabel passt nicht");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload ohne passenden Abschluss-Kontext");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload Abschluss-Kontext hat unterschiedliche Spezifikationen");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload ohne Produktionsplan-Exportlink");
    expect(rehearsalBundle).toContain("Answer-Submit-Rehearsal Reload ohne Einkaufslisten-Exportlink");
    expect(rehearsalBundle).toContain("fetch(expectedPlanHref)");
    expect(rehearsalBundle).toContain("fetch(expectedPurchaseHref)");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad zeigt alten Produktionsplan als aktuellen Kontext");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad zeigt alte Einkaufsliste als aktuellen Kontext");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad zeigt alten Produktionsplan-Exportlink");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad zeigt alten Einkaufslisten-Exportlink");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad zeigt alten Abschluss-Kontext");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad ohne Fehlupload-Archiv-Aktion");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad deaktiviert Fehlupload-Archiv trotz aktivem Intake-Kontext");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad bindet Fehlupload-Archiv nicht an den aktuellen Intake-Kontext");
    expect(rehearsalBundle).toContain("Offener-Rueckfragen-Pfad beschriftet Fehlupload-Archiv nicht mit dem aktuellen Intake-Kontext");
    expect(rehearsalBundle).toContain("Intake-Anfrage demo-production-answered-clarification");
    expect(rehearsalBundle).toContain("shouldArchiveIntake");
    expect(rehearsalBundle).toContain("archiveButton.click()");
    expect(rehearsalBundle).toContain("Archive-Rehearsal ohne Soft-Archiv-Erfolgsmeldung");
    expect(rehearsalBundle).toContain("Archive-Rehearsal zeigt archivierten Intake weiter als aktiven Kontext");
    expect(rehearsalBundle).toContain("Archive-Rehearsal zeigt alten Abschluss-Kontext nach Klick");
    expect(rehearsalBundle).toContain("Archive-Rehearsal behaelt Produktionsplan-Exportlink nach Klick");
    expect(rehearsalBundle).toContain("Archive-Rehearsal behaelt Einkaufslisten-Exportlink nach Klick");
    expect(rehearsalBundle).toContain("Archive-Rehearsal laesst Fehlupload-Archiv nach Klick aktiv oder falsch beschriftet");
    expect(rehearsalBundle).toContain("capArchiveRehearsalChecked");
    expect(rehearsalBundle).toContain("Produktion Archiv-Reload stabil");
    expect(rehearsalBundle).toContain("Archive-Rehearsal Reload ohne leeren aktiven Vorgang");
    expect(rehearsalBundle).toContain("Archive-Rehearsal Reload zeigt archivierten Intake wieder als aktiven Kontext");
    expect(rehearsalBundle).toContain("Archive-Rehearsal Reload behaelt archivierten Intake-Detailanker im DOM");
    expect(rehearsalBundle).toContain("Archive-Rehearsal Reload zeigt alten Abschluss-Kontext");
    expect(rehearsalBundle).toContain("Archive-Rehearsal Reload behaelt Produktionsplan-Exportlink");
    expect(rehearsalBundle).toContain("Archive-Rehearsal Reload behaelt Einkaufslisten-Exportlink");
    expect(rehearsalBundle).toContain("Archive-Rehearsal Reload laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
    expect(rehearsalBundle).toContain("Browser-Rehearsal-Archivpfad bestaetigt");
  });

  it("keeps mutating browser rehearsals isolated to a fresh synthetic data root by default", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");

    expect(browserShellHelpers).toContain("Mutierender Browser-Rehearsal mutiert synthetische lokale Daten und erwartet einen Fresh-Run.");
    expect(browserShellHelpers).toContain("npm run local:start:fresh");
    expect(browserShellHelpers).toContain("catering-agents-rehearsal-");
    expect(script).toContain("CATERING_BROWSER_REHEARSAL_ALLOW_PERSISTENT_MUTATION");
    expect(script).toContain("Answer-Submit-Modus: aktiv");
    expect(script).toContain("Archiv-Modus: aktiv");
    expect(script).toContain("Failed-Upload-Modus: aktiv");
  });

  it("documents the normal and mutating browser rehearsal modes without widening release claims", () => {
    for (const doc of [readmeDoc, testingDoc]) {
      expect(doc).toContain("`npm run browser:rehearsal`");
      expect(doc).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit");
      expect(doc).toContain("`npm run browser:rehearsal:answer-submit`");
      expect(doc).toContain("`npm run browser:rehearsal:archive-intake`");
      expect(doc).toContain("`npm run browser:rehearsal:failed-upload`");
      expect(doc).toContain("`npm run browser:rehearsal:full-fresh`");
      expect(doc).toContain("`npm run local:start:fresh`");
      expect(doc).toContain("synthetische");
      expect(doc).toContain("Fresh-Datenwurzel");
      expect(doc).toContain("kein Echte-Daten");
      expect(doc).toContain("keine Produktionsfreigabe");
    }
  });

  it("guards production workspace actions against unsafe stale or empty states", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");
    const rehearsalBundle = `${script}\n${browserRehearsalScripts}`;

    expect(rehearsalBundle).toContain("Arbeitsbereich-lokal-leeren-Aktion fehlt");
    expect(rehearsalBundle).toContain("Arbeitsbereich-lokal-leeren-Aktion ist trotz aktuellem Ergebnis deaktiviert");
    expect(rehearsalBundle).toContain("Arbeitsbereich-lokal-leeren-Aktion ist nicht mit aktuellem Kontext beschriftet");
    expect(rehearsalBundle).toContain("Fehlupload-Archiv-Aktion fehlt");
    expect(rehearsalBundle).toContain("Fehlupload-Archiv-Aktion ist ohne aktiven Intake-Kontext nicht sicher deaktiviert");
    expect(rehearsalBundle).toContain("Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.");
    expect(rehearsalBundle).toContain("Wiederverarbeitungs-Aktion ist ohne ausgewählte Datei nicht sicher deaktiviert");
  });

  it("clicks local clear in the browser and rejects stale production artifacts afterwards", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");
    const rehearsalBundle = `${script}\n${browserRehearsalScripts}`;

    expect(script).toContain("clear_workspace_markers");
    expect(rehearsalBundle).toContain("Clear-Check vor Klick ohne aktuellen Plan-Kontext");
    expect(rehearsalBundle).toContain("clearButton.click()");
    expect(rehearsalBundle).toContain("Kein aktiver Vorgang");
    expect(rehearsalBundle).toContain("Auftrag einfügen oder Datei ablegen");
    expect(rehearsalBundle).toContain("Clear-Check nach Klick zeigt alten Produktionsplan");
    expect(rehearsalBundle).toContain("Clear-Check nach Klick zeigt alte Einkaufsliste");
    expect(rehearsalBundle).toContain("Clear-Check nach Klick zeigt alten Abschluss-Kontext");
    expect(rehearsalBundle).toContain("Clear-Check nach Klick zeigt alte Audit-Spur");
    expect(rehearsalBundle).toContain("Clear-Check nach Klick ohne neutralisierte Audit-Spur");
    expect(rehearsalBundle).toContain("Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.");
    expect(rehearsalBundle).toContain("Clear-Check nach Klick laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
    expect(rehearsalBundle).toContain("capClearWorkspaceContext");
    expect(rehearsalBundle).toContain("Clear-Check Reload zeigt weder leeren Arbeitsbereich noch konsistent wiederhergestellten aktuellen Kontext");
    expect(rehearsalBundle).toContain("Clear-Check Reload zeigt alte Audit-Spur im leeren Arbeitsbereich");
    expect(rehearsalBundle).toContain("Clear-Check Reload ohne neutralisierte Audit-Spur im leeren Arbeitsbereich");
    expect(rehearsalBundle).toContain("Clear-Check Reload laesst Clear-Aktion aktiv oder falsch beschriftet");
    expect(rehearsalBundle).toContain("Clear-Check Reload laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
    expect(script).toContain("Produktion lokales Leeren nach Reload konsistent");
    expect(script).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit -> lokales Leeren");
  });

  it("checks the failed upload browser path without preserving stale production artifacts", () => {
    const script = readFileSync("scripts/check-browser-rehearsal.sh", "utf8");
    const rehearsalBundle = `${script}\n${browserRehearsalScripts}`;

    expect(script).toContain("failed_upload_markers");
    expect(rehearsalBundle).toContain("falsches-angebot.exe");
    expect(rehearsalBundle).toContain("Dateityp .exe ist nicht erlaubt.");
    expect(rehearsalBundle).toContain("Failed-Upload-Rehearsal ohne sichtbare Upload-Fehlermeldung");
    expect(rehearsalBundle).toContain("Failed-Upload-Rehearsal verliert die retrybare Fehldatei");
    expect(rehearsalBundle).toContain("Failed-Upload-Rehearsal ohne leeren aktiven Vorgang nach Fehler");
    expect(rehearsalBundle).toContain("Failed-Upload-Rehearsal zeigt alten Produktionsplan");
    expect(rehearsalBundle).toContain("Failed-Upload-Rehearsal zeigt alte Einkaufsliste");
    expect(rehearsalBundle).toContain("Failed-Upload-Rehearsal laesst Fehlupload-Archiv ohne aktiven Intake-Kontext aktiv oder falsch beschriftet");
    expect(rehearsalBundle).toContain("Failed-Upload-Rehearsal kann retrybare Fehldatei nicht erneut verarbeiten");
    expect(rehearsalBundle).toContain("Browser-Rehearsal-Fehluploadpfad bestaetigt");
  });
});
