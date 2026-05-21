# PA18 Clarification Answer Processing Gate ADR

Status: verbindliches Gate, keine Runtime-Antwortverarbeitung
Datum: 2026-05-21
Scope: Grenzen, Typen, Sicherheitsregeln und Akzeptanzkriterien fuer spaetere Antwortverarbeitung auf ProductionClarificationQuestion

## 1. Ist-Zustand nach PA16/PA17

PA16/PA17 haben den Rueckfragen-Strang qualitativ geschlossen:

- `ProductionClarificationQuestion` existiert im `shared-core` als typisierte, read-only Rueckfrage.
- Rueckfragen entstehen nur aus vorhandenen sicheren Signalen: `missingFields`, `readiness.reasons`, `documentIngestion.status` und `documentIngestion.warnings`.
- Die bestehende `ProductionConversationProjection` transportiert diese Fragen read-only als strukturierte Agent-Fragen.
- Fragen sind deterministisch sortiert, identische Ursache-/Quellenanker-Kombinationen werden dedupliziert und bekannte sichere Keys erhalten neutrale deutsche Kurzlabels.
- Quellenanker enthalten nur sichere Metadaten-, Hash-, Status- und Warnmarker; Rohtexte, extrahierte Texte und PDF-Inhalte werden nicht gespiegelt.
- Es gibt noch keine Nutzerantwortannahme, keine Nutzerantwortspeicherung, keine Antwortverarbeitung und keine neue API dafuer.

## 2. Ziel dieses Gates

Dieses ADR legt fest, welche Grenzen spaeter gelten muessen, bevor echte Nutzerantworten angenommen, gespeichert oder verarbeitet werden duerfen.

Ziel ist ein enger Sicherheits- und Architekturrahmen fuer einen spaeteren Antwort-Slice, damit Antworten nicht still fachliche Wahrheit, Rezeptentscheidungen, Mengenentscheidungen, Allergenentscheidungen oder Freigaben erzeugen.

## 3. Nicht-Ziele dieses PA18-Slices

Nicht Teil dieses Slices und nicht umzusetzen:

- keine Runtime-Antwortannahme
- keine Nutzerantwortspeicherung
- keine Nutzerantwortverarbeitung
- keine neue API
- keine neue Persistenz, Migration oder Prisma
- keine freie Chat-/LLM-Antwort
- keine Tool-Ausfuehrung
- keine OCR-/Parser-/PDF-Verstaendnis-Erweiterung
- keine Rezept-, Mengen- oder Allergenentscheidung
- keine fachliche Angebotsinterpretation aus Antworttext
- keine Rohtextspiegelung oder PDF-Extraktspiegelung
- keine UI-Workflow-Erweiterung

## 4. Erlaubte spaetere Antworttypen als Konzept

Ein spaeterer Antwort-Slice darf nur eng typisierte Klaerantworten vorbereiten. Erlaubte Antworttypen als Konzept:

1. Kurze Freitext-Klaerung
   - fuer knappe Angaben wie Datum, Personenzahlhinweis, Zeitfenster oder fehlende organisatorische Information
   - kein Ersatz fuer fachliche Rezept-, Mengen- oder Allergenentscheidung

2. Auswahl oder Bestaetigung
   - fuer explizite Bestaetigung oder Korrektur eines vorhandenen sicheren Fragekontexts
   - muss an die urspruengliche Frage gebunden bleiben

3. Ja/Nein oder binaer
   - fuer einfache, klar abgegrenzte Klaerpunkte
   - darf keine mehrstufige fachliche Ableitung ausloesen

4. Datei-/Quellenhinweis
   - nur als spaeterer separater Gate-Pfad
   - braucht vorher eigene Upload-/Source-/Retention-/Security-Grenze

Explizit nicht erlaubt im ersten Antwort-Slice:

- Rezeptauswahl oder Rezeptfreigabe
- Mengen- oder Portionsentscheidung mit Produktionswirkung
- Allergenbewertung oder Allergenfreigabe
- automatische Produktionsfreigabe
- LLM-/Tool-Use-Start aus Antworttext
- freie Anweisung an System, Datei, Netzwerk, Drive, Mail oder Shell

## 5. Sicherheitsgrenzen fuer spaetere Antwortverarbeitung

Spaetere Antworten duerfen nicht automatisch fachliche Wahrheit erzeugen.

Mindestgrenzen:

- Jede Antwort muss eindeutig mit `questionId` und einem stabilen Question-Key oder Reason-Kontext der urspruenglichen `ProductionClarificationQuestion` verbunden sein.
- Antworten ohne bekannte aktive Frage duerfen nicht verarbeitet werden.
- Antworttext bleibt Dateninput, keine Systeminstruktion und kein Tool-Befehl.
- Rohtexte, PDF-Extrakte und vollstaendige Dokumentinhalte bleiben tabu in Conversation-, Antwort-, Export- und Audit-Ankern.
- Aus Antworten duerfen nicht automatisch Rezepte, Mengen, Einkaufslisten, Allergene, Downloadpakete oder Freigaben entstehen.
- Widerspruechliche, unvollstaendige oder sicherheitsrelevante Antworten muessen Review-/Klaerbedarf bleiben.
- Menschliche Freigabe bleibt Pflichtgrenze vor produktionsrelevanter Nutzung.
- Input-Laengen, Whitespace-/Unicode-Normalisierung, Sanitizing und XSS-Schutz muessen vor Runtime-Annahme als Pflichttests vorhanden sein.
- Prompt-Injection-Muster in Antworttext duerfen keine Modell-, Tool-, Export-, Persistenz- oder Rechteaktion ausloesen.

## 6. Daten- und Persistenzgrenze

PA18 fuehrt keine neue Persistenz ein.

Falls spaeter Persistenz fuer Antworten noetig wird, gilt:

- keine neue Persistenzwelt ohne ausdrueckliche Entscheidung
- bestehende Domain-Grenzen respektieren, insbesondere `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList`, `Recipe`, Audit und die bestehende Datenablage
- keine Prisma-/Migrationswelt ohne bewussten Grossschnitt
- Antwortdaten muessen minimal, zweckgebunden und an Frage, Quelle, Actor, Zeitpunkt und Reviewstatus gebunden sein
- sensible Inhalte und PII muessen minimiert und mit Retention-/Access-Regeln versehen werden
- Audit darf genug fuer Nachvollziehbarkeit speichern, aber keine unnoetigen Rohantworten, Rohprompts oder Dokumentextrakte spiegeln

## 7. Minimaler naechster Implementierungsslice nach diesem Gate

Empfehlung: bewusst stoppen, bis Alexander die unten genannten Entscheidungen trifft.

Falls ein weiterer enger Vorbereitungsslice gewuenscht ist, dann nur als Typ-/Testanker ohne Runtime-Annahme:

- `AllowedAnswerType` oder `ProductionClarificationAnswerDraft` im `shared-core` als Konzeptmodell
- Bindung an `questionId` und Question-Key
- Laengen-/Sanitizing-/XSS-/Prompt-Injection-Grenzen als reine Testspezifikation oder statische Helpergrenze
- keine API, keine UI-Annahme, keine Persistenz, keine Verarbeitung, keine fachliche Ableitung

## 8. Akzeptanzkriterien fuer spaetere echte Antwortverarbeitung

Ein spaeterer Runtime-Slice ist erst akzeptabel, wenn mindestens gilt:

1. Antwortannahme ist streng typisiert und an eine bekannte `ProductionClarificationQuestion` gebunden.
2. Unbekannte, abgelaufene oder nicht mehr aktive Fragen werden kontrolliert abgelehnt.
3. Input-Laengen, Sanitizing, XSS- und Prompt-Injection-Grenzen sind testseitig abgesichert.
4. Antworttext erzeugt keine automatische fachliche Wahrheit und keine Produktionsfreigabe.
5. Rezept-, Mengen-, Einkaufslisten-, Allergen- und Downloadentscheidungen bleiben separate, reviewpflichtige Pfade.
6. Rohdokumente, extrahierte Texte und PDF-Inhalte werden nicht in Antwort-/Conversation-/Exportanker gespiegelt.
7. Persistenzentscheidung ist explizit getroffen oder der Slice bleibt vollstaendig transient/read-only.
8. Actor, Fragebezug, Zeitbezug und Reviewstatus sind nachvollziehbar, falls Antwortdaten gespeichert werden.
9. `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check` sind gruen.

## 9. Maximal drei offene Entscheidungen fuer Alexander

1. Soll der naechste Schritt nach PA18 bewusst stoppen, oder darf ein reiner `AllowedAnswerType`-/`ProductionClarificationAnswerDraft`-Typanker ohne Runtime-Annahme vorbereitet werden?
2. Wenn spaeter Antworten gespeichert werden: bestehende dateibasierte Domain-Ablage weiter nutzen oder vorher einen bewussten Datenmodell-/Migrationsschnitt entscheiden?
3. Welche Antworttypen sollen im ersten echten Runtime-Slice erlaubt sein: nur kurze Freitext-Klaerung, auch Auswahl/Bestaetigung, oder zusaetzlich Ja/Nein?

## 10. Weiter geltende Stopgrenzen

Weiter gesperrt bleiben:

- keine Antwortannahme in PA18
- keine Antwortspeicherung in PA18
- keine Antwortverarbeitung in PA18
- keine neue API
- keine neue Persistenz, Migration oder Prisma
- keine LLM-/Tool-Use-/OCR-/Parser-Erweiterung
- keine Rezept-/Mengen-/Allergenentscheidung
- keine automatische Produktionsfreigabe
- keine Rohtext-, PDF-Extrakt- oder Prompt-Spiegelung
- keine weitere Clarification-Frage-Politur ohne neuen realen Produktgrund
