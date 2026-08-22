# Phase-3 Catering-Pilot – Snapshot

Datum: 2026-08-22
Status: dokumentarisch geprüft; keine Runtime- oder Deploymentfreigabe

## Zweck und Belege

Dieser Snapshot verdichtet den verbindlichen Phase-3.0/3.1-Vertrag aus dem [aktuellen Plan](../superpowers/plans/2026-08-20-server-app-isolation-phase3.md) und ergänzt die führende [Root-Memory](../../memory.md). Phase 2 ist mit `PHASE 2: GO` durch Evidence Run `32596742623` auf Main `b3d7b4b528f4762e07198ef1305b9844a98b62f9` belegt. Diese Belege beschreiben den Ausgangszustand; sie starten keinen Pilot und ersetzen keine spätere Implementierungs-, Review-, CI- oder Git-Freigabe.

## Freigegebener Pilotumfang

- Der Pilot betrifft ausschließlich Catering sowie die additive Shared-Edge-Mitgliedschaft auf dem externen Netz `catering_ingress`.
- Catering besitzt und verwaltet `catering_ingress` und `catering_private`. Beide Netze sind `external: true`; Engine-Zustand, stabile Owner-/Phase-/Kind-Labels, `driver=bridge`, `scope=local`, Default-IPAM und exakte Mitgliedschaften werden vor jeder Mutation geprüft. `catering_private` bleibt deterministisch `internal=false`: „private“ bedeutet exakte Mitgliedschaft, keine Shared-Edge-Mitgliedschaft der internen Dienste und keine veröffentlichten Hostports. Ein ausdrücklich aktivierter Fachquellen-/Rezeptanbieter-HTTPS-Pfad bleibt damit möglich und erhält nur den erlaubten nicht-sensitiven Funktionsnachweis; bei deaktivierter Funktion wird nichts erzwungen.
- Im finalen Pilotzustand hängt Catering `web` ausschließlich an `catering_ingress` und `catering_private`; `postgres`, `intake`, `offer`, `production` und `exports` hängen ausschließlich an `catering_private`. Der interne Upstream bleibt `http://web:8081`; interne Dienste haben keine Hostports.
- Shared Edge darf nur als separat gelockter Consumer `catering_ingress` beitreten, niemals `catering_private`; bestehende Shared-Edge-Kompatibilitätsnetze bleiben für die noch nicht migrierten Fremd-Apps erhalten. Nur Catering `web` trägt auf `catering_ingress` den Alias `web`; Edge verwendet dort ausschließlich seine eigene Edge-Identität und darf nicht als `web` erscheinen.
- Alte Pfade werden additiv beibehalten und erst nach vollständigen Stufen-Smokes und Fremd-App-Invarianten owner-scoped einzeln getrennt. Keine Kompatibilitätsnetze werden pauschal gelöscht.

## Geschützte Fremd-App-Invarianten

Vor und nach jeder Mutation gelten für Zeiterfassung, EventOS und Iranmonitor unverändert: voller Container-ID, `RestartCount`, Status, `StartedAt`, Image, Compose-Projekt/Service/Container-Identität, exakte Netzwerk-IDs und Aliase sowie Host-Portbindungen. Jede Abweichung, fehlende Identität, zusätzliche Ressource oder unbekannte Mitgliedschaft ist `NO-GO`.

Iranmonitor bleibt auf der statischen Allowlist `deploy-web-1`, `deploy-ingest-1` und `deploy-db-1` im `deploy`-Projekt auf `deploy_default` mit den im Plan festgelegten Images und Portbindungen. Keine weiteren Iranmonitor-/Deploy-Container werden akzeptiert; Iranmonitor wird nie verbunden, getrennt, neugestartet, recreatet oder umkonfiguriert.

## Harte Verbote

- Kein Pilot im Dokumentations- oder Implementierungsturn: kein `compose up`, Recreate, Restart, Server-/SSH-Zugriff, Workflow-Dispatch, Deployment, DNS-, TLS-/ACME-, Caddy-, Upstream-, Hostname-, Port-, Image-, Volume-, Secret-, Datenbank- oder Appcode-Eingriff.
- Keine Fremd-App-Mutation. Shared Edge darf nicht neu erstellt oder neugestartet werden, wenn nur die additive Netzmitgliedschaft verbunden wird.
- Keine pauschale Netzlöschung, kein `prune`, kein Entfernen vorbestehender oder fremder Netze. Ein Netz darf im Rollback nur entfernt werden, wenn es in diesem Lauf erstellt wurde und nach exakter ID-/Label-/Parameterprüfung leer sowie frei von Fremd-Consumern ist.

## Zustandsautomat und Locks

Der Aktivierungsmarker liegt unter `/opt/catering-phase3/phase3.activation`. `absent`/`inactive` bezeichnet den stabilen aktuellen Phase-2-Shared-Edge-Zustand; `candidate` bezeichnet einen laufenden Pilot; `active` bezeichnet vollständig aktivierte Phase 3.1; `rolling_back` bezeichnet laufende Wiederherstellung. Normale mutierende Deploy-, Recovery-, Cutover- und Rollback-Caller blockieren bei `candidate` und `rolling_back` fail-closed.

Die markergebundenen Felder sind ausschließlich `schema`, `state`, `owner`, `platform_override_sha256`, `edge_override_sha256`, `catering_ingress_id` und `catering_private_id`. `mode` und der gerenderte Compose-/Konfigurationshash werden separat aus Ausführungskontext und Evidence-Manifest validiert; sie sind keine Markerfelder. Container-IDs sind keine Konfigurationsgeneration.

Die Locks werden immer in dieser Reihenfolge gehalten: zuerst `/opt/catering-agents-platform.deploy-lock`, dann `/opt/shared-edge.deploy-lock`; Freigabe erfolgt umgekehrt. Workflow-Concurrency ersetzt diese Host-Locks nicht. Geschützte Platform-/Edge-Overrides und der Marker liegen außerhalb allgemeiner `rsync --delete`-Bäume und werden nur durch die lockgebundene Marker-/Source-Transaktion geändert.

## Aktivierung, Rollback und terminale Ergebnisse

Der Pilot installiert und hashprüft beide geschützten Source-Kopien atomar, schreibt `candidate` vor der ersten Netzmutation und liest ihn vollständig zurück. Nach jeder erfolgreichen Netzwerkerstellung wird der bestätigte ID-Fortschritt atomar in `candidate` fortgeschrieben. Erst nach vollständiger Migration und Evidenz darf ein nichtterminaler `PILOT: GO CANDIDATE` folgen; erst ein vollständig zurückgelesener `active`-Marker mit beiden Source-Hashes und Netzwerk-IDs sowie abschließende Invarianten/Smokes erlauben terminal `PILOT: GO`.

Rollback erzeugt `rolling_back` atomar aus dem letzten bestätigten Pilotzustand. Jedes Ressourcenfeld darf dort `absent` oder den vollständig bestätigten Hash/die bestätigte ID als unveränderliche Provenienz tragen; eine fortbestehende Live-Ressource wird während des Rückbaus nicht behauptet. Nur der Pilot-Helper darf unter beiden Locks fortfahren und prüft jeden Schritt gegen Baseline-/Rollbackmanifest: Quellen bzw. Abwesenheit wiederherstellen, alte Kompatibilitätsmitgliedschaften und Aliase additiv zurückbringen, Smokes/Invarianten prüfen, neue Mitgliedschaften einzeln entfernen und nur berechtigte, im Lauf erstellte leere Netze entfernen. Erst nach vollständiger Wiederherstellung wird der exakte vorherige `absent`-/`inactive`-Zustand atomar geschrieben und gelesen; dann darf `PILOT: ROLLED BACK` ausgegeben werden. Bei jedem Fehler bleibt `rolling_back` bestehen und das Ergebnis ist `PILOT: NO-GO`.

## GO-Grenzen und Folgegates

`PILOT: GO` ist nur nach aktivem Marker-Readback, vollständigem Evidence-Manifest, öffentlichen Catering-Smokes, Isolation der fünf privaten Dienste vom Edge und allen Fremd-App-Invarianten zulässig. Der Phase-2-Evidencepfad bewertet `candidate`, `active` und `rolling_back` nicht; ein separater Phase-3-Pilothelper ist dafür zuständig.

Nach erfolgreichem Catering-Pilot, Evidence-Dokumentation und Abnahme wird hart vor jeder Zeiterfassungs-, EventOS- oder Iranmonitor-Netzmutation gestoppt. Phase 3.2 und 3.3 bleiben neue Risikogates mit eigenen Owner-Inventaren, Source-/Compose-Verträgen, Reviews und technischen Freigaben. Dieser Snapshot, `memory.md` und der [Plan](../superpowers/plans/2026-08-20-server-app-isolation-phase3.md) dokumentieren Grenzen; sie führen keine Runtime- oder Produktionsaktion aus.
