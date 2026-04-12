# memory snapshot

source: memory.md
version: 5.37
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-10-minimal-specrecord-adapter-cut-defined

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.10 ist der kleinste reale Implementierungsschnitt fuer den ersten internen `SpecRecord`-Adapterpfad fachlich definiert.

## Kernaussage
- Der erste echte Umsetzungsschnitt bleibt bewusst klein, intern und rein lesend/ableitend.
- Der Prototyp soll als kleine Helper-/Adapter-Funktion entstehen.
- Er soll nur aus `AcceptedEventSpec` einen minimalen `SpecRecord` ableiten.
- Noch keine neue Persistenz, keine neue API und keine neue UI.

## Konkreter erster Adapter
- vorgeschlagene Funktion:
  - `mapAcceptedEventSpecToSpecRecord(spec: AcceptedEventSpec): SpecRecord`

## Andockpunkt
- `intake-service/src/app.ts`
- nahe dem bestehenden Spec-Normalisierungs- und Speichergang
- bei den Stellen, an denen `normalizeEventRequestToSpec(...)` bereits verwendet wird
- direkt vor bzw. um `store.saveSpec(...)`

## Darf im ersten Schritt
- `AcceptedEventSpec` intern auf minimale `SpecRecord`-Form abbilden
- `id` aus `specId`
- `title` aus bestehender Spec-Label-Logik
- `status` konservativ aus `lifecycle.commercialState`
- `sourceRef` aus `sourceLineage[0].reference`
- `version` konservativ aus `schemaVersion` oder Fallback `1`
- `updatedAt` als internen Ableitungszeitpunkt setzen

## Darf noch nicht
- keine neue Persistenz
- keine neue API
- keine UI-Aenderung
- kein `OpenIssueRecord`
- keine komplexe Lifecycle- oder Verdichtungslogik
- kein Provider-State
- keine Mehrquellen-Zusammenfuehrung

## Warum risikoklein
- nur lokal im Intake-Service erreichbar
- nur `AcceptedEventSpec` als Input
- kleines Plain-Object als Output
- keine neuen Endpunkte
- keine veraenderte Antwortstruktur
- unterhalb jeder neuen Speicher- oder UI-Schicht
