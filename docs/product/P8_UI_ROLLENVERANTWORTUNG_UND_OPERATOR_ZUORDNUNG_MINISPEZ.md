# P8 UI-Rollenverantwortung und Operator-Zuordnung – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation ordnet den aktuellen MVP-Kern der Backoffice-UI fachlich den vorhandenen Rollen und Operatoren zu.

Sie erfindet keine neue Auth-/RBAC-Architektur, keine neue Rollenwelt und keine neue Produktfläche. Ziel ist nur, den bereits realen UI-Kern so klein zu begrenzen, dass klar bleibt:
- welche UI-Bereiche primär von welcher Rolle genutzt werden
- welche mutierenden Aktionen zu welchem Operator-Kontext gehoeren
- welche Wege bewusst read-only bleiben
- welche Operatornamen im Repo als bestehende Konvention gelten

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P1, P5, P7 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P1_ROLLEN_RECHTE_MINISPEZ.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `docs/product/P7_BETRIEBSFREIGABE_MVP_FREIGABEKRITERIEN_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand in der Backoffice-UI, in den Guards und in den Operator-/Audit-Pfaden

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne Betriebsplattform mit klarer Rollen- und Nachvollziehbarkeitsidee.
- P1 hat die minimale Rollen-/Rechte-Grundlage und die geschuetzten Kernpfade bereits real verankert.
- P5 begrenzt den MVP-Kern pro Bereich.
- P7 formuliert den Betriebsfreigabe-Rahmen fuer den internen MVP-Betrieb.
- P8 ordnet nun die sichtbare UI und die vorhandenen Operatoren sauber auf diese bereits realen Grenzen zu.
- `memory.md` bleibt der Kurzanker fuer den konsolidierten Repo-Stand.

## 3. Aktueller repo-gebundener UI-Kontext

### 3.1 Start-/Home-Kontext

Bereits vorhanden im Repo:
- Startseite als zentrales UI-Entry
- Navigation zu Angebotsagent und Produktionsagent
- Operatorname-Eingabe im Masthead
- Demo-Daten laden und Aktualisieren als operative UI-Aktionen
- Home-Karten fuer operative Spezifikationen, Uebergabe, Angebotsentwuerfe, Produktionsplaene und Rezeptbibliothek

Fachliche Zuordnung fuer den MVP:
- Home ist die Schaltzentrale fuer den internen Betriebs- und Operator-Kontext.
- Der Home-Kontext wird primär von internen Operatoren genutzt, nicht von externen Endnutzern.

### 3.2 Angebotsansicht

Bereits vorhanden im Repo:
- route-eindeutiger Angebotskontext unter `/angebot`
- Angebotsentwuerfe
- operative Spezifikationen als Uebergabe in die Produktion
- Angebotsdienst-Status und Exportdienst-Status
- Angebots-Exportpfade aus dem UI
- Uebernahme einzelner Varianten in operative Spezifikationen

Fachliche Zuordnung fuer den MVP:
- Die Angebotsansicht wird primär vom Angebots-Operator genutzt.
- Sie ist die fachliche Arbeitsflaeche fuer Entwurf, Varianten und Uebergabe.

### 3.3 Produktionsansicht

Bereits vorhanden im Repo:
- route-eindeutiger Produktionskontext unter `/produktion`
- Produktionsplaene
- Einkaufslisten
- Rezeptbibliothek und Rezeptfreigaben
- Schnellimport fuer Angebots-, E-Mail- und Textdateien
- Produktions-Exportpfade
- operative Produktions- und Beschaffungsdaten

Fachliche Zuordnung fuer den MVP:
- Die Produktionsansicht wird primär vom Produktions-Operator genutzt.
- Sie ist die fachliche Arbeitsflaeche fuer Produktionsplanung, Einkauf und Rezeptbezug.

### 3.4 Read-only Detail-, Export- und Audit-Kontexte

Bereits vorhanden im Repo:
- Detailansichten zu Entwuerfen und Spezifikationen
- Exportlinks fuer Angebot, Produktionsblatt und Einkaufsliste
- Audit-Feed / Audit-Ansicht
- Governance-/Finalize-Nachvollziehbarkeit
- read-first Transparenzkontexte

Fachliche Zuordnung fuer den MVP:
- Read-only Detail-, Export- und Audit-Kontexte bleiben bewusst fuer Betrachtung, Nachvollziehbarkeit und interne Kontrolle offen.
- Diese Wege sind nicht als neue eigenstaendige Schreibrollen zu verstehen.

## 4. Kleinste MVP-Zuordnung

### 4.1 Rolle → primäre UI-Bereiche

#### Intake-Operator
Primär nutzt:
- Home-Kontext als Einstieg und Ueberblick
- Intake-nahe Teile der Spezifikationsarbeit
- Arbeitswege, die Spezifikationen annehmen, normalisieren oder nachbearbeiten

#### Angebots-Operator
Primär nutzt:
- Home-Kontext
- Angebotsansicht
- Entwurfs- und Variantenarbeit
- operative Uebergabe in Spezifikationen

#### Produktions-Operator
Primär nutzt:
- Home-Kontext
- Produktionsansicht
- Produktionsplaene
- Einkaufslisten
- Rezeptbezug und operative Kuechenplanung

#### Betriebs-/Audit-Operator
Primär nutzt:
- Home-Kontext fuer Ueberblick
- Audit-/Review-/Finalize-Kontexte
- read-only Nachvollziehbarkeits- und Exportkontexte
- Demo-Daten- und Betriebswege, soweit sie im MVP als Betriebsaktion vorgesehen sind

### 4.2 Mutierende Aktionen → Operator-Kontext

#### Intake-Operator
Zuordnen zu:
- Intake-Normalisierung
- Intake-Nachbearbeitung
- Spezifikationskorrekturen im Intake-Kontext
- mutierende Intake-Wege, die im P1-Korridor bereits geschuetzt sind

#### Angebots-Operator
Zuordnen zu:
- Angebotsentwuerfen
- Variantenuebernahme
- angebotsbezogenen Bearbeitungen
- Rezept-Review im Angebotskontext

#### Produktions-Operator
Zuordnen zu:
- Produktionsplanung
- Rezept-Review im Produktionskontext
- produktionsbezogenen Bearbeitungen
- Einkaufslisten- und Planpflege im Produktionskontext

#### Betriebs-/Audit-Operator
Zuordnen zu:
- Demo-Daten laden / Seed-nahe Betriebswege
- Audit-Feed / Review-Nachweise
- Finalize-Kontext
- interne Betriebs- und Statusaktionen

### 4.3 Read-only bleiben soll

Im MVP sollen bewusst read-only bleiben:
- Exportlinks und Exportartefakte
- Audit-Ansichten
- Detailansichten von Entwuerfen und Spezifikationen, soweit sie keine explizite Bearbeitung ausloesen
- Betriebs- und Statusansichten ohne Schreibwirkung

Read-only bedeutet hier: ansehen, pruefen, nachvollziehen. Nicht: neue Fachzustände erzeugen.

### 4.4 Bestehende Operatornamen / Zuordnungskonvention

Als bereits bestehende Konvention gelten im Repo die folgenden Operatornamen und Minimalrollen:
- `Intake-Mitarbeiter` → Intake-Operator
- `Angebots-Mitarbeiter` → Angebots-Operator
- `Produktions-Mitarbeiter` → Produktions-Operator
- `Betriebs-/Audit-Operator` → Betriebs-/Audit-Operator

Diese Namen sind keine neue Rollenwelt, sondern die vorhandene, normalisierte Zuordnungsbasis fuer den MVP.

## 5. Fuer den MVP verbindliche Mindestzuordnung

### 5.1 Verbindlich

Fuer den MVP ist verbindlich:
- Intake-UI und mutierende Intake-Pfade bleiben dem Intake-Operator zugeordnet.
- Angebots-UI und mutierende Angebots-Pfade bleiben dem Angebots-Operator zugeordnet.
- Produktions-UI und mutierende Produktions-Pfade bleiben dem Produktions-Operator zugeordnet.
- Audit-/Review-/Finalize- und Betriebswege bleiben dem Betriebs-/Audit-Operator zugeordnet.
- Die UI darf diese Zuordnung sichtbar machen, ohne daraus eine neue Login- oder Session-Logik zu machen.

### 5.2 Organisatorisch wichtig, aber nicht als neue Technik formuliert

Wichtig fuer den MVP-Betrieb ist ausserdem:
- Operatornamen im Backoffice sollen konsistent genutzt werden.
- Die UI soll nicht so wirken, als koenne jede Rolle jeden mutierenden Bereich beliebig bedienen.
- Betriebs- und Audit-Wege sollen als separate Verantwortungszone sichtbar bleiben.

## 6. Offene Punkte

Bewusst offen bleibt:
- ob die heutigen Minimalrollen spaeter in eine feinere AuthN/AuthZ-Welt uebergehen
- ob die UI noch deutlicher zwischen Anzeige, Bearbeitung und Betriebsaktion trennt
- ob weitere Operator-Unterteilungen spaeter fachlich noetig sind
- welche Teile der Zuordnung nur organisatorisch und welche spaeter technisch hart durchgesetzt werden
- wie weit die Rollenbeschreibung ausserhalb des aktuellen MVP-Kerns ueberhaupt erweitert werden muss

Diese Punkte sind noch nicht durch einen echten AuthN/AuthZ-Ausbau geklaert und sollen deshalb hier nicht vorweggenommen werden.

## 7. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue Login-/Session-Welt
- keine feingranulare Feldberechtigung
- keine neue externe Nutzerrolle
- keine neue Produktfläche
- keine neue Auth-/RBAC-Architektur
- keine neue Persistenzlogik

Die Dokumentation ordnet nur den bestehenden UI-Kern und die vorhandenen Operatoren fachlich zu.

## 8. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die vorhandenen UI-Bereiche weiter nur den bestehenden Minimalrollen zuordnen
2. die Operatornamen im Backoffice konsistent halten
3. weitere Feinheiten erst dann vertiefen, wenn ein echter AuthN/AuthZ-Ausbau beauftragt wird

Damit bleibt P8 ein schmaler Beta-Gate-Schritt ohne neue Rollenwelt.

## 9. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Kern im UI fachlich sauber zuordnen, ohne eine neue Rollenarchitektur zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
