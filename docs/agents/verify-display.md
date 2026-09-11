---
summary: 保存済みコーパスを独立した端末で撮影し、表示数式を実表示検証する
read_when:
  - 表示数式の実表示検証を実行または変更する時
  - コーパスモードとプロトコル層の検証の役割を確認する時
---

# 表示数式の実表示検証

実表示検証は、保存済み Markdown を Ghostty または Kitty 上の Pi に一字一句そのまま描画させ、履歴全体を PNG に撮る。この**コーパスモード**は、表示の異常と検証作業の失敗を区別する。

## 実行

Linux、cage、wlr-randr、選択する端末、grim、Node.js、Pi が必要になる。引数を省略すると、明るいテーマ、Ghostty、画像経路、現在の checkout の `src/extension.ts` を使う。

```sh
npm run verify:display -- docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --theme dark --terminal kitty docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --extension /tmp/package/src/extension.ts docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --reflow 100 docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --path text docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --artifacts /tmp/pi-formula-captures docs/agents/verify-corpus/issue-21.md
```

`--theme` は `light` または `dark`、`--terminal` は `ghostty` または `kitty`、`--path` は `image` または `text` を受け付ける。`--reflow <cols>` は最初の撮影後に出力幅を変更し、描き直し後も撮影する。

## 実行結果

標準出力は machine-readable な JSON 1件だけである。

| kind | code | 意味 |
| --- | ---: | --- |
| `captured` | 0 | 撮影が完了し、目視確認用 artifact がある |
| `rejected` | 1 | 入力または表示計画を描画前に拒否した |
| `failed` | 2 | 準備、起動、応答確認、撮影、後片付けのいずれかが失敗した |

`failed.stage` は `prepare`、`launch`、`verify-response`、`capture`、`cleanup` のいずれかである。個別 command の情報は診断へ入り、stage にはしない。先行する失敗と後片付け失敗が重なった場合、先行する stage を保ち、`cleanupDiagnostics` を追加する。

## Artifact

既定では次の下に実行ごとの directory を作る。

```text
${XDG_STATE_HOME:-$HOME/.local/state}/pi-formula/verify-display/
```

`--artifacts` で親 directory を変更できる。各実行は `result.json` を残し、進行した stage に応じて `plan.json`、`protocol.json`、`session.jsonl`、端末設定、診断記録、`initial.png` を加える。`--reflow` を使って撮影まで進むと `reflow.png` も残す。既存の実行結果は上書きしない。

## 判定の役割

自動検査は次の事実だけを扱う。

- Pi の最後の完了した assistant 応答がコーパスと一致する
- 要求した画像経路またはテキスト経路が選ばれた
- キャプチャが PNG である
- キャプチャ寸法が表示計画と一致する
- 連続するキャプチャが一致して描画が安定した
- 画像プロトコルの状態が別の検査入口を通る

ピクセルから表示の正しさを判定しない。表示数式の組版品質、色、字形、配置の最終判断は、`captured` が返した画像を人が見て行う。

## プロトコルの検証

画像経路の転送、仮想配置、placeholder セルは libghostty-vt を使って決定的に検査する。実表示検証は撮影前に次の三つを実行し、成功した検査を `protocol.json` と `captured.protocolChecks` に記録する。

```sh
npm run verify:encoder-protocol
npm run verify:pi-protocol
npm run verify:streaming-protocol
```

詳しい検査項目は[libghostty-vt のプロトコル検査](libghostty-vt.md)を参照する。

## 隔離と安全性

利用者の `WAYLAND_DISPLAY` と `DISPLAY` を使わず、`WLR_BACKENDS=headless` の cage を専用 process group で起動する。利用者の拡張、theme、設定、tool は読み込まず、現在の pi-formula、検証用の追加マクロ、経路確認だけを読み込む。

`SIGINT`、`SIGTERM`、`SIGHUP`、例外、timeout のすべてで専用 process group を停止する。取得済み artifact は後片付けの対象にしない。production の実表示検証は Linux headless Wayland だけを対象とし、それ以外の環境は `prepare` stage で失敗する。

## 表示計画

表示計画は通常幅とリフロー幅について、Markdown の折り返し、表示数式の画像行、Pi の画面部分を含む必要高を求める。16000px に収まらないコーパスは描画前に `rejected` とする。表示計画の詳細は現在も `scripts/verify-display-plan.js` が担う。
