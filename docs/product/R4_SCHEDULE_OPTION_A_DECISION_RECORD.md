# R4 Schedule-/Zeitfenster-Entscheidungsrecord

Status: Management-Entscheidung / keine Runtime-Implementierung  
Stand: 2026-05-23  
Scope: Entscheidung nach Plan 10 zum Umgang mit der Zeitfenster-/Schedule-Frage im internen Beta-MVP

## 1. Entscheidung

Alexander entscheidet fuer den aktuellen internen Beta-MVP:

**Option A bleibt fuehrend.**

Das verbindliche Zeitfenster / `event.schedule` bleibt im aktuellen Korridor eine manuell sichtbare Klaerungs- und Anleitungslinie. Es wird jetzt **keine** strukturierte Schedule-/Zeitfenster-Runtime gebaut.

## 2. Bedeutung

Damit gilt fuer den aktuellen Stand:

- Die vorhandene Rueckfrage zum Zeitfenster bleibt sichtbar.
- UI-/Runbook-Copy darf erklaeren, dass das Zeitfenster manuell geklaert wird.
- Eine Antwort wird nicht automatisch und nicht halbautomatisch in `event.schedule` ueberfuehrt.
- Plan 10 darf als lokal/synthetisch gruener Rehearsal-Abschluss fuer den internen Demo-/Beta-Korridor stehen bleiben.
- Dieser Entscheid ist **kein** Go fuer echte Daten, produktionsnahe Nutzung, externe Nutzung oder Deployment.

## 3. Nicht entschieden / weiter blockiert

Nicht freigegeben sind:

- neue Schedule-/Zeitfenster-Runtime;
- Spec-Patch-Bindung fuer Zeitfensterantworten;
- neues Zeitfenster-/Schedule-Datenmodell;
- neue API, Persistenz, Prisma oder Migration;
- automatische oder halbautomatische Spec-Korrektur;
- echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten;
- Deployment, Hetzner, SSH, Secrets oder produktive Konfiguration;
- OAuth/Login/OIDC/Auth-Ausbau;
- rechtssichere Audit-/Compliance-/DSGVO-Freigabe;
- produktionsnahe Nutzung.

## 4. Vormerkung fuer spaeter

Option B aus `docs/product/R3_SCHEDULE_ZEITFENSTER_ENTSCHEIDUNGSVORLAGE.md` bleibt der naechste fachlich saubere Pfad, falls Alexander spaeter strukturierte Zeitfensterantworten in Richtung bestehender Spec-Patch-/Review-Grenze freigeben will.

Option C, ein eigenes Schedule-/Zeitfenster-Modell, bleibt ein spaeterer Produktarchitekturpfad und ist fuer den aktuellen Beta-MVP zurueckgestellt.

## 5. Naechster Produktpfad nach dieser Entscheidung

Da Plan 10 lokal/synthetisch gruen ist und Schedule bewusst nicht erweitert wird, ist der naechste sinnvolle Plan-11-Pfad kein Schedule-Featurebau.

Empfohlener naechster Pfad:

**Plan 11 soll den begrenzten internen Pilot mit anonymisierten/synthetischen Daten als Preflight-/Entscheidungskorridor vorbereiten, ohne Deployment, echte Daten, Secrets, Auth-Implementierung, neue API oder Persistenz.**

Fuehrende Grenze bleibt `docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md`:

- interner Demo-Modus: `go`;
- begrenzter interner Pilot mit anonymisierten Daten: bisher `not assessed`, jetzt als naechster Preflight-Korridor vorzubereiten;
- produktionsnaher Pilot mit echten Daten: `blocked`.

## 6. Ergebnis

R4 fuehrt keine Produktlogik ein. Der Nutzen ist eine klare Management-Grenze: Option A bleibt fuer den internen Beta-MVP bestaetigt, Schedule-Featurebau wird nicht autonom gestartet, und der naechste App-Fortschritt soll ueber einen konservativen Pilot-Preflight statt ueber Scheinausbau erfolgen.
