#!/usr/bin/env bash

configure_browser_cli() {
  local default_pwcli="${HOME}/.codex/skills/playwright/scripts/playwright_cli.sh"

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
}

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

require_fresh_mutation_scope() {
  local submit_answers="$1"
  local archive_intake="$2"
  local failed_upload="$3"
  local allow_persistent_mutation="$4"
  local data_root_file="$5"
  local recorded_data_root

  if [[ "${submit_answers}" != "1" && "${archive_intake}" != "1" && "${failed_upload}" != "1" ]]; then
    return 0
  fi

  recorded_data_root="$(cat "${data_root_file}" 2>/dev/null || true)"
  if [[ "${allow_persistent_mutation}" != "1" && "${recorded_data_root}" != *"catering-agents-rehearsal-"* ]]; then
    echo "Mutierender Browser-Rehearsal mutiert synthetische lokale Daten und erwartet einen Fresh-Run." >&2
    echo "Starte vorher: npm run local:start:fresh" >&2
    echo "Aktuelle Datenwurzel: ${recorded_data_root:-unbekannt}" >&2
    echo "Nur bewusst ueberschreiben mit CATERING_BROWSER_REHEARSAL_ALLOW_PERSISTENT_MUTATION=1." >&2
    exit 2
  fi
}

load_rehearsal_script() {
  local script_name="$1"

  cat "${ROOT_DIR}/scripts/browser-rehearsal/${script_name}"
}
