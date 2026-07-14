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
  if [[ -n "${app_pid:-}" ]] && kill -0 "$app_pid" >/dev/null 2>&1; then
    pkill -TERM -P "$app_pid" >/dev/null 2>&1 || true
    kill "$app_pid" >/dev/null 2>&1 || true
    for _ in 1 2 3; do
      if ! kill -0 "$app_pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    if kill -0 "$app_pid" >/dev/null 2>&1; then
      pkill -KILL -P "$app_pid" >/dev/null 2>&1 || true
      kill -KILL "$app_pid" >/dev/null 2>&1 || true
    fi
    wait "$app_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "${install_dir:-}" ]]; then
    pkill -TERM -f "$install_dir" >/dev/null 2>&1 || true
    for _ in 1 2 3; do
      if ! pgrep -f "$install_dir" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    pkill -KILL -f "$install_dir" >/dev/null 2>&1 || true
  fi
  if [[ -n "${mount_dir:-}" ]] && hdiutil info | grep -q "$mount_dir"; then
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

bundle_icon_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "$installed_app/Contents/Info.plist" 2>/dev/null || true)"
[[ "$bundle_icon_name" == "icon.icns" ]] || fail "Unexpected CFBundleIconFile: $bundle_icon_name"
bundle_icon="$installed_app/Contents/Resources/$bundle_icon_name"
[[ -f "$bundle_icon" ]] || fail "Bundle icon missing: $bundle_icon"

bundle_icon_asset_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconName' "$installed_app/Contents/Info.plist" 2>/dev/null || true)"
[[ "$bundle_icon_asset_name" == "Icon" ]] || fail "Unexpected CFBundleIconName: $bundle_icon_asset_name"
asset_catalog="$installed_app/Contents/Resources/Assets.car"
[[ -f "$asset_catalog" ]] || fail "Adaptive Assets.car missing: $asset_catalog"
[[ "$(stat -f%z "$asset_catalog")" -gt 10000 ]] || fail "Adaptive Assets.car is unexpectedly small"
assetutil --info "$asset_catalog" > "$out_dir/icon-assets.json"
node -e '
  const assets = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const header = assets.find((asset) => asset.Appearances);
  if (!assets.some((asset) => asset.Name === "Icon" && asset.AssetType === "Icon Image")) {
    throw new Error("Assets.car does not contain the Icon app icon");
  }
  if (!header?.Appearances || !("NSAppearanceNameDarkAqua" in header.Appearances)) {
    throw new Error("Assets.car does not contain a dark appearance");
  }
' "$out_dir/icon-assets.json"

for tray_icon in trayTemplate.png trayTemplate@2x.png; do
  installed_tray_icon="$installed_app/Contents/Resources/$tray_icon"
  [[ -f "$installed_tray_icon" ]] || fail "Tray template icon missing: $installed_tray_icon"
  cmp -s "$installed_tray_icon" "$(dirname "$0")/../resources/$tray_icon" || fail "Packaged $tray_icon differs from source"
done

codesign --verify --deep --strict --verbose=2 "$installed_app" 2>&1 | tee "$out_dir/codesign-verify.txt" || fail "codesign verification failed"
spctl -a -vv "$installed_app" > "$out_dir/spctl.txt" 2>&1 || true

app_exe="$installed_app/Contents/MacOS/Banana Slides"
[[ -x "$app_exe" ]] || fail "App executable missing"

export BANANA_DESKTOP_SMOKE=1
export BANANA_DESKTOP_SMOKE_RESULT="$result_path"
export BANANA_DESKTOP_SMOKE_SCREENSHOT="$screenshot_path"
export BANANA_DESKTOP_SMOKE_QUIT_DELAY_MS=60000

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
  fail "Smoke result file was not created"
fi

node -e '
  const fs = require("fs");
  const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!result.ok) throw new Error("Smoke result reported failure");
  if (!result.backendPort) throw new Error("Missing backendPort");
  if (!result.windowVisible) throw new Error("Window was not visible");
  if (!result.url || !result.url.includes("index.html")) throw new Error(`Unexpected URL: ${result.url}`);
  if (result.iconPolicy?.dockOverrideApplied !== false) throw new Error("Packaged macOS must not override the bundle Dock icon");
  if (result.iconPolicy?.trayTemplateImage !== true) throw new Error("macOS Tray icon was not marked as a template image");
' "$result_path"

[[ -f "$screenshot_path" ]] || fail "Screenshot missing"
[[ "$(stat -f%z "$screenshot_path")" -gt 10000 ]] || fail "Screenshot is unexpectedly small"

backend_port="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).backendPort)' "$result_path")"
curl -fsS "http://127.0.0.1:${backend_port}/health" > "$out_dir/backend-health.json"

wait "$app_pid" || true
app_pid=""
log "RESULT: PASS"
