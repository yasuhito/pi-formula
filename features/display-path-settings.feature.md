# Feature: 表示経路の指定を保存する

表示経路を手動で指定すると、その指定を現在のセッションに記録します。

必要に応じて、既定の設定を保存できます。`--default` を付けた指定だけを全体の設定ファイルへ保存し、`/formula auto --default` で表示経路だけを持つ設定ファイルを削除します。

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
