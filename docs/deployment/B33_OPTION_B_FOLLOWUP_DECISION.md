# B33 Option-B Abschluss- und Folgeentscheidung

Status: P13-N2 Entscheidung-only; kein Deployment-Go, kein echte-Daten-Go, kein SSH-Go und keine rechtssichere Compliance-/DSGVO-Freigabe
Stand: 2026-05-24
Scope: nicht-sensitive Abschluss- und Folgeentscheidung nach B32; keine SSH-Verbindung, keine Serveraenderung, keine Secret-Erstellung, keine produktive ENV, keine echte Datenverarbeitung, keine neue API, keine neue Persistenz, keine Migration und keine Produktlogik

## 1. Zweck

B33 schliesst P13-N2 ab: Nach dem B32-Readiness-Paket wird bewertet, ob ein klarer, sicherer Folgeplan fuer vorbereitende Umsetzung existiert oder ob `decision needed` beziehungsweise `blocked` stehen bleiben muss.

Alexander hat mit "go" den Start von P13-N2 beauftragt. Dieses "go" wird nicht als Deployment-Go, echte-Daten-Go oder SSH-Go interpretiert. Es startet nur diese Abschluss- und Folgeentscheidung.

## 2. Fuehrende Eingaben

- `docs/plans/hans-night-build-plan-13-option-b-real-data-hetzner-readiness-2026-05-24.md`
- `docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md`
- `docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md`
- `docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md`
- `docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md`
- `docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md`
- `docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md`
- `docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md`
- `docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md`

## 3. Ergebnis

Ergebniswert: `decision needed`.

Begruendung:

- kein `go fuer vorbereitende Umsetzung`, weil mehrere B32-Mussgruppen weiterhin `blocked` oder `not assessed` sind,
- kein `blocked` als Produktabbruch, weil Option B als Zielrichtung weiter moeglich bleibt,
- keine technische Umsetzung ohne weitere nicht-sensitive Entscheidungen.

Damit bleibt der aktuelle Stand: Option B ist bewusst gewollt, aber noch nicht vorbereitend umsetzbar.

## 4. Offene Mussgruppen aus B32

| Mussgruppe | Aktueller Befund | Folgeentscheidung |
| --- | --- | --- |
| Betreiber / Verantwortliche | technischer Betreiber und Stop-Verantwortung sind bekannt; fachlicher Betreiber fehlt als Rolle/Funktion | `decision needed` |
| Zugriffsschutz / Berechtigte | Nutzung nur durch Berechtigte ist gewollt, aber Zugriffsschicht fehlt | `decision needed` |
| Direkte Service-Exposition | Ausschluss direkter App-/API-/Serviceport-Erreichbarkeit ist noch nicht belegt | `decision needed` |
| Trusted-Header / Secret-Grenze | Header-Stripping und serverseitige Trusted-Header-Injektion sind noch nicht fuer Zielbetrieb bestaetigt | `decision needed` |
| Datenkategorien / PII-Scope | echte Daten sind gewollt, Kategorien sind nicht eng bestimmt | `decision needed` |
| Speicherort / Systemgrenze | Hetzner ist benannt, Daten-/Artefaktgrenzen fehlen | `decision needed` |
| Retention / Loeschung | Fristen und Loeschpfad fehlen | `decision needed` |
| Backup / Restore | Backup-/Restore-Verantwortung und Loeschwirkung fehlen | `decision needed` |
| Export / Audit / Logs | Klassifikation und Log-/Evidence-Regeln fuer echte Daten fehlen | `decision needed` |
| Uploads / Sandbox / AV | echte Uploads sind nicht ausgeschlossen und B14 ist nicht entschieden | `decision needed` |
| Dokumentation / Evidence | Dokumentation ist gewollt, sichere Ablage-/Belegregeln sind noch nicht final entschieden | `decision needed` |
| Recht / DSGVO / AVV | externe/rechtliche Bewertung ist nicht im Repo erfolgt | `not assessed` |
| Gesamtstatus | mindestens eine Mussgruppe offen | `decision needed` |

## 5. Mindestentscheidungen vor einem spaeteren Vorbereitungslauf

Vor einem spaeteren technischen Vorbereitungslauf muessen mindestens diese Entscheidungen ausserhalb oder sicher innerhalb des Repos geklaert werden:

1. Zugriffsschicht waehlen: VPN/Tailscale, IP-Allowlist plus Auth, Proxy/IAP/OIDC oder gleichwertige Zugriffsschicht.
2. direkte Service-Exposition ausschliessen: App/API/Serviceports duerfen nicht frei oeffentlich erreichbar sein.
3. Trusted-Header-/Secret-Grenze bestaetigen: clientseitige Actor-/Trusted-Header werden entfernt; Trusted-Kontext wird serverseitig gesetzt; keine Secret-Werte im Repo.
4. B13 echte-Daten-Entscheid ausfuellen: Datenkategorien, Speicherort/Systemgrenze, Retention/Loeschung, Backup/Restore, Zugriff, Export/Audit/Logs und Incident-/Loeschpfad.
5. B14 Upload-Entscheid treffen: echte Uploads explizit ausschliessen oder Sandbox/Worker/AV-Mindestentscheidungen treffen.
6. Recht/DSGVO/AVV ausserhalb des Repos klaeren: keine rechtssichere Freigabe im Repo behaupten.
7. Evidence-Regeln ohne PII bestaetigen: Nachweise, Reibungslog und Statusberichte ohne Secrets, IPs, Hostnamen, PII, echte Dokumentinhalte oder produktive Logs.

## 6. Harte Grenze fuer den naechsten technischen Schritt

Bis diese Mindestentscheidungen vorliegen, gilt:

- kein Serverzugriff vor diesen Entscheidungen,
- keine SSH-Verbindung,
- keine Serveraenderung,
- keine Secrets,
- keine produktive ENV,
- keine echten Daten,
- keine echten Uploads,
- kein Deployment,
- keine neue API,
- keine neue Persistenz,
- keine Migration,
- keine Login-/OIDC-/Session-Implementierung.

## 7. Naechster sinnvoller Schritt

Naechster sinnvoller Schritt: kein technischer Deployment- oder Serverlauf, sondern ein kurzer Management-/Owner-Entscheid zu den offenen B32-Mussgruppen.

Erst wenn diese Entscheidungen vorliegen, darf ein spaeterer Plan fuer vorbereitende Umsetzung erstellt werden. Dieser spaetere Plan muss weiterhin ohne sensible Werte starten und zuerst die Zugriffsschicht sowie Nicht-Exposition absichern, bevor echte Daten oder produktive Betriebswerte beruehrt werden.

## 8. Definition of Done

B33 ist erfuellt, wenn:

- diese Abschluss- und Folgeentscheidung im Repo auffindbar ist,
- das Ergebnis `decision needed` nicht als Produktabbruch und nicht als Go missverstanden werden kann,
- die offenen Mussgruppen aus B32 sichtbar bleiben,
- der naechste Schritt vor Serverzugriff/Secrets/echten Daten liegt,
- `entfernter Doku-Contract-Test` gruen ist,
- die Standard-Gates gruen sind: `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`.
