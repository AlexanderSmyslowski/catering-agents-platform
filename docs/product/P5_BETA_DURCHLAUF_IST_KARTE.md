# P5-B49 Beta-Durchlauf Ist-Karte

Status: Doku-/Vertragstest-only Ist-Karte fuer Build Plan 5 Cycle P5-B49
Stand: 2026-05-22
Scope: vorhandene Web-App und bestehende Demo-/Smoke-Anker; keine neue Runtime-Funktion, keine neue API, keine neue Persistenz

## 1. Zweck

Diese Ist-Karte benennt den aktuellen internen Beta-Durchlauf aus Nutzersicht:

`Start -> Angebot -> Produktion -> Exporte/Audit`

Sie macht sichtbar, was im bestehenden Repo bereits intern nutzbar ist, was nur dokumentiert oder intern abnahmefaehig ist, was blockiert bleibt und welche vorhandenen Tests den Weg schon schuetzen.

## 2. Nutzerweg im Ist-Zustand

1. Start `/`
   - Einstieg ueber die bestehende Startseite mit Agentenwahl und internem Beta-Kontrollzentrum.
   - Nutzer sieht Demo-/Erfassungs-/Angebots-/Produktions-/Export-/Audit-Bezug aus bestehenden Daten.
2. Angebot `/angebot`
   - Nutzer kann eine Anfrage in der vorhandenen Angebotsflaeche pruefen oder den Demo-/Fixture-Kontext nachvollziehen.
   - Sichtbar bleiben Angebotsentwurf, Spec-/Request-Bezug, Uebergabeanker, Angebots-HTML und Audit-/Operator-Kontext.
3. Produktion `/produktion`
   - Nutzer sieht Spezifikationskontext, Rueckfragenstatus, beantwortete Rueckfragen, Produktionsobjekte, Einkaufslistenstatus, Rezeptpruefstatus sowie Herkunft/Uebergabe.
   - Wenn Objekte fehlen oder blockiert sind, soll die UI den Zustand ruhig benennen statt eine Freigabe zu behaupten.
4. Exporte/Audit
   - Vorhandene read-only Arbeitsbelege sind Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML, Einkaufsliste-CSV und Audit-Trail.
   - Diese Artefakte bleiben interne Arbeitsbelege und keine externe oder rechtssichere Freigabe.

## 3. Intern nutzbar

- Lokaler Demo-/Abnahmeweg mit bestehenden Scripts `npm run local:start`, `npm run local:status`, `npm run local:check` und `npm run local:stop`.
- Startseite `/` als ruhiger Einstieg in die bestehenden Agentenflaechen.
- Angebotsroute `/angebot` fuer Anfrage, Entwurf, Exportstatus und Uebergabeanker.
- Produktionsroute `/produktion` fuer Rueckfragenstatus, Ergebnisobjekte, Einkauf/Downloads, Rezeptstatus und Herkunft/Audit.
- Read-only Exporte als interne Arbeitsbelege: Angebots-HTML, Produktionsblatt-/Produktionsplan-HTML und Einkaufsliste-CSV.
- Audit-Trail als interner Betriebs-/Kontrollnachweis fuer Demo- und Operator-Aktionen.

## 4. Nur dokumentiert / nur intern abnahmefaehig

- C8 beschreibt den reproduzierbaren internen Demo-/Abnahmeweg; daraus folgt keine Produktionsfreigabe.
- PA6/B11/B12/B24 ordnen Beta-, Demo- und Pilot-Grenzen dokumentarisch ein.
- Trusted-Actor-/Proxy-/IAP-Annahmen sind als Architektur- und Vertragstestanker dokumentiert, aber kein fertiges Login-/OIDC-System.
- Rueckfragenantworten sind im aktuellen Plan-4-Korridor read-only nachvollziehbar; sie korrigieren die fachliche Spec nicht automatisch.

## 5. Blockiert

- keine echten Daten: keine echten Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten ohne separate Gate-Entscheidungen.
- keine Produktionsfreigabe und keine externe Freigabe aus lokalen Demo- oder Smoke-Signalen.
- kein Deployment und keine SSH-Verbindung im P5-B49-Korridor.
- keine neue Persistenz, keine Migration und keine neue Datenwelt.
- kein OAuth/Login/OIDC und keine produktionsnahe AuthN/AuthZ-Implementierung.
- keine automatische Spec-Korrektur aus Rueckfragenantworten.
- keine Rezept-/Allergenautomatik und keine rechtssichere Compliance-/Audit-Behauptung.
- keine LLM-/Tool-Use-/OCR-/Parser-Erweiterung.

## 6. Schon testbar

- `tests/backoffice-route-smoke.test.ts` schuetzt Startseite, Angebotsroute, Handoff-/Exportanker und sichere Intake-/Audit-Marker.
- `tests/backoffice-production-acceptance-smoke.test.ts` schuetzt Produktionsroute, Rueckfragenstatus, Ergebnisobjekte, Einkauf/Downloads, Rezeptstatus und Herkunft/Audit.
- `tests/backoffice-internal-usage-smoke.test.ts` schuetzt einen schmalen internen Nutzpfad bis zur Produktionssicht.
- `tests/local-ops-check-contract.test.ts` schuetzt lokale Demo-/Export-/Audit-Anker und die C8-Auffindbarkeit.
- `entfernter Doku-Contract-Test` schuetzt diese Ist-Karte als repo-verankerten P5-B49-Durchlaufanker.

## 7. P5-B49-Ergebnis

Der vorhandene Weg ist als interner Demo-/Beta-Durchlauf auffindbar und teilweise bereits UI-/Smoke-gesichert. Der groesste Nutzwert fuer die naechsten Plan-5-Cycles liegt nicht in neuer Produktlogik, sondern in kleinen sichtbaren UI-/Copy-Schaerfungen der bestehenden Routen, damit interne Nutzer den naechsten Schritt ohne Entwicklerkontext erkennen.
