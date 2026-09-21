# CateringOS eigenständiger Zielserver-Updateweg – Design

**Datum:** 2026-09-21
**Ausgangsstand:** `main` nach Merge von PR #682, Mergecommit `d6a9b8dbc0987c281c826a88697bddeeb51a9ff5`.

## Ziel
CateringOS erhält einen eigenen, fail-closed Updateweg für den bereits technisch übergebenen Server `catering-prod-1`. Der Updateweg darf die beim Serverübergang geschaffene Isolation nicht wieder mit der alten gemeinsamen Zeiterfassungs-/Compose-Infrastruktur verzahnen. Dieser Entwurf erlaubt noch kein Deployment.

## Nicht-Ziele
- Keine Änderung des alten `Deploy production`-Workflows für seinen historischen Einsatzbereich.
- Keine Nutzung von `zeiterfassung_default` auf dem Catering-Zielserver.
- Keine neue Infrastrukturplattform oder zweite Servermigration.
- Keine Änderung an DNS, öffentlichem Proxy, Firewall, SSH-Zugang, Backup-Provider oder Secrets.
- Keine Echtdatenmanipulation und keine automatische Deployment-Aktivierung.

## Autoritativer Zielzustand
Der Zielserver ist nach der versionierten Betriebsübergabe alleiniger Catering-Writer. Ein Update erhält: eigenständige Catering-Netze und Edge/Caddy-Konfiguration; PostgreSQL-Daten/Volumes; Zugangskonfiguration; Backup-/Restore-Regelbetrieb; Abwesenheit öffentlicher App-Hostports; eindeutigen installierten Commitnachweis. Fehler nach Mutationsbeginn dürfen nie als Erfolg enden.

## Architektur
Der neue Weg wird neben dem historischen Deploymentpfad aufgebaut.

### Eigenständiger Workflow
Neuer manueller GitHub-Actions-Workflow ausschließlich von `main`, mit eigenem Production-Environment und expliziter Zielserver-Konfiguration. Er ruft nur das neue Target-Update-Skript auf. `.github/workflows/deploy-production.yml` bleibt unverändert und wird nicht auf den neuen Server umgebogen.

### Target-Update-Skript
Neues Skript unter `platform-infra/scripts/` mit den Phasen:
**Read-only Preflight → Lock → Recovery Point → Sync/Build → kontrollierte Aktivierung → Smoke/Verifikation → Commitnachweis → Unlock.**
Vor der ersten Mutation werden Zielidentität, Verzeichnisstruktur, eigenständige Compose-/Runtime-Konfiguration, Datenbank-/Writerzustand und Backupfähigkeit geprüft.

### Zielserver-Konfiguration bleibt Eigentum des Zielservers
Repository-Sync überschreibt keine Secrets oder Betriebsdateien. Runtime-Environment, Edge/Caddy-Daten, DB-Volume, Backup-/Restore-Konfiguration und zielserverspezifische Bindungen bleiben erhalten bzw. werden explizit ausgeschlossen.

### Kein Rückfall auf alte Compose-Kette
Der Updateweg benutzt ausschließlich den abgenommenen eigenständigen Target-Compose-Vertrag. Fehlt eine eindeutige maschinenlesbare Bindung, stoppt die Implementierung vor produktiver Aktivierung und ergänzt zuerst einen getesteten geheimnisfreien Target-Vertrag. `zeiterfassung_default` und der alte base+production+edge-cutover-Stack sind verboten.

### Datenbank/Migrationen
Keine implizite destructive Migration. Erforderliche Migrationen laufen nur über den expliziten Migrationsmechanismus und sind an Backup-/Rollbackgrenzen gebunden. Code-Rollback ist nicht automatisch DB-Rollback. Nach Beginn nicht rückwärtskompatibler Datenänderungen gilt bei Fehlern `manual recovery required`.

### Recovery und Rücknahme
Vor Mutation wird ein nachweisbarer Recovery Point bzw. eine frische erfolgreiche Sicherung nach bestehendem Catering-Backupvertrag verlangt und der installierte App-Stand gebunden. Automatische Rücknahme erfolgt nur bei nachgewiesener Datenkompatibilität; sonst bleibt der Lock bestehen und der Lauf endet recovery-required.

### Erfolgsnachweis
Erfolg beweist mindestens: exakter Git-Commit; Zielserver-/Pfadbindung; unveränderte geschützte Betriebsdateien; unveränderte Netzwerkisolation; Servicegesundheit; authentisierte Read-Smokes; keine unerwarteten öffentlichen Ports; grüner Backup-/Recovery-Preflight; installierter Commitnachweis.

## Sicherheitsgrenzen
SSH strict host checking; keine Secrets in Logs/Git; nur exakter `main`-Commit; allowlisted/symlink-sichere Pfade; Locking gegen Parallelupdates; Lesefehler kritischer Zustände = Abbruch; kein Zugriff auf alten Host oder fremde Docker-Netze.

## Teststrategie
Vertragstests erzwingen mindestens:
1. Target-Vertrag fehlt oder referenziert `zeiterfassung_default` → Abbruch vor Mutation.
2. Zielpfad/Runtime/Netzwerk unerwartet → Abbruch.
3. Backup-/Recovery-Preflight nicht grün → keine Mutation.
4. Lock belegt/unklar → keine Mutation.
5. Sync/Build/Aktivierung scheitert → definierte Rücknahme oder recovery-required.
6. Smoke scheitert → kein Erfolg.
7. Netzwerkisolation/Portgrenze verletzt → Fehler + Rücknahmeversuch.
8. falscher/verschobener Commit → Abbruch.
9. Sync würde geschützte Zielkonfiguration löschen → Testfehler.

Positive Tests nutzen nur synthetische/isolierte Harnesses; kein echter Serverzugriff in Implementierungs-CI.

## Abnahmegrenze
Implementierung/CI können nur ein **GO zur Deploymentvorbereitung** liefern. Der erste echte Lauf gegen `catering-prod-1` bleibt gesondert freizugeben und beginnt mit frischer read-only Zielprüfung. Fachliche Küchen-, Rezept-/Allergen- und Zukaufsabnahmen werden dadurch nicht ersetzt.
