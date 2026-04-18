# P11 Datenkorrekturen und fachliche Nachpflege im MVP – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt Datenkorrekturen und fachliche Nachpflege fuer den MVP der `AlexanderSmyslowski/catering-agents-platform`.

Sie erfindet keine freie Vollbearbeitung aller Artefakte, keine neue Historien-/Diff-Oberflaeche, keine automatische Korrekturlogik und keine neue Produktfamilie. Ziel ist ausschliesslich, den bereits realen MVP-Kern so einzuordnen, dass klar bleibt:
- was bereits vorhanden ist
- welche Korrekturen im MVP fachlich zulässig sind
- welche Artefakte eher neu erzeugt als direkt editiert werden sollen
- was bewusst read-only oder nur indirekt korrigierbar bleibt

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P8, P9, P10 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P8_UI_ROLLENVERANTWORTUNG_UND_OPERATOR_ZUORDNUNG_MINISPEZ.md`
- `docs/product/P9_AUTHN_AUTHZ_MVP_RAHMEN_MINISPEZ.md`
- `docs/product/P10_MANUELLE_BETRIEBSINTERVENTIONEN_UND_FALLBACKS_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in der Intake-Arbeit, in den Entwurfs-/Produktionspfaden und in den read-only Kontextelementen

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- Die MVP-Arbeitspakete halten die ersten Rollen-/Rechte-, Betriebs- und Audit-Grenzen klein.
- P8 ordnet die UI den vorhandenen Rollen und Operatoren zu.
- P9 begrenzt den AuthN-/AuthZ-Rahmen zwischen read-only und mutierend.
- P10 begrenzt manuelle Betriebsinterventionen und Fallbacks bei Stoerungen.
- P11 bleibt innerhalb dieses Rahmens und beschreibt nur fachliche Korrekturen und Nachpflege, nicht eine neue Bearbeitungsplattform.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten.

## 3. Aktueller repo-gebundener Kontext

### 3.1 Bereits vorhanden

Im Repo sind bereits folgende Kontexte sichtbar:
- Intake-nahe Spezifikationsarbeit und Normalisierung
- Angebotsentwuerfe und Varianten
- Produktionsplaene und Einkaufslisten
- read-only Detail-, Export- und Audit-Kontexte
- Rollen-/Operator-Zuordnung ueber die vorhandene Minimalrollen- und `x-actor-name`-Konvention
- geschuetzte mutierende Kernpfade im MVP

### 3.2 Fuer den MVP zulässig und verbindlich

Fuer den MVP ist verbindlich anzunehmen:
- Korrekturen erfolgen innerhalb der vorhandenen fachlichen Kontexte, nicht als freie Vollbearbeitung aller Artefakte
- Nachpflege geschieht nur dort direkt, wo ein Artefakt im aktuellen Rollen- und Guard-Rahmen mutierbar ist
- read-only Kontexte bleiben read-only; sie dienen der Sichtung und Entscheidung, nicht der stillen Umwandlung in Schreiboberflaechen
- Korrekturen muessen zum passenden Operator-Kontext passen
- wenn ein Artefakt fachlich nicht sicher editiert werden kann, ist Neuanlage oder erneute Ableitung fachlich oft sauberer als ein unsauberer Direktedit

### 3.3 Was heute eher organisatorisch oder indirekt korrigiert wird

Heute bereits eher organisatorisch oder indirekt korrigiert:
- unklare oder unvollstaendige Intake-Daten
- inkonsistente Angebotsentwuerfe
- fachliche Korrekturen an Produktionskontexten, die aus einer vorgelagerten Spezifikation oder einem Entwurf stammen
- Zuordnungsfehler, die nur im passenden Operator-Kontext sinnvoll berichtigt werden koennen
- Zustandsunstimmigkeiten, die zuerst sichtbargemacht und dann in einem passenden Bearbeitungsschritt bereinigt werden muessen

## 4. Kleinste MVP-Festlegung

### 4.1 Fachliche Korrekturen im MVP

Im MVP sind folgende fachliche Korrekturen grundsätzlich zulässig, sofern sie im passenden Operator-Kontext und innerhalb der bestehenden Guards erfolgen:
- Korrektur von Intake-nahen Spezifikationsdaten, wenn die Normalisierung noch nicht final fachlich weiterverarbeitet wurde
- Korrektur von Angebotsentwuerfen und Varianten, soweit sie als operative Entwurfsarbeit gedacht sind
- Korrektur von Produktionsplaenen und Einkaufslisten, wenn der Produktionskontext dies als operative Nachpflege vorsieht
- fachliche Nachpflege von Datenfeldern, die im aktuellen Kern als bearbeitbar und nicht als rein dokumentarisch gedacht sind
- Berichtigung offensichtlicher Zuordnungsfehler, wenn sie vom zuständigen Operator verantwortet werden

### 4.2 Nachpflege eher als Neuerzeugung statt Edit

Im MVP soll fachlich eher neu erzeugt oder erneut abgeleitet werden, statt beliebig direkt editiert zu werden, wenn es um:
- neue oder stark abweichende Angebotsvarianten
- neu geordnete Produktionsplaene nach grundlegender fachlicher Aenderung
- Einkaufslisten, die sich aus einer wesentlich geaenderten Produktionslage ergeben
- Intake-Spezifikationen, die sich nach einer erheblichen fachlichen Korrektur nicht mehr sauber als kleiner Direktedit behandeln lassen

Faustregel: Wenn die Nachpflege den fachlichen Ursprung des Artefakts praktisch neu setzt, ist Neuanlage oder erneute Ableitung im MVP oft sauberer als eine freie Vollkorrektur.

### 4.3 Nur im passenden Operator-Kontext zulässig

Folgende Korrekturen sind nur im passenden Operator-Kontext zulässig:
- Intake-Korrekturen nur im Intake-Operator-Kontext
- Angebotskorrekturen nur im Angebots-Operator-Kontext
- Produktionskorrekturen nur im Produktions-Operator-Kontext
- Betriebs-, Audit- und Freigabekontexte nur im Betriebs-/Audit-Operator-Kontext

Die bestehende Rollen- und Header-Konvention darf dabei als fachliche Zuordnung dienen, aber nicht in eine neue Rolleninfrastruktur umgedeutet werden.

### 4.4 Read-only oder nur indirekt korrigierbar bleibende Artefakte

Im MVP sollen bewusst read-only oder nur indirekt korrigierbar bleiben:
- Detailansichten, die primär der Nachvollziehbarkeit dienen
- Exportartefakte als erzeugte operative Belege
- Audit-Kontexte und Nachweisspuren
- historische, bereits verankerte Zustandsdarstellungen
- Artefakte, deren fachlicher Zustand erst durch eine neue Ableitung oder einen erneuten Lauf wieder sauber hergestellt werden kann

Read-only bedeutet hier: ansehen, prüfen, nachziehen. Nicht: beliebig direkt umschreiben.

## 5. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine freie Vollbearbeitung aller Artefakte
- keine neue Historien-/Diff-Oberflaeche
- keine automatische Korrekturlogik
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Governance-Engine
- keine neue Produktfamilie

P11 ordnet nur die fachliche Nachpflege des bestehenden MVP-Kerns ein.

## 6. Offene Punkte

Bewusst offen bleibt:
- welche Artefakte spaeter noch feiner editierbar werden sollen
- ob und wie ein spaeterer Ausbau zwischen direkter Korrektur und Neuerzeugung weiter differenziert
- welche Teile der Nachpflege organisatorisch dokumentiert und welche technisch hart gefuehrt werden muessen
- ob der MVP in spaeteren Phasen eine echte Change-/Diff-Sicht benoetigt
- welche fachlichen Korrekturen bewusst nur ueber erneute Ableitung sauber bleiben

Diese Punkte sind noch nicht durch einen echten produktiven Nachpflege-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Korrekturklassen als internen Referenzrahmen festhalten
2. die Grenze zwischen Direktedit, Neuerzeugung und read-only klar benennen
3. weitere Nachpflege- oder Diff-Funktionen erst spaeter explizit beauftragen

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Kern bei Datenkorrekturen und fachlicher Nachpflege fachlich einordnen, ohne eine neue Bearbeitungs- oder Governance-Plattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
