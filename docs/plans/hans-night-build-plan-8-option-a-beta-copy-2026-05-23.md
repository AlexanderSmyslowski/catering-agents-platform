# Hans Night Build Plan 8 — Option A Beta Copy / Rehearsal Hardening

Datum: 2026-05-23  
Status: aktiv fuer ueberwachten Nachtlauf  
Repo: `AlexanderSmyslowski/catering-agents-platform`  
Baseline vor Planerstellung:

```text
## main...origin/main
?? tmp/
1f38d7b
failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git
```

## Management-Ziel

Hans soll ueber Nacht weiterarbeiten, aber nicht ungebunden. Ziel ist, die bestaetigte **Option A** fuer die interne Beta sauber, ehrlich und pruefbar im bestehenden synthetischen Korridor zu verankern:

`Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit`

Option A bedeutet: Die Zeitfenster-/Schedule-Frage wird fuer den internen Beta-MVP vorerst als Copy-/Anleitungs-Linie behandelt, **ohne** Datenmodell-, API-, Persistenz- oder Runtime-Ausbau.

## Absolute Stop-Gates

Sofort stoppen und Bericht schreiben bei Bedarf fuer:

- neues Schedule-/Zeitfenster-Datenmodell;
- neue Persistenz, Prisma, Migration, neue Tabellen;
- neue API-Endpunkte oder veraenderte API-Vertraege;
- OAuth/Login/OIDC/Auth-Ausbau;
- Deployment, SSH, Secrets, Hetzner-Aktionen;
- echte Kunden-/Personendaten oder produktionsnahe Nutzung;
- automatische Spec-Korrektur oder halbautomatische Uebernahme von Zeitfenster-Antworten;
- Rezept-/Allergenautomatik;
- grosse Refactorings oder UI-Neubau;
- rote CI, die nicht durch einen engen Fix reproduzierbar und behebbar ist.

`tmp/` bleibt bekannt untracked und wird nicht beruehrt.

## Nachtlauf-Protokoll

- Immer nur ein Hans-Runner gegen dieses Repo.
- Jeder Cycle schreibt einen Lagebericht nach `/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/`.
- Jeder Cycle arbeitet RED/Contract-first, falls Code/Doku-Anker geaendert werden.
- Commit/Push nur bei gruenen Gates.
- Push mit `HOME=/Users/alexandersmyslowski git push origin main`.
- CI nach Push pruefen.
- Keine Fortsetzung ueber rote CI hinweg.
- Wenn ein Cycle keinen sicheren Produktwert findet: No-Product-Change-Bericht, kein erzwungener Commit.

## Cycle Queue

### P8-N1 — Option-A Copy-Anker im Produktions-Rehearsal

Ziel: Die bestaetigte Option A soll im bestehenden `/produktion`-Rehearsal ehrlich sichtbar/ableitbar werden: Zeitfenster bleibt eine manuell zu klaerende Copy-/Anleitungsfrage, keine automatische Datenmodell- oder Spec-Uebernahme.

Erlaubt:
- kleine Doku-/Copy-/UI-Textanker im bestehenden Produktions-/Rehearsal-Kontext;
- Vertragstest/Smoke-Test fuer Marker;
- memory.md + Snapshot.

Nicht erlaubt:
- Runtime-Schedule-Modell, neue API, Persistenz, automatische Spec-Patches.

### P8-N2 — Rehearsal-Checkliste fuer interne Testperson schaerfen

Ziel: Eine interne Testperson soll den synthetischen Korridor ohne Missverstaendnis durchlaufen koennen: Wo wird Zeitfenster manuell notiert, was wird nicht automatisch geloest, welche Evidenz wird gesammelt?

Erlaubt:
- Doku-/Produkt-Checkliste, evtl. bestehende Start-/Szenariokarte schaerfen;
- Vertragstest auf klare Grenzen.

### P8-N3 — Export-/Audit-Evidenz fuer Option A pruefen

Ziel: Sicherstellen, dass die Option-A-Linie im bestehenden Export-/Audit-Evidenzpaket nicht so wirkt, als waere Schedule strukturiert geloest.

Erlaubt:
- kleine Doku-/Copy-Anker, Test auf Evidenzhinweise;
- keine neue Exportlogik, ausser ein minimaler Klarstellungstext in bestehendem UI/Doc-Anker, wenn streng noetig.

### P8-N4 — Local Ops / Smoke Robustheit nach Option A

Ziel: Lokalstart, Status, Checks und Smoke-Pfade bleiben fuer die Beta stabil und beschreiben die bekannte Grenze sauber.

Erlaubt:
- check-/docs-only Robustheit, kleine Testanker;
- keine Infra-/Deployment-Arbeit.

### P8-N5 — Abschlussgate / Memory Snapshot / Management-Lage

Ziel: Full Gates, CI-Verifikation, memory-Snapshot und kompakte Management-Lage: umgesetzt, dokumentiert, offen, out of scope, naechstes echtes Gate.

Pflicht:
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- `git diff --check`
- `npm run local:status`
- `npm run local:check`
- CI fuer letzten Push pruefen

## Erfolgskriterium fuer die Nacht

Nicht maximale Commit-Zahl, sondern kontrollierter Fortschritt: Die interne Beta-Linie ist ehrlicher, pruefbarer und weniger missverstaendlich, ohne Datenmodell-/API-/Persistenzentscheidungen vorwegzunehmen.
