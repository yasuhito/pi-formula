# Feature: 公開 API で表示数式の PNG を作る

連携拡張は公開 API を使い、利用者マクロと追加マクロを含む表示数式から PNG を作れます。テーマと字形の違いに応じた画像を、同期的に返します。

PNG の返り値は画像データと寸法です。返された Buffer を変更しても、同じ数式から作る次の画像や Markdown の画像は破損しません。

不正な入力やテキスト経路では、例外を出さずに PNG を返しません。

## Scenario: XDG 設定と環境変数から利用者マクロを読む

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | configured | x | なし |

- And 環境変数の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | temporary | y | なし |

- And 画像経路の公開APIを使っている
- When 両方の利用者マクロを使う PNG を公開 API で作る
- Then XDG 設定と環境変数の利用者マクロが一緒に使える

## Scenario: 環境変数の利用者マクロを優先する

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | chosen | y | なし |

- And 環境変数の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | chosen | x | なし |

- And 画像経路の公開APIを使っている
- When 同名の利用者マクロを使う PNG を公開 API で作る
- And 比較用の数式 "x" のPNGを公開APIで作る
- Then 環境変数の利用者マクロで PNG が作られる

## Scenario: 空文字列の利用者マクロを使う

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | empty |  | なし |

- And 画像経路の公開APIを使っている
- When 空文字列の利用者マクロを使う PNG を公開 API で作る
- And 比較用の数式 "x" のPNGを公開APIで作る
- Then 空文字列の利用者マクロが使える

## Scenario: 空文字列の追加マクロを使う

- Given 空文字列の追加マクロがある
- When 空文字列の追加マクロを使う PNG を公開 API で作る
- And 比較用の数式 "x" のPNGを公開APIで作る
- Then 空文字列の追加マクロが使える

## Scenario: エスケープしたハッシュ記号を利用者マクロで使う

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | hash | \\# | なし |

- And 画像経路の公開APIを使っている
- When その利用者マクロを使う PNG を公開 API で作る
- Then ハッシュ記号の PNG が作られる

## Scenario: 正しい利用者マクロでPNGが作られる

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | usable | x | なし |
  | broken | #2 | 1 |

- And 画像経路の公開APIを使っている
- When 正しい利用者マクロからPNGを作る
- And 壊れた利用者マクロからPNGを作る
- Then 正しい利用者マクロでPNGが作られる

## Scenario: 壊れた利用者マクロではPNGを返さない

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | usable | x | なし |
  | broken | #2 | 1 |

- And 画像経路の公開APIを使っている
- When 正しい利用者マクロからPNGを作る
- And 壊れた利用者マクロからPNGを作る
- Then 壊れた利用者マクロではPNGを返さない

## Scenario: 壊れた環境変数の定義では XDG 定義を上書きしない

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | chosen | x | なし |

- And 環境変数の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | chosen | #2 | 1 |

- And 画像経路の公開APIを使っている
- When 同名の利用者マクロを使う PNG を公開 API で作る
- And 比較用の数式 "x" のPNGを公開APIで作る
- Then 正しい XDG 定義で PNG が作られる

## Scenario: JSON 全体が壊れた設定元だけを無効にする

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | configured | x | なし |

- And 環境変数のマクロ設定は壊れたJSONである
- And 画像経路の公開APIを使っている
- When XDG 設定の利用者マクロを使う PNG を公開 API で作る
- Then 壊れた環境変数に関係なく XDG 設定の利用者マクロが使える

## Scenario: 追加マクロを利用者設定から保護する

- Given XDG設定の利用者マクロは次のとおりである

  | 名前 | 置換 | 引数 |
  | ---- | ---- | ---- |
  | trial | wrong | なし |

- And 画像経路を使う試験用の連携拡張がある
- When 連携拡張の追加マクロを使う PNG を公開 API で作る
- And 比較用の数式のPNGを公開APIで作る

  ```text
  \left|x\right\rangle
  ```
- Then 利用者設定では追加マクロを上書きできない

## Scenario: Object prototype と同名の追加マクロを登録する

- Given Object prototype と同名の追加マクロがある
- When その追加マクロを使う PNG を公開 API で作る
- And 比較用の数式 "x" のPNGを公開APIで作る
- Then Object prototype と同名の追加マクロが使える

## Scenario: 既存の公開 API と画像描画 API を公開する

- Given pi-formula の CommonJS 公開 API がある
- When 公開された名前を調べる
- Then 既存の公開 API と画像経路向け API が公開される

## Scenario Outline: 公開 API の不正な LaTeX 入力を安全に拒否する

- Given 画像経路を使う試験用の連携拡張がある
- When 公開APIへ <入力> のLaTeX入力を渡す
- Then 公開 API は例外を出さず画像を返さない

### Examples:

  | 入力 |
  | --- |
  | null |
  | object |

## Scenario: 公開PNGの返り値には画像データと寸法だけが含まれる

- Given 画像経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then 公開PNGの返り値には画像データと寸法だけが含まれる

## Scenario: 公開PNGのデータはPNG形式である

- Given 画像経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then 公開PNGのデータはPNG形式である

## Scenario: 公開PNGの幅は正数である

- Given 画像経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then 公開PNGの幅は正数である

## Scenario: 公開PNGの高さは正数である

- Given 画像経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then 公開PNGの高さは正数である

## Scenario: 変更されたBufferから次の公開PNGへ破損が伝わらない

- Given 画像経路を使う試験用の連携拡張がある
- When 変更前の公開PNGを作る
- And 返された公開PNGのBufferを書き換える
- And 同じ数式の公開PNGをもう一度作る
- And 同じ数式をMarkdownの表示数式として描く
- Then 変更されたBufferから次の公開PNGへ破損が伝わらない

## Scenario: 変更されたBufferからMarkdownの画像へ破損が伝わらない

- Given 画像経路を使う試験用の連携拡張がある
- When 変更前の公開PNGを作る
- And 返された公開PNGのBufferを書き換える
- And 同じ数式の公開PNGをもう一度作る
- And 同じ数式をMarkdownの表示数式として描く
- Then 変更されたBufferからMarkdownの画像へ破損が伝わらない

## Scenario: テーマ変更後は現在の文字色で PNG を作る

- Given 画像経路を使う試験用の連携拡張がある
- When テーマ変更前の公開PNGを作る
- And テーマの文字色をRGBの1・2・3へ変える
- And テーマ変更後の同じ数式の公開PNGを作る
- Then 変更後の文字色で新しい PNG が作られる

## Scenario Outline: 動的字形を含む表示数式を画像にする

- Given 画像経路を使う試験用の連携拡張がある
- When "<latex>" を含む表示数式の PNG を公開 API で作る
- Then 動的字形を含む表示数式の PNG が返る

### Examples:

  | latex            |
  | ---------------- |
  | `\\mathcal{H}`  |
  | `\\mathscr{F}`  |
  | `\\mathbb{R}`   |
  | `\\mathfrak{g}` |
  | `\\mathsf{T}`   |
  | `\\mathtt{x}`   |

## Scenario Outline: 既存の字形を含む表示数式を引き続き画像にする

- Given 画像経路を使う試験用の連携拡張がある
- When "<latex>" を含む表示数式の PNG を公開 API で作る
- Then 既存の字形を含む表示数式の PNG が返る

### Examples:

  | latex                 |
  | --------------------- |
  | `\\mathbf{v}`        |
  | `\\mathrm{d}x`       |
  | `a^2 + b^2 = c^2`    |

## Scenario: 表示数式の PNG を同期的に作る

- Given 画像経路を使う試験用の連携拡張がある
- When 動的字形を含む表示数式の PNG を公開 API で作る
- Then 公開 API は同期的に PNG を返す

## Scenario: テキスト経路では PNG を返さない

- Given テキスト経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then 公開 API は画像を返さない
