# P11-N1 Limited Internal Pilot Preflight Index

Status: Doku-/Vertragstest-only Preflight-Index fuer Nachtlauf Plan 11 Cycle P11-N1
Stand: 2026-05-23
Scope: nicht-sensitive Entscheidungsvorlage fuer einen begrenzten internen Pilot mit anonymisierten/synthetischen Daten; keine Runtime, kein Deployment, keine neue API, keine Persistenz, keine Auth/OIDC-Implementierung, keine echten Daten und keine Compliance-/DSGVO-Freigabe

## 1. Zweck

Dieser Index uebersetzt den B24-Korridor `begrenzter interner Pilot mit anonymisierten Daten: not assessed` in konkrete, nicht-sensitive Preflight-Pruefpunkte.

Er baut keinen Pilot, kein Deployment, keine Produktfunktion und keine Betriebsplattform. Er macht nur sichtbar, welche Fragen Alexander vor einer spaeteren Pilot-Bewertung ausfuellen muesste.

Fuehrende Repo-Anker:

- `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md`
- `docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md`
- `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md`
- `docs/plans/hans-night-build-plan-9-local-beta-rehearsal-evidence-2026-05-23.md`
- `docs/plans/hans-night-build-plan-10-synthetic-beta-rehearsal-run-2026-05-23.md`

## 2. Harte Status-Trennung

| Korridor | Status | Bedeutung fuer P11-N1 |
| --- | --- | --- |
| lokaler Demo-/Rehearsal-Korridor | `go` | Plan 9/10 belegen den lokalen synthetischen Durchlauf mit Status, lokalem Check, UI-Routen, read-only Export-/Auditbelegen und Reibungstriage. Das ist nur ein lokales Demo-/Rehearsal-Go. |
| begrenzter interner Pilot mit anonymisierten/synthetischen Daten | `not assessed` | Vorbereitbar, aber noch nicht bewertet. Zielumgebung, Nutzerkreis, Datenumfang, Betreiber-/Zugriffskontext und Anonymisierungsnachweis muessen erst nicht-sensitiv benannt werden. |
| produktionsnaher Pilot mit echten Daten | `blocked` | Nicht freigegeben. Echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten bleiben ohne B10/B13/B14-Entscheidungen und ohne konkrete Betriebs-/Daten-/Zugriffsgates blockiert. |

Ein lokales Gruensignal aus Plan 9/10 darf nicht als Pilot-Go gelesen werden. `not assessed` ist kein stilles Go.

## 3. P11-N1 Mussfragen fuer den begrenzten internen Pilot-Preflight

Diese Fragen duerfen nur nicht-sensitive Antworten enthalten. Keine Secrets, keine Tokens, keine privaten SSH-Keys, keine produktiven ENV-Werte, keine IP-/Serverdetails, keine echten Personen- oder Kundendaten und keine echten Betriebsdaten dokumentieren.

| Pruefpunkt | Nicht-sensitive Antwortfrage | Default |
| --- | --- | --- |
| Zielumgebung | Wo soll der begrenzte interne Pilot bewertet werden: lokal, kontrolliert intern oder spaeter separate Zielumgebung? Nur Typ/Verantwortung nennen, keine Hostnamen, IPs, Secrets oder produktive Konfiguration. | `not assessed` |
| Nutzerkreis | Welche internen Rollen/Testpersonen sollen pruefen? Nur Rollen/Funktion nennen, keine personenbezogenen Daten. | `not assessed` |
| Datenumfang | Welche Demo-, synthetischen oder anonymisierten Datensaetze/Artefakte duerfen genutzt werden? Echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- und Abrechnungsdaten ausschliessen. | `not assessed` |
| Betreiberkontext | Wer ist fachlich/technisch fuer den begrenzten Preflight verantwortlich? Nur Verantwortungsrolle nennen, keine Zugangsdaten oder privaten Kontakte. | `not assessed` |
| Zugriffskontext | Wie wird verhindert, dass aus dem internen Preflight oeffentlicher Direktzugriff oder produktionsnahe Nutzung entsteht? Nur Kontrollprinzip/Entscheidungsbedarf nennen, keine Proxy-/Secret-/Deployment-Umsetzung. | `not assessed` |
| Anonymisierungs-/Synthetiknachweis | Woran ist erkennbar, dass die verwendeten Daten synthetisch oder anonymisiert sind und keine Rueckschluesse auf echte Kunden, Personen, Mitarbeiter, Einsaetze, Schichten oder Abrechnung zulassen? | `not assessed` |
| Abgrenzung zu Plan 9/10 | Welche lokalen Rehearsal-Nachweise liegen vor, und warum ersetzen sie kein Pilot-Go? | `go` fuer lokal, `not assessed` fuer Pilot |
| Stop-Gates | Welche Punkte wuerden den Preflight sofort stoppen: echte Daten, beliebige Uploads, Deployment, Auth/OIDC, neue API/Persistenz, Retention/Backup, Sandbox/Worker/AV, Compliance-Freigabe? | `blocked` bei Treffer |

## 4. Erlaubte Evidenz aus Plan 9/10

Als Vorbedingung fuer die spaetere Bewertung darf referenziert werden:

- `npm run local:status` als lokale Prozess-/Port-/Session-Plausibilitaet,
- `npm run local:check` als lokaler Betriebs-/Seed-/Export-/Auditbeleg gegen den laufenden lokalen Stack,
- manuelle UI-Sichtung von `/`, `/angebot` und `/produktion`,
- read-only Angebots-HTML, Produktionsplan-/Produktionsblatt-HTML und Einkaufslisten-CSV,
- read-only Audit-/Herkunftsanker,
- P6-B58-Reibungslog und P7-B65-Evidence-Paket,
- P7-B67/P9-N3-Triage mit `go`, `fix`, `blocked` und `decision needed`.

Diese Evidenz bleibt lokal/synthetisch. Sie beweist keine produktionsnahe Freigabe, keine externe Freigabe, keine rechtssichere Audit-/Compliance-Aussage und keine strukturierte Schedule-/Zeitfensterloesung.

## 5. Option-A-Grenze aus R4

R4 bestaetigt: Option A bleibt fuehrend. Zeitfenster/Schedule bleibt im aktuellen Korridor eine manuelle Copy-/Anleitungsloesung.

Fuer den Pilot-Preflight heisst das:

- keine strukturierte Schedule-/Zeitfenster-Runtime,
- keine automatische oder halbautomatische `event.schedule`-Uebernahme,
- kein neues Schedule-Datenmodell,
- keine neue API, Persistenz, Prisma oder Migration,
- keine automatische Spec-Korrektur.

Wenn eine Pilot-Bewertung strukturierte Zeitfensterverarbeitung verlangt, ist das `decision needed` und nicht Teil von P11-N1.

## 6. Weiterhin blocked

P11-N1 laesst diese Punkte ausdruecklich blockiert:

- produktionsnaher Pilot mit echten Daten,
- echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten,
- beliebige echte Uploads oder produktionsnahe Dateiannahme,
- Deployment, Hetzner, SSH, Secrets, Domains, TLS oder produktive Konfiguration,
- oeffentlicher Direktzugriff auf App oder APIs,
- OAuth/Login/OIDC/Session/Auth-Ausbau,
- neue API, API-Vertragsaenderung, neue Persistenz, Prisma oder Migration,
- Retention-/Loesch-/Backup-Entscheidung,
- Sandbox-/Worker-/AV-Freigabe,
- rechtssichere Compliance-/DSGVO-/Audit-Freigabe,
- Multi-Tenant/White-Label/Plattformausbau,
- LLM-/Tool-/Parser-/OCR-Ausweitung,
- Rezept-/Allergenautomatik.

## 7. Triage fuer beobachtete Preflight-Reibung

| Befund | Triage | Handlung |
| --- | --- | --- |
| Alle nicht-sensitiven Pflichtantworten liegen vor und widersprechen B24/R4/Plan 9/10 nicht | `go` nur fuer Preflight-Bewertung | Alexander kann spaeter den begrenzten internen Pilot bewusst bewerten. Kein automatischer Pilotstart. |
| Kleine Doku-Unklarheit ohne Stop-Gate | `fix` | Engen Doku-/Copy-/Vertragstest-Fix ableiten. |
| Echte Daten, Deployment, Auth/OIDC, neue API/Persistenz, Secrets, Compliance- oder produktionsnahe Nutzung noetig | `blocked` | Stoppen und berichten. Keine Umsetzung im Nachtlauf. |
| Zielumgebung, Nutzerkreis, Datenumfang, Zugriffskontext oder Anonymisierungsnachweis fehlen | `decision needed` | Alexander muss die nicht-sensitiven Antworten liefern oder den Korridor weiter `not assessed` lassen. |

## 8. Ergebnis von P11-N1

Der B24-Korridor ist als konkrete Preflight-Entscheidungsvorlage lesbar: lokaler Demo-/Rehearsal-Stand bleibt `go`, der begrenzte interne Pilot mit anonymisierten/synthetischen Daten bleibt bis zu ausgefuellten nicht-sensitiven Pflichtantworten `not assessed`, produktionsnahe Nutzung mit echten Daten bleibt `blocked`.

P11-N1 fuehrt keine Runtime-, Deployment-, API-, Persistenz-, Auth-, Daten- oder Compliance-Aenderung ein.
