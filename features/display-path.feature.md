# Feature: 端末に合わせて表示経路を選ぶ

Formula for Piは、端末が画像表示に対応しているかどうかと、ユーザーの設定に応じて、数式を画像またはテキストで表示します。通常は自動判定を使い、必要に応じて手動で切り替えられます。

Piの非対話モードでは、端末の画像表示機能を問い合わせず、応答待ちを避けます。

このFeatureでは、数式表示方法の自動選択と手動切替について、期待する振る舞いを定義します。公開 API から現在の経路も確認できます。

## Scenario: 現在の画像経路を問い合わせる

- Given 画像経路を使う試験用の連携拡張がある
- When 現在の表示経路を公開 API で問い合わせる
- Then 現在の表示経路は画像経路である

## Scenario: 現在のテキスト経路を問い合わせる

- Given テキスト経路を使う試験用の連携拡張がある
- When 現在の表示経路を公開 API で問い合わせる
- Then 現在の表示経路はテキスト経路である

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

## Scenario: 非対話モードでは端末へ問い合わせを出さない

- Given Piを非対話モード（RPC）で使っている
- And 端末はPNG画像を表示できると返答する
- When セッションを開始する
- Then 端末の画像表示機能を問い合わせない
