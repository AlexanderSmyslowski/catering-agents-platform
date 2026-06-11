# B36 Backup-Retention-Entscheidungsanker fuer Option-B-Pilot

Status: Doku-/Vertragstest-only Entscheidungsanker; keine Backup-Aktivierung, kein Deployment-Go, kein Echtdaten-Go und keine rechtssichere Compliance-/DSGVO-Freigabe
Stand: 2026-05-24
Scope: Backup-Retention fuer den Option-B-Pilot als nicht-sensitive Managemententscheidung dokumentierbar machen; keine echten Backups, keine Restore-Tests, keine Serverzugriffe, keine echten Daten, keine Secrets, keine IPs/Hostnames, keine produktiven Logs und keine neue API/Persistenz/Migration

## 1. Zweck

B36 schliesst den offenen Punkt aus B34/B35 zur konkreten Backup-Retention fuer den spaeteren Option-B-Pilot.

Ziel: Managemententscheidung dokumentierbar machen, nicht Backup technisch aktivieren.

B36 ist damit nur ein Entscheidungsanker. Das Dokument darf nicht als Backup-Aktivierung, Restore-Test, Deployment-Go, Echtdaten-Go oder Compliance-/DSGVO-Freigabe gelesen werden.

Fuehrende Eingaben:

- `docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md`
- `docs/deployment/B35_OPTION_B_PREPARATION_BOUNDARY.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`

## 2. Ergebnisstatus

Ergebniswert: `backup retention recommendation documented`.

Bedeutung:

- Die Backup-Retention ist als Managemententscheidung vorbereitet.
- Empfehlung ist ein Pilot-Default, keine technische Konfiguration.
- Alexander kann 7, 14 oder 30 Tage bewusst abweichend entscheiden.
- Ohne separate Freigabe bleibt daraus kein Serverlauf, kein Backup-Job, kein Restore-Test und kein echter Datenstart ableitbar.

## 3. Optionenvergleich

| Option | Nutzen | Grenze / Risiko | Einordnung |
| --- | --- | --- | --- |
| 7 Tage | 7 Tage: minimale Datenhaltung, weniger Wiederherstellungsfenster. | Sehr knappes Wiederherstellungsfenster bei spaet bemerkten Bedien-, Import- oder Planungsfehlern. | Datenschutzfreundlich, aber operativ fuer Pilotbetrieb eher knapp. |
| 14 Tage | 14 Tage: empfohlener MVP-Default, pragmatisches Wiederherstellungsfenster bei ueberschaubarer Datenhaltung. | Erfordert weiterhin klare manuelle Loesch-/Stop-Disziplin und getrennte Compliance-Klaerung. | Empfohlener Pilot-Default, wenn Alexander nichts anderes entscheidet. |
| 30 Tage | 30 Tage: mehr Sicherheit gegen spaete Fehler, aber laengere Datenhaltung und hoehere Datenschutz-/Betriebsdisziplin. | Laengeres Vorhalten echter Arbeitsdaten; Datenschutz-, Loesch- und Betriebsdisziplin muessen belastbarer sein. | Nur bewusst waehlen, wenn spaete Wiederherstellung hoeher priorisiert wird als minimale Datenhaltung. |

## 4. Empfehlung

Empfehlung: 14 Tage als Pilot-Default, sofern Alexander nichts anderes entscheidet.

Begruendung:

- 14 Tage bleiben enger als eine laengere 30-Tage-Haltung.
- 14 Tage geben mehr operativen Spielraum als 7 Tage, falls ein Fehler erst nach einigen Tagen auffaellt.
- 14 Tage passen zum konservativen MVP-Ansatz: begrenztes Wiederherstellungsfenster, aber keine uebermaessige Datenhaltung.
- Die Entscheidung bleibt Management-/Betriebsentscheidung und ersetzt keine Rechts-, DSGVO-, TOM-, AVV- oder technische Backup-/Restore-Freigabe.

## 5. Harte Grenzen

B36 aktiviert kein Backup.
B36 prueft keinen Restore.
B36 erlaubt keinen Serverlauf.
B36 ersetzt keine Compliance-/DSGVO-Freigabe.

Nicht Teil von B36:

- keine echten Backups,
- keine Restore-Tests,
- keine Serverzugriffe,
- keine SSH-Verbindung,
- keine Serveraenderung,
- keine echten Daten,
- keine echten Uploads,
- keine Secrets,
- keine produktive ENV,
- keine IPs/Hostnames,
- keine produktiven Logs,
- keine neue API/Persistenz/Migration,
- keine rechtssichere Compliance-/DSGVO-/AVV-Freigabe.

## 6. Stop-Regeln

Sofort `blocked` oder `stop`, wenn fuer diesen Schritt eines der folgenden Dinge noetig wuerde:

- echte Infrastrukturwerte,
- Serverzugriff oder SSH,
- produktive ENV,
- Secrets, Tokens oder private SSH-Keys,
- echte Kunden-, Event-, Angebots-, Produktions- oder Dokumentdaten,
- echte Uploads,
- Backup-Job-Konfiguration,
- Restore-Test,
- produktive Logauszuege,
- IPs, Hostnamen, Serverdetails oder Tailnet-/Geraetedetails,
- neue API, neue Persistenz, Prisma oder Migration,
- rechtliche Freigabe oder DSGVO-/AVV-Bewertung im Repo.

## 7. Naechster sicherer Schritt nach B36

Nach B36 ist sicher nur dokumentiert:

- Backup-Retention-Empfehlung: 14 Tage als Pilot-Default.
- Alexander kann diese Empfehlung bewusst bestaetigen oder auf 7 beziehungsweise 30 Tage aendern.
- Ein spaeterer technischer Vorbereitungsschritt braucht weiterhin eine separate Freigabe und muss ohne sensible Werte starten.

Nicht ableitbar:

- kein Deployment-Go,
- kein Echtdaten-Go,
- kein Backup-Go,
- kein Restore-Go,
- kein Upload-Go,
- keine Compliance-/DSGVO-Freigabe.

## 8. Definition of Done

B36 ist erfuellt, wenn:

- dieser Entscheidungsanker im Repo auffindbar ist,
- 7 Tage, 14 Tage und 30 Tage kurz verglichen sind,
- 14 Tage als Pilot-Default empfohlen sind, sofern Alexander nichts anderes entscheidet,
- B36 nicht als Backup-Aktivierung, Deployment-Go oder Echtdaten-Go gelesen werden kann,
- `entfernter Doku-Contract-Test` gruen ist,
- `TESTING.md` und `memory.md` fortgeschrieben sind,
- `git diff --check` gruen ist.
