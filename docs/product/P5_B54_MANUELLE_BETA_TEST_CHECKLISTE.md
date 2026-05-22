# P5-B54 Manuelle Beta-Test-Checkliste fuer Alexander

Status: Doku-/Vertragstest-only Checkliste fuer Build Plan 5 Cycle P5-B54
Stand: 2026-05-22
Scope: manueller interner Beta-Durchgang; keine neue QA-Plattform, keine neue Produktlogik, keine neue API, keine neue Persistenz, kein Deployment

## 1. Zweck

Diese Checkliste macht den vorhandenen internen Beta-Weg fuer Alexander manuell durchgehbar:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Sie dient dazu, sichtbare Reibungspunkte zu notieren. Sie ersetzt keine automatisierten Gates, baut keine neue QA-Plattform und behauptet keine Produktions- oder externe Freigabe.

## 2. Vor dem Durchgang

1. Nur mit Demo-/Seed-/synthetischen Daten arbeiten.
2. keine echten Daten verwenden: keine echten Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten.
3. Lokalen Stack nur ueber bestehende Repo-Scripts starten:
   - `npm run local:start`
   - `npm run local:status`
   - optional/anschliessend `npm run local:check`
4. Wenn `npm run local:status` oder `npm run local:check` rot ist: Durchgang als lokalen Blocker notieren, nicht durch Featurebau oder Infrastrukturannahmen ueberdecken.

## 3. Manuelle Reihenfolge und URLs

| Schritt | URL / Aktion | Erwartete sichtbare Marker | Reibungspunkt notieren, wenn |
| --- | --- | --- | --- |
| 1 Start | `http://127.0.0.1:3200/` | Beta-Weg, Angebot, Produktion, Rueckfragen, Exporte/Audit, Audit-/Erfassungsstatus | unklar ist, wo Alexander als erstes klicken soll |
| 2 Angebot | `http://127.0.0.1:3200/angebot` | Anfrage-/Angebotsflaeche, Entwurf, naechster Angebotsschritt, Angebots-HTML, Uebergabe zur Produktion | Entwurf, Export oder Produktionsuebergabe nicht ohne Entwicklerwissen auffindbar sind |
| 3 Produktion | `http://127.0.0.1:3200/produktion` | Spezifikationskontext, Rueckfragenstatus, `Agent fragt · offen`, `Agent fragt · beantwortet`, ggf. `Synthetische Demo-Antwort`, Ergebnisobjekte | offene/beantwortete Rueckfragen oder naechster Schritt nicht klar sind |
| 4 Exporte/Audit | `/produktion` Abschluss-/Download-/Herkunftszonen | Produktionsblatt, Einkaufsliste, Audit-Spur, interne Arbeitsbelege, offene Artefakte bleiben offen markiert | Exporte wie Freigaben wirken oder fehlende Artefakte nicht als offen erkennbar sind |

## 4. Stop-Gates waehrend der manuellen Beta-Pruefung

Sofort stoppen und als Blocker notieren, wenn eines davon fuer den Durchgang noetig wuerde:

- echte Daten oder produktionsnahe Pilotdaten,
- Deployment, SSH, Server-, Domain-, TLS- oder Proxy-Aenderungen,
- Secrets, Tokens, produktive `.env` oder Connection Strings,
- neue API, neue Persistenz, Migration oder Prisma,
- kein OAuth/Login/OIDC, Session- oder Nutzerverwaltungsentscheidungen,
- keine automatische Spec-Korrektur aus Rueckfragenantworten,
- keine Rezept-/Allergenautomatik,
- Parser-/OCR-/LLM-/Tool-Use-Ausbau,
- Sandbox/Worker/AV-Entscheidung,
- PII/Retention/Backup-Entscheidung.

## 5. Was nicht als Freigabe gewertet wird

Ein gruener manueller Durchgang bedeutet nur: Der vorhandene interne Demo-/Beta-Korridor ist fuer Alexander lokal nachvollziehbar.

Daraus folgt ausdruecklich:

- keine Produktionsfreigabe,
- keine externe Freigabe,
- keine Freigabe fuer echte Daten,
- keine rechtssichere Audit-/Compliance-Aussage,
- keine Signatur- oder Export-Verbindlichkeit,
- kein produktionsnaher Pilot ohne separate Gate-Entscheidungen.

## 6. Minimaler B12-Ergebnisvermerk nach dem Durchgang

Nach dem manuellen Durchgang genuegt ein kurzer B12-Ergebnisvermerk mit:

- Datum und Commit-SHA,
- Ergebnis von `npm run local:start`, `npm run local:status`, `npm run local:check` und `npm run local:stop`, soweit ausgefuehrt,
- betrachtete URLs: `http://127.0.0.1:3200/`, `http://127.0.0.1:3200/angebot`, `http://127.0.0.1:3200/produktion`,
- betrachtete sichtbare Marker: Beta-Weg, Angebots-HTML, Produktionsblatt, Einkaufsliste, Audit-Spur, `Agent fragt · offen`, `Agent fragt · beantwortet`, `Synthetische Demo-Antwort`,
- notierte Reibungspunkte,
- Ergebniszustand `go`, `blocked` oder `not assessed`,
- klare Nicht-Behauptung: keine Produktionsfreigabe, keine externe Freigabe und keine rechtssichere Audit-/Compliance-Aussage.

Fuehrender Ergebnisanker bleibt `docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md`; diese Checkliste liefert nur den manuellen Beta-Pruefpfad fuer Alexander.
