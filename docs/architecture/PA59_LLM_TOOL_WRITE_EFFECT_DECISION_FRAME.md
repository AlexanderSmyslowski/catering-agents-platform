# PA59 LLM Tool-/Write-Effect-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA58 fuer Tool-Allowlist, Write-Effect-Grenzen und produktwirksame Uebergaben oberhalb eines spaeteren nicht-lokalen providerfaehigen Draft-Pfads; kein Deployment, keine Tool-Orchestrierung, keine neue API, keine Persistenz, keine Migration, keine echten Daten und keine Produktschreibwirkung

## 1. Zweck

PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt. PA55 hat die Trusted-Operator-/Auth-Frage nachgezogen. PA56 hat den Prompt-/Response-Retention- und Evidence-Rahmen geschaerft. PA57 hat den Deployment-/Zielumgebungsrahmen fuer spaetere nicht-lokale Draft-Pfade sortiert. PA58 hat danach Human Approval und Operator-Handover geklaert.

Damit bleibt die naechste offene Schwesterfrage:

Welche Tool-Klassen duerfte ein spaeterer providerfaehiger Draft-Pfad ueberhaupt sehen oder anstossen, und wo bleibt die harte Grenze gegen Write-Effects und produktwirksame Uebergaben?

PA59 macht genau diese Frage fuer Alexander entscheidungsreif, ohne eine Tool-Orchestrierung, Write-Pipeline oder produktwirksame Agent-Runtime zu bauen.

## 2. Fuehrende Quellen

- `docs/architecture/PA26_LLM_READINESS_CONTRACT.md`
- `docs/architecture/PA41_LLM_PROVIDER_DATA_RUNTIME_DECISION_FRAME.md`
- `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md`
- `docs/architecture/PA55_LLM_TRUSTED_OPERATOR_AUTH_DECISION_FRAME.md`
- `docs/architecture/PA58_LLM_HUMAN_APPROVAL_OPERATOR_HANDOVER_DECISION_FRAME.md`
- `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`

## 3. Aktueller Stand

Bereits vorhanden:

- PA26 trennt `read`, `draft` und `write` als Tool-Effektklassen,
- `writesProductObject: false` bleibt fuer die bisherigen Draft-Vertraege hart,
- lokaler `synthetic_live`-Korridor erzeugt nur Draft-Outputs und keine Produkt-Schreibwirkung,
- Daten-, Auth-, Evidence-, Zielumgebungs- und Human-Approval-Schwesterrahmen fuer spaetere nicht-lokale Draft-Pfade sind als Entscheidungsvorlagen vorhanden.

Noch nicht explizit fuer den LLM-Draft-Pfad entschieden:

- ob ein spaeterer providerfaehiger Draft-Pfad strikt read-/draft-only bleiben muss,
- ob Write-Tools jemals sichtbar oder andeutbar sein duerften, auch wenn sie blockiert bleiben,
- wie eine spaetere Tool-Allowlist gegen produktwirksame Spec-, Plan-, Einkaufsliste-, Archiv- oder Export-Schreibpfade getrennt werden muss,
- ob ein spaeterer nicht-lokaler Draft-Pfad je mehr als lesen, vorschlagen und erklaeren duerfte,
- welcher sichere Default gilt, solange Tool-/Write-Effect-Grenzen offen bleiben.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Tool-/Write-Effect-Rahmen oberhalb von `synthetic_live`.

Warum jetzt?

Sobald ein spaeterer Draft-Pfad mehr sein soll als ein lokaler Probe-Lauf, reicht "human-in-the-loop" allein nicht. Dann muss vorher klar sein, ob der Pfad nur lesen und vorschlagen darf oder ob irgendwann produktwirksame Write-Tools ueberhaupt in Reichweite kommen.

## 5. Optionen

Option A:

- Beschreibung: Jeder spaetere providerfaehige Draft-Pfad bleibt rein read-/draft-only. Keine Write-Tools, keine produktwirksamen Uebergaben, keine Tool-Orchestrierung mit Schreibwirkung.
- Vorteile: Kleinster Sicherheitsradius. Maximale Anschlussfaehigkeit an den vorhandenen `writesProductObject: false`-Vertrag.
- Nachteile / Risiken: Kein vorbereiteter Pfad fuer spaetere teilautomatisierte Operator-Unterstuetzung.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Spaetere providerfaehige Draft-Pfade bleiben zunaechst strikt read-/draft-only. Eine spaetere Tool-Allowlist fuer Write-Effects waere nur als separater Gate-Schritt denkbar und darf im aktuellen Rahmen weder still vorbereitet noch implizit aktiviert werden.
- Vorteile: Kleinster glaubwuerdiger Tool-Rahmen oberhalb des heutigen Korridors. Read- und Draft-Unterstuetzung bleiben denkbar, produktwirksame Schreibpfade bleiben hart draussen.
- Nachteile / Risiken: Braucht Disziplin, damit "nur mal ein kleiner Write-Hook" nicht spaeter still in Scope driftet.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- read- und draft-only bleiben die einzige zulaessige Tool-Reichweite;
- keine Write-Tools fuer Spec-Aenderung, Planerzeugung, Einkaufsliste, Antwortspeicherung, Archivierung oder Export-Freigabe im aktuellen LLM-Pfad;
- `writesProductObject: false` bleibt fuehrende harte Grenze;
- keine Tool-Orchestrierung mit Schreibwirkung, auch nicht hinter Human Approval, solange kein separater neuer Gate-Schritt entschieden ist;
- Read-/Draft-Unterstuetzung darf Human Approval, Operator-Handover, Daten-, Auth-, Evidence- oder Deployment-Gates nicht umgehen;
- keine neue API, keine Persistenz, keine Produktschreibwirkung.

Option C:

- Beschreibung: Ein spaeterer providerfaehiger Draft-Pfad darf bereits Write-Tools sehen, vorbereiten oder anstossen, solange ein Mensch spaeter noch draufschaut.
- Vorteile: Schnellster Weg in Richtung agentischer Automatisierung.
- Nachteile / Risiken: Unterlaeuft PA26, PA41 und den bisherigen 10/10-Korridor praktisch sofort und wuerde produktwirksame Agent-Orchestrierung vor dem dafuer noetigen Gate normalisieren.
- Aufwand: scheinbar niedrig, real hoch riskant.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Der sichere Weg ist nicht "Write-Tools schon mal sichtbar machen", sondern die klare Trennung: LLM darf vorerst lesen, strukturieren, erklaeren und vorschlagen. Produktwirksame Write-Effects bleiben ein eigener spaeterer Gate-Schritt.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: providerfaehige Draft-Pfade bleiben dauerhaft read-/draft-only.
- Bei Option B: der naechste kleine Schritt waere hoechstens ein weiterer Contract- oder ADR-Rahmen fuer eine spaetere Write-Tool-Allowlist, weiter ohne Runtime-Ausweitung.
- Bei Option C: vor jeder weiteren Arbeit muessten PA26, PA41 und der bisherige 10/10-Gate-Kranz faktisch neu verhandelt werden; kein sicherer Minimalpfad.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- read-/draft-only fuer providerfaehige Draft-Pfade,
- keine Write-Tools,
- keine Tool-Orchestrierung mit Schreibwirkung,
- `writesProductObject: false` bleibt fuehrend,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
