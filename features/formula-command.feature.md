# Feature: 端末に合わせて表示経路を選ぶ

Formula for Piは、端末が画像表示に対応しているかどうかと、ユーザーの設定に応じて、数式を画像またはテキストで表示します。通常は自動判定を使い、必要に応じて手動で切り替えたり、既定の設定を保存したりできます。

数式表示に問題があるときは、診断機能で判定結果を確認できます。

Piの非対話モードでは、端末の画像表示機能を問い合わせず、応答待ちを避けます。

このFeatureでは、数式表示方法の自動選択、手動切替、設定の保存、診断について、期待する振る舞いを定義します。

## Scenario Outline: 端末のPNG画像表示への対応に応じて経路を選ぶ

- Given 端末 `<terminal>` でPiを使っている
- When セッションを開始する
- Then `<path>`経路が選ばれる

### Examples:

  | terminal | path |
  | -------- | ---- |
  | Ghostty | 画像 |
  | Kitty | 画像 |
  | Alacritty | テキスト |

## Scenario: tmux の中では画像に対応した端末でもテキスト経路を選ぶ

- Given 端末でPiを使っている
- And 端末はPNG画像を表示できると返答する
- And 端末の種類は "xterm-kitty"
- And tmuxの中でPiを使っている
- When セッションを開始する
- Then テキスト経路が選ばれる

## Scenario: screen の端末種別では画像に対応した端末でもテキスト経路を選ぶ

- Given 端末でPiを使っている
- And 端末はPNG画像を表示できると返答する
- And 端末の種類は "screen-256color"
- When セッションを開始する
- Then テキスト経路が選ばれる

## Scenario: PNG画像表示を拒否した端末ではテキスト経路を選ぶ

- Given 端末でPiを使っている
- And 端末の種類は "xterm-kitty"
- And 端末はPNG画像表示の問い合わせにエラーを返す
- When セッションを開始する
- Then テキスト経路が選ばれる

## Scenario: PNG画像表示へ応答しない端末ではテキスト経路を選ぶ

- Given 端末でPiを使っている
- And 端末の種類は "xterm-kitty"
- And 端末はPNG画像表示の問い合わせに応答しない
- When セッションを開始する
- Then テキスト経路が選ばれる

## Scenario: 非対話モードではテキスト経路を選ぶ

- Given Piを非対話モード（RPC）で使っている
- And 端末の種類は "xterm-kitty"
- When セッションを開始する
- Then テキスト経路が選ばれる

## Scenario: image 指定で画像経路へ切り替える

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路は設定されていない
- When セッションを開始する
- And formula imageを実行する
- Then 画像経路が選ばれる

## Scenario: text 指定で画像経路からテキスト経路へ切り替える

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路は設定されていない
- When セッションを開始する
- And formula imageを実行する
- And formula textを実行する
- Then テキスト経路が選ばれる

## Scenario: auto 指定でテキスト経路から端末の自動判定へ戻す

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路は設定されていない
- When セッションを開始する
- And formula imageを実行する
- And formula textを実行する
- And formula autoを実行する
- Then 画像経路が選ばれる

## Scenario: 手動指定を現在のセッションへ順に記録する

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路は設定されていない
- When セッションを開始する
- And formula imageを実行する
- And formula textを実行する
- And formula autoを実行する
- Then 表示経路の指定が次の順に記録される

  | 指定 |
  | ---- |
  | image |
  | text |
  | auto |

## Scenario: セッションの auto 指定で全体既定を上書きする

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路はテキスト経路である
- When セッションを開始する
- And formula autoを実行する
- Then 画像経路が選ばれる

## Scenario: auto 指定ではセッション開始時のPNG画像表示確認を選択理由にする

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路はテキスト経路である
- When セッションを開始する
- And formula autoを実行する
- Then 選択理由はPNG画像表示の問い合わせの成功になる

## Scenario: default のない指定は全体設定を作らない

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の設定ファイルは存在しない
- When セッションを開始する
- And formula textを実行する
- Then 全体の設定ファイルは作られない

## Scenario: default 指定で全体の既定を保存する

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の設定ファイルは存在しない
- When セッションを開始する
- And formula textを実行する
- And formula image --defaultを実行する
- Then 全体の既定の表示経路は画像経路として保存される

## Scenario: auto default 指定で表示経路だけの全体設定を削除する

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の設定ファイルは存在しない
- When セッションを開始する
- And formula textを実行する
- And formula image --defaultを実行する
- And formula auto --defaultを実行する
- Then 表示経路だけを持つ全体の設定ファイルは削除される

## Scenario: 表示数式の画像を一時保存する

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路は設定されていない
- When セッションを開始する
- And 数式 "$$x$$" を画像へ変換する
- Then 画像の一時保存に1件以上が含まれる

## Scenario: formula clear で画像の一時保存を削除する

- Given PNG画像を表示できる端末でPiを使っている
- And 全体の既定の表示経路は設定されていない
- When セッションを開始する
- And 数式 "$$x$$" を画像へ変換する
- And formula clearを実行する
- Then 画像の一時保存が空になる

## Scenario: 診断項目を決まった順序で表示する

- Given 端末 `Kitty` でPiを使っている
- And 利用者マクロを1個設定している
- And マクロの内容に秘密の文字列が含まれる
- When セッションを開始する
- And formula statusを実行する
- Then 診断には次の項目だけがこの順に含まれる

  | 項目 |
  | ---- |
  | 版 |
  | 経路 |
  | 理由 |
  | 端末 |
  | セリフ体 |
  | マクロ数 |
  | 数式色 |
  | 一時保存 |
  | 直近の失敗 |

## Scenario: 診断情報を英語の印字可能な文字で表示する

- Given 端末 `Kitty` でPiを使っている
- And 利用者マクロを1個設定している
- And マクロの内容に秘密の文字列が含まれる
- When セッションを開始する
- And formula statusを実行する
- Then 診断情報はすべて印字可能なASCII文字である

## Scenario: 診断には利用者マクロの個数を表示する

- Given 端末 `Kitty` でPiを使っている
- And 利用者マクロを1個設定している
- And マクロの内容に秘密の文字列が含まれる
- When セッションを開始する
- And formula statusを実行する
- Then 診断に表示される利用者マクロの数は1である

## Scenario: 診断には秘密のマクロ内容を含めない

- Given 端末 `Kitty` でPiを使っている
- And 利用者マクロを1個設定している
- And マクロの内容に秘密の文字列が含まれる
- When セッションを開始する
- And formula statusを実行する
- Then 診断情報に秘密のマクロ内容は含まれない

## Scenario: 非対話モードでは端末へ問い合わせを出さない

- Given Piを非対話モード（RPC）で使っている
- And 端末はPNG画像を表示できると返答する
- When セッションを開始する
- Then 端末の画像表示機能を問い合わせない
