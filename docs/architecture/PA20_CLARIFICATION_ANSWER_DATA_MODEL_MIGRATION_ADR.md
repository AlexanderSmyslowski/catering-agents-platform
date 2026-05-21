# PA20 Clarification Answer Data Model / Migration Decision ADR

Status: Entscheidungsvorlage, keine Runtime-Implementierung
Datum: 2026-05-21
Scope: Datenmodell- und Migrationsschnitt fuer spaetere kurze Freitext-Klaerungsantworten auf `ProductionClarificationQuestion`

## 1. Ist-Zustand nach PA19

PA19 hat bewusst nur einen shared-core Typ-/Testanker geschaffen:

- `allowedProductionClarificationAnswerTypes` enthaelt aktiv ausschliesslich `shortText`.
- `ProductionClarificationAnswerDraft` bindet spaetere Antworten an `questionId` und stabilen Question-Key (`reason`, `reasonCode`).
- Der Draft traegt keinen Antwortinhalt.
- Es gibt keine Antwortannahme, keine Speicherung, keine Verarbeitung, keine API, keine UI-Runtime und keine neue Persistenz.

Die bestehende Architektur bleibt fuer den MVP fuehrend:

- `ProductionClarificationQuestion` entsteht deterministisch aus vorhandenen sicheren Signalen.
- `ProductionConversationProjection` transportiert Rueckfragen aktuell read-only.
- Persistenz laeuft im Repo ueber bestehende `createPersistentCollection(...)`-Sammlungen: dateibasiert unter `CATERING_DATA_ROOT`/`./data` oder, bei gesetzter Datenbank-URL, ueber die bestehende generische `catering_records`-Tabelle.
- `production-service` nutzt diese Grenze bereits fuer `production/plans` und `production/purchase-lists`.
- Repo-Governance bleibt bindend: keine neue Persistenzwelt, kein Prisma und keine Migration ohne ausdrueckliche Entscheidung.

## 2. Daten, die spaetere Antwortspeicherung mindestens braeuchte

Eine spaetere erste Speicherung fuer kurze Freitext-Klaerungen muesste mindestens als Konzept pruefen:

- Fragebindung:
  - `questionId`
  - stabiler Question-Key mit `reason` und `reasonCode`
- Antworttyp:
  - `answerType = shortText`
  - andere Antworttypen bleiben nicht aktiviert
- Antwortinhalt:
  - kurzer Antworttext
  - harte Laengenbegrenzung vor Speicherung
  - Whitespace-/Unicode-Normalisierung
  - Sanitizing-/Escaping-Grenzen fuer UI, Export, Audit und spaetere Modellkontexte
- Herkunfts- und Kontextbindung, soweit vorhanden:
  - Conversation-/Session-Kontext oder ersatzweise bestehender Spec-/Plan-/Request-Kontext
  - Quellenanker nur als sichere Metadaten-/Hash-/Statusmarker, keine Rohtexte
  - Actor/Operator-Kontext, sobald die Antwort als Nutzerhandlung gespeichert wird
- Zeitbezug:
  - `createdAt`
  - `updatedAt`, falls nachtraegliche Korrektur erlaubt wird
- Review-Konzept:
  - optional `reviewStatus` fuer `draft`, `submitted`, `reviewed` oder `rejected`
  - Statuswerte sind in PA20 nur Konzept, keine Runtime-Regel

## 3. Nicht-Ziele

PA20 fuehrt nicht ein und entscheidet nicht fachlich:

- keine Rezept-, Mengen- oder Allergenwahrheit
- keine automatische Fachableitung aus Antworttext
- keine automatische Produktionsfreigabe
- keine Rohtext-, PDF-Extrakt-, Prompt- oder Dokumentspiegelung
- keine neue Multi-Tenancy-, Plattform- oder White-Label-Logik
- keine LLM-/Tool-Use-/OCR-/Parser-Implementierung
- keine neue API
- keine UI-Annahme freier Nutzerantworten
- keine Migration
- keine neue Persistenzwelt und kein Prisma

## 4. Optionenbewertung

### Option A: Bestehende dateibasierte Domain-Ablage spaeter weiter nutzen

Beschreibung: Spaetere Antworten wuerden als kleine JSON-Sammlung innerhalb der bestehenden dateibasierten Ablage unter `CATERING_DATA_ROOT`/`./data` abgelegt, analog zum bestehenden `PersistentCollection`-Muster.

Bewertung:

- MVP-Fit: hoch, weil klein und nah an der vorhandenen Default-Ablage.
- Audit/Review-Faehigkeit: mittel; moeglich, aber nur gut, wenn Antwortdatensatz, Actor, Zeit, Fragebindung und Reviewstatus explizit modelliert werden.
- Implementierungsrisiko: niedrig bis mittel; technisch naheliegend, aber Gefahr eines zu schnellen Runtime-Starts ohne klares Fachmodell.
- Security/XSS/Input-Sanitizing: mittel; muss separat testbar vor der ersten Speicherung definiert werden.
- Migrations-/Persistenzrisiko: niedrig fuer lokalen MVP, hoeher fuer spaetere PostgreSQL-/Migrationsklarheit, wenn die Sammlung nur implizit entsteht.
- Testbarkeit: gut fuer Unit-/Collection-Tests, begrenzt fuer echte Review-/Audit-Ketten.
- Alignment mit Single-Tenant zuerst: gut.

Einordnung: A passt als technischer Implementierungsmechanismus nur dann, wenn das Antwortmodell vorher explizit definiert wird. Als fuehrende Architekturentscheidung waere A zu schwach, weil Frage-Antwort-Review und Audit leicht nur implizit bleiben.

### Option B: Eigenes explizites Answer-Datenmodell in bestehender Persistenz-/Domain-Grenze spaeter einfuehren

Beschreibung: Vor Runtime-Antwortannahme wird ein kleines `ProductionClarificationAnswer`-Modell als eigene Domain-Grenze definiert und danach innerhalb der bestehenden Persistenzmechanik abgelegt, z. B. als klar benannte Sammlung in der vorhandenen `PersistentCollection`-Welt. Keine neue Persistenzwelt.

Bewertung:

- MVP-Fit: hoch; klein genug fuer den ersten echten Antwort-Slice und fachlich sauberer als eine nur dateibasierte Ablageentscheidung.
- Audit/Review-Faehigkeit: hoch fuer MVP-Zwecke, wenn Actor, Fragebindung, Zeit, Status und sichere Quellenanker Bestandteil des Modells werden.
- Implementierungsrisiko: mittel; groesser als A, aber kontrollierbar, weil keine neue API-/DB-Welt noetig ist.
- Security/XSS/Input-Sanitizing: gut testbar, weil Antworttext als eigener Grenztyp mit Laengen-, Normalisierungs- und Sanitizing-Regeln modelliert werden kann.
- Migrations-/Persistenzrisiko: mittel bis niedrig; nutzt vorhandene Datei/Postgres-Abstraktion, vermeidet aber ein stilles Hineinschreiben in bestehende Produktobjekte.
- Testbarkeit: hoch; Modell-, Sanitizing-, Reviewstatus- und Persistenzadaptertests koennen eng geschnitten werden.
- Alignment mit Single-Tenant zuerst: sehr gut; bleibt im vorhandenen internen MVP-Rahmen.

Einordnung: B ist die empfohlene Zielrichtung fuer das naechste Gate, aber noch nicht umzusetzen. Sie verbindet die fachlich notwendige Frage-Antwort-Bindung mit der bestehenden Persistenzgrenze, ohne Prisma, neue Tabellenwelt oder Runtime-Ausweitung vorwegzunehmen.

### Option C: Vollstaendiger Persistenz-/Migrationsschnitt vor Runtime-Antwortannahme

Beschreibung: Vor jeder Antwortannahme wuerde ein umfassender Persistenz- und Migrationsschnitt entworfen, etwa mit eigenem Schema, Migrationsprozess, Retention-/PII-Konzept und Datenbank-Governance.

Bewertung:

- MVP-Fit: niedrig bis mittel; fachlich sauber, aber fuer den ersten kurzen Freitext-Slice wahrscheinlich zu gross.
- Audit/Review-Faehigkeit: hoch, sofern voll umgesetzt.
- Implementierungsrisiko: hoch; Gefahr einer neuen Persistenzwelt entgegen Repo-Governance.
- Security/XSS/Input-Sanitizing: gut adressierbar, aber nicht automatisch besser als B.
- Migrations-/Persistenzrisiko: hoch im Scope, weil genau dieser Grossschnitt bewusst entschieden werden muesste.
- Testbarkeit: hoch, aber mit deutlich groesserem Setup- und Wartungsaufwand.
- Alignment mit Single-Tenant zuerst: nur bedingt; kann Single-Tenant ueberfrachten.

Einordnung: C ist jetzt nicht empfohlen. C wird erst relevant, wenn Alexander bewusst entscheidet, dass Antwortspeicherung Teil eines groesseren Persistenz-/Migrationsprogramms werden soll.

### Option D: Stop - Antworten weiterhin nur typisiert vorbereiten, keine Speicherentscheidung bis Produktabnahme

Beschreibung: Der PA19-Typanker bleibt der letzte Stand. Echte Antworten werden weder gespeichert noch angenommen, bis das Produktziel fuer den Produktionsagenten abgenommen ist.

Bewertung:

- MVP-Fit: mittel; maximal sicher, aber blockiert die erste echte Agentenfaehigkeit.
- Audit/Review-Faehigkeit: niedrig im Produktfortschritt, weil keine Antwortdaten entstehen.
- Implementierungsrisiko: sehr niedrig.
- Security/XSS/Input-Sanitizing: sehr niedriges Runtime-Risiko, da kein Input angenommen wird.
- Migrations-/Persistenzrisiko: sehr niedrig.
- Testbarkeit: gut als Stopgrenze, aber kein Fortschritt fuer Antwortverarbeitung.
- Alignment mit Single-Tenant zuerst: neutral bis gut.

Einordnung: D bleibt die richtige Stop-Empfehlung, falls das Produktziel fuer Nutzerantworten noch nicht freigegeben ist. Nach Alexanders PA18/PA19-Entscheidung ist aber mindestens die Datenmodell-/Migrationsentscheidung selbst sinnvoll.

## 5. Empfehlung

Empfohlen wird Option B als naechstes Gate: ein kleines, explizites `ProductionClarificationAnswer`-Datenmodell innerhalb der bestehenden Domain- und Persistenzgrenzen, bevor irgendeine Runtime-Antwortannahme gebaut wird.

Warum nicht A als fuehrende Entscheidung: Die bestehende dateibasierte Ablage ist als technischer Mechanismus MVP-nah, aber ohne explizites Answer-Modell zu schwach fuer Fragebindung, Review, Audit und Sanitizing-Grenzen.

Warum nicht C: Ein vollstaendiger Persistenz-/Migrationsgrossschnitt waere fuer den ersten kurzen Freitexttyp zu gross und riskiert eine neue Persistenzwelt.

Warum nicht D: D ist sicher, wuerde aber die erste echte Agentenfaehigkeit weiter blockieren, obwohl mit B ein enger, repo-konformer Entscheidungspfad moeglich ist.

Kleinster spaeterer Runtime-Slice nach bewusster B-Entscheidung:

1. `ProductionClarificationAnswer` als shared-core Modell mit `questionId`, Question-Key, `answerType: "shortText"`, normalisiertem kurzen Text, Status, Actor und Zeitstempeln definieren.
2. Laengen-, Normalisierungs-, Sanitizing-/XSS- und Prompt-Injection-Grenzen mit fokussierten Tests absichern.
3. Erst danach eine minimale Annahme-/Speichergrenze bauen; keine fachliche Ableitung, keine Rezept-/Mengen-/Allergenlogik, keine Produktionsfreigabe.

## 6. Akzeptanzkriterien vor echter Antwortspeicherung

Echte Antwortspeicherung darf erst gebaut werden, wenn alle Kriterien erfuellt sind:

1. Alexander hat Option B oder eine andere konkrete Persistenz-/Migrationsrichtung ausdruecklich bestaetigt.
2. Das konkrete `ProductionClarificationAnswer`-Modell ist im `shared-core` als eigener Grenztyp definiert.
3. Der erste aktive Antworttyp bleibt `shortText`; weitere Typen bleiben nicht aktiviert.
4. Fragebindung an `questionId` und stabilen Question-Key ist Pflicht.
5. Speicherung ohne bekannte aktive Frage ist kontrolliert verboten.
6. Antworttext hat harte Laengenbegrenzung, Whitespace-/Unicode-Normalisierung und Sanitizing-/Escaping-Pflichttests.
7. Antworttext erzeugt keine automatische Rezept-, Mengen-, Einkaufslisten-, Allergen-, Download- oder Freigabeentscheidung.
8. Actor, `createdAt`, optional `updatedAt` und ein Review-/Submission-Status sind als Konzept entschieden.
9. Rohdokumente, extrahierte Texte, PDFs und Prompts werden nicht in Antwort-, Conversation-, Export- oder Audit-Ankern gespiegelt.
10. Die Persistenz nutzt entweder die bestehende Sammlungsschicht bewusst oder ein separat entschiedenes Migrationskonzept; kein Prisma und keine neue Persistenzwelt nebenbei.
11. `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check` sind fuer den Implementierungsslice gruen.

## 7. Maximal drei offene Entscheidungen fuer Alexander

1. Soll Option B als verbindliche Zielrichtung fuer das naechste Gate festgelegt werden: kleines explizites Answer-Modell innerhalb der bestehenden Domain-/Persistenzgrenze?
2. Welcher minimale Reviewstatus ist fuer erste kurze Freitextantworten gewuenscht: nur `submitted` oder bereits `draft/submitted/reviewed`?
3. Soll der erste Runtime-Slice Antworten nur speichern und anzeigen, oder duerfen sie nach Review spaeter gezielt in bestehende Spezifikations-Korrekturpfade ueberfuehrt werden?

## 8. Weiter geltende Stopgrenzen

Weiter gesperrt bleiben:

- keine Antwortannahme in PA20
- keine Antwortspeicherung in PA20
- keine Antwortverarbeitung in PA20
- keine neue API in PA20
- keine Migration in PA20
- keine neue Persistenzwelt und kein Prisma
- keine UI-Freitexteingabe als Runtime
- keine LLM-/Tool-Use-/OCR-/Parser-/Rezept-/Allergen-Implementierung
- keine fachliche Angebots- oder Rezeptinterpretation aus Antworttext
- keine Rohtext-, PDF-Extrakt-, Prompt- oder Dokumentspiegelung
- keine automatische Produktionsfreigabe

## 9. Entscheidungsvorschlag fuer PA20

PA20 sollte als Architekturentscheidung abgeschlossen werden mit:

- Zielrichtung: Option B.
- Umsetzung jetzt: keine.
- Naechster enger Slice nur nach Alexanders Entscheidung: shared-core Modellanker fuer `ProductionClarificationAnswer` plus Sicherheits-/Sanitizing-Tests, weiterhin ohne Runtime-Speicherung, falls Alexander erst einen weiteren Typanker wuenscht; oder eine minimale Speichergrenze erst nach expliziter Freigabe der Persistenzrichtung.
