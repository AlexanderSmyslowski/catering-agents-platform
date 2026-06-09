#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

run_step() {
  local label="$1"
  shift

  printf '\n== %s ==\n' "${label}"
  "$@"
}

run_step "production dependency audit" npm audit --omit=dev
run_step "full dependency audit" npm audit

run_step "runtime and source boundary" \
  npx vitest run \
    tests/runtime-single-source.test.ts \
    tests/runtime-service-smoke.test.ts

run_step "auth boundary" \
  npx vitest run tests/mutating-route-auth-matrix.test.ts

run_step "critical product paths" \
  npx vitest run \
    tests/critical-path-rehearsal.test.ts \
    tests/ui-critical-path-rehearsal.test.ts

run_step "data safety and provider boundaries" \
  npx vitest run \
    tests/data-safety-audit-gates.test.ts \
    tests/byo-llm-boundary.test.ts

run_step "recipe and export safety" \
  npx vitest run \
    tests/recipe-research-calculation-boundary.test.ts \
    tests/recipe-candidate-review-gate.test.ts \
    tests/export-source-metadata-readability.test.ts

run_step "upload and document ingestion safety" \
  npx vitest run \
    tests/upload-security.test.ts \
    tests/pa11-intake-document-ingestion-bridge.test.ts \
    tests/document-ingestion-boundary.test.ts

run_step "full test suite" npm test
run_step "build" npm run build

printf '\nInternal beta gate passed for controlled internal synthetic/demo rehearsal only.\n'
printf 'This does not approve real customer data, public deployment, external customer use, or unmanaged provider calls.\n'
