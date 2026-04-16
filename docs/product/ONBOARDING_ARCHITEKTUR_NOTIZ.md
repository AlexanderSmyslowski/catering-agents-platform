# Onboarding für Catering Agents – Architektur- und Produktnotiz

Status: Architektur- und Produktnotiz v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16
Einordnung: späterer Architektur-/Produktstrang, ausdrücklich nicht Teil des aktiven MVP-Umsetzungsblocks

## 1. Zweck der Notiz

Diese Notiz hält die Onboarding-Idee als geplanten Architektur- und Produktentscheid fest.

Sie dient dazu:
- die Idee repo-gebunden zu verankern
- spätere Umsetzung gezielt vorzubereiten
- den aktuellen MVP-/Beta-Pfad nicht mit einer neuen Produktfläche zu zerfasern
- offene Architekturfragen sauber zu sammeln, ohne sie jetzt schon zu beantworten

## 2. Kurzbeschreibung der Onboarding-Idee

Perspektivisch sollen die Catering Agents nicht nur über eine freie Oberflaeche und Dokumentation nutzbar sein, sondern ueber einen gefuehrten Einrichtungsprozess.

Der Nutzer soll schrittweise durch die Inbetriebnahme gefuehrt werden, zum Beispiel bei:
- Nutzerrolle
- beabsichtigter Nutzung des Agenten
- Zugriffsrahmen
- Angebotsquellen
- Rezeptquellen
- relevanten Arbeitskontexten

Die Idee ist nicht, sofort eine neue große Produktoberflaeche zu bauen, sondern einen spaeteren, klar abgegrenzten Einstiegspfad vorzusehen.

## 3. Produktnutzen

Ein gefuehrtes Onboarding soll spaeter helfen:
- Einstiegshuerden fuer interne Nutzer zu senken
- Fehlkonfigurationen in den ersten Nutzungsschritten zu verringern
- Rollen, Quellen und Zugriffe frueh sichtbar und bewusst zu machen
- den Betrieb nicht nur fuer erfahrene Operatoren, sondern auch fuer weniger vorgepraegte Nutzer nachvollziehbar zu machen

## 4. Warum das wichtig ist fuer interne Nutzer und spaetere externe Nutzbarkeit

Fuer interne Nutzer ist Onboarding relevant, weil der aktuelle Produktkern funktional ist, aber nicht automatisch selbsterklaerend bleibt.

Fuer spaetere externe Nutzbarkeit ist die Idee wichtig, weil jede breitere Produktform frueher oder spaeter einen gefuehrten Einstieg braucht. Ohne einen solchen Einstieg entstehen typischerweise:
- zu hohe Erstnutzungshuerden
- unklare Erwartungen an Rollen und Rechte
- uneinheitliche Konfigurationen
- Support- und Schulungsaufwand

Die Notiz markiert diese Anforderung bewusst jetzt, ohne daraus schon eine Plattformisierungsentscheidung abzuleiten.

## 5. Abgrenzung zum aktuellen MVP-/Beta-Pfad

Der aktuelle Repo-Kontext bleibt der fuehrende Rahmen:
- MVP-Kern ist bereits auf interne Nutzung, Stabilitaet und Nachvollziehbarkeit ausgerichtet
- P1 bis P5 sind dokumentarisch konsolidiert
- der Beta-Pfad soll nicht durch eine neue Onboarding-Flaeche zerlegt werden

Daraus folgt:
- Onboarding ist ein spaeterer Strang
- Onboarding ist aktuell nicht Teil des aktiven MVP-Umsetzungsblocks
- Onboarding darf nicht als versteckte Scope-Ausweitung in bestehende Arbeitsplaene hineinrutschen

## 6. Was jetzt ausdruecklich noch nicht umgesetzt wird

Aktuell wird nicht umgesetzt:
- keine neue Onboarding-UI
- keine neue API
- keine Persistenzmigration
- keine neue Produktlinie fuer Provisionierung oder Self-Service
- keine Multi-Tenant- oder Plattformisierungsarchitektur
- keine Vorentscheidung fuer konkrete Wizard-Schritte in der Implementierung
- keine neue Rolle- oder Rechte-Engine

## 7. Zentrale Architekturfragen fuer spaeter

Diese Fragen sind fuer einen spaeteren Umsetzungsschritt zu klaeren:
- Wo lebt der gefuehrte Einstieg fachlich: in der Backoffice-UI, im Setup-Kontext oder als eigener Einstiegsmodus?
- Welche Onboarding-Daten sind reine Erstkonfiguration und welche sind spaeter produktive Arbeitsdaten?
- Wie werden Rolle, Nutzungskontext und Zugriffsrahmen voneinander getrennt?
- Welche Quellen sind nur dokumentarisch anzugeben und welche muessen technisch pruefbar referenziert werden?
- Wie werden Angebots- und Rezeptquellen im Setup nur verknuepft statt neu modelliert?
- Wie wird ein Setup-Zustand vom laufenden Betriebszustand abgegrenzt?
- Welche Werte duerfen nur einmalig im Onboarding gesetzt werden und welche bleiben spaeter editierbar?
- Wie viel Persistenz ist fuer einen Setup-Zustand notwendig, ohne vorschnell eine neue Datenwelt einzufuehren?

## 8. Einordnung in Rollen, Quellen, Zugriffe, Setup-Zustand und Persistenz

Die spaetere Onboarding-Funktion muss sich vermutlich an die bereits bestehenden Kernbereiche anlehnen:
- Rollen: Nutzerrolle und Operator-Kontext
- Quellen: Angebotsquellen, Rezeptquellen und weitere fachliche Eingangsquellen
- Zugriffe: sichtbare und bewusst gesetzte Zugriffsgrenzen
- Setup-Zustand: Erstkonfiguration versus laufende Nutzung
- Persistenz: nur so viel wie fuer einen belastbaren Einrichtungszustand wirklich noetig ist

Wichtig ist dabei: Diese Notiz legt noch keine technische Form fest. Sie markiert nur, welche Dimensionen spaeter zusammen gedacht werden muessen.

## 9. Risiken bei zu frueher oder zu spaeter Umsetzung

Zu fruehe Umsetzung birgt das Risiko:
- eine noch nicht stabil abgegrenzte Produktoberflaeche aufzubauen
- den MVP/Beta-Pfad zu vermischen
- Konfigurations- und Betriebsfragen vorschnell zu verhaerten
- neue Persistenz oder UI-Strukturen ohne klaren Nutzen zu schaffen

Zu spaete Umsetzung birgt das Risiko:
- dass die Plattform fuer neue Nutzer unnoetig schwer zugänglich bleibt
- dass Wissen nur in Koepfen oder Handbuechern landet
- dass spaetere externe Nutzbarkeit durch fehlenden gefuehrten Einstieg erschwert wird

## 10. Empfohlener spaeterer Einstiegspunkt

Der empfohlene spaetere Einstiegspunkt ist nicht eine breite Produktinitiative, sondern ein kleiner, klar abgegrenzter Setup-/Onboarding-Strang nach weiter gefestigtem MVP-/Beta-Betrieb.

Sinnvoll ist dann ein schmaler Startpunkt mit:
- klarer Nutzerzuordnung
- klarer Rollenwahl
- klarer Quellenreferenz
- klarer Abgrenzung zwischen Erstkonfiguration und laufendem Betrieb

Bis dahin bleibt die Idee bewusst als Architektur- und Produktentscheidung vorgemerkt.