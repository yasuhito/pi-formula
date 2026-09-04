---
summary: 保存済みコーパスを独立した Ghostty で撮影し、表示数式を実表示検証する
read_when:
  - 表示数式の実表示検証を実行または変更する時
  - コーパスモードとプロトコル層の検証の役割を確認する時
---

# 表示数式の実表示検証

`scripts/verify-display` は、保存済み Markdown を Ghostty 上の Pi に一字一句そのまま描画させ、履歴全体を1枚の PNG に撮るローカル専用ハーネスである。この**コーパスモード**は、表示の異常と検証作業の失敗を区別する。

## 実行

cage、wlr-randr、Ghostty、grim、jq、Node.js、Pi が必要になる。

```sh
scripts/verify-display docs/agents/verify-corpus/issue-21.md
```

検証の役割と、プロトコル層の検査入口は道具から取得できる。

```sh
scripts/verify-display --describe
```

## プロトコル層の検証

画像経路の転送、仮想配置、placeholder セルは、libghostty-vt を使う Tier A / Tier B で決定的に検査する。

```sh
npm run verify:encoder-protocol
npm run verify:pi-protocol
```

エンコーダ層は Pi とモデルを起動せず、Markdown transformer の出力を直接検査する。Pi を通す検査は保存済みコーパスセッションを `--offline` で開き、1回の描画が終わった時点のプロトコル状態を検査する。詳しい検査項目と native ツールがない場合の skip は、[libghostty-vt のプロトコル検査](libghostty-vt.md)を参照する。

フォントと字形の問題はプロトコル状態では分からない。動的字形は公開 API から PNG を作る `features/api.feature.md` のシナリオで回帰検査する。最終的な見た目はコーパスモードのキャプチャを人が確認する。

## 終了コード

| code | 意味 |
| --- | --- |
| 0 | ピクセル一次判定で帯を検出しなかった |
| 1 | 水平帯を検出した |
| 2 | 準備・描画・キャプチャ・判定に失敗した |

終了コード1を返すのはピクセル一次判定が帯を検出した場合だけとする。コマンド失敗と判定器の timeout・実行失敗は、実コマンド名を標準エラーへ示して2にする。

## キャプチャと目視

キャプチャは `$XDG_STATE_HOME/pi-formula/verify-display-capture.png`、`XDG_STATE_HOME` がなければ `~/.local/state/pi-formula/verify-display-capture.png` へ残す。保存先は `PI_FORMULA_VERIFY_CAPTURE` で変更できる。

```sh
PI_FORMULA_VERIFY_CAPTURE=/tmp/issue-21.png \
  scripts/verify-display docs/agents/verify-corpus/issue-21.md
```

`scripts/detect-display-bands.js` は色帯と黒帯を決定的な一次判定として検出する。表示数式の組版品質や内容の正しさは判定しない。合否の最終判断はキャプチャを人が見て行う。

## モデルと設定の隔離

```sh
PI_FORMULA_VERIFY_MODEL=openrouter/z-ai/glm-5.3-flash \
  scripts/verify-display docs/agents/verify-corpus/issue-21.md
```

既定ではプロジェクトの Pi 設定にあるモデルを使う。別のモデルは `PI_FORMULA_VERIFY_MODEL` で指定する。

拡張は利用者・project の設定から読み込まない。実行中の checkout にある `src/extension.ts`、検証用の追加マクロ、画像経路確認だけを明示して、tool を無効にする。pi-formula の設定は一時 `XDG_CONFIG_HOME` へ隔離し、利用者マクロを空に固定する。

検証用の追加マクロは qni-cli の `ket`、`bra`、`braket` と同じ定義を使う。CI は qni-cli の TypeScript を解析して名前、展開値、引数数を照合する。

現在の checkout の公開 API で試験用 PNG を作り、PNG 署名が一致したことを確認してから撮影する。画像経路を選べない場合は終了コード2にする。

## 安全性

`WAYLAND_DISPLAY` と `DISPLAY` を外し、`WLR_BACKENDS=headless` の cage を専用 process group で起動する。検証セッションの中だけで Ghostty を描画し、その Wayland display だけを grim で撮る。利用者の compositor、フォーカス、ワークスペースは使わない。

cage の出力は、コーパスから計画した 1920 x 8000〜16000 px へ広げる。Markdown の行数、折り返し、各表示数式の画像行数、Pi の画面部品を含めて高さを決める。16000 px に収まらないコーパスは描画前に拒否する。

通常の外部処理には8秒、ビルドには120秒、ピクセル判定には30秒の上限を使う。Ghostty の寿命は270秒とする。`EXIT`、`INT`、`TERM`、`HUP` では検証セッションの process group を停止する。

## 撮影条件

キャプチャ前に、セッション記録の最後の完了した assistant message とコーパスを照合する。末尾の改行だけを除き、一字一句一致しなければ終了コード2にする。

描画完了は次の3条件で決める。

- 専用の端末背景がキャプチャの1%以上を占める
- 背景以外の描画が0.1%以上ある
- 前回のキャプチャとピクセルが完全に一致する

2秒間隔で撮り直し、30秒以内に条件を満たさなければ終了コード2にする。キャプチャの寸法が計画と一致することも確認する。

水平帯判定は専用 theme の背景色、本文色、UI 色を候補から除く。残る ID 色と黒色について、一定幅と密度を持つ同色領域が3行以上連続する場合を水平帯とする。詳しい閾値の正本は `scripts/detect-display-bands.js` に置く。
