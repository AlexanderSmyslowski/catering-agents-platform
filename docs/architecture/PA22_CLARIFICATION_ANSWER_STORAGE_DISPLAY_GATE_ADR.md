# PA22 Clarification Answer Storage/Display Gate ADR

Status: Speicher-/Anzeige-Gate, keine Runtime-Implementierung
Datum: 2026-05-21
Scope: spaetere Speicherung und read-only Anzeige kurzer Freitextantworten auf `ProductionClarificationQuestion`

## 1. Ist-Zustand nach PA21

PA21 hat `ProductionClarificationAnswer` als reinen shared-core Modellanker eingefuehrt.

Real umgesetzt ist nur der Modell-/Testanker:

- Option B aus PA20 ist als Zielrichtung bestaetigt: kleines explizites `ProductionClarificationAnswer`-Modell innerhalb bestehender Domain-/Persistenzgrenzen.
- `ProductionClarificationAnswer` bindet jede spaetere Antwort an `questionId` plus stabilen Question-Key mit `reason` und `reasonCode`.
- Aktiv erlaubt ist nur `answerType = shortText`.
- Die Statusmenge ist exakt `draft | submitted | reviewed`.
- Der kurze Antworttext ist auf maximal 500 Zeichen begrenzt.
- Sicherheitsgrenzen gegen Rohtext-/HTML-/Script-Spiegelung, automatische Fachableitung und automatische Spec-Korrekturueberfuehrung sind als Modellgrenzen verankert.

Noch nicht umgesetzt ist weiterhin:

- keine Antwortannahme
- keine Antwortspeicherung
- keine Antwortverarbeitung
- keine neue API
- keine UI-/Projection-Erweiterung
- keine Migration
- keine neue Persistenzwelt
- keine automatische fachliche Ableitung

## 2. Entscheidung dieses Gates

PA22 entscheidet nur, wo kurze Freitextantworten spaeter gespeichert und read-only angezeigt werden duerfen.

Empfehlung: Ein erster Runtime-Slice darf nach PA22 moeglich werden, aber nur als minimaler Speicher-/Anzeige-Slice fuer `shortText`-Antworten innerhalb der bestehenden Domain-/Persistenzgrenze. Runtime bleibt blockiert fuer jede Antwortinterpretation, Spec-Korrekturueberfuehrung, Rezept-/Mengen-/Allergenlogik, neue API-Welt, Prisma, Migration oder neue Persistenzwelt.

## 3. Speicher-Gate

Eine spaetere `ProductionClarificationAnswer`-Speicherung darf nur innerhalb der bestehenden Domain- und Persistenzgrenzen erfolgen.

Zulaessige Richtung:

- eigenes kleines Answer-Modell als klar benannte Domain-Grenze im bestehenden Production-/Conversation-/Clarification-Kontext
- technische Ablage nur ueber die vorhandene `PersistentCollection`-Mechanik beziehungsweise deren bereits bestehende Datei/Postgres-Abstraktion
- keine direkte Vermischung mit `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList` oder `Recipe`
- keine neue Datenbank-/Tabellen-/Prisma-Welt ohne separate ausdrueckliche Freigabe
- keine Migration im ersten engen Runtime-Slice, sofern die bestehende Sammlungsschicht ausreichend ist

Pflichtfelder und Grenzen fuer spaetere Speicherung:

- `answerId`
- `questionId`
- stabiler Question-Key mit `reason` und `reasonCode`
- `answerType = shortText`
- `answerText.kind = shortText`
- `answerText.value` maximal 500 Zeichen nach Normalisierung
- `status`
- Actor/Operator-Kontext, soweit vorhanden
- `createdAt`
- optional `updatedAt`

Statusfluss fuer den ersten Runtime-Slice:

- Empfehlung: Der erste echte Speicher-Slice speichert angenommene kurze Freitextantworten direkt als `submitted`.
- `draft` bleibt vorbereitet fuer eine spaetere UI-Zwischenspeicherung, soll im ersten Runtime-Slice aber nicht aktiv erzeugt werden, solange keine echte Entwurfsoberflaeche existiert.
- `reviewed` bleibt vorbereitet fuer spaetere menschliche Pruefung, soll im ersten Runtime-Slice aber nicht automatisch gesetzt werden.

Speicherung ist nur erlaubt, wenn die referenzierte Frage im vorhandenen Frage-/Conversation-Kontext bekannt und aktiv genug ist. Eine Antwort ohne bekannte `questionId` und ohne passenden stabilen Question-Key ist kontrolliert abzulehnen.

## 4. Anzeige-Gate

Eine gespeicherte Antwort darf spaeter nur read-only in bestehenden Anzeigeankern erscheinen.

Zulaessige Richtung:

- bevorzugt in der bestehenden `/produktion`-`ProductionConversationProjection` als Nutzerantwort-Bubble oder read-only Antwortanker direkt unter der zugehoerigen Agent-Frage
- alternativ in einem bestehenden Detailanker desselben Produktions-/Conversation-Kontexts, falls die Projection zu diesem Zeitpunkt noch nicht speichertauglich ist
- keine neue UI-Welt, kein neues Dashboard und kein separater Antwort-Editor
- keine Antwortbearbeitung im ersten Speicher-/Anzeige-Slice
- keine automatische Ueberfuehrung in Spec-Korrekturpfade
- keine automatische Veraenderung von `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList`, `Recipe`, Downloads, Audit-Freigaben oder Allergenlisten

Anzeige darf nur den sicheren, normalisierten Antworttext und minimale Kontextmarker zeigen. HTML, Scripts, Dokumentrohtexte, PDF-Extrakte, Prompts oder ganze Quelleninhalte duerfen nicht gespiegelt werden.

## 5. Sicherheitsgrenzen

Der spaetere erste Runtime-Slice muss vor Speicherung und Anzeige mindestens folgende Grenzen pruefen:

- HTML/Scripts escapen oder sanitizen, bevor Antworttext in UI, Export, Audit oder Modellkontext gelangt.
- Leere oder nur aus Whitespace bestehende Antworten ablehnen.
- Antworten ueber 500 Zeichen nach Normalisierung ablehnen.
- Unbekannte, ungueltige oder nicht mehr passende `questionId` ablehnen.
- Falschen oder nicht aktivierten Antworttyp ablehnen; aktiv erlaubt bleibt nur `shortText`.
- Question-Key muss zur Frage passen; `reason` und `reasonCode` duerfen nicht frei erfunden werden.
- Keine Rohtext-, PDF-Extrakt-, Prompt- oder vollstaendige Dokumentspiegelung.
- Antworttext bleibt Dateninput, keine Systeminstruktion und kein Tool-Befehl.
- Keine fachliche Interpretation aus Antworttext.
- Keine Rezept-, Mengen-, Einkaufslisten-, Download-, Freigabe- oder Allergenlogik.
- Keine automatische Spec-Korrekturueberfuehrung.

## 6. Akzeptanzkriterien fuer den spaeteren ersten Runtime-Slice

Ein erster Runtime-Slice nach PA22 ist nur akzeptabel, wenn er alle folgenden Punkte erfuellt:

1. Eine kurze Freitextantwort wird streng an eine bestehende `ProductionClarificationQuestion` gebunden.
2. Speicherung erfolgt im freigegebenen `ProductionClarificationAnswer`-Modell innerhalb der bestehenden Domain-/Persistenzgrenze.
3. Der initiale gespeicherte Status ist vorzugsweise `submitted`; `draft` und `reviewed` werden nicht ohne eigene UI-/Review-Logik aktiv erzeugt.
4. Die Antwort wird read-only im bestehenden `/produktion`-Projection-/Conversation-Anker oder einem bestehenden Detailanker angezeigt.
5. Es gibt keine Antwortbearbeitung.
6. Es gibt keine automatische Fachableitung und keine automatische Spec-Korrekturueberfuehrung.
7. Tests sichern XSS/HTML/Scripts, Laenge, leere Antwort, unbekannte Frage-ID, nicht passenden Question-Key und falschen Antworttyp ab.
8. Tests bestaetigen, dass keine Rohtexte/PDF-Extrakte gespiegelt und keine Rezept-/Mengen-/Allergenlogik ausgeloest werden.
9. `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check` sind gruen.

## 7. Maximal drei offene Entscheidungen fuer Alexander

1. Soll der erste Runtime-Slice nach PA22 wirklich direkt eine minimale Speicherung ueber die bestehende `PersistentCollection`-Grenze bauen, oder vorher noch einmal als reiner Implementierungsplan gestoppt werden?
2. Soll der erste Runtime-Slice ausschliesslich `submitted` erzeugen, oder ist ein sichtbarer `draft`-Zustand trotz fehlender Entwurfsoberflaeche gewuenscht?
3. Wo soll die read-only Anzeige zuerst erscheinen: direkt in der bestehenden `/produktion`-Conversation-Projection oder zunaechst in einem bestehenden Detailanker?

## 8. Weiter geltende Stopgrenzen

Weiter gesperrt bleiben:

- keine Antwortannahme in PA22
- keine Antwortspeicherung in PA22
- keine Antwortverarbeitung in PA22
- keine neue API in PA22
- keine UI-Erweiterung in PA22
- keine Migration in PA22
- keine neue Persistenzwelt und kein Prisma
- keine automatische Spec-Korrekturueberfuehrung
- keine fachliche Angebots-, Rezept-, Mengen-, Einkaufslisten- oder Allergeninterpretation aus Antworttext
- keine Produktionsfreigabe aus Antworttext
- keine LLM-/Tool-Use-/OCR-/Parser-Implementierung
- keine Rohtext-, PDF-Extrakt-, Prompt- oder Dokumentspiegelung

## 9. Empfehlung fuer PA23

Nach PA22 bleibt allgemeine Runtime weiter blockiert, aber ein PA23-Minimalslice ist vertretbar, wenn Alexander die drei offenen Entscheidungen eng beantwortet.

Empfohlener PA23-Scope: eine kurze `shortText`-Antwort auf eine bestehende Frage validieren, als `submitted` im freigegebenen Modell ueber die bestehende Persistenzgrenze speichern und read-only im bestehenden `/produktion`-Conversation-Anker anzeigen. Ausdruecklich nicht Teil von PA23 waeren Antwortbearbeitung, Spec-Korrektur, Fachableitung, neue API-Welt, Migration, LLM-/Tool-Use, Rezept-, Mengen-, Einkaufslisten- oder Allergenlogik.
