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
  local attempts=30
  local attempt
  local last_error=""

  for attempt in $(seq 1 "${attempts}"); do
    if last_error="$(run_browser eval "${marker_script}" 2>&1)"; then
      printf '  %s: Browser-Marker sichtbar\n' "${label}"
      return 0
    fi
    if (( attempt < attempts )); then
      sleep 0.2
    fi
  done

  printf '  %s: Browser-Marker nach %s Versuchen nicht sichtbar\n' "${label}" "${attempts}" >&2
  if [[ -n "${last_error}" ]]; then
    printf '%s\n' "${last_error}" >&2
  else
    echo 'Keine konkrete CLI-/Markerfehlermeldung erhalten.' >&2
  fi
  return 1
}

check_viewport() {
  local label="$1"
  local width="$2"
  local height="$3"

  run_browser resize "${width}" "${height}" >/dev/null
  run_browser eval "() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (viewport.width !== ${width} || viewport.height !== ${height}) {
      throw new Error(\"${label} erwartet ${width}x${height}, erhalten \" + JSON.stringify(viewport));
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
      throw new Error(\"${label} hat horizontales Scrollen\");
    }
    return viewport;
  }" >/dev/null
  printf '  %s: Viewport %sx%s und keine horizontale Überbreite\n' "${label}" "${width}" "${height}"
}

check_current_page_markers_at_viewports() {
  local label="$1"
  local marker_script="$2"

  check_viewport "${label} Desktop" 1440 900
  check_current_page_markers "${label} Desktop" "${marker_script}"
  check_viewport "${label} Mobil" 390 844
  check_current_page_markers "${label} Mobil" "${marker_script}"
  check_viewport "${label} Desktop Abschluss" 1440 900
}

require_empty_console_report() {
  node -e '
    let raw = process.argv[1] ?? "";
    let report;
    try {
      report = JSON.parse(raw);
    } catch {
      report = undefined;
    }

    if (report !== undefined) {
      const keys = report && typeof report === "object" && !Array.isArray(report) ? Object.keys(report) : [];
      if (keys.length === 1 && keys[0] === "messages" && Array.isArray(report.messages)) {
        if (report.messages.length !== 0) process.exit(1);
        process.exit(0);
      }

      if (keys.length !== 1 || keys[0] !== "result" || typeof report.result !== "string") process.exit(1);
      raw = report.result;
    }

    const lines = raw.trim().split(/\r?\n/);
    const summary = lines[0]?.match(/^Total messages: ([0-9]+) \(Errors: ([0-9]+), Warnings: ([0-9]+)\)$/);
    const returned = lines[1]?.match(/^Returning ([0-9]+) messages for level "error"$/);
    if (
      lines.length !== 2 ||
      !summary ||
      !returned ||
      Number(summary[2]) !== 0 ||
      Number(returned[1]) !== 0
    ) process.exit(1);
  ' "$1"
}

require_nonempty_request_report() {
  node -e '
    let report;
    try {
      report = JSON.parse(process.argv[1] ?? "");
    } catch {
      process.exit(1);
    }

    const keys = report && typeof report === "object" && !Array.isArray(report) ? Object.keys(report) : [];
    if (keys.length === 1 && keys[0] === "requests" && Array.isArray(report.requests)) {
      const validMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"]);
      const validUrl = (value) => {
        if (typeof value !== "string" || value.length === 0 || value.trim() !== value || /\s/.test(value)) return false;
        if (value.startsWith("/")) return !value.startsWith("//");
        try {
          const parsed = new URL(value);
          return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname !== "";
        } catch {
          return false;
        }
      };
      const validRequests = report.requests.length > 0 && report.requests.every((request) => {
        if (!request || typeof request !== "object" || Array.isArray(request) || typeof request.url !== "string") return false;
        if (!validUrl(request.url)) return false;
        return request.method === undefined || (typeof request.method === "string" && validMethods.has(request.method));
      });
      if (!validRequests) process.exit(1);
      process.exit(0);
    }

    if (keys.length !== 1 || keys[0] !== "result" || typeof report.result !== "string") process.exit(1);

    const lines = report.result.replace(/\r\n/g, "\n").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    const requestLine = /^\d+\. \[(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\] https?:\/\/\S+(?: => \[\d{3}\](?: .*)?)?$/;
    const completionMarker = /^Note: [1-9][0-9]* static requests not shown, run with --static option to see them\.$/;
    const lastLine = lines[lines.length - 1];
    let requestLines = lines;
    if (completionMarker.test(lastLine ?? "")) {
      if (lines.length < 3 || lines[lines.length - 2] !== "") process.exit(1);
      requestLines = lines.slice(0, -2);
    }
    if (requestLines.length === 0 || requestLines.some((line) => !requestLine.test(line))) process.exit(1);
  ' "$1"
}

check_browser_diagnostics() {
  local console_report
  local request_report

  console_report="$(run_browser --json console error)"
  if ! require_empty_console_report "${console_report}"; then
    echo "Browser-Rehearsal meldet Konsolenfehler oder einen unlesbaren Fehlerbericht." >&2
    printf '%s\n' "${console_report}" >&2
    return 1
  fi

  request_report="$(run_browser --json requests --filter '/api/')"
  if ! require_nonempty_request_report "${request_report}"; then
    echo "Browser-Rehearsal konnte keinen API-Requestbericht lesen." >&2
    printf '%s\n' "${request_report}" >&2
    return 1
  fi
  printf '  Browser-Diagnose: keine Konsolenfehler; API-Requestbericht vorhanden\n'
}

click_rehearsal_link() {
  local label="$1"
  local target_path="$2"
  local click_script="$3"
  local attempts=30
  local attempt
  local last_error=""
  local navigation_check

  if ! last_error="$(run_browser eval "${click_script}" 2>&1)"; then
    printf '  %s: Navigationklick nach %s fehlgeschlagen\n' "${label}" "${target_path}" >&2
    if [[ -n "${last_error}" ]]; then
      printf '%s\n' "${last_error}" >&2
    else
      echo 'Keine konkrete CLI-/Navigationsfehlermeldung erhalten.' >&2
    fi
    return 1
  fi

  navigation_check="() => {
      if (location.pathname !== \"${target_path}\") {
        throw new Error(\"${label} wartet auf ${target_path}, aktuell \" + location.pathname);
      }
      return { route: location.pathname };
    }"

  for attempt in $(seq 1 "${attempts}"); do
    if last_error="$(run_browser eval "${navigation_check}" 2>&1)"; then
      printf '  %s: Browser-Navigation nach %s bestaetigt\n' "${label}" "${target_path}"
      return 0
    fi
    if (( attempt < attempts )); then
      sleep 0.2
    fi
  done

  printf '  %s: Browser-Navigation nach %s nach %s Versuchen nicht bestaetigt\n' \
    "${label}" "${target_path}" "${attempts}" >&2
  if [[ -n "${last_error}" ]]; then
    printf '%s\n' "${last_error}" >&2
  else
    echo 'Keine konkrete CLI-/Navigationsfehlermeldung erhalten.' >&2
  fi
  return 1
}

is_fresh_data_root() {
  local candidate="$1"
  local candidate_real
  local marker_path
  local marker_parent_real

  [[ "${candidate}" = /* ]] || return 1
  [[ -d "${candidate}" && ! -L "${candidate}" ]] || return 1
  [[ "${candidate}" =~ ^/.*\/catering-agents-rehearsal-[[:alnum:]]{6}$ ]] || return 1
  candidate_real="$(cd "${candidate}" && pwd -P)" || return 1
  [[ "${candidate_real}" == "${candidate}" ]] || return 1
  [[ -n "${CATERING_FRESH_OWNER_MARKER:-}" && -n "${CATERING_FRESH_RUN_TOKEN:-}" ]] || return 1
  marker_path="${candidate}/.catering-rehearsal-owner-${CATERING_FRESH_RUN_TOKEN}"
  [[ "${CATERING_FRESH_OWNER_MARKER}" == "${marker_path}" ]] || return 1
  [[ -f "${marker_path}" && ! -L "${marker_path}" ]] || return 1
  [[ "$(<"${marker_path}")" == "${CATERING_FRESH_RUN_TOKEN}" ]] || return 1
  marker_parent_real="$(cd "$(dirname "${marker_path}")" && pwd -P)" || return 1
  [[ "${marker_parent_real}" == "${candidate_real}" ]]
}

require_fresh_mutation_scope() {
  local submit_answers="$1"
  local archive_intake="$2"
  local failed_upload="$3"
  local create_offer_case="$4"
  local allow_persistent_mutation="$5"
  local data_root_file="$6"
  local recorded_data_root

  if [[ "${submit_answers}" != "1" && "${archive_intake}" != "1" && "${failed_upload}" != "1" && "${create_offer_case}" != "1" ]]; then
    return 0
  fi

  recorded_data_root="$(cat "${data_root_file}" 2>/dev/null || true)"
  if [[ "${create_offer_case}" == "1" ]] && ! is_fresh_data_root "${recorded_data_root}"; then
    echo "Synthetischer Angebotsfall darf nur unter einer Fresh-Datenwurzel angelegt werden." >&2
    echo "Starte vorher: npm run local:start:fresh" >&2
    echo "Aktuelle Datenwurzel: ${recorded_data_root:-unbekannt}" >&2
    exit 2
  fi
  if [[ "${allow_persistent_mutation}" != "1" ]] && ! is_fresh_data_root "${recorded_data_root}"; then
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
