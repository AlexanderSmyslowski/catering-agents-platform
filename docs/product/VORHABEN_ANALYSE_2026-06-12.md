# Tiefergehende Vorhaben-Analyse: catering-agents-platform

Stand: 2026-06-12, main @ 65565cb. Datenbasis: volle Git-Historie (1.018 Commits), GitHub-PR-Statistik (`gh`, 482 PRs), Zeilenzählung auf der Platte, Testlauf. Methodik in Anhang B.

> Hinweis (2026-06-13): Nach Berichtsstand wurde der Uni-Rahmenvertrag-Datenlayer gemergt (`1aebd6d`, Merge `92259af`) — die Datengrundlage für Slice 8 liegt damit bereits auf main. An den Befunden ändert das nichts (u. a. `*-state.ts`-Zählung jetzt 59 statt 58).

---

## Management-Zusammenfassung

**Das Vorhaben hat in 13,5 Wochen einen brauchbaren, gut getesteten Produktkern hervorgebracht — aber zu einem schlechten Kurs: Auf jede Zeile Produktcode kamen ~1,2 Zeilen Doku/Prozess-Artefakte.** 38 % aller geschriebenen Zeilen sind Governance und Doku (Spitze im Mai: 51.460 Doku-Zeilen in einem Monat), und allein `docs/agent-memory/` ist mit 4,7 MB größer als der gesamte Produktcode. Der Beta-Haltepunkt vom 10.06. war richtig.

**Die fünf wichtigsten Aussagen:**

1. **Der Produktkern trägt.** Schemas (JSON Schema 2020-12, versioniert, strikt), Regelwerk (Pricing, Einkauf, Skalierung), Taxonomien und die geerdeten Daten (13 Pakete mit echten Preisbändern, 11 Köpff-Rezepte, Metro-Warengruppen) sind das werthaltige Fundament — gerade *weil* sie deterministisch sind. Der Regex-Intake (300 Zeilen) ist Wegwerf-Gerüst, aber sauber isoliert und als Eval-Baseline für den LLM-Pfad weiter nützlich.
2. **Ballast ist identifiziert und größtenteils inert.** Das llm-readiness-Gerüst (18 Module, 2.772 Zeilen, pa26–pa42) ist 4× so groß wie die eigentliche BYO-LLM-Runtime (689 Zeilen). Nichts davon muss sofort gelöscht werden — es darf nur nicht weiter wachsen.
3. **Strategische Weiche: Uni-Konfigurator VOR der UI-Konsolidierung** — aber als eigenes, schmales Frontend, nicht als Ausbau der Backoffice-UI. Dann blockiert die Konsolidierung (148 Dateien, 58 `*-state.ts`-Splitter) den Konfigurator nicht, und sie wird später von echter Reibung priorisiert statt von Ästhetik.
4. **LLM-Reihenfolge nach Risiko:** zuerst Batch-Klassifikation der 916 Altangebote (offline, risikofrei, baut Eval-Daten), dann Intake-Extraktion im Schattenmodus gegen die Regex-Baseline, dann Mengenlogik-Fachurteile (draft-only), zuletzt kundensichtbare Angebotstexte.
5. **Nächster Schritt ist kein Code.** Wie am 10.06. festgehalten: Erst muss ein Mensch (Alexander) den synthetischen Flow einmal selbst durchlaufen (Operator-Probe). Jede weitere Investition ohne diesen Realitätskontakt verlängert nur die Selbstbeschäftigungsphase.

---

## 1. Aufwand-Ertrag-Bilanz

### Rohzahlen

| Kennzahl | Wert |
|---|---|
| Zeitraum | 10.03.–12.06.2026 (13,5 Wochen) |
| Commits | 1.018 (März 45 · April 201 · **Mai 535** · Juni 237) |
| PRs | 482 — 478 gemergt, 3 geschlossen, 1 offen |
| PR-Durchsatz | ~40 PRs/Woche |
| PR-Größe | Median 136 Zeilen, Mittel 236, Max 12.029 |
| Zeilen-Additions gesamt | ~182.000 |

Der eine offene PR ([#48](https://github.com/AlexanderSmyslowski/catering-agents-platform/pull/48), „Clarify blocked production status", offen seit 21.04.) ist stale und sollte geschlossen oder neu bewertet werden.

### Verteilung der Additions über die volle Historie

| Bereich | Additions | Anteil |
|---|---|---|
| Produktcode (UI, shared-core, 4 Services, Print) | ~57.700 | **32 %** |
| Tests | ~45.600 | 25 % |
| Doku & Prozess (docs/, memory.md, .codex/, Root-Doku) | ~68.200 | **38 %** |
| Scripts, Infra, Seeds, Config | ~10.300 | 5 % |

Monatsverlauf der Additions (Produkt / Tests / Doku): März 13,7k/2,8k/0,3k → April 5,6k/3,1k/8,9k → **Mai 21,9k/24,3k/51,5k** → Juni 16,5k/15,3k/4,9k. Der April war der Kipppunkt (Doku überholt Produkt), der Mai die Eskalation. Der Juni zeigt, dass der Kurswechsel (Sanierungs-Slices) gewirkt hat: Doku-Anteil von 52 % auf 11 % gefallen.

### Bestand heute

- Produktcode: ~33.800 Zeilen (backoffice-ui 14.049 · shared-core 11.721 · production-service 5.224 · intake 1.214 · print-export 965 · offer 604)
- Tests: 38.460 Zeilen, **255 Dateien / 1.073 Tests, alle grün in 14,4 s** — nach Löschung der 73 Doku-Tests prüft die Suite jetzt überwiegend Verhalten
- Doku: 60.715 Zeilen / 231 Markdown-Dateien, davon `docs/agent-memory/` allein 4,7 MB (78 Dateien)
- Lokale Daten (`data/`, 1.029 Dateien, u. a. die 916 Angebote): korrekt **nicht** in Git

### Bewertung

Der Ertrag ist real: lauffähige Kette Intake → Angebot → Produktionsplan → Mappen-Export, geerdet mit echten Preisen und Rezepten, plus eine saubere BYO-LLM-Schiene. Aber der Kurs war teuer: 38 % Doku-Anteil ist für ein Zwei-Personen-Produkt das Drei- bis Vierfache des Vertretbaren. **Empfehlung:** `docs/agent-memory/` einfrieren (kein neuer Inhalt; bei Gelegenheit in ein Archiv-Verzeichnis oder aus dem Repo verschieben) und als Workflow-Regel festschreiben: Doku-Zeilen pro PR dürfen Produkt+Test-Zeilen nicht übersteigen, außer der PR ist explizit ein Doku-PR.

---

## 2. Tragfähigkeit des Produktkerns

**Urteil: Fundament, nicht Wegwerf-Gerüst — mit einer klar abgegrenzten Wegwerf-Zone.**

### Werthaltig (behalten, darauf bauen)

- **Schemas** (`shared-core/src/schemas/`, 8 Module): handgeschriebenes JSON Schema draft 2020-12, `$id`-versioniert, `additionalProperties: false`. Provider-neutral — exakt das Format, das jeder LLM-Structured-Output-Pfad (OpenAI wie Anthropic) als Contract braucht. Das ist der wichtigste Einzelbaustein für den LLM-Ausbau.
- **Rules** (`shared-core/src/rules/`: pricing, purchasing, scaling, offer, readiness, normalization, curated-offer-selection; zusammen mit Schemas ~2.500 Zeilen): deterministische Geschäftslogik, die ein LLM *nicht* übernehmen soll. Preisbänder, Skalierungsfaktoren, Einkaufslogik bleiben Code; das LLM liefert künftig nur Eingaben und Urteile, die durch diese Regeln laufen.
- **Geerdete Daten:** 13 kuratierte Pakete mit `price_band_pp`/`min_pax`/Modulen (aus 916 echten Angeboten destilliert), 11 Köpff-Rezeptkarten, 12 Metro-Warengruppen. Das ist das eigentliche Asset — Domänenwissen, das kein Wettbewerber und kein Modell mitbringt.
- **BYO-LLM-Runtime** (689 Zeilen): model-blind, drei Provider, draft-only mit Pflicht-Freigabe. Kleine, richtige Abstraktion.
- **Infra:** Docker Compose + Caddy + Hetzner-Deploy-Skript — ausreichend für Jahre.

### Wegwerf-Zone (ersetzen, wenn der LLM-Pfad reift — nicht vorher)

- **`intake-signals.ts`** (300 Zeilen deutsche Regex-Heuristiken für Datum/Uhrzeit/Personenzahl/Unsicherheiten): sauber isoliert hinter der `IntakeSignals`-Schnittstelle. Zweitverwertung: als **deterministische Baseline im Eval-Harness** für die LLM-Extraktion — „LLM muss mindestens alles finden, was die Regex findet". Erst löschen, wenn der LLM-Pfad die Baseline dauerhaft schlägt.

### Ballast (einfrieren, nicht ausbauen)

- **llm-readiness-Gerüst:** 18 Module / 2.772 Zeilen + 17 Testdateien (pa26–pa42) — viermal so groß wie die Runtime, die es absichern soll. Behalten: Eval-Harness, Prompt-Schema-Registry, Draft-Registry (werden im Ausbau gebraucht). Einfrieren: Policy-, Audit-, Preflight-, Mini-Pilot-Module. Keine neuen pa-Nummern.
- **Vier Microservices** für einen Zwei-Personen-Betrieb sind architektonischer Overhead, aber bereits bezahlt und per Compose beherrschbar. Nicht zusammenlegen (Aufwand ohne Ertrag), aber auch **keinen fünften Service** anlegen — neue Fähigkeiten gehören in bestehende Services oder shared-core.

---

## 3. LLM-Ausbaupfad

Reihenfolge nach Risiko (intern → extern) und danach, was jede Stufe für die nächste liefert:

1. **Batch-Klassifikation der 916 Altangebote** (API-Schiene, offline). Kein Nutzer betroffen, kein Freigabe-Workflow nötig, Ergebnis ist prüfbar gegen die 13 manuell destillierten Pakete. Liefert: Validierung der OpenAI-Transportschiene unter Last, ein gelabeltes Eval-Korpus, und vermutlich Korrekturen/Erweiterungen am Portfolio (Pakete 14+, Preisband-Drift über Jahre). Aufwand klein: Script über `byo-llm-runtime` + `offer-draft`-Schema.
2. **Intake-Extraktion im Schattenmodus.** LLM extrahiert `IntakeSignals` parallel zur Regex; UI zeigt weiterhin Regex-Ergebnis, Abweichungen werden geloggt. Die bestehenden Intake-Tests + Regex-Baseline sind das fertige Eval. Umschalten erst, wenn die Abweichungsquote über echte Anfragen hinweg überzeugt.
3. **Mengenlogik-Fachurteile für die Produktionsmappe** (draft-only, Pflicht-Freigabe — exakt die Mechanik der Rückfragen-Entwürfe). Das LLM schlägt Mengenanpassungen mit Begründung vor; die Skalierungs-*Rechnung* bleibt in `rules/scaling.ts`. Hoher Nutzwert für Ronak/Alexander, Risiko durch Freigabe gedeckelt.
4. **Angebotstexte** zuletzt: kundensichtbar, höchstes Reputationsrisiko, und profitiert von allem davor (klassifiziertes Portfolio als Stilkorpus, erprobte Freigabe-UI).

Querschnitt: jede Stufe nutzt dieselben drei Bausteine — Schemas als Output-Contract, Eval-Harness, draft-only-Freigabe. **Keine neue Infrastruktur bauen;** sie existiert.

---

## 4. UI-Reifegrad und die Konfigurator-Weiche

### Befund

- 148 TS/TSX-Dateien, davon **58 `*-state.ts`-Splitterdateien**; `App.tsx` mit 619 Zeilen und 10 `useState`-Hooks als Verteilerknoten; Routen-Zustand handgerollt (`app-*-route-state`, `app-*-boundary`) statt Router; kein Design-System, keine Komponentenbibliothek.
- Abstand zu „Apple-like" (absteigend nach Wirkung): (1) konsistentes Typografie-/Abstands-/Farbsystem mit wenigen Tokens, (2) durchgestaltete Leer-, Lade- und Fehlerzustände, (3) Reduktion der sichtbaren Komplexität pro Screen (eine Hauptaktion je Ansicht), (4) Mikro-Feedback (Übergänge, Bestätigungen). Erst danach lohnt Feinschliff.
- **Auth ist faktisch nicht vorhanden:** `access-control.ts` (224 Zeilen) ist ein Rollen-Stub mit Default-Actor-Namen, ohne Sessions, Tokens oder Login. Für interne Beta auf eigener Infrastruktur tragbar; für externe Uni-Nutzer ein harter Blocker.

### Entscheidung: Konfigurator vor Konsolidierung

**Empfehlung: Den Uni-Konfigurator zuerst bauen — als eigenes, schmales öffentliches Frontend, nicht als Erweiterung der Backoffice-UI.** Begründung:

- Der Konfigurator braucht aus dem Bestand nur die offer-API mit den 13 Paketen und die shared-core-Schemas — nicht eine einzige der 148 Backoffice-Dateien. Die Konsolidierung ist für ihn schlicht nicht auf dem kritischen Pfad.
- Ein Neubau auf grüner Wiese (eine Seite, ein Formularfluss, ~10–15 Komponenten) ist der billigste Ort, das Design-Token-System zu etablieren, das die Backoffice-UI später übernimmt. Die Konsolidierung bekommt damit eine Vorlage statt einer Theorie.
- Die Backoffice-Konsolidierung sollte von echter Nutzungs-Reibung (Phase A, Abschnitt 6) priorisiert werden, nicht vor dem ersten Nutzer stattfinden.

Konsequenz für Auth: Der Konfigurator braucht **kein** Nutzerkonten-System. Es reicht: öffentlicher, lesender Konfigurations-Flow ohne Login; Absenden der Anfrage erzeugt einen Intake-Datensatz; Schutz über Rate-Limit + Caddy-Routen-Trennung (public Pfad → nur die zwei benötigten Endpunkte) + Spam-Hürde (z. B. E-Mail-Bestätigungslink). Echte Authentifizierung wird erst nötig, wenn Externe *gespeicherte Vorgänge wieder öffnen* sollen — das ist bewusst NICHT Teil von Slice 5.

---

## 5. Workflow-Effizienz: Lessons aus dem Claude→Codex→Verify-Loop

Was die Zahlen sagen: 40 PRs/Woche bei Median 136 Zeilen — die ≤4000-Zeichen-Guardrail mit 2–3 Abnahmepunkten hat kleine, prüfbare Einheiten erzwungen und funktioniert. Aber der Loop hat unbeaufsichtigt 38 % seiner Leistung in Selbstdokumentation gesteckt — der Mai (535 Commits, 51k Doku-Zeilen) ist das Lehrstück.

Konkrete Lessons, übertragbar auf ADH/Agent Desk:

1. **Tool-Selbstauskunft ist kein Fakt.** Codex kannte die Flags seiner eigenen CLI falsch (`--ask-for-approval`, Commit 6ee14e0). Regel: Jede Behauptung eines Agents über ein Werkzeug wird durch einen realen Aufruf belegt; „Befehl wurde ausgeführt, Output liegt bei" gehört als Abnahmepunkt in den Prompt.
2. **Abnahmepunkte müssen die Wurzel benennen, nicht das Symptom.** Der Tarte-Fix wurde als Sonderfall am Symptom verklebt, weil der Abnahmepunkt nur das sichtbare Fehlverhalten beschrieb. Regel: Abnahmepunkt-Formulierung „X funktioniert für die Klasse von Fällen Y", nie „der konkrete Fall Z ist grün".
3. **Verifikation misst Verhalten, nie Artefakt-Existenz.** Die 73 gelöschten Doku-Tests waren grüne Lampen ohne Lampe dahinter. Regel: Ein Test, der eine Markdown-Datei prüft, ist kein Test.
4. **Prozess-Output deckeln, nicht verbieten.** Agenten dokumentieren exzessiv, wenn Doku der billigste Weg ist, „Fortschritt" zu zeigen. Wirksamer als Verbote: ein hartes Budget (Doku-Zeilen ≤ Produkt+Test-Zeilen pro PR) und ein Mensch, der den Takt vorgibt (der Beta-Haltepunkt tut genau das).
5. **Der Mensch gehört an die Slice-Grenzen, nicht in die Slices.** Die sechs Sanierungs-Slices mit je vorab benannten Abnahmepunkten waren der produktivste Modus des Projekts (Juni: Doku-Anteil 11 %). Das Muster — Mensch definiert Slice + Abnahme, Agent implementiert, Mensch nimmt ab — ist das Exportprodukt für Agent Desk.

---

## 6. Roadmap zur ersten echten Nutzung

### Phase A — Realitätskontakt (jetzt, ~1–2 Wochen, fast kein Code)

1. **Operator-Probe** (vereinbart, steht aus): Alexander führt den synthetischen Flow Intake → Angebot → Plan → Mappen-Export einmal vollständig selbst durch; Artefakt ist eine Reibungs-Notiz, kein PR.
2. **Deploy auf Hetzner** mit dem vorhandenen `platform-infra` (Compose + Caddy + Deploy-Skript sind fertig; nur `.env` füllen und Smoke-Check fahren).
3. **Eine echte Anfrage parallel fahren:** Die nächste reale Kundenanfrage zusätzlich zu rechner.commcats.de durch die Plattform schieben; Ronak bekommt die Produktionsmappe aus dem System statt aus der Word-Vorlage.
4. Danach: **nur Fixes aus dokumentierter Reibung.** Stale-PR #48 schließen oder neu bewerten.

### Phase B — LLM-Nutzen heben (nach erster echter Mappe)

5. Batch-Klassifikation der 916 Angebote (Abschnitt 3, Stufe 1).
6. Intake-Schattenmodus (Stufe 2).
7. Mengenlogik-Fachurteile draft-only (Stufe 3) — erst wenn Ronak die Mappe real nutzt, sonst fehlt der Abnehmer des Nutzens.

### Phase C — Uni-Konfigurator (Slice 5)

8. Schmales öffentliches Frontend unter the-one.catering (Abschnitt 4): Paket wählen → Personenzahl/Datum/Optionen → Anfrage absenden → Intake-Datensatz. Design-Tokens hier etablieren.
9. Public/intern-Trennung in Caddy + Rate-Limit + E-Mail-Bestätigung. Kein Login, keine Konten.

### Phase D — Konsolidierung (nur reibungsgetrieben)

10. Backoffice-UI konsolidieren entlang der Schmerzpunkte aus Phase A/C, mit den Konfigurator-Tokens als Vorlage; `*-state.ts`-Splitter zu Routen-Modulen zusammenziehen, Router einführen.

### Ausdrücklich NICHT bauen

- **Keine UI-Konsolidierung vor dem Konfigurator** (Begründung Abschnitt 4).
- **Kein Nutzerkonten-/Login-System** für Slice 5; keine Multi-Tenancy, kein Mandantenmodell.
- **Keine weiteren llm-readiness-/Governance-Module**, keine neuen pa-Gates, kein Wachstum von `docs/agent-memory/`.
- **Kein fünfter Service**, keine Zusammenlegung der vier bestehenden.
- **Kein DOCX-Export**, solange die HTML-Mappe für Ronak druckbar ist.
- **Kein eigenes Design-System** als Vorab-Projekt — Tokens entstehen im Konfigurator nebenbei.
- **Keine weiteren Provider** in der BYO-Schiene, bevor einer produktiv genutzt wird.

---

## Anhang A — Priorisierte Slice-Liste

| # | Slice | Phase | Aufwand | Abhängigkeit |
|---|---|---|---|---|
| 1 | Operator-Probe + Reibungs-Notiz | A | Stunden (Mensch) | — |
| 2 | Hetzner-Deploy + Smoke | A | klein | — |
| 3 | Erste echte Anfrage end-to-end, Mappe an Ronak | A | klein | 2 |
| 4 | Reibungs-Fixes aus 1–3 (gebündelt) | A | klein–mittel | 1–3 |
| 5 | Batch-Klassifikation 916 Angebote (OpenAI-Schiene) | B | klein | — (lokales Offline-Script, braucht keinen Deploy) |
| 6 | Intake-Schattenmodus LLM vs. Regex-Baseline | B | mittel | 5 |
| 7 | Mengenlogik-Fachurteile draft-only in der Mappe | B | mittel | 3 |
| 8 | Uni-Konfigurator: öffentliches Frontend + Intake-Anbindung | C | mittel | 2 |
| 9 | Public-Routing, Rate-Limit, E-Mail-Bestätigung | C | klein | 8 |
| 10 | Backoffice-Konsolidierung (reibungsgetrieben, Tokens aus 8) | D | groß | 4, 8 |
| 11 | Intake-Umschaltung Regex→LLM (wenn Baseline geschlagen) | D | klein | 6 |
| 12 | Angebotstexte LLM-gestützt (draft-only) | D | mittel | 5, 7 |

## Anhang B — Zahlenbasis und Methodik

- Commits/Monatsverteilung: `git log` über die volle lokale Historie (nicht shallow; 1.018 Commits, 2026-03-10 bis 2026-06-12).
- PR-Statistik: `gh pr list --state all --json …` (482 PRs, Additions/Deletions je PR).
- Bereichs-Verteilung: `git log --numstat`, Additions je Top-Level-Pfad aggregiert; „Doku & Prozess" = `docs/` + `memory.md` + `.codex/` + Root-Markdown (README, AGENTS, TESTING, HANDOFF, START_HERE, memory_current).
- Bestandszahlen: `wc -l`/`find` auf der Platte, `node_modules` ausgenommen; `data/` (1.029 Dateien) ist nicht in Git getrackt und in keiner Historienzahl enthalten.
- Testlauf: `npx vitest run` am 2026-06-12 — 255 Dateien, 1.073 Tests, grün, 14,4 s.
- Titel-basierte PR-Klassifikation wurde geprüft, aber wegen Mehrdeutigkeit (100 von 482 unklar) verworfen; die Pfad-basierte Zeilenmetrik ist die belastbare Quelle für die 32 %/38 %-Aussage.
