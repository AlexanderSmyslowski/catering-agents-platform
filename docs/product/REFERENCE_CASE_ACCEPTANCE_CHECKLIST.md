# Referenzauftrag: Produktionsgrundlage und Küchenabnahme

Status: `blocked` für den vorhandenen Köpff-Referenzanker; keine Produktions- oder Pilotfreigabe.

Stand: 2026-08-16

## Zweck und Grenze

Dieses Dokument ist eine nicht-sensitive Abnahme-Checkliste für einen bereits
vorhandenen synthetischen/anonymisierten Referenzkorridor. Es erzeugt keinen
neuen Kundenfall, keine Quell-PDF und keine Rezept- oder Preisdaten. Ein
`ready`-Ergebnis darf nur aus belegten Artefakten und einer ausdrücklichen
menschlichen Küchenabnahme entstehen.

Der maschinenlesbare Vertrag liegt in
`shared-core/src/production-reference-acceptance.ts`; der fokussierte Beleg
liegt in `tests/production-reference-acceptance.test.ts` sowie im
Persistenzpfadtest `tests/production-reference-persisted-acceptance.integration.test.ts`.
Der Evaluator akzeptiert ohne einen resolver-ausgestellten Evidence-Token
keine Abnahme; die Integration zeigt die minimale bestehende Offer-/Audit-
Grenze, an der die unveränderlichen IDs gekreuzt werden.

## Vorhandene, zulässige Evidenz

- `tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json`
  enthält nur die Fallkennung, einen erwarteten Quellhash, anonyme
  Komponentenlabels und erlaubte offene Fragen. Es enthält keine PDF-Bytes,
  Kundendaten oder Providerantworten.
- `shared-core/src/fixtures/llm-readiness-eval-fixtures.ts` enthält einen
  synthetischen Flying-Buffet-Evaluationsanker mit deaktivierten Provider- und
  Schreibwirkungen.
- `data-seeds/recipes-koepff/` enthält elf transkribierte Rezeptkarten. Ihre
  `approvalState` ist `review_required`; sie sind daher keine freigegebene
  Produktionswahrheit.
- Die bestehenden Referenz-, Produktionsplan-, Einkaufslisten- und
  Exporttests belegen Teilverträge, aber keinen vollständigen persistierten
  Köpff-Durchlauf von Quelle bis Küchenabnahme.

## Aktueller Befund

Der Köpff-Referenzanker bleibt bewusst `blocked` beziehungsweise
`not_assessed`. Es fehlen mindestens:

1. ein im Repo vorhandenes, zum Erwartungshash passendes Quellartefakt oder
   ein separat freigegebener synthetischer Quellanker;
2. eine serverseitig belegte Event-/Angebots-/Handoff-Kette für genau diesen
   Fall;
3. eine verifizierte Preisbasis. Das aktuelle Modell trägt einen
   Modulkatalog-/Arbeitsband-Schätzwert, aber keine vollständige
   Zutaten-, Personal-, Logistik-, Equipment- und Margenkalkulation;
4. fachlich freigegebene Rezepte und bestätigte Allergen-/Diet-Status für
   jede erforderliche Komponente;
5. ein vollständiger Produktionsplan mit skalierten Mengen und eine
   Einkaufsposition für jede verwendete Zutat;
6. eine menschliche Küchenabnahme mit Operator, Zeitpunkt und der expliziten
   Bestätigung, dass kein paralleler GPT-Rettungschat nötig war.

Keiner dieser Punkte wird aus einer Annahme, einem Mock-Provider oder einer
Test-ID abgeleitet. Es gibt deshalb in diesem Turn keine Behauptung eines
belastbaren Köpff-Produktionsdokuments.

## Abnahme-Checkliste für den nächsten belegten Lauf

- [ ] Quellfallkennung stimmt mit der Erwartung überein.
- [ ] Originale beziehungsweise ausdrücklich freigegebene synthetische
      Bytes wurden gelesen; der SHA-256-Hash stimmt exakt.
- [ ] Nicht-sensitive Quellen-/Provenienzreferenz ist serverseitig gebunden.
- [ ] Ein explizit validierter Evidence-Token bindet Quellfall, Angebot,
      Event-Spec, ApprovalRequest, unveränderlichen Handoff sowie die
      zugehörigen Audit-IDs; caller-supplied Strings allein gelten niemals als
      Nachweis.
- [ ] Angebot besitzt eine dokumentierte Preisbasis aus dem aktuellen Modell;
      Preis-, Steuer-, Allergen-, Hygiene-/Temperatur- und Quellenstatus sind
      `verified`, bevor eine Produktionsfreigabe behauptet wird.
- [ ] `full_cost_model` wird erst nach einer tatsächlich vollständigen
      Kostenaufschlüsselung verwendet; das aktuelle Modell blockiert diesen
      Anspruch weiterhin.
- [ ] Unveränderlicher Handoff verweist auf denselben Event-/Spec-Kontext.
- [ ] Produktionsplan ist `complete`, ohne Fallback, ungelöste Punkte oder
      Blocking-Issues.
- [ ] Jede erforderliche Komponente ist `operational` und besitzt Batch,
      Küchenkarte und Einkaufsabdeckung.
- [ ] Die Readiness-Zeilen entsprechen bidirektional und ohne Duplikate genau
      allen Batch- und Küchenblatt-Komponenten.
- [ ] Jede skalierte Zutat erscheint mit positiver Einkaufsmenge und
      Rezeptprovenienz in der Einkaufsliste.
- [ ] Alle Zutaten- und Einkaufslistenmengen sind endlich, positiv und mit
      einer nichtleeren Einheit belegt.
- [ ] Jedes verwendete Rezept ist `approved_internal` oder `auto_usable`;
      Allergene und Diet-Tags sind explizit vorhanden.
- [ ] Jede Küchenkarte enthält Menge, Station, Vorbereitungsfenster,
      Zutaten und Arbeitsschritte beziehungsweise einen belegten
      Beschaffungsweg.
- [ ] Eine menschliche Küchenperson zeichnet die Abnahme mit Name/Operator
      und Zeitpunkt ab.
- [ ] `rescueChatUsed` ist ausdrücklich `false`; offene Punkte werden als
      Blocker oder Rückfrage dokumentiert, nicht mündlich überbrückt.
- [ ] Malformed Runtime-Evidence erzeugt einen deterministischen Blocker und
      keinen Parser-/TypeError.

## Nicht aus dieser Checkliste ableitbar

Ein grüner maschinenlesbarer Vertrag wäre nur ein interner, kontrollierter
Abnahmenachweis. Er ist keine Freigabe für echte Kundendaten, produktive
Migration, Deployment, externe Nutzung, automatische Preis-/Margenfreigabe,
Allergenfreigabe oder rechtssichere Compliance.
