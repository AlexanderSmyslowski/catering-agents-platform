# P7-B64 Synthetische Szenario- und Datenkarte

Status: Doku-/Vertragstest-only Szenariokarte fuer Build Plan 7 Cycle P7-B64
Stand: 2026-05-23
Scope: klar fiktives Szenario fuer den ersten manuellen internen Beta-Rehearsal-Durchlauf; keine Produktlogik, keine UI-Aenderung, keine neue Seed-Daten-Quelle, keine Persistenz- oder Datenmodell-Aenderung, kein Deployment

## 1. Zweck

Diese Szenario- und Datenkarte gibt dem Reviewer ein klar fiktives Szenario fuer den manuellen synthetischen Beta-Rehearsal-Durchlauf:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Der Nutzen ist bewusst klein: Der Reviewer weiss vor dem Tippen, welche synthetischen Angaben erlaubt sind und welche Daten nicht eingetragen werden duerfen. Die Karte ersetzt keine Demo-Seeds, erzeugt keine neue Datenquelle und fuehrt keine neue Produktfunktion ein.

## 2. Fiktives Rehearsal-Szenario

Der Durchlauf simuliert einen internen Testauftrag, der eindeutig nicht real ist.

Szenario:

- Beispielkunde: Testfirma Nordstern Demo GmbH
- Kontaktperson: Erika Beispiel
- Ort: Musterhalle 7, 12345 Beispielstadt
- Termin: 15. Oktober 2099, 18:00 Uhr
- Anlass: internes Probe-Catering fuer 42 fiktive Gaeste
- Gewuenschter Ablauf: Empfang, kleines Buffet, Abschlusskaffee
- Besonderheit fuer Rueckfragen: Portions- und Zeitfenster sollen im Verlauf sichtbar pruefbar bleiben
- Testquelle: synthetisches Testdokument oder manuelle Eingabe mit ausschliesslich diesen fiktiven Angaben

Diese Angaben duerfen fuer Notizen, UI-Eingaben und anonymisierte Screenshots verwendet werden, solange keine echten Zusatzinformationen ergaenzt werden.

## 3. Erlaubte synthetische Angaben

Erlaubt sind nur Angaben, die offensichtlich fiktiv sind:

- erfundene Organisationen mit `Test`, `Demo`, `Muster` oder `Beispiel` im Namen,
- erfundene Personen wie `Erika Beispiel`,
- erfundene Orte wie `Musterhalle 7, 12345 Beispielstadt`,
- weit in der Zukunft liegende Beispieltermine wie `15. Oktober 2099`,
- runde fiktive Gaestezahlen wie `42 fiktive Gaeste`,
- synthetisches Testdokument ohne echte Kundentexte, echte Logos, echte Signaturen oder echte Metadaten.

## 4. Nicht eintragen

Keine echten Kunden-, Personen- oder Einsatzdaten eintragen. Verboten sind insbesondere:

- keine echten Namen,
- keine echten Telefonnummern,
- keine echten E-Mail-Adressen,
- keine echten Adressen,
- keine echten Termine,
- keine echten Dokumentinhalte,
- keine Kundendaten,
- keine Mitarbeiterdaten,
- keine Einsatzdaten,
- keine Schicht-, Abrechnungs- oder Lieferdaten,
- keine produktionsnahen Pilotdaten,
- keine Secrets, Tokens, produktive `.env` oder Connection Strings.

Wenn der Durchlauf echte Daten oder produktionsnahe Angaben brauchen wuerde: Stop statt Eingabe.

## 5. Eingabeleitlinie fuer den Reviewer

1. Starte mit der P7-B63-Startkarte.
2. Verwende im gesamten Durchlauf nur das Szenario aus Abschnitt 2.
3. Wenn ein Feld nach Kontakt, Ort, Termin oder Anlass fragt, nutze nur die fiktiven Beispielwerte.
4. Wenn ein Upload oder Dokumentinhalt noetig wirkt, nutze nur ein synthetisches Testdokument mit den fiktiven Beispielwerten oder stoppe.
5. Halte Reibung in der P6-B58-Reibungslog-Vorlage fest.
6. Screenshots duerfen nur Demo-/Seed-/synthetische Inhalte enthalten.

## 6. Schutzanker gegen Verwechslung mit echter Nutzung

Diese Karte markiert den Rehearsal-Korridor ausdruecklich als synthetisch:

- kein echter Catering-Auftrag,
- keine echte Kundenkommunikation,
- keine echte Produktionsplanung,
- keine Freigabe fuer echte Daten,
- keine Produktionsfreigabe,
- keine externe Freigabe,
- keine rechtssichere Audit-/Compliance-/Export-Verbindlichkeitsaussage.

Technische Grenzen bleiben unveraendert:

- keine neue Seed-Daten-Quelle,
- keine Persistenz- oder Datenmodell-Aenderung,
- keine neue API,
- kein Deployment,
- keine SSH-Verbindung,
- keine Secrets,
- kein OAuth/Login/OIDC,
- keine automatische Spec-Korrektur,
- keine Rezept-/Allergenautomatik,
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau.

## 7. Ergebnis von P7-B64

P7-B64 baut keine Produktlogik und keine neue Datenwelt. Der messbare Nutzen ist eine auffindbare Szenario- und Datenkarte: Der erste manuelle Beta-Rehearsal-Durchlauf kann mit eindeutig fiktiven Angaben gestartet werden, ohne echte Kunden-, Personen- oder Einsatzdaten zu erfassen.
