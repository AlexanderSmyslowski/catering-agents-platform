# Produktionsagent v1 - Architektur-Gate

Status: verbindliches Architektur-/ADR-Gate vor weiterem Produktbau
Datum: 2026-05-21
Scope: Zielarchitektur, Modulgrenzen, Sicherheits- und Abnahme-Gates fuer den spaeteren Produktionsagent v1

## 1. Entscheidung

Vor weiterem sichtbarem Produkt- oder Featurebau fuer `/produktion` wird der Produktionsagent v1 als eigene Architekturgrenze behandelt.

Der bestehende MVP-Korridor bleibt fuehrend fuer den aktuellen Betrieb:

- `AcceptedEventSpec` als strukturierte operative Veranstaltungsgrundlage
- `ProductionPlan` als pruefbares Ergebnisobjekt
- `PurchaseList` als abgeleitetes Einkaufsobjekt
- Rezeptbibliothek mit Review-Status
- HTML-/CSV-Exports
- Audit-/Operator-Spuren
- Trusted-Actor-Kontext fuer produktionsnahe Rollenentscheidungen

Der zukuenftige Produktionsagent v1 darf diese Objekte erklaeren, anstossen und verdichten, aber nicht durch unpruefbaren Chattext ersetzen.

### PA5 Nachvollziehbarkeitskorridor

Der aktuell abgesicherte MVP-Korridor ist ein read-only Nachvollziehbarkeitskorridor:

`Upload-Provenance -> Conversation-Quellenanker -> Produktionsoutput/Exportdarstellung`

Er ist intern nachvollziehbar und dient der operativen Rueckverfolgung vorhandener Upload-Metadaten ueber bestehende Projektionen und Exportanker. Er ist ausdruecklich nicht rechtssicherer Audit und gibt keine Vollständigkeitsgarantie für spätere LLM-/Rezept-/Allergen-Outputs. Rohinhalte, neue Parser-/OCR-Logik, LLM-/Tool-Use-Schritte, neue API-Endpunkte und neue Persistenz bleiben ausserhalb dieses Korridors.

## 2. Grundlagen und Iststand

Gelesene fuehrende Grundlagen:

- `AGENTS.md`
- `memory.md`
- `HANDOFF_PROMPT.md`
- `README.md`
- `TESTING.md`
- Auditbericht `hans-codebase-professional-audit-20260521.md`
- `docs/plans/production-workbench-structure.md`
- `docs/product/UI_CHATBOT_GOOGLE_DRIVE_ZIELBILD_DISCOVERY.md`
- `docs/product/UI_IST_FLOW_KARTE_CONVERSATIONAL_WORKBENCH.md`
- `docs/product/UI_WORKBENCH_ZONE_MAPPING_READONLY.md`
- `docs/product/P1_MVP_ROLLEN_RECHTE_MATRIX.md`
- `docs/product/P2_BROWSER_SMOKE_MINISPEZ.md`
- `docs/product/P4_AUDIT_REVIEW_MINISPEZ.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P9_AUTHN_AUTHZ_MVP_RAHMEN_MINISPEZ.md`
- `docs/architecture/MEMORY_ARCHITECTURE.md`

Aktuell real umgesetzt:

- monorepo-basierter MVP mit `shared-core`, `intake-service`, `offer-service`, `production-service`, `print-export` und `backoffice-ui`
- Dokumentupload-/Textgewinnung im bestehenden Upload-Korridor
- deterministische Produktionsplanung und Einkaufsliste aus strukturierten Spezifikationen
- Rezeptbibliothek mit Upload-/Import-/Review-Pfaden
- Exportservice fuer Angebot, Produktionsblatt und Einkaufsliste
- gemeinsamer Audit-/Operator-Kontext
- Security-Hardening 1: Dependency-Audit gruen und Export-XSS-Escaping mit Regressionen
- Security-Hardening 2: Upload-/PDF-Limits und Allowlist mit Regressionen
- Security-Hardening 3: Trusted-Actor-Kontext fuer produktionsnahe Rollenentscheidungen

Noch nicht umgesetzt:

- keine echte `ConversationSession` als Produktobjekt
- keine LLM-Orchestrierung
- keine Tool-Use-Schicht fuer Agenten
- keine echte PDF-Verstaendnis-/Extraktionspipeline jenseits der bestehenden Textgewinnung
- keine Rezeptgenerierung durch LLM
- keine fachlich/rechtlich abgesicherte Allergen Engine DE/EN
- keine neue Persistenz- oder Migrationswelt
- keine echte Login-/OIDC-/SSO-Schicht
- keine vollstaendige PII-/Retention-/Backup-/Access-Architektur

## 3. Zielbild Produktionsagent v1

`/produktion` soll langfristig eine ruhige, weisse, chatzentrierte Produktionsagent-Oberflaeche sein.

Der fachliche Zielablauf:

1. Nutzer legt ein Angebot, PDF, eine E-Mail, Text oder strukturierte Veranstaltungsdaten per Drag & Drop oder `+` in die Produktionsflaeche.
2. Der Agent erzeugt daraus keinen ungeprueften Zaubertext, sondern eine strukturierte `ConversationSession` mit Quellen, Fragen, Unsicherheiten und Zielobjekten.
3. Der Agent fragt nach, bis die operative Produktionsarbeit belastbar moeglich ist.
4. Aus geklaerten Daten entstehen pruefbare Produktobjekte:
   - operative Veranstaltungsspezifikation
   - Rezeptvorschlaege oder Rezeptableitungen je Speise
   - skalierte Mengen je Personenanzahl
   - Rezept-Lebensmittelmengen
   - kumulierte Einkaufsliste
   - Produktionsplan und Arbeitsunterlagen
   - Downloadpaket
   - Allergenlisten Deutsch/Englisch
5. Jeder relevante Schritt bleibt auditierbar: Quelle, Operator, Modell-/Regelentscheidung, Annahme, Freigabe, Export.
6. Menschliche Freigabe bleibt Gate fuer produktionsrelevante Nutzung.

Die Architektur trennt deshalb strikt zwischen:

- Eingabe und Dokumentverarbeitung
- Conversation- und Klaerzustand
- LLM-/Tool-Orchestrierung
- deterministischen Produktobjekten
- fachlichen Engines
- Persistenz und Migration
- Sicherheit und Rechte
- Audit, Provenance und Human Approval

## 4. Nicht-Ziele dieses Gates

Nicht Teil dieses Blocks und nicht umzusetzen:

- kein Featurebau
- keine neue UI-Funktion
- keine echte LLM-Integration
- keine PDF-/OCR-/Parser-Neuimplementierung
- keine Rezeptgenerierung
- keine Allergenautomatik
- keine neue API
- keine neue Persistenzwelt
- kein Prisma als Umsetzung
- keine Migration
- keine neuen Secrets
- keine neue Login-/OIDC-/SSO-Implementierung
- keine Google-Drive-/OAuth-Implementierung
- keine Multi-Tenancy-, Plattform- oder White-Label-Erweiterung
- kein Big-Bang-Refactor von UI oder Services
- keine Behauptung, dass der heutige MVP bereits ein echter LLM-Produktionsagent ist

## 5. Modulgrenzen und Schichten

### 5.1 ConversationSession

Zweck:

- fuehrt den chatzentrierten Arbeitszustand eines Produktionsvorgangs
- verbindet Nutzerinput, Dateien, Rueckfragen, Antworten, Annahmen, Agentenschritte und Zielobjekte
- ist kein Ersatz fuer `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList` oder `Recipe`

Fuehrende Verantwortungen:

- Session-ID, Status und Lebenszyklus
- verknuepfte Quellen und Zielobjekte
- offene Rueckfragen und gegebene Antworten
- Confidence-/Unsicherheitsmarken
- Human-Approval-Status
- Provenance-Verweise auf Dokumente, Modellschritte, Tool-Ergebnisse und Exporte

Nicht verantwortlich fuer:

- PDF-Parsing
- LLM-Prompting
- Rezeptskalierung
- Allergenbewertung
- Exportgenerierung
- Rechteentscheidung

Gate vor Implementierung:

- Datenmodell als ADR spezifizieren
- klare Beziehung zu `AcceptedEventSpec`, `ProductionPlan`, `PurchaseList`, `Recipe` und Audit definieren
- Retention- und PII-Regeln klaeren

### 5.2 DocumentIngestion

Zweck:

- nimmt Angebote, PDFs, E-Mails, Text und spaetere Drive-Quellen kontrolliert entgegen
- erzeugt normalisierte, nachvollziehbare Text-/Struktur-Extrakte fuer die weitere Verarbeitung

Fuehrende Verantwortungen:

- Upload-Limits, MIME-/Extension-Allowlist und Dateigroessenpruefung
- Parser-Auswahl und Parser-Isolation
- Timeout, Fehlerklassifikation und Ablehnung unsicherer Inhalte
- Hash, Dateiname, MIME, Groesse, Quelle und Ingestion-Zeitpunkt
- Trennung von Rohdokument, extrahiertem Text und strukturierten Kandidaten

Nicht verantwortlich fuer:

- LLM-Interpretation
- finale Event-Spezifikation
- Rezeptgenerierung
- Allergenbewertung

Gate vor Implementierung:

- bestehende Upload-Haertung als Mindestlinie beibehalten
- entscheiden, ob Parser in separatem Worker/Sandbox laufen muessen
- PII-/Retention-Regeln fuer Rohdateien und extrahierte Texte festlegen

PA10 DocumentIngestion-v1 Boundary:

- `shared-core` definiert eine kleine, testbare `DocumentIngestionResult`-Grenze fuer vorhandene Dokumentbausteine.
- Das Modell kapselt vorhandene `sourceMetadata`, `context`, `status`, `warnings`, `ingestedAt` und optional extrahierten Text mit Laengenangabe.
- Fallback- oder Problemfaelle werden als Warnung/Status modelliert und nicht als fachlich sicherer Erfolg behauptet.
- Conversation- und Exportanker bleiben weiterhin sichere Provenance-Anker aus Metadaten/Hash-Kurzform; Rohinhalte oder extrahierte Texte werden dort nicht gespiegelt.
- Der Slice fuehrt keine neue Parser-Engine, OCR, LLM-/Tool-Use-Schicht, Angebotssemantik, Rezept-/Allergenlogik, API, Migration oder Persistenzwelt ein.

PA11 Intake DocumentIngestion Bridge:

- Die bestehenden Intake-Dokumentpfade fuer JSON/Base64 und Multipart verwenden intern `ingestDocument(...)` fuer die kontrollierte Textgewinnung.
- Die API bleibt rueckwaertskompatibel und ergaenzt nur sichere Marker in `documentIngestion`: `ingestionStatus`, `warnings` und vorhandene `sourceMetadata`.
- Audit-Details duerfen Ingestion-Status und Warnungen enthalten, aber keine Rohtexte oder extrahierten Inhalte.
- PDF-/Fallback-/Problemfaelle werden als Warnung/Status sichtbar und nicht als extrahierter Erfolg behauptet.
- Der Slice fuehrt keine neue Parser-Engine, OCR, LLM-/Tool-Use-Schicht, Angebotssemantik, Rezept-/Allergenlogik, neue Persistenz, Migration oder neue Produktlogik ein.

PA12 Read-only Ingestion-Warnungen:

- Bestehende Intake-Dokumentpfade speichern sichere `rawInputs[].documentIngestion`-Marker mit Status und Warnungen, damit bestehende Detail-/ProductionConversation-Kontexte ohne neue API-Welt darauf zugreifen koennen.
- Die `ProductionConversationProjection` erzeugt bei fallback/failed oder vorhandenen Warnungen nur einen Systemhinweis zur unsicheren/fallback Quelle; sie interpretiert die Quelle nicht fachlich.
- `/produktion` und die Intake-Detailkarte zeigen knappe read-only Warnhinweise; extracted/ok bleibt ohne Warnspur.
- Neue Warn-/Conversation-Anker enthalten nur Dateiname/Dokumentanker, Status und Warncodes, keine Rohtexte oder extrahierten Inhalte.
- Der Slice fuehrt keine neue Parser-Engine, OCR, LLM-/Tool-Use-Schicht, Angebotssemantik, Rezept-/Allergenlogik, API-Welt, Persistenz, Migration oder neue Produktlogik ein.

### 5.3 LLM Orchestrator

Zweck:

- steuert Modellaufrufe, Tools, Prompts, Guardrails und Rueckfragen
- uebersetzt unstrukturierte Inputs in strukturierte Kandidaten, nie direkt in ungepruefte Produktwahrheit

Fuehrende Verantwortungen:

- Prompt-Templates und Versionierung
- Tool-Registry mit Allowlist
- Input-/Output-Schemas
- Prompt-Injection-Abwehr
- Kontextbegrenzung und Resolver-Auswahl
- Modell-/Provider-Metadaten
- Confidence, Unsicherheiten und Rueckfragepflicht
- keine stillen Writes ohne expliziten erlaubten Tool-Kontext

Nicht verantwortlich fuer:

- Persistenz als Datenbankadapter
- finale fachliche Freigabe
- Export-Sanitizing
- AuthN/AuthZ-Entscheidungen

Gate vor Implementierung:

- Tool-Allowlist und verbotene Toolklassen definieren
- strukturierte Outputs per Schema erzwingen
- Modellantworten nur als Kandidaten behandeln
- Prompt-Injection-Testkorridor definieren

### 5.4 RecipeGeneration

Zweck:

- erzeugt oder waehlt Rezeptkandidaten je Speise und ueberfuehrt sie in pruefbare Rezeptobjekte

Fuehrende Verantwortungen:

- Unterscheidung zwischen vorhandener Rezeptbibliothek, Web-/Quellenkandidat, LLM-Vorschlag und menschlich freigegebenem Rezept
- Mengenbasis, Ausbeute, Portionslogik und Skalierungsannahmen
- Herkunft, Quellen, Version und Review-Status
- Konflikte zwischen Rezeptquelle, Spezifikation und Produktionsanforderung

Nicht verantwortlich fuer:

- finale Allergenhaftung
- Einkaufskumulierung ueber alle Rezepte
- Exportlayout

Gate vor Implementierung:

- Rezeptstatusmodell klaeren: Kandidat, review_required, approved_internal, rejected
- keine automatische Nutzung nicht freigegebener Rezeptkandidaten fuer echte Produktion
- Testdaten und fachliche Review-Beispiele definieren

### 5.5 Allergen Engine DE/EN

Zweck:

- leitet Allergenhinweise aus Rezeptzutaten, Quellen und manuellen Pruefungen ab
- erzeugt deutsche und englische Allergenlisten als pruefpflichtige Arbeitsartefakte

Fuehrende Verantwortungen:

- Allergen-Taxonomie und Sprachmapping DE/EN
- Zutat-zu-Allergen-Regeln
- Unsicherheitsmarken bei unklaren Zutaten oder Quellen
- Trennung von automatisch erkannt, manuell bestaetigt und offen
- Verweis auf Rezeptversion und Quelle

Nicht verantwortlich fuer:

- rechtliche Freigabe
- medizinische Beratung
- finale Haftungsentscheidung

Gate vor Implementierung:

- Alexander muss entscheiden, ob Allergenlisten rechtlich verbindlich oder nur operative Hinweise sind
- Human Approval ist vor echter Nutzung zwingend
- fachliche Testfixtures fuer DE/EN und Grenzfaelle definieren

### 5.6 Quantity/Purchase Aggregation

Zweck:

- skaliert Rezeptmengen und kumuliert Einkaufsbedarfe ueber alle Gerichte

Fuehrende Verantwortungen:

- Portions-/Personenzahl-Skalierung
- Einheitennormalisierung und Umrechnung
- Aggregation gleicher oder aequivalenter Zutaten
- Rundung, Gebinde, Sicherheitsaufschlaege und Ausschussannahmen
- Rueckverweis von Einkaufspositionen auf Rezept, Gericht und Quelle

Nicht verantwortlich fuer:

- Lieferantenpreise oder Warenwirtschaft
- Bestellungen
- Lagerverwaltung

Gate vor Implementierung:

- bestehende `PurchaseList`-Logik bewahren und modularisieren statt ersetzen
- Einheiten-/Gebinde-Grenzen fachlich pruefen
- Regressionen fuer Mengen- und Aggregationsfaelle definieren

### 5.7 Export/Download

Zweck:

- erzeugt sichere, reproduzierbare Downloadartefakte fuer Produktion, Einkauf, Rezepte und Allergene

Fuehrende Verantwortungen:

- HTML-/CSV-/spaetere PDF-Erzeugung
- XSS-/Injection-Schutz
- Dateinamen und Content-Type
- Artefaktmanifest fuer Downloadpakete
- Verknuepfung mit Session, Produktobjekt, Quelle und Freigabestatus

Nicht verantwortlich fuer:

- fachliche Objektberechnung
- LLM-Ausgabevalidierung
- Rechteentscheidung jenseits expliziter Export-Gates

Gate vor Implementierung:

- bestehendes Export-XSS-Hardening bleibt Mindestlinie
- Downloadpaket erst nach Human Approval fuer produktionsrelevante Inhalte
- Audit-/Provenance-Verweis fuer jedes Artefakt

### 5.8 Audit/Provenance

Zweck:

- macht jeden produktionsrelevanten Schritt nachvollziehbar

Fuehrende Verantwortungen:

- Quelle, Operator, Zeitpunkt und Aktionstyp
- Dokumenthash und Ingestion-Metadaten
- Modell-/Prompt-/Tool-Versionen, soweit LLM betroffen ist
- strukturierte Entscheidung: Vorschlag, Annahme, Nutzerantwort, Review, Freigabe, Export
- Beziehung zwischen ConversationSession und Produktobjekten

Nicht verantwortlich fuer:

- UI-Darstellung als Timeline
- AuthN/AuthZ-Pruefung selbst

Gate vor Implementierung:

- Audit-Events fuer LLM-/Tool-Schritte vorab definieren
- sensible Inhalte minimieren; keine unnoetigen Rohprompts oder PII in Audit speichern
- Zugriff auf Audit read-only weiterhin rollen-/trusted-geschuetzt halten

### 5.9 Persistence/Migrations

Zweck:

- fuehrt Produktobjekte, Sessions, Quellen, Artefakte und Audit konsistent und migrierbar

Fuehrende Verantwortungen:

- klare Collections/Tabellen je Objektklasse
- Migrationsstrategie fuer spaetere Strukturwechsel
- Backup-/Restore-Verhalten
- Retention und Loeschkonzept
- Datenintegritaet zwischen Session, Source, Spec, Plan, Recipe, PurchaseList, Export und Audit

Nicht verantwortlich fuer:

- fachliche Generierung
- AuthN-Provider

Gate vor Implementierung:

- keine neue Persistenzwelt in diesem Gate
- vor Umsetzung entscheiden: vorhandene generische Persistenz weiter modularisieren oder bewusster Datenmodell-/Migrationsschnitt
- kein Prisma ohne ausdruecklichen Grossschnitt

### 5.10 Security/Permissions

Zweck:

- schuetzt Eingaben, interne Daten, Agenten-Tools, Exporte und Auditpfade

Fuehrende Verantwortungen:

- Trusted Actor Context
- Rollen-/Rechte-Gates fuer read-only, mutierend, Audit, Export und spaetere Agentenaktionen
- Upload-/PDF-Grenzen
- Export-XSS-Schutz
- Prompt-Injection-/Tool-Use-Grenzen
- PII-/Retention-/Backup-/Access-Regeln
- Betriebsgrenze: interne Plattform, nicht oeffentlich exponiert

Nicht verantwortlich fuer:

- fachliche Planung selbst
- Prompt-Inhalt jenseits Sicherheitsregeln

Gate vor Implementierung:

- direkte API-Exposition ohne Proxy-/AuthN-Rahmen bleibt verboten fuer echte Daten
- read-only Export- und Detailpfade vor echter Nutzung neu klassifizieren
- Tool-Use fuer LLMs nur mit expliziter Allowlist, kein Shell-/Dateisystem-/Netzwerkzugriff ohne eigenes Gate

## 6. Datenfluss vom Angebots-PDF bis Downloadpaket

Ziel-Datenfluss fuer v1:

1. Input
   - Nutzer legt Angebots-PDF oder Text in `/produktion` ab.
   - UI sendet an kontrollierten DocumentIngestion-Pfad.
   - Trusted Actor Context wird fuer mutierende Aktion geprueft.

2. Ingestion
   - Upload-Limits, MIME-/Extension-Allowlist und Groessenpruefung greifen.
   - Rohquelle erhaelt Source-ID, Hash, Metadaten und Retention-Klasse.
   - Parser erzeugt extrahierten Text oder kontrollierten Fehler.

3. ConversationSession
   - Neue oder bestehende Session verknuepft Source-ID und Operator.
   - Session haelt offene Rueckfragen, Unsicherheiten und Zielobjekte.

4. LLM-/Kandidatenphase
   - LLM Orchestrator verarbeitet nur erlaubten Kontext und Source-Extrakt.
   - Output ist strukturierter Kandidat, kein finaler Produktzustand.
   - Prompt-Injection-Anweisungen aus Dokumenten duerfen keine Tools, Exporte oder Writes ausloesen.

5. Klaerung
   - Agent formuliert Rueckfragen.
   - Nutzerantworten werden strukturiert erfasst und an Session/Spec-Kandidaten gebunden.
   - Unklare, widerspruechliche oder sicherheitsrelevante Punkte bleiben blockierend.

6. Produktobjekte
   - Aus geklaerten Daten entsteht oder aktualisiert sich `AcceptedEventSpec`.
   - Rezeptkandidaten entstehen aus Bibliothek, Quellen oder LLM-Vorschlaegen und bleiben reviewpflichtig.
   - Produktionsplan und Einkaufsliste entstehen aus freigegebenen/ausreichend geprueften Daten.

7. Allergen DE/EN
   - Allergen Engine erzeugt Vorschlaege mit Herkunft und Unsicherheiten.
   - Menschliche Pruefung entscheidet Freigabe/Offen/Zurueckweisung.

8. Human Approval
   - Produktionsrelevante Nutzung verlangt explizite menschliche Pruefung.
   - Finalisierung ist weiterhin nicht automatisch Freigabe.

9. Export/Download
   - Exportservice erzeugt HTML/CSV/spaetere Paketartefakte mit Escape-/Sanitizing-Gates.
   - Downloadpaket enthaelt Manifest: Quellen, Objektversionen, Freigabestatus, Zeitpunkt.

10. Audit/Provenance
   - Alle relevanten Schritte schreiben Audit-/Provenance-Ereignisse.
   - Audit speichert genug fuer Nachvollziehbarkeit, aber nicht unnoetig PII oder komplette Rohprompts.

## 7. Sicherheitsannahmen und Gates

### 7.1 Trusted Actor Context

Aktuelle Mindestlinie:

- `x-actor-name` bleibt nur lokaler Dev-/Test-Kompatibilitaetsheader.
- Produktionsnahe Rollenentscheidungen stammen aus `x-catering-actor-name` plus passendem `x-catering-trusted-secret`.
- Mutierende Pfade duerfen bei gesetztem Secret nicht durch frei gesetzte Header nutzbar sein.

Gate fuer v1:

- LLM-/Agentenaktionen duerfen nie mehr Rechte haben als der ausloesende Trusted Actor.
- Jede Tool-Ausfuehrung erbt Actor, Rolle, Session und Zweck.
- Direkter Servicezugriff ohne Proxy-/AuthN-Rahmen bleibt fuer echte Daten unzulaessig.

### 7.2 Upload-/PDF-Limits

Aktuelle Mindestlinie:

- zentrale Limits, MIME-/Extension-Allowlist und streambasierte Groessenpruefung sind vorhanden.

Gate fuer v1:

- Parserfehler duerfen nicht in unkontrollierte Fallbacks kippen.
- Rohdateien, extrahierte Texte und strukturierte Kandidaten brauchen getrennte Retention- und Zugriffsklassen.
- Fuer produktionsnahe PDFs ist Worker-/Sandbox-Isolation oder gleichwertige Begruendung zu entscheiden.

### 7.3 Export-XSS-Schutz

Aktuelle Mindestlinie:

- HTML-Exports escapen datengetriebene Texte; XSS-Regressionen existieren.

Gate fuer v1:

- Alle LLM-, Dokument- und Rezepttexte bleiben vor HTML/PDF-Ausgabe escapet oder sanitizet.
- CSV-/Dateiname-/Content-Disposition-Injection ist vor spaeteren Downloadpaketen mitzupruefen.
- Kein `dangerouslySetInnerHTML` oder vergleichbarer Bypass fuer ungepruefte Inhalte.

### 7.4 Prompt-Injection-/Tool-Use-Grenzen

Gate fuer v1:

- Dokumentinhalt ist Dateninput, keine Instruktion an Tools.
- Tools werden nur ueber feste Allowlist und strukturierte Schemas aufgerufen.
- Keine Shell-, Dateisystem-, Netzwerk-, Mail-, Drive- oder Persistenz-Writes ohne explizites separates Gate.
- Modellantworten koennen Rueckfragen oder Kandidaten erzeugen, aber keine Freigabe, keinen Export und keine Loeschung ausloesen.
- Prompt- und Tool-Versionen werden fuer reproduzierbare Audits referenziert.

### 7.5 PII, Retention, Backup, Access

Gate fuer v1:

- PII-Klassen fuer Kunden-, Event-, Mitarbeiter-, Allergie- und Produktionsdaten definieren.
- Retention fuer Rohdokumente, extrahierte Texte, Sessions, Exporte und Audit festlegen.
- Backup-/Restore-Pfad vor echter Nutzung testen.
- Zugriff auf read-only Datenpfade, Exporte und Audit neu klassifizieren.
- Keine Drive-/Cloud-Quelle ohne Scope-, Token-, Rechte- und Auditentscheidung.

## 8. Qualitaets- und Abnahme-Gates

Vor echter Nutzung mit realen Produktionsdaten muessen zwingend gruen sein:

### 8.1 Technische Gates

- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- Upload-Security-Regressionen
- Export-XSS-Regressionen
- Trusted-Identity-/Access-Control-Regressionen
- Prompt-Injection-/Tool-Use-Regressionen vor erster LLM-Integration
- Datenmigrations-/Backup-/Restore-Check vor neuer Persistenzstruktur

### 8.2 Architektur-/Review-Gates

- ADR fuer `ConversationSession` und Objektbeziehungen
- ADR fuer LLM Orchestrator, Tool-Allowlist und Prompt-Versionierung
- ADR fuer DocumentIngestion-Sandbox/Worker-Entscheidung
- ADR fuer Allergen Engine DE/EN und Haftungs-/Freigabegrenze
- Review der read-only vs. mutierenden Pfade vor echter Datenexposition
- Human-Approval-Prozess fuer produktionsrelevante Artefakte

### 8.3 Fachliche Gates

- Beispielvorgaenge mit echtem Angebotsinput durchgespielt
- Rezeptkandidaten manuell pruefbar und nicht automatisch freigegeben
- Mengen-/Einkaufsaggregation mit Grenzfaellen getestet
- Allergen DE/EN mit fachlichen Grenzfaellen getestet
- Exportpaket mit Manifest und Provenance pruefbar

### 8.4 Human Approval

Human Approval ist zwingend fuer:

- Nutzung neuer oder LLM-generierter Rezeptkandidaten
- produktionsrelevante Mengenentscheidungen bei Unsicherheit
- Allergenlisten DE/EN
- finale Downloadpakete fuer echte Produktion
- jede spaetere Write-Back- oder Drive-Output-Aktion

## 9. Migrationspfad vom aktuellen MVP-Korridor

### 9.1 Was bleibt

- `AcceptedEventSpec` bleibt operative Veranstaltungsgrundlage.
- `ProductionPlan` bleibt pruefbares Ergebnisobjekt.
- `PurchaseList` bleibt Einkaufsgrundlage.
- Rezeptbibliothek und Review-Status bleiben relevant.
- Exportservice bleibt Ausgangspunkt fuer HTML/CSV-Artefakte.
- Audit-/Operator-Kontext bleibt Pflichtanker.
- Trusted Actor Context bleibt Mindest-Sicherheitslinie.
- bestehende Tests, Build und Smoke-Korridor bleiben Regressionsbasis.

### 9.2 Was ersetzt oder modularisiert wird

Nicht sofort ersetzen, sondern schrittweise modularisieren:

- Document-Text-Gewinnung wird zu `DocumentIngestion` mit Source-/Hash-/Retention-Konzept erweitert.
- UI-Chat-/Rueckfragezustand wird von reinen Komponenten-/Formularzustaenden zu `ConversationSession` gehoben.
- heutige Produktionsplanung bleibt, wird aber spaeter klar von LLM-Kandidaten und RecipeGeneration getrennt.
- Rezeptsuche/-Discovery wird als Quelle fuer Rezeptkandidaten gefuehrt, nicht als finale Wahrheit.
- Exportservice wird um Manifest-/Paketlogik erst nach Freigabe erweitert.
- Audit wird um Provenance fuer LLM-/Tool-/Source-Schritte erweitert.

### 9.3 Was nicht migriert wird, solange kein Gate gruen ist

- keine Rohdokumente in neue Speicherstruktur ohne Retention-Entscheidung
- keine Conversation-Persistenz ohne Datenmodell-ADR
- keine LLM-Prompts oder Toolausfuehrungen ohne Security-Gate
- keine Allergenlisten als verbindliche Artefakte ohne fachliche Haftungsentscheidung
- keine neue Datenbank-/Prisma-Welt ohne ausdruecklichen Grossschnitt

## 10. Kleinste naechste Implementierungs-Slices nach diesem Gate

Erst nach diesem Dokument und gesonderter Entscheidung. Reihenfolge bewusst klein:

1. ADR `ConversationSession` Datenmodell und Objektbeziehungen
   - nur Dokument/API-Schema-Entwurf, noch keine Laufzeitimplementierung
   - klärt Session, Source, Question, Answer, Candidate, Approval, TargetObject

2. Technische Source-/Provenance-Metadaten fuer bestehende Uploads nachziehen
   - minimale Erweiterung entlang vorhandener Uploadpfade
   - Hash, Quelle, Dateityp, Groesse, Ingestion-Zeitpunkt
   - keine neue Parser-Engine

3. Read-only Conversation-Projection fuer `/produktion`
   - zeigt vorhandene Rueckfragen, Antworten und Zielobjekte als Session-nahe Projektion
   - keine freie LLM-Eingabe, keine neue Generierung

4. Prompt-Injection-/Tool-Use-Testkorridor als leere Sicherheitsvorgabe
   - Tests/Fixtures fuer boesartige Dokumentinstruktionen
   - noch kein LLM, aber erwartete Blockierungsregeln dokumentiert/testbar

5. RecipeCandidate-Grenze spezifizieren
   - vorhandene Rezeptbibliothek, Discovery und spaetere LLM-Vorschlaege sauber trennen
   - keine automatische Produktionsfreigabe

6. Allergen-DE/EN-Entscheidungs-ADR
   - rechtlich verbindlich vs. operativer Hinweis entscheiden
   - Taxonomie, Review und Human Approval definieren

7. Exportpaket-Manifest spezifizieren
   - nur Datenvertrag/ADR
   - Quellen, Objektversionen, Freigabestatus, Exportzeitpunkt

## 11. Offene Entscheidungen fuer Alexander

1. Soll Produktionsagent v1 weiterhin strikt interne Single-Tenant-Plattform bleiben oder mittelfristig echte Benutzer-/Teamkonten vorbereiten?
2. Wird AuthN spaeter ueber Reverse Proxy/OIDC/SSO geloest oder applikationsintern?
3. Duerfen read-only Detail- und Exportpfade fuer echte Daten nur hinter AuthN erreichbar sein? Empfehlung: ja.
4. Welche Rohdaten duerfen wie lange gespeichert werden: PDFs, extrahierte Texte, Prompts, Modelloutputs, Exporte?
5. Soll DocumentIngestion PDFs in separatem Worker/Sandbox verarbeiten?
6. Welche LLM-Provider kommen infrage und welche Daten duerfen dorthin gesendet werden?
7. Welche Tools darf der LLM Orchestrator ueberhaupt nutzen?
8. Sind Allergenlisten DE/EN rechtlich verbindlich oder nur interne operative Hinweise?
9. Wer darf Human Approval fuer Rezepte, Allergene und finale Produktionspakete geben?
10. Wann ist ein neuer Persistenz-/Migrationsschnitt gross genug, um bewusst entschieden zu werden?

## 12. ADR-Folge

Dieses Dokument ist das Gate, nicht die Umsetzung.

Folgende ADRs sollten vor Featurebau folgen:

- ADR-PA1: `ConversationSession` und Produktobjektbeziehungen
- ADR-PA2: `DocumentIngestion` Source-/Hash-/Retention-Modell
- ADR-PA3: LLM Orchestrator, Tool-Allowlist und Prompt-Injection-Grenzen
- ADR-PA4: RecipeCandidate/RecipeGeneration und Human Review
- ADR-PA5: Allergen Engine DE/EN und Haftungsgrenze
- ADR-PA6: Exportpaket, Manifest und Provenance
- ADR-PA7: Persistence/Migrations-Entscheidung fuer v1

Bis diese Folgeentscheidungen getroffen sind, bleibt sichtbarer Produktbau fuer echte LLM-/PDF-/Rezept-/Allergen-Automatik gesperrt.
