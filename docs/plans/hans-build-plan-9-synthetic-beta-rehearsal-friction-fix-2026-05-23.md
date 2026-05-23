# Hans Build Plan 9 — Synthetic Beta Rehearsal / Friction-to-Fix Relay

> **For Hermes:** Implement as a supervised Hans run with one narrow cycle at a time. Use hard verification after every cycle before continuing.

Datum: 2026-05-23  
Status: bereit fuer ueberwachten Anschlusslauf nach Plan 8  
Repo: `AlexanderSmyslowski/catering-agents-platform`  
Baseline: Plan 8 abgeschlossen auf `ce1b22d`; GitHub CI gruen; Repo sauber bis auf bekanntes untracked `tmp/`.

## Management-Ziel

Plan 9 fuehrt den naechsten sinnvollen Schritt nach Plan 8 aus: keinen weiteren abstrakten Option-A-Mikroausbau, sondern einen kontrollierten synthetischen Beta-Rehearsal-Durchlauf mit anschliessender Ableitung genau eines kleinen, beobachtungsbasierten Produktwertblocks.

Fuehrender Beta-Korridor bleibt:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Plan 9 soll die App naeher an interne Beta-Faehigkeit bringen, indem er echte Bedienreibungen im vorhandenen lokalen/synthetischen Korridor findet, belegt, triagiert und nur dann minimal behebt, wenn der Fix ohne neue Produkt-, API-, Persistenz-, Auth-, Deployment- oder Datenentscheidung moeglich ist.

## Architektur / Produktlinie

- Der bestehende lokale Backoffice-/Service-Korridor bleibt fuehrend.
- Reibung entsteht nur aus reproduzierbarer Beobachtung im synthetischen Durchlauf, nicht aus Wunschlisten.
- Erlaubte Fixes sind klein: UI-Copy, vorhandene Zustandsmarker, Doku-/Runbook-Anker oder Smoke-/Contract-Absicherung.
- Keine neue Fachlogik und keine strukturelle Schedule-Loesung; Option A aus Plan 8 bleibt gueltig.

## Tech Stack / vorhandene Gates

- Node/npm Monorepo
- Backoffice UI: vorhandene Routen `/`, `/angebot`, `/produktion`
- Lokale Scripts: `npm run local:start`, `npm run local:status`, `npm run local:check`, `npm run local:stop`
- Standard-Gates: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`
- GitHub CI muss nach Push gruen sein.

## Absolute Stop-Gates

Sofort stoppen und Bericht schreiben, wenn ein naechster Schritt eines davon benoetigt:

- echte Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahe Pilotdaten;
- Deployment, Hetzner, SSH, Server-, Domain-, TLS-, Proxy- oder Secret-Aktion;
- produktive `.env`, Tokens, private Keys oder Connection Strings;
- neue API, API-Vertragsaenderung, neue Persistenz, Prisma, Migration;
- OAuth/Login/OIDC, Session- oder Nutzerverwaltungswelt;
- automatische Spec-Korrektur oder halbautomatische Uebernahme von Rueckfragen-/Zeitfensterantworten;
- Rezept-/Allergenautomatik;
- Parser-/OCR-/LLM-/Tool-Use-Ausbau;
- Sandbox/Worker/AV-, PII/Retention/Backup- oder rechtliche/Compliance-Entscheidung;
- Multi-Tenant, White-Label oder Plattformausbau;
- rote CI, die nicht eng reproduzierbar und fixbar ist.

`tmp/` bleibt bekannt untracked und wird nicht beruehrt.

## Fuehrende Referenzen

Vor jedem Cycle lesen:

1. `memory.md`
2. `HANDOFF_PROMPT.md`
3. `README.md`
4. `TESTING.md`
5. `docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md`
6. `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md`
7. `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md`
8. `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md`
9. `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md`
10. `docs/product/R3_SCHEDULE_ZEITFENSTER_ENTSCHEIDUNGSVORLAGE.md`
11. dieser Plan

## Cycle Queue

### P9-R1 — Synthetischen Beta-Rehearsal-Durchlauf real ausfuehren und beobachten

**Objective:** Lokalen synthetischen Korridor tatsaechlich starten/pruefen und eine konkrete Bedien- oder Verstaendnisreibung belegen — oder sauber `no-product-change` melden, wenn keine sichere Reibung entsteht.

**Erlaubt:**
- `npm run local:start`, `npm run local:status`, `npm run local:check`, ggf. `npm run local:stop`;
- Betrachtung der vorhandenen Routen `/`, `/angebot`, `/produktion` mit synthetischen/Demo-Daten;
- Dokumentation genau einer beobachteten Reibung nach P6-B58;
- keine Code-Aenderung, ausser ein reproduzierbarer lokaler Blocker verlangt einen engsten Reparaturhinweis.

**Nicht erlaubt:**
- neue Produktfunktion;
- echte Daten;
- Deployment/Secrets/Auth/API/Persistenz.

**Pflichtbericht:**
`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-plan9-20260523-p9-r1.md`

### P9-R2 — Reibung nach Backlog-Triage klassifizieren

**Objective:** Die in P9-R1 beobachtete Reibung mit P7-B67 in genau eine Kategorie einordnen: `sofort kleiner Fix`, `spaeter`, `Entscheidung noetig` oder `out of scope/verboten`.

**Erlaubt:**
- Doku-/Triage-Ergaenzung nur, wenn sie aus der konkreten Beobachtung folgt;
- Entscheidungsvorlage, wenn ein Gate beruehrt wird;
- `no-product-change`, wenn kein sicherer Fix ableitbar ist.

**Nicht erlaubt:**
- Wunschlisten;
- mehrere parallele Backlogpunkte;
- impliziter Schedule-/Zeitfenster-Funktionsausbau.

**Pflichtbericht:**
`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-plan9-20260523-p9-r2.md`

### P9-R3 — Genau einen kleinen beobachtungsbasierten Fix umsetzen

**Objective:** Wenn P9-R2 `sofort kleiner Fix` ergibt, genau einen minimalen UI-Copy-, Doku-, Marker- oder Smoke-/Contract-Fix umsetzen, der die beobachtete Reibung reduziert.

**Erlaubt:**
- vorhandene UI-Copy schaerfen;
- vorhandene Status-/Naechster-Schritt-Marker klarer benennen;
- vorhandene Checkliste/Doku minimal aktualisieren;
- fokussierten Smoke-/Contract-Test ergaenzen oder schaerfen.

**Nicht erlaubt:**
- neue Workflow-/Runtime-Logik;
- neue API/Persistenz/Migration;
- automatische Antwort-/Spec-Verarbeitung;
- neue Produktflaeche oder grosse Refactorings.

**Mindest-Gates bei Aenderung:**
- fokussierter Test/Contract-Test fuer den Fix;
- `npm test`;
- `npm run build`;
- `npm audit --omit=dev`;
- `git diff --check`;
- bei lokalem UI-/Betriebsbezug: `npm run local:status` und `npm run local:check`.

**Pflichtbericht:**
`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-plan9-20260523-p9-r3.md`

### P9-R4 — Rehearsal-Nachpruefung und Export-/Audit-Beleg

**Objective:** Nach dem Fix denselben synthetischen Korridor erneut pruefen und belegen, ob die Reibung reduziert wurde, ohne die Grenzen zu verwischen.

**Erlaubt:**
- lokale Status-/Check-Verifikation;
- vorhandene Export-/Audit-Anker pruefen;
- Doku-/Report-Update mit Ergebnis `reduziert`, `unveraendert`, `blocked` oder `no-product-change`.

**Nicht erlaubt:**
- neue Exportlogik;
- rechtssichere Audit-/Compliance-Behauptung;
- externe oder produktionsnahe Freigabe.

**Pflichtbericht:**
`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-plan9-20260523-p9-r4.md`

### P9-R5 — Abschlussgate und Plan-10-Entscheidungsanker

**Objective:** Plan 9 hart abschliessen: Full Gates, CI, memory-Snapshot falls relevant, Management-Lage und naechster sinnvoller Produktwertblock fuer Plan 10.

**Pflicht:**
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run local:status`
- `npm run local:check`
- CI fuer letzten Push pruefen
- unterscheiden: umgesetzt, nur dokumentiert, offen, out of scope, Entscheidung noetig

**Pflichtbericht:**
`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-plan9-20260523-p9-r5.md`

## Erfolgskriterium

Plan 9 ist erfolgreich, wenn mindestens eines davon sauber belegt ist:

1. Eine konkrete synthetische Beta-Reibung wurde beobachtet, triagiert, minimal reduziert und durch Gates abgesichert; oder
2. der vorhandene Korridor wurde ohne neue Reibung hart verifiziert, inklusive `no-product-change`-Begruendung; oder
3. ein echtes Stop-/Entscheidungsgate wurde mit belastbarer Entscheidungsvorlage sichtbar gemacht.

Nicht erfolgreich waere: weiterer abstrakter Dokuausbau ohne Beobachtung, mehrere parallele Wunschlistenpunkte oder Featurebau ausserhalb der Guardrails.

## Fortsetzung nach Plan 9

Wenn Plan 9 ohne Stop-Gate endet, soll Plan 10 aus dem realen Ergebnis abgeleitet werden:

- bei reduzierter Bedienreibung: naechster Beta-Korridor-Engpass;
- bei no-product-change: naechstes echtes App-Ziel ausserhalb Option-A-Politur;
- bei Gate-Frage: Entscheidungsvorlage statt Implementierung;
- bei lokaler Instabilitaet: erst gezielter Stabilisierungslauf, kein Featurebau.
