# Hans Night Build Plan 12 — Internal Pilot Go/No-Go Decision Packet

Datum: 2026-05-24  
Status: startbereit nach gruenem Plan 11 / kein Pilotstart in diesem Plan  
Repo: `AlexanderSmyslowski/catering-agents-platform`

## Ausgangslage

Plan 10 ist lokal/synthetisch gruen abgeschlossen: `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` ist mit Demo-/Seed-/synthetischen Daten belegbar. Die Zeitfenster-/Schedule-Frage ist bewusst ueber R4 entschieden: **Option A bleibt fuehrend**. Das verbindliche Zeitfenster wird manuell geklaert und als Rehearsal-/Preflight-Notiz festgehalten; keine Runtime-Schedule-Loesung, keine API-/Persistenz-/Migrationsaenderung und keine automatische Spec-Korrektur.

Plan 11 ist gruen abgeschlossen: Der lokale Pilot-Preflight fuer Demo-/Seed-/synthetische oder nachweisbar anonymisierte Daten ist durch P11-N1, P11-N2, P11-N3 und den sichtbaren Startseiten-Pilot-Preflight-Marker besser pruefbar. Der echte begrenzte interne Pilot ist aber weiterhin **not assessed**, weil Nutzerkreis, fachlicher/technischer Betreiber, Zugriffskontext, Datenrahmen, Anonymisierungs-/Synthetiknachweis und Management-Go noch nicht bewusst entschieden sind.

Der naechste echte Bottleneck ist deshalb kein weiterer UI-Polish und kein Produktfeature, sondern ein knappes, nicht-sensitives **Go/No-Go-Entscheidungspaket** fuer Alexander: Was muesste vor einem echten begrenzten internen Pilot beantwortet sein, und wann bleibt der Status `blocked` oder `decision needed`?

## Management-Ziel

Hans soll Plan 12 nur als Entscheidungs-/Preflight-Abschluss vorbereiten und, falls eng beobachtete Reibung im bestehenden Vertrag auftaucht, maximal einen kleinen Doku-/Contract-/Copy-Fix vornehmen.

Zielbild:

- Plan-11-Preflight-Evidenz in ein kurzes Management-Go/No-Go-Paket verdichten;
- klar trennen: lokaler Preflight `go`, echter begrenzter Pilot `not assessed`, produktionsnaher Pilot mit echten Daten `blocked`;
- nicht-sensitive Entscheidungsfelder fuer Nutzerkreis, Betreiber, Zugriffskontext, Datenrahmen und Nachweis sichtbar machen;
- Option A als manuelle Zeitfenstergrenze fuehrend halten;
- keinen Pilot starten, kein Deployment vorbereiten, keine echten Daten verwenden und keine Auth-/API-/Persistenzarbeit beginnen.

## Absolute Stop-Gates

Sofort stoppen und Bericht schreiben bei Bedarf fuer:

- Deployment, Hetzner, SSH, Secrets, produktive `.env`, Domains, TLS, Proxy/IAP-Konfiguration;
- echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahe Pilotdaten;
- neue Persistenz, Prisma, Migration, neue Tabellen oder Datenbankumbau;
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
- Jeder Cycle arbeitet am realen Repo-Iststand und liest `memory.md`, `AGENTS.md`, `HANDOFF_PROMPT.md`, `README.md`, Plan 11, R4 Option-A Decision Record und diesen Plan.
- Kein Code-/Doku-Fix ohne beobachtete Reibung und engen Scope.
- Commit/Push nur bei gruenen Gates und sauberem Status abgesehen vom bekannten untracked `tmp/`.
- Push mit `HOME=/Users/alexandersmyslowski git push origin main`.
- CI nach Push pruefen; wenn nicht technisch moeglich, klar kennzeichnen.
- Keine Fortsetzung ueber rote CI hinweg.

## Cycle Queue

### P12-N1 — Plan-11-Evidenz und Entscheidungsluecke hart pruefen

Ziel: Realen Stand nach Plan 11 pruefen und bestaetigen, dass kein Stop-Gate beruehrt wurde.

Pflicht:

- `git status --short --branch`, letzter HEAD, Plan-11-Berichte und Plan-11-Produktanker lesen;
- `npm run local:status` und `npm run local:check` ausfuehren, wenn lokaler Stack erreichbar ist; falls nicht, nur bestehenden Demo-Weg `npm run local:start` nutzen und erneut pruefen;
- CI fuer letzten Push pruefen, sofern technisch verfuegbar;
- keine Deployment-, SSH-, Secret- oder echte Daten-Aktion.

Ergebnis: Baseline `go`, `fix`, `blocked` oder `decision needed`.

### P12-N2 — Management-Go/No-Go-Entscheidungspaket erstellen

Ziel: Die offenen Pilotentscheidungen aus P11 in eine kurze, nicht-sensitive Entscheidungsvorlage verdichten.

Erlaubt:

- Doku-/Vertragstest-only Anker fuer Go/No-Go-Fragen;
- vorhandene P11-N1/N2/N3, B24, PA7/PA8/PA9, B8/B9, P6/P7/P9/C8 und R4 verlinken;
- Felder fuer Nutzerkreis, fachlichen Betreiber, technischen Betreiber, Zugriffskontext, Datenrahmen, Anonymisierungs-/Synthetiknachweis, Stop-Verantwortung und finale Entscheidung `go` / `blocked` / `not assessed` sichtbar machen.

Nicht erlaubt:

- Pilotstart, Deployment, Auth-Implementierung, echte Daten, neue API/Persistenz, produktive Konfiguration, rechtliche Freigabe.

Ergebnis: Entscheidungspaket mit Default `not assessed` fuer echten begrenzten Pilot und `blocked` fuer echte/produktive Daten.

### P12-N3 — Bestehende Preflight-Doku auf Scheingruenheit pruefen und ggf. ein enger Fix

Ziel: Sicherstellen, dass lokale Gruensignale nicht als Pilot-Go gelesen werden.

Erlaubt:

- genau ein kleiner Doku-/Contract-/Copy-Fix, wenn konkrete Reibung beobachtet wird;
- bevorzugt Vertragstest statt Produktflaeche, wenn der Konflikt nur Dokumentations-/Nachweislogik betrifft.

Nicht erlaubt:

- UI-Neubau, neuer Workflow, neue Produktlogik, API/Persistenz/Migration, Auth/OIDC, Deployment, echte Daten, Runtime-Schedule.

Ergebnis: `fix` mit Gates oder `no-product-change`.

### P12-N4 — Abschlussgate und Start-/Stop-Entscheidung fuer Folgeplan

Ziel: Plan 12 sauber abschliessen und ehrlich markieren, ob ein Folgeplan ohne Managemententscheidung sinnvoll ist.

Pflicht:

- fokussierter Test/Contract-Test passend zu Aenderungen;
- bei jeder Aenderung: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`;
- bei lokalem Betriebs-/UI-Bezug: `npm run local:status` und `npm run local:check`;
- CI fuer letzten Push pruefen, sofern technisch moeglich;
- trennen: umgesetzt, nur dokumentiert, offen, durch Alexander/extern zu entscheiden.

Ergebnis:

- Wenn ein nicht-sensitives Management-Go fuer einen echten begrenzten internen Pilot fehlt: bewusst `decision needed` / Stop statt Scheinausbau.
- Wenn nur weitere sichere Preflight-Reibung beobachtet wurde: kleinsten Folgeplan ableiten.
- Kein Start eines echten Pilotbetriebs in Plan 12.

## Erfolgskriterium

Plan 12 ist erfolgreich, wenn der nach Plan 11 offene Bottleneck als kurzes, nicht-sensitives Go/No-Go-Paket sichtbar ist und keine lokalen Gruensignale mehr als Pilot-/Deployment-/Auth-/Compliance-Go missverstanden werden koennen. Ohne Alexanders bewusste Managemententscheidung bleibt ein echter begrenzter interner Pilot `not assessed`; produktionsnahe Nutzung mit echten Daten bleibt `blocked`.
