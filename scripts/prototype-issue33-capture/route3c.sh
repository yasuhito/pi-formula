#!/usr/bin/env bash
# PROTOTYPE — ルート 3c: cage (wlroots) の headless バックエンドで入れ子 Wayland
# compositor を立て、その中で Ghostty + grim を完結させる。
# 親セッション非依存 → ロック中でも動くはずの「本命」ルートの実証。
set -Eeuo pipefail
S=$(cd "${BASH_SOURCE[0]%/*}" && pwd)
CPID=

cleanup() {
  [[ -n "$CPID" ]] && kill "$CPID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# cage の中で走るラッパ: Ghostty を起動し、描画完了を待って grim で撮る
cat >"$S/cage-inner.sh" <<INNER
#!/usr/bin/env bash
set -u
echo "inner: WAYLAND_DISPLAY=\$WAYLAND_DISPLAY" >>"$S/cage.log"
ghostty --config-default-files=false --gtk-single-instance=false \
  --title=proto33xr3c -e "$S/content.sh" "$S/test-image.png" "$S/mark-r3c" &
GP=\$!
for _ in \$(seq 60); do [ -f "$S/mark-r3c" ] && break; sleep 0.25; done
sleep 2
timeout 15 grim "$S/r3c.png" && echo "inner: captured" >>"$S/cage.log" \
  || echo "inner: grim 失敗" >>"$S/cage.log"
kill "\$GP" 2>/dev/null
INNER
chmod +x "$S/cage-inner.sh"

rm -f "$S/mark-r3c" "$S/r3c.png"
env -u WAYLAND_DISPLAY -u DISPLAY \
  WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 \
  cage -- "$S/cage-inner.sh" >"$S/cage.log" 2>&1 &
CPID=$!

for _ in {1..90}; do
  kill -0 "$CPID" 2>/dev/null || break
  sleep 1
done
kill "$CPID" 2>/dev/null || true
CPID=

echo "-- cage.log:"
grep -E "inner:|ERROR|error" "$S/cage.log" | head -10 || tail -5 "$S/cage.log"
[[ -f "$S/mark-r3c" ]] && echo "描画マーカー: あり" || echo "描画マーカー: なし"
if [[ -f "$S/r3c.png" ]]; then
  magick identify "$S/r3c.png" | awk '{print "capture:", $3}'
  "$S/check.sh" "$S/r3c.png"
else
  echo "キャプチャなし"
fi
