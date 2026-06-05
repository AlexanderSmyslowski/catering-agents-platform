# PA56 LLM Prompt-/Response-Retention- und Evidence-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA55 fuer Prompt-/Response-Retention, Evidence-Ausschnitte und lokale Nachweisgrenzen eines spaeteren providerfaehigen Draft-Pfads; kein Deployment, keine neuen APIs, keine Persistenz, keine Migration, keine echten Daten, keine Backup-Aktivierung und keine Produktschreibwirkung

## 1. Zweck

PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt. PA55 hat die Schwesterfrage nach Trusted-Operator-/Auth-Kontext geklaert.

Damit bleibt die naechste offene Governance-Kante:

Was darf von Prompt-/Response-Inhalten, Eval-Drift und Provider-Evidence eines
spaeteren providerfaehigen Draft-Pfads ueberhaupt aufbewahrt, gezeigt oder als
Nachweis weitergegeben werden?

PA56 macht genau diese Frage fuer Alexander entscheidungsreif, ohne einen
Retention-Mechanismus, eine Logging-Pipeline oder produktionsnahe
Runtime-Ausweitung zu bauen.

## 2. Fuehrende Quellen

- `docs/architecture/PA50_SYNTHETIC_LIVE_STRICT_EVIDENCE_CORRIDOR.md`
- `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md`
- `docs/architecture/PA52_SYNTHETIC_LIVE_LOCAL_OPERATOR_RUNBOOK.md`
- `docs/architecture/PA53_SYNTHETIC_LIVE_PREFLIGHT_POLICY_HINTS.md`
- `docs/architecture/PA54_LLM_DATA_PII_DECISION_FRAME.md`
- `docs/architecture/PA55_LLM_TRUSTED_OPERATOR_AUTH_DECISION_FRAME.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/deployment/B36_BACKUP_RETENTION_DECISION.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`

## 3. Aktueller Stand

Bereits vorhanden:

- lokaler `synthetic_live`-Korridor mit `preflight`, `probe`, `probe:strict`
  und `check`,
- `AgentAudit`, `RunResult` und Eval-Harness als strukturierte lokale
  Nachweisbausteine,
- lokales Operator-Runbook mit klarer Grenze gegen Raw Prompt-/Response-
  Sammlungen in Repo, PR, Ticket oder Chat,
- Policy-Hinweise fuer Operatorname, Budgetnotiz und Human Approval.

Noch nicht explizit fuer einen spaeteren providerfaehigen Draft-Pfad
entschieden:

- ob Evidence grundsaetzlich nur metadata-only bleiben muss,
- ob es ueberhaupt begrenzte redigierte Prompt-/Response-Ausschnitte fuer
  Drift-/Operator-Review geben darf,
- wie strikt lokale Review-Evidence gegen Repo, PR, Ticket, Chat und
  allgemeine Artefaktablagen getrennt bleiben muss,
- ob Prompt-/Response-Inhalte jemals in denselben Retention-Rahmen fallen
  duerften wie allgemeine Backup-/Pilot-Artefakte,
- welcher sichere Default gilt, wenn Logging-/Retention-Fragen offen bleiben.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Retention-/Evidence-Rahmen oberhalb von `synthetic_live`.

Warum jetzt?

PA54 und PA55 klaeren bereits, welche Daten und welcher Operatorkontext fuer
einen spaeteren Draft-Pfad ueberhaupt denkbar waeren. Ohne eine eigene
Entscheidung zu Prompt-/Response-Retention und Evidence wuerde der naechste
Schritt trotzdem still in Logging-, Backup-, Datenschutz- und Review-Risiken
kippen.

## 5. Optionen

Option A:

- Beschreibung: Es werden nur strukturierte Metadaten, Eval-Felder, Audit- und
  RunResult-Informationen aufbewahrt. Keine Prompt-/Response-Ausschnitte, keine
  lokalen Review-Snippets, keine inhaltliche Evidence.
- Vorteile: Maximale Zurueckhaltung. Minimiert Drift in Richtung Logging- oder
  Retention-Pfad.
- Nachteile / Risiken: Erschwert Operator-Review bei echten Eval-Mismatches,
  weil keinerlei inhaltlicher Vergleich mehr sichtbar ist.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Standard bleiben strukturierte Metadaten, Eval-Felder,
  `AgentAudit` und `RunResult`. Fuer einen spaeteren engen providerfaehigen
  Draft-Pfad sind zusaetzlich nur bewusst begrenzte, redigierte und lokal
  verbleibende Evidence-Ausschnitte fuer Drift-/Operator-Review denkbar:
  keine Raw Prompt-/Response-Archive, keine Repo-/PR-/Ticket-/Chat-Spiegelung,
  keine dauerhafte Prompt-/Response-Sammlung und keine Gleichsetzung mit
  allgemeinen Backup-Artefakten.
- Vorteile: Kleinster glaubwuerdiger Review-Pfad oberhalb des heutigen lokalen
  Korridors, ohne gleich ein Prompt-/Response-Logging-System zu normalisieren.
- Nachteile / Risiken: Braucht Disziplin bei Redaction, lokaler Ablage und
  spaeterer Loeschung. "Redigiert" und "lokal" duerfen nicht nur behauptet
  werden.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- `AgentAudit`, `RunResult` und strukturierte Eval-Felder bleiben der
  Standard-Nachweis;
- Prompt-/Response-Inhalte niemals als Raw-Sammlung in Repo, PR, Ticket,
  Chat oder allgemeiner Evidence-Ablage;
- nur bewusst begrenzte, redigierte und lokal verbleibende Ausschnitte fuer
  Drift-/Operator-Review;
- keine Rohdokumente, keine vollen Specs und keine vollstaendigen
  Provider-Transkripte als Evidence-Artefakte;
- keine Gleichsetzung mit B36-Backup-Retention fuer Pilotartefakte;
- Human Approval bleibt Pflicht, auch wenn Drift-Evidence vorliegt;
- B13 bleibt fuehrendes Gate fuer jede spaetere Ausweitung in Richtung echter
  oder nicht-anonymisierter Daten.

Option C:

- Beschreibung: Prompt-/Response-Inhalte duerfen vollstaendig oder breit
  gesammelt, geloggt, weitergereicht oder in allgemeine Review-/Evidence-Pfade
  uebernommen werden.
- Vorteile: Maximale Debug-Sichtbarkeit.
- Nachteile / Risiken: Unterlaeuft PA52, B13 und die Trennung zwischen lokalem
  Review und allgemeiner Artefaktwelt praktisch sofort.
- Aufwand: scheinbar niedrig, real hoch riskant.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Der sichere Weg ist nicht "gar keine Review-Evidence", sondern
strukturierte Default-Nachweise plus sehr eng begrenzte lokale, redigierte
Ausschnitte fuer den Ausnahmefall eines Drift- oder Operator-Reviews.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: kein inhaltlicher Prompt-/Response-Nachweis oberhalb von
  Audit-/RunResult-Metadaten.
- Bei Option B: der naechste kleine Schritt waere hoechstens ein
  Contract-/Runbook-Rahmen fuer lokale redigierte Drift-Evidence, weiter ohne
  Runtime-Ausweitung.
- Bei Option C: vor jeder weiteren Arbeit muessten B13, PA54 und die lokale
  No-Raw-Logging-Grenze faktisch neu verhandelt werden; kein sicherer
  Minimalpfad.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- `AgentAudit`, `RunResult` und Eval-Felder als einziger Standard-Nachweis,
- keine Prompt-/Response-Retention ausserhalb des engen lokalen Review-Kontexts,
- keine Raw Prompt-/Response-Sammlungen,
- keine Repo-/PR-/Ticket-/Chat-Spiegelung,
- keine Gleichsetzung mit allgemeiner Backup-/Pilot-Retention,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
