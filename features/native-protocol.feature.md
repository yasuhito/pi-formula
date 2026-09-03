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

## Scenario: pin と隔離した prefix のビルド計画を得る

- Given ホーム側の native prefix を指定する
- When libghostty-vt のビルド計画を出力する
- Then pin と指定 prefix だけを使うビルド計画が得られる

`@native-vt`
## Scenario: pty の子プロセス出力からプロトコル状態を得る

- Given vt-pty で文字を出力する子プロセスを起動する
- When 子プロセスの出力が落ち着くまで待つ
- Then libghostty-vt が解析したプロトコル状態が出力される

`@native-vt`
## Scenario: 長い grapheme cluster を安全に解析する

- Given vt-pty で16 codepointを超える grapheme cluster を出力する
- When 子プロセスの出力が落ち着くまで待つ
- Then 長い grapheme cluster のプロトコル状態が出力される

`@native-vt`
## Scenario: 子プロセスの timeout を失敗として返す

- Given vt-pty の期限を超えて動く子プロセスがある
- When プロトコル検査の入口を実行する
- Then timeout は成功として扱われない

`@native-vt`
## Scenario: 子プロセスの起動失敗を返す

- Given vt-pty から起動できない子プロセスがある
- When プロトコル検査の入口を実行する
- Then 子プロセスの起動失敗は成功として扱われない
