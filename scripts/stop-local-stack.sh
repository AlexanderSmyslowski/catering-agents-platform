#!/usr/bin/env bash

set -euo pipefail

stop_screen_session() {
  local session_name="$1"
  if (screen -ls 2>/dev/null || true) | grep -q "\\.${session_name}[[:space:]]"; then
    echo "Stoppe ${session_name}..."
    screen -S "${session_name}" -X quit || true
  fi
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  launchctl bootout "gui/$(id -u)/com.cateringagents.ui" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.exports" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.production" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.offer" >/dev/null 2>&1 || true
  launchctl bootout "gui/$(id -u)/com.cateringagents.intake" >/dev/null 2>&1 || true
  rm -f \
    "${HOME}/Library/LaunchAgents/com.cateringagents.intake.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.offer.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.production.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.exports.plist" \
    "${HOME}/Library/LaunchAgents/com.cateringagents.ui.plist"
fi

stop_screen_session "catering-ui"
stop_screen_session "catering-exports"
stop_screen_session "catering-production"
stop_screen_session "catering-offer"
stop_screen_session "catering-intake"

echo "Lokaler Stack gestoppt."
