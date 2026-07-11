# Ziellauf: Catering-App autark bis Realbetrieb

Bindende Phasenfolge für den autonomen Codex-Loop. Ergänzt
`autonomous-corridor.md` (Regeln) und `autonomous-queue.md` (Takt).
Die Queue wird ausschließlich aus der jeweils AKTIVEN Phase gespeist.
Eine Phase wird erst aktiv, wenn das Gate der Vorphase von Alexander
quittiert ist (Queue-Eintrag `GATE QUITTIERT: <Phase>`).

## Endziel (Definition of Done)

Eine echte Kundenanfrage (PDF oder Freitext) läuft auf der
Hetzner-Instanz ohne Code-Handarbeit durch:
Import → KI-Entwurf (BYO, draft-only) → Review-Karten-Entscheidung
durch Operator → Freigabe (`approvedBy`/`approvedAt`) → Angebot +
Produktionsübergabe → Produktionsmappe mit Rezeptkarten und gefüllter
Einkaufsliste, die Ronak für eine reale Produktion verwendet.

Dabei durchgehend: kein Raw-Payload persistiert, keine automatische
Freigabe, Wissensschicht enthält erste reale `production_feedback`-
und `rejected_ai_extraction`-Einträge, Regex-Intake nur noch als
Eval-Baseline, Batterie grün, offene PRs ≤ 5.

NICHT Teil des Ziellaufs: Login/Konten, Multi-Tenancy, DOCX-Export,
fünfter Service, Design-System als Vorabprojekt, neue pa-Gates,
weitere BYO-Provider vor produktiver Nutzung eines bestehenden.

## Loop-Regeln (Ergänzung zum Korridor)

- WIP-Limit: max. 3 offene Draft-PRs, die der Loop SELBST im Ziellauf
  erzeugt hat. Zählbar über Branch-Präfix: Loop-Branches heißen immer
  `loop/<slice>`. Der Alt-Bestand (u. a. #490–#515, #543, #484, #48)
  zählt NICHT — er ist Gegenstand von Slice 0.1, nicht WIP des Loops.
- Report-only-Slices (Ergebnis ist ein Bericht/Queue-Anhang, kein
  Produktcode, kein PR — z. B. 0.1, 0.3, Operator-Probe) sind vom
  WIP-Limit ausgenommen und immer ziehbar.
- Zweimal rot auf demselben Slice → Befund-Notiz in Queue, Slice
  zurückstellen, nächsten unabhängigen Slice ziehen oder HALT.
- Jeder PR-Body enthält real ausgeführte Validierungs-Outputs
  (nie behauptete). Batterie: vitest run, tsc --noEmit, build,
  audit, git diff --check, check-internal-beta-gate.sh; bei
  UI-Slices zusätzlich browser:rehearsal auf frischer Datenwurzel.
- Batterie-Budget: voller vitest-Lauf ≤ 120 s. Überschreitung macht
  einen Maintenance-Slice ERLAUBT (Testlaufzeit, keine Testlöschung).
- Human-Gates (immer WARTE AUF MENSCH): Merge · Geld/Provider-Calls
  über Fixtures hinaus · echte/pseudonymisierte Daten (PA54) ·
  kundensichtbarer Text · Löschung > 200 Zeilen · Deploy.

## Phase 0 — Startbereinigung (autark)

0.1 PR-Triage #490–#515 + #543/#484/#48: je PR Empfehlung
    schließen/rebase/merge mit Begründung (superseded-Prüfung gegen
    gemergte Nachfolger, z. B. #511 vs. #542). Kein Close/Merge selbst.
0.2 Batterie-Beschleunigung: collect-Zeit senken (Ziel ≤ 120 s voll),
    ohne einen Test zu löschen oder zu skippen.
0.3 Stale-Branch-Inventur (~60 lokale Branches): Report only.
GATE 0: Alexander merged/schließt den Stapel; committet die
    Steuerdateien (.codex/ziellauf.md, corridor, queue) auf main.

## Phase 1 — Harness-Kern abschließen (autark, nur Fixtures)

1.1 E2E-Kettentest als Contract: Fixture-Draft → Import-Route →
    Review-Entscheidungen → Apply → Plan/Einkaufsliste/Mappe. Ein
    Test, der die ganze Kette über die echten Routen fährt.
1.2 Jede Karten-Entscheidung trägt decidedBy/decidedAt (Invariante
    aus Review P1-2 zu Ende geführt).
1.3 Feedback-Objekt: genau EIN Wissenstyp (`production_feedback`)
    draft-only mit Freigabe; kein weiterer Typ, bevor dieser real
    genutzt wird.
1.4 Übergabe Angebot→Produktion Wurzelfix, falls Triage 0.1 zeigt,
    dass offene PRs (#490/#505/#515) das Symptom nur teilweise decken.
1.5 Ballast-Inventur (report-only): Parser-/UI-/Governance-Code gegen
    Pflichtenheft §9 klassifizieren; Löschliste mit Beweisführung.
GATE 1: Alexander merged; benennt das echte Angebots-PDF (anonymisiert)
    und gibt Provider-Budget frei.

## Phase 2 — Echte KI-Anbindung (nach Gate 1 autark)

2.1 PDF→ProductionDraft über BYO-Schiene mit dem freigegebenen PDF;
    Abnahme als Fallklasse: alle im PDF benannten Buffet-Komponenten
    erscheinen als Karten ODER als explizite open_question — nichts
    verschwindet stillschweigend.
2.2 Intake-Schattenmodus: LLM-Extraktion parallel zur Regex-Baseline,
    Abweichungslog; Umschaltung bleibt menschliche Entscheidung.
2.3 Batch-Klassifikation der 916 Altangebote als Nacht-Loop
    (Budget aus Gate 1); Ergebnis: Eval-Korpus + Portfolio-Abgleich.
GATE 2: Alexander sichtet Draft-Qualität an 3 realen Fällen.

## Phase 3 — Mappe produktionsreif (autark + Abnahme)

3.1 Rezeptkarten aus approved Drafts erscheinen in der Mappe.
3.2 Einkaufsliste aus Apply-Pfad gefüllt (nie 0 Positionen bei
    approved Plan mit Rezepten — Fallklasse, nicht Einzelfall).
3.3 Technische IDs vollständig aus sichtbaren Titeln/Flächen.
GATE 3: Ronak/Alexander nehmen EINE Mappe fachlich ab.
    Abnahmekriterium: "Ronak-tauglich heißt: Alle angebotenen Speisen sind
    vollständig enthalten; Mengen, Produktionsrezepte, Mise-en-Place und
    Metro-Einkaufsliste sind fachlich plausibel, druckbar und ohne technische
    Nacharbeit nutzbar. Unsicherheiten sind deutlich markiert, nichts wird
    still angenommen."

## Phase 4 — Realbetrieb (gated)

4.1 Hetzner-Deploy mit platform-infra; Smoke gegen die Instanz.
4.2 Eine echte Anfrage parallel zu rechner.commcats.de; Mappe an
    Ronak aus dem System.
4.3 Feedback-Writeback: erste reale production_feedback-Einträge.
GATE 4 = Endziel-Prüfung gegen die Definition oben.

## Phase 5 — danach (nicht Teil des Ziellaufs)

Uni-Konfigurator (öffentliches schmales Frontend), Backoffice-
Konsolidierung reibungsgetrieben, Angebotstexte LLM-gestützt.
