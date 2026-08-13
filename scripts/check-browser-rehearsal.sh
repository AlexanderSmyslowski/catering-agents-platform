#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${CATERING_BROWSER_REHEARSAL_BASE_URL:-http://127.0.0.1:3200}"
SESSION_NAME="${CATERING_BROWSER_REHEARSAL_SESSION:-cap}"
CURL_MAX_TIME_SECONDS="${CATERING_LOCAL_CURL_MAX_TIME_SECONDS:-5}"
SUBMIT_ANSWERS="${CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS:-0}"
ARCHIVE_INTAKE="${CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE:-0}"
FAILED_UPLOAD="${CATERING_BROWSER_REHEARSAL_FAILED_UPLOAD:-0}"
ALLOW_PERSISTENT_MUTATION="${CATERING_BROWSER_REHEARSAL_ALLOW_PERSISTENT_MUTATION:-0}"
DATA_ROOT_FILE="${ROOT_DIR}/.runtime/local-stack/data-root.txt"

source "${ROOT_DIR}/scripts/browser-rehearsal-shell.sh"
configure_browser_cli

trap close_browser EXIT

cd "${ROOT_DIR}"

require_fresh_mutation_scope \
  "${SUBMIT_ANSWERS}" \
  "${ARCHIVE_INTAKE}" \
  "${FAILED_UPLOAD}" \
  "${ALLOW_PERSISTENT_MUTATION}" \
  "${DATA_ROOT_FILE}"

echo "Browser-Rehearsal fuer lokalen synthetischen Kernpfad"
echo "Base URL: ${BASE_URL}"
echo "Session: ${SESSION_NAME}"
if [[ "${SUBMIT_ANSWERS}" == "1" ]]; then
  echo "Answer-Submit-Modus: aktiv (Fresh-Rehearsal-Datenroot erwartet)"
fi
if [[ "${ARCHIVE_INTAKE}" == "1" ]]; then
  echo "Archiv-Modus: aktiv (Fresh-Rehearsal-Datenroot erwartet)"
fi
if [[ "${FAILED_UPLOAD}" == "1" ]]; then
  echo "Failed-Upload-Modus: aktiv (Fresh-Rehearsal-Datenroot erwartet)"
fi
echo ""

require_ui_shell "${BASE_URL}/"
require_ui_shell "${BASE_URL}/angebot"
require_ui_shell "${BASE_URL}/produktion"

run_browser open "${BASE_URL}/" >/dev/null

home_markers="$(load_rehearsal_script "home-markers.js")"
offer_empty_markers="$(load_rehearsal_script "offer-empty-markers.js")"
offer_markers="$(load_rehearsal_script "offer-markers.js")"
production_empty_markers="$(load_rehearsal_script "production-empty-markers.js")"
production_markers="$(load_rehearsal_script "production-markers.js")"

load_rehearsal_script_with_modes() {
  local script_name="$1"
  local script

  script="$(load_rehearsal_script "${script_name}")"
  script="${script//__SUBMIT_ANSWERS__/${SUBMIT_ANSWERS}}"
  script="${script//__ARCHIVE_INTAKE__/${ARCHIVE_INTAKE}}"
  printf "%s" "${script}"
}

open_question_markers="$(load_rehearsal_script_with_modes "open-question-markers.js")"

submitted_reload_markers="$(load_rehearsal_script "submitted-reload-markers.js")"

production_result_reload_pre_markers="$(load_rehearsal_script "production-result-reload-pre-markers.js")"
production_result_reload_markers="$(load_rehearsal_script "production-result-reload-markers.js")"

archive_reload_markers="$(load_rehearsal_script "archive-reload-markers.js")"
failed_upload_markers="$(load_rehearsal_script "failed-upload-markers.js")"

clear_workspace_markers="$(load_rehearsal_script "clear-workspace-markers.js")"
clear_workspace_reload_markers="$(load_rehearsal_script "clear-workspace-reload-markers.js")"

home_to_offer="$(load_rehearsal_script "home-to-offer.js")"
open_offer_history_item="$(load_rehearsal_script "open-offer-history-item.js")"
offer_to_production="$(load_rehearsal_script "offer-to-production.js")"
open_production_history_item="$(load_rehearsal_script "open-production-history-item.js")"

echo "Browser-Navigations- und Markerpruefung:"
check_current_page_markers_at_viewports "Start" "${home_markers}"
click_rehearsal_link "Start -> Angebot" "/angebot" "${home_to_offer}"
check_current_page_markers_at_viewports "Angebot leerer Start" "${offer_empty_markers}"
check_current_page_markers "Angebot Auftrag bewusst geoeffnet" "${open_offer_history_item}"
check_current_page_markers_at_viewports "Angebot" "${offer_markers}"
click_rehearsal_link "Angebot -> Produktion" "/produktion" "${offer_to_production}"
check_current_page_markers_at_viewports "Produktion leerer Start" "${production_empty_markers}"
check_current_page_markers "Produktion Auftrag bewusst geoeffnet" "${open_production_history_item}"
check_current_page_markers_at_viewports "Produktion" "${production_markers}"
check_current_page_markers "Produktion offene Rueckfragen" "${open_question_markers}"
if [[ "${SUBMIT_ANSWERS}" == "1" ]]; then
  run_browser reload >/dev/null
  check_current_page_markers "Produktion Submit-Reload leerer Start" "${production_empty_markers}"
  check_current_page_markers "Produktion Submit-Reload gespeichert" "${submitted_reload_markers}"
  check_browser_diagnostics
  echo ""
  echo "Browser-Rehearsal-Antwortpfad bestaetigt: Lunch-Auftrag wurde auf 43 Teilnehmer aktualisiert; Produktionsplan und ehrlicher Leerzustand der Einkaufsliste bleiben nach Reload sichtbar."
  echo "Grenze: mutierender Fresh-Rehearsal-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
  exit 0
fi
if [[ "${ARCHIVE_INTAKE}" == "1" ]]; then
  run_browser reload >/dev/null
  check_current_page_markers "Produktion Archiv-Reload stabil" "${archive_reload_markers}"
  check_browser_diagnostics
  echo ""
  echo "Browser-Rehearsal-Archivpfad bestaetigt: synthetischer aktiver Intake-Kontext wurde per Soft-Archiv aus dem Fokus genommen."
  echo "Grenze: mutierender Fresh-Rehearsal-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
  exit 0
fi
run_browser reload >/dev/null
check_current_page_markers "Produktion Ergebnis leerer Reload-Start" "${production_empty_markers}"
check_current_page_markers "Produktion Ergebnis-Kontext bewusst geoeffnet" "${open_production_history_item}"
check_current_page_markers "Produktion Ergebnis-Kontext wiederhergestellt" "${production_markers}"
check_current_page_markers "Produktion Ergebnis-Reload vorbereitet" "${production_result_reload_pre_markers}"
run_browser reload >/dev/null
check_current_page_markers "Produktion Ergebnis zweiter leerer Reload-Start" "${production_empty_markers}"
check_current_page_markers "Produktion Ergebnis-Kontext erneut bewusst geoeffnet" "${open_production_history_item}"
check_current_page_markers "Produktion Ergebnis-Reload stabil" "${production_result_reload_markers}"
if [[ "${FAILED_UPLOAD}" == "1" ]]; then
  check_current_page_markers "Produktion Failed-Upload sicher" "${failed_upload_markers}"
  check_browser_diagnostics
  echo ""
  echo "Browser-Rehearsal-Fehluploadpfad bestaetigt: synthetischer nicht erlaubter Upload leert stale Produktionskontext, zeigt den Fehler und bleibt retrybar."
  echo "Grenze: mutierender Fresh-Rehearsal-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
  exit 0
fi
check_current_page_markers "Produktion lokal geleert" "${clear_workspace_markers}"
run_browser reload >/dev/null
check_current_page_markers "Produktion lokales Leeren nach Reload konsistent" "${clear_workspace_reload_markers}"

check_browser_diagnostics

echo ""
echo "Browser-Rehearsal-Kernpfad bestaetigt: Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit -> lokales Leeren."
echo "Grenze: lokaler synthetischer Browser-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
