# B12 Lokaler Demo-Ergebnisvermerk

Status: Doku-/Vertragstest-only Ergebnisanker fuer einen realen lokalen Demo-Durchlauf
Stand: 2026-05-22
Scope: lokaler interner Demo-Durchlauf; interne Stabilisierung / Abnahmefaehigkeit; keine neue Produktlogik, keine neue API, keine neue Persistenz, keine neue Exportlogik, keine Migration, kein Deployment-Code

## 1. Zweck

B12 strukturiert den lokalen Demo-Ergebnisvermerk als kleinen operativ sichtbaren Nachweisanker.
Die manuelle P5-B54-Checkliste `docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md` liefert dafuer einen knappen Alexander-Pruefpfad mit URLs, sichtbaren Markern, Stop-Gates und Nicht-Freigaben; B12 bleibt der fuehrende Ergebnisvermerk.

Der Vermerk beantwortet nur:

- Welche tatsaechlichen lokalen Nachweise liegen fuer den internen Demo-Durchlauf vor?
- Welche Blocker bleiben bestehen?
- Welche Aussage darf daraus gerade NICHT abgeleitet werden?

B12 baut keine Runtime-Funktion, keine neue Produktlogik, keine UI-Flaeche, keine API, keine Persistenz, keine Migration, keine Exportlogik und keinen Deployment-Code.

## 2. Datum und Scope des lokalen Durchlaufs

Datum des Ergebnisvermerks: 2026-05-22.

Scope des lokalen Durchlaufs:

- lokaler interner Demo-/Abnahmekorridor auf dem Repo-Stand des jeweiligen Commits,
- bestehende lokale Stack- und Repo-Kommandos,
- vorhandene Backoffice-, Export-, Ingestion-, Test-, Build- und Audit-Anker,
- keine echten Kunden-/Pilotdaten,
- keine externe Nutzung,
- keine produktionsnahe Zielumgebung.

## 3. Tatsaechliche lokale Nachweise

Als Nachweis zaehlen nur vorhandene Checks und Artefakte:

| Nachweis | Aussage |
| --- | --- |
| `npm run local:status` | lokale Prozess- und Erreichbarkeitsuebersicht fuer den erwarteten lokalen Stack. |
| `npm run local:check` | lokaler Betriebs-/Seed-/Export-/Auditbeleg gegen einen bereits laufenden lokalen Stack. |
| `tests/backoffice-route-smoke.test.ts` | Kernrouten `/`, `/angebot` und `/produktion` bleiben als Backoffice-Smoke abgesichert. |
| `tests/backoffice-production-acceptance-smoke.test.ts` | Produktionssicht, Empty-/Readiness-Zustaende und vorhandene Produktionsanker bleiben sichtbar. |
| `tests/backoffice-internal-usage-smoke.test.ts` | interner Nutzpfad bleibt im jsdom-Kontext abgesichert. |
| `tests/pa8-read-path-auth.test.ts` | read-only Export-/Read-Path-Guards unter Trusted-Actor-Kontext bleiben abgesichert. |
| `tests/pa14-document-ingestion-corridor-readiness.test.ts` | sichere Ingestion-/Warn-/Exportanker bleiben abgesichert. |
| `npm test` | gesamter vorhandener Vitest-Regressionskorridor. |
| `npm run build` | TypeScript-/Frontend-Build-Gate. |
| `npm audit --omit=dev` | Produktionsdependency-Audit ohne Dev-Abhaengigkeiten. |
| `git diff --check` | Whitespace-/Patch-Integritaet. |

Diese Nachweise tragen nur eine Aussage zur internen Demo-Abnahmefaehigkeit des lokalen Korridors. Sie ersetzen keinen B10-Preflight und keine produktionsnahe Security-, Daten- oder Betriebsentscheidung.

## 4. Artefakte und Quellen des Ergebnisvermerks

Zulaessige Quellen fuer den Ergebnisvermerk sind:

- Befehlsergebnisse im lokalen Terminal,
- Repo-Tests und Vitest-Ausgaben,
- Build- und Audit-Ausgaben,
- read-only Export-/Arbeitsbelege fuer Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufslisten-CSV,
- Demo-Start-/Auditbeleg als interner Betriebs-/Kontrollnachweis,
- bestehende Doku-Anker C8, B10 und B11.

Nicht in den Ergebnisvermerk gehoeren:

- keine Secrets,
- keine personenbezogenen Daten,
- keine echten Kunden-/Pilotdaten,
- keine Rohlogs mit sensitiven lokalen Pfaden oder Umgebungswerten,
- keine vollstaendigen Chat- oder Toolverlaeufe,
- keine rechtssichere Compliance- oder Audit-Freigabe.

## 5. Ergebniszustand

Jeder B12-Ergebnisvermerk nutzt genau einen Ergebniszustand:

| Ergebniszustand | Bedeutung |
| --- | --- |
| `go` | Alle tatsaechlich geforderten lokalen Nachweise sind gruen. Das bedeutet nur interne Demo-Abnahmefaehigkeit fuer den lokalen Korridor. |
| `blocked` | Mindestens ein Pflichtcheck ist rot oder ein lokaler Muss-Nachweis verhindert den Demo-Durchlauf. |
| `not assessed` | Ein relevanter Nachweis wurde nicht ausgefuehrt, ist nicht belegbar oder liegt ausserhalb des lokalen B12-Scopes. |

Ein lokaler `go`-Zustand darf nicht als produktionsnaher Pilot, externe Freigabe oder rechtssichere Compliance-/Audit-Aussage gelesen werden.

## 6. Was daraus gerade NICHT abgeleitet werden darf

Aus einem gruenen lokalen B12-Vermerk darf daraus gerade NICHT abgeleitet werden:

- kein produktionsnaher Pilot,
- keine externe Freigabe,
- keine rechtssichere Compliance-/Audit-Aussage,
- keine rechtssichere Audit-/Compliance-Freigabe,
- keine Freigabe fuer echte Kunden-, Mitarbeiter- oder Pilotdaten,
- keine Aussage zur konkreten Zielumgebung,
- keine Aussage zu PII, Retention, Backup, Sandbox, Worker oder AV,
- keine neue AuthN/AuthZ-, Login-, Session- oder OIDC-Implementierung.

## 7. Weiterhin blocked/not assessed

Weiterhin blocked/not assessed bleiben insbesondere:

- konkrete Zielumgebung,
- B10-Preflight-Ausfuellung fuer diese konkrete Zielumgebung,
- PII/Retention/Backup,
- Sandbox/Worker/AV,
- produktionsnahe Proxy-/IAP-/AuthN/AuthZ-Entscheidung,
- Backup-/Restore- und Wiederanlaufnachweis,
- Datenklassifikation und Umgang mit echten Personen-/Kundendaten.

Diese Punkte duerfen im B12-Vermerk nur als offen, `blocked` oder `not assessed` markiert werden. B12 loest sie nicht.

## 8. Naechste Entscheidung fuer Alexander

Naechste Entscheidung fuer Alexander:

1. Ob jetzt eine konkrete Zielumgebung benannt wird und der B10-Preflight dafuer ausgefuellt wird.
2. Oder ob zuerst PII/Retention/Backup als eigenes Gate vorbereitet wird; der separate B13-Anker `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md` haelt lokale Demo-Daten von echten Daten und produktionsnahen Pilotdaten getrennt.
3. Oder ob zuerst der separate B14-Anker `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` fuer Sandbox/AV bei Upload-, Dokument- und Worker-Pfaden ausgefuellt wird.

Empfehlung fuer den naechsten Block: keine weitere abstrakte Auth-/Preflight-Doku ausbauen, sondern bewusst entscheiden, welches der drei offenen Gates als B13 zuerst operativ vorbereitet wird.

B12-Gruensignale ersetzen das B14-Gate nicht; produktionsnahe echte Upload- oder Ingestion-Verarbeitung bleibt ohne B14 `blocked` oder `not assessed`.

## 9. Minimaler B12-Vermerk im Arbeitsbericht

Ein konkreter Arbeitsbericht zu B12 enthaelt knapp:

- Datum und Commit-SHA,
- Ergebnis von `npm run local:status`,
- Ergebnis von `npm run local:check`,
- Ergebnis des fokussierten B12-Vertragstests,
- Ergebnis der relevanten C8-/B11-/Backoffice-/Export-/Ingestion-Smokes,
- Ergebnis von `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`,
- Gesamtzustand `go`, `blocked` oder `not assessed`,
- offene Punkte / Risiken,
- Push-/Remote-/CI-Status,
- klare Nicht-Behauptung: keine produktionsnahe, externe oder rechtssichere Compliance-/Audit-Freigabe.

## 10. Abnahmehinweis

B12 ist erfuellt, wenn dieser Ergebnisvermerk im Repo auffindbar ist, B11, C8 und TESTING auf den B12-Anker verweisen und `tests/b12-local-demo-result-note-contract.test.ts` gruen ist.
