# P11-N3 Interner Pilot-Preflight-Runbook

Status: Doku-/Vertragstest-only Runbookanker fuer Nachtlauf Plan 11 Cycle P11-N3
Stand: 2026-05-24
Scope: knappe praktische Preflight-Checkliste fuer einen begrenzten internen Pilot ohne Deployment; keine echten Daten, kein produktionsnaher Pilot, keine neue Produktlogik, keine neue API, keine Persistenz, keine Auth/OIDC-Implementierung, keine Schedule-Runtime und keine Compliance-/DSGVO-Freigabe

## 1. Zweck

Dieses Runbook ordnet den bestehenden lokalen Preflight-Weg so, dass eine interne Testperson den begrenzten Pilot-Preflight mit Demo-/Seed-/synthetischen oder nachweisbar anonymisierten Daten vorbereitet, ohne versehentlich in Deployment, echte Daten oder produktionsnahe Nutzung zu wechseln.

Es baut keinen neuen Workflow und fuehrt kein neuer Workflow ein. Es verweist auf die vorhandenen lokalen Scripts, UI-Routen, Reibungslog-, Export-/Audit- und Option-A-Anker.

Fuehrende Repo-Anker:

- `docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md`
- `docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md`
- `docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md`
- `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md`
- `docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md`
- `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md`
- `docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md`

## 2. Harte Vorabgrenze

| Korridor | Status im Runbook | Bedeutung |
| --- | --- | --- |
| lokaler interner Pilot-Preflight mit Demo-/Seed-/synthetischen oder nachweisbar anonymisierten Daten | `go` fuer Preflight-Durchlauf | Nur lokal und nicht produktionsnah. Dient der internen Sichtung von Start, Angebot, Produktion, Rueckfragen, Exporten/Audit und Reibung. |
| begrenzter interner Pilot als echte Managementfreigabe | `not assessed` | Dieses Runbook bereitet nur Evidenz vor. Ein Pilot-Go muss spaeter bewusst entschieden werden. |
| produktionsnaher Pilot, echte Daten oder Deployment | `blocked` | Nicht starten. Sofort stoppen und als `blocked` oder `decision needed` berichten. |

Ein lokaler Preflight-Erfolg ist kein Deployment-Go, kein Produktionsfreigabe-Go, kein Auth-/Compliance-Go und keine rechtssichere Audit-Aussage.

## 3. Praktische Preflight-Checkliste

### Schritt 1: Datenkorridor bestaetigen

- Nur Demo-/Seed-Daten, offensichtlich synthetische Daten oder nachweisbar anonymisierte Testdaten nutzen.
- Keine echten Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten eingeben, hochladen, anzeigen, exportieren oder dokumentieren.
- Keine produktionsnahen Dateien, echten PDFs, echten E-Mails, echten Pages-Dateien, Logos, Signaturen, Metadaten oder Buchhaltungs-/Drive-/Mail-Inhalte verwenden.
- Bei Unsicherheit: Stop statt Eingabe.

### Schritt 2: Lokalen Stack starten

Standardweg:

```bash
npm run local:start
```

Der Startweg bleibt lokaler Demo-/Preflight-Betrieb. Kein Deployment, keine SSH-Verbindung, keine Secrets, keine produktive `.env`, keine Domain/TLS/Proxy-Aktion.

### Schritt 3: Status pruefen

```bash
npm run local:status
npm run local:check
```

Erwartung:

- `npm run local:status` zeigt lokale Prozess-/Port-/Screen-Plausibilitaet.
- `npm run local:check` prueft vorhandene Health-Endpunkte, UI-Routen, read-only Exportpfade und den Demo-Start-/Auditbeleg.

Wenn Status oder Check rot ist: nicht improvisieren, keinen neuen Betriebsweg bauen, Reibung als `fix`, `blocked` oder `decision needed` notieren.

### Schritt 4: UI-Routen manuell oeffnen

Im laufenden lokalen Stack:

- `http://localhost:3200/` fuer Start und Beta-/Preflight-Grenze,
- `http://localhost:3200/angebot` fuer Anfrage, Angebotsentwurf, Angebots-HTML und Uebergabe,
- `http://localhost:3200/produktion` fuer Rueckfragen, Produktionsobjekte, Einkaufsliste, Exporte, Herkunft und Auditanker.

Pruefen, ob der Pfad `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` mit erlaubten Daten nachvollziehbar ist. Keine echten Freitexte, keine echten Uploads und keine personenbezogenen Screenshots verwenden.

### Schritt 5: Reibung notieren

Reibung in der Struktur aus `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` festhalten:

- Route oder Schritt,
- Erwartung,
- tatsaechliches Verhalten,
- Schweregrad,
- sichere Screenshot-Notiz ohne personenbezogene Daten,
- Triage: `go`, `fix`, `blocked` oder `decision needed`.

Triage-Regel:

- `go`: Preflight ist lokal mit erlaubten Daten nachvollziehbar.
- `fix`: kleine Copy-/Doku-/Smoke-/bestehende UI-Lesbarkeitsreibung ohne Stop-Gate.
- `blocked`: echte Daten, produktionsnahe Nutzung, Deployment, Auth/OIDC, neue API/Persistenz, Sandbox/Worker/AV, Retention/Backup oder Compliance waeren noetig.
- `decision needed`: Alexander muss einen nicht-technischen oder produkt-/betriebsrelevanten Punkt entscheiden, z. B. Nutzerkreis, Zielumgebung, Zugriffskontext oder spaetere strukturierte Schedule-Loesung.

### Schritt 6: Export-/Auditbelege read-only pruefen

Nur vorhandene read-only Belege sichten:

- Angebots-HTML,
- Produktionsplan-/Produktionsblatt-HTML,
- Einkaufslisten-CSV,
- Audit-/Herkunftsanker der letzten Operator-Aktionen.

Diese Belege sind interne Arbeits- und Kontrollbelege. Sie beweisen keine rechtssichere Audit-/Compliance-Aussage, keine externe Freigabe und keine Produktionsfreigabe.

### Schritt 7: Option-A-Zeitfenstergrenze beachten

Das verbindliche Zeitfenster bleibt nach R4 Option A:

- Zeitfenster manuell klaeren und als Rehearsal-/Preflight-Notiz festhalten,
- keine strukturierte Schedule-/Zeitfenster-Runtime,
- keine automatische oder halbautomatische `event.schedule`-Uebernahme,
- kein neues Schedule-Datenmodell,
- keine neue API, Persistenz, Prisma oder Migration,
- keine automatische Spec-Korrektur.

Wenn der Preflight nur mit automatischer Zeitfensterverarbeitung sinnvoll erscheint, ist das `decision needed` und kein P11-N3-Fix.

### Schritt 8: Kontrolliert stoppen

Nach dem Preflight:

```bash
npm run local:stop
npm run local:status
```

Erwartung: lokale Demo-/Preflight-Prozesse sind beendet oder der Status zeigt klar, was noch laeuft. Kein produktiver Betrieb, kein Hintergrund-Deployment und keine produktive Nutzung offen lassen.

## 4. Stop-Gates

Sofort stoppen und nicht weiterbauen bei Bedarf fuer:

- echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten,
- produktionsnaher Pilot oder externe Nutzung,
- Deployment, Hetzner, SSH, Secrets, produktive `.env`, Domains, TLS, Proxy/IAP,
- OAuth/Login/OIDC/Session/Nutzerverwaltung,
- neue API, API-Vertragsaenderung, neue Persistenz, Prisma, Migration,
- Retention-/Loesch-/Backup-Entscheidung,
- Sandbox-/Worker-/AV-Freigabe fuer echte oder beliebige Uploads,
- rechtssichere Compliance-/DSGVO-/Audit-/Signaturfreigabe,
- Runtime-Schedule-/Zeitfenster-Modell oder automatische Spec-Korrektur,
- Rezept-/Allergenautomatik oder LLM-/Tool-/Parser-/OCR-Ausweitung.

## 5. Ergebnis von P11-N3

Der begrenzte interne Pilot-Preflight ist als knappe lokale Checkliste nutzbar: Starten, Status pruefen, UI-Routen sichten, Reibung triagieren, Export-/Auditbelege read-only pruefen, Option-A-Zeitfenstergrenze beachten und kontrolliert stoppen.

P11-N3 fuehrt keine Runtime-, UI-, API-, Persistenz-, Deployment-, Auth-, Daten-, Schedule- oder Compliance-Aenderung ein.
