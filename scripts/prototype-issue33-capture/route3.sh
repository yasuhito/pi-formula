#!/usr/bin/env bash
# PROTOTYPE — ルート 3: 入れ子の headless Hyprland。
# 親の WAYLAND_DISPLAY/DISPLAY を外して起動し、aquamarine が headless バックエンド
# のみで立ち上がるかを確認。成功したらその中で Ghostty + grim を完結させる。
set -Eeuo pipefail
S=$(cd "${BASH_SOURCE[0]%/*}" && pwd)
LOG="$S/nested.log"
CONF="$S/nested-min.lua"
HPID=

cleanup() {
  [[ -n "$HPID" ]] && kill "$HPID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cat >"$CONF" <<'LUA'
-- PROTOTYPE: 入れ子 headless Hyprland 用の最小設定（autostart なし）
hl.config({
  misc = { disable_hyprland_logo = true, disable_splash_rendering = true },
})
LUA

PARENT_SIG=${HYPRLAND_INSTANCE_SIGNATURE:-$(hyprctl instances -j | jq -r '.[0].instance')}
BEFORE=$(hyprctl instances -j | jq -r '.[].instance')

env -u WAYLAND_DISPLAY -u DISPLAY -u HYPRLAND_INSTANCE_SIGNATURE \
  AQ_DRM_DEVICES='' Hyprland -c "$CONF" >"$LOG" 2>&1 &
HPID=$!
echo "nested Hyprland pid=$HPID"

SIG=
for _ in {1..40}; do
  if ! kill -0 "$HPID" 2>/dev/null; then
    echo "== 入れ子 Hyprland が終了した。ログ末尾:"; tail -20 "$LOG"; exit 1
  fi
  SIG=$(hyprctl instances -j | jq -r '.[].instance' | grep -vxF "$PARENT_SIG" | head -1 || true)
  [[ -n "$SIG" ]] && break
  sleep 0.5
done
[[ -n "$SIG" ]] || { echo "新インスタンスが見つからない"; tail -20 "$LOG"; exit 1; }
echo "nested sig=$SIG"
sleep 2

WL=$(hyprctl instances -j | jq -r --arg s "$SIG" '.[]|select(.instance==$s)|(.wl_socket // .["wl socket"])')
echo "nested wayland socket=$WL"
H() { hyprctl -i "$SIG" "$@"; }
echo "-- nested monitors (起動直後):"
H monitors all -j | jq -r '.[]|"\(.name) \(.width)x\(.height)"' || true

H output create headless cap3 >/dev/null || echo "WARN: output create 失敗"
H eval 'hl.monitor({ output = "cap3", mode = "1280x800@60", position = "0x0", scale = "1" })' >/dev/null || true
sleep 1
H monitors all -j | jq -r '.[]|"\(.name) \(.width)x\(.height) ws=\(.activeWorkspace.id)"'

rm -f "$S/mark-r3"
env -u DISPLAY WAYLAND_DISPLAY="$WL" setsid ghostty --config-default-files=false --gtk-single-instance=false \
  --title=proto33xr3 -e "$S/content.sh" "$S/test-image.png" "$S/mark-r3" >"$S/ghostty-r3.log" 2>&1 &
GPID=$!
for _ in {1..60}; do [[ -f "$S/mark-r3" ]] && break; sleep 0.25; done
[[ -f "$S/mark-r3" ]] && echo "描画マーカー: あり" || { echo "描画マーカーが出ない。ghostty ログ:"; tail -10 "$S/ghostty-r3.log"; }
H clients -j | jq -r '.[]|"client: \(.title) at=\(.at) size=\(.size)"' || true
sleep 2
env -u DISPLAY WAYLAND_DISPLAY="$WL" timeout 15 grim -o cap3 "$S/r3.png" && echo captured || echo "grim 失敗"
[[ -f "$S/r3.png" ]] && "$S/check.sh" "$S/r3.png"
kill "$GPID" 2>/dev/null || true
