# Local Subscription Runtime

Ziel: Die Catering-App kann lokal als leerer Operator-Arbeitsplatz laufen und
nutzt den vorhandenen ChatGPT-Subscription-Login ueber den Codex-CLI-Adapter.
Abnahme:
1. Der CLI-Transport ignoriert private Codex-Konfigurationen; ein lokaler
   Modell-Pin oder MCP darf die reine Inferenz nicht beeinflussen.
2. `npm run local:start:subscription` prueft CLI und Login vor dem Start und
   startet ohne Demo-Seeding mit explizitem draft-only Provider-Opt-in.
3. Ein realer synthetischer Adapter-Aufruf liefert ueber `codex_cli` einen
   schema-validen Entwurf; keine Kunden- oder Live-Daten werden verwendet.

Grenzen: Kein API-Key, kein Server-CLI-Login, keine automatische Freigabe,
keine Produkt-Schreibwirkung durch den Provider.
