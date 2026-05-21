# memory snapshot v5.96 – 2026-05-21

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff nach dem ersten groesseren UI-Ausbauschritt nach der Doku-Konsolidierung.

## Kernaussage
- `/angebot` zeigt jetzt eine read-only Angebots-Workbench-Projektion.
- Die Projektion zieht vorhandene Dashboard-Daten in Quellen-/Eingabe-, Verstandene-Daten-, Rueckfragen-, Ergebnisobjekt- und Export/Audit-Zonen zusammen.
- Der Schritt bleibt bewusst innerhalb des bestehenden Backoffice-UI- und Dashboard-Datenpfads.

## Scope-Grenzen
- Keine neue API.
- Keine neue Persistenz.
- Keine OAuth-/Google-/Drive-Implementierung.
- Keine Upload- oder Chat-Ausweitung.
- Keine neue Produktflaeche ausserhalb der bestehenden Route `/angebot`.

## Verifikation
- Backoffice-Praesentations-Smoke fuer die Angebots-Workbench-Projektion.
- `npm test`.
- `npm run build`.
