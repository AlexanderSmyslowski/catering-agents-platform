# P2 – #712-Reconciliation gegen den P1-Updateweg

**Datum:** 2026-09-29

**Repository:** `AlexanderSmyslowski/catering-agents-platform`

**P2-Base:** `6e3d5f798165fffa6125c605c40fe8e283444023`

**Gelesener #712-Head:** `f2546468c5bce0e8f2298ee1a92c6c6da3b2ae71` (PR weiterhin offen/Draft)

## Ergebnis

P1/main bleibt führende Architektur. #712 wurde nicht gemergt oder cherry-picked. Die vollständige Reconciliation-Matrix steht in `docs/operations/CATERING_TARGET_UPDATE.md`; alle dort aufgeführten Betriebskenntnisse sind als bereits durch P1 abgedeckt, in P2 übertragen oder für den neuen Updateweg verworfen klassifiziert. Für die geforderten #712-Punkte verbleibt kein ungeklärter Reconciliation-Rest. #712 ist inhaltlich absorbiert und für den dauerhaften Updateweg nicht mehr als Codequelle erforderlich. Der PR wurde nicht geschlossen.

## P2-Änderungen

- Bundle-Manifest v3 bindet den vollständigen Source-Baum über Pfade, Dateitypen, Inhalte und normalisierte Modi zusätzlich zu Produkt-/Operationscommit, Image-IDs, Archiven, Override und Compose-Dateien.
- Stage-Export setzt Verzeichnisse unabhängig von Mac-umask auf 0755 und Dateien auf 0644 beziehungsweise 0755 für Git-ausführbare Dateien. Der Zielvalidator verlangt root:root und festgelegte Modi.
- Ein vorhandener Releasepfad wird nur read-only wiederverwendet, wenn Layout, vollständige Manifest-/Image-/Source-Bindungen und Stage-Receipt exakt passen. Teilstände, unbekannte Einträge, Modus-/Owner-Drift, abweichende Bundles sowie unvollständige Apply-Zustände enden fail-closed, ohne Löschen oder Überschreiben.
- Install-Receipt und Stage-Receipt werden semantisch getrennt. Ein passendes installiertes Release wird vor Stage-Transfer beziehungsweise Apply-Lock als `already_installed` bestätigt.
- Node-Smokekompatibilität ist über `Dockerfile.runtime` (`node:22-alpine`) belegt; der 20-Sekunden-Request-Timeout bleibt bestehen.

## Gezielte lokale Prüfung

- `python3 tests/catering_target_operator_test.py`: 43 Tests erfolgreich.
- `npx vitest run tests/catering-target-*.test.ts`: 8 Dateien, 86 Tests erfolgreich.
- Bash-Syntax, beide Smoke-Skripte mit `node --check`, drei Python-Dateien mit `py_compile` und `git diff --check`: erfolgreich.
- Keine echte SSH-, Docker-, Stage-, Apply-, Verify- oder Produktionsausführung; kein Hostkontakt, kein Hub-Writeback, kein Merge und keine P3-Arbeit.

## Bewusste Grenzen

- Installierte Manifest-v1-/v2-Releases bleiben für bestehende Receipt-/Rollbackprüfungen lesbar; neue Stage-Kandidaten verlangen Manifest v3.
- O-1 bis O-8 wurden nicht als separate Nebenbaustellen umgesetzt oder als erledigt erklärt.
- #712 bleibt offen, bis seine GitHub-Behandlung separat freigegeben ist.
