# Infrastruktur-OCI-Bindung – lokaler Implementierungsstand 2026-10-11

Basis: `0f015c46623233256f8a139ad4f19af9ff80ea7f`. Migrationsprodukt weiterhin
`9ce4fbc96a5dd877f2cd2f00588a22be861306b9`, PostgreSQL17.9, Schema3.
Unabhängiger Delta-Review und exakte CI-Annahme bleiben offen.

## Beobachtung und Korrektur

Docker/containerd exportierte bei den offiziellen PG-/Edge-Images den originalen
Multiplattformindex sowie die vorhandene amd64-Kette und deren Attestation.
Fremdplattformblobs fehlen. Der Basisvalidator lehnt bereits die Annotationen des
Runnable-Manifests ab; ein bloßes Hinzufügen der Index-ID zum Digestvergleich würde
die erforderliche Relation nicht beweisen.

`inspect_infrastructure_archive` verlangt stattdessen die exakt gepinnte Indexwurzel
als einziges exportiertes Rootobjekt, genau ein linux/amd64-Manifest, dessen Config
und sämtliche Layer. Alle vorhandenen benötigten Deskriptoren werden nach Größe und
SHA-256 geprüft; Docker-Legacy-Config und Layerliste müssen dieselbe Kette benennen.
Mitgelieferte amd64-Attestationen bleiben vollständig bytegeprüft. Ausschließlich
fehlende, explizit fremde Linuxzweige und ihre eindeutig zugeordneten Attestationen
erscheinen als `unverifiedDescriptors`; das ist keine Verifikation ihrer Bytes.
Unbekannte zusätzliche Dateien, fehlende benötigte Bytes und Drift bleiben Fehler.
Der eigene App-v4-Pfad erhält diese Ausnahme nicht.

Bootstrap prüft die aus dem Originalexport bekannten Wurzel/M/C-Tripel zusätzlich
zur Archivkette. Der spätere Infrastruktur-Load verwendet `--platform linux/amd64`;
App-v4 behält den bisherigen Aufruf. Docker muss die ursprüngliche Indexreferenz und
die plattformqualifizierte Auflösung derselben Referenz auf M bestätigen. Der
Load-Beleg trägt Archiv-/Exportindex-/Wurzel-/M-/C- und Eingabepaketbindungen sowie
ungeprüfte Deskriptoren. Vor PG-Start werden Beleg und aktuelle Beobachtung erneut
geprüft. Die laufende PostgreSQL-Instanz muss `.Image=Index` und
`ImageManifestDescriptor.digest=M` zeigen; Instanz-/Mount-/Isolation-Gates bleiben.

## Lokale Belege und Grenzen

- Basissynthetik RED: gültiger offizieller amd64-Export wurde abgewiesen; falscher
  PostgreSQL-M-Descriptor wurde fälschlich akzeptiert. Zwei echte Assertions rot.
- Plattform-Load RED: Infrastrukturaufruf ohne explizites linux/amd64 wurde vom
  Kommandovertrag abgewiesen; danach GREEN.
- 98 gezielte Python-Tests: Infrastruktur9, target02 23, Operator57, App-v4 9.
  App-v4 wird durch unittest discovery tatsächlich ausgeführt; die Datei allein
  besitzt keinen unittest-main-Einstieg.
- 111 gezielte Vitest-Tests in acht bestehenden Catering-Target-Dateien bestanden
  mit Node22.23.3/Vitest4.1.11. Der erste Lauf mit älteren gemeinsam vorhandenen
  Vitest3.2.6-Abhängigkeiten hatte trotz 111 bestandener Assertions einen RPC-Timeout
  und Exit1; dieser Lauf ist kein Annahmebeleg. Der erneute Lauf mit aktuellen
  vorhandenen Abhängigkeiten und einem Worker endet mit Exit0. Keine Installation.
- Originalarchiv-RED auf Basisvalidator: beide abgewiesen. GREEN über den echten
  Bootstrap-Infrastrukturvalidator: PG14/Edge12 ungeprüfte Fremddeskriptoren,
  benötigte amd64-Ketten vollständig geprüft. Vorher-/Nachher-SHA und Größen identisch.
- PG-Archiv A `10a7ca7c89c41819d7517319d97c6c71b95d76358a18a2636e0f6b829a20c1f3`,
  110387571 Bytes. Edge-A `d9fc54b8b15b79af9d70d9d9aa55831b01ebbf499d9d7e95dccb0a790c990927`,
  23889320 Bytes. Wurzel/M/C stehen im Operationsdokument.
- Geschützte lokale Kommando-/Exit-/Outputbelege außerhalb Git:
  `~/.codex/private/cateringos-infra-oci-fix-20261011/`.

Synthetische Dockerantworten testen den Aufruf- und Ablehnungsvertrag, keinen realen
Load. Kein Hostkontakt, Dockeraufruf, Build/Pull/Export, Paketbau oder Hostinstallation.
Originalarchive, historisches P4-Bundle und vorhandenes target02-Manifest
`26362122f5d18eaca22d74cc0dffe73213cff8cb60cbf8d946efeca6c75f4700` bleiben unverändert.
Eine spätere neue Operationsversion benötigt eine eigene reguläre Paketbindung.
Das führende lokale Migrationsrunbook bleibt außerhalb dieses Implementierungsdiffs.
