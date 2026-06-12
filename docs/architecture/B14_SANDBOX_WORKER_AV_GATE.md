# B14 Sandbox/Worker/AV-Gate

Status: Doku-/Vertragstest-only Entscheidungsanker fuer produktionsnahe Dateiverarbeitung
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefaehigkeit; keine Sandbox-Implementierung, keine Worker-Isolation-Implementierung, keine Antivirus-/Malware-Scan-Implementierung, keine neue Parser-/OCR-/LLM-Engine, keine neue Upload-/Ingestion-Produktlogik, keine neue API, keine neue Persistenz, keine Migration, keine neue Runtime, keine produktionsnahe Dateiverarbeitungsfreigabe, keine rechtssichere Compliance-Behauptung, keine Multi-Tenancy-/White-Label-/Plattform-Erweiterung

## 1. Zweck

B14 bereitet ein enges Sandbox/Worker/AV-Gate als pruefbaren Entscheidungsanker vor.

Der aktuelle Demo-/Ingestion-/Upload-Korridor ist intern/testbezogen und keine produktionsnahe Verarbeitung beliebiger Dateien. Damit gilt: aktueller Demo-/Ingestion-/Upload-Korridor ist intern/testbezogen; B14 verhindert, dass Upload-, Import-, Ingestion-, Health-, Demo- oder read-only Export-Gruensignale als Freigabe fuer echte oder beliebige Dateien verstanden werden.

B14 implementiert keine Sandbox, keine Worker-Isolation, keinen Antivirus-/Malware-Scan, keine Parser-/OCR-/LLM-Engine, keine Upload-Produktlogik und keine neue Runtime. Der Anker beschreibt nur Mindestentscheidungen, die vor produktionsnaher Dateiverarbeitung bewusst getroffen und dokumentiert werden muessen.

## 2. Heute erlaubt

Heute erlaubt bleibt nur der vorhandene interne Demo-/Abnahmekorridor:

- PA14 DocumentIngestion-Korridor bleibt read-only Abnahmeanker: Quelle vorhanden -> Ingestion-Status sichtbar -> Warnungen sichtbar -> Exportanker sicher.
- Bestehende Upload-/Ingestion-Smokes duerfen sichere Metadaten-/Warnmarker pruefen.
- Health-, Demo- und read-only Exportchecks duerfen nur interne Betriebs- und Abnahmefaehigkeit fuer den lokalen Korridor belegen.
- Quellenmetadaten duerfen nur als gekürzte Quellenmetadaten beziehungsweise sichere Kurzanker erscheinen.

Diese erlaubten Nachweise sind keine produktionsnahe Verarbeitung beliebiger Dateien und keine Malware-/Sandbox-Freigabe.

## 3. Blockiert

Produktionsnahe Verarbeitung echter Uploads bleibt `blocked`, solange Sandbox/Worker-Isolation/AV bzw. Malware-Scan-Entscheidung nicht getroffen ist.

Insbesondere bleiben blockiert:

- beliebige echte Kunden-, Mitarbeiter-, Lieferanten- oder Pilotdateien,
- Uploads ausserhalb des engen internen Demo-/Testkorridors,
- produktionsnahe Dateiannahme ohne entschiedene erlaubte Dateitypen und Groessenlimits,
- Verarbeitung ohne entschiedenes Quarantaene-/Reject-Verhalten,
- Verarbeitung ohne entschiedene Scan-/Sandbox-Verantwortung und Worker-Isolation,
- Aussagen, dass Health-/Demo-/Read-only-Export-Gruensignale eine Sandbox/AV-Freigabe ersetzen.

## 4. Fehlende Mindestentscheidungen vor produktionsnaher Dateiverarbeitung

Vor jeder produktionsnahen Verarbeitung echter Uploads muessen mindestens diese Entscheidungen ausgefuellt sein:

| Entscheidung | Mindestinhalt | Default ohne Entscheidung |
| --- | --- | --- |
| erlaubte Dateitypen | Welche MIME-/Extension-Kombinationen sind fuer welchen Uploadpfad erlaubt, und welche bleiben abgelehnt? | `blocked` |
| Groessenlimits | Welche Dateigroesse, Anzahl pro Request und Gesamtdatenmenge gelten je Pfad? | `blocked` |
| Quarantaene-/Reject-Verhalten | Wird eine Datei bei Verdacht/Scanfehler isoliert, sofort abgelehnt oder nur intern markiert? | `blocked` |
| Scan-/Sandbox-Verantwortung | Wer betreibt Malware-Scan, Sandbox, Signaturen/Updates, Ergebnisinterpretation und Nachweis? | `blocked` |
| Worker-Isolation | In welchem isolierten Worker-/Prozess-/Container-Kontext duerfen Parser oder Extraktion laufen? | `blocked` |
| Timeout-/Ressourcenlimit | Welche CPU-, Speicher-, Laufzeit- und Abbruchgrenzen gelten fuer Extraktion/Scan? | `blocked` |
| Fehler-/Warnpfad | Wie werden Scanfehler, Verdacht, Fallback und Reject sicher an UI/Logs/Audit weitergegeben? | `blocked` |
| Betreiber-/Betriebsverantwortung | Wer verantwortet Betrieb, Updates, Eskalation und Wiederanlauf des Datei-Gates? | `blocked` |

Noch nicht gepruefte externe, rechtliche, betriebliche oder organisatorische Fragen bleiben `not assessed`.

## 5. Keine Leak- oder Freigabe-Behauptung

B14 erlaubt weiterhin nur sichere Metadaten-/Warnmarker. Es gilt ausdruecklich:

- keine Rohtext-Leaks in UI, Logs oder Exports,
- keine Vollhash-Leaks in UI, Logs oder Exports,
- keine Dateiinhalts-Leaks in UI, Logs oder Exports,
- UI/Logs/Exports behaupten daraus keine Freigabe,
- gekürzte Quellenmetadaten sind nur interne Nachvollziehbarkeitsmarker,
- ein Warn- oder Fallbackanker ist kein Malware-Scan und keine Sandbox-Freigabe.

## 6. Ergebniszustand

Jede B14-Pruefung nutzt genau einen Ergebniszustand:

| Ergebniszustand | Bedeutung |
| --- | --- |
| `go` | Nur fuer den engen internen Demo-/Testkorridor oder fuer einen spaeter explizit entschiedenen produktionsnahen Dateiumfang mit dokumentierter Sandbox/Worker/AV-Entscheidung. |
| `blocked` | Produktionsnahe echte Uploads oder beliebige Dateien sind gemeint, aber mindestens eine Mindestentscheidung fehlt. |
| `not assessed` | Sandbox-, Worker-, AV-, Malware-, Betriebs-, Rechts- oder Betreiberfragen sind noch nicht bewertet. |

Health-/Demo-/Read-only-Export-Gruensignale ersetzen keine Sandbox/AV-Freigabe.

## 7. Bezug zu B10/B11/B12/B13 und PA14

B10 bleibt das Runbook fuer eine konkrete Zielumgebung. B14 ersetzt B10 nicht.

B11 und B12 bleiben lokale interne Demo-/Abnahmeanker. Ein gruenes lokales Ergebnis bleibt intern; ein produktionsnaher Pilot bleibt ohne B14-Gate `blocked` oder `not assessed`.

B13 PII/Retention/Backup bleibt separat. B14 loest Datenschutz/Backup nicht und ist keine Freigabe fuer echte Personen-, Kunden-, Einsatz-, Schicht- oder Abrechnungsdaten.

PA14 bleibt ein read-only DocumentIngestion-Abnahmeanker. PA14 bestaetigt sichere Sichtbarkeit von Status, Warnung und Exportanker; PA14 ist keine Sandbox-, Worker- oder AV-Entscheidung.

## 8. Nicht-Ziele / Grenzen

B14 fuehrt ausdruecklich nicht ein:

- keine Sandbox-Implementierung,
- keine Worker-Isolation-Implementierung,
- keine Antivirus-/Malware-Scan-Implementierung,
- keine neue Parser-/OCR-/LLM-Engine,
- keine neue Upload-/Ingestion-Produktlogik,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- keine neue Runtime,
- keine produktionsnahe Dateiverarbeitungsfreigabe,
- keine rechtssichere Compliance-Behauptung,
- keine Multi-Tenancy-/White-Label-/Plattform-Erweiterung.

## 9. Abnahmehinweis

B14 ist erfuellt, wenn dieser Gate-Anker im Repo auffindbar ist, B10, B11, B12 und TESTING auf `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` verweisen und `entfernter Doku-Contract-Test` gruen ist.

Die technischen Standard-Gates bleiben unveraendert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
