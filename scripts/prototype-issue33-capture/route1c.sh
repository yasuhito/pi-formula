#!/usr/bin/env bash
# PROTOTYPE — ルート 1 の切り分け: どの条件が最小で効くか（fps は既定の 15 のまま）。
#   a2 : ルールなし（陰性対照、ウィンドウ存在を確認してから判定）
#   c1 : exec ルール render_unfocused=true のみ（本番ハーネスと同一条件）
#   c2 : hl.window_rule render_unfocused のみ
set -Eeuo pipefail
S=$(cd "${BASH_SOURCE[0]%/*}" && pwd)
OUT=proto33r1

cleanup() {
  pkill -f -- '--title=proto33x' 2>/dev/null || true
  hyprctl output remove "$OUT" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

hyprctl output create headless "$OUT" >/dev/null 2>&1 || true
hyprctl eval "hl.monitor({ output = \"$OUT\", mode = \"1280x800@60\", position = \"6000x0\", scale = \"1\" })" >/dev/null
sleep 1
WS=$(hyprctl monitors all -j | jq -r --arg n "$OUT" '.[]|select(.name==$n).activeWorkspace.id')
echo "output=$OUT ws=$WS fps=$(hyprctl getoption misc:render_unfocused_fps -j | jq .int)"

variant() { # $1=name $2=extra_exec_rules $3=pre_lua(空可)
  local title="proto33x$1" marker="$S/mark-$1" launcher="$S/launch-$1"
  rm -f "$marker"
  [[ -n "$3" ]] && hyprctl eval "$3" >/dev/null
  printf '#!/usr/bin/env bash\nexec ghostty --config-default-files=false --gtk-single-instance=false --title=%q -e %q %q %q\n' \
    "$title" "$S/content.sh" "$S/test-image.png" "$marker" >"$launcher"
  chmod +x "$launcher"
  hyprctl dispatch "hl.dsp.exec_cmd(\"$launcher\", { workspace = \"$WS silent\", monitor = \"$OUT silent\", no_initial_focus = true, no_focus = true, no_anim = true$2 })" >/dev/null
  local exists=no
  for _ in {1..60}; do
    if hyprctl clients -j | jq -e --arg t "$title" '.[]|select(.title==$t)' >/dev/null; then exists=yes; break; fi
    sleep 0.25
  done
  local mark=no
  for _ in {1..40}; do [[ -f "$marker" ]] && { mark=yes; break; }; sleep 0.25; done
  sleep 1.5
  timeout 10 grim -o "$OUT" "$S/r1c-$1-1.png" || echo "grim fail 1"
  sleep 1.5
  timeout 10 grim -o "$OUT" "$S/r1c-$1-2.png" || echo "grim fail 2"
  pkill -f -- "--title=$title" 2>/dev/null || true
  sleep 0.5
  printf '%s: window=%s marker=%s | 1枚目: %s | 2枚目: %s\n' \
    "$1" "$exists" "$mark" \
    "$("$S/check.sh" "$S/r1c-$1-1.png" | tail -1)" \
    "$("$S/check.sh" "$S/r1c-$1-2.png" | tail -1)"
}

variant a2 "" ""
variant c1 ", render_unfocused = true" ""
variant c2 "" 'hl.window_rule({ match = { title = "^(proto33xc2)$" }, render_unfocused = true })'
