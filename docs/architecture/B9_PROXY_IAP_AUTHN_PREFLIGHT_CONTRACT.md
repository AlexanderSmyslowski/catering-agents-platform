# B9 Proxy/IAP-AuthN-Preflight-Vertrag

Status: Doku-/Vertragsanker; Preflight-Mindestvertrag vor produktionsnahem Pilot
Stand: 2026-05-22
Scope: Proxy-/IAP-AuthN-Preflight fuer den bestehenden Trusted-Actor-/Read-Path-Korridor; keine App-Login-, Session-, OIDC-, API-, Persistenz-, Migrations- oder Exportimplementierung

## Zweck

B9 definiert den kleinsten Proxy/IAP-AuthN-Preflight-Vertrag, der vor einem spaeteren produktionsnahen Pilot erfuellt sein muss.

Der Vertrag entscheidet nicht ueber ein konkretes Proxy-Produkt und implementiert keinen Proxy. Er macht nur abnahmefaehig, welche Mindestbedingungen vor direkter Service-Exposition und Header-Spoofing erfuellt sein muessen.

Grundlage bleibt `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`. B9 schaerft diesen PA9-Rahmen als aktuellen Preflight-Vertrag fuer die naechste Pilotentscheidung.

## Mindestbedingungen vor produktionsnahem Pilot

Vor einem produktionsnahen Pilot muessen mindestens diese Bedingungen dokumentiert und positiv geprueft sein:

1. Header-Stripping am aeusseren Proxy-/IAP-Rand.
   - Es duerfen keine ungeprueften Client-Header als Trusted Actor bis zur App/API durchgereicht werden.
   - Externe Requests duerfen `x-catering-actor-name`, `x-catering-trusted-secret` und `x-actor-name` nicht unveraendert zu Intake, Offer, Production oder Print-Export weiterreichen.
   - Der Proxy/IAP muss diese Header am aeusseren Rand entfernen oder kontrolliert ueberschreiben.

2. Kontrollierte Trusted-Header-Injektion ausschliesslich durch Proxy/IAP.
   - Mindestbedingung ist eine kontrollierte Trusted-Header-Injektion ausschliesslich durch Proxy/IAP.
   - Nur der vorgeschaltete vertrauenswuerdige Proxy/IAP darf `x-catering-actor-name` setzen.
   - Nur der Proxy/IAP darf `x-catering-trusted-secret` mit dem serverseitig bekannten Shared Secret injizieren.
   - Die injizierten Actor-Namen muessen auf die bestehenden MVP-Minimalrollen abbildbar bleiben.

3. Serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`.
   - Fuer einen produktionsnahen Pilot ist ein serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET` Pflicht.
   - Ohne gesetztes Secret bleibt der Stand Dev-/Test-Kompatibilitaetsmodus und ist nicht pilotbereit fuer echte Daten.
   - Es darf kein clientseitiges oder oeffentliches Secret geben.
   - Das Secret darf nicht in Frontend-Bundles, HTML, JavaScript, Browser-Speichern, API-Antworten, Logs oder oeffentlichen Konfigurationsdateien erscheinen.

4. Keine direkte Service-Exposition der App/API am Proxy vorbei.
   - Mindestbedingung ist keine direkte Service-Exposition der App/API am Proxy vorbei.
   - Intake, Offer, Production und Print-Export duerfen aus dem oeffentlichen Netz nicht direkt auf ihren Service-Ports erreichbar sein.
   - Browser und externe Clients sprechen nur den oeffentlichen Proxy-/IAP-Host an.
   - Direkter Zugriff auf interne Service-Ports wuerde die Header-Vertrauensgrenze unterlaufen.

5. Health-Endpunkte bleiben nicht-sensitiv.
   - `GET /health` darf offen bleiben, solange nur nicht-sensitive Minimaldaten ausgegeben werden.
   - Health darf keine Kunden-, Event-, Rezept-, Angebots-, Produktions-, Einkaufs- oder Auditdaten enthalten.
   - Health darf keine Secrets, Tokens, internen Pfade oder detaillierten Stack-/Fehlerausgaben enthalten.
   - Sobald Health sensible oder betriebliche Detaildaten ausliefert, gehoert Health in denselben Auth-/Proxy-Korridor oder muss reduziert werden.

6. Exporte und read-only Arbeitsbelege bleiben hinter dem Trusted-Actor-/Proxy-Kontext.
   - Angebots-HTML, Produktionsplan-/Produktionsblatt-HTML und Einkaufslisten-CSV bleiben interne read-only Arbeitsbelege.
   - Read-only Detailpfade fuer Intake, Offer und Production bleiben im Trusted-Actor-/Proxy-Kontext.
   - Audit-Read-Pfade bleiben interne Betriebs-/Kontrollnachweise und duerfen nicht als oeffentliche oder rechtssichere Audit-Freigabe gelesen werden.

## Negativer Preflight: wann nicht pilotbereit

Ein spaeteres Deployment ist nicht pilotbereit, wenn mindestens einer dieser Punkte zutrifft:

- clientseitig gesetzte Trusted-/Actor-Header erreichen die Services unveraendert.
- `x-catering-trusted-secret` kann aus Browser, Bundle, API-Antwort, Log oder oeffentlicher Config ausgelesen werden.
- `CATERING_TRUSTED_ACTOR_SECRET` fehlt oder ist leer.
- Intake-, Offer-, Production- oder Print-Export-Ports sind direkt oeffentlich erreichbar.
- Exporte, Detaildaten oder Audit-Reads sind ohne Proxy-/Trusted-Actor-Kontext erreichbar.
- Health liefert sensible Daten oder betriebliche Detailinformationen.
- Der Stand wird als produktionsreife Auth, externe Freigabe oder rechtssichere Compliance behauptet.

## Nicht-Ziele / Grenzen

B9 fuehrt ausdruecklich nicht ein:

- keine Login-/Session-/OIDC-Implementierung in der App
- kein echter Proxy-/IAP-Deployment-Code
- keine neue API
- keine neue Persistenz
- keine Migration
- keine neue Exportlogik
- keine Produktlogik-Ausweitung
- keine Multi-Tenancy-, White-Label- oder Plattform-Erweiterung
- keine produktionsreife Auth
- keine externe Freigabe
- keine rechtssichere Compliance

## B10 Pilot-Preflight-Runbook

Der B10 Pilot-Preflight-Runbookanker ist in `docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md` erfasst.

B10 macht die B9-Mussbedingungen fuer eine konkrete Zielumgebung abfragbar: Zielumgebung, Betreiber und Proxy-/IAP-Rahmen muessen benannt werden; direkte Service-Exposition, Header-Stripping, Trusted-Header-Injektion, serverseitiges Trusted Secret, Health-Grenzen und interne Export-/Read-Pfade muessen je mit `go`, `blocked` oder `not assessed` bewertet werden. PII, Retention, Backup, Sandbox und AV bleiben separate Gates und werden durch B10 nicht geloest.

## Abnahmehinweis

B9 ist erfuellt, wenn dieser Vertrag im Repo auffindbar bleibt, PA9/PA6/TESTING auf ihn verweisen und der Marker-Test `tests/b9-proxy-iap-authn-preflight-contract.test.ts` gruen ist. B10 ist erfuellt, wenn das B10 Pilot-Preflight-Runbook im Repo auffindbar bleibt und der Marker-Test `tests/b10-pilot-preflight-runbook-contract.test.ts` gruen ist.

Die technischen Standard-Gates bleiben unveraendert: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
