#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${CATERING_BROWSER_REHEARSAL_BASE_URL:-http://127.0.0.1:3200}"
SESSION_NAME="${CATERING_BROWSER_REHEARSAL_SESSION:-cap}"
CURL_MAX_TIME_SECONDS="${CATERING_LOCAL_CURL_MAX_TIME_SECONDS:-5}"

default_pwcli="${HOME}/.codex/skills/playwright/scripts/playwright_cli.sh"

if [[ -n "${CATERING_BROWSER_CLI:-}" ]]; then
  pwcli=( "${CATERING_BROWSER_CLI}" )
elif [[ -x "${default_pwcli}" ]]; then
  pwcli=( "${default_pwcli}" )
else
  if ! command -v npx >/dev/null 2>&1; then
    echo "npx ist nicht verfuegbar; Browser-Rehearsal kann nicht gestartet werden." >&2
    echo "Bitte Node/npm installieren oder CATERING_BROWSER_CLI auf eine playwright-cli-kompatible CLI setzen." >&2
    exit 1
  fi
  pwcli=( npx --yes --package @playwright/cli playwright-cli )
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

check_markers() {
  local label="$1"
  local route="$2"
  local marker_script="$3"

  run_browser goto "${BASE_URL}${route}" >/dev/null
  run_browser eval "${marker_script}" >/dev/null
  printf '  %s: Browser-Marker sichtbar (%s%s)\n' "${label}" "${BASE_URL}" "${route}"
}

trap close_browser EXIT

cd "${ROOT_DIR}"

echo "Browser-Rehearsal fuer lokalen synthetischen Kernpfad"
echo "Base URL: ${BASE_URL}"
echo "Session: ${SESSION_NAME}"
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

production_markers='() => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Was braucht die Produktion als Nächstes?",
    "Beta-Pfad: Rückfragen -> Ergebnisobjekte -> Exporte/Audit.",
    "Produktionsobjekte und Downloads prüfen",
    "Produktionsblatt exportieren",
    "Einkaufsliste exportieren",
    "Audit-Spur",
    "Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.",
    "keine rechtssichere Audit-Behauptung"
  ].filter((marker) => !text.includes(marker));
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => anchor.getAttribute("href") ?? "");
  if (!exportLinks.some((href) => href.includes("/api/exports/v1/exports/production-plans/") && href.endsWith("/html"))) {
    missing.push("Produktionsplan-Exportlink fehlt");
  }
  if (!exportLinks.some((href) => href.includes("/api/exports/v1/exports/purchase-lists/") && href.endsWith("/csv"))) {
    missing.push("Einkaufslisten-Exportlink fehlt");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-ok" };
}'

echo "Route-/Markerpruefung:"
check_markers "Start" "/" "${home_markers}"
check_markers "Angebot" "/angebot" "${offer_markers}"
check_markers "Produktion" "/produktion" "${production_markers}"

echo ""
echo "Browser-Rehearsal-Kernpfad bestaetigt: Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit."
echo "Grenze: lokaler synthetischer Browser-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
