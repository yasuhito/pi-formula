# Feature: 利用者マクロと追加マクロから表示数式の PNG を作る

Formula for Pi の利用者と連携拡張の作者として
設定した LaTeX 命令を同じ数式画像で使いたい
Pi の画面部品に依存せず PNG を配置したい

## Scenario: XDG 設定と環境変数から利用者マクロを読む

- Given XDG 設定と環境変数に異なる利用者マクロがある
- When 両方の利用者マクロを使う PNG を公開 API で作る
- Then XDG 設定と環境変数の利用者マクロが一緒に使える

## Scenario: 環境変数の利用者マクロを優先する

- Given XDG 設定と環境変数に同名の利用者マクロがある
- When 同名の利用者マクロを使う PNG を公開 API で作る
- Then 環境変数の利用者マクロで PNG が作られる

## Scenario: 壊れた利用者マクロだけを無効にする

- Given 正しい定義と壊れた定義を含む利用者マクロ設定がある
- When 正しい利用者マクロと壊れた利用者マクロから PNG を作る
- Then 正しい利用者マクロだけが使える

## Scenario: JSON 全体が壊れた設定元だけを無効にする

- Given 正しい XDG 設定と壊れた JSON の環境変数がある
- When XDG 設定の利用者マクロを使う PNG を公開 API で作る
- Then 壊れた環境変数に関係なく XDG 設定の利用者マクロが使える

## Scenario: 追加マクロを利用者設定から保護する

- Given 試験用の連携拡張と同名の利用者マクロがある
- When 連携拡張の追加マクロを使う PNG を公開 API で作る
- Then 利用者設定では追加マクロを上書きできない

## Scenario: 公開 API を登録と PNG 作成に絞る

- Given pi-formula の CommonJS 公開 API がある
- When 公開された名前を調べる
- Then 拡張登録と同期的な PNG 作成だけが公開される

## Scenario: PNG データと大きさだけを返す

- Given 画像経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then PNG データと大きさが画面部品なしで返る

## Scenario: テキスト経路では PNG を返さない

- Given テキスト経路を使う試験用の連携拡張がある
- When 連携拡張が公開 API で PNG を作る
- Then 公開 API は画像を返さない

## Scenario: 単体版を先に読み込んでも登録を一つにする

- Given 単体版を同梱版より先に読み込む
- When 両方の拡張登録を調べる
- Then 数式描画と formula コマンドは一つになる

## Scenario: 同梱版を先に読み込んでも登録を一つにする

- Given 同梱版を単体版より先に読み込む
- When 両方の拡張登録を調べる
- Then 数式描画と formula コマンドは一つになる
