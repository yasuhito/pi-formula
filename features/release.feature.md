# Feature: 承認付きで pi-formula を公開する

保守者は秘密情報を残さず、版と配布物を確認してから pi-formula を公開します。公開の各段階で承認と検査結果を確認し、失敗した手順は進めません。

公開物が承認済みの GitHub リリースに由来することを、リリースノートと provenance から確認できます。

## Scenario: 初回公開手順は1Passwordのop runを使う

- Given 初回 npm 公開の手順がある
- When 1Password から npm 認証情報を渡す方法を調べる
- Then 初回公開手順は1Passwordのop runを使う

## Scenario: 初回公開手順はtokenとOTPの秘密参照を使う

- Given 初回 npm 公開の手順がある
- When 1Password から npm 認証情報を渡す方法を調べる
- Then 初回公開手順はtokenとOTPの秘密参照を使う

## Scenario: 初回公開スクリプトはshell traceを止める

- Given 初回 npm 公開の手順がある
- When 1Password から npm 認証情報を渡す方法を調べる
- Then 初回公開スクリプトはshell traceを止める

## Scenario: 初回公開スクリプトは一時npmrcを作って終了時に削除する

- Given 初回 npm 公開の手順がある
- When 1Password から npm 認証情報を渡す方法を調べる
- Then 初回公開スクリプトは一時npmrcを作って終了時に削除する

## Scenario: 初回公開スクリプトは秘密の値を表示する指定を使わない

- Given 初回 npm 公開の手順がある
- When 1Password から npm 認証情報を渡す方法を調べる
- Then 初回公開スクリプトは秘密の値を表示する指定を使わない

## Scenario: 初回Releaseを手動で起動できる

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseを手動で起動できる

## Scenario: 初回Releaseジョブは手動起動時だけ動く

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseジョブは手動起動時だけ動く

## Scenario: 二つのタグ公開ジョブはpush時だけ動く

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 二つのタグ公開ジョブはpush時だけ動く

## Scenario: 初回Releaseはnpm公開を確認してからタグを作る

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseはnpm公開を確認してからタグを作る

## Scenario: 初回Releaseは同じ版の遠隔タグを作る

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseは同じ版の遠隔タグを作る

## Scenario: 初回Releaseは同じ版のGitHub Releaseを作る

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseは同じ版のGitHub Releaseを作る

## Scenario: 初回Releaseの題名には同じ版が含まれる

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseの題名には同じ版が含まれる

## Scenario: 初回Releaseの本文には作成したリリースノートを使う

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseの本文には作成したリリースノートを使う

## Scenario: 初回Releaseはnpmへ再公開しない

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseはnpmへ再公開しない

## Scenario: 初回Releaseのタグ作成はタグ公開処理を再起動しないと案内される

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回Releaseのタグ作成はタグ公開処理を再起動しないと案内される

## Scenario: 初回版には由来証明がない例外が案内される

- Given 初回版が 1Password で npm に公開済みである
- When 初回版の遠隔タグと Release を作る経路を調べる
- Then 初回版には由来証明がない例外が案内される

## Scenario: 再圧縮された npm 公開物を検証済み tarball と照合する

- Given 同じ tar ストリームを異なる圧縮レベルで gzip にした二つの tarball がある
- When tarball の中身を照合する
- Then tarball の中身は一致する

## Scenario: 版が異なるタグの公開準備は終了コード1を返す

- Given package.json と異なる版の公開タグがある
- When 公開準備を実行する
- Then 版が異なるタグの公開準備は終了コード1を返す

## Scenario: 公開準備はpackageの版とタグの不一致を表示する

- Given package.json と異なる版の公開タグがある
- When 公開準備を実行する
- Then 公開準備はpackageの版とタグの不一致を表示する

## Scenario: 版が異なるタグの公開準備では配布ファイルを作らない

- Given package.json と異なる版の公開タグがある
- When 公開準備を実行する
- Then 版が異なるタグの公開準備では配布ファイルを作らない

## Scenario: 版が一致する公開準備は正常終了する

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then 版が一致する公開準備は正常終了する

## Scenario: 公開準備コマンドは全チェックを通してから配布物を作る

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then 公開準備コマンドは全チェックを通してから配布物を作る

## Scenario: 公開準備では同じ版のtarballとリリースノートが用意される

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then 公開準備では同じ版のtarballとリリースノートが用意される

## Scenario: 公開workflowは公開準備コマンドを使う

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then 公開workflowは公開準備コマンドを使う

## Scenario: 公開workflowは版のタグpushで起動する

- Given npm 公開用の GitHub Actions がある
- When 公開ジョブの権限と環境を調べる
- Then 公開workflowは版のタグpushで起動する

## Scenario: 公開workflowは承認用のnpm環境を使う

- Given npm 公開用の GitHub Actions がある
- When 公開ジョブの権限と環境を調べる
- Then 公開workflowは承認用のnpm環境を使う

## Scenario: npm環境で許可する操作はnpm publishと案内される

- Given npm 公開用の GitHub Actions がある
- When 公開ジョブの権限と環境を調べる
- Then npm環境で許可する操作はnpm publishと案内される

## Scenario: 公開workflowにはOIDCのtoken発行権限がある

- Given npm 公開用の GitHub Actions がある
- When 公開ジョブの権限と環境を調べる
- Then 公開workflowにはOIDCのtoken発行権限がある

## Scenario: npm公開では由来証明を付ける

- Given npm 公開用の GitHub Actions がある
- When 公開ジョブの権限と環境を調べる
- Then npm公開では由来証明を付ける

## Scenario: 公開workflowにはnpm tokenを設定しない

- Given npm 公開用の GitHub Actions がある
- When 公開ジョブの権限と環境を調べる
- Then 公開workflowにはnpm tokenを設定しない

## Scenario: リリースノートは同じ版のCHANGELOGの本文と一致する

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then リリースノートは同じ版のCHANGELOGの本文と一致する

## Scenario: Releaseの題名にはpackageの版が含まれる

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then Releaseの題名にはpackageの版が含まれる

## Scenario: Releaseの本文には同じ版のリリースノートを使う

- Given package.json と同じ版の公開タグがある
- When 公開準備を実行する
- Then Releaseの本文には同じ版のリリースノートを使う

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

## Scenario: 公開後にnpmの版を確認する手順がある

- Given 継続公開の運用手順がある
- When 公開後と公開失敗時の手順を調べる
- Then 公開後にnpmの版を確認する手順がある

## Scenario: 公開後に遠隔タグを確認する手順がある

- Given 継続公開の運用手順がある
- When 公開後と公開失敗時の手順を調べる
- Then 公開後に遠隔タグを確認する手順がある

## Scenario: 公開後にGitHub Releaseを確認する手順がある

- Given 継続公開の運用手順がある
- When 公開後と公開失敗時の手順を調べる
- Then 公開後にGitHub Releaseを確認する手順がある

## Scenario: 公開後に由来証明を確認する手順がある

- Given 継続公開の運用手順がある
- When 公開後と公開失敗時の手順を調べる
- Then 公開後に由来証明を確認する手順がある

## Scenario: 外部条件が不足した公開は再試行しないと案内される

- Given 継続公開の運用手順がある
- When 公開後と公開失敗時の手順を調べる
- Then 外部条件が不足した公開は再試行しないと案内される

## Scenario: 公開条件の不足を報告する手順がある

- Given 継続公開の運用手順がある
- When 公開後と公開失敗時の手順を調べる
- Then 公開条件の不足を報告する手順がある
