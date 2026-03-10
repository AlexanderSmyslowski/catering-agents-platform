#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: npm run checkpoint -- <short-name> [--push]"
  exit 1
fi

SHORT_NAME=""
PUSH=false

for arg in "$@"; do
  if [[ "$arg" == "--push" ]]; then
    PUSH=true
  elif [[ -z "$SHORT_NAME" ]]; then
    SHORT_NAME="$arg"
  fi
done

if [[ -z "$SHORT_NAME" ]]; then
  echo "Missing short checkpoint name."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree must be clean before creating a checkpoint."
  exit 1
fi

DATE_PART="$(date +%Y%m%d)"
COUNT="$(git tag --list "checkpoint-${DATE_PART}-*" | wc -l | tr -d ' ')"
NEXT_INDEX=$((COUNT + 1))
SLUG="$(echo "$SHORT_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
TAG="checkpoint-${DATE_PART}-${NEXT_INDEX}-${SLUG}"

echo "Running validation before creating ${TAG}..."
npm run build
npm test

git tag -a "${TAG}" -m "Checkpoint ${TAG}"
echo "Created tag ${TAG}"

if [[ "$PUSH" == true ]]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git push origin "${CURRENT_BRANCH}"
  git push origin "${TAG}"
  echo "Pushed ${CURRENT_BRANCH} and ${TAG}"
fi
