# P11-N2 Pilot-Datenkorridor anonymisiert/synthetisch

Status: Doku-/Vertragstest-only Datenkorridor fuer Nachtlauf Plan 11 Cycle P11-N2
Stand: 2026-05-24
Scope: nicht-sensitive Leitlinie fuer interne Tester im begrenzten Pilot-Preflight; keine echten Daten, keine Testdatenplattform, kein Reset-/Seeder-Feature, keine neue API, keine Persistenz, kein Deployment, keine Auth/OIDC-Implementierung und keine Compliance-/DSGVO-Freigabe

## 1. Zweck

Dieser Anker konkretisiert den erlaubten Datenkorridor fuer einen begrenzten internen Pilot-Preflight, damit eine interne Testperson nicht versehentlich echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten nutzt.

Er baut keine neue Datenquelle und keine neue Testdatenplattform. Er beschreibt nur, welche Eingaben, Notizen, Screenshots und Upload-Artefakte im bestehenden lokalen/synthetischen Korridor erlaubt sind und wann sofort gestoppt werden muss.

Fuehrende Repo-Anker:

- `docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md`
- `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md`
- `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md`
- `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md`
- `docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md`
- `docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md`
- `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md`
- `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md`
- `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md`
- `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md`
- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`
- `docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md`
- `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md`
- `docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md`
- `docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md`
- `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md`
- `docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md`

## 2. Harte Datenbewertung

| Datenart | Status | Erlaubte Nutzung im P11-N2-Korridor |
| --- | --- | --- |
| Demo-/Seed-Daten aus dem Repo | `go` | Erlaubt fuer lokalen Preflight, UI-Sichtung, read-only Export-/Auditbelege und Reibungslog. |
| Offensichtlich synthetische Daten | `go` | Erlaubt, wenn sie frei erfunden, als Test/Demo/Muster/Beispiel markiert und nicht auf reale Personen, Kunden, Mitarbeitende, Einsaetze, Schichten oder Abrechnung rueckfuehrbar sind. |
| Anonymisierte Testdaten | `go` nur nach Nachweis | Nur erlaubt, wenn der Anonymisierungs-/Synthetiknachweis nicht-sensitiv dokumentiert ist und keine Rueckschluesse auf echte Personen, Kunden, Mitarbeitende, Einsaetze, Schichten oder Abrechnung moeglich sind. |
| Pseudonymisierte echte Daten | `blocked` | Nicht erlaubt, weil echte Ausgangsdaten weiter rueckfuehrbar sein koennen und PII/Retention/Backup nicht entschieden ist. |
| Echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten | `blocked` | Nicht eintragen, nicht hochladen, nicht in Screenshots/Notizen uebernehmen und nicht als Export-/Auditbeleg verwenden. |
| Produktionsnahe Betriebsdateien oder beliebige echte Uploads | `blocked` | Ohne Sandbox/Worker/AV- und Daten-/PII-Gates nicht nutzen. |

Kurzregel fuer Tester: Wenn ein Wert aus einem echten Auftrag, einer echten Person, einem echten Kunden, einer echten Mitarbeiterplanung, einer echten Schicht, einer echten Rechnung oder einer echten Datei stammt, ist er im P11-N2-Korridor verboten.

## 3. Erlaubte Beispielwerte

Erlaubt sind Werte, die klar als fiktiv erkennbar sind:

| Feld | Erlaubtes Beispiel |
| --- | --- |
| Organisation | `Testfirma Nordstern Demo GmbH`, `Muster Catering Probe AG`, `Beispielkunde 2099` |
| Kontaktperson | `Erika Beispiel`, `Max Muster`, `Demo Kontakt` |
| E-Mail | `erika.beispiel@example.invalid`, `demo-kontakt@example.invalid` |
| Telefon | `+49 000 000000`, `0000-TEST` |
| Ort | `Musterhalle 7, 12345 Beispielstadt`, `Demokueche Intern` |
| Termin | `15. Oktober 2099`, `2099-10-15` |
| Anlass | `internes Probe-Catering`, `synthetischer Testlauf`, `Demo-Buffet fuer fiktive Gaeste` |
| Gaestezahl | `42 fiktive Gaeste`, `30 Demo-Gaeste`, `100 Testportionen` |
| Zeitfenster | `Aufbau 16:00 Uhr, Service 18:00 bis 21:00 Uhr, Abbau bis 22:00 Uhr` als manuelle Option-A-Notiz |
| Dokument | selbst erstelltes Testdokument mit ausschliesslich Demo-/Muster-/Beispielwerten, ohne Logos, Signaturen, echte Metadaten oder kopierte Kundentexte |

Die Werte aus `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md` bleiben der bevorzugte Default fuer einen manuellen Durchlauf.

## 4. No-go-Daten

Nicht erlaubt sind insbesondere:

- echte Namen, echte Telefonnummern, echte E-Mail-Adressen oder echte Privat-/Firmenadressen,
- echte Kundennamen, echte Ansprechpartner, echte Locations oder echte Vertrags-/Anfragetexte,
- echte Mitarbeiter-, Dienstplan-, Einsatz-, Schicht-, Lohn-, Rechnungs- oder Abrechnungsdaten,
- echte Termine aus laufenden oder vergangenen Auftraegen,
- echte Dokumentinhalte, echte PDFs, echte E-Mails, echte Pages-Dateien, echte Logos, Signaturen, Briefkoepfe oder Metadaten,
- Screenshots mit personenbezogenen Daten oder produktionsnahen Betriebsdaten,
- Rohdaten aus Buchhaltung, iCloud-/Drive-Ablagen, Mailpostfaechern, Kundenkommunikation oder Mitarbeiterplanung,
- Secrets, Tokens, private SSH-Keys, produktive `.env`, Connection Strings, Hostnamen, IPs oder Serverdetails.

## 5. Anonymisiert vs. pseudonymisiert

Fuer diesen Korridor gilt konservativ:

- `synthetisch` bedeutet: frei erfunden und nicht aus echten Daten abgeleitet.
- `anonymisiert` bedeutet: kein Rueckschluss auf echte Personen, Kunden, Mitarbeitende, Einsaetze, Schichten oder Abrechnung moeglich; der Nachweis wird nur nicht-sensitiv beschrieben.
- `pseudonymisiert` bedeutet: echte Quelle wurde nur maskiert, gekuerzt oder ersetzt; das bleibt im P11-N2-Korridor `blocked`.

Wenn eine Testperson nicht sicher beweisen kann, dass Daten synthetisch oder wirklich anonymisiert sind, gilt: Stop statt Eingabe.

## 6. Stop-Regeln fuer interne Tester

Sofort stoppen und als `blocked` oder `decision needed` im P6-B58-Reibungslog notieren, wenn:

- echte oder produktionsnahe Daten eingegeben, hochgeladen, angezeigt, exportiert oder dokumentiert werden sollen,
- ein Upload nur mit echten Dateien sinnvoll wirkt,
- ein Screenshot echte Namen, Kontakte, Adressen, Termine, Dokumentinhalte oder Betriebsdaten enthalten wuerde,
- eine laengerfristige Speicherung echter Daten erwartet wird,
- Retention/Loeschung/Backup, Sandbox/Worker/AV, Auth/OIDC, Deployment oder Compliance geklaert werden muessten,
- ein lokales Demo-/Rehearsal-Go als Pilot-Go, Produktionsfreigabe, externe Freigabe oder rechtssichere Audit-/Compliance-Aussage gelesen werden soll,
- eine strukturierte Schedule-/Zeitfenster-Runtime oder automatische `event.schedule`-Uebernahme verlangt wird.

Stop heisst: keine Umgehung, kein Featurebau, keine echten Ersatzdaten, kein Deployment und keine nachtraegliche Dokumentation sensibler Inhalte.

## 7. Verknuepfung mit P6/P7/P9/C8/B24/B25-B31

- P6-B56/P6-B57/P6-B58/P6-B61 liefern Start-/Status-/Reibungs- und Managementrahmen ohne echte Daten.
- P7-B63/P7-B64/P7-B65/P7-B67 liefern Startkarte, synthetische Datenkarte, Export-/Audit-Evidenz und Triage.
- P9-N1 bindet den lokalen Rehearsal-Nachweis an Status, lokalen Check, UI-Evidenz, Export-/Auditbelege und Reibungslog.
- C8 beschreibt den reproduzierbaren internen Demo-/Abnahmeweg mit bestehenden lokalen Scripts, UI-Routen und read-only Belegen.
- B24 bleibt fuehrend fuer `go` Demo, `not assessed` begrenzter Pilot mit anonymisierten Daten und `blocked` echte/produktive Daten.
- B25-B31 bleiben Deployment-/Hetzner-Preflight-Anker; sie werden nur verlinkt und nicht ausgefuellt. P11-N2 fuehrt kein Deployment, keine SSH-Verbindung, keine Secrets, keine produktive Config und keine Zugriffsschicht ein.

## 8. Option-A-Schedule-Grenze

Die Zeitfensterlinie bleibt nach R4 Option A:

- verbindliches Zeitfenster manuell klaeren/notieren,
- keine strukturierte Schedule-/Zeitfenster-Runtime,
- keine automatische oder halbautomatische `event.schedule`-Uebernahme,
- kein neues Schedule-Datenmodell,
- keine API-/Persistenz-/Migrationsaenderung,
- keine automatische Spec-Korrektur.

Zeitfenster-Beispiele duerfen nur als synthetische manuelle Rehearsal-Notiz genutzt werden.

## 9. Ergebnis von P11-N2

Der erlaubte Pilot-Datenkorridor ist konkret: Demo-/Seed-Daten, offensichtlich synthetische Daten und nachweisbar anonymisierte Testdaten sind fuer einen begrenzten internen Pilot-Preflight nutzbar; pseudonymisierte, echte und produktionsnahe Daten bleiben `blocked`.

P11-N2 fuehrt keine Runtime-, UI-, API-, Persistenz-, Deployment-, Auth-, Reset-/Seeder-, Datenplattform- oder Compliance-Aenderung ein.
