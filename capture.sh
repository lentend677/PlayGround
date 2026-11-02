#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

run_timed() {
  /usr/bin/time -p "$@"
}

: "${RUNTIME_DIR:?RUNTIME_DIR must point to the worker runtime}"
: "${CAPTURE_URL:?CAPTURE_URL must be the exact public preview URL}"
: "${CAPTURE_DIR:?CAPTURE_DIR must be the screenshot output directory}"

run_timed test -f "$RUNTIME_DIR/scripts/default-capture.mjs"
run_timed mkdir -p "$CAPTURE_DIR"
# Preserve the rendered menu state; never trigger gameplay or depend on a control click.
run_timed env CAPTURE_AUTO_START=false CAPTURE_READY_SELECTOR='#menu:not(.hidden)' CAPTURE_STRICT=1 \
  node "$RUNTIME_DIR/scripts/default-capture.mjs"
run_timed test -s "$CAPTURE_DIR/final-desktop.png"
run_timed test -s "$CAPTURE_DIR/final-mobile.png"
