# Stage-A-Kontrollpunkt – 2026-08-11

## Verbindlicher Stand

- Repository: `AlexanderSmyslowski/catering-agents-platform`
- Stage-A-Codeanker nach PR 597: `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`
- Geprüfte Übergabe aus PR 598: `5b879d5de22bf276d8e1a3d56e8e203303ece809`
- Aufgaben 1 bis 7: zusammengeführt; PRs 590 bis 596 sind abgeschlossen.
- PR 596: zusammengeführt als `c6f530c7bae70bf52c3767b68620368060fd00cf`.
- PR 597: eng begrenzte Nachbesserung der Provider- und Request-Kennungen, enthalten im Codeanker `51f6cbc36f9f3ec93f5b7fd7d5d7cdb170e15e3b`.

## Belegte Architektur

- Datei- und PostgreSQL-Speicherung bleiben getrennt und geschäftsbezogen.
- `ApprovalRequestRecord` ist die einzige fachliche Freigabewahrheit; die Providerfreigabe ist keine zweite Produktentscheidung, sondern ein technisches Betriebs-Gate.
- Angebots- und Produktionsartefakte werden als unveränderliche, freigegebene Snapshots beziehungsweise Spezifikationen über die bestehenden Grenzen weitergegeben.
- Fälle, Originalquellen und append-only Verläufe sind persistent; Produktion liest Handoff-, Intake- und Quelleninformationen über explizite Ports.
- OpenAI- und Codex-CLI-Aufrufe werden unmittelbar vor Fetch beziehungsweise Subprozess serverseitig gegen Geschäft, Datenklasse, Zweck, Anbieter, Modell, Fähigkeit, Region, Endpunkt, Kosten, Aufbewahrung, Trainingsnutzung und Gültigkeit geprüft. Fehlende oder ungenaue Freigaben führen zu einer geschlossenen Ablehnung.
- Fixture-Betrieb bleibt lokal. Protokolle und Fehlerausgaben enthalten keine Rohtexte, Antworten, Zugangsdaten oder unredigierten Provider-Kennungen.

## Prüfungen

- `npm test -- --maxWorkers=1`: 305 Testdateien bestanden, 1 übersprungen; 1.744 Tests bestanden, 14 übersprungen. Die 11 PostgreSQL-Schema-/Konkurrenztests wurden mangels lokaler PostgreSQL-Instanz übersprungen.
- `npx tsc --noEmit` bestanden.
- `npm run build` bestanden.
- `npm audit --omit=dev` und `npm audit` ohne Schwachstellen.
- Internes Beta-Gate bestanden; GitHub-CI von PR 596 und PR 597 bestanden.
- Keine echte externe KI-Ausführung und keine Verarbeitung realer Unternehmens- oder Kundendaten.

## Übergabegrenze

Aufgabe 8 ist nicht begonnen. Aufgaben 8 bis 12 bleiben offen, bis der Portfolio-Supervisor einen ausdrücklichen nächsten Auftrag erteilt.
