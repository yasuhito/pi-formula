# Feature: libghostty-vt で画像経路のプロトコル状態を検査する

pi-formula の worker として
不安定な native 依存を通常の検査から分離しながら
画像経路のプロトコル状態を決定的に検査したい

## Scenario: native ツールがない環境ではプロトコル検査を skip する

- Given vt-pty がない環境がある
- When プロトコル検査の入口を実行する
- Then 成功として skip したことが出力される

## Scenario: 環境変数で指定した vt-pty を優先する

- Given 環境変数で指定した vt-pty がある
- When プロトコル検査の入口を実行する
- Then 環境変数で指定した vt-pty が実行される

`@native-vt`
## Scenario: pty の子プロセス出力からプロトコル状態を得る

- Given vt-pty で文字を出力する子プロセスを起動する
- When 子プロセスの出力が落ち着くまで待つ
- Then libghostty-vt が解析したプロトコル状態が出力される

## Scenario: pin した commit だけをビルド入力にする

- Given libghostty-vt のビルド定義がある
- When ビルド入力を調べる
- Then 一行の pin を指定 prefix のビルドへ使う

## Scenario: native 成果物をシステム領域へ入れない

- Given libghostty-vt のビルド定義がある
- When native 成果物の出力先を調べる
- Then ヘッダとライブラリを指定 prefix だけから使う

## Scenario: 専用 CI で pin ごとの native 成果物を作る

- Given CI の native 専用 job がある
- When native job のビルドとキャッシュを調べる
- Then Linux と macOS で pin ごとの vt-pty を検査する

## Scenario: pin 更新時の確認事項を残す

- Given libghostty-vt の運用文書がある
- When pin の更新手順を調べる
- Then API 差分と検査と資源量の変化を確認できる
