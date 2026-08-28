# Catering Session Authentication – Gate B Design

## Status

Variante A wurde am 28. August 2026 fachlich freigegeben. Dieses Dokument
schreibt die angenommene Anwendungsauthentifizierung für Catering verbindlich
fest. Abschnitt 11 beschreibt einen erst bei der Codekartierung sichtbar
gewordenen, noch gesondert zu bestätigenden P1 zur historischen
Vertraulichkeit von ProductionFeedbackDraft.

## Ziel

Catering erhält einen eigenen Login aus eindeutiger Kennung und sechsstelliger
PIN. Jeder geschützte Browserrequest wird an eine konkrete, unveränderliche
`userId` gebunden. Rolle und Aktivstatus werden bei jedem Request aus dem
serverseitigen User Store geladen; ausschließlich die bestehende
`MINIMAL_MVP_ROLE_CAPABILITIES`-Matrix entscheidet über Rechte.

Die Gate-B-Produktbaseline aus PR #677 bleibt fachlich führend. Authentisierung
darf die dort bewiesenen Preisredaktionen, Production-Rechte, Read-only-Grenzen,
Exportgrenzen und Auditprojektionen weder abschwächen noch duplizieren.

## Nicht-Ziele

- keine Caddy-, Proxy-, Shared-Edge-, Docker-, Server- oder Phase-3-Änderung;
- kein gemeinsamer Auth-Service für mehrere Produkte;
- kein externer IdP und kein Google-, Microsoft- oder Cloudflare-Login;
- kein Multi-Tenant-/SaaS-Ausbau;
- keine zweite Rollen- oder Capability-Matrix;
- keine Rollen-, Benutzer- oder Capability-Ableitung aus URL, Pfad oder Header;
- kein JavaScript-lesbarer Token und kein Bearer-Token als Browserfallback;
- keine öffentliche Benutzerverwaltungs-API und kein allgemeines UI-Redesign;
- kein Merge, Deployment, Release oder Tag in diesem Produktslice.

## Architektur

Die bestehende business-scoped Persistenz erhält die Collection `auth/users`.
Der Intake-Dienst stellt Login, Sessionprüfung und Logout bereit. Intake,
Offer, Production und Print Export verwenden denselben shared-core
Sessionvertrag und denselben User Store.

```text
Kennung + PIN
  -> Intake-Login
  -> HttpOnly-Cookie mit JWT(sub=userId, sessionBinding)
  -> jeder Dienst prüft Cookie und JWT
  -> User Store lädt active, authEpoch und aktuelle role
  -> bestehende Capability-Matrix
  -> Route, Projektion, Export und Audit
```

Der aktuelle Hosted-Stack setzt kein `CATERING_DEPLOYMENT_PROFILE=hosted`.
Darum darf der Sessionmodus nicht nur von diesem Profil abhängen. Verbindlich
gilt:

```ts
sessionMode = deploymentProfile === "hosted" || !isDevAuthEnabled(env);
```

Nur `CATERING_DEV_AUTH=1` aktiviert den bisherigen lokalen Entwicklungsmodus.
Ein Hosted-Profil gewinnt immer gegen das Dev-Flag. Im Sessionmodus bedeutet
eine fehlende, ungültige oder veraltete Sitzung stets HTTP 401. Der Code ruft
dann niemals den bisherigen Header-Actor-Resolver als Fallback auf.

## User Store

Der User Store verwendet ausschließlich
`createBusinessScopedPersistentCollection` und die vorhandenen File-/Postgres-
CAS- und Critical-Section-Verträge.

```ts
interface CateringUserRecord {
  schemaVersion: "1.0";
  businessId: BusinessId;
  userId: string;
  loginCodeCanonical: string;
  displayName: string;
  pinHash: string;
  role: MinimalMvpRole;
  active: boolean;
  authEpoch: number;
  failedLoginCount: number;
  failureWindowStartedAt?: string;
  lockedUntil?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

`userId` ist ein zufälliges, unveränderliches Subject. Die kanonische Kennung
ist im ersten Slice ebenfalls unveränderlich. Sie wird getrimmt, in ASCII-
Kleinschreibung überführt und muss dem Ausdruck
`^[a-z0-9][a-z0-9._-]{1,63}$` entsprechen. Ihre Eindeutigkeit wird unter
einer vorhandenen business-scoped Critical Section geprüft; der Lock-Identifier
enthält nur einen Hash der Kennung. Login akzeptiert keine `businessId` vom
Client. Der konfigurierte THE-ONE-Betrieb ist alleinige Quelle des
Betriebskontexts.

PIN-Hash, Sperrzähler und Sperrzeit erscheinen nie in API-Antworten oder Audit.
Benutzeranlage sowie PIN-, Rollen- und Aktivstatusänderungen erfolgen über ein
lokales, nicht netzwerkfähiges Verwaltungswerkzeug. Sicherheitsänderungen
erhöhen `authEpoch` und `version`; reine Loginfehler erhöhen nur `version`.
Das Werkzeug wählt denselben Speicher wie die Dienste: Eine konfigurierte
`CATERING_DATABASE_URL` beziehungsweise `DATABASE_URL` hat Vorrang, andernfalls
ist ein explizites `CATERING_DATA_ROOT` erforderlich. Es gibt keinen impliziten
Wechsel auf einen anderen Speicher.

Im File-Backend wird ausschließlich die Collection `auth/users` zusätzlich
gehärtet: Das Collection-Verzeichnis besitzt Modus `0700`, temporäre und
veröffentlichte Benutzerrecords besitzen vor dem ersten Payload-Write Modus
`0600`. Auch ein Replacement stellt diese Modi unabhängig von der Prozess-Umask
wieder her. Andere Collections und der PostgreSQL-Pfad bleiben unverändert.

## PIN und Sperrlogik

Ein PIN besteht exakt aus sechs ASCII-Ziffern. Neue PINs verwenden ausschließlich
scrypt mit folgenden festen Parametern:

```text
N = 16384
r = 8
p = 1
Salt = 16 zufällige Bytes
Output = 32 Bytes
Format = scrypt$16384$8$1$<32 hex>$<64 hex>
```

Der Verifizierer akzeptiert keine Parameter aus dem Datenbestand, kein fremdes
Format und keinen Legacy-SHA-Fallback. Der Vergleich ist zeitkonstant.
Unbekannte Kennungen durchlaufen bei zugelassenen Versuchen dieselbe
scrypt-Arbeit mit einem festen Dummy-Hash. Fehlermeldungen unterscheiden
unbekannte Kennung, falschen PIN, inaktiven Benutzer, Sperre und konkurrierende
Sicherheitsänderung nicht. Jeder zur KDF-Arbeit zugelassene Loginversuch führt
genau eine scrypt-Prüfung aus: nur bei einer formal gültigen sechsstelligen PIN
und einem eindeutig gefundenen, validen Record gegen dessen Hash, andernfalls
gegen den Dummy-Hash. Eine formal ungültige PIN darf insbesondere bei einem
Konto mit der echten PIN `000000` keinen Treffer erzeugen. Aktivstatus und
Kontosperre werden erst danach extern beantwortet.

- zwölf Fehlversuche innerhalb von 15 Minuten sperren das Konto zehn Minuten;
- Kontosperre und Fehlerfenster werden CAS-gesichert persistiert;
- zusätzlich gelten 60 Fehlversuche je vertrauenswürdiger Quelle in 15 Minuten;
- der flüchtige Quellen-Bucket wird ausschließlich aus einem normalisierten,
  serverseitig bestimmten `sourceKey` und einer domain-separierten HMAC
  gebildet; Kennung oder Login-Code sind kein Bestandteil dieses Keys;
- wechselnde Kennungen aus derselben Quelle teilen daher denselben Bucket,
  während die persistierte Kontosperre separat am Benutzerrecord bleibt;
- ohne belastbare Clientadresse gilt ein strenger gemeinsamer Bucket;
- `X-Forwarded-For` wird in diesem Produktslice nicht als freie Wahrheit
  übernommen;
- ein bereits ausgeschöpfter Quellen-Bucket bricht vor Benutzerlookup und KDF
  mit derselben Rate-Limit-Antwort ab;
- pro Prozess werden höchstens vier scrypt-Prüfungen gleichzeitig zugelassen;
  weitere Versuche werden vor Lookup und KDF kurzzeitig rate-limitiert, damit
  keine unbeschränkte KDF-Warteschlange entsteht;
- jede KDF-Zulassung wird auch bei Verifikationsfehlern zuverlässig freigegeben;
- ein CAS-Konflikt nach PIN-Prüfung erzeugt keine Sitzung.

## JWT und Cookie

Der Browser erhält ausschließlich dieses Cookie:

```text
__Host-catering_session
HttpOnly
Secure
SameSite=Strict
Path=/
kein Domain-Attribut
```

Das JWT gilt zwölf Stunden und besitzt keinen Refresh-Token. Es enthält nur
`sub`, `sessionBinding`, `iat`, `exp`, `iss`, `aud` und optional `jti`. Rolle,
Kennung, Anzeigename, PIN und Betriebskontext stehen nicht im Token.

JWT-, Binding- und Rate-Limit-Schlüssel werden durch domain-separierte HMAC-
Ableitung aus dem bestehenden starken `CATERING_TRUSTED_ACTOR_SECRET` gewonnen.
Im Sessionmodus startet ein Dienst ohne ausreichend starkes Root-Secret
fail-closed. Der Secret-Wert wird nie protokolliert.

`sessionBinding` bindet `userId` und `authEpoch`. Jeder geschützte Request:

1. verifiziert Signatur, `iss`, `aud`, Laufzeit und Cookiequelle;
2. lädt den aktuellen Benutzer über `sub`;
3. prüft `active` und die aktuelle Epoch-Bindung;
4. übernimmt ausschließlich die aktuelle User-Store-Rolle;
5. erzeugt einen Request-lokalen Session-Actor.

Bei `@fastify/jwt` ist zwingend `request.jwtVerify({ onlyCookie: true })` zu
verwenden. Ein gültiger Bearer-Token ohne Cookie muss HTTP 401 liefern.
Alle vier Dienste registrieren die gemeinsame Sitzungskette in exakt dieser
Reihenfolge: zuerst `@fastify/cookie`, danach `@fastify/jwt` mit
`cookie.cookieName = "__Host-catering_session"` und erst danach den
Session-`onRequest`-Guard. Ein von Intake ausgestelltes Cookie muss damit in
Offer, Production und Print/Export identisch verifiziert werden.

## Actor und Capability

Ein Session-Actor besitzt:

```ts
{
  name: user.userId,
  businessId: configuredBusinessId,
  source: "authenticated-session",
  trusted: true,
  role: user.role
}
```

Die flüchtige `role` wird nur serverseitig gesetzt. Der Capability-Check liest
sie ausschließlich für `authenticated-session`; für den expliziten lokalen
Dev-Modus bleibt die historische Namensabbildung erhalten. Die bestehende
Capability-Matrix selbst bleibt byte- und bedeutungsgleich.

Finale Freigaben dürfen einen gültigen Session-Actor als menschliche
Freigabeevidenz verwenden. Dev-, untrusted- und Service-Quellen bleiben für
finale menschliche Freigaben unzulässig. Bestehende historische Proxy-
Provenienz bleibt lesbar. Die im ApprovalRequest persistierte Rolle muss der
aktuell aus demselben Session-Actor gelesenen Rolle entsprechen; ein Aufrufer
darf keine abweichende Freigaberolle einsetzen.

## Öffentliche und interne Routen

Im Sessionmodus werden alle registrierten `/v1`-Fachrouten standardmäßig
geschützt. Bewusste öffentliche Ausnahmen sind nur:

- `/health`;
- `POST /v1/auth/login`;
- `GET /v1/auth/session` als cookieprüfender Endpunkt;
- `POST /v1/auth/logout` als cookieprüfender Endpunkt.

Ein Registrierungstest muss jede Fachroute klassifizieren. Dadurch bleiben
auch bisher in der statischen Liste fehlende Quantity-Workflow- und
Production-Folder-Exportpfade geschützt.

Bestehende interne Dienstaufrufe bleiben als eng gebundene Service-Principals
erhalten:

- Offer-Service -> Intake ausschließlich für
  `GET /v1/intake/internal/requests/:requestId` und
  `GET /v1/intake/internal/source-documents/:documentId`;
- Production-Service -> Intake ausschließlich für
  `GET /v1/intake/internal/requests/:requestId`,
  `GET /v1/intake/internal/specs/:specId`,
  `GET /v1/intake/internal/source-documents/:documentId`,
  `GET /v1/intake/internal/source-documents/:documentId/content`,
  `PUT /v1/intake/internal/specs/:specId` und
  `PUT /v1/intake/internal/specs/:specId/replacement`;
- Production-Service -> Offer ausschließlich für
  `GET /v1/offers/handoffs/:handoffId`.

Ein Service-Principal gilt nur für die exakte vorhandene Methoden-/Pfad-
Allowlist und erhält keine menschliche Rolle oder allgemeine Capability.
Für jedes erlaubte Tripel sichern Negativtests benachbarte Methode, Pfad und
Service-Identität ab.
Öffentliche Fachrouten akzeptieren ihn nicht als alternative Browsersitzung.
Auch für interne Principals bleibt der konfigurierte THE-ONE-Betrieb
serverautoritativ; ein eingehender Business-Header darf keinen anderen
Betriebskontext wählen.

## Header- und CSRF-Grenze

Im Sessionmodus sind `x-actor-name`, `x-catering-actor-name`,
`x-catering-business-id`, Actor-/Subject-/Role-/Identity-Header und der
historische Caddy-Actor vollständig wirkungslos für Benutzer, Rolle und
Capability. Ein Header ohne Cookie ergibt HTTP 401. Ein Header neben einem
Cookie kann Rechte weder erhöhen noch senken.

Die physische Entfernung der Caddy-Header ist ausdrücklich Infrastrukturarbeit
und nicht Bestandteil dieses Slices.

Cookie-authentifizierte Mutationen verlangen zusätzlich eine passende
Same-Origin-Grenze. `SameSite=Strict` wird durch eine serverseitige Prüfung von
`Origin` gegen den angeforderten Host ergänzt. Interne Service-Principals und
der explizite lokale Dev-Modus verwenden ihre eigenen bestehenden Grenzen.

## UI

Die UI ruft vor jedem Fachloader `/api/intake/v1/auth/session` auf. Bei HTTP 401
wird ausschließlich der Login gerendert. Kein Intake-, Offer-, Production-,
Audit- oder Exportloader darf vorher starten.

Nach Login verwendet die UI Same-Origin-Cookies und speichert kein JWT. Sie
sendet keinen Actor-Namen mehr. Der bisherige Local-Storage-Operatorname und der
feste Production-Header verlieren jede Identitätswirkung. Anzeigename und
Logout kommen aus dem Sessionkontext; alle Fachrechte bleiben serverautoritativ.
Beim Start der Abmeldung werden Fachrequests sofort abgebrochen und Fachinhalte
ausgehängt. Login wird erst nach bestätigtem HTTP-204-Logout gezeigt. Bei
Netzwerk- oder Serverfehler bleibt stattdessen ein blockierender, fachinhaltfreier
Wiederholungszustand sichtbar; die noch mögliche Cookie-Sitzung wird nicht als
erfolgreich beendet dargestellt.

Die vorhandene ProductionRouteAccessBoundary bleibt bestehen und konsumiert
weiter die serverseitige Capability. Read-only erhält keine Mutation,
Freigabe, Review- oder Exportaktion.

## Audit und Hosted-E2E

Ohne Auditmigration speichert `AuditEntry.actor.name` die konkrete `userId` und
`actor.source` den Wert `authenticated-session`. Anzeigenamen sind keine
Auditidentität.

Der Kandidat muss drei synthetische Konten über denselben echten
Anwendungszugriff prüfen:

| Konto | Pflichtnachweis |
|---|---|
| Admin | vollständige erlaubte API/UI-Rechte, kommerzielle Exporte, Audit mit konkreter `userId` |
| `production_operator` | Production-Workbench und fachliche Entscheidungen; keine Preise, Offer-Rechte oder kommerziellen Exporte |
| `read_only_operator` | redigierte Production-Leseansicht; keine Mutation, Freigabe, Review oder Exporterzeugung |

Pflichtnegative Fälle sind Cookie-freie Caddy-/Actor-Header, Bearer ohne Cookie,
gefälschte Admin-Header neben niedriger Sitzung, Cross-Path-Zugriff, Rollen- und
Aktivstatusänderung, PIN-Wechsel, Sperre sowie Audit ohne PIN-, Hash-, Kennungs-
oder Cookieleck.

Der codebasierte Hosted-Profil-Test ist Produktnachweis. Ein späterer Lauf gegen
die tatsächlich gehostete URL bleibt eine gesondert freizugebende
Betriebsaktion; bis dahin bleibt Gate B insgesamt offen.

## Gesonderter P1-Entscheid: ProductionFeedback-Vertraulichkeit

`ProductionFeedbackDraft` speichert heute nur `createdBy.name` und
`createdBy.source`. Für nichtkommerzielle Production-Akteure wird daraus
historisch die Rolle über den bekannten Actor-Namen rekonstruiert. Nach der
richtigen Umstellung auf `name = userId` ist diese Rekonstruktion unmöglich.
Ein Lookup der heutigen Benutzerrolle wäre fachlich falsch: Eine spätere
Herabstufung eines Administrators könnte altes kommerzielles Feedback sichtbar
machen.

Empfohlene engste Korrektur:

```ts
type ProductionFeedbackVisibility = "operational" | "commercial";

interface ProductionFeedbackDraft {
  // bestehende Felder unverändert
  visibility?: ProductionFeedbackVisibility;
}
```

- Neue Session-Entwürfe setzen die Sichtbarkeit unveränderlich bei Erstellung:
  `commercial`, wenn der Ersteller die bestehende Capability `commercial`
  besitzt, sonst `operational`.
- Insert und spätere Updates vergleichen die persistierte Sichtbarkeit an der
  Speichergrenze; eine Umklassifizierung in beide Richtungen scheitert
  konfliktgesichert.
- Keine Text-, Wort-, Zahlen- oder Preisheuristik entscheidet darüber.
- Entscheidungsänderungen verändern die Sichtbarkeit nicht.
- Eine terminale Feedbackentscheidung wird per Exact-CAS gegen genau den zuvor
  geprüften `pending_review`-Snapshot gespeichert. Ein konkurrierender zweiter
  Entscheidungsversuch scheitert mit Konflikt und kann den ersten Zustand nicht
  überschreiben.
- Für Session-Provenienz ist das Feld zwingend.
- Historische Proxy-Provenienz darf den bestehenden streng kontrollierten
  Kompatibilitätspfad weiter verwenden.
- Andere historische oder unklassifizierte Einträge bleiben für Rollen ohne
  Preisrecht fail-closed unsichtbar.

Das Feld ist eine unveränderliche Inhaltsklassifikation, keine neue Rollenmatrix
und keine zweite Freigabewahrheit. Da es dennoch eine enge Erweiterung eines
persistierten Produktmodells ist, beginnt die Produktimplementierung erst nach
ausdrücklicher Bestätigung dieses P1-Entscheids.

## Abnahmekriterien

- Kein P0 und kein P1 im exakten Auth-Kandidaten.
- Kein Session-, JWT-, Header-, Pfad-, Bearer- oder Exportfallback.
- Aktuelle Rolle und Aktivstatus werden bei jedem geschützten Benutzerrequest
  serverseitig geprüft.
- Rollen-, PIN- und Aktivstatusänderungen invalidieren bestehende Sitzungen.
- Admin, Production ohne Preisrecht und Read-only bestehen API, UI, Export und
  Audit im codebasierten Hosted-E2E.
- PR #677 bleibt unverändert und eingefroren.
- Keine Infrastruktur-, Caddy-, Proxy-, Phase-3-, Deployment- oder Release-
  Änderung.
