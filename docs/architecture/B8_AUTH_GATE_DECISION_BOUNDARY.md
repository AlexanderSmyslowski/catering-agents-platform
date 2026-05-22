# B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze

Status: Entscheidungsvorbereitung; Doku-/Vertragsanker
Stand: 2026-05-22
Scope: vorhandene interne Read-Path-/Trusted-Actor-Grenzen entscheidungsfaehig strukturieren; keine Login-, OIDC-, API-, Persistenz-, Migrations- oder Exportimplementierung

## Zweck

B8 bereitet den naechsten AuthN/AuthZ-/read-path-Auth-Strang entscheidungsfaehig vor, ohne vorschnell ein Login-, OIDC- oder Session-System zu bauen.

Die Uebersicht trennt den real vorhandenen internen Schutzkorridor von den weiterhin offenen Entscheidungen fuer produktionsnahe oder externe Nutzung. Sie ist keine produktionsnahe Freigabe und keine rechtssichere Audit-/Compliance-Behauptung.

## Quellen

- `docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/product/PA6_INTERNAL_BETA_READINESS_SUMMARY.md`
- `README.md`
- `TESTING.md`
- `tests/pa8-read-path-auth.test.ts`
- `tests/trusted-identity-access.test.ts`
- `tests/production-audit-access.test.ts`

## Tatsaechlich umgesetzt / intern geschuetzt

- PA8 Read-path Auth Hardening Slice 1 ist umgesetzt und testseitig abgesichert.
- `CATERING_TRUSTED_ACTOR_SECRET` aktiviert den Trusted-Actor-Modus.
- Bei gesetztem Secret zaehlen Rollen nur aus `x-catering-actor-name` plus passendem `x-catering-trusted-secret`.
- Ein frei gesetztes `x-actor-name` reicht bei gesetztem Secret nicht aus und bleibt nur lokale Dev-/Test-Kompatibilitaet.
- Mutierende MVP-Kernpfade sind im bestehenden P1/P9-Korridor rollenbezogen gehaertet.
- Der Audit-Read-Pfad `GET /v1/production/audit/events` bleibt als Betriebs-/Audit-Pfad geschuetzt.
- Health-Endpunkte bleiben offen, solange sie keine sensiblen Daten liefern.

Diese Punkte beschreiben den heutigen internen technischen Mindestkorridor. Sie ersetzen keine echte Nutzer-Authentifizierung.

## Read-only Pfade am Trusted-Actor-/internen Kontext

Die folgenden Pfadklassen haengen heute an Trusted-Actor-/internem Kontext und duerfen nur innerhalb dieser Grenze als interne Arbeits- und Kontrollpfade verstanden werden:

- Intake-Read: Requests und Specs (`GET /v1/intake/requests`, Details, `GET /v1/intake/specs`, Details) -> Intake-Operator.
- Offer-Read: Drafts und Rezepte (`GET /v1/offers/drafts`, Details, `GET /v1/offers/recipes`, Details) -> Angebots-Operator.
- Production-Read: Plaene, Einkaufslisten und Rezepte (`GET /v1/production/plans`, Details, `GET /v1/production/purchase-lists`, Details, `GET /v1/production/recipes`, Details) -> Produktions-Operator.
- Export-Read: Angebots-HTML, Produktionsplan-/Produktionsblatt-HTML und Einkaufslisten-CSV -> Angebots- bzw. Produktions-Operator.
- Audit-Read: `GET /v1/production/audit/events` -> Betriebs-/Audit-Operator.

Die Exportartefakte bleiben interne read-only Arbeitsbelege. Sie sind keine externe Freigabe, keine Produktionsfreigabe und keine rechtssichere Audit-/Compliance-Behauptung.

## Nicht produktionsnah nutzbar ohne naechste Auth-Entscheidung

Ohne naechste bewusste Auth-Entscheidung duerfen insbesondere diese Nutzungen nicht produktionsnah oder extern freigegeben werden:

- direkte oeffentliche Service-Exposition von Intake, Offer, Production oder Print-Export.
- echte Daten in Detail-, Export- oder Auditpfaden ohne vorgeschalteten Proxy/IAP mit Header-Stripping und kontrollierter Trusted-Header-Injektion.
- Deployments ohne serverseitig gesetztes `CATERING_TRUSTED_ACTOR_SECRET`.
- Browser- oder Client-Zugriff auf das Trusted Secret.
- Annahme, dass frei gesetzte Client-Header eine belastbare Identitaet darstellen.
- Interpretation des Trusted-Actor-Korridors als produktionsreife AuthN/AuthZ-Schicht.

Trusted-Actor allein ist keine echte Nutzer-AuthN. Der heutige Stand bleibt interner Mindestschutz und keine produktionsnahe Freigabe.

## Minimalentscheidung fuer Alexander als B9-Einstieg

Alexander muss als naechstes genau den kleinsten produktionsnahen Auth-Korridor festlegen:

Soll B9 den kleinsten produktionsnahen Auth-Korridor als Reverse-Proxy/OIDC-/Identity-Aware-Proxy-Korridor festlegen, der echte AuthN vor der App erzwingt, Header am Edge entfernt, nur kontrollierte Trusted-Header injiziert und in den Services weiterhin nur vorhandene Trusted-Actor-/Rollenpruefung in den Services nutzen laesst?

Empfehlung: Ja, als enger B9-Entscheidungs- und ggf. Preflight-Slice. Die App sollte dabei keine applikationsinterne Login-/Session-Welt bauen. Der erste produktionsnahe Korridor sollte aus Proxy/IAP-AuthN plus vorhandener service-seitiger Trusted-Actor-/Rollenpruefung bestehen.

Wenn Alexander diese Richtung nicht freigibt, muss der Stand weiterhin auf kontrollierte interne Nutzung begrenzt bleiben.

## Out of scope fuer B8 und die Entscheidungsvorbereitung

B8 fuehrt ausdruecklich nicht ein:

- kein OIDC-/Login-Bau
- keine applikationsinterne Session-Welt
- keine externe Rollen-/Mandantenlogik
- keine Multi-Tenancy-, White-Label- oder Plattform-Erweiterung
- keine neue Exportlogik
- keine neue API
- keine neue Persistenz
- keine Migration
- keine neue Secret- oder Nutzerverwaltungsplattform
- keine produktionsnahe Freigabe
- keine externe Freigabe
- keine rechtssichere Audit-/Compliance-Behauptung

## B9-Empfehlung

B9 sollte nicht erneut weitere Read-Pfade inventarisieren, solange PA8/B6 gruene Regressionen halten. Der naechste kleinste echte Schritt ist eine Proxy/IAP-AuthN-Entscheidung mit minimalem Preflight-Vertrag:

1. Bestaetigen, dass echte AuthN vor der App durch Reverse Proxy/OIDC/SSO oder gleichwertigen Identity-Aware Proxy erfolgen soll.
2. Bestaetigen, dass die App selbst vorerst keine Login-/Session-/User-Persistenz baut.
3. Einen kleinen testbaren Preflight definieren: Header-Stripping, kontrollierte Trusted-Header-Injektion, gesetztes Server-Secret, keine direkte Service-Exposition, nicht-sensitive Health-Antworten.
4. Erst danach entscheiden, ob ein konkreter Deployment-/Proxy-Slice umgesetzt wird.
