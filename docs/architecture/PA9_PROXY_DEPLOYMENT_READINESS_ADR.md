# PA9 Proxy-/Deployment-Readiness fuer Trusted Actor

Status: Entscheidung angenommen; Konfigurations-/Deployment-Readiness-Anker
Datum: 2026-05-21
Scope: Proxy-/Deployment-Annahmen fuer den nach PA8 gehaerteten Trusted-Actor-Korridor; keine Runtime-Feature-Implementierung, keine Login-/Session-Welt, keine neue Persistenz, keine Migration

## 1. Zweck

PA8 schuetzt sensible read-only Detail-/Listen-/Export-/Audit-Pfade mit dem vorhandenen Trusted-Actor-/Rollenmodell.

Diese ADR legt fest, welche Reverse-Proxy- und Deployment-Annahmen zwingend gelten muessen, damit dieser Ansatz nicht durch clientseitig gesetzte Header unterlaufen wird.

Sie ist ein Betriebs- und Readiness-Anker fuer Alexander und einen spaeteren Deployment-Agenten. Sie ist keine Freigabe fuer oeffentlichen Go-Live.

## 2. Bezug und Ist-Zustand

Grundlagen:

- `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md`
- `docs/product/P9_AUTHN_AUTHZ_MVP_RAHMEN_MINISPEZ.md`
- `README.md`
- `TESTING.md`
- PA8 Read-path Auth Hardening Slice 1
- Trusted-Actor-Aufloesung in `shared-core/src/access-control.ts`

Nach PA8 gilt:

- `CATERING_TRUSTED_ACTOR_SECRET` aktiviert den produktionsnahen Trusted-Actor-Modus.
- Bei gesetztem Secret zaehlen Rollen nur aus `x-catering-actor-name` plus passendem `x-catering-trusted-secret`.
- Frei gesetztes `x-actor-name` bleibt nur lokale Dev-/Test-Kompatibilitaet und ist kein produktionsnaher Sicherheitskontext.
- Sensible Detail-/Listen-/Export-/Audit-Read-Pfade sind rollenbezogen geschuetzt.
- `GET /health` darf offen bleiben, solange dort keine sensitiven Daten ausgegeben werden.

## 3. Muss-Anforderungen vor produktionsnaher Exposition

Vor jeder produktionsnahen oder oeffentlichen Exposition muessen diese Anforderungen erfuellt sein:

1. Edge/Reverse Proxy entfernt clientseitig mitgelieferte Trusted-Header.
   - Externe Requests duerfen `x-catering-actor-name`, `x-catering-trusted-secret` und `x-actor-name` nicht unveraendert bis zu den Services durchreichen.
   - Der Proxy muss diese Header am Edge strippen bzw. ueberschreiben.

2. Proxy oder Identity-Aware Proxy setzt Trusted-Header kontrolliert.
   - Nur der vorgeschaltete vertrauenswuerdige Proxy darf `x-catering-actor-name` setzen.
   - Nur der Proxy darf `x-catering-trusted-secret` mit dem serverseitig bekannten Shared Secret injizieren.
   - Die Actor-Namen muessen auf die im MVP gueltigen Minimalrollen abbildbar bleiben.

3. `CATERING_TRUSTED_ACTOR_SECRET` ist in produktionsnaher Umgebung Pflicht.
   - Ohne gesetztes Secret befindet sich die App im Dev-/Test-Kompatibilitaetsmodus.
   - Ein Deployment mit echten Daten und ohne Secret ist nicht bereit fuer produktionsnahe Exposition.

4. Das Trusted Secret darf nie an Browser oder Clients ausgeliefert werden.
   - Das Secret gehoert nur in Server-/Proxy-Konfiguration bzw. serverseitige Secret-Verwaltung.
   - Es darf nicht in Frontend-Bundles, HTML, JavaScript, lokalen Browser-Speichern, API-Antworten, Logs oder Client-Konfigurationsdateien erscheinen.

5. Services duerfen nicht direkt aus dem oeffentlichen Netz erreichbar sein.
   - Intake, Offer, Production und Export muessen nur hinter dem Proxy bzw. intern im Compose-/Service-Netz erreichbar sein.
   - Direkter Zugriff auf Service-Ports wuerde die Header-Vertrauensgrenze unterlaufen.

## 4. TLS, Host, Origin und CORS

Mindestannahmen fuer produktionsnahe Exposition:

- TLS terminiert am vertrauenswuerdigen Edge/Reverse Proxy, z. B. Caddy.
- Der oeffentliche Host ist explizit festgelegt, z. B. ueber `CATERING_SITE_ADDRESS`.
- HTTP muss auf HTTPS umgeleitet oder gleichwertig kontrolliert werden, sobald echte Daten exponiert werden.
- Der Browser spricht nur mit dem oeffentlichen Web-/Proxy-Host, nicht direkt mit den Service-Ports.
- CORS bleibt restriktiv: keine pauschale Freigabe fuer beliebige Origins, solange nicht bewusst entschieden und getestet.
- Falls spaeter ein Identity-Aware Proxy/OIDC-Gate davorgeschaltet wird, bleibt dieses Gate die AuthN-Quelle; die App interpretiert nur den daraus kontrolliert erzeugten Trusted-Actor-Kontext.

## 5. Health-Endpunkte

`GET /health` auf Intake, Offer, Production und Export darf offen bleiben, solange die Antwort strikt nicht-sensitiv bleibt.

Erlaubt sind z. B.:

- einfacher Status wie `ok`
- Service-Name oder technische Minimalbereitschaft
- keine personenbezogenen Daten
- keine Kunden-, Event-, Rezept-, Angebots-, Produktions-, Einkaufs- oder Auditdaten
- keine Secrets, Tokens, internen Pfade oder detaillierten Stack-/Fehlerausgaben

Sobald ein Health-Endpunkt sensible oder betriebliche Detaildaten ausliefert, muss er entweder reduziert oder in denselben Auth-/Proxy-Korridor aufgenommen werden.

## 6. Nicht-Ziele dieses PA9-Slices

PA9 fuehrt ausdruecklich nicht ein:

- keine OIDC-/SSO-/OAuth-Implementierung
- keine applikationsinterne Login- oder Session-Welt
- keine neue RBAC-Engine
- keine neue Persistenz, Migration oder Nutzerverwaltung
- keine neue Secret-Plattform
- keine neuen Runtime-Endpunkte
- keine Freigabe fuer oeffentlichen Go-Live

## 7. Minimaler Preflight-Check vor Exposition

Vor produktionsnaher Exposition muss ein Deployment-Agent mindestens diesen Preflight dokumentiert pruefen:

1. `CATERING_TRUSTED_ACTOR_SECRET` ist serverseitig gesetzt und nicht leer.
2. Ein externer Request mit selbst gesetztem `x-catering-actor-name`, `x-catering-trusted-secret` oder `x-actor-name` wird am Edge entfernt bzw. ueberschrieben.
3. Der Proxy injiziert den erwarteten `x-catering-actor-name` und das passende `x-catering-trusted-secret` nur nach erfolgreicher vorgelagerter AuthN bzw. nur im bewusst internen Kontrollkorridor.
4. Service-Ports fuer Intake, Offer, Production und Export sind nicht direkt oeffentlich erreichbar.
5. Browser-Quelltext, ausgelieferte JS-Bundles und API-Antworten enthalten das Trusted Secret nicht.
6. `GET /health` liefert nur nicht-sensitive Minimaldaten.
7. TLS, Host und Origin/CORS-Verhalten entsprechen dem vorgesehenen Zielhost.
8. Die repo-seitigen Gates bleiben gruen: `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.

## 8. Einordnung

Der Trusted-Actor-Korridor ist nach PA8 ein technisches Mindest-Gate fuer interne und produktionsnahe Servicepfade, aber keine eigenstaendige Nutzer-Authentifizierung.

PA9 macht deshalb die Proxy-/Deployment-Grenze verbindlich: Client-Header sind nicht vertrauenswuerdig; vertrauenswuerdig ist nur der vom Edge kontrolliert erzeugte Header-Kontext. Ohne Header-Stripping, kontrollierte Header-Injektion, gesetztes Server-Secret und nicht direkt exponierte Services darf der Stand nicht als produktionsnah bereit gelten.

B6 ordnet die bestehenden Exportpfade fuer Angebot, Produktionsblatt-/Produktionsplan und Einkaufsliste nur als interne read-only Arbeitsbelege unter Trusted-Actor-Kontext ein. Diese Exportartefakte sind keine externe Freigabe, keine Produktionsfreigabe, keine rechtssichere Audit-/Compliance-Behauptung und kein OIDC/Login; die PA9-Grenze bleibt Proxy-/Deployment-Readiness ohne neue Login-, Session-, Persistenz- oder Exportlogik.

## 9. B9 Proxy/IAP-AuthN-Preflight-Vertrag

Der B9 Proxy/IAP-AuthN-Preflight-Vertrag ist in `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md` als aktueller Doku-/Vertragsanker erfasst.

B9 schaerft PA9 fuer einen spaeteren produktionsnahen Pilot auf die kleinsten Muss-Bedingungen: Header-Stripping am aeusseren Proxy-/IAP-Rand, kontrollierte Trusted-Header-Injektion ausschliesslich durch Proxy/IAP, serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`, kein clientseitiges oder oeffentliches Secret, keine direkte Service-Exposition am Proxy vorbei, nicht-sensitive Health-Endpunkte sowie Exporte/read-only Arbeitsbelege hinter Trusted-Actor-/Proxy-Kontext.

B9 bleibt ausdruecklich ohne Login-/Session-/OIDC-Implementierung in der App, ohne echten Proxy-/IAP-Deployment-Code, ohne neue API, Persistenz, Migration, Exportlogik, Produktlogik-Ausweitung, Multi-Tenancy-/White-Label-/Plattform-Erweiterung, produktionsreife Auth, externe Freigabe oder rechtssichere Compliance.
