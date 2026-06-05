# PA61 LLM Dokument-/Upload-Quellen-Sicherheitsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA60 fuer Dokument-, Upload- und
quellennahe Provider-Inputs oberhalb eines spaeteren nicht-lokalen
providerfaehigen Draft-Pfads; kein Deployment, keine Sandbox-Implementierung,
keine Worker-Isolation, keine AV-Implementierung, keine neue API, keine
Persistenz, keine Migration, keine echten Daten und keine
Produktschreibwirkung

## 1. Zweck

PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt. PA56 hat den
Prompt-/Response-Retention- und Evidence-Rahmen geschaerft. PA59 hat die
Tool-/Write-Effect-Grenzen festgezogen. PA60 hat die Runtime- und
ConversationSession-Grenzen sortiert.

Damit bleibt die naechste offene Schwesterfrage:

Duerfte ein spaeterer providerfaehiger Draft-Pfad jemals direkte
Upload-/Dokumentquellen sehen, oder muss er strikt auf bereits reduzierte,
nicht-rohe und nicht-dateinahe Arbeitsausschnitte begrenzt bleiben?

PA61 macht genau diese Frage fuer Alexander entscheidungsreif, ohne schon
Upload-Pipelines, Sandbox/Worker/AV, Parser-/OCR-/Dokument-Runtime oder neue
Providerpfade zu bauen.

## 2. Fuehrende Quellen

- `docs/architecture/PA41_LLM_PROVIDER_DATA_RUNTIME_DECISION_FRAME.md`
- `docs/architecture/PA54_LLM_DATA_PII_DECISION_FRAME.md`
- `docs/architecture/PA56_LLM_RETENTION_EVIDENCE_DECISION_FRAME.md`
- `docs/architecture/PA59_LLM_TOOL_WRITE_EFFECT_DECISION_FRAME.md`
- `docs/architecture/PA60_LLM_RUNTIME_CONVERSATION_SESSION_DECISION_FRAME.md`
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`
- `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`

## 3. Aktueller Stand

Bereits vorhanden:

- der lokale `synthetic_live`-Korridor arbeitet nur mit bekannten
  synthetischen Fixtures,
- PA54 blockiert Rohdokumente, E-Mails, PDFs und ganze Specs als spaetere
  Provider-Inputs bereits grundsaetzlich an,
- B14 bleibt fuehrendes Gate fuer echte oder beliebige Uploads, Sandbox,
  Worker-Isolation und AV,
- PA14 bleibt read-only Nachweisanker fuer Ingestion-Status, Warnmarker und
  sichere Quellenanker, nicht aber Provider-Futter,
- Tool-, Runtime-, Evidence- und Human-Approval-Schwesterrahmen fuer spaetere
  Draft-Pfade sind vorhanden.

Noch nicht explizit fuer den LLM-Draft-Pfad entschieden:

- ob ein spaeterer providerfaehiger Draft-Pfad ueberhaupt irgendein
  uploadnahes oder dokumentnahes Material sehen duerfte,
- ob reduzierte, strukturierte Arbeitsausschnitte aus vorhandenen
  Projektionen/Objekten die einzig zulaessige Quellform bleiben muessen,
- ob Rohtext-Extrakte, Parser-Fallback-Text, OCR-Ergebnisse oder ganze
  Dokumentzusammenhaenge jemals in einen Providerpfad gelangen duerften,
- ob ein spaeterer Draft-Pfad direkte Dateibezuege aus Intake-, Offer- oder
  Production-Uploads ueberhaupt kennen duerfte,
- welcher sichere Default gilt, solange Upload-/Dokumentquellen nicht separat
  entschieden sind.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Dokument-/Upload-Quellenrahmen oberhalb von `synthetic_live`.

Warum jetzt?

Nach Daten-, Evidence-, Tool- und Runtime-Grenzen bleibt die eigentliche
Dateiquellenfrage uebrig: Selbst wenn ein spaeterer Draft-Pfad weiter nur
read-/draft-only bleibt, darf daraus nicht still ein dokumentnaher
Providerpfad werden, der Uploads oder Rohtext indirekt an ein Modell
weiterreicht.

## 5. Optionen

Option A:

- Beschreibung: Jeder spaetere providerfaehige Draft-Pfad bleibt dauerhaft frei
  von uploadnahen oder dokumentnahen Quellen. Er sieht nur manuell gepflegte
  oder streng strukturierte, bereits vorhandene Arbeitsobjekte.
- Vorteile: Kleinster Sicherheitsradius. Kein Konflikt mit B14.
- Nachteile / Risiken: Kein vorbereiteter Pfad fuer spaetere,
  bewusst reduzierte Dokumentausschnitte.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Ein spaeterer providerfaehiger Draft-Pfad darf hoechstens
  bereits reduzierte, nicht-rohe, nicht-dateinahe und bewusst begrenzte
  Arbeitsausschnitte aus vorhandenen Projektionen oder strukturierten Objekten
  sehen. Direkte Upload-Payloads, Rohdokumente, Rohtext-Extrakte,
  Parser-Fallback-Text, OCR-Ergebnisse, ganze E-Mails, PDFs, Pages-Dateien und
  Dateibloecke bleiben ausserhalb des Providerpfads. Alles Upload-/Sandbox-/
  Worker-/AV-Nahe bleibt separat hinter B14.
- Vorteile: Kleinster glaubwuerdiger Quellrahmen oberhalb des heutigen
  synthetischen Korridors. Verhindert, dass Dokument- oder Uploadnaehe still
  in den ersten freigegebenen Draft-Pfad einsickert.
- Nachteile / Risiken: Braucht Disziplin bei Reduktion, Redaction und
  SourceRef-Grenzen. "Reduziert" darf nicht als Rohtextabkuerzung missbraucht
  werden.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- keine direkten Upload-Payloads fuer Intake-, Offer- oder Production-Pfade im
  Providerpfad;
- keine PDFs, E-Mails, Pages-Dateien, Dateibloecke, Binaerartefakte oder
  Dokumentanhaenge im Providerpfad;
- keine Rohtext-Extrakte, kein Parser-Fallback-Text und keine OCR-Rohresultate
  als Modellinput;
- nur bereits reduzierte, strukturierte und bewusst begrenzte
  Arbeitsausschnitte aus vorhandenen Projektionen oder Produktobjekten;
- B14 bleibt fuehrendes Gate fuer alles Upload-, Sandbox-, Worker- und
  AV-Nahe;
- PA14 bleibt read-only Nachweisanker und wird nicht zu einem stillen
  Dokumentfeed fuer Provider umgedeutet;
- keine neue API, keine Persistenz, keine Produktschreibwirkung.

Option C:

- Beschreibung: Ein spaeterer providerfaehiger Draft-Pfad darf direkte
  Uploads, Rohdokumente oder Rohtext-nahe Dokumentquellen sehen.
- Vorteile: Schnellste Naeherung an dokumentnahe Agentik.
- Nachteile / Risiken: Unterlaeuft PA54 und B14 praktisch sofort und wuerde
  Dokument-, Upload-, Sandbox-, Worker-, AV-, Logging- und Datenrisiken vor
  dem dafuer noetigen Gate normalisieren.
- Aufwand: scheinbar niedrig, real hoch riskant.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Der sichere Weg ist nicht "Dokumente spaeter einfach reduzieren", sondern die
klare Grenze: Ein spaeterer Draft-Pfad bleibt frei von direkten Uploads und
Rohdokumenten; wenn ueberhaupt, sieht er nur bereits reduzierte,
nicht-dateinahe Arbeitsausschnitte aus bestehenden, kontrollierten
Objektgrenzen.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: providerfaehige Draft-Pfade bleiben dauerhaft dokument- und
  uploadfern.
- Bei Option B: der naechste kleine Schritt waere hoechstens ein weiterer
  Contract- oder ADR-Rahmen fuer reduzierte Source-Material-Grenzen, weiter
  ohne Upload-Runtime, Sandbox/AV oder Provider-Ausweitung.
- Bei Option C: vor jeder weiteren Arbeit muessten PA54, B14 und der bisherige
  10/10-Gate-Kranz faktisch neu verhandelt werden; kein sicherer Minimalpfad.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- keine direkten Upload-Payloads im Providerpfad,
- keine Rohdokumente oder Rohtext-Extrakte im Providerpfad,
- nur synthetische oder bereits reduzierte, nicht-dateinahe Arbeitsausschnitte,
- B14 bleibt fuehrendes Upload-/Sandbox-/Worker-/AV-Gate,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
