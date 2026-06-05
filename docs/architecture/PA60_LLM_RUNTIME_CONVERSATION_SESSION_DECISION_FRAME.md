# PA60 LLM Runtime-/ConversationSession-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA59 fuer Runtime-Grenzen, ConversationSession und Session-getragene LLM-Pfade oberhalb eines spaeteren nicht-lokalen providerfaehigen Draft-Pfads; kein Deployment, keine neue Runtime-Conversation, keine neue API, keine Persistenz, keine Migration, keine echten Daten und keine Produktschreibwirkung

## 1. Zweck

PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt. PA55 hat die Trusted-Operator-/Auth-Frage nachgezogen. PA56 hat den Prompt-/Response-Retention- und Evidence-Rahmen geschaerft. PA57 hat den Deployment-/Zielumgebungsrahmen fuer spaetere nicht-lokale Draft-Pfade sortiert. PA58 hat Human Approval und Operator-Handover geklaert. PA59 hat danach die Tool-/Write-Effect-Grenzen festgezogen.

Damit bleibt die naechste offene Schwesterfrage:

Bleibt ein spaeterer providerfaehiger Draft-Pfad weiterhin eine schmale, auf vorhandene Objekte gestuetzte Projektion, oder duerfte er jemals eine echte Runtime-`ConversationSession` als fuehrendes Produktobjekt brauchen?

PA60 macht genau diese Frage fuer Alexander entscheidungsreif, ohne schon Chat-Runtime, Session-Persistenz, neue APIs oder produktwirksame Agentenlaufzeit zu bauen.

## 2. Fuehrende Quellen

- `docs/architecture/PA41_LLM_PROVIDER_DATA_RUNTIME_DECISION_FRAME.md`
- `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md`
- `docs/architecture/PA58_LLM_HUMAN_APPROVAL_OPERATOR_HANDOVER_DECISION_FRAME.md`
- `docs/architecture/PA59_LLM_TOOL_WRITE_EFFECT_DECISION_FRAME.md`
- `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`

## 3. Aktueller Stand

Bereits vorhanden:

- `ProductionConversationProjection` bleibt die bestehende read-only Projektion aus vorhandenen Objekten,
- Clarification-Fragen und bestehende Antworten leben innerhalb getesteter, schmaler Objektgrenzen,
- die LLM-Readiness-Vertraege bleiben bisher ohne Runtime-`ConversationSession`,
- Daten-, Auth-, Evidence-, Zielumgebungs-, Human-Approval- und Tool-/Write-Grenzen fuer spaetere Draft-Pfade sind als Schwesterrahmen vorhanden.

Noch nicht explizit fuer den LLM-Draft-Pfad entschieden:

- ob ein spaeterer providerfaehiger Draft-Pfad ueberhaupt eine echte Runtime-`ConversationSession` brauchen duerfte,
- ob bestehende Projektion plus vorhandene Produktobjekte fuer den ersten freigegebenen Draft-Pfad ausreichen muessen,
- ob Session-Identitaet, Speicherlogik und Laufzeitsteuerung je separat gated werden muessen,
- ob ein spaeterer nicht-lokaler Draft-Pfad ohne neue Session-Runtime bewusst begrenzt bleiben soll,
- welcher sichere Default gilt, solange Runtime-/ConversationSession-Fragen offen bleiben.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Runtime-/ConversationSession-Rahmen oberhalb von `synthetic_live`.

Warum jetzt?

Nach Daten, Auth, Evidence, Zielumgebung, Human Approval und Tool-Grenzen bleibt die eigentliche Runtime-Frage uebrig: Reicht ein kontrollierter Draft-Pfad auf Basis vorhandener Projektionen und Objekte, oder kippt der naechste Schritt still in eine neue Session-/Chat-Runtime?

## 5. Optionen

Option A:

- Beschreibung: Jeder spaetere providerfaehige Draft-Pfad bleibt auf bestehende Projektionen und vorhandene Produktobjekte begrenzt. Keine Runtime-`ConversationSession`.
- Vorteile: Kleinster technischer Radius. Passt direkt zum vorhandenen Projektionsmodell.
- Nachteile / Risiken: Kein vorbereiteter Pfad fuer spaetere reichere agentische Sitzungen.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Der erste spaetere providerfaehige Draft-Pfad bleibt bewusst ohne neue Runtime-`ConversationSession`. Bestehende Projektionen und vorhandene Objekte bleiben fuehrend. Eine echte Session-Runtime waere nur als separater spaeterer Gate-Schritt denkbar.
- Vorteile: Kleinster glaubwuerdiger Runtime-Rahmen oberhalb des heutigen Korridors. Verhindert, dass Session-, API- und Persistenzarbeit still in den Draft-Pfad hineinwandert.
- Nachteile / Risiken: Begrenzter Spielraum fuer spaetere agentische Interaktion, bis ein eigener Session-Gate-Schritt bewusst entschieden wird.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- keine neue Runtime-`ConversationSession` fuer den ersten freigegebenen Draft-Pfad;
- bestehende `ProductionConversationProjection` und vorhandene Produktobjekte bleiben fuehrend;
- keine neue Chat-/Session-API, keine Session-Persistenz und keine Laufzeitsteuerung als Teil dieses Schritts;
- keine automatische Uebertragung aus einer hypothetischen Session in `AcceptedEventSpec`, Produktionsplan oder andere Produktobjekte;
- Runtime-/Session-Fragen bleiben ein separater spaeterer Gate-Schritt, auch wenn Daten-, Auth- und Tool-Grenzen sonst geklaert sind;
- keine neue API, keine Persistenz, keine Produktschreibwirkung.

Option C:

- Beschreibung: Ein spaeterer providerfaehiger Draft-Pfad darf direkt auf eine echte Runtime-`ConversationSession` aufbauen.
- Vorteile: Schnellster Weg in Richtung reichere agentische Laufzeit.
- Nachteile / Risiken: Unterlaeuft die bisherige Projektionsgrenze und wuerde neue Runtime-, API-, Persistenz- und Steuerungsarbeit vor dem dafuer noetigen Gate normalisieren.
- Aufwand: scheinbar niedrig, real hoch riskant.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Der sichere Weg ist nicht "Session bauen wir spaeter schon mit", sondern die klare Begrenzung: Der erste freigegebene Draft-Pfad bleibt ohne neue Runtime-`ConversationSession`; Session-Runtime bleibt ein eigener spaeterer Gate-Schritt.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: providerfaehige Draft-Pfade bleiben dauerhaft projektionsbasiert.
- Bei Option B: der naechste kleine Schritt waere hoechstens ein weiterer ADR-/Contract-Rahmen fuer einen spaeteren Session-Gate-Schritt, weiter ohne Runtime-Ausweitung.
- Bei Option C: vor jeder weiteren Arbeit muessten PA41, die Projektionsgrenze und der bisherige 10/10-Gate-Kranz faktisch neu verhandelt werden; kein sicherer Minimalpfad.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- keine neue Runtime-`ConversationSession`,
- bestehende Projektionen und vorhandene Objekte bleiben fuehrend,
- keine neue Chat-/Session-API,
- keine Session-Persistenz,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
