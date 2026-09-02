# Feature: 端末に合わせて表示経路を選ぶ

Formula for Pi の利用者として
端末の能力と自分の指定に合う表示経路を使いたい
画面のない処理を壊さず表示問題を調べたい

## Scenario Outline: PNG 応答のある端末で画像経路を選ぶ

- Given `<terminal>` が PNG 問い合わせへ応答する Pi がある
- When セッションを開始する
- Then 画像経路が選ばれる

### Examples:

  | terminal |
  | -------- |
  | Ghostty  |
  | Kitty    |

## Scenario: 画像を使えない環境でテキスト経路を選ぶ

- Given 画像を使えない端末環境がある
- When 各環境でセッションを開始する
- Then すべての環境でテキスト経路が選ばれる

## Scenario: formula コマンドで表示経路を手動指定して自動判定へ戻す

- Given 画像経路で数式を描ける Pi がある
- When formula コマンドの image と text と auto を順に実行する
- Then 経路が切り替わり、すべての指定が現在のセッションへ保存される

## Scenario: セッションの auto 指定で全体既定から自動判定へ戻す

- Given テキスト経路の全体既定と画像対応端末がある
- When セッションで formula auto を実行する
- Then PNG 問い合わせによる画像経路へ戻る

## Scenario: default 指定だけを XDG 設定へ保存する

- Given 一時的な XDG 設定を使う Pi がある
- When default なしとありの表示経路指定を実行してから auto default を実行する
- Then default 指定だけが XDG 設定を変更する

## Scenario: formula clear で画像の一時保存を削除する

- Given 画像の一時保存がある Pi がある
- When formula clear を実行する
- Then 画像の一時保存が空になる

## Scenario: formula status で安全な診断情報を英語表示する

- Given 秘密のマクロ設定がある Kitty の Pi がある
- When formula status を実行する
- Then 版、経路、理由、端末、セリフ体、マクロ数、一時保存、直近の失敗だけを英語表示する

## Scenario: 画面のない Pi では端末問い合わせを行わない

- Given 画面のない Pi がある
- When セッションを開始する
- Then 待機せず制御文字も端末へ出さない
