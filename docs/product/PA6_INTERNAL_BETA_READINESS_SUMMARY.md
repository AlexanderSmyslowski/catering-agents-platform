# PA6 Interne Beta-/Abnahme-Readiness-Zusammenfassung

Status: interne Readiness-Zusammenfassung v0.1 auf Basis bestehender Repo-Signale
Stand: 2026-05-21
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
