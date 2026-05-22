# Hans 24h Build Plan 2 — Internal Beta Readiness 2026-05-22

> Zweck: Anschlussplan nach `hans-continuous-build-plan-2026-05-22.md` C1-C9. Alexander will weiter 24h-Betrieb ohne Leerlauf, aber nicht blindes Feature-Erfinden. Dieser Plan fokussiert interne Beta-/Abnahmefaehigkeit, Demo-Reproduzierbarkeit und kleine vorhandene UI-/Doku-/Test-Korridore.

## Ausgangspunkt

Verifizierter Stand:
- HEAD/origin/main: `7c1a50f6c05ed6df11f0cb4676d5b37d882cb095` (`docs: document internal demo acceptance path`)
- C1-C9 des vorherigen Continuous-Plans abgeschlossen
- letzte CI: gruen, Run `26284784919`
- C9: lokale Full Gates gruen, keine weitere Aenderung noetig
- `tmp/` bleibt bekannt untracked und unberuehrt

## Arbeitsprinzip fuer weitere 24h

- Kein Leerlauf: nach gruenem Cycle naechsten Cycle aus dieser Queue starten.
- Kein blindes Coden: nur diese Queue, keine erfundenen Features.
- Kleine Commits, jeweils mit Tests/Build/CI.
- Wenn CI rot: Fix-Cycle fuer den roten Stand, kein Weiterbau.
- Wenn fachlich blockiert: Stop und Lagebericht.
- Bestehende Architektur- und MVP-Grenzen bleiben fuehrend.

## Absolute Guardrails

Nicht bauen:
- keine neue Persistenzwelt, kein Prisma, keine Migration
- keine neue API ohne explizite Minimalfreigabe im Cycle
- kein OAuth, Google Drive, Login, OIDC
- kein LLM-/Tool-Use-/OCR-/Parser-Ausbau
- keine automatische Spec-Korrektur
- keine Rezept-/Allergenautomatik
- keine Plattform-/Multi-Tenant-/White-Label-Erweiterung
- keine rechtssichere Audit- oder Compliance-Behauptung

Erlaubt:
- Doku-/Abnahme-/Demo-Haertung
- vorhandene Smokes und Tests schaerfen
- kleine UI-/Copy-/Marker-Fixes, wenn RED einen echten Nutzbarkeitsmangel zeigt
- kleine Script-/Check-Haertung fuer vorhandene lokale Verifikation
- Memory-/Snapshot-Fortschreibung bei relevanten Aenderungen

## Queue F — Demo-Abnahme und interne Beta-Reproduzierbarkeit

### B1 — C8-Abnahmeweg als Vertrag pruefbar machen

Ziel:
Der neue C8-Abnahmeweg bleibt auffindbar und verweist auf real existierende Scripts/Routen/Gates.

Arbeitsrichtung:
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`, `README.md`, `TESTING.md` lesen
- schmalen Doku-Vertragstest oder bestehenden Doku-Test erweitern
- pruefen: genannte Commands, Routen und Kernanker existieren

Akzeptanz:
- Test gruen
- keine Produktlogik
- Full Gates gruen

### B2 — Demo-Start-/Seed-/Audit-Korridor narrativ schaerfen

Ziel:
Ein interner Nutzer versteht, was Demo-Seed und Auditbeleg leisten und was nicht.

Arbeitsrichtung:
- `local:check`-Doku, C1/C2-Kontrakt, C8-Abnahmeweg abgleichen
- nur Doku/Copy, falls Inkonsistenz sichtbar

Akzeptanz:
- klare Grenzen: intern, kein Produktionsfreigabe, keine rechtssichere Auditbehauptung

### B3 — Angebot-zu-Produktion-Demo als kleine Nutzerroute absichern

Ziel:
Die im C8-Weg beschriebene Route von `/angebot` zu `/produktion` bleibt als interner Nutzerfluss regressionssicher.

Arbeitsrichtung:
- bestehende Backoffice-Smokes lesen
- nur vorhandene Marker/Links/IDs testen
- minimaler UI-Fix nur bei echter Marker-Luecke

Akzeptanz:
- keine Angebotslogik/API/Persistenz-Aenderung

## Queue G — Intern nutzbare Workbench-Verstaendlichkeit

### B4 — Produktionsobjekt-/Export-Readiness klarer pruefen

Ziel:
`/produktion` zeigt ruhig, wann Produktionsplan, Einkaufsliste und Exporte verfuegbar oder noch nicht verfuegbar sind.

Arbeitsrichtung:
- an C7 anschliessen
- bestehende Empty-/Export-Zonen nur regressionssichern

Akzeptanz:
- kein neuer Workflow, keine Generierungslogik

### B5 — Upload-/Warnungszustand im Demo-Weg absichern

Ziel:
Die Demo-Abnahme kann Upload-/Importwarnungen sicher erkennen, ohne Rohtexte oder volle Hashes zu spiegeln.

Arbeitsrichtung:
- an C6/PA14 anschliessen
- sichere Marker testen/dokumentieren

Akzeptanz:
- keine Parser-/OCR-/LLM-Erweiterung

### B6 — Trusted-Actor-/Export-Grenzen fuer Abnahme lesbarer machen

Ziel:
Interne Exporte bleiben als Arbeitsbelege unter Trusted-Actor-Kontext eingeordnet.

Arbeitsrichtung:
- C5/PA8/PA9 Doku und Tests abgleichen
- Doku/Test nur fuer bestehende read-only Exportpfade

Akzeptanz:
- kein OIDC/Login, keine produktionsnahe Freigabe

## Queue H — Abschluss, Status und naechster echter Produktwertblock

### B7 — Management-/Lageuebersicht aktualisieren

Ziel:
Der Stand nach C1-C9 und B1-B6 ist fuer Alexander knapp entscheidbar.

Arbeitsrichtung:
- `docs/product/MANAGEMENT_UPDATE.md` oder passendes Statusdokument aktualisieren, falls vorhanden
- nicht als Marketingtext, sondern harter Status: umgesetzt/offen/risiko/naechste Entscheidung

Akzeptanz:
- keine Featureliste erfinden

### B8 — Full Gates + Memory-Snapshot

Ziel:
Stand konsolidieren.

Akzeptanz:
- `npm run local:status`
- `npm run local:check`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- Memory/Snapshot nur bei relevanter Aenderung

### B9 — Neuer Produktwertblock als Entscheidungsvorlage

Ziel:
Nicht weiter polieren, sondern den naechsten echten Produktwertblock fuer Alexander vorbereiten.

Mögliche Kandidaten nur als Entscheidungsvorlage, nicht Umsetzung:
- strukturierte Antwortannahme/Rueckfragen-Fortsetzung in `/produktion`
- interne Beta-Durchfuehrung mit realem Eventbeispiel
- Onboarding-/Setup-Korridor
- spaetere Telegram-/Drive-Zielbildentscheidung

Akzeptanz:
- Entscheidungsvorlage, kein Implementierungsstart

### B10 — Stop-Gate

Wenn B1-B9 abgeschlossen sind:
- nicht weiterbauen
- Lagebericht schreiben
- Frau Mueller muss neuen Plan oder Stop-Entscheidung herbeifuehren

## Lageberichte

Jeder Cycle schreibt:
`/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-24h-plan2-20260522-BX.md`

Jeder Bericht enthaelt:
- Cycle
- Umsetzung/Root Cause
- geaenderte Dateien
- Checks
- Commit SHA
- Push/Remote/CI
- Risiken
- naechster Cycle
