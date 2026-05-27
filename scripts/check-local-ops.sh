#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime/local-stack"
DATA_ROOT_FILE="${RUNTIME_DIR}/data-root.txt"
START_COMMAND="npm run local:start --seed-demo"
CURL_MAX_TIME_SECONDS="${CATERING_LOCAL_CURL_MAX_TIME_SECONDS:-5}"

required_sessions=(
  "catering-ui"
  "catering-intake"
  "catering-offer"
  "catering-production"
  "catering-exports"
)

required_urls=(
  "UI|http://127.0.0.1:3200/"
  "Angebot-UI|http://127.0.0.1:3200/angebot"
  "Produktion-UI|http://127.0.0.1:3200/produktion"
  "Intake|http://127.0.0.1:3101/health"
  "Angebot|http://127.0.0.1:3102/health"
  "Produktion|http://127.0.0.1:3103/health"
  "Export|http://127.0.0.1:3104/health"
)

screen_session_exists() {
  local session_name="$1"
  (screen -ls 2>/dev/null || true) | grep -q "\\.${session_name}[[:space:]]"
}

json_item_count() {
  node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  if (!Array.isArray(payload.items)) {
    process.stdout.write("0");
    return;
  }
  process.stdout.write(String(payload.items.length));
});
'
}

instruction_like_purchase_item_report() {
  local data_root="$1"
  DATA_ROOT="${data_root}" node - <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const dataRoot = process.env.DATA_ROOT;
const purchaseListDir = dataRoot ? path.join(dataRoot, "production", "purchase-lists") : "";
const findings = [];
const instructionStartPattern =
  /^(?:\d+[.)]\s*)?(?:add|bake|boil|braise|chop|combine|cook|fry|garnish|grill|heat|knead|marinate|mix|prepare|roast|season|serve|shape|slice|simmer|stir|whisk)\b/i;
const instructionPhrasePattern =
  /\b(?:and|with)\b.*\b(?:bake|boil|braise|cook|fry|grill|mix|roast|serve|shape|simmer)\b/i;

if (purchaseListDir && fs.existsSync(purchaseListDir)) {
  for (const file of fs.readdirSync(purchaseListDir).filter((name) => name.endsWith(".json")).sort()) {
    const filePath = path.join(purchaseListDir, file);
    let payload;

    try {
      payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }

    if (!Array.isArray(payload.items)) {
      continue;
    }

    for (const item of payload.items) {
      const displayName = String(item?.displayName ?? item?.articleName ?? item?.name ?? "").trim();
      if (
        displayName &&
        (instructionStartPattern.test(displayName) || instructionPhrasePattern.test(displayName))
      ) {
        findings.push({ file, displayName });
      }
    }
  }
}

const examples = findings
  .slice(0, 3)
  .map((finding) => `${finding.file}: ${finding.displayName.replace(/\s+/g, " ").slice(0, 80)}`);

process.stdout.write(`${findings.length}\n${examples.join("\n")}`);
NODE
}

for session_name in "${required_sessions[@]}"; do
  if ! screen_session_exists "${session_name}"; then
    echo "Lokaler Stack nicht vollstaendig gestartet. Bitte zuerst: ${START_COMMAND}" >&2
    exit 1
  fi
done

recorded_data_root="$(cat "${DATA_ROOT_FILE}" 2>/dev/null || true)"
requested_data_root="${CATERING_DATA_ROOT:-}"

if [[ -n "${recorded_data_root}" && -n "${requested_data_root}" && "${recorded_data_root}" != "${requested_data_root}" ]]; then
  echo "Lokaler Stack wurde mit anderer Datenwurzel gestartet: ${recorded_data_root}" >&2
  echo "local:check bekam CATERING_DATA_ROOT=${requested_data_root}." >&2
  echo "Bitte dieselbe Datenwurzel nutzen oder den Stack mit npm run local:stop kontrolliert neu starten." >&2
  exit 1
fi

data_root="${requested_data_root:-${recorded_data_root:-${ROOT_DIR}/data}}"

echo "Startweg vorhanden: ${START_COMMAND}"
echo "Lokale Datenwurzel: ${data_root}"
echo ""
echo "Statuspruefung:"
bash "${ROOT_DIR}/scripts/status-local-stack.sh"
echo ""
echo "Healthpruefung:"

for entry in "${required_urls[@]}"; do
  label="${entry%%|*}"
  url="${entry#*|}"
  code="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -sS -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || true)"
  if [[ "${code}" != "200" ]]; then
    echo "  ${label}: nicht erreichbar (${url}, HTTP ${code:-timeout})" >&2
    exit 1
  fi
  echo "  ${label}: erreichbar (${url}, HTTP 200)"
done

echo ""
echo "Erwartungsankerpruefung:"
intake_requests_url="http://127.0.0.1:3101/v1/intake/requests"
intake_requests_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS -H "x-actor-name: Intake-Mitarbeiter" "${intake_requests_url}")"
if [[ "${intake_requests_body}" != *"demo-intake-conference-lunch"* ]]; then
  echo "  Intake-Request-Check: erwarteter Demo-Request demo-intake-conference-lunch fehlt (${intake_requests_url})" >&2
  exit 1
fi
printf '  Intake-Request-Check: erreichbar (%s, enthält demo-intake-conference-lunch)\n' "${intake_requests_url}"

intake_specs_url="http://127.0.0.1:3101/v1/intake/specs"
intake_specs_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS -H "x-actor-name: Intake-Mitarbeiter" "${intake_specs_url}")"
if [[ "${intake_specs_body}" != *"spec-demo-intake-conference-lunch"* ]]; then
  echo "  Intake-Spec-Check: erwartete Demo-Spec spec-demo-intake-conference-lunch fehlt (${intake_specs_url})" >&2
  exit 1
fi
printf '  Intake-Spec-Check: erreichbar (%s, enthält spec-demo-intake-conference-lunch)\n' "${intake_specs_url}"

offer_drafts_url="http://127.0.0.1:3102/v1/offers/drafts"
offer_drafts_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS -H "x-actor-name: Angebots-Mitarbeiter" "${offer_drafts_url}")"
if [[ "${offer_drafts_body}" != *"draft-demo-offer-conference-buffet"* ]]; then
  echo "  Angebots-Check: erwarteter Demo-Entwurf draft-demo-offer-conference-buffet fehlt (${offer_drafts_url})" >&2
  exit 1
fi
printf '  Angebots-Check: erreichbar (%s, enthält draft-demo-offer-conference-buffet)\n' "${offer_drafts_url}"

production_plans_url="http://127.0.0.1:3103/v1/production/plans"
production_plans_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS -H "x-actor-name: Produktions-Mitarbeiter" "${production_plans_url}")"
if [[ "${production_plans_body}" != *"plan-spec-demo-production-coffee"* ]]; then
  echo "  Produktions-Check: erwarteter Demo-Plan plan-spec-demo-production-coffee fehlt (${production_plans_url})" >&2
  exit 1
fi
printf '  Produktions-Check: erreichbar (%s, enthält plan-spec-demo-production-coffee)\n' "${production_plans_url}"

intake_spec_count="$(printf '%s' "${intake_specs_body}" | json_item_count)"
offer_draft_count="$(printf '%s' "${offer_drafts_body}" | json_item_count)"
production_plan_count="$(printf '%s' "${production_plans_body}" | json_item_count)"

if (( intake_spec_count > 8 || offer_draft_count > 4 || production_plan_count > 8 )); then
  echo ""
  echo "Rehearsal-Datenhinweis: lokaler Datenbestand wirkt aufgefuellt (${intake_spec_count} Specs, ${offer_draft_count} Entwuerfe, ${production_plan_count} Plaene)."
  echo "Das ist kein rotes Gate, aber kein sauberer Frischlauf; UI-Evidenz und Reibungslog muessen Altlasten/Stale-Fokus beruecksichtigen."
  echo "local:check loescht oder archiviert keine lokalen Daten automatisch."
fi

instruction_like_report="$(instruction_like_purchase_item_report "${data_root}")"
instruction_like_count="${instruction_like_report%%$'\n'*}"
if [[ ! "${instruction_like_count}" =~ ^[0-9]+$ ]]; then
  instruction_like_count=0
fi

if (( instruction_like_count > 0 )); then
  echo ""
  echo "Rehearsal-Datenhinweis: lokale Einkaufslisten enthalten moegliche Rezept-Arbeitsschritte als Einkaufspositionen (${instruction_like_count} Treffer)."
  echo "Das ist kein rotes Gate, aber UI-Evidenz und Reibungslog muessen diese Altlasten ausdruecklich als lokalen Stale-Datenbefund markieren."
  echo "local:check bereinigt diese Einkaufslisten nicht automatisch; kontrollierten Frischlauf oder Soft-Archiv nur bewusst ausloesen."
  if [[ "${instruction_like_report}" == *$'\n'* ]]; then
    echo "Beispiele:"
    printf '%s\n' "${instruction_like_report#*$'\n'}" | sed 's/^/  - /'
  fi
fi

echo ""
echo "Exportpruefung:"
export_url="http://127.0.0.1:3200/api/exports/v1/exports/production-plans/plan-spec-demo-production-coffee/html"
export_anchor="Produktionsplan plan-spec-demo-production-coffee"
export_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS "${export_url}")"
if [[ "${export_body}" != *"${export_anchor}"* ]]; then
  echo "  Export-Check: unerwarteter Inhalt (${export_url})" >&2
  exit 1
fi
printf '  Export-Check: erreichbar (%s, enthält %s)\n' "${export_url}" "${export_anchor}"

offer_export_url="http://127.0.0.1:3200/api/exports/v1/exports/offers/draft-demo-offer-conference-buffet/html"
offer_export_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS "${offer_export_url}")"
if [[ "${offer_export_body}" != *"Angebot draft-demo-offer-conference-buffet"* ]]; then
  echo "  Export-Check: unerwarteter Inhalt (${offer_export_url})" >&2
  exit 1
fi
printf '  Export-Check: erreichbar (%s, enthält %s)\n' "${offer_export_url}" "Angebot draft-demo-offer-conference-buffet"

purchase_list_export_url="http://127.0.0.1:3200/api/exports/v1/exports/purchase-lists/purchase-spec-demo-production-coffee/csv"
purchase_list_export_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS "${purchase_list_export_url}")"
if [[ "${purchase_list_export_body}" != *'"group","item","normalizedQty","normalizedUnit","purchaseQty","purchaseUnit","supplierHint"'* ]]; then
  echo "  Export-Check: unerwarteter Inhalt (${purchase_list_export_url})" >&2
  exit 1
fi
printf '  Export-Check: erreichbar (%s, enthält CSV-Header)\n' "${purchase_list_export_url}"

echo ""
echo "Bootstrapp-/Auditpruefung:"
audit_url="http://127.0.0.1:3103/v1/production/audit/events?limit=200"
audit_body="$(curl --max-time "${CURL_MAX_TIME_SECONDS}" -fsS -H "x-actor-name: Betriebs-/Audit-Operator" "${audit_url}")"
if ! audit_entry="$(printf '%s' "${audit_body}" | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  if (!Array.isArray(payload.items)) {
    console.error("Audit-Feed enthaelt keine items-Liste.");
    process.exit(1);
  }

  const item = payload.items.find((entry) =>
    entry.action === "production.seed_demo" &&
    entry.entityType === "SeedBatch" &&
    entry.actor &&
    entry.actor.name === "Betriebs-/Audit-Operator"
  );

  if (!item) {
    const actions = [...new Set(payload.items.map((entry) => entry.action).filter(Boolean))].slice(0, 8);
    console.error(
      `Kein production.seed_demo-Beleg unter den letzten ${payload.items.length} Audit-Eintraegen gefunden. ` +
      `Bitte lokalen Stack kontrolliert mit npm run local:start neu seed-en. Sichtbare Aktionen: ${actions.join(", ") || "keine"}.`
    );
    process.exit(1);
  }

  if (typeof item.summary !== "string" || !item.summary.includes("Produktions-Demoplaene angelegt")) {
    console.error("production.seed_demo-Beleg hat eine unerwartete Summary.");
    process.exit(1);
  }

  if (typeof item.entityId !== "string" || !item.entityId.startsWith("production-demo-")) {
    console.error("production.seed_demo-Beleg hat eine unerwartete entityId.");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(item));
});
')"; then
  echo "  Audit-Check: erwarteter Seed-Demo-Eintrag fehlt oder ist ungueltig (${audit_url})" >&2
  exit 1
fi
printf '  Audit-Check: erreichbar (%s, enthält production.seed_demo und Betriebs-/Audit-Operator)\n' "${audit_url}"

echo ""
echo "Lokaler Betriebsweg reproduzierbar bestaetigt: Start -> Status -> Health -> Export -> Bootstrap/Audit."
echo "Rehearsal-Grenze: local:check ist nur ein lokaler Betriebs-/Seed-/Export-/Auditbeleg."
echo "Kein Rehearsal-Go ohne manuelle UI-Sichtung, Evidence-Paket und Reibungslog."
echo "Keine Produktionsfreigabe, keine echten Daten, keine rechtssichere Audit-/Compliance-Aussage."
