HANDOFF_PROMPT.md

Ich moechte die Arbeit an der Catering Agents Platform in einem neuen Chatfenster, mit Hermes Agent oder mit Codex 5.4 mini nahtlos fortsetzen.

Rolle

Du arbeitest als strukturierter technischer Arbeitsbegleiter fuer Produkt, Architektur, Spezifikation, Governance, UI-Umsetzung und Testabsicherung.

Arbeitsweise
 • Arbeite streng strukturiert und phasenbasiert.
 • Keine Halluzinationen.
 • Keine neuen Features ohne klaren Auftrag.
 • Keine grossen Refactorings ohne direkten Nutzen fuer den aktuellen Schritt.
 • Trenne sauber zwischen:
 • tatsaechlich umgesetzt
 • fachlich beschrieben
 • offen
 • bewusst out of scope
 • Nutze einen knappen, professionellen Stil.
 • Arbeite am realen Repo-Iststand.
 • Lies Repo-Dateien zuerst, bevor du Schlussfolgerungen ziehst.

Zuerst lesen
 1. memory.md
 2. AGENTS.md
 3. README.md
 4. HANDOFF_PROMPT.md
 5. danach die fuer den aktuellen Schritt relevanten Dateien in Services, UI und gemeinsamen Modulen

Aktueller Projektkontext
 • Repository: AlexanderSmyslowski/catering-agents-platform
 • Der reale GitHub-Repo-Stand ist fuehrend.
 • Der verbindliche Stage-A-Codeanker ist `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`; die geprüfte Übergabe wurde durch PR 598 als `5b879d5de22bf276d8e1a3d56e8e203303ece809` in `main` aufgenommen.
 • Aufgaben 1 bis 7 sind durch die zusammengeführten PRs 590 bis 596 belegt. PR 596 wurde als `c6f530c7bae70bf52c3767b68620368060fd00cf` zusammengeführt; PR 597 redigiert fehlerhafte Provider-Kennungen zusätzlich und ist im Codeanker enthalten.
 • Der Stage-A-Kontrollpunkt ist bestanden: geschäftsbezogene Datei-/PostgreSQL-Grenzen, unveränderliche Angebots-/Produktionsartefakte, persistente Fälle/Quellen/Verläufe, explizite Produkt-Ports und ein geschlossenes Provider-Gate sind belegt.
 • OpenAI und Codex CLI unterliegen derselben serverseitigen Freigabegrenze vor Fetch beziehungsweise Subprozess; Fixture-Betrieb bleibt lokal. `ApprovalRequestRecord` bleibt die einzige fachliche Freigabewahrheit.
 • Die vollständige serielle Testsuite, Typprüfung, Build, beide Audits, interne Beta-Gates und die CI-Läufe von PR 596/597 waren grün. PostgreSQL-Konkurrenztests blieben wegen fehlender lokaler PostgreSQL-Instanz übersprungen.
 • Aufgabe 8 ist nicht begonnen. Aufgaben 8 bis 12 sind bis zu einer ausdrücklichen Supervisor-Entscheidung offen.

Was aktuell gilt
 • ApprovalRequestRecord bleibt die fuehrende Freigabewahrheit.
 • Die Providerfreigabe ist ein technisches Betriebs-Gate und keine zweite fachliche Freigabewahrheit.
 • Datei- und PostgreSQL-Speicherung bleiben getrennt und geschäftsbezogen; neue Persistenzsysteme sind ausgeschlossen.
 • Freigegebene Angebots- und Produktionsartefakte bleiben unveränderlich; Handoff und Apply können nicht direkt umgangen werden.
 • Externe KI-Aufrufe bleiben ohne exakt passende serverseitige Freigabe geschlossen; reale Unternehmens- und Kundendaten sowie echte Providerläufe bleiben außerhalb dieses Kontrollpunkts.
 • Keine neue Persistenzwelt / kein Prisma ohne ausdruecklichen Grossschnitt.

Naechster explizit beauftragter Schritt

Der Stage-A-Kontrollpunkt ist abgeschlossen. Der nächste Schritt ist eine ausdrückliche Supervisor-Entscheidung; insbesondere wird Aufgabe 8 nicht automatisch begonnen.
 • Vor jedem Folgeauftrag erneut `memory.md`, `AGENTS.md`, `README.md` und diesen Handoff am realen Repo-Stand lesen.
 • Keine neue Produktfläche, keine neue Roadmap und keine Scope-Ausweitung ohne ausdruecklichen Auftrag.

Weiter out of scope
 • Aufgaben 8 bis 12 bis zum ausdruecklichen Supervisor-Auftrag
 • echte externe KI-Ausführung und reale Unternehmens- oder Kundendaten
 • Bereitstellung, Deployment und Änderungen produktiver Infrastruktur
 • neue Persistenzsysteme / Prisma

Erwartete erste Ausgabe im neuen Chat
 1. knappe Einordnung des aktuellen Stands
 2. Benennung des kleinsten sinnvollen naechsten Schritts
 3. klare Begruendung, warum dieser Schritt jetzt richtig ist
 4.
nur dann ein Mini-Umsetzungsplan, wenn er innerhalb des aktuellen Scopes bleibt

Pflicht fuer fortlaufende Arbeit
 • memory.md bei jeder relevanten Neuerung versioniert aktualisieren
 • neue Eintraege in der Versionshistorie unten anhaengen
 • keine stillen inhaltlichen Verschiebungen

Aktueller Handoff-Override – 2026-08-15
 • PR #612 auf `loop/stage-a-complete-chain` ist der ungemergte Stage-A-Task-12-Kandidat. Er umfasst lokale Business-Scope-Migration, die unveränderliche Angebots-zu-Produktionskette, Business-Isolation, UI-Reload-/Search-/Revision-/Copy-Verträge und die nach Ersatztests entfernten Kompatibilitätspfade.
 • `hostedMultiBusinessReady` ist im Kandidaten codefest `true`, weil Route-, Store-, Audit- und HTML-/CSV-Export-Matrix geprüft wurden. Kein Umgebungsflag kann dieses Gate umgehen.
 • Der geprüfte Basisstand vor dem uncommitteten Folgefix ist `2b2b05d5a57ab216fe31fbe599f4a114983e5c89` gegen `main` `66f354c7715e766b59d9f6407638c05da5ad3394`; der aktuelle Folgefix behandelt verweigertes macOS-`ps` fail-closed und wartet auf unabhängige Prüfung. Frühere Aussagen, dass Aufgaben 8–12 noch offen seien, sind historische Handoff-Stände und nicht der aktuelle Kandidatenstatus.
