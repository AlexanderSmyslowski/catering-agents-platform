# P6-B57 Lokaler Start-/Status-Korridor

Status: Doku-/Vertragstest-only Start-/Status-Anker fuer Build Plan 6 Cycle P6-B57
Stand: 2026-05-23
Scope: vorhandener lokaler Beta-Start und Statuscheck; keine neue Betriebsplattform, keine Produktlogik, keine API, keine Persistenz, kein Deployment

## 1. Zweck

Dieser Anker macht den lokalen internen Beta-Start vor dem manuellen Durchlauf eindeutig auffindbar:

`Starten -> Status pruefen -> Betriebscheck -> UI-Routen oeffnen -> kontrolliert stoppen`

Er baut keine neue Runtime-Funktion. Er ordnet nur die bestehenden Repo-Scripts, lokalen URLs, Health-Endpunkte und Stop-Regeln so, dass Alexander oder eine interne Testperson vor dem UI-Durchlauf weiss, ob der lokale Stack plausibel laeuft.

## 2. Kompakter Ablauf

| Schritt | Befehl / URL | Bedeutung | Wenn rot / unklar |
| --- | --- | --- | --- |
| 1 Starten | `npm run local:start` | startet den lokalen Stack mit Demo-Seeding in bestehenden `screen`-Sitzungen | lokalen Blocker dokumentieren, keine Infrastruktur- oder Featureannahme treffen |
| 2 Status pruefen | `npm run local:status` | lokale Prozess- und Erreichbarkeitsuebersicht fuer Services, Sessions und Ports | lokalen Blocker dokumentieren; Stack kontrolliert pruefen oder neu starten |
| 3 Betriebscheck | `npm run local:check` | lokaler Betriebs-/Seed-/Export-/Auditbeleg gegen den laufenden Stack | Check-Meldung notieren; nicht durch Featurebau ueberdecken |
| 4 UI-Routen oeffnen | `http://127.0.0.1:3200/`, `http://127.0.0.1:3200/angebot`, `http://127.0.0.1:3200/produktion` | Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit manuell betrachten | Reibung im Beta-Durchlauf notieren |
| 5 Kontrolliert stoppen | `npm run local:stop` | beendet lokale `screen`-Sitzungen und Repo-Prozesse | verbleibende Prozesse als lokalen Betriebsblocker notieren |

## 3. Relevante lokale URLs

### UI-Routen

- `http://127.0.0.1:3200/` — Startseite / Beta-Kontrollzentrum.
- `http://127.0.0.1:3200/angebot` — Angebotsagent fuer Anfrage, Entwurf, Angebots-HTML und Uebergabe.
- `http://127.0.0.1:3200/produktion` — Produktionsagent fuer Rueckfragen, Produktionsobjekte, Exporte und Audit-/Herkunftszonen.

### Health-Endpunkte

- `http://127.0.0.1:3101/health` — Intake-Service.
- `http://127.0.0.1:3102/health` — Offer-Service.
- `http://127.0.0.1:3103/health` — Production-Service.
- `http://127.0.0.1:3104/health` — Print-/Export-Service.

`npm run local:status` fasst diese lokale Erreichbarkeit als Prozess- und Portsicht zusammen. `npm run local:check` geht darueber hinaus und prueft den vorhandenen lokalen Betriebs-/Seed-/Export-/Auditbeleg.

## 4. Was Status und Check bedeuten

- `npm run local:status` ist nur eine lokale Prozess- und Erreichbarkeitsuebersicht. Ein gruener Status bedeutet: Der Stack wirkt lokal plausibel erreichbar.
- `npm run local:check` ist der lokale Betriebs-/Seed-/Export-/Auditbeleg. Ein gruener Check bedeutet: Die erwarteten Demo-/Seed-Anker, UI-Routen, Health-Endpunkte, read-only Exportpfade und der Demo-Start-/Auditbeleg sind im laufenden lokalen Stack nachvollziehbar.
- Beide Signale sind interne Beta-/Demo-Signale. Sie sind keine Produktionsfreigabe und keine rechtssichere Audit-/Compliance-Aussage.

## 5. Reaktion auf rote Signale

Wenn `npm run local:status` rot ist:

1. Nicht mit echten Daten weiterprobieren.
2. Nicht Deployment, SSH, Server, Secrets oder neue Infrastruktur anfassen.
3. Lokalen Blocker dokumentieren: betroffener Service, Port oder `screen`-Sitzung; sichtbare Fehlermeldung; naechster sicherer lokaler Schritt.
4. Falls sinnvoll: Stack kontrolliert mit `npm run local:stop` und `npm run local:start` neu starten.

Wenn `npm run local:check` rot ist:

1. Check-Meldung wortnah in den Beta-/B12-Ergebnisvermerk uebernehmen.
2. Als lokalen Betriebs- oder Demo-Datenstand behandeln.
3. Nicht durch Featurebau, Infrastrukturbehauptungen oder neue API-/Persistenzannahmen ueberdecken.
4. Erst nach kontrolliertem lokalem Neu-Start erneut pruefen.

## 6. Daten- und Freigabegrenzen

Dieser Korridor ist nur fuer Demo-/Seed-/synthetischen Daten gedacht. Er bleibt intern, lokal und beta-orientiert.

Verbindlich gilt:

- keine echten Daten: keine echten Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten,
- kein Deployment,
- keine SSH-Verbindung,
- keine Secrets, Tokens, produktive `.env` oder Connection Strings,
- keine neue Persistenz, keine Migration, kein Prisma,
- kein OAuth/Login/OIDC und keine Session- oder Nutzerverwaltungswelt,
- keine automatische Spec-Korrektur,
- keine Rezept-/Allergenautomatik,
- keine Produktionsfreigabe,
- keine externe Freigabe,
- keine rechtssichere Audit-/Compliance-Aussage.

## 7. P6-B57-Ergebnis

P6-B57 fuehrt keinen neuen Betriebspfad ein. Der lokale Beta-Start und Statuscheck sind nun als kompakter Korridor auffindbar und pruefbar: bestehende Befehle, relevante lokale URLs, Health-Endpunkte, Bedeutung von Status/Check sowie sichere Reaktion auf rote Signale sind an einer Stelle gebuendelt. Der naechste sichere Plan-6-Schritt bleibt die strukturierte Reibungserfassung in P6-B58, nicht Deployment, echte Daten oder Featurebau ausserhalb des synthetischen Beta-Korridors. P6-B58 ist in `docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md` als sichere Reibungslog-Vorlage fuer Beobachtung, Route, erwartetes/tatsaechliches Verhalten, Schweregrad, Screenshot-Hinweis ohne personenbezogene Daten und naechste Entscheidung verankert.
