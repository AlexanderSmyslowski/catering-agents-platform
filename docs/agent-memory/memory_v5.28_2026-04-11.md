# memory snapshot

source: memory.md
version: 5.28
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: component-edit-bridge-implemented

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: konkrete Planhinweise in `recipeSelections` sind jetzt direkt an die bestehende Spezifikationsbearbeitung angeschlossen.

## Tatsaechlich umgesetzte Aenderungen
- In den komponentenbezogenen Rezeptzeilen im Bereich `recipeSelections` wurde eine kleine Action ergaenzt:
  - `Komponente bearbeiten`
- Der Klick nutzt die bereits bestehende Bearbeitungsmechanik ueber `beginSpecEdit(...)`.
- Damit springt man aus dem konkreten Planhinweis direkt in die vorhandene Spezifikationsbearbeitung.

## Betroffene Stellen
- `backoffice-ui/src/App.tsx`
  - Block `selectedPlan.recipeSelections`
  - einzelne Komponenten-/Rezeptzeile innerhalb der Plandetails
- `backoffice-ui/src/styles.css` unveraendert

## Warum der Schritt im Scope bleibt
- nur eine kleine zusaetzliche Action an einer bestehenden Zeile
- keine neue API
- keine neue Persistenz
- keine neue Logik
- kein neuer Screen
- kein neuer Workflow
- nur die bestehende Bearbeitungsmechanik direkt an den konkreten Planhinweis angeschlossen

## Einordnung
- Der Produktionsfluss wird damit nochmals handlungsfaehiger:
  - aus Operative Uebergabe in die Produktion
  - aktive Spezifikation sichtbar
  - aus Offene Punkte in die Bearbeitung
  - nach dem Bearbeiten klare Rueckkehrmarkierung
  - aus konkreten Komponenten-/Rezeptzeilen direkt in die Bearbeitung
