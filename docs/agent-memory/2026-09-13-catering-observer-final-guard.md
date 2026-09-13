# PR691: Fehler aus der letzten Dienstabfrage erhalten

13.09.2026. Enger Folgeauftrag im bestehenden Branch/Worktree; ein Writer.
Ausgangshead6940c68def203aae16f50cd9030e706603ea1a7f,
Tree2fd306416b52da1787b58f65e88e91c09fcf750e.
Betreiberreview5190890022, Inline3999756639. Der PR bleibt Draft.

Die letzte Dienstabfrage konnte bisher einen Fehler erkennen und vor dem
Senden abbrechen, ohne ihn dauerhaft vorzumerken. Der bestehende Late-Test
reproduziert nun failure_epoch=0 statt des neu erkannten Fehlerzeitpunkts.
Die Korrektur verwendet denselben Dienstsatz fuer Fehlerermittlung und
Gesundheitspruefung sowie den vorhandenen geschuetzten atomaren Publisher.
Vor dem Abbruch bleiben Fehlerzeitpunkt und bereits gespeicherte Uhrmarke
monoton erhalten. Kein neues Schema oder neuer Reparaturpfad.

Die erweiterten beiden Bestandstests verwenden echte Recordvalidatoren und
Publisher, synthetische Dienst-/Nachweisdaten und simulierten Transport.
Sie pruefen den gespeicherten kritischen Zustand, gesperrte alte Evidence
nach verschwundenem/geaendertem Fehler, vollstaendig gebundene neue Recovery
sowie fehlgeschlagene Publikation vor/nach Zustandsersatz. Ein Fehler bleibt
ohne Signal und ohne behauptete dauerhafte Vormerkung; nach einem Austausch
kann die Dauerhaftigkeit unklar sein. RED/GREEN ist belegt.

Produktivcode3877 von3911, Rest34; sieben neue Zeilen gegenueber3870.
Basen3511/3181 bleiben unveraendert. Fokus-/statische Pruefungen,
unabhaengiger Deltareview und Folgecommit/CI werden im dauerhaften lokalen
`observer-final-guard-report.md` gegen die tatsaechlichen Artefakte gebunden.
Keine Wiederholung der unveraenderten lokalen Vollsuite oder historischen
Werkzeuglaeufe; die bestehende automatisch ausgeloeste CI bleibt massgeblich.

Better-Stack-Konto-/Empfaenger-/Fristbindung sowie P2/P3 sind getrennt offen.
Runbook: [OBSERVER-RUNBOOK.md](../../platform-infra/backup/OBSERVER-RUNBOOK.md).
Keine Produktionsmutation, Live-Signale, weiteren Backup-/Restorelaeufe,
Timer oder Phase3. Zeiterfassungs-PR82 bleibt unveraendert.
