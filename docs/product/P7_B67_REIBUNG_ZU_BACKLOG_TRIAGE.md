# P7-B67 Reibung-zu-Backlog-Triage

Status: Doku-/Vertragstest-only Triage-Vorlage fuer Build Plan 7 Cycle P7-B67
Stand: 2026-05-23
Scope: Ableitung des naechsten kleinsten sicheren Produktwertblocks aus beobachteter manueller Beta-Rehearsal-Reibung; keine Produktlogik, keine neue API, keine neue Persistenz, kein Deployment, keine echten Daten

## 1. Zweck

Diese Vorlage uebersetzt Beobachtungen aus dem manuellen synthetischen Beta-Rehearsal in eine kleine Backlog-Triage:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Sie verbindet die Reibungsnotiz aus `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md`, die Managementregel aus `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md` und die Evidenzsammlung aus `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md`.

Ziel ist eine klare naechste Handlung statt einer unsortierten Wunschliste; ausdruecklich gilt: keine unsortierte Wunschliste. Die Vorlage ist kein Ticket-System, keine QA-Plattform und keine Produktfreigabe.

## 2. Eingangsdaten fuer eine Triage-Zeile

Eine Triage-Zeile darf nur aus beobachteter Reibung entstehen. Mindestangaben:

| Feld | Herkunft / Inhalt |
| --- | --- |
| Beobachtung | Titel aus P6-B58 oder kurze neutrale Zusammenfassung der Reibung. |
| Route | `Start`, `/angebot`, `/produktion`, `Rueckfragen`, `Exporte/Audit`, `local:status`, `local:check` oder `local:stop`. |
| Schweregrad | `niedrig`, `mittel`, `hoch` oder `blockierend` aus P6-B58. |
| Beleg | Sichtbarer UI-Marker, lokaler Check-Hinweis, read-only Export-/Auditbeleg oder P7-B65-Evidenznotiz; keine Rohlogs, keine echten Inhalte. |
| Naechste Entscheidung aus Reibungslog | `weiter beobachten`, `kleiner UI-/Doku-Slice moeglich`, `lokaler Blocker`, `Alexander-Entscheidung noetig` oder `blocked wegen Gate`. |
| Triage-Kategorie | Genau eine Kategorie aus Abschnitt 3. |
| Naechster kleinster Schritt | Nur der naechste kleinste sichere Produktwertblock oder ein Stop-/Entscheidungshinweis. |

## 3. Triage-Matrix

| Kategorie | Wann verwenden | Erlaubte naechste Handlung | Nicht tun |
| --- | --- | --- | --- |
| sofort kleiner Fix | Beobachtete Reibung ist konkret, lokal reproduzierbar, betrifft vorhandene Doku/UI-Copy/Smoke-Marker und beruehrt keine Gate-Entscheidung. | Einen kleinen Doku-, UI-Copy- oder fokussierten Smoke-Slice ableiten. | Keine neue Produktfaehigkeit, keine neue API, keine Persistenz, kein groesseres Refactoring. |
| spaeter | Beobachtung ist plausibel, aber nicht blockierend oder fuer den ersten Rehearsal-Durchlauf nicht entscheidend. | Als spaeteren Hinweis notieren und den aktuellen Durchlauf nicht ausweiten. | Nicht als sofortigen Featurebau tarnen. |
| Entscheidung noetig | Naechster Schritt beruehrt Produkt-, Betriebs-, Datenschutz-, Sicherheits-, Rechts-, Nutzer-, Freigabe-, API-, Persistenz-, Auth- oder Infrastrukturfragen. | Stoppen und eine Entscheidungsvorlage fuer Alexander schreiben. | Nicht implementieren, nicht durch Doku-Wording freigeben. |
| out of scope/verboten | Beobachtung verlangt echte Daten, Deployment, Secrets, Auth/OIDC, neue Persistenz/API, automatische Spec-Korrektur, Rezept-/Allergenautomatik oder LLM-/Tool-Use-/OCR-/Parser-Ausbau. | Als `blocked wegen Gate` oder `out of scope/verboten` markieren. | Keine Umgehung, keine Scheinarbeit, keine Produktfreigabe. |

## 4. Entscheidungsregel

1. Ohne beobachtete Reibung entsteht kein neuer Produktwertblock.
2. Wenn die Reibung nur Orientierung oder Dokumentauffindbarkeit betrifft, ist ein kleiner Doku-/UI-Copy-/Smoke-Slice moeglich.
3. Wenn die Reibung rote lokale Checks betrifft, ist zuerst der lokale Blocker zu klaeren; kein Feature-Weiterbau.
4. Wenn die Reibung eine Gate-Frage beruehrt, gilt `Alexander-Entscheidung noetig` oder `blocked wegen Gate`.
5. Wenn die Reibung keine klare Handlung ergibt, gilt `weiter beobachten` statt Backlog-Ausbau.

Die Triage soll den naechsten kleinsten sicheren Produktwertblock benennen, nicht mehrere parallele Aufgaben erzeugen.

## 4.1 P9-N3 Rehearsal-Reibung-zu-Entscheidung

Nach einem lokalen synthetischen Rehearsal wird jede Beobachtung zusaetzlich auf genau einen knappen Ergebnisanker verdichtet: `go`, `fix`, `blocked` oder `decision needed`. Diese Anker dienen nur der Management-/Triage-Schaerfung; sie erzeugen kein automatisches Ticket und keine Backlog- oder QA-Plattform.

| Ergebnisanker | Wann verwenden | Naechster Schritt |
| --- | --- | --- |
| `go` | go: Rehearsal-Kette widerspruchsfrei; Status, Check, manuelle UI-Routen, Evidence-Paket und Reibungslog enthalten keinen Widerspruch und kein offenes Stop-Gate. | Lokalen synthetischen Rehearsal-Stand als intern testbar notieren; keine Produktionsfreigabe ableiten. |
| `fix` | fix: klein, beobachtet, lokal reproduzierbar; betrifft nur vorhandene Doku, UI-Copy oder Smoke-/Contract-Anker und beruehrt keine Produkt-/Daten-/API-/Security-/Infra-Entscheidung. | Genau einen kleinen Doku-/Copy-/Smoke-Slice ableiten. |
| `blocked` | blocked: Stop-Gate oder rotes lokales Gate; echte Daten, Deployment, Auth/OIDC, Persistenz/API, Compliance, Sandbox/Worker/AV, Schedule-Runtime oder andere absolute Gates waeren noetig. | Stoppen, Blocker mit Beleg notieren, nicht weiterbauen. |
| `decision needed` | decision needed: bewusste Alexander-Entscheidung erforderlich; naechster Schritt ist fachlich/operativ/architektonisch moeglich, aber nicht durch Triage vorwegzunehmen. | Entscheidungsvorlage schreiben; keine echte Produkt-/Scope-Entscheidung im Cycle treffen. |

P9-N3 ersetzt nicht die Kategorien aus Abschnitt 3, sondern macht den Abschluss einer Triage-Zeile kopierbar und eindeutig: `go` / `fix` / `blocked` / `decision needed`.

## 5. Guardrails

P7-B67 bleibt strikt innerhalb des vorhandenen internen synthetischen Rehearsal-Korridors:

- keine echten Daten,
- kein Deployment,
- keine SSH-Verbindung,
- keine Secrets, Tokens, produktive `.env` oder Connection Strings,
- keine neue API,
- keine neue Persistenz,
- keine Migration und kein Prisma,
- kein OAuth/Login/OIDC und keine Session- oder Nutzerverwaltungswelt,
- keine automatische Spec-Korrektur aus Rueckfragenantworten,
- keine Rezept-/Allergenautomatik,
- kein Parser-/OCR-/LLM-/Tool-Use-Ausbau,
- keine PII/Retention/Backup- oder Sandbox/Worker/AV-Entscheidung,
- keine Produktionsfreigabe, externe Freigabe oder rechtssichere Audit-/Compliance-Aussage.

## 6. Beispiel-Triage ohne echte Daten

| Feld | Beispiel |
| --- | --- |
| Beobachtung | Nach beantworteter Rueckfrage ist der naechste manuelle Schritt unklar. |
| Route | `/produktion` / `Rueckfragen` |
| Schweregrad | `mittel` |
| Beleg | P7-B65-Evidenznotiz: `Agent fragt · beantwortet` sichtbar, Ergebnisobjekte sichtbar, aber naechster manueller Rehearsal-Schritt nicht eindeutig. |
| Naechste Entscheidung aus Reibungslog | `kleiner UI-/Doku-Slice moeglich` |
| Triage-Kategorie | sofort kleiner Fix |
| Naechster kleinster Schritt | Vorhandene UI-Copy oder Runbook-Zeile minimal schaerfen; kein neuer Workflow, keine API, keine Persistenz. |

## 7. Ergebnis von P7-B67

P7-B67 fuehrt keine Produktlogik ein. Der messbare Nutzen ist eine kleine Triage-Matrix, mit der Frau Mueller/Hans nach dem manuellen synthetischen Beta-Rehearsal aus Beobachtung, Route, Schweregrad und Beleg genau eine sichere Folgekategorie ableiten kann: sofort kleiner Fix, spaeter, Entscheidung noetig oder out of scope/verboten. Entscheidungs- und Guardrail-Themen werden sauber separiert, damit beobachtete Reibung nicht in eine unsortierte Wunschliste oder verbotenen Featurebau kippt.
