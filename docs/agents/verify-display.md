# 表示数式の実表示検証

`scripts/verify-display` は、Ghostty 上の Pi に Markdown コーパスをそのまま描画させ、表示数式の色帯や黒帯をピクセルで検出するローカル専用ハーネスである。

## 実行

Hyprland 0.55 以降の Lua dispatcher、Ghostty、grim、jq、Node.js、Pi が必要になる。

```sh
scripts/verify-display docs/agents/verify-corpus/issue-21.md
```

異常がなければ 0、水平帯を検出すると 1、準備・描画・キャプチャに失敗すると 2 で終了する。検出時は次のように座標と RGB を表示する。

```text
異常な水平帯を 1 件検出しました
- x=120..1780, y=940..1012, rgb=210,0,170
```

キャプチャを残す場合は保存先を明示する。

```sh
PI_FORMULA_VERIFY_CAPTURE=/tmp/issue-21.png \
  scripts/verify-display docs/agents/verify-corpus/issue-21.md
```

既定ではプロジェクトの Pi 設定にあるモデルを使う。安価なモデルを指定する場合は `PI_FORMULA_VERIFY_MODEL` を使う。

```sh
PI_FORMULA_VERIFY_MODEL=openrouter/z-ai/glm-5.3-flash \
  scripts/verify-display docs/agents/verify-corpus/issue-21.md
```

## 安全性

ハーネスは実行ごとに一意な headless 出力を作る。Ghostty は `hl.dsp.exec_cmd` の `workspace` と `monitor` の `silent` 規則で、その出力へ作成時から割り当てる。`no_initial_focus` も指定する。後追い移動はしない。起動後は、Ghostty の monitor ID と実行前後の active window が変わっていないことを検査する。条件を満たさなければキャプチャせず失敗する。

すべての外部処理には時間上限がある。`EXIT`、`INT`、`TERM`、`HUP` の trap は、失敗時も Ghostty を閉じ、headless 出力と一時ファイルを削除する。利用者の可視出力は撮影しない。`grim` には一意な headless 出力名だけを渡す。

## 履歴全体

コーパスの行数と折り返し量から、8000〜16000 px の縦長 headless 出力を実行前に選ぶ。入力メッセージ、応答、Pi の画面部品を含む保守的な余白を加える。16000 px に収まらないコーパスは、ビューポートだけを撮らず実行前に拒否する。受理したコーパスはスクロールや画像結合を使わず、`grim -o` の 1 枚で履歴全体を取得する。

この方式は GPU の最大テクスチャ寸法以下に限られる。長大な会話履歴一般を撮る道具ではなく、指定コーパスを一度だけ回帰検証するためのものとする。

## 判定

`scripts/detect-display-bands.js` は 8-bit RGB/RGBA の非インターレース PNG を読む。画面で最も多い色を背景色とし、背景色に近い色を除く。画面幅の 20% 以上に連続する同色領域が 3 行以上続く場合を水平帯とする。字形で途切れた同色領域は近接する座標へまとめる。画面上下 1% の compositor 部品は対象外にする。本文の字形や正常な透明背景の表示数式は、長い同色矩形を作らないため検出しない。

この判定は決定的な一次判定であり、数式の組版品質や内容の正しさまでは判定しない。
