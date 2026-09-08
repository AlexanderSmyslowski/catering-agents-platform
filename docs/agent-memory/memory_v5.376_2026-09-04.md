# memory snapshot v5.376 – 2026-09-04

## Attestations- und FD-Vertrag

Der lokale Backup-/Restore-Kandidat verlangt zwei getrennte, nicht geheime
root-owned-0600 Operatorattestationen. Der Off-host-Record bindet den
kanonischen Locator, Endpoint, aufgelösten Adresssatz samt Produktions-
Adresssatz, Repository-ID, die gemeinsame Produktionshostbindung, Scope,
UTC-Freshness und `status=operator_attested`. Der Secret-Recovery-Record bindet
`source_type=independent-secret-recovery`, die kanonische Referenz
`operator-recovery`, ihren berechneten SHA-256, das erforderliche
Secret-Schema-Digest sowie Repository/Host/Scope/Freshness. Beide Records
werden geschlossen, digest- und descriptorgebunden vor jeder Promotion neu
geprüft; kein Record enthält Secretwerte oder behauptet externe Verifikation.

Repository-/Passwortdateien werden in einer gemeinsamen no-follow-/fstat-
Primitive geöffnet. `secure_restic` reicht genau diese geprüften FDs über
`/proc/self/fd/9` und `/proc/self/fd/8` weiter und vergleicht den Locatordigest
über die gebundenen Bytes. Ein Pfadwechsel nach dem Öffnen kann daher nicht
unbemerkt eine andere Generation liefern.

Der Stand bleibt ein lokaler, ungemergter und nicht ausgeführter Kandidat.
