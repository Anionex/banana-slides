#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: smoke-linux-appimage.sh <appimage-path> [out-dir]" >&2
  exit 2
fi

appimage_path="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
out_dir="${2:-${TMPDIR:-/tmp}/banana-desktop-smoke-linux}"
result_path="$out_dir/smoke-result.json"
screenshot_path="$out_dir/smoke-screenshot.png"
log_path="$out_dir/smoke-linux.log"
user_data_dir="$out_dir/user-data"
xdg_config_home="$out_dir/xdg-config"
custom_data_root="$out_dir/custom-data-root"
storage_config_path="$user_data_dir/storage-config.json"

rm -rf "$out_dir"
mkdir -p "$user_data_dir" "$xdg_config_home" "$custom_data_root"

node -e '
  const fs = require("fs");
  const configPath = process.argv[1];
  const dataRoot = process.argv[2];
  fs.writeFileSync(configPath, `${JSON.stringify({ version: 1, dataRoot }, null, 2)}\n`);
' "$storage_config_path" "$custom_data_root"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$log_path"
}

fail() {
  log "FAIL $*"
  exit 1
}

cleanup() {
  if [[ -n "${app_pid:-}" ]] && kill -0 "$app_pid" >/dev/null 2>&1; then
    pkill -TERM -P "$app_pid" >/dev/null 2>&1 || true
    kill "$app_pid" >/dev/null 2>&1 || true
    for _ in 1 2 3; do
      if ! kill -0 "$app_pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    pkill -KILL -P "$app_pid" >/dev/null 2>&1 || true
    kill -KILL "$app_pid" >/dev/null 2>&1 || true
    wait "$app_pid" >/dev/null 2>&1 || true
  fi
  pkill -TERM -f "$appimage_path" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "Linux AppImage smoke started"
log "AppImage=$appimage_path"
log "UserData=$user_data_dir"
log "CustomDataRoot=$custom_data_root"

[[ -f "$appimage_path" ]] || fail "AppImage not found"
[[ "$(stat -c%s "$appimage_path")" -gt 100000000 ]] || fail "AppImage is unexpectedly small"
chmod +x "$appimage_path"

export APPIMAGE_EXTRACT_AND_RUN=1
export XDG_CONFIG_HOME="$xdg_config_home"
export BANANA_DESKTOP_SMOKE=1
export BANANA_DESKTOP_SMOKE_USER_DATA_DIR="$user_data_dir"
export BANANA_DESKTOP_SMOKE_RESULT="$result_path"
export BANANA_DESKTOP_SMOKE_SCREENSHOT="$screenshot_path"
export BANANA_DESKTOP_SMOKE_QUIT_DELAY_MS=60000

log "Launching AppImage under Xvfb"
xvfb-run -a "$appimage_path" --no-sandbox --user-data-dir="$user_data_dir" \
  >> "$out_dir/app-stdout.log" 2>> "$out_dir/app-stderr.log" &
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

[[ -f "$result_path" ]] || fail "Smoke result file was not created"

node -e '
  const fs = require("fs");
  const path = require("path");
  const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!result.ok) throw new Error("Smoke result reported failure");
  if (result.platform !== "linux") throw new Error(`Unexpected platform: ${result.platform}`);
  if (!result.backendPort) throw new Error("Missing backendPort");
  if (!result.windowVisible) throw new Error("Window was not visible");
  if (!result.url || !result.url.includes("index.html")) throw new Error(`Unexpected URL: ${result.url}`);
  if (!result.dataRoot) throw new Error("Missing dataRoot");
  if (path.resolve(result.dataRoot) !== path.resolve(process.argv[2])) {
    throw new Error(`Unexpected dataRoot: ${result.dataRoot}`);
  }
' "$result_path" "$custom_data_root"

[[ -f "$custom_data_root/data/database.db" ]] || fail "Database was not created in custom data root"
[[ -d "$custom_data_root/uploads" ]] || fail "Uploads directory was not created in custom data root"
[[ -d "$custom_data_root/exports" ]] || fail "Exports directory was not created in custom data root"
[[ -f "$screenshot_path" ]] || fail "Screenshot missing"
[[ "$(stat -c%s "$screenshot_path")" -gt 10000 ]] || fail "Screenshot is unexpectedly small"

backend_port="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).backendPort)' "$result_path")"
curl -fsS "http://127.0.0.1:${backend_port}/health" > "$out_dir/backend-health.json"

wait "$app_pid" || true
app_pid=""
log "RESULT: PASS"
