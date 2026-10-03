# P3.1C – containerd-Image-Identität, Diagnose abgeschlossen

Datum: 2026-10-01. Klassifikation: **P3.1C BLOCKED**.

- Der unveränderte P3.1B-Bundlestand mit Produkt `9ce4fbc96a5dd877f2cd2f00588a22be861306b9` und noch nicht regulär angenommenem Operationsstand `0cad37b840af516e165267df240a3196a8147a02` wurde in derselben isolierten VM real geladen. Beide gebundenen Config-Digests bleiben byte-identisch im containerd-Content und im erneuten lokalen Docker-save erhalten. Direkte Docker-CLI-Lookups nach Config-Digest scheitern; Inspect einer gültigen Index-Referenz liefert als `.Id` den Index beziehungsweise mit expliziter Plattform das Manifest, nicht den Config-Digest.
- Der aktuelle Vertrag setzt Config-Bindung, Compose-Referenz und Container-Imagevergleich gleich. Ein absichtlich Index-adressierter, ansonsten hashgebundener Diagnose-Override wird vom unveränderten Operator abgewiesen. Ein Lookup-Teilfix schließt Compose, Verify und Rollback deshalb nicht. P3.1C stoppt an der ausdrücklich gesetzten Vertragsgrenze; kein Betriebsfix, kein neuer Bundlebau und kein Runtime-Rehearsal. Der kleinste nächste Entscheid betrifft die explizite Relation zwischen kanonischer Config-Identität und aus dem Archiv abgeleiteter unveränderlicher Docker-Referenz.
- Snapshot: `docs/agent-memory/2026-10-01-p3-1c-containerd-identity.md`. Reale Rohbelege liegen ausschließlich im separaten privaten P3.1C-Paket. Keine Store-Umstellung, Produktionsverbindung, Credential-/Push-Reparatur oder Hub-Schreibwirkung; unabhängiger Review und reguläre Annahme bleiben offen.

## Vertragsgrenze

Manifest v3 bindet den Config-Digest. Operator, Stage und Release-State verlangen zugleich exakt diesen Wert im `candidate-images.json`-Compose-Override. Image-Load prüft ihn direkt per Docker-Inspect; Preflight und Verify vergleichen den Containerwert `.Image` direkt damit. Der echte Docker-29/containerd-Store adressiert diese geladenen Images dagegen über den OCI-Index. Seine Config-Blobs sind unverändert vorhanden.

Ein Diagnose-Override mit den aus den gebundenen Archiven belegten Index-Digests wird trotz konsistenter Artefakt- und Manifest-Hashes an der bestehenden Config-Gleichheit fail-closed abgewiesen. Der vorhandene Archivprüfer weist auch die jeweils falsche Config-ID für beide realen Archive ab. Dies sind Diagnose-/Negativbelege, kein RED/GREEN eines neuen Produktfixes.

Vor jeder Consumer-Änderung ist die beabsichtigte Bindungsrelation für Override und Runtime festzulegen. Kein Teilfix, keine alternative Identitätsakzeptanz, kein Tagvertrauen und keine neue Recovery-Architektur wurden implementiert. Die bisherige Python-/Vitest-Verifikation gehört zu P3.1B und wurde hier nicht erneut als frischer Testlauf ausgegeben.
