# Phase 4.2: Interner Zugriff

Ziel: Die Hetzner-App ist nur nach internem Login erreichbar und leitet
Operatorrollen ausschliesslich aus der vertrauenswuerdigen Proxy-Schicht ab.

Abnahme:
1. Ohne Login antworten UI und APIs mit 401; mit Login sind UI und Healthchecks erreichbar.
2. Frei gesetzte Actor-/Trusted-Header werden entfernt und koennen die serverseitige Rolle nicht ueberschreiben.
3. Login- und Trusted-Secrets bleiben ausserhalb von Git und Logs; Smoke und Browserprobe laufen authentifiziert.

Nicht Teil dieses Slices: echte Kundendaten, Upload-Freigabe, Mehrbenutzerverwaltung oder OAuth/OIDC.
