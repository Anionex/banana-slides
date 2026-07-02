#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: smoke-macos-dmg.sh <dmg-path> [out-dir]" >&2
  exit 2
fi

dmg_path="$1"
out_dir="${2:-${TMPDIR:-/tmp}/banana-desktop-smoke-mac}"
mount_dir="$out_dir/mount"
install_dir="$out_dir/Applications"
result_path="$out_dir/smoke-result.json"
screenshot_path="$out_dir/smoke-screenshot.png"
log_path="$out_dir/smoke-macos.log"

rm -rf "$out_dir"
mkdir -p "$mount_dir" "$install_dir"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$log_path"
}

fail() {
  log "FAIL $*"
  exit 1
}

cleanup() {
  if hdiutil info | grep -q "$mount_dir"; then
    hdiutil detach "$mount_dir" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

log "macOS DMG smoke started"
log "DMG=$dmg_path"

[[ -f "$dmg_path" ]] || fail "DMG not found"
[[ "$(stat -f%z "$dmg_path")" -gt 100000000 ]] || fail "DMG is unexpectedly small"

hdiutil attach "$dmg_path" -readonly -nobrowse -mountpoint "$mount_dir" | tee -a "$log_path"
app_path="$(find "$mount_dir" -maxdepth 2 -name '*.app' -type d | head -1)"
[[ -n "$app_path" ]] || fail "No .app found in DMG"
log "MountedApp=$app_path"

cp -R "$app_path" "$install_dir/"
installed_app="$install_dir/$(basename "$app_path")"
log "InstalledApp=$installed_app"

codesign --verify --deep --strict --verbose=2 "$installed_app" 2>&1 | tee "$out_dir/codesign-verify.txt" || fail "codesign verification failed"
spctl -a -vv "$installed_app" > "$out_dir/spctl.txt" 2>&1 || true

app_exe="$installed_app/Contents/MacOS/Banana Slides"
[[ -x "$app_exe" ]] || fail "App executable missing"

export BANANA_DESKTOP_SMOKE=1
export BANANA_DESKTOP_SMOKE_RESULT="$result_path"
export BANANA_DESKTOP_SMOKE_SCREENSHOT="$screenshot_path"

log "Launching app executable"
"$app_exe" >> "$out_dir/app-stdout.log" 2>> "$out_dir/app-stderr.log" &
app_pid=$!

deadline=$((SECONDS + 120))
while (( SECONDS < deadline )); do
  if [[ -f "$result_path" ]]; then
    break
  fi
  if ! kill -0 "$app_pid" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [[ ! -f "$result_path" ]]; then
  kill "$app_pid" >/dev/null 2>&1 || true
  fail "Smoke result file was not created"
fi

node -e '
  const fs = require("fs");
  const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!result.ok) throw new Error("Smoke result reported failure");
  if (!result.backendPort) throw new Error("Missing backendPort");
  if (!result.windowVisible) throw new Error("Window was not visible");
  if (!result.url || !result.url.includes("index.html")) throw new Error(`Unexpected URL: ${result.url}`);
' "$result_path"

[[ -f "$screenshot_path" ]] || fail "Screenshot missing"
[[ "$(stat -f%z "$screenshot_path")" -gt 10000 ]] || fail "Screenshot is unexpectedly small"

backend_port="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).backendPort)' "$result_path")"
curl -fsS "http://127.0.0.1:${backend_port}/health" > "$out_dir/backend-health.json"

wait "$app_pid" || true
log "RESULT: PASS"
