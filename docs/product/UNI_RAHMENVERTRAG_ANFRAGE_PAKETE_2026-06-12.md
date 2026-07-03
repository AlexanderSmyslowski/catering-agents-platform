# Typische Anfrage-Pakete: Uni-Rahmenvertrag Heidelberg

Stand: 2026-06-12. Zweck: Vorlage für den Uni-Konfigurator auf the-one.catering (Slice 8) — die Rahmenvertragspartner der Uni Heidelberg sollen sich typische Anfragen selbst zusammenklicken können, statt dass jedes Angebot manuell geschrieben wird.

**Datenbasis:** GDrive `Geteilte Ablagen/THE ONE/Angebote/` — Uni-Rahmenvertrag **2025 (123 PDFs, ~45 Institute, ab Vertragsstart April 2025) + 2026 (64 PDFs, 27 Institute)**, dazu als Vergleichskorpora Business 2025+2026 (172 PDFs) und Privat 2025+2026 (33 PDFs); insgesamt ~390 PDFs / 388 bepreiste Catering-Positionen, per `pdftotext` extrahiert und nach Kostenübersichts-Positionen geclustert. Alle Preise netto. Methodik in Anhang B.

---

## 1. Befund: Der reale Baukasten

Jedes Rahmenvertrags-Angebot folgt demselben Aufbau:

1. **Konzept-Brief** (persönliche Ansprache, Ronak)
2. **Ablaufplanung** mit Personalstunden-Tabelle
3. **Leistungsmodule** (Conference-Getränke, Coffee Breaks, Lunch, …)
4. **Kostenübersicht** mit festen Querschnittspositionen:
   - Transport/Anlieferung: 50–150 € pro Fahrt (Großevents bis 625 €)
   - Personal: **45,55 €/h** (einheitlich in allen Angeboten)
   - Buffetinfrastruktur: Pauschale 150–300 € (oft „Sonderkondition")
   - Tischwäsche/Duni: ~60 €
   - Geschirr/Besteck: oft inkludiert („Welcome Goodie")

Die Personenzahlen liegen typisch bei **20–130 Pax** (Ausreißer: 11 Gutachter bis 500 Sommerschule). Häufigster Veranstaltungstyp ist die ein- bis mehrtägige Tagung/Seminar mit Kaffeepausen und Lunch.

## 2. Die sechs Anfrage-Pakete (Konfigurator-Vorschlag)

| # | Paket | €/P netto | Pax | Evidenz (Institute 2025+2026) |
|---|---|---|---|---|
| U1 | **Conference-Getränke ganztägig** | 7–12 | ab 15 | Herzchirurgie, Studierendenadmin., Urologie, Mathematikon, CAPAS (9,50), HCTS '25 (7,50) — in fast jedem Angebot als Basismodul |
| U2 | **Kaffeepausen-Paket** (Getränke + Coffee Break I/II) | 12,50–19,90 | ab 15 | 2026: Kirchhoff (10), Datenethik (12,50–15,50), Mathematikon (13), Theor. Physik (13,80), Juristen (14,50–24,50), Office Structures/Urologie (19,90) · 2025: Median 14,95 über 28 Positionen (7–29) |
| U3 | **Quick Lunch** (kalt/einfach warm) | 6,50–18 | 12–500 | 2026: HCTS (6,50–9), BZH (10–11,50), Urologie (17–21), Alfred Weber/ZEGK (18,50), Landessternwarte (18 bei 500 Pax) · 2025: URZ (8), ISSW (9–9,90), Chirurgie (10–15), Phys. Institut (15), Median 15 über 31 Positionen |
| U4 | **Lunch-Buffet warm** (inkl. Dessert/Tea Time) | 19–29 | 30–130 | 2026: BZH (19,90), Biochemie (19), Chirurgie (24,90), Herzchirurgie (25), Musikwiss. (29), Theor. Physik (22,50–28,90) · 2025: Phys. Institut (19,50), COS Kombi mit Breaks (29) |
| U5 | **Empfang / Get-Together** (Fingerfood, Tapas, Poster Session) | 12–40 | 20–200 | 2026: UniKT Poster Session (12), Urologie Apéro (22), Datenethik (23,80), Theor. Physik Tapas (25) · 2025: Exzellenzcluster (18), Rektorat Bel Etage (34), Dezernat 7 (35 inkl. Getränke), Umweltphysik (bis 40) |
| U6 | **Abendessen / Dinner-Buffet** | 22–49 (+5–30 Getränke) | 24–125 | 2026: NAR (24+5), Kuratorium Chirurgie (28 inkl.) · 2025: Theol. Institut (22), Jüdische Hochschule (12), Radio-Onkologie Weihnachten (49+24,90), UniKT BBQ-Dinner (50 inkl.) — **Premium-Variante:** Phys. Institut Dinner-Buffet Tapas 45 / Klassisch 65 |

**Stufen-Namen aus der Praxis:** Die Angebote der Theoretischen Physik (Juni 2026) benennen die Lunch-Stufen bereits explizit — **BASIC 13,50 € / CLASSIC 22,50 € / gehoben 28,90 €**. Diese Dreistufigkeit ist die natürliche Konfigurator-Auswahl innerhalb von U3/U4: BASIC entspricht dem oberen Quick-Lunch-Bereich, CLASSIC und „gehoben" dem warmen Buffet.

**Add-ons (zu jedem Paket zubuchbar):**
- Lunch Bags / Brownbags To Go: 12,50–12,95 €/P (Herzchirurgie, Alfred Weber)
- Welcome Snacks (kleine Gruppe, z. B. Gutachter): ~5 €/P
- Sommerfest/BBQ: existiert bereits als Paket `summer_bbq_buffet` — Uni-Belege: BZH 25 €/P (130 Pax), HGSFP BBQ 32 €/P (220 Pax), Musikwiss. Sommerfest-Buffet kalt 49 €/P + 30 € Getränke
- Getränkepauschale Abend: 5–30 €/P je nach Umfang (2025: 17 Belege, Median 16,50)

**Pflicht-Nebenkosten (im Konfigurator immer ausweisen, nie verstecken):**
Transport (Standard **150 € netto/Anlieferung**; 300/450/600 € bei größeren Events mit 2–3 Anlieferungen; nur bei Kleinst-/„Brötchen-Caterings" darunter), Personal 45,55 €/h nach Aufwand (RV-Zuschlagssatz 42,02 €/h — siehe Abschnitt 6), Buffetinfrastruktur-Pauschale. Diese drei Positionen stehen in jeder einzelnen Kostenübersicht — der Konfigurator muss sie als automatisch berechnete Schätzpositionen mitführen, sonst sind die Selbstkalkulationen der Institute systematisch zu niedrig.

## 3. Abgrenzung zum bestehenden Portfolio

Das Repo-Fixture `curated-offer-packages.json` enthält bereits `institution_framework_catering` (18–35 €/P) als Sammelpaket. Die sechs U-Pakete sind dessen **Auffächerung auf Konfigurator-Granularität** — sie ersetzen es im Uni-Kontext, nicht im Gesamtportfolio. Überlappungen: U2≈`conference_day_catering` (24–42, deckt aber den Uni-Preisbereich nicht ab — Uni liegt darunter), U5≈`reception_fingerfood_basic` (26–38, Uni ab 12).

**Quervergleich Business/Privat (172 + 33 PDFs, 2025+2026):** Das Business-Segment nutzt exakt denselben Modul-Baukasten (Conference-Getränke, Coffee Breaks, Lunch, Buffet, Flying/Empfang), liegt aber **durchgängig ~40–60 % über Uni-Niveau**: Lunch Median 24–26 € (Uni 15–17,50), Empfang/Flying Median 30 € mit Spitze 49,90 (Uni Median ~23), Conference-Pauschalen Median 19,90–24 € (Uni ~14). Privat ist das Premium-Segment (Median ~40–49 €, Spitze 92 € inkl. Getränke). Konsequenz: **eigener Uni-Datensatz ist zwingend** — Business-Preisbänder im Konfigurator würden die Rahmenvertragspartner systematisch verprellen; umgekehrt taugt die Paket-Mechanik 1:1 als Blaupause für einen späteren Business-Konfigurator.

## 4. JSON-Entwurf (Format wie `curated-offer-packages.json`)

```json
[
  {
    "id": "uni_conference_drinks_allday",
    "name": "Conference-Getränke ganztägig",
    "price_band_pp": [7, 12],
    "min_pax": 15,
    "food_modules": ["Kaffee frisch gebrüht mit Milch-/Zuckerbar", "Ronnefeldt-Tee", "Säfte 0,2l Glas", "Wasser", "Kekse & Saisonobst"],
    "service_modules": ["Thermoskannen/Dispenser", "Auf- & Abbau", "ganztägige Verfügbarkeit"],
    "event_types": ["Tagung", "Seminar", "Workshop", "Prüfung/Begutachtung"],
    "cluster": "Uni-Rahmenvertrag",
    "source_evidence": {"records_2025_2026": 20, "institute": ["Herzchirurgie", "Studierendenadministration", "Urologie", "Mathematikon", "CAPAS", "HCTS"]}
  },
  {
    "id": "uni_coffee_breaks",
    "name": "Kaffeepausen-Paket (Coffee Break I & II)",
    "price_band_pp": [12.5, 19.9],
    "min_pax": 15,
    "food_modules": ["Conference-Getränke (U1 inkludiert)", "vormittags: Viennoiserie/Laugengebäck/Focaccia", "nachmittags: Minisweets/hausgemachte Kuchen", "Saisonobst"],
    "service_modules": ["Buffetaufbau Pausenstation", "alternierend bei Mehrtagesveranstaltung"],
    "event_types": ["Tagung", "Konferenz", "Vollversammlung"],
    "cluster": "Uni-Rahmenvertrag",
    "source_evidence": {"records_2026": 9, "institute": ["Kirchhoff Physik", "Med. Fakultät Datenethik", "Mathematikon", "Theoretische Physik", "Juristen-Strafrecht", "Office Structures", "Urologie"]}
  },
  {
    "id": "uni_quick_lunch",
    "name": "Quick Lunch",
    "price_band_pp": [6.5, 18],
    "min_pax": 12,
    "food_modules": ["Suppen/Eintöpfe/Wraps (Basis)", "Bowls/Salate/Petite Baguettes (Standard)", "vegan/vegetarisch-Quote standardmäßig ~50 %"],
    "service_modules": ["Anlieferung & Anrichten", "Buffetinfrastruktur klein"],
    "event_types": ["Mittagsseminar", "Besprechung", "Sommerschule"],
    "cluster": "Uni-Rahmenvertrag",
    "source_evidence": {"records_2026": 14, "institute": ["HCTS", "BZH", "Urologie", "Alfred Weber", "ZEGK", "NAR", "Landessternwarte"]}
  },
  {
    "id": "uni_lunch_buffet_warm",
    "name": "Lunch-Buffet warm",
    "price_band_pp": [19, 29],
    "min_pax": 30,
    "food_modules": ["Salat-Vorspeise", "warme Hauptgerichte (50 % Fleisch / 50 % vegan)", "Dessert", "optional Kuchenbuffet/Tea Time"],
    "service_modules": ["Buffetinfrastruktur", "Servicepersonal nach Aufwand", "Geschirr & Besteck"],
    "event_types": ["Tagung mit Mittagessen", "Begutachtung", "Festakt mittags"],
    "cluster": "Uni-Rahmenvertrag",
    "source_evidence": {"records_2026": 8, "institute": ["BZH", "Biochemie", "Chirurgie", "Herzchirurgie", "Musikwissenschaften"]}
  },
  {
    "id": "uni_reception_gettogether",
    "name": "Empfang / Get-Together",
    "price_band_pp": [12, 40],
    "min_pax": 20,
    "food_modules": ["Fingerfood/Tapas", "Aperitifsnacks", "vegetarisch/vegan-Anteil"],
    "service_modules": ["Stehtisch-/Empfangsaufbau", "Getränkeservice", "optional Sekt/Prosecco"],
    "event_types": ["Poster Session", "Antrittsvorlesung", "Get-Together nach Tagung", "Apéro"],
    "cluster": "Uni-Rahmenvertrag",
    "source_evidence": {"records_2025_2026": 9, "institute": ["UniKT", "Urologie", "Med. Fakultät Datenethik", "Theoretische Physik", "Exzellenzcluster Structures", "Rektorat Bel Etage", "Dezernat 7", "Umweltphysik"]}
  },
  {
    "id": "uni_dinner_buffet",
    "name": "Abendessen / Dinner-Buffet",
    "price_band_pp": [22, 49],
    "min_pax": 24,
    "food_modules": ["warmes Dinner-Buffet", "Dessert"],
    "service_modules": ["Getränkepaket abends (5–30 €/P)", "Servicepersonal", "Abbau spät"],
    "premium_variant": {"name": "Dinner-Buffet Premium (Tapas/Klassisch)", "price_band_pp": [45, 65]},
    "event_types": ["Conference Dinner", "Abendveranstaltung", "Kuratoriumssitzung"],
    "cluster": "Uni-Rahmenvertrag",
    "source_evidence": {"records_2025_2026": 10, "institute": ["NAR Altersforschung", "Biochemie", "Kuratorium Stiftung Chirurgie", "Theologisches Institut", "Jüdische Hochschule", "Radio-Onkologie", "Physikalisches Institut"]}
  }
]
```

Querschnittspositionen für die Konfigurator-Kalkulation (nicht Teil der Pakete): `transport_per_delivery: 60–150 €`, `staff_hourly: 45.55 €`, `buffet_infrastructure_flat: 150–300 €`, `linen_flat: 60 €`.

## 5. Der offizielle Vertragsrahmen (Ordner „Uni Heidelberg Rahmenvertrag")

Auswertung der Vergabeunterlagen `Uni-HD.2025.62_Cateringleistungen_RV-UV` (Leistungsverzeichnis 69 S., Zuschlag § 58 VgV, Angebotskalkulations-Template, Umsatzbericht):

### Zuschlag & Marktposition
- **THE ONE hat Los 1 und Los 5 gewonnen** (Zuschlag 25.03.2025): Los 1 = Eventpaket 1 **GROSS, 600–900 Teilnehmer** (~25 % des Ausschreibungsumsatzes), Los 5 = Eventpaket 3 **KLEIN, 20–50 Teilnehmer** (~12 %).
- Laufzeit **01.04.2025–31.03.2029** (1 Jahr + 3×1 Jahr Verlängerungsoption). Ausschreibungsvolumen gesamt: **~1,633 Mio. € netto / 48 Monate**; THE-ONE-Anteil nominal ~37 % ≈ 600 k€.
- Wettbewerber laut Umsatzbericht: Salerno (Los 2: 300–600 Pax, Los 6: 20–50), frieda (Los 3: 150–300), Toffs (Los 4: 50–150).
- **Umsatz-Realität** (Bericht, Mai 2025–Dez 2026 inkl. gebuchter Termine): 21 Abrechnungen, **65.285 € netto, 1.274 Pax**, Ø ~3.100 €/Event, Ø ~51 €/Pax all-in (inkl. Personal/Equipment). Reale Eventgrößen 22–125 Pax — die Institute bestellen faktisch quer über die Los-Grenzen.

### Die offizielle Bestell-Taxonomie (Konfigurator-relevant!)
Die Vertragspreisliste ist ein SKU-Katalog: **8 Warengruppen** (1 Herzhafte Pause/kalter Imbiss/Empfang · 2 Süße Pause · 3 Warm/kaltes Buffet · 4 Warme Getränke · 5 Kalte Getränke alkoholfrei · 6 mit Alkohol · 7 Equipment-Leihe · 8 Personal nach Tageszeit/Wochentag) × **3 Qualitätskategorien** (1 einfach, 2 mittel, 3 exklusiv) mit normierten Größen (z. B. halbes belegtes Brötchen, Quiche-Stück 5,5×4 cm, Suppe 200 ml, Hauptgericht 450 g). **Die Kategorie-1/2/3-Logik des Vertrags deckt sich exakt mit den in den Angeboten gefundenen Stufen BASIC/CLASSIC/gehoben** — der Konfigurator sollte genau diese Dreistufigkeit anbieten und kann die Vertrags-SKUs als Mengengerüst hinter den Paketen verwenden.

### Vertrags-Pflichten, die der Konfigurator einhalten muss
1. **Keine gesonderte Handlingsgebühr/Service Charge.**
2. **Keine gesonderten Fahrtkosten in Heidelberg** laut Vertragstext — **aber individuell vereinbart, dass Lieferkosten weiterhin abgerechnet werden** (Klärung Alexander, 12.06.2026). Gelebte Regel: **150 € netto pro Standard-Anlieferung**; Abweichung nach unten nur bei sehr kleinen Budgets/„Brötchen-Caterings"; bei größeren Veranstaltungen mit 2–3 Anlieferungen und größeren Fahrzeugen **300 / 450 / 600 €**. Der Konfigurator rechnet Transport also gestaffelt mit (Standard 150 €, Staffelung nach Eventgröße/Lieferungen).
3. **Vegetarische Option in jeder Kategorie Pflicht** (vegan bevorzugt zusätzlich) — deckt sich mit der beobachteten 50/50-Praxis.
4. Englischsprachige Kommunikation bei internationalen Veranstaltungen; Geschirr/Besteck/Servietten ohne Aufpreis; keine Brennpasten; Auf-/Abbau durch Caterer-Personal.
5. Rechnungen brauchen **Vertragskennziffer (# 2025-0062/1+5) und UHD-Nummer** — das Anfrage-Formular des Konfigurators sollte die UHD-Nummer/Kostenstelle gleich abfragen.

## 6. Validierung gegen die eingereichten Vertragspreise

Die eingereichten SKU-Preise (CSV-Export der Kalkulations-Numbers vom 12.06.2026) liegen jetzt vollständig vor — 8 Warengruppen, ~110 Positionen, Preise je Eventpaket weitgehend identisch (nur Getränke in Paket 1/GROSS leicht günstiger, z. B. Kaffee 1,20 statt 1,50 €/Tasse, Wasser 1,80 statt 2,50 €/0,75 l). Gewichtete Warenkorbsummen der Abgabe: Los 1: 106.791 € · Los 3: 54.638 € · Los 5: 28.586 € · Los 6: 6.651 €.

**Plausibilisierung der sechs Paket-Bänder durch SKU-Komposition (Kategorie 2):**

| Paket | SKU-Komposition (Beispiel) | rechnerisch | Band | Urteil |
|---|---|---|---|---|
| U1 Conference-Getränke | 2–3× Kaffee/Tee (1,20–1,50/Tasse) + Wasser (1,80–2,50/0,75 l) + Saft-Anteil + Kekse/Obst (2,00+1,00) | ~8,50–11 € | 9,90–12 | ✓ |
| U2 Kaffeepausen | U1 + Break I (Danish 1,70–1,90, Laugengebäck 1,50–2,50, Obst 1,00) + Break II (Kuchen 1,80–2,40, Kleingebäck 2,00) | ~13,50–19 € | 12,50–19,90 | ✓ |
| U3 Quick Lunch | Eintopf+Brot 6,50–8,50 *oder* Wrap 4–6 + Salatgläschen 2,50–4,50 + Dessert/Obst 1–2 (+ Getränke 2–4) | ~6,50–17 € | 6,50–18 | ✓ |
| U4 Lunch-Buffet warm | Hauptgericht 10–19 + Vorspeise 2,20–3,80 + Suppe 2,50–3 + Dessert 1,50–2 (+ Kuchen/Tea Time) | ~16–27 € | 19–29 | ✓ |
| U5 Empfang | 8–12 Teile Canapés/Spieße/Mini-Quiches/Gläschen à 1–3 € | ~10–25 € | 12–25 | ✓ |
| U6 Dinner | U4-Basis + Wein/Sekt abends (Flasche 15–25 € ≈ 5–7 €/P) | ~22–30 € | 24–30 | ✓ |

Alle sechs Bänder sind mit den Vertrags-SKUs reproduzierbar — die Pakete können mit hinterlegtem SKU-Mengengerüst in den Konfigurator.

**Neue Diskrepanz — Personalsatz:** Eingereicht und bezuschlagt sind **42,02 €/h** (+12,61 € Zuschlag ab 21 Uhr, Mo–So einheitlich); die 2026-Angebote rechnen durchgängig **45,55 €/h**. Nur das BZH-Angebot nennt noch 42,02 €. Klären: Preisindexierung im Vertrag oder versehentliche Nicht-RV-Rate? Der Konfigurator braucht den vertraglich richtigen Satz.

## 7. Offene Punkte vor Konfigurator-Bau

1. ~~Fahrtkosten-Klausel~~ **geklärt (12.06.2026):** individuell vereinbart, dass Lieferkosten trotz Vertragstext abgerechnet werden — Staffel 150 € Standard, 300/450/600 € bei Mehrfach-Anlieferung, Ausnahme nur Kleinst-/Brötchen-Caterings (Abschnitt 5, Punkt 2).
2. **Personalsatz klären** (Abschnitt 6): bezuschlagt 42,02 €/h vs. 45,55 €/h in der Angebotspraxis — vermutlich ebenfalls individuell angepasst; kurz bestätigen.
3. **MwSt-Logik:** Angebote mischen 7 % (Speisen-Lieferung) und 19 % (Service/Verleih); Konfigurator zeigt netto + Hinweis, die App rechnet wie bisher.
4. **Draft-only bleibt:** Konfigurator-Anfragen erzeugen einen Intake-Datensatz, nie ein verbindliches Angebot — Preisbänder werden als „Richtwert pro Person" angezeigt (rechtlich unverbindlich, freibleibend wie die PDF-Angebote).
5. Die 60 PDFs taugen zusätzlich als **Eval-Korpus** für die Batch-Klassifikation (Slice 5) — Uni-Cluster ist damit schon vor dem OpenAI-Lauf manuell gelabelt.

## Anhang B — Methodik

- Quelle Angebote Uni: `2026/Rahmenvertrag/` (64 Texte, 27 Instituts-Ordner) + `2025/Rahmenvertrag-UniHD/` (123 Texte, ~45 Institute); `.pages`-Duplikate und Infodateien ignoriert.
- Vergleichskorpora: `2025/Business` (137) + `2026/Business` (35) + `2025/Privat` (20) + `2026/Privat` (13) — Cluster-Statistik (min/median/max je Leistungsart) zur Segment-Abgrenzung in Abschnitt 3.
- Quelle Vertrag: GDrive-Ordner `Angebote/Uni Heidelberg Rahmenvertrag/` — Leistungsverzeichnis-PDF (69 S., per pdftotext), Zuschlagsschreiben-PDF, `Angebotskalkulation …_Stand 04.02.2025.xlsx` (Blanko-Template, beide Sheets), `2025/Bericht 2025 Rahmenvertrag Uni Heidelberg.xlsx` (21 Abrechnungszeilen). Eingereichte SKU-Preise: CSV-Export der Kalkulations-Numbers (durch Alexander am 12.06.2026, als ZIP im selben Ordner), Blatt „Angebot und Bewertung", ~110 Positionen vollständig ausgewertet. Nicht ausgewertet: Umsatz-Gesamt-Numbers und `2025/Rahmenvertrag-UniHD/` (252 Dateien Vorjahres-Angebote — bei Bedarf nachziehbar).
- Extraktion: `pdftotext -layout`; Clusterung über die Positionszeilen der Kostenübersichten (`Catering | … € pro Person`), Pax aus `KOSTENÜBERSICHT | DETAILS | n PAX`.
- Preisbänder = beobachtete Min/Max je Cluster über alle Institute; keine Inflationierung, keine Glättung.
- Nicht enthalten: ältere Jahrgänge (2015–2025) und Nicht-Rahmenvertrags-Ordner (Business, Privat, Omas …) — bewusst, weil der Konfigurator zunächst nur die Uni-Partner bedient.
