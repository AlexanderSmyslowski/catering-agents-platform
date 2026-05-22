# PA6 Interne Beta-/Abnahme-Readiness-Zusammenfassung

Status: interne Readiness-Zusammenfassung v0.1 auf Basis bestehender Repo-Signale
Stand: 2026-05-22
Scope: Doku-only; keine neue Runtime-Funktion, keine neue API, keine neue Persistenz

## 1. Zweck und Abgrenzung

Diese Zusammenfassung fuehrt die vorhandenen Status-, Test-, Export-, Audit- und Gate-Signale fuer eine knappe interne Beta-/Abnahme-Sicht zusammen.

Sie ist kein Monitoring-Dashboard, keine Release-Plattform und keine produktive Freigabe fuer externe Nutzung. Sie behauptet nur, welcher interne MVP-Korridor anhand bestehender Repo-Signale aktuell abnahmeorientiert lesbar ist und welche Gates vor echter externer oder produktionsnaher Nutzung offen bleiben.

## 2. Quellen

Diese Readiness-Sicht stuetzt sich ausschliesslich auf bestehende Repo-Quellen:

- `memory.md`
- `README.md`
- `TESTING.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/product/P2_BROWSER_SMOKE_MINISPEZ.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `docs/product/P9_AUTHN_AUTHZ_MVP_RAHMEN_MINISPEZ.md`
- `docs/product/P14_AUDIT_REVIEW_SPUREN_OPERATIVE_NUTZUNG_MINISPEZ.md`
- `docs/product/P17_MINIMALER_INTERNER_BETRIEBSSTATUS_UND_LAGEUEBERBLICK_MVP_MINISPEZ.md`
- PA5-Nachvollziehbarkeitskorridor im Architektur-Gate und in `tests/pa5-traceability-corridor.test.ts`

## 3. Interner MVP-Korridor: aktuell zulaessig

Der aktuelle Stand ist fuer einen kontrollierten internen MVP-/Beta-Korridor lesbar, wenn die bestehenden Checks gruen bleiben.

Zulaessig ist im internen Korridor:

- lokale oder servernahe interne Nutzung der vorhandenen Kernrouten `/`, `/angebot` und `/produktion`
- Nutzung der vorhandenen strukturierten Intake-, Angebots- und Produktionsobjekte als pruefbare Arbeitsgrundlage
- Nutzung der vorhandenen read-only Exporte fuer Angebot, Produktionsblatt und Einkaufsliste als interne Arbeitsbelege
- Nutzung der vorhandenen Audit-/Review-/Operator-Spuren als interne Betriebs- und Kontrollnachweise
- Nutzung des PA5-Korridors `Upload-Provenance -> Conversation-Quellenanker -> Produktionsoutput/Exportdarstellung` als interne Nachvollziehbarkeit vorhandener Upload-Metadaten
- Weiterfuehrung der bestehenden Test-, Build-, Audit- und lokalen Smoke-Signale als knappe Abnahmebasis

Diese Einordnung gilt nur fuer interne kontrollierte Nutzung. Sie ersetzt keine rechtliche, compliance-seitige oder externe Produktfreigabe.

## 4. Gruene Abnahmesignale im Repo

Die interne Readiness stuetzt sich auf folgende pruefbare Signale:

| Signal | Bestehender Nachweis | Einordnung |
| --- | --- | --- |
| Tests | `npm test` und fokussierte Vitest-Korridore | Technische Regression fuer Kernpfade |
| Build | `npm run build` | TypeScript-/UI-Build-Gate |
| Dependency Audit | `npm audit --omit=dev` | Mindestlinie fuer bekannte Produktionsabhängigkeitsrisiken |
| Lokaler Status | `npm run local:status` | Schneller Blick auf laufende lokale Services, sofern Stack aktiv ist |
| UI-Smoke | Kernrouten `/`, `/angebot`, `/produktion` laut `TESTING.md` und P2 | Schmaler Frontend-/Route-Korridor |
| Exporte | Angebot, Produktionsblatt, Einkaufsliste | Interne Arbeitsbelege, keine rechtssichere Freigabe |
| Audit/Review | geschuetzte Kernpfade und Audit-Feed | Interne Kontroll- und Nachvollziehbarkeitsspur |
| PA5-Provenance | Upload-Metadaten bis Exportanker | Interne Rueckverfolgung vorhandener Quellenanker |
| Produktionsagent-v1-Gate | Architektur-Gate | Sperre gegen ungeklärten Featurebau |

## 5. Bewusst offen vor externer oder produktiver Nutzung

Externe oder echte produktive Nutzung ist mit diesem Stand nicht freigegeben. Vorher muessen mindestens folgende Gates bewusst entschieden und umgesetzt oder belastbar begruendet sein:

- echte AuthN/AuthZ-Schicht, insbesondere OIDC/SSO oder gleichwertiger Reverse-Proxy-/Session-Rahmen
- erneute Klassifikation und Absicherung von read-only Detail-, Export- und Audit-Pfaden fuer echte Daten
- Sandbox-/Worker- und AV-Entscheidung fuer PDF-/Dokumentverarbeitung und unsichere Eingaben
- read-path Auth fuer Detail-, Export- und Audit-Sichten mit echten Daten
- PII-, Retention-, Backup-/Restore- und Access-Regeln fuer Rohdokumente, extrahierte Texte, Exporte, Audit und spaetere Sessions
- klare Human-Approval-Regeln fuer produktionsrelevante Artefakte
- Betriebskonzept fuer reale Nutzer, Verantwortlichkeiten, Datenzugriff und Störungsreaktion
- keine direkte oeffentliche Service-Exposition ohne Proxy-/AuthN-Rahmen

Bis diese Punkte geklaert sind, bleibt der Stand ein interner MVP-/Beta-Korridor.

## 6. Produktionsagent-v1: nicht implementiert

Der heutige Stand ist noch kein echter LLM-Produktionsagent v1.

Insbesondere nicht implementiert sind:

- keine echte `ConversationSession` als persistiertes Produktobjekt
- keine LLM-Orchestrierung
- keine Tool-Use-Schicht fuer Agenten
- keine neue PDF-/OCR-/Parser-Engine jenseits vorhandener Textgewinnung
- keine LLM-Rezeptgenerierung
- keine fachlich/rechtlich abgesicherte Allergen Engine Deutsch/Englisch
- kein Exportpaket mit Manifest und Freigabestatus
- keine neue Persistenz- oder Migrationswelt

Der bestehende PA5-Provenance-Korridor ist nur intern nachvollziehbar. Er ist kein rechtssicherer Audit und keine Vollständigkeitsgarantie fuer spaetere LLM-/Rezept-/Allergen-Outputs.

## 7. Kleinster interner Abnahmesatz

Wenn `npm test`, `npm run build`, `npm audit --omit=dev`, der lokale Status-/Smoke-Korridor sowie die Export- und Audit-/Review-Signale gruen bleiben, ist der Stand fuer eine kontrollierte interne Beta-/Abnahmesicht ausreichend eingegrenzt.

Freigegeben ist damit nur der interne MVP-Korridor. Nicht freigegeben sind externe Nutzung, echte produktionsnahe Nutzung mit ungeklärten Daten-/Auth-/Retention-Risiken und jeder Produktionsagent-v1-Featurebau jenseits des Architektur-Gates.

## 8. Naechster enger Schritt

Der Provenance-Strang sollte nach PA5 stehen bleiben. Der naechste sinnvolle Schritt ist keine neue Runtime-Funktion, sondern eine Produktentscheidung: Welche offenen Gates muessen vor einer echten externen oder produktionsnahen Nutzung zuerst geschlossen werden?

Empfohlene Entscheidungsreihenfolge:

1. AuthN/AuthZ fuer echte Nutzer und read-only Pfade
2. PII-/Retention-/Backup-/Restore-Rahmen
3. Sandbox-/Worker-Entscheidung fuer Dokumentverarbeitung
4. Human Approval fuer produktionsrelevante Artefakte
5. erst danach weitere Produktionsagent-v1-ADRs oder Feature-Slices

## 9. Management-/Lageuebersicht B7

Diese Lageuebersicht ist bewusst hart und knapp. Sie ersetzt keine Freigabeentscheidung und fuehrt keine neue Produktlogik ein.

### Tatsaechlich umgesetzt

- Bestehende Kernrouten `/`, `/angebot` und `/produktion` sind im Backoffice-Korridor testseitig abgesichert.
- Bestehende lokale Abnahmesignale sind dokumentiert: `npm run local:status`, `npm run local:check`, `npm test`, `npm run build`, `npm audit --omit=dev` und `git diff --check`.
- Read-only Exportpfade fuer Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufslisten-CSV sind im bestehenden PA8/B6-Korridor unter Trusted-Actor-Kontext abgesichert.
- Upload-/Ingestion-Warnungen und Quellenanker werden als sichere Marker sichtbar, ohne Rohtext- oder Vollhash-Spiegelung.
- Produktionsobjekt-/Export-Readiness in `/produktion` benennt fehlende Einkaufsliste oder fehlende Exportlinks als offenen Zustand statt als fertigen Export.

### Nur dokumentiert / nur intern abnahmefaehig

- C8 ist ein interner Demo-/Abnahmeweg aus bestehenden Scripts, Routen, Exporten, Warnankern und Gates; C8 ist keine neue Runtime-Funktion.
- PA6 ist eine Management-/Readiness-Sicht aus bestehenden Repo-Signalen; sie ist kein Monitoring, keine Release-Plattform und keine produktive Freigabe.
- PA9 beschreibt Proxy-/Deployment-Annahmen fuer Trusted Actor; PA9 implementiert kein OIDC/Login und keine Session-Welt.
- Audit-/Review- und Exportartefakte sind interne Betriebs-, Kontroll- und Arbeitsbelege. Keine Produktionsfreigabe, keine externe Freigabe und keine rechtssichere Audit-/Compliance-Behauptung.

### Offen

- Echte AuthN/AuthZ-Schicht fuer reale Nutzer, insbesondere OIDC/SSO oder gleichwertiger Identity-Aware Proxy.
- Vollstaendig entschiedener read-path Auth-/Proxy-Rahmen fuer echte Detail-, Export- und Auditdaten.
- PII-, Retention-, Backup-/Restore- und Access-Regeln fuer Rohdokumente, extrahierte Texte, Exporte, Audit und spaetere Sessions.
- Sandbox-/Worker- und AV-Entscheidung fuer PDF-/Dokumentverarbeitung und unsichere Eingaben.
- Human-Approval-Regeln fuer produktionsrelevante Artefakte.
- Echter ProductionAgent-v1 mit LLM-/Tool-Use-/Rezept-/Allergen-Faehigkeiten bleibt durch das Architektur-Gate gesperrt.

### Risiko

- Ohne vorgeschalteten Proxy mit Header-Stripping und kontrollierter Trusted-Header-Injektion darf der Trusted-Actor-Korridor nicht als produktionsnah sicher gelten.
- Ohne `CATERING_TRUSTED_ACTOR_SECRET` bleibt die App im Dev-/Test-Kompatibilitaetsmodus.
- Lokale Gruen-Signale belegen nur den internen MVP-/Demo-Korridor, nicht reale Betriebs-, Rechts-, Datenschutz- oder Compliance-Reife.
- Dokumentierte Abnahme kann falsch gelesen werden, wenn interne Arbeitsbelege als externe Freigabe oder produktionsreife Artefakte behandelt werden.

### Naechste Entscheidung fuer Alexander

Alexander muss entscheiden, ob B8 zuerst AuthN/AuthZ/read-path Auth, PII-/Retention/Backup oder Sandbox-/Worker/AV schliesst.

Empfehlung: B8 sollte AuthN/AuthZ/read-path Auth priorisieren, weil diese Entscheidung die Grenze fuer echte Daten, Exporte, Auditpfade und jeden spaeteren produktionsnahen Pilotbetrieb bestimmt.

## 10. B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze

Die B8 AuthN/AuthZ/read-path Auth Entscheidungsgrenze ist in `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md` als Doku-/Vertragsanker erfasst.

B8 trennt:

- tatsaechlich umgesetzt / intern geschuetzt: PA8 Read-path Auth Hardening Slice 1, Trusted-Actor-Modus bei gesetztem `CATERING_TRUSTED_ACTOR_SECRET`, Schutz gegen frei gesetztes `x-actor-name`, bestehende Rollenpruefung und offene nicht-sensitive Health-Endpunkte.
- read-only Pfade am Trusted-Actor-/internen Kontext: Intake-Requests/-Specs, Offer-Drafts/-Recipes, Production-Plaene/-Einkaufslisten/-Rezepte, Export-Read fuer Angebots-HTML/Produktionsplan-/Produktionsblatt-HTML/Einkaufslisten-CSV und Audit-Read.
- nicht produktionsnah nutzbar ohne naechste Auth-Entscheidung: direkte oeffentliche Service-Exposition, echte Detail-/Export-/Auditdaten ohne Proxy/IAP, Deployments ohne serverseitiges Trusted Secret und jede Gleichsetzung von Trusted-Actor mit echter Nutzer-AuthN.
- Minimalentscheidung fuer Alexander: Soll B9 den kleinsten produktionsnahen Auth-Korridor als Reverse-Proxy/OIDC-/Identity-Aware-Proxy-Korridor festlegen, ohne applikationsinterne Login-/Session-Welt zu bauen?

B8 bleibt ohne OIDC-/Login-Bau, externe Rollen-/Mandantenlogik, neue Exportlogik, neue API, neue Persistenz, Migration, produktionsnahe Freigabe oder rechtssichere Audit-/Compliance-Behauptung.
