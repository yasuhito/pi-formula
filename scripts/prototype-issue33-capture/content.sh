#!/usr/bin/env bash
# PROTOTYPE — issue #33 検証用の使い捨てスクリプト。Ghostty 内で実行される。
# 既知色のマーカー（緑帯 #00FF77）と Kitty graphics（test-image.png, マゼンタ #FF00FF）を
# 描画し、完了マーカーを touch して待機する。
set -u
IMG="$1"
MARK="$2"
clear
# テキストマーカー: 緑帯 2 本 + プレーンテキスト
printf '\e[48;2;0;255;119m%60s\e[0m\n' ''
printf '\e[48;2;0;255;119m%60s\e[0m\n' ''
printf 'PROTO33 TEXT MARKER ABCDEFG 0123456789\n'
printf 'The quick brown fox jumps over the lazy dog\n'
# Kitty graphics: PNG (f=100) を直接転送・表示。base64 を 4000 byte で分割送信
b64=$(base64 -w0 "$IMG")
first=1
while [ -n "$b64" ]; do
  chunk=${b64:0:4000}
  b64=${b64:4000}
  if [ -n "$b64" ]; then m=1; else m=0; fi
  if [ "$first" -eq 1 ]; then
    printf '\e_Ga=T,f=100,m=%d;%s\e\\' "$m" "$chunk"
    first=0
  else
    printf '\e_Gm=%d;%s\e\\' "$m" "$chunk"
  fi
done
printf '\nPROTO33 AFTER IMAGE\n'
touch "$MARK"
sleep 300
