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
 • Die Arbeit betrifft aktuell einen Governance-Ausbau fuer Aenderungs-/Freigabehistorie sowie den konsolidierten M1-Memory-Strang.
 • Der Governance-Pfad ist bis einschliesslich Stufe 6c umgesetzt und fachlich gruen / abnahmefaehig.
 • M1 Owned Memory Foundation ist im aktuellen Ausbaustand vorerst konsolidiert und abgeschlossen.
 • Die aktuelle Phase ist eine Konsolidierungsphase ohne neue Fachlogik.

Was aktuell gilt
 • ApprovalRequestRecord bleibt die fuehrende Freigabewahrheit.
 • SpecGovernanceStateRecord bleibt die Statusspur.
 • SpecChangeSetRecord bleibt die Aenderungseinheit.
 • Finalize ist nicht gleich Freigabe.
 • Governance bleibt additiv und wird nicht als zweiter Kern aufgebaut.
 • M1 bleibt intern, modellagnostisch und ohne neue API-, Persistenz- oder UI-Flaeche.
 • Keine neue Persistenzwelt / kein Prisma ohne ausdruecklichen Grossschnitt.

Naechster explizit beauftragter Schritt

Kein neuer Fachausbau ist implizit vorgegeben.
 • Zuerst den in memory.md dokumentierten Iststand lesen und am realen Repo abgleichen.
 • Danach den kleinsten sinnvollen, klar beauftragten und scope-sicheren Schritt ableiten.
 • Keine neuen Features, keine neue Produktflaeche und keine Scope-Ausweitung ohne ausdruecklichen Auftrag.

Weiter out of scope
 • Snapshots / lastHardApproved
 • Hard-Approve
 • Point-of-no-return-Ausbau
 • ChangeItem-Persistenz
 • ChangeItem-Anzeige
 • zusaetzliche Governance-Workflows
 • neue API-Endpunkte
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
