#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${CATERING_BROWSER_REHEARSAL_BASE_URL:-http://127.0.0.1:3200}"
SESSION_NAME="${CATERING_BROWSER_REHEARSAL_SESSION:-cap}"
CURL_MAX_TIME_SECONDS="${CATERING_LOCAL_CURL_MAX_TIME_SECONDS:-5}"
SUBMIT_ANSWERS="${CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS:-0}"
ARCHIVE_INTAKE="${CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE:-0}"
ALLOW_PERSISTENT_MUTATION="${CATERING_BROWSER_REHEARSAL_ALLOW_PERSISTENT_MUTATION:-0}"
DATA_ROOT_FILE="${ROOT_DIR}/.runtime/local-stack/data-root.txt"

default_pwcli="${HOME}/.codex/skills/playwright/scripts/playwright_cli.sh"

if [[ -n "${CATERING_BROWSER_CLI:-}" ]]; then
  if [[ ! -x "${CATERING_BROWSER_CLI}" ]]; then
    echo "CATERING_BROWSER_CLI ist gesetzt, aber nicht ausfuehrbar: ${CATERING_BROWSER_CLI}" >&2
    exit 2
  fi
  pwcli=( "${CATERING_BROWSER_CLI}" )
elif [[ -x "${default_pwcli}" ]]; then
  pwcli=( "${default_pwcli}" )
else
  echo "Browser-Rehearsal benoetigt die Codex-kompatible Browser-CLI mit -s/open/eval/close." >&2
  echo "Nicht gefunden: ${default_pwcli}" >&2
  echo "Setze CATERING_BROWSER_CLI auf einen kompatiblen Wrapper oder fuehre den Check in der Codex-Umgebung aus." >&2
  echo "Die oeffentliche Playwright-CLI ist kein kompatibler Fallback fuer dieses Script." >&2
  exit 2
fi

run_browser() {
  "${pwcli[@]}" -s="${SESSION_NAME}" "$@"
}

close_browser() {
  run_browser close >/dev/null 2>&1 || true
}

require_ui_shell() {
  local url="$1"
  local body

  body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS "${url}")"
  if [[ "${body}" != *'<div id="root"></div>'* || "${body}" != *'/src/main.tsx'* ]]; then
    echo "UI-App-Shell unerwartet oder nicht erreichbar: ${url}" >&2
    exit 1
  fi
}

check_current_page_markers() {
  local label="$1"
  local marker_script="$2"

  run_browser eval "${marker_script}" >/dev/null
  printf '  %s: Browser-Marker sichtbar\n' "${label}"
}

click_rehearsal_link() {
  local label="$1"
  local target_path="$2"
  local click_script="$3"
  local attempts=30

  run_browser eval "${click_script}" >/dev/null

  for _ in $(seq 1 "${attempts}"); do
    if run_browser eval "() => {
      if (location.pathname !== \"${target_path}\") {
        throw new Error(\"${label} wartet auf ${target_path}, aktuell \" + location.pathname);
      }
      return { route: location.pathname };
    }" >/dev/null 2>&1; then
      printf '  %s: Browser-Navigation nach %s bestaetigt\n' "${label}" "${target_path}"
      return 0
    fi
    sleep 0.2
  done

  run_browser eval "() => {
    throw new Error(\"${label} navigierte nicht stabil nach ${target_path}; aktuell \" + location.pathname);
  }" >/dev/null
  printf '  %s: Browser-Navigation nach %s bestaetigt\n' "${label}" "${target_path}"
}

trap close_browser EXIT

cd "${ROOT_DIR}"

if [[ "${SUBMIT_ANSWERS}" == "1" || "${ARCHIVE_INTAKE}" == "1" ]]; then
  recorded_data_root="$(cat "${DATA_ROOT_FILE}" 2>/dev/null || true)"
  if [[ "${ALLOW_PERSISTENT_MUTATION}" != "1" && "${recorded_data_root}" != *"catering-agents-rehearsal-"* ]]; then
    echo "Mutierender Browser-Rehearsal mutiert synthetische lokale Daten und erwartet einen Fresh-Run." >&2
    echo "Starte vorher: npm run local:start:fresh" >&2
    echo "Aktuelle Datenwurzel: ${recorded_data_root:-unbekannt}" >&2
    echo "Nur bewusst ueberschreiben mit CATERING_BROWSER_REHEARSAL_ALLOW_PERSISTENT_MUTATION=1." >&2
    exit 2
  fi
fi

echo "Browser-Rehearsal fuer lokalen synthetischen Kernpfad"
echo "Base URL: ${BASE_URL}"
echo "Session: ${SESSION_NAME}"
if [[ "${SUBMIT_ANSWERS}" == "1" ]]; then
  echo "Answer-Submit-Modus: aktiv (Fresh-Rehearsal-Datenroot erwartet)"
fi
if [[ "${ARCHIVE_INTAKE}" == "1" ]]; then
  echo "Archiv-Modus: aktiv (Fresh-Rehearsal-Datenroot erwartet)"
fi
echo ""

require_ui_shell "${BASE_URL}/"
require_ui_shell "${BASE_URL}/angebot"
require_ui_shell "${BASE_URL}/produktion"

run_browser open "${BASE_URL}/" >/dev/null

home_markers='() => {
  const text = document.body.innerText;
  const missing = [
    "Catering-Agenten",
    "Internes Beta-Kontrollzentrum",
    "Beta-Weg: Start → Angebot → Produktion → Rückfragen → Exporte/Audit.",
    "Rehearsal-Go: erst nach grünem Status, lokalem Check, manueller UI-Evidenz und Reibungslog.",
    "Nächster Einstieg: zuerst Angebot prüfen, danach Produktion und offene Rückfragen klären."
  ].filter((marker) => !text.includes(marker));
  const links = [...document.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));
  for (const href of ["/angebot", "/produktion"]) {
    if (!links.includes(href)) {
      missing.push(`Link fehlt: ${href}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Start-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "home-ok" };
}'

offer_markers='() => {
  const text = document.body.innerText;
  const missing = [
    "Angebotsagent",
    "Kundenanfrage einfügen und ruhigen Entwurf erzeugen",
    "Interner Beta-Schritt: Anfrage, Entwurf, Export und Übergabe bleiben nachvollziehbar.",
    "Synthetische Beta-Grenze: Entwürfe und Exporte nur intern prüfen",
    "Zur Produktion"
  ].filter((marker) => !text.includes(marker));
  const hasProductionHandoff = [...document.querySelectorAll("a")]
    .some((anchor) => anchor.getAttribute("href") === "/produktion" && (anchor.textContent ?? "").includes("Zur Produktion"));
  if (!hasProductionHandoff) {
    missing.push("Handoff-Link Zur Produktion fehlt");
  }
  if (missing.length > 0) {
    throw new Error(`Angebots-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "offer-ok" };
}'

production_markers='async () => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Was braucht die Produktion als Nächstes?",
    "Beta-Pfad: Rückfragen -> Ergebnisobjekte -> Exporte/Audit.",
    "Beta-Prüfpunkt: prüfbar, wenn Rückfragenstatus, Produktionsobjekte und Export-/Auditanker sichtbar",
    "Rückfragenstatus:",
    "Rückfragen und Antworten",
    "Produktionsobjekte und Downloads prüfen",
    "Produktionsblatt exportieren",
    "Einkaufsliste exportieren",
    "Audit-Spur",
    "Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.",
    "keine rechtssichere Audit-Behauptung"
  ].filter((marker) => !text.includes(marker));
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => anchor.getAttribute("href") ?? "");
  const buttons = [...document.querySelectorAll("button")].map((button) => ({
    text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
    disabled: button.disabled,
    title: button.getAttribute("title") ?? ""
  }));
  if (!exportLinks.some((href) => href.includes("/api/exports/v1/exports/production-plans/") && href.endsWith("/html"))) {
    missing.push("Produktionsplan-Exportlink fehlt");
  }
  if (!exportLinks.some((href) => href.includes("/api/exports/v1/exports/purchase-lists/") && href.endsWith("/csv"))) {
    missing.push("Einkaufslisten-Exportlink fehlt");
  }
  const planContext = text.match(/Plan-Kontext: planId ([^\\s]+) · specId ([^\\s]+)/);
  let currentPlanId;
  let currentPlanSpecId;
  if (!planContext) {
    missing.push("aktueller Plan-Kontext fehlt");
  } else {
    const [, planId, specId] = planContext;
    currentPlanId = planId;
    currentPlanSpecId = specId;
    const expectedPlanHref = `/api/exports/v1/exports/production-plans/${planId}/html`;
    if (!exportLinks.includes(expectedPlanHref)) {
      missing.push(`aktueller Produktionsplan-Exportlink passt nicht zu ${planId}`);
    }
    if (!text.includes(`Produktionsblatt exportieren\\nfür Plan ${planId} · Spezifikation ${specId}`)) {
      missing.push(`Produktionsplan-Exportlabel passt nicht zu ${planId}/${specId}`);
    }
    const planExportResponse = await fetch(expectedPlanHref);
    if (!planExportResponse.ok) {
      missing.push(`aktueller Produktionsplan-Export ist im Browser nicht abrufbar: ${planExportResponse.status}`);
    } else {
      const planExportBody = await planExportResponse.text();
      if (!planExportBody.includes(`Produktionsplan ${planId}`) || !planExportBody.includes(specId)) {
        missing.push(`aktueller Produktionsplan-Exportinhalt passt nicht zu ${planId}/${specId}`);
      }
    }
  }
  const purchaseContext = text.match(/purchaseListId: ([^\\s]+) · specId: ([^\\s]+)/);
  let currentPurchaseListId;
  let currentPurchaseSpecId;
  if (!purchaseContext) {
    missing.push("aktueller Einkaufslisten-Kontext fehlt");
  } else {
    const [, purchaseListId, specId] = purchaseContext;
    currentPurchaseListId = purchaseListId;
    currentPurchaseSpecId = specId;
    const expectedPurchaseHref = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
    if (!exportLinks.includes(expectedPurchaseHref)) {
      missing.push(`aktueller Einkaufslisten-Exportlink passt nicht zu ${purchaseListId}`);
    }
    if (!text.includes(`Einkaufsliste exportieren\\nfür aktuellen Vorgang ${purchaseListId} · Spezifikation ${specId}`)) {
      missing.push(`Einkaufslisten-Exportlabel passt nicht zu ${purchaseListId}/${specId}`);
    }
    const purchaseExportResponse = await fetch(expectedPurchaseHref);
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
  if (currentPlanId && currentPlanSpecId && currentPurchaseListId && currentPurchaseSpecId) {
    if (currentPlanSpecId !== currentPurchaseSpecId) {
      missing.push(`Abschluss-Kontext hat unterschiedliche Spezifikationen ${currentPlanSpecId}/${currentPurchaseSpecId}`);
    }
    const expectedHandoffContext =
      `Abschluss-Kontext: planId ${currentPlanId} · specId ${currentPlanSpecId} · purchaseListId ${currentPurchaseListId}`;
    if (!text.includes(expectedHandoffContext)) {
      missing.push("Abschluss-Kontext passt nicht zum aktuellen Plan-/Einkaufslisten-Kontext");
    }
  }
  if (text.includes("ÄLTERE EINKAUFSLISTEN") && !text.includes("Nur bei Bedarf aufklappen; ältere Listen sind kein aktueller Vorgang.")) {
    missing.push("aeltere Einkaufslisten sind nicht klar als nicht aktuell markiert");
  }
  if (text.includes("Ältere Produktionsläufe") && !text.includes("Diese früheren Produktionsläufe sind Kontext aus anderen Vorgängen, nicht das aktuelle Ergebnis.")) {
    missing.push("aeltere Produktionslaeufe sind nicht klar als nicht aktuell markiert");
  }
  const questionSummary = text.match(/Rückfragenstatus: offen (\\d+) · beantwortet (\\d+)/);
  const questionPanelSummary = text.match(/Rückfragen und Antworten\\s+offen (\\d+) · beantwortet (\\d+)/);
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
  } else if (!clearWorkspaceButton.text.includes("Plan-Kontext geladen:") || !clearWorkspaceButton.title.includes("Lokalen Arbeitsbereich leeren:")) {
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
}'

open_question_markers='async () => {
  const missing = [];
  const shouldSubmitAnswers = '"${SUBMIT_ANSWERS}"' === "1";
  const shouldArchiveIntake = '"${ARCHIVE_INTAKE}"' === "1";
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
      text.includes("Rückfragenstatus: offen 5 · beantwortet 0") &&
      text.includes("production-session-spec-demo-production-answered-clarification")
    ) {
      break;
    }
  }

  const text = document.body.innerText;
  const html = document.body.innerHTML;
  for (const marker of [
    "Nächster Schritt\\n\\nRückfragen beantworten",
    "Lunch · 42 Teilnehmer · 2026-12-16",
    "Klarheit: teilweise vollständig · Rückfragen: 5 offene Rückfragen",
    "Rückfragenstatus: offen 5 · beantwortet 0",
    "Rückfragen und Antworten\\noffen 5 · beantwortet 0",
    "ConversationSession-Projektion",
    "production-session-spec-demo-production-answered-clarification",
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
  if (html.includes("/api/exports/v1/exports/production-plans/plan-spec-demo-production-coffee/html")) {
    missing.push("Offener-Rueckfragen-Pfad zeigt alten Produktionsplan-Exportlink");
  }
  if (html.includes("/api/exports/v1/exports/purchase-lists/purchase-spec-demo-production-coffee/csv")) {
    missing.push("Offener-Rueckfragen-Pfad zeigt alten Einkaufslisten-Exportlink");
  }
  const archiveButton = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/g, " ").trim().startsWith("Fehlupload archivieren")
  );
  if (!archiveButton) {
    missing.push("Offener-Rueckfragen-Pfad ohne Fehlupload-Archiv-Aktion");
  } else {
    const archiveButtonText = (archiveButton.textContent ?? "").replace(/\s+/g, " ").trim();
    const archiveTitle = archiveButton.getAttribute("title") ?? "";
    if (archiveButton.disabled) {
      missing.push("Offener-Rueckfragen-Pfad deaktiviert Fehlupload-Archiv trotz aktivem Intake-Kontext");
    }
    if (!archiveButtonText.includes("Intake-Anfrage demo-production-answered-clarification")) {
      missing.push("Offener-Rueckfragen-Pfad bindet Fehlupload-Archiv nicht an den aktuellen Intake-Kontext");
    }
    if (
      archiveTitle !==
      "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage demo-production-answered-clarification"
    ) {
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
            "Fehlupload demo-production-answered-clarification wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
          ) &&
          archivedText.includes("Kein aktiver Vorgang") &&
          archivedText.includes("Auftrag einfügen oder Datei ablegen") &&
          !archivedText.includes("requestId: demo-production-answered-clarification")
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
      const archivedArchiveButton = archivedButtons.find((button) => button.text === "Fehlupload archivieren");
      if (
        !archivedText.includes(
          "Fehlupload demo-production-answered-clarification wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
        )
      ) {
        missing.push("Archive-Rehearsal ohne Soft-Archiv-Erfolgsmeldung");
      }
      if (!archivedText.includes("Kein aktiver Vorgang")) {
        missing.push("Archive-Rehearsal ohne leeren aktiven Vorgang nach Klick");
      }
      if (!archivedText.includes("Auftrag einfügen oder Datei ablegen")) {
        missing.push("Archive-Rehearsal ohne sichere naechste Eingabe nach Klick");
      }
      if (archivedText.includes("requestId: demo-production-answered-clarification")) {
        missing.push("Archive-Rehearsal zeigt archivierten Intake weiter als aktiven Kontext");
      }
      if (archivedText.includes("Lunch · 42 Teilnehmer · 2026-12-16")) {
        missing.push("Archive-Rehearsal zeigt archivierte Spezifikation weiter als aktiven Vorgang");
      }
      if (archivedHtml.includes("/api/intake/v1/intake/requests/demo-production-answered-clarification")) {
        missing.push("Archive-Rehearsal behaelt archivierten Intake-Detailanker im DOM");
      }
      if (!archivedArchiveButton) {
        missing.push("Archive-Rehearsal nach Klick ohne Fehlupload-Archiv-Aktion");
      } else if (
        !archivedArchiveButton.disabled ||
        archivedArchiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
      ) {
        missing.push("Archive-Rehearsal laesst Fehlupload-Archiv nach Klick aktiv oder falsch beschriftet");
      }

      location.reload();
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
      if (!reloadedArchiveButton) {
        missing.push("Archive-Rehearsal Reload ohne Fehlupload-Archiv-Aktion");
      } else if (
        !reloadedArchiveButton.disabled ||
        reloadedArchiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
      ) {
        missing.push("Archive-Rehearsal Reload laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
      }
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
  const attendeeInput = [...document.querySelectorAll("input")].find((input) =>
    input.getAttribute("placeholder") === "Teilnehmerzahl"
  );

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
    attendeeInput.value = "43";
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
        const submittedText = document.body.innerText;
        if (
          submittedText.includes("Produktionsplan wurde erzeugt.") &&
          submittedText.includes("Plan-Kontext: planId ") &&
          submittedText.includes("purchaseListId: ") &&
          submittedText.includes("Produktionsblatt exportieren") &&
          submittedText.includes("Einkaufsliste exportieren")
        ) {
          break;
        }
      }

      const submittedText = document.body.innerText;
      const submittedHtml = document.body.innerHTML;
      const submittedExportLinks = [...document.querySelectorAll("a")]
        .map((anchor) => anchor.getAttribute("href") ?? "");
      const submittedPlanContext = submittedText.match(/Plan-Kontext: planId ([^\\s]+) · specId ([^\\s]+)/);
      const submittedPurchaseContext = submittedText.match(/purchaseListId: ([^\\s]+) · specId: ([^\\s]+)/);
      let submittedPlanId;
      let submittedPlanSpecId;
      let submittedPurchaseListId;
      let submittedPurchaseSpecId;
      if (!submittedText.includes("Produktionsplan wurde erzeugt.")) {
        missing.push("Answer-Submit-Rehearsal ohne Plan-Erfolgsmeldung");
      }
      if (!submittedText.includes("Teilnehmerzahl: 43")) {
        missing.push("Answer-Submit-Rehearsal ohne gespeicherte strukturierte Teilnehmerzahl");
      }
      if (!submittedPlanContext) {
        missing.push("Answer-Submit-Rehearsal ohne aktuellen Plan-Kontext");
      } else {
        const [, planId, specId] = submittedPlanContext;
        submittedPlanId = planId;
        submittedPlanSpecId = specId;
        const expectedPlanHref = `/api/exports/v1/exports/production-plans/${planId}/html`;
        if (!submittedExportLinks.includes(expectedPlanHref)) {
          missing.push(`Answer-Submit-Rehearsal Produktionsplan-Exportlink passt nicht zu ${planId}`);
        } else {
          const planExportResponse = await fetch(expectedPlanHref);
          if (!planExportResponse.ok) {
            missing.push(`Answer-Submit-Rehearsal Produktionsplan-Export ist nicht abrufbar: ${planExportResponse.status}`);
          } else {
            const planExportBody = await planExportResponse.text();
            if (!planExportBody.includes(`Produktionsplan ${planId}`) || !planExportBody.includes(specId)) {
              missing.push(`Answer-Submit-Rehearsal Produktionsplan-Exportinhalt passt nicht zu ${planId}/${specId}`);
            }
          }
        }
      }
      if (!submittedPurchaseContext) {
        missing.push("Answer-Submit-Rehearsal ohne aktuelle Einkaufsliste");
      } else {
        const [, purchaseListId, specId] = submittedPurchaseContext;
        submittedPurchaseListId = purchaseListId;
        submittedPurchaseSpecId = specId;
        const expectedPurchaseHref = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
        if (!submittedExportLinks.includes(expectedPurchaseHref)) {
          missing.push(`Answer-Submit-Rehearsal Einkaufslisten-Exportlink passt nicht zu ${purchaseListId}`);
        } else {
          const purchaseExportResponse = await fetch(expectedPurchaseHref);
          if (!purchaseExportResponse.ok) {
            missing.push(`Answer-Submit-Rehearsal Einkaufslisten-Export ist nicht abrufbar: ${purchaseExportResponse.status}`);
          } else {
            const purchaseExportBody = await purchaseExportResponse.text();
            if (
              !purchaseExportBody.includes(
                `"group","item","normalizedQty","normalizedUnit","purchaseQty","purchaseUnit","supplierHint"`
              )
            ) {
              missing.push(`Answer-Submit-Rehearsal Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header fuer ${purchaseListId}`);
            }
          }
        }
      }
      if (submittedPlanId && submittedPlanSpecId && submittedPurchaseListId && submittedPurchaseSpecId) {
        if (submittedPlanSpecId !== submittedPurchaseSpecId) {
          missing.push(`Answer-Submit-Rehearsal Abschluss-Kontext hat unterschiedliche Spezifikationen ${submittedPlanSpecId}/${submittedPurchaseSpecId}`);
        }
        const expectedHandoffContext =
          `Abschluss-Kontext: planId ${submittedPlanId} · specId ${submittedPlanSpecId} · purchaseListId ${submittedPurchaseListId}`;
        if (!submittedText.includes(expectedHandoffContext)) {
          missing.push("Answer-Submit-Rehearsal ohne passenden Abschluss-Kontext");
        }
      }
      if (!submittedHtml.includes("/api/exports/v1/exports/production-plans/")) {
        missing.push("Answer-Submit-Rehearsal ohne Produktionsplan-Exportlink");
      }
      if (!submittedHtml.includes("/api/exports/v1/exports/purchase-lists/")) {
        missing.push("Answer-Submit-Rehearsal ohne Einkaufslisten-Exportlink");
      }
      if (submittedText.includes("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.")) {
        missing.push("Answer-Submit-Rehearsal bleibt nach Berechnung in leerem Ergebniszustand");
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Offener-Rueckfragen-Browserpfad fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "open-question-ok" };
}'

submitted_reload_markers='() => {
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
}'

production_result_reload_markers='async () => {
  const beforeText = document.body.innerText;
  const beforeHtml = document.body.innerHTML;
  const missing = [];
  const planContext = beforeText.match(/Plan-Kontext: planId ([^\\s]+) · specId ([^\\s]+)/);
  const purchaseContext = beforeText.match(/purchaseListId: ([^\\s]+) · specId: ([^\\s]+)/);
  if (!planContext) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne aktuellen Plan-Kontext");
  }
  if (!purchaseContext) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne aktuelle Einkaufsliste");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload vor Reload unsicher: ${missing.join(" | ")}`);
  }

  const [, planId, planSpecId] = planContext;
  const [, purchaseListId, purchaseSpecId] = purchaseContext;
  const planExport = `/api/exports/v1/exports/production-plans/${planId}/html`;
  const purchaseExport = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
  const handoffContext = `Abschluss-Kontext: planId ${planId} · specId ${planSpecId} · purchaseListId ${purchaseListId}`;
  if (planSpecId !== purchaseSpecId) {
    missing.push(`Produktions-Ergebnis-Reload vor Reload Abschluss-Kontext hat unterschiedliche Spezifikationen ${planSpecId}/${purchaseSpecId}`);
  }
  if (!beforeText.includes(handoffContext)) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne passenden Abschluss-Kontext");
  }
  if (!beforeHtml.includes(planExport)) {
    missing.push(`Produktions-Ergebnis-Reload vor Reload ohne Produktionsplan-Export ${planExport}`);
  }
  if (!beforeHtml.includes(purchaseExport)) {
    missing.push(`Produktions-Ergebnis-Reload vor Reload ohne Einkaufslisten-Export ${purchaseExport}`);
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload vor Reload unvollstaendig: ${missing.join(" | ")}`);
  }

  location.reload();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const text = document.body.innerText;
    const html = document.body.innerHTML;
    if (
      text.includes(`Plan-Kontext: planId ${planId} · specId ${planSpecId}`) &&
      text.includes(`purchaseListId: ${purchaseListId} · specId: ${purchaseSpecId}`) &&
      text.includes(handoffContext) &&
      html.includes(planExport) &&
      html.includes(purchaseExport)
    ) {
      break;
    }
  }

  const afterText = document.body.innerText;
  const afterHtml = document.body.innerHTML;
  if (!afterText.includes(`Plan-Kontext: planId ${planId} · specId ${planSpecId}`)) {
    missing.push("Produktions-Ergebnis-Reload verliert aktuellen Plan-Kontext");
  }
  if (!afterText.includes(`purchaseListId: ${purchaseListId} · specId: ${purchaseSpecId}`)) {
    missing.push("Produktions-Ergebnis-Reload verliert aktuelle Einkaufsliste");
  }
  if (!afterText.includes(handoffContext)) {
    missing.push("Produktions-Ergebnis-Reload verliert passenden Abschluss-Kontext");
  }
  if (!afterHtml.includes(planExport)) {
    missing.push("Produktions-Ergebnis-Reload verliert aktuellen Produktionsplan-Exportlink");
  }
  if (!afterHtml.includes(purchaseExport)) {
    missing.push("Produktions-Ergebnis-Reload verliert aktuellen Einkaufslisten-Exportlink");
  }
  if (afterText.includes("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.")) {
    missing.push("Produktions-Ergebnis-Reload faellt in leeren Ergebniszustand zurueck");
  }
  if (afterText.includes("Kein aktiver Vorgang")) {
    missing.push("Produktions-Ergebnis-Reload faellt in leeren Arbeitsbereich zurueck");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-result-reload-ok", planId, purchaseListId };
}'

clear_workspace_markers='async () => {
  const beforeText = document.body.innerText;
  const beforeHtml = document.body.innerHTML;
  const missing = [];
  const planContext = beforeText.match(/Plan-Kontext: planId ([^\\s]+) · specId ([^\\s]+)/);
  const purchaseContext = beforeText.match(/purchaseListId: ([^\\s]+) · specId: ([^\\s]+)/);
  const clearButton = [...document.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").replace(/\s+/g, " ").trim().startsWith("Arbeitsbereich lokal leeren")
  );

  if (!planContext) {
    missing.push("Clear-Check vor Klick ohne aktuellen Plan-Kontext");
  }
  if (!purchaseContext) {
    missing.push("Clear-Check vor Klick ohne aktuellen Einkaufslisten-Kontext");
  }
  if (!clearButton) {
    missing.push("Clear-Check ohne Arbeitsbereich-lokal-leeren-Aktion");
  } else if (clearButton.disabled) {
    missing.push("Clear-Check kann nicht klicken, Aktion ist deaktiviert");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal vor Klick unsicher: ${missing.join(" | ")}`);
  }

  const [, planId] = planContext;
  const [, purchaseListId] = purchaseContext;
  const planExport = `/api/exports/v1/exports/production-plans/${planId}/html`;
  const purchaseExport = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;

  if (!beforeHtml.includes(planExport)) {
    missing.push(`Clear-Check vor Klick ohne Produktionsplan-Export ${planExport}`);
  }
  if (!beforeHtml.includes(purchaseExport)) {
    missing.push(`Clear-Check vor Klick ohne Einkaufslisten-Export ${purchaseExport}`);
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
      text.includes("Kein aktiver Vorgang") &&
      text.includes("Auftrag einfügen oder Datei ablegen") &&
      !text.includes(`Plan-Kontext: planId ${planId}`) &&
      !text.includes(`purchaseListId: ${purchaseListId}`) &&
      !html.includes(planExport) &&
      !html.includes(purchaseExport)
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
  const clearedClearButton = buttons.find((button) => button.text.startsWith("Arbeitsbereich lokal leeren"));
  const clearedArchiveButton = buttons.find((button) => button.text === "Fehlupload archivieren");

  if (!afterText.includes("Kein aktiver Vorgang")) {
    missing.push("Clear-Check nach Klick ohne leeren Vorgang");
  }
  if (!afterText.includes("Auftrag einfügen oder Datei ablegen")) {
    missing.push("Clear-Check nach Klick ohne sichere naechste Eingabe");
  }
  if (afterText.includes(`Plan-Kontext: planId ${planId}`) || afterHtml.includes(planExport)) {
    missing.push(`Clear-Check nach Klick zeigt alten Produktionsplan ${planId}`);
  }
  if (afterText.includes(`purchaseListId: ${purchaseListId}`) || afterHtml.includes(purchaseExport)) {
    missing.push(`Clear-Check nach Klick zeigt alte Einkaufsliste ${purchaseListId}`);
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
  location.reload();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const text = document.body.innerText;
    const html = document.body.innerHTML;
    if (
      text.includes("Kein aktiver Vorgang") &&
      text.includes("Auftrag einfügen oder Datei ablegen") &&
      !text.includes(`Plan-Kontext: planId ${planId}`) &&
      !text.includes(`purchaseListId: ${purchaseListId}`) &&
      !html.includes(planExport) &&
      !html.includes(purchaseExport)
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
  const reloadedClearButton = reloadedButtons.find((button) => button.text.startsWith("Arbeitsbereich lokal leeren"));
  const reloadedArchiveButton = reloadedButtons.find((button) => button.text === "Fehlupload archivieren");
  if (!reloadedText.includes("Kein aktiver Vorgang")) {
    missing.push("Clear-Check Reload ohne leeren Vorgang");
  }
  if (!reloadedText.includes("Auftrag einfügen oder Datei ablegen")) {
    missing.push("Clear-Check Reload ohne sichere naechste Eingabe");
  }
  if (reloadedText.includes(`Plan-Kontext: planId ${planId}`) || reloadedHtml.includes(planExport)) {
    missing.push(`Clear-Check Reload zeigt alten Produktionsplan ${planId}`);
  }
  if (reloadedText.includes(`purchaseListId: ${purchaseListId}`) || reloadedHtml.includes(purchaseExport)) {
    missing.push(`Clear-Check Reload zeigt alte Einkaufsliste ${purchaseListId}`);
  }
  if (!reloadedClearButton) {
    missing.push("Clear-Check Reload ohne Clear-Aktion");
  } else if (
    !reloadedClearButton.disabled ||
    reloadedClearButton.title !== "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren."
  ) {
    missing.push("Clear-Check Reload laesst Clear-Aktion aktiv oder falsch beschriftet");
  }
  if (!reloadedArchiveButton) {
    missing.push("Clear-Check Reload ohne Fehlupload-Archiv-Aktion");
  } else if (
    !reloadedArchiveButton.disabled ||
    reloadedArchiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
  ) {
    missing.push("Clear-Check Reload laesst Fehlupload-Archiv aktiv oder falsch beschriftet");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Clear-Rehearsal fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-clear-ok", planId, purchaseListId };
}'

home_to_offer='() => {
  const candidates = [...document.querySelectorAll("a")];
  const link = candidates.find((anchor) =>
    anchor.getAttribute("href") === "/angebot" &&
    ((anchor.textContent ?? "").includes("Angebotsagent öffnen") ||
      (anchor.textContent ?? "").includes("Angebotsagent"))
  );
  if (!link) {
    throw new Error("Start-Link zum Angebotsagent fehlt");
  }
  link.click();
  return { clicked: link.textContent?.trim() };
}'

offer_to_production='() => {
  const candidates = [...document.querySelectorAll("a")];
  const link = candidates.find((anchor) =>
    anchor.getAttribute("href") === "/produktion" &&
    (anchor.textContent ?? "").includes("Zur Produktion")
  );
  if (!link) {
    throw new Error("Angebot-Handoff-Link zur Produktion fehlt");
  }
  link.click();
  return { clicked: link.textContent?.trim() };
}'

echo "Browser-Navigations- und Markerpruefung:"
check_current_page_markers "Start" "${home_markers}"
click_rehearsal_link "Start -> Angebot" "/angebot" "${home_to_offer}"
check_current_page_markers "Angebot" "${offer_markers}"
click_rehearsal_link "Angebot -> Produktion" "/produktion" "${offer_to_production}"
check_current_page_markers "Produktion" "${production_markers}"
check_current_page_markers "Produktion offene Rueckfragen" "${open_question_markers}"
if [[ "${ARCHIVE_INTAKE}" == "1" ]]; then
  echo ""
  echo "Browser-Rehearsal-Archivpfad bestaetigt: synthetischer aktiver Intake-Kontext wurde per Soft-Archiv aus dem Fokus genommen."
  echo "Grenze: mutierender Fresh-Rehearsal-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
  exit 0
fi
run_browser open "${BASE_URL}/produktion" >/dev/null
check_current_page_markers "Produktion Ergebnis-Kontext wiederhergestellt" "${production_markers}"
check_current_page_markers "Produktion Ergebnis-Reload stabil" "${production_result_reload_markers}"
if [[ "${SUBMIT_ANSWERS}" == "1" ]]; then
  check_current_page_markers "Produktion Submit-Reload gespeichert" "${submitted_reload_markers}"
fi
check_current_page_markers "Produktion lokal geleert" "${clear_workspace_markers}"

echo ""
echo "Browser-Rehearsal-Kernpfad bestaetigt: Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit -> lokales Leeren."
echo "Grenze: lokaler synthetischer Browser-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
