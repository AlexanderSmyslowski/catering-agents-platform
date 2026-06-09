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

run_step "auth boundary (mutating route matrix)" \
  npx vitest run tests/mutating-route-auth-matrix.test.ts

run_step "service critical path rehearsal" \
  npx vitest run tests/critical-path-rehearsal.test.ts

run_step "UI critical path rehearsal" \
  npx vitest run tests/ui-critical-path-rehearsal.test.ts

run_step "data safety and audit gates" \
  npx vitest run tests/data-safety-audit-gates.test.ts

run_step "BYO LLM boundary" \
  npx vitest run tests/byo-llm-boundary.test.ts

run_step "recipe candidate review gate" \
  npx vitest run tests/recipe-candidate-review-gate.test.ts

run_step "export source metadata readability" \
  npx vitest run tests/export-source-metadata-readability.test.ts

run_step "gated dev-panel workbench flow (.test.tsx inclusion)" \
  npx vitest run tests/shared-mini-pilot-workbench-flow.test.tsx

run_step "full test suite" npm test
run_step "build" npm run build

printf '\nInternal beta gate passed for controlled internal synthetic/demo rehearsal only.\n'
printf 'This does not approve real customer data, public deployment, external customer use, or unmanaged provider calls.\n'
printf 'See docs/operations/INTERNAL_BETA_GATE.md for the full Go/No-Go scope.\n'
