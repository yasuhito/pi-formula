# Formula for Pi

[English](README.md)

Pi の LaTeX を読みやすく表示します。インライン数式は選択できる Unicode 文字、表示数式は MathJax 画像になります。

## 導入

Pi 0.84 以降と Node.js 22.19 以降が必要です。

```sh
pi install npm:pi-formula
```

Pi は拡張を自動で読み込みます。インライン数式には `$...$` または `\(...\)`、表示数式には `$$...$$` または `\[...\]` を使います。

## 表示見本

次の Ghostty 画像では、本文中のインライン数式を Unicode 文字で、表示数式を MathJax 画像で同時に表示しています。

![Unicode のインライン数式と MathJax 画像の表示数式を表示する Ghostty](assets/ghostty-formulas.png)

## 動作

- **インライン数式**（`$...$` と `\(...\)`）は Pi 標準の Unicode テキスト経路を使います。選択、検索、折り返しができます。
- **表示数式**（`$$...$$` と `\[...\]`）は、画像経路で透明な MathJax PNG になります。
- 画像を使えない場合は、表示数式もテキスト経路を使います。
- 画面上の Markdown だけを変えます。保存した会話とモデルへ渡す文脈には元の LaTeX が残ります。

コードフェンス、文中コード、thinking、エスケープしたドル記号、金額、URL、シェル変数、曖昧なドル記号、未完成の数式は変えません。ストリーミング中でも、閉じた表示数式は表示できます。箇条書きと引用の階層も保ちます。

一つの表示数式が不正、安全上限を超過、正確なテーマ色を取得できない、または半分未満へ縮小する場合、その数式だけを LaTeX のまま残します。後続の数式は引き続き処理します。

## `/formula` コマンド

| コマンド | 動作 |
| --- | --- |
| `/formula status` | 版、現在の経路、選択理由、端末、マクロ数、メモリ内の一時保存、直近の失敗を表示します。 |
| `/formula image` | 現在の Pi セッションで画像経路を選びます。 |
| `/formula text` | 現在の Pi セッションでテキスト経路を選びます。 |
| `/formula auto` | 現在の Pi セッションを自動判定へ戻します。 |
| `/formula clear` | メモリ内の画像と失敗結果を削除します。 |

`image`、`text`、`auto` に `--default` を付けると、全体の既定値を変えます。たとえば `/formula text --default` はテキスト経路を保存します。`/formula auto --default` は保存済みの経路を削除します。`--default` がなければ現在のセッションだけに適用します。

## 設定

設定ファイルは `$XDG_CONFIG_HOME/pi-formula/config.json` です。`XDG_CONFIG_HOME` がなければ `~/.config/pi-formula/config.json` を使います。

```json
{
  "macros": {
    "RR": "\\mathbb{R}",
    "pair": ["\\left(#1,#2\\right)", 2]
  }
}
```

`path` は `image`、`text`、または自動判定を表す省略のいずれかです。`/formula` は明示した既定値だけを書きます。`auto` は `path` の省略として保存します。

`PI_FORMULA_MACROS` には `macros` オブジェクト自体を JSON で指定できます。正しい環境変数の定義は設定ファイルの同名定義を上書きします。

```sh
export PI_FORMULA_MACROS='{"RR":"\\mathbb{R}"}'
```

壊れた JSON の設定元は無視します。個別の壊れたマクロは、他の定義を無効にせず無視します。マクロ名には ASCII の英字を使います。定義は置換文字列、または `[置換文字列, 引数の数]` です。引数の数は 0 から 9 の整数です。ハッシュ記号自体には `\\#` を使います。

## 対応端末と対応 OS

| 環境 | 動作 |
| --- | --- |
| Linux または macOS の Ghostty | PNG 問い合わせが成功すると画像経路 |
| Linux または macOS の Kitty | PNG 問い合わせが成功すると画像経路 |
| その他の端末 | テキスト経路 |
| tmux または screen | 問い合わせをせずテキスト経路 |
| Pi の非対話モード | 制御文字を出さずテキスト経路 |

画像経路の対応範囲は、Linux または macOS で Ghostty か Kitty を直接使う場合です。PNG 問い合わせが拒否されるか応答がない場合は、安全にテキスト経路を選びます。0.1.0 では Windows と他の端末画像プロトコルは未対応・未検証です。

## 未対応範囲と他の数式拡張との併用

次の機能には対応しません。

- インライン数式の画像化
- `$...$`、`\(...\)`、`$$...$$`、`\[...\]` 以外の LaTeX 区切り
- 端末マルチプレクサを通した画像表示の保証
- 分野固有マクロの標準搭載
- 0.1.0 での ES Modules 入口

同じ Markdown を変換する他の数式拡張と同時に有効にしないでください。変換が重なり、表示が重複または破損する場合があります。`qni-cli` は例外です。`qni-cli` は pi-formula の公開 API で追加マクロを渡し、登録を共有します。両方を導入しても、数式描画と `/formula` コマンドは一つずつです。

## 画像処理の安全性

MathJax と Resvg は、最初の表示数式が画像経路へ入るまで読み込みません。SVG と PNG は上限のあるメモリ内一時保存だけに置き、ディスクへ書きません。ネットワーク、ブラウザ、子プロセスも使いません。

固定上限は LaTeX 16,384 文字、画像 255 列、255 行、一時保存 64 件、合計 32 MiB です。失敗結果も一時保存するため、同じ不正入力を繰り返し組版しません。

## 拡張向け公開 API

CommonJS パッケージは、同期的な `registerFormula` と `createFormulaPng` だけを公開します。他の Pi 拡張は、保護された追加マクロを登録し、同じ経路で表示数式の PNG を作れます。

```js
const { createFormulaPng, registerFormula } = require("pi-formula");

registerFormula(pi, {
  ket: ["\\left|#1\\right\\rangle", 1]
});

const image = createFormulaPng("\\ket{0}", availableWidth);
```

追加マクロ名には ASCII の英字を使い、先頭のバックスラッシュは省略できます。不正な追加マクロでは `registerFormula` が `TypeError` を出します。追加マクロは利用者マクロより優先し、単体版と同梱版をどちらの順で登録しても保護されます。再読み込みやセッション切り替えでは拡張を結び直し、利用者マクロを読み直します。

テキスト経路では `image` は `undefined` です。画像経路では PNG の `data`、ピクセル寸法、端末の列数と行数を返します。Pi の画面部品は返しません。呼び出しごとに独立した PNG バッファを返します。

## 監査と変更履歴

- [CHANGELOG.md](CHANGELOG.md): 利用者に見える変更
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): コードの由来、直接依存の版、更新状況、ライセンス、日付付き脆弱性確認
- [LICENSE](LICENSE): MIT License

npm 配布物の内容は次のコマンドで確認できます。

```sh
npm pack --dry-run
```
