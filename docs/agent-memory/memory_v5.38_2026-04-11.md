# memory snapshot

source: memory.md
version: 5.38
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-12-specrecord-adapter-validation-added

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.12 wurde der erste interne `SpecRecord`-Adapter klein abgesichert.

## Kernaussage
- Der interne `SpecRecord`-Adapter bleibt rein intern, lesend und ohne neue API, Persistenz oder UI.
- Der kleinste passende Absicherungsschritt ist ein enger Unit-Test im bestehenden Vitest-Kontext.
- Die lokale Testausfuehrung war im Checkout noch nicht moeglich, weil `vitest` dort nicht installiert ist.

## Abgesicherte Adapter-Aspekte
- `id` aus `specId`
- `title` aus der konservativen Spezifikationsanzeige
- `status` aus `lifecycle.commercialState`
- `sourceRef` aus `sourceLineage[0].reference`
- `version`-Fallback
- `updatedAt` als gueltiger ISO-Zeitstempel

## Betroffene Dateien
- `intake-service/src/app.ts`
- `tests/platform.test.ts`

## Warum der Schritt im Scope bleibt
- Adapter bleibt intern im Intake-Service
- Test prueft nur lokale Ableitungsfunktion
- keine Endpunkte geaendert
- keine Persistenz oder Migration
- keine UI beruehrt
- `OpenIssueRecord` unangetastet

## Naechster sinnvoller Schritt
- kleine fachliche Kurzabnahme von M1.11/M1.12
- danach entweder:
  - sehr kleiner interner Nutzungsort fuer den Adapter bestimmen
  - oder zuerst Build-/Testfaehigkeit des lokalen Checkouts fuer diese Repo-Linie klaeren
