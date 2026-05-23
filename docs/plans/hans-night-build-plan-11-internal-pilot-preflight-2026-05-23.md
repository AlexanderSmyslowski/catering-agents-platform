# Hans Night Build Plan 11 — Limited Internal Pilot Preflight

Datum: 2026-05-23  
Status: vorbereitet fuer ueberwachten Anschlusslauf nach Plan 10  
Repo: `AlexanderSmyslowski/catering-agents-platform`

## Ausgangslage

Plan 8 hat die Option-A-Linie fuer Schedule/Zeitfenster bestaetigt: Zeitfenster bleiben im internen Beta-MVP eine manuelle Copy-/Anleitungslinie ohne Runtime-Schedule, neues Datenmodell, neue API, Persistenz/Migration oder automatische Spec-Korrektur.

Plan 9 hat den lokalen Rehearsal-Nachweis geschaerft. Plan 10 hat den vorhandenen synthetischen Durchlauf entlang `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` lokal mit UI-, Export-/Audit- und Gate-Evidenz geprueft. Es wurde keine neue enge scope-sichere Reibung beobachtet.

Die anschliessende R4-Entscheidung dokumentiert: Option A bleibt fuehrend. Der naechste sinnvolle Produktfortschritt liegt deshalb nicht in Schedule-Featurebau, sondern in einem konservativen **begrenzten internen Pilot-Preflight mit anonymisierten/synthetischen Daten**. Fuehrender Repo-Anker ist `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md`: interner Demo-Modus ist `go`, begrenzter interner Pilot mit anonymisierten Daten ist `not assessed`, produktionsnaher Pilot mit echten Daten ist `blocked`.

## Management-Ziel

Hans soll den `not assessed`-Korridor fuer einen begrenzten internen Pilot mit anonymisierten/synthetischen Daten so vorbereiten, dass Alexander danach eine echte, knappe Entscheidung treffen kann, ohne dass im Nachtlauf Deployment, echte Daten, Auth, neue API, Persistenz oder Compliance vorweggenommen werden.

Zielbild fuer Plan 11:

- aus B24 wird eine konkrete, nicht-sensitive Preflight-Pruefliste fuer einen begrenzten internen Pilot abgeleitet;
- Zielumgebung, Nutzerkreis, Datenumfang, Betreiber-/Zugriffskontext und Anonymisierungsnachweis werden als auszufuellende Entscheidungspunkte sichtbar gemacht;
- lokale Rehearsal-Evidenz aus Plan 9/10 bleibt sauber vom Pilot-Go getrennt;
- Stop-Gates bleiben hart: echte Daten, Deployment, Auth/OIDC, neue Persistenz/API, rechtliche/Compliance-Freigabe und produktionsnahe Nutzung werden nicht umgesetzt;
- falls sich ein kleiner, sicherer Doku-/Copy-/Testanker ergibt, darf Hans ihn bauen; sonst no-product-change mit Entscheidungsvorlage.

## Absolute Stop-Gates

Sofort stoppen und Bericht schreiben bei Bedarf fuer:

- Deployment, Hetzner, SSH, Secrets oder produktive Konfiguration;
- echte Kunden-/Personen-/Mitarbeiter-/Einsatz-/Schicht-/Abrechnungsdaten;
- neue Persistenz, Prisma, Migration, neue Tabellen oder Datenbankumbau;
- neue API-Endpunkte oder veraenderte API-Vertraege;
- OAuth/Login/OIDC/Session/Auth-Ausbau;
- rechtliche/Compliance-/DSGVO-/Retention-/Backup-Entscheidung oder rechtssichere Audit-Behauptung;
- rote CI, die nicht eng reproduzierbar und minimal fixbar ist;
- grosse Produkt-/Scope-/Architekturentscheidung;
- Multi-Tenant/White-Label/Plattformausbau;
- Runtime-Schedule-/Zeitfenster-Modell, automatische Spec-Korrektur, Rezept-/Allergenautomatik.

`tmp/` bleibt bekannt untracked und wird nicht beruehrt.

## Nachtlauf-Protokoll

- Immer nur ein Hans-Runner gegen dieses Repo.
- Jeder Cycle schreibt einen Lagebericht nach `/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/`.
- Jeder Cycle arbeitet am realen Repo-Iststand und liest `memory.md`, `AGENTS.md`, `HANDOFF_PROMPT.md`, `README.md`, B24 und diesen Plan.
- Kein Code-/Doku-Fix ohne beobachtete Reibung und engen Scope.
- Commit/Push nur bei gruenen Gates und sauberem Status abgesehen vom bekannten untracked `tmp/`.
- Push mit `HOME=/Users/alexandersmyslowski git push origin main`.
- CI nach Push pruefen, sofern `gh`/Token verfuegbar ist; wenn nicht, klar als nicht pruefbar kennzeichnen.
- Keine Fortsetzung ueber rote CI hinweg.

## Cycle Queue

### P11-N1 — Pilot-Preflight-Iststand aus B24 ableiten

Ziel: Den `not assessed`-Korridor aus B24 in konkrete, nicht-sensitive Preflight-Pruefpunkte uebersetzen.

Pflicht:
- B24, R4, Plan-9/10-Abschlussberichte und lokale Rehearsal-Anker lesen;
- die Mussfragen fuer Zielumgebung, beteiligte Personen/Nutzerkreis, Datenumfang, Betreiber-/Zugriffskontext und Anonymisierungsnachweis herausarbeiten;
- klar trennen: lokaler Demo-/Rehearsal-Go vs. begrenzter interner Pilot `not assessed` vs. produktionsnah `blocked`.

Erlaubt:
- Doku-/Vertragstest-only Preflight-Index oder Entscheidungsvorlage;
- keine Runtime- oder Deployment-Arbeit.

### P11-N2 — Anonymisierte/synthetische Daten-Grenze schaerfen

Ziel: Eine interne Testperson darf nicht versehentlich echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten in den Pilot-Preflight ziehen.

Pflicht:
- sichere Datenkategorien definieren: Demo, synthetisch, anonymisiert, verboten;
- Nachweisfrage formulieren, woran Anonymisierung/Synthetik erkennbar ist;
- verbotene Artefakte/Uploads/Exporte klar benennen.

Erlaubt:
- Doku-/Testanker, kleine README-/TESTING-Verlinkung, falls eng sinnvoll;
- keine echten Daten, keine Upload- oder Parser-Erweiterung.

### P11-N3 — Interner Nutzerkreis und Zugriffskontext als Entscheidungspunkte

Ziel: Pilot-Preflight soll die organisatorischen Luecken sichtbar machen, ohne Auth/OIDC, Proxy, Deployment oder Rollenplattform zu bauen.

Pflicht:
- aus B24/PA7-PA9/B8-B9 die sicheren Fragen fuer Nutzerkreis, Betreiber, Trusted-Actor-Kontext und Zugriffskontrolle ableiten;
- klar markieren, dass ein lokales Rehearsal-Go kein Auth-/Pilot-Go ist;
- Stop bei jeder Umsetzungsidee fuer Login/OIDC/Proxy/Secrets/Deployment.

Erlaubt:
- Entscheidungsvorlage/Checkliste/Contract-Test;
- keine Auth-, Secret-, Proxy- oder Deployment-Implementierung.

### P11-N4 — Pilot-Preflight-Evidence-Paket mit lokalem Rehearsal verbinden

Ziel: Plan-9/10-Evidenz soll als Vorbedingung nutzbar sein, aber nicht als stilles Pilot-Go gelesen werden.

Pflicht:
- vorhandene lokale Gates (`npm run local:status`, `npm run local:check`, UI-Evidenz, Export-/Auditbelege, Reibungslog) mit den neuen Pilot-Preflight-Fragen verbinden;
- Ergebnisstatus fuer Alexander formulieren: `go fuer lokalen Demo-Modus`, `not assessed fuer begrenzten internen Pilot`, `blocked fuer echte Daten/Produktion`;
- keine neue QA-, Ticket-, Release- oder Monitoring-Plattform.

Erlaubt:
- kleiner Doku-/Copy-/Testanker in bestehenden Docs;
- keine neue Produktflaeche oder Runtime.

### P11-N5 — Abschlussgate / Entscheidungsvorlage / naechster Plan

Ziel: Plan 11 sauber abschliessen und entscheiden, ob ein weiterer kleiner docs-/test-only Preflight-Schritt ohne Stop-Gate moeglich ist oder ob Alexander entscheiden muss.

Pflicht:
- fokussierte Tests/Smokes passend zu Aenderungen;
- bei jeder Aenderung mindestens `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`;
- bei lokalem Betriebsbezug: `npm run local:status` und `npm run local:check`;
- Memory-Snapshot, falls sich der Projektstand relevant aendert;
- CI fuer letzten Push pruefen, sofern technisch moeglich;
- Management-Lage mit Entscheidungsvorlage schreiben.

## Erfolgskriterium

Plan 11 ist erfolgreich, wenn Alexander danach eine konkrete, nicht-sensitive Entscheidungsvorlage fuer einen begrenzten internen Pilot mit anonymisierten/synthetischen Daten hat: Was ist lokal bereits gruen, was fehlt fuer Pilot-Assessment, was bleibt blockiert und welche Stop-Gates duerfen nicht ueberschritten werden. Plan 11 darf keinen Pilot starten, kein Deployment vorbereiten, keine echten Daten verwenden und keine Auth/API/Persistenz-/Compliance-Entscheidung ersetzen.
