#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
BUILD_DIR="$PROJECT_DIR/dist"

run_timed() {
  /usr/bin/time -p "$@"
}

[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "PORT must be a numeric TCP port; got '$PORT'." >&2; exit 1; }
(( PORT >= 1 && PORT <= 65535 )) || { echo "PORT is outside the valid TCP range: $PORT." >&2; exit 1; }
: "${OPENCODE_WEB_DIR:?OPENCODE_WEB_DIR must point to the worker metadata directory}"

# This vanilla app has no package manifest: Three.js and all browser dependencies
# are already vendored in the project. Honor a manifest if one is added later.
if [[ -f package.json ]]; then
  if [[ -f package-lock.json ]]; then
    run_timed npm ci --no-audit --no-fund
  else
    run_timed npm install --no-audit --no-fund
  fi
fi

run_timed test -f index.html
run_timed test -f styles.css
run_timed test -f src/main.js
run_timed test -f vendor/three.module.js
run_timed rm -rf "$BUILD_DIR"
run_timed mkdir -p "$BUILD_DIR"
run_timed cp index.html styles.css "$BUILD_DIR/"
run_timed cp -R src vendor assets "$BUILD_DIR/"
run_timed test -f "$BUILD_DIR/index.html"
run_timed test -f "$BUILD_DIR/src/main.js"
run_timed test -f "$BUILD_DIR/vendor/three.module.js"
run_timed mkdir -p "$OPENCODE_WEB_DIR"
run_timed env PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" node -e 'const fs=require("node:fs"); const path=require("node:path"); const output={project:process.env.PROJECT_DIR,directory:path.resolve(process.env.BUILD_DIR)}; fs.writeFileSync(path.join(process.env.OPENCODE_WEB_DIR,"deployment-output.json"),JSON.stringify(output));'

# Keep the server in the foreground so the controller can own and supervise it.
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$BUILD_DIR"
