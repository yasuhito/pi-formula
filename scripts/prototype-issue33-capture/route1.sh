#!/usr/bin/env bash
# PROTOTYPE — ルート 1: 現セッションの headless 出力 + render_unfocused。
# この Hyprland (0.56, Lua パーサ) では keyword/旧 dispatch 構文が使えないため
# hl.* Lua API を使う（本番ハーネス scripts/verify-display と同じ流儀）。
# Phase A: render_unfocused なしで grim 3 連続（screencopy が frame callback を
#          誘発して 2 枚目以降に写るか）
# Phase B: exec ルール render_unfocused + hl.window_rule + fps 60 で再スポーン
set -Eeuo pipefail
S=$(cd "${BASH_SOURCE[0]%/*}" && pwd)
OUT=proto33r1
TITLE_A=proto33r1a
TITLE_B=proto33r1b

cleanup() {
  pkill -f -- "--title=$TITLE_A" 2>/dev/null || true
  pkill -f -- "--title=$TITLE_B" 2>/dev/null || true
  hyprctl eval 'hl.config({ misc = { render_unfocused_fps = 15 } })' >/dev/null 2>&1 || true
  hyprctl output remove "$OUT" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

focus_now() { hyprctl activewindow -j | jq -r '.address // "none"'; }

mk_launcher() { # $1=path $2=title $3=marker
  printf '#!/usr/bin/env bash\nexec ghostty --config-default-files=false --gtk-single-instance=false --title=%q -e %q %q %q\n' \
    "$2" "$S/content.sh" "$S/test-image.png" "$3" >"$1"
  chmod +x "$1"
}

spawn() { # $1=launcher $2=title $3=marker $4=extra_lua_rules("" or ", render_unfocused = true")
  rm -f "$3"
  hyprctl dispatch "hl.dsp.exec_cmd(\"$1\", { workspace = \"$WS silent\", monitor = \"$OUT silent\", no_initial_focus = true, no_focus = true, no_anim = true$4 })"
  for _ in {1..40}; do [[ -f "$3" ]] && break; sleep 0.25; done
  [[ -f "$3" ]] && echo "描画完了マーカー: あり" || echo "WARN: $2 の描画完了マーカーが出ない（続行）"
  hyprctl clients -j | jq -r --arg t "$2" '.[]|select(.title==$t)|"client: ws=\(.workspace.id) monitor=\(.monitor) at=\(.at) size=\(.size)"'
}

BEFORE_FOCUS=$(focus_now)
hyprctl output create headless "$OUT" >/dev/null 2>&1 || true
hyprctl eval "hl.monitor({ output = \"$OUT\", mode = \"1280x800@60\", position = \"6000x0\", scale = \"1\" })"
sleep 1
WS=$(hyprctl monitors all -j | jq -r --arg n "$OUT" '.[]|select(.name==$n).activeWorkspace.id')
echo "headless output=$OUT workspace=$WS"
[[ "$WS" =~ ^[0-9]+$ ]] || { echo "出力の workspace が取れない"; exit 2; }

echo "== Phase A: render_unfocused なし、grim 3 連続 =="
mk_launcher "$S/launch-a" "$TITLE_A" "$S/mark-a"
spawn "$S/launch-a" "$TITLE_A" "$S/mark-a" ""
sleep 1
for i in 1 2 3; do
  timeout 10 grim -o "$OUT" "$S/r1-noRule-$i.png" && echo "captured r1-noRule-$i" || echo "grim timeout/fail ($i)"
  sleep 1
done
pkill -f -- "--title=$TITLE_A" 2>/dev/null || true
sleep 0.5

echo "== Phase B: render_unfocused + window_rule + fps 60 =="
hyprctl eval "hl.window_rule({ match = { title = \"^($TITLE_B)\$\" }, render_unfocused = true })" || echo "WARN: window_rule 追加失敗"
hyprctl eval 'hl.config({ misc = { render_unfocused_fps = 60 } })' || echo "WARN: fps 設定失敗"
mk_launcher "$S/launch-b" "$TITLE_B" "$S/mark-b"
spawn "$S/launch-b" "$TITLE_B" "$S/mark-b" ", render_unfocused = true"
sleep 2
for i in 1 2; do
  timeout 10 grim -o "$OUT" "$S/r1-rule-$i.png" && echo "captured r1-rule-$i" || echo "grim timeout/fail ($i)"
  sleep 1
done

AFTER_FOCUS=$(focus_now)
[ "$BEFORE_FOCUS" = "$AFTER_FOCUS" ] && echo "focus: 不変" || echo "focus: 変わった! before=$BEFORE_FOCUS after=$AFTER_FOCUS"
echo "== 判定 =="
for f in "$S"/r1-*.png; do
  [[ -f "$f" ]] || continue
  printf '%s: ' "${f##*/}"
  "$S/check.sh" "$f" | tr '\n' ' '
  echo
done
