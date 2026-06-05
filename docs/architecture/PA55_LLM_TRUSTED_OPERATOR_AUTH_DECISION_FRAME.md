# PA55 LLM Trusted-Operator-/Auth-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA54 fuer den Operator- und
Trusted-Auth-Kontext eines spaeteren providerfaehigen Draft-Pfads; kein
Deployment, keine neuen APIs, keine Persistenz, keine Migration, keine
OIDC-/Login-Implementierung, keine echten Daten und keine Schreibwirkung

## 1. Zweck

PA51 hat den lokalen Operator-, Kosten- und Human-Approval-Rahmen fuer den
bestehenden `synthetic_live`-Korridor geklaert. PA54 hat direkt danach den
Datenscope oberhalb von `synthetic_live` als eigene Gate-Frage getrennt.

Damit bleibt die naechste offene Betreiberfrage:

Unter welchem Trusted-Operator-/Auth-Kontext duerfte ein spaeterer
providerfaehiger Draft-Pfad ueberhaupt laufen, sobald er nicht mehr nur der
rein lokale synthetic/demo Korridor ist?

PA55 macht genau diese Frage fuer Alexander entscheidungsreif, ohne B8/B9 zu
duplizieren und ohne einen produktionsnahen Auth-Pfad schon zu bauen.

## 2. Fuehrende Quellen

- `docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md`
- `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md`
- `docs/architecture/PA54_LLM_DATA_PII_DECISION_FRAME.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`

## 3. Aktueller Stand

Bereits vorhanden:

- lokaler `synthetic_live`-Korridor mit benannten internen Operatoren,
- lokaler Kosten-, Preflight- und Human-Approval-Rahmen,
- Trusted-Actor-Grenze fuer bestehende interne Read-/Export-/Audit-Pfade,
- Proxy-/IAP-Preflight als produktionsnaher Auth-Anker ausserhalb des lokalen
  Korridors.

Noch nicht explizit fuer den LLM-Draft-Pfad entschieden:

- ob ein spaeterer providerfaehiger Draft-Pfad weiter nur lokal unter einem
  benannten Operator laufen darf,
- ob ein nicht-lokaler Draft-Pfad nur hinter Trusted-Proxy/IAP-Kontext
  denkbar waere,
- ob freie Client-Header oder lokales `x-actor-name` jemals als belastbare
  LLM-Operatoridentitaet zaehlen duerften,
- wie streng Human Approval an den vertrauten Operatorkontext gebunden bleibt,
- ob ein spaeterer Draft-Pfad ueberhaupt ohne B9/B10-artigen Preflight in eine
  geteilte Zielumgebung duerfte.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Trusted-Operator-/Auth-Kontext oberhalb von `synthetic_live`.

Warum jetzt?

Sobald ein spaeterer Draft-Pfad mehr sein soll als ein rein lokaler
synthetic/demo Probe-Lauf, reicht "ein interner Operator fuehrt es aus" nicht
mehr als Sicherheits- und Nachweisformel. Dann muss klar sein, ob der
Operatorkontext weiter lokal bleibt oder nur hinter einem kontrollierten
Trusted-Proxy-/IAP-Rahmen denkbar ist.

## 5. Optionen

Option A:

- Beschreibung: Jeder spaetere providerfaehige Draft-Pfad bleibt strikt lokal
  und an einen benannten internen Operator gebunden. Kein nicht-lokaler
  LLM-Draft-Pfad.
- Vorteile: Kleinster Sicherheitsradius. Kein neuer Auth-/Proxy-Bedarf.
- Nachteile / Risiken: Kein Lernpfad fuer spaetere geteilte oder
  produktionsnaehere Draft-Kontexte.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Ein spaeterer nicht-lokaler providerfaehiger Draft-Pfad ist nur
  hinter einem kontrollierten Trusted-Proxy-/IAP-Kontext denkbar. Freie
  Client-Header, lokales `x-actor-name` oder ungepruefte Browser-Identitaet
  zaehlen nicht. Human Approval bleibt an einen klar benannten vertrauten
  Operatorkontext gebunden.
- Vorteile: Kleinster glaubwuerdiger Auth-Pfad fuer spaetere
  providerfaehige Draft-Nutzung ohne App-Login-Neubau.
- Nachteile / Risiken: Braucht B8/B9/B10-Denke, auch wenn noch kein Deployment
  erfolgt. Der Schritt erzeugt Architekturklarheit, aber keine sofortige
  Nutzbarkeit ausserhalb des lokalen Korridors.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- kein freier Client-Header als LLM-Operatoridentitaet;
- lokales `x-actor-name` bleibt Dev-/Test-Kompatibilitaet und keine
  belastbare LLM-Auth;
- nicht-lokaler Draft-Pfad nur hinter Trusted-Proxy/IAP-Kontext;
- `CATERING_TRUSTED_ACTOR_SECRET` serverseitig und nie clientseitig;
- keine direkte Service-Exposition am Proxy vorbei;
- Human Approval bleibt an benannte vertrauenswuerdige Operatorrollen gebunden;
- weiter keine App-Login-/Session-/OIDC-Implementierung als Teil dieses
  Entscheidungsschnitts;
- keine neue API, keine Persistenz, keine Produktschreibwirkung.

Option C:

- Beschreibung: Ein spaeterer providerfaehiger Draft-Pfad darf auch ohne
  Trusted-Proxy-/IAP-Kontext oder ueber freie Client-/Browser-Identitaet
  betrieben werden.
- Vorteile: Weniger Anfangsaufwand.
- Nachteile / Risiken: Unterlaeuft B8, B9 und PA9 praktisch sofort und wuerde
  einen unsauberen Auth-/Operatorkontext in die LLM-Schiene tragen.
- Aufwand: scheinbar niedrig, real hoch riskant.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Der LLM-Draft-Pfad braucht spaetestens oberhalb von `synthetic_live` einen
ehrlichen Trusted-Operatorkontext. Alles andere waere nur eine weichgespuelte
Version von "Header im Browser genuegen schon", und genau das ist durch B8/B9
bereits als nicht belastbar markiert.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: spaetere providerfaehige Draft-Nutzung bleibt lokal-only.
- Bei Option B: der naechste kleine Schritt waere eine weitere Vorlage oder ein
  Contract-Rahmen fuer LLM-spezifische Trusted-Operatorrollen und
  Approval-Bindung, weiter ohne Deployment oder Login-Bau.
- Bei Option C: vor jeder weiteren Arbeit muessten B8/B9/PA9 faktisch neu
  verhandelt werden; kein sicherer Minimalpfad.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- lokal-only fuer providerfaehige Draft-Laeufe,
- kein nicht-lokaler LLM-Draft-Pfad,
- kein freier Client- oder Browser-Header als vertrauter Operatorkontext,
- keine App-Login-/Session-Ausweitung,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
