# P6-B61 Beta-Durchlauf als Management-Entscheidungsvorlage

Status: Doku-/Vertragstest-only Entscheidungsvorlage fuer Build Plan 6 Cycle P6-B61
Stand: 2026-05-23
Scope: Verdichtung des vorhandenen lokalen synthetischen Beta-Onboarding-Korridors; keine Produktlogik, keine UI-Aenderung, keine neue API, keine neue Persistenz, kein Deployment

## 1. Zweck

Diese Vorlage verdichtet den aktuellen Plan-6-Stand fuer Alexander als Management-Entscheidung:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Sie beantwortet knapp, was jetzt sinnvoll manuell testbar ist, wo gestoppt werden muss und welcher naechste Produktwertblock nur aus beobachteter Reibung abgeleitet werden soll. Sie baut keine neue Runtime-Funktion, keine QA-Plattform und keine Freigabewelt.

## 2. Eingeflossene Plan-6-Anker

| Anker | Verdichtete Aussage fuer die Entscheidung |
| --- | --- |
| P6-B56 | Der Beta-Onboarding-Iststand ist kartiert: Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates. |
| P6-B57 | Lokaler Start, Status, Check, relevante URLs und kontrolliertes Stoppen sind als Korridor gebuendelt. |
| P6-B58 | Reibung kann sicher und einheitlich ohne echte Daten notiert werden. |
| P6-B59 | Startseite, `/angebot` und `/produktion` markieren den Durchlauf als intern/synthetisch und nicht produktionsfreigegeben. |
| P6-B60 | `/produktion` benennt den Beta-Pruefpunkt Rueckfragenstatus, Produktionsobjekte und Export-/Auditanker; offene Stop-Punkte bleiben Stop statt Freigabe. |

## 3. Sofort manuell testbar

Sofort testbar ist nur der lokale interne Beta-Durchlauf, nur mit Demo-/Seed-/synthetischen Daten:

1. Lokal starten und pruefen:
   - `npm run local:start`
   - `npm run local:status`
   - `npm run local:check`
2. UI-Pfad manuell durchgehen:
   - `http://127.0.0.1:3200/`
   - `http://127.0.0.1:3200/angebot`
   - `http://127.0.0.1:3200/produktion`
3. Sichtbare Marker pruefen:
   - Beta-Weg `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`,
   - synthetische/interne Grenze,
   - Angebotsschritt, Angebots-HTML und Uebergabe zur Produktion,
   - Rueckfragenstatus, `Agent fragt · offen`, `Agent fragt · beantwortet` und ggf. synthetische Antwort,
   - Produktionsobjekte, Export-/Downloadanker und Audit-/Herkunftszonen,
   - offene Artefakte oder Stop-Punkte bleiben offen bzw. Stop.
4. Reibung mit `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` erfassen.
5. Lokal kontrolliert stoppen: `npm run local:stop`.

Ergebnisbewertung: `go`, `blocked` oder `not assessed` gilt nur fuer den internen Demo-/Beta-Korridor, nicht fuer Produktion oder echte Daten.

## 4. Stop-Gates

Der Durchlauf muss gestoppt und als `blocked` oder `Alexander-Entscheidung noetig` notiert werden, wenn eines davon fuer den naechsten Schritt gebraucht wuerde:

- echte Daten oder produktionsnahe Pilotdaten,
- Deployment, SSH-Verbindung, Server-, Domain-, TLS-, Proxy- oder IAP-Aenderung,
- Secrets, Tokens, produktive `.env` oder Connection Strings,
- neue API, neue Persistenz, Migration oder Prisma,
- OAuth/Login/OIDC, Session- oder Nutzerverwaltungswelt,
- automatische Spec-Korrektur aus Rueckfragenantworten,
- Rezept-/Allergenautomatik,
- Parser-/OCR-/LLM-/Tool-Use-Ausbau,
- PII/Retention/Backup-Entscheidung,
- Sandbox/Worker/AV-Entscheidung,
- rechtssichere Audit-, Compliance-, Signatur- oder Export-Verbindlichkeitsaussage.

## 5. No-go

No-go fuer P6-B61 und den unmittelbaren manuellen Beta-Durchlauf:

- keine echten Daten: keine Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten,
- kein Deployment,
- keine SSH-Verbindung,
- keine Secrets,
- keine neue API,
- keine neue Persistenz,
- keine Migration und kein Prisma,
- kein OAuth/Login/OIDC,
- keine automatische Spec-Korrektur,
- keine Rezept-/Allergenautomatik,
- keine Produktionsfreigabe,
- keine externe Freigabe,
- keine rechtssichere Audit-/Compliance-Aussage.

## 6. Entscheidung fuer Alexander

Empfehlung fuer den naechsten Management-Schritt:

**Alexander sollte jetzt genau einen manuellen lokalen Beta-Durchlauf nach P6-B57/P6-B58 machen und die Reibung notieren.**

Entscheidung:

- `go` fuer einen lokalen synthetischen Beta-Test mit Demo-/Seed-/synthetischen Daten.
- `blocked` fuer echte Daten, produktionsnahen Pilot, Deployment, Auth-/Proxy-/IAP-Ausbau, PII/Retention/Backup und Sandbox/Worker/AV, bis eigene Gates entschieden sind.
- `not assessed` fuer weitere Produktwertslices, solange kein konkretes Reibungslog vorliegt.

## 7. Naechster enger Produktwertblock nach Feedback

Es gilt: kein weiterer Mikroausbau ohne beobachtete Reibung.

Arbeitsregel nach Alexanders Test:

1. erst Reibungslog ausfuellen,
2. dann genau einen konkreten Reibungspunkt auswaehlen,
3. naechster kleiner UI-/Doku-/Smoke-Slice nur aus einem konkreten Reibungspunkt,
4. keine neue Feature-Familie und keine Gate-Umgehung,
5. wenn die Reibung eine Produkt-, Betriebs-, Datenschutz-, Sicherheits-, Rechts-, Freigabe-, API-, Persistenz-, Auth- oder Infrastrukturentscheidung beruehrt: stoppen und Entscheidungsvorlage schreiben.

Wenn keine echte Reibung beobachtet wird: stoppen und P6-B62 Full Gates/Lage vorbereiten, statt weiteren Mikroausbau zu erfinden.

Fuer Plan 7 konkretisiert `docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md` den ersten Rehearsal-Start: interner Reviewer, fiktive Testrolle, synthetisches Ziel, erlaubte Daten, Stop-Gates und der fuehrende Pfad `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` werden vor dem manuellen Durchlauf auffindbar gebuendelt.

## 8. P6-B61-Ergebnis

P6-B61 fuehrt keine Produktlogik ein. Der vorhandene lokale synthetische Beta-Korridor ist als Management-Entscheidungsvorlage verdichtet: sofort testbar ist der lokale Demo-/Seed-/synthetische Durchlauf; Stop-Gates und No-go-Grenzen bleiben sichtbar; der naechste Produktwertblock soll erst aus real beobachteter Reibung entstehen.
