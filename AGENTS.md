# Projektleitplanken für Codex

## Produkt in einem Satz
Interne Catering-Plattform mit zwei getrennten Agenten:
1. Angebotsagent für Angebotserstellung
2. Produktionsagent für Rezepte, Produktionsplanung und Einkaufslisten

## Aktuelle Lage
Der Produktionsagent ist weiter entwickelt als der Angebotsagent.
Der Kernfluss ist grundsätzlich vorhanden:
Upload oder Eingabe -> Normalisierung -> Rückfragen -> Produktionsplan -> Einkaufsliste

## Aktuelle Hauptprobleme
1. Produktions-UI ist fragil.
2. Fehluploads werden noch nicht sauber backend-seitig bereinigt.
3. Rezeptsuche und Rezept-Matching sind noch zu heuristisch.
4. `backoffice-ui/src/App.tsx` ist zu groß und wartungsanfällig.
5. Der Angebotsagent ist funktional weniger weit als der Produktionsagent.

## Oberstes Ziel der nächsten Iterationen
Nicht neue große Features bauen, sondern den operativen Kernfluss stabil, reproduzierbar und wartbar machen.

## Was Codex vorerst nicht tun darf
- Keine große Architekturänderung.
- Keine Auth-Großintegration.
- Keine LLM-Großintegration.
- Keine gleichzeitige Änderung von UI, Datenmodellen und Rezeptlogik in einer Iteration.
- Keine Umbauten an kanonischen Kernmodellen ohne zwingenden Grund.

## Bereiche mit hoher Vorsicht
- `shared-core/src/types.ts`
- `shared-core/src/rules/*`
- `production-service/src/rules/planning.ts`
- `intake-service/src/app.ts`
- Persistenzlogik Dateispeicher/PostgreSQL
- Rezept-Matching und Rezeptbibliothek

## Arbeitsweise
- Immer nur ein klar abgegrenztes Problem pro Iteration.
- Kleinster sinnvoller Eingriff statt breitem Umbau.
- Vor jeder Umsetzung kurz benennen:
  - Ziel
  - betroffene Dateien
  - Risiko
  - Erfolgskriterium
- Nach jeder Umsetzung kurz prüfen, ob der Kernfluss stabiler wurde.
- Wenn das Risiko mittel oder hoch ist und die Seiteneffekte nicht klar abgrenzbar sind: zuerst nur Analyse und Plan, noch kein Umbau.

## Reihenfolge der nächsten Iterationen
1. Produktions-Kernfluss per Smoke-/E2E-Prüfung absichern.
2. Backend-seitigen Archivierungs- oder Löschpfad für Fehluploads ergänzen.
3. Rezept-Matching für häufige Catering-Gerichte härten.
4. Produktions-UI ohne Verhaltensänderung in kleinere Komponenten aufteilen.
5. Danach Angebotsagent auf Nutzbarkeit und Parität prüfen.

## Erfolgskriterien
- Ein echter Lunch- oder Buffet-Durchlauf funktioniert reproduzierbar.
- Upload -> Rückfragen -> Speichern -> Berechnung -> Ergebnisse bleibt stabil.
- Falsche Uploads lassen sich fachlich sauber archivieren oder löschen.
- Die UI verliert keinen Zustand und zeigt keine Altlasten als aktuellen Vorgang.
- Bekannte Catering-Gerichte finden bevorzugt interne Rezepte.
- Build und Tests bleiben grün.
- Smoke-Tests für den Kernfluss laufen zuverlässig.

## Antwortformat für neue Aufgaben
Wenn die Aufgabe eine konkrete Produktänderung oder Fehlerbehebung betrifft, antworte vor der Umsetzung kurz in dieser Struktur:

1. Ziel dieser Iteration
2. Betroffene Dateien
3. Risiko: niedrig / mittel / hoch
4. Kleinster sinnvoller Umfang
5. Was ausdrücklich nicht geändert wird
6. Umsetzungsvorschlag
7. Prüfkriterien
8. Falls nötig: zuerst nur Plan, noch keine Umsetzung

## Ausnahmen
- Sehr kleine, klar lokalisierte Änderungen dürfen direkt umgesetzt werden, wenn Risiko und Seiteneffekte offensichtlich niedrig sind.
- Reine Verständnisfragen, Statusabfragen oder Zusammenfassungen müssen nicht in das obige Iterationsformat gezwungen werden.
