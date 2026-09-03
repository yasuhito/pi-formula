# Feature: libghostty-vt で画像経路のプロトコル状態を検査する

pi-formula の worker として
不安定な native 依存を通常の検査から分離しながら
画像経路のプロトコル状態を決定的に検査したい

## Scenario: native ツールがない環境ではプロトコル検査を skip する

- Given vt-pty がない環境がある
- When プロトコル検査の入口を実行する
- Then 成功として skip したことが出力される

## Scenario: Pi を通した検査も native ツールがない環境では skip する

- Given vt-pty がない環境がある
- When Pi を通したプロトコル検査を実行する
- Then Pi を通した検査を成功として skip したことが出力される

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

## Scenario: Pi を通した本文セルの APC 断片を検出する

- Given 本文セルに APC の断片を返す vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then 本文セルの APC 断片を検出して失敗する

## Scenario: Pi の描画が落ち着かない場合は理由を返す

- Given 描画が落ち着かない vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then 描画が落ち着かない理由が出力される

`@native-vt`
## Scenario: Pi を通した表示数式の placeholder セルは汚れていない

- Given 保存済みコーパスセッションを Pi で開く
- When Pi を通したプロトコル検査を実行する
- Then placeholder セルの汚れがないと報告される

`@native-vt`
## Scenario: Pi を通した本文セルに APC の断片がない

- Given 保存済みコーパスセッションを Pi で開く
- When Pi を通したプロトコル検査を実行する
- Then 本文セルに APC の断片がないと報告される

`@native-vt`
## Scenario: 表示数式ごとに storage の image を持つ仮想配置がある

- Given 保存済みコーパスセッションを Pi で開く
- When Pi を通したプロトコル検査を実行する
- Then 表示数式と storage 付き仮想配置の数が一致する

`@native-vt`
## Scenario: placeholder セルの SGR 汚染を退行として検出する

- Given 下線色をセミコロン形式へ戻した pi-formula がある
- When Pi を通したプロトコル検査を実行する
- Then placeholder セルの汚れを検出して失敗する
