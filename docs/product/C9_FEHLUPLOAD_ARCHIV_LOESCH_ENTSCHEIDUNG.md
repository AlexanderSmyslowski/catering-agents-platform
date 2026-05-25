# C9 Fehlupload-Archiv-/Loeschentscheidung

Status: Doku-/Vertragstest-only Entscheidungsvorlage; keine Runtime-Implementierung, keine neue API, keine Persistenz-/Migrationsaenderung, keine echte Datenbereinigung und keine Retention-/Compliance-Freigabe
Stand: 2026-05-25
Scope: Entscheidungsreife fuer den spaeteren kleinsten Backend-Pfad zum Entfernen eines falschen Uploads aus dem aktiven Arbeitsfokus; keine technische Umsetzung in C9

## 1. Zweck

C9 bereitet die naechste Entscheidung vor, weil der Produktionskern zwar lokal pruefbar ist, falsche Uploads aber noch nicht sauber backend-seitig aus dem aktiven Arbeitsfokus genommen werden koennen.

Das betrifft den internen MVP-/Beta-Korridor:

```text
Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit
```

Ziel ist eine entscheidbare Grenze fuer spaeteren Code, nicht der Code selbst.

## 2. Fuehrende Eingaben

- `AGENTS.md`: falsche Uploads lassen sich fachlich sauber archivieren oder loeschen; Produktionskern zuerst stabilisieren.
- `docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md`: neue API, Persistenz, Retention, echte Daten und Deployment bleiben entscheidungspflichtig.
- `docs/product/P6_AUFBEWAHRUNG_LOESCHUNG_ARCHIVIERUNG_MINISPEZ.md`: im MVP eher vorsichtig archivieren als hart loeschen; keine automatische Loeschung im Hintergrund.
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`: lokaler Demo-/Rehearsal-Korridor, keine Produktionsfreigabe.
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`: Loesch-/Retention-/Backup-Fragen sind eigene Gates.
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`: echte Uploads bleiben ohne Sandbox/Worker/AV-Gate blockiert.
- `scripts/check-local-ops.sh`: lokaler Rehearsal-Datenhinweis ist kein Loesch- oder Archivierungsmechanismus.

## 3. Entscheidung noetig

Kurzer Titel: Backend-Pfad fuer Fehluploads im internen MVP-Korridor.

Warum jetzt?

Der UI-Arbeitsbereich kann lokal geleert werden, aber das ist nur ein Frontend-Fokuswechsel. Falsche oder testweise erzeugte Upload-/Spec-Kontexte bleiben backend-seitig im Datenbestand und koennen spaeter wieder als Altlast oder falscher aktueller Vorgang sichtbar werden.

Eine Implementierung beruehrt API, Persistenzzustand, Audit-/Handoff-Nachvollziehbarkeit und spaeter echte Daten. Darum braucht der Pfad vor Code eine bewusste Alexander-Entscheidung.

## 4. Optionen

### Option A: Status quo plus UI-Arbeitsbereich leeren

Beschreibung:

Der bestehende UI-Pfad bleibt fuehrend. `Arbeitsbereich leeren` entfernt nur den aktuellen lokalen Fokus, aber keine backend-seitigen Intake-, Spec-, Plan-, Einkaufslisten- oder Audit-Daten.

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

Ein spaeterer enger Backend-Slice markiert einen fehlerhaften Upload-/Spezifikationskontext als archiviert oder verworfen und nimmt ihn aus aktiven Listen/Fokuslogiken heraus. Die Daten bleiben fuer interne Nachvollziehbarkeit und Audit-/Review-Kontext erhalten.

Vorteile:

- passt zur P6-Regel "eher archivieren als hart loeschen";
- reduziert Stale-Fokus und aufgefuellte aktive Arbeitslisten;
- erhaelt Nachvollziehbarkeit fuer Demo-/Beta-Review;
- kleiner und reversibler als Hard-Delete.

Nachteile / Risiken:

- braucht trotzdem eine neue API-/Persistenzentscheidung;
- muss definieren, welche Objekte betroffen sind: IntakeRequest, AcceptedEventSpec, OfferDraft, ProductionPlan, PurchaseList, AuditEvent;
- muss UI-Filter und Export-/Audit-Einordnung sauber begrenzen;
- ist noch keine echte Retention-/Compliance-Loesung.

Aufwand:

- klein bis mittel, wenn auf bestehender File-Store-/Repository-Grenze und bestehender Rollen-/Trusted-Actor-Mechanik aufgebaut wird.

Empfehlung ja/nein:

- Ja, empfohlen fuer den naechsten Implementierungsslice nach Alexander-Go.

### Option C: Hard-Delete

Beschreibung:

Ein spaeterer Backend-Pfad entfernt fehlerhafte Upload-/Spezifikations- und Folgeobjekte dauerhaft aus dem Datenbestand.

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

Empfehlung: Option B, Soft-Archiv aus aktivem Arbeitsfokus, aber erst nach explizitem Alexander-Go.

Begruendung:

- Sie loest die belegte Reibung "Fehlupload bleibt aktiv sichtbar" am naechsten.
- Sie respektiert die bestehende P6-Linie: lieber archivieren als hart loeschen.
- Sie laesst interne Nachvollziehbarkeit, Audit-/Handoff-Kontext und spaetere Review-Faehigkeit erhalten.
- Sie bleibt kleiner als eine echte Retention-/Compliance- oder Hard-Delete-Loesung.

## 6. Konsequenz nach Auswahl

Nach Auswahl von Option B darf der naechste technische Minimalblock vorbereitet werden:

- bestehende aktive Listen/Fokuslogik identifizieren;
- kleinsten Archivstatus im vorhandenen Modell-/Store-Korridor bestimmen;
- genau einen Operatorpfad fuer synthetische/interne Fehluploads bauen;
- UI nur so weit anpassen, dass archivierte Vorgange nicht mehr als aktuell erscheinen;
- Audit-/Handoff-Anker intern sichtbar halten;
- fokussierte Tests plus Full Gates ausfuehren.

Nicht automatisch freigegeben:

- keine echten Daten;
- keine echten Uploads ausserhalb B14;
- keine produktionsnahe Nutzung;
- keine Retention-/Backup-/Restore-Implementierung;
- keine Compliance-/DSGVO-/AVV-Freigabe;
- kein Deployment;
- keine Hard-Delete-Kaskade.

## 7. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt Option A aktiv:

- UI-Arbeitsbereich kann lokal geleert werden;
- `local:check` darf weiter nur warnen, wenn der lokale Rehearsal-Datenbestand aufgefuellt wirkt;
- keine backend-seitige Archivierung;
- keine Loeschung;
- keine neue API;
- keine neue Persistenz;
- kein Retention- oder Compliance-Anspruch.

## 8. Harte Grenzen fuer C9

C9 ist nur Entscheidungsvorbereitung.

Nicht Teil von C9:

- keine Runtime-Implementierung;
- keine neue API;
- keine neue Persistenz;
- keine Migration;
- keine Backend-Archivierung;
- keine Datenloeschung;
- keine automatische Bereinigung;
- keine echten Daten;
- keine echten Uploads;
- keine Retention-/Backup-/Restore-Implementierung;
- keine Sandbox-/Worker-/AV-Implementierung;
- keine Deployment- oder Serveraenderung;
- keine Auth-/OIDC-/IAP-Aenderung;
- keine rechtssichere Compliance-/DSGVO-/AVV-Freigabe.

## 9. Minimaler technischer Folgeblock nach Go

Ziel:

- Ein falscher interner/synthetischer Upload-Kontext kann backend-seitig aus dem aktiven Produktionsarbeitsfokus genommen werden.

Umfang:

- nur bestehender MVP-Datenkorridor;
- nur ein enger Operatorpfad;
- nur aktive Listen/Fokuslogik und sichtbare Einordnung;
- nur Soft-Archiv, kein Hard-Delete.

Nicht-Ziele:

- keine Retention-Engine;
- keine Kaskadenloeschung;
- keine echte Datenfreigabe;
- keine externe Nutzung;
- keine neue Persistenzwelt.

Dateien/Quellen:

- `intake-service/src/app.ts`
- `backoffice-ui/src/App.tsx`
- `shared-core/src/types.ts` nur wenn absolut zwingend und klein;
- bestehende Repository-/File-Store-Grenzen;
- `tests/backoffice-production-acceptance-smoke.test.ts`
- ein fokussierter Service-/Integrationstest.

Tests:

- archivierter Fehlupload erscheint nicht mehr als aktiver Vorgang;
- archivierter Kontext bleibt intern nachvollziehbar;
- kein Hard-Delete;
- keine Export-/Audit-Scheingruenheit;
- `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`.

Abbruchkriterien:

- neue Persistenzwelt oder Migration wird noetig;
- echte Daten oder echte Uploads werden noetig;
- Hard-Delete-Kaskaden werden noetig;
- Retention-/Backup-/Compliance-Fragen muessen in Code beantwortet werden;
- Auth-/Deployment-/Serverfragen werden beruehrt.

Erwartetes Ergebnis:

- Nach Alexander-Go kann ein kleiner, reversibler Soft-Archiv-Slice gebaut werden.
- Ohne Go bleibt der Status quo sicher und ehrlich dokumentiert.

## 10. Definition of Done

C9 ist erfuellt, wenn:

- diese Entscheidungsvorlage im Repo auffindbar ist;
- Option A, Option B und Option C entscheidungsreif verglichen sind;
- Option B als Empfehlung und Option A als sicherer Default festgehalten sind;
- C9 nicht als Implementierungs-, API-, Persistenz-, Retention-, echte-Daten-, Sandbox-/AV- oder Deployment-Go gelesen werden kann;
- `tests/c9-fehlupload-archive-delete-decision-contract.test.ts` gruen ist;
- README, TESTING und memory fortgeschrieben sind;
- Full Gates weiterhin gruen bleiben.
