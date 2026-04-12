# memory snapshot

source: memory.md
version: 5.36
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-7-minimal-specrecord-prototype-defined

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.7 ist der erste minimale Umsetzungskandidat fuer `SpecRecord` fachlich eingegrenzt.

## Kernaussage
- `SpecRecord` ist der richtige erste minimale Umsetzungskandidat.
- Der erste Prototyp soll klein, produktnah und deterministisch bleiben.
- Er soll zunaechst als interne Mapping-/Adapter-Schicht mit kleiner Record-Form andocken, nicht als neuer Persistenzkern.

## Andockpunkt
- nahe an der bestehenden produktnahen Objekt-/Handoff-Schicht
- um vorhandene Spezifikations-, Aenderungs- oder Freigabekontexte herum
- nicht im Provider
- nicht im Modellprompt
- nicht als neue UI-Schicht

## Minimalfelder fuer den ersten Prototyp
- `id`
- `title`
- `status`
- `sourceRef`
- `updatedAt`

### Optional als sechstes Feld
- `version`

## Noch nicht Teil von M1.7
- `OpenIssueRecord`
- Persistenzmigration
- neue API
- neue UI
- neuer Screen
- grosse Refactorings
- Long-Term-Verdichtung
- Provider-State als Wahrheitsquelle
- komplexe Beziehungen zu anderen Memory-Objekten
- automatische Modellverdichtung oder Resolver-Intelligenz

## Einordnung
- Der naechste sinnvolle Schritt ist jetzt nicht sofort breite Umsetzung, sondern die kleinste konkrete Prototyp-Form fuer `SpecRecord` im bestehenden Produktkontext sauber festzuziehen.
