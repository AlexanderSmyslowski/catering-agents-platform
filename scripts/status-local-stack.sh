#!/usr/bin/env bash

set -euo pipefail

print_screen_status() {
  local session_name="$1"
  local pretty="$2"
  if (screen -ls 2>/dev/null || true) | grep -q "\\.${session_name}[[:space:]]"; then
    echo "${pretty}: läuft in screen (${session_name})"
  else
    echo "${pretty}: gestoppt"
  fi
}

print_url_status() {
  local label="$1"
  local url="$2"
  if curl -sf "${url}" >/dev/null 2>&1; then
    echo "  ${label}-URL: erreichbar (${url})"
  else
    echo "  ${label}-URL: nicht erreichbar (${url})"
  fi
}

print_screen_status "catering-ui" "UI"
print_screen_status "catering-intake" "Intake"
print_screen_status "catering-offer" "Angebot"
print_screen_status "catering-production" "Produktion"
print_screen_status "catering-exports" "Export"

print_url_status "UI" "http://127.0.0.1:3200"
print_url_status "Intake" "http://127.0.0.1:3101/health"
print_url_status "Angebot" "http://127.0.0.1:3102/health"
print_url_status "Produktion" "http://127.0.0.1:3103/health"
print_url_status "Export" "http://127.0.0.1:3104/health"
