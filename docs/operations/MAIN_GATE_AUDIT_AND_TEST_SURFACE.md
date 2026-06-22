# Main Gate Audit and Test Surface

Stand: 2026-06-22, Branch `hardening/main-gate-audit-and-test-surface`.

## Befund

Auf aktuellem `origin/main` (`92259af`) war die Test-Suite gruen, aber das interne Beta-Gate blockiert:

- `npm test`: 256 Testdateien / 1077 Tests gruen
- `npm run build`: gruen
- `npm audit --omit=dev`: rot
- `npm audit`: rot
- `bash scripts/check-internal-beta-gate.sh`: rot im Production-Audit-Schritt

Audit-Ursache waren Build-/Test-Tooling-Pfade:

| Paket | Severity | Pfad | Fix |
| --- | --- | --- | --- |
| `vite` | high | direkte Dependency | `7.3.3` -> `7.3.5` |
| `@babel/core` | low | via `@vitejs/plugin-react` | Override auf `7.29.7` |
| `esbuild` | low | via `vite` und `tsx` | `tsx` auf `4.22.4`, Override auf `0.28.1` |
| `ws` | high | via `jsdom` | Override auf `8.21.0` |

## Testzahl

Die aktuelle Zahl 256 ist keine Vitest-Discovery-Regression:

- `vitest.config.ts` enthaelt `tests/**/*.test.ts` und `tests/**/*.test.tsx`.
- `tests/shared-mini-pilot-workbench-flow.test.tsx` wird von `npm test` ausgefuehrt.
- `git ls-files` zaehlt aktuell 255 `.test.ts` plus 1 `.test.tsx`.
- Commit `a511808` entfernte 73 reine Dokumentations-Contract-Tests: von 323 auf 250 Testdateien.
- Seitdem kamen 6 produktnahe Testdateien hinzu: aktueller Stand 256.

Die hoehere Zahl aus frueheren PRs beschreibt den Stand vor der Prozess-Artefakte-Bereinigung, nicht eine aktuelle lokale Auslassung.
