# Issue tracker: GitHub

このリポジトリの課題と仕様は GitHub Issues で管理する。すべての操作には `gh` CLI を使う。

## 操作

- 作成: `gh issue create --title "..." --body "..."`
- 読み取り: `gh issue view <number> --comments`
- 一覧: `gh issue list --state open --json number,title,body,labels,comments`
- コメント: `gh issue comment <number> --body "..."`
- ラベル: `gh issue edit <number> --add-label "..."`
- 完了: `gh issue close <number> --comment "..."`

リポジトリは `git remote -v` から判断する。「issue tracker へ公開」は GitHub Issue の作成を意味する。

## Pull Request

外部 Pull Request は triage の依頼受付面として扱わない。Issue と Pull Request は同じ番号空間を使うため、種類が不明な番号は `gh pr view` と `gh issue view` で確認する。

## 子Issueと依存関係

複数の作業へ分ける場合は GitHub の子Issueを使う。作業順は GitHub の依存関係で表し、依存関係を使えない場合だけIssue本文の `Blocked by:` 行へ記録する。未完了の依存先がなく、担当者がいないIssueを次の作業候補とする。

## 実装契約

自動実装に渡す issue の本文には、次の節を置く。

- `## What to build`: 何をどう変えるか
- `## Acceptance criteria`: 検証できる条件のチェックリスト
- `## Out of scope`（任意）: この issue でやらないこと

## 自動化ループのラベル

| label | 意味 |
| --- | --- |
| `agent:implement` | `ready-for-agent` と併用すると、issue coordinator が worker に渡す |
| `agent:in-progress` | worker が実装中 |
| `agent:waiting-dependency` | 依存 issue の完了待ち。依存がすべて閉じると自動で `agent:implement` に戻る |
| `agent:blocked` | 自動処理を停止。原因を人間が確認するまで再実行しない |
| `agent:review` | PR がレビュー待ち |
| `agent:reviewing` | PR reviewer がレビュー中 |

automation の定義は `docs/agents/automations/` を参照する。
