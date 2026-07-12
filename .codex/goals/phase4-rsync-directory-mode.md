# Phase 4.2: Deploy-Verzeichnisrechte

Ziel: Ein Deployment aus einem restriktiven temporaeren Archiv darf dem
Remote-Operator nicht den Zugriff auf den Deploypfad entziehen.

Abnahme:
1. Der Deploy setzt den Remote-Wurzelpfad nach Rsync deterministisch auf 755.
2. Ein realer 700-Quellordner entzieht dem Remote-Operator nicht den Zugriff.
3. Deployment, Login-Smoke und bestehende externe Caddy-Sites bleiben gruen.
