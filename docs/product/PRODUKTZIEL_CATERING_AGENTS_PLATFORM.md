# PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md

## Zweck

Dieses Dokument beschreibt das eigentliche Ziel der Catering Agents Platform in knapper, pruefbarer Form.

Es dient als Zielanker fuer Codex-/Hermes-Reviews, Produktentscheidungen, Scope-Kontrolle und weitere kleine Umsetzungsslices. Es ersetzt nicht `memory.md`, `README.md` oder die Detaildokumente, sondern fasst die Zielrichtung zusammen.

---

## Kurzfassung

Ziel ist eine interne, praxistaugliche Catering-Arbeitsplattform, die aus eingehenden Catering-Anfragen strukturiert verwertbare Angebots-, Produktions-, Einkaufslisten-, Export- und Audit-Arbeitsbelege erzeugt.

Die Plattform soll den realen Arbeitsfluss von The One / CommCats unterstuetzen:

```text
Intake -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit
```

Der aktuelle Zielbetrieb ist ein kontrollierter interner MVP-/Beta-Korridor. Externe Kundennutzung, oeffentliche Produktfreigabe, echte Multi-Tenant-Plattform, White-Label-Rollout und produktionsnahe echte Datenverarbeitung sind ohne gesonderte Gates nicht Teil des aktuellen freigegebenen Ziels.

---

## Produktziel

Die Catering Agents Platform soll den operativen Catering-Prozess schrittweise entlasten:

- Catering-Anfragen und Dokumente werden erfasst und in strukturierte Event-Spezifikationen ueberfuehrt.
- Der Angebotsagent unterstuetzt Angebotsentwurf, Varianten, Uebergabe und Angebots-HTML-Export.
- Der Produktionsagent unterstuetzt Produktionsplanung, Rueckfragen, Rezept-/Mengenbezug, Produktionsblatt, Einkaufsliste und Produktions-Exports.
- Die Backoffice-UI bietet eine ruhige, interne Arbeitsoberflaeche fuer Start, Angebot, Produktion, Rueckfragen, Exporte und Audit-/Handoff-Belege.
- Gemeinsame Kernmodelle, Regeln, Rollen-/Guard-Mechanik und Audit-Spuren bleiben im `shared-core` bzw. in den bestehenden Services verankert.
- Exporte und Audit-/Review-Spuren sind interne Arbeits- und Kontrollbelege, keine rechtssichere Compliance- oder externe Freigabeaussage.

---

## Aktueller Arbeitsmodus

Aktuell geht es nicht um moeglichst viele neue Features, sondern um einen stabilen, nachvollziehbaren internen MVP-Korridor.

Fuehrend ist:

- kleine echte Bausteine statt grosser Architekturverschiebungen;
- keine neue Persistenzwelt / kein Prisma ohne ausdrueckliche Entscheidung;
- Governance additiv, nicht als zweiter Kern;
- `ApprovalRequestRecord` bleibt fuehrende Freigabewahrheit;
- `SpecGovernanceStateRecord` bleibt Statusspur;
- `SpecChangeSetRecord` bleibt Aenderungseinheit;
- Finalize ist nicht gleich Freigabe;
- M1 Owned Memory Foundation bleibt intern, modellagnostisch und ohne neue API-/Persistenz-/UI-Flaeche;
- die aktuelle Phase ist eine Konsolidierungsphase ohne neue Fachlogik, sofern kein enger Auftrag etwas anderes verlangt.

---

## Nicht-Ziele im aktuellen Stand

Aktuell nicht Ziel und nicht stillschweigend einzufuehren:

- neue Produktflaeche ohne ausdruecklichen Auftrag;
- echte Multi-Tenant-Runtime oder Plattformisierung als operativer Kern;
- externe Kundennutzung oder oeffentliche Produktfreigabe;
- produktionsnahe Verarbeitung echter Kunden-, Personen-, Event-, Angebots-, Rezept- oder Produktionsdaten ohne freigegebene Gates;
- neue Auth-/Login-/OIDC-/Session-Welt ohne bewusste Architekturentscheidung;
- neue API-Endpunkte, neue Persistenz, Prisma, Migrationen oder Datenmodell-Grossschnitt ohne ausdrueckliche Entscheidung;
- automatische Spec-Korrektur, Rezept-/Allergenautomatik, LLM-/Tool-Use-Ausbau, OCR-/Parser-Engine-Ausbau oder echte Upload-Verarbeitung ausserhalb der dokumentierten Gates;
- Deployment, SSH, Secrets, produktive ENV, Serveraenderungen, Backup-Aktivierung oder Live-Datenaktionen ohne explizite Freigabe;
- rechtssichere Compliance-, Audit-, DSGVO-, AVV-, SLA- oder externe Freigabe-Behauptungen.

---

## Zielnutzer im MVP-Korridor

### Interne Angebots-/Backoffice-Nutzung

Die interne Angebots-/Backoffice-Nutzung braucht:

- klare Erfassung bzw. Uebernahme von Catering-Anfragen;
- pruefbare Angebotsentwuerfe und Varianten;
- sichtbare Uebergabe in die Produktion;
- nachvollziehbare Export- und Handoff-Anker;
- einfache Reibungsnotizen fuer Beta-/Rehearsal-Durchlaeufe.

### Interne Produktion / Kuechenplanung

Die interne Produktion braucht:

- verstaendliche Produktionskontexte;
- klare Rueckfragen statt Scheinautomatik;
- sichtbare Ergebnisobjekte;
- Produktionsblatt, Einkaufslistenbezug und Exportanker;
- Herkunfts-, Quellen-, Audit- und Handoff-Kontext;
- klare Stop-Gates bei fehlenden Daten, unklaren Quellen oder nicht freigegebenen echten Uploads.

### Alexander / Betreiberrolle

Alexander braucht:

- eine belastbare Management- und Go/No-Go-Sicht;
- klare Trennung zwischen intern testbar, nur dokumentiert, offen, blockiert und out of scope;
- konservative Freigabegrenzen fuer echte Daten, Deployment, Auth, Retention, Backup, Sandbox/Worker/AV und Compliance;
- kleine entscheidbare Folgeschritte statt Feature-Sammelbecken.

---

## Qualitaetsziel

Die Plattform soll zuerst intern vertrauenswuerdig werden.

Prioritaet haben:

1. Nachvollziehbarkeit: Jede relevante Uebergabe, Rueckfrage, Export- und Auditspur muss verstaendlich bleiben.
2. Scope-Kontrolle: Keine verdeckte Ausweitung in Plattform, Multi-Tenant, externe Nutzung oder echte Daten.
3. Bedienbarkeit: Der interne Pfad `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` muss ruhig und pruefbar bleiben.
4. Daten- und Quellenvorsicht: Rohtexte, Vollhashes, sensible Inhalte und echte Daten duerfen nicht unkontrolliert gespiegelt oder verarbeitet werden.
5. Testbarkeit: Kernpfade, UI-Marker, Verträge und lokale Runbooks bleiben test-/smoke-gesichert.
6. Betriebsreife: Hetzner-/Option-B-Vorbereitung bleibt nicht-sensitiv, gate-basiert und ohne stilles Deployment.
7. Ehrliche Freigabelogik: Interne Demo-/Beta-/Rehearsal-Signale sind keine Produktions-, Kunden- oder Compliance-Freigabe.

---

## Aktueller Reifegrad

Der aktuelle Stand ist ein interner MVP-/Beta-/Rehearsal-Korridor.

Verbindliche Einordnung:

```text
Lokaler interner Demo-/Rehearsal-Korridor: nutzbar/pruefbar unter dokumentierten Grenzen
Begrenzter interner Pilot mit anonymisierten oder synthetischen Daten: entscheidungsbeduerftig / not assessed
Produktionsnahe Nutzung mit echten Daten: blocked bis Gates bewusst freigegeben sind
Externe Kundennutzung / oeffentlicher Rollout: blocked
```

Das bedeutet:

- Gruene Tests, lokale Smokes und Export-/Auditbelege zeigen interne technische Reife, aber keine externe Freigabe.
- Echte Daten, Deployment, Auth, PII/Retention/Backup, Sandbox/Worker/AV und Compliance bleiben eigene Gates.
- Neue Produktfaehigkeiten duerfen nur als enger, begruendeter und testbarer Slice umgesetzt werden.

---

## Entscheidungsregel fuer neue Arbeit

Jede neue Code-, Doku-, Review-, Deploy- oder Produktaufgabe soll gegen diese Fragen geprueft werden:

1. Staerkt sie direkt den bestehenden internen MVP-Korridor oder die Nachvollziehbarkeit?
2. Ist sie klein, reversibel und innerhalb vorhandener Architektur-/Persistenz-/API-Grenzen?
3. Fuehrt sie neue Produktflaeche, neue API, neue Persistenz, echte Daten, Deployment, Auth oder externe Freigabeversprechen ein?
4. Gibt es eine klare Verifikation durch Test, Smoke, Doku-Vertrag oder nachvollziehbaren Review?
5. Trennt sie sauber zwischen umgesetzt, fachlich beschrieben, offen, blockiert und out of scope?

Wenn Punkt 3 zutrifft oder Punkt 4 fehlt, ist die Aufgabe zunaechst zu stoppen oder ausdruecklich neu freizugeben.

---

## Praktischer Zielzustand vor dem naechsten groesseren Reifeschritt

Der naechste sinnvolle Zielzustand ist nicht „mehr Plattform“, sondern ein sauberer interner Arbeitskern:

- `Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit` ist lokal und synthetisch reproduzierbar;
- UI und Dokumentation vermeiden Scheingruenheit;
- Export- und Auditanker sind intern lesbar und testbar;
- Reibung aus manuellen Durchlaeufen kann in kleine Fixes, spaeter, Entscheidung noetig oder out of scope sortiert werden;
- Hetzner-/Option-B-Vorbereitung bleibt nicht-sensitiv und gate-basiert;
- echte Daten, echte Uploads, Deployment, Auth und Compliance-Freigaben bleiben blockiert, bis Alexander sie bewusst entscheidet.

---

## Fuehrende Referenzen

Bei tieferer Pruefung sind insbesondere diese Dokumente heranzuziehen:

- `memory.md`
- `HANDOFF_PROMPT.md`
- `README.md`
- `TESTING.md`
- `docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md`
- `docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md`
- `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md`

---

## Merksatz

Dieses Projekt soll zuerst eine ruhige, intern kontrolliert nutzbare Catering-Arbeitsplattform fuer Anfrage, Angebot, Produktion, Rueckfragen, Exporte und Audit werden — nicht vorschnell eine externe SaaS-Plattform, nicht vorschnell ein Produktionssystem fuer echte Daten und nicht ein unkontrolliertes Feature-Sammelbecken.
