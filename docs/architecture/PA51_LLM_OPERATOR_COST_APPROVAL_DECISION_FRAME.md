# PA51 LLM Operator-/Kosten-/Approval-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA42-PA50 fuer lokalen
`synthetic_live`-Betrieb mit Provider-Secrets, Kostenrahmen und
Human-Approval-Grenze; kein Deployment, keine neuen APIs, keine Persistenz,
keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA41 hat den ersten echten synthetic-only Provider-Slice entscheidungsreif
gemacht. PA42 bis PA50 haben diesen kleinsten Korridor jetzt lokal umgesetzt:

`synthetic_live slice -> audit/run-result -> probe -> eval comparison -> strict probe -> preflight -> strict evidence corridor`

Damit ist die naechste echte 10/10-Frage nicht mehr, ob ein erster
providerfaehiger synthetischer Draft-Lauf technisch moeglich ist, sondern unter
welchen Operator-, Kosten- und Human-Approval-Regeln dieser Korridor
verantwortbar genutzt werden darf.

## 2. Aktueller Stand

Bereits vorhanden:

- lokaler `synthetic_live`-Clarification-Draft hinter Feature-Flag,
- OpenAI-Transport mit Structured Outputs,
- `AgentAudit` und `RunResult` fuer erfolgreiche Live-Laeufe,
- `preflight`, `probe`, `probe:strict` und `check` als lokaler
  Evidence-Korridor,
- Human Approval auf Draft-Ebene,
- keine Produktobjekt-Schreibwirkung,
- keine echten Daten, keine Google-Drive-Angebote, keine Runtime-`ConversationSession`.

Noch nicht entschieden:

- wer den lokalen Providerpfad ueberhaupt ausfuehren darf,
- welches Modell bzw. welche Modellfamilie erlaubt ist,
- welcher Kostenrahmen und welcher Kill-Switch gelten,
- welche Prompt-/Response-Inhalte lokal sichtbar sein duerfen,
- wie Human Approval fuer eine spaetere produktionsnahe Uebernahme
  operationalisiert wird,
- ob der Korridor strikt lokal bleibt oder spaeter in einen nicht-lokalen
  Operatorrahmen uebergehen darf.

## 3. Entscheidung noetig

Kurzer Titel:

Lokaler `synthetic_live`-Operatorrahmen nach PA50.

Warum jetzt?

Der technische Vorbereitungskorridor ist fuer lokale synthetic-only Laeufe
vorhanden. Ohne klare Regeln fuer Operatoren, Kosten, Secrets, sichtbare
Outputs und Human Approval waere der naechste Schritt organisatorisch unscharf,
obwohl der Codepfad bereits existiert.

## 4. Optionen

Option A:

- Beschreibung: Der PA42-PA50-Korridor bleibt rein technischer Nachweis und
  wird vorerst nicht aktiv durch mehrere Operatoren genutzt.
- Vorteile: Kein neuer Kosten- oder Bedienaufwand. Keine neue Betriebsgewohnheit.
- Nachteile / Risiken: Kaum praktisches Lernen aus echten lokalen Draft-Laeufen.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Der lokale `synthetic_live`-Korridor wird fuer einen kleinen,
  benannten internen Operatorkreis freigegeben. Er bleibt strikt lokal,
  synthetic/demo only, feature-flag-geschuetzt und ohne Produktschreibwirkung.
- Vorteile: Praktische Nutzung des vorhandenen Korridors ohne Deployment- oder
  Echte-Daten-Sprung. Kosten, Modellwahl und Human Approval werden bewusst
  gefuehrt.
- Nachteile / Risiken: Braucht klare Operator-, Secret-, Kosten- und
  Logging-Regeln. Auch lokale Modellaufrufe koennen bei unsauberem Umgang
  still entgrenzen.
- Aufwand: niedrig bis mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- nur benannte interne Operatoren;
- nur lokale Ausfuehrung ueber `npm run llm:synthetic-live:check`;
- nur synthetic/demo Daten;
- nur erlaubtes Modell aus einer kleinen Liste;
- explizites Monats- oder Testbudget;
- Secrets ausschliesslich ausserhalb des Repos;
- kein Raw Prompt-/Response-Logging in Repo, CI oder Tickets;
- Human Approval bleibt Pflicht, bevor ein Draft manuell uebernommen wird;
- weiterhin keine Write-Tools, keine neue API, keine Persistenz und keine
  Runtime-`ConversationSession`.

Option C:

- Beschreibung: Der Korridor wird auf geteilte Zielumgebungen, automatisierte
  Runs, weitere Use Cases oder produktnaeheres Arbeiten ausgedehnt.
- Vorteile: Schnellere Naeherung an einen breiteren Agentenbetrieb.
- Nachteile / Risiken: Beruehrt sofort Deployment-, Auth-, Daten-, Logging-,
  Kosten-, Runtime- und spaeter Tool-/Write-Gates.
- Aufwand: hoch.
- Empfehlung ja/nein: nein.

## 5. Empfehlung

Klare Empfehlung:

Option B in der kleinsten lokalen Form.

Die Technik ist weit genug, um echte lokale Lernerfahrung zu erzeugen. Alles
Groessere wuerde mehrere harte Gates gleichzeitig ankratzen, bevor der
Operatorrahmen selbst sauber entschieden ist.

## 6. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: Der Korridor bleibt ein technischer Nachweis, keine breitere
  Nutzung.
- Bei Option B: naechster kleiner Schritt ist ein nicht-sensitives
  Operator-Runbook plus Contract-Tests fuer erlaubte Modelle, Kostenrahmen,
  lokale Secrets und Human-Approval-Hinweise.
- Bei Option C: vor jeder weiteren Implementierung muessen Deployment-, Auth-,
  Daten- und Runtime-Gates separat vorbereitet werden.

## 7. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- lokal vorhanden, aber nicht breiter freigegeben,
- keine echten Daten,
- keine nicht-lokale Zielumgebung,
- keine Produktschreibwirkung,
- keine neue Runtime-Ausweitung.
