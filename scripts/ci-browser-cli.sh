#!/usr/bin/env bash

set -euo pipefail

exec npx --yes --package @playwright/cli playwright-cli "$@"
