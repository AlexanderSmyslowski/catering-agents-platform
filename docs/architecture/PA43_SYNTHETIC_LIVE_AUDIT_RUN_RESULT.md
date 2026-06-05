# PA43 Synthetic-Live Audit und Run-Result

## Ziel

Der erste echte `synthetic_live`-Providerlauf aus PA42 soll nicht nur einen
Draft liefern, sondern auch sauber in die bestehenden Readiness-Vertraege fuer
`AgentAudit` und `RunResult` hineinlaufen.

## Was dieser Schritt ausdruecklich tut

- erweitert `AgentAudit` um den erfolgreichen Status `matched_provider`
- erlaubt `synthetic_live` als zweiten, weiterhin stark begrenzten Adaptermodus
- schreibt `providerId` und optional `providerRequestId` in Audit und Run-Result
- behaelt `fixtureId` als synthetischen Eval-Anker auch fuer Live-Validierung

## Was dieser Schritt ausdruecklich nicht tut

- keine neue API
- keine Persistenz
- keine Runtime-Conversation
- keine Schreibwirkung
- keine echten Daten
- keine Tool-Orchestrierung
- keine Provider-Freigabe ausserhalb des bereits env-gated PA42-Korridors

## Warum das wichtig ist

PA42 konnte erstmals einen echten, aber strikt synthetischen Provider-Call
ausfuehren. Ohne PA43 waere dieser Lauf im Readiness-Korridor halb sichtbar:
Der Slice waere live, aber Audit und Run-Result waeren weiter nur auf
`fixture_only` ausgerichtet.

Mit PA43 bleibt die Architektur klein und nachvollziehbar:

- `fixture_only` bleibt der konservative Standardpfad
- `synthetic_live` wird als klar markierte Ausnahme sichtbar
- beide Pfade landen im selben deterministischen Audit-/Result-Rahmen

## Akzeptanz

- erfolgreicher `synthetic_live`-Lauf ergibt `matched_provider` im Audit
- `providerId` und `providerRequestId` bleiben bis ins Run-Result erhalten
- bestehende `fixture_only`-Faelle bleiben unveraendert gruen
