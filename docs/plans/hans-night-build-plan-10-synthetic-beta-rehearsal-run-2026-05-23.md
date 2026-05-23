# Hans Night Build Plan 10 — Synthetic Beta Rehearsal Run

Datum: 2026-05-23  
Status: vorbereitet fuer ueberwachten Anschlusslauf nach Plan 9  
Repo: `AlexanderSmyslowski/catering-agents-platform`

## Ausgangslage

Plan 8 ist abgeschlossen: die Zeitfenster-/Schedule-Linie bleibt bewusst Option A, also eine manuelle Copy-/Anleitungsnotiz ohne Datenmodell-, API-, Persistenz-, Runtime-Schedule- oder automatische Spec-Korrektur.

Plan 9 ist abgeschlossen: der lokale synthetische Rehearsal-Nachweis ist klarer an Status, lokalen Check, manuelle UI-Evidenz, Export-/Auditbelege und Reibungslog gebunden. Die Full Gates waren lokal gruen; CI konnte lokal nicht ueber `gh` verifiziert werden, weil GitHub CLI nicht authentifiziert ist.

Der naechste kleinste sinnvolle Schritt ist jetzt kein weiterer abstrakter Doku-Ausbau, sondern ein kontrollierter **synthetischer Beta-Rehearsal-Durchlauf** entlang `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` mit vorhandenen Demo-/Fixture-Daten. Ziel ist echte beobachtete Reibung aus dem bestehenden Produktstand, nicht Scheinarbeit.

## Management-Ziel

Hans soll einen lokalen, synthetischen Durchlauf als Evidenzpaket ausfuehren bzw. nachvollziehbar protokollieren:

- lokaler Stack-/Status- und Betriebscheck werden als Startsignal geprueft;
- die vorhandenen UI-Routen `/`, `/angebot`, `/produktion` werden mit den Plan-9-Rehearsal-Grenzen betrachtet;
- Export-/Auditanker werden read-only geprueft;
- beobachtete Reibung wird nach `go`, `fix`, `blocked`, `decision needed` triagiert;
- nur wenn eine enge, beobachtete, scope-sichere Reibung ohne Stop-Gate vorliegt, darf genau ein kleiner Fix erfolgen;
- echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, neue Persistenz/API und automatische Spec-Korrektur bleiben gesperrt.

## Absolute Stop-Gates

Sofort stoppen und Bericht schreiben bei Bedarf fuer:

- Deployment, Hetzner, SSH, Secrets oder produktive Konfiguration;
- echte Kunden-/Personen-/Mitarbeiterdaten oder produktionsnahe Nutzung;
- neue Persistenz, Prisma, Migration, neue Tabellen oder Datenbankumbau;
- neue API-Endpunkte oder veraenderte API-Vertraege;
- OAuth/Login/OIDC/Session/Auth-Ausbau;
- rechtliche/Compliance-/DSGVO-/Retention-/Backup-Entscheidung;
- rote CI, die nicht eng reproduzierbar und minimal fixbar ist;
- grosse Produkt-/Scope-/Architekturentscheidung;
- Multi-Tenant/White-Label/Plattformausbau;
- Runtime-Schedule-/Zeitfenster-Modell, automatische Spec-Korrektur, Rezept-/Allergenautomatik.

`tmp/` bleibt bekannt untracked und wird nicht beruehrt.

## Nachtlauf-Protokoll

- Immer nur ein Hans-Runner gegen dieses Repo.
- Jeder Cycle schreibt einen Lagebericht nach `/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/`.
- Jeder Cycle arbeitet am realen Repo-Iststand und liest `memory.md`, `AGENTS.md`, `HANDOFF_PROMPT.md`, `README.md` sowie diesen Plan.
- Kein Code-/Doku-Fix ohne beobachtete Reibung und engen Scope.
- Commit/Push nur bei gruenen Gates und sauberem Status abgesehen vom bekannten untracked `tmp/`.
- Push mit `HOME=/Users/alexandersmyslowski git push origin main`.
- CI nach Push pruefen, sofern `gh`/Token verfuegbar ist; wenn nicht, klar als nicht pruefbar kennzeichnen.
- Keine Fortsetzung ueber rote CI hinweg.

## Cycle Queue

### P10-N1 — Rehearsal-Startsignal und lokaler Iststand

Ziel: Den realen lokalen Iststand fuer den synthetischen Rehearsal-Durchlauf hart pruefen.

Pflicht:
- `git status --short --branch`, letzter HEAD und relevante Reports lesen;
- `npm run local:status` und `npm run local:check` ausfuehren;
- wenn der lokale Stack nicht erreichbar ist, nur den bestehenden lokalen Demo-Weg `npm run local:start` nutzen und danach erneut Status/Check pruefen;
- keine Deployment-, SSH-, Secret- oder echte Daten-Aktion.

Ergebnis: Bericht mit Startsignal `go`, `fix`, `blocked` oder `decision needed`.

### P10-N2 — UI-Rehearsal-Evidenz Start -> Angebot -> Produktion

Ziel: Die vorhandenen UI-Routen mit synthetischen/Demo-Daten nachvollziehen und sichtbare Rehearsal-Marker dokumentieren.

Pflicht:
- `/`, `/angebot`, `/produktion` lokal pruefen, bevorzugt mit vorhandenen Browser-/Smoke-/DOM-Mitteln;
- sichtbare Marker fuer Beta-Korridor, Rehearsal-Go-Grenze, Angebot, Produktion, Rueckfragen, Ergebnisobjekte und Exporte/Audit sammeln;
- keine freien echten Eingaben, keine personenbezogenen Daten, keine neue UI-Flaeche.

Ergebnis: Evidenznotiz und Reibungslog-Entwurf.

### P10-N3 — Export-/Audit-Evidenz read-only pruefen

Ziel: Bestehende Export- und Auditanker im lokalen synthetischen Korridor read-only verifizieren.

Pflicht:
- vorhandene read-only Exportpfade und Audit-/Herkunftsanker aus `local:check`, C8, P7-B65 und P9-N1 gegen den laufenden lokalen Stack pruefen;
- keine neuen Exportvertraege, keine API-Aenderung, keine rechtssichere Audit-Behauptung;
- Option-A-Zeitfenstergrenze sichtbar halten: Export-/Auditbelege beweisen keine strukturierte Schedule-Loesung.

Ergebnis: Export-/Audit-Evidence mit `go`, `fix`, `blocked` oder `decision needed`.

### P10-N4 — Beobachtete Reibung triagieren und ggf. ein enger Fix

Ziel: Aus P10-N1 bis P10-N3 nur echte beobachtete Reibung bearbeiten.

Erlaubt:
- genau ein kleiner Fix, wenn er eng reproduzierbar, lokal testbar und ohne Stop-Gate ist;
- typische erlaubte Fixes: Copy-/Marker-Klarstellung, Test-/Runbook-Anker, kleine bestehende UI-Lesbarkeitskorrektur.

Nicht erlaubt:
- neue Produktflaeche, neue API, Persistenz/Migration, Runtime-Schedule, automatische Spec-Korrektur, Auth/OIDC, Deployment, echte Daten.

Wenn kein sicherer Fix vorliegt: no-product-change berichten.

### P10-N5 — Abschlussgate / Evidence-Paket / Management-Lage

Ziel: Plan 10 sauber abschliessen und entscheiden, ob Plan 11 ein weiterer kleiner Fix aus beobachteter Reibung sein kann oder ob ein echter Stop-/Entscheidungspunkt erreicht ist.

Pflicht:
- fokussierte Tests/Smokes passend zu Aenderungen;
- bei jeder Aenderung: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`;
- bei lokalem Betriebs-/UI-Bezug: `npm run local:status` und `npm run local:check`;
- Memory-Snapshot, falls sich der Projektstand relevant aendert;
- CI fuer letzten Push pruefen, sofern technisch moeglich.

## Erfolgskriterium

Plan 10 ist erfolgreich, wenn ein realer synthetischer Beta-Rehearsal-Durchlauf entlang `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` mit vorhandenen lokalen Mitteln belegbar ist, beobachtete Reibung ehrlich triagiert wurde und keine Stop-Gates verletzt wurden. Falls keine weitere sichere Mikroumsetzung moeglich ist, muss die Lage als Entscheidungspunkt fuer Alexander ausgewiesen werden statt weiter Scheinarbeit zu erzeugen.
