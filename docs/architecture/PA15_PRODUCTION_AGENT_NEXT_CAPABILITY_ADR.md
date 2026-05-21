# PA15 ProductionAgent-v1 Next Capability ADR

Status: Entscheidungsvorlage, keine Runtime-Implementierung
Datum: 2026-05-21
Scope: naechste verantwortbare Produktionsagent-v1-Faehigkeit nach geschlossenem PA10-PA14 DocumentIngestion-Korridor

## 1. Ist-Zustand nach PA14

PA10-PA14 hat den DocumentIngestion-Korridor als read-only Abnahmeanker geschlossen:

- Quelle vorhanden
- Ingestion-Status sichtbar
- Warnungen sichtbar
- Exportanker sicher
- keine Rohtextspiegelung in Conversation-/Output-/Exportankern

Real vorhanden sind damit sichere Quellen-, Hash-, Ingestion-Status- und Warnmarker entlang vorhandener Intake-/ProductionConversation-/Exportpfade. Ebenfalls vorhanden ist eine minimale `ProductionConversationProjection`, die bestehende Spezifikationen, Rueckfragen, Antworten, Quellenanker und Output-/Downloadanker als geordneten read-only Chat-/Session-Verlauf abbildet.

Nicht vorhanden sind weiterhin:

- keine echte `ConversationSession` als persistiertes Produktobjekt
- keine neue API oder Persistenz fuer Klaerzustand
- keine LLM-/Tool-Use-Schicht
- keine OCR-/Parser-/PDF-Verstaendnis-Implementierung jenseits des bestehenden Korridors
- keine automatische Rezept-/Mengen-/Allergen-Generierung
- keine fachliche Freigabe durch Agententext

## 2. Ziel und Nicht-Ziele fuer den naechsten Block

Ziel ist die Entscheidung, welche kleine echte Produktionsagent-v1-Faehigkeit als naechstes verantwortbar vorbereitet werden soll, ohne den heutigen MVP als fertigen LLM-Agenten auszugeben.

Der naechste Block soll:

- sichtbar in Richtung chatzentrierter Produktionsagent fuehren
- auf vorhandenen Quellen-/Ingestion-/Warnankern aufbauen
- keine fachlichen Entscheidungen behaupten, die der Code noch nicht tragen kann
- testbar bleiben
- keine neue Persistenz-, API-, LLM-, OCR-, Parser-, Rezept- oder Allergenwelt einfuehren, solange dies nicht separat entschieden ist

Nicht-Ziele dieses ADR-Slices:

- keine Runtime-Implementierung
- keine neue API
- keine Persistenz, Migration oder Prisma
- keine neue UI-Funktion
- keine LLM-/Tool-Use-/Prompt-Implementierung
- keine OCR-/Parser-/PDF-Verstaendnis-Implementierung
- keine Rezeptkandidaten-Generierung
- keine Allergenlogik DE/EN
- keine Downloadpaket- oder Exportlogik

## 3. Optionenbewertung

### Option A: Rueckfragenmodell / Clarification Model

Beschreibung:

Der Produktionsagent darf strukturierte Rueckfragen aus vorhandenen Unsicherheiten, fehlenden Feldern, Ingestion-Warnungen und Quellenankern ableiten. Er trifft dabei noch keine Fachentscheidung und erzeugt keine Rezepte, Mengen oder Allergenlisten.

Bewertung:

- Produktwert Richtung Zielbild: hoch. Das Zielbild verlangt, dass der Agent nachfragt, bis die Produktion sicher genug ist. Diese Option macht genau diese Faehigkeit zuerst explizit.
- Fake-/Ueberversprechungsrisiko: niedrig bis mittel. Niedrig, wenn Rueckfragen strikt als Klaerbedarf modelliert werden und nicht als fachliche Antwort oder Produktionsfreigabe.
- Technischer Scope: klein bis mittel. Ein erster Slice kann als reines Modell/Schema plus Projection-Anker starten, ohne Persistenz und ohne Generierung.
- Daten-/Compliance-Risiko: niedrig. Es koennen sichere Referenzen auf vorhandene `sourceMetadata`, `documentIngestion.status`, Warncodes und bestehende Spec-Luecken verwendet werden, ohne Rohtexte zu spiegeln.
- Testbarkeit: hoch. Marker- und Modelltests koennen pruefen, dass fallback/failed Quellen strukturierte Klaerbedarfe erzeugen duerfen, extracted/ok ruhig bleibt und keine Fachentscheidung getroffen wird.
- Abhaengigkeiten: PA10-PA14 DocumentIngestion-Warnmarker, bestehende `ProductionConversationProjection`, bestehende `AcceptedEventSpec.missingFields`/Readiness-Signale.

Risiko:

Das Modell darf nicht in freie Chatlogik kippen. Jede Frage braucht eine strukturierte Ursache, Quelle, Schwere und blockierende/nicht blockierende Einordnung.

### Option B: RecipeCandidate-Grenze

Beschreibung:

Eine erste fachliche Kandidatenstruktur fuer Rezepte/Mengen wird spezifiziert, aber noch ohne automatische Generierung oder Nutzung fuer echte Produktion.

Bewertung:

- Produktwert Richtung Zielbild: hoch, weil Rezepte, Mengen und Einkaufsliste Kern des Produktionsagenten sind.
- Fake-/Ueberversprechungsrisiko: hoch. Schon eine Kandidatenstruktur kann als beginnende Rezeptintelligenz gelesen werden, obwohl Generierung, Review, Quellenqualitaet, Skalierung und Human Approval noch nicht getragen sind.
- Technischer Scope: mittel. Es braucht klare Beziehungen zu Rezeptbibliothek, Review-Status, Mengenbasis, Herkunft und spaeterer Aggregation.
- Daten-/Compliance-Risiko: mittel bis hoch. Rezept- und Allergennaehe beruehrt fachliche Haftung, Quellenqualitaet und Freigabegrenzen.
- Testbarkeit: mittel. Schema- und Statusgrenzen sind testbar, fachlicher Nutzen aber erst mit Review-/Fixture-Basis belastbar.
- Abhaengigkeiten: Rezeptstatusmodell, Human Review, spaetere Quantity/Purchase-Grenzen, Allergen-Haftungsentscheidung.

Risiko:

Diese Option zieht frueh Fachdomänenarbeit nach sich und kann den naechsten Slice groesser machen als gewollt.

### Option C: Read-only Download-/Output-Einordnung

Beschreibung:

Vorhandene Outputs und Downloads werden besser eingeordnet, z. B. als Arbeitsbelege, Entwurf, Warnungstraeger oder nicht freigegebene Artefakte. Es entsteht keine neue Agentenfaehigkeit.

Bewertung:

- Produktwert Richtung Zielbild: niedrig bis mittel. Die operative Transparenz steigt, aber der Agent wird nicht klueger.
- Fake-/Ueberversprechungsrisiko: niedrig. Read-only Einordnung ist sicher, solange keine neue Verbindlichkeit behauptet wird.
- Technischer Scope: klein. Vor allem Doku-/Projection-/UI-Marker waeren moeglich.
- Daten-/Compliance-Risiko: niedrig bis mittel. Gute Einordnung kann Compliance-Risiko senken; neue Artefaktlabels duerfen aber keine Freigabe ersetzen.
- Testbarkeit: hoch. Marker-Tests koennen Output-Klassifikation absichern.
- Abhaengigkeiten: bestehende Exportanker, PA13/PA14 Warnmarker, Approval-/Audit-Leitplanken.

Risiko:

Diese Option waere kontrolliert, aber nach PA13/PA14 vor allem weitere Konsolidierung. Sie schiebt die naechste echte Agentenfaehigkeit erneut auf.

### Option D: Tool-/LLM-Gate vorbereiten

Beschreibung:

Die technische Grenze fuer spaetere LLM-/Tool-Nutzung wird definiert: erlaubte Tools, verbotene Toolklassen, Prompt-Injection-Regeln, strukturierte Outputs, Auditmetadaten. Keine Implementierung.

Bewertung:

- Produktwert Richtung Zielbild: mittel. Die spaetere Agentenfaehigkeit wird sicherer vorbereitet, aber fuer Nutzer noch nicht fachlich greifbarer.
- Fake-/Ueberversprechungsrisiko: niedrig, solange es reine Gate-/Security-Arbeit bleibt.
- Technischer Scope: mittel. Gute Definition braucht Tool-Allowlist, Datenklassen, Prompt-Injection-Fixtures, Audit-/Versionierungsrahmen.
- Daten-/Compliance-Risiko: niedrig bis mittel. Als Gate risikosenkend; zu frueh ohne konkrete erste Agentenfaehigkeit kann es abstrakt bleiben.
- Testbarkeit: mittel bis hoch. Negative Fixtures und erlaubte/verbotene Toolklassen sind testbar, aber ohne Orchestrator noch abstrakt.
- Abhaengigkeiten: Security/Permissions-Gate aus `PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`, spaetere LLM-Provider-/Datenfreigabeentscheidung.

Risiko:

Ohne vorher klaren Agenten-Nutzen kann das Gate zu breit werden. Fuer LLM-/Tool-Use fehlen ausserdem noch Provider-, Daten- und Freigabeentscheidungen.

## 4. Empfehlung

Primaere Empfehlung: Option A, Rueckfragenmodell / Clarification Model.

Begruendung:

Option A ist die naechste echte Produktionsagent-v1-Faehigkeit, weil sie direkt am Zielbild ansetzt: Der Agent fragt nach, statt ungeprueft zu entscheiden. Sie nutzt den gerade geschlossenen PA10-PA14-Korridor sinnvoll aus, denn Ingestion-Warnungen, Quellenanker und Spec-Luecken sind belastbare Ursachen fuer strukturierte Klaerbedarfe. Gleichzeitig bleibt das Fake-Risiko beherrschbar, wenn der naechste Slice nur das Modell und die sicheren Ableitungsgrenzen definiert und keine fachlichen Rezepte, Mengen, Allergene, Exporte oder LLM-Antworten erzeugt.

Warum nicht B jetzt:

RecipeCandidate ist produktnah, aber fachlich zu frueh. Ohne geklaertes Rueckfragenmodell, Review-/Freigabegrenze und Quellenqualitaetslogik wuerde eine Rezeptkandidatengrenze schnell wie echte Rezeptintelligenz wirken.

Warum nicht C jetzt:

Output-Einordnung ist sicher, aber nach PA13/PA14 eher weitere read-only Konsolidierung. Sie verbessert Transparenz, erzeugt aber keine neue Agentenfaehigkeit.

Warum nicht D jetzt:

Ein LLM-/Tool-Gate bleibt wichtig, sollte aber auf eine konkrete erste Agentenfaehigkeit bezogen werden. Das Rueckfragenmodell liefert diese konkrete Faehigkeit und kann danach als Input fuer ein engeres Prompt-/Tool-Gate dienen.

Kleinster sinnvoller naechster technischer Slice nach Entscheidung:

`PA16 Clarification Model Slice 1` als Modell-/Projection-Slice ohne Runtime-Automatik:

- kleines `ProductionClarificationQuestion`-Datenmodell im `shared-core` oder ADR-nahem Schemaentwurf
- Ursachen nur aus vorhandenen sicheren Signalen: `missingFields`, `readiness.reasons`, `documentIngestion.status`, `documentIngestion.warnings`, vorhandene Quellenanker
- Frage enthaelt: `questionId`, `reasonCode`, `severity`, `blocking`, `sourceAnchorRef?`, `targetField?`, `text`, `allowedAnswerShape?`
- keine automatische Fachentscheidung, keine Rezept-/Mengen-/Allergen-Generierung, kein LLM, keine neue API, keine Persistenz
- `ProductionConversationProjection` darf diese Fragen read-only darstellen, falls sie bereits uebergeben werden

## 5. Akzeptanzkriterien fuer den naechsten Implementierungsslice

Der naechste Slice ist akzeptiert, wenn:

1. ein kleines, typisiertes Rueckfragenmodell existiert, das Ursachen und Zielbezug einer Frage ausdrueckt
2. mindestens ein fallback/failed Ingestion-Signal oder eine vorhandene Spec-Luecke als strukturierter Klaerbedarf modellierbar ist
3. die Frage keine Fachentscheidung trifft und keine Produktionsfreigabe behauptet
4. keine Rohtexte, extrahierten Texte oder PDF-Inhalte in Rueckfragen-, Conversation- oder Exportankern gespiegelt werden
5. extracted/ok Quellen ohne Warnungen nicht kuenstlich als Problem markiert werden
6. bestehende `ProductionConversationProjection`-Semantik erhalten bleibt und Rueckfragen nur read-only einordnet
7. fokussierte Tests die Scope-Grenzen belegen
8. `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check` gruen sind

## 6. Offene Entscheidungen fuer Alexander

1. Soll PA16 das Rueckfragenmodell zunaechst nur als `shared-core`-Modell plus Tests liefern, oder darf die bestehende `/produktion`-Projection diese strukturierten Fragen bereits read-only anzeigen?
2. Welche Rueckfragen gelten im ersten Slice als blockierend: nur Ingestion `fallback/failed`, nur `missingFields`, oder beide?
3. Soll eine Nutzerantwort im ersten PA16-Slice bereits typisiert beschrieben werden, oder bleibt Antwortverarbeitung vorerst ausdruecklich ausserhalb des Scopes?

## 7. Weiter geltende Stopgrenzen

Weiter gesperrt bleiben:

- keine neue API
- keine neue Persistenz, Migration oder Prisma
- keine freie Chat-/LLM-Antwort
- keine Tool-Ausfuehrung
- keine OCR-/Parser-/PDF-Verstaendnis-Erweiterung
- keine Rezeptkandidaten-, Mengen- oder Allergen-Generierung
- keine automatische Produktionsfreigabe
- keine Downloadpaket- oder Export-Neulogik
- keine Rohtextspiegelung in Conversation-/Output-/Export-/Rueckfragenankern
- kein Featurebau ausserhalb des bewusst entschiedenen PA16-Minimalslices
