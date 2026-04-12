# memory snapshot

source: memory.md
version: 5.34
date: 2026-04-11
repo: AlexanderSmyslowski/catering-agents-platform
status: m1-4-lifecycle-matrix-defined

## Snapshot-Zweck
Versionierter Zwischenstand fuer Handoff und Rueckgriff: in Phase M1.4 sind Lifecycle- und Source-of-Truth-Regeln fuer `SpecRecord` und `OpenIssueRecord` fachlich definiert.

## Kernaussage
- Nach Objektdefinition und Read-/Write-Regeln sind jetzt auch Lifecycle und Fuehrungsquellen geklaert.
- `SpecRecord` und `OpenIssueRecord` haben minimale, klar begrenzte Zustaende.
- Produktmomente und fachliche Ereignisse sind fuehrend, nicht Modellinterpretationen.
- Verdichtung darf nur nachziehen, nie die Wahrheit setzen.

## Minimale Lifecycle-Skizze - SpecRecord
- `angelegt`
- `aktiv`
- `in Ueberarbeitung`
- `finalisiert`
- `obsolet / ersetzt`

## Minimale Lifecycle-Skizze - OpenIssueRecord
- `eroeffnet`
- `bestaetigt`
- `in Bearbeitung`
- `geklaert`
- `zurueckgestellt`
- `erledigt`
- `verworfen / nicht mehr relevant`

## Kleine Source-of-Truth-Matrix
- neue oder geaenderte Spezifikation im Produkt -> `SpecRecord.status`, `SpecRecord.version`, `SpecRecord.updatedAt`
- bestaetigte fachliche Entscheidung -> `SpecRecord.lastDecisionId`, `SpecRecord.currentFocus`, `SpecRecord.status`
- produktnaher Handoff mit neuer Objektlage -> `SpecRecord.currentFocus`, `SpecRecord.owner`, `SpecRecord.sourceRef`
- offener fachlicher Konflikt oder Rueckfrage -> `OpenIssueRecord.status = eroeffnet`, `OpenIssueRecord.description`, `OpenIssueRecord.sourceRef`
- bestaetigte Bearbeitung eines offenen Punkts -> `OpenIssueRecord.status = in Bearbeitung`, `OpenIssueRecord.owner`
- fachliche Klaerung oder Antwort -> `OpenIssueRecord.status = geklaert`, spaeter ggf. resolution-aehnliches Feld
- bewusstes Zurueckstellen -> `OpenIssueRecord.status = zurueckgestellt`
- Abschluss eines offenen Punkts -> `OpenIssueRecord.status = erledigt`
- Ersatz durch neue Spezifikation -> `SpecRecord.status = obsolet / ersetzt`, Issues je nach Fachlage `erledigt` oder `verworfen`

## Noch nicht erlaubt
- automatische Zustandswechsel nur aus Prompt-Sprache
- providerseitige Schaetzungen als Truth-Source
- modellische Erkennung impliziter offener Punkte ohne reale Produktgrundlage
- automatische Vererbung von Fokus oder Status ueber Session-Grenzen ohne klaren Produktmoment
- automatische Verdichtung als Ersatz fuer deterministischen Zustand
- heuristische `wahrscheinlich geklaert`- oder `wahrscheinlich ersetzt`-Uebergaenge
- stille Lifecycle-Spruenge ohne explizites fachliches Ereignis

## Scope-Grenzen
- nur Lifecycle- und Source-of-Truth-Regeln festlegen
- keine Implementierung
- keine neue API
- keine Persistenzmigration
- keine neue UI
- kein neuer Screen
- keine grossen Refactorings
- keine Provider-Abhaengigkeit als Primaerquelle
- keine Long-Term-Verdichtung vorziehen
- nur `SpecRecord` und `OpenIssueRecord` im Fokus
