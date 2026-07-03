# Operator-Probe: Reibungs-Notiz

Ausfüllblatt für Slice 1 (Phase A der Vorhaben-Analyse). Eine Person, ein
Durchlauf, ehrliches Protokoll. **Während der Probe wird nichts gefixt und
nichts nachgeschlagen — nur notiert.** Wenn ein Schritt ohne Hilfe nicht
gelingt, ist genau das der Befund.

| | |
|---|---|
| Datum / Operator | 2026-06-29 / Codex-Sichtung, keine Alexander-Personenprobe |
| Stand (Commit) | `git rev-parse --short HEAD` → fe3e3f5 |
| Gesamtdauer | ca. 20 min |

## Setup (vor der Stoppuhr)

```bash
npm run local:start:fresh   # temporäre synthetische Datenwurzel, ./data bleibt unberührt
npm run local:status
npm run local:check
```

Achtung: `local:start:fresh` stoppt einen bereits laufenden Stack und startet
mit Wegwerf-Datenwurzel neu. Zurück zum Normalbetrieb auf `./data` danach mit
`npm run local:start`.

UI: <http://localhost:3200/> · `/angebot` · `/produktion` — Schritt-für-Schritt-
Referenz bei Bedarf NACH der Probe: `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`.

Setup-Reibung (alles, was bis zur erreichbaren UI schiefging): keine im frischen
Stack. `local:start:fresh`, `local:status`, `local:check` und
`browser:rehearsal:full-fresh` liefen grün; `./data` blieb unberührt.

## Durchlauf

Je Station: Dauer, „kam ich ohne Doku/Suchen weiter?" (ja/zäh/nein), und was
gestolpert hat. Leere Zeile = lief glatt.

| # | Station | Dauer | Ohne Hilfe? | Reibung |
|---|---|---|---|---|
| 1 | Intake: neue synthetische Anfrage anlegen | 2 min | ja | Freitext-Normalisierung in `/produktion` funktioniert. |
| 2 | Angebot: Entwurf aus der Anfrage erzeugen und verstehen | 3 min | ja | Kundentext ist sauber deutsch; technischer Draft-Kontext steht noch im Exporttitel. |
| 3 | Übergabe Angebot → Produktion nachvollziehen | 3 min | nein | UI meldet Angebotsvariante übernommen, Produktion bleibt aber auf Seed-/anderem Vorgang. |
| 4 | Produktion: Rückfragen sehen/beantworten, „Berechnung starten" | 5 min | zäh | Rückfragen doppelt/inkonsistent; Zeitfenster-Rückfrage ohne sichtbares Antwortfeld. |
| 5 | Plan + Einkaufsliste prüfen (stimmen Mengen plausibel?) | 3 min | zäh | Plan wird erzeugt, bleibt teilweise vollständig; Einkaufsliste vorhanden, aber 0 Positionen. |
| 6 | Export: Angebots-HTML, Produktionsplan-HTML, Einkaufslisten-CSV öffnen | 3 min | ja | Alle Exporte erreichbar; Plan/Mappe zeigen technische IDs im Titel, CSV nur Header. |
| 7 | Drucktauglichkeit: würde Ronak diese Mappe nehmen? | 2 min | nein | Mappe hat 9 Abschnitte, aber ohne Rezeptkarten/Einkaufsposten nicht produktionsbrauchbar. |

## Reibungs-Log

Jede Beobachtung einzeln, auch Kleinkram. Schwere: **B**locker (kam nicht
weiter) / **S**tolperer (kam weiter, aber falsch/umständlich/unklar) /
**K**osmetik.

| Nr | Station | Beobachtung (was habe ich erwartet, was passierte) | Schwere |
|---|---|---|---|
| 1 | Angebot → Produktion | Nach „Variante übernehmen" erwartete ich den Besprechungsvorgang in Produktion; stattdessen blieb die Produktionsroute auf einem vorhandenen Seed-/Kaffeestation-Vorgang. | B |
| 2 | Angebot-Export | Angebots-HTML ist erreichbar und sprachlich besser, startet aber mit `Angebot draft-request-...`; technische ID steht im sichtbaren Titel. | S |
| 3 | Produktion Rückfragen | Status meldete 5 offene Rückfragen, sichtbar waren doppelte Zeitfenster-Fragen; nach Speichern blieb 1 offen, aber dieselbe Frage stand zweimal im Chatfluss. | S |
| 4 | Produktion Rückfragen | „Wie lautet das verbindliche Zeitfenster?" hat kein klar zugeordnetes Antwortfeld. Datum ist vorhanden, Zeitfenster nicht. | B |
| 5 | Produktions-Normalisierung | „Tomatensuppe und Kaffeestation." wurde als eine Komponente behandelt. Für einen Operator ist unklar, ob das beabsichtigt ist. | S |
| 6 | Produktion Hauptfläche | Plan-, Spec- und Purchase-IDs stehen mehrfach sichtbar in Buttons, Downloadbereich und Abschluss-Kontext statt nur in technischen Details. | S |
| 7 | Plan + Einkauf | Nach Berechnung: `teilweise vollständig`, 0 Einkaufspositionen, keine Rezeptkarten. Das ist ehrlich markiert, aber für „produktionsbereit" klar nicht ausreichend. | B |
| 8 | Produktionsmappe | Mengenkalkulation zeigt `1 Portionen p. P.`; grammatisch klein, aber in einer Küchenmappe sichtbar. | K |

## Urteil (3 Fragen, je 1–3 Sätze)

1. Würde ich die nächste **echte** Kundenanfrage parallel über die Plattform
   schieben (Slice 3) — ja sofort / ja nach Fixes / nein? Warum?
   Ja nach Fixes. Der Demo-Kern startet und exportiert, aber Angebot-zu-Produktion
   und Rückfragenbeantwortung sind noch nicht robust genug für echte parallele
   Nutzung.
2. Welche max. 3 Reibungspunkte müssen vor Slice 3 gefixt sein (→ Slice 4)?
   Erstens: Angebotsübernahme muss in Produktion als aktueller Vorgang sichtbar
   und berechenbar sein. Zweitens: Rückfragen dürfen nicht doppelt erscheinen und
   jede Rückfrage braucht ein klares Antwortfeld oder einen klaren Status. Drittens:
   technische IDs aus sichtbaren Exporttiteln/Hauptflächen entfernen.
3. Was hat positiv überrascht / trägt mehr als erwartet?
   Der frische Stack und die technische Rehearsal laufen stabil; die Mappe hat
   die richtige Abschnittsstruktur und markiert fehlende Daten ehrlich statt sie
   zu kaschieren.

## Abschluss

```bash
npm run local:stop
```

Diese Notiz ist das Artefakt — kein PR, keine Folge-Doku. Fixes aus dem
Reibungs-Log werden als Slice 4 gebündelt beauftragt.

---

# Operator-Probe: Reibungs-Notiz 2026-07-03

Eine Codex-Operatorprobe auf aktuellem `main`, frischer Wegwerf-Datenwurzel
und ohne Produktcode-Änderung.

| | |
|---|---|
| Datum / Operator | 2026-07-03 / Codex, Browser-gestützte Sichtprobe |
| Stand (Commit) | `git rev-parse --short HEAD` → 5cd97e7 |
| Gesamtdauer | ca. 20 min |

## Setup

`npm run local:start:fresh`, `npm run local:status` und `npm run local:check`
liefen grün. Danach zusätzlich:

- `npm run browser:rehearsal` → grün: Start → Angebot → Produktion →
  Rückfragen → Ergebnisobjekte → Exporte/Audit → lokales Leeren.
- `npm run browser:rehearsal:answer-submit` → grün: Antwortpfad bleibt nach
  Reload gespeichert.

Setup-Reibung: keine fachliche. Die Browser-DOM-Snapshot-Funktion der Codex-App
fiel aus, Screenshot und read-only DOM-Auswertung reichten für die Sichtprobe.

## Durchlauf

| # | Station | Dauer | Ohne Hilfe? | Reibung |
|---|---|---|---|---|
| 1 | Intake: neue synthetische Anfrage anlegen | 2 min | zäh | Eingabe ist vorhanden, aber auf der Produktionsroute stehen Eingabe, Demo-Aktionen, aktueller Plan und Ergebnis dicht hintereinander. |
| 2 | Angebot: Entwurf aus der Anfrage erzeugen und verstehen | 2 min | ja | Rehearsal bestätigt Navigation und Marker; keine fachliche Angebotsqualität geprüft. |
| 3 | Übergabe Angebot → Produktion nachvollziehen | 2 min | zäh | UI zeigt Produktionsdaten im Fokus, aber der Zusammenhang zwischen Angebot, gespeicherter Spezifikation und aktuellem Plan bleibt erklärungsbedürftig. |
| 4 | Produktion: Rückfragen sehen/beantworten | 3 min | ja | Antwort-Submit-Pfad technisch grün; sichtbarer Fresh-Seed hatte 0 offene Rückfragen. |
| 5 | Plan + Einkaufsliste prüfen | 5 min | nein | Aktueller Plan ist ehrlich als unzureichend markiert: 0 Rezeptblätter, 1 Liste ohne Positionen, offene Klassifikation für Filterkaffee Station. |
| 6 | Export: HTML/CSV öffnen | 4 min | nein | Produktionsblatt und CSV erreichbar, aber sichtbarer Link zur Produktionsmappe liefert 404. |
| 7 | Drucktauglichkeit | 2 min | nein | Nicht Ronak-tauglich: kein Rezeptblatt, keine Einkaufspositionen, Mappe-Link 404. |

## Reibungs-Log

| Nr | Station | Beobachtung (was habe ich erwartet, was passierte) | Schwere |
|---|---|---|---|
| 1 | Produktion Hauptfläche | Erwartet: aktueller Produktionsstand als klares Cockpit. Passiert: UI ist ruhiger als im alten Screenshot, aber immer noch dicht; Eingabe, Seed-Daten, Demo-Aktion, Rückfragen und Ergebnis konkurrieren. | S |
| 2 | Plan + Einkauf | Erwartet: bei aktivem Plan mindestens nachvollziehbare Rezept-/Einkaufsgrundlage oder klarer nächster Freigabeschritt. Passiert: `0 Rezeptblätter`, `1 Liste ohne Positionen`, offene Klassifikation. | B |
| 3 | Produktionsmappe | Erwartet: sichtbarer Link "Produktionsmappe (HTML)" öffnet die Mappe. Passiert: `GET /production-folders/plan-spec-demo-production-coffee/html` liefert 404: `AcceptedEventSpec zum ProductionPlan nicht gefunden.` | B |
| 4 | Exportqualität | Produktionsblatt ist erreichbar, aber meldet nur `Status: nicht ausreichend`, `Rezeptauswahl: 1`, offene Klassifikation. Das ist ehrlich, aber kein Produktionsartefakt. | S |
| 5 | Rückfragen | Antwort-Speichern ist technisch stabil; die Probe konnte aber keine echte offene Rückfrage fachlich beantworten, weil der sichtbare aktuelle Seed 0 offene Rückfragen hatte. | K |

## Urteil

1. Würde ich die nächste echte Kundenanfrage parallel über die Plattform
   schieben?
   Nein, noch nicht. Der lokale UI-Kernpfad ist stabiler, aber der aktuelle
   Produktionsoutput ist nicht produktionsreif und der Mappe-Link bricht.
2. Welche max. 3 Reibungspunkte müssen vor Slice 3 gefixt sein?
   Erstens: Produktionsmappe-Link darf für sichtbare aktuelle Pläne nicht 404
   liefern. Zweitens: ein aktueller Plan darf nicht als fast-leeres Ergebnis
   hängen bleiben, ohne einen unmittelbar ausführbaren nächsten Schritt.
   Drittens: Hauptfläche weiter auf ein klares "aktueller Vorgang"-Cockpit
   reduzieren, aber erst nach reproduziertem Daten-/Flow-Befund.
3. Was trägt?
   Fresh-Stack, Healthcheck, UI-Marker-Rehearsal und Antwort-Submit sind grün.
   Die UI lügt nicht mehr: sie sagt offen, dass Plan und Einkauf nicht reichen.

## Abschluss

`npm run local:stop` nach der Probe ausführen.
