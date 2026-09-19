# Catering-Zielaufbau — 19.09.2026

## Freigabe und eindeutige Ressource

Ein zusätzlicher Hetzner CPX32 HEL1 (4AMD-vCPU/8GB/160GB), Ubuntu24.04,
IPv4 2.29.43.174, Server catering-prod-1/166533273, Projekt Default/13344062.
Einmal bestellt;35,99EUR netto/42,83EUR brutto monatlich inklIPv4.
Keine Addons oder zweite Storage-Grundgebühr. Nie blind neu bestellen.

Verwaltungszugang codex, Key-only SSH, Rootlogin gesperrt. Unabhängiger
Hostschlüsselabgleich über authentifizierte Hetzner-Konsole in Chrome:
ED25519 SHA256:9RHv3VPuNcWSaaQlj50WLthf9m+oN/h0hPbMw7gkACA.
Firewall ausschließlich SSH von der geprüften Betreiberadresse; keine
öffentliche Anwendung. Zugangsmittel bleiben außerhalb von Git.

## Erreicht und noch offen

- Exakte sieben Quellimages übertragen und auf Ziel gehasht/identifiziert.
  PostgreSQL-Digest778d0b… unverändert. Docker29.2.1/Compose5.0.2/containerd2.2.1
  und Restic0.16.4 installiert. Quellhost nicht geändert.
- Nur benötigte Catering-Runtime-Schlüssel geschützt auf Ziel übertragen;
  gegen tatsächliche Containerkonfigurationen abgeglichen, keine Werte publiziert.
- Eigene deklarative Zielkonfiguration: private IPv4/internal/isolated-Netze,
  kein Hostport, kein Host-Gateway, kein automatischer Restart. Eigener Edge
  und eigene interne TLS-Prüfwege. Keine fremden Site-/TLS-Konfigurationen.
- Leere Ziel-DB, Web und eigener Edge gestartet. Appdienste und Datenkopie
  noch nicht gestartet. Die tatsächliche Netz-/TLS-Prüfung ist bestanden: externer IPv4-/IPv6-/
  DNS-Zugriff blockiert, beide privaten HTTPS-Routen mit echter CA geprüft.
  Das ist noch kein Anwendungs-/Datenproof.
- Vollständiger Dump statt Zweitabellenfilter; tatsächlicher Probe prüft
  Lesbarkeit von4Tabellen, synthetische CI erweitert um Daten/Spalten/PKs.
  Scope postgres-full,sites,platform-caddy,catering-edge-caddy.
- Keine abgeschlossene Ziel-Datenprobe, externe Sicherung oder Restoreprüfung
  behaupten. Der gekennzeichnete manuelle Better-Stack-Testalarm ist zugestellt:
  Alexander bestätigte den E-Mail-Empfang. Eigener Incident1017835477 um
  14:02MESZ abgeschlossen; pausierter Heartbeat493066 unverändert. Dies ist
  ein Meldewegtest, kein automatischer Beobachter-End-to-End-Nachweis.

## Kandidat und Checks

Basis8ccdfd4e1feae46cd6a8c4013aa6b25d6bfbf4be, Branch
codex/catering-target-hel1-20260919. Sourcebindung immer anhand des tatsächlichen
Folgecommits/Tree prüfen; lokale Dirtyänderungen sind kein installierter Commit.
Unabhängiger read-only Review target_candidate_review (Astra/xhigh):
Scope/Code PASS nach Behebung echter leerer-Caddy-Komponenten und CI-Testbindung;
Live-Isolation und Zielproben sind davon ausdrücklich nicht abgenommen.

Lokales RED/GREEN: tatsächliches Dumpfragment, zusätzliche Tabellen und neuer
Scope. Python3.11:47 Integrationsverträge und41 Beobachterverträge bestanden;
2 Zielkonfigurationstests bestanden. Build, Bashsyntax, Shellcheck-S-error und
Diffprüfung bestanden. Python3.14 zeigte zwei Cleanup-Laufzeitprobleme; keine
Tests abgeschwächt. Linux-CI-Gate noch nicht ersetzt. Vitest-Fokus nach
gezielter Fixtureanpassung:199/199 bestanden, Exit0,870,80Sekunden.
Automatische CI vor Datenprobe verifizieren.
Produktivcode3878/3911, Rest33; Basen3181/3511 erhalten. Neue Compose-/Caddy-
Konfiguration deklarativ; Tests/Dokumentation separat.

## Fortsetzung und Grenzen

1. Netz-/TLS-Prüfung und korrigierter Vitest-Fokus sind ausgewertet und grün.
2. Geprüften Commit normal pushen, Draft-PR, bestehende automatische CI auswerten.
3. Geschützte vollständige konsistente Datenprobe; sourcegebundener Abgleich,
   Kernabläufe ohne externe Geschäftswirkungen. Kein beweglicher späterer
   Produktionszeilenzähler als Gleichheitsbeweis einer älteren Kopie.
4. Zielbindung/Attestationen, ein begrenztes externes Backup, tatsächlicher
   isolierter Restore. Der markierte Testalarm ist bereits empfangsbestätigt;
   keinen zweiten Test nur wegen Fortsetzung senden.
5. Vor Umschaltung ausdrücklich stoppen; kein dauerhaft aktivierter Scheduler.

Reihenfolge und Rücknahme: [TARGET-REHEARSAL](../../platform-infra/backup/TARGET-REHEARSAL.md).
Historische Attestationsfrist09.10.2026 14:53:16UTC nicht verlängern; neue
Host-/Scopebindungen benötigen echte Zielprüfung. UnverändertB/P/M/R/J:
100663296/268435456/536870912/67108864/10000.

Detailliertes bestehendes Arbeitsledger (nicht zweite Statusführung):
`~/.codex/local-evidence/catering-finalconfig-0jae6hqe/observer-merge-approved-report.md`.
Dort sind Befehle/Exitcodes, geschützte lokale Belegdateien und aktuelle
Lauf-/CI-Identitäten verzeichnet. Keine Secrets oder privaten Daten in Git.
Diese versionierte Kurzfassung ist die KI-zugängliche Übergabe; lokale
historische Berichte ersetzen keine frischen Zielmessungen.
