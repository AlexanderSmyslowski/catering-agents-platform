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

Vor und nach jeder Mutation gelten für Zeiterfassung, EventOS, Iranmonitor und Shared Edge unverändert: voller Container-ID, `RestartCount`, Status, `StartedAt`, Image, Compose-Projekt/Service/Container-Identität, exakte fremde Netzwerk-IDs und Aliase sowie Host-Portbindungen. Die Catering-Mitglieder in `platform-infra_default` und `zeiterfassung_default` folgen dagegen ausschließlich der stage-aware Transitionsmatrix im Plan; eine Catering-Detach-Abweichung von der dortigen Sollmenge ist `NO-GO`, eine unveränderte Gesamtmitgliedschaft nach jedem Detach wäre hingegen widersprüchlich.

Iranmonitor bleibt auf der statischen Allowlist `deploy-web-1`, `deploy-ingest-1` und `deploy-db-1` im `deploy`-Projekt auf `deploy_default` mit den im Plan festgelegten Images und Portbindungen. Keine weiteren Iranmonitor-/Deploy-Container werden akzeptiert; Iranmonitor wird nie verbunden, getrennt, neugestartet, recreatet oder umkonfiguriert.

## Harte Verbote

- Kein Pilot im Dokumentations- oder Implementierungsturn: kein `compose up`, Recreate, Restart, Server-/SSH-Zugriff, Workflow-Dispatch, Deployment, DNS-, TLS-/ACME-, Caddy-, Upstream-, Hostname-, Port-, Image-, Volume-, Secret-, Datenbank- oder Appcode-Eingriff.
- Keine Fremd-App-Mutation. Shared Edge darf nicht neu erstellt oder neugestartet werden, wenn nur die additive Netzmitgliedschaft verbunden wird.
- Keine pauschale Netzlöschung, kein `prune`, kein Entfernen vorbestehender oder fremder Netze. Ein Netz darf im Rollback nur entfernt werden, wenn es in diesem Lauf erstellt wurde und nach exakter ID-/Label-/Parameterprüfung leer sowie frei von Fremd-Consumern ist.

## Zustandsautomat und Locks

Der Aktivierungsmarker liegt unter `/opt/catering-phase3/phase3.activation`. `absent`/`inactive` bezeichnet den stabilen aktuellen Phase-2-Shared-Edge-Zustand; `candidate` bezeichnet einen laufenden Pilot; `active` bezeichnet vollständig aktivierte Phase 3.1; `rolling_back` bezeichnet laufende Wiederherstellung. Normale mutierende Deploy-, Recovery-, Cutover- und Rollback-Caller blockieren bei `candidate` und `rolling_back` fail-closed.

Der feste kanonische, geschützte und nicht geheime Transaktions-/Baseline-Manifestpfad lautet `/opt/catering-phase3/phase3.transaction-baseline.manifest`. Pro Pilotlauf enthält die unveränderliche, deterministisch serialisierte Datei eine streng validierte eindeutige `transaction_id` (nur Datenwert/Owner- und Transaction-Label, niemals Pfadbestandteil), den vorherigen Markerzustand, Source-Präsenz/-Hashes und genaue owner-scoped Rollbackartefakte, Netzwerk-Präsenz/IDs/Ownerlabels/Parameter/Members/Aliase, die `created_by_run`-Berechtigung sowie die vollständige Fremd-App-Baseline. Für run-erstellte Netze ist neben den Owner-/Phase-/Kind-Labels exakt `com.catering.transaction=<transaction_id>` gebunden. Secrets, Env-Werte, Datei-/Mount-Inhalte und Credentials sind ausgeschlossen. Die Datei liegt außerhalb aller rsync/delete-/Snapshot-/Restore-Bäume, wird unter beiden Locks vor jeder Source- oder Netzmutation atomar installiert, vollständig zurückgelesen und gehasht und bleibt während des gesamten Piloten/aktiven Zustands unverändert. Fortschritt, Smokes, Modus und gerenderte Config gehören ausschließlich in ein separates Evidence-/Laufmanifest.

Die markergebundenen Felder sind für `candidate`, `active` und `rolling_back` exakt `schema`, `state`, `owner`, `platform_override_sha256`, `edge_override_sha256`, `catering_ingress_id`, `catering_private_id` und `transaction_manifest_sha256=<64hex>`. `transaction_manifest_sha256` muss exakt den SHA-256-Hash des kanonischen Baseline-Manifests binden; fehlt die Datei, stimmt der Hash oder der Transaktions-/Ownerlabel-Kontext nicht, bleibt jede Recovery/Mutation fail-closed blockiert. `inactive` verwendet `transaction_manifest_sha256=absent` und darf stattdessen vollständig absent sein. `mode` und der gerenderte Compose-/Konfigurationshash werden separat aus Ausführungskontext und Evidence-/Laufmanifest validiert; sie sind keine Markerfelder. Container-IDs sind keine Konfigurationsgeneration.

Die Locks werden immer in dieser Reihenfolge gehalten: zuerst `/opt/catering-agents-platform.deploy-lock`, dann `/opt/shared-edge.deploy-lock`; Freigabe erfolgt umgekehrt. Workflow-Concurrency ersetzt diese Host-Locks nicht. Geschützte Platform-/Edge-Overrides, der Marker und das Baseline-Manifest liegen außerhalb allgemeiner `rsync --delete`-Bäume und werden nur durch die lockgebundene Transaktion geändert.

## Aktivierung, Rollback und terminale Ergebnisse

Die atomare Reihenfolge lautet: beide Locks → vollständige Baseline erfassen → kanonisches unveränderliches Manifest atomar installieren, vollständig lesen und hashen → beide inerten Sources atomar installieren und readback/hashprüfen → `candidate` mit `transaction_manifest_sha256` atomar schreiben und vollständig lesen → erst danach die erste Netzmutation. Nach jeder erfolgreichen Netzwerkerstellung wird der bestätigte ID-Fortschritt atomar in `candidate` fortgeschrieben, ohne das Baseline-Manifest zu verändern. Erst nach vollständiger Migration und separatem Evidence-/Laufmanifest darf ein nichtterminaler `PILOT: GO CANDIDATE` folgen; erst ein vollständig zurückgelesener `active`-Marker mit demselben Manifesthash, beiden Source-Hashes und Netzwerk-IDs sowie abschließende Invarianten/Smokes erlauben terminal `PILOT: GO`.

Rollback nutzt ausschließlich das durch den Markerhash gebundene kanonische Manifest. Es schreibt `rolling_back` atomar unter beiden Locks mit demselben `transaction_manifest_sha256`, stellt daraus die exakte vorherige Source-Präsenz/-Hashes und owner-scoped Rollbackartefakte sowie die alten Catering-/Edge-Mitgliedschaften/Aliase wieder her, prüft Invarianten und Smokes und entfernt neue Mitgliedschaften einzeln. Ein Netz gilt nur dann als `created-by-run`, wenn die vorab gebundene Baseline seine Abwesenheit und Berechtigung ausweist und die Live-Ressource die exakte Owner-/Transaction-Labelbindung trägt; ein stale/ungebundenes Manifest genügt nie. Erst nach vollständigem Restore, Invarianten und Smokes darf der Manifestbeweis kontrolliert als separate Evidence archiviert, der kanonische Baselinepfad entfernt und der alte exakte `absent`-/`inactive`-Markerzustand atomar geschrieben und gelesen werden. Bei Prozess-, SSH-, Workflow-, Host- oder sonstigem Fehler bleiben `rolling_back` und das gebundene Manifest erhalten; normale Caller bleiben blockiert und das Ergebnis ist `PILOT: NO-GO`.

## GO-Grenzen und Folgegates

`PILOT: GO` ist nur nach aktivem Marker-Readback, erfolgreicher Marker ↔ kanonisches Manifest ↔ Hash-/Transaktionskontext-Validierung, vollständigem separatem Evidence-/Laufmanifest, öffentlichen Catering-Smokes, Isolation der fünf privaten Dienste vom Edge und allen Fremd-App-Invarianten zulässig. Alle normalen mutierenden Caller müssen diese Bindung vor jeder Mutation validieren; `candidate` und `rolling_back` bleiben blockiert. Der Phase-2-Evidencepfad bewertet `candidate`, `active` und `rolling_back` nicht; ein separater Phase-3-Pilothelper ist dafür zuständig.

Nach erfolgreichem Catering-Pilot, Evidence-Dokumentation und Abnahme wird hart vor jeder Zeiterfassungs-, EventOS- oder Iranmonitor-Netzmutation gestoppt. Phase 3.2 und 3.3 bleiben neue Risikogates mit eigenen Owner-Inventaren, Source-/Compose-Verträgen, Reviews und technischen Freigaben. Dieser Snapshot, `memory.md` und der [Plan](../superpowers/plans/2026-08-20-server-app-isolation-phase3.md) dokumentieren Grenzen; sie führen keine Runtime- oder Produktionsaktion aus.

## Dokumentationsscope dieser Korrektur

Diese Korrektur ändert genau drei bereits im PR enthaltene Dateien: den [Plan](../superpowers/plans/2026-08-20-server-app-isolation-phase3.md), [`memory.md`](../../memory.md) und diesen Snapshot. Es gibt keine Runtime-, Server-, SSH-, Workflow-, Docker-, Netzwerk-, Deployment- oder Git-Metadatenaktion.

## Exact-Head-Review-Korrektur (P1/P2, 2026-08-23)

### P1 – Post-create marker gap

Root Cause: Nach erfolgreichem `docker network create` konnte der Prozess vor dem geforderten Candidate-Readback ausfallen. Das unveränderliche Manifest meldete weiterhin `absent`, während die Live-Ressource bereits existierte; eine normale ID-Gleichheitsprüfung blockierte dadurch Recovery und Rollback. Die einzige erlaubte Ausnahme ist eine manifestgebundene Adoption: Baseline `absent` und `created_by_run_authorized=true`, exakt ein Zielnetz pro erwarteten Namen, exakte Owner-/Phase-/Kind-/`com.catering.transaction`-Labels und Engine-Parameter, identischer `transaction_id`-/Manifesthash-Kontext sowie exakt stage-konforme Mitglieder/Aliase/Host-Portbindungen (im unmittelbaren Create-Fenster leer). Der Helper schreibt dessen volle ID atomar in den zustandsgebundenen Candidate- oder `rolling_back`-Beweis, liest zurück und setzt erst dann deterministisch fort oder rollt owner-scoped zurück. Name-only-Adoption, fremde Labels, Mehrdeutigkeit, ein zweites Netz für denselben Namen oder zusätzliche Mitglieder bleiben `NO-GO`.

Die Create-Reihenfolge ist `catering_ingress` vor `catering_private`. Zwischen den Creates wird nur ein exakt transaktionsgelabeltes ingress-Netz mit privatem Ziel `absent` adoptiert; ein privates Netz ohne ingress ist out of order. Sind beide Creates vor dem Fortschritts-Readback abgeschlossen, dürfen beide nur als genau ein Treffer pro erwartetem Namen gemeinsam atomar übernommen werden. Pre-existing-exact-Netze werden nie adoptiert oder entfernt.

### P2 – Stage-aware compatibility invariants

Die unveränderlichen Fremd-App-Invarianten bleiben zu jedem Zeitpunkt exakt: IDs, `RestartCount`, Status/`StartedAt`, Images, Compose-Identitäten, Fremd-Netzwerk-IDs/Aliase und Portbindungen für Zeiterfassung, EventOS, Iranmonitor und Shared Edge. Nur die Catering-Mitgliedschaft darf in der expliziten Reihenfolge `postgres → intake → offer → production → exports → web von zeiterfassung_default → web von platform-infra_default` abnehmen. Die Sollmengen `S0` Baseline, `S1` Candidate, `S2` neue leere Netze, `S3` additive Mitglieder, `D1`–`D5` je ein interner Detach, `D6` Web-Detach aus Zeiterfassung und `S4` final active sind im Plan mit vollständigen Container-/Alias-Sets festgelegt. Kein Fremd-App-Detach, kein nicht autorisierter Catering-Detach und kein Zusatzmitglied ist zulässig. Der letzte belegte Catering-Compatibility-Consumer eines Kompatibilitätsnetzes wird erst nach grüner Ersatzroute und vollständigen Smokes getrennt; die Netze bleiben wegen ihrer Fremd-Consumer bestehen. Rollback stellt exakt die `S0`-Mitgliedschaften einschließlich Aliase wieder her.

Die statischen Assertions müssen beide Korrekturen abdecken: Crash-Gap/Label-/Manifestbindung, exact-one adoption, Zwei-Netze- und Between-Create-Zustände, stage-aware Transitionsmatrix, unveränderte Fremd-App-Invarianten, last-consumer-Smoke-Gate und exakte Rollback-Baseline. Diese Ergänzung bleibt dokumentarisch und ist keine Runtime-, Deployment- oder Produktionsfreigabe.
