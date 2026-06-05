# PA58 LLM Human-Approval-/Operator-Handover-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA57 fuer Human Approval, Operator-Handover und manuelle Draft-Uebernahme oberhalb eines spaeteren nicht-lokalen providerfaehigen Draft-Pfads; kein Deployment, keine neue Approval-Engine, keine neue API, keine Persistenz, keine Migration, keine echten Daten und keine Produktschreibwirkung

## 1. Zweck

PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt. PA55 hat die Trusted-Operator-/Auth-Frage nachgezogen. PA56 hat den Prompt-/Response-Retention- und Evidence-Rahmen geschaerft. PA57 hat danach den Deployment-/Zielumgebungsrahmen fuer spaetere nicht-lokale Draft-Pfade sortiert.

Damit bleibt die naechste offene Schwesterfrage:

Wie muss Human Approval und Operator-Handover fuer einen spaeteren nicht-lokalen providerfaehigen Draft-Pfad aussehen, bevor irgendein Draft manuell uebernommen, weitergereicht oder in einen produktionsrelevanten Arbeitsfluss ueberfuehrt werden duerfte?

PA58 macht genau diese Frage fuer Alexander entscheidungsreif, ohne eine neue Approval-Runtime, Handover-Engine oder produktwirksame Agent-Orchestrierung zu bauen.

## 2. Fuehrende Quellen

- `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md`
- `docs/architecture/PA52_SYNTHETIC_LIVE_LOCAL_OPERATOR_RUNBOOK.md`
- `docs/architecture/PA55_LLM_TRUSTED_OPERATOR_AUTH_DECISION_FRAME.md`
- `docs/architecture/PA56_LLM_RETENTION_EVIDENCE_DECISION_FRAME.md`
- `docs/architecture/PA57_LLM_DEPLOYMENT_TARGET_ENVIRONMENT_DECISION_FRAME.md`
- `docs/architecture/PRODUCTION_AGENT_10_10_CODING_ARCHITECTURE.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`
- `AGENTS.md`

## 3. Aktueller Stand

Bereits vorhanden:

- `humanApprovalRequired` ist im LLM-Readiness-Vertrag ein fuehrender Pflichtmarker,
- lokaler `synthetic_live`-Korridor mit benannten Operatoren, Kostenrahmen und Pflicht zu Human Approval vor manueller Uebernahme,
- getrennte Schwesterrahmen fuer Daten, Trusted-Operator-/Auth, Retention/Evidence und Deployment-/Zielumgebung,
- repo-weit bleibt `ApprovalRequestRecord` die fuehrende Freigabewahrheit.

Noch nicht explizit fuer den LLM-Draft-Pfad entschieden:

- ob ein spaeterer nicht-lokaler providerfaehiger Draft-Pfad weiter strikt Vier-Augen-/Human-Approval-pflichtig bleibt,
- ob derselbe Operator einen Draft erzeugen und allein freigeben duerfte,
- wie klar Operator-Handover zwischen Draft-Erzeugung, Review und manueller Uebernahme getrennt sein muss,
- ob ein spaeterer nicht-lokaler Draft-Pfad an bestehende Approval-Wahrheit anschliessen muss oder still eine neue Freigabelogik erfinden duerfte,
- welcher sichere Default gilt, solange Human-Approval- und Handover-Grenzen offen bleiben.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Human-Approval-/Operator-Handover-Rahmen oberhalb von `synthetic_live`.

Warum jetzt?

Daten, Auth, Evidence und Zielumgebung helfen nur bis zu dem Punkt, an dem ein Draft ueberhaupt sichtbar und technisch moeglich ist. Danach bleibt die eigentliche Sicherheitskante: Wer darf einen Draft pruefen, wer darf ihn uebernehmen, und darf derselbe Operator beides allein tun?

## 5. Optionen

Option A:

- Beschreibung: Jeder spaetere providerfaehige Draft-Pfad bleibt rein informativ. Kein formaler Human-Approval- oder Handover-Rahmen oberhalb lokaler Probe-Laeufe.
- Vorteile: Minimaler organisatorischer Aufwand.
- Nachteile / Risiken: Wuerde Human Approval als Lippenbekenntnis stehen lassen und keine belastbare Grenze fuer manuelle Uebernahmen schaffen.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Ein spaeterer nicht-lokaler providerfaehiger Draft-Pfad bleibt strikt human-in-the-loop. Draft-Erzeugung, Review und manuelle Uebernahme muessen als benannter Operator-Schritt nachvollziehbar bleiben. Dieselbe Person darf nicht still einen produktionsrelevanten Draft ohne klaren Review-/Handover-Rahmen durchwinken. Bestehende Approval-Wahrheit bleibt fuehrend; keine neue Freigabelogik wird erfunden.
- Vorteile: Kleinster glaubwuerdiger Human-Approval-Rahmen oberhalb des lokalen Korridors, ohne schon Approval-Runtime zu bauen.
- Nachteile / Risiken: Braucht klare Disziplin bei Rollen-/Handover-Grenzen und spaeter eine bewusste Anbindung an vorhandene Freigabewahrheit.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- `humanApprovalRequired` bleibt fuer jeden providerfaehigen Draft-Lauf Pflicht;
- kein stilles Self-Approval ohne klaren Review-/Handover-Rahmen;
- benannter Operator fuer Draft-Erzeugung, Review und manuelle Uebernahme nachvollziehbar trennen oder explizit begruenden;
- bestehende `ApprovalRequestRecord`-Wahrheit nicht umgehen und keine zweite Freigabelogik erfinden;
- Human Approval nie durch Eval-Match, Probe-Gruen, Trusted-Header oder Zielumgebungs-Go ersetzen;
- keine neue API, keine Persistenz, keine Produktschreibwirkung als Teil dieses Entscheidungsschnitts.

Option C:

- Beschreibung: Ein spaeterer providerfaehiger Draft-Pfad darf auch ohne klaren Human-Approval-/Handover-Rahmen oder mit implizitem Self-Approval operieren.
- Vorteile: Weniger Anfangsdisziplin.
- Nachteile / Risiken: Unterlaeuft den bisherigen `humanApprovalRequired`-Vertrag und wuerde faktisch eine produktwirksame Freigabelogik ohne echten Gate-Entscheid normalisieren.
- Aufwand: scheinbar niedrig, real hoch riskant.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Der sichere Weg ist nicht "ein Operator schaut halt kurz drueber", sondern ein expliziter, nachvollziehbarer Human-Approval- und Handover-Rahmen, der die bestehende Freigabewahrheit respektiert und keinen neuen stillen Approval-Pfad erfindet.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: providerfaehige Drafts bleiben organisatorisch unscharf und duerfen nicht in produktionsrelevante Uebernahmen kippen.
- Bei Option B: der naechste kleine Schritt waere hoechstens ein weiterer Contract- oder Runbook-Rahmen fuer benannte Review-/Handover-Schritte, weiter ohne Approval-Runtime.
- Bei Option C: vor jeder weiteren Arbeit muesste der bisherige Human-Approval-Anspruch praktisch neu verhandelt werden; kein sicherer Minimalpfad.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- jeder providerfaehige Draft-Pfad bleibt human-in-the-loop,
- kein Self-Approval ohne klaren Review-/Handover-Rahmen,
- keine neue Freigabelogik neben bestehender Approval-Wahrheit,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
