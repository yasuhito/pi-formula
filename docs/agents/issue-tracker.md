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
