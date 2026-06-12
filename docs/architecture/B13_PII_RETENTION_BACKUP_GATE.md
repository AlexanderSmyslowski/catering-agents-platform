# B13 PII/Retention/Backup-Gate

Status: Doku-/Vertragstest-only Entscheidungsanker fuer echte Daten vor produktionsnaher Pilotnutzung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefaehigkeit; keine neue Persistenz, keine Migration, keine Backup-Implementierung, keine Loesch-/Retention-Engine, keine neue API, keine Produktlogik-Ausweitung, keine echte personenbezogene Datenverarbeitung, keine rechtssichere Compliance-/DSGVO-Freigabe, keine Multi-Tenancy-/White-Label-/Plattform-Erweiterung

## 1. Zweck

B13 bereitet ein enges PII/Retention/Backup-Gate als pruefbaren Entscheidungsanker vor.

Der Anker verhindert, dass aus lokal gruenem Demo-Status echte personenbezogene Daten, echte Kundendaten oder produktionsnahe Pilotdaten abgeleitet werden.

B13 implementiert keine Speicher-, Backup-, Retention-, Loesch-, API-, Compliance- oder Produktlogik. Der Anker ist nur eine Mindestentscheidung, die vor echten Daten bewusst getroffen und dokumentiert werden muss.

## 2. Heute erlaubt

Heute erlaubt sind nur Daten und Artefakte, die den internen Demo-/Abnahmekorridor nicht verlassen:

- Demo-/Seed-/synthetische Daten,
- interne Arbeitsbelege ohne echte Personen-/Kundendaten,
- read-only Export-/Arbeitsbelege fuer Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufslisten-CSV,
- Demo-Start-/Auditbeleg als interner Betriebs-/Kontrollnachweis,
- lokale Test-, Build-, Audit- und Terminalergebnisse ohne Secrets, PII oder echte Kunden-/Pilotdaten.

Diese erlaubten Quellen tragen nur interne Demo-Abnahmefaehigkeit. Sie sind kein Produktionsdatenmodell und keine Freigabe fuer echte Daten.

## 3. Blockiert

Bis B13 fuer einen konkreten Datenumfang bewusst entschieden und dokumentiert ist, bleiben blockiert:

- echte Mitarbeiterdaten,
- echte Kundendaten,
- echte Einsatz-/Schicht-/Abrechnungsdaten,
- produktionsnahe Pilotdaten,
- echte Personen-/Kundendaten bleiben `blocked`, wenn Datenkategorie, Speicherort, Retention, Backup, Zugriff, Export-/Audit-Klassifikation und Incident-/Loeschpfad nicht entschieden sind.

Ein lokaler B12-`go`-Vermerk darf diese Blockade nicht ueberstimmen.

## 4. Fehlende Mindestentscheidungen vor echten Daten

Vor jeder Nutzung echter oder produktionsnaher Daten muessen mindestens diese Entscheidungen ausgefuellt sein:

| Entscheidung | Mindestinhalt | Default ohne Entscheidung |
| --- | --- | --- |
| Datenkategorien/PII-Scope | Welche Personen-, Kunden-, Einsatz-, Schicht-, Abrechnungs-, Dokument- und Auditdaten sind im Scope? | `blocked` |
| Speicherort/Systemgrenze | Wo liegen Daten und Artefakte, welche Services/Volumes/Repos/Exports gehoeren zur Systemgrenze? | `blocked` |
| Aufbewahrungsfrist/Loeschkonzept | Welche Frist gilt je Daten-/Artefaktklasse und wie wird Loeschung zumindest operativ ausgeloest/nachgewiesen? | `blocked` |
| Backup-/Restore-Verantwortung | Wer verantwortet Backup, Restore-Test, Wiederanlauf und Ruecksicherung betroffener Artefakte? | `blocked` |
| Zugriff/Verantwortliche | Wer darf echte Daten lesen/bearbeiten/exportieren, wer ist fachlich und technisch verantwortlich? | `blocked` |
| Export-/Audit-Artefaktklassifikation | Sind Exporte und Audit-/Review-Spuren Arbeitsbeleg, Nachweis, personenbezogenes Datum oder rechtlich relevanter Beleg? | `blocked` |
| Incident-/Loeschpfad | Welcher Minimalpfad gilt fuer Datenpanne, Fehlimport, Loeschanforderung oder Ruecknahme eines Pilotfalls? | `blocked` |

Externe oder rechtliche Bewertungen, die noch nicht geprueft sind, bleiben `not assessed`. B13 behauptet keine rechtssichere Compliance-/DSGVO-Freigabe.

## 5. Ergebniszustand

Jede B13-Pruefung nutzt genau einen Ergebniszustand:

| Ergebniszustand | Bedeutung |
| --- | --- |
| `go` | `go` nur fuer Demo/synthetisch: Der aktuelle Umfang nutzt ausschliesslich Demo-/Seed-/synthetische Daten und interne Arbeitsbelege ohne echte Personen-/Kundendaten. |
| `blocked` | `blocked` fuer echte Daten ohne Gate: echte Mitarbeiter-, Kunden-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahe Pilotdaten sind gemeint, aber mindestens eine Mindestentscheidung fehlt. |
| `not assessed` | `not assessed` fuer noch nicht gepruefte externe/rechtliche Fragen: externe Datenschutz-, Rechts-, Betriebs-, Kunden- oder Auftragsverarbeitungsfragen sind nicht bewertet. |

Ein B13-`go` ist damit kein allgemeiner Produktions-Go. Es ist nur ein Go fuer den engen Demo-/synthetischen Umfang oder fuer einen spaeter explizit entschiedenen echten Datenumfang.

## 6. Bezug zu B10 und B12

B10 bleibt das Runbook fuer eine konkrete Zielumgebung. B13 ist ein separates Daten-Gate und ersetzt B10 nicht.

B12 bleibt der lokale Demo-Ergebnisvermerk. Ein lokaler Demo-Go bleibt intern und darf nicht als Freigabe fuer echte Daten, Zielumgebung oder produktionsnahen Pilot gelesen werden.

Der produktionsnaher Pilot bleibt `blocked`, solange PII/Retention/Backup offen ist oder B13 nur `not assessed` fuer externe/rechtliche Fragen ausweist.

## 7. Nicht-Ziele / Grenzen

B13 fuehrt ausdruecklich nicht ein:

- keine neue Persistenz,
- keine Migration,
- keine Backup-Implementierung,
- keine Loesch-/Retention-Engine,
- keine neue API,
- keine Produktlogik-Ausweitung,
- keine echte personenbezogene Datenverarbeitung,
- keine rechtssichere Compliance-/DSGVO-Freigabe,
- keine Multi-Tenancy-/White-Label-/Plattform-Erweiterung,
- keine neue AuthN/AuthZ-, Login-, Session- oder OIDC-Implementierung,
- keinen ausgefuellten B10-Preflight fuer eine Zielumgebung.

## 8. Abnahmehinweis

B13 ist erfuellt, wenn dieser Gate-Anker im Repo auffindbar ist, B10, B12 und TESTING auf `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` verweisen und `entfernter Doku-Contract-Test` gruen ist.

Die technischen Standard-Gates bleiben unveraendert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
