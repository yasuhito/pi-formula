#!/usr/bin/env bash
# PROTOTYPE — ルート 2: キャプチャの瞬間だけ focusmonitor で headless 出力へ
# フォーカスを移して戻す。奪っている時間と復帰の正確さを計測する。
set -Eeuo pipefail
S=$(cd "${BASH_SOURCE[0]%/*}" && pwd)
OUT=proto33r2
TITLE=proto33xr2

ghostty_pid() { hyprctl clients -j | jq -r --arg t "$TITLE" '.[]|select(.title==$t)|.pid' | head -1; }

cleanup() {
  local p; p=$(ghostty_pid || true)
  [[ -n "${p:-}" ]] && kill "$p" 2>/dev/null || true
  hyprctl output remove "$OUT" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

hyprctl output create headless "$OUT" >/dev/null
hyprctl eval "hl.monitor({ output = \"$OUT\", mode = \"1280x800@60\", position = \"6000x0\", scale = \"1\" })" >/dev/null
sleep 1
WS=$(hyprctl monitors all -j | jq -r --arg n "$OUT" '.[]|select(.name==$n).activeWorkspace.id')

rm -f "$S/mark-r2"
printf '#!/usr/bin/env bash\nexec ghostty --config-default-files=false --gtk-single-instance=false --title=%q -e %q %q %q\n' \
  "$TITLE" "$S/content.sh" "$S/test-image.png" "$S/mark-r2" >"$S/launch-r2"
chmod +x "$S/launch-r2"
hyprctl dispatch "hl.dsp.exec_cmd(\"$S/launch-r2\", { workspace = \"$WS silent\", monitor = \"$OUT silent\", no_initial_focus = true, no_focus = true, no_anim = true })" >/dev/null
for _ in {1..60}; do [[ -f "$S/mark-r2" ]] && break; sleep 0.25; done
[[ -f "$S/mark-r2" ]] || { echo "描画マーカーが出ない"; exit 2; }
sleep 1

BEFORE_MON=$(hyprctl monitors -j | jq -r '.[]|select(.focused).name')
BEFORE_WIN=$(hyprctl activewindow -j | jq -r '.address // "none"')
echo "before: monitor=$BEFORE_MON window=$BEFORE_WIN"

T0=$(date +%s%3N)
hyprctl dispatch "hl.dsp.focus({ monitor = \"$OUT\" })" >/dev/null
MID_MON=$(hyprctl monitors -j | jq -r '.[]|select(.focused).name')
timeout 10 grim -o "$OUT" "$S/r2.png"
hyprctl dispatch "hl.dsp.focus({ monitor = \"$BEFORE_MON\" })" >/dev/null
if [[ "$BEFORE_WIN" != "none" ]]; then
  hyprctl dispatch "hl.dsp.focus({ window = \"$BEFORE_WIN\" })" >/dev/null 2>&1 || true
fi
T1=$(date +%s%3N)

AFTER_MON=$(hyprctl monitors -j | jq -r '.[]|select(.focused).name')
AFTER_WIN=$(hyprctl activewindow -j | jq -r '.address // "none"')
echo "フォーカス移動中の focused monitor: $MID_MON (headless へ移った=$([ "$MID_MON" = "$OUT" ] && echo yes || echo no))"
echo "奪っていた時間: $((T1 - T0)) ms"
echo "after: monitor=$AFTER_MON window=$AFTER_WIN (復帰=$([ "$AFTER_MON" = "$BEFORE_MON" ] && [ "$AFTER_WIN" = "$BEFORE_WIN" ] && echo 完全 || echo 不完全))"
"$S/check.sh" "$S/r2.png"
