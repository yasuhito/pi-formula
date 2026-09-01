#!/usr/bin/env bash
# PROTOTYPE — ルート 3b: Xvfb (X11 headless) の中で Ghostty + import キャプチャ。
# 親 Wayland セッションから完全に独立 → ロック中でも動くはず。
set -Eeuo pipefail
S=$(cd "${BASH_SOURCE[0]%/*}" && pwd)
DPY=:77
XPID=
GPID=

cleanup() {
  [[ -n "$GPID" ]] && kill "$GPID" 2>/dev/null || true
  [[ -n "$XPID" ]] && kill "$XPID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

Xvfb "$DPY" -screen 0 1280x800x24 >"$S/xvfb.log" 2>&1 &
XPID=$!
for _ in {1..20}; do [[ -e /tmp/.X11-unix/X77 ]] && break; sleep 0.25; done
[[ -e /tmp/.X11-unix/X77 ]] || { echo "Xvfb が起動しない"; exit 1; }
echo "Xvfb pid=$XPID display=$DPY"

rm -f "$S/mark-r3b"
env -u WAYLAND_DISPLAY DISPLAY="$DPY" GDK_BACKEND=x11 setsid \
  ghostty --config-default-files=false --gtk-single-instance=false \
  --title=proto33xr3b -e "$S/content.sh" "$S/test-image.png" "$S/mark-r3b" \
  >"$S/ghostty-r3b.log" 2>&1 &
GPID=$!
for _ in {1..60}; do [[ -f "$S/mark-r3b" ]] && break; sleep 0.25; done
if [[ -f "$S/mark-r3b" ]]; then
  echo "描画マーカー: あり"
else
  echo "描画マーカーが出ない。ghostty ログ:"
  tail -15 "$S/ghostty-r3b.log"
fi
sleep 2
env -u WAYLAND_DISPLAY DISPLAY="$DPY" timeout 15 magick import -window root "$S/r3b.png" \
  && echo captured || echo "import 失敗"
[[ -f "$S/r3b.png" ]] && "$S/check.sh" "$S/r3b.png"
