# PA57 LLM Deployment-/Zielumgebungs-Entscheidungsrahmen

Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung
Stand: 2026-06-05
Scope: naechste bewusste Entscheidung nach PA56 fuer den Deployment- und Zielumgebungsrahmen eines spaeteren nicht-lokalen providerfaehigen Draft-Pfads; kein Deployment, keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung, keine neue API, keine Persistenz, keine Migration, keine echten Daten und keine Produktschreibwirkung

## 1. Zweck

PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt. PA55 hat die Trusted-Operator-/Auth-Frage nachgezogen. PA56 hat danach den Prompt-/Response-Retention- und Evidence-Rahmen geschaerft.

Damit bleibt die naechste offene Schwesterfrage:

Unter welchem Deployment- und Zielumgebungs-Kontext duerfte ein spaeterer nicht-lokaler providerfaehiger Draft-Pfad ueberhaupt denkbar sein, sobald er mehr sein soll als der heutige lokale `synthetic_live`-Korridor?

PA57 macht genau diese Frage fuer Alexander entscheidungsreif, ohne B25-B37 oder PA9 in Runtime- oder Infrastrukturarbeit zu verwandeln.

## 2. Fuehrende Quellen

- `docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md`
- `docs/architecture/PA54_LLM_DATA_PII_DECISION_FRAME.md`
- `docs/architecture/PA55_LLM_TRUSTED_OPERATOR_AUTH_DECISION_FRAME.md`
- `docs/architecture/PA56_LLM_RETENTION_EVIDENCE_DECISION_FRAME.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md`
- `docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md`
- `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md`
- `docs/deployment/B37_NONSENSITIVE_TECHNICAL_PREPARATION_PLAN.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/product/C11_10_10_GAP_AUDIT.md`

## 3. Aktueller Stand

Bereits vorhanden:

- lokaler `synthetic_live`-Korridor mit `preflight`, `probe`, `probe:strict` und `check`,
- lokaler Operator-, Kosten- und Human-Approval-Rahmen,
- getrennte Entscheidungsvorlagen fuer Datenrahmen, Trusted-Operator-/Auth-Kontext sowie Prompt-/Response-Retention und Evidence,
- Hetzner-/Deployment-Anker B25-B37 als nicht-sensitive Zielumgebungs- und Vorbereitungsgrenzen.

Noch nicht explizit fuer den LLM-Draft-Pfad entschieden:

- ob ein spaeterer providerfaehiger Draft-Pfad grundsaetzlich lokal-only bleiben soll,
- ob ein nicht-lokaler Draft-Pfad nur hinter bereits vorbereiteten Proxy-/IAP-/Zielumgebungs-Gates denkbar waere,
- ob Alexanders Hetzner-Zielumgebung ueberhaupt als erster spaeterer nicht-lokaler Draft-Rahmen dienen duerfte,
- welcher sichere Deployment-Default gilt, solange Daten-, Auth-, Logging- und Betriebsfragen noch nicht gemeinsam freigegeben sind,
- wie hart lokale Rehearsal-/Probe-Gruensignale gegen spaetere Zielumgebungs-Behauptungen getrennt bleiben muessen.

## 4. Entscheidung noetig

Kurzer Titel:

Erster Deployment-/Zielumgebungsrahmen oberhalb von `synthetic_live`.

Warum jetzt?

Sobald ein spaeterer Draft-Pfad nicht mehr nur lokal sein soll, reichen Daten-, Operator- und Evidence-Rahmen allein nicht mehr. Dann muss klar sein, ob der Korridor weiter lokal bleibt oder nur hinter bereits vorbereiteten Deployment-/Proxy-/Target-Environment-Gates ueberhaupt denkbar ist.

## 5. Optionen

Option A:

- Beschreibung: Jeder providerfaehige Draft-Pfad bleibt auf unbestimmte Zeit lokal-only. Kein nicht-lokaler LLM-Draft-Pfad.
- Vorteile: Kleinster Betriebsradius. Kein neuer Zielumgebungs- oder Deployment-Rahmen noetig.
- Nachteile / Risiken: Kein sauberer Pfad fuer spaetere geteilte oder produktionsnaehere Draft-Nutzung.
- Aufwand: niedrig.
- Empfehlung ja/nein: nein.

Option B:

- Beschreibung: Ein spaeterer nicht-lokaler providerfaehiger Draft-Pfad ist nur hinter den bereits vorbereiteten Deployment-/Proxy-/Target-Environment-Gates denkbar. B25-B37 und PA9 bleiben fuehrend; lokale `synthetic_live`-Gruensignale zaehlen nicht als Zielumgebungs- oder Deployment-Go.
- Vorteile: Kleinster glaubwuerdiger Zielumgebungsrahmen oberhalb des lokalen Korridors, ohne schon Deployment oder Infrastrukturarbeit zu starten.
- Nachteile / Risiken: Erzeugt noch keine Nutzbarkeit; klaert nur, dass jeder nicht-lokale Schritt zuerst ueber vorhandene Gates laufen muss.
- Aufwand: mittel.
- Empfehlung ja/nein: ja.

Minimale sichere Bedingungen fuer Option B:

- kein nicht-lokaler Draft-Pfad ohne B25-B37- und PA9-/B9-konformen Zielumgebungsrahmen;
- keine direkten Service-Endpunkte nur fuer den LLM-Draft-Pfad;
- keine lokalen Probe-, Preflight- oder Strict-Check-Erfolge als Deployment-Go;
- keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung und keine produktive ENV als Teil dieses Entscheidungsschnitts;
- Alexanders Hetzner-Zielumgebung bleibt nur ein vorbereiteter Entscheidungsanker und keine automatische erste Laufumgebung;
- Daten-, Auth-, Logging-/Evidence- und Human-Approval-Gates bleiben zusaetzlich fuehrend;
- keine neue API, keine Persistenz, keine Produktschreibwirkung.

Option C:

- Beschreibung: Ein spaeterer providerfaehiger Draft-Pfad darf auch ausserhalb eines vorbereiteten Proxy-/Target-Environment-Rahmens oder vor B25-B37-artigen Zielumgebungs-Gates laufen.
- Vorteile: Weniger Anfangsformalitaet.
- Nachteile / Risiken: Unterlaeuft PA9 sowie B25-B37 praktisch sofort und wuerde einen unsauberen nicht-lokalen Betriebsrahmen normalisieren.
- Aufwand: scheinbar niedrig, real hoch riskant.
- Empfehlung ja/nein: nein.

## 6. Empfehlung

Klare Empfehlung:

Option B in der kleinsten moeglichen Form.

Der sichere Weg ist nicht "einfach spaeter irgendwo hosten", sondern die klare Bindung: Nicht-lokale providerfaehige Draft-Pfade duerfen erst nach den bestehenden Zielumgebungs- und Proxy-Gates ueberhaupt denkbar sein.

## 7. Konsequenz

Was passiert nach Auswahl?

- Bei Option A: providerfaehige Draft-Nutzung bleibt lokal-only.
- Bei Option B: der naechste kleine Schritt waere hoechstens ein weiterer Contract- oder Decision-Frame fuer den ersten nicht-lokalen LLM-Draft-Preflight, weiter ohne Deployment-Arbeit.
- Bei Option C: vor jeder weiteren Arbeit muessten PA9 sowie B25-B37 faktisch neu verhandelt werden; kein sicherer Minimalpfad.

## 8. Sicherer Default

Wenn Alexander nicht entscheidet, bleibt der sichere Default:

- lokal-only fuer providerfaehige Draft-Laeufe,
- kein nicht-lokaler LLM-Draft-Pfad,
- kein Deployment- oder Zielumgebungs-Go aus lokalen Probe-/Rehearsal-Erfolgen,
- keine Serveraenderung, keine SSH-Verbindung, keine Secret-Erstellung,
- keine neue Runtime-Ausweitung,
- keine Produktschreibwirkung.
