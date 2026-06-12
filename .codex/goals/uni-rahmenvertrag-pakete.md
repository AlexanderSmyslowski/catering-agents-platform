# Uni-Rahmenvertrag-Pakete

- Branch: `feat/uni-rahmenvertrag-pakete`
- Ziel: sechs Uni-Rahmenvertrag-Pakete als Shared-Core-Datenschicht.
- Quelle: `docs/product/UNI_RAHMENVERTRAG_ANFRAGE_PAKETE_2026-06-12.md`, Abschnitt 4.
- Quelle nur lesen; `docs/product/*.md` nicht committen.
- Neu: `shared-core/src/fixtures/uni-request-packages.json`.
- Neu: `shared-core/src/rules/uni-packages.ts`.
- Test: `tests/uni-packages.test.ts`.
- Keine UI-, Service-, Persistenz- oder Dependency-Aenderung.
- Abnahme: Auswahl A, Nebenkosten B, komplette Vitest-Suite C.
- Am Ende Draft-PR, nicht mergen.
