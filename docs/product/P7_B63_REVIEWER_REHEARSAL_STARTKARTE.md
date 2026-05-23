# P7-B63 Reviewer-Rehearsal-Startkarte

Status: Doku-/Vertragstest-only Startkarte fuer Build Plan 7 Cycle P7-B63
Stand: 2026-05-23
Scope: erster manueller interner Beta-Rehearsal-Start; keine Produktlogik, keine UI-Aenderung, keine neue API, keine neue Persistenz, kein Deployment

## 1. Zweck

Diese Reviewer-Rehearsal-Startkarte gibt einem internen Reviewer vor dem ersten manuellen synthetischen Beta-Rehearsal eine knappe Startorientierung:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Sie ersetzt keine bestehenden Gates und fuehrt keine neue Produktfunktion ein. Sie buendelt Rolle, synthetisches Ziel, erlaubte Daten, Stop-Gates und fuehrenden Pfad so, dass der Durchlauf ohne Entwicklerkontext begonnen werden kann.

## 2. Fiktive Testrolle

Der Reviewer handelt als interne Testperson fuer den lokalen Demo-/Beta-Korridor.

Fiktive Testrolle:

- Rolle: interner Reviewer fuer Angebots- und Produktionsdurchlauf.
- Aufgabe: sichtbare Orientierung, Reibung und Stop-Punkte beobachten.
- Keine Aufgabe: echte Catering-Auftraege planen, echte Personen-/Kunden-/Einsatzdaten erfassen oder Produktionsfreigabe ableiten.

## 3. Synthetisches Ziel

Synthetisches Ziel des Durchlaufs:

1. lokalen Stack mit bestehenden Scripts starten und Status pruefen,
2. Startseite oeffnen und den Beta-Weg erkennen,
3. Angebotspfad oeffnen und Entwurf/Export/Uebergabe nachvollziehen,
4. Produktionspfad oeffnen und Rueckfragen, Ergebnisobjekte sowie Export-/Auditanker pruefen,
5. Reibung sicher notieren und bei Stop-Gates stoppen.

Fuehrende lokale URLs:

- `http://127.0.0.1:3200/`
- `http://127.0.0.1:3200/angebot`
- `http://127.0.0.1:3200/produktion`

## 4. Erlaubte Daten

Erlaubt sind nur Demo-/Seed-/synthetischen Daten aus dem bestehenden lokalen Korridor.

Nicht eintragen und nicht in Screenshots festhalten:

- keine echten Daten,
- keine Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten,
- keine Namen, Kontaktdaten, Adressen, echten Termine oder echten Dokumentinhalte,
- keine Secrets, Tokens, produktive `.env` oder Connection Strings.

## 5. Zustandsgrenzen vor dem Start

### synthetisch/testbar

- Lokaler Durchlauf mit Demo-/Seed-/synthetischen Daten.
- Bestehende Routen `/`, `/angebot`, `/produktion`.
- Bestehende read-only Arbeitsbelege: Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML, Einkaufsliste-CSV und Audit-Spur.
- Reibungsnotiz ueber die vorhandene P6-Reibungslog-Vorlage.

### blockiert

- produktionsnaher Pilot mit echten Daten ohne separate Gate-Entscheidungen,
- AuthN/AuthZ-, Proxy-/IAP-, PII/Retention/Backup- oder Sandbox/Worker/AV-Entscheidung,
- externe Freigabe, Produktionsfreigabe oder rechtssichere Audit-/Compliance-/Export-Verbindlichkeitsaussage.

### verboten

- kein Deployment,
- keine SSH-Verbindung,
- keine Secrets,
- keine neue API,
- keine neue Persistenz,
- keine Migration und kein Prisma,
- kein OAuth/Login/OIDC,
- keine automatische Spec-Korrektur,
- keine Rezept-/Allergenautomatik,
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau,
- keine Produktionsfreigabe.

## 6. Stop-Gates waehrend des Rehearsals

Sofort Stop statt Freigabe, wenn fuer den naechsten Schritt eines davon noetig waere:

- echte Daten oder produktionsnahe Pilotdaten,
- Deployment, SSH, Server-, Domain-, TLS-, Proxy- oder IAP-Aenderung,
- Secrets, produktive Konfiguration oder nicht-sensitive Grenze unklar,
- neue API, Persistenz, Migration oder Auth-/Session-Welt,
- automatische Spec-Korrektur aus Rueckfragenantworten,
- Rezept-, Mengen-, Allergen-, Parser-, OCR-, LLM- oder Tool-Use-Ausbau,
- PII/Retention/Backup oder Sandbox/Worker/AV-Entscheidung,
- rechtssichere Audit-, Compliance-, Signatur- oder Export-Verbindlichkeitsaussage.

## 7. Startablauf fuer den Reviewer

1. Lokalen Stack starten: `npm run local:start`.
2. Status pruefen: `npm run local:status`.
3. Betriebs-/Seed-/Export-/Auditbeleg pruefen: `npm run local:check`.
4. UI-Pfad oeffnen: Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit.
5. Reibung mit `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` notieren.
6. Ergebnis nur fuer den internen synthetischen Korridor einordnen: `go`, `blocked` oder `not assessed`.
7. Lokal kontrolliert stoppen: `npm run local:stop`.

## 8. Ergebnis von P7-B63

P7-B63 baut keine Produktlogik und keine neue QA-Plattform. Der messbare Nutzen ist eine auffindbare Startkarte: Ein interner Reviewer erkennt vor dem Start fiktive Testrolle, synthetisches Ziel, erlaubte Daten, Stop-Gates und den fuehrenden Pfad `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`.
