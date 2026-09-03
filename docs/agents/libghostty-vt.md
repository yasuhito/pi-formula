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

## pin の更新

pin の更新は独立した PR にする。更新前後で次を確認する。

1. `include/ghostty/vt/` の `terminal.h`、`render.h`、`style.h`、`kitty_graphics.h` の差分を読む。
2. Tier A と Tier B の検査が通ることを確認する。
3. ビルド時間と成果物サイズが極端に変わっていないことを確認する。
