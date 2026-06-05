# PA54 LLM Daten-/PII-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA53 fuer den Datenrahmen eines
spaeteren providerfaehigen Draft-Pfads; kein Deployment, keine neuen APIs,
keine Persistenz, keine Migration, keine echten Daten und keine
Produktschreibwirkung

## 1. Zweck

PA42 bis PA53 haben den kleinsten lokalen `synthetic_live`-Korridor
aufgebaut und operationalisiert:

`synthetic_live slice -> audit/run-result -> probe -> eval comparison -> strict probe -> preflight -> strict evidence corridor -> local operator runbook -> policy hints`

Damit ist nach PA51 nicht nur die Operator-/Kosten-/Approval-Frage offen,
sondern auch die naechste echte Datengrenze:

Welche Art von Inputs duerfte ein spaeterer providerfaehiger Draft-Pfad
ueberhaupt sehen, bevor wir den rein synthetischen Korridor verlassen?

PA54 macht genau diese Frage fuer Alexander entscheidungsreif, ohne eine
einzige Daten-, Provider- oder Runtime-Ausweitung zu bauen.

## 2. Fuehrende Quellen

- `docs/architecture/PA41_LLM_PROVIDER_DATA_RUNTIME_DECISION_FRAME.md`
- `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md`
- `docs/architecture/PA52_SYNTHETIC_LIVE_LOCAL_OPERATOR_RUNBOOK.md`
- `docs/architecture/PA53_SYNTHETIC_LIVE_PREFLIGHT_POLICY_HINTS.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`

## 3. Aktueller Stand

Bereits vorhanden:

- lokaler `synthetic_live`-Draft-Korridor hinter Feature-Flag,
- nur synthetische Clarification-Fixtures,
- `AgentAudit`, `RunResult`, Preflight, Strict-Probe und lokales Runbook,
- Human Approval als Pflichtgrenze,
- kein Write-Tool, keine Produktschreibwirkung,
- keine echten Daten und keine Provider-Secrets im Repo.

Bereits als allgemeine Daten-/Pilot-Gates vorhanden:

- B13 fuer PII/Retention/Backup,
- P11-N2 fuer anonymisiert/synthetisch vs. pseudonymisiert/echt,
- P12-N2 fuer den nicht-sensitiven Management-Go/No-Go-Rahmen.

Noch nicht explizit fuer den LLM-Draft-Pfad entschieden:

- ob nach `synthetic_live` ueberhaupt irgendetwas anderes als synthetische/demo
  Daten in einen Providerlauf duerfte,
- ob nur nachweisbar anonymisierte Extracts oder auch pseudonymisierte/echte
  Inputs denkbar waeren,
- ob Rohdokumente, E-Mails, PDFs oder ganze Specs jemals direkt Provider-Input
  sein duerften,
- welche Logging-/Retention-Regeln fuer Prompt-/Response-Inhalte gelten,
- ob ein erster nicht-synthetischer LLM-Draft-Pfad weiter strikt lokal bleiben
  muss.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Datenrahmen nach `synthetic_live`.

Warum jetzt?

PA51 hat geklaert, wer den lokalen Korridor unter welchem Kosten- und
Approval-Rahmen ueberhaupt bedienen darf. Der naechste echte Gate-Schritt ist
nicht mehr "noch ein besseres Script", sondern die Datengrenze selbst. Ohne
diese Entscheidung wuerde jeder spaetere Versuch mit anonymisierten,
pseudonymisierten oder echten Inputs still in PII-, Retention-, Logging- und
Provider-Risiken kippen.

## 5. Optionen

Option A:

- Beschreibung: Der providerfaehige Draft-Pfad bleibt auf unbestimmte Zeit rein
  synthetisch/demo. Kein nicht-synthetischer Input geht an einen Provider.
- Vorteile: Maximale Sicherheits- und Datenschutzkonservativitaet. Kein neuer
  Daten- oder Logging-Rahmen noetig.
- Nachteile / Risiken: Kein praktisches Lernen, wie sich spaetere
  nicht-synthetische Draft-Inputs verhalten wuerden.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Fuer einen spaeteren, weiterhin engen Draft-Pfad sind nur
  nachweisbar anonymisierte, nicht-rueckfuehrbare und bewusst reduzierte
  Arbeitsausschnitte denkbar. Keine Rohdokumente, keine direkten Uploads,
  keine ganzen E-Mails, keine vollstaendigen Specs, keine Pseudonymisierung als
  Ersatz fuer Anonymisierung und keine Produkt-Schreibwirkung.
- Vorteile: Kleinster reale Datennaeherungs-Schritt oberhalb von
  `synthetic_live`, ohne gleich echte oder rueckfuehrbare Inhalte zuzulassen.
- Nachteile / Risiken: Braucht harte Disziplin bei Redaction, Logging,
  Prompt-Retention und Operatorverhalten. "Anonymisiert" darf nicht nur
  behauptet werden.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- nur nachweisbar anonymisierte und bewusst reduzierte Draft-Inputs;
- keine pseudonymisierten echten Daten;
- keine Rohdokumente, keine PDFs, keine E-Mails, keine Direct-Upload-Payloads;
- keine vollstaendigen `AcceptedEventSpec`-Objekte als Provider-Input;
- keine Prompt-/Response-Retention ausserhalb des engen lokalen Nachweiswegs;
- kein Raw Prompt-/Response-Logging in Repo, PR, Ticket oder Chat;
- weiter nur Draft-Outputs, keine Write-Tools, keine Produktschreibwirkung;
- Human Approval bleibt Pflicht;
- B13, P11-N2 und P12-N2 bleiben fuehrende Gates fuer alles, was ueber lokale
  nicht-synthetische Entwurfsarbeit hinausgeht.

Option C:

- Beschreibung: Pseudonymisierte oder echte operative Daten duerfen in einen
  providerfaehigen Draft-Pfad gelangen.
- Vorteile: Schnellste Naeherung an produktionsnahe LLM-Nutzung.
- Nachteile / Risiken: Beruehrt sofort B13, P12-N2, Logging, Retention,
  Provider-Datenuebertragung, rechtliche Bewertung und spaeter Deployment/Auth.
- Aufwand: hoch.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Sie ist der einzige sinnvolle Zwischenschritt zwischen rein synthetischem
Readiness-Korridor und einem spaeteren echten Daten-Gate. Alles Groessere ist
zu frueh, alles Kleinere liefert keinen belastbaren Erkenntnisgewinn fuer den
naechsten Agentenpfad.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: der providerfaehige Draft-Pfad bleibt synthetic/demo only.
- Bei Option B: der naechste kleine Schritt waere eine weitere
  Entscheidungsvorlage oder ein Contract-Rahmen fuer anonymisierte
  Draft-Inputs, weiterhin ohne Runtime-Ausweitung.
- Bei Option C: vor jeder weiteren Umsetzung muessen B13, P11-N2, P12-N2,
  Logging-, Retention- und spaeter Deployment-/Auth-Gates separat vorbereitet
  und bewusst freigegeben werden.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- nur synthetic/demo Daten,
- kein nicht-synthetischer Provider-Input,
- keine Rohdokumente im Providerpfad,
- keine pseudonymisierten oder echten Daten,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
