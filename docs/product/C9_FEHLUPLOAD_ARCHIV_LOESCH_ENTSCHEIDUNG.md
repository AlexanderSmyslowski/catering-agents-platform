# C9 Fehlupload-Archiv-/Loeschentscheidung

Status: Option B nach explizitem Alexander-Go als enger Soft-Archiv-Runtime-Slice inklusive `/produktion`-UI-Aktion umgesetzt; kein Hard-Delete, keine neue Persistenzwelt, keine Migration, keine echte Datenfreigabe und keine Retention-/Compliance-Freigabe
Stand: 2026-05-26
Scope: kleinster Backend-Pfad mit enger `/produktion`-UI-Anbindung, um falsche interne/synthetische Intake-Upload-Kontexte aus aktiven Listen/Fokuslogiken zu nehmen und intern nachvollziehbar zu halten

## 1. Zweck

C9 hat die Entscheidung fuer den naechsten Backend-Pfad vorbereitet. Nach Alexanders Go ist Option B als kleinster Soft-Archiv-Slice umgesetzt.

Das betrifft den internen MVP-/Beta-Korridor:

```text
Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit
```

Ziel ist keine Loesch-/Retention-Plattform, sondern nur: ein falscher interner/synthetischer Intake-Kontext verschwindet aus dem aktiven Arbeitsfokus, bleibt aber fuer interne Nachvollziehbarkeit lesbar.

## 2. Fuehrende Eingaben

- `AGENTS.md`: falsche Uploads lassen sich fachlich sauber archivieren oder loeschen; Produktionskern zuerst stabilisieren.
- `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md`: neue API, Persistenz, Retention, echte Daten und Deployment bleiben entscheidungspflichtig.
- `docs/product/P6_AUFBEWAHRUNG_LOESCHUNG_ARCHIVIERUNG_MINISPEZ.md`: im MVP eher vorsichtig archivieren als hart loeschen; keine automatische Loeschung im Hintergrund.
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`: lokaler Demo-/Rehearsal-Korridor, keine Produktionsfreigabe.
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`: Loesch-/Retention-/Backup-Fragen sind eigene Gates.
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`: echte Uploads bleiben ohne Sandbox/Worker/AV-Gate blockiert.
- `scripts/check-local-ops.sh`: lokaler Rehearsal-Datenhinweis ist kein Loesch- oder Archivierungsmechanismus.

## 3. Entscheidung erfolgt

Kurzer Titel: Backend-Pfad fuer Fehluploads im internen MVP-Korridor.

Warum jetzt?

Der UI-Arbeitsbereich kann lokal geleert werden, aber das ist nur ein Frontend-Fokuswechsel. Falsche oder testweise erzeugte Upload-/Spec-Kontexte bleiben backend-seitig im Datenbestand und koennen spaeter wieder als Altlast oder falscher aktueller Vorgang sichtbar werden.

Eine Implementierung beruehrt API, Persistenzzustand, Audit-/Handoff-Nachvollziehbarkeit und spaeter echte Daten. Darum brauchte der Pfad vor Code eine bewusste Alexander-Entscheidung.

Entscheidung:

- Option B, Soft-Archiv aus aktivem Arbeitsfokus.
- Kein Hard-Delete.
- Keine Retention-/Backup-/Compliance- oder echte-Daten-Freigabe.

## 4. Optionen

### Option A: Status quo plus UI-Arbeitsbereich lokal leeren

Beschreibung:

Der bestehende UI-Pfad bleibt fuehrend. `Arbeitsbereich lokal leeren` entfernt nur den aktuellen lokalen Fokus, aber keine backend-seitigen Intake-, Spec-, Plan-, Einkaufslisten- oder Audit-Daten.

Vorteile:

- kein API-/Persistenzrisiko;
- keine Retention- oder Loeschentscheidung noetig;
- sofort sicher fuer lokale synthetische Rehearsals.

Nachteile / Risiken:

- Fehluploads bleiben als Altlasten erhalten;
- lokale Rehearsal-Daten koennen aufgefuellt wirken;
- Nutzer kann spaeter wieder einen falschen Vorgang sehen.

Aufwand:

- keiner.

Empfehlung ja/nein:

- Nein als Zielzustand, aber ja als sicherer Default bis zur Entscheidung.

### Option B: Soft-Archiv aus aktivem Arbeitsfokus

Beschreibung:

Ein enger Backend-Slice markiert einen fehlerhaften Upload-/Spezifikationskontext als archiviert und nimmt ihn aus aktiven Listen/Fokuslogiken heraus. Die Daten bleiben fuer interne Nachvollziehbarkeit und Audit-/Review-Kontext erhalten.

Vorteile:

- passt zur P6-Regel "eher archivieren als hart loeschen";
- reduziert Stale-Fokus und aufgefuellte aktive Arbeitslisten;
- erhaelt Nachvollziehbarkeit fuer Demo-/Beta-Review;
- kleiner und reversibler als Hard-Delete.

Nachteile / Risiken:

- fuehrt einen neuen, engen API-Pfad ein;
- markiert nur `EventRequest` und zugehoerige `AcceptedEventSpec` ueber vorhandene Store-Grenzen;
- filtert aktive Intake-Listen, ohne Detail-/Audit-Lesbarkeit zu entfernen;
- ist noch keine echte Retention-/Compliance-Loesung.

Aufwand:

- klein bis mittel, wenn auf bestehender File-Store-/Repository-Grenze und bestehender Rollen-/Trusted-Actor-Mechanik aufgebaut wird.

Empfehlung ja/nein:

- Ja, umgesetzt nach Alexander-Go.

### Option C: Hard-Delete

Beschreibung:

Ein Backend-Pfad wuerde fehlerhafte Upload-/Spezifikations- und Folgeobjekte dauerhaft aus dem Datenbestand entfernen.

Vorteile:

- Datenbestand wird wirklich kleiner;
- falsche Testdaten verschwinden vollstaendig aus Listen und Exporten.

Nachteile / Risiken:

- hohes Risiko fuer Audit-/Handoff-Luecken;
- Kaskaden zwischen Intake, Spec, Angebot, Produktion, Einkaufsliste, Export und Audit muessen exakt definiert werden;
- beruehrt Retention, Backup, Restore, Datenschutz und spaeter echte Daten deutlich staerker;
- bei Fehlern schwer reversibel.

Aufwand:

- mittel bis hoch, weil Kaskaden, Audit, Tests und Betriebsregeln sauber entschieden werden muessen.

Empfehlung ja/nein:

- Nein fuer den naechsten MVP-Slice.

## 5. Empfehlung

Empfehlung: Option B, Soft-Archiv aus aktivem Arbeitsfokus.

Begruendung:

- Sie loest die belegte Reibung "Fehlupload bleibt aktiv sichtbar" am naechsten.
- Sie respektiert die bestehende P6-Linie: lieber archivieren als hart loeschen.
- Sie laesst interne Nachvollziehbarkeit, Audit-/Handoff-Kontext und spaetere Review-Faehigkeit erhalten.
- Sie bleibt kleiner als eine echte Retention-/Compliance- oder Hard-Delete-Loesung.

## 6. Konsequenz nach Auswahl

Nach Auswahl von Option B wurde der technische Minimalblock so umgesetzt:

- `POST /v1/intake/requests/:requestId/archive` markiert den Intake-Kontext per Soft-Archiv;
- `EventRequest` und die per `sourceLineage.reference` verbundenen `AcceptedEventSpec` erhalten `operationalArchive`;
- `GET /v1/intake/requests` und `GET /v1/intake/specs` listen standardmaessig nur aktive Eintraege;
- `includeArchived=true` erlaubt interne Rueckschau;
- Detailpfade bleiben lesbar;
- Audit-Aktion `intake.request_soft_archived` dokumentiert den Operatorpfad;
- `/produktion` bietet fuer den fokussierten Intake-Kontext die Aktion `Fehlupload archivieren`;
- `hardDeleted` bleibt explizit `false`.

Nicht automatisch freigegeben:

- keine echten Daten;
- keine echten Uploads ausserhalb B14;
- keine produktionsnahe Nutzung;
- keine Retention-/Backup-/Restore-Implementierung;
- keine Compliance-/DSGVO-/AVV-Freigabe;
- kein Deployment;
- keine Hard-Delete-Kaskade.

## 7. Sicherer Default

Vor Alexanders Go blieb Option A aktiv:

- UI-Arbeitsbereich kann lokal geleert werden;
- `local:check` darf weiter nur warnen, wenn der lokale Rehearsal-Datenbestand aufgefuellt wirkt;
- keine backend-seitige Archivierung;
- keine Loeschung;
- keine neue API;
- keine neue Persistenz;
- kein Retention- oder Compliance-Anspruch.

## 8. Harte Grenzen fuer C9

C9 ist nach Go ein enger Soft-Archiv-Slice.

Nicht Teil von C9:

- kein Hard-Delete;
- keine neue Persistenzwelt;
- keine Migration;
- keine Datenloeschung;
- keine automatische Bereinigung;
- keine echten Daten;
- keine echten Uploads;
- keine Retention-/Backup-/Restore-Implementierung;
- keine Sandbox-/Worker-/AV-Implementierung;
- keine Deployment- oder Serveraenderung;
- keine Auth-/OIDC-/IAP-Aenderung;
- keine rechtssichere Compliance-/DSGVO-/AVV-Freigabe.

## 9. Umgesetzter technischer Minimalblock

Ziel:

- Ein falscher interner/synthetischer Upload-Kontext kann backend-seitig aus dem aktiven Arbeitsfokus genommen werden.

Umfang:

- nur bestehender MVP-Datenkorridor;
- nur ein enger Operatorpfad;
- nur aktive Listen/Fokuslogik und sichtbare Einordnung;
- nur Soft-Archiv, kein Hard-Delete;
- nur `wrong_upload`, `duplicate_test_data` oder `operator_rehearsal_cleanup` als kontrollierte Reason-Codes, keine freie Bereinigungsnotiz.

Nicht-Ziele:

- keine Retention-Engine;
- keine Kaskadenloeschung;
- keine echte Datenfreigabe;
- keine externe Nutzung;
- keine neue Persistenzwelt.

Dateien/Quellen:

- `intake-service/src/app.ts`
- `intake-service/src/store.ts`
- `intake-service/src/app.js`
- `intake-service/src/store.js`
- `shared-core/src/types.ts`
- `shared-core/src/schemas/*`
- `shared-core/src/access-control.*`
- bestehende Repository-/File-Store-/Postgres-Collection-Grenzen;
- `tests/intake-soft-archive.test.ts`
- `tests/backoffice-production-acceptance-smoke.test.ts`
- `tests/access-control.test.ts`
- `tests/p1-role-guards.test.ts`

Tests:

- archivierter Fehlupload erscheint nicht mehr als aktiver Vorgang;
- `/produktion` kann den fokussierten Intake-Kontext per Soft-Archiv aus dem aktiven Arbeitsfokus nehmen;
- archivierter Kontext bleibt intern ueber Detailpfade und `includeArchived=true` nachvollziehbar;
- kein Hard-Delete;
- Audit-Aktion ist vorhanden;
- `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`.

Abbruchkriterien:

- neue Persistenzwelt oder Migration wird noetig;
- echte Daten oder echte Uploads werden noetig;
- Hard-Delete-Kaskaden werden noetig;
- Retention-/Backup-/Compliance-Fragen muessen in Code beantwortet werden;
- Auth-/Deployment-/Serverfragen werden beruehrt.

Ergebnis:

- Der kleine, reversible Soft-Archiv-Slice ist backend-seitig und in `/produktion` bedienbar gebaut.
- Ohne Hard-Delete, ohne neue Persistenzwelt und ohne echte-Daten-Go.

## 10. Definition of Done

C9 ist erfuellt, wenn:

- diese Entscheidungsvorlage im Repo auffindbar ist;
- Option A, Option B und Option C entscheidungsreif verglichen sind;
- Option B als Empfehlung und Option A als sicherer Default festgehalten sind;
- C9 nicht als Hard-Delete-, Retention-, echte-Daten-, Sandbox-/AV- oder Deployment-Go gelesen werden kann;
- `entfernter Doku-Contract-Test`, `tests/intake-soft-archive.test.ts` und `tests/backoffice-production-acceptance-smoke.test.ts` gruen sind;
- README, TESTING und memory fortgeschrieben sind;
- Full Gates weiterhin gruen bleiben.
