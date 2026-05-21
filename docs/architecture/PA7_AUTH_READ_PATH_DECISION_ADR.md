# PA7 AuthN/AuthZ + Read-Path Auth – Entscheidungs-ADR

Status: Entscheidung angenommen; PA8 Runtime-Slice 1 umgesetzt
Datum: 2026-05-21
Scope: PA7 ADR plus PA8 Read-path Auth Hardening Slice 1; keine neue Persistenz, keine Migration, keine OIDC-/Login-Implementierung

## 1. Zweck

Diese ADR bereitet die Entscheidung vor, welches AuthN/AuthZ- und Read-Path-Modell als nächstes umgesetzt werden soll, bevor weitere Runtime-Slices oder Produktionsagent-v1-Fähigkeiten gebaut werden.

Sie folgt der PA6-Empfehlung: Vor externer oder produktionsnaher Nutzung muss zuerst das echte Gate für AuthN/AuthZ und read-path Auth entschieden werden.

## 2. Quellen und Repo-Anker

Gelesene Grundlagen:

- `docs/product/P9_AUTHN_AUTHZ_MVP_RAHMEN_MINISPEZ.md`
- `docs/product/P1_MVP_ROLLEN_RECHTE_MATRIX.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md`
- `README.md`
- `TESTING.md`
- `shared-core/src/access-control.ts`
- `tests/access-control.test.ts`
- `tests/trusted-identity-access.test.ts`
- relevante Service-Guards in Intake, Offer und Production

## 3. Ist-Zustand

### 3.1 Trusted Actor Context

Umgesetzt ist ein minimaler Trusted-Actor-Rahmen im `shared-core`:

- Rollenbasis: `intake_operator`, `offer_operator`, `production_operator`, `operations_audit_operator`
- Standard-Akteursnamen: `Intake-Mitarbeiter`, `Angebots-Mitarbeiter`, `Produktions-Mitarbeiter`, `Betriebs-/Audit-Operator`
- produktionsnaher Vertrauenspfad: `x-catering-actor-name` plus passendes `x-catering-trusted-secret`
- Konfiguration über `CATERING_TRUSTED_ACTOR_SECRET` bzw. Testoption `trustedActorSecret`

Wichtig: Sobald ein Trusted-Secret gesetzt ist, zählt ein frei gesetztes `x-actor-name` nicht mehr als Rollenquelle. Ohne Secret bleibt `x-actor-name` nur Dev-/Test-Kompatibilität.

### 3.2 Dev-/Test-Modus

Der lokale Dev-/Test-Modus erlaubt weiterhin `x-actor-name`, damit bestehende Tests, UI-Entwicklung und lokale Bedienung einfach bleiben.

Diese Dev-Kompatibilität ist ausdrücklich kein produktionsnahes Sicherheitsmodell. Für echte Daten ist direkte API-Exposition ohne Proxy-/AuthN-Rahmen weiterhin unzulässig.

### 3.3 Mutierende Pfade

Die mutierenden MVP-Kernpfade sind bereits real guard-geschützt und in P1/P9 dokumentiert. Dazu gehören insbesondere:

- Intake: `POST /v1/intake/normalize`, `POST /v1/intake/documents`, `POST /v1/intake/documents/upload`, `POST /v1/intake/specs/manual`, `PATCH /v1/intake/specs/:specId`, `POST /v1/intake/seed-demo`, `POST /v1/intake/spec-governance/finalize`
- Angebot: `POST /v1/offers/drafts`, `POST /v1/offers/from-text`, `POST /v1/offers/recipes/import-text`, `POST /v1/offers/recipes/upload`, `POST /v1/offers/seed-demo`, `PATCH /v1/offers/recipes/:recipeId/review`
- Produktion: `POST /v1/production/plans`, `POST /v1/production/recipes/import-text`, `POST /v1/production/recipes/upload`, `POST /v1/production/seed-demo`, `PATCH /v1/production/recipes/:recipeId/review`

`tests/access-control.test.ts` und servicebezogene Access-Tests sichern den Minimal-Korridor ab.

### 3.4 Read-only Detail-, Export- und Audit-Pfade

Read-only ist heute ungleichmäßig eingeordnet:

- Der Audit-Read-Pfad `GET /v1/production/audit/events` ist bereits als Betriebs-/Audit-Pfad guard-geschützt und in `tests/trusted-identity-access.test.ts` gegen Spoofing abgesichert.
- Detail- und Listenpfade in Intake, Offer, Production und Backoffice sind überwiegend interne read-only Datenpfade und nicht als öffentlich exponierte APIs freigegeben.
- Exportpfade für Angebots-HTML, Produktionsblatt-HTML und Einkaufsliste-CSV sind interne Arbeitsbelege. Sie sind ausgabeseitig gegen XSS gehärtet, aber noch nicht als echtes read-path Auth-Gate für produktionsnahe/externe Nutzung entschieden.

PA6 und das Produktionsagent-v1-Architektur-Gate benennen deshalb read-path Auth für Detail-, Export- und Audit-Sichten als offenes Gate vor echter Nutzung.

## 4. Ziel und Nicht-Ziele

### 4.1 Ziel für den nächsten Implementierungsslice

Der nächste Implementierungsslice soll nach Alexanders Entscheidung genau ein kleines, belastbares Gate umsetzen:

- AuthN-Quelle eindeutig festlegen
- Actor-/Rollen-Kontext für geschützte Mutations- und Read-Pfade konsistent ableiten
- read-only Detail-, Export- und Audit-Pfade für echte Daten technisch schützen
- Dev-/Test-Kompatibilität weiterhin kontrolliert möglich halten
- vorhandene Service-/UI-/Teststruktur nicht groß umbauen

### 4.2 Interner MVP

Für den internen MVP reicht aktuell ein kontrollierter Korridor, solange:

- die Plattform nicht öffentlich exponiert wird
- mutierende Pfade über vorhandene Guards laufen
- Audit-Read bereits geschützt bleibt
- Detail-/Export-Read-Pfade organisatorisch intern bleiben
- `npm test`, `npm run build`, `npm audit --omit=dev` und die Smoke-/Access-Korridore grün bleiben

### 4.3 Produktionsnahe oder externe Nutzung

Für produktionsnahe oder externe Nutzung reicht der heutige Zustand nicht. Dafür müssen mindestens AuthN/AuthZ und read-path Auth bewusst entschieden und umgesetzt werden.

### 4.4 Nicht-Ziele dieses ADR- und Folgeslices

Nicht Teil dieses Slices und nicht still vorzuziehen:

- keine neue Persistenz
- keine Migration
- keine OIDC-/Login-Implementierung in dieser ADR
- keine neue Session-Datenbank
- keine neue RBAC-Engine
- keine Multi-Tenancy
- keine neue Produktfläche
- keine LLM-, PDF-, Rezept-, Allergen- oder Produktionsagent-v1-Runtime-Funktion

## 5. Optionen

### Option A: Reverse Proxy/OIDC/SSO setzt vertrauenswürdige Header

Modell:

- Ein vorgeschalteter Reverse Proxy bzw. Identity-Aware Proxy übernimmt echte AuthN, z. B. OIDC/SSO.
- Die App akzeptiert weiterhin nur vertrauenswürdige interne Header vom Proxy.
- Der bestehende Trusted-Actor-Rahmen wird zur Applikationsgrenze ausgebaut: Header werden nicht aus dem öffentlichen Netz akzeptiert, sondern ausschließlich aus dem Proxy-Vertrauenskanal.
- Read-Pfade erhalten dieselbe Actor-/Rollenprüfung wie mutierende Pfade.

Bewertung:

- Sicherheit: stark, wenn Proxy-Header zuverlässig entfernt/gesetzt werden und Services nicht direkt erreichbar sind.
- Aufwand: mittel; App bleibt relativ klein, Proxy-/Infra-Konfiguration wird entscheidend.
- Architekturpassung: sehr gut zum vorhandenen Trusted-Actor-Kontext und Caddy-/Reverse-Proxy-Bild.
- Risiken: Fehlkonfiguration des Proxys, direkte Service-Exposition, Header-Spoofing bei falschem Netzschnitt.
- Testbarkeit: gut über bestehende `trustedActorSecret`-Tests plus neue read-path Auth-Regressionen.
- Betrieb: gut für interne Organisation, wenn Alexander einen IdP/OIDC-Provider oder Identity-Aware Proxy festlegt.

### Option B: Applikationsinterne Session/Auth

Modell:

- Die App implementiert eigene Login-, Session- und Rollenverwaltung.
- Services lesen Rollen aus einem applikationsinternen Session-/Token-Kontext statt aus Proxy-Headern.
- Read- und Write-Pfade werden über diese interne Auth-Schicht geschützt.

Bewertung:

- Sicherheit: grundsätzlich stark möglich, aber nur mit sauberer Session-, Cookie-, CSRF-, Passwort-/IdP- und Rollenlogik.
- Aufwand: hoch; braucht Produkt- und Sicherheitsdesign statt Minimal-Slice.
- Architekturpassung: aktuell schwächer, weil das Repo bewusst keine neue Identity-/Persistenzwelt enthält.
- Risiken: eigene Auth-Fehler, Scope-Ausweitung, neue Persistenz-/Migrationserfordernisse.
- Testbarkeit: mittel bis gut, aber deutlich breiterer Testkorridor nötig.
- Betrieb: später flexibel, jetzt zu groß für den nächsten kontrollierten Slice.

### Option C: Weiter nur interner trusted-proxy Korridor, aber read-paths härten

Modell:

- Kein echtes OIDC/SSO-Gate im nächsten Schritt.
- Der vorhandene Trusted-Actor-Mechanismus bleibt das alleinige technische Auth-Gate.
- Detail-, Export- und Audit-Read-Pfade werden technisch mit Rollen/Trusted Actor geschützt.
- Betrieblich bleibt die Plattform nur intern und nicht öffentlich exponiert.

Bewertung:

- Sicherheit: besser als heute für read-only Datenpfade, aber keine echte Nutzer-AuthN.
- Aufwand: klein bis mittel; passt in einen engen Implementierungsslice.
- Architekturpassung: gut als Übergang, aber nicht ausreichend für externe Nutzung.
- Risiken: trügerische Sicherheit, wenn der Korridor öffentlich exponiert würde; Shared Secret ersetzt kein SSO.
- Testbarkeit: sehr gut mit vorhandenen Service-Injection-Tests.
- Betrieb: nur als bewusst interner Übergang vertretbar.

### Option D: Mischform/Stufenmodell

Modell:

- Stufe 1: Jetzt read-path Auth auf Basis des vorhandenen Trusted-Actor-Kontexts implementieren.
- Stufe 2: Gleichzeitig die Proxy-/OIDC-Annahme verbindlich dokumentieren: öffentliche Nutzung erst nach vorgeschaltetem OIDC/SSO bzw. gleichwertigem Identity-Aware Proxy.
- Stufe 3: Später optional OIDC/SSO konkret anbinden oder Proxy-Setup finalisieren, ohne die App in eine eigene Auth-Plattform umzubauen.

Bewertung:

- Sicherheit: kurzfristig verbessert, mittelfristig sauber, sofern Stufe 2 nicht übersprungen wird.
- Aufwand: kleinster sinnvoller nächster Runtime-Slice plus klarer Betriebsentscheid.
- Architekturpassung: am besten zur aktuellen Repo-Linie: Trusted Actor bleibt Mindestlinie, OIDC/SSO bleibt echtes Gate vor Exposition.
- Risiken: Stufe 1 darf nicht als externe Freigabe missverstanden werden.
- Testbarkeit: sehr gut, weil read-path Auth isoliert testbar ist.
- Betrieb: praktikabel, wenn die Dokumentation klar zwischen internem Korridor und produktionsnaher Exposition trennt.

## 6. Empfehlung

Primärempfehlung: Option D, mit Stufe 1 als kleinstem nächsten Implementierungsslice.

Begründung: Der vorhandene Trusted-Actor-Kontext ist bereits real, testbar und passt zur aktuellen Architektur. Gleichzeitig reicht er allein nicht als echte externe AuthN-Schicht; deshalb muss Alexander vor produktionsnaher Exposition zusätzlich entscheiden, ob Reverse Proxy/OIDC/SSO das verbindliche AuthN-Gate wird.

Nicht empfohlen als nächster Schritt ist Option B. Eine applikationsinterne Session-/Auth-Welt wäre ein größerer Produkt- und Persistenzschnitt und widerspricht dem gewünschten Minimal-Scope für den nächsten Slice.

## 7. Kleinster sinnvoller nächster technischer Slice nach Entscheidung

Wenn Alexander Option D bestätigt, ist der kleinste nächste Implementierungsslice:

1. Alle sensiblen read-only Detail-/Listen-/Exportpfade inventarisieren.
2. Für echte Daten relevante Read-Pfade mit vorhandener Trusted-Actor-/Rollenprüfung schützen.
3. Audit-Read-Schutz unverändert beibehalten und nicht aufweichen.
4. Dev-/Test-Kompatibilität über fehlendes `CATERING_TRUSTED_ACTOR_SECRET` erhalten.
5. README bzw. Betriebsdoku minimal nachziehen: öffentliche Exposition nur hinter Proxy/OIDC/SSO oder ausdrücklich internem Netzwerk.
6. Regressionstests ergänzen: ohne Trusted-Kontext 403 bei gesetztem Secret, mit passendem Trusted-Kontext 200.

Dieser Slice darf keine neue Login-, OIDC-, Session-, Persistenz- oder Migrationsebene implementieren.

## 8. Akzeptanzkriterien für den nächsten Implementierungsslice

### 8.1 Zu schützende Pfadklassen

Mindestens zu prüfen und, soweit echte Daten ausliefernd, zu schützen:

- Audit: `GET /v1/production/audit/events` bleibt geschützt.
- Intake-Read: Spezifikations-/Request-Listen und Detaildaten.
- Offer-Read: Angebotslisten, Angebotsdetails, Rezeptlisten, Rezeptdetails, soweit echte Betriebsdaten sichtbar werden.
- Production-Read: Produktionsplanlisten, Produktionsplandetails, Rezeptlisten, Produktionsstatus und vergleichbare Datenpfade.
- Export-Read: Angebots-HTML, Produktionsblatt-HTML und Einkaufsliste-CSV.
- Health: `GET /health` kann bewusst unauthentifiziert bleiben, solange keine sensiblen Daten ausgegeben werden.

### 8.2 Tests

Erwartete Tests:

- mindestens ein read-path Auth-Test je betroffener Service-/Pfadklasse oder ein gut begründeter kompakter Korridortest
- Spoofing-Test: `x-actor-name` reicht bei gesetztem `CATERING_TRUSTED_ACTOR_SECRET` nicht
- Positivtest: `x-catering-actor-name` plus passendes `x-catering-trusted-secret` erlaubt den vorgesehenen Read-Zugriff
- Regression, dass Dev-/Test-Modus ohne Secret nicht unnötig gebrochen wird
- bestehende Access-Control-, Trusted-Identity-, Export- und Smoke-Tests bleiben grün

### 8.3 Env-/Proxy-Annahmen

Zu dokumentieren:

- `CATERING_TRUSTED_ACTOR_SECRET` ist für produktionsnahe Umgebungen Pflicht, solange kein stärkeres AuthN-Gate live ist.
- Direkter Zugriff auf Services ist für echte Daten verboten; Services dürfen nur hinter Proxy bzw. internem Netz erreichbar sein.
- Der Proxy muss externe `x-catering-*`- und `x-actor-name`-Header entfernen bzw. kontrolliert neu setzen.
- `x-actor-name` bleibt ausschließlich lokaler Dev-/Test-Kompatibilitätsheader.
- OIDC/SSO oder gleichwertiger Identity-Aware Proxy bleibt Voraussetzung für externe oder breiter produktionsnahe Nutzung.

## 9. Offene Entscheidungen für Alexander

1. Soll Option D als nächstes verbindlich gelten: erst read-path Auth auf Trusted-Actor-Basis härten, externe Nutzung aber weiter an OIDC/SSO bzw. Identity-Aware Proxy koppeln? Ja/Nein.
2. Wenn ja: Soll für die echte AuthN später primär Reverse Proxy/OIDC/SSO gelten, statt applikationsinterner Login-/Session-Welt? Option A oder B.
3. Dürfen Health-Endpunkte unauthentifiziert bleiben, solange sie keine sensiblen Daten liefern? Ja/Nein.

## 10. Entscheidungsvorschlag

Empfohlene Entscheidung:

- Option D wird als Stufenmodell angenommen.
- Der nächste Runtime-Slice härtet nur read-only Detail-/Export-/Audit-Pfade mit vorhandener Trusted-Actor-/Rollenlogik.
- Externe oder echte produktionsnahe Nutzung bleibt bis zur bestätigten Proxy/OIDC/SSO-Entscheidung gesperrt.

Damit erhält Alexander sofort einen kleinen, testbaren Sicherheitsgewinn, ohne jetzt eine neue Login-, Session- oder Persistenzwelt zu bauen.

## 11. PA8-Umsetzungsstand nach Slice 1

Option D ist fuer den ersten technischen Slice umgesetzt.

Real gehaertet sind sensible read-only Pfade fuer echte Betriebsdaten:

- Intake: `GET /v1/intake/requests`, `GET /v1/intake/requests/:requestId`, `GET /v1/intake/specs`, `GET /v1/intake/specs/:specId` -> Intake-Operator
- Angebot: `GET /v1/offers/drafts`, `GET /v1/offers/drafts/:draftId`, `GET /v1/offers/recipes`, `GET /v1/offers/recipes/:recipeId` -> Angebots-Operator
- Produktion: `GET /v1/production/plans`, `GET /v1/production/plans/:planId`, `GET /v1/production/purchase-lists`, `GET /v1/production/purchase-lists/:purchaseListId`, `GET /v1/production/recipes`, `GET /v1/production/recipes/:recipeId` -> Produktions-Operator
- Audit: `GET /v1/production/audit/events` bleibt Betriebs-/Audit-Operator-geschuetzt
- Print-Export: `GET /v1/exports/offers/:draftId/html` -> Angebots-Operator; `GET /v1/exports/production-plans/:planId/html` und `GET /v1/exports/purchase-lists/:purchaseListId/csv` -> Produktions-Operator

Bei gesetztem `CATERING_TRUSTED_ACTOR_SECRET` reicht ein frei gesetztes `x-actor-name` fuer diese Read-Pfade nicht aus. Erforderlich bleibt der Trusted-Proxy-Kontext aus `x-catering-actor-name` und passendem `x-catering-trusted-secret`.

Bewusst offen bleiben `GET /health` je Service und Exportservice, solange dort nur nicht-sensitive Status-/Zaehlinformationen ausgeliefert werden.

Grenzen bleiben unveraendert:

- keine applikationsinterne Login-/Session-Welt
- keine OIDC-/SSO-Implementierung in diesem Slice
- keine neue Persistenz oder Migration
- keine externe oder produktionsnahe Freigabe ohne Reverse Proxy/OIDC/SSO bzw. gleichwertigen Identity-Aware Proxy
