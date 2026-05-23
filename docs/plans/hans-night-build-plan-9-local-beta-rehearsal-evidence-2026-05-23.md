# Hans Night Build Plan 9 — Local Beta Rehearsal Evidence

Datum: 2026-05-23  
Status: vorbereitet fuer ueberwachten Anschlusslauf nach Plan 8  
Repo: `AlexanderSmyslowski/catering-agents-platform`

## Ausgangslage

Plan 8 ist abgeschlossen und gruen verifiziert. Die bewusste Option-A-Linie steht: Zeitfenster/Schedule bleibt fuer den internen Beta-MVP eine manuelle Copy-/Anleitungsnotiz, ohne Datenmodell-, API-, Persistenz-, Runtime-Schedule- oder automatische Spec-Korrektur.

Der naechste kleinste sinnvolle Produktwert liegt nicht in weiterem Schedule-Featurebau. Er liegt darin, den bestehenden synthetischen Beta-Korridor `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` fuer eine interne Testperson noch besser als **ehrlich pruefbaren lokalen Rehearsal-Nachweis** nutzbar zu machen: Was wurde lokal gestartet, welche UI-/Export-/Audit-Anker wurden gesehen, welche Reibung ist dokumentiert, und welche Stop-Gates bleiben blockiert?

## Management-Ziel

Hans soll einen schmalen, echten Nutzwertblock bauen, der Alexanders interne Beta-Faehigkeit verbessert, ohne neue Fachentscheidungen vorwegzunehmen:

- der lokale synthetische Beta-Durchlauf wird als Nachweis-/Rehearsal-Paket klarer und weniger missverstaendlich;
- vorhandene lokale Checks, UI-Marker, Export-/Audit-Anker und Reibungslog werden enger verbunden;
- eine interne Testperson kann nach dem Durchlauf belastbarer sagen: gruen, Reibung, blocked oder Entscheidungsbedarf;
- keine echten Daten, kein Deployment, keine Auth-/Persistenz-/API-/Schedule-Entscheidung.

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
- Jeder Cycle arbeitet RED/Contract-first, falls Code/Doku-Anker geaendert werden.
- Commit/Push nur bei gruenen Gates.
- Push mit `HOME=/Users/alexandersmyslowski git push origin main`.
- CI nach Push pruefen, sofern `gh`/Token verfuegbar ist; wenn nicht, im Bericht klar als nicht pruefbar kennzeichnen und lokale Gates dokumentieren.
- Keine Fortsetzung ueber rote CI hinweg.
- Wenn ein Cycle keinen sicheren Produktwert findet: No-Product-Change-Bericht, kein erzwungener Commit.

## Cycle Queue

### P9-N1 — Rehearsal-Nachweisrahmen aus Ist-Dokumenten konsolidieren

Ziel: Die vorhandenen Rehearsal-Dokumente, Start-/Status-Korridor, Reibungslog, Evidence-Paket und Option-A-Grenze sollen als ein klarer lokaler Nachweisrahmen auffindbar sein.

Erlaubt:
- Doku-/Vertragstest-only Konsolidierung in bestehenden Produktdocs oder einem schmalen neuen Rehearsal-Index;
- Links/Marker zu C8, P6-B57, P6-B58, P7-B63/B64/B65/B67 und Plan-8-Option-A-Grenze;
- klare Trennung: lokal/synthetisch gruener Nachweis vs. echte Daten/Produktionsfreigabe/Compliance blocked.

Nicht erlaubt:
- neue Produktlogik, UI-Neubau, API, Persistenz, Deployment, echte Daten.

### P9-N2 — Lokalen Rehearsal-Check eng an bestehende Gates binden

Ziel: Bestehende lokale Gates (`npm run local:status`, `npm run local:check`, UI-/Export-/Audit-Smokes) sollen fuer den Rehearsal-Nachweis so beschrieben oder minimal pruefbar verbunden werden, dass eine Testperson keine Scheingruenheit ableitet.

Erlaubt:
- docs-/script-contract-only Schaerfung vorhandener Check-Beschreibungen;
- kleiner fokussierter Test, der die Rehearsal-Anker und Grenzen schuetzt;
- falls streng sinnvoll: minimaler Wrapper-/Hinweisanker ohne neue Runtime-Services und ohne neue API.

Nicht erlaubt:
- Deployment-/Infra-Arbeit, neue Health-Vertraege, neue API, Persistenz, echte Daten, rechtssichere Audit-Behauptung.

### P9-N3 — Reibung-zu-Entscheidung nach Rehearsal schaerfen

Ziel: Nach einem lokalen synthetischen Durchlauf muss klar sein, welche Reibung sofort klein fixbar ist, welche spaeter gehoert, welche ein Stop-Gate ausloest und welche Alexander bewusst entscheiden muss.

Erlaubt:
- Doku-/Test-only Schaerfung der Triage-/Management-Vorlagen;
- kleine Copy-Anker fuer `go`, `fix`, `blocked`, `decision needed`;
- keine automatische Ticket-/Backlog-/QA-Plattform.

Nicht erlaubt:
- echte Produkt-/Scope-Entscheidung treffen, neue Workflows, Persistenz, externe Tools.

### P9-N4 — UI-Lesbarkeit nur bei echtem Rehearsal-Nutzwert

Ziel: Falls aus N1-N3 ein konkreter, enger UI-Missverstaendnispunkt sichtbar ist, darf Hans genau einen kleinen bestehenden UI-Copy-/Marker-Fix umsetzen, der den lokalen synthetischen Beta-Durchlauf sicherer fuehrt.

Erlaubt:
- minimaler Text-/Marker-Fix in vorhandenen Routen `/`, `/angebot` oder `/produktion`;
- fokussierter jsdom-/Smoke-Test;
- keine neue Produktflaeche.

Nicht erlaubt:
- neue UI-Flow-Architektur, freie Chatfunktion, neue Formular-/Antwortlogik, API, Persistenz, automatische Spec-Korrektur, Schedule-Featurebau.

Wenn kein klarer UI-Nutzwert besteht: no-product-change berichten und N5 ausfuehren.

### P9-N5 — Abschlussgate / Memory Snapshot / Management-Lage

Ziel: Full Gates, ggf. CI-Verifikation, memory-Snapshot und kompakte Management-Lage: was ist fuer den lokalen Beta-Rehearsal-Nachweis jetzt besser, was bleibt blocked, und was waere der naechste echte Entscheidungspunkt.

Pflicht:
- fokussierte P9-Tests/Smokes;
- `npm test`;
- `npm run build`;
- `npm audit --omit=dev`;
- `git diff --check`;
- bei lokalem Betriebsbezug: `npm run local:status` und `npm run local:check`;
- CI fuer letzten Push pruefen, sofern technisch moeglich.

## Erfolgskriterium

Plan 9 ist erfolgreich, wenn der lokale synthetische Beta-Rehearsal-Nachweis fuer `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` klarer, ehrlicher und besser pruefbar ist, ohne ein Stop-Gate zu verletzen oder Scheinfunktionalitaet zu erzeugen.
