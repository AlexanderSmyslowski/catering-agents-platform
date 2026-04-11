# memory.md

version: 5.16
date: 2026-04-11
status: active
repo: AlexanderSmyslowski/catering-agents-platform

## Zweck
Diese Datei ist die fuehrende Kurzreferenz fuer neue Chatfenster, Hermes Agent, Codex 5.4 mini und andere Arbeitskontexte.
Sie soll den aktuellen Projektstand, den Governance-Bauplan, die Leitplanken und den naechsten explizit beauftragten Schritt knapp und belastbar festhalten.

## Repo-Kontext
- Repository: `AlexanderSmyslowski/catering-agents-platform`
- Produkt: Catering Agents Platform
- Monorepo fuer spezialisierte Catering-Agenten und Backoffice-UI
- Laut `README.md` umfasst der aktuelle MVP insbesondere:
  - `offer-service`
  - `intake-service`
  - `production-service`
  - `shared-core`
  - `print-export`
  - `backoffice-ui`

## Projektkontext der aktuellen Arbeit
- Aktuelles Arbeitsthema: Governance-Ausbau fuer Aenderungs-/Freigabehistorie, bewusst klein und sequenziell
- Leitlinien bleiben bindend:
  - deterministischer, pruefbarer Produktkern
  - keine unnoetige Plattformbildung
  - keine neue Persistenzwelt / kein Prisma ohne bewussten Grossschnitt
  - kleine echte Bausteine
  - bestehende Approval-Request-Mechanik bleibt fuehrende Freigabewahrheit
  - Governance additiv, nicht als zweiter Kern
  - keine Vermischung von Stufen
  - keine Out-of-Scope-Themen still mitziehen

## Aktueller Gesamtstand
- Der Governance-Pfad ist bis einschliesslich **Stufe 6b** umgesetzt und fachlich gruen / abnahmefaehig.
- Die Umsetzung baut sauber sequenziell aufeinander auf.
- Der Produktkern bleibt fuehrend; es wurde kein Prisma eingefuehrt.
- Die aktuelle Phase ist ausdruecklich eine **Konsolidierungsphase** und nicht ein neuer Fachblock.
- In dieser Phase gilt: keine neue Fachlogik, keine Vorgriffe auf spaetere Stufen, keine stillen Erweiterungen.

## Governance-Stand im Detail

### Stufe 3a - ApprovalTrigger & Governance-State
- Status: fachlich gruen / abnahmefaehig
- Minimaler `ApprovalTrigger` vorhanden
- Minimaler `SpecGovernanceStateRecord` vorhanden
- `pending_reapproval` wird fuer relevante Faelle gesetzt
- Bestehende `ApprovalRequestRecord`-Mechanik bleibt fuehrende Wahrheit
- Keine UI-Ausweitung, keine Snapshots, keine neue Persistenzwelt

### Stufe 3b - ChangeSet & Finalize (minimal)
- Status: fachlich gruen / abnahmefaehig
- Minimales `SpecChangeSetRecord` vorhanden
- Genau ein offenes ChangeSet pro Spec
- `finalizeChangeSet(...)` als kleine Backend-Funktion vorhanden
- Finalisierung ist ausdruecklich **nicht** gleich Freigabe
- Keine ChangeItem-Persistenz, keine Snapshots

### Stufe 3c - erste ChangeSet-Sichtbarkeit (read-first)
- Status: fachlich gruen / abnahmefaehig
- Read-only Sichtbarkeit des Governance-Status und des sichtbaren ChangeSets im bestehenden UI-Kontext
- Sichtbares ChangeSet = offenes ChangeSet oder zuletzt finalisiertes ChangeSet
- Keine neue Schreiblogik

### Stufe 4a - minimale Finalize-Aktion im UI-Pfad
- Status: fachlich gruen / abnahmefaehig
- Kleiner Finalize-Endpunkt vorhanden:
  - `POST /v1/intake/spec-governance/finalize`
- Im bestehenden Governance-Callout gibt es eine kleine Finalize-Aktion
- Nach erfolgreicher Finalisierung wird der bestehende Read-Pfad neu geladen
- Keine neue Freigabelogik, kein Hard-Approve

### Stufe 4b - Bedienhaertung des Finalize-Pfads
- Status: fachlich gruen / abnahmefaehig
- Button-Text sprachlich geschaerft:
  - `Aenderungen finalisieren`
- Offene `L3`-ChangeSets verlangen vor Finalisierung eine kleine UI-Bestaetigung
- Bekannte Fehlerfaelle werden im UI verstaendlicher gemappt
- Keine neue Persistenz, keine neue Approval-Logik

### Stufe 5a - serverseitige Guard-Logik fuer Finalize
- Status: fachlich gruen / abnahmefaehig
- Finalize-Endpunkt verlangt fuer offene `L3`-ChangeSets serverseitig ein explizites Confirm-Flag:
  - `confirmCriticalFinalize?: boolean`
- Ohne Confirm-Flag wird ein offenes `L3`-ChangeSet nicht finalisiert
- Mit Confirm-Flag bleibt Finalisierung moeglich
- `L1/L2` bleiben ohne Zusatzflag direkt finalisierbar

### Stufe 5b - sichtbare L3-Hinweishaertung im Governance-Callout
- Status: fachlich gruen / abnahmefaehig
- Offene `L3`-ChangeSets sind im bestehenden Governance-Callout sichtbar als kritisch markiert
- Sichtbare Begriffe:
  - `Kritische Aenderung`
  - kurze Hinweiszeile zur bewussten Pruefung und Finalisierung
- Keine neue API- oder Persistenzlogik

### Stufe 6a - serverseitige echte Kritikalitaetsquelle fuer ChangeSets
- Status: fachlich gruen / abnahmefaehig
- `highestImpactLevel` und `activeRuleKeys` stammen serverseitig aus echter Klassifikation realer Spec-Aenderungen
- `summary` wird ebenfalls aus derselben serverseitigen Klassifikationsquelle abgeleitet
- Finalize und Guard nutzen weiterhin die gespeicherten ChangeSet-Daten

### Stufe 6b - fachlich lesbarere Kurzsprache fuer Governance-Regeln
- Status: fachlich gruen / abnahmefaehig
- `activeRuleKeys` bleiben technisch unveraendert
- Im bestehenden Governance-Callout werden Rule Keys in lesbarere Kurzsprache uebersetzt
- Beispiele:
  - `guest_count` -> `Mengen`
  - `event_timing` -> `Zeitfenster`
  - `allergens` -> `Allergene`
  - `recipe_swap` -> `Gerichte/Rezeptur`
  - `notes` -> `Hinweise/Texte`
  - `yield` -> `Ausbeute`
  - `procurement_units_equivalent` -> `Gebinde`
  - `unit_conversion_with_qty_effect` -> `Mengenumrechnung`
- `summary` bleibt unveraendert

## Konsolidierungsstand
- Der aktuelle Governance-Pfad ist bis einschliesslich Stufe 6b korrekt umgesetzt und fachlich gruen beziehungsweise abnahmefaehig.
- Die Umsetzung bleibt additiv zum bestehenden Produktkern und fuehrt keine neue Persistenzwelt oder Prisma ein.
- `ApprovalRequestRecord` bleibt die einzige Freigabewahrheit.
- `SpecGovernanceStateRecord` bildet die Statusspur, `SpecChangeSetRecord` bleibt die Aenderungseinheit.
- Der Finalize-Pfad ist vorhanden und gehaertet, aber Finalize ist ausdruecklich nicht mit Freigabe gleichzusetzen.
- Im sichtbaren Produktkontext ist das Wording auf den konsolidierten Stand gebracht.
- Die aktuelle Phase ist ausdruecklich eine Konsolidierungsphase ohne neue Fachlogik.

## Verbindlicher Mini-Referenzblock - Was aktuell gilt
- Der Governance-Stand ist bis Stufe 6b abgeschlossen und fachlich gruen / abnahmefaehig.
- `ApprovalRequestRecord` bleibt die fuehrende und einzige Freigabewahrheit.
- `SpecGovernanceStateRecord` bleibt die Statusspur.
- `SpecChangeSetRecord` bleibt die Aenderungseinheit.
- Finalize ist nicht gleich Freigabe.
- Der Produktkern bleibt fuehrend, deterministisch, pruefbar und auditierbar.
- Governance bleibt additiv und wird nicht als zweiter Kern aufgebaut.
- Im sichtbaren Produkt-Wording gilt aktuell:
  - `Freigabe- und Aenderungsspur`
  - `Aenderungsspur`
  - `Aenderungen finalisieren`
  - `Kritische Aenderung`
  - `approved`
  - `pending_reapproval`
  - `open`
  - `finalized`

## Was ausdruecklich weiter out of scope bleibt
- Snapshots / `lastHardApproved`
- Hard-Approve-Logik
- Point-of-no-return-Mechanik ueber den kleinen Finalize-Guard hinaus
- ChangeItem-Anzeige oder ChangeItem-Persistenz
- weitere Governance-Workflows
- Aktivierung zusaetzlicher `prepared`-Regeln ohne direkte reale Feldanbindung
- groessere Export-/UI-Ausweitung
- neue Persistenzsysteme oder Prisma

## Naechster explizit beauftragter Bauplan-Schritt - Stufe 6c
- Status: fachlich beschrieben / noch nicht umgesetzt
- Typ: kleiner UX-/Transparenzschritt im bestehenden Governance-Callout
- Ziel: bereits vorhandene Zustaende fachlich klarer sichtbar machen, ohne neue Fachlogik
- Sichtbar einzuordnen:
  - `open`
  - `finalized`
  - `approved`
  - `pending_reapproval`
- Explizite Klarstellung im UI:
  - `finalized` ist nicht gleich `approved`
- Nutzung ausschliesslich bestehender Daten und bestehender UI-Kontexte
- Keine neue Freigabelogik, keine neue Persistenz, keine neuen API-Endpunkte

### Stufe 6c - ausformulierter Bauplanrahmen
1. Fachliche Einordnung
- Stufe 6c setzt auf dem fachlich gruenen Stand 3a bis 6b auf.
- Sie bleibt bewusst unterhalb eines neuen Fachblocks und fuehrt keine neue Governance-Mechanik ein.
- Ziel ist ausschliesslich, die bereits vorhandenen Zustaende im bestehenden Governance-Callout lesbarer und fachlich sauberer einzuordnen.
- Der Kernsatz bleibt unveraendert: Finalize ist nicht gleich Freigabe.
- `ApprovalRequestRecord` bleibt die fuehrende Freigabewahrheit; `SpecGovernanceStateRecord` bleibt die Statusspur; `SpecChangeSetRecord` bleibt die Aenderungseinheit.

2. Im UI sichtbar werden soll
- Eine kleine read-only Status-Einordnung im bestehenden Governance-Callout.
- Sichtbar benannt werden die bestehenden Zustaende `open`, `finalized`, `approved` und `pending_reapproval`.
- `finalized` erhaelt eine klare sichtbare Einordnung als Abschluss eines ChangeSet-Schritts, nicht als Freigabe.
- `approved` bleibt sprachlich erkennbar der Freigabezustand.
- `pending_reapproval` bleibt erkennbar als Zustand erneuter Freigabeerforderlichkeit.
- `open` bleibt erkennbar als noch offener Aenderungszustand.

3. Unveraenderte Fachlogik
- Keine neue Freigabelogik.
- Kein Hard-Approve.
- Kein Snapshot und kein `lastHardApproved`.
- Kein Point-of-no-return-Ausbau.
- Keine ChangeItem-Persistenz und keine ChangeItem-Anzeige.
- Keine zusaetzlichen Governance-Workflows.
- Keine neuen API-Endpunkte und keine neue Persistenz.

4. Kompakter Umsetzungsrahmen
- Backend: nur Nutzung bereits vorhandener, lesbarer Zustaende; keine neue Fach- oder Persistenzlogik.
- UI: sprachliche und visuelle Praezisierung ausschliesslich im bestehenden Governance-Callout.
- Test: kleine Absicherung, dass die vorhandenen Status korrekt lesbar eingeordnet werden und dass `finalized` sichtbar nicht als `approved` erscheint.

## Arbeitsmodus fuer neue Chats / Agenten
- Immer zuerst `memory.md`, `AGENTS.md`, `HANDOFF_PROMPT.md` und `README.md` lesen.
- Den Repo-Iststand pruefen, bevor neue Annahmen getroffen werden.
- Zwischen umgesetzt, beschrieben, offen und bewusst out of scope sauber trennen.
- Keine neuen Features ohne expliziten Auftrag.
- Keine grossen Refactorings ohne klaren Phasenbezug.
- `memory.md` bei jeder relevanten Neuerung versioniert fortschreiben.
- Neue Eintraege unten in der Versionshistorie anhaengen, bestehende Inhalte nicht still ueberschreiben.

## Versionshistorie
### 5.16 - 2026-04-11
- Fuehrende Repo-Memory-Datei fuer `AlexanderSmyslowski/catering-agents-platform` angelegt.
- Aktuellen Governance-/Konsolidierungsstand 3a bis 6b uebernommen.
- Stufe 6c als naechster explizit beauftragter Bauplan-Schritt ausformuliert.
- Arbeitsregeln fuer neue Chats, Hermes Agent und Codex 5.4 mini festgehalten.
