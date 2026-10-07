# Feature: 利用者マクロと追加マクロから表示数式の PNG を作る

Formula for Pi の利用者と連携拡張の作者として
設定した LaTeX 命令を同じ数式画像で使いたい
Pi の画面部品に依存せず PNG を配置したい

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

## Scenario: 動的字形を読み込めない表示数式は原文へ戻る

- Given 動的字形を読み込めない画像経路がある
- When 動的字形を含む表示数式を描く
- And 同じruntimeで動的字形を使わない表示数式を描く
- Then 動的字形を読み込めない表示数式は原文へ戻る

## Scenario: 動的字形を使わない表示数式は引き続き画像になる

- Given 動的字形を読み込めない画像経路がある
- When 動的字形を含む表示数式を描く
- And 同じruntimeで動的字形を使わない表示数式を描く
- Then 動的字形を使わない表示数式は引き続き画像になる

## Scenario: テキスト経路では PNG を返さない

- Given テキスト経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then 公開 API は画像を返さない

## Scenario: 現在の画像経路を問い合わせる

- Given 画像経路を使う試験用の連携拡張がある
- When 現在の表示経路を公開 API で問い合わせる
- Then 現在の表示経路は画像経路である

## Scenario: 現在のテキスト経路を問い合わせる

- Given テキスト経路を使う試験用の連携拡張がある
- When 現在の表示経路を公開 API で問い合わせる
- Then 現在の表示経路はテキスト経路である

## Scenario: 既成PNGの描画は成功する

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画は成功する

## Scenario: 既成PNGの描画成功時に拒否理由はない

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画成功時に拒否理由はない

## Scenario: 既成PNGの描画結果には画像転送が含まれる

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画結果には画像転送が含まれる

## Scenario: 既成PNGの描画結果にはplaceholderが含まれる

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画結果にはplaceholderが含まれる

## Scenario: 既成PNGの配置は8列以内に収まる

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの配置は8列以内に収まる

## Scenario: 既成PNGの配置は1行以上を使う

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの配置は1行以上を使う

## Scenario: 既成PNGの画像IDは危険域の3バイトを保持する

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの画像IDは危険域の3バイトを保持する

## Scenario: placeholderの下線色はコロン形式で表現される

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- Then placeholderの下線色はコロン形式で表現される

## Scenario: placeholder出力後に背景色は残らない

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- And placeholder出力後のSGR状態を読み取る
- Then placeholder出力後に背景色は残らない

## Scenario: placeholder出力後にdimは残らない

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- And placeholder出力後のSGR状態を読み取る
- Then placeholder出力後にdimは残らない

## Scenario: ファイルの既成PNGは描画される

- Given 画像経路を使う試験用の連携拡張がある
- When ファイルの既成 PNG を公開 API で描く
- Then ファイルの既成PNGは描画される

## Scenario: ファイルの既成PNGはPNG画像を転送する

- Given 画像経路を使う試験用の連携拡張がある
- When ファイルの既成 PNG を公開 API で描く
- Then ファイルの既成PNGはPNG画像を転送する

## Scenario: 画像を使えない端末では既成PNGを描画しない

- Given テキスト経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 画像を使えない端末では既成PNGを描画しない

## Scenario: 既成PNGを描画しない理由は画像経路を使えないことである

- Given テキスト経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGを描画しない理由は画像経路を使えないことである

## Scenario: テキスト経路での拒否では、拒否結果には描画状態と拒否理由だけがある

- Given テキスト経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある

## Scenario: 寸法の安全上限を超える PNG では、安全上限を超えた既成PNGは描画しない

- Given 画像経路を使う試験用の連携拡張がある
- When 安全上限を超える既成 PNG を公開 API で描く
- Then 安全上限を超えた既成PNGは描画しない

## Scenario: 寸法の安全上限を超える PNG では、既成PNGの拒否理由は安全上限である

- Given 画像経路を使う試験用の連携拡張がある
- When 安全上限を超える既成 PNG を公開 API で描く
- Then 既成PNGの拒否理由は安全上限である

## Scenario: 寸法の安全上限を超える PNG では、拒否結果には描画状態と拒否理由だけがある

- Given 画像経路を使う試験用の連携拡張がある
- When 安全上限を超える既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある

## Scenario: 不正な既成PNGは描画しない

- Given 画像経路を使う試験用の連携拡張がある
- When 途中で切れた既成 PNG を公開 API で描く
- Then 不正な既成PNGは描画しない

## Scenario: 既成PNGの拒否理由はPNG形式の不正である

- Given 画像経路を使う試験用の連携拡張がある
- When 途中で切れた既成 PNG を公開 API で描く
- Then 既成PNGの拒否理由はPNG形式の不正である

## Scenario: 途中で切れた PNG の拒否では、拒否結果には描画状態と拒否理由だけがある

- Given 画像経路を使う試験用の連携拡張がある
- When 途中で切れた既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある

## Scenario: 展開上限を超える PNG では、安全上限を超えた既成PNGは描画しない

- Given 画像経路を使う試験用の連携拡張がある
- When 展開上限を超える既成 PNG を公開 API で描く
- Then 安全上限を超えた既成PNGは描画しない

## Scenario: 展開上限を超える PNG では、既成PNGの拒否理由は安全上限である

- Given 画像経路を使う試験用の連携拡張がある
- When 展開上限を超える既成 PNG を公開 API で描く
- Then 既成PNGの拒否理由は安全上限である

## Scenario: 展開上限を超える PNG では、拒否結果には描画状態と拒否理由だけがある

- Given 画像経路を使う試験用の連携拡張がある
- When 展開上限を超える既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある

## Scenario: 再登録したruntimeのMarkdown描画は1個だけ登録される

- Given 利用者マクロを読む拡張 runtime がある
- When 元のruntimeのセッションを終了する
- And XDGの利用者マクロを再読込用の定義へ変更する
- And 環境変数の利用者マクロを再読込用の定義へ変更する
- And 別のruntimeを読み込んで登録する
- And 新しいruntimeで画像経路のセッションを開始する
- And 新しいruntimeの利用者マクロでPNGを作る
- Then 再登録したruntimeのMarkdown描画は1個だけ登録される

## Scenario: 再登録したruntimeのコマンドは1個だけ登録される

- Given 利用者マクロを読む拡張 runtime がある
- When 元のruntimeのセッションを終了する
- And XDGの利用者マクロを再読込用の定義へ変更する
- And 環境変数の利用者マクロを再読込用の定義へ変更する
- And 別のruntimeを読み込んで登録する
- And 新しいruntimeで画像経路のセッションを開始する
- And 新しいruntimeの利用者マクロでPNGを作る
- Then 再登録したruntimeのコマンドは1個だけ登録される

## Scenario: 再登録したruntimeでformulaコマンドを利用できる

- Given 利用者マクロを読む拡張 runtime がある
- When 元のruntimeのセッションを終了する
- And XDGの利用者マクロを再読込用の定義へ変更する
- And 環境変数の利用者マクロを再読込用の定義へ変更する
- And 別のruntimeを読み込んで登録する
- And 新しいruntimeで画像経路のセッションを開始する
- And 新しいruntimeの利用者マクロでPNGを作る
- Then 再登録したruntimeでformulaコマンドを利用できる

## Scenario: 再登録したruntimeで新しい利用者マクロを使える

- Given 利用者マクロを読む拡張 runtime がある
- When 元のruntimeのセッションを終了する
- And XDGの利用者マクロを再読込用の定義へ変更する
- And 環境変数の利用者マクロを再読込用の定義へ変更する
- And 別のruntimeを読み込んで登録する
- And 新しいruntimeで画像経路のセッションを開始する
- And 新しいruntimeの利用者マクロでPNGを作る
- Then 再登録したruntimeで新しい利用者マクロを使える

## Scenario: 単体版を先に読み込む場合、単体版と同梱版のMarkdown描画は1個だけ登録される

- Given 単体版を同梱版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版のMarkdown描画は1個だけ登録される

## Scenario: 単体版を先に読み込む場合、単体版と同梱版のコマンドは1個だけ登録される

- Given 単体版を同梱版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版のコマンドは1個だけ登録される

## Scenario: 単体版を先に読み込む場合、単体版と同梱版を読み込んでも連携拡張の追加マクロを使える

- Given 単体版を同梱版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版を読み込んでも連携拡張の追加マクロを使える

## Scenario: 単体版を先に読み込む場合、単体版と同梱版は異なるPi APIで登録されている

- Given 単体版を同梱版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版は異なるPi APIで登録されている

## Scenario: 同梱版を先に読み込む場合、単体版と同梱版のMarkdown描画は1個だけ登録される

- Given 同梱版を単体版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版のMarkdown描画は1個だけ登録される

## Scenario: 同梱版を先に読み込む場合、単体版と同梱版のコマンドは1個だけ登録される

- Given 同梱版を単体版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版のコマンドは1個だけ登録される

## Scenario: 同梱版を先に読み込む場合、単体版と同梱版を読み込んでも連携拡張の追加マクロを使える

- Given 同梱版を単体版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版を読み込んでも連携拡張の追加マクロを使える

## Scenario: 同梱版を先に読み込む場合、単体版と同梱版は異なるPi APIで登録されている

- Given 同梱版を単体版より先に読み込む順序である
- When 順序で最初の拡張を読み込む
- And 順序で次の拡張を読み込む
- And 順序で最初の拡張を登録する
- And 順序で次の拡張を登録する
- And 最初に登録したPiで画像経路のセッションを開始する
- And 両方を登録したruntimeで連携拡張のPNGを作る
- And 両方の拡張登録を調べる
- Then 単体版と同梱版は異なるPi APIで登録されている
