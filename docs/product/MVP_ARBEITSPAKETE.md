# MVP-Arbeitspakete – Catering Agents Platform

Status: Entwurf v0.1 auf Basis von `docs/product/PFLICHTENHEFT.md` und dem aktuellen Repo-Iststand

Stand: 2026-04-11

## 1. Zweck des Dokuments

Dieses Dokument uebersetzt das repo-gebundene Pflichtenheft in eine kleine, priorisierte und praktisch nutzbare MVP-Arbeitspaketliste.

Es dient dazu:
- die naechsten kleinen sinnvollen Arbeitsschritte zu ordnen
- bereits vorhandene Umsetzung klar von echten Luecken zu trennen
- keine neue Roadmap zu erfinden
- den aktuellen konsolidierten Stand in umsetzbare Folgepakete zu ueberfuehren

## 2. Bezug auf `docs/product/PFLICHTENHEFT.md`

Das Pflichtenheft beschreibt den aktuellen Produkt- und Arbeitsrahmen der Catering Agents Platform.
Dieses Dokument leitet daraus nur die naechsten konkreten MVP-Pakete ab und bleibt bewusst enger als eine generische Projektroadmap.

Leitannahmen aus dem Pflichtenheft:
- Governance ist bis Stufe 6c fachlich gruen und abnahmefaehig.
- M1 Owned Memory Foundation ist vorerst konsolidiert und abgeschlossen.
- Es gibt keinen impliziten Auftrag fuer neue Produktflaeche.
- Der Fokus liegt auf interner Stabilisierung, Klarheit und belastbarer Nutzung.

## 3. aktueller Ableitungsstand

### 3.1 Bereits vorhanden / bereits umgesetzt

Aus dem aktuellen Repo-Stand und den führenden Dokumenten sind bereits belastbar vorhanden:
- `offer-service`
- `intake-service`
- `production-service`
- `shared-core`
- `print-export`
- `backoffice-ui`
- lokaler Stack-Start via `npm run local:start`
- dokumentierter Hetzner-/Reverse-Proxy-/HTTPS-Rahmen
- Audit- und Review-Kontext
- Governance-Pfad bis Stufe 6c
- konsolidierter M1-Memory-Strang
- gruener automatisierter Vitest-Korridor

### 3.2 Priorisierte MVP-Luecken

Aus Pflichtenheft und Repo-Iststand ergeben sich aktuell vor allem diese Luecken:
1. Rollen- und Rechtebild sind jetzt erst teilweise formalisiert: die zentrale Konvention und erste Production-Guards existieren, die restlichen relevanten Pfade sind noch nicht durchgehend angeschlossen.
2. Die Bedienung des Kernpfads ist noch nicht durch eine schmale Browser-/Smoke-Abdeckung abgesichert.
3. Der Betriebs- und Deployment-Rahmen ist dokumentiert, aber fuer MVP-Freigabe und Reproduzierbarkeit weiter zu haerten.
4. Datenschutz-, Aufbewahrungs- und Autorisierungsfragen sind beschrieben, aber noch nicht voll operationalisiert.
5. Die Abgrenzung zwischen MVP-Kern und bewusst nicht verfolgten Erweiterungen muss weiter scharf gehalten werden.

## 4. empfohlene Arbeitspakete in sinnvoller Reihenfolge

### Arbeitspaket 1: Rollen-, Rechte- und Autorisierungsbild konsolidieren

**Prioritaet:** P1

**Ziel:**
Ein belastbares, repo-konsistentes Rollen- und Rechtebild fuer die internen Nutzerrollen herstellen.

**Kurzbeschreibung:**
Das Pflichtenheft benennt bereits Angebots-Ersteller, Produktionsplanung/Kueche und interne Operatoren. Im Repo ist die erste zentrale Rollen-/Rechte-Konvention bereits verankert und erste Production-Pfade sind geschuetzt; dieses Paket praezisiert nun die verbleibenden Aktionen und Pfade, die noch an dieselbe Konvention angeschlossen werden muessen.

**Begruendung:**
Dies bleibt die wichtigste Grundlage, weil Sicherheit, Bedienbarkeit und Betrieb davon direkt abhaengen und die erste reale Verankerung jetzt anschlussfaehig fortgesetzt werden muss.

**Abhaengigkeiten:**
- `docs/product/PFLICHTENHEFT.md`
- `README.md`
- `docs/deployment-and-versioning.md`
- vorhandene UI- und Servicepfade

**Definition of Done:**
- Rollen sind eindeutig beschrieben.
- Rechte pro Kernaktion sind benannt.
- AuthN/AuthZ-Entscheidungen sind dokumentiert oder minimal im System verankert.
- Offene Punkte sind klar abgegrenzt.

### Arbeitspaket 2: Browser-/Smoke-Absicherung der Kernpfade

**Prioritaet:** P2

**Ziel:**
Die wichtigsten End-to-End-Kernpfade im UI gegen offensichtliche Regressionsrisiken absichern.

**Kurzbeschreibung:**
Die bestehenden Vitest-Tests decken bereits zentrale Logik ab. Als naechster kleiner Schritt braucht der MVP eine schmale Browser- oder Smoke-Absicherung fuer die wichtigsten Benutzerwege im Backoffice.

**Begruendung:**
Der Repo-Stand ist fachlich gruen, aber die UI- und Bedienkette ist noch nicht in einem gleichwertigen, schlanken Smoke-Korridor abgesichert.

**Abhaengigkeiten:**
- Backoffice-UI
- bestehende Servicepfade
- lokaler Start und Testumgebung

**Definition of Done:**
- mindestens ein schmaler Smoke-Pfad laeuft reproduzierbar
- Kernansicht ist erreichbar
- ein minimaler produktiver UI-Fluss ist sichtbar verifiziert
- keine neue Produktflaeche wird eingefuehrt

### Arbeitspaket 3: Betriebs- und Deployment-Rahmen fuer den MVP haerten

**Prioritaet:** P3

**Ziel:**
Den dokumentierten lokalen und Hetzner-orientierten Betriebsrahmen so praezisieren, dass er fuer den MVP als belastbare Arbeitsgrundlage dient.

**Kurzbeschreibung:**
Die Betriebswege sind bereits dokumentiert. Dieses Paket schaerft die operative Reproduzierbarkeit: Start, Status, Stop, Proxy-Rahmen, Datenhaltung und minimale Betriebsannahmen.

**Begruendung:**
Ein interner Produktkandidat ist nur dann stabil nutzbar, wenn der Betrieb nicht nur beschrieben, sondern in einer klaren Minimalform reproduzierbar ist.

**Abhaengigkeiten:**
- `README.md`
- `docs/deployment-and-versioning.md`
- lokaler Stack
- vorhandene Deploy-Skripte / Infra-Dokumentation

**Definition of Done:**
- Start-/Status-/Stop-Rahmen ist nachvollziehbar
- Datenhaltungsmodus ist eindeutig beschrieben
- Zielumgebung und lokaler Betrieb sind sauber voneinander getrennt
- offene Betriebsannahmen sind benannt

### Arbeitspaket 4: Audit-, Review- und Nachvollziehbarkeitsrahmen operationalisieren

**Prioritaet:** P4

**Ziel:**
Die bereits vorhandene Audit- und Review-Idee so zu strukturieren, dass sie fuer den MVP als klare operative Nachvollziehbarkeit dient.

**Kurzbeschreibung:**
Das Pflichtenheft benoetigt eine nachvollziehbare Zuordnung mutierender Aktionen, sichtbare Review-Pfade und eine klare Trennung von finalisiert und freigegeben. Dieses Paket ordnet die dazugehoerigen Erwartungen und minimalen Nachweise.

**Begruendung:**
Der Produktkern ist nur dann intern belastbar, wenn Aenderungen und Entscheidungen im Alltag nachvollziehbar bleiben.

**Abhaengigkeiten:**
- Governance-Stand bis 6c
- Audit-Feed / Audit-Log
- bestehende Review-Pfade

**Definition of Done:**
- Audit-/Review-Begriffe sind einheitlich beschrieben
- Operator-Zuordnung ist konsistent
- offenen Compliance-Fragen sind sichtbar markiert
- keine neue Freigabelogik wird still eingefuehrt

### Arbeitspaket 5: MVP-Abgrenzung pro Kernbereich final scharfziehen

**Prioritaet:** P5

**Ziel:**
Den MVP-Kern gegen unbeabsichtigte Erweiterungen absichern.

**Kurzbeschreibung:**
Das Pflichtenheft benennt bereits den internen Kern und die expliziten Out-of-Scope-Punkte. Dieses Paket praezisiert die Abgrenzung pro Service- und UI-Bereich, damit Folgearbeit nicht implizit in neue Produktflaechen kippt.

**Begruendung:**
Nach dem aktuellen Konsolidierungsstand ist die wichtigste Schutzfunktion nicht Expansion, sondern saubere Begrenzung.

**Abhaengigkeiten:**
- `docs/product/PFLICHTENHEFT.md`
- `memory.md`
- `README.md`
- `docs/architecture/MEMORY_ARCHITECTURE.md`

**Definition of Done:**
- MVP-Kern und Out-of-Scope sind pro Bereich klar benannt
- keine neuen Produktversprechen entstehen
- offene Punkte sind explizit markiert

## 5. bereits vorhanden / bereits umgesetzt

Diese Elemente sind als Arbeitsgrundlage bereits vorhanden und muessen nicht als neue MVP-Pakete erfunden werden:
- zentrale Services fuer Intake, Angebot, Produktion und Exporte
- Backoffice-UI
- dokumentierter lokaler Start
- dokumentierter Betriebsrahmen
- Governance bis 6c
- konsolidierter M1-Stand
- gruene bestehende Vitest-Absicherung
- zentrale Rollen-/Rechte-Konvention im `shared-core`
- geschuetzte Production-Pfade: `GET /v1/production/audit/events` und `POST /v1/production/seed-demo`

## 6. ausdruecklich nicht Teil des aktuellen MVP

- neue Multi-Tenancy
- White-Label- oder Plattformvermarktung
- neue API-Endpunkte ohne expliziten Auftrag
- neue Persistenzsysteme oder Prisma als neuer Kern
- Hard-Approve
- Snapshots / `lastHardApproved`
- Point-of-no-return-Ausbau
- ChangeItem-Persistenz oder -Anzeige
- weitere Governance-Fachbloecke
- neue Produktflaechen ausserhalb des dokumentierten Kerns

## 7. Risiken / offene Punkte

- Rollen- und Rechtebild ist erst teilweise operationalisiert; die naechsten relevanten Pfade muessen noch an die bestehende Konvention angeschlossen werden.
- Browser-/Smoke-Absicherung ist im aktuellen Testkorridor noch nicht gleichwertig zum Unit-/Logikteststand.
- Betriebs- und Deployment-Annahmen sind dokumentiert, aber fuer eine echte Freigabe noch weiter zu schliessen.
- Datenschutz- und Aufbewahrungsfragen sind aktuell nur teilweise konkretisiert.

## 8. empfohlene naechste Konkretisierung

Die naechste sinnvolle Konkretisierung ist nicht ein neuer Fachblock, sondern die Auswahl von Arbeitspaket 1 als fachlichem Anker, gefolgt von Arbeitspaket 2 fuer die sichtbare Bedienabsicherung.

Damit bleibt die weitere Arbeit klein, real und direkt an den aktuellen Repo-Stand gebunden.
