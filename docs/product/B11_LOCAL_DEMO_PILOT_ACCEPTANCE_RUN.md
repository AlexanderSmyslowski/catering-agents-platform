# B11 Lokaler Demo-/Pilotdaten-Abnahmedurchlauf

Status: Doku-/Vertragstest-only Abnahmeanker auf Basis bestehender lokaler Gates
Stand: 2026-05-22
Scope: interne Stabilisierung / Abnahmefaehigkeit; keine neue Produktlogik, keine neue API, keine neue Persistenz, keine neue Exportlogik, keine Migration, kein Deployment-Code

## 1. Zweck

B11 strukturiert einen kleinen realen lokalen Demo-/Pilotdaten-Durchlauf als pruefbaren Abnahmeanker.

Der Anker nutzt nur vorhandene Repo-Kommandos, bestehende Backoffice-/Demo-Smokes, read-only Export-/Arbeitsbelege und bestehende Standard-Gates. Er baut keine Runtime-Funktion, keine Produktlogik, keine neue Datenhaltung und keine neue Freigabewelt.

B11 beantwortet nur: Ist der lokale interne Demo-/Abnahmekorridor anhand vorhandener Nachweise gruen, blockiert oder noch nicht bewertet?

Der nachgelagerte B12-Ergebnisvermerk `docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md` strukturiert den konkreten lokalen Ergebnisnachweis dieses Korridors: tatsaechlich ausgefuehrte Checks, belegende Quellen, Ergebniszustand, offene Blocker und klare Nicht-Behauptungen.

## 2. Vorhandene Kommandos und Gates

Ein B11-Durchlauf nutzt die vorhandenen Kommandos in dieser Reihenfolge:

```bash
npm run local:status
npm run local:check
npm test -- tests/b11-local-demo-pilot-acceptance-contract.test.ts
npm test -- tests/local-ops-check-contract.test.ts tests/b10-pilot-preflight-runbook-contract.test.ts tests/backoffice-route-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-internal-usage-smoke.test.ts tests/pa8-read-path-auth.test.ts tests/pa14-document-ingestion-corridor-readiness.test.ts
npm test
npm run build
npm audit --omit=dev
git diff --check
```

Ein lokaler Stack muss fuer `npm run local:status` und `npm run local:check` bereits laufen beziehungsweise kontrolliert ueber den bestehenden C8-Weg gestartet worden sein. B11 fuehrt keinen neuen Stack-Startmechanismus und keine neue Umgebung ein.

## 3. Bestehende Demo-, Backoffice- und Exportnachweise

B11 fragt nur bestehende Nachweise ab:

- `npm run local:status` als lokale Prozess- und Erreichbarkeitsuebersicht.
- `npm run local:check` als lokaler Betriebs-/Seed-/Export-/Auditbeleg gegen den laufenden lokalen Stack.
- `tests/backoffice-route-smoke.test.ts` fuer die Kernrouten `/`, `/angebot` und `/produktion`.
- `tests/backoffice-production-acceptance-smoke.test.ts` fuer Produktionssicht, Empty-/Readiness-Zustaende und vorhandene Produktionsanker.
- `tests/backoffice-internal-usage-smoke.test.ts` fuer den internen Nutzpfad.
- `tests/pa8-read-path-auth.test.ts` fuer read-only Export-/Read-Path-Guards unter Trusted-Actor-Kontext.
- `tests/pa14-document-ingestion-corridor-readiness.test.ts` fuer sichere Ingestion-/Warn-/Exportanker.
- Angebots-HTML als interner read-only Arbeitsbeleg.
- Produktionsblatt-/Produktionsplan-HTML als interner read-only Arbeitsbeleg.
- Einkaufslisten-CSV als interner read-only Arbeitsbeleg.
- Demo-Start-/Auditbeleg als interner Betriebs-/Kontrollnachweis, nicht als rechtssichere Audit-Freigabe.

## 4. Ergebniszustaende

Jeder B11-Durchlauf wird mit genau einem Gesamtzustand dokumentiert:

| Gesamtzustand | Bedeutung |
| --- | --- |
| `go` | Alle lokalen B11-Pflichtchecks und die relevanten vorhandenen Vertrags-/Smoke-Anker sind gruen. Ein gruenes lokales B11-Ergebnis bedeutet nur interne Demo-/Abnahmefaehigkeit. Es ist kein produktionsnaher Pilot-Go. |
| `blocked` | Mindestens ein Pflichtcheck ist rot, ein Muss-Gate weist einen Blocker aus oder ein relevanter Nachweis zeigt ein Risiko, das den lokalen Demo-/Pilotdaten-Durchlauf verhindert. rote Muss-Gates bleiben `blocked`. |
| `not assessed` | Ein Nachweis wurde nicht ausgefuehrt, ist nicht belegbar oder die konkrete Zielumgebung / der lokale Stack wurde nicht bewertet. Fehlende Nachweise bleiben `not assessed`. |

`go` darf nur fuer den lokalen internen Demo-/Abnahmekorridor verwendet werden. Sobald ein produktionsnaher Pilot, echte Daten, externe Nutzer oder eine konkrete Zielumgebung gemeint sind, reicht B11 nicht aus.

## 5. Produktionsnahe Pilotgrenze

Ein produktionsnaher Pilot bleibt `blocked`, solange mindestens einer dieser Nachweise fehlt oder nicht positiv entschieden ist:

- B10 Pilot-Preflight-Runbook fuer eine konkrete Zielumgebung ausgefuellt und erfuellt.
- PII-Pruefung und Datenklassifikation.
- Retention-/Loesch-/Archivierungsentscheidung.
- Backup-/Restore-Konzept und Wiederanlaufnachweis.
- Sandbox-/Mandanten-/Testdatenabgrenzung.
- AV-/Malware-Pruefung fuer Upload- und Dokumentpfade.
- echte AuthN/AuthZ- beziehungsweise Proxy-/IAP-Entscheidung fuer produktionsnahe Nutzung.

B11 kann diese Punkte hoechstens als `not assessed` oder `blocked` markieren. B11 loest sie nicht.

Der separate B14-Entscheidungsanker `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md` konkretisiert das Sandbox-/Worker-/AV-Gate fuer Upload-, Ingestion- und Dokumentpfade. B11-Gruensignale ersetzen dieses Gate nicht; ein produktionsnaher Pilot bleibt ohne B14 `blocked`.

## 6. Klare Nicht-Behauptungen

B11 behauptet ausdruecklich nicht:

- keine produktionsnahe Freigabe,
- keine externe Freigabe,
- keine rechtssichere Compliance-/Audit-Freigabe,
- keine rechtssichere Audit-/Compliance-Behauptung,
- keine Signatur- oder Freigabewelt fuer Exporte,
- keine neue QA-, Release-, Monitoring- oder Deployment-Plattform,
- keine Parser-/OCR-/LLM-Engine,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- keine neue Exportlogik,
- keine Produktlogik-Ausweitung,
- kein Login/OIDC/Auth-Provider,
- keine Multi-Tenancy-/White-Label-/Plattform-Erweiterung.

## 7. Minimaler Ergebnisvermerk

Ein Ergebnisvermerk fuer B11 enthaelt knapp:

- Commit-SHA und Zeitpunkt,
- Ergebnis von `npm run local:status`,
- Ergebnis von `npm run local:check`,
- Ergebnis des fokussierten B11-Vertragstests,
- Ergebnis der relevanten C8-/B10-/Backoffice-/Export-/Ingestion-Smokes,
- Ergebnis von `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`,
- Gesamtzustand `go`, `blocked` oder `not assessed`,
- offene Punkte / Risiken,
- explizite Grenze: keine externe, produktionsnahe oder rechtssichere Compliance-/Audit-Freigabe.

## 8. Abnahmehinweis

B11 ist erfuellt, wenn dieses Dokument im Repo auffindbar bleibt, C8 und TESTING auf den B11-Anker verweisen und `tests/b11-local-demo-pilot-acceptance-contract.test.ts` gruen ist.

B12 ist erfuellt, wenn `docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md` auffindbar bleibt und der fokussierte Vertragstest `tests/b12-local-demo-result-note-contract.test.ts` den konkreten lokalen Ergebnisvermerk schuetzt.
