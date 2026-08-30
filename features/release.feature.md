# Feature: 承認付きで pi-formula を公開する

pi-formula の保守者として
秘密情報を残さず、版と配布物を確認してから公開したい
公開物が承認済みの GitHub リリースに由来すると確認したい

## Scenario: 初回公開の秘密情報を 1Password から一時的に渡す

- Given 初回 npm 公開の手順がある
- When 1Password から npm 認証情報を渡す方法を調べる
- Then 秘密情報を表示もログ保存もせず初回公開できる

## Scenario: 初回版の遠隔タグと GitHub Release を npm の再公開なしで作る

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then タグ push 用の公開処理と競合せず初回版を完了できる

## Scenario: タグと package.json の版が異なる公開を止める

- Given package.json と異なる版の公開タグがある
- When 公開準備を実行する
- Then 公開準備は tarball を作らず失敗する

## Scenario: 公開前に全チェック済みの tarball を再確認する

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then 全チェック後の tarball と CHANGELOG の箇条書きが公開用に用意される

## Scenario: 人間の承認後に信頼された公開を実行する

- Given npm 公開用の GitHub Actions がある
- When 公開ジョブの権限と環境を調べる
- Then 人間の承認、npm の信頼された公開、由来証明が必須になっている

## Scenario: GitHub Release を CHANGELOG と同じ内容で作る

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then Release の題名と本文は同じ版の CHANGELOG に一致する

## Scenario: 似た版の CHANGELOG 見出しを現在の版として扱わない

- Given CHANGELOG に現在の版から始まる別の版だけがある
- When 現在の版の Release 本文を取り出す
- Then 現在の版の Release 本文は見つからない

## Scenario: 複数行の CHANGELOG 箇条書きを保持する

- Given CHANGELOG に継続行を持つ箇条書きと次の箇条書きがある
- When その版の Release 本文を取り出す
- Then 継続行と次の箇条書きが同じ順で保持される

## Scenario: 空の CHANGELOG 箇条書きを拒否する

- Given CHANGELOG の版に空の箇条書きしかない
- When その版の Release 本文を取り出す
- Then Release 本文は見つからない

## Scenario: 公開後の対応と外部サービス停止時の対応を確認する

- Given 継続公開の運用手順がある
- When 公開後と公開失敗時の手順を調べる
- Then npm、タグ、Release、由来証明を確認し外部条件不足では再試行せず報告できる
