#!/usr/bin/env bash
# PROTOTYPE — キャプチャ PNG に (a) テキストマーカー緑 #00FF77 と
# (b) Kitty graphics のマゼンタ #FF00FF / シアン #00FFFF が写っているかを数える。
set -u
f="$1"
hist=$(magick "$f" -format %c histogram:info:- 2>/dev/null)
count() { printf '%s\n' "$hist" | grep -F "$1" | awk -F: '{s+=$1} END{printf "%d", s+0}'; }
green=$(count '#00FF77')
magenta=$(count '#FF00FF')
cyan=$(count '#00FFFF')
echo "green=$green magenta=$magenta cyan=$cyan"
if [ "$green" -gt 100 ] && [ "$magenta" -gt 1000 ]; then
  echo "VERDICT: 写った (テキスト+画像)"
elif [ "$green" -gt 100 ]; then
  echo "VERDICT: テキストのみ (Kitty graphics が写らない)"
elif [ "$magenta" -gt 1000 ]; then
  echo "VERDICT: 画像のみ (テキストが写らない?)"
else
  echo "VERDICT: 写らない"
fi
