# P7 Betriebsfreigabe / MVP-Freigabekriterien – Mini-Spezifikation

Status: Mini-Spezifikation v0.1 auf Basis des aktuellen Repo-Iststands
Stand: 2026-04-16

## 1. Zweck und Abgrenzung

Diese Mini-Spezifikation begrenzt die Betriebsfreigabe fuer den MVP der `AlexanderSmyslowski/catering-agents-platform` auf einen kleinen, repo-gebundenen Go/No-Go-Rahmen.

Sie erfindet keine neue Release-Plattform, keine neue Monitoring-/Observability-Architektur und keine neue Compliance-Vollabdeckung. Ziel ist ausschliesslich, den bereits realen MVP-Betrieb so zu formulieren, dass klar bleibt:
- was fuer einen internen Beta-/MVP-Betrieb vorhanden sein muss
- was als Go/No-Go-Kriterium gilt
- was vor Freigabe nur dokumentiert oder organisatorisch geklaert sein muss
- was bewusst offen bleiben darf

## 2. Bezug auf Pflichtenheft, MVP-Arbeitspakete, P3, P4, P5, P6 und Memory

Grundlagen dieses Dokuments sind:
- `docs/product/PFLICHTENHEFT.md`
- `docs/product/MVP_ARBEITSPAKETE.md`
- `docs/product/P3_BETRIEB_DEPLOYMENT_MINISPEZ.md`
- `docs/product/P4_AUDIT_REVIEW_MINISPEZ.md`
- `docs/product/P5_MVP_ABGRENZUNG_MINISPEZ.md`
- `docs/product/P6_AUFBEWAHRUNG_LOESCHUNG_ARCHIVIERUNG_MINISPEZ.md`
- `memory.md`
- der aktuelle Repo-Iststand im lokalen Stack, in der UI, im Exportpfad und in den Audit-/Guard-Pfaden

Wesentliche Ableitung:
- Das Pflichtenheft beschreibt eine interne, nachvollziehbare Betriebsplattform mit operativen Artefakten.
- P3 begrenzt den Betriebs- und Deployment-Rahmen.
- P4 begrenzt die Nachvollziehbarkeit und Audit-/Review-Sicht.
- P5 begrenzt den MVP-Kern pro Bereich.
- P6 begrenzt Aufbewahrung, Archivierung und Loeschung als konservative Ordnungsfrage.
- P7 fasst diese bereits realen Grenzen zu einem kleinen Freigaberahmen zusammen, ohne daraus eine neue Betriebswelt zu machen.
- `memory.md` bleibt der Kurzanker fuer die konsolidierten Repo-Fakten.

## 3. Aktueller repo-gebundener Freigabekontext

### 3.1 Bereits vorhanden

Fuer den aktuellen MVP-Betrieb sind im Repo bereits folgende Bausteine sichtbar:
- lokaler Stack-Start, Status und Stop
- UI auf den Kernrouten `/`, `/angebot` und `/produktion`
- schmaler UI-/Smoke-Korridor fuer diese Routen
- read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste
- Audit-/Review-/Finalize-Nachweise ueber die geschuetzten Kernpfade
- zentrale Rollen-/Guard-Grundlage im `shared-core`
- konservative Grenzen fuer Aufbewahrung, Archivierung und Loeschung

### 3.2 Konkrete Betriebsbausteine, auf die sich die Freigabe stuetzen kann

- lokaler Stack ist reproduzierbar startbar und statusfaehig
- die UI zeigt die zentralen Kernbereiche und die route-eindeutigen Marker fuer Angebots- und Produktionsansicht
- die drei read-only Exportpfade sind real pruefbar
- Audit-/Review-/Finalize-Pfade sind geschuetzt und testseitig belegt
- P1-Guards decken die zentralen mutierenden Kernpfade ab
- P6 verhindert, dass Aufbewahrung oder Archivierung stillschweigend zu einer neuen Produktwelt wird

## 4. Kleinste MVP-Freigabekriterien

### 4.1 Go-Kriterien fuer internen Beta-/MVP-Betrieb

Der MVP gilt fuer den internen Betrieb nur dann als freigabefaehig, wenn alle folgenden Punkte erfuellt sind:

1. Der lokale Stack ist mit den vorhandenen Start-/Status-Pfaden reproduzierbar.
2. Die Kern-UI ist erreichbar und die Routen `/`, `/angebot` und `/produktion` liefern ihre route-eindeutigen Marker.
3. Die drei read-only Exportpfade fuer Angebot, Produktionsblatt und Einkaufsliste sind erreichbar und liefern die erwarteten Artefakte.
4. Die Audit-/Review-/Finalize-Pfade sind im Repo geschuetzt und nachvollziehbar verifiziert.
5. Die zentrale Rollen-/Guard-Grundlage fuer die mutierenden Kernpfade ist vorhanden.
6. Aufbewahrung, Archivierung und Loeschung sind konservativ begrenzt; es gibt keine stillschweigende automatische Retention-Logik.

### 4.2 No-Go-Kriterien

Der MVP ist fuer den internen Betrieb nicht freigabefaehig, wenn eines der folgenden Dinge zutrifft:
- der lokale Stack ist nicht reproduzierbar start- und statusfaehig
- eine der Kernrouten ist nicht erreichbar oder liefert nicht die erwarteten route-eindeutigen Marker
- ein read-only Exportpfad faellt aus oder ist nicht mehr nachvollziehbar pruefbar
- Audit-/Review-/Finalize-Nachweise sind nicht mehr verifizierbar
- die zentralen Guards fuer die mutierenden Kernpfade sind gebrochen
- eine automatische Retention-, Compliance- oder Archivlogik waere bereits still aktiv, ohne dass sie bewusst freigegeben wurde

### 4.3 Vor Freigabe nur dokumentiert oder organisatorisch zu klaerende Punkte

Vor einer internen Freigabe muessen nicht technisch implementiert, aber dokumentiert oder organisatorisch geklaert sein:
- wer den internen Betriebsoperator darstellt
- welcher lokale oder servernahe Betriebsweg als Referenzweg gilt
- welche Demo- oder Testdaten bewusst mitlaufen duerfen
- wie der Operator mit Archivierungs- oder Loeschentscheidungen umgeht
- welche Pfade fuer Freigabe als read-only gelten und welche nicht

### 4.4 Bewusst offen bleibende Punkte

Offen bleiben fuer den MVP bewusst:
- formale Release- oder Rollout-Mechanik
- detaillierte Compliance-Vollabdeckung
- feingranulare AuthN/AuthZ-Weiterentwicklung ueber die bestehende Grundlage hinaus
- grosse Observability- oder Monitoring-Plattform
- neue Betriebsfluesse ausserhalb des aktuellen MVP-Kerns
- neue Endpunkte

## 5. Go/No-Go-Rahmen in der kleinsten Form

### Go

Go heisst im MVP-Kontext:
- der Repo-Stand laesst sich lokal reproduzieren
- die Kern-UI ist erreichbar
- die Kern-Exporte sind pruefbar
- Audit-/Review-/Finalize-Nachweise sind vorhanden
- Rollen-/Guards sind auf den aktuellen Kernpfad abgestimmt
- Aufbewahrung und Loeschung sind nicht als neue, unkontrollierte Produktwelt ausgeweitet

### No-Go

No-Go heisst im MVP-Kontext:
- ein Kernpfad ist gebrochen oder nicht mehr nachvollziehbar
- der lokale Betriebsweg ist nicht reproduzierbar
- die Exportpfade sind nicht mehr belastbar
- Guards oder Audit-Nachweise sind verschwunden oder uneindeutig
- die Betriebsfreigabe wuerde implizit eine neue Plattform-, Compliance- oder Observability-Architektur einfuehren

## 6. Klare Abgrenzung

Diese Mini-Spezifikation fuehrt ausdruecklich nicht ein:
- keine neue Release-Plattform
- keine neue Compliance-Vollabdeckung
- keine neue Auth-/RBAC-Welt
- keine neue Monitoring-/Observability-Architektur
- keine neuen Endpunkte
- keine neue Persistenzlogik
- keine neue Produktfamilie

Die Freigabe wird hier nur als kleiner, interner Go/No-Go-Rahmen gefasst.

## 7. Empfohlener kleinster naechster Schritt

Der naechste Schritt sollte weiterhin nur Klärung und Begrenzung sein, nicht Implementierung:
1. die hier genannten Go-/No-Go-Kriterien als internen Referenzrahmen festhalten
2. die Rollen fuer Betrieb, Audit und manuelle Entscheidung knapp benennen
3. offene Fristen, Rollen oder Betriebsannahmen erst spaeter technisch vertiefen

Damit bleibt P7 ein schmaler Beta-Gate-Schritt ohne neue Produktwelt.

## 8. Einordnung

Diese Mini-Spezifikation ist absichtlich konservativ.
Sie soll den aktuellen MVP-Betrieb freigabefaehig begrenzen, ohne eine neue Betriebsplattform zu erfinden.

Alles darueber hinaus bleibt spaeteren, explizit beauftragten Schritten vorbehalten.
