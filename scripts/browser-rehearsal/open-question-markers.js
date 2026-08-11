async () => {
  const missing = [];
  const shouldSubmitAnswers = "__SUBMIT_ANSWERS__" === "1";
  const shouldArchiveIntake = "__ARCHIVE_INTAKE__" === "1";
  const partialQuestionButton = [...document.querySelectorAll("button")].find((button) => {
    const label = button.getAttribute("aria-label") ?? "";
    return label.includes("Rückfragen öffnen: Lunch") && label.includes("teilweise vollständig");
  });

  if (!partialQuestionButton) {
    throw new Error("Offener-Rueckfragen-Browserpfad ohne partial Lunch-Aktion");
  }

  partialQuestionButton.click();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const text = document.body.innerText;
    if (
      text.includes("Lunch · 42 Teilnehmer · 2026-12-16") &&
      text.includes("Rückfragen:\noffen 6 · beantwortet 0")
    ) {
      break;
    }
  }

  const openAnswerEditorButton = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/g, " ").trim() === "Rückfragen beantworten"
  );
  if (!openAnswerEditorButton) {
    throw new Error("Offener-Rueckfragen-Browserpfad ohne sichtbare Antwort-Aktion");
  }
  openAnswerEditorButton.click();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (document.body.innerText.includes("Antwort direkt zur Agentenfrage")) {
      break;
    }
  }

  const text = document.body.innerText;
  const visibleExportHrefs = [...document.querySelectorAll("a")]
    .filter((anchor) => anchor.offsetParent !== null)
    .map((anchor) => anchor.getAttribute("href") ?? "");
  for (const marker of [
    "NÄCHSTER SCHRITT\n\nRückfragen beantworten",
    "Lunch · 42 Teilnehmer · 2026-12-16",
    "Status:\nteilweise geklärt",
    "Rückfragen:\noffen 6 · beantwortet 0",
    "Rückfragen und Antworten\noffen 6 · beantwortet 0",
    "URSPRÜNGLICHE INTAKE-ANFRAGE",
    "Rückfrage offen",
    "Bitte prüfen: Synthetischer Rueckfragenanker fuer Demo.",
    "Antwort direkt zur Agentenfrage",
    "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.",
    "Produktionsblatt offen · Einkaufsliste offen"
  ]) {
    if (!text.includes(marker)) {
      missing.push(`Offener-Rueckfragen-Marker fehlt: ${marker}`);
    }
  }
  if (text.includes("Plan-Kontext: planId plan-spec-demo-production-coffee")) {
    missing.push("Offener-Rueckfragen-Pfad zeigt alten Produktionsplan als aktuellen Kontext");
  }
  if (text.includes("purchaseListId: purchase-spec-demo-production-coffee")) {
    missing.push("Offener-Rueckfragen-Pfad zeigt alte Einkaufsliste als aktuellen Kontext");
  }
  if (visibleExportHrefs.includes("/api/exports/v1/exports/production-plans/plan-spec-demo-production-coffee/html")) {
    missing.push("Offener-Rueckfragen-Pfad zeigt alten Produktionsplan-Exportlink");
  }
  if (visibleExportHrefs.includes("/api/exports/v1/exports/purchase-lists/purchase-spec-demo-production-coffee/csv")) {
    missing.push("Offener-Rueckfragen-Pfad zeigt alten Einkaufslisten-Exportlink");
  }
  if (text.includes("Abschluss-Kontext:")) {
    missing.push("Offener-Rueckfragen-Pfad zeigt alten Abschluss-Kontext");
  }
  const archiveButton = [...document.querySelectorAll("button")].find((button) =>
    (button.getAttribute("title") ?? "").startsWith("Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen:")
  );
  if (!archiveButton) {
    missing.push("Offener-Rueckfragen-Pfad ohne Fehlupload-Archiv-Aktion");
  } else {
    const archiveButtonText = (archiveButton.textContent ?? "").replace(/\s+/g, " ").trim();
    const archiveTitle = archiveButton.getAttribute("title") ?? "";
    if (archiveButton.disabled) {
      missing.push("Offener-Rueckfragen-Pfad deaktiviert Fehlupload-Archiv trotz aktivem Intake-Kontext");
    }
    if (!archiveButtonText.includes("Intake-Anfrage im Fokus")) {
      missing.push("Offener-Rueckfragen-Pfad bindet Fehlupload-Archiv nicht an den aktuellen Intake-Kontext");
    }
    if (archiveTitle !== "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage im Fokus") {
      missing.push("Offener-Rueckfragen-Pfad beschriftet Fehlupload-Archiv nicht mit dem aktuellen Intake-Kontext");
    }
  }
  if (shouldArchiveIntake) {
    if (!archiveButton) {
      missing.push("Archive-Rehearsal ohne Fehlupload-Archiv-Aktion");
    } else if (archiveButton.disabled) {
      missing.push("Archive-Rehearsal kann Fehlupload-Archiv-Aktion nicht klicken");
    } else {
      archiveButton.click();
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const archivedText = document.body.innerText;
        if (
          archivedText.includes(
            "Fehlupload wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
          ) &&
          archivedText.includes("Angebot hochladen oder Produktionsauftrag beschreiben") &&
          !archivedText.includes("requestId:")
        ) {
          break;
        }
      }

      const archivedText = document.body.innerText;
      const archivedHtml = document.body.innerHTML;
      const archivedButtons = [...document.querySelectorAll("button")].map((button) => ({
        text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
        disabled: button.disabled,
        title: button.getAttribute("title") ?? ""
      }));
      const archivedArchiveButton = archivedButtons.find((button) =>
        button.text.startsWith("Fehlgeschlagenen Demo-Upload ausblenden")
      );
      if (
        !archivedText.includes(
          "Fehlupload wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
        )
      ) {
        missing.push("Archive-Rehearsal ohne Soft-Archiv-Erfolgsmeldung");
      }
      if (!archivedText.includes("Angebot hochladen oder Produktionsauftrag beschreiben")) {
        missing.push("Archive-Rehearsal ohne sichere naechste Eingabe nach Klick");
      }
      if (archivedText.includes("requestId:")) {
        missing.push("Archive-Rehearsal zeigt archivierten Intake weiter als aktiven Kontext");
      }
      if (archivedHtml.includes("/api/intake/v1/intake/requests/")) {
        missing.push("Archive-Rehearsal behaelt archivierten Intake-Detailanker im DOM");
      }
      if (archivedText.includes("Abschluss-Kontext:")) {
        missing.push("Archive-Rehearsal zeigt alten Abschluss-Kontext nach Klick");
      }
      if (archivedHtml.includes("/api/exports/v1/exports/production-plans/")) {
        missing.push("Archive-Rehearsal behaelt Produktionsplan-Exportlink nach Klick");
      }
      if (archivedHtml.includes("/api/exports/v1/exports/purchase-lists/")) {
        missing.push("Archive-Rehearsal behaelt Einkaufslisten-Exportlink nach Klick");
      }
      if (!archivedArchiveButton) {
        missing.push("Archive-Rehearsal nach Klick ohne Fehlupload-Archiv-Aktion");
      } else if (
        !archivedArchiveButton.disabled ||
        archivedArchiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
      ) {
        missing.push("Archive-Rehearsal laesst Fehlupload-Archiv nach Klick aktiv oder falsch beschriftet");
      }

      sessionStorage.setItem("capArchiveRehearsalChecked", "1");
    }

    if (missing.length > 0) {
      throw new Error(`Archiv-Browserpfad fehlgeschlagen: ${missing.join(" | ")}`);
    }
    return { route: location.pathname, markers: "archive-intake-ok" };
  }
  const answerSaveButton = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/g, " ").trim() === "Antworten speichern"
  );
  const planWithSaveButton = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/g, " ").trim() === "Speichern und Berechnung starten"
  );
  const answerEditor = [...document.querySelectorAll("section, article, form")].find((element) =>
    (element.textContent ?? "").includes("Antwort direkt zur Agentenfrage") &&
    (element.textContent ?? "").includes("Antworten speichern")
  );
  const attendeeInput = answerEditor
    ? [...answerEditor.querySelectorAll("input")].find((input) => input.getAttribute("placeholder") === "120")
    : undefined;

  if (!answerSaveButton) {
    missing.push("Offener-Rueckfragen-Pfad ohne Antworten-speichern-Aktion");
  } else if (!answerSaveButton.disabled) {
    missing.push("Antworten-speichern-Aktion ist vor einer strukturierten Aenderung aktiv");
  }
  if (!planWithSaveButton) {
    missing.push("Offener-Rueckfragen-Pfad ohne Speichern-und-Berechnung-starten-Aktion");
  }
  if (!attendeeInput) {
    missing.push("Offener-Rueckfragen-Pfad ohne Teilnehmerzahl-Feld");
  } else {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(attendeeInput, "43");
    attendeeInput.dispatchEvent(new Event("input", { bubbles: true }));
    attendeeInput.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (answerSaveButton?.disabled) {
      missing.push("Antworten-speichern-Aktion bleibt nach strukturierter Aenderung deaktiviert");
    }
    if (document.body.innerText.includes("Teilnehmerzahl: 43")) {
      missing.push("Strukturierte Antwort-Aenderung wurde vor dem Speichern als aktueller Spec-Text angezeigt");
    }
  }
  if (shouldSubmitAnswers) {
    if (!planWithSaveButton) {
      missing.push("Answer-Submit-Rehearsal ohne Berechnungsaktion");
    } else if (planWithSaveButton.disabled) {
      missing.push("Answer-Submit-Rehearsal kann Berechnungsaktion nach strukturierter Aenderung nicht klicken");
    } else {
      planWithSaveButton.click();
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const draftText = document.body.innerText;
        if (
          draftText.includes("Lunch · 43 Teilnehmer · 2026-12-16") &&
          draftText.includes("manueller Import | wartet auf Prüfung | 5 Prüfpunkte") &&
          draftText.includes("Enthält: Eventdaten, Produktionsplan, Einkaufsliste, 2 Rückfragen.")
        ) {
          break;
        }
      }

      const draftText = document.body.innerText;
      if (!draftText.includes("Lunch · 43 Teilnehmer · 2026-12-16")) {
        missing.push("Answer-Submit-Rehearsal speichert die strukturierte Teilnehmerzahl nicht im Lunch-Auftrag");
      }
      if (!draftText.includes("manueller Import | wartet auf Prüfung | 5 Prüfpunkte")) {
        missing.push("Answer-Submit-Rehearsal erzeugt keinen prüfpflichtigen Produktionsentwurf");
      }
      if (!draftText.includes("Enthält: Eventdaten, Produktionsplan, Einkaufsliste, 2 Rückfragen.")) {
        missing.push("Answer-Submit-Rehearsal weist den Inhalt des Produktionsentwurfs nicht aus");
      }
      if (draftText.includes("Plan-Kontext: aktueller Produktionsplan")) {
        missing.push("Answer-Submit-Rehearsal materialisiert Produktdaten vor der Freigabe");
      }

      const passButtons = [...document.querySelectorAll("button")].filter(
        (button) => (button.textContent ?? "").trim() === "Passt" && !button.disabled
      );
      if (passButtons.length !== 5) {
        missing.push(`Answer-Submit-Rehearsal erwartet 5 entscheidbare Prüfpunkte, gefunden: ${passButtons.length}`);
      } else {
        for (const passButton of passButtons) {
          passButton.click();
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }

      const approveDraftButton = [...document.querySelectorAll("button")].find(
        (button) => (button.textContent ?? "").trim() === "Entwurf freigeben"
      );
      if (!approveDraftButton) {
        missing.push("Answer-Submit-Rehearsal ohne Entwurf-freigeben-Aktion");
      } else if (approveDraftButton.disabled) {
        missing.push("Answer-Submit-Rehearsal kann den vollständig geprüften Entwurf nicht freigeben");
      } else {
        approveDraftButton.click();
        for (let attempt = 0; attempt < 60; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const approvedText = document.body.innerText;
          const enabledApplyButton = [...document.querySelectorAll("button")].find(
            (button) =>
              (button.textContent ?? "").trim() === "Entwurf übernehmen" &&
              !button.disabled
          );
          if (approvedText.includes("Produktionsentwurf freigegeben.") && enabledApplyButton) {
            break;
          }
        }
      }

      const applyDraftButton = [...document.querySelectorAll("button")].find(
        (button) => (button.textContent ?? "").trim() === "Entwurf übernehmen"
      );
      if (!applyDraftButton) {
        missing.push("Answer-Submit-Rehearsal ohne bewusste Übernahme-Aktion nach Freigabe");
      } else if (applyDraftButton.disabled) {
        missing.push("Answer-Submit-Rehearsal kann den freigegebenen Entwurf nicht übernehmen");
      } else {
        applyDraftButton.click();
        for (let attempt = 0; attempt < 80; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const appliedText = document.body.innerText;
          if (
            appliedText.includes("Produktionsentwurf übernommen.") &&
            appliedText.includes("Plan-Kontext: aktueller Produktionsplan") &&
            appliedText.includes("1 Liste ohne Positionen")
          ) {
            break;
          }
        }
      }

      const submittedText = document.body.innerText;
      const submittedHtml = document.body.innerHTML;
      const submittedExportLinks = [...document.querySelectorAll("a")]
        .map((anchor) => {
          const href = anchor.getAttribute("href") ?? "";
          return href ? new URL(href, location.origin).pathname : "";
        });
      const submittedPlanExport = submittedExportLinks.find((href) =>
        /^\/api\/exports\/v1\/exports\/production-plans\/[^/]+\/html$/.test(href)
      );
      const submittedPurchaseExport = submittedExportLinks.find((href) =>
        /^\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv$/.test(href)
      );
      const submittedPlanId = submittedPlanExport?.match(/^\/api\/exports\/v1\/exports\/production-plans\/([^/]+)\/html$/)?.[1];
      const expectedHandoffContext =
        "Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste ohne Positionen";
      if (!submittedText.includes("Produktionsentwurf übernommen.")) {
        missing.push("Answer-Submit-Rehearsal ohne bestätigte Entwurfsübernahme");
      }
      if (!submittedText.includes("Teilnehmerzahl: 43")) {
        missing.push("Answer-Submit-Rehearsal ohne gespeicherte strukturierte Teilnehmerzahl");
      }
      if (!submittedText.includes("Lunch · 43 Teilnehmer · 2026-12-16")) {
        missing.push("Answer-Submit-Rehearsal zeigt den aktualisierten Lunch-Auftrag nicht mit 43 Teilnehmern");
      }
      if (!submittedText.includes("Plan-Kontext: aktueller Produktionsplan")) {
        missing.push("Answer-Submit-Rehearsal ohne lesbaren aktuellen Plan-Kontext");
      }
      if (submittedText.includes("Plan-Kontext: planId ") || submittedText.includes("purchaseListId: ")) {
        missing.push("Answer-Submit-Rehearsal zeigt technische IDs im sichtbaren Kontext");
      }
      if (!submittedPlanExport || !submittedPlanId) {
        missing.push("Answer-Submit-Rehearsal ohne aktuellen Produktionsplan-Exportlink");
      } else {
        const planExportResponse = await fetch(submittedPlanExport);
        if (!planExportResponse.ok) {
          missing.push(`Answer-Submit-Rehearsal Produktionsplan-Export ist nicht abrufbar: ${planExportResponse.status}`);
        } else {
          const planExportBody = await planExportResponse.text();
          if (
            !planExportBody.includes("<h1>Produktionsplan</h1>") ||
            !planExportBody.includes("Klassifikation für Lunchbuffet fehlt.")
          ) {
            missing.push("Answer-Submit-Rehearsal Produktionsplan-Export enthaelt keine fachliche Lunch-Planung");
          }
          if (planExportBody.includes(submittedPlanId) || planExportBody.includes("planId")) {
            missing.push("Answer-Submit-Rehearsal Produktionsplan-Export zeigt eine technische Plan-ID");
          }
        }
      }
      if (submittedPurchaseExport) {
        missing.push("Answer-Submit-Rehearsal bietet für eine Einkaufsliste ohne Positionen einen CSV-Export an");
      }
      if (!submittedText.includes("1 Liste ohne Positionen")) {
        missing.push("Answer-Submit-Rehearsal kennzeichnet die leere Einkaufsliste nicht ehrlich");
      }
      if (!submittedText.includes("Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.")) {
        missing.push("Answer-Submit-Rehearsal erklärt den fehlenden Einkaufslisten-Export nicht");
      }
      if (!submittedText.includes(expectedHandoffContext)) {
        missing.push("Answer-Submit-Rehearsal ohne lesbaren Abschluss-Kontext");
      }
      if (!submittedHtml.includes("/api/exports/v1/exports/production-plans/")) {
        missing.push("Answer-Submit-Rehearsal ohne Produktionsplan-Exportlink");
      }
      if (submittedHtml.includes("/api/exports/v1/exports/purchase-lists/")) {
        missing.push("Answer-Submit-Rehearsal zeigt einen unzulässigen Einkaufslisten-Exportlink");
      }
      if (submittedText.includes("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.")) {
        missing.push("Answer-Submit-Rehearsal bleibt nach Übernahme in leerem Ergebniszustand");
      }
      if (submittedText.includes("Plan-Kontext: planId ") || submittedText.includes("purchaseListId:")) {
        missing.push("Answer-Submit-Rehearsal zeigt technische IDs im sichtbaren Kontext");
      }
      if (missing.length > 0) {
        throw new Error(`Answer-Submit-Rehearsal fehlgeschlagen: ${missing.join(" | ")}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Offener-Rueckfragen-Browserpfad fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "open-question-ok" };
}
