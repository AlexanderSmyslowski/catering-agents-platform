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

  run_browser eval "${click_script}" >/dev/null
  run_browser eval "() => {
    if (location.pathname !== \"${target_path}\") {
      throw new Error(\"${label} navigierte nach \" + location.pathname + \" statt ${target_path}\");
    }
    return { route: location.pathname };
  }" >/dev/null
  printf '  %s: Browser-Navigation nach %s bestaetigt\n' "${label}" "${target_path}"
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
  if (!planContext) {
    missing.push("aktueller Plan-Kontext fehlt");
  } else {
    const [, planId, specId] = planContext;
    const expectedPlanHref = `/api/exports/v1/exports/production-plans/${planId}/html`;
    if (!exportLinks.includes(expectedPlanHref)) {
      missing.push(`aktueller Produktionsplan-Exportlink passt nicht zu ${planId}`);
    }
    if (!text.includes(`Produktionsblatt exportieren\\nfür Plan ${planId} · Spezifikation ${specId}`)) {
      missing.push(`Produktionsplan-Exportlabel passt nicht zu ${planId}/${specId}`);
    }
  }
  const purchaseContext = text.match(/purchaseListId: ([^\\s]+) · specId: ([^\\s]+)/);
  if (!purchaseContext) {
    missing.push("aktueller Einkaufslisten-Kontext fehlt");
  } else {
    const [, purchaseListId, specId] = purchaseContext;
    const expectedPurchaseHref = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
    if (!exportLinks.includes(expectedPurchaseHref)) {
      missing.push(`aktueller Einkaufslisten-Exportlink passt nicht zu ${purchaseListId}`);
    }
    if (!text.includes(`Einkaufsliste exportieren\\nfür aktuellen Vorgang ${purchaseListId} · Spezifikation ${specId}`)) {
      missing.push(`Einkaufslisten-Exportlabel passt nicht zu ${purchaseListId}/${specId}`);
    }
  }
  if (text.includes("ÄLTERE EINKAUFSLISTEN") && !text.includes("Nur bei Bedarf aufklappen; ältere Listen sind kein aktueller Vorgang.")) {
    missing.push("aeltere Einkaufslisten sind nicht klar als nicht aktuell markiert");
  }
  if (text.includes("Ältere Produktionsläufe") && !text.includes("Diese früheren Produktionsläufe sind Kontext aus anderen Vorgängen, nicht das aktuelle Ergebnis.")) {
    missing.push("aeltere Produktionslaeufe sind nicht klar als nicht aktuell markiert");
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

echo ""
echo "Browser-Rehearsal-Kernpfad bestaetigt: Start -> Angebot -> Produktion -> Rueckfragen -> Ergebnisobjekte -> Exporte/Audit."
echo "Grenze: lokaler synthetischer Browser-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."
