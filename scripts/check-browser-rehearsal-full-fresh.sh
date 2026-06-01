#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_fresh_rehearsal() {
  local label="$1"
  shift

  echo
  echo "== ${label} =="
  bash "${ROOT_DIR}/scripts/start-fresh-local-stack.sh"
  "$@"
}

echo "Vollstaendiger Fresh-Browser-Rehearsal fuer den synthetischen Produktionskern."
echo "Grenze: lokaler synthetischer Browser-Beleg; keine Produktionsfreigabe, keine echten Daten, keine Compliance-Aussage."

run_fresh_rehearsal \
  "Normaler Kernpfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Answer-Submit-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

run_fresh_rehearsal \
  "Archiv-Pfad" \
  env -u CATERING_BROWSER_REHEARSAL_SUBMIT_ANSWERS CATERING_BROWSER_REHEARSAL_ARCHIVE_INTAKE=1 \
    bash "${ROOT_DIR}/scripts/check-browser-rehearsal.sh"

echo
echo "Vollstaendiger Fresh-Browser-Rehearsal abgeschlossen."
echo "Geprueft: normaler Kernpfad, Answer-Submit-Pfad und Soft-Archiv-Pfad auf temporaeren synthetischen Datenwurzeln."
