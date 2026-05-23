# Hans Night Build Plan 11 — Internal Pilot Preflight Without Real Data

Datum: 2026-05-24  
Status: vorbereitet fuer ueberwachten Anschlusslauf nach Plan 10 und Option-A-Entscheidung  
Repo: `AlexanderSmyslowski/catering-agents-platform`

## Ausgangslage

Plan 10 ist abgeschlossen und lokal/synthetisch gruen: `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` ist mit Demo-/Seed-/synthetischen Daten belegbar. Es gab keinen kleinen scope-sicheren Produktfix; die einzige echte Produktentscheidung war die bekannte Schedule-/Zeitfensterfrage. Diese wurde nach Plan 10 bewusst entschieden: **Option A bleibt fuer den internen Beta-MVP fuehrend**. Das verbindliche Zeitfenster bleibt manuelle Rehearsal-/Klaerungsnotiz; keine Runtime-Schedule-Loesung, keine neue API, keine Persistenz/Migration, keine automatische Spec-Korrektur.

Alexanders neue Steuerung fuer die Nacht lautet: weiterarbeiten, neue Plaene entwerfen und ohne Routinefreigabe durchziehen, solange keine echten Stop-Gates beruehrt werden. Plan 11 ist deshalb kein Schedule-Featurebau und kein Deployment, sondern der naechste sichere Produktfortschritt: ein begrenzter **interner Pilot-Preflight** fuer anonymisierte/synthetische Daten, der die App naeher an 10/10 interne Nutzbarkeit bringt, ohne die gesperrten Realbetriebsgates zu ueberschreiten.

## Management-Ziel

Hans soll den Uebergang vom synthetisch gruenen Rehearsal zu einem begrenzten internen Pilot-Preflight vorbereiten:

- klaeren, was fuer einen internen Pilot mit anonymisierten/synthetischen Daten heute wirklich `go`, `not assessed`, `blocked` oder `decision needed` ist;
- den sicheren Pilot-Datenkorridor ohne echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten definieren;
- pruefen, ob vorhandene UI-/Runbook-/Smoke-Anker fuer einen internen Tester eindeutig genug sind;
- nur bei beobachteter enger Reibung genau einen kleinen Copy-/Doku-/Smoke-/bestehenden UI-Lesbarkeitsfix umsetzen;
- nach gruenem Abschluss automatisch den naechsten Plan ableiten, sofern kein Stop-Gate erreicht ist.

## Absolute Stop-Gates

Sofort stoppen und Bericht schreiben bei Bedarf fuer:

- Deployment, Hetzner, SSH, Secrets, produktive `.env`, Domains, TLS, Proxy/IAP-Konfiguration;
- echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahe Pilotdaten;
- neue Persistenz, Prisma, Migration, neue Tabellen, Datenbankumbau;
- neue API-Endpunkte oder veraenderte API-Vertraege;
- OAuth/Login/OIDC/Session/Nutzerverwaltung;
- PII/Retention/Backup-Entscheidung;
- Sandbox/Worker/AV-Entscheidung fuer echte oder beliebige Uploads;
- rechtliche/Compliance-/DSGVO-/Signatur-/Export-Verbindlichkeitsentscheidung;
- rote CI, die nicht eng reproduzierbar und minimal fixbar ist;
- grosse Produkt-/Scope-/Architekturentscheidung;
- Multi-Tenant/White-Label/Plattformausbau;
- Runtime-Schedule-/Zeitfenster-Modell, automatische Spec-Korrektur, Rezept-/Allergenautomatik.

`tmp/` bleibt bekannt untracked und wird nicht beruehrt.

## Nachtlauf-Protokoll

- Immer nur ein Hans-Runner gegen dieses Repo.
- Jeder Cycle schreibt einen Lagebericht nach `/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/`.
- Jeder Cycle arbeitet am realen Repo-Iststand und liest `memory.md`, `AGENTS.md`, `HANDOFF_PROMPT.md`, `README.md`, Plan 10, den Option-A Decision Record und diesen Plan.
- Kein Code-/Doku-Fix ohne beobachtete Reibung und engen Scope.
- Commit/Push nur bei gruenen Gates und sauberem Status abgesehen vom bekannten untracked `tmp/`.
- Push mit `HOME=/Users/alexandersmyslowski git push origin main`.
- CI nach Push pruefen; wenn nicht technisch moeglich, klar kennzeichnen.
- Keine Fortsetzung ueber rote CI hinweg.

## Cycle Queue

### P11-N1 — Baseline und Pilot-Preflight-Iststand

Ziel: Den realen Stand nach Plan 10 und Option-A-Entscheidung hart pruefen und als Pilot-Preflight-Ausgangspunkt festhalten.

Pflicht:
- `git status --short --branch`, letzter HEAD, GitHub-CI fuer letzten Push, Plan-10-Berichte und `docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md` lesen;
- `npm run local:status` und `npm run local:check` ausfuehren;
- wenn der lokale Stack nicht erreichbar ist, nur den bestehenden Demo-Weg `npm run local:start` nutzen und erneut pruefen;
- keine Deployment-, SSH-, Secret- oder echte Daten-Aktion.

Ergebnis: Bericht mit Baseline `go`, `fix`, `blocked` oder `decision needed`.

### P11-N2 — Pilot-Datenkorridor anonymisiert/synthetisch

Ziel: Den erlaubten Pilot-Datenkorridor so konkret machen, dass ein interner Tester nicht versehentlich echte Daten nutzt.

Erlaubt:
- Doku-/Vertragstest-only Anker fuer anonymisierte/synthetische Daten, Beispielwerte, No-go-Daten und Stop-Regeln;
- vorhandene P6/P7/P9/C8/B24/B25-B31-Dokumente verlinken statt neue Plattform bauen;
- Vertragstest, der die konservative Trennung schuetzt.

Nicht erlaubt:
- Speicherung echter Daten, neue Testdatenplattform, Reset-/Seeder-Feature, neue API/Persistenz, Deployment/Auth.

Ergebnis: Pilot-Datenkorridor mit klarer Bewertung `go` fuer synthetisch/anonymisiert, `blocked` fuer echte/produktive Daten.

### P11-N3 — Interner Pilot-Preflight-Runbookanker

Ziel: Einen knappen, praktisch nutzbaren Preflight-Weg fuer einen begrenzten internen Pilot ohne Deployment formulieren.

Pflicht:
- Starten, Status, UI-Routen, Reibungslog, Export-/Auditbelege und kontrolliertes Stoppen als Schritte ordnen;
- sichtbar trennen: lokaler interner Pilot-Preflight vs. produktionsnaher Pilot vs. Deployment;
- Schedule Option A als manuelle Zeitfensterklaerung aufnehmen.

Ergebnis: Runbook-/Checklistenanker, idealerweise testgesichert.

### P11-N4 — Bestehende UI-/Smoke-Lesbarkeit fuer Pilot-Preflight pruefen und ggf. ein enger Fix

Ziel: Aus P11-N1 bis P11-N3 pruefen, ob ein interner Tester im bestehenden UI-/Smoke-Korridor die Pilotgrenzen versteht.

Erlaubt:
- genau ein kleiner Copy-/Marker-/bestehender UI-Lesbarkeitsfix oder ein enger Smoke-/Vertragstest, wenn Reibung konkret beobachtet wurde;
- kein Fix, wenn die Reibung nur eine echte Entscheidung waere.

Nicht erlaubt:
- neue Produktflaeche, neuer Workflow, neue Fachlogik, API, Persistenz/Migration, Auth/OIDC, Deployment, echte Daten.

Ergebnis: `fix` mit Gates oder `no-product-change`.

### P11-N5 — Abschlussgate, Memory-Snapshot, 10/10-Lage

Ziel: Plan 11 sauber abschliessen und aus Managementsicht bewerten, ob die App fuer den internen Pilot-Preflight naeher an 10/10 gekommen ist.

Pflicht:
- fokussierte Tests/Smokes passend zu Aenderungen;
- bei jeder Aenderung: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`;
- bei lokalem Betriebs-/UI-Bezug: `npm run local:status` und `npm run local:check`;
- Memory-Snapshot, falls sich der Projektstand relevant aendert;
- CI fuer letzten Push pruefen;
- trennen: umgesetzt, nur dokumentiert, offen, durch Alexander/extern zu entscheiden.

### P11-N6 — Plan-12-Ableitung oder bewusster Stop

Ziel: Nach gruenem Plan 11 nicht in Leerlauf fallen.

Pflicht:
- Wenn Plan 11 gruen ist und kein Stop-Gate beruehrt wurde: einen kleinen Plan 12 als naechsten echten Bottleneck ableiten, in `docs/plans/` schreiben, commiten/pushen und im Lagebericht als startbereit markieren.
- Wenn ein echtes Stop-Gate erreicht wurde: keinen Plan 12 starten, sondern Entscheidungsanker schreiben und stoppen.
- Plan 12 darf weiterhin keine Routinefreigabe brauchen, solange er innerhalb der bereits erlaubten Guardrails bleibt.

## Erfolgskriterium

Plan 11 ist erfolgreich, wenn der lokale synthetische Beta-Rehearsal-Stand zu einem klaren, pruefbaren internen Pilot-Preflight fuer anonymisierte/synthetische Daten verdichtet ist, ohne echte Daten/Deployment/Auth/Persistenz/API/Schedule-Runtime zu beruehren, und wenn entweder ein sicherer Plan 12 vorbereitet ist oder ein echter Stop-/Entscheidungspunkt ehrlich ausgewiesen wurde.
