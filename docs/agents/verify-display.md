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

既定ではプロジェクトの Pi 設定にあるモデルを使う。安価なモデルを指定する場合は `PI_FORMULA_VERIFY_MODEL` を使う。拡張は利用者・project の設定から探索しない。`--no-extensions` と `--extension` を併用し、実行中の checkout にある `src/extension.ts` だけを読み込む。qni-cli など、導入済み package の状態は検証結果へ影響しない。

pi-formula の設定は一時 `XDG_CONFIG_HOME` へ隔離し、利用者マクロも空に固定する。現在の checkout の公開 API で試験用 PNG を作り、8 byte の PNG 署名が完全に一致したことを補助拡張が記録する。保存済みの `path: "text"`、PNG 問い合わせ失敗、その他の理由で画像経路を選べない場合は exit 2 とし、キャプチャへ進まない。

```sh
PI_FORMULA_VERIFY_MODEL=openrouter/z-ai/glm-5.3-flash \
  scripts/verify-display docs/agents/verify-corpus/issue-21.md
```

## 安全性

ハーネスは実行ごとに一意な headless 出力を作る。Ghostty は `hl.dsp.exec_cmd` の `workspace` と `monitor` の `silent` 規則で、その出力へ作成時から割り当てる。`no_initial_focus` も指定する。後追い移動はしない。起動後は、Ghostty の monitor ID と実行前後の active window が変わっていないことを検査する。条件を満たさなければキャプチャせず失敗する。

すべての外部処理には時間上限がある。通常の外部処理は8秒、ビルドは120秒、最大画像のピクセル判定は30秒とする。Ghostty の240秒の寿命には、起動、画像経路、応答、描画、キャプチャの各期限と余裕を含める。キャプチャの直前と直後に、同じ address の対象ウィンドウが headless monitor 上に存在することを確認する。

Ghostty は専用の process group で起動し、その ID をウィンドウ待機より前に保存する。`EXIT`、`INT`、`TERM`、`HUP` の trap は、PID ファイルまたは対象ウィンドウの PID から process group を回収して停止する。dispatch 未成立などで process group と対象ウィンドウが存在しない場合も headless 出力を削除する。利用者の可視出力は撮影しない。`grim` には一意な headless 出力名だけを渡す。

## 履歴全体

コーパスを現在の typesetter で事前に組版し、各表示数式の実際の画像行数を求める。Markdown の行数・折り返し量、入力と応答の2回分の画像行数、Pi の画面部品を含む保守的な余白から、8000〜16000 px の縦長 headless 出力を選ぶ。短い LaTeX でも画像が高ければ必要高へ加算する。16000 px に収まらないコーパスは、ビューポートだけを撮らず描画前に拒否する。受理したコーパスはスクロールや画像結合を使わず、`grim -o` の 1 枚で履歴全体を取得する。キャプチャ前には session JSONL の最後の完了した assistant message から text content を取り出し、コーパスと一字一句比較する。コードフェンス、Unicode 化、前置き、欠落を含む不一致は exit 2 とし、キャプチャへ進まない。

この方式は GPU の最大テクスチャ寸法以下に限られる。長大な会話履歴一般を撮る道具ではなく、指定コーパスを一度だけ回帰検証するためのものとする。

## 判定

`scripts/detect-display-bands.js` は 8-bit RGB/RGBA の非インターレース PNG を読む。scanline の展開長が画像寸法と厳密に一致しない PNG は破損として拒否する。画素数の上限は 1920×16000 とする。

ハーネスは専用の Pi theme と Ghostty の背景色・本文色を使う。判定器へ背景色、本文色、theme の全 UI 色を明示し、それらを候補から除く。このため、本文色の長い分数線、コード、URL、金額、シェル変数、非数式 UI を水平帯と誤認しない。専用 palette と量子化誤差2以内で一致しない ID 色や黒色について、2px 以上の同色成分を走査する。同じ行で16px 以下の字形の隙間を挟む同色成分をまとめ、幅48px 以上かつ40%以上が同色の領域が3行以上続く場合を水平帯とする。画面幅ではなく帯自体の幅を使うため、幅384px未満の短い表示数式も判定できる。画面上下 1% の compositor 部品は対象外にする。

画素色は 24-bit 整数で扱い、背景色は固定長 histogram の一走査で求める。判定時間は画素数に比例する。横方向に色が変わり続ける上限寸法 1920×16000 の合成 PNG を、実処理と同じ30秒の上限で判定する回帰試験を置く。

この判定は決定的な一次判定であり、数式の組版品質や内容の正しさまでは判定しない。
