---
summary: libghostty-vt を固定した版からビルドし、プロトコル状態を検査する
read_when:
  - libghostty-vt の pin や vt-pty を更新する時
  - 画像経路のプロトコル検査を追加する時
---

# libghostty-vt のプロトコル検査

`vt-pty` は pty で子プロセスを起動し、その出力を libghostty-vt へ渡す。描画が落ち着くと、Kitty 画像の placement と端末セルの状態を標準出力へ出す。`WRITE_PTY` の応答は pty へ書き戻す。PNG decoder は IHDR の寸法だけを読み、ゼロ埋め RGBA を返す。

## ビルド

Zig 0.16.0 と C compiler が必要になる。

```sh
scripts/build-vt-pty
```

既定の成果物は `$XDG_CACHE_HOME/pi-formula/libghostty-vt/<commit>/prefix`、`XDG_CACHE_HOME` がなければ `~/.cache` 以下へ置く。別の場所を使う場合は次のように指定する。

```sh
scripts/build-vt-pty --prefix "$HOME/.local/state/pi-formula-native"
```

ビルドは `native/libghostty-vt.commit` の一行だけを版の入力にする。Ghostty をその commit へ切り替え、次のコマンドで指定 prefix へ入れる。

```sh
zig build -Demit-lib-vt -Doptimize=ReleaseFast --prefix <dir>
```

`vt-pty` のコンパイルでは `<dir>/include` と `<dir>/lib` を明示する。システムの libghostty-vt や `pkg-config` は使わない。ビルド計画だけを確認する場合は `--print-plan` を付ける。この場合は clone、ビルド、ファイル作成を行わない。

CI は高価な libghostty-vt のヘッダとライブラリだけを pin ごとに cache する。`native/vt-pty.c` と `native/diacritics.h` から作る実行ファイルは cache に含めず、現在の checkout から毎回コンパイルする。

## 実行と skip

```sh
scripts/run-vt-pty.js -- <command> [args...]
```

入口は `PI_FORMULA_VT_TOOL`、既定の cache 内にある `vt-pty` の順で探す。どちらにも実行可能なファイルがなければ、プロトコル検査を成功として skip し、その旨を標準出力へ出す。通常の `npm run check` は native 成果物を必要としない。

子プロセスの出力が落ち着いた場合だけプロトコル状態を出す。timeout、起動失敗、PTY の入出力失敗、必須 libghostty-vt API の失敗は終了コード2にする。

native 専用の Cucumber シナリオも同じ順序で探す。専用 CI job は `PI_FORMULA_VT_TOOL` を設定してこのシナリオを実行する。

## エンコーダ層のプロトコル検査

```sh
npm run verify:encoder-protocol
```

この入口は最初に現在の checkout をビルドする。その後、`test/support/fake-pi.js` で画像経路を選び、Markdown transformer が出したバイト列を `vt-pty` へ直接流す。Pi とモデルは起動しない。利用者の設定と端末環境に左右されないよう、検査中は `XDG_CONFIG_HOME` を一時ディレクトリへ向け、`PI_FORMULA_MACROS` を空にし、`TMUX` を外して `TERM` を画像経路用の値へ固定する。storage の画像、仮想配置、placeholder セルの画像 ID・座標・下線色タグを検査する。同じ Markdown を二度変換し、二度目の出力も新しい端末の storage に画像を作ることも確かめる。

PNG の転送形式 `f=100` と IHDR の寸法を転送計画として読み、libghostty-vt の storage と照合する。libghostty-vt は PNG decoder を通した画像を RGBA として保存するため、storage 側では RGBA へ正規化された形式を期待する。`vt-pty` は各 U+10EEEE セルについて foreground RGB から復元した画像 ID と、diacritics から復元した行・列を出力する。

`--check` へ `storage`、`placement`、`image-id`、`coordinates`、`underline`、`cached` のいずれかを渡すと、その項目だけを検査できる。`missing-transfer` は画像転送を除いた退行確認用で、「placeholder が指す id に仮想配置がない」として失敗する。`vt-pty` がなければ成功として skip する。実装契約のシナリオは `npm run test:native-vt` で実行する。

## Pi を通したプロトコル検査

```sh
npm run verify:pi-protocol
```

この検査は `docs/agents/verify-corpus/issue-52.md` から一時セッションを作り、`pi --session` で開く。Pi は `--offline` で起動し、保存済み assistant message を描くだけなのでモデルを呼ばない。拡張の自動探索、tool、skill、prompt template、context file、theme を無効にする。設定は一時 `XDG_CONFIG_HOME` へ隔離し、`PI_FORMULA_MACROS='{}'` で利用者マクロを空にする。

全表示数式の仮想配置を受け取った後、pty の出力が1.5秒止まった時点の状態を検査する。初回組版の途中に無出力時間があっても確定しない。全体の期限は15秒とし、期限内に配置が揃わなければ、必要数と観測数を含む `vt-pty: timeout 15000ms waiting for ... placements` を出して終了コード2で失敗する。

次のどれかに該当すると終了コード1で失敗する。

- placeholder セルに `faint`、背景色、`inverse` のいずれかがある
- 本文セルに APC の ESC または ST が残る
- 表示数式の数と、storage に image がある仮想配置の数が一致しない

`vt-pty` がなければ通常のプロトコル検査と同様に成功として skip する。実装契約の回帰シナリオは `npm run test:native-vt` で実行する。

## pin の更新

pin の更新は独立した PR にする。更新前後で次を確認する。

1. `include/ghostty/vt/` の `terminal.h`、`render.h`、`style.h`、`kitty_graphics.h` の差分を読む。
2. Tier A と Tier B の検査が通ることを確認する。
3. ビルド時間と成果物サイズが極端に変わっていないことを確認する。
