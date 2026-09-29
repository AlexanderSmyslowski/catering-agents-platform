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
- `apply` klassifiziert den Releasezustand nach Lock-Erwerb erneut, bevor es `previous-images.json` schreibt oder Images lädt. Eine inzwischen identisch installierte Version ist nach Receipt-/Aktivmarkerprüfung ein No-op; ein Teil-/Driftzustand wird vor Aktivierung abgewiesen und der Lock freigegeben.
- Ein fehlgeschlagener SSH-Unlock propagiert seinen Exitstatus und lässt `LOCK_HELD` gesetzt; der Prozess meldet manuelle Wiederherstellung und behauptet weder einen erfolgreichen No-op noch eine freigegebene Sperre.
- Die rsync-SSH-Invocation enthält dieselben Keepalive-Optionen wie direkter SSH-Transport. Der dateibasierte Smoke behält den 20-Sekunden-Request-Timeout und wird als `node --input-type=module -e` ausgeführt. Das Runtime-Image deklariert `node:22-alpine`; es wurde kein Smoke in diesem Image ausgeführt.
- Postflight, Gesamt-Health, Health je Service und Auth-Smoke liefern nicht-sensitive `TARGET_UPDATE_STAGE`- und `TARGET_AUTH_SMOKE_STAGE`-Marker. Der Exporttest prüft die Modusbits des exportierten Executables; ein gezielter Schema-v2-Installations-/Rollbacktest bewahrt die Receipt-Kompatibilität.

## Gezielte lokale Prüfung

- `python3 tests/catering_target_operator_test.py`: 44 Tests erfolgreich.
- `npx vitest run tests/catering-target-*.test.ts`: 8 Dateien, 92 Tests erfolgreich.
- `bash -n platform-infra/scripts/catering-target-production-update.sh`, `node --check platform-infra/scripts/catering-target-operator-smoke.mjs`, AST-Parse der drei Python-Operator-Skripte und `git diff --check`: erfolgreich.
- Keine echte SSH-, Docker-, Stage-, Apply-, Verify- oder Produktionsausführung; kein Hostkontakt, kein Hub-Writeback, kein Merge und keine P3-Arbeit.

## Bewusste Grenzen

- Installierte Manifest-v1-/v2-Releases bleiben für bestehende Receipt-/Rollbackprüfungen lesbar; neue Stage-Kandidaten verlangen Manifest v3.
- O-1 bis O-8 wurden nicht als separate Nebenbaustellen umgesetzt oder als erledigt erklärt.
- #712 bleibt offen, bis seine GitHub-Behandlung separat freigegeben ist.

## P2.1 – Abschluss des Retry-Befunds I-1

Der unabhängige Review von P2-Head `ca287f09b7e584bc928ffe3c827dbd71410a86cf` fand, dass ein nach `candidate_rejected` oder sauberem Rollback zurückgebliebenes `previous-images.json` ohne Install-Receipt zuvor pauschal als unvollständiger Apply-Zustand abgelehnt wurde. Damit war die damalige allgemeine Wiederverwendungsformulierung zu weit.

Nach P2.1 darf ein solcher Releasepfad nur als Retry-Stage wiederverwendet werden, wenn Install-Receipt fehlt, der Kandidat nicht aktiv ist und Stage-Receipt, Manifest, beide Commits, Image-/Archiv-/Override-/Compose-/Tool-/Source-Tree-Bindungen, erwartetes Layout, `previous-images.json`-Form, Ownership und Modi exakt passen. Unbekannte oder widersprüchliche Zustände bleiben fail-closed; nichts wird automatisch gelöscht.

Bei jedem neuen Apply bindet der Operator den tatsächlichen Vorgänger erneut aus dem unter Lock gelesenen aktiven Release. `previous-images.json` wird vor dem Image-Load atomar aus den zu diesem Zeitpunkt laufenden Containern neu geschrieben und ist für den gebundenen Operator keine Rollback-Autorität. Ein gültiges Install-Receipt bleibt ein eigener `already_installed`-Zustand; ein aktiver Kandidat ohne gültiges Install-Receipt wird abgewiesen.

Scheitert der Remote-Preflight wegen eines aktiven Kandidaten ohne Install-Receipt erst nach Lock-Erwerb, bleibt der Lock zur manuellen Recovery erhalten.

Mit dem funktional und dokumentarisch geschlossenen I-1 gilt die Reconciliation-Abschlussaussage für den dauerhaften Updateweg; #712 bleibt offen und wurde weder gemergt noch geschlossen. M-1 bis M-4 bleiben sichtbar für P3/Betriebsrehearsal. Kein Hostkontakt oder Deployment.

Gezielte lokale Prüfung für P2.1: 46 Tests in `tests/catering_target_operator_test.py`, 97 Tests in 8 Catering-Target-Vitest-Dateien, Bash-Syntax, Python-AST und `git diff --check` erfolgreich. Keine reale SSH-, Docker-, Stage-, Apply-, Verify- oder Produktionsausführung.
