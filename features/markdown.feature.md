# Feature: 通常の Markdown を壊さず数式だけを見分ける

Formula for Pi の利用者として
通常の文章やコードをそのまま読みたい
閉じた表示数式だけを画像で読みたい

## Scenario: 4 種類の数式区切りだけを扱う

- Given 画像経路で数式を描ける Pi がある
- When 4 種類の数式区切りを含む本文を変換する
- Then インライン数式は残り、2 つの表示数式だけが画像になる

## Scenario: ket 追加マクロをドル区切りのインライン数式で使う

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When ket 追加マクロを含むドル区切りのインライン数式を描く
- Then ket 追加マクロが Unicode で描かれる

## Scenario: braket 追加マクロを丸括弧区切りのインライン数式で使う

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When braket 追加マクロを含む丸括弧区切りのインライン数式を描く
- Then braket 追加マクロが Unicode で描かれる

## Scenario: braket 利用者マクロをドル区切りのインライン数式で使う

- Given braket の利用者マクロを設定した画像経路の Pi がある
- When braket 利用者マクロを含むドル区切りのインライン数式を描く
- Then braket 利用者マクロが Unicode で描かれる

## Scenario: Object prototype 名を未登録マクロとして扱う

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When Object prototype 名と ket 追加マクロを含む本文を変換する
- Then Object prototype 名は残り ket 追加マクロだけが展開される

## Scenario: 金額とシェル変数の後にあるインライン数式を描く

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When 金額とシェル変数の後に ket 追加マクロがある本文を描く
- Then 金額とシェル変数は残り後続の ket 追加マクロが Unicode で描かれる

## Scenario: 相対 Markdown URL のマクロ風文字列を変換しない

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When 相対 Markdown URL に ket 追加マクロ風文字列がある本文を変換する
- Then 相対 Markdown URL は変更されない

## Scenario: スキームなし URL のマクロ風文字列を変換しない

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When スキームなし URL に ket 追加マクロ風文字列がある本文を変換する
- Then スキームなし URL は変更されない

## Scenario: 追加マクロがなければインライン数式を変えない

- Given 画像経路で数式を描ける Pi がある
- When 未登録の ket を含むインライン数式を変換する
- Then 未登録の ket は原文のまま残る

## Scenario: 展開後に描けないインライン数式を変えない

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When 展開後も描けない命令を含むインライン数式を変換する
- Then 描けないインライン数式は原文のまま残る

## Scenario: 追加マクロがあっても保護対象を変えない

- Given 画像経路で数式を描ける Pi がある
- Given ket と braket の追加マクロを登録する
- When コードと金額と URL とシェル変数に追加マクロがある本文を変換する
- Then 追加マクロがある保護対象は変更されない

## Scenario: コード内の数式を変換しない

- Given 画像経路で数式を描ける Pi がある
- When コードフェンスと文中コードに数式がある本文を変換する
- Then コード内の本文は変更されない

## Scenario: 長い区切りと字下げと末尾空白でコードフェンスを閉じる

- Given 画像経路で数式を描ける Pi がある
- When 長い区切りと字下げと末尾空白を持つコードフェンスを変換する
- Then 2 種類のコードフェンスが閉じて後続の表示数式だけが画像になる

## Scenario: 正規表現メタ文字をコードフェンス終端と誤認しない

- Given 画像経路で数式を描ける Pi がある
- When 正規表現メタ文字を含む行があるコードフェンスを変換する
- Then 正規表現メタ文字を含む行の後もコード内の表示数式は残る

## Scenario: thinking を変換しない

- Given 画像経路で数式を描ける Pi がある
- When thinking の本文を変換する
- Then thinking の本文は変更されない

## Scenario: 通常のドル記号を数式と誤認しない

- Given 画像経路で数式を描ける Pi がある
- When 金額と URL とシェル変数とエスケープ済みドル記号を含む本文を変換する
- Then 通常のドル記号を含む本文は変更されない

## Scenario: 曖昧なドル記号では原文を優先する

- Given 画像経路で数式を描ける Pi がある
- When 曖昧なドル記号を含む本文を変換する
- Then 曖昧なドル記号を含む本文は変更されない

## Scenario: 箇条書き内の表示数式を保つ

- Given 画像経路で数式を描ける Pi がある
- When 箇条書き内の表示数式を変換する
- Then 画像は箇条書きの字下げに残る

## Scenario: 引用内の表示数式を保つ

- Given 画像経路で数式を描ける Pi がある
- When 引用内の表示数式を変換する
- Then 画像は引用の階層に残る

## Scenario: ストリーミング中の閉じた数式を文字で保つ

- Given 画像経路で数式を描ける Pi がある
- When 閉じた数式まで届いたストリーミング本文を変換する
- Then 閉じた表示数式は原文のまま残る

## Scenario: ストリーミング中の未完成な数式を変換しない

- Given 画像経路で数式を描ける Pi がある
- When 未完成な数式まで届いたストリーミング本文を変換する
- Then 未完成な数式は原文のまま残る

## Scenario: 不正な LaTeX が後続の本文を壊さない

- Given 画像経路で数式を描ける Pi がある
- When 不正な表示数式と正しい表示数式を含む本文を変換する
- Then 不正な数式は残り、正しい数式だけが画像になる
