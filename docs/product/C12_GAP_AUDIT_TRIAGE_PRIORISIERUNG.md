# C12 Gap-Audit-Triage und Priorisierung

Status: Doku-/Triage-only Aufbereitung von `C11_10_10_GAP_AUDIT.md`, keine Runtime-Implementierung
Stand: 2026-06-29
Scope: Ueberfuehrung der Befunde aus C11 in eine priorisierte, gate-belegte Triage-Liste; keine neue Produktlogik, keine neue API, keine Persistenz, kein Deployment, keine echten Daten

## 1. Zweck

Dieses Dokument implementiert nichts. Es uebersetzt das bestehende `C11_10_10_GAP_AUDIT.md`
in eine sortierte, entscheidungsreife Triage-Liste, damit der naechste Schritt nicht aus
einer unsortierten Wunschliste, sondern aus einer klar belegten Einordnung entsteht.

Es verbindet:

- die harte Einordnung aus `docs/product/C11_10_10_GAP_AUDIT.md` §3 und §5,
- die Triage-Taxonomie aus `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md` §3 und §4.1,
- den Priorisierungsrahmen aus `docs/product/P29_MINIMALER_INTERNE_ENTSCHEIDUNGSRAHMEN_AUSBAUPRIORISIERUNG_NACH_BEREINIGUNG_MVP_MINISPEZ.md`.

## 2. Triage-Schluessel

Jede Zeile traegt genau einen Ergebnisanker (aus P7-B67 §4.1) und genau eine Triage-Kategorie
(aus P7-B67 §3):

- Ergebnisanker: `go` / `fix` / `blocked` / `decision needed`
- Triage-Kategorie: `sofort kleiner Fix` / `spaeter` / `Entscheidung noetig` / `out of scope/verboten`

Prioritaetsskala (nur Reihenfolge der Aufmerksamkeit, kein Featurebau-Auftrag):

- P0: blockiert den ehrlichen Korridor oder einen gruenen Kernpfad sofort.
- P1: nicht-gate-pflichtig, aber erst nach beobachteter Reibung handelbar.
- P2: gate-pflichtig, braucht eine Alexander-Entscheidung, bevor irgendetwas gebaut wird.
- P3: bewusst geparkt, kein Handlungsdruck.

Harte Regel (aus P7-B67 §4 und dem aktuellen Befund "erst beobachtete Reibung"):
**Ohne beobachtete Operator-Reibung oder einen roten Gate-Befund entsteht kein neuer
Produktwertblock.** Jede `fix`-Zeile bleibt daher bis zu einer ausgefuellten Reibungsnotiz
auf `weiter beobachten`.

## 3. Priorisierte Triage-Liste

### 3.1 P0 — Korridor- und Kernpfad-Ehrlichkeit

| # | Befund (C11) | Status | Ergebnisanker | Kategorie | Gate-Beleg | Naechster kleinster Schritt |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | Interner synthetischer Rehearsal-Kern | umgesetzt + getestet | `go` | spaeter | `npm test`, `npm run build`, `npm run browser:rehearsal:full-fresh`, Main-CI | Korridor gruen halten; keine Aenderung ohne Reibung/Gate-Befund. |
| T2 | Start -> Angebot -> Produktion -> Rueckfragen -> Plan -> Einkaufsliste -> Export | umgesetzt + getestet | `go` | spaeter | Browser-Rehearsal, Route-Smokes, Produktions-Smokes | Als intern testbar belassen; keine externe Freigabe ableiten. |
| T3 | Fehlupload, Soft-Archiv, Reload, Clear, stale Ergebniszonen | umgesetzt + getestet | `go` | spaeter | Browser-Rehearsal-Modi, `tests/backoffice-production-acceptance-smoke.test.ts` | Beobachtet halten; keine Retention-/Backup-Aussage ohne Gate. |

Begruendung: T1-T3 tragen den 9/10-Stand (C11 §4). Sie sind kein Bauauftrag, sondern die
Linie, die nicht durch stille Ausweitung beschaedigt werden darf.

### 3.2 P1 — Nicht-gate-pflichtig, aber erst nach beobachteter Reibung

| # | Befund (C11) | Status | Ergebnisanker | Kategorie | Gate-Beleg | Naechster kleinster Schritt |
| --- | --- | --- | --- | --- | --- | --- |
| T4 | Ruhiges Arbeitsfenster / Produktions-UX (kleine Copy-/Marker-Schnitte) | umgesetzt fuer MVP-Korridor, verbesserbar | `fix` (gesperrt bis Reibung) | sofort kleiner Fix | UI-Komponenten, Route-/Workbench-Smokes | Warten auf ausgefuellte Reibungsnotiz; dann genau einen Doku-/Copy-/Smoke-Slice. Kein UI-Redesign. |
| T5 | Codeklarheit im Produktionskern (kleine Boundaries, `Record<string, unknown>`-Raender, `App.tsx`-Hotspot) | fortgeschritten, nicht final | `fix` (gesperrt bis Befund) | spaeter | extrahierte `App.tsx`-Boundaries, fokussierte Tests; Bericht: 321 `Record<string, unknown>`-Treffer in `backoffice-ui/src`, `App.tsx` 619 Zeilen | Kein Big-Bang-Refactor. Erst wenn Reibung oder ein konkreter Bug einen Rand trifft, einen kleinen Boundary-/Typ-Schnitt ableiten. |
| T6 | Deterministische Planung / Rezeptsuche / Einkaufsliste (weitere synthetische Faelle, Qualitaetschecks) | umgesetzt + breit getestet | `fix` (gesperrt bis Reibung) | spaeter | `production-service/src/rules/*`, `recipe-discovery/*`, Produktions-/Recipe-/Purchase-Tests | Neue synthetische Catering-Faelle nur ableiten, wenn ein Probelauf eine konkrete Luecke zeigt. |
| T7 | LLM-Readiness ohne Provider: nicht-leere Prompt-Artefakte (synthetisch, providerlos) | kleiner Vertrag bis Level-9 vorbereitet | `fix` (gesperrt bis Befund) | spaeter | 10/10-Coding-Architektur, PA26-PA40 | Nur den providerlosen, schema-only Anteil; kein Prompttext-Ausbau ohne Datenrahmen. Provider/Runtime bleiben P2. |

Begruendung: Das ist der einzige Bereich, in dem autonome Arbeit ueberhaupt zulaessig waere.
Genau hier greift der aktuelle Befund: ohne beobachtete Reibung waere das blindes Bauen.
Alle vier Zeilen bleiben deshalb auf `weiter beobachten`, bis eine Reibungsnotiz oder ein
roter Check sie konkret macht.

### 3.3 P2 — Gate-pflichtig: erst Alexander-Entscheidung, dann ggf. Bau

| # | Befund (C11) | Status | Ergebnisanker | Kategorie | Gate-Beleg / Entscheidungsvorlage | Naechster kleinster Schritt |
| --- | --- | --- | --- | --- | --- | --- |
| T8 | Conversation / echte `ConversationSession`-Runtime | teilweise umgesetzt | `decision needed` | Entscheidung noetig | `ProductionConversationProjection`; PA60 | Keine Runtime-Session bauen. PA60 als Entscheidungsvorlage offen halten. |
| T9 | LLM-Provider / Modellaufrufe oberhalb `synthetic_live` | teilweise lokal, uebergeordnet gate-pflichtig | `decision needed` | Entscheidung noetig | PA41, PA51, PA54-PA61 | Lokalen synthetic-only Korridor nicht ausweiten. Entscheidung zu Operatorrahmen, Kosten, Logging/Retention, Secrets, Datenrahmen abwarten. |
| T10 | LLM-Readiness: entscheidungsreife Provider-/Daten-/Runtime-Vorlage | offen | `decision needed` | Entscheidung noetig | PA41, PA54, PA56 | Vorlage als Entscheidungsanker behandeln; nicht in Runtime kippen. |
| T11 | Tool-Orchestrierung mit Schreibwirkung | blockiert | `blocked` | out of scope/verboten | 10/10-Coding-Architektur, Produktziel; PA59 | Keine Tool-Allowlist/Write-Pfade. Entscheidung zu Tool-Grenzen, Auth/Rollen, Audit, Human Approval erforderlich. |

### 3.4 P2 — Harte Betriebs-/Sicherheits-Gates (absolut blockiert)

| # | Befund (C11) | Status | Ergebnisanker | Kategorie | Gate-Beleg | Naechster kleinster Schritt |
| --- | --- | --- | --- | --- | --- | --- |
| T12 | Auth / OIDC / IAP / Proxy fuer echte Nutzung | dokumentiert, nicht umgesetzt | `blocked` | out of scope/verboten | B8, B9, B10, PA9, PA55 | Alexander-Entscheidung + Umsetzung erforderlich; kein Login-/Session-Code. |
| T13 | PII / Retention / Backup / Restore | dokumentiert, blockiert | `blocked` | out of scope/verboten | B13, B36, P12-N2, PA54 | Alexander-Entscheidung erforderlich; keine Persistenz-/Retention-Logik. |
| T14 | Sandbox / Worker / AV fuer echte Uploads | dokumentiert, blockiert | `blocked` | out of scope/verboten | B14, B37 | Alexander-Entscheidung erforderlich; keine Upload-Runtime. |
| T15 | Deployment / produktionsnahe echte Daten | dokumentiert, blockiert | `blocked` | out of scope/verboten | B25-B37, P12-N2 | Kein Server-/Secret-/ENV-/Echtdaten-Go. |

## 4. Verdichtung

| Ergebnisanker | Zeilen | Bedeutung fuer den naechsten Schritt |
| --- | --- | --- |
| `go` | T1, T2, T3 | Kernkorridor traegt; nur halten, nicht ausweiten. |
| `fix` (gesperrt) | T4, T5, T6, T7 | Einzige autonom denkbare Flaeche, aber bis zu beobachteter Reibung / rotem Befund gesperrt. |
| `decision needed` | T8, T9, T10 | Entscheidungsvorlagen vorhanden; warten auf Alexander. |
| `blocked` | T11, T12, T13, T14, T15 | Absolute Gates; ohne neues Go kein Code. |

Kernaussage: 11 von 15 Zeilen sind gate-gebunden (`decision needed`/`blocked`), 3 sind gruen
(`go`), und nur 4 sind ueberhaupt nicht-gate-pflichtig — und auch die sind ohne beobachtete
Reibung nicht handelbar. Damit bestaetigt die Triage den Hauptbefund: **es gibt aktuell keinen
legitimen autonomen Bauauftrag.** Der Engpass ist beobachtete Operator-Reibung, nicht
Testabdeckung oder weiterer Featurebau.

## 5. Empfohlener naechster Schritt

1. Eine reale Anfrage in einem Operator-Probelauf erfassen und die Reibungsnotiz
   (`P6_B58_BETA_REIBUNGSLOG_VORLAGE.md`) ausfuellen — das ist ein menschlicher Schritt,
   nicht autonom erzeugbar.
2. Beobachtete Reibung ueber P7-B67 in genau eine Triage-Zeile pressen und auf eine der
   P1-Zeilen (T4-T7) abbilden — falls ueberhaupt eine getroffen wird.
3. Erst dann den kleinsten sicheren Slice ableiten. Trifft die Reibung eine P2-Zeile, gilt
   `decision needed`/`blocked` und es wird eine Entscheidungsvorlage geschrieben, kein Code.

## 6. Guardrails

Dieses Dokument haelt sich strikt an den internen synthetischen Korridor: keine echten Daten,
kein Deployment, keine Secrets, keine neue API, keine neue Persistenz, kein Auth/OIDC, keine
Rezept-/Allergen-/Preis-Automatik, kein Parser-/OCR-/LLM-/Tool-Use-Ausbau, keine
Produktionsfreigabe und keine rechtssichere Audit-/Compliance-Aussage. Es ist eine Triage,
keine Freigabe.
