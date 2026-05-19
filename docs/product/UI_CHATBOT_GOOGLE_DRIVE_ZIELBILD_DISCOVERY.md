# UI-/Produktzielbild: Apple-like Conversational Workbench und Google-Drive-Pfad

Status: Discovery- und Planungsnotiz auf Basis des Repo-Iststands
Stand: 2026-05-19
Scope: Produkt-/UI-Richtung, keine Implementierung, keine neue API, keine OAuth-/Google-Integration

## 1. Zweck

Diese Notiz hält Alexanders neue Produktvorgabe repo-gebunden fest, ohne daraus bereits einen Umbau abzuleiten:

- Die App soll später sehr clean und Apple-like wirken.
- Der Kern soll eher wie ein ruhiger, präziser Chatbot bzw. eine Conversational Workbench funktionieren.
- Google Drive ist als gewünschter Datei-/Dokumentzugriff vorgesehen.
- UX, Informationsarchitektur, Daten-/Dateizugriff und mögliche OAuth-/Google-Integration müssen getrennt entschieden werden.

Die Notiz ist bewusst kein Redesign-Auftrag und keine technische Google-Implementierung.

## 2. Repo-Iststand

### 2.1 UI-Struktur

Bereits vorhanden:

- `backoffice-ui` als Vite-/React-App.
- Kernrouten:
  - `/` Startseite mit Agentenwahl und Betriebsüberblick
  - `/angebot` Angebotsagent
  - `/produktion` Produktionsagent
- Ein großer zentraler UI-Einstieg in `backoffice-ui/src/App.tsx`.
- UI-Komponenten `DashboardShell` und `StatusCard` unter `backoffice-ui/components/`.
- Styles in `backoffice-ui/src/styles.css`.
- Bestehende Frontend-Smoke-Absicherung für die drei Kernrouten in `tests/backoffice-route-smoke.test.ts`.

### 2.2 Frontend-Framework und Abhängigkeiten

Belegt im Repo:

- React 19, React DOM 19
- Vite 7 mit `@vitejs/plugin-react`
- TypeScript
- Vitest und jsdom für Tests
- keine erkennbare zusätzliche UI-Komponentenbibliothek
- keine erkennbare Chat-spezifische UI-Bibliothek

### 2.3 Bereits vorhandene conversational-nahe Ansätze

Bereits vorhanden, aber noch keine echte Chat-UI:

- Freitext-Intake wird in strukturierte `AcceptedEventSpec`-Daten normalisiert.
- Datei-Upload, Drag & Drop und Dokumentanalyse führen zu Rückfragen/Ergebnissen im bestehenden Produktions-/Intake-Kontext.
- UI-Sprache ist bereits operativ auf Agenten, Klärung, Übergabe, Analyse und Ergebnisse ausgerichtet.
- Es gibt jedoch keine echte Nachrichten-Timeline, keinen Prompt-/Antwort-Thread, keine Assistant-Komponente und keine Conversation-Session als eigenes Produktobjekt.

### 2.4 Dateiimport und Google-Drive-Anknüpfung

Bereits vorhanden:

- Browserbasierter Datei-Upload für PDF, Text, Markdown und E-Mail-Dateien.
- Intake-Endpunkt `/v1/intake/documents/upload` über die UI.
- Rezept-Upload über Offer- und Production-Pfade.
- Import-Script für lokale Catering-Rezeptbestände.

Nicht vorhanden bzw. nicht belegt:

- keine Google-Drive-Integration
- keine Google-OAuth- oder OIDC-Implementierung
- keine Google-API-/`googleapis`-/Picker-Abhängigkeit
- keine Drive-spezifischen Scopes
- keine produktiven Google-Zugriffe oder Secrets

Relevant: `docs/product/P9_AUTHN_AUTHZ_MVP_RAHMEN_MINISPEZ.md` hält OAuth-/OIDC-/SSO-Implementierung ausdrücklich als nicht umgesetzt und nicht Teil des aktuellen MVP-Rahmens fest.

## 3. Zielbild in 5–8 Punkten

1. Die App wird als ruhige interne Arbeitsoberfläche gedacht: viel Weißraum, klare Hierarchie, hohe Lesbarkeit, keine Neon-/AI-Purple-/Emoji-Ästhetik.
2. Der Kernfluss soll conversational wirken, aber betrieblich präzise bleiben: Nutzer geben Anfrage, Datei oder Kontext ein; die App antwortet mit strukturierten Klärpunkten, Vorschlägen, Entscheidungen und nächsten Aktionen.
3. Chatbot-Look bedeutet keine Spielerei: Die Oberfläche soll wie eine fokussierte Conversational Workbench für Catering-Aufträge funktionieren.
4. Angebot, Produktion, Rezeptbibliothek, Exporte und Audit bleiben fachlich robuste Arbeitsbereiche; die Conversational Workbench darf diese Betriebsobjekte nicht verdecken oder unprüfbar machen.
5. Jede AI-/Agenten-Antwort muss in nachvollziehbare Produktobjekte überführbar bleiben, insbesondere `AcceptedEventSpec`, Angebotsentwurf, Produktionsplan, Einkaufsliste, Rezept-Review und Audit-/Änderungsspur.
6. Google Drive wird als eigener, bewusst freigegebener Integrationspfad behandelt: minimale Scopes, klare Dateirechte, explizite Nutzerfreigabe und getrennte Sicherheits-/Datenabgrenzung.
7. Alexanders Berechtigungslinie ist: bestehende Drive-Dateien sind grundsätzlich nur read-only Importquellen; Schreiben ist nur für app-eigene erzeugte Artefakte oder explizit freigegebene Zielordner/Zielartefakte vorgesehen.
8. Drive-Dateien dürfen nicht als heimlicher Ersatz für bestehende Upload- und Persistenzpfade eingeführt werden; zunächst muss geklärt werden, ob Drive Quelle, Ablage, Synchronisationspunkt oder Arbeitsraum sein soll.
9. Der erste UI-Schritt sollte dokumentierend und kartierend bleiben: bestehende Flows, Datenobjekte und UI-Zonen auf ein späteres Conversational-Workbench-Modell abbilden, bevor Code umgebaut wird.

## 4. Kleinster sicherer erster Umsetzungsschritt

Umgesetzt wurde nur diese Zielbild-/Discovery-Notiz.

Begründung:

- Ein UI-Prototyp wäre derzeit bereits eine sichtbare Produktfläche und könnte falsche Architekturannahmen setzen.
- Eine Google-Drive-Integration erfordert Entscheidungen zu OAuth, Scopes, Dateirechten, Token-/Secret-Umgang, Datenmodell und Audit.
- Die vorhandene UI ist testbar und operativ bereits breit belegt; ein Umbau ohne Flow-Kartierung wäre riskant.

Empfohlener nächster kleiner Schritt nach dieser Notiz:

1. vorhandene UI-Flows in `/`, `/angebot`, `/produktion` als Ist-Flow-Karte dokumentieren,
2. pro Flow markieren: Eingabe, Systemantwort, Klärbedarf, erzeugtes Produktobjekt, Export/Audit,
3. daraus erst danach einen minimalen read-only Mock für eine Conversational-Workbench ableiten, ohne neue API und ohne Google-Zugriff.

## 5. Drive-Berechtigungsmodell als Zielbild

Alexanders fachliche Vorgabe für den späteren Google-Drive-Pfad:

### 5.1 Existing Drive Files

- Bestehende Drive-Dateien, die der berechtigte App-Nutzer auswählt, dienen grundsätzlich als read-only Importquelle.
- Die App darf solche Dateien lesen, analysieren, importieren oder in interne Produktobjekte überführen, sofern der Nutzer den Zugriff bewusst auslöst.
- Die App darf vorhandene Drive-Dateien nicht still überschreiben, ändern, umbenennen, verschieben oder löschen.
- Eine Änderung bestehender Drive-Dateien ist nur zulässig, wenn dafür später eine gesonderte fachliche Berechtigung, UI-Bestätigung und technische Rechtebasis definiert wird.

### 5.2 App-eigene Drive-Outputs

- Schreibzugriff ist nur für von der App neu erzeugte Artefakte oder ausdrücklich freigegebene Zielartefakte/Zielordner vorgesehen.
- Für Outputs wie Rezepte, Einkaufslisten, Angebote, Produktionsunterlagen oder vergleichbare Arbeitsbelege braucht es einen eigenen Drive-Ausgabepfad.
- Dieser Ausgabepfad setzt eine explizite Nutzerfreigabe voraus, z. B. durch bewusste Zielordnerwahl oder spätere Freigabe eines klar benannten Zielartefakts.
- App-Outputs dürfen bestehende Drive-Dateien nicht still ersetzen; bei Namenskonflikten wäre später ein neues Artefakt, eine explizite Versionierung oder eine bewusste Nutzerentscheidung erforderlich.

### 5.3 Audit-Anforderung

Jeder spätere Drive-Import oder Drive-Output muss nachvollziehbar dokumentieren:

- Quelle: Drive-Datei, Datei-ID oder sonstiger belastbarer Herkunftsverweis.
- Ziel: internes Produktobjekt, erzeugtes Drive-Artefakt oder Zielordner.
- Nutzer: auslösender App-Nutzer bzw. Operator.
- Zeitpunkt: Import-, Lese-, Erzeugungs- oder Schreibzeitpunkt.
- Aktionstyp: lesen, importieren, erzeugen, exportieren, versionieren oder explizit freigegebenes Schreiben.
- Falls technisch sinnvoll: Hash, Drive-Version, Revision-ID oder vergleichbarer Integritäts-/Versionshinweis.

## 6. Offene Entscheidungen zu Google Drive / OAuth / Scopes

Vor Implementierung zu entscheiden:

1. Drive-Rolle: nur Datei-Auswahl als Quelle, dauerhafte Ablage, bidirektionale Synchronisation oder Team-Arbeitsraum?
2. OAuth-Modell: einzelner Betreiber-Account, echte Nutzer-Accounts, Workspace-Domain oder Service Account?
3. Scope-Strategie: Picker/dateiselektiver read-only Zugriff für bestehende Dateien plus separater create/write-Scope für app-eigene Outputs, oder ein anderes bewusst begründetes Modell?
4. Write-Grenze: wie wird technisch verhindert, dass bestehende Drive-Dateien ohne gesonderte Berechtigung überschrieben oder verändert werden?
5. Dateirechte: wer darf welche Drive-Dateien auswählen, importieren, speichern oder erneut verarbeiten?
6. Datenhaltung: werden Drive-Dateien kopiert, referenziert, gehasht, versioniert oder nur temporär gelesen?
7. Audit: wie werden Quelle, Ziel, Nutzer, Zeitpunkt, Aktionstyp und ggf. Hash/Version nachvollziehbar dokumentiert?
8. Secrets/Tokens: wo werden OAuth-Client, Refresh Tokens und Zugriffe verwaltet; aktuell keine neuen externen Secrets einführen.
9. Sicherheitsgrenze: welche Daten dürfen aus Drive in Angebots-, Produktions- und Exportobjekte übernommen werden?

## 7. Bewusst nicht umgesetzt

Nicht umgesetzt wurden:

- kein UI-Redesign
- keine neue Chat-Komponente
- keine neue Conversation-Persistenz
- keine neuen API-Endpunkte
- keine Google-Drive- oder Google-OAuth-Implementierung
- keine neuen Secrets
- keine Änderung an bestehenden Upload-, Export-, Rollen- oder Audit-Pfaden
