# CateringOS Installations-UX – Produktkandidat

Basis: `b1e3d44573bf6fe6d3c8e46861792a592535e856` (aktueller `origin/main`
am 04.10.2026), Branch `codex/cateringos-installation-ux` im eigenen Worktree.
Die Betreiberangabe zum abgeschlossenen P4.4C/v4-Betriebsstrang bleibt maßgeblich;
dieser Auftrag prüft oder verändert keinen Produktions-/Betriebsstand.

## Bestand und Umsetzung

- React 19/Vite 7, origin-root-basierte Routen `/`, `/angebot`, `/produktion`.
  Zuvor nur Servierglocken-SVG und Viewport-Meta; kein Manifest, Apple-Touch-Icon
  oder Service Worker. Bestehende responsive CSS-Breakpoints bleiben unverändert.
- Manifest `id`, `start_url`, `scope` jeweils `/`, Name/Kurzname `CateringOS`,
  `display: standalone`, Theme/Hintergrund `#edf3fb` passend zur bestehenden Shell.
  Alle Pfade bleiben origin-relativ; keine neue Loginroute oder Deep-Link-Konvention.
- HTML-Dokumenttitel, Login-Branding und Portalüberschrift heißen `CateringOS`.
  Apple-Titel/Capable-Meta und Statusbar `default` sind gesetzt. Der bestehende
  Viewport bleibt ohne `viewport-fit=cover`; kein Inhalt unter Displayausschnitte
  gelegt, keine Safari-Speziallogik. Credentialed Manifest-Link wegen vorhandener
  Basic-Auth-geschützter statischer Auslieferung.
- Online-first ohne Service Worker, Offlinecache, Installationsprompt oder neuen
  Updater. Neue Dateien werden vom bestehenden Vite-Build nach `dist` und über
  den vorhandenen Webimage-/Releaseweg ausgeliefert.

## Freigegebenes Icon B und Reproduktion

Der Nutzer hat Entwurf B „Geteilter Teller“ ausdrücklich freigegeben.
Die Original-SVG-Datei aus dem fremden Scratchpad ist lokal nicht verfügbar.
Deshalb wurde exakt der SVG-Codeblock aus „CateringOS Better Stack Check“,
Quellnachricht `641b400f-11b1-460a-8d20-3c1b00238d6c`, übernommen:
`https://chatgpt.com/c/6abc2c17-5de0-83eb-ad8f-423aa9b24c4b`.
Keine Screenshot-Konvertierung oder visuelle Neugestaltung.

Einziger SVG-Master und SVG-Favicon: `backoffice-ui/public/favicon.svg`.
SHA-256 (UTF-8, abschließender Zeilenumbruch):
`fea90890008b913d9fb3e5bda8c3a647c5a3bc628eb0906224ef0c861909bce8`.

```bash
npm ci
node scripts/generate-cateringos-icons.mjs
node scripts/generate-cateringos-icons.mjs --check
```

Der Renderer `@resvg/resvg-js` ist ausschließlich als Dev-Abhängigkeit auf
`2.6.2` fixiert; kein Browserdownload, kein zusätzlicher Releasepfad.
Er erzeugt PNG-Favicon 32×32, Apple Touch 180×180 und PWA 192×192/512×512.
48×48 ist nur eine lokale Sichtprobe, kein zusätzliches Produktasset.
32×32 und 48×48 wurden am gerenderten Master visuell geprüft: Teilung, Versatz
und Tellerrand sind erkennbar. Manifest-Purpose nur `any`; es wird keine
Maskable-/Safe-Zone-Freigabe behauptet.

## Auth und konkrete Grenzen

- Unverändert: Same-Origin-Fetch, serverseitige Sessionprüfung, Cookie mit
  Secure/HttpOnly/SameSite=Strict und Pfad `/`, Origin-/Host-Prüfung bei
  Authmutationen. Kein Credential-/Token-Storage oder browserseitiger Bypass.
- Safari kann Web-App-Cookies getrennt vom Browser verwalten; erneute Anmeldung
  und unabhängiger Logout sind möglich. Das bleibt derselbe serverseitige
  Authvertrag, keine eigene App-Authentifizierung.
- Chromium-Installation über das Browsermenü benötigt keinen Cache-Service-Worker;
  eine automatische Installationswerbung wird nicht garantiert. Mac ab Sonoma 14;
  iPhone/iPad über Safari-Home-Bildschirm. OS-Steuerelemente bleiben browserverwaltet.
- Der vorhandene gesperrte Edge-Modus erlaubt die neuen Manifest-/Iconpfade nicht.
  Installation erfordert die bereits zugängliche Anwendung. Kein Aufweiten von
  Schutz-/Allowlistregeln und keine Infrastrukturänderung.
- Keine echte Dock-/Home-Bildschirm-/Windows-Installation und kein Produktions-
  Basic-Auth-Nachweis in diesem Auftrag. Lokale Chromium-Prüfungen ersetzen keine
  Betriebssystemprobe. Bereits offene Fenster benötigen nach Releases einen Reload;
  es wird keine sofortige Aktualisierung oder vollständige HTTP-Cachefreiheit versprochen.

## Prüfung und Annahmegrenze

RED: vier Installationsverträge, Login-Branding und drei Portal-/Routentitelchecks
scheiterten vor Umsetzung an fehlenden Assets/Metadaten oder bisherigen Namen.
GREEN: 82 gezielte Installations-, Login-, Shell-, Route- und Harness-Verträge
sowie 27 Auth-/Hosted-Session-Verträge (109 Tests); `npm run build` erfolgreich.
Die gezielten Tests prüfen echte PNG-Header/-Maße, Manifestpfade/Scope und
unveränderte Raster-Reproduktion. Der vollständige bestehende Fresh-Browser-Rehearsal
bestand Desktop 1440×900/Mobil 390×844, Handoff, Submit, Soft-Archiv und
Failed-Upload. Chromium liest das gebaute Manifest ohne Fehler, alle PNGs laden
mit korrektem MIME und Maßen; kein Service Worker registriert. Der unabhängige
Qualitätsreview wird am finalen Kandidaten geprüft; PR-CI bleibt
ein eigener, exakt an den gepushten Head gebundener Abschlussnachweis.

Installation ist Produktumfang; Merge, Deployment, Produktionskontakt, v4-/Backup-
oder Restoreänderung und Hub-Writeback sind nicht freigegeben und wurden nicht ausgeführt.
