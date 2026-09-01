# PROTOTYPE — issue #33: headless キャプチャ経路の検証（使い捨て）

**これはプロトタイプです。本番コードではありません。** issue #33 の設計質問
「Hyprland 環境で Ghostty の端末内容（テキスト + Kitty graphics）を grim の
キャプチャに確実に写すには、どのルートを採用すべきか」に答えるための
最小実験スクリプト群と、その結果を記録します。

検証日: 2026-09-02 / 環境: Hyprland 0.56.2（Lua パーサ）, Ghostty 1.3.1, grim, ロック解除状態

## 結果の要約

**ルート 1（現セッションの headless 出力）は、特別なルールなしでもそのまま写る。**
f27043a 時点の「headless 出力に surface が合成されない」は現環境では再現しない。
過去の失敗は実験手順の偽陰性（Ghostty の起動完了を確認せずにキャプチャ）か、
実行時の環境状態（ロック等）だった可能性が高い。

| ルート | 結果 | テキスト | Kitty graphics | フォーカスを奪う | ロック中 |
|---|---|---|---|---|---|
| 1. headless 出力（ルールなし） | ✅ 写った | ✅ | ✅ | 奪わない | ❌ 不可（ロッカーが全出力を覆う） |
| 1'. + exec ルール render_unfocused（本番ハーネス構成） | ✅ 写った | ✅ | ✅ | 奪わない | ❌ 同上 |
| 1''. + window_rule + fps 60 | ✅ 写った | ✅ | ✅ | 奪わない | ❌ 同上 |
| 1'''. 縦長 1920x12000 出力（本番の実寸） | ✅ 写った | ✅ | ✅ | 奪わない | ❌ 同上 |
| 2. 瞬間 focusmonitor | ✅ 写った | ✅ | ✅ | 50 ms・完全復帰 | ❌ 同上 |
| 3a. 入れ子 headless Hyprland | ❌ 起動不可 | — | — | — | — |
| 3b. Xvfb + Ghostty(X11) + import | ✅ 写った | ✅ | ✅ | 奪わない | ✅ 可能なはず（親セッション非依存） |

## 各ルートの詳細

### ルート 1: 現セッションの headless 出力（route1.sh, route1c.sh）

- `hyprctl output create headless` + `hl.monitor(...)` + `hl.dsp.exec_cmd(...)` で
  Ghostty をスポーンし、描画完了後に `grim -o <出力名>`。
- **render_unfocused ルールも fps 引き上げも不要**（a2/c1/c2 の 3 変種すべて成功、
  fps は既定の 15 のまま）。grim の screencopy 要求が出力の render を強制し、
  その際に frame callback がクライアントへ届くため。
- 縦長 1920x12000（本番ハーネスの実寸相当）でも成功。GPU テクスチャ上限説は棄却。
- 注意: **Ghostty の起動完了（描画完了マーカー）を確認してからキャプチャすること**。
  初回スポーンは数秒かかることがあり、確認を怠ると空キャプチャ＝偽陰性になる。
  route1.sh の Phase A はこれで一度偽陰性を出した（route1c.sh で確認済み）。

### ルート 2: 瞬間 focusmonitor（route2.sh）

- `hl.dsp.focus({ monitor = ... })` で移して grim → 即復帰。奪ったのは 50 ms、
  元のモニタ・ウィンドウへ完全復帰。
- 動くが、ルート 1 が無条件で動く以上、採用理由がない。

### ルート 3a: 入れ子 headless Hyprland（route3.sh）— 起動不可

- 親セッションが logind の session controller を保持しているため、入れ子側は
  seat を取れず DRM/libinput backend が失敗（= 親セッションへの干渉はない）。
- headless フォールバックは `Cannot open backend: no allocator available` で失敗。
  aquamarine の allocator は DRM fd 必須で、これを与える環境変数はない
  （AQ_DRM_DEVICES は DRM backend 用で seat が先に必要）。
- wlroots 系 compositor（sway/cage/labwc/niri）は未インストール。
  `cage`（66 KiB + wlroots0.20）を入れれば `WLR_BACKENDS=headless cage` で
  Wayland のまま入れ子にできる見込み（未検証）。

### ルート 3b: Xvfb + Ghostty(X11)（route3b.sh）— 動く

- Xvfb は導入済み。`GDK_BACKEND=x11 DISPLAY=:77 ghostty ...` で起動し
  `magick import -window root` でキャプチャ。テキストも Kitty graphics も写る。
- 親 Wayland セッションと完全に独立なので、**ロック中でも動くはず**
  （ロック競合の根拠だった「ロッカーが全出力を覆う」「grim が応答しない」の
  どちらも X11 サーバには及ばない）。ロック中の実測は未実施。
- 代償: 表示サーバが X11 になり、本番の表示経路（Wayland/Hyprland/grim）から
  離れる。「Ghostty が Kitty graphics を描けたか」の検証には十分だが、
  「Hyprland 上での見え方」の検証としては忠実度が下がる。

## 採用推奨

- **主経路: ルート 1（現行ハーネスの構成のまま）**。修正すべきは合成待ちではなく
  「Ghostty の描画完了を確認してからキャプチャする」こと。render_unfocused は
  外してもよいが、害もないので残して構わない。
- **ロック中も動かしたい場合の逃げ道: ルート 3b（Xvfb）**、または cage を
  インストールして Wayland のまま入れ子にする（要検証）。
- ルート 2 は不要。

## 再実行方法

```sh
scripts/prototype-issue33-capture/route1c.sh   # ルート 1 の 3 変種
scripts/prototype-issue33-capture/route2.sh    # ルート 2
scripts/prototype-issue33-capture/route3b.sh   # ルート 3b (Xvfb)
```

各スクリプトは自己完結（headless 出力の作成〜削除まで面倒を見る）。
判定は check.sh（既知色 #00FF77 / #FF00FF / #00FFFF のピクセル数）と目視。
captures/ に代表キャプチャを残した。

## 副産物の知見

- この Hyprland 0.56 は Lua パーサ運用のため `hyprctl keyword` と
  旧 `dispatch exec "[rules] cmd"` 構文は使えない。`hl.config(...)` /
  `hl.window_rule(...)` / `hl.dsp.exec_cmd(...)` / `hl.dsp.focus(...)` を使う。
- headless 出力にも omarchy のバー（waybar）が乗る。本番ハーネスは
  ウィンドウ矩形で切り出すので影響なし。
- キャプチャの画像右側に淡い横線のアーティファクトが Wayland/X11 両方で出る
  （Ghostty の描画由来と推定）。帯検出器と干渉しないかは本番判定器で要確認。
