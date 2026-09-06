# memory snapshot v5.377 – 2026-09-04

## Attestationen-/Descriptorvertrag

Der A2-Slice bindet zwei getrennte, nicht geheime root-owned-0600
Operatorattestationen descriptor- und Digest-gebunden. Die Off-host-Attestation
trägt den kanonischen Locator/Endpoint, den aufgelösten Endpoint-Adresssatz,
die deterministische Produktionsadressmenge aus Interface- und separat
provisionierten externen Adressen, Repository-/Hostbindung, festen Scope,
`verified_at`/`valid_until` und `status=operator_attested`.

Die Secret-Recovery-Attestation erlaubt ausschließlich die Quellenklassen
`github_environment` oder `offline_vault` mit einem operatorbereitgestellten,
nicht geheimen Locator. Dessen SHA-256 wird aus dem kanonischen Locator selbst
berechnet; ein Schema-Digest bindet mindestens Restic-Verschlüsselungspasswort,
Off-host-Repositoryzugang sowie `POSTGRES_PASSWORD`,
`CATERING_TRUSTED_ACTOR_SECRET` und `CATERING_BASIC_AUTH_PASSWORD_HASH`.
Repository/Host/Scope/Freshness bleiben Pflicht. `operator_attested` beschreibt
nur die Betreiberangabe; keine Secretwerte oder automatisch behauptete externe
Verifikation werden gespeichert.

`secure_restic` öffnet Repository- und Passwortdatei no-follow, prüft dieselben
Fds und reicht sie über `/proc/self/fd/9` und `/proc/self/fd/8` an Restic. Die
Attestationen und diese Fd-Bindung werden vor jeder Backup-/Restore-Promotion
erneut geprüft. Der Stand bleibt lokal, ungemergt und ohne externe Operation.
