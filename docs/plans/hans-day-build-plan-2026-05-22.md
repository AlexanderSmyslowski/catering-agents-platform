# Hans Day Build Plan 2026-05-22

> **For Hermes:** Dieser Plan ist fuer einen langen, beaufsichtigten `hans-catering`-Coding-Run gedacht. Arbeite Cycle fuer Cycle, TDD/RED zuerst, kleine Commits, harte Checks. Wenn ein Cycle abgeschlossen ist: Lagebericht in die shared Inbox schreiben, pushen nur bei gruenen Gates.

**Goal:** Heute soll Hans den bestehenden internen MVP spuerbar naeher an eine funktionsfaehige, nutzbare App bringen, ohne die ProductionAgent-v1-Architekturgrenzen zu verletzen.

**Architecture:** Keine neue LLM-/Tool-/OCR-/Allergen-/Rezeptgenerierungswelt. Der Tagesplan nutzt die vorhandenen MVP-Objekte (`AcceptedEventSpec`, `ProductionPlan`, `PurchaseList`, Rezeptbibliothek, Exporte, Audit, Clarification Projection) und verbessert den realen internen Nutzfluss in kleinen, verifizierbaren Slices. Fokus ist `/produktion` als nutzbarer, ruhiger Arbeitsfluss plus harte Smoke-/Acceptance-Absicherung.

**Tech Stack:** TypeScript, React/Vite Backoffice UI, Fastify Services, shared-core, Vitest/jsdom, bestehender filebasierter Store, bestehende lokale Stack-Skripte.

---

## 0. Verbindliche Ausgangslage

Repo:

```text
/Users/alexandersmyslowski/Projects/catering-agents-platform
```

Aktueller HEAD bei Planerstellung:

```text
e086ccb feat: show answered clarification status
```

Aktueller Status:

```text
## main...origin/main
?? tmp/
```

`tmp/` ist vorhanden und bleibt unangetastet.

Pflichtlesung vor Arbeit:

1. `memory.md`
2. `AGENTS.md`
3. `HANDOFF_PROMPT.md`
4. `README.md`
5. `TESTING.md`
6. `docs/plans/production-workbench-structure.md`
7. `docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md`
8. relevante aktuelle Dateien:
   - `backoffice-ui/src/App.tsx`
   - `backoffice-ui/src/production-workbench.tsx`
   - `backoffice-ui/src/offer-workbench.tsx`
   - `backoffice-ui/src/styles.css`
   - `tests/backoffice-route-smoke.test.ts`
   - `tests/backoffice-production-acceptance-smoke.test.ts`
   - `tests/backoffice-internal-usage-smoke.test.ts`
   - `tests/backoffice-output-praesentation-smoke.test.ts`
   - `shared-core/src/conversation-projection.ts`
   - `shared-core/src/production-clarification.ts`
   - `production-service/src/repositories/production-store.ts`

---

## 1. Tagesziel in Managementsprache

Heute nicht weiter Mikrohaerten im Clarification-Answer-Strang.

Stattdessen:

1. `/produktion` muss sich wie eine konkrete Arbeitsflaeche anfuehlen, nicht wie eine technische Card-Wand.
2. Der interne Nutzpfad muss lesbar und smoke-gesichert sein:
   - Auftrag/Spec vorhanden oder erstellbar
   - offene Rueckfragen sichtbar
   - beantwortete Rueckfragen sichtbar
   - naechster sinnvoller Schritt sichtbar
   - Plan/Einkauf/Exports erreichbar
   - Rezept-/Audit-/Herkunftszonen vorhanden, aber ruhig eingeordnet
3. Keine unechte Magie behaupten:
   - kein echter freier Chat
   - kein LLM-Agent
   - keine automatische Spec-Korrektur aus Antworten
   - keine Allergen-/Rezeptgenerierung
   - keine neue API/Persistenz/Migration

---

## 2. Absolute Stop-Gates

Hans muss stoppen und berichten, statt zu improvisieren, wenn ein Schritt eines dieser Themen erzwingt:

- neue HTTP-API
- neue Persistenzfelder oder Migration
- Prisma oder neues Datenbanksystem
- echte LLM-/Tool-Use-/Agent-Orchestrierung
- neue PDF/OCR/Parser-Engine
- automatische Spec-Korrektur aus Clarification-Antworten
- Allergenautomatik DE/EN
- Rezeptgenerierung oder Rezeptskalierungslogik, die fachlich neu entscheidet
- OIDC/Login/Session/OAuth/Google Drive
- Multi-Tenant, Plattform, White-Label
- grosse generische Workbench-Abstraktion fuer `/angebot` und `/produktion`
- Umbau von `/angebot`, ausser minimaler Build-/Import-Fix ist zwingend
- Security-/Access-Control-Entscheidung ohne Alexander

Wenn ein Slice nur mit einem dieser Punkte sinnvoll loesbar ist: Lagebericht schreiben, nicht bauen.

---

## 3. Arbeitsrhythmus fuer den ganzen Tag

Arbeite in Zyklen von maximal 60-90 Minuten.

Nach jedem Zyklus:

1. fokussierte Tests laufen lassen
2. falls UI/TypeScript betroffen: `npm run build`
3. bei gruenem Ergebnis committen
4. mit `HOME=/Users/alexandersmyslowski git push origin main` pushen
5. Remote/CI kurz pruefen, wenn moeglich
6. Lagebericht schreiben nach:

```text
/Users/alexandersmyslowski/.hermes/coordination/agent-reports/inbox/hans-day-build-20260522-cycle-XX.md
```

Lagebericht-Format:

```markdown
# Hans Day Build 2026-05-22 Cycle XX

Verdict: umgesetzt / gestoppt / umgesetzt mit Fix / nur Plan

Commit:
Remote:
CI:

Umgesetzt:
- ...

Geaenderte Dateien:
- ...

Tests:
- ...

Bewusst nicht umgesetzt:
- ...

Risiken / offene Entscheidungen:
- ...

Naechster empfohlener Cycle:
- ...
```

---

## 4. Tages-Cycles

## Cycle 1 — Baseline und UI-Istbild hart festhalten

**Objective:** Vor weiterem Bau den realen App-Zustand und die aktuelle Testbasis sichern.

**Files:**
- Lesen: `backoffice-ui/src/App.tsx`
- Lesen: `backoffice-ui/src/production-workbench.tsx`
- Lesen: `backoffice-ui/src/styles.css`
- Lesen: `tests/backoffice-route-smoke.test.ts`
- Lesen: `tests/backoffice-production-acceptance-smoke.test.ts`
- Optional aendern: keine, ausser ein offensichtlicher gebrochener Testmarker erfordert Minimalfix.

**Step 1: Repo sauber pruefen**

```bash
git status -sb
git log -5 --oneline --decorate
```

Expected:

```text
## main...origin/main
?? tmp/
```

**Step 2: Baseline-Tests laufen lassen**

```bash
npx vitest run tests/backoffice-route-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts
npm run build
```

Expected: PASS.

**Step 3: Falls Baseline rot ist**

- Nicht weiterbauen.
- Fehler analysieren.
- Nur minimalen Fix fuer gebrochene aktuelle Baseline machen.
- Danach fokussierte Tests und Build erneut.

**Step 4: Lagebericht**

Berichte:
- Baseline gruen/rot
- welche Route-/Production-Marker aktuell vorhanden sind
- ob `ProductionConversationalWorkbench` bereits aktiv genutzt wird

Commit nur bei Code-/Doku-Aenderung.

---

## Cycle 2 — PA26: Rueckfragenstatus sichtbar in der Workbench, nicht nur im Core

**Objective:** Der PA25-Status `answered | unanswered` wird in `/produktion` read-only sichtbar und verbessert die Nutzbarkeit, ohne Fragen zu schliessen oder Spec zu korrigieren.

**Rationale:** PA25 ist im Core/Projection vorhanden. Der App-Nutzer soll erkennen, welche Rueckfragen schon beantwortet sind. Das ist sichtbarer Produktwert ohne neue Fachlogik.

**Files:**
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/styles.css`
- Test: `tests/backoffice-production-acceptance-smoke.test.ts`
- Optional Test: `tests/backoffice-route-smoke.test.ts`

**Step 1: Failing Test schreiben**

Im Production-Acceptance-Smoke Fixture eine passende submitted shortText-Antwort fuer eine vorhandene Frage modellieren, wenn die Projection/Store-Daten im Testkontext bereits uebergeben werden koennen. Falls der UI-Test die Antwortdaten nicht ohne neue API einspeisen kann, stattdessen einen kleineren Render-Test auf vorhandene Projection-Nachrichten/Status schreiben.

Akzeptanz im Test:

```ts
expect(text).toContain("Beantwortet");
expect(text).toContain("Noch offen");
```

oder genauer:

```ts
expect(text).toContain("Rückfrage beantwortet");
expect(text).toContain("Rückfrage offen");
```

**Wichtig:** Kein neuer Fetch-Endpunkt, keine neue API, keine neue Persistenz.

**Step 2: RED verifizieren**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts -t "answered"
```

Expected: FAIL, weil UI-Label noch fehlt.

**Step 3: Minimal implementieren**

In der Darstellung der `productionConversationProjection.messages` bzw. der strukturierten Frage-Bubbles:

- Wenn `message` eine Clarification-Frage mit Status `answered` ist: kleines Badge `Beantwortet` anzeigen.
- Wenn `unanswered`: kleines Badge `Noch offen` anzeigen.
- Badge rein read-only.
- Antworttext weiterhin escaped/nicht als HTML rendern.
- Status darf keine Frage entfernen und keine Aktion ausloesen.

**Step 4: Styling minimal**

In `styles.css` kleine ruhige Badge-Klassen, z. B.:

```css
.clarification-status-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.clarification-status-badge--answered {
  background: rgba(52, 199, 89, 0.12);
  color: #1f7a3a;
}

.clarification-status-badge--unanswered {
  background: rgba(255, 149, 0, 0.12);
  color: #8a4b00;
}
```

**Step 5: Tests**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts
npx vitest run tests/backoffice-route-smoke.test.ts
npm run build
```

**Step 6: Commit**

```bash
git add backoffice-ui/src/App.tsx backoffice-ui/src/styles.css tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts
git commit -m "feat: show clarification answer status in production workbench"
HOME=/Users/alexandersmyslowski git push origin main
```

---

## Cycle 3 — PA27: Naechster-Schritt-Logik nur aus vorhandenen Daten klarer machen

**Objective:** Die Workbench sagt dem Nutzer oben klar, was als Naechstes zu tun ist: Auftrag eingeben, Rueckfrage beantworten, Plan berechnen oder Downloads pruefen.

**Files:**
- Modify: `backoffice-ui/src/production-workbench.tsx`
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/styles.css`
- Test: `tests/backoffice-route-smoke.test.ts`
- Test: `tests/backoffice-production-acceptance-smoke.test.ts`

**Step 1: Failing Tests fuer 3-4 Zustaende**

Testfaelle:

1. kein aktiver Vorgang:

```ts
expect(text).toContain("Auftrag einfügen oder Datei ablegen");
```

2. offene Rueckfragen:

```ts
expect(text).toContain("Rückfragen beantworten");
```

3. Spec ausreichend, kein Plan:

```ts
expect(text).toContain("Produktionsplan berechnen");
```

4. Plan/Einkauf vorhanden:

```ts
expect(text).toContain("Produktionsobjekte und Downloads prüfen");
```

**Step 2: RED verifizieren**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts -t "next step"
```

**Step 3: Minimalen `nextStep` Prop einfuehren**

In `App.tsx` aus vorhandenen Daten ableiten:

```ts
const productionNextStep = useMemo(() => {
  if (!focusedProductionSpec) {
    return {
      title: "Auftrag einfügen oder Datei ablegen",
      description: "Starte mit Angebot, E-Mail, Text oder manuellen Veranstaltungsdaten."
    };
  }
  if (productionQuestions.some((question) => question.clarificationAnswerStatus !== "answered")) {
    return {
      title: "Rückfragen beantworten",
      description: "Die Produktion braucht noch strukturierte Antworten, bevor Ergebnisse belastbar sind."
    };
  }
  if (!selectedPlan) {
    return {
      title: "Produktionsplan berechnen",
      description: "Die vorhandene Spezifikation kann nun in vorhandene Produktionsobjekte überführt werden."
    };
  }
  return {
    title: "Produktionsobjekte und Downloads prüfen",
    description: "Plan, Einkaufsliste und Exporte sind als prüfbare Ergebniszonen verfügbar."
  };
}, [focusedProductionSpec, productionQuestions, selectedPlan]);
```

Falls `ProductionClarificationQuestion` im UI nicht direkt `clarificationAnswerStatus` traegt, die Information ueber `productionConversationProjection.messages` ableiten. Nicht am Core improvisieren, wenn Typen anderes verlangen.

**Step 4: Workbench anzeigen**

`ProductionConversationalWorkbench` bekommt:

```ts
nextStepTitle: string;
nextStepDescription: string;
```

Im Composer unter der Hauptfrage anzeigen.

**Step 5: Tests/Build**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts
npm run build
```

**Step 6: Commit**

```bash
git add backoffice-ui/src/production-workbench.tsx backoffice-ui/src/App.tsx backoffice-ui/src/styles.css tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts
git commit -m "feat: clarify next production workbench step"
HOME=/Users/alexandersmyslowski git push origin main
```

---

## Cycle 4 — PA28: Interner Happy Path als echter UI-Smoke

**Objective:** Ein jsdom-Smoke belegt den Kernnutzen der App: Manuelle Spezifikation / vorhandene Spec -> Produktionsplan -> Einkauf/Export sichtbar. Keine neue Funktion, nur bestehender Pfad wird abgesichert.

**Files:**
- Modify: `tests/backoffice-internal-usage-smoke.test.ts`
- Modify: `tests/backoffice-production-acceptance-smoke.test.ts`
- Code-Fix nur falls Test realen bestehenden Bug findet.

**Step 1: Bestehenden Test lesen**

```bash
sed -n '1,260p' tests/backoffice-internal-usage-smoke.test.ts
```

Nicht per `sed` im finalen Workflow noetig; Agent darf `read_file` nutzen. Ziel: vorhandene Mock-Struktur verstehen.

**Step 2: Failing Test fuer sichtbaren Happy Path**

Test soll belegen:

- `/produktion` zeigt die zentrale Frage
- aktiver Vorgang sichtbar
- Button/Aktion zur Planberechnung sichtbar, wenn kein Plan
- bei Plan-Fixture:
  - Planstatus sichtbar
  - Produktionsblatt-Exportlink sichtbar
  - Einkaufsliste-Zone sichtbar
  - Einkaufslisten-Exportlink sichtbar, wenn Liste vorhanden

Akzeptanzmarker bevorzugt vorhandene echte Texte, keine instabilen CSS-Details.

**Step 3: RED verifizieren**

```bash
npx vitest run tests/backoffice-internal-usage-smoke.test.ts -t "production"
```

**Step 4: Minimalfix nur bei echtem Bug**

Moegliche erlaubte Fixes:

- falsche/fehlende route-eindeutige Marker
- Exportlink nicht erreichbar, obwohl `selectedPlan` oder `purchaseList` vorhanden
- falsche leere Statusanzeige
- Plan/Einkauf fuer falsche Spec angezeigt

Nicht erlaubt:

- neue API
- neue Exportlogik
- neue Produktionsberechnung

**Step 5: Tests**

```bash
npx vitest run tests/backoffice-internal-usage-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts
npm run build
```

**Step 6: Commit**

```bash
git add tests/backoffice-internal-usage-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts backoffice-ui/src/App.tsx backoffice-ui/src/production-workbench.tsx backoffice-ui/src/styles.css
git commit -m "test: cover internal production happy path"
HOME=/Users/alexandersmyslowski git push origin main
```

Wenn kein Codefix noetig: Commit nur Testdateien.

---

## Cycle 5 — PA29: Produktionsobjekte ruhiger und nutzbarer gruppieren

**Objective:** Ergebnis-, Plan-, Einkauf- und Downloadzonen sollen fuer den Nutzer klarer sein, ohne bestehende Datenpfade zu veraendern.

**Files:**
- Modify: `backoffice-ui/src/production-workbench.tsx`
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/styles.css`
- Test: `tests/backoffice-output-praesentation-smoke.test.ts`
- Test: `tests/backoffice-production-acceptance-smoke.test.ts`

**Step 1: Failing Test fuer Output-Zonen**

Akzeptanz:

```ts
expect(text).toContain("Produktionsobjekte");
expect(text).toContain("Produktionsblatt exportieren");
expect(text).toContain("Einkaufsliste");
expect(text).toContain("Einkaufsliste exportieren");
expect(text).toContain("Vorhandene Pläne, Einkaufslisten und Exportlinks");
```

**Step 2: RED verifizieren**

```bash
npx vitest run tests/backoffice-output-praesentation-smoke.test.ts -t "production"
```

**Step 3: Minimal umbauen**

Erlaubt:

- bestehende Plan-/Purchase-/Export-Blöcke in `production-objects-zone` und `production-purchase-zone` klarer gruppieren
- lange Tabellen/Listen hinter `details` lassen
- kurze Vorschau + Downloadaktion sichtbar oben
- ruhige Leerzustaende formulieren

Nicht erlaubt:

- Export-URLs neu erfinden
- Exportservice aendern
- Planberechnung aendern
- PurchaseList-Berechnung aendern

**Step 4: Tests/Build**

```bash
npx vitest run tests/backoffice-output-praesentation-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-route-smoke.test.ts
npm run build
```

**Step 5: Commit**

```bash
git add backoffice-ui/src/App.tsx backoffice-ui/src/production-workbench.tsx backoffice-ui/src/styles.css tests/backoffice-output-praesentation-smoke.test.ts tests/backoffice-production-acceptance-smoke.test.ts
git commit -m "feat: group production outputs and downloads"
HOME=/Users/alexandersmyslowski git push origin main
```

---

## Cycle 6 — PA30: Rezept- und Review-Zone als Blocker-/Ruhig-Zone einordnen

**Objective:** Rezeptverwaltung bleibt vorhanden, aber die App zeigt nur dann laut, wenn Rezeptreview oder Rezeptauswahl die Produktion blockiert.

**Files:**
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/styles.css`
- Test: `tests/backoffice-production-acceptance-smoke.test.ts`
- Optional Test: `tests/recipe-review-access.test.ts` nur wenn Review-Pfade beruehrt werden; bevorzugt nicht beruehren.

**Step 1: Failing UI-Test**

Fixture mit Rezepten in verschiedenen Review-Zustaenden:

- `approved_internal`
- `review_required`
- `rejected`

Akzeptanz:

```ts
expect(text).toContain("Rezeptprüfung");
expect(text).toContain("1 zu prüfen");
expect(text).toContain("Freigegebene Rezepte bleiben verwendbar");
```

**Step 2: RED verifizieren**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts -t "recipe"
```

**Step 3: Minimal implementieren**

- Keine Review-Logik aendern.
- Nur aus vorhandenen Recipe-Daten zaehlen:
  - approved
  - review_required
  - rejected
- Im UI als ruhiger Status in der unteren Rezeptzone anzeigen.
- Bestehende Review-Actions bleiben unveraendert.

**Step 4: Tests/Build**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts tests/recipe-review-access.test.ts
npm run build
```

**Step 5: Commit**

```bash
git add backoffice-ui/src/App.tsx backoffice-ui/src/styles.css tests/backoffice-production-acceptance-smoke.test.ts
git commit -m "feat: summarize recipe review status in production workbench"
HOME=/Users/alexandersmyslowski git push origin main
```

---

## Cycle 7 — PA31: Audit/Herkunft/Uebergabe als Abschlusszone

**Objective:** Die App zeigt am Ende der Produktionsarbeit ruhig, woher die Daten stammen und welche Uebergabe-/Exportartefakte existieren.

**Files:**
- Modify: `backoffice-ui/src/App.tsx`
- Modify: `backoffice-ui/src/production-workbench.tsx`
- Modify: `backoffice-ui/src/styles.css`
- Test: `tests/backoffice-production-acceptance-smoke.test.ts`
- Test: `tests/backoffice-intake-request-detail.test.ts`

**Step 1: Failing Test**

Akzeptanz:

```ts
expect(text).toContain("Herkunft und Übergabe");
expect(text).toContain("Intake-Ursprung");
expect(text).toContain("Audit-Spur");
expect(text).toContain("Keine rechtssichere Audit-Behauptung");
```

**Step 2: RED verifizieren**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts -t "handoff"
```

**Step 3: Minimal implementieren**

- Bestehende `intakeRequestDetail`, `sourceMetadata`, Audit-/Export-Hinweise in eine Abschlusszone gruppieren.
- Keine neuen Audit-Endpunkte.
- Keine rechtssichere Audit-Behauptung.
- Keine Rohtext-/PDF-Extrakt-Spiegelung.

**Step 4: Tests/Build**

```bash
npx vitest run tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-intake-request-detail.test.ts
npm run build
```

**Step 5: Commit**

```bash
git add backoffice-ui/src/App.tsx backoffice-ui/src/production-workbench.tsx backoffice-ui/src/styles.css tests/backoffice-production-acceptance-smoke.test.ts tests/backoffice-intake-request-detail.test.ts
git commit -m "feat: add production handoff and provenance zone"
HOME=/Users/alexandersmyslowski git push origin main
```

---

## Cycle 8 — PA32: Lokalen Betriebscheck und Doku fuer nutzbaren Tagesstand aktualisieren

**Objective:** Am Ende des Tages ist der Stand nicht nur gebaut, sondern reproduzierbar pruefbar und dokumentiert.

**Files:**
- Modify: `TESTING.md`
- Modify: `memory.md`
- Create: `docs/agent-memory/memory_v5.132_2026-05-22.md` oder naechste freie Version
- Optional Modify: `docs/plans/production-workbench-structure.md` nur wenn Plan-Iststand falsch geworden ist

**Step 1: Full Gates**

```bash
npm test
npm run build
npm audit --omit=dev
git diff --check
npm run local:status
```

Wenn lokaler Stack laeuft:

```bash
npm run local:check
```

Wenn lokaler Stack nicht laeuft, nicht blind starten, ausser im Tagesauftrag ausdruecklich gewuenscht. Dann Status melden.

**Step 2: Dokumentation aktualisieren**

`TESTING.md`:

- neue/geschaerfte Production-Workbench-Smokes erwaehnen
- keine neuen Testinfrastruktur-Behauptungen

`memory.md`:

- neue Version unten in Historie anhaengen
- knapper Statusblock:
  - welche PA-Slices heute umgesetzt
  - welche Grenzen gehalten
  - welcher naechste Schritt offen

Snapshot:

```bash
cp memory.md docs/agent-memory/memory_v5.132_2026-05-22.md
```

Version nur verwenden, wenn frei; sonst naechste freie Version.

**Step 3: Full final checks nach Doku**

```bash
npm test
npm run build
npm audit --omit=dev
git diff --check
npm run local:status
```

**Step 4: Commit**

```bash
git add TESTING.md memory.md docs/agent-memory docs/plans/production-workbench-structure.md
git commit -m "docs: update production workbench build status"
HOME=/Users/alexandersmyslowski git push origin main
```

---

## 5. Optionaler Stretch nur wenn Cycle 1-8 gruen und Zeit bleibt

## Stretch A — Read-only Internal Beta Walkthrough

**Objective:** Eine kleine Doku-/Smoke-Sicht beschreibt den heute funktionsfaehigen manuellen internen Ablauf.

Allowed:

- Doku unter `docs/product/` oder `docs/plans/`
- Test, der bestehende UI-Marker fuer den Ablauf absichert

Not allowed:

- neue Startseite
- neues Dashboard
- neue API
- neue Persistenz

Commit:

```bash
git commit -m "docs: describe internal production walkthrough"
```

## Stretch B — Kleine Copy-/Wording-Korrektur nur mit Testanker

Allowed:

- Begriffe schaerfen, wenn sie falsche Magie behaupten
- Tests an stabile Marker anpassen

Not allowed:

- reine Designpolitur ohne Akzeptanznutzen
- grosses CSS-Redesign

---

## 6. Nicht heute bauen

Auch wenn es verlockend ist, heute nicht bauen:

- echter LLM-Chat
- automatische Antwortverarbeitung in Spec-Korrektur
- PDF-Verstaendnis jenseits bestehender Textgewinnung
- Allergenlisten DE/EN
- Rezeptgenerierung
- neue Google-Drive-/OAuth-Anbindung
- neues Login/OIDC
- neue Persistenz/Migration/Prisma
- generische Workbench-Komponenten fuer mehrere Routen
- Deployment-Umbau

Diese Punkte koennen spaeter eigene Entscheidungs-/Architektur-Slices sein.

---

## 7. Schluss-Gate fuer den Tageslauf

Hans darf am Tagesende nur `PASS` melden, wenn:

1. jeder umgesetzte Slice committed und gepusht ist
2. `git status -sb` sauber ist bis auf bekanntes `tmp/`
3. `npm test` gruen ist
4. `npm run build` gruen ist
5. `npm audit --omit=dev` gruen ist
6. `git diff --check` gruen ist
7. `npm run local:status` geprueft ist
8. CI fuer finalen HEAD gruen ist oder explizit als offen mit Run-ID/Grund gemeldet wird
9. Lagebericht in der Inbox liegt
10. klar getrennt ist:
    - umgesetzt
    - nur dokumentiert
    - offen
    - bewusst out of scope

---

## 8. Erwartetes Tagesergebnis

Realistisches gutes Ergebnis fuer heute:

- `/produktion` ist sichtbarer und nutzbarer als Workbench.
- Rueckfragenstatus ist fuer Nutzer sichtbar.
- Naechster Schritt ist klar.
- Produktionsplan/Einkauf/Downloads sind besser gruppiert.
- Rezept-/Review-/Herkunftszonen sind ruhiger eingeordnet.
- Interner Happy Path ist durch jsdom-Smokes besser abgesichert.
- Keine neue Architektur-/Persistenz-/LLM-Schuld.

Das bringt die App spuerbar naeher an "intern nutzbar", ohne den ProductionAgent-v1-Grossschnitt vorwegzunehmen.
